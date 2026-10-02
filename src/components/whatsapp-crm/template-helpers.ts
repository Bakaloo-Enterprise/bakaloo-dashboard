import type { MetaCategory, TemplateButtonInput, TemplateInput, TemplateStatus, TemplateVariable, WaTemplate } from "@/types/whatsapp-crm.types"

export const LIMITS = { header: 60, body: 1024, footer: 60, buttonText: 25 } as const

export const LANGUAGES: Array<{ code: string; label: string }> = [
  { code: "en", label: "English" },
  { code: "en_US", label: "English (US)" },
  { code: "en_GB", label: "English (UK)" },
  { code: "hi", label: "Hindi" },
  { code: "bn", label: "Bengali" },
]

export const CATEGORY_HELP: Record<Exclude<MetaCategory, "AUTHENTICATION">, string> = {
  MARKETING: "Offers, promotions, reminders to buy. Needs the customer's opt-in. Costs the most per message.",
  UTILITY: "Order updates, delivery status, receipts about something the customer already did. Cheaper.",
}

export const STATUS_STYLE: Record<TemplateStatus, { label: string; cls: string; hint: string }> = {
  DRAFT: { label: "Draft", cls: "bg-slate-100 text-slate-700", hint: "Saved here only. Submit it to Meta for approval." },
  PENDING: { label: "In review", cls: "bg-amber-100 text-amber-800", hint: "Meta is reviewing it (minutes to about a day)." },
  APPROVED: { label: "Approved", cls: "bg-emerald-100 text-emerald-800", hint: "Ready to use." },
  REJECTED: { label: "Rejected", cls: "bg-red-100 text-red-800", hint: "Meta rejected it. Edit and resubmit." },
  PAUSED: { label: "Paused", cls: "bg-orange-100 text-orange-800", hint: "Meta paused it because of customer feedback. It cannot be used for now." },
  DISABLED: { label: "Disabled", cls: "bg-red-200 text-red-900", hint: "Meta disabled it." },
  IN_APPEAL: { label: "In appeal", cls: "bg-sky-100 text-sky-800", hint: "An appeal is being reviewed." },
  PENDING_DELETION: { label: "Deleting", cls: "bg-slate-200 text-slate-700", hint: "Being deleted." },
  ARCHIVED: { label: "Archived", cls: "bg-slate-200 text-slate-700", hint: "Archived for inactivity." },
  DELETED: { label: "Deleted", cls: "bg-slate-200 text-slate-700", hint: "Deleted." },
}

/** Statuses Meta allows editing in (docs: template-management). */
export const EDITABLE_STATUSES: ReadonlySet<TemplateStatus> = new Set<TemplateStatus>(["DRAFT", "APPROVED", "REJECTED", "PAUSED"])

const VAR_RE = /\{\{\s*([^{}]*?)\s*\}\}/g

/** Variable names in order of first appearance across the given texts. */
export function detectVariables(...texts: Array<string | undefined>): string[] {
  const seen = new Set<string>()
  for (const t of texts) {
    const re = new RegExp(VAR_RE.source, "g")
    let m: RegExpExecArray | null
    while ((m = re.exec(String(t ?? ""))) !== null) seen.add(m[1])
  }
  return Array.from(seen)
}

/** "Abandoned cart reminder" → "abandoned_cart_reminder" (what Meta allows in a name). */
export function suggestName(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80)
}

/** What the customer will see, with sample values for the editor preview. */
export function previewFromInput(i: Pick<TemplateInput, "headerText" | "bodyText" | "footerText" | "buttons" | "examples">): string {
  const fill = (t: string) => t.replace(VAR_RE, (_, n: string) => i.examples?.[n]?.trim() || `{{${n}}}`)
  const parts: string[] = []
  if (i.headerText?.trim()) parts.push(fill(i.headerText))
  parts.push(fill(i.bodyText || ""))
  if (i.footerText?.trim()) parts.push(i.footerText)
  const buttons = (i.buttons ?? []).filter((b) => b.text.trim())
  if (buttons.length) parts.push(buttons.map((b) => `[ ${b.text.trim()} ]`).join(" "))
  return parts.filter(Boolean).join("\n\n")
}

type Comp = Record<string, unknown>

/** What an existing template looks like with the given variable values (send dialog preview). */
export function renderTemplateText(t: Pick<WaTemplate, "components" | "variables">, values: Record<string, string>): string {
  const comps = (t.components ?? []) as Comp[]
  const find = (type: string) => comps.find((c) => c.type === type)
  const keyFor = (name: string, where: string): string => {
    const v = t.variables.find((x) => x.name === name && (x.where === where || where === "any"))
    return v?.key ?? name
  }
  const fill = (text: string, where: string) => text.replace(VAR_RE, (_, n: string) => values[keyFor(n, where)]?.trim() || `{{${n}}}`)
  const parts: string[] = []
  const header = find("HEADER")
  if (header?.format === "TEXT") parts.push(fill(String(header.text ?? ""), "header"))
  else if (header) parts.push(`[${String(header.format).toLowerCase()}]`)
  const body = find("BODY")
  if (body) parts.push(fill(String(body.text ?? ""), "body"))
  const footer = find("FOOTER")
  if (footer) parts.push(String(footer.text ?? ""))
  const buttons = (find("BUTTONS")?.buttons ?? []) as Array<{ text: string }>
  if (buttons.length) parts.push(buttons.map((b) => `[ ${b.text} ]`).join(" "))
  return parts.join("\n\n")
}

/** Variables that need a value when sending (header / body / link). */
export function sendVariables(t: Pick<WaTemplate, "variables">): TemplateVariable[] {
  return t.variables.map((v) => ({ ...v, key: v.key ?? v.name }))
}

export function newButton(type: TemplateButtonInput["type"]): TemplateButtonInput {
  if (type === "URL") return { type, text: "", url: "https://" }
  if (type === "PHONE_NUMBER") return { type, text: "", phoneNumber: "+91" }
  return { type, text: "" }
}

/** Why a template cannot be sent right now (mirrors the server's gate; the server always re-checks). */
export function sendBlockReason(t: Pick<WaTemplate, "status" | "meta_category" | "header_format">): string | null {
  if (t.status !== "APPROVED") return STATUS_STYLE[t.status].hint
  if (t.meta_category === "AUTHENTICATION") return "Authentication templates are not supported yet."
  if (t.header_format === "LOCATION") return "Templates with a location header are not supported yet."
  return null
}
