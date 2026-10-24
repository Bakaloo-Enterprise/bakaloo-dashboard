/**
 * The buy list: products the owner has decided to buy, grouped by supplier, ready to send as one WhatsApp order and then
 * record as purchases. Pure functions only (storage, grouping, message, links) so they can be tested without a browser.
 */
export interface BuyLine {
  productId: string
  name: string
  unit: string | null
  qty: number
  price: number | null
  vendorId: string | null
  vendorName: string | null
}

export interface BuyGroup { vendorId: string | null; vendorName: string | null; lines: BuyLine[]; total: number }

const KEY = "bakaloo-buy-list-v1"

/** Same product from the same supplier is one line: quantities add up and the newest price wins. */
export function addLine(list: BuyLine[], line: BuyLine): BuyLine[] {
  const i = list.findIndex((l) => l.productId === line.productId && l.vendorId === line.vendorId)
  if (i < 0) return [...list, line]
  const next = [...list]
  next[i] = { ...next[i], qty: next[i].qty + line.qty, price: line.price ?? next[i].price }
  return next
}

export const lineTotal = (l: BuyLine): number => Math.round(l.qty * (l.price ?? 0) * 100) / 100

/** One group per supplier (A→Z); lines with no supplier yet come last. */
export function groupByVendor(list: BuyLine[]): BuyGroup[] {
  const map = new Map<string, BuyGroup>()
  for (const l of list) {
    const k = l.vendorId ?? "none"
    const g = map.get(k) ?? { vendorId: l.vendorId, vendorName: l.vendorName, lines: [], total: 0 }
    g.lines.push(l)
    g.total = Math.round((g.total + lineTotal(l)) * 100) / 100
    map.set(k, g)
  }
  return Array.from(map.values()).sort((a, b) => (a.vendorId === null ? 1 : b.vendorId === null ? -1 : (a.vendorName ?? "").localeCompare(b.vendorName ?? "")))
}

/** The message the owner sends the supplier. */
export function orderMessage(vendorName: string | null, lines: BuyLine[], dayText: string): string {
  const rows = lines.map((l) => `• ${l.name}${l.unit ? ` (${l.unit})` : ""} — ${l.qty}`)
  return [`Hello${vendorName ? ` ${vendorName}` : ""}, my order for ${dayText}:`, ...rows, "Please confirm. Thank you."].join("\n")
}

/** Digits only; a 10-digit Indian mobile gets 91 in front. null when it cannot be a phone number. */
export function phoneDigits(phone: string | null | undefined): string | null {
  let d = String(phone ?? "").replace(/\D/g, "")
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1)
  if (d.length === 10) d = `91${d}`
  return d.length >= 11 && d.length <= 15 ? d : null
}
export const telLink = (phone: string | null | undefined): string | null => { const d = phoneDigits(phone); return d ? `tel:+${d}` : null }
export const whatsappLink = (phone: string | null | undefined, text: string): string | null => { const d = phoneDigits(phone); return d ? `https://wa.me/${d}?text=${encodeURIComponent(text)}` : null }

const isLine = (x: unknown): x is BuyLine => {
  const l = x as BuyLine
  return Boolean(l) && typeof l.productId === "string" && typeof l.name === "string" && Number.isInteger(l.qty) && l.qty > 0 && (l.price === null || (typeof l.price === "number" && l.price >= 0)) && (l.vendorId === null || typeof l.vendorId === "string")
}

/** Storage can be empty, blocked or hand-edited: anything unreadable is simply an empty list. */
export function loadList(): BuyLine[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "[]")
    return Array.isArray(raw) ? raw.filter(isLine).slice(0, 200) : []
  } catch { return [] }
}
export function saveList(list: BuyLine[]): void {
  try { window.localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* private window or full: the list just will not survive a reload */ }
}
