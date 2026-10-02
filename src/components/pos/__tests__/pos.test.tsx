import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import type { Board, OrderDetail, PosLine } from "@/types/pos.types"

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: ReactNode }) => <a href={href} {...r}>{children}</a> }))

const api = { getBoard: vi.fn(), scan: vi.fn() }
vi.mock("@/services/pos.service", async (orig) => ({
  ...(await orig<object>()),
  getBoard: (...a: unknown[]) => api.getBoard(...a),
  scan: (...a: unknown[]) => api.scan(...a),
}))

import PosBoardPage from "@/app/(dashboard)/pos/page"
import { BoardCardView } from "../BoardCard"
import { LineRow } from "../LineRow"
import { ScanBox } from "../ScanBox"
import { formatWaiting, progressFor, remainingFor, scanFeedback } from "../pos-helpers"

beforeAll(() => { Element.prototype.scrollIntoView = vi.fn() })
beforeEach(() => vi.clearAllMocks())

const wrap = (ui: ReactNode) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

const line = (o: Partial<PosLine> = {}): PosLine => ({
  id: "l1", name: "Rice 5kg", unit: "1 unit", imageUrl: null, barcode: "890", sku: "R5", required: 2, picked: 0, packed: 0, packTarget: null, status: "PENDING",
  missingNote: null, decision: null, decisionNote: null, ...o,
})
const card = (o = {}) => ({
  id: "o1", orderNumber: "A100", lane: "NEW" as const, since: null, waitingMinutes: 7, late: false, items: { lines: 2, units: 3 }, picker: null, packer: null, rider: null,
  area: "Salt Lake", slot: null, packages: 1, progress: null, flags: { missing: false, printFailed: false, paymentFailed: false }, ...o,
})

describe("pos helpers", () => {
  it("formats waiting times", () => {
    expect(formatWaiting(null)).toBe("—")
    expect(formatWaiting(0)).toBe("under 1 min")
    expect(formatWaiting(7)).toBe("7 min")
    expect(formatWaiting(65)).toBe("1 h 5 min")
    expect(formatWaiting(120)).toBe("2 h")
  })
  it("works out what is left to do at each stage", () => {
    expect(remainingFor(line({ picked: 1 }), "PICK")).toBe(1)
    expect(remainingFor(line({ status: "MISSING" }), "PICK")).toBe(0)
    expect(remainingFor(line({ packTarget: 2, packed: 1 }), "PACK")).toBe(1)
    expect(remainingFor(line({ packTarget: null }), "PACK")).toBe(0)
  })
  it("counts progress, treating a removed line as done at what was already picked", () => {
    expect(progressFor([line({ picked: 1 })], "PICK")).toEqual({ done: 1, total: 2 })
    expect(progressFor([line({ status: "RESOLVED", decision: "REMOVE", picked: 1 })], "PICK")).toEqual({ done: 1, total: 1 })
    expect(progressFor([line({ packTarget: 2, packed: 2 })], "PACK")).toEqual({ done: 2, total: 2 })
  })
  it("makes a wrong scan loud", () => {
    expect(scanFeedback({ code: "WRONG_ITEM", message: "That item is not on this order." }, "PICK")).toMatchObject({ tone: "bad", title: "WRONG ITEM" })
    expect(scanFeedback({ ok: true, line: { name: "Rice", picked: 1, packed: 0, required: 2 } }, "PICK")).toMatchObject({ tone: "ok", detail: "1 of 2 picked" })
  })
})

describe("board card", () => {
  it("links to the order and flags late and problem orders", () => {
    wrap(<BoardCardView card={card({ late: true, flags: { missing: true, printFailed: true, paymentFailed: false } })} />)
    expect(screen.getByRole("link")).toHaveAttribute("href", "/pos/orders/o1")
    expect(screen.getByText("Item missing")).toBeInTheDocument()
    expect(screen.getByText("Print failed")).toBeInTheDocument()
    expect(screen.getByText(/late/)).toBeInTheDocument()
  })
  it("does not talk about packages before the order is packed", () => {
    wrap(<BoardCardView card={card({ lane: "PICKING" })} />)
    expect(screen.queryByText(/package/)).toBeNull()
    wrap(<BoardCardView card={card({ lane: "READY", packages: 2, orderNumber: "B200" })} />)
    expect(screen.getByText(/2 packages/)).toBeInTheDocument()
  })
})

