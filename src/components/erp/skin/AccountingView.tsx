"use client"

/**
 * Accounting in the MandiMetrics reference layout ("Accounting & Treasury": KPI grid, tab bar, overview / entries / ledger / statements),
 * fed by GET /admin/erp/accounting/{summary,expenses,cash-entries,journal}. Same permissions and lock as before.
 */
import { useMemo, useState } from "react"
import type { ReactNode } from "react"
import {
  ArrowDownLeft, ArrowUpRight, Banknote, BookOpen, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, CircleDollarSign, Download,
  Landmark, Lock, Plus, ReceiptText, Search, ShieldCheck, TrendingDown, TrendingUp, Undo2, Wallet,
} from "lucide-react"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { useAccountingMutations, useAccountingSummary, useCashEntries, useExpenses, useJournal } from "@/hooks/useErp"
import type { AccountingSummary, Box, CashEntry, Expense, JournalType } from "@/types/erp.types"
import { istToday } from "@/components/business/business-helpers"
import { inr } from "../format"
import { AddCash } from "../accounting/CashTab"
import { JournalLedger, NewEntryForm, TrialBalanceCard } from "./AccountingJournal"
import { AddExpense, ReasonDialog } from "../accounting/ExpensesTab"
import { BOX_LABEL, CASH_META, EXPENSE_META, VIA_LABEL, metaFor, monthRange, shiftMonth } from "../accounting/meta"
import { cn } from "@/lib/utils"

