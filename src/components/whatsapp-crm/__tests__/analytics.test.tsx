import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import type { AnalyticsOverview, BreakdownRow, InboxReport, RateCards } from "@/types/whatsapp-crm.types"

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))
// Recharts needs real layout; the chart is a thin wrapper, so a stand-in keeps these tests about the numbers.
vi.mock("next/dynamic", () => ({ default: () => (p: { metric: string }) => <div data-testid="chart" data-metric={p.metric} /> }))

const api = { getAnalyticsOverview: vi.fn(), getAnalyticsBreakdown: vi.fn(), getAnalyticsInbox: vi.fn(), getRateCards: vi.fn(), addRateCard: vi.fn(), removeRateCard: vi.fn(), getCrmMe: vi.fn() }
vi.mock("@/services/whatsapp-crm.service", async (orig) => ({
  ...(await orig<object>()),
  getAnalyticsOverview: (...a: unknown[]) => api.getAnalyticsOverview(...a),
  getAnalyticsBreakdown: (...a: unknown[]) => api.getAnalyticsBreakdown(...a),
  getAnalyticsInbox: (...a: unknown[]) => api.getAnalyticsInbox(...a),
  getRateCards: (...a: unknown[]) => api.getRateCards(...a),
  addRateCard: (...a: unknown[]) => api.addRateCard(...a),
  removeRateCard: (...a: unknown[]) => api.removeRateCard(...a),
  getCrmMe: (...a: unknown[]) => api.getCrmMe(...a),
}))

import { AnalyticsOverviewTab } from "../AnalyticsOverviewTab"
import { BreakdownTab } from "../BreakdownTab"
import { CostTab } from "../CostTab"
import { InboxReportTab } from "../InboxReportTab"
import WhatsappAnalyticsPage from "@/app/(dashboard)/whatsapp-crm/analytics/page"
import { addDays, breakdownCsv, formatMinutes, formatPct, formatRupees, istToday, presetRange, rangeProblem, shortDay, sortRows } from "../analytics-helpers"

beforeAll(() => { Element.prototype.scrollIntoView = vi.fn() })
const wrap = (ui: ReactNode) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>)

const funnel = (o = {}) => ({ sent: 200, delivered: 180, read: 90, failed: 5, replied: 18, orders: 10, revenue: 5000, cost: 100, delivery_rate: 90, read_rate: 50, reply_rate: 10, failure_rate: 2.4, cost_per_order: 10, revenue_per_rupee: 50, ...o })
const overview = (o: Partial<AnalyticsOverview> = {}): AnalyticsOverview => ({
  range: { from: "2026-03-10", to: "2026-03-12", days: 3, attributionDays: 7 },
  totals: funnel(),
  bySource: [{ source: "CAMPAIGN", ...funnel() }, { source: "WORKFLOW", ...funnel({ sent: 20, delivered: 20, orders: 0, revenue: 0 }) }, { source: "MANUAL", ...funnel({ sent: 3, delivered: 3 }) }],
  newContacts: 12, optedOut: 4, optOutRate: 2.2, failures: [{ code: 131049, title: "Marketing cap", count: 3 }, { code: null, title: null, count: 2 }],
  cost: { total: 100, estimated: 60, billedMessages: 180, estimatedMessages: 100, unpricedMessages: 0, hasRates: true, byCategory: [{ category: "MARKETING", messages: 150, unpriced: 0, cost: 90 }, { category: "UTILITY", messages: 30, unpriced: 0, cost: 10 }] },
  daily: [], ...o,
})
const row = (o: Partial<BreakdownRow> = {}): BreakdownRow => ({ id: "c1", name: "Diwali offer", ...funnel(), unpriced: 0, ...o })

