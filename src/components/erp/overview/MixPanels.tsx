"use client"

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"
import type { OverviewData } from "@/types/overview.types"
import { count, hourLabel, inr, pctText } from "../format"
import { Bar, Empty, Panel, TONE, type Tone } from "../kit"
import { cn } from "@/lib/utils"

const CH_COLOR: Record<string, string> = { B2C: "#0ea5e9", B2B: "#f97316" }
const CH_NAME: Record<string, string> = { B2C: "Home customers", B2B: "Business" }

export function ChannelPanel({ d }: { d: OverviewData }) {
  const total = d.channels.reduce((t, c) => t + c.gross, 0)
  return (
    <Panel title="Who buys" hint="Share of sales, home vs business">
      {total <= 0 ? <Empty>No sales yet.</Empty> : (
        <div className="flex items-center gap-5">
          <div className="relative h-36 w-36 shrink-0">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={d.channels} dataKey="gross" nameKey="channel" innerRadius={44} outerRadius={64} paddingAngle={3} strokeWidth={0} isAnimationActive={false}>
                  {d.channels.map((c) => <Cell key={c.channel} fill={CH_COLOR[c.channel]} />)}
                </Pie>
                <Tooltip formatter={(v: number | undefined, n: string | undefined) => [inr(v ?? 0, false), CH_NAME[n ?? ""] ?? n ?? ""]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div><p className="text-lg font-bold tabular-nums">{inr(total)}</p><p className="text-[10px] uppercase tracking-wide text-muted-foreground">sold</p></div>
            </div>
          </div>
          <ul className="flex-1 space-y-3">
            {d.channels.map((c) => (
              <li key={c.channel}>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: CH_COLOR[c.channel] }} />{CH_NAME[c.channel]}</span>
                  <span className="font-semibold tabular-nums">{inr(c.gross)}</span>
                </div>
                <p className="text-xs text-muted-foreground">{count(c.orders)} orders · {pctText(c.sharePct)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  )
}

const CAT_TONES: Tone[] = ["green", "blue", "violet", "amber", "rose", "slate"]

export function CategoryPanel({ d }: { d: OverviewData }) {
  const rows = d.categories.slice(0, 6)
  return (
    <Panel title="What sells" hint="Sales by category">
      {rows.length === 0 ? <Empty>No sales yet.</Empty> : (
        <ul className="space-y-3">
          {rows.map((c, i) => (
            <li key={c.category}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-medium">{c.category}</span>
                <span className="shrink-0 tabular-nums"><b>{inr(c.revenue)}</b> <span className="text-xs text-muted-foreground">{pctText(c.sharePct)}</span></span>
              </div>
              <Bar pct={c.sharePct ?? 0} tone={CAT_TONES[i % CAT_TONES.length]} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

export function HoursPanel({ d }: { d: OverviewData }) {
  const max = Math.max(1, ...d.hours.map((h) => h.orders))
  const total = d.hours.reduce((t, h) => t + h.orders, 0)
  const peak = d.hours.reduce((a, b) => (b.orders > a.orders ? b : a), d.hours[0])
  return (
    <Panel title="Busy hours" hint={total > 0 ? `Busiest around ${hourLabel(peak.hour)} · ${count(peak.orders)} orders` : "Orders through the day (India time)"}>
      {total === 0 ? <Empty>No orders yet.</Empty> : (
        <>
          <div className="flex h-36 items-end gap-1" role="img" aria-label="Orders by hour of day">
            {d.hours.map((h) => (
              <div key={h.hour} className="group relative flex h-full flex-1 flex-col justify-end" title={`${hourLabel(h.hour)} · ${h.orders} orders`}>
                <div className={cn("w-full rounded-t-md transition-colors", h.hour === peak.hour ? "bg-emerald-500" : "bg-emerald-500/35 group-hover:bg-emerald-500/60")}
                  style={{ height: `${Math.max(h.orders > 0 ? 6 : 2, (h.orders / max) * 100)}%` }} />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground"><span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>11 PM</span></div>
        </>
      )}
    </Panel>
  )
}

export { TONE }
