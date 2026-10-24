"use client"

import { Area, AreaChart, ResponsiveContainer } from "recharts"
import { Ban, IndianRupee, Receipt, ShoppingBag, Undo2, Users } from "lucide-react"
import type { OverviewData } from "@/types/overview.types"
import { count, dayLabel, inr, pctText } from "../format"
import { Delta, Help, Tile } from "../kit"
import { cn } from "@/lib/utils"

export function rangeText(d: Pick<OverviewData, "from" | "to" | "days">): string {
  return d.days === 1 ? dayLabel(d.to) : `${dayLabel(d.from)} – ${dayLabel(d.to)}`
}

/** The money story in one card: what we sold, what went back, what we kept. */
function HeroRevenue({ d, className }: { d: OverviewData; className?: string }) {
  const spark = d.series.map((x) => ({ v: x.net }))
  return (
    <div className={cn("relative overflow-hidden rounded-2xl p-5 text-white shadow-lg", className)} style={{ background: "linear-gradient(135deg,#0f6b34 0%,#1a7a3c 45%,#2e9e54 100%)" }}>
      {spark.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 opacity-40" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <Area type="monotone" dataKey="v" stroke="#fff" strokeWidth={2} fill="#fff" fillOpacity={0.18} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/80">
            Money kept <Help text={d.definitions.netRevenue} className="text-white/70 hover:text-white" />
          </span>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20" aria-hidden><IndianRupee className="h-5 w-5" /></span>
        </div>
        <div className="mt-2 text-4xl font-bold tabular-nums tracking-tight">{inr(d.money.netRevenue)}</div>
        <Delta pct={d.comparison.netRevenue.changePct} className="mt-1 text-white/90 [&_span]:text-white/60" />
        <dl className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <div className="rounded-lg bg-white/15 px-2.5 py-1"><dt className="inline text-white/70">Sold </dt><dd className="inline font-semibold tabular-nums">{inr(d.money.grossSales)}</dd></div>
          <span aria-hidden className="text-white/60">−</span>
          <div className="rounded-lg bg-white/15 px-2.5 py-1"><dt className="inline text-white/70">Given back </dt><dd className="inline font-semibold tabular-nums">{inr(d.money.refunds)}</dd></div>
          <span aria-hidden className="text-white/60">=</span>
          <div className="rounded-lg bg-white/25 px-2.5 py-1"><dt className="inline text-white/80">Kept </dt><dd className="inline font-bold tabular-nums">{inr(d.money.netRevenue)}</dd></div>
        </dl>
      </div>
    </div>
  )
}

export function OverviewKpis({ d }: { d: OverviewData }) {
  const c = d.comparison
  const o = d.orders
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <HeroRevenue d={d} className="md:col-span-2" />
      <Tile tone="blue" icon={<ShoppingBag className="h-5 w-5" />} label="Orders" help={d.definitions.orders} value={count(o.net)}
        sub={<><Delta pct={c.orders.changePct} /><span className="mt-0.5 block">{count(o.placed)} placed{o.fullyRefunded > 0 && ` · ${count(o.fullyRefunded)} fully refunded`}</span></>} />
      <Tile tone="violet" icon={<Receipt className="h-5 w-5" />} label="Per order" help={d.definitions.avgOrderValue} value={inr(d.money.avgOrderValue)}
        sub={<Delta pct={c.avgOrderValue.changePct} />} />
      <Tile tone="rose" icon={<Undo2 className="h-5 w-5" />} label="Given back" help={d.definitions.refunds} value={inr(d.money.refunds)}
        sub={<><Delta pct={c.refunds.changePct} goodWhenDown /><span className="mt-0.5 block">{count(o.refundEvents)} refund{o.refundEvents === 1 ? "" : "s"}</span></>} href="/refund-requests" />
      <Tile tone="amber" icon={<Ban className="h-5 w-5" />} label="Cancelled" help={d.definitions.cancelled} value={count(o.cancelled)}
        sub={<>{inr(d.money.cancelledValue)} <span className="text-muted-foreground">· not counted in sales</span></>} href="/orders?status=CANCELLED" />
      <Tile tone="green" icon={<Users className="h-5 w-5" />} label="Buyers" value={count(d.customers.buyers)}
        sub={<>{count(d.customers.newBuyers)} new · {count(d.customers.repeatBuyers)} back{d.customers.repeatRatePct != null && ` (${pctText(d.customers.repeatRatePct)})`}</>} href="/customers" />
    </div>
  )
}