describe("helpers", () => {
  it("India today near midnight UTC", () => {
    expect(istToday(new Date("2026-10-01T19:00:00Z"))).toBe("2026-10-02")
    expect(istToday(new Date("2026-10-01T10:00:00Z"))).toBe("2026-10-01")
  })
  it("date arithmetic across month ends", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28")
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01")
  })
  it("presets end today and cover the right number of days", () => {
    const now = new Date("2026-10-02T10:00:00Z")
    expect(presetRange("7d", now)).toEqual({ from: "2026-09-26", to: "2026-10-02" })
    expect(presetRange("30d", now)).toEqual({ from: "2026-09-03", to: "2026-10-02" })
  })
  it("custom range problems match the server", () => {
    expect(rangeProblem("", "2026-01-01")).toMatch(/both/)
    expect(rangeProblem("2026-02-01", "2026-01-01")).toMatch(/after/)
    expect(rangeProblem("2025-01-01", "2026-10-01")).toMatch(/366/)
    expect(rangeProblem("2026-01-01", "2026-01-31")).toBeNull()
    expect(rangeProblem("2025-10-02", "2026-10-02")).toBeNull()
  })
  it("formats rupees, percentages, minutes and days", () => {
    expect(formatRupees(1234.5)).toBe("₹1,234.50")
    expect(formatRupees(500)).toBe("₹500")
    expect(formatRupees(null)).toBe("—")
    expect(formatRupees(250000, { compact: true })).toBe("₹2.5 L")
    expect(formatPct(33.3)).toBe("33.3%")
    expect(formatPct(null)).toBe("—")
    expect(formatMinutes(0.4)).toBe("under a minute")
    expect(formatMinutes(12.5)).toBe("12.5 min")
    expect(formatMinutes(135)).toBe("2 h 15 min")
    expect(formatMinutes(120)).toBe("2 h")
    expect(formatMinutes(null)).toBe("—")
    expect(shortDay("2026-03-10")).toBe("10 Mar")
  })
  it("sorts without mutating, with missing numbers always last", () => {
    const rows = [row({ id: "a", name: "B", revenue_per_rupee: 5 }), row({ id: "b", name: "A", revenue_per_rupee: null }), row({ id: "c", name: "C", revenue_per_rupee: 9 })]
    expect(sortRows(rows, "revenue_per_rupee", "desc").map((r) => r.id)).toEqual(["c", "a", "b"])
    expect(sortRows(rows, "revenue_per_rupee", "asc").map((r) => r.id)).toEqual(["a", "c", "b"])
    expect(sortRows(rows, "name", "asc").map((r) => r.id)).toEqual(["b", "a", "c"])
    expect(rows.map((r) => r.id)).toEqual(["a", "b", "c"])
  })
  it("CSV: quotes commas/quotes and defuses spreadsheet formulas", () => {
    const csv = breakdownCsv([row({ name: 'Diwali, "big" sale' }), row({ id: "x", name: "=HYPERLINK(\"http://evil\")" }), row({ id: "y", name: "+91 offer", cost_per_order: null })])
    const lines = csv.split("\r\n")
    expect(lines[0]).toMatch(/^Name,Sent,Delivered/)
    expect(lines[1].startsWith('"Diwali, ""big"" sale",200,180')).toBe(true)
    expect(lines[2].startsWith("\"'=HYPERLINK(\"\"http://evil\"\")\"")).toBe(true)
    expect(lines[3].startsWith("'+91 offer,")).toBe(true)
    expect(lines).toHaveLength(4)
  })
})

describe("AnalyticsOverviewTab", () => {
  it("shows the key numbers, sources, opt-outs and failure reasons", () => {
    wrap(<AnalyticsOverviewTab data={overview()} onGoToCost={() => {}} />)
    const keys = screen.getByRole("region", { name: "Key numbers" })
    expect(within(keys).getByText("200")).toBeTruthy()
    expect(within(keys).getByText("90%")).toBeTruthy()
    expect(within(keys).getByText("₹5,000")).toBeTruthy()
    expect(within(keys).getByText("₹50")).toBeTruthy()
    expect(within(keys).getByText("₹60 estimated")).toBeTruthy()
    expect(screen.getByText("Campaigns")).toBeTruthy()
    expect(screen.getByText("Sent by a person")).toBeTruthy()
    expect(screen.getByText(/4/, { selector: "strong" })).toBeTruthy()
    expect(screen.getByText("Marketing cap")).toBeTruthy()
    expect(screen.getByText("Unknown reason")).toBeTruthy()
    expect(screen.getByTestId("chart").getAttribute("data-metric")).toBe("messages")
    expect(screen.queryByRole("note")).toBeNull()
  })
  it("manual sends never show orders or revenue", () => {
    wrap(<AnalyticsOverviewTab data={overview()} onGoToCost={() => {}} />)
    const manual = screen.getByText("Sent by a person").closest("tr") as HTMLElement
    expect(within(manual).getAllByText("—")).toHaveLength(2)
  })
  it("warns when no prices are set and offers the way to add them", () => {
    const go = vi.fn()
    wrap(<AnalyticsOverviewTab data={overview({ cost: { ...overview().cost, hasRates: false, total: 0, estimated: 0 } })} onGoToCost={go} />)
    expect(screen.getByRole("note").textContent).toMatch(/No message prices/)
    fireEvent.click(screen.getByRole("button", { name: "Add prices" }))
    expect(go).toHaveBeenCalled()
  })
  it("warns about billable messages that had no price", () => {
    wrap(<AnalyticsOverviewTab data={overview({ cost: { ...overview().cost, unpricedMessages: 7 } })} onGoToCost={() => {}} />)
    expect(screen.getByRole("note").textContent).toMatch(/7 billable messages had no price/)
  })
  it("switches the chart and says so when nothing was sent", () => {
    const { unmount } = wrap(<AnalyticsOverviewTab data={overview()} onGoToCost={() => {}} />)
    fireEvent.click(screen.getByRole("tab", { name: "Orders & revenue" }))
    expect(screen.getByTestId("chart").getAttribute("data-metric")).toBe("orders")
    unmount()
    wrap(<AnalyticsOverviewTab data={overview({ totals: funnel({ sent: 0, failed: 0, delivered: 0 }) })} onGoToCost={() => {}} />)
    expect(screen.getByText(/No messages were sent/)).toBeTruthy()
    expect(screen.queryByTestId("chart")).toBeNull()
  })
})

