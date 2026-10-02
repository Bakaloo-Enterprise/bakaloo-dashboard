import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import type { BulkBatch, Overview, ProcurementDetail } from "@/types/business.types"

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))
vi.mock("next/dynamic", () => ({ default: () => () => <div data-testid="chart" /> }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), useParams: () => ({ id: "e1" }) }))
// Same shape as the real hook: a paginated list under `items`.
vi.mock("@/hooks/useShops", () => ({ useActiveShopsForSwitcher: () => ({ data: { items: [{ id: "s1", name: "Salt Lake" }, { id: "s2", name: "Dark Store" }] } }) }))
vi.mock("@/hooks/useProducts", () => ({ useProducts: () => ({ data: { products: [{ id: "p1", name: "Tomato" }] }, isLoading: false }) }))

const api = {
  getBizMe: vi.fn(), getVendors: vi.fn(), createEntry: vi.fn(), allocateEntry: vi.fn(), adjustEntry: vi.fn(), getUploadRows: vi.fn(), applyUpload: vi.fn(), discardUpload: vi.fn(),
  getOverview: vi.fn(), getReconciliation: vi.fn(), getTopProducts: vi.fn(),
}
vi.mock("@/services/business.service", async (orig) => ({
  ...(await orig<object>()),
  getBizMe: (...a: unknown[]) => api.getBizMe(...a), getVendors: (...a: unknown[]) => api.getVendors(...a), createEntry: (...a: unknown[]) => api.createEntry(...a),
  allocateEntry: (...a: unknown[]) => api.allocateEntry(...a), adjustEntry: (...a: unknown[]) => api.adjustEntry(...a), getUploadRows: (...a: unknown[]) => api.getUploadRows(...a),
  applyUpload: (...a: unknown[]) => api.applyUpload(...a), discardUpload: (...a: unknown[]) => api.discardUpload(...a), getOverview: (...a: unknown[]) => api.getOverview(...a),
  getReconciliation: (...a: unknown[]) => api.getReconciliation(...a), getAnalyticsReconciliation: (...a: unknown[]) => api.getReconciliation(...a), getTopProducts: (...a: unknown[]) => api.getTopProducts(...a),
}))

import BusinessAnalyticsPage from "@/app/(dashboard)/business-analytics/page"
import { AdjustDialog } from "../AdjustDialog"
import { BulkPreview } from "../BulkPreview"
import { NewPurchaseDialog } from "../NewPurchaseDialog"
import { SplitDialog } from "../SplitDialog"
import { periodProblem, toFilters, toPeriodQuery } from "../business-helpers"

beforeAll(() => { Element.prototype.scrollIntoView = vi.fn() })
beforeEach(() => {
  vi.clearAllMocks()
  api.getBizMe.mockResolvedValue({ procurementView: true, procurementManage: true, catalogBulk: true, analyticsBusiness: true })
  api.getVendors.mockResolvedValue([{ id: "v1", name: "Vendor A", phone: null, notes: null, is_active: true, created_at: "" }])
})
const wrap = (ui: ReactNode) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>)

const entry = (o: Partial<ProcurementDetail> = {}): ProcurementDetail => ({
  id: "e1", entryNo: 7, product: { id: "p1", name: "Tomato", sku: "TOM" }, vendor: { id: "v1", name: "Vendor A" }, unit: "1 kg", expectedQty: 10, receivedQty: 10, damagedQty: 0, procuredOn: "2026-10-02",
  invoiceRef: null, receivingNote: null, status: "ACTIVE", purpose: "RETAIL", destination: null, reservedFor: null, createdAt: "", usable: 10, shortage: 0, allocated: 0, centralAdjusted: 0, available: 10,
  purchaseTotal: 280, unitPrice: 28, allocations: [], adjustments: [], history: [], ...o,
})

