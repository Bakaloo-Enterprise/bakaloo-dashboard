import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import type { ChatChannel, ChatMessage } from "@/types/team-chat.types"

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: ReactNode }) => <a href={href} {...r}>{children}</a> }))
vi.mock("@/hooks/useShops", () => ({ // the real hook returns a Paginated<Shop> ({ items, pagination }), not a bare array — and nothing while loading
  useActiveShopsForSwitcher: () => ({ data: { items: [{ id: "s1", name: "Salt Lake" }, { id: "s2", name: "Howrah" }], pagination: { page: 1, limit: 100, total: 2, totalPages: 1 } } }) }))

const api = { getChatPeople: vi.fn(), searchChatRefs: vi.fn(), removeChatMember: vi.fn(), addChatMembers: vi.fn(), setChatArchived: vi.fn(), updateChatChannel: vi.fn(), refreshChatAudience: vi.fn() }
vi.mock("@/services/team-chat.service", async (orig) => ({
  ...(await orig<object>()),
  getChatPeople: (...a: unknown[]) => api.getChatPeople(...a),
  searchChatRefs: (...a: unknown[]) => api.searchChatRefs(...a),
  removeChatMember: (...a: unknown[]) => api.removeChatMember(...a),
  addChatMembers: (...a: unknown[]) => api.addChatMembers(...a),
  setChatArchived: (...a: unknown[]) => api.setChatArchived(...a),
  updateChatChannel: (...a: unknown[]) => api.updateChatChannel(...a),
  refreshChatAudience: (...a: unknown[]) => api.refreshChatAudience(...a),
}))

import { ChannelList } from "../ChannelList"
import { ChannelSettings } from "../ChannelSettings"
import { ChatThread } from "../ChatThread"
import { NewChatDialog } from "../NewChatDialog"
import { activeMention, dayLabel, extractMentions, initials, refHref, splitMentions, startsBlock, suggestPeople } from "../chat-helpers"

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
})
const wrap = (ui: ReactNode) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>)

const ME = "me-id"
const ASHA = { id: "u-asha", name: "Asha" }
const ASHA_S = { id: "u-asha-s", name: "Asha Sharma" }
const BALA = { id: "u-bala", name: "Bala" }
const HINDI = { id: "u-hi", name: "रवि कुमार" }

const abilities = (o = {}) => ({ send: true, rename: false, manageMembers: false, leave: false, archive: false, unarchive: false, refreshAudience: false, ...o })
const channel = (o: Partial<ChatChannel> = {}): ChatChannel => ({
  id: "c1", kind: "GROUP", name: "Store pickers", description: null, archived: false, last_message_at: null, created_at: "", my_role: "MEMBER", member_count: 3,
  members: [{ user_id: ME, role: "MEMBER", name: "Me Myself", is_active: true, platform_role: null }, { user_id: ASHA.id, role: "OWNER", name: "Asha", is_active: true, platform_role: null }, { user_id: BALA.id, role: "MEMBER", name: "Bala", is_active: true, platform_role: "ADMIN" }],
  abilities: abilities(), ...o,
})
const msg = (o: Partial<ChatMessage> = {}): ChatMessage => ({ id: "m1", seq: 1, channel_id: "c1", sender_id: ASHA.id, sender_name: "Asha", body: "hello", ref: null, mentions: [], deleted: false, created_at: "2026-10-02T06:00:00Z", ...o })

describe("mention helpers", () => {
  it("extracts only people actually mentioned", () => {
    expect(extractMentions("hi @Bala and @Nobody", [ASHA, BALA])).toEqual([BALA.id])
  })
  it("prefers the longer name and does not double-count its prefix", () => {
    expect(extractMentions("ping @Asha Sharma please", [ASHA, ASHA_S])).toEqual([ASHA_S.id])
    expect(extractMentions("ping @Asha and @Asha Sharma", [ASHA, ASHA_S]).sort()).toEqual([ASHA.id, ASHA_S.id].sort())
  })
  it("does not match inside a longer word, and works for non-Latin names", () => {
    expect(extractMentions("@Balaji is here", [BALA])).toEqual([])
    expect(extractMentions("@रवि कुमार देखो", [HINDI])).toEqual([HINDI.id])
  })
  it("splits a message into plain and highlighted parts", () => {
    expect(splitMentions("hey @Bala, look @Asha", [BALA.id], [ASHA, BALA])).toEqual([
      { text: "hey ", mention: false }, { text: "@Bala", mention: true }, { text: ", look @Asha", mention: false },
    ])
    expect(splitMentions("no mentions", [], [ASHA])).toEqual([{ text: "no mentions", mention: false }])
  })
  it("finds the @word being typed at the caret", () => {
    expect(activeMention("hello @As", 9)).toEqual({ query: "As", start: 6 })
    expect(activeMention("email a@b.com", 13)).toBeNull()
    expect(activeMention("done @Asha  ", 12)).toBeNull()
  })
  it("suggests by substring, capped", () => {
    expect(suggestPeople([ASHA, ASHA_S, BALA], "ash").map((p) => p.id)).toEqual([ASHA.id, ASHA_S.id])
  })
})

