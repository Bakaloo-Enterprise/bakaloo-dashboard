"use client"

import { useState } from "react"
import { AlertTriangle, ArrowRight, BadgeCheck, Settings2, TrendingUp, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useSaveTargets } from "@/hooks/useErp"
import type { DayCloseItem } from "@/types/erp.types"
import { count, inr, pctText } from "../format"
import { Empty, TONE } from "../kit"
import { cn } from "@/lib/utils"

type Filter = "all" | "price" | "waste" | "gaps"

function Flow({ r }: { r: DayCloseItem }) {
  const cell = (label: string, v: number, cls = "") => (
    <div className="min-w-[44px] text-center"><p className={cn("text-sm font-semibold tabular-nums", cls)}>{count(v)}</p><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p></div>
  )
  return (
    <div className="flex items-center gap-1" aria-label={`Opening ${r.opening}, bought ${r.bought}, sold ${r.sold}, lost ${r.wasted}, closing ${r.closing}`}>
      {cell("Had", r.opening)}<span className="text-muted-foreground/50">+</span>{cell("Bought", r.bought, r.bought > 0 ? "text-sky-600 dark:text-sky-400" : "text-muted-foreground")}
      <span className="text-muted-foreground/50">−</span>{cell("Sold", r.sold, "text-emerald-600 dark:text-emerald-400")}
      <span className="text-muted-foreground/50">−</span>{cell("Lost", r.wasted, r.wasted > 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground")}
      <ArrowRight className="mx-0.5 h-3.5 w-3.5 text-muted-foreground/50" aria-hidden />{cell("Left", r.closing)}
    </div>
  )
}

function PriceChip({ r }: { r: DayCloseItem }) {
  const a = r.price.advice
  if (!a || r.price.suggested == null) return <span className="text-xs text-muted-foreground">—</span>
  if (a === "RAISE") return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", TONE.amber.soft, TONE.amber.text)} title={`Sells at ${inr(r.price.average, false)}; to earn ${r.price.targetMarginPct}% it should be ${inr(r.price.suggested, false)}`}><TrendingUp className="h-3.5 w-3.5" aria-hidden />Raise to {inr(r.price.suggested)}</span>
  if (a === "ROOM_TO_DISCOUNT") return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", TONE.blue.soft, TONE.blue.text)} title={`Target price is ${inr(r.price.suggested, false)}; you sell at ${inr(r.price.average, false)}`}>Room to offer a deal</span>
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", TONE.green.soft, TONE.green.text)}><BadgeCheck className="h-3.5 w-3.5" aria-hidden />Price is right</span>
}

function TargetsDialog({ item, onClose }: { item: DayCloseItem | null; onClose: () => void }) {
  const save = useSaveTargets()
  const [m, setM] = useState("")
  const [w, setW] = useState("")
  const [seen, setSeen] = useState<string | null>(null)
  if (item && seen !== item.productId) { setSeen(item.productId); setM(String(item.price.targetMarginPct)); setW(String(item.targetWastePct)) }
  const num = (s: string) => (s.trim() === "" ? null : Number(s))
  const bad = (v: number | null, max: number) => v != null && (!Number.isFinite(v) || v < 0 || v > max)
  const invalid = bad(num(m), 89) || bad(num(w), 100)
  return (
    <Dialog open={Boolean(item)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{item?.name} — targets</DialogTitle><DialogDescription>What you aim for. Only used to give advice; no price changes by itself.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <label className="block text-sm font-medium">Profit I want on each sale (%)<Input inputMode="decimal" className="mt-1 h-11" value={m} onChange={(e) => setM(e.target.value)} aria-invalid={bad(num(m), 89)} /></label>
          <label className="block text-sm font-medium">Most I can afford to lose to spoilage (%)<Input inputMode="decimal" className="mt-1 h-11" value={w} onChange={(e) => setW(e.target.value)} aria-invalid={bad(num(w), 100)} /></label>
          {invalid && <p role="alert" className="text-xs text-rose-600">Profit must be 0–89 and spoilage 0–100.</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={invalid || save.isPending} onClick={() => item && save.mutate({ productId: item.productId, marginPct: num(m), wastagePct: num(w) }, { onSuccess: onClose })}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const wastesTooMuch = (i: DayCloseItem) => i.wastePct != null && i.wastePct > i.targetWastePct * 1.35 && i.wasteValue >= 80
const hasGap = (i: DayCloseItem) => i.ledgerGap !== 0 || i.shelfMismatch !== 0

export function DayCloseTable({ items, manage }: { items: DayCloseItem[]; manage: boolean }) {
  const [filter, setFilter] = useState<Filter>("all")
  const [editing, setEditing] = useState<DayCloseItem | null>(null)
  const FILTERS: Array<[Filter, string, number]> = [
    ["all", "Everything", items.length],
    ["price", "Fix the price", items.filter((i) => i.price.advice === "RAISE").length],
    ["waste", "Wasting too much", items.filter(wastesTooMuch).length],
    ["gaps", "Stock doesn't add up", items.filter(hasGap).length],
  ]
  const rows = items.filter((i) => filter === "all" || (filter === "price" && i.price.advice === "RAISE") || (filter === "waste" && wastesTooMuch(i)) || (filter === "gaps" && hasGap(i)))
  return (
    <section className="rounded-2xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b p-4">
        <h2 className="mr-auto text-base font-semibold">Product by product</h2>
        {FILTERS.map(([id, label, n]) => (
          <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}
            className={cn("rounded-full border px-3 py-1.5 text-xs font-medium", filter === id ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "hover:bg-muted")}>
            {label} <span className="ml-1 tabular-nums text-muted-foreground">{n}</span>
          </button>
        ))}
      </div>
      {rows.length === 0 ? <div className="p-4"><Empty>Nothing here for this day.</Empty></div> : (
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.productId} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1.3fr)_auto_minmax(0,1fr)_auto] md:items-center">
              <div className="min-w-0">
                <p className="truncate font-medium">{r.name} <span className="text-xs font-normal text-muted-foreground">{r.pack}</span></p>
                <p className="text-xs text-muted-foreground">{r.category} · cost {inr(r.unitCost, false)}{r.doorDamage ? ` · ${r.doorDamage.qty} damaged at the door` : ""}</p>
                {hasGap(r) && (
                  <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"><AlertTriangle className="h-3.5 w-3.5" aria-hidden />Stock records off by {r.ledgerGap !== 0 ? r.ledgerGap : r.shelfMismatch}</p>
                )}
              </div>
              <Flow r={r} />
              <div className="grid grid-cols-3 gap-2 text-right md:text-left">
                <div><p className="text-sm font-semibold tabular-nums">{inr(r.revenue)}</p><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Sales</p></div>
                <div><p className={cn("text-sm font-semibold tabular-nums", r.profit < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>{inr(r.profit)}</p><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Profit {pctText(r.marginPct)}</p></div>
                <div><p className={cn("text-sm font-semibold tabular-nums", wastesTooMuch(r) && "text-rose-600 dark:text-rose-400")}>{pctText(r.wastePct, 1)}</p><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Lost · aim {pctText(r.targetWastePct)}</p></div>
              </div>
              <div className="flex items-center justify-between gap-2 md:justify-end">
                <PriceChip r={r} />
                {manage && <button type="button" onClick={() => setEditing(r)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Set targets for ${r.name}`}><Settings2 className="h-4 w-4" aria-hidden /></button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <TargetsDialog item={editing} onClose={() => setEditing(null)} />
      <p className="flex items-center gap-1.5 border-t px-4 py-2.5 text-xs text-muted-foreground"><Trash2 className="h-3.5 w-3.5" aria-hidden />“Lost” = spoiled or damaged stock written off. Profit = sales − cost of what sold − what was lost.</p>
    </section>
  )
}