describe("period helpers", () => {
  it("only custom ranges can be wrong", () => {
    expect(periodProblem({ period: "30d" })).toBeNull()
    expect(periodProblem({ period: "custom" })).toMatch(/both dates/)
    expect(periodProblem({ period: "custom", from: "2026-03-11", to: "2026-03-10" })).toMatch(/must not be after/)
    expect(periodProblem({ period: "custom", from: "2024-01-01", to: "2026-03-10" })).toMatch(/366/)
    expect(periodProblem({ period: "custom", from: "2026-03-10", to: "2026-03-10" })).toBeNull()
  })
  it("sends dates only for a custom range, and store / channel only when chosen", () => {
    expect(toPeriodQuery({ period: "7d", from: "x", to: "y" })).toEqual({ period: "7d" })
    expect(toFilters({ period: "today" }, "", "ALL")).toEqual({ period: "today" })
    expect(toFilters({ period: "custom", from: "2026-03-10", to: "2026-03-11" }, "s1", "B2B")).toEqual({ period: "custom", from: "2026-03-10", to: "2026-03-11", shopId: "s1", channel: "B2B" })
  })
})

describe("new purchase dialog", () => {
  it("shows the total and the shortage, blocks an incomplete form, then sends exactly what was typed", async () => {
    api.createEntry.mockResolvedValue(entry())
    const onCreated = vi.fn()
    wrap(<NewPurchaseDialog open onOpenChange={() => undefined} onCreated={onCreated} />)
    const submit = screen.getByRole("button", { name: "Record purchase" })
    expect(submit).toBeDisabled()

    fireEvent.change(screen.getByLabelText("Product"), { target: { value: "Tom" } })
    fireEvent.click(await screen.findByRole("option", { name: "Tomato" }))
    fireEvent.change(screen.getByLabelText("Vendor"), { target: { value: "v1" } })
    fireEvent.change(screen.getByLabelText("Quantity ordered"), { target: { value: "10" } })
    fireEvent.change(screen.getByLabelText("Quantity received (blank = same)"), { target: { value: "9" } })
    fireEvent.change(screen.getByLabelText("Damaged on arrival"), { target: { value: "1" } })
    expect(submit).toBeDisabled() // no price yet
    fireEvent.change(screen.getByLabelText("Purchase price per unit (₹)"), { target: { value: "28" } })
    expect(screen.getByRole("status")).toHaveTextContent("₹252")
    expect(screen.getByRole("status")).toHaveTextContent("Short by 1")
    expect(submit).toBeEnabled()
    fireEvent.click(submit)
    await waitFor(() => expect(api.createEntry).toHaveBeenCalled())
    expect(api.createEntry.mock.calls[0][0]).toMatchObject({ productId: "p1", vendorId: "v1", expectedQty: 10, receivedQty: 9, damagedQty: 1, unitPrice: 28 })
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("e1"))
  })
  it("will not accept damaged > received, and asks who B2B stock is for", () => {
    wrap(<NewPurchaseDialog open onOpenChange={() => undefined} onCreated={() => undefined} />)
    fireEvent.change(screen.getByLabelText("Quantity ordered"), { target: { value: "5" } })
    fireEvent.change(screen.getByLabelText("Damaged on arrival"), { target: { value: "6" } })
    expect(screen.getByText("Damaged cannot be more than received.")).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText("Reserved for a B2B or bulk order"))
    expect(screen.getByText("Say who the B2B stock is reserved for.")).toBeInTheDocument()
  })
})

