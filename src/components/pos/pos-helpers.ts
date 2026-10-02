import type { LaneId, LineStatus, PosLine, RiderState, Stage } from "@/types/pos.types"

export const LANE_STYLE: Record<LaneId, { head: string; dot: string; hint: string }> = {
  NEW: { head: "bg-slate-100 text-slate-800", dot: "bg-slate-400", hint: "Waiting to be picked" },
  PICKING: { head: "bg-sky-100 text-sky-900", dot: "bg-sky-500", hint: "Someone is collecting the items" },
  PACKING: { head: "bg-violet-100 text-violet-900", dot: "bg-violet-500", hint: "Checking and packing" },
  READY: { head: "bg-amber-100 text-amber-900", dot: "bg-amber-500", hint: "Packed — needs a rider" },
  WAITING_RIDER: { head: "bg-orange-100 text-orange-900", dot: "bg-orange-500", hint: "Rider chosen, not collected yet" },
  PICKED_UP: { head: "bg-emerald-100 text-emerald-900", dot: "bg-emerald-500", hint: "Just left the store" },
  OUT_FOR_DELIVERY: { head: "bg-teal-100 text-teal-900", dot: "bg-teal-500", hint: "On its way to the customer" },
}

/** “under 1 min”, “7 min”, “1 h 5 min”. */
export function formatWaiting(minutes: number | null | undefined): string {
  if (minutes == null) return "—"
  if (minutes < 1) return "under 1 min"
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

export const RIDER_STATE: Record<RiderState, { label: string; cls: string }> = {
  OFFLINE: { label: "Offline", cls: "bg-slate-200 text-slate-700" },
  AVAILABLE: { label: "Available", cls: "bg-emerald-100 text-emerald-800" },
  ASSIGNED: { label: "Assigned", cls: "bg-amber-100 text-amber-800" },
  COMING_TO_STORE: { label: "Coming to store", cls: "bg-amber-100 text-amber-800" },
  AT_STORE: { label: "At store", cls: "bg-sky-100 text-sky-800" },
  PICKED_UP: { label: "Picked up", cls: "bg-violet-100 text-violet-800" },
  ON_DELIVERY: { label: "On delivery", cls: "bg-teal-100 text-teal-800" },
}

export const LINE_STATUS: Record<LineStatus, { label: string; cls: string }> = {
  PENDING: { label: "To pick", cls: "bg-slate-100 text-slate-700" },
  PICKED: { label: "Picked", cls: "bg-emerald-100 text-emerald-800" },
  MISSING: { label: "Missing", cls: "bg-red-100 text-red-800" },
  RESOLVED: { label: "Decided", cls: "bg-violet-100 text-violet-800" },
}

/** Units this line still needs at this stage (mirrors the server so the screen never offers an impossible action). */
export function remainingFor(line: PosLine, stage: Stage): number {
  if (stage === "PICK") return line.status === "PENDING" ? Math.max(0, line.required - line.picked) : 0
  return line.packTarget == null ? 0 : Math.max(0, line.packTarget - line.packed)
}

/** Done / total units for the progress bar at this stage. */
export function progressFor(lines: PosLine[], stage: Stage): { done: number; total: number } {
  let done = 0
  let total = 0
  for (const l of lines) {
    if (stage === "PICK") {
      if (l.status === "RESOLVED" && l.decision !== "REPLACE") { total += l.picked; done += l.picked; continue }
      total += l.required
      done += l.status === "RESOLVED" ? l.required : l.picked
    } else if (l.packTarget != null) {
      total += l.packTarget
      done += l.packed
    }
  }
  return { done, total }
}

export type ScanFeedback = { tone: "ok" | "bad"; title: string; detail?: string; code?: string }

/** What to show (and say) after a scan. A wrong scan is loud: the item must go back. */
export function scanFeedback(result: { ok: true; line: { name: string; picked: number; packed: number; required: number } } | { code?: string; message: string }, stage: Stage): ScanFeedback {
  if ("ok" in result) {
    const n = stage === "PICK" ? result.line.picked : result.line.packed
    return { tone: "ok", title: result.line.name, detail: stage === "PICK" ? `${n} of ${result.line.required} picked` : `${n} verified` }
  }
  const title = result.code === "WRONG_ITEM" ? "WRONG ITEM" : result.code === "OVER_QTY" ? "ALREADY COMPLETE" : result.code === "NOT_NEEDED" ? "NOT NEEDED" : "Cannot scan"
  return { tone: "bad", title, detail: result.message, code: result.code }
}

/** Order status text for non-staff-facing labels (“PREPARING” → “Being prepared”). */
export function orderStatusLabel(status: string): string {
  const map: Record<string, string> = { CONFIRMED: "Confirmed", PREPARING: "Being prepared", PACKED: "Packed", OUT_FOR_DELIVERY: "Out for delivery", DELIVERED: "Delivered", CANCELLED: "Cancelled", REFUNDED: "Refunded", PENDING: "Pending" }
  return map[status] ?? status
}

export const BLOCKER_TEXT: Record<string, string> = {
  NOT_PICKED: "not collected yet",
  MISSING_UNDECIDED: "reported missing — waiting for a manager’s decision",
  NOT_VERIFIED: "not verified into the package",
  UNSETTLED: "not settled yet",
}

export const ATTENTION_LINK: Record<string, string> = {
  MISSING_ITEM: "Open the order to decide",
  WRONG_SCAN: "Open the order",
  DELAY: "Open the order",
  NO_RIDER: "Assign a rider",
  QR_REJECTED: "Check the rider",
  UNRELEASED_PICKUP: "Open the order",
}

/** A short beep so staff hear a wrong scan without looking. Fails silently where audio is blocked. */
export function beep(kind: "ok" | "bad"): void {
  try {
    const Ctx = typeof window !== "undefined" ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined
    if (!Ctx) return
    const ctx = new Ctx()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = kind === "ok" ? 880 : 220
    g.gain.value = 0.08
    o.connect(g)
    g.connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + (kind === "ok" ? 0.08 : 0.35))
    o.onended = () => void ctx.close()
  } catch {
    /* sound is a nicety, never a requirement */
  }
}
