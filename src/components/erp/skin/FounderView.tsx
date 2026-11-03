"use client"

/**
 * Founder view in the MandiMetrics "Founder Intelligence" look. It shows only what the founder view already had
 * (headline numbers, alerts, what one order earns, business customers owing, stores, customer return) from GET /admin/erp/founder.
 */
import { useState } from "react"
import Link from "next/link"
import { ArrowRight, ArrowUpRight, Banknote, ChartSpline, ChevronLeft, ChevronRight, Gauge, Landmark, PiggyBank, RefreshCw, Receipt, ShoppingBag, Undo2 } from "lucide-react"
import { istToday } from "@/components/business/business-helpers"
import { shiftMonth } from "../accounting/meta"
import { useFounder } from "@/hooks/useErp"
import type { Founder, LadderStep } from "@/types/erp.types"
import { count, inr, pctText } from "../format"
import { Bar as Progress, Insight, Kpi, LoadError, MetricPill, Panel, SectionTitle, Tag } from "./ui"
import { cn } from "@/lib/utils"

function Ladder({ f }: { f: Founder }) {
  if (!f.ladder) return <p className="py-8 text-center text-xs text-slate-400">No orders this month yet.</p>
  const sales = f.ladder.steps[0].perOrder || 1
  return (
    <div className="space-y-1">
      {f.ladder.steps.map((s: LadderStep) => {
        const strong = s.kind === "subtotal" || s.kind === "end" || s.kind === "start"
        const width = Math.max(0, Math.min(100, (Math.abs(s.perOrder) / sales) * 100))
        const color = s.kind === "cost" ? "#e11d48" : s.kind === "gain" ? "#0891b2" : s.perOrder < 0 ? "#e11d48" : "#65a30d"
        return (
          <div key={s.key} className={cn("grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto_auto] items-center gap-2 border-b border-slate-100 py-2 text-xs", strong && "rounded-lg border-transparent bg-[#f6f8f2] px-2 font-semibold")}>
            <span className={cn("truncate", strong ? "text-slate-800" : "text-slate-600")}>{s.label}</span>
            <Progress pct={width} color={color} h={7} />
            <span className={cn("num w-[104px] text-right font-semibold", s.perOrder < 0 ? "text-rose-600" : "text-slate-800")}>{inr(s.perOrder, false)}/order</span>
            <Tag tone={s.kind === "cost" ? "slate" : (s.pctOfSales ?? 0) < 0 ? "rose" : (s.pctOfSales ?? 0) < 10 ? "amber" : "lime"}>{pctText(s.pctOfSales, 0)}</Tag>
          </div>
        )
      })}
    </div>
  )
}