describe("other helpers", () => {
  it("links shared items to the right page", () => {
    expect(refHref({ type: "ORDER", id: "x", label: "Order ORD-12" })).toBe("/orders?search=ORD-12")
    expect(refHref({ type: "PRODUCT", id: "p1", label: "Rice" })).toBe("/products/p1")
    expect(refHref({ type: "CUSTOMER", id: "c", label: "A B" })).toBe("/customers?search=A%20B")
  })
  it("labels days and groups blocks", () => {
    const now = new Date("2026-10-02T12:00:00Z")
    expect(dayLabel("2026-10-02T01:00:00Z", now)).toBe("Today")
    expect(dayLabel("2026-10-01T01:00:00Z", now)).toBe("Yesterday")
    const a = msg({ created_at: "2026-10-02T06:00:00Z" })
    expect(startsBlock(a, msg({ id: "m2", created_at: "2026-10-02T06:02:00Z" }))).toBe(false)
    expect(startsBlock(a, msg({ id: "m2", created_at: "2026-10-02T06:20:00Z" }))).toBe(true)
    expect(startsBlock(a, msg({ id: "m2", sender_id: BALA.id }))).toBe(true)
    expect(initials("Asha Sharma Roy")).toBe("AS")
  })
})

describe("ChannelList", () => {
  it("shows unread counts, mentions and previews", () => {
    const onSelect = vi.fn()
    render(<ChannelList isLoading={false} selectedId={null} onSelect={onSelect} channels={[
      channel({ id: "a", name: "Picking", unread: 3, preview: "Where is the rice?" }),
      channel({ id: "b", name: "HQ", kind: "CHANNEL", unread: 2, unread_mentions: 1, preview: "@Me look" }),
      channel({ id: "c", name: "Quiet", unread: 0 }),
    ]} />)
    expect(screen.getByRole("button", { name: "Picking, 3 unread" })).toBeTruthy()
    expect(screen.getByText("@ 2")).toBeTruthy()
    expect(screen.getByText("Where is the rice?")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Quiet" }))
    expect(onSelect).toHaveBeenCalledWith("c")
  })
  it("has an empty state", () => {
    render(<ChannelList isLoading={false} selectedId={null} onSelect={() => {}} channels={[]} />)
    expect(screen.getByText(/No chats yet/)).toBeTruthy()
  })
})

describe("ChatThread", () => {
  const base = { meId: ME, isHq: false, canModerate: false, sending: false, onDelete: vi.fn() }
  beforeEach(() => { api.searchChatRefs.mockReset(); base.onDelete.mockReset() })

  it("shows messages, a deleted marker and a shared item link", () => {
    wrap(<ChatThread {...base} channel={channel()} isLoading={false} onSend={vi.fn()} messages={[
      msg({ body: "check this", ref: { type: "ORDER", id: "o1", label: "Order ORD-9" } }),
      msg({ id: "m2", seq: 2, body: "", deleted: true }),
    ]} />)
    expect(screen.getByText("check this")).toBeTruthy()
    expect(screen.getByText("Message deleted")).toBeTruthy()
    expect(screen.getByRole("link", { name: /Order ORD-9/ }).getAttribute("href")).toBe("/orders?search=ORD-9")
    expect(screen.getByText("Internal only — never sent to customers.")).toBeTruthy()
  })

  it("sends on Enter with the mentioned people, and Shift+Enter does not send", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined)
    wrap(<ChatThread {...base} channel={channel()} isLoading={false} onSend={onSend} messages={[]} />)
    const box = screen.getByLabelText("Message") as HTMLTextAreaElement
    fireEvent.change(box, { target: { value: "hi @Asha ok", selectionStart: 11 } })
    fireEvent.keyDown(box, { key: "Enter", shiftKey: true })
    expect(onSend).not.toHaveBeenCalled()
    fireEvent.keyDown(box, { key: "Enter" })
    await waitFor(() => expect(onSend).toHaveBeenCalledWith({ body: "hi @Asha ok", mentions: [ASHA.id] }))
    await waitFor(() => expect(box.value).toBe(""))
  })

  it("suggests members after @ and inserts the chosen name (never yourself)", () => {
    wrap(<ChatThread {...base} channel={channel()} isLoading={false} onSend={vi.fn()} messages={[]} />)
    const box = screen.getByLabelText("Message") as HTMLTextAreaElement
    fireEvent.change(box, { target: { value: "hey @", selectionStart: 5 } })
    const list = screen.getByRole("listbox", { name: "Mention someone" })
    expect(within(list).getAllByRole("option").map((o) => o.textContent)).toEqual(["Asha", "Bala"])
    fireEvent.mouseDown(within(list).getByText("Bala"))
    expect(box.value).toBe("hey @Bala ")
  })

  it("disables Send when empty, and is read-only when archived", () => {
    const { unmount } = wrap(<ChatThread {...base} channel={channel()} isLoading={false} onSend={vi.fn()} messages={[]} />)
    expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(true)
    unmount()
    wrap(<ChatThread {...base} channel={channel({ archived: true, abilities: abilities({ send: false, unarchive: true }) })} isLoading={false} onSend={vi.fn()} messages={[]} />)
    expect(screen.queryByLabelText("Message")).toBeNull()
    expect(screen.getByText(/Restore it to write here/)).toBeTruthy()
  })

  it("attaches an order and sends it with the message", async () => {
    api.searchChatRefs.mockResolvedValue([{ id: "o1", type: "ORDER", label: "Order ORD-1", hint: "CONFIRMED" }])
    const onSend = vi.fn().mockResolvedValue(undefined)
    wrap(<ChatThread {...base} channel={channel()} isLoading={false} onSend={onSend} messages={[]} />)
    fireEvent.click(screen.getByRole("button", { name: /Attach an order/ }))
    fireEvent.change(screen.getByLabelText("Search orders"), { target: { value: "ORD" } })
    fireEvent.click(await screen.findByText("Order ORD-1"))
    expect(screen.getByText("Order:", { exact: false })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Send" }))
    await waitFor(() => expect(onSend).toHaveBeenCalledWith({ body: "", mentions: [], ref: { type: "ORDER", id: "o1" } }))
  })

  it("only offers customers to HQ", () => {
    const { unmount } = wrap(<ChatThread {...base} channel={channel()} isLoading={false} onSend={vi.fn()} messages={[]} />)
    fireEvent.click(screen.getByRole("button", { name: /Attach an order/ }))
    expect(screen.queryByRole("tab", { name: "Customer" })).toBeNull()
    unmount()
    wrap(<ChatThread {...base} isHq channel={channel()} isLoading={false} onSend={vi.fn()} messages={[]} />)
    fireEvent.click(screen.getByRole("button", { name: /Attach an order/ }))
    expect(screen.getByRole("tab", { name: "Customer" })).toBeTruthy()
  })

  it("delete appears only on your own messages (or for moderators)", () => {
    const ms = [msg({ id: "a", sender_id: ME, sender_name: "Me", body: "mine" }), msg({ id: "b", seq: 2, body: "theirs" })]
    const { unmount } = wrap(<ChatThread {...base} channel={channel()} isLoading={false} onSend={vi.fn()} messages={ms} />)
    expect(screen.getAllByRole("button", { name: "Delete message" })).toHaveLength(1)
    unmount()
    wrap(<ChatThread {...base} canModerate channel={channel()} isLoading={false} onSend={vi.fn()} messages={ms} />)
    expect(screen.getAllByRole("button", { name: "Delete message" })).toHaveLength(2)
  })
})

