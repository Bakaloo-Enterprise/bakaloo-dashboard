"use client"

/** Forecast screen in the MandiMetrics reference layout, fed by GET /admin/erp/ops/forecast. */
import { useMemo, useState } from "react"
import Link from "next/link"
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { AlertOctagon, ArrowRight, Boxes, CalendarClock, Copy, Gauge, Radar, ShoppingCart, Trash2, TrendingUp } from "lucide-react"
import { toast } from "sonner"
import { useForecast } from "@/hooks/useErp"
import type { Forecast, ForecastItem, ForecastRisk } from "@/types/erp.types"
import { count, dayLabel, inr } from "../format"
import { ShopPick } from "./Controls"
import { AXIS, ChartTip, CountUp, GRID, Kpi, LoadError, PageHead, Panel, SectionTitle, Seg, Tag, type TagTone } from "./ui"
import { cn } from "@/lib/utils"

const RISK: Record<ForecastRisk, { label: string; tone: TagTone }> = {
  RUNS_OUT_TODAY: { label: "runs out today", tone: "rose" },
  BUY_FOR_TOMORROW: { label: "buy", tone: "amber" },
  LOW: { label: "getting low", tone: "amber" },
  WILL_SPOIL: { label: "may spoil", tone: "violet" },
  OK: { label: "enough", tone: "lime" },
  NO_DATA: { label: "new", tone: "slate" },
}
const needsAction = (i: ForecastItem) => i.buy > 0 || i.risk === "RUNS_OUT_TODAY" || i.risk === "WILL_SPOIL"
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
/** whole numbers stay whole, fractions get one decimal; zero reads as 0 */
const qty = (n?: number | null) => (n == null ? "—" : Number.isInteger(n) ? String(n) : n.toFixed(1)) // tolerant: an older API without these fields shows a dash, not a crash
const rupees = (n?: number | null) => n == null ? "—" : `₹${Math.round(n).toLocaleString("en-IN")}`

function copyBuyList(f: Forecast) {
  const lines = f.items.filter((i) => i.buy > 0).map((i) => `• ${i.name} (${i.pack ?? i.unit ?? ""}) — ${i.buy}`)
  navigator.clipboard.writeText(`Buy list for ${dayLabel(f.forecastFrom)}\n${lines.join("\n")}`)
    .then(() => toast.success("Buy list copied"), () => toast.error("Could not copy — select and copy by hand"))
}

