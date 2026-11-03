"use client"

/** Data Explorer in the MandiMetrics reference layout, fed by GET /admin/erp/explorer/:kind (server-side search and paging; phones masked, downloads audited). */
import { useState } from "react"
import { ChevronLeft, ChevronRight, Download, FilterX, Search, TableProperties } from "lucide-react"
import { toast } from "sonner"
import { periodProblem, toPeriodQuery } from "@/components/business/business-helpers"
import type { PeriodState } from "@/components/business/PeriodBar"
import { bizError } from "@/hooks/useBusiness"
import { useDebounce } from "@/hooks/useDebounce"
import { useExplorer } from "@/hooks/useErp"
import { downloadExplorerCsv } from "@/services/erp.service"
import type { ExplorerColumn, ExplorerKind } from "@/types/erp.types"
import { count, inr } from "../format"
import { DateWindow } from "./Controls"
import { LoadError, PageHead, Panel, Seg, Tag } from "./ui"
import { cn } from "@/lib/utils"

const KINDS: Array<{ id: ExplorerKind; label: string }> = [
  { id: "orders", label: "Orders" }, { id: "lines", label: "Order items" }, { id: "movements", label: "Stock moves" },
  { id: "purchases", label: "Purchases" }, { id: "refunds", label: "Refunds" }, { id: "expenses", label: "Expenses" },
]
const PAGE = 50
const input = "rounded-lg border border-[#dce3d4] bg-white px-2.5 py-2 text-xs text-slate-800 focus:border-lime-400/40"

function Cell({ col, v }: { col: ExplorerColumn; v: string | number | boolean | null }) {
  if (v == null || v === "") return <span className="text-slate-300">—</span>
  if (col.type === "money") return <span className="num font-medium text-slate-800">{inr(Number(v), false)}</span>
  if (col.type === "number") return <span className="num text-slate-700">{count(Number(v))}</span>
  if (col.type === "bool") return <Tag tone={v ? "lime" : "slate"}>{v ? "Yes" : "No"}</Tag>
  if (col.type === "datetime") return <span className="num whitespace-nowrap text-slate-600">{new Date(String(v)).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}</span>
  const s = String(v)
  if (col.key === "treatment" || (col.key === "note" && /counted|Cancelled/.test(s))) {
    return <Tag tone={s === "Sale" ? "lime" : /part/i.test(s) ? "amber" : "rose"} className="whitespace-nowrap">{s}</Tag>
  }
  if (col.key === "status") return <Tag tone={/DELIVERED|ACTIVE|RECEIVED/.test(s) ? "lime" : /CANCEL|REFUND|VOID/.test(s) ? "rose" : "slate"}>{s}</Tag>
  return <span className={cn(col.key === "number" ? "num whitespace-nowrap font-medium text-slate-800" : "text-slate-700")}>{s}</span>
}

