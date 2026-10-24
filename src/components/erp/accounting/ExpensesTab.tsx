"use client"

import { useState } from "react"
import { Plus, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useAccountingMutations, useExpenses } from "@/hooks/useErp"
import { useActiveShopsForSwitcher } from "@/hooks/useShops"
import type { Expense, ExpenseCategory, PayVia } from "@/types/erp.types"
import { inr } from "../format"
import { Empty, TONE } from "../kit"
import { EXPENSE_META, VIA_LABEL, monthRange } from "./meta"
import { cn } from "@/lib/utils"

const CATS = Object.keys(EXPENSE_META) as ExpenseCategory[]
const LABEL: Record<ExpenseCategory, string> = { RENT: "Rent", SALARY: "Salaries", ELECTRICITY: "Electricity & water", INTERNET: "Internet & phone", TAXES: "Taxes & licences", TRANSPORT: "Transport & fuel", PACKING: "Packing material", RIDER_PAY: "Rider payouts", MARKETING: "Marketing", GATEWAY_FEES: "Gateway fees", MAINTENANCE: "Repairs", OTHER: "Other" }

export function ReasonDialog({ open, title, confirm, busy, onClose, onSubmit }: { open: boolean; title: string; confirm: string; busy: boolean; onClose: () => void; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState("")
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setReason(""); onClose() } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>It stays in the list, marked as cancelled, with your reason — nothing is deleted.</DialogDescription></DialogHeader>
        <label className="block text-sm font-medium">Why?<Input autoFocus className="mt-1 h-11" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="e.g. entered twice" /></label>
        <DialogFooter><Button variant="outline" onClick={onClose}>Keep it</Button><Button variant="destructive" disabled={!reason.trim() || busy} onClick={() => { onSubmit(reason.trim()); setReason("") }}>{confirm}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AddExpense({ open, onClose, defaultDate }: { open: boolean; onClose: () => void; defaultDate: string }) {
  const { createExpense } = useAccountingMutations()
  const shops = useActiveShopsForSwitcher()
  const [category, setCategory] = useState<ExpenseCategory | null>(null)
  const [amount, setAmount] = useState("")
  const [via, setVia] = useState<PayVia>("CASH")
  const [date, setDate] = useState(defaultDate)
  const [party, setParty] = useState("")
  const [note, setNote] = useState("")
  const [shopId, setShopId] = useState("")
  const amt = Number(amount)
  const amountOk = Number.isFinite(amt) && amt > 0 && Math.round(amt * 100) / 100 === amt
  const reset = () => { setCategory(null); setAmount(""); setParty(""); setNote(""); setShopId(""); setVia("CASH") }
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader><DialogTitle>New expense</DialogTitle><DialogDescription>Money the business spent that is not buying stock — stock purchases and supplier payments are recorded under Procurement.</DialogDescription></DialogHeader>
        <div className="space-y-5">
          <fieldset><legend className="mb-2 text-sm font-medium">What was it for?</legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {CATS.map((c) => { const m = EXPENSE_META[c]; return (
                <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)} className={cn("flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition-colors", category === c ? cn("border-2", TONE[m.tone].soft, TONE[m.tone].text, "border-current") : "hover:bg-muted")}>
                  <m.icon className="h-6 w-6" aria-hidden />{m.short}
                </button>
              ) })}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">Amount (₹)<Input inputMode="decimal" className="mt-1 h-12 text-lg font-semibold" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} aria-invalid={amount !== "" && !amountOk} placeholder="0" /></label>
            <label className="block text-sm font-medium">Date<Input type="date" className="mt-1 h-12" value={date} max={defaultDate} onChange={(e) => e.target.value && setDate(e.target.value)} /></label>
          </div>
          <fieldset><legend className="mb-2 text-sm font-medium">How was it paid?</legend>
            <div className="grid grid-cols-3 gap-2">{(["CASH", "UPI", "BANK"] as PayVia[]).map((v) => <button key={v} type="button" aria-pressed={via === v} onClick={() => setVia(v)} className={cn("rounded-xl border p-3 text-sm font-semibold", via === v ? "border-2 border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "hover:bg-muted")}>{VIA_LABEL[v]}</button>)}</div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">Paid to <span className="font-normal text-muted-foreground">(optional)</span><Input className="mt-1 h-11" value={party} maxLength={120} onChange={(e) => setParty(e.target.value)} /></label>
            <label className="block text-sm font-medium">Store <span className="font-normal text-muted-foreground">(optional)</span>
              <select className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm" value={shopId} onChange={(e) => setShopId(e.target.value)}><option value="">Whole business</option>{(shops.data?.items ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          </div>
          <label className="block text-sm font-medium">Note <span className="font-normal text-muted-foreground">(optional)</span><Input className="mt-1 h-11" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} /></label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!category || !amountOk || createExpense.isPending} onClick={() => category && createExpense.mutate({ spentOn: date, category, amount: amt, paidVia: via, ...(shopId ? { shopId } : {}), ...(party.trim() ? { party: party.trim() } : {}), ...(note.trim() ? { note: note.trim() } : {}) }, { onSuccess: () => { reset(); onClose() } })}>Save expense</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ExpensesTab({ month, today, manage }: { month: string; today: string; manage: boolean }) {
  const [cat, setCat] = useState<ExpenseCategory | "">("")
  const [showVoided, setShowVoided] = useState(false)
  const [adding, setAdding] = useState(false)
  const [voiding, setVoiding] = useState<Expense | null>(null)
  const { voidExpense } = useAccountingMutations()
  const range = monthRange(month)
  const q = useExpenses({ ...range, ...(cat ? { category: cat } : {}), includeVoided: showVoided })
  return (
    <section className="rounded-2xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b p-4">
        <h2 className="mr-auto text-base font-semibold">Running costs {q.data && <span className="ml-2 text-sm font-normal text-muted-foreground">{inr(q.data.total, false)} this month</span>}</h2>
        <select aria-label="Filter by type" value={cat} onChange={(e) => setCat(e.target.value as ExpenseCategory | "")} className="h-9 rounded-xl border bg-background px-3 text-sm"><option value="">All types</option>{CATS.map((c) => <option key={c} value={c}>{LABEL[c]}</option>)}</select>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground"><input type="checkbox" checked={showVoided} onChange={(e) => setShowVoided(e.target.checked)} />Show cancelled</label>
        {manage && <Button className="h-10 rounded-xl" onClick={() => setAdding(true)}><Plus className="mr-1.5 h-4 w-4" aria-hidden />Add expense</Button>}
      </div>
      {q.isLoading ? <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
        : !q.data?.items.length ? <div className="p-4"><Empty>No expenses for this month. {manage ? "Tap “Add expense” to record rent, salaries, power and the rest." : ""}</Empty></div> : (
          <ul className="divide-y">
            {q.data.items.map((e) => { const m = EXPENSE_META[e.category]; return (
              <li key={e.id} className={cn("flex items-center gap-3 p-4", e.voided && "opacity-60")}>
                <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", TONE[m.tone].icon)} aria-hidden><m.icon className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-sm font-medium", e.voided && "line-through")}>{e.categoryLabel}{e.party ? ` · ${e.party.replace(/^DM-/, "")}` : ""}</p>
                  <p className="truncate text-xs text-muted-foreground">{e.date} · {VIA_LABEL[e.paidVia]} · {e.kind === "FIXED" ? "fixed" : "varies"}{e.shop ? ` · ${e.shop}` : ""}{e.note && !e.note.startsWith("DM-") ? ` · ${e.note}` : ""}{e.voided ? ` · cancelled: ${e.voidReason}` : ""}</p>
                </div>
                <p className="text-sm font-semibold tabular-nums">{inr(e.amount, false)}</p>
                {manage && !e.voided && <button type="button" onClick={() => setVoiding(e)} aria-label="Cancel this expense" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><Undo2 className="h-4 w-4" aria-hidden /></button>}
              </li>
            ) })}
          </ul>
        )}
      <AddExpense open={adding} onClose={() => setAdding(false)} defaultDate={today} />
      <ReasonDialog open={Boolean(voiding)} title={`Cancel ${voiding ? inr(voiding.amount, false) : ""} ${voiding?.categoryLabel ?? ""}?`} confirm="Cancel expense" busy={voidExpense.isPending} onClose={() => setVoiding(null)}
        onSubmit={(reason) => voiding && voidExpense.mutate({ id: voiding.id, reason }, { onSuccess: () => setVoiding(null) })} />
    </section>
  )
}
