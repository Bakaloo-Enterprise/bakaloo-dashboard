"use client"

import type { OverviewData } from "@/types/overview.types"
import { count, inr } from "../format"
import { Bar, Empty, Panel } from "../kit"

export function TopProductsPanel({ d }: { d: OverviewData }) {
  const top = d.topProducts
  const max = Math.max(1, ...top.map((p) => p.revenue))
  return (
    <Panel title="Best sellers" hint="By money. Cancelled and fully refunded orders are left out." help="Units are real quantities sold, not order lines.">
      {top.length === 0 ? <Empty>No sales yet.</Empty> : (
        <ol className="space-y-3">
          {top.map((p, i) => (
            <li key={p.id} className="flex items-center gap-3">
              <span className="w-5 text-right text-xs font-semibold text-muted-foreground tabular-nums">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate font-medium">{p.name}</span>
                  <span className="shrink-0 font-semibold tabular-nums">{inr(p.revenue)}</span>
                </div>
                <div className="mt-1 flex items-center gap-3">
                  <Bar pct={(p.revenue / max) * 100} tone="green" className="h-1.5" />
                  <span className="w-20 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">{count(p.unitsSold)} sold</span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}
