import type { Campaign, CampaignStats, CampaignStatus, ConditionOp, Workflow, WorkflowAction, WorkflowCondition, WorkflowTrigger } from "@/types/whatsapp-crm.types"

export const CAMPAIGN_STATUS: Record<CampaignStatus, { label: string; cls: string; hint: string }> = {
  DRAFT: { label: "Draft", cls: "bg-slate-100 text-slate-700", hint: "Not sent yet. You can still edit it." },
  SCHEDULED: { label: "Scheduled", cls: "bg-sky-100 text-sky-800", hint: "Will start at the scheduled time." },
  SENDING: { label: "Sending", cls: "bg-emerald-100 text-emerald-800", hint: "Messages are going out." },
  PAUSED: { label: "Paused", cls: "bg-amber-100 text-amber-800", hint: "Stopped. Nothing more is sent until you resume it." },
  COMPLETED: { label: "Done", cls: "bg-slate-200 text-slate-700", hint: "Everyone in the audience has been handled." },
  CANCELLED: { label: "Cancelled", cls: "bg-red-100 text-red-800", hint: "Stopped for good." },
}

export const SKIP_REASON: Record<string, string> = {
  NO_CONSENT: "No recorded opt-in",
  OPTED_OUT: "Opted out",
  SUPPRESSED: "On the do-not-contact list",
  NO_ADDRESS: "No WhatsApp number",
  MARKETING_CAP: "Hit Meta’s marketing limit for this person",
  NOT_ON_WHATSAPP: "Not on WhatsApp",
  BLOCKED_BY_USER: "Blocked the business",
  CANCELLED: "Campaign cancelled",
  MISSING_VALUES: "A template value was missing",
  UNKNOWN_OUTCOME: "Unknown result — not retried to avoid a duplicate",
  TEMPLATE_PROBLEM: "Template problem",
  SEND_FAILED: "Send failed",
  INTERNAL_ERROR: "Internal error",
}

/** 0–100 of the audience that has been handled (sent, failed or skipped). */
export function progressPercent(s: CampaignStats): number {
  if (!s.total) return 0
  return Math.round(((s.total - s.waiting) / s.total) * 100)
}

export function pct(part: number, whole: number): string {
  if (!whole) return "–"
  return `${Math.round((part / whole) * 100)}%`
}

export function canEditCampaign(c: Pick<Campaign, "status">) {
  return c.status === "DRAFT"
}

export function availableActions(c: Pick<Campaign, "status">): Array<"launch" | "pause" | "resume" | "cancel" | "delete"> {
  switch (c.status) {
    case "DRAFT": return ["launch", "delete"]
    case "SCHEDULED": return ["pause", "cancel"]
    case "SENDING": return ["pause", "cancel"]
    case "PAUSED": return ["resume", "cancel"]
    default: return []
  }
}

/** "a@b, c" style pasted lists -> unique, trimmed phone strings. */
export function parsePhones(text: string): string[] {
  return Array.from(new Set(text.split(/[\s,;]+/).map((p) => p.trim()).filter(Boolean)))
}

/** <input type="datetime-local"> value (local time) -> ISO string, or undefined when empty. */
export function localInputToIso(v: string): string | undefined {
  if (!v) return undefined
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

/** Earliest schedulable moment for the datetime-local `min` attribute (now + 2 minutes). */
export function minScheduleLocal(now = new Date()): string {
  const d = new Date(now.getTime() + 2 * 60_000)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Marketing messages are held back between 9 pm and 9 am India time (the server enforces this). */
export function isQuietHoursIST(now = new Date()): boolean {
  const ist = new Date(now.getTime() + 330 * 60_000)
  const h = ist.getUTCHours()
  return h >= 21 || h < 9
}

// ─── Workflows ───────────────────────────────────────────────────────
export const TRIGGER_LABEL: Record<WorkflowTrigger, string> = {
  CART_ABANDONED: "A cart is left without buying",
  ORDER_STATUS: "An order reaches a status",
}

export const ORDER_STATUS_OPTIONS = [
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "PACKED", label: "Packed" },
  { value: "OUT_FOR_DELIVERY", label: "Out for delivery" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
] as const

export const FIELD_LABEL: Record<string, string> = {
  cart_value: "Cart value (₹)",
  item_count: "Number of items",
  order_count: "Customer’s past orders",
  order_total: "Order total (₹)",
  payment_method: "Payment method",
}

export const OP_LABEL: Record<ConditionOp, string> = {
  gt: "is more than",
  gte: "is at least",
  lt: "is less than",
  lte: "is at most",
  eq: "is",
  neq: "is not",
}

export const TEXT_FIELDS = new Set(["payment_method"])

export const RUN_REASON: Record<string, string> = {
  CONDITIONS_NOT_MET: "Did not match the conditions",
  CART_RECOVERED: "Customer came back / bought",
  NO_CONSENT: "No opt-in",
  OPTED_OUT: "Opted out",
  SUPPRESSED: "Do-not-contact list",
  NO_ADDRESS: "No WhatsApp number",
  QUIET_HOURS: "Night time (marketing is held back)",
  COUPON_UNAVAILABLE: "Coupon no longer valid",
  MISSING_VALUES: "A template value was missing",
  EVENT_GONE: "Order or cart no longer exists",
  WORKER_STOPPED: "Server restarted mid-send (not re-sent)",
  TEMPLATE_NOT_SENDABLE: "Template not approved",
  TEMPLATE_GONE: "Template deleted",
  LABEL_ONLY: "Label added",
  INTERNAL_ERROR: "Internal error",
  SEND_FAILED: "Send failed",
}

export function describeCondition(c: WorkflowCondition): string {
  return `${FIELD_LABEL[c.field] ?? c.field} ${OP_LABEL[c.op]} ${c.value}`
}

export function describeTrigger(w: Pick<Workflow, "trigger_type" | "trigger_config">): string {
  if (w.trigger_type === "CART_ABANDONED") {
    const m = w.trigger_config.delay_minutes ?? 5
    return `A cart sits unbought for ${m >= 60 && m % 60 === 0 ? `${m / 60} hour${m === 60 ? "" : "s"}` : `${m} minute${m === 1 ? "" : "s"}`}`
  }
  const s = ORDER_STATUS_OPTIONS.find((o) => o.value === w.trigger_config.status)?.label ?? w.trigger_config.status ?? "a status"
  return `An order becomes “${s}”`
}

export function describeAction(a: WorkflowAction, names: { template?: (id: string) => string | undefined; label?: (id: string) => string | undefined; coupon?: boolean }): string {
  if (a.type === "ADD_LABEL") return `Add the label “${names.label?.(a.labelId) ?? "…"}”`
  return `Send “${names.template?.(a.templateId) ?? "template"}”${a.couponId ? " with a coupon" : ""}`
}

/** The variables a staff member can write inside a value, e.g. {{customer_name}}. */
export function tokenHint(tokens: string[]): string {
  return tokens.map((t) => `{{${t}}}`).join("  ")
}

/** Drop empty condition rows and turn number-looking values into numbers (the server compares numbers numerically). */
export function cleanConditions(rows: Array<{ field: string; op: ConditionOp; value: string }>): WorkflowCondition[] {
  return rows
    .filter((r) => r.field && r.value.trim() !== "")
    .map((r) => ({ field: r.field, op: r.op, value: TEXT_FIELDS.has(r.field) ? r.value.trim() : Number(r.value) }))
    .filter((c) => typeof c.value === "string" || !Number.isNaN(c.value))
}
