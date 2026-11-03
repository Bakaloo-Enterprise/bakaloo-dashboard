"use client"

/**
 * The double-entry journal, copied from the MandiMetrics Accounting screen: the "Post a balanced journal entry" form,
 * the ledger with its search / type / department / store filters, and the trial balance. All lists (types, accounts,
 * departments, categories) come from GET /accounting/journal-options, so the screen never keeps its own copy.
 */
import { useMemo, useState } from "react"
import type { ReactNode } from "react"
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Download, ReceiptText, Search, ShieldCheck, Undo2 } from "lucide-react"
import { toast } from "sonner"
import { useAccountingMutations, useJournalEntries, useJournalOptions } from "@/hooks/useErp"
import { useActiveShopsForSwitcher } from "@/hooks/useShops"
import type { CostBehavior, JournalEntry, JournalType } from "@/types/erp.types"
import { ReasonDialog } from "../accounting/ExpensesTab"
import { monthRange } from "../accounting/meta"
import { cn } from "@/lib/utils"

const money = (n: number | null | undefined) => {
  const v = Number.isFinite(n as number) ? (n as number) : 0
  return `${v < 0 ? "-" : ""}₹${Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
}
const inputClass = "w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 text-e16 text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
const labelClass = "mb-1.5 block text-xs font-semibold text-slate-600"

function Empty({ children }: { children: ReactNode }) { return <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-xs text-slate-500">{children}</p> }
function PreviewLine({ icon, title, value }: { icon: ReactNode; title: string; value: string }) {
  return <div className="flex items-start gap-2"><span className="mt-0.5 text-emerald-700">{icon}</span><div className="min-w-0"><p className="text-e9 font-bold tracking-wider text-emerald-700">{title}</p><p className="break-words text-xs font-semibold text-slate-800">{value}</p></div></div>
}

/** A store picker with "All / HQ" first — the entry's location tag. */
function useStores() { return useActiveShopsForSwitcher().data?.items ?? [] }

// ─────────────────────────── the form ───────────────────────────
export function NewEntryForm({ today, initialType, onDone, onCancel }: { today: string; initialType: JournalType; onDone: () => void; onCancel: () => void }) {
  const opts = useJournalOptions().data
  const stores = useStores()
  const { createJournal } = useAccountingMutations()
  const start = opts?.types.find((t) => t.id === initialType)
  const [entryType, setEntryType] = useState<JournalType>(initialType)
  const [date, setDate] = useState(today)
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState(start?.category ?? "Store rent")
  const [amount, setAmount] = useState("")
  const [debitAccount, setDebitAccount] = useState(start?.debit ?? "Operating Expenses")
  const [creditAccount, setCreditAccount] = useState(start?.credit ?? "Cash on Hand")
  const [costBehavior, setCostBehavior] = useState<CostBehavior>("fixed")
  const [department, setDepartment] = useState("Store Operations")
  const [shopId, setShopId] = useState("")
  const [counterparty, setCounterparty] = useState("")
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")
  const [seeded, setSeeded] = useState(false)
  // the options arrive after the first paint: apply the starting type's defaults once they are here
  if (opts && start && !seeded) { setSeeded(true); setCategory(start.category); setDebitAccount(start.debit); setCreditAccount(start.credit); setCostBehavior(initialType === "EXPENSE" ? "fixed" : start.behavior) } // like the reference: a fresh expense starts as a fixed cost

  const categories = useMemo(() => Array.from(new Set([...(opts?.categories ?? []), category])), [opts, category])

  /** Same behaviour as the reference: choosing a type fills in its usual accounts, category and cost behaviour. */
  const switchType = (next: JournalType) => {
    setEntryType(next)
    const t = opts?.types.find((x) => x.id === next)
    if (!t) return
    setDebitAccount(t.debit); setCreditAccount(t.credit); setCostBehavior(t.behavior); setCategory(t.category)
  }
  const reset = () => { setDescription(""); setAmount(""); setCounterparty(""); setReference(""); setNotes("") }
  const save = () => {
    const parsed = Number(amount)
    if (!description.trim() || !Number.isFinite(parsed) || parsed <= 0 || !date) { toast.error("Enter date, description and a positive amount"); return }
    if (Math.round(parsed * 100) / 100 !== parsed) { toast.error("Use at most 2 decimals"); return }
    if (debitAccount === creditAccount) { toast.error("Choose different debit and credit accounts"); return }
    createJournal.mutate({
      entryOn: date, type: entryType, description: description.trim(), category: category.trim() || undefined, amount: parsed, debitAccount, creditAccount, costBehavior, department,
      ...(shopId ? { shopId } : {}), counterparty: counterparty.trim(), reference: reference.trim(), notes: notes.trim(),
    }, { onSuccess: () => { reset(); onDone() } })
  }

  if (!opts) return <section className="rounded-2xl border border-slate-200 bg-white p-6"><div className="h-64 animate-pulse rounded-xl bg-slate-50" /></section>
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-6">
      <div className="mb-5 flex items-start gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><ReceiptText className="size-5" /></div><div><h2 className="text-lg font-bold">Post a balanced journal entry</h2><p className="text-xs text-slate-500">Every posted amount has equal debit and credit. Use contra entries for transfers; never book a transfer as an expense.</p></div></div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <label><span className={labelClass}>Transaction type</span><select className={inputClass} value={entryType} onChange={(e) => switchType(e.target.value as JournalType)}>{opts.types.map((t) => <option value={t.id} key={t.id}>{t.label}</option>)}</select></label>
        <label><span className={labelClass}>Date</span><input type="date" className={inputClass} value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} /></label>
        <label><span className={labelClass}>Amount (₹)</span><input type="number" min="0.01" step="0.01" inputMode="decimal" className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></label>
        <label className="md:col-span-2 xl:col-span-3"><span className={labelClass}>Description *</span><input className={inputClass} value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Store rent paid for October" /></label>
        <label><span className={labelClass}>Category</span><select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label><span className={labelClass}>Debit account</span><select className={inputClass} value={debitAccount} onChange={(e) => setDebitAccount(e.target.value)}>{opts.accounts.map((a) => <option key={a}>{a}</option>)}</select></label>
        <label><span className={labelClass}>Credit account</span><select className={inputClass} value={creditAccount} onChange={(e) => setCreditAccount(e.target.value)}>{opts.accounts.map((a) => <option key={a}>{a}</option>)}</select></label>
        <label><span className={labelClass}>Cost behaviour</span><select className={inputClass} value={costBehavior} onChange={(e) => setCostBehavior(e.target.value as CostBehavior)}>{opts.behaviors.map((b) => <option value={b.id} key={b.id}>{b.label}</option>)}</select></label>
        <label><span className={labelClass}>Department</span><select className={inputClass} value={department} onChange={(e) => setDepartment(e.target.value)}>{opts.departments.map((v) => <option key={v}>{v}</option>)}</select></label>
        <label><span className={labelClass}>Store / location</span><select className={inputClass} value={shopId} onChange={(e) => setShopId(e.target.value)}><option value="">All / HQ</option>{stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label><span className={labelClass}>Counterparty</span><input className={inputClass} value={counterparty} maxLength={120} onChange={(e) => setCounterparty(e.target.value)} placeholder="Vendor / promoter / customer" /></label>
        <label><span className={labelClass}>Invoice / reference</span><input className={inputClass} value={reference} maxLength={120} onChange={(e) => setReference(e.target.value)} placeholder="Receipt, UTR, invoice no." /></label>
        <label className="md:col-span-2 xl:col-span-3"><span className={labelClass}>Notes</span><textarea className={inputClass} value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional details for audit trail" /></label>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-2 rounded-xl border border-emerald-100 bg-emerald-50 p-3 sm:grid-cols-3">
        <PreviewLine icon={<ArrowDownLeft className="size-4" />} title="DEBIT" value={debitAccount} />
        <PreviewLine icon={<ArrowUpRight className="size-4" />} title="CREDIT" value={creditAccount} />
        <PreviewLine icon={<ShieldCheck className="size-4" />} title="AMOUNT" value={money(Number(amount) || 0)} />
      </div>
      <p className="mt-3 text-e11 leading-relaxed text-slate-500">Entries that touch Cash on Hand, Petty Cash, Bank or UPI clearing move the cash and bank balances. Expense, commission, other-income and refund entries also count in the month&apos;s profit. To set the starting balance of the cash box or bank, use “Cash &amp; bank entry”.</p>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className="min-h-11 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600">Cancel</button>
        <button type="button" onClick={save} disabled={createJournal.isPending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-60"><CheckCircle2 className="size-4" />Post entry</button>
      </div>
    </section>
  )
}

// ─────────────────────────── the ledger ───────────────────────────
const csvCell = (v: string | number | null) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }

export function JournalLedger({ month, manage }: { month: string; manage: boolean }) {
  const opts = useJournalOptions().data
  const stores = useStores()
  const { voidJournal } = useAccountingMutations()
  const [query, setQuery] = useState("")
  const [type, setType] = useState("all")
  const [department, setDepartment] = useState("all")
  const [shopId, setShopId] = useState("all")
  const [showVoided, setShowVoided] = useState(false)
  const [voiding, setVoiding] = useState<JournalEntry | null>(null)
  const q = useJournalEntries({
    ...monthRange(month), includeVoided: showVoided, q: query.trim() || undefined,
    ...(type !== "all" ? { type } : {}), ...(department !== "all" ? { department } : {}), ...(shopId !== "all" ? { shopId } : {}),
  })
  const rows = q.data?.items ?? []
  const live = rows.filter((r) => !r.voided)
  const download = () => {
    const head = ["Date", "Type", "Description", "Category", "Debit", "Credit", "Amount", "Cost behaviour", "Department", "Store", "Counterparty", "Reference", "Notes", "Status"]
    const body = rows.map((r) => [r.date, r.typeLabel, r.description, r.category, r.debitAccount, r.creditAccount, r.amount, r.costBehavior, r.department, r.shop ?? "All / HQ", r.counterparty, r.reference, r.notes, r.voided ? `cancelled: ${r.voidReason}` : "posted"])
    const blob = new Blob([[head, ...body].map((r) => r.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" })
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `journal-${month}.csv`; a.click(); URL.revokeObjectURL(a.href)
  }
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="grid grid-cols-1 gap-2 border-b border-slate-100 p-3 sm:grid-cols-2 xl:grid-cols-4 sm:p-4">
        <label className="relative"><Search className="absolute left-3 top-4 size-4 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} className={`${inputClass} pl-9`} placeholder="Search ledger..." /></label>
        <select aria-label="Type" className={inputClass} value={type} onChange={(e) => setType(e.target.value)}><option value="all">All types</option>{(opts?.types ?? []).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
        <select aria-label="Department" className={inputClass} value={department} onChange={(e) => setDepartment(e.target.value)}><option value="all">All departments</option>{(opts?.departments ?? []).map((t) => <option key={t}>{t}</option>)}</select>
        <select aria-label="Store" className={inputClass} value={shopId} onChange={(e) => setShopId(e.target.value)}><option value="all">All store tags</option>{stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2 text-xs text-slate-500">
        <span>Showing {rows.length.toLocaleString("en-IN")} journal lines · {monthRange(month).from} to {monthRange(month).to}</span>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={showVoided} onChange={(e) => setShowVoided(e.target.checked)} />Show cancelled</label>
      </div>
      <div className="max-h-[640px] overflow-auto">
        <table className="w-full min-w-[1150px] border-collapse text-left text-xs">
          <thead className="sticky top-0 bg-slate-50 text-e10 uppercase tracking-wider text-slate-500"><tr>{["Date", "Particulars", "Category", "Debit", "Credit", "Amount", "Store", "Reference", ""].map((x, i) => <th key={i} className={cn("whitespace-nowrap px-3 py-3", x === "Amount" && "text-right")}>{x}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={cn("border-t border-slate-100", r.voided && "opacity-60")}>
                <td className="whitespace-nowrap px-3 py-3">{r.date}</td>
                <td className="max-w-[260px] px-3 py-3"><p className={cn("truncate font-semibold text-slate-800", r.voided && "line-through")}>{r.description}</p><p className="text-e10 text-slate-400">{r.typeLabel} · {r.department}{r.counterparty ? ` · ${r.counterparty}` : ""}{r.voided ? ` · cancelled: ${r.voidReason}` : ""}</p></td>
                <td className="px-3 py-3">{r.category}</td>
                <td className="px-3 py-3">{r.debitAccount}</td>
                <td className="px-3 py-3">{r.creditAccount}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right font-bold tabular-nums">{money(r.amount)}</td>
                <td className="px-3 py-3">{r.shop ?? "All / HQ"}</td>
                <td className="px-3 py-3">{r.reference || "—"}</td>
                <td className="px-3 py-3 text-right">{manage && !r.voided && <button type="button" aria-label="Cancel this entry" onClick={() => setVoiding(r)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600" style={{ minHeight: 0 }}><Undo2 className="size-4" /></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!q.isLoading && rows.length === 0 && <div className="p-3"><Empty>No ledger lines match the filters.</Empty></div>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 p-3">
        <span className="text-xs text-slate-500">{rows.length} rows · Amount total {money(live.reduce((a, r) => a + r.amount, 0))}</span>
        <button type="button" onClick={download} disabled={!rows.length} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold disabled:opacity-50"><Download className="size-4" />Export filtered CSV</button>
      </div>
      <ReasonDialog open={Boolean(voiding)} title={`Cancel ${voiding ? money(voiding.amount) : ""} ${voiding?.typeLabel ?? ""}?`} confirm="Cancel entry" busy={voidJournal.isPending} onClose={() => setVoiding(null)}
        onSubmit={(reason) => voiding && voidJournal.mutate({ id: voiding.id, reason }, { onSuccess: () => setVoiding(null) })} />
    </section>
  )
}

// ─────────────────────────── trial balance ───────────────────────────
export function TrialBalanceCard({ month }: { month: string }) {
  const r = monthRange(month)
  const q = useJournalEntries({ from: r.from, to: r.to })
  const tb = q.data?.trialBalance
  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 sm:p-5">
      <h2 className="mb-3 text-base font-bold">Trial balance · as of {r.to}</h2>
      <p className="mb-3 text-xs text-slate-500">Balances include every journal entry posted up to the end of the month. Sales, stock and expenses typed on the Expenses tab are not journal entries and are not in here.</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[400px] text-left text-xs">
          <thead><tr className="border-b text-slate-500"><th className="py-2">Account</th><th className="py-2 text-right">Debit</th><th className="py-2 text-right">Credit</th></tr></thead>
          <tbody>{(tb?.rows ?? []).map((x) => <tr key={x.account} className="border-b border-slate-100"><td className="py-2">{x.account}</td><td className="py-2 text-right tabular-nums">{x.debit ? money(x.debit) : "—"}</td><td className="py-2 text-right tabular-nums">{x.credit ? money(x.credit) : "—"}</td></tr>)}</tbody>
          <tfoot><tr className="font-bold"><td className="py-3">Total</td><td className="py-3 text-right tabular-nums">{money(tb?.debit)}</td><td className="py-3 text-right tabular-nums">{money(tb?.credit)}</td></tr></tfoot>
        </table>
        {!q.isLoading && !tb?.rows.length && <Empty>No journal entries yet.</Empty>}
      </div>
    </section>
  )
}

