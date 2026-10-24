"use client"

import { useState } from "react"
import Link from "next/link"
import { AlertOctagon, AlertTriangle, ArrowRight, Banknote, ChevronLeft, ChevronRight, Landmark, PiggyBank, Receipt, ShoppingBag, Undo2 } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { istToday } from "@/components/business/business-helpers"
import { ErpGuard } from "@/components/erp/ErpGuard"
import { shiftMonth } from "@/components/erp/accounting/meta"
import { count, inr, pctText } from "@/components/erp/format"
import { Bar, Empty, Help, Panel, Tile, TONE } from "@/components/erp/kit"
import { useFounder } from "@/hooks/useErp"
import type { Founder, LadderStep } from "@/types/erp.types"
import { cn } from "@/lib/utils"

function Ladder({ f }: { f: Founder }) {
  if (!f.ladder) return <Empty>No orders this month yet.</Empty>
  const sales = f.ladder.steps[0].perOrder || 1
  return (
    <ul className="space-y-1.5">
      {f.ladder.steps.map((s: LadderStep) => {
        const strong = s.kind === "subtotal" || s.kind === "end" || s.kind === "start"
        const width = Math.max(0, Math.min(100, (Math.abs(s.perOrder) / sales) * 100))
        return (
          <li key={s.key} className={cn("grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-1.5", strong && "bg-muted/50")}>
            <span className={cn("truncate text-sm", strong ? "font-semibold" : "text-muted-foreground")}>{s.label}</span>
            <div className="h-2 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", s.kind === "cost" ? "bg-rose-400" : s.kind === "gain" ? "bg-sky-400" : s.perOrder < 0 ? "bg-rose-500" : "bg-emerald-500")} style={{ width: `${width}%` }} /></div>
            <span className={cn("w-[120px] text-right text-sm tabular-nums", strong && "font-bold", s.perOrder < 0 && s.kind !== "cost" && "text-rose-600 dark:text-rose-400")}>{inr(s.perOrder, false)} <span className="text-[11px] font-normal text-muted-foreground">{pctText(s.pctOfSales, 0)}</span></span>
          </li>
        )
      })}
    </ul>
  )
}