describe("line row", () => {
  const base = { stage: "PICK" as const, canWork: true, canDecide: false, busy: false, onConfirm: vi.fn(), onMissing: vi.fn(), onDecide: vi.fn() }
  it("confirms by hand, one or all", () => {
    const onConfirm = vi.fn()
    wrap(<LineRow {...base} line={line()} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByText("Confirm 1 by hand"))
    fireEvent.click(screen.getByText("Confirm all 2"))
    expect(onConfirm).toHaveBeenNthCalledWith(1)
    expect(onConfirm).toHaveBeenNthCalledWith(2, 2)
  })
  it("reports a missing item with a note", () => {
    const onMissing = vi.fn()
    wrap(<LineRow {...base} line={line()} onMissing={onMissing} />)
    fireEvent.click(screen.getByText("Can’t find it"))
    fireEvent.change(screen.getByLabelText("Note about the missing item"), { target: { value: "shelf empty" } })
    fireEvent.click(screen.getByText("Report missing"))
    expect(onMissing).toHaveBeenCalledWith("shelf empty")
  })
  it("offers the manager's decision only on a missing line and only to managers", () => {
    const onDecide = vi.fn()
    const { unmount } = wrap(<LineRow {...base} line={line({ status: "MISSING" })} />)
    expect(screen.queryByText("Decide what to do")).toBeNull()
    unmount()
    wrap(<LineRow {...base} canDecide line={line({ status: "MISSING" })} onDecide={onDecide} />)
    fireEvent.click(screen.getByText("Decide what to do"))
    fireEvent.click(screen.getByText("Refund the item"))
    expect(onDecide).toHaveBeenCalledWith("REFUND", "")
  })
  it("offers nothing to someone who may not work this stage", () => {
    wrap(<LineRow {...base} canWork={false} line={line()} />)
    expect(screen.queryByText(/Confirm/)).toBeNull()
    expect(screen.queryByText("Can’t find it")).toBeNull()
  })
})

describe("scan box", () => {
  it("shows the good result, then a loud wrong-item banner", async () => {
    api.scan.mockResolvedValueOnce({ ok: true, line: { id: "l1", name: "Rice 5kg", required: 2, picked: 1, packed: 0, status: "PENDING" } })
    wrap(<ScanBox orderId="o1" stage="PICK" />)
    const input = screen.getByLabelText("Scan a barcode")
    fireEvent.change(input, { target: { value: "890" } })
    fireEvent.submit(input.closest("form")!)
    expect(await screen.findByText(/Rice 5kg/)).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("1 of 2 picked")
    expect(api.scan).toHaveBeenCalledWith("o1", "PICK", "890")
    expect(input).toHaveValue("")

    api.scan.mockRejectedValueOnce({ response: { data: { code: "WRONG_ITEM", message: "That item is not on this order. Put it back." } } })
    fireEvent.change(input, { target: { value: "999" } })
    fireEvent.submit(input.closest("form")!)
    expect(await screen.findByText("WRONG ITEM")).toBeInTheDocument()
    expect(screen.getByRole("alert")).toHaveTextContent("Put it back")
  })
  it("ignores an empty scan", () => {
    wrap(<ScanBox orderId="o1" stage="PACK" />)
    fireEvent.submit(screen.getByLabelText("Scan a barcode").closest("form")!)
    expect(api.scan).not.toHaveBeenCalled()
  })
})

describe("board page", () => {
  const board = (): Board => ({
    lanes: [
      { id: "NEW", label: "New", orders: [card(), card({ id: "o2", orderNumber: "B200", late: true })] },
      { id: "PICKING", label: "Picking", orders: [] },
    ] as Board["lanes"],
    deliveredLast24h: 4, printing: { printers: 1, online: 0, queued: 2, failed: 1 }, totals: { active: 2, late: 1 },
  })
  it("shows totals, lanes and filters by order number", async () => {
    api.getBoard.mockResolvedValue(board())
    wrap(<PosBoardPage />)
    expect(await screen.findByText("#A100")).toBeInTheDocument()
    expect(screen.getByText("#B200")).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent(/2\s*active\s*1\s*late\s*4\s*delivered in 24 h/)
    expect(screen.getByText(/0\/1 online/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Find order number"), { target: { value: "b2" } })
    await waitFor(() => expect(screen.queryByText("#A100")).toBeNull())
    expect(screen.getByText("#B200")).toBeInTheDocument()
  })
  it("says so when the board cannot load", async () => {
    api.getBoard.mockRejectedValue(new Error("boom"))
    wrap(<PosBoardPage />)
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the board")
  })
})

// type-only guard: the detail shape the work screen relies on
const _detail: Pick<OrderDetail, "can" | "blockers"> | null = null
void _detail
