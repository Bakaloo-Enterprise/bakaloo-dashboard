import type { BotAction, BotMatchType, BotRule, BotWhenHours } from "@/types/whatsapp-crm.types"

export const MATCH_LABEL: Record<BotMatchType, string> = {
  CONTAINS: "Message contains the words",
  EXACT: "Whole message is exactly",
  STARTS_WITH: "Message starts with",
  PINCODE: "Message has a PIN code",
}

export const ACTION_LABEL: Record<BotAction, string> = {
  REPLY: "Reply",
  REPLY_HANDOFF: "Reply, then hand to a person",
  HANDOFF: "Hand to a person (no reply)",
  OPT_OUT: "Reply and unsubscribe from offers",
  OPT_IN: "Reply and subscribe to offers",
}

export const WHEN_LABEL: Record<BotWhenHours, string> = {
  ANY: "Any time",
  OPEN: "Only while the store is open",
  CLOSED: "Only while the store is closed",
}

export const VARIABLES: Array<{ key: string; hint: string }> = [
  { key: "customer_name", hint: "First name, or “there”" },
  { key: "last_order", hint: "Status of their latest order" },
  { key: "business_hours", hint: "When the store is open" },
]

/** One keyword per line, or comma separated. */
export function parseKeywords(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((k) => k.trim())
    .filter(Boolean)
}

export function keywordSummary(r: Pick<BotRule, "match_type" | "keywords" | "exact_keywords">): string {
  if (r.match_type === "PINCODE") return "any 6-digit PIN code"
  const parts: string[] = []
  if (r.keywords.length) parts.push(r.keywords.slice(0, 4).join(", ") + (r.keywords.length > 4 ? ` +${r.keywords.length - 4}` : ""))
  if (r.exact_keywords.length) parts.push(`exactly: ${r.exact_keywords.join(", ")}`)
  return parts.join(" · ")
}
