"use client"

/**
 * Command Center in the MandiMetrics look. Every number comes from the existing /admin/dashboard/overview response
 * (one set of rules: an order "stood" only if it was placed, not cancelled and not refunded in full). Cancelled orders are
 * shown on their own — never counted as orders or sales — and returns of delivered orders are a separate thing again.
 */
import dynamic from "next/dynamic"
import Link from "next/link"
import { useMemo, useState } from "react"
import { Area, Bar as RBar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { ArrowRight, Ban, BellRing, Bike, ChefHat, Clock3, HandCoins, IndianRupee, Leaf, RefreshCw, Receipt, ShoppingBasket, ShoppingCart, TrendingUp, TriangleAlert, Undo2, Wallet, CircleDollarSign } from "lucide-react"
import { PendingActions } from "@/components/dashboard/PendingActions"
import { LowStockAlerts } from "@/components/dashboard/LowStockAlerts"
import { useAbandonedCartsSummary } from "@/hooks/useAbandonedCarts"
import { useOverview, useRecentOrders } from "@/hooks/useDashboard"
import { formatRelativeTime, cn } from "@/lib/utils"
import type { RecentOrder } from "@/types/dashboard.types"
import type { OverviewData, OverviewPeriod } from "@/types/overview.types"
import { count, dayLabel, hourLabel, inr, pctText } from "../format"
import { AXIS, Bar as Progress, ChartTip, CountUp, GRID, Kpi, LoadError, PageHead, Panel, SectionTitle, Seg, Tag } from "./ui"

// Heavy map — no SSR
const LiveRiderMap = dynamic(() => import("@/components/dashboard/LiveRiderMap").then((m) => m.LiveRiderMap), {
  ssr: false,
  loading: () => <Panel><div className="h-[300px] animate-pulse rounded-xl bg-[#f6f8f2]" /></Panel>,
})

const PERIODS: Array<{ id: OverviewPeriod; label: string }> = [
  { id: "today", label: "Today" }, { id: "week", label: "7 days" }, { id: "month", label: "30 days" }, { id: "year", label: "Year" },
]
const COLOR = ["#4d7c0f", "#0891b2", "#ea580c", "#7c3aed", "#e11d48", "#ca8a04", "#0f766e"]
const REASON_COLOR = ["#e11d48", "#ea580c", "#ca8a04", "#7c3aed", "#0891b2", "#64748b", "#94a3b8"]

const rangeText = (d: Pick<OverviewData, "from" | "to" | "days">) => (d.days === 1 ? dayLabel(d.to) : `${dayLabel(d.from)} → ${dayLabel(d.to)}`)
/** Percent change for the Kpi chip (null when there is nothing to compare with). */
const delta = (pct: number | null | undefined) => (pct == null ? undefined : pct)

function Skel({ h = "h-64", className }: { h?: string; className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl border border-[#e3e8dd] bg-[#f6f8f2]", h, className)} />
}

function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading overview">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Skel key={i} h="h-32" />)}</div>
      <div className="grid gap-4 xl:grid-cols-3"><Skel className="xl:col-span-2" /><Skel /></div>
      <div className="grid gap-4 xl:grid-cols-3"><Skel h="h-56" /><Skel h="h-56" /><Skel h="h-56" /></div>
    </div>
  )
}

/** What happened to the orders, in one place: stood / cancelled / returned never blur into each other. */
function OrderTruth({ d }: { d: OverviewData }) {
  const o = d.orders
  const c = d.cancellations
  const placedAll = o.placed + c.orders
  const rate = placedAll > 0 ? (c.orders / placedAll) * 100 : null
  return (
    <Panel>
      <SectionTitle title="What happened to the orders" sub="Three different outcomes, counted separately"
        help="Orders that stood are the real sales. A cancelled order never became a sale. A return is money handed back on an order that was delivered."
        right={<Tag tone={rate != null && rate >= 15 ? "rose" : "lime"}>{rate == null ? "no orders yet" : `${pctText(rate, 1)} cancelled`}</Tag>} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-lime-200 bg-lime-50 p-3.5">
          <p className="flex items-center gap-1.5 text-e10.5 font-semibold uppercase tracking-wider text-lime-800"><ShoppingBasket className="size-3.5" /> Orders that stood</p>
          <p className="num mt-1 text-2xl font-bold text-lime-800">{count(o.net)}</p>
          <p className="mt-1 text-e11 leading-snug text-lime-800/80">{count(o.placed)} placed{o.fullyRefunded > 0 ? ` − ${count(o.fullyRefunded)} fully refunded` : ""} · counted in sales</p>
        </div>
        <Link href="/orders?status=CANCELLED" className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 transition-colors hover:border-rose-300">
          <p className="flex items-center gap-1.5 text-e10.5 font-semibold uppercase tracking-wider text-rose-800"><Ban className="size-3.5" /> Cancelled</p>
          <p className="num mt-1 text-2xl font-bold text-rose-800">{count(c.orders)}</p>
          <p className="mt-1 text-e11 leading-snug text-rose-800/80">{inr(c.value)} · <b>not</b> counted as orders or sales</p>
          <p className="mt-1 text-e11 text-rose-800/80">{count(c.beforeConfirm.orders)} stopped before confirmation · {count(c.afterConfirm.orders)} after</p>
        </Link>
        <Link href="/refund-requests" className="rounded-xl border border-violet-200 bg-violet-50 p-3.5 transition-colors hover:border-violet-300">
          <p className="flex items-center gap-1.5 text-e10.5 font-semibold uppercase tracking-wider text-violet-800"><Undo2 className="size-3.5" /> Returned / refunded</p>
          <p className="num mt-1 text-2xl font-bold text-violet-800">{count(d.returns.orders)}</p>
          <p className="mt-1 text-e11 leading-snug text-violet-800/80">{inr(d.returns.value)} given back on delivered orders</p>
        </Link>
      </div>
    </Panel>
  )
}

function CancelReasons({ d }: { d: OverviewData }) {
  const c = d.cancellations
  const data = c.byReason.map((r) => ({ name: r.reason, value: r.orders }))
  return (
    <Panel>
      <SectionTitle title="Why orders were cancelled" sub="Every cancellation in the window, by the reason recorded" help={d.definitions.cancelledAll}
        right={<Tag tone="rose">{count(c.orders)} cancelled</Tag>} />
      {c.orders === 0 ? (
        <p role="status" className="rounded-xl border border-dashed border-[#e3e8dd] p-8 text-center text-xs text-slate-400">No cancelled orders in this period.</p>
      ) : (
        <>
          <div className="relative h-40">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={72} paddingAngle={3} strokeWidth={0} isAnimationActive={false}>
                  {data.map((r, i) => <Cell key={r.name} fill={REASON_COLOR[i % REASON_COLOR.length]} fillOpacity={0.9} />)}
                </Pie>
                <Tooltip content={<ChartTip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="text-center"><p className="num text-xl font-bold text-slate-900">{inr(c.value)}</p><p className="text-e10 uppercase tracking-widest text-slate-500">not sold</p></div>
            </div>
          </div>
          <div className="mt-2 space-y-2.5">
            {c.byReason.map((r, i) => (
              <div key={r.reason}>
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-1.5 text-slate-600"><i className="size-2 shrink-0 rounded-full" style={{ background: REASON_COLOR[i % REASON_COLOR.length] }} /><span className="truncate">{r.reason}</span></span>
                  <span className="num shrink-0 font-semibold text-slate-800">{count(r.orders)} · {inr(r.value)}</span>
                </div>
                <Progress pct={c.orders > 0 ? (r.orders / c.orders) * 100 : 0} color={REASON_COLOR[i % REASON_COLOR.length]} h={4} />
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-[#f6f8f2] py-2"><p className="num text-sm font-bold text-amber-700">{count(c.beforeConfirm.orders)} · {inr(c.beforeConfirm.value)}</p><p className="text-e9.5 uppercase tracking-wider text-slate-400">before confirmation</p></div>
            <div className="rounded-lg bg-[#f6f8f2] py-2"><p className="num text-sm font-bold text-rose-700">{count(c.afterConfirm.orders)} · {inr(c.afterConfirm.value)}</p><p className="text-e9.5 uppercase tracking-wider text-slate-400">after confirmation</p></div>
          </div>
        </>
      )}
    </Panel>
  )
}

type Filter = "all" | "stood" | "cancelled" | "returned"
const FILTERS: Array<{ id: Filter; label: string }> = [{ id: "all", label: "All" }, { id: "stood", label: "Stood" }, { id: "cancelled", label: "Cancelled" }, { id: "returned", label: "Returned" }]

/** One recent order → the outcome it ended in. REFUNDED + delivered = a return; REFUNDED without a delivery = cancelled, then refunded. */
export function outcomeOf(o: Pick<RecentOrder, "status" | "delivered_at">): "stood" | "cancelled" | "returned" | "unpaid" {
  if (o.status === "CANCELLED") return "cancelled"
  if (o.status === "REFUNDED") return o.delivered_at ? "returned" : "cancelled"
  if (o.status === "PENDING") return "unpaid"
  return "stood"
}

/** The orders list sends the basket as `items` (and money as text), so count from whichever the row carries. */
function itemsText(o: RecentOrder & { items?: unknown }): string {
  const n = Number.isFinite(Number(o.item_count)) && o.item_count != null ? Number(o.item_count) : Array.isArray(o.items) ? o.items.length : null
  return n == null ? "" : ` · ${n} item${n === 1 ? "" : "s"}`
}

const OUTCOME_TAG: Record<ReturnType<typeof outcomeOf>, { label: string; tone: "lime" | "rose" | "violet" | "slate" }> = {
  stood: { label: "", tone: "lime" }, cancelled: { label: "Cancelled", tone: "rose" }, returned: { label: "Returned", tone: "violet" }, unpaid: { label: "Unpaid", tone: "slate" },
}

function RecentOrdersPanel({ orders, loading }: { orders?: RecentOrder[]; loading: boolean }) {
  const [filter, setFilter] = useState<Filter>("all")
  const rows = useMemo(() => (orders ?? []).filter((o) => {
    const k = outcomeOf(o)
    return filter === "all" || (filter === "stood" ? k === "stood" : k === filter)
  }).slice(0, 12), [orders, filter])
  return (
    <Panel>
      <SectionTitle title="Recent orders" sub="Latest 40 checked · cancelled and returned orders are marked and never added to totals"
        right={<Seg<Filter> options={FILTERS} value={filter} onChange={setFilter} size="xs" label="Filter orders" />} />
      {loading ? <Skel h="h-56" /> : rows.length === 0 ? (
        <p role="status" className="rounded-xl border border-dashed border-[#e3e8dd] p-8 text-center text-xs text-slate-400">No {filter === "all" ? "" : `${filter} `}orders in the latest list.</p>
      ) : (
        <ul className="max-h-[340px] space-y-1 overflow-y-auto pr-1">
          {rows.map((o) => {
            const k = outcomeOf(o)
            const tag = OUTCOME_TAG[k]
            const out = k === "cancelled" || k === "returned"
            return (
              <li key={o.id}>
                <Link href={`/orders?search=${encodeURIComponent(o.order_number)}`} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-xs hover:bg-lime-50/60">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-1.5 font-medium text-slate-800">#{o.order_number}
                      {tag.label ? <Tag tone={tag.tone}>{tag.label}</Tag> : <Tag tone="slate">{o.status.replace(/_/g, " ").toLowerCase()}</Tag>}
                      {k === "cancelled" && o.status === "REFUNDED" && <Tag tone="amber">money refunded</Tag>}
                    </p>
                    <p className="mt-0.5 truncate text-e11 text-slate-500">{o.customer_name}{itemsText(o)}{k === "cancelled" && o.cancelled_reason ? ` · ${o.cancelled_reason}` : ""}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={cn("num font-semibold", out ? "text-slate-400 line-through" : "text-slate-800")} title={out ? "Not counted in sales" : undefined}>{inr(Number(o.total_amount), false)}</p>
                    <p className="text-e10 text-slate-400">{formatRelativeTime(o.created_at)}</p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

function LiveRow({ d }: { d: OverviewData }) {
  const l = d.live
  const items = [
    { label: "New to accept", value: count(l.newOrders), sub: "orders waiting", icon: <BellRing className="size-4" />, href: "/orders?status=CONFIRMED", hot: l.newOrders > 0, tone: "rose" },
    { label: "Packing", value: count(l.preparing), sub: "being prepared", icon: <ChefHat className="size-4" />, href: "/orders?status=PREPARING", hot: false, tone: "amber" },
    { label: "On the way", value: count(l.outForDelivery), sub: "with riders", icon: <Bike className="size-4" />, href: "/orders?status=OUT_FOR_DELIVERY", hot: false, tone: "cyan" },
    { label: "Unpaid", value: count(l.awaitingPayment), sub: "waiting to pay", icon: <Clock3 className="size-4" />, href: "/orders?status=PENDING", hot: false, tone: "slate" },
    { label: "Cash to collect", value: inr(l.codToCollect), sub: `${inr(l.codCollectedToday)} collected today`, icon: <HandCoins className="size-4" />, href: "", hot: false, tone: "lime" },
    { label: "Refund asks", value: count(l.pendingRefundRequests), sub: "waiting for you", icon: <CircleDollarSign className="size-4" />, href: "/refund-requests", hot: l.pendingRefundRequests > 0, tone: "violet" },
  ]
  const ring: Record<string, string> = { rose: "text-rose-700 bg-rose-100 ring-rose-200", amber: "text-amber-700 bg-amber-100 ring-amber-200", cyan: "text-cyan-700 bg-cyan-100 ring-cyan-200", slate: "text-slate-600 bg-slate-100 ring-slate-200", lime: "text-lime-700 bg-lime-100 ring-lime-200", violet: "text-violet-700 bg-violet-100 ring-violet-200" }
  return (
    <section aria-label="Right now" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {items.map((it) => {
        const body = (
          <div className={cn("flex items-center gap-3 rounded-2xl border bg-white p-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors", it.hot ? "border-rose-200" : "border-[#e3e8dd]", it.href && "hover:border-lime-300")}>
            <div className={cn("grid size-9 shrink-0 place-items-center rounded-xl ring-1", ring[it.tone])}>{it.icon}</div>
            <div className="min-w-0"><p className="num text-lg font-bold leading-tight text-slate-900">{it.value}</p><p className="truncate text-e10.5 font-semibold uppercase tracking-wider text-slate-500">{it.label}</p><p className="truncate text-e10 text-slate-400">{it.sub}</p></div>
          </div>
        )
        return it.href ? <Link key={it.label} href={it.href}>{body}</Link> : <div key={it.label}>{body}</div>
      })}
    </section>
  )
}

/** An older backend has no `cancellations` / `returns` yet: fall back to what it does send so the page still opens and stays honest. */
export function withCancelDefaults(d: OverviewData): OverviewData {
  const cancelled = d.orders.cancelled ?? 0
  return {
    ...d,
    cancellations: d.cancellations ?? { orders: cancelled, value: d.money.cancelledValue ?? 0, beforeConfirm: { orders: 0, value: 0 }, afterConfirm: { orders: cancelled, value: d.money.cancelledValue ?? 0 }, byReason: [] },
    returns: d.returns ?? { orders: d.orders.refundEvents ?? 0, value: d.money.refunds ?? 0, fullyRefundedOrders: d.orders.fullyRefunded ?? 0 },
    series: d.series.map((x) => ({ ...x, cancelledAll: x.cancelledAll ?? x.cancelled })),
  }
}

export function CommandCenterView() {
  const [period, setPeriod] = useState<OverviewPeriod>("week")
  const { data: raw, isLoading, isError, isFetching, refetch, dataUpdatedAt } = useOverview(period)
  const data = useMemo(() => (raw ? withCancelDefaults(raw) : raw), [raw])
  const { data: recent, isLoading: recentLoading } = useRecentOrders(40)
  const { data: abandoned } = useAbandonedCartsSummary()

  const chan = useMemo(() => (data?.channels ?? []).map((c, i) => ({ name: c.channel === "B2B" ? "B2B (business)" : "B2C (app)", value: c.gross, orders: c.orders, color: i === 0 ? "#0891b2" : "#ea580c" })), [data])
  const days = useMemo(() => (data?.series ?? []).map((s) => ({ ...s, label: dayLabel(s.day) })), [data])
  const hours = useMemo(() => (data?.hours ?? []).map((h) => ({ ...h, label: hourLabel(h.hour) })), [data])

  const alerts: Array<{ tone: "rose" | "amber" | "lime"; text: string }> = []
  if (data) {
    if (data.live.pendingRefundRequests > 0) alerts.push({ tone: "amber", text: `${data.live.pendingRefundRequests} refund request${data.live.pendingRefundRequests === 1 ? "" : "s"} waiting for you` })
    if (data.live.newOrders > 0) alerts.push({ tone: "rose", text: `${data.live.newOrders} new order${data.live.newOrders === 1 ? "" : "s"} waiting to be accepted` })
    const all = data.orders.placed + data.cancellations.orders
    if (all >= 10 && data.cancellations.orders / all >= 0.15) alerts.push({ tone: "rose", text: `${pctText((data.cancellations.orders / all) * 100, 0)} of orders were cancelled in this period (${count(data.cancellations.orders)} of ${count(all)})` })
    const top = data.cancellations.byReason[0]
    if (top && data.cancellations.orders >= 5) alerts.push({ tone: "amber", text: `Top cancel reason: “${top.reason}” — ${count(top.orders)} order${top.orders === 1 ? "" : "s"}` })
  }

  return (
    <div className="space-y-5">
      <PageHead eyebrow="Command Center" icon={<Leaf className="size-3.5" />} title={<>Good operations make <span className="text-lime-700">thin margins thick</span></>}
        sub={data ? `${rangeText(data)} · ${data.days} trading day${data.days === 1 ? "" : "s"} · compared with the ${data.days === 1 ? "day" : `${data.days} days`} before · every number traceable to real orders` : "How the business is doing"}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Seg<OverviewPeriod> options={PERIODS} value={period} onChange={setPeriod} label="Period" />
            <button type="button" onClick={() => refetch()} aria-label="Refresh numbers" title={dataUpdatedAt ? `Updated ${new Date(dataUpdatedAt).toLocaleTimeString("en-IN")}` : "Refresh"}
              className="grid size-9 place-items-center rounded-xl border border-[#e3e8dd] bg-white text-slate-500 hover:text-slate-800">
              <RefreshCw className={cn("size-4", isFetching && "animate-spin")} aria-hidden />
            </button>
          </div>
        } />

      {isLoading ? <Loading /> : isError || !data ? (
        <LoadError what="the Command Center numbers" onRetry={() => refetch()} />
      ) : (
        <>
          {alerts.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {alerts.slice(0, 4).map((a, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl border border-[#e3e8dd] bg-[#fafbf7] px-3 py-2 text-xs text-slate-700">
                  <TriangleAlert className={cn("size-3.5", a.tone === "rose" ? "text-rose-500" : a.tone === "amber" ? "text-amber-500" : "text-lime-600")} />{a.text}
                </div>
              ))}
            </div>
          )}

          <LiveRow d={data} />

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            <Kpi label="Money kept" help={data.definitions.netRevenue} value={<CountUp value={data.money.netRevenue} format={(n) => inr(n)} />} sub={`${inr(data.money.grossSales)} sold − ${inr(data.money.refunds)} given back`}
              delta={delta(data.comparison.netRevenue.changePct)} spark={data.series.map((s) => s.net)} icon={<IndianRupee className="size-4" />} accent="lime" />
            <Kpi label="Sold" help={data.definitions.grossSales} value={<CountUp value={data.money.grossSales} format={(n) => inr(n)} />} sub="orders that stood, before refunds"
              spark={data.series.map((s) => s.gross)} icon={<Wallet className="size-4" />} accent="cyan" />
            <Kpi label="Orders" help={data.definitions.orders} value={<CountUp value={data.orders.net} />} sub={`${count(data.orders.placed)} placed · cancelled not counted`}
              delta={delta(data.comparison.orders.changePct)} spark={data.series.map((s) => s.orders)} icon={<ShoppingBasket className="size-4" />} accent="violet" />
            <Kpi label="Avg basket" help={data.definitions.avgOrderValue} value={data.money.avgOrderValue == null ? "—" : <CountUp value={data.money.avgOrderValue} format={(n) => inr(n)} />} sub="kept per order"
              delta={delta(data.comparison.avgOrderValue.changePct)} icon={<Receipt className="size-4" />} accent="lime" />
            <Kpi label="Cancelled" help={data.definitions.cancelledAll} value={<CountUp value={data.cancellations.orders} />} sub={`${inr(data.cancellations.value)} · not in sales`}
              spark={data.series.map((s) => s.cancelledAll)} icon={<Ban className="size-4" />} accent="rose" invert />
            <Kpi label="Returned" help={data.definitions.refunds} value={<CountUp value={data.returns.orders} />} sub={`${inr(data.returns.value)} given back`}
              delta={delta(data.comparison.refunds.changePct)} icon={<Undo2 className="size-4" />} accent="amber" invert />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Panel className="xl:col-span-2">
              <SectionTitle title="Sales vs money given back — daily curve" sub="What was sold, what went back to customers, and what we kept"
                right={<Tag tone="lime">{inr(data.money.netRevenue)} kept</Tag>} />
              <div className="h-64">
                <ResponsiveContainer>
                  <ComposedChart data={days} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="ccSold" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#65a30d" stopOpacity={0.3} /><stop offset="100%" stopColor="#65a30d" stopOpacity={0} /></linearGradient>
                      <linearGradient id="ccBack" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e11d48" stopOpacity={0.2} /><stop offset="100%" stopColor="#e11d48" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid {...GRID} />
                    <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" />
                    <YAxis {...AXIS} tickFormatter={(v: number) => inr(v)} width={62} />
                    <Tooltip content={<ChartTip money />} />
                    <Area type="monotone" dataKey="gross" name="Sold" stroke="#65a30d" strokeWidth={2.2} fill="url(#ccSold)" isAnimationActive={false} />
                    <Area type="monotone" dataKey="refunds" name="Given back" stroke="#e11d48" strokeWidth={1.6} fill="url(#ccBack)" strokeDasharray="5 4" isAnimationActive={false} />
                    <Line type="monotone" dataKey="net" name="Kept" stroke="#0891b2" strokeWidth={1.8} dot={false} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel>
              <SectionTitle title="Channel mix" sub="Share of sales · app customers vs business buyers" />
              {chan.every((c) => c.value === 0) ? (
                <p role="status" className="rounded-xl border border-dashed border-[#e3e8dd] p-8 text-center text-xs text-slate-400">No sales in this period.</p>
              ) : (
                <>
                  <div className="relative h-44">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={chan} innerRadius={56} outerRadius={80} paddingAngle={4} dataKey="value" strokeWidth={0} isAnimationActive={false}>
                          {chan.map((c) => <Cell key={c.name} fill={c.color} fillOpacity={0.85} />)}
                        </Pie>
                        <Tooltip content={<ChartTip money />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 grid place-items-center">
                      <div className="text-center"><p className="num text-xl font-bold text-slate-900">{pctText(data.channels.find((c) => c.channel === "B2C")?.sharePct, 0)}</p><p className="text-e10 uppercase tracking-widest text-slate-500">on app</p></div>
                    </div>
                  </div>
                  <div className="mt-2 space-y-3">
                    {chan.map((c) => (
                      <div key={c.name}>
                        <div className="mb-1 flex items-center justify-between text-xs"><span className="text-slate-600">{c.name} · {count(c.orders)} orders</span><span className="num font-semibold text-slate-800">{inr(c.value)}</span></div>
                        <Progress pct={data.money.grossSales > 0 ? (c.value / data.money.grossSales) * 100 : 0} color={c.color} />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Panel>
          </div>

          <OrderTruth d={data} />

          <div className="grid gap-4 xl:grid-cols-3">
            <Panel>
              <SectionTitle title="Order velocity" sub="Orders that stood vs orders cancelled, per day" />
              <div className="h-48">
                <ResponsiveContainer>
                  <BarChart data={days} margin={{ top: 4, right: 0, left: -18, bottom: 0 }}>
                    <CartesianGrid {...GRID} vertical={false} />
                    <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" />
                    <YAxis {...AXIS} allowDecimals={false} />
                    <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                    <RBar dataKey="orders" name="Stood" fill="#4d7c0f" fillOpacity={0.9} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                    <RBar dataKey="cancelledAll" name="Cancelled" fill="#e11d48" fillOpacity={0.85} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel>
              <SectionTitle title="Best sellers" sub="Highest sales this window · cancelled and fully refunded left out"
                right={<Link href="/business-analytics" className="flex items-center gap-1 text-e11 font-medium text-lime-700">deep dive <ArrowRight className="size-3" /></Link>} />
              {data.topProducts.length === 0 ? (
                <p role="status" className="rounded-xl border border-dashed border-[#e3e8dd] p-8 text-center text-xs text-slate-400">No sales in this period.</p>
              ) : (
                <div className="space-y-2.5">
                  {data.topProducts.slice(0, 6).map((p, i) => (
                    <div key={p.id} className="flex items-center gap-3">
                      <span className="num w-5 text-right text-e11 text-slate-400">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2"><p className="truncate text-e13 font-medium text-slate-800">{p.name}</p><p className="num text-xs font-semibold text-lime-700">{inr(p.revenue)}</p></div>
                        <div className="mt-1 flex items-center gap-2"><Progress pct={data.topProducts[0].revenue > 0 ? (p.revenue / data.topProducts[0].revenue) * 100 : 0} color="#16a34a" h={4} /><span className="num w-16 shrink-0 whitespace-nowrap text-right text-e10 text-slate-500">{count(p.unitsSold)} units</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <CancelReasons d={data} />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Panel className="xl:col-span-2">
              <SectionTitle title="When customers order" sub="Orders that stood, by hour of day (India time)" />
              <div className="h-52">
                <ResponsiveContainer>
                  <BarChart data={hours} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid {...GRID} vertical={false} />
                    <XAxis dataKey="label" {...AXIS} interval={2} />
                    <YAxis {...AXIS} allowDecimals={false} />
                    <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                    <RBar dataKey="orders" name="Orders" fill="#0891b2" fillOpacity={0.9} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel>
              <SectionTitle title="What sells by category" sub="Share of sales" />
              {data.categories.length === 0 ? (
                <p role="status" className="rounded-xl border border-dashed border-[#e3e8dd] p-8 text-center text-xs text-slate-400">No sales in this period.</p>
              ) : (
                <div className="space-y-2.5">
                  {data.categories.slice(0, 6).map((c, i) => (
                    <div key={c.category}>
                      <div className="mb-1 flex items-center justify-between text-xs"><span className="truncate text-slate-600">{c.category}</span><span className="num font-semibold text-slate-800">{inr(c.revenue)} · {pctText(c.sharePct, 0)}</span></div>
                      <Progress pct={c.sharePct ?? 0} color={COLOR[i % COLOR.length]} h={5} />
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2"><RecentOrdersPanel orders={recent} loading={recentLoading} /></div>
            <div className="space-y-4">
              <PendingActions />
              {abandoned && (
                <Link href="/abandoned-carts" className="block">
                  <Panel hover>
                    <SectionTitle title="Carts left behind" sub="Customers who did not finish checking out" icon={<ShoppingCart className="size-4" />}
                      right={<span className="flex items-center gap-1 text-e11 font-medium text-lime-700">see all <ArrowRight className="size-3" /></span>} />
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="rounded-lg bg-[#f6f8f2] py-2"><p className="num text-sm font-bold text-slate-800">{count(abandoned.openCount)}</p><p className="text-e9.5 uppercase tracking-wider text-slate-400">open</p></div>
                      <div className="rounded-lg bg-[#f6f8f2] py-2"><p className="num text-sm font-bold text-amber-700">{inr(abandoned.openValue)}</p><p className="text-e9.5 uppercase tracking-wider text-slate-400">at risk</p></div>
                      <div className="rounded-lg bg-[#f6f8f2] py-2"><p className="num text-sm font-bold text-lime-700">{count(abandoned.recoveredToday)}</p><p className="text-e9.5 uppercase tracking-wider text-slate-400">won back today</p></div>
                      <div className="rounded-lg bg-[#f6f8f2] py-2"><p className="num text-sm font-bold text-cyan-700">{(abandoned.recoveryRate7d * 100).toFixed(0)}%</p><p className="text-e9.5 uppercase tracking-wider text-slate-400">7-day win-back</p></div>
                    </div>
                  </Panel>
                </Link>
              )}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <LowStockAlerts />
            <Panel>
              <SectionTitle title="Customers" sub="Who bought in this window" icon={<TrendingUp className="size-4" />} />
              <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                <div className="rounded-lg bg-[#f6f8f2] py-3"><p className="num text-lg font-bold text-slate-800">{count(data.customers.buyers)}</p><p className="text-e9.5 uppercase tracking-wider text-slate-400">buyers</p></div>
                <div className="rounded-lg bg-[#f6f8f2] py-3"><p className="num text-lg font-bold text-lime-700">{count(data.customers.newBuyers)}</p><p className="text-e9.5 uppercase tracking-wider text-slate-400">new</p></div>
                <div className="rounded-lg bg-[#f6f8f2] py-3"><p className="num text-lg font-bold text-cyan-700">{count(data.customers.repeatBuyers)}</p><p className="text-e9.5 uppercase tracking-wider text-slate-400">came back</p></div>
                <div className="rounded-lg bg-[#f6f8f2] py-3"><p className="num text-lg font-bold text-violet-700">{pctText(data.customers.repeatRatePct, 0)}</p><p className="text-e9.5 uppercase tracking-wider text-slate-400">repeat rate</p></div>
              </div>
              {data.customers.registered != null && <p className="mt-3 text-e11 text-slate-500">{count(data.customers.registered)} registered accounts · {count(data.customers.joinedInPeriod)} joined in this period</p>}
            </Panel>
          </div>

          <LiveRiderMap />

          <details className="rounded-2xl border border-[#e3e8dd] bg-white p-4 text-sm">
            <summary className="cursor-pointer font-medium text-slate-800">How these numbers are worked out</summary>
            <dl className="mt-3 space-y-2">
              {Object.entries(data.definitions).map(([k, v]) => <div key={k}><dt className="inline font-semibold text-slate-800">{k}: </dt><dd className="inline text-slate-500">{v}</dd></div>)}
            </dl>
          </details>
        </>
      )}
    </div>
  )
}
