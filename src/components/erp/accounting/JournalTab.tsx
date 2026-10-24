"use client"

import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useJournal } from "@/hooks/useErp"
import { inr } from "../format"
import { Empty } from "../kit"
import { BOX_LABEL } from "./meta"
import { cn } from "@/lib/utils"

const csvCell = (v: string | number | null) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }

export function JournalTab({ month }: { month: string }) {
  const q = useJournal(month)
  const j = q.data
  const download = () => {
    if (!j) return
    const head = ["Date", "Box", "Direction", "What", "Who", "Amount", "Source"]
    const rows = j.rows.map((r) => [r.date, BOX_LABEL[r.account], r.direction === "in" ? "In" : "Out", r.label, r.party, r.amount, r.source])
    const blob = new Blob([[head, ...rows].map((r) => r.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob); a.download = `money-log-${j.month}.csv`; a.click(); URL.revokeObjectURL(a.href)
  }
  return (
    <section className="rounded-2xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b p-4">
        <h2 className="mr-auto text-base font-semibold">Money log <span className="ml-2 text-sm font-normal text-muted-foreground">every rupee that moved, in date order</span></h2>
        {j && <p className="text-xs text-muted-foreground tabular-nums">Cash: +{inr(j.totals.CASH.in, false)} / −{inr(j.totals.CASH.out, false)} · Bank: +{inr(j.totals.BANK.in, false)} / −{inr(j.totals.BANK.out, false)}</p>}
        <Button variant="outline" className="h-9 rounded-xl" onClick={download} disabled={!j?.rows.length}><Download className="mr-1.5 h-4 w-4" aria-hidden />Download CSV</Button>
      </div>
      {q.isLoading ? <div className="space-y-2 p-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
        : !j?.rows.length ? <div className="p-4"><Empty>Nothing moved this month.</Empty></div> : (
          <div className="max-h-[640px] overflow-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="sticky top-0 bg-card text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-2">Date</th><th className="px-2 py-2">Box</th><th className="px-2 py-2">What</th><th className="px-2 py-2 text-right">In</th><th className="px-4 py-2 text-right">Out</th></tr></thead>
              <tbody className="divide-y">
                {j.rows.map((r, i) => (
                  <tr key={i}>
                    <td className="whitespace-nowrap px-4 py-2 tabular-nums text-muted-foreground">{r.date.slice(5)}</td>
                    <td className="px-2 py-2"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", r.account === "CASH" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-sky-500/15 text-sky-700 dark:text-sky-300")}>{r.account === "CASH" ? "Cash" : "Bank"}</span></td>
                    <td className="px-2 py-2"><span className="font-medium">{r.label}</span>{r.party && <span className="text-xs text-muted-foreground"> · {r.party.replace(/^DM-/, "")}</span>}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{r.direction === "in" ? inr(r.amount, false) : ""}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-rose-600 dark:text-rose-400">{r.direction === "out" ? inr(r.amount, false) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </section>
  )
}
