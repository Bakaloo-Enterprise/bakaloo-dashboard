"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Boxes, PackageOpen, Scale, Store, Trash2, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useProcurementMutations, useRepack } from "@/hooks/useBusiness"
import { useActiveShopsForSwitcher } from "@/hooks/useShops"
import { cn } from "@/lib/utils"
import type { ProcurementEntry } from "@/types/business.types"
import { formatRupees } from "./business-helpers"
import { PackSizeEditor } from "./PackSizeEditor"
import { QtyStepper } from "./QtyStepper"

/** 1500 g → "1.5 kg", 500 g → "500 g", 2000 ml → "2 L". */
export function amount(size: number, unit: "G" | "ML" | null) {
  const big = size >= 1000
  const n = big ? Math.round((size / 1000) * 1000) / 1000 : size
  return `${n} ${unit === "ML" ? (big ? "L" : "ml") : big ? "kg" : "g"}`
}

/** Turn bulk stock into the packs we sell. Weight in = weight out; what is lost on the way is shown, never hidden. */
export function RepackDialog({ entry, onOpenChange }: { entry: ProcurementEntry | null; onOpenChange: (o: boolean) => void }) {
  const preview = useRepack(entry?.id ?? null)
  const shops = useActiveShopsForSwitcher()
  const { repack, undoRepack } = useProcurementMutations()
  const [shopId, setShopId] = useState("")
  const [packs, setPacks] = useState<Record<string, number>>({})
  const [extra, setExtra] = useState(0)
  const p = preview.data
  useEffect(() => { setPacks({}); setExtra(0) }, [entry?.id])
  useEffect(() => { if (!shopId && p?.entry.dedicatedShopId) setShopId(p.entry.dedicatedShopId) }, [p, shopId])

  const unit = p?.unitSize ?? 0
  const made = useMemo(() => (p?.targets ?? []).reduce((n, t) => n + (packs[t.productId] ?? 0) * (t.packSize ?? 0), 0), [p, packs])
  const minUnits = unit > 0 ? Math.ceil(made / unit) : 0
  const unitsUsed = made > 0 ? minUnits + extra : 0
  const lost = unitsUsed * unit - made
  const lostPct = unitsUsed > 0 && unit > 0 ? Math.round((lost / (unitsUsed * unit)) * 1000) / 10 : 0
  const over = p ? unitsUsed > p.available : false
  const lines = (p?.targets ?? []).filter((t) => (packs[t.productId] ?? 0) > 0).map((t) => ({ shopId, productId: t.productId, packs: packs[t.productId] }))
  const ok = Boolean(p && !p.blocked && unit > 0 && shopId && lines.length > 0 && !over)

  if (!entry) return null
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl"><Boxes className="h-6 w-6" aria-hidden />Make packs from {entry.product.name}</DialogTitle>
          <DialogDescription>{entry.vendor.name} · #{entry.entryNo}</DialogDescription>
        </DialogHeader>
        {preview.isLoading || !p ? <Skeleton className="h-64 w-full rounded-2xl" /> : p.blocked ? (
          <p role="alert" className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-center font-semibold text-amber-900">{p.blocked}</p>
        ) : !p.unitSize ? (
          <div className="space-y-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
            <p className="flex items-center gap-2 font-bold text-amber-900"><Scale className="h-6 w-6" aria-hidden />How big is one unit of this purchase?</p>
            <PackSizeEditor productId={p.entry.product.id} />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-2xl border-2 border-sky-300 bg-sky-50 p-3">
              <PackageOpen className="h-9 w-9 shrink-0 text-sky-700" aria-hidden />
              <div className="flex-1"><p className="text-sm font-semibold text-sky-900">Free to repack</p><p className="text-2xl font-extrabold tabular-nums text-sky-900">{p.available} × {p.unitLabel} <span className="text-base font-bold">= {amount(p.available * unit, p.unit)}</span></p></div>
            </div>

            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-sm font-bold"><Store className="h-4 w-4" aria-hidden />Send the packs to</p>
              <select aria-label="Store" className="h-12 w-full rounded-xl border-2 bg-background px-3 text-base" value={shopId} disabled={Boolean(p.entry.dedicatedShopId)} onChange={(e) => setShopId(e.target.value)}>
                <option value="">Choose a store…</option>
                {(shops.data?.items ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <section aria-label="Packs to make" className="space-y-2">
              <p className="text-sm font-bold">How many packs?</p>
              {p.targets.length === 0 && <p className="rounded-xl border-2 border-dashed p-4 text-center text-sm text-muted-foreground">This product has no other pack sizes in its family.</p>}
              {p.targets.map((t) => (
                <div key={t.productId} className={cn("flex items-center gap-3 rounded-xl border-2 p-2.5", (packs[t.productId] ?? 0) > 0 ? "border-green-400 bg-green-50/60" : "")}>
                  {t.imageUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={t.imageUrl} alt="" className="h-12 w-12 rounded-lg border object-cover" /> : <span className="flex h-12 w-12 items-center justify-center rounded-lg border bg-muted"><PackageOpen className="h-6 w-6 text-muted-foreground" aria-hidden /></span>}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{t.name}</p>
                    {t.packSize && t.packUnit === p.unit ? <p className="text-xs text-muted-foreground"><strong className="text-base text-foreground">{t.label}</strong> pack · costs {t.cost !== null ? formatRupees(t.cost) : "—"} each</p>
                      : t.packSize ? <p className="text-xs font-semibold text-red-700">{t.label} — different kind of measure, cannot be made from this</p>
                      : <div className="mt-1"><p className="mb-1 text-xs font-semibold text-amber-800">Size not set</p><PackSizeEditor productId={t.productId} compact /></div>}
                  </div>
                  {t.packSize && t.packUnit === p.unit && <QtyStepper label={`${t.name} packs`} value={packs[t.productId] ?? 0} onChange={(n) => setPacks((x) => ({ ...x, [t.productId]: n }))} />}
                </div>
              ))}
            </section>

            {made > 0 && (
              <div className="space-y-2 rounded-2xl border-2 p-3" aria-live="polite">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl border-2 border-sky-300 bg-sky-50 p-2"><p className="text-xs font-semibold">Uses up</p><p className="text-xl font-extrabold tabular-nums">{unitsUsed}</p><p className="text-[11px]">× {p.unitLabel} = {amount(unitsUsed * unit, p.unit)}</p></div>
                  <div className="rounded-xl border-2 border-green-300 bg-green-50 p-2"><p className="text-xs font-semibold">Packs weigh</p><p className="text-xl font-extrabold tabular-nums">{amount(made, p.unit)}</p></div>
                  <div className={cn("rounded-xl border-2 p-2", lost > 0 ? "border-red-300 bg-red-50 text-red-800" : "border-green-300 bg-green-50")}><p className="flex items-center justify-center gap-1 text-xs font-semibold">{lost > 0 && <Trash2 className="h-3 w-3" aria-hidden />}Lost</p><p className="text-xl font-extrabold tabular-nums">{amount(lost, p.unit)}</p><p className="text-[11px]">{lost > 0 ? `${lostPct}% · ${formatRupees((lost * (p.costPerGram ?? 0)))}` : "nothing"}</p></div>
                </div>
                <div className="flex items-center justify-between gap-2 text-sm"><span>Use more units (for trimming)?</span><QtyStepper label="extra units" value={extra} min={0} max={Math.max(0, p.available - minUnits)} onChange={setExtra} /></div>
                {over && <p role="alert" className="flex items-center gap-2 text-sm font-bold text-red-700"><AlertTriangle className="h-4 w-4" aria-hidden />That needs {unitsUsed} units but only {p.available} is free.</p>}
              </div>
            )}

            <Button type="button" className="h-14 w-full bg-green-600 text-lg font-bold hover:bg-green-700" disabled={!ok || repack.isPending} onClick={() => repack.mutate({ id: entry.id, unitsUsed, lines }, { onSuccess: () => { setPacks({}); setExtra(0) } })}>
              <Boxes className="mr-2 h-6 w-6" aria-hidden />Make the packs
            </Button>

            {p.history.length > 0 && (
              <section aria-label="Made so far">
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">Made so far</h3>
                <ul className="space-y-2">
                  {p.history.map((h) => (
                    <li key={h.id} className={cn("rounded-xl border-2 p-2.5 text-sm", h.status === "REVERSED" && "opacity-50")}>
                      <div className="flex items-center gap-2"><span className="flex-1 font-semibold">{h.unitsUsed} × {p.unitLabel} → {amount(h.gramsPacked, p.unit)}{h.gramsLost > 0 ? ` (lost ${amount(h.gramsLost, p.unit)})` : ""}{h.status === "REVERSED" ? " · undone" : ""}</span>
                        {h.status === "APPLIED" && <Button type="button" variant="ghost" size="sm" className="text-red-700" disabled={undoRepack.isPending} onClick={() => undoRepack.mutate(h.id)}><Undo2 className="mr-1 h-4 w-4" aria-hidden />Undo</Button>}</div>
                      <p className="text-xs text-muted-foreground">{h.lines.map((l) => `${l.packs} × ${l.productName} → ${l.shopName}`).join(" · ")}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
