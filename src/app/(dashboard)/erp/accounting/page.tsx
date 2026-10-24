"use client"

import { useState } from "react"
import { AlertTriangle, ChevronLeft, ChevronRight, Lock } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { istToday } from "@/components/business/business-helpers"
import { ErpGuard } from "@/components/erp/ErpGuard"
import { AddCash, CashTab } from "@/components/erp/accounting/CashTab"
import { ExpensesTab } from "@/components/erp/accounting/ExpensesTab"
import { JournalTab } from "@/components/erp/accounting/JournalTab"
import { PnlPanel } from "@/components/erp/accounting/PnlPanel"
import { PositionPanel } from "@/components/erp/accounting/PositionPanel"
import { shiftMonth } from "@/components/erp/accounting/meta"
import { useAccountingSummary } from "@/hooks/useErp"
import { cn } from "@/lib/utils"

type Tab = "profit" | "money" | "expenses" | "cash" | "log"
const TABS: Array<[Tab, string]> = [["profit", "Profit"], ["money", "Cash & bank"], ["expenses", "Expenses"], ["cash", "Owner’s book"], ["log", "Money log"]]

function Body({ manage }: { manage: boolean }) {
  const today = istToday()
  const thisMonth = today.slice(0, 7)
  const [month, setMonth] = useState(thisMonth)
  const [tab, setTab] = useState<Tab>("profit")
  const [addingCash, setAddingCash] = useState(false)
  const q = useAccountingSummary(month)
  const s = q.data
  const monthName = s?.label ?? month
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <PageHeader title="Accounting" subtitle="Is the business making money, and where is the money now?" />
        <div className="inline-flex items-center self-start rounded-xl border bg-card shadow-sm lg:self-auto">
          <Button type="button" variant="ghost" size="icon" className="h-10 w-10" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="min-w-[140px] text-center text-sm font-semibold">{monthName}</span>
          <Button type="button" variant="ghost" size="icon" className="h-10 w-10" aria-label="Next month" disabled={month >= thisMonth} onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <div role="tablist" aria-label="Accounting" className="flex flex-wrap gap-1 border-b">
        {TABS.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn("-mb-px border-b-4 px-4 py-2.5 text-sm", tab === id ? "border-emerald-500 font-bold" : "border-transparent text-muted-foreground hover:text-foreground")}>{label}</button>)}
      </div>

      {s?.closed && <p className="flex items-center gap-2 rounded-xl border border-sky-300/60 bg-sky-50 p-3 text-sm dark:bg-sky-500/10"><Lock className="h-4 w-4" aria-hidden />{s.label} is closed. Sales and stock are frozen; expenses and cash entries for it can’t be changed.</p>}
      {s?.warnings.filter((w) => !w.startsWith("No opening")).map((w) => <p key={w} className="flex items-center gap-2 text-sm text-muted-foreground"><AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />{w}</p>)}

      {tab === "profit" && (q.isLoading ? <Skeleton className="h-96 rounded-2xl" /> : q.isError || !s ? <p role="alert" className="rounded-2xl border border-rose-300 bg-rose-50 p-6 text-sm text-rose-900 dark:bg-rose-500/10 dark:text-rose-200">Could not load the month. <button type="button" className="font-semibold underline" onClick={() => q.refetch()}>Try again</button></p> : <PnlPanel s={s} />)}
      {tab === "money" && (q.isLoading ? <Skeleton className="h-96 rounded-2xl" /> : s ? <PositionPanel s={s} onSetOpening={() => manage && setAddingCash(true)} /> : null)}
      {tab === "expenses" && <ExpensesTab month={month} today={today} manage={manage} />}
      {tab === "cash" && <CashTab month={month} today={today} manage={manage} adding={addingCash} setAdding={setAddingCash} />}
      {tab === "log" && <JournalTab month={month} />}
      <AddCash open={addingCash} onClose={() => setAddingCash(false)} defaultDate={today} initialKind={tab === "money" ? "OPENING_BALANCE" : undefined} />

      {s && (
        <details className="rounded-2xl border bg-card p-4 text-sm"><summary className="cursor-pointer font-medium">Good to know</summary>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted-foreground">{s.notes.map((n) => <li key={n}>{n}</li>)}</ul></details>
      )}
    </div>
  )
}

export default function AccountingPage() {
  return <ErpGuard>{(manage) => <Body manage={manage} />}</ErpGuard>
}
