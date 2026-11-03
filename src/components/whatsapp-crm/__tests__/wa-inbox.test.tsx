import { beforeAll, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { useState } from "react"
import { WaChatList } from "../wa/WaChatList"
import { WaFilterBar } from "../wa/WaFilterBar"
import { WaTicks } from "../wa/WaBits"
import type { InboxCriteria, WaConversation, WaLabel, WaSavedFilter } from "@/types/whatsapp-crm.types"

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})
vi.mock("next/link", () => ({ default: ({ children, href, ...r }: { children: React.ReactNode; href: string }) => <a href={href} {...r}>{children}</a> }))

const conv = (over: Partial<WaConversation> = {}): WaConversation => ({
  id: "c1", status: "OPEN", assigned_to: null, unread_count: 0, last_message_at: new Date().toISOString(), last_message_preview: "hi",
  last_message_direction: "INBOUND", last_inbound_at: new Date().toISOString(), window_open: true, contact_id: "ct1", wa_id: "919876543210",
  phone: "9876543210", bsuid: null, wa_username: null, profile_name: "Rahul Das", source: "ORGANIC", marketing_consent: "UNKNOWN",
  customer_id: null, customer_name: null, assigned_name: null, labels: [], bot_state: "BOT", bot_paused_until: null, bot_handoff_reason: null, ...over,
})
const labels: WaLabel[] = [
  { id: "l-meta", name: "Meta Ad", color: "#1877F2" },
  { id: "l-ig", name: "Instagram Ad", color: "#C13584" },
  { id: "l-vip", name: "VIP", color: "#CA8A04" },
] as WaLabel[]

function Harness({ initial = {}, saved = [], onSave = vi.fn(), onDelete = vi.fn(), conversations = [conv()] }: { initial?: InboxCriteria; saved?: WaSavedFilter[]; onSave?: (n: string, c: InboxCriteria) => void; onDelete?: (id: string) => void; conversations?: WaConversation[] }) {
  const [criteria, setCriteria] = useState<InboxCriteria>(initial)
  const [open, setOpen] = useState(false)
  const props = { criteria, onChange: setCriteria, labels, agents: [], saved, onSave, onDeleteSaved: onDelete, open, onOpenChange: setOpen }
  return (
    <div>
      <output data-testid="criteria">{JSON.stringify(criteria)}</output>
      <WaChatList
        conversations={conversations} isLoading={false} selectedId={null} onSelect={() => {}} search="" onSearch={() => {}} filtersActive={Object.keys(criteria).length > 0}
        onClearFilters={() => setCriteria({})} filterButton={<WaFilterBar {...props} part="button" />} chips={<WaFilterBar {...props} part="chips" />}
        canBulk={false} agents={[]} checked={new Set()} onToggleChecked={() => {}} onClearChecked={() => {}} onBulkAssign={() => {}} bulkPending={false} showBack={false}
      />
    </div>
  )
}
const crit = () => JSON.parse(screen.getByTestId("criteria").textContent || "{}")

describe("WaChatList rows", () => {
  it("shows unread badge, ticks for our last message, Meta Ad + label chips", () => {
    render(
      <Harness
        conversations={[
          conv({ id: "a", profile_name: "Rohit", unread_count: 3, source: "META_AD", labels: [labels[0], labels[1]] as never }),
          conv({ id: "b", profile_name: "Sent One", last_message_direction: "OUTBOUND", last_message_status: "READ" }),
        ]}
      />,
    )
    expect(screen.getByLabelText("3 unread")).toBeInTheDocument()
    expect(screen.getByLabelText("Read")).toBeInTheDocument() // blue double tick on our last message
    expect(screen.getAllByText("Meta Ad")).toHaveLength(1) // source badge only; the identical auto label is not repeated
    expect(screen.getByText("Instagram Ad")).toBeInTheDocument()
  })

  it("explains an empty filtered list and offers to show everything", () => {
    render(<Harness initial={{ unread: true }} conversations={[]} />)
    expect(screen.getByText("No chats match these filters.")).toBeInTheDocument()
    fireEvent.click(screen.getByText("Show all chats"))
    expect(crit()).toEqual({})
  })
})

