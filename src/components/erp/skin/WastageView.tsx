"use client"

/** Wastage Lab in the MandiMetrics reference layout, fed by GET /admin/erp/ops/wastage. */
import { useMemo, useState } from "react"
import { Area, AreaChart, Bar, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { AlertTriangle, Crosshair, Flame, PackageX, Recycle, Skull } from "lucide-react"
import { useWastage } from "@/hooks/useErp"
import { periodProblem, toPeriodQuery } from "@/components/business/business-helpers"
import type { PeriodState } from "@/components/business/PeriodBar"
import type { Wastage } from "@/types/erp.types"
import { count, dayLabel, inr, pctText } from "../format"
import { DateWindow } from "./Controls"
import { AXIS, ChartTip, CountUp, GRID, Kpi, LoadError, PageHead, Panel, SectionTitle, Tag } from "./ui"

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MON_FIRST = [1, 2, 3, 4, 5, 6, 0]
const SLICES = ["#e11d48", "#f59e0b", "#8b5cf6", "#0891b2", "#65a30d", "#64748b"]
const short = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)))

function HeatRow({ name, cells, max }: { name: string; cells: number[]; max: number }) {
  return (
    <>
      <div className="flex items-center truncate pr-2 text-e11.5 font-medium text-slate-700">{name}</div>
      {MON_FIRST.map((w) => {
        const v = cells[w] ?? 0
        const t = max > 0 ? v / max : 0
        return (
          <div key={w} className="heat-cell relative grid h-8 cursor-default place-items-center rounded-md"
            style={{ background: `rgba(225,29,72,${0.05 + t * 0.5})`, boxShadow: t > 0.75 ? "inset 0 0 0 1px rgba(225,29,72,0.45)" : "none" }}
            title={`${name} · ${DOW[w]} · ${inr(v, false)}`}>
            {v > 0 && <span className="num text-e9.5" style={{ color: t > 0.5 ? "#fecdd3" : "#64748b" }}>{short(v)}</span>}
          </div>
        )
      })}
    </>
  )
}

function derive(w: Wastage) {
  const heat = [...w.heatmap].sort((a, b) => b.weekdays.reduce((x, y) => x + y, 0) - a.weekdays.reduce((x, y) => x + y, 0)).slice(0, 12)
  const scaleMax = Math.max(1, ...heat.flatMap((h) => h.weekdays))
  const pareto = w.products.slice(0, 12).map((p) => ({ name: p.name.split(" ")[0], cost: Math.round(p.value), cum: p.cumulativePct ?? 0 }))
  const worst = w.daily.reduce<{ day: string; value: number } | null>((best, d) => (!best || d.value > best.value ? d : best), null)
  const breaches = w.products.filter((p) => p.breach).slice(0, 7)
  const cats = w.byCategory.filter((c) => c.value > 0)
  return { heat, scaleMax, pareto, worst: worst && worst.value > 0 ? worst : null, breaches, cats }
}

