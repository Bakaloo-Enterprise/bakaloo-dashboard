"use client"

import { useState } from "react"
import { Ban, CalendarClock, HandCoins, Pencil, Phone, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useProcurementMutations, useSupplierLedger } from "@/hooks/useBusiness"
import { cn } from "@/lib/utils"
import { formatRupees, istToday } from "./business-helpers"
import { InvoiceButton } from "./InvoiceButton"
import { PayDialog } from "./PayDialog"
import { SupplierFormDialog } from "./SupplierFormDialog"
import { TERMS_UI } from "./supplier-helpers"
import { dayWord } from "./requirement-helpers"

const BILL_TONE = { PAID: "border-green-300 bg-green-50 text-green-800", PART: "border-amber-300 bg-amber-50 text-amber-800", UNPAID: "border-red-300 bg-red-50 text-red-800" } as const
const BILL_WORD = { PAID: "Paid", PART: "Part paid", UNPAID: "Not paid" } as const

/** One supplier on one page: what we owe, every bill (with its invoice), and every payment. */
export function SupplierDialog({ vendorId, canManage, onOpenChange }: { vendorId: string | null; canManage: boolean; onOpenChange: (o: boolean) => void }) {
  const ledger = useSupplierLedger(vendorId)
  const { voidPayment } = useProcurementMutations()
  const [paying, setPaying] = useState(false)
  const [editing, setEditing] = useState(false)
  const today = istToday()
  const d = ledger.data
  const v = d?.vendor
  const terms = v?.paymentTerms ? TERMS_UI[v.paymentTerms] : null
  return (
    <Dialog open={Boolean(vendorId)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">{v?.name ?? "Supplier"}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {v?.phone && <a href={`tel:${v.phone}`} className="inline-flex items-center gap-1 font-semibold text-sky-700"><Phone className="h-4 w-4" aria-hidden />{v.phone}</a>}
            {terms && <span className="inline-flex items-center gap-1"><terms.icon className="h-4 w-4" aria-hidden />{terms.label}{v?.paymentTerms === "CREDIT" ? ` · ${v.creditDays} days` : ""}</span>}
            {v?.gstin && <span>GST {v.gstin}</span>}
          </DialogDescription>
        </DialogHeader>
        {ledger.isLoading || !d || !v ? <Skeleton className="h-48 w-full rounded-2xl" /> : (
          <div className="space-y-4">
            <div className={cn("rounded-2xl border-2 p-4", d.owed === 0 ? "border-green-300 bg-green-50" : d.overdue > 0 ? "border-red-300 bg-red-50" : "border-amber-300 bg-amber-50")}>
              <p className="text-sm font-semibold">{d.owed === 0 ? "All paid" : "You owe"}</p>
              <p className="text-4xl font-extrabold tabular-nums">{formatRupees(d.owed)}</p>
              <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-muted-foreground">
                {d.overdue > 0 && <span className="font-bold text-red-700">{formatRupees(d.overdue)} late</span>}
                {d.nextDue && d.owed > 0 && <span className="inline-flex items-center gap-1"><CalendarClock className="h-4 w-4" aria-hidden />Pay by {dayWord(d.nextDue, today)}</span>}
                {d.onTheWay && <span className="inline-flex items-center gap-1"><Truck className="h-4 w-4" aria-hidden />{d.onTheWay.count} on the way ({formatRupees(d.onTheWay.value)}) — not owed yet</span>}
              </p>
            </div>
            {canManage && (
              <div className="grid grid-cols-2 gap-3">
                <Button type="button" className="h-14 bg-green-600 text-base font-bold hover:bg-green-700" disabled={d.owed <= 0} onClick={() => setPaying(true)}><HandCoins className="mr-2 h-6 w-6" aria-hidden />I paid</Button>
                <Button type="button" variant="outline" className="h-14 border-2 text-base font-bold" onClick={() => setEditing(true)}><Pencil className="mr-2 h-5 w-5" aria-hidden />Change</Button>
              </div>
            )}

            <section aria-label="Bills">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">Bills</h3>
              {d.bills.length === 0 ? <p className="rounded-xl border-2 border-dashed p-4 text-center text-sm text-muted-foreground">No goods received from them yet.</p> : (
                <ul className="space-y-2">
                  {d.bills.map((b) => (
                    <li key={b.entryId} className="rounded-xl border-2 p-3">
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1"><p className="truncate font-semibold">{b.product} <span className="text-xs font-normal text-muted-foreground">#{b.entryNo} · {dayWord(b.procuredOn, today)}</span></p>
                          <p className="text-sm text-muted-foreground">{formatRupees(b.total)}{b.credit > 0 && ` − ${formatRupees(b.credit)} sent back`} {b.left > 0 && <span className={b.overdue ? "font-bold text-red-700" : ""}>· due {dayWord(b.dueOn, today)}{b.overdue ? " (late)" : ""}</span>}</p></div>
                        <span className={cn("shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold", BILL_TONE[b.status])}>{BILL_WORD[b.status]}{b.status === "PART" ? ` · ${formatRupees(b.left)} left` : ""}</span>
                      </div>
                      <div className="mt-2"><InvoiceButton entryId={b.entryId} hasInvoice={b.hasInvoice} canUpload={canManage} /></div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-label="Payments">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">Payments</h3>
              {d.payments.length === 0 ? <p className="rounded-xl border-2 border-dashed p-4 text-center text-sm text-muted-foreground">No payments yet.</p> : (
                <ul className="space-y-2">
                  {d.payments.map((p) => { const m = TERMS_UI[p.method]; return (
                    <li key={p.id} className={cn("flex items-center gap-3 rounded-xl border-2 p-3", p.voided && "opacity-50")}>
                      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", m.tone)}><m.icon className="h-5 w-5" aria-label={m.label} /></span>
                      <div className="min-w-0 flex-1"><p className={cn("font-bold tabular-nums", p.voided && "line-through")}>{formatRupees(p.amount)}</p><p className="truncate text-xs text-muted-foreground">{dayWord(p.paidOn, today)}{p.reference ? ` · ${p.reference}` : ""}{p.by ? ` · ${p.by}` : ""}{p.voided ? ` · cancelled: ${p.voidReason}` : ""}</p></div>
                      {canManage && !p.voided && <Button type="button" variant="ghost" size="sm" className="text-red-700" onClick={() => { const reason = window.prompt("Why cancel this payment?"); if (reason?.trim()) voidPayment.mutate({ id: p.id, reason: reason.trim() }) }} aria-label="Cancel this payment"><Ban className="mr-1 h-4 w-4" aria-hidden />Cancel</Button>}
                    </li>
                  ) })}
                </ul>
              )}
            </section>
            <PayDialog vendorId={v.id} vendorName={v.name} owed={d.owed} upiId={v.upiId} open={paying} onOpenChange={setPaying} />
            <SupplierFormDialog open={editing} onOpenChange={setEditing} vendor={v} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