describe("BreakdownTab", () => {
  const q = { from: "2026-03-10", to: "2026-03-12", attributionDays: 7 }
  beforeEach(() => api.getAnalyticsBreakdown.mockReset())

  it("lists rows, shows templates under campaigns, and sorts when a header is clicked", async () => {
    api.getAnalyticsBreakdown.mockResolvedValue({ range: { ...q, days: 3 }, rows: [
      row({ id: "a", name: "Small", sent: 10, revenue: 900, template_name: "diwali_offer" }),
      row({ id: "b", name: "Big", sent: 500, revenue: 100, failed: 7, unpriced: 3 }),
    ] })
    wrap(<BreakdownTab by="campaign" query={q} />)
    await screen.findByText("Big")
    const names = () => screen.getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("cell")[0].textContent)
    expect(names()).toEqual(["Big", "Smalldiwali_offer"]) // default: most sent first
    expect(screen.getByText("7 failed")).toBeTruthy()
    expect(screen.getByText("3 unpriced")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: /^Revenue/ }))
    expect(names()).toEqual(["Smalldiwali_offer", "Big"])
    expect(screen.getByRole("columnheader", { name: /Revenue/ }).getAttribute("aria-sort")).toBe("descending")
    fireEvent.click(screen.getByRole("button", { name: /^Revenue/ }))
    expect(names()).toEqual(["Big", "Smalldiwali_offer"])
    expect(api.getAnalyticsBreakdown).toHaveBeenCalledWith("campaign", q)
  })

  it("hands the CSV for the current sort to the download", async () => {
    api.getAnalyticsBreakdown.mockResolvedValue({ range: { ...q, days: 3 }, rows: [row({ id: "a", name: "Only" })] })
    const onExport = vi.fn()
    wrap(<BreakdownTab by="template" query={q} onExport={onExport} />)
    fireEvent.click(await screen.findByRole("button", { name: /Download CSV/ }))
    expect(onExport.mock.calls[0][0]).toMatch(/^Name,Sent,Delivered/)
    expect(onExport.mock.calls[0][1]).toBe("whatsapp-template-report")
  })

  it("empty and error states", async () => {
    api.getAnalyticsBreakdown.mockResolvedValueOnce({ range: { ...q, days: 3 }, rows: [] })
    const { unmount } = wrap(<BreakdownTab by="workflow" query={q} />)
    expect(await screen.findByText(/Nothing was sent/)).toBeTruthy()
    unmount()
    api.getAnalyticsBreakdown.mockRejectedValueOnce(new Error("x"))
    wrap(<BreakdownTab by="workflow" query={{ ...q, from: "2026-03-01" }} />)
    expect((await screen.findByRole("alert")).textContent).toMatch(/Could not load/)
  })
})

