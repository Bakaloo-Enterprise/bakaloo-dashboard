import type { ProspectImport, ProspectRowStatus } from "@/types/whatsapp-crm.types"

export const ROW_STATUS: Record<ProspectRowStatus, { label: string; cls: string; hint: string }> = {
  NEW: { label: "New", cls: "bg-emerald-100 text-emerald-800", hint: "A number we have never seen." },
  EXISTING_CONTACT: { label: "Already in CRM", cls: "bg-sky-100 text-sky-800", hint: "Already in WhatsApp CRM; not yet a customer." },
  EXISTING_CUSTOMER: { label: "Existing customer", cls: "bg-violet-100 text-violet-800", hint: "Already shops with Bakaloo. Left out unless you include them." },
  INVALID: { label: "Invalid number", cls: "bg-red-100 text-red-800", hint: "Not a usable Indian mobile number." },
  DUPLICATE: { label: "Repeated", cls: "bg-slate-200 text-slate-700", hint: "The same number appears earlier in this file." },
  OPTED_OUT: { label: "Opted out", cls: "bg-amber-100 text-amber-800", hint: "Asked us to stop. Never contacted." },
  SUPPRESSED: { label: "Do not contact", cls: "bg-amber-100 text-amber-800", hint: "On the do-not-contact list. Never contacted." },
}

export const ROW_STATUS_ORDER: ProspectRowStatus[] = ["NEW", "EXISTING_CONTACT", "EXISTING_CUSTOMER", "INVALID", "DUPLICATE", "OPTED_OUT", "SUPPRESSED"]

/** How many rows will be reachable once this list is confirmed (mirrors the server's rule). */
export function reachableCount(counts: ProspectImport["counts"], includeExisting: boolean): number {
  return (counts.NEW ?? 0) + (counts.EXISTING_CONTACT ?? 0) + (includeExisting ? counts.EXISTING_CUSTOMER ?? 0 : 0)
}

/** Only .csv / .xlsx, at most 5 MB — checked before upload so the person gets an instant answer. */
export function fileProblem(file: { name: string; size: number }): string | null {
  const ext = file.name.toLowerCase().split(".").pop()
  if (ext !== "csv" && ext !== "xlsx") return "Upload a .csv or .xlsx file."
  if (file.size > 5 * 1024 * 1024) return "That file is over 5 MB."
  if (file.size === 0) return "That file is empty."
  return null
}
