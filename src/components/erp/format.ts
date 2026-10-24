/** Shared number formatting for the ERP screens (Indian grouping, safe for negatives and paise). */

const full = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 })
const whole = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 })

/** ₹1.24L, ₹12.5K, ₹850 — keeps the sign; `compact:false` gives the exact ₹1,24,500.50. */
export function inr(n: number | null | undefined, compact = true): string {
  if (n == null || !Number.isFinite(n)) return "—"
  if (!compact) return full.format(n)
  const a = Math.abs(n)
  const sign = n < 0 ? "-" : ""
  if (a >= 1e7) return `${sign}₹${(a / 1e7).toFixed(2)}Cr`
  if (a >= 1e5) return `${sign}₹${(a / 1e5).toFixed(2)}L`
  if (a >= 1e4) return `${sign}₹${(a / 1e3).toFixed(1)}K`
  return `${sign}₹${whole.format(a)}`
}

export const count = (n: number | null | undefined): string => (n == null ? "—" : whole.format(n))

export function pctText(n: number | null | undefined, digits = 0): string {
  return n == null || !Number.isFinite(n) ? "—" : `${n.toFixed(digits)}%`
}

/** "2026-10-11" → "11 Oct" */
export function dayLabel(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })
}

/** 0–23 → "7 PM" */
export function hourLabel(h: number): string {
  const ap = h < 12 ? "AM" : "PM"
  const x = h % 12 === 0 ? 12 : h % 12
  return `${x} ${ap}`
}
