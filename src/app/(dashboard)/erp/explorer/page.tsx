"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, Download, ListOrdered, Package, ReceiptText, Search, Truck, Undo2, Wallet } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { PeriodBar, type PeriodState } from "@/components/business/PeriodBar"
import { periodProblem, toPeriodQuery } from "@/components/business/business-helpers"
import { ErpGuard } from "@/components/erp/ErpGuard"
import { count, inr } from "@/components/erp/format"
import { Empty } from "@/components/erp/kit"
import { downloadExplorerCsv } from "@/services/erp.service"
import { useExplorer } from "@/hooks/useErp"
import { useDebounce } from "@/hooks/useDebounce"
import type { ExplorerColumn, ExplorerKind } from "@/types/erp.types"
import { bizError } from "@/hooks/useBusiness"
import { cn } from "@/lib/utils"

const KINDS: Array<[ExplorerKind, string, typeof Truck]> = [
  ["orders", "Orders", ReceiptText], ["lines", "Order items", ListOrdered], ["movements", "Stock moves", Package], ["purchases", "Purchases", Truck], ["refunds", "Refunds", Undo2], ["expenses", "Expenses", Wallet],
]
const PAGE = 50

function Cell({ col, v }: { col: ExplorerColumn; v: string | number | boolean | null }) {
  if (v == null || v === "") return <span className="text-muted-foreground/50">—</span>
  if (col.type === "money") return <span className="tabular-nums">{inr(Number(v), false)}</span>
  if (col.type === "number") return <span className="tabular-nums">{count(Number(v))}</span>
  if (col.type === "bool") return <span>{v ? "Yes" : "No"}</span>
  if (col.type === "datetime") return <span className="whitespace-nowrap tabular-nums">{new Date(String(v)).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}</span>
  const s = String(v)
  if (col.key === "treatment" || col.key === "note" && /counted|Cancelled/.test(s)) {
    const tone = s === "Sale" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : /part/i.test(s) ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-rose-500/10 text-rose-700 dark:text-rose-300"
    return <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", tone)}>{s}</span>
  }
  return <span className={cn(col.key === "number" && "whitespace-nowrap font-medium tabular-nums")}>{s}</span>
}

function Body() {
  const [kind, setKind] = useState<ExplorerKind>("orders")
  const [period, setPeriod] = useState<PeriodState>({ period: "7d" })
  const [shopId, setShopId] = useState("")
  const [search, setSearch] = useState("")
  const [offset, setOffset] = useState(0)
  const [busy, setBusy] = useState(false)
  const q = useDebounce(search, 300)
  const ok = !periodProblem(period)
  const params = { ...toPeriodQuery(period), ...(shopId ? { shopId } : {}), ...(q ? { q } : {}) }
  const page = useExplorer(kind, { ...params, limit: PAGE, offset }, ok)
  const d = page.data
  const reset = <T,>(fn: (v: T) => void) => (v: T) => { setOffset(0); fn(v) }
  const download = async () => {
    setBusy(true)
    try { const r = await downloadExplorerCsv(kind, params); toast.success(r.truncated ? "Downloaded the first 20,000 rows — narrow the dates for the rest" : "Downloaded") } catch (e) { toast.error(bizError(e)) } finally { setBusy(false) }
  }
  return (
    <div className="space-y-4">
      <PageHeader title="Data Explorer" subtitle="Every record behind the numbers. Search it, check it, download it." />
      <div role="tablist" aria-label="Record type" className="flex flex-wrap gap-2">
        {KINDS.map(([id, label, Icon]) => <button key={id} type="button" role="tab" aria-selected={kind === id} onClick={() => { setKind(id); setOffset(0) }} className={cn("flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium", kind === id ? "border-2 border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-card hover:bg-muted")}><Icon className="h-4 w-4" aria-hidden />{label}</button>)}
      </div>
      <PeriodBar value={period} onChange={reset(setPeriod)} shopId={shopId} onShop={reset(setShopId)} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[240px] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden /><span className="sr-only">Search</span>
          <Input value={search} maxLength={60} onChange={(e) => { setOffset(0); setSearch(e.target.value) }} placeholder="Search order number, name, product …" className="h-10 rounded-xl pl-9" /></label>
        <Button variant="outline" className="h-10 rounded-xl" onClick={download} disabled={busy || !d?.total}><Download className="mr-1.5 h-4 w-4" aria-hidden />Download CSV</Button>
      </div>
      <section className="rounded-2xl border bg-card shadow-sm">
        {page.isLoading ? <div className="space-y-2 p-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-9 rounded-lg" />)}</div>
          : page.isError || !d ? <p role="alert" className="p-6 text-sm text-rose-700">Could not load these records. <button type="button" className="font-semibold underline" onClick={() => page.refetch()}>Try again</button></p>
          : d.rows.length === 0 ? <div className="p-4"><Empty>Nothing matches. Try wider dates or clear the search.</Empty></div> : (
            <div className="max-h-[640px] overflow-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="sticky top-0 z-10 bg-card text-left text-xs uppercase tracking-wide text-muted-foreground"><tr>{d.columns.map((c) => <th key={c.key} className={cn("whitespace-nowrap px-3 py-2.5 font-medium", (c.type === "money" || c.type === "number") && "text-right")}>{c.label}</th>)}</tr></thead>
                <tbody className="divide-y">{d.rows.map((r, i) => <tr key={i} className="hover:bg-muted/40">{d.columns.map((c) => <td key={c.key} className={cn("px-3 py-2", (c.type === "money" || c.type === "number") && "text-right")}><Cell col={c} v={r[c.key]} /></td>)}</tr>)}</tbody>
              </table>
            </div>
          )}
        {d && d.total > 0 && (
          <div className="flex items-center justify-between border-t px-4 py-2.5 text-xs text-muted-foreground">
            <span>{count(offset + 1)}–{count(Math.min(offset + PAGE, d.total))} of {count(d.total)}</span>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Previous page" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Next page" disabled={offset + PAGE >= d.total} onClick={() => setOffset(offset + PAGE)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
      </section>
      <p className="text-xs text-muted-foreground">Customer phone numbers are partly hidden here. Downloads are logged.</p>
    </div>
  )
}

export default function ExplorerPage() {
  return <ErpGuard>{() => <Body />}</ErpGuard>
}