describe("InboxReportTab", () => {
  it("shows reply times, unanswered chats, people and bot outcomes", async () => {
    const data: InboxReport = {
      range: { from: "2026-04-10", to: "2026-04-10", days: 1 },
      volume: { inbound: 6, by_people: 3, by_bot: 1, automated: 1 },
      responses: { waiting_starts: 5, answered_by_people: 3, answered_by_bot: 1, unanswered: 1, within_15: 1, within_15_rate: 33.3, median_minutes: 20, p90_minutes: 28 },
      agents: [{ id: "u1", name: "Asha", messages: 2, conversations: 2, first_replies: 2, median_minutes: 12.5 }],
      bot: [{ outcome: "REPLIED", n: 8 }, { outcome: "HANDOFF", n: 2 }],
    }
    api.getAnalyticsInbox.mockResolvedValue(data)
    wrap(<InboxReportTab query={{ from: "2026-04-10", to: "2026-04-10" }} />)
    expect(await screen.findByText("20 min")).toBeTruthy()
    expect(screen.getByText("33.3%")).toBeTruthy()
    expect(screen.getByText("Asha")).toBeTruthy()
    expect(screen.getByText("12.5 min")).toBeTruthy()
    expect(screen.getByText("Answered by the bot")).toBeTruthy()
    expect(screen.getByText("Handed to a person")).toBeTruthy()
    expect(screen.getByText("1", { selector: "p.text-red-600" })).toBeTruthy()
  })
  it("quiet period: dashes, not NaN", async () => {
    api.getAnalyticsInbox.mockResolvedValue({ range: { from: "a", to: "b", days: 1 }, volume: { inbound: 0, by_people: 0, by_bot: 0, automated: 0 }, responses: { waiting_starts: 0, answered_by_people: 0, answered_by_bot: 0, unanswered: 0, within_15: 0, within_15_rate: null, median_minutes: null, p90_minutes: null }, agents: [], bot: [] })
    wrap(<InboxReportTab query={{ from: "2026-04-11", to: "2026-04-11" }} />)
    expect(await screen.findByText(/Nobody replied/)).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/NaN|undefined/)
  })
})

describe("CostTab", () => {
  const cards = (extra: Partial<RateCards["cards"][number]>[] = []): RateCards => ({
    categories: ["MARKETING", "UTILITY", "AUTHENTICATION", "SERVICE"],
    cards: [
      { id: "r2", category: "MARKETING", rate: 0.9, effective_from: "2026-03-11", note: "Meta Mar", created_by_name: "Hema", current: true, future: false },
      { id: "r1", category: "MARKETING", rate: 0.8, effective_from: "2026-02-01", note: null, created_by_name: null, current: false, future: false },
      ...extra.map((e, i) => ({ id: `f${i}`, category: "UTILITY" as const, rate: 0.2, effective_from: "2027-01-01", note: null, created_by_name: null, current: false, future: true, ...e })),
    ],
  })
  beforeEach(() => { Object.values(api).forEach((f) => f.mockReset()) })

  it("shows the price history with what is in use and what starts later; only future prices can be removed", async () => {
    api.getRateCards.mockResolvedValue(cards([{}]))
    wrap(<CostTab overview={overview()} canManage />)
    expect(await screen.findByText("In use")).toBeTruthy()
    expect(screen.getByText("Starts later")).toBeTruthy()
    expect(screen.getByText("Replaced")).toBeTruthy()
    expect(screen.getAllByRole("button", { name: /^Remove the/ })).toHaveLength(1)
    expect(screen.getByText(/100 priced by template category \(an estimate\) = ₹60/)).toBeTruthy()
  })

  it("Add price stays off until the price is a number; sends the right values", async () => {
    api.getRateCards.mockResolvedValue(cards())
    api.addRateCard.mockResolvedValue(cards())
    wrap(<CostTab overview={overview()} canManage />)
    await screen.findByText("In use")
    const add = screen.getByRole("button", { name: "Add price" }) as HTMLButtonElement
    expect(add.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "UTILITY" } })
    fireEvent.change(screen.getByLabelText("Price (₹)"), { target: { value: "abc" } })
    expect(add.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText("Price (₹)"), { target: { value: "0.115" } })
    fireEvent.change(screen.getByLabelText("Applies from"), { target: { value: "2026-10-01" } })
    fireEvent.change(screen.getByLabelText("Note (optional)"), { target: { value: " Meta Oct " } })
    expect(add.disabled).toBe(false)
    fireEvent.click(add)
    await waitFor(() => expect(api.addRateCard).toHaveBeenCalledWith({ category: "UTILITY", rate: 0.115, effectiveFrom: "2026-10-01", note: "Meta Oct" }))
  })

  it("shows the server's message next to the field that is wrong", async () => {
    api.getRateCards.mockResolvedValue(cards())
    api.addRateCard.mockRejectedValue({ response: { data: { message: "Please fix", details: { effectiveFrom: "Already has a price" } } } })
    wrap(<CostTab overview={overview()} canManage />)
    await screen.findByText("In use")
    fireEvent.change(screen.getByLabelText("Price (₹)"), { target: { value: "1" } })
    fireEvent.click(screen.getByRole("button", { name: "Add price" }))
    expect((await screen.findByRole("alert")).textContent).toBe("Already has a price")
  })

  it("people without crm.rates.manage can look but not change", async () => {
    api.getRateCards.mockResolvedValue(cards([{}]))
    wrap(<CostTab overview={overview()} canManage={false} />)
    await screen.findByText("In use")
    expect(screen.queryByRole("form", { name: "Add a price" })).toBeNull()
    expect(screen.queryByRole("button", { name: /^Remove the/ })).toBeNull()
    expect(screen.getByText(/can see prices but not change/)).toBeTruthy()
  })
})

