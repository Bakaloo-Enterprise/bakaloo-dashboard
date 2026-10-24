"use client"

import { IndianRupee, PiggyBank, Receipt, TrendingDown, TrendingUp } from "lucide-react"
import type { AccountingSummary } from "@/types/erp.types"
import { inr, pctText } from "../format"
import { Bar, Help, Panel, Tile } from "../kit"
import { EXPENSE_META } from "./meta"
import { cn } from "@/lib/utils"

function Step({ label, value, sign, strong = false, sub, help }: { label: string; value: number; sign?: "+" | "−" | "="; strong?: boolean; sub?: string; help?: string }) {
  return (
    <li className={cn("flex items-center gap-3 py-2.5", strong && "rounded-xl bg-muted/50 px-3")}>
      <span className="w-5 text-center text-lg font-semibold text-muted-foreground" aria-hidden>{sign ?? ""}</span>
      <div className="min-w-0 flex-1"><p className={cn("flex items-center gap-1.5 text-sm", strong ? "font-semibold" : "font-medium")}>{label}{help && <Help text={help} />}</p>{sub && <p className="text-xs text-muted-foreground">{sub}</p>}</div>
      <p className={cn("tabular-nums", strong ? "text-lg font-bold" : "text-sm font-semibold", value < 0 && "text-rose-600 dark:text-rose-400")}>{inr(value, false)}</p>
    </li>
  )
}

export function PnlPanel({ s }: { s: AccountingSummary }) {
  const p = s.pnl
  const coverPct = p.breakEvenSales && p.breakEvenSales > 0 ? Math.min(150, (p.sales / p.breakEvenSales) * 100) : null
  const maxCat = Math.max(1, ...p.expenses.byCategory.map((c) => c.amount))
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Tile tone="green" icon={<IndianRupee className="h-5 w-5" />} label="Sold" value={inr(p.sales)} sub="item prices, delivered orders" help="Item prices of everything delivered, before coupons and fees. Straight from the stock records." />
        <Tile tone="blue" icon={<Receipt className="h-5 w-5" />} label="Left after goods" value={inr(p.gross)} sub={`${pctText(p.grossMarginPct, 1)} of sales`} help="Sales minus what the goods cost us." />
        <Tile tone="amber" icon={<TrendingDown className="h-5 w-5" />} label="Running costs" value={inr(p.expenses.total)} sub={`${inr(p.expenses.fixed)} fixed · ${inr(p.expenses.variable)} varies`} />
        <Tile big tone={p.netProfit < 0 ? "rose" : "green"} icon={p.netProfit < 0 ? <TrendingDown className="h-5 w-5" /> : <PiggyBank className="h-5 w-5" />} label={p.netProfit < 0 ? "Loss" : "Profit"} value={inr(p.netProfit)} sub={`${pctText(p.netMarginPct, 1)} of sales`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <Panel title="From sales to profit" hint={s.inProgress ? "The month is still running" : s.label} className="lg:col-span-3">
          <ul className="divide-y">
            <Step label="Sales" value={p.sales} />
            <Step label="Cost of the goods sold" value={p.cogs} sign="−" />
            <Step label="Left after goods" value={p.gross} sign="=" strong sub={`${pctText(p.grossMarginPct, 1)} margin`} />
            <Step label="Stock thrown away or damaged" value={p.wastage} sign="−" help="Spoiled, damaged or written-off stock valued at cost (including damage found when purchases arrived)." />
            <Step label="Running costs" value={p.expenses.total} sign="−" sub="rent, salaries, power, riders, ads … as entered under Expenses" />
            <Step label="Operating profit" value={p.operatingProfit} sign="=" strong />
            <Step label="Other income" value={p.otherIncome} sign="+" sub="money that is not a sale" />
            <Step label={p.netProfit < 0 ? "Loss for the month" : "Profit for the month"} value={p.netProfit} sign="=" strong />
          </ul>
        </Panel>
        <div className="space-y-4 lg:col-span-2">
          <Panel title="Where the running costs go" hint={p.expenses.byCategory.length ? undefined : "No expenses entered for this month yet."}>
            <ul className="space-y-3">
              {p.expenses.byCategory.map((c) => {
                const m = EXPENSE_META[c.category]
                return (
                  <li key={c.category}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-sm"><span className="flex items-center gap-2 font-medium"><m.icon className="h-4 w-4 text-muted-foreground" aria-hidden />{c.label}<span className="text-[10px] uppercase tracking-wide text-muted-foreground">{c.kind === "FIXED" ? "fixed" : "varies"}</span></span><b className="tabular-nums">{inr(c.amount)}</b></div>
                    <Bar pct={(c.amount / maxCat) * 100} tone={m.tone} className="h-1.5" />
                  </li>
                )
              })}
            </ul>
          </Panel>
          {coverPct != null && (
            <Panel title="Do sales cover the costs?" help="Sales needed for what is left after goods and spoilage to pay all running costs: running costs ÷ (share of each sale left after goods and wastage).">
              <p className="text-sm">You need <b>{inr(p.breakEvenSales)}</b> of sales to cover running costs. You sold <b>{inr(p.sales)}</b>.</p>
              <div className="mt-3"><Bar pct={Math.min(100, coverPct)} tone={coverPct >= 100 ? "green" : "rose"} /></div>
              <p className={cn("mt-1.5 flex items-center gap-1 text-xs font-medium", coverPct >= 100 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>{coverPct >= 100 ? <TrendingUp className="h-3.5 w-3.5" aria-hidden /> : <TrendingDown className="h-3.5 w-3.5" aria-hidden />}{Math.round(coverPct)}% of what is needed</p>
            </Panel>
          )}
        </div>
      </div>
    </div>
  )
}