describe("split dialog", () => {
  it("never lets you send more than is available, or a store twice", () => {
    wrap(<SplitDialog entry={entry({ available: 10 })} open onOpenChange={() => undefined} />)
    const send = screen.getByRole("button", { name: "Send to stores" })
    fireEvent.change(screen.getByLabelText("Store for row 1"), { target: { value: "s1" } })
    fireEvent.change(screen.getByLabelText("Quantity for row 1"), { target: { value: "11" } })
    expect(screen.getByText("That is 1 more than is available.")).toBeInTheDocument()
    expect(send).toBeDisabled()
    fireEvent.change(screen.getByLabelText("Quantity for row 1"), { target: { value: "6" } })
    fireEvent.click(screen.getByRole("button", { name: /Add a store/ }))
    fireEvent.change(screen.getByLabelText("Store for row 2"), { target: { value: "s1" } })
    fireEvent.change(screen.getByLabelText("Quantity for row 2"), { target: { value: "2" } })
    expect(screen.getByText(/appears twice/)).toBeInTheDocument()
    expect(send).toBeDisabled()
  })
  it("sends the 4 + 3 + 3 style split with the cost-price choice", async () => {
    api.allocateEntry.mockResolvedValue(entry())
    wrap(<SplitDialog entry={entry({ available: 10 })} open onOpenChange={() => undefined} />)
    fireEvent.change(screen.getByLabelText("Store for row 1"), { target: { value: "s1" } })
    fireEvent.change(screen.getByLabelText("Quantity for row 1"), { target: { value: "4" } })
    fireEvent.click(screen.getByRole("button", { name: /Add a store/ }))
    fireEvent.change(screen.getByLabelText("Store for row 2"), { target: { value: "s2" } })
    fireEvent.change(screen.getByLabelText("Quantity for row 2"), { target: { value: "3" } })
    expect(screen.getByRole("status")).toHaveTextContent("Sending 7 · 3 will stay unallocated")
    fireEvent.click(screen.getByRole("checkbox"))
    fireEvent.click(screen.getByRole("button", { name: "Send to stores" }))
    await waitFor(() => expect(api.allocateEntry).toHaveBeenCalled())
    expect(api.allocateEntry).toHaveBeenCalledWith("e1", [{ shopId: "s1", quantity: 4 }, { shopId: "s2", quantity: 3 }], expect.objectContaining({ updateCostPrice: false }))
  })
  it("a dedicated purchase offers only its own store", () => {
    wrap(<SplitDialog entry={entry({ destination: { id: "s2", name: "Dark Store" } })} open onOpenChange={() => undefined} />)
    const options = within(screen.getByLabelText("Store for row 1")).getAllByRole("option").map((o) => o.textContent)
    expect(options).toEqual(["Choose a store…", "Dark Store"])
    expect(screen.queryByRole("button", { name: /Add a store/ })).toBeNull()
  })
})

describe("adjust dialog", () => {
  const withAlloc = entry({ available: 2, allocations: [{ id: "a1", shopId: "s1", shopName: "Salt Lake", quantity: 5, status: "APPLIED", note: null, at: "", reversedAt: null }], adjustments: [{ id: "j1", kind: "DAMAGE", label: "Damaged", quantity: 1, shopId: "s1", shopName: "Salt Lake", reason: "x", by: null, at: "", value: 28, loss: true }] })
  it("caps a central write-off by what is available and demands a reason", () => {
    wrap(<AdjustDialog entry={withAlloc} open onOpenChange={() => undefined} />)
    const record = screen.getByRole("button", { name: "Record" })
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "3" } })
    expect(screen.getByText(/Only 2 is in central stock/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "2" } })
    expect(record).toBeDisabled() // no reason
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "spoiled" } })
    expect(record).toBeEnabled()
  })
  it("caps a store write-off by what that store still holds from this purchase (5 sent − 1 already written off = 4)", async () => {
    api.adjustEntry.mockResolvedValue(withAlloc)
    wrap(<AdjustDialog entry={withAlloc} open onOpenChange={() => undefined} />)
    fireEvent.change(screen.getByLabelText("Taken from"), { target: { value: "s1" } })
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "5" } })
    expect(screen.getByText(/Only 4 is held by that store/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "4" } })
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "water leak" } })
    fireEvent.click(screen.getByRole("button", { name: "Record" }))
    await waitFor(() => expect(api.adjustEntry).toHaveBeenCalledWith("e1", { kind: "DAMAGE", quantity: 4, reason: "water leak", shopId: "s1" }))
  })
  it("B2B supply can only come from central stock", () => {
    wrap(<AdjustDialog entry={withAlloc} open onOpenChange={() => undefined} />)
    fireEvent.change(screen.getByLabelText("What happened"), { target: { value: "B2B_SUPPLY" } })
    expect(screen.getByLabelText("Taken from")).toBeDisabled()
  })
})

