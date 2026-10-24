"use client"

import { useState } from "react"
import { AlertOctagon, CheckCircle2, Clock, Copy, Leaf, ShoppingCart } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import type { Forecast, ForecastItem, ForecastRisk } from "@/types/erp.types"
import { count, dayLabel, inr } from "../format"
import { Empty, Help, TONE, type Tone } from "../kit"
import { cn } from "@/lib/utils"

const RISK: Record<ForecastRisk, { label: string; tone: Tone; Icon: typeof Clock }> = {
  RUNS_OUT_TODAY: { label: "Runs out today", tone: "rose", Icon: AlertOctagon },
  BUY_FOR_TOMORROW: { label: "Buy for tomorrow", tone: "amber", Icon: ShoppingCart },
  LOW: { label: "Getting low", tone: "amber", Icon: Clock },
  WILL_SPOIL: { label: "Too much — may spoil", tone: "violet", Icon: Leaf },
  OK: { label: "Enough", tone: "green", Icon: CheckCircle2 },
  NO_DATA: { label: "Not enough sales yet", tone: "slate", Icon: Clock },
}

function Mini({ values }: { values: number[] }) {
  const max = Math.max(1, ...values)
  return <div className="flex h-8 items-end gap-0.5" aria-hidden>{values.map((v, i) => <div key={i} className="w-2 rounded-t bg-emerald-500/60" style={{ height: `${Math.max(8, (v / max) * 100)}%` }} />)}</div>
}

type Filter = "buy" | "all"

export function ForecastTable({ f }: { f: Forecast }) {
  const [filter, setFilter] = useState<Filter>("buy")
  const rows: ForecastItem[] = filter === "buy" ? f.items.filter((i) => i.buy > 0 || i.risk === "RUNS_OUT_TODAY" || i.risk === "WILL_SPOIL") : f.items
  const copy = async () => {
    const lines = f.items.filter((i) => i.buy > 0).map((i) => `• ${i.name} (${i.pack ?? i.unit ?? ""}) — ${i.buy}`)
    const text = `Buy list for ${dayLabel(f.forecastFrom)}\n${lines.join("\n")}`
    try { await navigator.clipboard.writeText(text); toast.success("Buy list copied") } catch { toast.error("Could not copy — select and copy by hand") }
  }
  return (
    <section className="rounded-2xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b p-4">
        <h2 className="mr-auto flex items-center gap-1.5 text-base font-semibold">What to buy for {dayLabel(f.forecastFrom)} <Help text={f.definitions.forecast} /></h2>
        {([["buy", "Needs action", f.items.filter((i) => i.buy > 0 || i.risk === "RUNS_OUT_TODAY" || i.risk === "WILL_SPOIL").length], ["all", "All products", f.items.length]] as const).map(([id, label, n]) => (
          <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)} className={cn("rounded-full border px-3 py-1.5 text-xs font-medium", filter === id ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "hover:bg-muted")}>{label} <span className="ml-1 tabular-nums text-muted-foreground">{n}</span></button>
        ))}
        <Button type="button" variant="outline" className="h-9 rounded-xl" onClick={copy} disabled={!f.items.some((i) => i.buy > 0)}><Copy className="mr-1.5 h-4 w-4" aria-hidden />Copy buy list</Button>
      </div>
      {rows.length === 0 ? <div className="p-4"><Empty>Nothing needs buying — stock covers tomorrow.</Empty></div> : (
        <ul className="divide-y">
          {rows.map((i) => {
            const r = RISK[i.risk]
            return (
              <li key={i.productId} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_auto_auto] md:items-center">
                <div className="min-w-0">
                  <p className="truncate font-medium">{i.name} <span className="text-xs font-normal text-muted-foreground">{i.pack}</span></p>
                  <span className={cn("mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", TONE[r.tone].soft, TONE[r.tone].text)}><r.Icon className="h-3.5 w-3.5" aria-hidden />{r.label}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div><p className="font-semibold tabular-nums">{count(i.stock)}</p><p className="text-[10px] uppercase tracking-wide text-muted-foreground">On shelf{i.incoming > 0 ? ` +${i.incoming} coming` : ""}</p></div>
                  <div><p className="font-semibold tabular-nums">{count(Math.round(i.expectedTonight))}</p><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Left tonight</p></div>
                  <div><p className="font-semibold tabular-nums">{i.tomorrow}</p><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Will sell</p></div>
                </div>
                <Mini values={i.daily.map((d) => d.units)} />
                <div className="text-right">
                  {i.buy > 0 ? <><p className="text-2xl font-bold tabular-nums leading-none">{i.buy}</p><p className="mt-0.5 text-[11px] text-muted-foreground">to buy · ≈ {inr(i.buyValue)}</p></> : <p className="text-sm text-muted-foreground">Nothing to buy</p>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
