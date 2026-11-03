"use client"

/**
 * Business Analytics in the MandiMetrics look. Same reports, same endpoints and same numbers as before; the reference's
 * chart styles are attached to them (trajectory, weekday rhythm, where the money went, loss / channel / vendor / customer
 * mix, price movement). Every new chart is worked out in the browser from data the page already receives — no new backend function.
 */
import { useMemo, useState } from "react"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { BarChart3, Ban, Banknote, CircleDollarSign, Percent, PackageX, Receipt, ShoppingCart, TrendingDown, TrendingUp, Undo2, Users } from "lucide-react"
import { CARD_HELP, formatRupees, periodProblem, toFilters, toPeriodQuery } from "@/components/business/business-helpers"
import type { PeriodState } from "@/components/business/PeriodBar"
import { useAnalyticsReconciliation, useAnalyticsVendors, useChannels, useOverview, useStorePerf, useTopCustomers, useTopProducts } from "@/hooks/useBusiness"
import type { Overview, VendorReport } from "@/types/business.types"
import { count, dayLabel, inr, pctText } from "../format"
import { DateWindow } from "./Controls"
import { AXIS, Bar as Progress, ChartTip, CountUp, GRID, Kpi, LoadError, MetricPill, PageHead, Panel, SectionTitle, Seg, Tag } from "./ui"
import { cn } from "@/lib/utils"

type Tab = "overview" | "products" | "customers" | "stores" | "channels" | "vendors" | "reconciliation"
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" }, { id: "products", label: "Top products" }, { id: "customers", label: "Top customers" }, { id: "stores", label: "Stores" },
  { id: "channels", label: "B2B vs B2C" }, { id: "vendors", label: "Vendors & purchases" }, { id: "reconciliation", label: "Procurement reconciliation" },
]
const COLOR = ["#4d7c0f", "#0891b2", "#ea580c", "#7c3aed", "#e11d48", "#ca8a04", "#0f766e"]
const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const full = (n: number | null | undefined) => formatRupees(n) // exact rupees, no trailing .00 — the figures the page always showed
const KPI_ICON: Record<string, { icon: React.ReactNode; accent: "lime" | "cyan" | "amber" | "violet" | "rose" | "orange" }> = {
  grossSales: { icon: <ShoppingCart className="size-4" />, accent: "lime" }, netRevenue: { icon: <CircleDollarSign className="size-4" />, accent: "cyan" },
  procurementCost: { icon: <Receipt className="size-4" />, accent: "amber" }, commissionEarned: { icon: <Percent className="size-4" />, accent: "violet" },
  refunds: { icon: <Undo2 className="size-4" />, accent: "rose" }, returns: { icon: <TrendingDown className="size-4" />, accent: "orange" },
  cancelledValue: { icon: <Ban className="size-4" />, accent: "rose" }, trackedLoss: { icon: <PackageX className="size-4" />, accent: "rose" },
}

/** Every day of the window, so a quiet day counts as a quiet day. */
function dense(o: Overview) {
  const by = new Map(o.series.map((s) => [s.day, s]))
  const out: Array<{ day: string; label: string; orders: number; gross: number; wd: number }> = []
  for (let d = new Date(`${o.from}T12:00:00Z`); d <= new Date(`${o.to}T12:00:00Z`); d = new Date(d.getTime() + 86_400_000)) {
    const day = d.toISOString().slice(0, 10)
    const s = by.get(day)
    out.push({ day, label: dayLabel(day), orders: s?.orders ?? 0, gross: s?.gross ?? 0, wd: (d.getUTCDay() + 6) % 7 })
  }
  return out
}

const Empty = ({ children }: { children: React.ReactNode }) => <p role="status" className="rounded-xl border border-dashed border-[#e3e8dd] p-8 text-center text-xs text-slate-400">{children}</p>
const Skel = ({ h = "h-64" }: { h?: string }) => <div className={cn("animate-pulse rounded-2xl border border-[#e3e8dd] bg-[#f6f8f2]", h)} />

