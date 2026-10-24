"use client"

import { useState } from "react"
import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { OverviewData } from "@/types/overview.types"
import { count, dayLabel, inr } from "../format"
import { Empty, Panel, Segmented } from "../kit"

type View = "money" | "orders"

function Tip({ active, payload }: { active?: boolean; payload?: Array<{ payload: OverviewData["series"][number] }> }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-xl border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold">{dayLabel(p.day)}</p>
      <dl className="space-y-0.5 tabular-nums">
        <div className="flex justify-between gap-6"><dt className="text-muted-foreground">Sold</dt><dd>{inr(p.gross, false)}</dd></div>
        <div className="flex justify-between gap-6"><dt className="text-muted-foreground">Given back</dt><dd className="text-rose-600">{inr(p.refunds, false)}</dd></div>
        <div className="flex justify-between gap-6 font-semibold"><dt>Kept</dt><dd>{inr(p.net, false)}</dd></div>
        <div className="flex justify-between gap-6 border-t pt-0.5"><dt className="text-muted-foreground">Orders</dt><dd>{count(p.orders)}</dd></div>
        {p.cancelled > 0 && <div className="flex justify-between gap-6"><dt className="text-muted-foreground">Cancelled</dt><dd className="text-amber-600">{count(p.cancelled)}</dd></div>}
      </dl>
    </div>
  )
}

export function TrendPanel({ d }: { d: OverviewData }) {
  const [view, setView] = useState<View>("money")
  const has = d.series.some((x) => x.placed > 0 || x.refunds > 0)
  return (
    <Panel title="Day by day" hint="Sold, given back and kept for every day. The last day is still running, so it looks lower."
      right={<Segmented<View> label="Chart" value={view} onChange={setView} options={[{ id: "money", label: "Money" }, { id: "orders", label: "Orders" }]} />}>
      {!has ? <Empty>No orders in this period yet.</Empty> : (
        <div className="h-[300px] w-full">
          <ResponsiveContainer>
            <ComposedChart data={d.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gGross" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.28} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="day" tickFormatter={dayLabel} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => (view === "money" ? inr(v).replace("₹", "") : String(v))} />
              <Tooltip content={<Tip />} cursor={{ stroke: "hsl(var(--border))" }} />
              {view === "money" ? (
                <>
                  <Area type="monotone" dataKey="gross" name="Sold" stroke="#10b981" strokeWidth={1.5} strokeDasharray="4 3" fill="url(#gGross)" dot={false} isAnimationActive={false} />
                  <Bar dataKey="refunds" name="Given back" fill="#f43f5e" fillOpacity={0.85} radius={[3, 3, 0, 0]} maxBarSize={14} isAnimationActive={false} />
                  <Line type="monotone" dataKey="net" name="Kept" stroke="#0f6b34" strokeWidth={2.4} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                </>
              ) : (
                <>
                  <Bar dataKey="orders" name="Orders" fill="#0ea5e9" fillOpacity={0.9} radius={[3, 3, 0, 0]} maxBarSize={22} isAnimationActive={false} />
                  <Line type="monotone" dataKey="cancelled" name="Cancelled" stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={false} />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
        {view === "money" ? (
          <>
            <li className="flex items-center gap-1.5"><span className="h-0.5 w-4 border-t-2 border-dashed border-emerald-500" />Sold</li>
            <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-rose-500" />Given back</li>
            <li className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-emerald-800" />Kept</li>
          </>
        ) : (
          <>
            <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-sky-500" />Orders that stood</li>
            <li className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-amber-500" />Cancelled</li>
          </>
        )}
      </ul>
    </Panel>
  )
}
