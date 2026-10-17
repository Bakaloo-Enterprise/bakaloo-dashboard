import { Banknote, Landmark, Clock, QrCode, type LucideIcon } from "lucide-react"
import type { PayMethod, VendorTerms } from "@/types/business.types"

/** Same pictures everywhere: cash = notes, UPI = QR, bank = building, pay later = clock. */
export const TERMS_UI: Record<VendorTerms, { label: string; hint: string; icon: LucideIcon; tone: string }> = {
  CASH: { label: "Cash", hint: "Pay on the spot", icon: Banknote, tone: "bg-green-100 text-green-700 border-green-300" },
  UPI: { label: "UPI", hint: "Pay by phone", icon: QrCode, tone: "bg-violet-100 text-violet-700 border-violet-300" },
  BANK: { label: "Bank", hint: "Bank transfer", icon: Landmark, tone: "bg-sky-100 text-sky-700 border-sky-300" },
  CREDIT: { label: "Pay later", hint: "Pay after some days", icon: Clock, tone: "bg-amber-100 text-amber-700 border-amber-300" },
}
export const TERMS_ORDER: VendorTerms[] = ["CASH", "UPI", "BANK", "CREDIT"]
export const METHOD_ORDER: PayMethod[] = ["CASH", "UPI", "BANK"]
export const CREDIT_CHOICES = [7, 15, 30]
