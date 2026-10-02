import type { AnalyticsQuery, BreakdownRow } from "@/types/whatsapp-crm.types"

const DAY = 86_400_000
const IST = 5.5 * 3_600_000

/** Today's date in India, as YYYY-MM-DD (the reports are cut on India days). */
export function istToday(now = new Date()): string {
  return new Date(now.getTime() + IST).toISOString().slice(0, 10)
}

export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d) + n * DAY).toISOString().slice(0, 10)
}

export type RangePreset = "7d" | "30d" | "90d" | "custom"
export const PRESETS: Array<{ id: Exclude<RangePreset, "custom">; label: string; days: number }> = [
  { id: "7d", label: "Last 7 days", days: 7 },
  { id: "30d", label: "Last 30 days", days: 30 },
  { id: "90d", label: "Last 90 days", days: 90 },
]

export function presetRange(preset: Exclude<RangePreset, "custom">, now = new Date()): { from: string; to: string } {
  const days = PRESETS.find((p) => p.id === preset)?.days ?? 30
  const to = istToday(now)
  return { from: addDays(to, -(days - 1)), to }
}

/** Why a custom range cannot be used, or null. Mirrors the server (max 366 days, from ≤ to). */
export function rangeProblem(from: string, to: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return "Pick both dates."
  if (from > to) return "“From” must not be after “To”."
  const days = Math.round((Date.parse(to) - Date.parse(from)) / DAY) + 1
  if (days > 366) return "Pick at most 366 days."
  return null
}

export const ORDER_WINDOWS = [1, 3, 7, 14, 30]

export function toQuery(range: { from: string; to: string }, attributionDays: number): AnalyticsQuery {
  return { from: range.from, to: range.to, attributionDays }
}

// ─── Formatting ─────────────────────────────────────────────────────

export function formatRupees(n: number | null | undefined, opts: { compact?: boolean } = {}): string {
  if (n == null || Number.isNaN(n)) return "—"
  if (opts.compact && Math.abs(n) >= 100_000) return `₹${(n / 100_000).toFixed(2).replace(/\.?0+$/, "")} L`
  return n.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })
}

export function formatPct(n: number | null | undefined): string {
  return n == null ? "—" : `${n}%`
}

export function formatCount(n: number | null | undefined): string {
  return n == null ? "—" : n.toLocaleString("en-IN")
}

/** 0.4 → “under a minute”, 12.5 → “12.5 min”, 135 → “2 h 15 min”. */
export function formatMinutes(m: number | null | undefined): string {
  if (m == null) return "—"
  if (m < 1) return "under a minute"
  if (m < 60) return `${Math.round(m * 10) / 10} min`
  const h = Math.floor(m / 60)
  const rest = Math.round(m % 60)
  return rest ? `${h} h ${rest} min` : `${h} h`
}

/** “2026-03-10” → “10 Mar”. */
export function shortDay(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })
}

// ─── Tables ─────────────────────────────────────────────────────────

export type SortKey = "name" | "sent" | "delivered" | "read" | "replied" | "orders" | "revenue" | "cost" | "delivery_rate" | "revenue_per_rupee"

/** Sort rows without mutating them; missing numbers (—) always sink to the bottom. */
export function sortRows(rows: BreakdownRow[], key: SortKey, dir: "asc" | "desc"): BreakdownRow[] {
  const sign = dir === "asc" ? 1 : -1
  return [...rows].sort((a, b) => {
    if (key === "name") return sign * a.name.localeCompare(b.name)
    const av = a[key] as number | null
    const bv = b[key] as number | null
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    return sign * (av - bv)
  })
}

const csvCell = (v: unknown): string => {
  let s = v == null ? "" : String(v)
  // A cell that starts like a formula would run in Excel; defuse it. (Names come from staff-written campaign titles.)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** A CSV a spreadsheet can open: one row per campaign / workflow / template. */
export function breakdownCsv(rows: BreakdownRow[]): string {
  const head = ["Name", "Sent", "Delivered", "Delivery %", "Read", "Read %", "Replied", "Reply %", "Failed", "Orders", "Revenue (INR)", "Cost (INR)", "Cost per order (INR)", "Revenue per rupee"]
  const lines = rows.map((r) => [r.name, r.sent, r.delivered, r.delivery_rate, r.read, r.read_rate, r.replied, r.reply_rate, r.failed, r.orders, r.revenue, r.cost, r.cost_per_order, r.revenue_per_rupee].map(csvCell).join(","))
  return [head.map(csvCell).join(","), ...lines].join("\r\n")
}

export const CATEGORY_LABEL: Record<string, string> = {
  MARKETING: "Marketing",
  UTILITY: "Utility (order updates)",
  AUTHENTICATION: "Authentication",
  SERVICE: "Service (replies)",
  UNKNOWN: "Unknown",
}

export const BOT_OUTCOME_LABEL: Record<string, string> = {
  REPLIED: "Answered by the bot",
  HANDOFF: "Handed to a person",
  NO_MATCH: "No rule matched",
  SKIPPED_STALE: "Too old to answer",
  SKIPPED_COOLDOWN: "Skipped (just answered)",
  RATE_LIMITED: "Held back (too many)",
  SEND_FAILED: "Reply failed",
  MEDIA: "Photo / voice → person",
}
