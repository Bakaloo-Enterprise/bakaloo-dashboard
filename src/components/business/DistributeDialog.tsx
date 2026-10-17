"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Handshake, Lock, Send, Store, Wand2, Warehouse } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useDistribution, useProcurementMutations } from "@/hooks/useBusiness"
import { cn } from "@/lib/utils"
import type { DistributionPreview, ProcurementEntry } from "@/types/business.types"
import { istToday } from "./business-helpers"
import { QtyStepper } from "./QtyStepper"
import { dayWord } from "./requirement-helpers"

type Plan = { res: Record<string, number>; alloc: Record<string, number> }
const fromSuggestion = (p: DistributionPreview): Plan => ({
  res: Object.fromEntries(p.requests.map((r) => [r.id, p.suggestion.reservations.find((x) => x.requirementId === r.id)?.quantity ?? 0])),
  alloc: Object.fromEntries(p.suggestion.stores.map((s) => [s.shopId, s.total])),
})
const sum = (o: Record<string, number>) => Object.values(o).reduce((n, v) => n + v, 0)

/** Where should this purchase go? We suggest, you adjust, one tap sends it all (customer holds + store stock together). */
export function DistributeDialog({ entry, onOpenChange }: { entry: ProcurementEntry | null; onOpenChange: (o: boolean) => void }) {
  const preview = useDistribution(entry?.id ?? null)
  const { distribute } = useProcurementMutations()
  const [plan, setPlan] = useState<Plan>({ res: {}, alloc: {} })
  const p = preview.data
  useEffect(() => { if (p) setPlan(fromSuggestion(p)) }, [p])
  if (!entry) return null

  const today = istToday()
  const reserved = sum(plan.res)
  const sent = sum(plan.alloc)
  const left = (p?.available ?? 0) - reserved - sent
  const pct = (n: number) => `${p && p.available > 0 ? Math.max(0, Math.min(100, (n / p.available) * 100)) : 0}%`
  const sh = p?.suggestion.shortages
  const send = () => {
    if (!p || left < 0 || reserved + sent === 0) return
    distribute.mutate(
      { id: entry.id, reservations: Object.entries(plan.res).filter(([, q]) => q > 0).map(([requirementId, quantity]) => ({ requirementId, quantity })), allocations: Object.entries(plan.alloc).filter(([, q]) => q > 0).map(([shopId, quantity]) => ({ shopId, quantity })) },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl"><Send className="h-6 w-6" aria-hidden />Send {entry.product.name}</DialogTitle>
          <DialogDescription>{entry.vendor.name} · #{entry.entryNo}{p?.entry.dedicatedTo ? ` · only for ${p.entry.dedicatedTo}` : ""}</DialogDescription>
        </DialogHeader>
        {preview.isLoading || !p ? <Skeleton className="h-64 w-full rounded-2xl" /> : p.blocked ? (
          <p role="alert" className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-center font-semibold text-amber-900">{p.blocked}</p>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="mb-1 flex items-baseline justify-between"><span className="text-sm font-semibold">To share</span><span className="text-3xl font-extrabold tabular-nums">{p.available}</span></div>
              <div className="flex h-5 overflow-hidden rounded-full border bg-muted" role="img" aria-label={`${reserved} for customers, ${sent} to stores, ${left} stays here`}>
                <div className="bg-violet-500" style={{ width: pct(reserved) }} /><div className="bg-sky-500" style={{ width: pct(sent) }} /><div className="bg-slate-300" style={{ width: pct(Math.max(0, left)) }} />
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 text-xs font-semibold">
                <span className="text-violet-700">● Customers {reserved}</span><span className="text-sky-700">● Stores {sent}</span><span className={left < 0 ? "text-red-700" : "text-slate-600"}>● Stays here {left}</span>
              </div>
            </div>

            {(sh?.b2b || sh?.appOrders || sh?.shelves) ? (
              <ul className="space-y-1" aria-label="Shortages">
                {sh.b2b > 0 && <li className="flex items-center gap-2 rounded-xl border-2 border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800"><AlertTriangle className="h-5 w-5" aria-hidden />Customers are short by {sh.b2b}. Buy more.</li>}
                {sh.appOrders > 0 && <li className="flex items-center gap-2 rounded-xl border-2 border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800"><AlertTriangle className="h-5 w-5" aria-hidden />App B2B orders are short by {sh.appOrders}.</li>}
                {sh.shelves > 0 && <li className="flex items-center gap-2 rounded-xl border-2 border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900"><AlertTriangle className="h-5 w-5" aria-hidden />Shelves are short by {sh.shelves}.</li>}
              </ul>
            ) : null}

            {p.requests.length > 0 && (
              <section aria-label="Held for customers">
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-violet-700"><Handshake className="h-5 w-5" aria-hidden />Keep for customers</h3>
                <ul className="space-y-2">
                  {p.requests.map((r) => (
                    <li key={r.id} className="flex items-center gap-3 rounded-xl border-2 border-violet-200 bg-violet-50/50 p-2.5">
                      <Lock className="h-5 w-5 shrink-0 text-violet-600" aria-hidden />
                      <div className="min-w-0 flex-1"><p className="truncate font-semibold">{r.customer}</p><p className="text-xs text-muted-foreground">needs {r.open} · {dayWord(r.due, today)}</p></div>
                      <QtyStepper label={`${r.customer} hold`} value={plan.res[r.id] ?? 0} max={Math.min(r.open, (plan.res[r.id] ?? 0) + Math.max(0, left))} onChange={(n) => setPlan((x) => ({ ...x, res: { ...x.res, [r.id]: n } }))} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section aria-label="Stores">
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-sky-700"><Store className="h-5 w-5" aria-hidden />Send to stores</h3>
              {p.suggestion.stores.length === 0 ? <p className="rounded-xl border-2 border-dashed p-4 text-center text-sm text-muted-foreground">No store carries this product yet.</p> : (
                <ul className="space-y-2">
                  {p.suggestion.stores.map((s) => (
                    <li key={s.shopId} className="flex items-center gap-3 rounded-xl border-2 border-sky-200 bg-sky-50/50 p-2.5">
                      <Store className="h-5 w-5 shrink-0 text-sky-600" aria-hidden />
                      <div className="min-w-0 flex-1"><p className="truncate font-semibold">{s.name}</p><p className="text-xs text-muted-foreground">has {s.stock}{s.appOrders > 0 ? ` · ${s.appOrders} promised to app B2B` : ""}{s.retailNeed > 0 ? ` · shelf wants ${s.retailNeed}` : ""}</p></div>
                      <QtyStepper label={`${s.name} stock`} value={plan.alloc[s.shopId] ?? 0} max={(plan.alloc[s.shopId] ?? 0) + Math.max(0, left)} onChange={(n) => setPlan((x) => ({ ...x, alloc: { ...x.alloc, [s.shopId]: n } }))} />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="flex items-center gap-3 rounded-xl border-2 bg-muted/40 p-3"><Warehouse className="h-6 w-6 text-slate-600" aria-hidden /><div className="flex-1"><p className="font-semibold">Stays in the warehouse</p><p className="text-xs text-muted-foreground">Not sent anywhere yet</p></div><span className={cn("text-2xl font-extrabold tabular-nums", left < 0 && "text-red-700")}>{left}</span></div>
            {left < 0 && <p role="alert" className="text-sm font-semibold text-red-700">That is {-left} more than you have. Lower a number.</p>}

            <div className="grid grid-cols-3 gap-3">
              <Button type="button" variant="outline" className="h-14 border-2" onClick={() => setPlan(fromSuggestion(p))}><Wand2 className="mr-1.5 h-5 w-5" aria-hidden />Reset</Button>
              <Button type="button" className="col-span-2 h-14 bg-green-600 text-lg font-bold hover:bg-green-700" disabled={left < 0 || reserved + sent === 0 || distribute.isPending} onClick={send}><Send className="mr-2 h-6 w-6" aria-hidden />Send</Button>
            </div>
            <details className="text-xs text-muted-foreground"><summary className="cursor-pointer select-none">How is this suggested?</summary><p className="mt-1">{p.note}</p></details>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
