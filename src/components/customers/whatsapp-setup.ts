import type { WaConfigStatus } from "@/types/whatsapp-crm.types"

export interface WhatsappSetup {
  /** Messages can be sent right now. */
  canSend: boolean
  /** Replies and delivery ticks come back (the webhook is set up). */
  receivesReplies: boolean
  /** What is still missing for sending, in plain words. */
  missing: string[]
  /** The same, for the webhook. */
  missingForReplies: string[]
}

/** Reads the server's WhatsApp configuration and says what still has to be set up. */
export function whatsappSetup(s: WaConfigStatus | undefined): WhatsappSetup {
  if (!s) return { canSend: false, receivesReplies: false, missing: [], missingForReplies: [] }
  const missing: string[] = []
  if (!s.enabled) missing.push("WhatsApp is switched off on the server (WHATSAPP_ENABLED)")
  if (!s.configured.phoneNumberId) missing.push("Phone number ID (WHATSAPP_PHONE_NUMBER_ID)")
  if (!s.configured.accessToken) missing.push("Access token (WHATSAPP_ACCESS_TOKEN)")
  const missingForReplies: string[] = []
  if (!s.configured.verifyToken) missingForReplies.push("Webhook verify token (WHATSAPP_VERIFY_TOKEN)")
  if (!s.configured.appSecret) missingForReplies.push("App secret (META_APP_SECRET)")
  return { canSend: missing.length === 0, receivesReplies: missingForReplies.length === 0 && s.enabled, missing, missingForReplies }
}

/** “9999912345” → “+91 99999 12345”. Anything unexpected is shown as typed. */
export function displayPhone(phone: string | null | undefined): string {
  const d = String(phone ?? "").replace(/\D/g, "")
  const ten = d.length === 12 && d.startsWith("91") ? d.slice(2) : d
  return ten.length === 10 ? `+91 ${ten.slice(0, 5)} ${ten.slice(5)}` : String(phone ?? "")
}