export function ForecastView() {
  const [shopId, setShopId] = useState("")
  const [cover, setCover] = useState<"1" | "2" | "3">("1")
  const [itemId, setItemId] = useState("")
  const [show, setShow] = useState<"buy" | "all">("buy")
  const q = useForecast({ shopId, cover: Number(cover), horizon: 7 })
  const f = q.data

  const view = useMemo(() => {
    if (!f) return null
    const items = f.items
    const item = items.find((i) => i.productId === itemId) ?? [...items].sort((a, b) => b.buyValue - a.buyValue || b.tomorrow - a.tomorrow)[0]
    const demandTomorrow = sum(items.map((i) => i.tomorrow))
    const demandWeek = sum(items.map((i) => i.nextWeek))
    const perDay = sum(items.map((i) => i.avgPerDay))
    const coverAll = perDay > 0 ? sum(items.map((i) => i.stock)) / perDay : 0
    let left = item ? item.stock + item.incoming : 0
    const chart = (item?.daily ?? []).map((d) => { left = Math.max(0, left - d.units); return { day: dayLabel(d.day), demand: d.units, left: Math.round(left * 10) / 10 } })
    const action = items.filter(needsAction)
    const rows = (show === "buy" ? action : items).slice().sort((a, b) => b.buyValue - a.buyValue || b.tomorrow - a.tomorrow)
    return { items, item, demandTomorrow, demandWeek, coverAll, chart, rows, actionCount: action.length }
  }, [f, itemId, show])

  return (
    <div className="space-y-5 animate-fade">
      <PageHead
        eyebrow="Forecast Engine" icon={<Radar className="size-3.5" />}
        title={<>Buy tomorrow&apos;s demand, <span className="text-lime-700">not yesterday&apos;s regret</span></>}
        sub="Weekday pattern × recent trend from your real sales · the suggested purchase nets off the stock you already have"
        right={
          <div className="flex flex-wrap items-center gap-2">
            <ShopPick value={shopId} onChange={setShopId} />
            <Seg<"1" | "2" | "3"> label="Days to cover" value={cover} onChange={setCover} options={[{ id: "1", label: "1 day" }, { id: "2", label: "2 days" }, { id: "3", label: "3 days" }]} />
            <button type="button" disabled={!f?.items.some((i) => i.buy > 0)} onClick={() => f && copyBuyList(f)}
              className="flex items-center gap-2 rounded-xl border border-lime-300 bg-lime-50 px-3.5 py-2 text-xs font-semibold text-lime-700 hover:bg-lime-100 disabled:cursor-not-allowed disabled:opacity-50">
              <Copy className="size-3.5" /> Copy buy list
            </button>
          </div>
        }
      />

      {q.isLoading ? <Loading /> : q.isError || !f || !view ? <LoadError what="the forecast" onRetry={() => q.refetch()} /> : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6 stagger">
            <Kpi label={`To buy · ${cover}d`} value={<CountUp value={f.totals.toBuy} />} accent="cyan" icon={<ShoppingCart className="size-4" />} sub={`about ${inr(f.totals.buyValue)} of stock`} />
            <Kpi label="Runs out today" value={<CountUp value={f.totals.urgent} />} accent={f.totals.urgent > 0 ? "rose" : "lime"} icon={<AlertOctagon className="size-4" />} sub="shelf empties before closing" />
            <Kpi label="May spoil" value={<CountUp value={f.totals.willSpoil} />} accent="violet" icon={<Trash2 className="size-4" />} sub="more stock than will sell in time" />
            <Kpi label="Model confidence" value={f.accuracy.accuracyPct == null ? "—" : <CountUp value={f.accuracy.accuracyPct} format={(n) => `${Math.max(0, n).toFixed(0)}%`} />}
              accent={(f.accuracy.accuracyPct ?? 0) >= 80 ? "lime" : "amber"} icon={<Gauge className="size-4" />} sub="last 7 days, replayed" help={f.definitions.accuracy} />
            <Kpi label="Demand tomorrow" value={<CountUp value={view.demandTomorrow} />} accent="lime" icon={<TrendingUp className="size-4" />} sub={`${count(Math.round(view.demandWeek))} items over the next 7 days`} />
            <Kpi label="Stock cover" value={<CountUp value={view.coverAll} format={(n) => `${n.toFixed(1)} days`} />} accent={view.coverAll < 1 ? "rose" : view.coverAll < 3 ? "amber" : "lime"} icon={<Boxes className="size-4" />} sub={`${count(f.totals.short)} products running short`} />
          </div>

          <div className="grid gap-4 xl:grid-cols-3 stagger">
            <Panel className="xl:col-span-2">
              <SectionTitle title={view.item ? `${view.item.name} — expected sales and stock left` : "Expected sales"}
                sub="items per day · stock left assumes nothing new arrives"
                right={
                  <select aria-label="Product" value={view.item?.productId ?? ""} onChange={(e) => setItemId(e.target.value)}
                    className="appearance-none rounded-lg border border-[#dce3d4] bg-white px-3 py-1.5 pr-8 text-xs text-slate-800 focus:border-lime-400/40">
                    {view.items.map((it) => <option key={it.productId} value={it.productId}>{it.name}</option>)}
                  </select>} />
              {view.chart.length === 0 ? <p className="grid h-72 place-items-center text-xs text-slate-400">Not enough sales yet to forecast this product.</p> : (
                <div className="h-72">
                  <ResponsiveContainer>
                    <ComposedChart data={view.chart} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
                      <CartesianGrid {...GRID} />
                      <XAxis dataKey="day" {...AXIS} interval="preserveStartEnd" />
                      <YAxis {...AXIS} />
                      <Tooltip content={<ChartTip unit=" items" />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="demand" name="Will sell" stroke="#65a30d" strokeWidth={2.6} dot={{ r: 2.5, fill: "#65a30d" }} isAnimationActive={false} />
                      <Bar dataKey="left" name="Stock left" fill="#f59e0b" fillOpacity={0.5} radius={[3, 3, 0, 0]} barSize={8} isAnimationActive={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
              {view.item && (
                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-e11 text-slate-500">
                  <span>On shelf now: <b className="num text-slate-700">{count(view.item.stock)}</b>{view.item.incoming > 0 && <> + <b className="num text-slate-700">{count(view.item.incoming)}</b> on the way</>}</span>
                  <span>Allowing for <b className="num text-slate-700">{view.item.wastePct.toFixed(1)}%</b> spoilage</span>
                </div>
              )}
            </Panel>

            <Panel pad={false}>
              <div className="border-b border-[#e3e8dd] p-5 pb-3">
                <SectionTitle title={`Day-by-day · ${view.item?.name ?? "—"}`} sub="Expected sales, stock left & what to buy" />
              </div>
              <div className="max-h-[420px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white">
                    <tr className="text-left text-e9.5 uppercase tracking-widest text-slate-500">
                      <th className="px-4 py-2">Day</th><th className="px-2 py-2 text-right">Will sell</th>
                      <th className="px-2 py-2 text-right">Stock left</th><th className="px-4 py-2 text-right">Buy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.chart.map((x, i) => (
                      <tr key={x.day} className={cn("border-t border-[#eef1ea]", i === 0 && "bg-lime-50")}>
                        <td className="px-4 py-2 font-medium text-slate-800">{x.day}</td>
                        <td className="num px-2 py-2 text-right text-slate-700">{count(Math.round(x.demand))}</td>
                        <td className="num px-2 py-2 text-right text-amber-600">{count(Math.round(x.left))}</td>
                        <td className="num px-4 py-2 text-right font-semibold text-lime-700">{i === 0 && view.item && view.item.buy > 0 ? count(view.item.buy) : "—"}</td>
                      </tr>
                    ))}
                    {view.chart.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-400">No forecast yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          <Panel>
            <SectionTitle title="Tomorrow's procurement plan — all items"
              sub="What to carry in for tomorrow, costed at the last purchase rates"
              help={f.definitions.forecast}
              right={
                <div className="flex flex-wrap items-center gap-2">
                  <Seg size="xs" label="Which products" value={show} onChange={setShow} options={[{ id: "buy", label: `Needs action · ${view.actionCount}` }, { id: "all", label: `All · ${view.items.length}` }]} />
                  <Tag tone="amber"><CalendarClock className="size-3" /> spend {inr(f.totals.buyValue)}</Tag>
                  <Tag tone="lime">revenue potential {inr(f.totals.estRevenue)}</Tag>
                </div>} />
            <div className="max-h-[640px] overflow-auto">
              <table className="w-full min-w-[880px] text-xs">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-[#e3e8dd] text-left text-e10 uppercase tracking-widest text-slate-500">
                    <th className="py-2.5 pr-3">Item</th><th className="py-2.5 pr-3 text-right">Opening est.</th>
                    <th className="py-2.5 pr-3 text-right">Demand</th><th className="py-2.5 pr-3 text-right">Wastage est.</th>
                    <th className="py-2.5 pr-3 text-right">Buy qty</th><th className="py-2.5 pr-3 text-right">Est. cost</th>
                    <th className="py-2.5 pr-3 text-right">Est. revenue</th><th className="py-2.5 text-right">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {view.rows.map((r) => {
                    const risk = RISK[r.risk]
                    const conf = r.confidencePct
                    return (
                      <tr key={r.productId} onClick={() => setItemId(r.productId)} className={cn("cursor-pointer border-b border-[#eef1ea] hover:bg-lime-50/50", r.productId === view.item?.productId && "bg-lime-50")}>
                        <td className="py-2 pr-3 font-medium text-slate-800">{r.name} {r.pack && <span className="text-e10 font-normal text-slate-400">{r.pack}</span>}
                          {r.risk !== "OK" && <Tag tone={risk.tone} className="ml-2 align-middle">{risk.label}</Tag>}</td>
                        <td className="num py-2 pr-3 text-right text-amber-600">{qty(r.opening)}</td>
                        <td className="num py-2 pr-3 text-right text-slate-700">{qty(r.demand)}</td>
                        <td className="num py-2 pr-3 text-right text-rose-600">{qty(r.wasteQty)}</td>
                        <td className="num py-2 pr-3 text-right font-bold text-lime-700">{qty(r.buy)}</td>
                        <td className="num py-2 pr-3 text-right text-slate-700">{r.buy > 0 ? rupees(r.buyValue) : "—"}</td>
                        <td className="num py-2 pr-3 text-right text-slate-700">{r.estRevenue > 0 ? rupees(r.estRevenue) : "—"}</td>
                        <td className="py-2 text-right">{conf == null ? <Tag tone="slate" title="Nothing sold recently to check the forecast against">n/a</Tag> : <Tag tone={conf > 80 ? "lime" : conf > 62 ? "amber" : "rose"}>{Math.round(conf)}%</Tag>}</td>
                      </tr>
                    )
                  })}
                  {view.rows.length === 0 && <tr><td colSpan={8} className="py-12 text-center text-slate-400">Nothing needs buying — stock covers the next {cover === "1" ? "day" : `${cover} days`}.</td></tr>}
                </tbody>
              </table>
            </div>
            <Link href="/procurement" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-lime-700 hover:underline">Plan and record the purchase in Procurement <ArrowRight className="size-3.5" /></Link>
          </Panel>

          <Panel className="border-lime-200 bg-lime-50/60">
            <div className="flex items-start gap-3">
              <Boxes className="mt-0.5 size-4 shrink-0 text-lime-700" />
              <p className="text-xs leading-relaxed text-slate-600">
                <span className="font-semibold text-lime-800">How the forecast thinks:</span> {f.definitions.forecast}
                {f.definitions.accuracy && <> <span className="font-semibold text-lime-800">Confidence:</span> {f.definitions.accuracy}</>}
              </p>
            </div>
          </Panel>
        </>
      )}
    </div>
  )
}

function Loading() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-[108px] animate-pulse rounded-2xl border border-[#e3e8dd] bg-[#f6f8f2]" />)}</div>
      <div className="h-96 animate-pulse rounded-2xl border border-[#e3e8dd] bg-[#f6f8f2]" />
    </div>
  )
}