export function ExplorerView() {
  const [kind, setKind] = useState<ExplorerKind>("orders")
  const [period, setPeriod] = useState<PeriodState>({ period: "7d" })
  const [shopId, setShopId] = useState("")
  const [search, setSearch] = useState("")
  const [offset, setOffset] = useState(0)
  const [busy, setBusy] = useState(false)
  const q = useDebounce(search, 300)
  const problem = periodProblem(period)
  const params = { ...toPeriodQuery(period), ...(shopId ? { shopId } : {}), ...(q ? { q } : {}) }
  const page = useExplorer(kind, { ...params, limit: PAGE, offset }, !problem)
  const d = page.data
  const pages = d ? Math.max(1, Math.ceil(d.total / PAGE)) : 1
  const reset = <T,>(fn: (v: T) => void) => (v: T) => { setOffset(0); fn(v) }
  const download = async () => {
    setBusy(true)
    try { const r = await downloadExplorerCsv(kind, params); toast.success(r.truncated ? "Downloaded the first 20,000 rows — narrow the dates for the rest" : "Downloaded") } catch (e) { toast.error(bizError(e)) } finally { setBusy(false) }
  }

  return (
    <div className="space-y-5 animate-fade">
      <PageHead
        eyebrow="Data Explorer" icon={<TableProperties className="size-3.5" />}
        title="Every record, accounted for"
        sub={d ? `${count(d.total)} ${KINDS.find((k) => k.id === kind)?.label.toLowerCase()} matching · every record behind the numbers — search it, check it, download it` : "Every record behind the numbers — search it, check it, download it"}
        right={
          <button type="button" onClick={download} disabled={busy || !d?.total}
            className="flex items-center gap-2 rounded-xl border border-[#dce3d4] bg-[#f6f8f2] px-3.5 py-2 text-xs font-semibold text-slate-700 hover:border-lime-300 hover:text-lime-700 disabled:cursor-not-allowed disabled:opacity-50">
            <Download className="size-3.5" /> CSV
          </button>
        }
      />

      <Seg<ExplorerKind> label="Record type" value={kind} onChange={(k) => { setOffset(0); setKind(k) }} options={KINDS} />
      <DateWindow value={period} onChange={reset(setPeriod)} shopId={shopId} onShop={reset(setShopId)} problem={problem} />

      <Panel className="flex flex-wrap items-center gap-2.5 !py-3.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
          <input value={search} maxLength={60} onChange={(e) => { setOffset(0); setSearch(e.target.value) }} placeholder="Search order number, name, product…" aria-label="Search" className={cn(input, "w-[260px] pl-8")} />
        </div>
        <button type="button" onClick={() => { setSearch(""); setOffset(0) }} className="ml-auto flex items-center gap-1 text-e11 text-slate-500 hover:text-rose-600" style={{ minHeight: 0 }}>
          <FilterX className="size-3.5" /> reset
        </button>
        <div className="flex w-full gap-4 border-t border-[#e8ece3] pt-2 text-e11 text-slate-500 md:w-auto md:border-0 md:pt-0">
          <span>Records <span className="num font-semibold text-lime-700">{d ? count(d.total) : "—"}</span></span>
          <span>Window <span className="num font-semibold text-slate-700">{d ? `${d.from.slice(5)} → ${d.to.slice(5)}` : "—"}</span></span>
        </div>
      </Panel>

      {page.isLoading ? <div className="h-96 animate-pulse rounded-2xl border border-[#e3e8dd] bg-[#f6f8f2]" /> : page.isError || !d ? <LoadError what="these records" onRetry={() => page.refetch()} /> : (
        <Panel pad={false}>
          <div className="max-h-[640px] overflow-auto">
            <table className="w-full min-w-[900px] text-e11.5">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-[#e3e8dd] text-e10 uppercase tracking-widest text-slate-500">
                  {d.columns.map((c) => <th key={c.key} className={cn("whitespace-nowrap px-2.5 py-3 font-semibold", c.type === "money" || c.type === "number" ? "text-right" : "text-left")}>{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {d.rows.map((r, i) => (
                  <tr key={i} className="border-b border-[#eef1ea] hover:bg-lime-50">
                    {d.columns.map((c) => <td key={c.key} className={cn("px-2.5 py-2", c.type === "money" || c.type === "number" ? "text-right" : "text-left")}><Cell col={c} v={r[c.key]} /></td>)}
                  </tr>
                ))}
                {d.rows.length === 0 && <tr><td colSpan={d.columns.length} className="py-14 text-center text-slate-400">Nothing matches those filters. Try wider dates or clear the search.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-[#e3e8dd] px-4 py-2.5 text-xs text-slate-500">
            <span className="num">{d.total ? `${count(offset + 1)}–${count(Math.min(offset + PAGE, d.total))} of ${count(d.total)}` : "0 records"} · page {Math.floor(offset / PAGE) + 1} / {pages}</span>
            <div className="flex gap-1.5">
              <button type="button" aria-label="Previous page" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))} className="rounded-lg border border-[#dce3d4] p-1.5 hover:border-lime-400/30 hover:text-lime-700 disabled:opacity-30" style={{ minHeight: 0 }}><ChevronLeft className="size-4" /></button>
              <button type="button" aria-label="Next page" disabled={offset + PAGE >= d.total} onClick={() => setOffset(offset + PAGE)} className="rounded-lg border border-[#dce3d4] p-1.5 hover:border-lime-400/30 hover:text-lime-700 disabled:opacity-30" style={{ minHeight: 0 }}><ChevronRight className="size-4" /></button>
            </div>
          </div>
        </Panel>
      )}
      <p className="text-e11 text-slate-400">Customer phone numbers are partly hidden here. Downloads are logged.</p>
    </div>
  )
}