describe("bulk preview", () => {
  const batch = (t: Partial<BulkBatch["totals"]> = {}): BulkBatch => ({ id: "b1", fileName: "sheet.csv", status: "PREVIEW", createdAt: "", appliedAt: null, createdBy: null, totals: { rows: 4, valid: 2, errors: 1, unchanged: 1, shops: 1, products: 2, ...t } })
  beforeEach(() => {
    api.getUploadRows.mockResolvedValue({ total: 1, limit: 100, items: [{ rowNo: 4, status: "ERROR", errors: ["No product found for “X”."], product: null, store: null, changes: {}, summary: "", raw: { SKU: "X" } }] })
  })
  it("starts on the errors, and will not apply until the person agrees to skip them", async () => {
    wrap(<BulkPreview batch={batch()} onDone={() => undefined} />)
    expect(await screen.findByText("No product found for “X”.")).toBeInTheDocument()
    const apply = screen.getByRole("button", { name: /Apply 2 change/ })
    expect(apply).toBeDisabled()
    expect(screen.getByText(/Fix the sheet and upload again/)).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText(/skip the 1 row/))
    expect(apply).toBeEnabled()
  })
  it("asks for a final confirmation, then applies with skipErrors and reports the result", async () => {
    const result = { ...batch(), status: "APPLIED" as const, result: { appliedRows: 2, shops: 1, products: 2, stockMovements: 1, skippedRows: 1 } }
    api.applyUpload.mockResolvedValue(result)
    const onDone = vi.fn()
    wrap(<BulkPreview batch={batch()} onDone={onDone} />)
    fireEvent.click(screen.getByLabelText(/skip the 1 row/))
    fireEvent.click(screen.getByRole("button", { name: /Apply 2 change/ }))
    expect(api.applyUpload).not.toHaveBeenCalled() // not yet — confirmation first
    expect(screen.getByText("Apply these changes?")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Yes, apply" }))
    await waitFor(() => expect(api.applyUpload).toHaveBeenCalledWith("b1", true))
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(result))
  })
  it("a clean sheet needs no skip box; a sheet that changes nothing cannot be applied", () => {
    const { unmount } = wrap(<BulkPreview batch={batch({ errors: 0 })} onDone={() => undefined} />)
    expect(screen.queryByLabelText(/skip the/)).toBeNull()
    expect(screen.getByRole("button", { name: /Apply 2 change/ })).toBeEnabled()
    unmount()
    wrap(<BulkPreview batch={batch({ errors: 0, valid: 0 })} onDone={() => undefined} />)
    expect(screen.getByRole("button", { name: /Apply 0 change/ })).toBeDisabled()
    expect(screen.getByText(/would change anything/)).toBeInTheDocument()
  })
  it("discarding calls the server and closes the preview", async () => {
    api.discardUpload.mockResolvedValue({ id: "b1" })
    const onDone = vi.fn()
    wrap(<BulkPreview batch={batch()} onDone={onDone} />)
    fireEvent.click(screen.getByRole("button", { name: "Discard" }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(api.discardUpload).toHaveBeenCalledWith("b1")
  })
})

describe("business analytics page", () => {
  const overview = (): Overview => ({
    period: "30d", from: "2026-09-03", to: "2026-10-02", days: 30, shopId: null, channel: "ALL",
    cards: { grossSales: 1640, netRevenue: 1560, procurementCost: 3100, commissionEarned: 170, refunds: 80, returns: 80, cancelledValue: 500, trackedLoss: 270 },
    counts: { orders: 4, customers: 3, refundedOrders: 2, cancelledOrders: 1, deliveredOrders: 3, purchases: 2, returnMovements: 1 }, avgOrderValue: 410,
    lossBreakdown: { damagedAtReceiving: 60, procurementAdjustments: 90, storeDamage: 120, unpricedStoreDamageRecords: 0 },
    series: [{ day: "2026-03-10", orders: 4, gross: 1640 }], warnings: ["1 damaged-stock record(s) at stores have no cost price."], definitions: { trackedLoss: "Recorded loss only.", grossSales: "Orders placed." },
  })
  it("shows the eight agreed figures, the warnings and the definitions", async () => {
    api.getOverview.mockResolvedValue(overview())
    wrap(<BusinessAnalyticsPage />)
    expect(await screen.findByText("₹1,640")).toBeInTheDocument()
    for (const label of ["Gross sales", "Net revenue", "Procurement cost", "Commission earned", "Refunds", "Returns", "Cancelled value", "Tracked loss"]) expect(screen.getByText(label)).toBeInTheDocument()
    expect(screen.getByText("₹270")).toBeInTheDocument()
    expect(screen.getByText(/4 orders · 3 customers/)).toBeInTheDocument()
    expect(screen.getByText(/no cost price/)).toBeInTheDocument()
    expect(screen.getByTestId("chart")).toBeInTheDocument()
    expect(screen.getByText(/How these numbers are worked out/)).toBeInTheDocument()
  })
  it("asks the server for the chosen period, store and customer type", async () => {
    api.getOverview.mockResolvedValue(overview())
    wrap(<BusinessAnalyticsPage />)
    await screen.findByText("₹1,640")
    fireEvent.click(screen.getByRole("button", { name: "Today" }))
    await waitFor(() => expect(api.getOverview).toHaveBeenLastCalledWith({ period: "today" }))
    fireEvent.click(screen.getByRole("button", { name: "B2B" }))
    await waitFor(() => expect(api.getOverview).toHaveBeenLastCalledWith({ period: "today", channel: "B2B" }))
    fireEvent.change(screen.getByLabelText("Store"), { target: { value: "s1" } })
    await waitFor(() => expect(api.getOverview).toHaveBeenLastCalledWith({ period: "today", channel: "B2B", shopId: "s1" }))
  })
  it("does not ask for a bad custom range", async () => {
    api.getOverview.mockResolvedValue(overview())
    wrap(<BusinessAnalyticsPage />)
    await screen.findByText("₹1,640")
    api.getOverview.mockClear()
    fireEvent.click(screen.getByRole("button", { name: "Custom" }))
    expect(await screen.findByText("Pick both dates.")).toBeInTheDocument()
    expect(api.getOverview).not.toHaveBeenCalled()
  })
  it("switches to the reconciliation tab", async () => {
    api.getOverview.mockResolvedValue(overview())
    api.getReconciliation.mockResolvedValue({ range: { period: "30d", from: "", to: "" }, note: "Counted per product.", entries: [], products: [{ productId: "p1", name: "Tomato", received: 100, damagedAtDoor: 2, shortage: 0, allocated: 40, centralAdjusted: 8, storeAdjusted: 0, availableCentral: 50, purchaseCost: 3000, lossValue: 56, soldQty: 31, salesValue: 1240, storeStockNow: 7 }] })
    wrap(<BusinessAnalyticsPage />)
    await screen.findByText("₹1,640")
    fireEvent.click(screen.getByRole("tab", { name: "Procurement reconciliation" }))
    expect(await screen.findByText("Tomato")).toBeInTheDocument()
    expect(screen.getByText("Counted per product.")).toBeInTheDocument()
    expect(screen.getByText("₹3,000")).toBeInTheDocument()
  })
  it("shows a not-authorised page without the permission and asks for no data", async () => {
    api.getBizMe.mockResolvedValue({ procurementView: true, procurementManage: true, catalogBulk: true, analyticsBusiness: false })
    wrap(<BusinessAnalyticsPage />)
    await waitFor(() => expect(screen.queryByText("Business Analytics")).toBeNull())
    expect(api.getOverview).not.toHaveBeenCalled()
  })
})