const money = (n: number | null | undefined) => {
  const v = Number.isFinite(n as number) ? (n as number) : 0
  return `${v < 0 ? "-" : ""}₹${Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
}
const inputClass = "w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 text-e16 text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
const kfmt = (n: number) => (Math.abs(n) >= 1000 ? `${Math.round(n / 1000)}k` : String(Math.round(n)))

type Tab = "overview" | "entry" | "expenses" | "ledger" | "statements"
const TABS: Array<[Tab, string]> = [["overview", "Overview"], ["entry", "New entry"], ["expenses", "Expenses"], ["ledger", "Ledger"], ["statements", "Statements"]]

function Kpi({ title, value, note, icon }: { title: string; value: string; note: string; icon: ReactNode }) {
  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-500">{title}</span>
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">{icon}</span>
      </div>
      <p className="mt-3 break-words text-xl font-bold tracking-tight text-slate-900 sm:text-2xl tabular-nums">{value}</p>
      <p className="mt-1 text-e11 leading-relaxed text-slate-500">{note}</p>
    </article>
  )
}
function Empty({ children }: { children: ReactNode }) { return <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-xs text-slate-500">{children}</p> }
function Card({ children, className }: { children: ReactNode; className?: string }) { return <section className={cn("min-w-0 rounded-2xl border border-slate-200 bg-white p-3 sm:p-5", className)}>{children}</section> }

export function AccountingView({ manage }: { manage: boolean }) {
  const today = istToday()
  const thisMonth = today.slice(0, 7)
  const [month, setMonth] = useState(thisMonth)
  const [tab, setTab] = useState<Tab>("overview")
  const [addingExpense, setAddingExpense] = useState(false)
  const [addingCash, setAddingCash] = useState(false)
  const [entryType, setEntryType] = useState<JournalType>("EXPENSE")
  const [cashKind, setCashKind] = useState<"OPENING_BALANCE" | undefined>(undefined)
  const q = useAccountingSummary(month)
  const s = q.data
  const warnings = (s?.warnings ?? []).filter((w) => !w.startsWith("No opening"))
  const openEntry = (type: JournalType) => { setEntryType(type); setTab("entry") }
  const openCash = (kind?: "OPENING_BALANCE") => { setCashKind(kind); setAddingCash(true) }

  return (
    <div className="accounting-page min-w-0 space-y-5 animate-fade">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-1 text-e10 font-bold uppercase tracking-[.16em] text-emerald-700">Bakaloo · Finance &amp; Controls</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Accounting &amp; Treasury</h1>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">Is the business making money, and where is the money now? Sales, stock cost and spoilage come straight from orders and stock; running costs and the owner&apos;s cash and bank entries are typed here and stay auditable — nothing is deleted, only cancelled with a reason.</p>
        </div>
        {manage && (
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <button type="button" onClick={() => openCash()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"><Banknote className="size-4" />Cash &amp; bank entry</button>
            <button type="button" onClick={() => setAddingExpense(true)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"><Plus className="size-4" />Add expense</button>
            <button type="button" onClick={() => openEntry("EXPENSE")} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-semibold text-white"><ReceiptText className="size-4" />New journal entry</button>
          </div>
        )}
      </header>

      {s?.closed && <div className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900"><Lock className="size-3.5 shrink-0" />{s.label} is closed. Sales and stock are frozen; expenses and cash entries for it can’t be changed.</div>}
      {warnings.map((w) => <div key={w} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{w}</div>)}

      {q.isLoading && !s ? <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-slate-50" /> : q.isError || !s ? (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">Could not load the month. <button type="button" className="font-semibold underline" onClick={() => q.refetch()}>Try again</button></p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4">
            <Kpi title="Sales revenue" value={money(s.pnl.sales)} note="Item prices of delivered orders" icon={<TrendingUp className="size-4" />} />
            <Kpi title="Cost of goods" value={money(s.pnl.cogs)} note={`${s.pnl.grossMarginPct == null ? "—" : s.pnl.grossMarginPct.toFixed(1)}% of sales is left after goods`} icon={<BookOpen className="size-4" />} />
            <Kpi title="Operating expenses" value={money(s.pnl.expenses.total)} note={`Fixed ${money(s.pnl.expenses.fixed)} · variable ${money(s.pnl.expenses.variable)}`} icon={<ReceiptText className="size-4" />} />
            <Kpi title={s.pnl.netProfit < 0 ? "Net loss" : "Net profit"} value={money(s.pnl.netProfit)} note={`${s.pnl.netMarginPct == null ? "—" : s.pnl.netMarginPct.toFixed(1)}% of sales`} icon={<CircleDollarSign className="size-4" />} />
            <Kpi title="Wastage loss" value={money(s.pnl.wastage)} note="Spoiled or damaged stock at cost" icon={<TrendingDown className="size-4" />} />
            <Kpi title="Gross profit" value={money(s.pnl.gross)} note="Sales less cost of goods sold" icon={<Wallet className="size-4" />} />
            <Kpi title="Cash box" value={s.position.CASH.balance == null ? `${s.position.CASH.net >= 0 ? "+" : "−"}${money(Math.abs(s.position.CASH.net))}` : money(s.position.CASH.balance)} note={s.position.CASH.balance == null ? "Moved this month · set an opening balance" : `Balance on ${s.to}`} icon={<Banknote className="size-4" />} />
            <Kpi title="Bank & UPI" value={s.position.BANK.balance == null ? `${s.position.BANK.net >= 0 ? "+" : "−"}${money(Math.abs(s.position.BANK.net))}` : money(s.position.BANK.balance)} note={s.position.BANK.balance == null ? "Moved this month · set an opening balance" : `Balance on ${s.to}`} icon={<Landmark className="size-4" />} />
          </section>

          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white">
              <button type="button" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))} className="grid size-10 place-items-center text-slate-500 hover:text-slate-900"><ChevronLeft className="size-4" /></button>
              <span className="min-w-[140px] text-center text-sm font-semibold text-slate-800">{s.label}</span>
              <button type="button" aria-label="Next month" disabled={month >= thisMonth} onClick={() => setMonth(shiftMonth(month, 1))} className="grid size-10 place-items-center text-slate-500 hover:text-slate-900 disabled:opacity-40"><ChevronRight className="size-4" /></button>
            </div>
            <div className="text-xs text-slate-500">{s.inProgress ? "Month still running · " : ""}{s.counts.expenses} expenses · {s.counts.cashEntries} cash &amp; bank entries · {s.counts.codOrders} cash-on-delivery orders · {s.from} to {s.to}</div>
          </div>

          <nav role="tablist" aria-label="Accounting" className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1 sm:grid-cols-5">
            {TABS.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`min-h-11 rounded-xl px-3 py-2 text-sm font-semibold transition ${tab === id ? "bg-white text-emerald-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{label}</button>)}
          </nav>

          {tab === "overview" && <Overview s={s} month={month} manage={manage} onEntry={openEntry} onCash={openCash} />}
          {tab === "entry" && (manage
            ? <NewEntryForm key={entryType} today={today} initialType={entryType} onDone={() => setTab("ledger")} onCancel={() => setTab("overview")} />
            : <Card><Empty>You can read the books but not change them.</Empty></Card>)}
          {tab === "expenses" && <ExpensesList month={month} manage={manage} onAdd={() => setAddingExpense(true)} />}
          {tab === "ledger" && <LedgerTab month={month} manage={manage} />}
          {tab === "statements" && <Statements s={s} month={month} manage={manage} onCash={() => openCash()} />}

          <Card>
            <h2 className="mb-3 text-base font-bold">Good to know</h2>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {s.notes.map((x) => <div key={x} className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />{x}</div>)}
            </div>
          </Card>
        </>
      )}
      <AddExpense open={addingExpense} onClose={() => setAddingExpense(false)} defaultDate={today} />
      <AddCash open={addingCash} onClose={() => setAddingCash(false)} defaultDate={today} initialKind={cashKind} />
    </div>
  )
}

