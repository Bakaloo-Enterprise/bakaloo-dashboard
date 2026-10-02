import type { AnalyticsFilters, PeriodId, PeriodQuery } from "@/types/business.types"
export { formatRupees, formatPct, formatCount, istToday, addDays } from "@/components/whatsapp-crm/analytics-helpers"

export const PERIODS: Array<{ id: PeriodId; label: string }> = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 Days" },
  { id: "30d", label: "30 Days" },
  { id: "custom", label: "Custom" },
]

/** Why a custom range cannot be asked for yet (null when fine). */
export function periodProblem(p: { period: PeriodId; from?: string; to?: string }): string | null {
  if (p.period !== "custom") return null
  if (!p.from || !p.to) return "Pick both dates."
  if (p.from > p.to) return "“From” must not be after “To”."
  const days = Math.round((Date.parse(p.to) - Date.parse(p.from)) / 86_400_000) + 1
  return days > 366 ? "Pick at most 366 days." : null
}

/** Only send dates for a custom range. */
export function toPeriodQuery(p: { period: PeriodId; from?: string; to?: string }): PeriodQuery {
  return p.period === "custom" ? { period: "custom", from: p.from, to: p.to } : { period: p.period }
}
export function toFilters(p: { period: PeriodId; from?: string; to?: string }, shopId: string, channel: string): AnalyticsFilters {
  return { ...toPeriodQuery(p), ...(shopId ? { shopId } : {}), ...(channel && channel !== "ALL" ? { channel: channel as AnalyticsFilters["channel"] } : {}) }
}

/** “3 days ago” style only where a date string is shown; keeps tables short. */
export function shortDate(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00`)
  return Number.isNaN(d.getTime()) ? ymd : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
}

export const KIND_LABEL: Record<string, string> = {
  VENDOR_RETURN: "Returned to vendor", DAMAGE: "Damaged", WASTAGE: "Wasted / expired", AUTHORIZED_ADJUSTMENT: "Authorised adjustment", B2B_SUPPLY: "Supplied to a B2B order",
}

export const CARD_HELP: Array<{ key: keyof import("@/types/business.types").Overview["cards"]; label: string; def: string; tone?: "bad" }> = [
  { key: "grossSales", label: "Gross sales", def: "grossSales" },
  { key: "netRevenue", label: "Net revenue", def: "netRevenue" },
  { key: "procurementCost", label: "Procurement cost", def: "procurementCost" },
  { key: "commissionEarned", label: "Commission earned", def: "commission" },
  { key: "refunds", label: "Refunds", def: "refunds", tone: "bad" },
  { key: "returns", label: "Returns", def: "returns", tone: "bad" },
  { key: "cancelledValue", label: "Cancelled value", def: "cancelledValue", tone: "bad" },
  { key: "trackedLoss", label: "Tracked loss", def: "trackedLoss", tone: "bad" },
]