export function FounderView() {
  const thisMonth = istToday().slice(0, 7)
  const [month, setMonth] = useState(thisMonth)
  const q = useFounder(month)
  const f = q.data
  const best = f ? [...f.stores].filter((s) => s.orders > 0).sort((a, b) => (b.avgOrderValue ?? 0) - (a.avgOrderValue ?? 0))[0] : undefined
  const worst = f ? [...f.stores].filter((s) => s.orders > 0).sort((a, b) => b.cancelledOrders / Math.max(1, b.orders) - a.cancelledOrders / Math.max(1, a.orders))[0] : undefined

  return (
    <div className="founder-page space-y-5 animate-fade">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-e10 font-bold uppercase tracking-wider text-violet-700"><ChartSpline className="size-3.5" /> Founder view</span>
            <Tag tone="lime">LIVE DATA</Tag>
          </div>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">The business, from one cockpit.</h1>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">The business on one page — profit, what one order earns, who owes you, how each store is doing and whether customers come back. Built from the same records as every other screen.</p>
        </div>
        <div className="flex items-stretch rounded-xl border border-[#e3e8dd] bg-white">
          <button type="button" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))} className="grid w-10 place-items-center text-slate-500 hover:text-slate-900"><ChevronLeft className="size-4" /></button>
          <div className="flex min-w-[150px] flex-col justify-center px-2 py-2 text-center"><span className="text-e9 font-bold uppercase tracking-wider text-slate-400">Month</span><span className="text-xs font-semibold text-slate-700">{f?.label ?? month}</span></div>
          <button type="button" aria-label="Next month" disabled={month >= thisMonth} onClick={() => setMonth(shiftMonth(month, 1))} className="grid w-10 place-items-center text-slate-500 hover:text-slate-900 disabled:opacity-40"><ChevronRight className="size-4" /></button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-[#e3e8dd] bg-white px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("size-2 rounded-full", q.isError ? "bg-rose-500" : q.isFetching ? "animate-pulse bg-amber-400" : "bg-emerald-500")} />
          <span className="truncate text-xs font-semibold text-slate-700">{q.isError ? "Could not reach the backend" : q.isFetching ? "Loading analytics" : "Live backend connected"}</span>
          {f && <span className="hidden text-e11 text-slate-400 sm:inline">· {f.from} → {f.to}{f.inProgress ? " · month still running" : ""}</span>}
        </div>
        <button type="button" onClick={() => q.refetch()} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-e10 font-semibold text-slate-600 hover:border-lime-400" style={{ minHeight: 0 }}><RefreshCw className={cn("size-3", q.isFetching && "animate-spin")} /> Refresh</button>
      </div>

      {q.isLoading ? (
        <div className="space-y-4"><div className="grid grid-cols-2 gap-3 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-[108px] animate-pulse rounded-2xl border border-[#e3e8dd] bg-[#f6f8f2]" />)}</div><div className="h-96 animate-pulse rounded-2xl border border-[#e3e8dd] bg-[#f6f8f2]" /></div>
      ) : q.isError || !f ? <LoadError what="this month" onRetry={() => q.refetch()} /> : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3 stagger">
            <Kpi label="Sold" value={inr(f.headline.sales)} sub={`${inr(f.headline.netRevenue)} kept after refunds`} icon={<Receipt className="size-4" />} accent="lime" />
            <Kpi label="Orders" value={count(f.headline.orders)} sub={`${inr(f.headline.avgOrderValue)} each`} icon={<ShoppingBag className="size-4" />} accent="cyan" />
            <Kpi label={f.headline.netProfit < 0 ? "Loss" : "Profit"} value={inr(f.headline.netProfit)} sub={`${pctText(f.headline.netMarginPct, 1)} of sales`} icon={<PiggyBank className="size-4" />} accent={f.headline.netProfit < 0 ? "rose" : "violet"} />
            <Kpi label="Refunds" value={pctText(f.headline.refundPct, 1)} sub="of sales" icon={<Undo2 className="size-4" />} accent="rose" />
            <Kpi label="Cash box" value={f.headline.cashBalance == null ? "—" : inr(f.headline.cashBalance)} sub={f.headline.cashBalance == null ? "no opening balance yet" : "balance"} icon={<Banknote className="size-4" />} accent="amber" />
            <Kpi label="Bank & UPI" value={f.headline.bankBalance == null ? "—" : inr(f.headline.bankBalance)} sub={f.headline.bankBalance == null ? "no opening balance yet" : "balance"} icon={<Landmark className="size-4" />} accent="orange" />
          </div>

          <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.8fr)]">
            <Panel>
              <SectionTitle title="What one order earns" sub={f.ladder ? `The rupees left after each layer of cost — averages over ${count(f.ladder.orders)} orders` : "The rupees left after each layer of cost"}
                help="Each step takes the month's total cost and divides it by the number of orders that stood. CM1 = after goods and spoilage; CM2 = after delivery, packing and payment fees; CM3 = after marketing." />
              <Ladder f={f} />
            </Panel>
            <Panel>
              <SectionTitle title="Decision alerts" sub="Things to look at this month" />
              <div className="space-y-2.5">
                {f.alerts.length === 0 && <Insight priority="success" title="Nothing needs attention" detail="No warnings for this month." />}
                {f.alerts.map((a) => (
                  <Link key={a.text} href={a.href} className="block transition hover:opacity-90"><Insight priority={a.level === "bad" ? "critical" : "warning"} title={a.text} /></Link>
                ))}
              </div>
              <Link href="/erp/accounting" className="mt-3 flex w-full items-center justify-between rounded-xl border border-lime-200 bg-lime-50 px-3 py-2.5 text-xs font-semibold text-lime-800 hover:bg-lime-100">Open the month&apos;s accounts <ArrowUpRight className="size-4" /></Link>
            </Panel>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Panel>
              <SectionTitle title="Business customers owe" sub="From approved credit orders" />
              <div className="grid grid-cols-3 gap-2">
                <MetricPill label="Owed now" value={inr(f.b2b.outstanding)} detail="outstanding" tone={f.b2b.outstanding > 0 ? "amber" : "lime"} />
                <MetricPill label="Billed" value={inr(f.b2b.billed)} detail="this month" tone="cyan" />
                <MetricPill label="Collected" value={inr(f.b2b.collected)} detail="this month" />
              </div>
              <div className="mt-4 space-y-3">
                {f.b2b.aging.map((a, i) => (
                  <div key={a.bucket}>
                    <div className="mb-1 flex justify-between gap-2 text-xs"><span className="font-semibold text-slate-700">{a.bucket} <span className="font-normal text-slate-400">{a.orders} orders</span></span><span className="num font-semibold">{inr(a.amount)}</span></div>
                    <Progress pct={f.b2b.outstanding > 0 ? (a.amount / f.b2b.outstanding) * 100 : 0} color={i === 0 ? "#65a30d" : i === 1 ? "#f59e0b" : "#e11d48"} h={9} />
                  </div>
                ))}
                {f.b2b.aging.length === 0 && <p className="py-4 text-center text-xs text-slate-400">No credit orders this month.</p>}
              </div>
              {f.b2b.topLate.length > 0 && <Link href="/b2b/collections" className="mt-4 flex w-full items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-900 hover:bg-amber-100">Chase {f.b2b.topLate[0].customer} first <ArrowRight className="size-4" /></Link>}
            </Panel>

            <Panel>
              <SectionTitle title="Store snapshot" sub="Where orders come from and where they go wrong" />
              <div className="grid grid-cols-2 gap-2">
                <MetricPill label="Stores trading" value={String(f.stores.length)} detail="with orders this month" />
                <MetricPill label="Orders" value={count(f.stores.reduce((t, s) => t + s.orders, 0))} detail="across all stores" tone="cyan" />
                <MetricPill label="Biggest baskets" value={best?.name ?? "—"} detail={best ? `${inr(best.avgOrderValue)} per order` : "no orders yet"} />
                <MetricPill label="Most cancelled" value={worst?.name ?? "—"} detail={worst ? `${pctText((worst.cancelledOrders / Math.max(1, worst.orders)) * 100, 0)} of its orders` : "no orders yet"} tone={worst && worst.cancelledOrders / Math.max(1, worst.orders) > 0.08 ? "amber" : "lime"} />
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-e11 text-slate-400"><Gauge className="size-3.5 shrink-0" />Same rules as Business Analytics, so the numbers match everywhere.</p>
            </Panel>
          </div>

          <Panel>
            <SectionTitle title="Stores side by side" sub="Same rules as Business Analytics — a store can sell well and still cancel or refund too much" />
            {f.stores.length === 0 ? <p className="py-8 text-center text-xs text-slate-400">No store activity this month.</p> : (
              <div className="overflow-x-auto">
                <table className="founder-table">
                  <thead><tr>{["Store", "Orders", "Sales", "Per order", "Refunds", "Cancelled", "Delivery time"].map((x, i) => <th key={x} className={i > 0 ? "text-right" : undefined}>{x}</th>)}</tr></thead>
                  <tbody>
                    {f.stores.map((s) => {
                      const cancelRate = s.orders ? (s.cancelledOrders / s.orders) * 100 : 0
                      return (
                        <tr key={s.shopId}>
                          <td className="font-semibold">{s.name}</td>
                          <td className="text-right">{count(s.orders)}</td>
                          <td className="text-right font-semibold">{inr(s.sales)}</td>
                          <td className="text-right">{inr(s.avgOrderValue)}</td>
                          <td className="text-right">{inr(s.refunds)}</td>
                          <td className="text-right"><span className="mr-1.5">{count(s.cancelledOrders)}</span><Tag tone={cancelRate > 8 ? "rose" : cancelRate > 4 ? "amber" : "lime"}>{pctText(cancelRate, 0)}</Tag></td>
                          <td className="text-right">{s.avgFulfillmentMinutes == null ? "—" : `${Math.round(s.avgFulfillmentMinutes)} min`}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel>
            <SectionTitle title="Do customers come back?" sub="Each row = customers whose first order was that month. Boxes show how many ordered again 1, 2, 3 … months later."
              help="Customers grouped by the month of their first order that stood." />
            {f.cohorts.length === 0 ? <p className="py-8 text-center text-xs text-slate-400">Not enough history yet.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] border-separate border-spacing-1 text-xs">
                  <thead><tr className="text-e10 uppercase tracking-wider text-slate-500"><th className="text-left font-semibold">First order</th><th className="font-semibold">Customers</th>{[1, 2, 3, 4, 5].map((k) => <th key={k} className="font-semibold">+{k} mo</th>)}</tr></thead>
                  <tbody>
                    {f.cohorts.map((c) => (
                      <tr key={c.cohort}>
                        <td className="whitespace-nowrap pr-2 font-semibold text-slate-700">{c.cohort}</td>
                        <td className="num text-center text-slate-700">{count(c.size)}</td>
                        {[1, 2, 3, 4, 5].map((k) => {
                          const v = c.retention[String(k)]
                          return <td key={k} className="num h-9 rounded-md text-center" style={v != null ? { background: `rgba(101,163,13,${0.08 + (v / 100) * 0.62})`, color: v > 50 ? "#fff" : "#3f6212" } : { background: "#f2f5ec" }}>{v == null ? "" : `${Math.round(v)}%`}</td>
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-3 text-e10 leading-relaxed text-slate-500"><strong>How to read this:</strong> {f.notes.join(" ")} Every figure comes from the same records as Accounting, Business Analytics and the month-end report.</div>
        </div>
      )}
    </div>
  )
}
