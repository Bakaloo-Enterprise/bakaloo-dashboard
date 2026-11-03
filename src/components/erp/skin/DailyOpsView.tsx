"use client"

/**
 * Daily Ops in the MandiMetrics reference layout (day strip → movement cards → day close + price advisor → all-products table),
 * fed by GET /admin/erp/ops/day-close. Stock movements come from orders and stock records, so nothing is typed twice;
 * the only entry left is "Log wastage".
 */
import { useMemo, useState } from "react"
import { AlertTriangle, Calculator, CalendarDays, ClipboardList, Flame, Lightbulb, Settings2, ShoppingCart, Trash2, Truck } from "lucide-react"
import { useDayClose, useSaveTargets } from "@/hooks/useErp"
import { addDays, istToday } from "@/components/business/business-helpers"
import type { DayClose, DayCloseItem } from "@/types/erp.types"
import { count, dayLabel, inr, pctText } from "../format"
import { TargetsDialog } from "../ops/DayCloseTable"
import { LogWastageDialog } from "../ops/LogWastageDialog"
import { DayStepper, ShopPick } from "./Controls"
import { Calc, LoadError, PageHead, Panel, SectionTitle, Seg, Tag } from "./ui"
import { cn } from "@/lib/utils"

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const dayFull = (ymd: string) => `${WEEKDAY[new Date(`${ymd}T12:00:00Z`).getUTCDay()]}, ${dayLabel(ymd)}`
const money = (n: number) => inr(n, false).replace(/\.\d+$/, "")
const rate = (n: number) => `₹${n.toFixed(n >= 100 ? 0 : 1)}`
const priceFor = (cost: number, marginPct: number) => (marginPct >= 99 ? cost * 99 : cost / (1 - marginPct / 100))
const hasGap = (i: DayCloseItem) => i.ledgerGap !== 0 || i.shelfMismatch !== 0
const wastesTooMuch = (i: DayCloseItem) => i.wastePct != null && i.wastePct > i.targetWastePct * 1.35 && i.wasteValue >= 80

type Filter = "all" | "price" | "waste" | "gaps"

