import { beforeAll, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MessageThread } from "../MessageThread"
import { ConversationList } from "../ConversationList"
import { conversationHandle, conversationTitle, windowHoursLeft } from "../helpers"
import type { WaConversation, WaMessage } from "@/types/whatsapp-crm.types"

// jsdom does not implement scrollIntoView (browsers do).
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

const conv = (over: Partial<WaConversation> = {}): WaConversation => ({
  id: "c1",
  status: "OPEN",
  assigned_to: null,
  unread_count: 0,
  last_message_at: "2026-10-01T10:00:00Z",
  last_message_preview: "hi",
  last_message_direction: "INBOUND",
  last_inbound_at: new Date().toISOString(),
  window_open: true,
  contact_id: "ct1",
  wa_id: "919876543210",
  phone: "9876543210",
  bsuid: null,
  wa_username: null,
  profile_name: "Rahul Das",
  source: "ORGANIC",
  marketing_consent: "UNKNOWN",
  customer_id: null,
  customer_name: null,
  assigned_name: null,
  labels: [],
  bot_state: "BOT",
  bot_paused_until: null,
  bot_handoff_reason: null,
  ...over,
})
const msg = (over: Partial<WaMessage> = {}): WaMessage => ({
  id: "m1", direction: "INBOUND", wamid: "w1", msg_type: "text", body: "Is milk available?", media: null, interactive: null,
  template_name: null, status: "RECEIVED", error_code: null, error_title: null, error_details: null, sent_by: null, is_bot: false,
  created_at: "2026-10-01T10:00:00Z", delivered_at: null, read_at: null, ...over,
})

describe("helpers", () => {
  it("titles prefer matched customer, then profile name, then phone, then username/BSUID", () => {
    expect(conversationTitle(conv({ customer_name: "Rahul (customer)" }))).toBe("Rahul (customer)")
    expect(conversationTitle(conv())).toBe("Rahul Das")
    expect(conversationTitle(conv({ profile_name: null }))).toBe("9876543210")
    expect(conversationTitle(conv({ profile_name: null, phone: null, wa_id: null, wa_username: "priya_s" }))).toBe("@priya_s")
    expect(conversationTitle(conv({ profile_name: null, phone: null, wa_id: null, bsuid: "IN.123456" }))).toBe("IN.123456")
  })
  it("handle shows +91 phone, falling back when Meta hid the number", () => {
    expect(conversationHandle(conv())).toBe("+91 9876543210")
    expect(conversationHandle(conv({ phone: null, wa_id: null, wa_username: "priya_s" }))).toBe("@priya_s")
    // a number that is not Indian (so no 10-digit phone) is still shown, never "Unknown"
    expect(conversationTitle(conv({ profile_name: null, phone: null, wa_id: "14155550123" }))).toBe("+14155550123")
  })
  it("window hours left is 0 when closed or unknown", () => {
    const now = Date.parse("2026-10-02T00:00:00Z")
    expect(windowHoursLeft(null, now)).toBe(0)
    expect(windowHoursLeft("2026-10-01T00:00:00Z", now)).toBe(0) // exactly 24h ago
    expect(windowHoursLeft("2026-10-01T12:00:00Z", now)).toBeCloseTo(12)
  })
})

describe("MessageThread", () => {
  it("sends on Enter, trims, and clears the draft on success", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined)
    render(<MessageThread conversation={conv()} messages={[msg()]} isLoading={false} onSend={onSend} sending={false} />)
    const box = screen.getByLabelText(/reply to customer/i)
    fireEvent.change(box, { target: { value: "  Yes, in stock  " } })
    fireEvent.keyDown(box, { key: "Enter" })
    await waitFor(() => expect(onSend).toHaveBeenCalledWith("Yes, in stock"))
    await waitFor(() => expect((box as HTMLTextAreaElement).value).toBe(""))
  })

  it("Shift+Enter does not send", () => {
    const onSend = vi.fn()
    render(<MessageThread conversation={conv()} messages={[]} isLoading={false} onSend={onSend} sending={false} />)
    const box = screen.getByLabelText(/reply to customer/i)
    fireEvent.change(box, { target: { value: "line one" } })
    fireEvent.keyDown(box, { key: "Enter", shiftKey: true })
    expect(onSend).not.toHaveBeenCalled()
  })

  it("keeps the draft when sending fails", async () => {
    const onSend = vi.fn().mockRejectedValue(new Error("nope"))
    render(<MessageThread conversation={conv()} messages={[]} isLoading={false} onSend={onSend} sending={false} />)
    const box = screen.getByLabelText(/reply to customer/i) as HTMLTextAreaElement
    fireEvent.change(box, { target: { value: "important reply" } })
    fireEvent.keyDown(box, { key: "Enter" })
    await waitFor(() => expect(onSend).toHaveBeenCalled())
    expect(box.value).toBe("important reply")
  })

  it("locks the composer and explains why when the 24h window is closed", () => {
    const onSend = vi.fn()
    render(<MessageThread conversation={conv({ window_open: false })} messages={[]} isLoading={false} onSend={onSend} sending={false} />)
    const box = screen.getByLabelText(/reply to customer/i) as HTMLTextAreaElement
    expect(box.disabled).toBe(true)
    expect(screen.getByRole("button", { name: /send message/i })).toBeDisabled()
    expect(screen.getByText(/more than 24 hours/i)).toBeInTheDocument()
    expect(screen.getAllByText(/reply window closed/i).length).toBeGreaterThan(0)
  })

  it("shows why an outbound message failed", () => {
    render(
      <MessageThread
        conversation={conv()}
        messages={[msg({ id: "o1", direction: "OUTBOUND", status: "FAILED", body: "hello", error_details: "not on WhatsApp" })]}
        isLoading={false}
        onSend={vi.fn()}
        sending={false}
      />,
    )
    expect(screen.getByText(/not delivered: not on whatsapp/i)).toBeInTheDocument()
  })
})