describe("Analytics page", () => {
  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset())
    api.getAnalyticsOverview.mockResolvedValue(overview())
    api.getAnalyticsBreakdown.mockResolvedValue({ range: overview().range, rows: [] })
    api.getRateCards.mockResolvedValue({ categories: [], cards: [] })
  })
  const me = (permissions: string[]) => api.getCrmMe.mockResolvedValue({ userId: "u", isSuper: false, permissions })

  it("is closed to people without crm.analytics.view and never asks for data", async () => {
    me(["crm.inbox.view"])
    wrap(<WhatsappAnalyticsPage />)
    await waitFor(() => expect(screen.queryByRole("tablist", { name: "Reports" })).toBeNull())
    await new Promise((r) => setTimeout(r, 30))
    expect(api.getAnalyticsOverview).not.toHaveBeenCalled()
  })

  it("loads the last 30 days with a 7-day order window, and re-asks when those change", async () => {
    me(["crm.analytics.view"])
    wrap(<WhatsappAnalyticsPage />)
    await screen.findByRole("region", { name: "Key numbers" })
    const first = api.getAnalyticsOverview.mock.calls[0][0]
    expect(first).toMatchObject({ attributionDays: 7 })
    expect(first.from < first.to).toBe(true)
    fireEvent.change(screen.getByLabelText("Count orders placed within"), { target: { value: "14" } })
    await waitFor(() => expect(api.getAnalyticsOverview.mock.calls.at(-1)![0]).toMatchObject({ attributionDays: 14 }))
    fireEvent.click(screen.getByRole("button", { name: "Last 7 days" }))
    await waitFor(() => expect(api.getAnalyticsOverview.mock.calls.at(-1)![0]).toMatchObject({ attributionDays: 14, from: presetRange("7d").from, to: presetRange("7d").to }))
  })

  it("a bad custom range shows the problem and asks for nothing", async () => {
    me(["crm.analytics.view"])
    wrap(<WhatsappAnalyticsPage />)
    await screen.findByRole("region", { name: "Key numbers" })
    api.getAnalyticsOverview.mockClear()
    fireEvent.click(screen.getByRole("button", { name: "Custom" }))
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2030-01-01" } })
    expect((await screen.findByRole("alert")).textContent).toMatch(/must not be after/)
    expect(screen.queryByRole("tabpanel")).toBeNull()
    expect(api.getAnalyticsOverview).not.toHaveBeenCalled()
  })

  it("tabs show the matching report, and rate changes need the extra permission", async () => {
    me(["crm.analytics.view"])
    wrap(<WhatsappAnalyticsPage />)
    await screen.findByRole("region", { name: "Key numbers" })
    fireEvent.click(screen.getByRole("tab", { name: "Campaigns" }))
    await waitFor(() => expect(api.getAnalyticsBreakdown).toHaveBeenCalledWith("campaign", expect.anything()))
    fireEvent.click(screen.getByRole("tab", { name: "Templates" }))
    await waitFor(() => expect(api.getAnalyticsBreakdown).toHaveBeenCalledWith("template", expect.anything()))
    fireEvent.click(screen.getByRole("tab", { name: "Cost & prices" }))
    expect(await screen.findByText(/can see prices but not change/)).toBeTruthy()
  })
})
