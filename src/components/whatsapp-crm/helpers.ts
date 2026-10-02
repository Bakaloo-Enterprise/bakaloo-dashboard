import type { WaConversation, WaMessage } from "@/types/whatsapp-crm.types"

/** Best human label for a conversation: matched customer, WhatsApp profile, phone, @username. */
export function conversationTitle(c: Pick<WaConversation, "customer_name" | "profile_name" | "phone" | "wa_username" | "bsuid">): string {
  return c.customer_name || c.profile_name || c.phone || (c.wa_username ? `@${c.wa_username}` : null) || c.bsuid || "Unknown"
}

/** Phone shown to staff; falls back to the username/ID when Meta withheld the number. */
export function conversationHandle(c: Pick<WaConversation, "phone" | "wa_username" | "bsuid">): string {
  if (c.phone) return `+91 ${c.phone}`
  if (c.wa_username) return `@${c.wa_username}`
  return c.bsuid ?? ""
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase()
}

export function messageText(m: Pick<WaMessage, "body" | "msg_type">): string {
  if (m.body) return m.body
  return `[${m.msg_type}]`
}

/** Hours left in the 24 h free-reply window, or 0 when closed. */
export function windowHoursLeft(lastInboundAt: string | null, now: number = Date.now()): number {
  if (!lastInboundAt) return 0
  const left = new Date(lastInboundAt).getTime() + 24 * 3600_000 - now
  return left > 0 ? left / 3600_000 : 0
}

export const STATUS_LABEL: Record<string, string> = {
  QUEUED: "Sending…",
  SENT: "Sent",
  DELIVERED: "Delivered",
  READ: "Read",
  FAILED: "Failed",
  RECEIVED: "",
}