describe("ConversationList", () => {
  const base = {
    isLoading: false, selectedId: null, onSelect: vi.fn(), search: "", onSearch: vi.fn(), status: undefined, onStatus: vi.fn(),
    owner: "", onOwner: vi.fn(), labelId: "", onLabelId: vi.fn(), labels: [], canBulk: false, agents: [],
    checked: new Set<string>(), onToggleChecked: vi.fn(), onClearChecked: vi.fn(), onBulkAssign: vi.fn(), bulkPending: false,
  }

  it("shows unread count, lead / ad / closed-window badges, and selects on click", () => {
    const onSelect = vi.fn()
    render(<ConversationList {...base} onSelect={onSelect} conversations={[conv({ unread_count: 3, source: "META_AD", window_open: false })]} />)
    expect(screen.getByText("3")).toBeInTheDocument()
    expect(screen.getByText("New lead")).toBeInTheDocument()
    expect(screen.getByText("Meta Ad")).toBeInTheDocument()
    expect(screen.getByText("24h closed")).toBeInTheDocument()
    fireEvent.click(screen.getByText("Rahul Das"))
    expect(onSelect).toHaveBeenCalledWith("c1")
  })

  it("empty state and status filter tabs", () => {
    const onStatus = vi.fn()
    render(<ConversationList {...base} onStatus={onStatus} conversations={[]} />)
    expect(screen.getByText(/no conversations yet/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("tab", { name: "Resolved" }))
    expect(onStatus).toHaveBeenCalledWith("RESOLVED")
  })
})

describe("ConversationList — Phase 3", () => {
  const base = {
    isLoading: false, selectedId: null, onSelect: vi.fn(), search: "", onSearch: vi.fn(), status: undefined, onStatus: vi.fn(),
    owner: "", onOwner: vi.fn(), labelId: "", onLabelId: vi.fn(), labels: [], canBulk: false, agents: [],
    checked: new Set<string>(), onToggleChecked: vi.fn(), onClearChecked: vi.fn(), onBulkAssign: vi.fn(), bulkPending: false,
  }
  const labelled = conv({
    assigned_name: "Agent Asha",
    labels: [
      { id: "l1", name: "VIP", color: "#CA8A04" },
      { id: "l2", name: "B2B", color: "#0F766E" },
      { id: "l3", name: "Complaint", color: "#B91C1C" },
      { id: "l4", name: "Inactive", color: "#6B7280" },
    ],
  })

  it("shows owner, up to 3 label chips and a +N overflow", () => {
    render(<ConversationList {...base} conversations={[labelled]} />)
    expect(screen.getByText("Owner: Agent Asha")).toBeInTheDocument()
    expect(screen.getByText("VIP")).toBeInTheDocument()
    expect(screen.queryByText("Inactive")).not.toBeInTheDocument()
    expect(screen.getByText("+1")).toBeInTheDocument()
  })

  it("shows Unassigned when nobody owns the chat", () => {
    render(<ConversationList {...base} conversations={[conv()]} />)
    expect(screen.getByText("Unassigned")).toBeInTheDocument()
  })

  it("hides checkboxes and the bulk bar for agents without the assign permission", () => {
    render(<ConversationList {...base} checked={new Set(["c1"])} conversations={[conv()]} />)
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
    expect(screen.queryByRole("region", { name: /bulk reassign/i })).not.toBeInTheDocument()
  })

  it("managers can tick conversations and see the bulk bar with the count", () => {
    const onToggle = vi.fn()
    const onClear = vi.fn()
    render(<ConversationList {...base} canBulk checked={new Set(["c1"])} onToggleChecked={onToggle} onClearChecked={onClear} conversations={[conv()]} />)
    expect(screen.getByText("1 selected")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("checkbox", { name: /select conversation with rahul das/i }))
    expect(onToggle).toHaveBeenCalledWith("c1")
    // Move is disabled until a target is chosen
    expect(screen.getByRole("button", { name: "Move" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Clear" }))
    expect(onClear).toHaveBeenCalled()
  })
})

describe("MessageThread — view-only", () => {
  it("a user without reply permission gets a read-only composer even inside the window", () => {
    render(<MessageThread conversation={conv()} messages={[]} isLoading={false} onSend={vi.fn()} sending={false} canSend={false} />)
    expect((screen.getByLabelText(/reply to customer/i) as HTMLTextAreaElement).disabled).toBe(true)
    expect(screen.getByText(/view-only access/i)).toBeInTheDocument()
    // the window itself is still open, so the 24h-closed warning must NOT show
    expect(screen.queryByText(/more than 24 hours/i)).not.toBeInTheDocument()
  })
  it("renders the owner control passed in the header", () => {
    render(<MessageThread conversation={conv()} messages={[]} isLoading={false} onSend={vi.fn()} sending={false} headerExtra={<span>OWNER-CTRL</span>} />)
    expect(screen.getByText("OWNER-CTRL")).toBeInTheDocument()
  })
})