function Donut({ data, money = true }: { data: Array<{ name: string; value: number }>; money?: boolean }) {
  const total = data.reduce((t, x) => t + x.value, 0)
  return (
    <div className="grid items-center gap-3 sm:grid-cols-[170px_1fr]">
      <div className="relative h-44">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={54} outerRadius={78} paddingAngle={3} strokeWidth={0} isAnimationActive={false}>
              {data.map((d, i) => <Cell key={d.name} fill={COLOR[i % COLOR.length]} fillOpacity={0.9} />)}
            </Pie>
            <Tooltip content={<ChartTip money={money} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center"><div className="text-center"><p className="num text-base font-bold text-slate-800">{money ? inr(total) : count(total)}</p><p className="text-e10 uppercase tracking-widest text-slate-500">total</p></div></div>
      </div>
      <ul className="space-y-1.5 text-xs">
        {data.map((d, i) => <li key={d.name} className="flex items-center gap-2"><span className="size-2 shrink-0 rounded-full" style={{ background: COLOR[i % COLOR.length] }} /><span className="min-w-0 flex-1 truncate text-slate-600">{d.name}</span><span className="num font-semibold text-slate-800">{money ? inr(d.value) : count(d.value)}</span><span className="num w-10 text-right text-e10 text-slate-400">{total ? Math.round((d.value / total) * 100) : 0}%</span></li>)}
      </ul>
    </div>
  )
}

const th = "px-2.5 py-3 font-semibold"
const THead = ({ cols }: { cols: Array<[string, boolean?]> }) => <thead className="sticky top-0 bg-white"><tr className="border-b border-[#e3e8dd] text-e10 uppercase tracking-widest text-slate-500">{cols.map(([c, left]) => <th key={c} className={cn(th, left ? "text-left" : "text-right")}>{c}</th>)}</tr></thead>
const row = "border-b border-[#eef1ea] hover:bg-lime-50"
const num = "num px-2.5 py-2 text-right text-slate-700"

export function BusinessAnalyticsView() {
  const [tab, setTab] = useState<Tab>("overview")
  const [period, setPeriod] = useState<PeriodState>({ period: "30d" })
  const [shopId, setShopId] = useState("")
  const [channel, setChannel] = useState("ALL")
  const [sort, setSort] = useState("revenue")
  const [vendorId, setVendorId] = useState("")
  const [metric, setMetric] = useState<"gross" | "orders">("gross")
  const problem = periodProblem(period)
  const ok = !problem
  const f = toFilters(period, shopId, channel)
  const overview = useOverview(f, ok && tab === "overview")
  const products = useTopProducts({ ...f, sort }, ok && tab === "products")
  const customers = useTopCustomers(f, ok && tab === "customers")
  const stores = useStorePerf(f, ok && tab === "stores")
  const channels = useChannels(f, ok && tab === "channels")
  const vendors = useAnalyticsVendors({ ...toPeriodQuery(period), ...(vendorId ? { vendorId } : {}) }, ok && tab === "vendors")
  const recon = useAnalyticsReconciliation(toPeriodQuery(period), ok && tab === "reconciliation")
  const showShop = tab !== "vendors" && tab !== "reconciliation"
  const showChannel = tab !== "vendors" && tab !== "reconciliation" && tab !== "channels"

  const o = overview.data
  const days = useMemo(() => (o ? dense(o) : []), [o])
  const weekday = useMemo(() => WEEK.map((w, i) => {
    const d = days.filter((x) => x.wd === i)
    return { w, gross: d.length ? Math.round(d.reduce((t, x) => t + x.gross, 0) / d.length) : 0, orders: d.length ? Math.round((d.reduce((t, x) => t + x.orders, 0) / d.length) * 10) / 10 : 0 }
  }), [days])
  const bestDay = [...weekday].sort((a, b) => b.gross - a.gross)[0]

  return (
    <div className="space-y-5 animate-fade">
      <PageHead
        eyebrow="Business Analytics" icon={<BarChart3 className="size-3.5" />}
        title={<>Where the money is made — <span className="text-lime-700">and where it leaks</span></>}
        sub="Sales, what it cost, what we earned, and where money or stock is leaking."
      />
      <DateWindow value={period} onChange={setPeriod} shopId={showShop ? shopId : undefined} onShop={showShop ? setShopId : undefined} problem={problem} />
      {showChannel && <Seg size="xs" label="Customer type" value={channel} onChange={setChannel} options={[{ id: "ALL", label: "All customers" }, { id: "B2B", label: "Business (B2B)" }, { id: "B2C", label: "Retail (B2C)" }]} />}

      <div role="tablist" aria-label="Reports" className="flex gap-1 overflow-x-auto rounded-xl border border-[#e3e8dd] bg-white p-1.5">
        {TABS.map((t) => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cn("shrink-0 rounded-lg px-3.5 py-2 text-e11 font-semibold transition", tab === t.id ? "bg-lime-100 text-lime-800 shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800")}>{t.label}</button>)}
      </div>

      {ok && (
        <div role="tabpanel" aria-label={TABS.find((t) => t.id === tab)?.label} className="space-y-4">
          {/* ───────── overview ───────── */}
          {tab === "overview" && (overview.isLoading ? <Skel /> : overview.isError || !o ? <LoadError what="this report" onRetry={() => overview.refetch()} /> : (
            <>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 stagger">
                {CARD_HELP.map((c) => {
                  const k = KPI_ICON[c.key]
                  const spark = c.key === "grossSales" ? days.slice(-14).map((d) => d.gross) : undefined
                  return <Kpi key={c.key} label={c.label} value={<CountUp value={o.cards[c.key]} format={(n) => inr(n)} />} accent={c.tone === "bad" && o.cards[c.key] > 0 ? "rose" : k.accent} icon={k.icon} spark={spark} help={o.definitions[c.def]}
                    sub={c.key === "netRevenue" ? `${count(o.counts.orders)} orders` : c.key === "refunds" ? `${count(o.counts.refundedOrders)} refunded orders` : c.key === "cancelledValue" ? `${count(o.counts.cancelledOrders)} cancelled orders` : c.key === "returns" ? `${count(o.counts.returnMovements)} return movements` : c.key === "procurementCost" ? `${count(o.counts.purchases)} purchases` : undefined} />
                })}
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <MetricPill label="Orders" value={count(o.counts.orders)} detail={`${count(o.counts.deliveredOrders)} delivered`} />
                <MetricPill label="Customers" value={count(o.counts.customers)} detail="who bought in this period" tone="cyan" />
                <MetricPill label="Average order" value={full(o.avgOrderValue)} detail="gross sales ÷ orders" />
                <MetricPill label="Return on purchases" value={o.cards.procurementCost > 0 ? pctText(Math.round(((o.cards.netRevenue - o.cards.procurementCost) / o.cards.procurementCost) * 1000) / 10, 1) : "—"}
                  detail={o.cards.procurementCost > 0 ? `${inr(o.cards.netRevenue)} kept per ${inr(o.cards.procurementCost)} bought` : "nothing bought in this period"} tone={o.cards.netRevenue >= o.cards.procurementCost ? "lime" : "rose"} />
                <MetricPill label="Best weekday" value={bestDay && bestDay.gross > 0 ? bestDay.w : "—"} detail={bestDay && bestDay.gross > 0 ? `${inr(bestDay.gross)} on an average ${bestDay.w}` : "no sales yet"} tone="amber" />
              </div>
              <p className="text-e11.5 text-slate-500" role="status">
                {count(o.counts.orders)} orders · {count(o.counts.customers)} customers · average order {full(o.avgOrderValue)} · {o.counts.purchases} purchase(s) recorded
              </p>
              {o.warnings.map((w) => <p key={w} role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-e11.5 text-amber-900">{w}</p>)}

              <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.8fr)]">
                <Panel>
                  <SectionTitle title="Sales trajectory" sub="Every day of the window — a quiet day counts as a quiet day" right={<Seg size="xs" label="Series" value={metric} onChange={setMetric} options={[{ id: "gross", label: "Gross sales" }, { id: "orders", label: "Orders" }]} />} />
                  {o.series.length === 0 ? <Empty>No orders in this period.</Empty> : (
                    <div className="h-64 sm:h-72">
                      <ResponsiveContainer>
                        <AreaChart data={days} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
                          <defs><linearGradient id="baTrend" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#65a30d" stopOpacity={0.28} /><stop offset="100%" stopColor="#65a30d" stopOpacity={0.02} /></linearGradient></defs>
                          <CartesianGrid {...GRID} />
                          <XAxis dataKey="label" {...AXIS} minTickGap={22} />
                          <YAxis {...AXIS} width={56} tickFormatter={(v: number) => (metric === "gross" ? inr(v).replace("₹", "") : String(v))} />
                          <Tooltip content={<ChartTip money={metric === "gross"} />} />
                          <Area dataKey={metric} name={metric === "gross" ? "Gross sales" : "Orders"} type="monotone" stroke="#4d7c0f" fill="url(#baTrend)" strokeWidth={2.2} isAnimationActive={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </Panel>
                <Panel>
                  <SectionTitle title="Where the money went" sub="From gross sales to what is left, and what leaked" />
                  {(() => {
                    const c = o.cards
                    const rows: Array<[string, number, string]> = [["Gross sales", c.grossSales, "#65a30d"], ["Net revenue", c.netRevenue, "#0891b2"], ["Procurement spend", c.procurementCost, "#f59e0b"], ["Refunds", c.refunds, "#e11d48"], ["Returns", c.returns, "#ea580c"], ["Cancelled orders", c.cancelledValue, "#e11d48"], ["Tracked loss", c.trackedLoss, "#be123c"]]
                    const max = Math.max(1, ...rows.map((r) => r[1]))
                    return <div className="space-y-3">{rows.map(([label, v, color]) => <div key={label}><div className="mb-1 flex justify-between gap-2 text-e11"><span className="text-slate-600">{label}</span><span className="num font-semibold text-slate-800">{inr(v)}</span></div><Progress pct={(v / max) * 100} color={color} h={7} /></div>)}</div>
                  })()}
                </Panel>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <Panel>
                  <SectionTitle title="Weekday rhythm" sub="Average gross sales and orders for each weekday — plan staffing and stock around the strong days" />
                  <div className="h-60">
                    <ResponsiveContainer>
                      <ComposedChart data={weekday} margin={{ top: 6, right: 8, left: -6, bottom: 0 }}>
                        <CartesianGrid {...GRID} vertical={false} />
                        <XAxis dataKey="w" {...AXIS} />
                        <YAxis yAxisId="l" {...AXIS} tickFormatter={(v: number) => inr(v).replace("₹", "")} />
                        <YAxis yAxisId="r" orientation="right" {...AXIS} width={34} />
                        <Tooltip content={<ChartTip fmt={(v, p) => (p.dataKey === "orders" ? `${v} orders` : `₹${Number(v).toLocaleString("en-IN")}`)} />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                        <Bar yAxisId="l" dataKey="gross" name="Avg gross" fill="#84cc16" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                        <Line yAxisId="r" dataKey="orders" name="Avg orders" stroke="#0891b2" strokeWidth={2} dot={{ r: 2.5, fill: "#0891b2" }} isAnimationActive={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>
                <Panel>
                  <SectionTitle title="Tracked loss — where it happened" sub="Stock that was damaged, written off or adjusted" />
                  {o.cards.trackedLoss > 0 ? <Donut data={[
                    { name: "Damaged at receiving", value: o.lossBreakdown.damagedAtReceiving }, { name: "Damage / wastage / adjustments", value: o.lossBreakdown.procurementAdjustments }, { name: "Written off at stores", value: o.lossBreakdown.storeDamage },
                  ].filter((x) => x.value > 0)} /> : <Empty>No tracked loss in this period.</Empty>}
                  {o.lossBreakdown.unpricedStoreDamageRecords > 0 && <p className="mt-2 text-e10.5 text-slate-400">{o.lossBreakdown.unpricedStoreDamageRecords} store damage record(s) had no price and are not valued.</p>}
                </Panel>
              </div>
              <details className="rounded-2xl border border-lime-200 bg-lime-50/60 p-5 text-xs leading-relaxed text-slate-600">
                <summary className="cursor-pointer font-semibold text-lime-800">How these numbers are worked out</summary>
                <dl className="mt-3 space-y-1.5">{Object.entries(o.definitions).map(([k, v]) => <div key={k}><dt className="inline font-semibold text-slate-700">{k}: </dt><dd className="inline">{v}</dd></div>)}</dl>
              </details>
            </>
          ))}

          {/* ───────── products ───────── */}
          {tab === "products" && (
            <>
              <Seg size="xs" label="Rank by" value={sort} onChange={setSort} options={[{ id: "revenue", label: "Revenue" }, { id: "units", label: "Units sold" }, { id: "trending", label: "Trending (growth)" }]} />
              {products.isLoading ? <Skel /> : products.isError || !products.data ? <LoadError what="this report" onRetry={() => products.refetch()} /> : products.data.items.length === 0 ? <Empty>No sales in this period.</Empty> : (
                <>
                  <Panel>
                    <SectionTitle title={sort === "units" ? "Top sellers by units" : sort === "trending" ? "Fastest growing products" : "Profit engines — top products by revenue"} sub="The first ten of the ranking below" />
                    <div className="h-72">
                      <ResponsiveContainer>
                        <BarChart data={products.data.items.slice(0, 10).map((p) => ({ name: p.name.length > 18 ? `${p.name.slice(0, 17)}…` : p.name, value: sort === "units" ? p.units : sort === "trending" ? p.growthPct ?? 0 : p.revenue }))} layout="vertical" margin={{ top: 0, right: 14, left: 8, bottom: 0 }}>
                          <CartesianGrid {...GRID} horizontal={false} />
                          <XAxis type="number" {...AXIS} tickFormatter={(v: number) => (sort === "revenue" ? inr(v).replace("₹", "") : sort === "trending" ? `${v}%` : String(v))} />
                          <YAxis type="category" dataKey="name" width={124} {...AXIS} />
                          <Tooltip content={<ChartTip money={sort === "revenue"} unit={sort === "units" ? " units" : sort === "trending" ? "%" : ""} />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                          <Bar dataKey="value" name={sort === "units" ? "Units" : sort === "trending" ? "Growth" : "Revenue"} radius={[0, 5, 5, 0]} isAnimationActive={false}>{products.data.items.slice(0, 10).map((p, i) => <Cell key={p.productId} fill={COLOR[i % COLOR.length]} />)}</Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Panel>
                  <Panel pad={false}>
                    <div className="max-h-[560px] overflow-auto">
                      <table className="w-full min-w-[780px] text-e11.5">
                        <THead cols={[["Product", true], ["Units"], ["Revenue"], ["Orders"], ["Buyers"], ["Repeat buyers"], ["Growth"]]} />
                        <tbody>
                          {products.data.items.map((p) => (
                            <tr key={p.productId} className={row}>
                              <td className="px-2.5 py-2 font-medium text-slate-800">{p.name}{p.sku && <span className="ml-1.5 text-e10 font-normal text-slate-400">{p.sku}</span>}</td>
                              <td className={num}>{count(p.units)}</td><td className={cn(num, "font-semibold text-slate-800")}>{full(p.revenue)}</td><td className={num}>{count(p.orders)}</td><td className={num}>{count(p.buyers)}</td>
                              <td className={num}>{count(p.repeatBuyers)} <span className="text-slate-400">({pctText(p.repeatRatePct)})</span></td>
                              <td className="px-2.5 py-2 text-right">{p.isNew ? <Tag tone="cyan">New</Tag> : p.growthPct == null ? <span className="text-slate-300">—</span> : <Tag tone={p.growthPct < 0 ? "rose" : p.growthPct > 20 ? "lime" : "slate"}>{p.growthPct > 0 ? "+" : ""}{p.growthPct}%</Tag>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Panel>
                </>
              )}
            </>
          )}

          {/* ───────── customers ───────── */}
          {tab === "customers" && (customers.isLoading ? <Skel /> : customers.isError || !customers.data ? <LoadError what="this report" onRetry={() => customers.refetch()} /> : (
            <>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
                <Panel>
                  <SectionTitle title="Do they come back?" sub="Customers who ordered more than once in this window" />
                  <Donut money={false} data={[{ name: "Repeat customers", value: customers.data.summary.repeatCustomers }, { name: "One-time customers", value: Math.max(0, customers.data.summary.customers - customers.data.summary.repeatCustomers) }]} />
                </Panel>
                <div className="grid grid-cols-3 gap-3 self-start">
                  <MetricPill label="Customers" value={count(customers.data.summary.customers)} detail="in this period" tone="cyan" />
                  <MetricPill label="Repeat" value={count(customers.data.summary.repeatCustomers)} detail="ordered again" />
                  <MetricPill label="Repeat rate" value={pctText(customers.data.summary.repeatRatePct)} detail="of all customers" tone="amber" />
                </div>
              </div>
              {customers.data.items.length === 0 ? <Empty>No customers in this period.</Empty> : (
                <Panel pad={false}>
                  <div className="max-h-[560px] overflow-auto">
                    <table className="w-full min-w-[780px] text-e11.5">
                      <THead cols={[["Customer", true], ["Type", true], ["Orders"], ["Spend"], ["Avg order"], ["Repeat", true], ["Last order", true]]} />
                      <tbody>
                        {customers.data.items.map((c) => (
                          <tr key={c.userId} className={row}>
                            <td className="px-2.5 py-2"><span className="font-medium text-slate-800">{c.company ?? c.name ?? "—"}</span>{c.phone && <span className="num ml-1.5 text-e10 text-slate-400">{c.phone}</span>}</td>
                            <td className="px-2.5 py-2"><Tag tone={c.channel === "B2B" ? "violet" : "cyan"}>{c.channel}</Tag></td>
                            <td className={num}>{count(c.orders)}</td><td className={cn(num, "font-semibold text-slate-800")}>{full(c.spend)}</td><td className={num}>{full(c.avgOrderValue)}</td>
                            <td className="px-2.5 py-2">{c.isRepeat ? <Tag tone="lime">Yes</Tag> : <span className="text-slate-400">No</span>}</td>
                            <td className="num px-2.5 py-2 text-slate-500">{new Date(c.lastOrderAt).toLocaleDateString("en-IN")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              )}
              <p className="text-e11 text-slate-400">{customers.data.note}</p>
            </>
          ))}

          {/* ───────── stores ───────── */}
          {tab === "stores" && (stores.isLoading ? <Skel /> : stores.isError || !stores.data ? <LoadError what="this report" onRetry={() => stores.refetch()} /> : stores.data.items.length === 0 ? <Empty>No active stores.</Empty> : (
            <>
              <Panel>
                <SectionTitle title="Store-level scorecard" sub="Sales and refunds per store — find the location that needs a look" />
                <div className="h-64">
                  <ResponsiveContainer>
                    <BarChart data={stores.data.items.map((s) => ({ name: s.name, sales: s.sales, refunds: s.refunds }))} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid {...GRID} vertical={false} />
                      <XAxis dataKey="name" {...AXIS} interval={0} />
                      <YAxis {...AXIS} tickFormatter={(v: number) => inr(v).replace("₹", "")} />
                      <Tooltip content={<ChartTip money />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                      <Bar dataKey="sales" name="Sales" fill="#84cc16" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                      <Bar dataKey="refunds" name="Refunds" fill="#e11d48" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
              <Panel pad={false}>
                <div className="overflow-x-auto">
                  <table className="founder-table">
                    <thead><tr>{["Store", "Orders", "Sales", "Avg order", "Units", "Refunds", "Returns", "Cancelled", "Fulfilment", "Stock in / sold / damaged"].map((x, i) => <th key={x} className={i ? "text-right" : undefined}>{x}</th>)}</tr></thead>
                    <tbody>
                      {stores.data.items.map((s) => {
                        const cancelPct = s.orders ? (s.cancelledOrders / s.orders) * 100 : 0
                        return (
                          <tr key={s.shopId}>
                            <td className="font-semibold">{s.name}<span className="ml-1.5 text-slate-400">{s.branchCode}</span></td>
                            <td className="text-right">{count(s.orders)}</td><td className="text-right font-semibold">{full(s.sales)}</td><td className="text-right">{full(s.avgOrderValue)}</td><td className="text-right">{count(s.unitsSold)}</td>
                            <td className="text-right">{full(s.refunds)}</td><td className="text-right">{full(s.returns)}</td>
                            <td className="text-right"><span className="mr-1.5">{count(s.cancelledOrders)} <span className="text-slate-400">({full(s.cancelledValue)})</span></span><Tag tone={cancelPct > 8 ? "rose" : cancelPct > 4 ? "amber" : "lime"}>{pctText(Math.round(cancelPct))}</Tag></td>
                            <td className="text-right">{s.avgFulfillmentMinutes == null ? "—" : `${s.avgFulfillmentMinutes} min`}</td>
                            <td className="text-right">{count(s.stock.receivedUnits)} / {count(s.stock.soldUnits)} / <span className={s.stock.damagedUnits ? "font-semibold text-rose-600" : ""}>{count(s.stock.damagedUnits)}</span></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </>
          ))}

          {/* ───────── channels ───────── */}
          {tab === "channels" && (channels.isLoading ? <Skel /> : channels.isError || !channels.data ? <LoadError what="this report" onRetry={() => channels.refetch()} /> : (
            <>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
                <Panel>
                  <SectionTitle title="Channel mix" sub={`B2B share of sales: ${pctText(channels.data.b2bSharePct)}`} />
                  {channels.data.B2B.sales + channels.data.B2C.sales > 0 ? <Donut data={[{ name: "Business (B2B)", value: channels.data.B2B.sales }, { name: "Retail (B2C)", value: channels.data.B2C.sales }]} /> : <Empty>No sales in this period.</Empty>}
                </Panel>
                <Panel>
                  <SectionTitle title="Channel loyalty" sub="How often each side comes back, and what a customer is worth" />
                  <div className="space-y-4">
                    {(["B2B", "B2C"] as const).map((k, i) => (
                      <div key={k}>
                        <div className="mb-1 flex justify-between gap-2 text-e11"><span className="font-semibold text-slate-700">{k === "B2B" ? "Business (B2B)" : "Retail (B2C)"}</span><span className="num text-slate-500">repeat {pctText(channels.data![k].repeatRatePct)} · {inr(channels.data![k].valuePerCustomer)} per customer</span></div>
                        <Progress pct={channels.data![k].repeatRatePct ?? 0} color={COLOR[i]} h={9} />
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {(["B2B", "B2C"] as const).map((k) => {
                  const c = channels.data![k]
                  return (
                    <Panel key={k}>
                      <SectionTitle title={k === "B2B" ? "Business (B2B)" : "Retail (B2C)"} />
                      <div className="grid grid-cols-2 gap-2">
                        <MetricPill label="Orders" value={count(c.orders)} detail="placed" tone="cyan" />
                        <MetricPill label="Sales" value={inr(c.sales)} detail="in this period" />
                        <MetricPill label="Average order" value={inr(c.avgOrderValue)} detail="per order" tone="amber" />
                        <MetricPill label="Customers" value={count(c.customers)} detail="who bought" tone="cyan" />
                      </div>
                      <h4 className="mb-2 mt-4 text-e10 font-bold uppercase tracking-wider text-slate-400">Top products</h4>
                      {c.topProducts.length === 0 ? <p className="text-xs text-slate-400">None</p> : <ul className="space-y-1.5 text-xs">{c.topProducts.map((p) => <li key={p.productId} className="flex items-center justify-between gap-2 rounded-lg border border-[#eef1ea] bg-[#fcfdfa] px-2.5 py-1.5"><span className="truncate font-medium text-slate-800">{p.name}</span><span className="num shrink-0 text-slate-500">{count(p.units)} units · <b className="text-slate-800">{inr(p.revenue)}</b></span></li>)}</ul>}
                    </Panel>
                  )
                })}
              </div>
            </>
          ))}

          {/* ───────── vendors ───────── */}
          {tab === "vendors" && (vendors.isLoading ? <Skel /> : vendors.isError ? <LoadError what="this report" onRetry={() => vendors.refetch()} /> : !vendors.data || vendors.data.vendors.length === 0 ? <Empty>No purchases in this period.</Empty> : <Vendors data={vendors.data} selected={vendorId} onSelect={(id) => setVendorId(id === vendorId ? "" : id)} />)}

          {/* ───────── reconciliation ───────── */}
          {tab === "reconciliation" && (recon.isLoading ? <Skel /> : recon.isError ? <LoadError what="this report" onRetry={() => recon.refetch()} /> : !recon.data || recon.data.products.length === 0 ? <Empty>No purchases in this period.</Empty> : (
            <>
              <p className="text-e11 text-slate-500">{recon.data.note}</p>
              <Panel pad={false}>
                <div className="max-h-[640px] overflow-auto">
                  <table className="founder-table">
                    <thead><tr>{["Product", "Procured", "Damaged at door", "Sent to stores", "Returned / lost (central)", "Still central", "Written off at stores", "Sold", "In stores now", "Purchase cost", "Sales value", "Loss value"].map((x, i) => <th key={x} className={i ? "text-right" : undefined}>{x}</th>)}</tr></thead>
                    <tbody>
                      {recon.data.products.map((p) => (
                        <tr key={p.productId}>
                          <td className="font-semibold">{p.name}</td><td className="text-right">{count(p.received)}</td><td className="text-right">{count(p.damagedAtDoor)}</td><td className="text-right">{count(p.allocated)}</td><td className="text-right">{count(p.centralAdjusted)}</td>
                          <td className="text-right">{count(p.availableCentral)}</td><td className="text-right">{count(p.storeAdjusted)}</td><td className="text-right">{count(p.soldQty)}</td><td className="text-right">{count(p.storeStockNow)}</td>
                          <td className="text-right">{full(p.purchaseCost)}</td><td className="text-right font-semibold">{full(p.salesValue)}</td><td className={cn("text-right", p.lossValue > 0 && "font-semibold text-rose-600")}>{full(p.lossValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </>
          ))}
        </div>
      )}
    </div>
  )
}

function Vendors({ data, selected, onSelect }: { data: VendorReport; selected: string; onSelect: (id: string) => void }) {
  // price movement: how the latest price compares with the average paid for the same product (only when a vendor is picked)
  const moves = (data.products ?? []).filter((p) => p.avgPrice && p.lastUnitPrice).map((p) => ({ ...p, move: ((p.lastUnitPrice - (p.avgPrice as number)) / (p.avgPrice as number)) * 100 })).sort((a, b) => Math.abs(b.move) - Math.abs(a.move))
  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
        <Panel>
          <SectionTitle title="Who we buy from" sub={`Total purchased: ${full(data.totalValue)}`} />
          <Donut data={data.vendors.filter((v) => v.purchaseValue > 0).map((v) => ({ name: v.name, value: v.purchaseValue }))} />
        </Panel>
        <Panel>
          <SectionTitle title="Supplier quality" sub="Short deliveries and damage at the door, as a share of what was received" />
          <div className="space-y-3">
            {data.vendors.slice(0, 6).map((v) => {
              const bad = v.receivedQty > 0 ? ((v.shortageQty + v.damagedQty) / v.receivedQty) * 100 : 0
              return <div key={v.vendorId}><div className="mb-1 flex justify-between gap-2 text-e11"><span className="truncate font-medium text-slate-700">{v.name}</span><span className="num text-slate-500">{v.shortageQty} short · {v.damagedQty} damaged · <b className={bad > 5 ? "text-rose-600" : "text-slate-800"}>{bad.toFixed(1)}%</b></span></div><Progress pct={Math.min(100, bad * 4)} color={bad > 5 ? "#e11d48" : bad > 2 ? "#f59e0b" : "#65a30d"} h={7} /></div>
            })}
          </div>
        </Panel>
      </div>
      <Panel pad={false}>
        <div className="overflow-x-auto">
          <table className="founder-table">
            <thead><tr>{["Vendor", "Purchases", "Products", "Received", "Short", "Damaged", "Value", "Avg price", "Share"].map((x, i) => <th key={x} className={i ? "text-right" : undefined}>{x}</th>)}</tr></thead>
            <tbody>
              {data.vendors.map((v) => (
                <tr key={v.vendorId} onClick={() => onSelect(v.vendorId)} aria-selected={selected === v.vendorId} className="cursor-pointer" style={selected === v.vendorId ? { background: "#f4f9e8" } : undefined}>
                  <td className="font-semibold">{v.name}</td><td className="text-right">{count(v.entries)}</td><td className="text-right">{count(v.products)}</td><td className="text-right">{count(v.receivedQty)}</td>
                  <td className={cn("text-right", v.shortageQty > 0 && "font-semibold text-amber-600")}>{count(v.shortageQty)}</td><td className={cn("text-right", v.damagedQty > 0 && "font-semibold text-rose-600")}>{count(v.damagedQty)}</td>
                  <td className="text-right font-semibold">{full(v.purchaseValue)}</td><td className="text-right">{full(v.avgPrice)}</td><td className="text-right"><Tag tone="lime">{pctText(v.sharePct)}</Tag></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-[#e3e8dd] px-4 py-2.5 text-e11 text-slate-400">Click a vendor to see the products bought from them and how their prices moved.</p>
      </Panel>
      {data.products && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,.7fr)]">
          <Panel pad={false}>
            <div className="border-b border-[#e3e8dd] p-5 pb-3"><SectionTitle title="Products bought from this vendor" /></div>
            <div className="overflow-x-auto">
              <table className="founder-table">
                <thead><tr>{["Product", "Received", "Damaged", "Value", "Avg price", "Last price"].map((x, i) => <th key={x} className={i ? "text-right" : undefined}>{x}</th>)}</tr></thead>
                <tbody>{data.products.map((p) => <tr key={p.productId}><td className="font-semibold">{p.name}</td><td className="text-right">{count(p.receivedQty)}</td><td className="text-right">{count(p.damagedQty)}</td><td className="text-right">{full(p.purchaseValue)}</td><td className="text-right">{full(p.avgPrice)}</td><td className="text-right font-semibold">{full(p.lastUnitPrice)}</td></tr>)}</tbody>
              </table>
            </div>
          </Panel>
          <Panel>
            <SectionTitle title="Price movement board" sub="Latest price vs the average paid" />
            {moves.length === 0 ? <Empty>Not enough price history.</Empty> : (
              <ul className="space-y-2">
                {moves.slice(0, 8).map((p) => (
                  <li key={p.productId} className="flex items-center justify-between gap-2 rounded-xl border border-[#e8ece3] bg-[#fafbf7] px-3 py-2">
                    <div className="min-w-0"><p className="truncate text-e13 font-medium text-slate-800">{p.name}</p><p className="num text-e10 text-slate-500">{full(p.avgPrice)} avg → {full(p.lastUnitPrice)} last</p></div>
                    <Tag tone={p.move > 3 ? "rose" : p.move < -3 ? "lime" : "slate"}>{p.move > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}{p.move > 0 ? "+" : ""}{p.move.toFixed(1)}%</Tag>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
      <p className="flex items-center gap-1.5 text-e11 text-slate-400"><Users className="size-3.5" /><Banknote className="size-3.5" />Same purchase records as Procurement and the reconciliation tab.</p>
    </>
  )
}
