import { Banknote, BadgeCheck, CheckCircle2, Clock, HelpCircle, MessageCircle, MessagesSquare, PhoneCall, PieChart, Pencil, QrCode, Store, Truck, XCircle, type LucideIcon } from "lucide-react"
import type { PayTerms, ReqSource, ReqStatus } from "@/types/business.types"

/** One look for each idea, used everywhere, so people learn the picture once. Colour + icon + a very short word. */
export const SOURCE_UI: Record<ReqSource, { label: string; hint: string; icon: LucideIcon; tone: string }> = {
  WHATSAPP_META: { label: "Business WhatsApp", hint: "From our Inbox", icon: MessagesSquare, tone: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  WHATSAPP_PERSONAL: { label: "WhatsApp", hint: "Normal WhatsApp", icon: MessageCircle, tone: "bg-green-100 text-green-700 border-green-300" },
  PHONE_CALL: { label: "Call", hint: "Phone call", icon: PhoneCall, tone: "bg-sky-100 text-sky-700 border-sky-300" },
  WALK_IN: { label: "Walk-in", hint: "Came to the shop", icon: Store, tone: "bg-amber-100 text-amber-700 border-amber-300" },
  OTHER: { label: "Other", hint: "Any other way", icon: Pencil, tone: "bg-slate-100 text-slate-700 border-slate-300" },
}
export const SOURCE_ORDER: ReqSource[] = ["WHATSAPP_META", "WHATSAPP_PERSONAL", "PHONE_CALL", "WALK_IN", "OTHER"]

export const STATUS_UI: Record<ReqStatus, { label: string; hint: string; icon: LucideIcon; tone: string }> = {
  INQUIRY: { label: "Maybe", hint: "Just asking", icon: HelpCircle, tone: "bg-amber-100 text-amber-800 border-amber-300" },
  CONFIRMED: { label: "Sure", hint: "They will take it", icon: CheckCircle2, tone: "bg-green-100 text-green-800 border-green-300" },
  DELIVERED: { label: "Delivered", hint: "Given to them", icon: Truck, tone: "bg-sky-100 text-sky-800 border-sky-300" },
  CANCELLED: { label: "Cancelled", hint: "Not needed", icon: XCircle, tone: "bg-slate-100 text-slate-600 border-slate-300" },
}

export const PAY_UI: Record<PayTerms, { label: string; icon: LucideIcon }> = {
  COD: { label: "Cash", icon: Banknote },
  UPI: { label: "UPI", icon: QrCode },
  ADVANCE_PAID: { label: "Paid already", icon: BadgeCheck },
  CREDIT: { label: "Pay later", icon: Clock },
  PARTIAL: { label: "Part paid", icon: PieChart },
}
export const PAY_ORDER: PayTerms[] = ["COD", "UPI", "ADVANCE_PAID", "CREDIT", "PARTIAL"]

/** "Tomorrow", "Today", or "18 Oct" — people read words faster than dates. */
export function dayWord(iso: string | null, today: string): string {
  if (!iso) return "No date"
  if (iso === today) return "Today"
  const d = new Date(`${iso}T00:00:00`)
  const t = new Date(`${today}T00:00:00`)
  const diff = Math.round((d.getTime() - t.getTime()) / 86_400_000)
  if (diff === 1) return "Tomorrow"
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
}