describe("NewChatDialog", () => {
  beforeEach(() => { api.getChatPeople.mockReset(); api.getChatPeople.mockResolvedValue([{ id: "p1", name: "Bala", platform_role: null, shops: ["Howrah"] }, { id: "p2", name: "Hema", platform_role: "ADMIN", shops: [] }]) })

  it("starts a DM with one person", async () => {
    const onCreate = vi.fn()
    wrap(<NewChatDialog open canManage={false} saving={false} onClose={() => {}} onCreate={onCreate} />)
    fireEvent.click(await screen.findByLabelText(/Bala/))
    fireEvent.click(screen.getByRole("button", { name: "Open chat" }))
    expect(onCreate).toHaveBeenCalledWith({ kind: "DM", userId: "p1" })
  })

  it("a group needs a name and someone", async () => {
    const onCreate = vi.fn()
    wrap(<NewChatDialog open canManage={false} saving={false} onClose={() => {}} onCreate={onCreate} />)
    fireEvent.click(screen.getByRole("tab", { name: "Group" }))
    const create = screen.getByRole("button", { name: "Create group" }) as HTMLButtonElement
    expect(create.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText("Group name"), { target: { value: "Pickers" } })
    expect(create.disabled).toBe(true)
    fireEvent.click(await screen.findByLabelText(/Bala/)); fireEvent.click(screen.getByLabelText(/Hema/))
    fireEvent.click(create)
    expect(onCreate).toHaveBeenCalledWith({ kind: "GROUP", name: "Pickers", memberIds: ["p1", "p2"] })
  })

  it("only managers see Channel, and can pick HQ / stores as the audience", async () => {
    const { unmount } = wrap(<NewChatDialog open canManage={false} saving={false} onClose={() => {}} onCreate={() => {}} />)
    expect(screen.queryByRole("tab", { name: "Channel" })).toBeNull()
    unmount()
    const onCreate = vi.fn()
    wrap(<NewChatDialog open canManage saving={false} onClose={() => {}} onCreate={onCreate} />)
    fireEvent.click(screen.getByRole("tab", { name: "Channel" }))
    fireEvent.change(screen.getByLabelText("Channel name"), { target: { value: "HQ ↔ Salt Lake" } })
    fireEvent.click(screen.getByLabelText("All HQ staff")); fireEvent.click(screen.getByLabelText("Salt Lake"))
    fireEvent.click(screen.getByRole("button", { name: "Create channel" }))
    expect(onCreate).toHaveBeenCalledWith({ kind: "CHANNEL", name: "HQ ↔ Salt Lake", memberIds: [], audience: { hq: true, shopIds: ["s1"] } })
  })
})

