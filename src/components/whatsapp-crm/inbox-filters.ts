import type { ConversationFilters, InboxCriteria, WaLabel } from "@/types/whatsapp-crm.types"

/** Names of the labels the server adds automatically to chats that started from a Meta ad. */
export const META_TAG_NAMES = ["Meta Ad", "Facebook Ad", "Instagram Ad", "Ad Post"] as const

export interface QuickFilter {
  key: string
  label: string
  criteria: InboxCriteria
}

/** The chips under the search box. Each one is just a ready-made set of criteria. */
export const QUICK_FILTERS: QuickFilter[] = [
  { key: "all", label: "All", criteria: {} },
  { key: "unread", label: "Unread", criteria: { unread: true } },
  { key: "open", label: "Open", criteria: { status: "OPEN" } },
  { key: "mine", label: "Mine", criteria: { assignedTo: "me" } },
  { key: "unassigned", label: "Unassigned", criteria: { assignedTo: "unassigned" } },
  { key: "needs", label: "Needs a person", criteria: { needsPerson: true } },
  { key: "meta", label: "Meta ads", criteria: { source: "META_AD" } },
]

const DAY_MS = 86_400_000

/** Drops empty values so two criteria that mean the same thing compare equal. */
export function normalizeCriteria(c: InboxCriteria): InboxCriteria {
  const out: InboxCriteria = {}
  if (c.status) out.status = c.status
  if (c.assignedTo) out.assignedTo = c.assignedTo
  if (c.labelIds?.length) out.labelIds = [...c.labelIds].sort()
  if (c.unread) out.unread = true
  if (c.source) out.source = c.source
  if (c.windowOpen !== undefined) out.windowOpen = c.windowOpen
  if (c.lead !== undefined) out.lead = c.lead
  if (c.needsPerson) out.needsPerson = true
  if (c.days) out.days = c.days
  return out
}

export function sameCriteria(a: InboxCriteria, b: InboxCriteria): boolean {
  return JSON.stringify(normalizeCriteria(a)) === JSON.stringify(normalizeCriteria(b))
}

/** How many separate conditions are switched on (the number on the Filters button). */
export function activeCount(c: InboxCriteria): number {
  return Object.keys(normalizeCriteria(c)).length
}

/** The chip that exactly matches these criteria, if any. */
export function matchingQuickFilter(c: InboxCriteria): QuickFilter | undefined {
  return QUICK_FILTERS.find((q) => sameCriteria(q.criteria, c))
}

/** Criteria + search text -> the query the API understands. `now` is injectable for tests. */
export function toQuery(c: InboxCriteria, search: string, now: number = Date.now()): ConversationFilters {
  const n = normalizeCriteria(c)
  const q: ConversationFilters = {}
  if (search.trim()) q.search = search.trim()
  if (n.status) q.status = n.status
  if (n.assignedTo) q.assignedTo = n.assignedTo
  if (n.labelIds) q.labelIds = n.labelIds
  if (n.unread) q.unread = true
  if (n.source) q.source = n.source
  if (n.windowOpen !== undefined) q.windowOpen = n.windowOpen
  if (n.lead !== undefined) q.lead = n.lead
  if (n.needsPerson) q.needsPerson = true
  if (n.days) q.from = new Date(now - n.days * DAY_MS).toISOString()
  return q
}

/** Short human description of a criteria set, for saved-filter tooltips. */
export function describeCriteria(c: InboxCriteria, labels: Pick<WaLabel, "id" | "name">[], agentName?: (id: string) => string | undefined): string {
  const n = normalizeCriteria(c)
  const parts: string[] = []
  if (n.status) parts.push(n.status.charAt(0) + n.status.slice(1).toLowerCase())
  if (n.assignedTo) parts.push(n.assignedTo === "me" ? "Mine" : n.assignedTo === "unassigned" ? "Unassigned" : (agentName?.(n.assignedTo) ?? "One person"))
  if (n.unread) parts.push("Unread")
  if (n.needsPerson) parts.push("Needs a person")
  if (n.source === "META_AD") parts.push("From Meta ads")
  else if (n.source) parts.push(n.source.toLowerCase())
  if (n.windowOpen === true) parts.push("Can reply now")
  if (n.windowOpen === false) parts.push("24h closed")
  if (n.lead === true) parts.push("New leads")
  if (n.lead === false) parts.push("Customers")
  if (n.labelIds) parts.push(n.labelIds.map((id) => labels.find((l) => l.id === id)?.name ?? "label").join(" / "))
  if (n.days) parts.push(n.days === 1 ? "Last 24 hours" : `Last ${n.days} days`)
  return parts.join(" · ") || "Everything"
}

/** WhatsApp's list time: clock today, "Yesterday", weekday this week, else dd/mm/yyyy. */
export function listTime(iso: string | null, now: Date = new Date()): string {
  if (!iso) return ""
  const d = new Date(iso)
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((startOf(now) - startOf(d)) / DAY_MS)
  if (diff <= 0) return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase()
  if (diff === 1) return "Yesterday"
  if (diff < 7) return d.toLocaleDateString("en-IN", { weekday: "long" })
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  return `${dd}/${mm}/${d.getFullYear()}`
}