function Body() {
  const thisMonth = istToday().slice(0, 7)
  const [month, setMonth] = useState(thisMonth)
  const q = useFounder(month)
  const f = q.data
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <PageHeader title="Founder view" subtitle="The business on one page — built from the same records as every other screen." />
        <div className="inline-flex items-center self-start rounded-xl border bg-card shadow-sm lg:self-auto">
          <Button type="button" variant="ghost" size="icon" className="h-10 w-10" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="min-w-[140px] text-center text-sm font-semibold">{f?.label ?? month}</span>
          <Button type="button" variant="ghost" size="icon" className="h-10 w-10" aria-label="Next month" disabled={month >= thisMonth} onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
      {q.isLoading ? <div className="space-y-4"><div className="grid grid-cols-2 gap-3 xl:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div><Skeleton className="h-96 rounded-2xl" /></div>
        : q.isError || !f ? <p role="alert" className="rounded-2xl border border-rose-300 bg-rose-50 p-6 text-sm text-rose-900 dark:bg-rose-500/10 dark:text-rose-200">Could not load this month. <button type="button" className="font-semibold underline" onClick={() => q.refetch()}>Try again</button></p>
        : (
          <>
            {f.alerts.length > 0 && (
              <ul className="space-y-2" aria-label="Things to look at">
                {f.alerts.map((a) => (
                  <li key={a.text}><Link href={a.href} className={cn("flex items-center gap-3 rounded-xl border p-3 text-sm transition-colors hover:border-foreground/30", a.level === "bad" ? cn(TONE.rose.soft, "border-rose-300/60") : cn(TONE.amber.soft, "border-amber-300/60"))}>
                    {a.level === "bad" ? <AlertOctagon className="h-4 w-4 shrink-0 text-rose-600" aria-hidden /> : <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />}<span className="flex-1">{a.text}</span><ArrowRight className="h-4 w-4 shrink-0 opacity-50" aria-hidden /></Link></li>
                ))}
              </ul>
            )}
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
              <Tile tone="green" icon={<Receipt className="h-5 w-5" />} label="Sold" value={inr(f.headline.sales)} />
              <Tile tone="blue" icon={<ShoppingBag className="h-5 w-5" />} label="Orders" value={count(f.headline.orders)} sub={`${inr(f.headline.avgOrderValue)} each`} />
              <Tile tone={f.headline.netProfit < 0 ? "rose" : "violet"} icon={<PiggyBank className="h-5 w-5" />} label={f.headline.netProfit < 0 ? "Loss" : "Profit"} value={inr(f.headline.netProfit)} sub={`${pctText(f.headline.netMarginPct, 1)} of sales`} />
              <Tile tone="rose" icon={<Undo2 className="h-5 w-5" />} label="Refunds" value={pctText(f.headline.refundPct, 1)} sub="of sales" />
              <Tile tone="amber" icon={<Banknote className="h-5 w-5" />} label="Cash box" value={f.headline.cashBalance == null ? "—" : inr(f.headline.cashBalance)} sub={f.headline.cashBalance == null ? "no opening balance yet" : "balance"} />
              <Tile tone="blue" icon={<Landmark className="h-5 w-5" />} label="Bank & UPI" value={f.headline.bankBalance == null ? "—" : inr(f.headline.bankBalance)} sub={f.headline.bankBalance == null ? "no opening balance yet" : "balance"} />
            </div>
            <div className="grid gap-4 lg:grid-cols-5">
              <Panel title="What one order earns" hint={f.ladder ? `Averages over ${count(f.ladder.orders)} orders` : undefined} help="Each step takes the month's total cost and divides it by the number of orders that stood. CM1 = after goods and spoilage; CM2 = after delivery, packing and payment fees; CM3 = after marketing." className="lg:col-span-3"><Ladder f={f} /></Panel>
              <Panel title="Business customers owe" hint="From approved credit orders" className="lg:col-span-2">
                <p className="text-3xl font-bold tabular-nums">{inr(f.b2b.outstanding)}</p>
                <p className="text-xs text-muted-foreground">{inr(f.b2b.collected)} collected of {inr(f.b2b.billed)} billed this month</p>
                <ul className="mt-4 space-y-2.5">
                  {f.b2b.aging.map((a, i) => (<li key={a.bucket}><div className="mb-1 flex justify-between text-sm"><span>{a.bucket} <span className="text-xs text-muted-foreground">{a.orders} orders</span></span><b className="tabular-nums">{inr(a.amount)}</b></div><Bar pct={f.b2b.outstanding > 0 ? (a.amount / f.b2b.outstanding) * 100 : 0} tone={i === 0 ? "green" : i === 1 ? "amber" : "rose"} className="h-1.5" /></li>))}
                </ul>
                {f.b2b.topLate.length > 0 && <Link href="/b2b/collections" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400">Chase {f.b2b.topLate[0].customer} first <ArrowRight className="h-4 w-4" aria-hidden /></Link>}
              </Panel>
            </div>
            <Panel title="Stores side by side" hint="Same rules as Business Analytics">
              {f.stores.length === 0 ? <Empty>No store activity this month.</Empty> : (
                <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead className="text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="py-2 pr-3 font-medium">Store</th><th className="px-2 text-right font-medium">Orders</th><th className="px-2 text-right font-medium">Sales</th><th className="px-2 text-right font-medium">Per order</th><th className="px-2 text-right font-medium">Refunds</th><th className="px-2 text-right font-medium">Cancelled</th><th className="pl-2 text-right font-medium">Delivery time</th></tr></thead>
                  <tbody className="divide-y">{f.stores.map((s) => <tr key={s.shopId}><td className="py-2.5 pr-3 font-medium">{s.name}</td><td className="px-2 text-right tabular-nums">{count(s.orders)}</td><td className="px-2 text-right tabular-nums">{inr(s.sales)}</td><td className="px-2 text-right tabular-nums">{inr(s.avgOrderValue)}</td><td className="px-2 text-right tabular-nums">{inr(s.refunds)}</td><td className={cn("px-2 text-right tabular-nums", s.orders > 0 && s.cancelledOrders / s.orders > 0.08 && "font-semibold text-rose-600 dark:text-rose-400")}>{count(s.cancelledOrders)} <span className="text-xs text-muted-foreground">({pctText(s.orders ? (s.cancelledOrders / s.orders) * 100 : null, 0)})</span></td><td className="pl-2 text-right tabular-nums">{s.avgFulfillmentMinutes == null ? "—" : `${Math.round(s.avgFulfillmentMinutes)} min`}</td></tr>)}</tbody></table></div>
              )}
            </Panel>
            <Panel title="Do customers come back?" hint="Each row = customers whose first order was that month. Boxes show how many ordered again 1, 2, 3 … months later." help="Customers grouped by the month of their first order that stood.">
              {f.cohorts.length === 0 ? <Empty>Not enough history yet.</Empty> : (
                <div className="overflow-x-auto"><table className="w-full min-w-[520px] border-separate border-spacing-1 text-sm"><thead><tr className="text-xs text-muted-foreground"><th className="text-left font-medium">First order</th><th className="font-medium">Customers</th>{[1, 2, 3, 4, 5].map((k) => <th key={k} className="font-medium">+{k} mo</th>)}</tr></thead>
                  <tbody>{f.cohorts.map((c) => <tr key={c.cohort}><td className="whitespace-nowrap pr-2 font-medium">{c.cohort}</td><td className="text-center tabular-nums">{count(c.size)}</td>{[1, 2, 3, 4, 5].map((k) => { const v = c.retention[String(k)]; return <td key={k} className="h-9 rounded-md text-center tabular-nums" style={v != null ? { background: `rgba(16,185,129,${0.1 + (v / 100) * 0.7})`, color: v > 55 ? "#fff" : undefined } : { background: "hsl(var(--muted)/0.4)" }}>{v == null ? "" : `${Math.round(v)}%`}</td> })}</tr>)}</tbody></table></div>
              )}
            </Panel>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Help text={f.notes.join(" ")} />Every figure here comes from the same records as Accounting, Business Analytics and the month-end report.</p>
          </>
        )}
    </div>
  )
}

export default function FounderPage() {
  return <ErpGuard>{() => <Body />}</ErpGuard>
}
