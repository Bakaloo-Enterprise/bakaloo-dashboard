import type { WaCheckStatus, WaConnectionState, WaSettingsView } from "@/types/whatsapp-settings.types"

export const STATE_STYLE: Record<WaConnectionState, { label: string; headline: string; hero: string; dot: string }> = {
  CONNECTED: { label: "Connected", headline: "WhatsApp is connected", hero: "from-emerald-600 to-teal-700", dot: "bg-emerald-300" },
  SAVED: { label: "Not tested yet", headline: "Details saved — run a test to connect", hero: "from-amber-500 to-orange-600", dot: "bg-amber-200" },
  FAILED: { label: "Connection failed", headline: "WhatsApp could not connect", hero: "from-rose-600 to-red-700", dot: "bg-rose-200" },
  DISABLED: { label: "Switched off", headline: "WhatsApp is connected but switched off", hero: "from-slate-600 to-slate-800", dot: "bg-slate-300" },
  NOT_CONFIGURED: { label: "Not set up", headline: "Connect your WhatsApp Business number", hero: "from-slate-700 to-slate-900", dot: "bg-slate-400" },
}

export const CHECK_STYLE: Record<WaCheckStatus, { label: string; ring: string; text: string }> = {
  pass: { label: "Passed", ring: "bg-emerald-100 text-emerald-700", text: "text-emerald-700" },
  warn: { label: "Needs attention", ring: "bg-amber-100 text-amber-700", text: "text-amber-700" },
  fail: { label: "Failed", ring: "bg-red-100 text-red-700", text: "text-red-700" },
  skip: { label: "Skipped", ring: "bg-slate-100 text-slate-500", text: "text-slate-500" },
}

/** What Meta confirmed about the number, taken from the last test (for the status header). */
export function numberSummary(view: WaSettingsView | undefined): { number: string | null; name: string | null; chips: Array<[string, string]> } {
  const phone = view?.lastTest?.checks.find((c) => c.id === "phone")
  const d = (phone?.status === "pass" ? phone.details : undefined) as Record<string, string | null> | undefined
  const token = view?.lastTest?.checks.find((c) => c.id === "token")
  const chips: Array<[string, string]> = []
  if (d?.quality) chips.push(["Quality", String(d.quality).toLowerCase()])
  if (d?.limitTier) chips.push(["Daily limit", tierText(String(d.limitTier))])
  if (d?.verification) chips.push(["Number", String(d.verification).toLowerCase()])
  if (token && token.status !== "skip") chips.push(["Token", token.status === "pass" ? "permanent" : token.status === "warn" ? "check token" : "invalid"])
  return { number: d?.number ?? null, name: d?.name ?? null, chips }
}

/** TIER_1K → “1K customers / day”, TIER_UNLIMITED → “unlimited”. */
export function tierText(tier: string): string {
  const t = tier.replace(/^TIER_/, "")
  return t === "UNLIMITED" ? "unlimited" : `${t} customers / day`
}

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "never"
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** First day of this month (India) and today, as YYYY-MM-DD. */
export function thisMonth(today: string): { from: string; to: string } {
  return { from: `${today.slice(0, 7)}-01`, to: today }
}

export const FIELD_HELP = {
  phoneNumberId: { label: "Phone number ID", where: "Meta → WhatsApp → API Setup → “Phone number ID”", hint: "About 15 digits. This is not your phone number." },
  wabaId: { label: "WhatsApp Business Account ID", where: "Meta → WhatsApp → API Setup → “WhatsApp Business Account ID”", hint: "Needed for message templates." },
  accessToken: { label: "Access token", where: "Meta Business Settings → System users → Generate token", hint: "A very long text starting with EAA. Use a permanent token, not the 24-hour one." },
  appSecret: { label: "App Secret", where: "Meta → App settings → Basic → “App secret”", hint: "Lets us trust messages that really come from Meta." },
  verifyToken: { label: "Verify token", where: "A word you choose (or generate one)", hint: "You will paste the same word into Meta’s webhook screen." },
  appId: { label: "App ID", where: "Meta → App settings → Basic → “App ID”", hint: "Optional. With the App Secret it lets us show when your token expires." },
} as const