function Overview({ s, month, manage, onEntry, onCash }: { s: AccountingSummary; month: string; manage: boolean; onEntry: (t: JournalType) => void; onCash: (k?: "OPENING_BALANCE") => void }) {
  const jq = useJournal(month)
  const eq = useExpenses({ ...monthRange(month) })
  const trend = useMemo(() => {
    const m = new Map<string, { date: string; in: number; out: number }>()
    for (const r of jq.data?.rows ?? []) {
      if (/^Cash (put in the bank|taken from the bank)/.test(r.label)) continue // transfers between the two boxes are not new money
      const v = m.get(r.date) ?? { date: r.date.slice(5), in: 0, out: 0 }
      if (r.direction === "in") v.in += r.amount; else v.out += r.amount
      m.set(r.date, v)
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v)
  }, [jq.data])
  const cats = s.pnl.expenses.byCategory.map((c) => ({ name: metaFor(c.category, c.label).short, amount: c.amount }))
  const recent = (eq.data?.items ?? []).filter((e) => !e.voided).slice(0, 8)
  return (
    <div className="space-y-4">
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(342px,.65fr)]">
        <Card>
          <div className="mb-3 flex items-start justify-between gap-3"><div><h2 className="text-base font-bold">Money movement</h2><p className="text-xs text-slate-500">Money that came in and went out each day, across the cash box and the bank (moves between them left out)</p></div><CalendarDays className="size-4 shrink-0 text-slate-400" /></div>
          <div className="h-[291px] w-full min-w-0 sm:h-[354px]">
            {trend.length === 0 ? <p className="grid h-full place-items-center text-xs text-slate-400">Nothing moved this month.</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8eee5" />
                  <XAxis dataKey="date" tick={{ fontSize: 11.4 }} minTickGap={24} />
                  <YAxis tick={{ fontSize: 11.4 }} width={50} tickFormatter={kfmt} />
                  <Tooltip formatter={(v) => money(Number(v) || 0)} />
                  <Area type="monotone" dataKey="in" name="Came in" stroke="#059669" fill="#a7f3d0" fillOpacity={0.5} isAnimationActive={false} />
                  <Area type="monotone" dataKey="out" name="Went out" stroke="#d97706" fill="#fde68a" fillOpacity={0.45} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
        <Card>
          <h2 className="mb-1 text-base font-bold">Account balance snapshot</h2>
          <p className="mb-3 text-xs text-slate-500">Where the money is on {s.to}; reconcile to the bank statement and the counted cash box.</p>
          <div className="space-y-2">
            {(["CASH", "BANK"] as Box[]).map((box) => {
              const p = s.position[box]; const bal = p.balance ?? p.net
              return (
                <div key={box} className="space-y-1">
                  <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2"><span className="min-w-0 truncate text-xs font-medium text-slate-600">{BOX_LABEL[box]}{p.balance == null && " (moved this month)"}</span><span className={`shrink-0 text-xs font-bold tabular-nums ${bal < 0 ? "text-rose-600" : "text-slate-900"}`}>{money(bal)}</span></div>
                  <div className="flex justify-between px-3 text-e11 text-slate-500"><span className="inline-flex items-center gap-1"><ArrowDownLeft className="size-3 text-emerald-600" />came in {money(p.totalIn)}</span><span className="inline-flex items-center gap-1"><ArrowUpRight className="size-3 text-rose-600" />went out {money(p.totalOut)}</span></div>
                </div>
              )
            })}
          </div>
          {manage && (s.position.CASH.balance == null || s.position.BANK.balance == null) && <button type="button" onClick={() => onCash("OPENING_BALANCE")} className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:border-emerald-300">Set opening balance</button>}
          <p className="mt-3 rounded-lg bg-amber-50 p-2 text-e11 leading-relaxed text-amber-800">Balances count from the opening balance you set. Without one, only this month&apos;s movement is shown.</p>
        </Card>
      </div>

      <Card>
        <div className="mb-4"><h2 className="text-base font-bold">Where the running costs go</h2><p className="text-xs text-slate-500">Expenses entered for {s.label}, by type</p></div>
        <div className="h-[286px] w-full min-w-0 sm:h-[343px]">
          {cats.length === 0 ? <p className="grid h-full place-items-center text-xs text-slate-400">No expenses entered for this month yet.</p> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cats} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8eee5" />
                <XAxis dataKey="name" tick={{ fontSize: 11.4 }} minTickGap={12} />
                <YAxis tick={{ fontSize: 11.4 }} width={52} tickFormatter={kfmt} />
                <Tooltip formatter={(v) => money(Number(v) || 0)} />
                <Bar dataKey="amount" name="Spent" fill="#f59e0b" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-base font-bold">Expense register</h2>
          <div className="space-y-2">
            {recent.map((e) => (
              <div key={e.id} className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                <div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-700">{e.categoryLabel}{e.party ? ` · ${e.party.replace(/^DM-/, "")}` : ""}</p><p className="text-e10 text-slate-400">{e.date} · {VIA_LABEL[e.paidVia]} · {e.kind === "FIXED" ? "fixed" : "varies"}</p></div>
                <strong className="shrink-0 text-xs">{money(e.amount)}</strong>
              </div>
            ))}
            {recent.length === 0 && <Empty>No expenses for this month.</Empty>}
          </div>
        </Card>
        <Card>
          <h2 className="mb-3 text-base font-bold">Quick actions</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {manage ? ([
              ["Record petty cash / expense", "EXPENSE"], ["Cash ↔ bank contra", "CONTRA"], ["Promoter capital", "PROMOTER_CONTRIBUTION"], ["Promoter withdrawal", "PROMOTER_WITHDRAWAL"],
            ] as Array<[string, JournalType]>).map(([label, kind]) => <button key={label} type="button" onClick={() => onEntry(kind)} className="flex min-h-12 items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-3 text-left text-xs font-semibold text-slate-700 hover:border-emerald-300"><span>{label}</span><Plus className="size-4 shrink-0 text-emerald-700" /></button>) : <Empty>You can read the books but not change them.</Empty>}
          </div>
        </Card>
      </div>
    </div>
  )
}

function ExpensesList({ month, manage, onAdd }: { month: string; manage: boolean; onAdd: () => void }) {
  const [showVoided, setShowVoided] = useState(false)
  const [query, setQuery] = useState("")
  const [voiding, setVoiding] = useState<Expense | null>(null)
  const { voidExpense } = useAccountingMutations()
  const q = useExpenses({ ...monthRange(month), includeVoided: showVoided })
  const rows = (q.data?.items ?? []).filter((e) => !query || `${e.categoryLabel} ${e.party ?? ""} ${e.note ?? ""} ${e.shop ?? ""}`.toLowerCase().includes(query.toLowerCase()))
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="grid grid-cols-1 gap-2 border-b border-slate-100 p-3 sm:grid-cols-2 xl:grid-cols-4 sm:p-4">
        <label className="relative xl:col-span-2"><Search className="absolute left-3 top-4 size-4 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} className={`${inputClass} pl-9`} placeholder="Search running costs..." /></label>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs text-slate-600"><input type="checkbox" checked={showVoided} onChange={(e) => setShowVoided(e.target.checked)} />Show cancelled</label>
        {manage && <button type="button" onClick={onAdd} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white"><Plus className="size-4" />Add expense</button>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-xs">
          <thead className="bg-slate-50 text-e10 uppercase tracking-wider text-slate-500"><tr>{["Date", "Particulars", "Type", "Paid via", "Store", "Amount", ""].map((x) => <th key={x} className="whitespace-nowrap px-3 py-3">{x}</th>)}</tr></thead>
          <tbody>
            {rows.map((e) => { const m = EXPENSE_META[e.category]; return (
              <tr key={e.id} className={cn("border-t border-slate-100", e.voided && "opacity-60")}>
                <td className="whitespace-nowrap px-3 py-3">{e.date}</td>
                <td className="max-w-[300px] px-3 py-3"><p className={cn("flex items-center gap-2 truncate font-semibold text-slate-800", e.voided && "line-through")}><span className="grid size-6 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><m.icon className="size-3.5" /></span>{e.categoryLabel}{e.party ? ` · ${e.party.replace(/^DM-/, "")}` : ""}</p>{(e.note || e.voided) && <p className="text-e10 text-slate-400">{e.voided ? `cancelled: ${e.voidReason}` : e.note}</p>}</td>
                <td className="px-3 py-3">{e.kind === "FIXED" ? "Fixed" : "Varies"}</td>
                <td className="px-3 py-3">{VIA_LABEL[e.paidVia]}</td>
                <td className="px-3 py-3">{e.shop ?? "Whole business"}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right font-bold tabular-nums">{money(e.amount)}</td>
                <td className="px-3 py-3 text-right">{manage && !e.voided && <button type="button" aria-label="Cancel this expense" onClick={() => setVoiding(e)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600" style={{ minHeight: 0 }}><Undo2 className="size-4" /></button>}</td>
              </tr>
            ) })}
          </tbody>
        </table>
        {!q.isLoading && rows.length === 0 && <div className="p-3"><Empty>No expenses for this month.{manage ? " Tap “Add expense” to record rent, salaries, power and the rest." : ""}</Empty></div>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 p-3"><span className="text-xs text-slate-500">{rows.length} rows · Amount total {money(rows.filter((e) => !e.voided).reduce((a, r) => a + r.amount, 0))}</span></div>
      <ReasonDialog open={Boolean(voiding)} title={`Cancel ${voiding ? inr(voiding.amount, false) : ""} ${voiding?.categoryLabel ?? ""}?`} confirm="Cancel expense" busy={voidExpense.isPending} onClose={() => setVoiding(null)}
        onSubmit={(reason) => voiding && voidExpense.mutate({ id: voiding.id, reason }, { onSuccess: () => setVoiding(null) })} />
    </section>
  )
}

const csvCell = (v: string | number | null) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }

function LedgerTab({ month, manage }: { month: string; manage: boolean }) {
  const [view, setView] = useState<"journal" | "money">("journal")
  return (
    <div className="space-y-3">
      <div className="inline-flex gap-1 rounded-xl bg-slate-100 p-1">
        {([["journal", "Journal entries"], ["money", "Cash & bank log"]] as const).map(([id, label]) => <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${view === id ? "bg-white text-emerald-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{label}</button>)}
      </div>
      {view === "journal" ? <JournalLedger month={month} manage={manage} /> : <MoneyLog month={month} />}
    </div>
  )
}

function MoneyLog({ month }: { month: string }) {
  const q = useJournal(month)
  const j = q.data
  const [query, setQuery] = useState("")
  const [box, setBox] = useState<"all" | Box>("all")
  const [dir, setDir] = useState<"all" | "in" | "out">("all")
  const rows = (j?.rows ?? []).filter((r) => (box === "all" || r.account === box) && (dir === "all" || r.direction === dir) && (!query || `${r.date} ${r.label} ${r.party ?? ""}`.toLowerCase().includes(query.toLowerCase())))
  const download = () => {
    if (!j) return
    const head = ["Date", "Box", "Direction", "What", "Who", "Amount", "Source"]
    const body = j.rows.map((r) => [r.date, BOX_LABEL[r.account], r.direction === "in" ? "In" : "Out", r.label, r.party, r.amount, r.source])
    const blob = new Blob([[head, ...body].map((r) => r.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" })
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `money-log-${j.month}.csv`; a.click(); URL.revokeObjectURL(a.href)
  }
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="grid grid-cols-1 gap-2 border-b border-slate-100 p-3 sm:grid-cols-2 xl:grid-cols-4 sm:p-4">
        <label className="relative"><Search className="absolute left-3 top-4 size-4 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} className={`${inputClass} pl-9`} placeholder="Search ledger..." /></label>
        <select aria-label="Box" className={inputClass} value={box} onChange={(e) => setBox(e.target.value as "all" | Box)}><option value="all">Cash box + bank</option><option value="CASH">{BOX_LABEL.CASH}</option><option value="BANK">{BOX_LABEL.BANK}</option></select>
        <select aria-label="Direction" className={inputClass} value={dir} onChange={(e) => setDir(e.target.value as "all" | "in" | "out")}><option value="all">In and out</option><option value="in">Money in</option><option value="out">Money out</option></select>
        <button type="button" onClick={download} disabled={!j?.rows.length} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-xs font-semibold text-slate-700 disabled:opacity-50"><Download className="size-4" />Download CSV</button>
      </div>
      <div className="max-h-[640px] overflow-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-xs">
          <thead className="sticky top-0 bg-slate-50 text-e10 uppercase tracking-wider text-slate-500"><tr>{["Date", "Box", "Particulars", "Source", "In", "Out"].map((x, i) => <th key={x} className={cn("whitespace-nowrap px-3 py-3", i > 3 && "text-right")}>{x}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="whitespace-nowrap px-3 py-3">{r.date}</td>
                <td className="px-3 py-3">{BOX_LABEL[r.account]}</td>
                <td className="max-w-[320px] px-3 py-3"><p className="truncate font-semibold text-slate-800">{r.label}</p>{r.party && <p className="text-e10 text-slate-400">{r.party.replace(/^DM-/, "")}</p>}</td>
                <td className="px-3 py-3 text-slate-500">{r.source}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right font-bold tabular-nums text-emerald-700">{r.direction === "in" ? money(r.amount) : ""}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right font-bold tabular-nums text-rose-600">{r.direction === "out" ? money(r.amount) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!q.isLoading && rows.length === 0 && <div className="p-3"><Empty>No ledger lines match the filters.</Empty></div>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 p-3"><span className="text-xs text-slate-500">{rows.length} rows · in {money(rows.filter((r) => r.direction === "in").reduce((a, r) => a + r.amount, 0))} · out {money(rows.filter((r) => r.direction === "out").reduce((a, r) => a + r.amount, 0))}</span></div>
    </section>
  )
}

function Statements({ s, month, manage, onCash }: { s: AccountingSummary; month: string; manage: boolean; onCash: () => void }) {
  const p = s.pnl
  const [voiding, setVoiding] = useState<CashEntry | null>(null)
  const { voidCash } = useAccountingMutations()
  const cq = useCashEntries({ ...monthRange(month), includeVoided: true })
  const lines: Array<[string, number, "head" | "line" | "total"]> = [
    ["Sales (item prices, delivered orders)", p.sales, "line"],
    ["Less: cost of the goods sold", -p.cogs, "line"],
    ["Gross profit", p.gross, "total"],
    ["Less: stock thrown away or damaged", -p.wastage, "line"],
    ["Profit after wastage", p.afterWastage, "total"],
    ["Less: sales returns (journal)", -p.returns, "line"],
    ["Less: running costs — fixed", -p.expenses.fixed, "line"],
    ["Less: running costs — varies with sales", -p.expenses.variable, "line"],
    ["Operating profit", p.operatingProfit, "total"],
    ["Add: other income", p.otherIncome, "line"],
    [p.netProfit < 0 ? "Loss for the month" : "Profit for the month", p.netProfit, "total"],
  ].filter(([label, v]) => v !== 0 || label !== "Less: sales returns (journal)") as Array<[string, number, "head" | "line" | "total"]>
  const coverPct = p.breakEvenSales && p.breakEvenSales > 0 ? Math.min(150, (p.sales / p.breakEvenSales) * 100) : null
  return (
    <div className="space-y-4">
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-base font-bold">Profit &amp; loss · {s.label}</h2>
          <p className="mb-3 text-xs text-slate-500">{s.inProgress ? "The month is still running. " : ""}Sales and stock figures come from delivered orders and stock records; running costs are the expenses and journal entries entered here.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px] text-left text-xs">
              <thead><tr className="border-b text-slate-500"><th className="py-2">Line</th><th className="py-2 text-right">Amount</th></tr></thead>
              <tbody>{lines.map(([label, v, kind]) => <tr key={label} className={cn("border-b border-slate-100", kind === "total" && "font-bold")}><td className="py-2">{label}</td><td className={cn("py-2 text-right tabular-nums", v < 0 && kind !== "line" && "text-rose-600")}>{v < 0 ? `−${money(-v)}` : money(v)}</td></tr>)}</tbody>
            </table>
          </div>
          {coverPct != null && (
            <p className={cn("mt-3 rounded-lg p-2 text-e11 leading-relaxed", coverPct >= 100 ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800")}>Break-even: you need <b>{money(p.breakEvenSales)}</b> of sales to cover running costs; you sold <b>{money(p.sales)}</b> ({Math.round(coverPct)}% of what is needed).</p>
          )}
        </Card>
        <Card>
          <div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-base font-bold">Owner&apos;s cash &amp; bank log</h2>{manage && <button type="button" onClick={onCash} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-emerald-300" style={{ minHeight: 0 }}><Plus className="size-3.5 text-emerald-700" />Add entry</button>}</div>
          <div className="space-y-2">
            {(cq.data?.items ?? []).map((e) => { const m = CASH_META[e.kind]; return (
              <div key={e.id} className={cn("flex items-start justify-between gap-2 rounded-xl border border-slate-100 p-3", e.voided && "opacity-60")}>
                <div className="min-w-0"><p className={cn("break-words text-xs font-bold", e.voided && "line-through")}>{e.kindLabel}{e.account ? ` · ${BOX_LABEL[e.account]}` : ""}</p><p className="text-e10 text-slate-500">{e.date}{e.note ? ` · ${e.note.replace(/^DM-/, "")}` : ""}{e.voided ? ` · cancelled: ${e.voidReason}` : ""}</p></div>
                <div className="text-right"><strong className={cn("text-xs", m.sign === "−" && "text-rose-600", m.sign === "+" && "text-emerald-700")}>{m.sign === "↔" || m.sign === "•" ? "" : m.sign}{money(e.amount)}</strong>
                  {manage && !e.voided && <button type="button" onClick={() => setVoiding(e)} className="mt-1 flex items-center gap-1 text-e10 font-semibold text-rose-600" style={{ minHeight: 0 }}><Undo2 className="size-3" />Cancel</button>}</div>
              </div>
            ) })}
            {!cq.isLoading && !(cq.data?.items.length) && <Empty>No entries this month. Add an opening balance for the cash box and the bank to see balances.</Empty>}
          </div>
        </Card>
      </div>
      <TrialBalanceCard month={month} />
      <Card>
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold"><ShieldCheck className="size-4 text-emerald-700" />Cash &amp; bank this month</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["CASH", "BANK"] as Box[]).map((box) => { const b = s.position[box]; return (
            <div key={box} className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-bold text-slate-700">{BOX_LABEL[box]}</p>
              <p className="mt-1 text-e11 text-slate-500">Came in {money(b.totalIn)} · went out {money(b.totalOut)} · net {b.net >= 0 ? "+" : "−"}{money(Math.abs(b.net))}</p>
              <ul className="mt-2 space-y-1 text-e11 text-slate-600">{[...b.in.map((l) => ({ ...l, s: "+" })), ...b.out.map((l) => ({ ...l, s: "−" }))].map((l) => <li key={`${l.s}${l.label}`} className="flex justify-between gap-3"><span>{l.label}</span><span className={cn("tabular-nums", l.s === "+" ? "text-emerald-700" : "text-rose-600")}>{l.s}{money(l.amount)}</span></li>)}</ul>
            </div>
          ) })}
        </div>
      </Card>
      <ReasonDialog open={Boolean(voiding)} title={`Cancel this ${voiding?.kindLabel.toLowerCase() ?? "entry"}?`} confirm="Cancel entry" busy={voidCash.isPending} onClose={() => setVoiding(null)}
        onSubmit={(reason) => voiding && voidCash.mutate({ id: voiding.id, reason }, { onSuccess: () => setVoiding(null) })} />
    </div>
  )
}