describe("ChannelSettings", () => {
  beforeEach(() => { Object.values(api).forEach((f) => f.mockReset()); api.getChatPeople.mockResolvedValue([]) })

  it("a plain member of a group can only leave", () => {
    wrap(<ChannelSettings channel={channel({ abilities: abilities({ leave: true }) })} meId={ME} open onClose={() => {}} onGone={() => {}} />)
    expect(screen.getByRole("button", { name: "Leave chat" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Archive" })).toBeNull()
    expect(screen.queryByLabelText("Name")).toBeNull()
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull()
    expect(screen.getByText("Owner")).toBeTruthy()
  })

  it("an owner can rename, remove others (not themselves), archive", async () => {
    api.removeChatMember.mockResolvedValue(undefined)
    wrap(<ChannelSettings channel={channel({ my_role: "OWNER", abilities: abilities({ rename: true, manageMembers: true, archive: true, leave: true }) })} meId={ME} open onClose={() => {}} onGone={() => {}} />)
    expect(screen.getByLabelText("Name")).toBeTruthy()
    const removes = screen.getAllByRole("button", { name: "Remove" })
    expect(removes).toHaveLength(2) // Asha and Bala — never "you"
    fireEvent.click(removes[0])
    await waitFor(() => expect(api.removeChatMember).toHaveBeenCalledWith("c1", ASHA.id))
    expect(screen.getByRole("button", { name: "Archive" })).toBeTruthy()
  })

  it("managers of a channel can refresh its audience; others cannot", () => {
    const { unmount } = wrap(<ChannelSettings channel={channel({ kind: "CHANNEL", abilities: abilities({ refreshAudience: true, manageMembers: true }) })} meId={ME} open onClose={() => {}} onGone={() => {}} />)
    expect(screen.getByRole("button", { name: "Refresh people" })).toBeTruthy()
    unmount()
    wrap(<ChannelSettings channel={channel({ kind: "CHANNEL", abilities: abilities() })} meId={ME} open onClose={() => {}} onGone={() => {}} />)
    expect(screen.queryByRole("button", { name: "Refresh people" })).toBeNull()
  })
})