describe("WaTicks", () => {
  it("maps each delivery state to its own mark", () => {
    const { rerender } = render(<WaTicks status="SENT" />)
    expect(screen.getByLabelText("Sent")).toBeInTheDocument()
    rerender(<WaTicks status="DELIVERED" />)
    expect(screen.getByLabelText("Delivered")).toBeInTheDocument()
    rerender(<WaTicks status="READ" />)
    expect(screen.getByLabelText("Read")).toBeInTheDocument()
    rerender(<WaTicks status="FAILED" />)
    expect(screen.getByLabelText("Failed")).toBeInTheDocument()
    rerender(<WaTicks status="RECEIVED" />)
    expect(screen.queryByRole("img")).toBeNull()
  })
})

describe("WaFilterBar", () => {
  it("chips set exactly their criteria and the active chip is highlighted", () => {
    render(<Harness />)
    expect(screen.getByRole("tab", { name: "All" })).toHaveAttribute("aria-selected", "true")
    fireEvent.click(screen.getByRole("tab", { name: "Unread" }))
    expect(crit()).toEqual({ unread: true })
    expect(screen.getByRole("tab", { name: "Unread" })).toHaveAttribute("aria-selected", "true")
    fireEvent.click(screen.getByRole("tab", { name: "Meta ads" }))
    expect(crit()).toEqual({ source: "META_AD" }) // replaces, not stacks
    fireEvent.click(screen.getByRole("tab", { name: "Mine" }))
    expect(crit()).toEqual({ assignedTo: "me" })
  })

  it("the panel builds a custom filter (status + Meta tag + period) and counts what is on", () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole("button", { name: "Filters" }))
    fireEvent.click(screen.getByRole("radio", { name: "Pending" }))
    fireEvent.click(screen.getByRole("checkbox", { name: "Instagram Ad" }))
    fireEvent.click(screen.getByRole("radio", { name: "7 days" }))
    expect(crit()).toEqual({ status: "PENDING", labelIds: ["l-ig"], days: 7 })
    expect(screen.getByRole("button", { name: "Filters (3 on)" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /Custom · 3/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("checkbox", { name: "Instagram Ad" }))
    expect(crit()).toEqual({ status: "PENDING", days: 7 })
  })

  it("saves the custom filter under a name, and Save is disabled until there is a name", async () => {
    const onSave = vi.fn()
    render(<Harness onSave={onSave} />)
    fireEvent.click(screen.getByRole("button", { name: "Filters" }))
    fireEvent.click(screen.getByRole("checkbox", { name: "Instagram Ad" }))
    const save = screen.getByRole("button", { name: "Save" })
    expect(save).toBeDisabled()
    fireEvent.change(screen.getByLabelText("Name for this filter"), { target: { value: "Hot Insta" } })
    fireEvent.click(save)
    await waitFor(() => expect(onSave).toHaveBeenCalledWith("Hot Insta", { labelIds: ["l-ig"] }))
  })

  it("saved filters appear as chips, apply on click and can be deleted", () => {
    const onDelete = vi.fn()
    const saved: WaSavedFilter[] = [{ id: "s1", name: "Insta leads", criteria: { labelIds: ["l-ig"], unread: true }, created_at: "" }]
    render(<Harness saved={saved} onDelete={onDelete} />)
    fireEvent.click(screen.getByRole("tab", { name: /Insta leads/ }))
    expect(crit()).toEqual({ labelIds: ["l-ig"], unread: true })
    expect(screen.getByRole("tab", { name: /Insta leads/ })).toHaveAttribute("aria-selected", "true")
    fireEvent.click(within(screen.getByRole("tablist")).getByLabelText("Delete this saved filter"))
    expect(onDelete).toHaveBeenCalledWith("s1")
  })

  it("Clear all resets everything", () => {
    render(<Harness initial={{ unread: true, source: "META_AD" }} />)
    fireEvent.click(screen.getByRole("button", { name: "Filters (2 on)" }))
    fireEvent.click(screen.getByText("Clear all"))
    expect(crit()).toEqual({})
  })
})
