"use client"

import { useState } from "react"
import { AlertTriangle, ArrowRightCircle, CalendarClock, CheckCircle2, Lock, LockOpen, Snowflake, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useBizMe, useMonthMutations } from "@/hooks/useBusiness"
import { cn } from "@/lib/utils"
import type { MonthlyPreview } from "@/types/business.types"

const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "")

/** One card says where the month stands: running, ready to close, blocked, or closed (frozen). */
export function MonthClosingCard({ report }: { report: MonthlyPreview }) {
  const me = useBizMe()
  const { close, reopen } = useMonthMutations()
  const [dialog, setDialog] = useState<"close" | "reopen" | null>(null)
  const [note, setNote] = useState("")
  const c = report.closing
  const manage = Boolean(me.data?.procurementManage)
  const warns = report.exceptions.filter((e) => e.level !== "info")
  const done = () => { setDialog(null); setNote("") }

  const tone = c.state === "CLOSED" ? "border-green-400 bg-green-50 text-green-900" : c.state === "RUNNING" ? "border-amber-300 bg-amber-50 text-amber-900" : c.canClose ? "border-sky-400 bg-sky-50 text-sky-900" : "border-red-300 bg-red-50 text-red-900"
  return (
    <section aria-label="Month closing" className={cn("rounded-2xl border-2 p-4", tone)}>
      <div className="flex flex-wrap items-center gap-3">
        {c.state === "CLOSED" ? <Lock className="h-9 w-9 shrink-0" aria-hidden /> : c.state === "RUNNING" ? <CalendarClock className="h-9 w-9 shrink-0" aria-hidden /> : c.canClose ? <LockOpen className="h-9 w-9 shrink-0" aria-hidden /> : <AlertTriangle className="h-9 w-9 shrink-0" aria-hidden />}
        <div className="min-w-0 flex-1">
          <p className="text-lg font-extrabold">
            {c.state === "CLOSED" ? "This month is closed" : c.state === "RUNNING" ? "This month is still running" : c.canClose ? "Ready to close" : "Cannot close yet"}
          </p>
          <p className="text-sm">
            {c.state === "CLOSED" ? `Frozen on ${day(c.closedAt)}${c.closedBy ? ` by ${c.closedBy}` : ""}.${c.note ? ` “${c.note}”` : ""}`
              : c.state === "RUNNING" ? "You can close it once the month has ended."
              : c.canClose ? `${warns.length === 0 ? "All checks passed." : `${warns.length} thing${warns.length === 1 ? "" : "s"} to look at (they do not block closing).`}`
              : "Fix the red items below first."}
          </p>
        </div>
        {manage && c.state === "OPEN" && c.canClose && <Button className="h-12 bg-sky-700 px-5 text-base font-bold hover:bg-sky-800" onClick={() => setDialog("close")}><Lock className="mr-2 h-5 w-5" aria-hidden />Close this month</Button>}
        {manage && c.state === "CLOSED" && c.canReopen && <Button variant="outline" className="h-12 border-2 bg-white px-5 text-base font-bold" onClick={() => setDialog("reopen")}><Undo2 className="mr-2 h-5 w-5" aria-hidden />Reopen</Button>}
      </div>
      {(c.reasons.length > 0 || c.blockers.length > 0) && c.state !== "RUNNING" && (
        <ul className="mt-3 space-y-1.5">
          {[...c.reasons, ...c.blockers].map((t) => <li key={t} className="flex items-start gap-2 rounded-xl bg-white/70 px-3 py-2 text-sm font-semibold"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{t}</li>)}
        </ul>
      )}

      <Dialog open={dialog === "close"} onOpenChange={(o) => !o && done()}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl"><Lock className="h-6 w-6" aria-hidden />Close {report.window.label}?</DialogTitle>
            <DialogDescription className="sr-only">What closing a month does</DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-3 rounded-xl border-2 p-3"><Snowflake className="mt-0.5 h-6 w-6 shrink-0 text-sky-600" aria-hidden /><span><strong>Numbers are frozen.</strong> The report and the Excel file stay exactly as they are now.</span></li>
            <li className="flex items-start gap-3 rounded-xl border-2 p-3"><Lock className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" aria-hidden /><span><strong>No new purchases or supplier payments</strong> can be dated in this month.</span></li>
            <li className="flex items-start gap-3 rounded-xl border-2 p-3"><ArrowRightCircle className="mt-0.5 h-6 w-6 shrink-0 text-green-600" aria-hidden /><span><strong>Closing stock becomes next month’s opening stock</strong> ({report.summary.stock.totalClosing.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}).</span></li>
            <li className="flex items-start gap-3 rounded-xl border-2 p-3"><Undo2 className="mt-0.5 h-6 w-6 shrink-0 text-slate-600" aria-hidden /><span>You can reopen it later (the latest month only). It is written in the log.</span></li>
          </ul>
          {warns.length > 0 && <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{warns.length} thing{warns.length === 1 ? "" : "s"} still to look at. They will be saved with the month.</p>}
          <Input className="h-11" placeholder="Note (optional)" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} aria-label="Note" />
          <Button className="h-14 bg-sky-700 text-lg font-bold hover:bg-sky-800" disabled={close.isPending} onClick={() => close.mutate({ month: report.window.month, note: note.trim() || undefined }, { onSuccess: done })}><CheckCircle2 className="mr-2 h-6 w-6" aria-hidden />Yes, close it</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "reopen"} onOpenChange={(o) => !o && done()}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl"><LockOpen className="h-6 w-6" aria-hidden />Reopen {report.window.label}?</DialogTitle>
            <DialogDescription>The frozen numbers are removed and the month is worked out live again. Say why.</DialogDescription>
          </DialogHeader>
          <Input className="h-11" placeholder="Why are you reopening it?" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} aria-label="Reason" />
          <Button className="h-14 text-lg font-bold" variant="destructive" disabled={!note.trim() || reopen.isPending} onClick={() => reopen.mutate({ month: report.window.month, reason: note.trim() }, { onSuccess: done })}><LockOpen className="mr-2 h-6 w-6" aria-hidden />Reopen the month</Button>
        </DialogContent>
      </Dialog>
    </section>
  )
}
