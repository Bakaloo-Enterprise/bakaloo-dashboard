"use client"

import { useState } from "react"
import { Plus, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useAccountingMutations, useCashEntries } from "@/hooks/useErp"
import type { Box, CashEntry, CashKind } from "@/types/erp.types"
import { inr } from "../format"
import { Empty, TONE } from "../kit"
import { BOX_LABEL, CASH_META, monthRange } from "./meta"
import { ReasonDialog } from "./ExpensesTab"
import { cn } from "@/lib/utils"

const KINDS = Object.keys(CASH_META) as CashKind[]

export function AddCash({ open, onClose, defaultDate, initialKind }: { open: boolean; onClose: () => void; defaultDate: string; initialKind?: CashKind }) {
  const { createCash } = useAccountingMutations()
  const [kind, setKind] = useState<CashKind | null>(initialKind ?? null)
  const [seenKind, setSeenKind] = useState(initialKind)
  if (initialKind !== seenKind) { setSeenKind(initialKind); setKind(initialKind ?? null) }
  const [account, setAccount] = useState<Box>("CASH")
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState(defaultDate)
  const [note, setNote] = useState("")
  const amt = Number(amount)
  const amountOk = Number.isFinite(amt) && amt > 0 && Math.round(amt * 100) / 100 === amt
  const needsAccount = kind != null && !["BANK_DEPOSIT", "BANK_WITHDRAWAL"].includes(kind)
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader><DialogTitle>New cash &amp; bank entry</DialogTitle><DialogDescription>The owner’s side of the money. Sales, supplier payments and customer payments are picked up by themselves — don’t type those here.</DialogDescription></DialogHeader>
        <div className="space-y-5">
          <fieldset><legend className="mb-2 text-sm font-medium">What happened?</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {KINDS.map((k) => { const m = CASH_META[k]; return (
                <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} title={m.help} className={cn("flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center text-xs font-medium", kind === k ? cn("border-2 border-current", TONE[m.tone].soft, TONE[m.tone].text) : "hover:bg-muted")}>
                  <m.icon className="h-6 w-6" aria-hidden />{m.short}
                </button>
              ) })}
            </div>
            {kind && <p className="mt-2 text-xs text-muted-foreground">{CASH_META[kind].help}.</p>}
          </fieldset>
          {needsAccount && (
            <fieldset><legend className="mb-2 text-sm font-medium">Which one?</legend>
              <div className="grid grid-cols-2 gap-2">{(["CASH", "BANK"] as Box[]).map((b) => <button key={b} type="button" aria-pressed={account === b} onClick={() => setAccount(b)} className={cn("rounded-xl border p-3 text-sm font-semibold", account === b ? "border-2 border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "hover:bg-muted")}>{BOX_LABEL[b]}</button>)}</div>
            </fieldset>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">Amount (₹)<Input inputMode="decimal" className="mt-1 h-12 text-lg font-semibold" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} aria-invalid={amount !== "" && !amountOk} placeholder="0" /></label>
            <label className="block text-sm font-medium">Date<Input type="date" className="mt-1 h-12" value={date} max={defaultDate} onChange={(e) => e.target.value && setDate(e.target.value)} /></label>
          </div>
          <label className="block text-sm font-medium">Note <span className="font-normal text-muted-foreground">(optional)</span><Input className="mt-1 h-11" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} /></label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!kind || !amountOk || createCash.isPending} onClick={() => kind && createCash.mutate({ entryOn: date, kind, amount: amt, ...(needsAccount ? { account } : {}), ...(note.trim() ? { note: note.trim() } : {}) }, { onSuccess: () => { setAmount(""); setNote(""); onClose() } })}>Save entry</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function CashTab({ month, today, manage, adding, setAdding }: { month: string; today: string; manage: boolean; adding: boolean; setAdding: (v: boolean) => void }) {
  const [voiding, setVoiding] = useState<CashEntry | null>(null)
  const { voidCash } = useAccountingMutations()
  const q = useCashEntries({ ...monthRange(month), includeVoided: true })
  return (
    <section className="rounded-2xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b p-4">
        <h2 className="mr-auto text-base font-semibold">Owner’s cash book</h2>
        {manage && <Button className="h-10 rounded-xl" onClick={() => setAdding(true)}><Plus className="mr-1.5 h-4 w-4" aria-hidden />Add entry</Button>}
      </div>
      {q.isLoading ? <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
        : !q.data?.items.length ? <div className="p-4"><Empty>No entries this month. Add an opening balance for the cash box and the bank to see balances.</Empty></div> : (
          <ul className="divide-y">
            {q.data.items.map((e) => { const m = CASH_META[e.kind]; return (
              <li key={e.id} className={cn("flex items-center gap-3 p-4", e.voided && "opacity-60")}>
                <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", TONE[m.tone].icon)} aria-hidden><m.icon className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-sm font-medium", e.voided && "line-through")}>{e.kindLabel}{e.account ? ` · ${BOX_LABEL[e.account]}` : ""}</p>
                  <p className="truncate text-xs text-muted-foreground">{e.date}{e.note && !e.note.startsWith("DM-") ? ` · ${e.note}` : e.note ? ` · ${e.note.replace(/^DM-/, "")}` : ""}{e.voided ? ` · cancelled: ${e.voidReason}` : ""}</p>
                </div>
                <p className={cn("text-sm font-semibold tabular-nums", m.sign === "−" && "text-rose-600 dark:text-rose-400", m.sign === "+" && "text-emerald-600 dark:text-emerald-400")}>{m.sign === "↔" || m.sign === "•" ? "" : m.sign}{inr(e.amount, false)}</p>
                {manage && !e.voided && <button type="button" onClick={() => setVoiding(e)} aria-label="Cancel this entry" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><Undo2 className="h-4 w-4" aria-hidden /></button>}
              </li>
            ) })}
          </ul>
        )}
      <ReasonDialog open={Boolean(voiding)} title={`Cancel this ${voiding?.kindLabel.toLowerCase() ?? "entry"}?`} confirm="Cancel entry" busy={voidCash.isPending} onClose={() => setVoiding(null)}
        onSubmit={(reason) => voiding && voidCash.mutate({ id: voiding.id, reason }, { onSuccess: () => setVoiding(null) })} />
    </section>
  )
}