/** The reference's "entry" cards, as read-only summaries of what the stock records already hold. */
function CardShell({ title, sub, icon, tone, badge, children, action }: {
  title: string; sub: string; icon: React.ReactNode; tone: "amber" | "cyan" | "rose"; badge: string; children: React.ReactNode; action?: React.ReactNode
}) {
  const ring = { amber: "border-amber-200", cyan: "border-cyan-200", rose: "border-rose-200" }[tone]
  const bg = { amber: "bg-amber-50 text-amber-700", cyan: "bg-cyan-50 text-cyan-700", rose: "bg-rose-50 text-rose-700" }[tone]
  return (
    <Panel pad={false} className={cn("flex flex-col overflow-hidden", ring)}>
      <div className={cn("flex items-center gap-2.5 border-b px-4 py-3", ring, bg)}>
        <div className="grid size-7 place-items-center rounded-lg bg-white/70">{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-e13.5 font-bold leading-tight">{title}</p>
          <p className="truncate text-e10.5 opacity-80">{sub}</p>
        </div>
        <span className="num rounded-full bg-white/80 px-2 py-0.5 text-e11 font-bold">{badge}</span>
      </div>
      <div className="flex-1 space-y-1.5 p-3.5">{children}</div>
      {action && <div className="border-t border-dashed border-[#e3e8dd] p-3.5">{action}</div>}
    </Panel>
  )
}

function Line({ left, mid, right, rightClass }: { left: React.ReactNode; mid?: React.ReactNode; right: React.ReactNode; rightClass?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[#eef1ea] bg-[#fcfdfa] px-2.5 py-2 text-xs">
      <span className="num font-semibold text-slate-800">{left}</span>
      {mid && <span className="truncate text-slate-500">{mid}</span>}
      <span className={cn("num ml-auto font-bold text-slate-800", rightClass)}>{right}</span>
    </div>
  )
}

export function DailyOpsView({ manage }: { manage: boolean }) {
  const today = istToday()
  const [date, setDate] = useState(today)
  const [shopId, setShopId] = useState("")
  const [itemId, setItemId] = useState("")
  const [mode, setMode] = useState<"single" | "all">("single")
  const [filter, setFilter] = useState<Filter>("all")
  const [margins, setMargins] = useState<Record<string, string>>({})
  const [logging, setLogging] = useState(false)
  const [editing, setEditing] = useState<DayCloseItem | null>(null)
  const q = useDayClose({ date, shopId })
  const d = q.data
  const saveTargets = useSaveTargets()

  const item = useMemo(() => {
    if (!d?.items.length) return null
    return d.items.find((i) => i.productId === itemId) ?? [...d.items].sort((a, b) => b.revenue - a.revenue)[0]
  }, [d, itemId])

  const rows = useMemo(() => {
    if (!d) return []
    const list = d.items.filter((i) => filter === "all" || (filter === "price" && i.price.advice === "RAISE") || (filter === "waste" && wastesTooMuch(i)) || (filter === "gaps" && hasGap(i)))
    return [...list].sort((a, b) => b.revenue - a.revenue)
  }, [d, filter])

  return (
    <div className="space-y-5 animate-fade">
      <PageHead
        strong eyebrow="Daily Ops Workbench" icon={<CalendarDays className="size-3.5" />}
        title={dayFull(date)}
        sub={<>Close the day: <b className="text-slate-700">what we had, bought, sold and lost</b> — and whether the prices earned their keep. Everything is read from orders and stock records, so nothing is typed twice.</>}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" aria-label="Day" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} className="fld !w-[171px]" />
            {d && d.items.length > 0 && (
              <select aria-label="Product" value={item?.productId ?? ""} onChange={(e) => { setItemId(e.target.value); setMode("single") }} className="fld fld-sans !w-[217px] font-medium">
                {d.items.map((it) => <option key={it.productId} value={it.productId}>{it.name}{it.pack ? ` (${it.pack})` : ""}</option>)}
              </select>
            )}
            <ShopPick value={shopId} onChange={setShopId} className="!w-[190px]" />
            <DayStepper onPrev={() => setDate(addDays(date, -1))} onToday={() => setDate(today)} onNext={() => setDate(addDays(date, 1))} canNext={date < today} />
            {manage && (
              <button type="button" onClick={() => setLogging(true)} className="flex items-center gap-1.5 rounded-lg bg-rose-500 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-rose-600">
                <Trash2 className="size-3.5" /> Log wastage
              </button>
            )}
          </div>
        }
      />

      <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-white p-2 shadow-sm">
        <button type="button" onClick={() => setMode("single")} className={cn("rounded-lg px-4 py-2 text-sm font-semibold", mode === "single" ? "bg-[#235d49] text-white" : "text-slate-600")}>Single product</button>
        <button type="button" onClick={() => setMode("all")} className={cn("rounded-lg px-4 py-2 text-sm font-semibold", mode === "all" ? "bg-[#235d49] text-white" : "text-slate-600")}>Whole day · all products</button>
        <span className="ml-auto hidden text-xs text-slate-500 md:inline">{d?.inProgress ? "Today is still running — these numbers keep moving" : "Same stock ledger as everywhere else · no duplicate entry"}</span>
      </div>

      {q.isLoading ? <Loading /> : q.isError || !d ? <LoadError what="this day" onRetry={() => q.refetch()} /> : d.items.length === 0 ? (
        <Panel><p className="py-12 text-center text-slate-400">No stock movement for {dayFull(date)} yet.</p></Panel>
      ) : (
        <>
          {(d.raise > 0 || d.ledger.gaps > 0) && (
            <div className="grid gap-3 md:grid-cols-2">
              {d.raise > 0 && <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-e11.5 text-amber-800"><Lightbulb className="size-3.5 shrink-0" /><span><b>{d.raise} product{d.raise > 1 ? "s" : ""} sell below the price that earns the target profit</b> once spoilage is paid for — see “Fix the price”.</span></div>}
              {d.ledger.gaps > 0 && <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-e11.5 text-rose-700"><AlertTriangle className="size-3.5 shrink-0" /><span><b>{d.ledger.gaps} product{d.ledger.gaps > 1 ? "s" : ""} where the stock records don’t add up</b> ({d.ledger.items.slice(0, 3).map((x) => x.name).join(", ")}). Someone changed stock without a record.</span></div>}
            </div>
          )}
          {mode === "single" && item && <SingleProduct d={d} item={item} margin={margins[item.productId] ?? String(item.price.targetMarginPct)} onMargin={(v) => setMargins((m) => ({ ...m, [item.productId]: v }))} manage={manage} onLog={() => setLogging(true)}
            onSaveMargin={(v) => saveTargets.mutate({ productId: item.productId, marginPct: v, wastagePct: item.targetWastePct })} saving={saveTargets.isPending} />}

          <AllProducts d={d} rows={rows} filter={filter} setFilter={setFilter} itemId={item?.productId} manage={manage}
            onPick={(i) => { setItemId(i.productId); setMode("single"); window.scrollTo({ top: 0, behavior: "smooth" }) }} onEdit={setEditing} />

          <details className="rounded-2xl border border-lime-200 bg-lime-50/60 p-5 text-xs leading-relaxed text-slate-600">
            <summary className="cursor-pointer font-semibold text-lime-800">How these numbers are worked out</summary>
            <dl className="mt-3 space-y-1.5">{Object.entries(d.definitions).map(([k, v]) => <div key={k}><dt className="inline font-semibold text-slate-700">{k}: </dt><dd className="inline">{v}</dd></div>)}</dl>
          </details>
        </>
      )}
      <LogWastageDialog open={logging} onClose={() => setLogging(false)} defaultShopId={shopId} />
      <TargetsDialog item={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function SingleProduct({ d, item, margin, onMargin, manage, onLog, onSaveMargin, saving }: {
  d: DayClose; item: DayCloseItem; margin: string; onMargin: (v: string) => void; manage: boolean; onLog: () => void; onSaveMargin: (v: number) => void; saving: boolean
}) {
  const handled = item.opening + item.bought
  const sellable = Math.max(0, handled - item.wasted)
  const effCost = item.price.effectiveCost
  const load = Math.max(0, effCost - item.unitCost)
  const m = Math.min(89, Math.max(0, parseFloat(margin) || 0))
  const suggested = effCost > 0 ? priceFor(effCost, m) : 0
  const avg = item.price.average
  const sellThrough = sellable > 0 ? (item.sold / sellable) * 100 : 0
  const wasteOfHandled = handled > 0 ? (item.wasted / handled) * 100 : 0
  const atTarget = effCost > 0 && handled > 0 ? (item.unitCost * handled) / Math.max(1, handled * (1 - item.targetWastePct / 100)) : effCost
  const gap = hasGap(item)
  return (
    <>
      <Panel className="!p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-lime-100 font-display text-base font-bold text-lime-700 ring-1 ring-lime-200">{item.name[0]}</div>
            <div>
              <p className="font-display text-base font-bold text-slate-900">{item.name} {item.pack && <span className="text-xs font-normal text-slate-400">{item.pack}</span>}</p>
              <p className="text-e11 text-slate-500">{item.category ?? "Uncategorised"} · cost {rate(item.unitCost)} each · aim to lose ≤{item.targetWastePct}% to spoilage</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Tag tone="amber">{count(item.bought)} bought</Tag>
            <Tag tone="cyan">{count(item.orders)} {item.orders === 1 ? "order" : "orders"}</Tag>
            <Tag tone="rose">{count(item.wasted)} lost</Tag>
            {item.price.advice === "RAISE" && <Tag tone="lime">raise price to {rate(item.price.suggested ?? suggested)}</Tag>}
          </div>
        </div>
        {gap && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-e11.5 text-rose-700">
            <Flame className="size-3.5 shrink-0" />
            Stock records are off by {item.ledgerGap !== 0 ? item.ledgerGap : item.shelfMismatch} — someone changed stock without writing it down.
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
          <Calc label="Opening" value={count(item.opening)} tone="amber" hint="carried from yesterday" />
          <Calc label="Bought today" value={count(item.bought)} hint={`≈ ${money(item.bought * item.unitCost)} at cost`} />
          <Calc label="Total handled" value={count(handled)} hint={`stock value ${money(handled * item.unitCost)}`} />
          <Calc label="Lost" value={count(item.wasted)} tone="rose" hint={`${pctText(wasteOfHandled, 1)} of handled · ${money(item.wasteValue)}`} />
          <Calc label="Sellable" value={count(sellable)} tone="lime" hint="after losses — what you can actually sell" />
          <Calc label="Effective cost" value={rate(effCost)} tone="violet" hint={`raw ${rate(item.unitCost)} + ${rate(load)} loss load`} />
          <Calc label="Left on shelf" value={count(item.closing)} tone="cyan" hint={`${money(item.closing * effCost)} → tomorrow’s opening`} />
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <CardShell title="Bought" sub={`${money(item.bought * item.unitCost)} at cost`} tone="amber" badge={count(item.bought)} icon={<Truck className="size-4" />}>
          <Line left={count(item.bought)} mid={`@ ${rate(item.unitCost)}`} right={money(item.bought * item.unitCost)} />
          {item.doorDamage && <Line left={count(item.doorDamage.qty)} mid="damaged at the door" right={money(item.doorDamage.value)} rightClass="text-rose-600" />}
          {item.bought === 0 && <p className="py-3 text-center text-e11 text-slate-400">No purchase received on this day.</p>}
        </CardShell>
        <CardShell title="Sold" sub={`${money(item.revenue)} from ${count(item.orders)} ${item.orders === 1 ? "order" : "orders"}`} tone="cyan" badge={count(item.sold)} icon={<ShoppingCart className="size-4" />}>
          <Line left={count(item.sold)} mid={avg != null ? `@ ${rate(avg)} avg` : undefined} right={money(item.revenue)} />
          {item.returnedToShelf > 0 && <Line left={count(item.returnedToShelf)} mid="returned to shelf" right="—" />}
          {item.sold === 0 && <p className="py-3 text-center text-e11 text-slate-400">Nothing sold on this day.</p>}
        </CardShell>
        <CardShell title="Lost" sub={`${money(item.wasteValue)} written off`} tone="rose" badge={count(item.wasted)} icon={<Flame className="size-4" />}
          action={manage ? <button type="button" onClick={onLog} className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-rose-500 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-rose-600"><Trash2 className="size-3.5" /> Log wastage</button> : undefined}>
          <Line left={count(item.wasted)} mid={`${pctText(item.wastePct, 1)} of handled`} right={money(item.wasteValue)} rightClass="text-rose-600" />
          {item.adjusted !== 0 && <Line left={`${item.adjusted > 0 ? "+" : ""}${count(item.adjusted)}`} mid="adjusted by hand" right="—" />}
          {item.wasted === 0 && <p className="py-3 text-center text-e11 text-slate-400">Nothing spoiled — log any rejects or dumps here.</p>}
        </CardShell>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel className="xl:col-span-2">
          <SectionTitle icon={<Calculator className="size-4" />} title="Day close — did today’s pricing actually work?"
            sub="Profit is measured against the effective (loss-absorbed) cost, so the answer is honest" help={d.definitions.profit} />
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Calc label="Sold" value={count(item.sold)} hint={`${pctText(sellThrough, 0)} sell-through`} />
            <Calc label="Revenue" value={money(item.revenue)} tone="cyan" hint={avg != null ? `avg price ${rate(avg)}` : "no sales yet"} />
            <Calc label="Cost of those" value={money(item.cogs)} hint="includes absorbed spoilage" />
            <Calc label="Profit" value={money(item.profit)} tone={item.profit >= 0 ? "lime" : "rose"} hint={`${pctText(item.marginPct, 1)} margin`} />
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border border-[#e3e8dd]">
            <table className="w-full text-xs">
              <thead className="bg-[#f6f8f2]">
                <tr className="text-left text-e10 uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2">Movement</th><th className="px-3 py-2 text-right">Items</th><th className="px-3 py-2 text-right">Value</th><th className="px-3 py-2 text-right">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {([
                  ["Opening", "#f59e0b", item.opening, item.opening * item.unitCost, null],
                  ["Bought", "#0891b2", item.bought, item.bought * item.unitCost, null],
                  ["Sold", "#65a30d", item.sold, item.revenue,
                    item.sold > 0 && avg != null ? <Tag tone={avg >= (item.price.suggested ?? 0) ? "lime" : item.profit > 0 ? "amber" : "rose"}>{avg >= (item.price.suggested ?? 0) ? "on target" : item.profit > 0 ? "thin" : "below cost"}</Tag> : null],
                  ["Lost", "#e11d48", item.wasted, item.wasteValue,
                    item.wasted > 0 ? <Tag tone={(item.wastePct ?? 0) <= item.targetWastePct ? "lime" : "rose"}>{(item.wastePct ?? 0) <= item.targetWastePct ? "within aim" : "above aim"}</Tag> : null],
                  ["Left on shelf", "#7c3aed", item.closing, item.closing * effCost, null],
                ] as const).map(([name, color, qty, val, verdict]) => (
                  <tr key={name} className="border-t border-[#eef1ea]">
                    <td className="px-3 py-2"><span className="inline-flex items-center gap-1.5 font-medium text-slate-700"><span className="size-2 rounded-full" style={{ background: color }} />{name}</span></td>
                    <td className="num px-3 py-2 text-right text-slate-600">{qty > 0 ? count(qty) : "—"}</td>
                    <td className="num px-3 py-2 text-right font-semibold text-slate-800">{val > 0 ? money(val) : "—"}</td>
                    <td className="px-3 py-2 text-right">{verdict}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel className="border-lime-200 bg-lime-50/40">
          <SectionTitle icon={<Lightbulb className="size-4" />} title="Sale price advisor" sub="Type the margin you want — we add the spoilage load for you" />
          <div className="space-y-3">
            <div className="rounded-xl bg-white p-3 ring-1 ring-[#e3e8dd]">
              <div className="flex items-center justify-between text-xs"><span className="text-slate-500">Raw purchase cost</span><span className="num font-semibold text-slate-700">{rate(item.unitCost)}</span></div>
              <div className="mt-1.5 flex items-center justify-between text-xs"><span className="text-slate-500">+ spoilage load ({pctText(wasteOfHandled, 1)})</span><span className="num font-semibold text-rose-600">+{rate(load)}</span></div>
              <div className="mt-2 flex items-center justify-between border-t border-dashed border-[#e3e8dd] pt-2 text-xs"><span className="font-semibold text-slate-700">= effective cost</span><span className="num text-sm font-bold text-violet-700">{rate(effCost)}</span></div>
            </div>
            <div>
              <span className="fld-lbl mb-1 block">Desired margin %</span>
              <div className="flex items-center gap-2">
                <input type="range" aria-label="Desired margin" min={0} max={70} step={1} value={Math.min(70, m)} onChange={(e) => onMargin(e.target.value)} className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-lime-200 accent-lime-600" style={{ minHeight: 0 }} />
                <input className="fld !w-[73px] text-center" inputMode="decimal" value={margin} onChange={(e) => onMargin(e.target.value.replace(/[^0-9.]/g, ""))} />
              </div>
            </div>
            <div className="rounded-xl bg-lime-600 p-3.5 text-white shadow-sm">
              <p className="text-e10 font-semibold uppercase tracking-[0.14em] text-lime-100">Quote this price</p>
              <p className="num mt-0.5 font-display text-3xl font-bold">{rate(suggested)}</p>
              <p className="mt-0.5 text-e11 text-lime-100">per {item.pack ?? item.unit ?? "item"} · earns {rate(suggested - effCost)} each at {m.toFixed(0)}% margin</p>
            </div>
            <div className="rounded-xl bg-white p-3 text-e11 leading-relaxed text-slate-600 ring-1 ring-[#e3e8dd]">
              {item.sold > 0 && avg != null ? (
                avg >= suggested
                  ? <>✅ Today you realised <b className="num">{rate(avg)}</b> — <b className="num text-lime-700">{pctText(((avg - suggested) / suggested) * 100, 1)}</b> above this price. Pricing is working.</>
                  : <>⚠️ You realised <b className="num">{rate(avg)}</b>, <b className="num text-rose-600">{pctText(((suggested - avg) / suggested) * 100, 1)}</b> short of this price. Raise the price or cut the {pctText(wasteOfHandled, 1)} spoilage.</>
              ) : <>No sales yet for {dayLabel(d.date)}. Once something sells, today’s price is scored here.</>}
            </div>
            {item.wasted > 0 && atTarget > 0 && (
              <div className="rounded-xl bg-white p-3 text-e11 leading-relaxed text-slate-600 ring-1 ring-[#e3e8dd]">
                💡 If spoilage were at the aim ({item.targetWastePct}%), effective cost would be <b className="num text-lime-700">{rate(atTarget)}</b> — you could sell at <b className="num">{rate(priceFor(atTarget, m))}</b> and keep the same margin.
              </div>
            )}
            {manage && m !== item.price.targetMarginPct && (
              <button type="button" disabled={saving} onClick={() => onSaveMargin(m)} className="w-full rounded-lg bg-white py-1.5 text-e11 font-semibold text-lime-700 ring-1 ring-lime-200 hover:bg-lime-100 disabled:opacity-50">Make {m.toFixed(0)}% my profit target for {item.name}</button>
            )}
          </div>
        </Panel>
      </div>
    </>
  )
}

function AllProducts({ d, rows, filter, setFilter, itemId, manage, onPick, onEdit }: {
  d: DayClose; rows: DayCloseItem[]; filter: Filter; setFilter: (f: Filter) => void; itemId?: string; manage: boolean; onPick: (i: DayCloseItem) => void; onEdit: (i: DayCloseItem) => void
}) {
  const t = d.totals
  const chips: Array<{ id: Filter; label: string }> = [
    { id: "all", label: `Everything · ${d.items.length}` },
    { id: "price", label: `Fix the price · ${d.items.filter((i) => i.price.advice === "RAISE").length}` },
    { id: "waste", label: `Losing too much · ${d.items.filter(wastesTooMuch).length}` },
    { id: "gaps", label: `Stock off · ${d.items.filter(hasGap).length}` },
  ]
  return (
    <Panel pad={false}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eef1ea] p-4">
        <SectionTitle icon={<ClipboardList className="size-4" />} title={`All products · ${dayLabel(d.date)}`} sub="Auto-computed rollup of the day — click a row to work on that product" />
        <div className="flex flex-wrap items-center gap-1.5 text-e11">
          <Tag tone="cyan">revenue {money(t.revenue)}</Tag>
          <Tag tone="lime">profit {money(t.profit)}</Tag>
          <Tag tone="rose">lost {money(t.wasteValue)}</Tag>
          <Tag tone="amber">bought {money(t.purchaseSpend)}</Tag>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-[#eef1ea] px-4 py-2.5">
        <Seg size="xs" label="Filter" value={filter} onChange={setFilter} options={chips} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] text-xs">
          <thead className="bg-[#f6f8f2]">
            <tr className="text-left text-e10 uppercase tracking-wider text-slate-500">
              <th className="px-4 py-2.5">Product</th>
              {["Opening", "Bought", "Lost", "Lost %", "Sellable", "Eff. cost", "Sold", "Avg price", "Suggested", "Profit", "Margin"].map((h) => <th key={h} className="px-2 py-2.5 text-right">{h}</th>)}
              <th className="px-4 py-2.5 text-right">Left</th>{manage && <th className="w-9" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const handled = r.opening + r.bought
              return (
                <tr key={r.productId} onClick={() => onPick(r)} className={cn("cursor-pointer border-t border-[#eef1ea] transition hover:bg-lime-50/60", r.productId === itemId && "bg-lime-50")}>
                  <td className="px-4 py-2 font-medium text-slate-800">{r.name}{hasGap(r) && <AlertTriangle className="ml-1.5 inline size-3 text-rose-500" aria-label="Stock records off" />}</td>
                  <td className={cn("num px-2 py-2 text-right", r.opening > 0 ? "text-amber-600" : "text-slate-300")}>{count(r.opening)}</td>
                  <td className="num px-2 py-2 text-right text-slate-700">{count(r.bought)}</td>
                  <td className={cn("num px-2 py-2 text-right", r.wasted > 0 ? "text-rose-600" : "text-slate-300")}>{count(r.wasted)}</td>
                  <td className={cn("num px-2 py-2 text-right font-semibold", r.wastePct != null && r.wastePct > r.targetWastePct ? "text-rose-600" : "text-slate-500")}>{pctText(r.wastePct, 1)}</td>
                  <td className="num px-2 py-2 text-right font-semibold text-lime-700">{count(Math.max(0, handled - r.wasted))}</td>
                  <td className="num px-2 py-2 text-right text-violet-700">{rate(r.price.effectiveCost)}</td>
                  <td className="num px-2 py-2 text-right text-slate-700">{count(r.sold)}</td>
                  <td className="num px-2 py-2 text-right text-slate-700">{r.price.average != null && r.sold > 0 ? rate(r.price.average) : "—"}</td>
                  <td className="num px-2 py-2 text-right text-slate-500">{r.price.suggested != null ? rate(r.price.suggested) : "—"}</td>
                  <td className={cn("num px-2 py-2 text-right font-bold", r.profit >= 0 ? "text-lime-700" : "text-rose-600")}>{money(r.profit)}</td>
                  <td className={cn("num px-2 py-2 text-right", r.marginPct == null ? "text-slate-300" : r.marginPct >= r.price.targetMarginPct ? "text-lime-700" : r.marginPct >= 0 ? "text-amber-600" : "text-rose-600")}>{r.sold > 0 ? pctText(r.marginPct, 1) : "—"}</td>
                  <td className="num px-4 py-2 text-right font-medium text-slate-600">{count(r.closing)}</td>
                  {manage && <td className="pr-2"><button type="button" aria-label={`Set targets for ${r.name}`} onClick={(e) => { e.stopPropagation(); onEdit(r) }} className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-lime-700" style={{ minHeight: 0 }}><Settings2 className="size-3.5" /></button></td>}
                </tr>
              )
            })}
            {rows.length === 0 && <tr><td colSpan={14} className="px-4 py-12 text-center text-slate-400">Nothing here for this filter.</td></tr>}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-40 animate-pulse rounded-2xl border border-[#e3e8dd] bg-[#f6f8f2]" />
      <div className="h-72 animate-pulse rounded-2xl border border-[#e3e8dd] bg-[#f6f8f2]" />
    </div>
  )
}
