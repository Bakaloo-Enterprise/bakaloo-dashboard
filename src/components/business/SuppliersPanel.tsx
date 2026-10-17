"use client"

import { useState } from "react"
import { AlertTriangle, CheckCircle2, ChevronRight, HandCoins, Phone, Plus, Truck, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { usePayables } from "@/hooks/useBusiness"
import { cn } from "@/lib/utils"
import { formatRupees, istToday } from "./business-helpers"
import { dayWord } from "./requirement-helpers"
import { SupplierDialog } from "./SupplierDialog"
import { SupplierFormDialog } from "./SupplierFormDialog"
import { TERMS_UI } from "./supplier-helpers"

/** All suppliers with one number each: how much we owe them. Late ones first. */
export function SuppliersPanel({ canManage }: { canManage: boolean }) {
  const pay = usePayables()
  const [open, setOpen] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const today = istToday()
  if (pay.isLoading) return <Skeleton className="h-48 w-full rounded-2xl" />
  if (pay.isError || !pay.data) return <p role="alert" className="text-sm text-red-600">Could not load suppliers.</p>
  const d = pay.data
  const late = d.totalOverdue > 0
  return (
    <div className="space-y-3">
      <div className={cn("flex flex-wrap items-center gap-3 rounded-2xl border-2 p-4", d.totalOwed === 0 ? "border-green-300 bg-green-50" : late ? "border-red-300 bg-red-50" : "border-amber-300 bg-amber-50")}>
        {d.totalOwed === 0 ? <CheckCircle2 className="h-9 w-9 text-green-600" aria-hidden /> : late ? <AlertTriangle className="h-9 w-9 text-red-600" aria-hidden /> : <HandCoins className="h-9 w-9 text-amber-600" aria-hidden />}
        <div className="flex-1"><p className="text-sm font-semibold">{d.totalOwed === 0 ? "We owe nothing" : "We owe suppliers"}</p><p className="text-3xl font-extrabold tabular-nums">{formatRupees(d.totalOwed)}</p>{late && <p className="text-sm font-bold text-red-700">{formatRupees(d.totalOverdue)} is late</p>}</div>
        {canManage && <Button className="h-12 bg-green-600 text-base font-bold hover:bg-green-700" onClick={() => setAdding(true)}><Plus className="mr-1.5 h-5 w-5" aria-hidden />New supplier</Button>}
      </div>
      {d.vendors.length === 0 ? <p role="status" className="rounded-2xl border-2 border-dashed p-10 text-center text-muted-foreground"><Users className="mx-auto mb-2 h-10 w-10" aria-hidden />No suppliers yet.</p> : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {d.vendors.map((v) => { const t = TERMS_UI[v.paymentTerms]; return (
            <li key={v.vendorId}>
              <button type="button" onClick={() => setOpen(v.vendorId)} className={cn("flex w-full items-center gap-3 rounded-2xl border-2 bg-card p-3 text-left shadow-sm hover:bg-muted/40", v.overdue > 0 ? "border-red-300" : v.owed > 0 ? "border-amber-300" : "border-green-300", !v.isActive && "opacity-60")}>
                <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border", t.tone)} title={t.hint}><t.icon className="h-6 w-6" aria-label={t.label} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold">{v.name}</span>
                  <span className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                    {v.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" aria-hidden />{v.phone}</span>}
                    {v.nextDue && v.owed > 0 && <span className={v.overdue > 0 ? "font-bold text-red-700" : ""}>pay by {dayWord(v.nextDue, today)}</span>}
                    {v.onTheWay && <span className="inline-flex items-center gap-1"><Truck className="h-3 w-3" aria-hidden />{v.onTheWay.count} coming</span>}
                  </span>
                </span>
                <span className="shrink-0 text-right">{v.owed > 0 ? <><span className="block text-xs text-muted-foreground">owe</span><span className={cn("text-lg font-extrabold tabular-nums", v.overdue > 0 ? "text-red-700" : "text-amber-800")}>{formatRupees(v.owed)}</span></> : <CheckCircle2 className="h-7 w-7 text-green-600" aria-label="Nothing owed" />}</span>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ) })}
        </ul>
      )}
      <details className="text-xs text-muted-foreground"><summary className="cursor-pointer select-none">How is this worked out?</summary><p className="mt-1">{d.note}</p></details>
      <SupplierDialog vendorId={open} canManage={canManage} onOpenChange={(o) => !o && setOpen(null)} />
      <SupplierFormDialog open={adding} onOpenChange={setAdding} />
    </div>
  )
}