export function WastageView() {
  const [period, setPeriod] = useState<PeriodState>({ period: "30d" })
  const [shopId, setShopId] = useState("")
  const problem = periodProblem(period)
  const q = useWastage({ ...toPeriodQuery(period), ...(shopId ? { shopId } : {}) }, !problem)
  const w = q.data
  const d = useMemo(() => (w ? derive(w) : null), [w])

  return (
    <div className="space-y-5 animate-fade">
      <PageHead
        eyebrow="Wastage Lab" icon={<Flame className="size-3.5" />} eyebrowClass="text-rose-500/80"
        title={<>Every item wasted is <span className="text-rose-600">cash composted</span></>}
        sub={w ? `${dayLabel(w.from)} → ${dayLabel(w.to)} · what went bad, why, and when — priced at what we paid` : "What went bad, why, and when — priced at what we paid"}
      />
      <DateWindow value={period} onChange={setPeriod} shopId={shopId} onShop={setShopId} problem={problem} />

      {q.isLoading ? <Loading /> : q.isError || !w || !d ? <LoadError what="wastage" onRetry={() => q.refetch()} /> : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 stagger">
            <Kpi label="Total burn" value={<CountUp value={w.totals.value} format={(n) => inr(n)} />} accent="rose" icon={<Flame className="size-4" />} sub={`${inr(w.totals.perDay)} per day`} help={w.definitions.wasted} />
            <Kpi label="% of intake" value={w.totals.wastePct == null ? "—" : <CountUp value={w.totals.wastePct} format={(n) => pctText(n, 1)} />} accent="amber" icon={<Crosshair className="size-4" />} sub={`${count(w.totals.qty)} of ${count(w.totals.handled)} items handled`} />
            <Kpi label="Over target" value={<CountUp value={w.breaches} />} accent={w.breaches > 0 ? "orange" : "lime"} icon={<AlertTriangle className="size-4" />} sub="products above their wastage ceiling" />
            <Kpi label="Worst day" value={d.worst ? dayLabel(d.worst.day) : "—"} accent="rose" icon={<Skull className="size-4" />} sub={d.worst ? inr(d.worst.value, false) : "nothing lost"} />
          </div>

          <div className="grid gap-4 xl:grid-cols-3 stagger">
            <Panel className="xl:col-span-2">
              <SectionTitle title="Burn heatmap — product × weekday" sub="₹ lost, top 12 offenders · find your recurring bad slots" right={<Tag tone="rose">hover any cell</Tag>} />
              {d.heat.length === 0 ? <p className="py-10 text-center text-xs text-slate-400">Nothing lost in this window.</p> : (
                <div className="overflow-x-auto">
                  <div className="min-w-[731px]">
                    <div className="grid grid-cols-[149px_repeat(7,1fr)] gap-1">
                      <div />
                      {MON_FIRST.map((i) => <div key={i} className="num pb-1 text-center text-e10 uppercase tracking-widest text-slate-500">{DOW[i]}</div>)}
                      {d.heat.map((h) => <HeatRow key={h.productId} name={h.name} cells={h.weekdays} max={d.scaleMax} />)}
                    </div>
                  </div>
                </div>
              )}
            </Panel>

            <Panel>
              <SectionTitle title="Where the loss sits" sub="Share of the burn by category" />
              {d.cats.length === 0 ? <p className="py-10 text-center text-xs text-slate-400">Nothing lost.</p> : (
                <>
                  <div className="relative h-44">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={d.cats.map((c) => ({ name: c.category, value: Math.round(c.value) }))} innerRadius={54} outerRadius={78} paddingAngle={4} dataKey="value" strokeWidth={0} isAnimationActive={false}>
                          {d.cats.map((c, i) => <Cell key={c.category} fill={SLICES[i % SLICES.length]} fillOpacity={0.9} />)}
                        </Pie>
                        <Tooltip content={<ChartTip money />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 grid place-items-center">
                      <div className="text-center">
                        <p className="num text-lg font-bold text-rose-600">{pctText(d.cats[0].sharePct, 0)}</p>
                        <p className="max-w-[90px] truncate text-e10 uppercase tracking-widest text-slate-500">{d.cats[0].category}</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 space-y-1.5 text-xs text-slate-600">
                    {d.cats.slice(0, 5).map((c, i) => (
                      <p key={c.category} className="flex items-center gap-2"><span className="size-2 shrink-0 rounded-full" style={{ background: SLICES[i % SLICES.length] }} /><span className="min-w-0 flex-1 truncate">{c.category}</span><span className="num font-semibold text-slate-700">{inr(c.value)}</span></p>
                    ))}
                    <p className="flex gap-2 pt-1"><Recycle className="mt-0.5 size-3.5 shrink-0 text-lime-700" />Fix the top category first — that is where most of the money leaks.</p>
                  </div>
                </>
              )}
            </Panel>
          </div>

          <div className="grid gap-4 xl:grid-cols-3 stagger">
            <Panel className="xl:col-span-2">
              <SectionTitle title="Pareto of pain" sub="Cumulative % line — the few products causing most of the burn" />
              {d.pareto.length === 0 ? <p className="py-10 text-center text-xs text-slate-400">Nothing lost.</p> : (
                <div className="h-60">
                  <ResponsiveContainer>
                    <ComposedChart data={d.pareto} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
                      <CartesianGrid {...GRID} vertical={false} />
                      <XAxis dataKey="name" {...AXIS} interval={0} angle={-24} textAnchor="end" height={52} />
                      <YAxis yAxisId="l" {...AXIS} tickFormatter={(v: number) => inr(v).replace("₹", "")} />
                      <YAxis yAxisId="r" orientation="right" {...AXIS} tickFormatter={(v: number) => `${v}%`} width={38} domain={[0, 100]} />
                      <Tooltip content={<ChartTip fmt={(v, p) => (p.dataKey === "cum" ? `${v}%` : `₹${Number(v).toLocaleString("en-IN")}`)} />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                      <Bar yAxisId="l" dataKey="cost" name="Lost ₹" fill="#e11d48" fillOpacity={0.8} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                      <Line yAxisId="r" dataKey="cum" name="Cumulative %" stroke="#d97706" strokeWidth={2} dot={{ r: 2.5, fill: "#d97706" }} isAnimationActive={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>

            <Panel>
              <SectionTitle title="Damaged at the door" sub="Found broken when a purchase arrived — claim it from the vendor" />
              <div className="space-y-2.5">
                {w.doorDamage.byVendor.length === 0 && <p className="py-6 text-center text-xs text-slate-500">Clean receiving — no damage reported.</p>}
                {w.doorDamage.byVendor.map((v) => (
                  <div key={v.vendor} className="flex items-center justify-between gap-2 rounded-xl border border-[#e8ece3] bg-[#fafbf7] px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-e13 font-medium text-slate-800">{v.vendor}</p>
                      <p className="text-e10 text-slate-500">{count(v.qty)} items</p>
                    </div>
                    <div className="text-right">
                      <p className="num text-xs font-bold text-rose-600">{inr(v.value)}</p>
                      <Tag tone="amber">claim it</Tag>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-e10.5 text-slate-400"><PackageX className="size-3.5 shrink-0" />Total at the door: <b className="num text-slate-600">{inr(w.totals.doorDamageValue)}</b></p>
            </Panel>
          </div>

          <div className="grid gap-4 xl:grid-cols-3 stagger">
            <Panel className="xl:col-span-2">
              <SectionTitle title="Daily burn trajectory" sub={`Lost ₹ per day · ${inr(w.totals.perDay)} on an average day`} />
              {w.daily.some((x) => x.value > 0) ? (
                <div className="h-52">
                  <ResponsiveContainer>
                    <AreaChart data={w.daily.map((x) => ({ ...x, label: dayLabel(x.day) }))} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gBurn" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#e11d48" stopOpacity={0.3} /><stop offset="100%" stopColor="#e11d48" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid {...GRID} />
                      <XAxis dataKey="label" {...AXIS} minTickGap={24} />
                      <YAxis {...AXIS} tickFormatter={(v: number) => inr(v).replace("₹", "")} />
                      <Tooltip content={<ChartTip money />} />
                      <Area type="monotone" dataKey="value" name="Lost ₹" stroke="#e11d48" strokeWidth={2.2} fill="url(#gBurn)" isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="grid h-52 place-items-center text-xs text-slate-400">No spoilage recorded in this period.</p>}
            </Panel>

            <Panel>
              <SectionTitle title="Why it was lost" sub="Reason written when the stock was removed — fix the cause, not the symptom" />
              <div className="mb-4 space-y-2">
                {w.byReason.slice(0, 6).map((x) => (
                  <div key={x.reason} className="flex items-center gap-2 text-xs">
                    <span className="w-32 truncate text-slate-600">{x.reason}</span>
                    <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-rose-400" style={{ width: `${x.sharePct ?? 0}%` }} />
                    </div>
                    <span className="num w-20 text-right font-semibold text-slate-700">{inr(x.value)}</span>
                    <span className="num w-10 text-right text-e10 text-slate-400">{(x.sharePct ?? 0).toFixed(0)}%</span>
                  </div>
                ))}
                {w.byReason.length === 0 && <p className="py-4 text-center text-xs text-slate-400">No reasons recorded in this window.</p>}
              </div>
              <SectionTitle title="Target breaches" sub="Products above their wastage ceiling" />
              <div className="space-y-2">
                {d.breaches.map((x) => (
                  <div key={x.productId} className="flex items-center justify-between gap-2 text-xs">
                    <span className="w-24 truncate text-slate-700">{x.name}</span>
                    <div className="relative h-3.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="absolute inset-y-0 left-0 rounded-full bg-rose-400/70" style={{ width: `${Math.min(100, ((x.wastePct ?? 0) / (x.targetPct * 2.2)) * 100)}%` }} />
                      <div className="absolute inset-y-0 w-px bg-lime-300" style={{ left: `${(1 / 2.2) * 100}%` }} title="target" />
                    </div>
                    <span className="num w-20 text-right font-semibold text-rose-600">{pctText(x.wastePct, 1)} <span className="text-slate-400">/{x.targetPct}%</span></span>
                  </div>
                ))}
                {d.breaches.length === 0 && <p className="py-6 text-center text-xs text-lime-700">All products within their targets.</p>}
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  )
}

function Loading() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[108px] animate-pulse rounded-2xl border border-[#e3e8dd] bg-[#f6f8f2]" />)}</div>
      <div className="h-72 animate-pulse rounded-2xl border border-[#e3e8dd] bg-[#f6f8f2]" />
    </div>
  )
}
