"use client"

import { useMemo, useState } from "react"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAnalyticsBreakdown } from "@/hooks/useWhatsappCrm"
import type { AnalyticsQuery, BreakdownBy } from "@/types/whatsapp-crm.types"
import { breakdownCsv, formatCount, formatPct, formatRupees, sortRows, type SortKey } from "./analytics-helpers"

const TITLE: Record<BreakdownBy, string> = { campaign: "Campaign", workflow: "Automatic message", template: "Template" }

const COLS: Array<{ key: SortKey; label: string; right?: boolean }> = [
  { key: "name", label: "" },
  { key: "sent", label: "Sent", right: true },
  { key: "delivered", label: "Delivered", right: true },
  { key: "read", label: "Read", right: true },
  { key: "replied", label: "Replied", right: true },
  { key: "orders", label: "Orders", right: true },
  { key: "revenue", label: "Revenue", right: true },
  { key: "cost", label: "Cost", right: true },
  { key: "revenue_per_rupee", label: "₹ back per ₹1", right: true },
]

export function BreakdownTab({ by, query, onExport }: { by: BreakdownBy; query: AnalyticsQuery; onExport?: (csv: string, name: string) => void }) {
  const { data, isLoading, isError } = useAnalyticsBreakdown(by, query)
  const [key, setKey] = useState<SortKey>("sent")
  const [dir, setDir] = useState<"asc" | "desc">("desc")
  const rows = useMemo(() => sortRows(data?.rows ?? [], key, dir), [data, key, dir])

  const sort = (k: SortKey) => {
    if (k === key) setDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setKey(k); setDir(k === "name" ? "asc" : "desc") }
  }
  const download = () => {
    const csv = breakdownCsv(rows)
    if (onExport) return onExport(csv, `whatsapp-${by}-report`)
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `whatsapp-${by}-report-${query.from}-to-${query.to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) return <Skeleton className="h-48 w-full" />
  if (isError) return <p role="alert" className="text-sm text-red-600">Could not load this report. Try again.</p>
  if (rows.length === 0) return <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Nothing was sent in this period.</p>

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Orders are credited to the last {by === "workflow" ? "cart reminder" : "campaign message or cart reminder"} the customer received within {data?.range.attributionDays} days before ordering.</p>
        <Button variant="outline" size="sm" onClick={download}><Download className="mr-1 h-4 w-4" /> Download CSV</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{TITLE[by]} results</caption>
          <thead className="bg-muted text-xs">
            <tr>
              {COLS.map((c) => (
                <th key={c.key} scope="col" aria-sort={key === c.key ? (dir === "asc" ? "ascending" : "descending") : "none"} className={`px-3 py-2 ${c.right ? "text-right" : ""}`}>
                  <button type="button" onClick={() => sort(c.key)} className="font-semibold hover:underline">{c.label || TITLE[by]}{key === c.key ? (dir === "asc" ? " ↑" : " ↓") : ""}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2"><span className="font-medium">{r.name}</span>{r.template_name && <span className="block text-xs text-muted-foreground">{r.template_name}</span>}{r.category && <span className="block text-xs text-muted-foreground">{r.category.toLowerCase()}</span>}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCount(r.sent)}{r.failed > 0 && <span className="block text-[11px] text-red-600">{r.failed} failed</span>}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCount(r.delivered)}<span className="block text-[11px] text-muted-foreground">{formatPct(r.delivery_rate)}</span></td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCount(r.read)}<span className="block text-[11px] text-muted-foreground">{formatPct(r.read_rate)}</span></td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCount(r.replied)}<span className="block text-[11px] text-muted-foreground">{formatPct(r.reply_rate)}</span></td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCount(r.orders)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatRupees(r.revenue)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatRupees(r.cost)}{r.unpriced > 0 && <span className="block text-[11px] text-amber-700">{r.unpriced} unpriced</span>}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.revenue_per_rupee == null ? "—" : `₹${r.revenue_per_rupee}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
