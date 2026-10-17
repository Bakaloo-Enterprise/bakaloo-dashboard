"use client"

import { useState } from "react"
import { AlertTriangle, Banknote, Boxes, CheckCircle2, ChevronLeft, ChevronRight, Clock, FileSpreadsheet, HandCoins, Info, Loader2, ShoppingCart, Trash2, TrendingDown, TrendingUp, Undo2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useMonthly } from "@/hooks/useBusiness"
import { bizError } from "@/hooks/useBusiness"
import { downloadMonthly } from "@/services/business.service"
import { cn } from "@/lib/utils"
import { formatRupees, istToday } from "./business-helpers"
import { MonthClosingCard } from "./MonthClosingCard"

const shiftMonth = (m: string, n: number) => {
  const [y, mo] = m.split("-").map(Number)
  const d = new Date(Date.UTC(y, mo - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

function Tile({ icon: Icon, label, value, tone, children }: { icon: typeof Banknote; label: string; value: number; tone: string; children?: React.ReactNode }) {
  return (
    <div className={cn("rounded-2xl border-2 p-3", tone)}>
      <div className="flex items-center gap-2"><Icon className="h-6 w-6 shrink-0" aria-hidden /><span className="text-sm font-bold">{label}</span></div>
      <p className="mt-1 text-2xl font-extrabold tabular-nums">{formatRupees(value)}</p>
      {children && <div className="mt-1 space-y-0.5 text-xs">{children}</div>}
    </div>
  )
}

const LEVEL = { bad: { icon: AlertTriangle, tone: "border-red-300 bg-red-50 text-red-900" }, warn: { icon: AlertTriangle, tone: "border-amber-300 bg-amber-50 text-amber-900" }, info: { icon: Info, tone: "border-sky-300 bg-sky-50 text-sky-900" } } as const

/** The month at a glance, and the Excel file for the accountant. Same numbers in both. */
export function MonthlyReport() {
  const current = istToday().slice(0, 7)
  const [month, setMonth] = useState(current)
  const [busy, setBusy] = useState(false)
  const r = useMonthly(month)
  const d = r.data
  const s = d?.summary
  const download = async () => {
    setBusy(true)
    try { await downloadMonthly(month) } catch (e) { toast.error(bizError(e)) } finally { setBusy(false) }
  }
  const maxAge = Math.max(1, ...(d?.agingTotals ?? []).map((a) => a.amount))
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" className="h-12 w-12 rounded-full" onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label="Month before"><ChevronLeft className="h-6 w-6" /></Button>
          <p className="min-w-44 text-center text-xl font-extrabold" aria-live="polite">{d?.window.label ?? month}</p>
          <Button type="button" variant="outline" size="icon" className="h-12 w-12 rounded-full" disabled={month >= current} onClick={() => setMonth((m) => shiftMonth(m, 1))} aria-label="Month after"><ChevronRight className="h-6 w-6" /></Button>
        </div>
        <Button type="button" className="ml-auto h-14 bg-green-600 px-6 text-lg font-bold hover:bg-green-700" disabled={busy || !d} onClick={download}>
          {busy ? <Loader2 className="mr-2 h-6 w-6 animate-spin" aria-hidden /> : <FileSpreadsheet className="mr-2 h-6 w-6" aria-hidden />}Download Excel
        </Button>
      </div>
      {d?.window.inProgress && <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900"><Clock className="h-4 w-4" aria-hidden />This month is still running. Numbers are up to today.</p>}

      {r.isLoading || !s || !d ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div> : r.isError ? <p role="alert" className="text-sm text-red-600">Could not load the report.</p> : (
        <>
          <MonthClosingCard report={d} />

          <section aria-label="Profit" className={cn("rounded-2xl border-2 p-4", s.profit.gross >= 0 ? "border-green-400 bg-green-50 text-green-900" : "border-red-400 bg-red-50 text-red-900")}>
            <div className="flex items-center gap-2">{s.profit.gross >= 0 ? <TrendingUp className="h-7 w-7" aria-hidden /> : <TrendingDown className="h-7 w-7" aria-hidden />}<span className="text-base font-bold">Profit on what we sold</span></div>
            <p className="mt-1 text-3xl font-extrabold tabular-nums">{formatRupees(s.profit.gross)}{s.profit.marginPct !== null && <span className="ml-2 text-lg font-bold">{s.profit.marginPct}%</span>}</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
              <div><dt className="text-xs">Sold for</dt><dd className="font-bold tabular-nums">{formatRupees(s.profit.sales)}</dd></div>
              <div><dt className="text-xs">It cost us</dt><dd className="font-bold tabular-nums">{formatRupees(s.profit.cogs)}</dd></div>
              <div><dt className="text-xs">Thrown away / lost</dt><dd className="font-bold tabular-nums">−{formatRupees(s.profit.loss)}</dd></div>
              <div><dt className="text-xs">Left after losses</dt><dd className="font-bold tabular-nums">{formatRupees(s.profit.afterLoss)}</dd></div>
            </dl>
            <ul className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
              {(["B2C", "B2B"] as const).map((k) => <li key={k} className="rounded-full bg-white px-3 py-1">{k === "B2C" ? "Home customers" : "Businesses"}: {formatRupees(s.profit.channel[k].gross)}{s.profit.channel[k].marginPct !== null ? ` (${s.profit.channel[k].marginPct}%)` : ""}</li>)}
            </ul>
            {d.topProducts.length > 0 && (
              <ul className="mt-3 space-y-1" aria-label="Best selling products">
                {d.topProducts.map((p) => <li key={p.name} className="flex items-center gap-2 text-sm"><span className="min-w-0 flex-1 truncate font-medium">{p.name}</span><span className="tabular-nums">{formatRupees(p.sales)}</span><span className={cn("w-14 text-right text-xs font-bold", (p.marginPct ?? 0) < 0 ? "text-red-700" : "")}>{p.marginPct === null ? "—" : `${p.marginPct}%`}</span></li>)}
              </ul>
            )}
            <p className="mt-2 text-xs">Before delivery cost, store commission, payment fees, GST and running costs — those are not recorded here.{s.profit.unpricedSupplyUnits > 0 ? ` ${s.profit.unpricedSupplyUnits} units went to businesses with no price agreed.` : ""}</p>
          </section>

          <section aria-label="Stock value" className="rounded-2xl border-2 border-violet-300 bg-violet-50 p-4 text-violet-900">
            <div className="flex items-center gap-2"><Boxes className="h-7 w-7" aria-hidden /><span className="text-base font-bold">Stock we are holding (at cost)</span>
              {s.stock.basis === "ESTIMATED" && <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-bold text-amber-900">Opening is estimated</span>}</div>
            <p className="mt-1 text-3xl font-extrabold tabular-nums">{formatRupees(s.stock.totalClosing)}</p>
            <ul className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
              <li className="rounded-full bg-white px-3 py-1">On shelves {formatRupees(s.stock.closingValue)}</li>
              <li className="rounded-full bg-white px-3 py-1">In the warehouse {formatRupees(s.stock.warehouseClosing)}</li>
              <li className="rounded-full bg-white px-3 py-1">At the start {formatRupees(s.stock.totalOpening)}</li>
            </ul>
            {Math.abs(s.stock.rollForward.difference) > 1 && <p role="alert" className="mt-2 text-sm font-bold text-red-700">The stock value does not add up (off by {formatRupees(s.stock.rollForward.difference)}).</p>}
          </section>

          <div className="rounded-2xl border-2 border-green-400 bg-green-50 p-4 text-green-900">
            <div className="flex items-center gap-2"><Banknote className="h-7 w-7" aria-hidden /><span className="text-base font-bold">All money really received</span></div>
            <p className="mt-1 text-3xl font-extrabold tabular-nums">{formatRupees(s.moneyIn.total)}</p>
            <ul className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
              <li className="rounded-full bg-white px-3 py-1">B2B customers {formatRupees(s.moneyIn.b2b)}</li>
              <li className="rounded-full bg-white px-3 py-1">Cash on delivery {formatRupees(s.moneyIn.cod)} ({s.moneyIn.codOrders})</li>
              <li className="rounded-full bg-white px-3 py-1">Online {formatRupees(s.moneyIn.gateway)} ({s.moneyIn.gatewayPayments})</li>
            </ul>
            <p className="mt-2 text-xs">Only money that changed hands. Credit orders count when they are paid, not when they are placed.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Tile icon={ShoppingCart} label="We bought" value={s.purchases.value} tone="border-sky-300 bg-sky-50 text-sky-900">
              <p>{s.purchases.count} {s.purchases.count === 1 ? "purchase" : "purchases"}{s.purchases.onTheWay > 0 ? ` · ${s.purchases.onTheWay} on the way` : ""}</p>
            </Tile>
            <Tile icon={HandCoins} label="We owe suppliers" value={s.suppliers.closing} tone={s.suppliers.overdue > 0 ? "border-red-300 bg-red-50 text-red-900" : "border-amber-300 bg-amber-50 text-amber-900"}>
              <p>Paid this month: <strong>{formatRupees(s.suppliers.paid)}</strong></p>
              {s.suppliers.overdue > 0 && <p className="font-bold">{formatRupees(s.suppliers.overdue)} is late</p>}
            </Tile>
            <Tile icon={Trash2} label="Lost (thrown away)" value={s.loss.wastage} tone="border-red-300 bg-red-50 text-red-900">
              <p>{s.loss.units} units</p>
              <p className="flex items-center gap-1"><Undo2 className="h-3 w-3" aria-hidden />Got back from suppliers: <strong>{formatRupees(s.loss.recovered)}</strong></p>
            </Tile>
            <Tile icon={Banknote} label="Customers paid us" value={s.b2b.collected} tone="border-green-300 bg-green-50 text-green-900">
              <p>Cash {formatRupees(s.b2b.cash)} · UPI {formatRupees(s.b2b.upi)}{s.b2b.razorpay + s.b2b.other > 0 ? ` · Other ${formatRupees(s.b2b.razorpay + s.b2b.other)}` : ""}</p>
              <p>Billed: {formatRupees(s.b2b.billed)}</p>
            </Tile>
            <Tile icon={Clock} label="Customers owe us" value={s.b2b.outstanding} tone={s.b2b.overdue > 0 ? "border-red-300 bg-red-50 text-red-900" : "border-amber-300 bg-amber-50 text-amber-900"}>
              {s.b2b.overdue > 0 && <p className="font-bold">{formatRupees(s.b2b.overdue)} is late</p>}
            </Tile>
          </div>

          {d.agingTotals.some((a) => a.orders > 0) && (
            <section aria-label="How late customers are" className="rounded-2xl border-2 p-3">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">Customers who owe — how late</h3>
              <ul className="space-y-1.5">
                {d.agingTotals.map((a, i) => (
                  <li key={a.bucket} className="flex items-center gap-2 text-sm">
                    <span className="w-36 shrink-0 font-medium">{a.bucket}</span>
                    <span className="h-4 flex-1 overflow-hidden rounded-full bg-muted"><span className={cn("block h-full", i === 0 ? "bg-green-500" : i === 1 ? "bg-amber-400" : i === 2 ? "bg-orange-500" : "bg-red-600")} style={{ width: `${(a.amount / maxAge) * 100}%` }} /></span>
                    <span className="w-28 shrink-0 text-right font-bold tabular-nums">{formatRupees(a.amount)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-label="Needs attention">
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">Look at before closing the month</h3>
            {d.exceptions.length === 0 ? (
              <p className="flex items-center gap-2 rounded-2xl border-2 border-green-300 bg-green-50 p-4 font-bold text-green-800"><CheckCircle2 className="h-7 w-7" aria-hidden />All checks passed.</p>
            ) : (
              <ul className="space-y-2">{d.exceptions.map((e) => { const l = LEVEL[e.level]; return <li key={e.code} className={cn("flex items-center gap-3 rounded-xl border-2 p-3 text-sm font-semibold", l.tone)}><l.icon className="h-6 w-6 shrink-0" aria-hidden />{e.text}</li> })}</ul>
            )}
          </section>
          <p className="text-xs text-muted-foreground">The Excel file has every row behind these numbers: profit and margin by product and store, stock value, purchases, supplier accounts, payments, wastage, B2B billed, collections and who owes us.</p>
          <details className="text-xs text-muted-foreground"><summary className="cursor-pointer select-none">How are these numbers worked out?</summary>
            <dl className="mt-2 space-y-1.5">{d.definitions.map((x) => <div key={x.term}><dt className="font-bold text-foreground">{x.term}</dt><dd>{x.text}</dd></div>)}</dl>
          </details>
        </>
      )}
    </div>
  )
}
