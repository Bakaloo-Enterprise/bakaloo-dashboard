"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { AlertTriangle } from "lucide-react"
import type { Wastage } from "@/types/erp.types"
import { count, dayLabel, inr, pctText } from "../format"
import { Bar as Prog, Empty, Panel, TONE, type Tone } from "../kit"
import { cn } from "@/lib/utils"

const REASON_TONE: Tone[] = ["rose", "amber", "violet", "blue", "green", "slate"]
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function DailyLoss({ w }: { w: Wastage }) {
  const has = w.daily.some((d) => d.value > 0)
  return (
    <Panel title="Loss, day by day" hint={`${inr(w.totals.perDay)} on an average day`}>
      {!has ? <Empty>No spoilage recorded in this period.</Empty> : (
        <div className="h-[240px]">
          <ResponsiveContainer>
            <BarChart data={w.daily} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="day" tickFormatter={dayLabel} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} minTickGap={20} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={46} tickFormatter={(v: number) => inr(v).replace("₹", "")} />
              <Tooltip formatter={(v: number | undefined) => [inr(v ?? 0, false), "Lost"]} labelFormatter={(l) => dayLabel(String(l))} />
              <Bar dataKey="value" fill="#f43f5e" fillOpacity={0.85} radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  )
}

export function ReasonPanel({ w }: { w: Wastage }) {
  return (
    <Panel title="Why it was lost" hint="Reason written when the stock was removed">
      {w.byReason.length === 0 ? <Empty>Nothing lost.</Empty> : (
        <ul className="space-y-3">
          {w.byReason.map((r, i) => (
            <li key={r.reason}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm"><span className="truncate font-medium">{r.reason}</span><span className="shrink-0 tabular-nums"><b>{inr(r.value)}</b> <span className="text-xs text-muted-foreground">{pctText(r.sharePct)}</span></span></div>
              <Prog pct={r.sharePct ?? 0} tone={REASON_TONE[i % REASON_TONE.length]} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

export function Heatmap({ w }: { w: Wastage }) {
  const max = Math.max(1, ...w.heatmap.flatMap((h) => h.weekdays))
  return (
    <Panel title="When it happens" hint="Biggest losses by weekday. Darker = more money.">
      {w.heatmap.length === 0 ? <Empty>Nothing lost.</Empty> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[460px] border-separate border-spacing-1 text-xs">
            <thead><tr><th className="w-36 text-left font-medium text-muted-foreground" /> {DOW.map((d) => <th key={d} className="font-medium text-muted-foreground">{d}</th>)}</tr></thead>
            <tbody>
              {w.heatmap.map((h) => (
                <tr key={h.productId}>
                  <td className="truncate pr-2 text-sm font-medium">{h.name}</td>
                  {h.weekdays.map((v, i) => (
                    <td key={i} className="h-9 rounded-md text-center tabular-nums" style={{ background: v > 0 ? `rgba(244,63,94,${0.12 + (v / max) * 0.78})` : "hsl(var(--muted)/0.5)", color: v / max > 0.55 ? "#fff" : undefined }} title={`${h.name} · ${DOW[i]} · ${inr(v, false)}`}>{v > 0 ? inr(v).replace("₹", "") : ""}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

export function ProductLoss({ w }: { w: Wastage }) {
  const top = w.products.slice(0, 12)
  const concentration = w.products.slice(0, 5).at(-1)?.cumulativePct
  return (
    <Panel title="Who loses the most" hint={concentration != null && w.products.length > 5 ? `The top 5 products are ${pctText(concentration)} of all the loss.` : "Biggest losses first"}>
      {top.length === 0 ? <Empty>Nothing lost.</Empty> : (
        <ul className="divide-y">
          {top.map((p) => (
            <li key={p.productId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5">
              <div className="min-w-0">
                <p className="flex items-center gap-2 truncate text-sm font-medium">{p.name}{p.breach && <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", TONE.rose.soft, TONE.rose.text)}><AlertTriangle className="h-3 w-3" aria-hidden />Too high</span>}</p>
                <p className="text-xs text-muted-foreground">{count(p.qty)} lost of {count(p.handled)} handled · {p.topReason ?? "—"}</p>
              </div>
              <div className="text-right"><p className="text-sm font-semibold tabular-nums">{inr(p.value)}</p><p className={cn("text-xs tabular-nums", p.breach ? "font-semibold text-rose-600 dark:text-rose-400" : "text-muted-foreground")}>{pctText(p.wastePct, 1)} · aim {pctText(p.targetPct)}</p></div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

export function DoorDamage({ w }: { w: Wastage }) {
  return (
    <Panel title="Damaged at the door" hint="Found broken or rotten when a purchase arrived — claim it from the vendor">
      {w.doorDamage.byVendor.length === 0 ? <Empty>No damage reported at receiving.</Empty> : (
        <ul className="divide-y">
          {w.doorDamage.byVendor.map((v) => <li key={v.vendor} className="flex items-center justify-between py-2.5 text-sm"><span className="font-medium">{v.vendor}</span><span className="tabular-nums"><b>{inr(v.value)}</b> <span className="text-xs text-muted-foreground">{count(v.qty)} items</span></span></li>)}
        </ul>
      )}
    </Panel>
  )
}
