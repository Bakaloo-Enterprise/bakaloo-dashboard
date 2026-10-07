import type { WaConversation, WaMessage } from "@/types/whatsapp-crm.types"

/** Best human label for a conversation: matched customer, WhatsApp profile, phone, @username. */
export function conversationTitle(c: Pick<WaConversation, "customer_name" | "profile_name" | "phone" | "wa_username" | "bsuid"> & { wa_id?: string | null }): string {
  // A brand-new number may have no WhatsApp profile name and (if not Indian) no 10-digit phone — still show the number.
  return c.customer_name || c.profile_name || c.phone || (c.wa_username ? `@${c.wa_username}` : null) || (c.wa_id ? `+${c.wa_id}` : null) || c.bsuid || "Unknown"
}

/** Phone shown to staff; falls back to the username/ID when Meta withheld the number. */
export function conversationHandle(c: Pick<WaConversation, "phone" | "wa_username" | "bsuid"> & { wa_id?: string | null }): string {
  if (c.phone) return `+91 ${c.phone}`
  if (c.wa_id) return `+${c.wa_id}`
  if (c.wa_username) return `@${c.wa_username}`
  return c.bsuid ?? ""
}

/** Attachment details stored on a message (image / video / audio / document / sticker / location). */
export interface MessageMediaInfo {
  id?: string | null
  mime_type?: string | null
  filename?: string | null
  caption?: string | null
  size?: number | null
  latitude?: number | null
  longitude?: number | null
}

export function mediaInfo(m: Pick<WaMessage, "media">): MessageMediaInfo {
  return (m.media ?? {}) as MessageMediaInfo
}

export function formatBytes(n?: number | null): string {
  if (!n || n <= 0) return ""
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

/** "Today", "Yesterday" or "12 Oct 2026" — the divider shown between days in a chat. */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((startOf(now) - startOf(d)) / 86_400_000)
  if (diff === 0) return "Today"
  if (diff === 1) return "Yesterday"
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })
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
