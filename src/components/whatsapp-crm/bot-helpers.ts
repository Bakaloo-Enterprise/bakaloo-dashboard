import type { BotAction, BotMatchType, BotRule, BotWhenHours } from "@/types/whatsapp-crm.types"

export const MATCH_LABEL: Record<BotMatchType, string> = {
  CONTAINS: "Message contains the words",
  EXACT: "Whole message is exactly",
  STARTS_WITH: "Message starts with",
  PINCODE: "Message has a PIN code",
  AREA_YES: "Message names an area we deliver to",
  AREA_NO: "Message names an area we do NOT deliver to",
  AREA_ASKED: "We asked “which area?” and the place is unknown",
  PRODUCT: "Message names a product we know",
}

export const ACTION_LABEL: Record<BotAction, string> = {
  REPLY: "Reply",
  REPLY_HANDOFF: "Reply, then hand to a person",
  HANDOFF: "Hand to a person (no reply)",
  OPT_OUT: "Reply and unsubscribe from offers",
  OPT_IN: "Reply and subscribe to offers",
  IGNORE: "Stay silent (no reply, no person needed)",
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
  { key: "area_name", hint: "The area the customer named (area rules)" },
  { key: "served_areas", hint: "List of areas we deliver to" },
  { key: "area_text", hint: "The place the customer typed (unknown-area rule)" },
  { key: "product_info", hint: "Products found in the catalog (product rule)" },
  { key: "play_store_link", hint: "Android app link" },
  { key: "app_store_link", hint: "iPhone app link" },
  { key: "website", hint: "Website link" },
]

/** Rule types that match on facts (area, product, PIN), so they have no keyword list. */
export const NO_KEYWORD_TYPES: BotMatchType[] = ["PINCODE", "AREA_YES", "AREA_NO", "AREA_ASKED", "PRODUCT"]

/** One keyword per line, or comma separated. */
export function parseKeywords(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((k) => k.trim())
    .filter(Boolean)
}

export function keywordSummary(r: Pick<BotRule, "match_type" | "keywords" | "exact_keywords">): string {
  if (r.match_type === "PINCODE") return "any 6-digit PIN code"
  if (r.match_type === "AREA_YES") return "an area we deliver to"
  if (r.match_type === "AREA_NO") return "an area we do not deliver to"
  if (r.match_type === "AREA_ASKED") return "after “which area?”, a place we do not know"
  if (r.match_type === "PRODUCT") return "a product word from the list below"
  const parts: string[] = []
  if (r.keywords.length) parts.push(r.keywords.slice(0, 4).join(", ") + (r.keywords.length > 4 ? ` +${r.keywords.length - 4}` : ""))
  if (r.exact_keywords.length) parts.push(`exactly: ${r.exact_keywords.join(", ")}`)
  return parts.join(" · ")
}
