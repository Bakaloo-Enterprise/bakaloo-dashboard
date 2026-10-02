"use client"

import { useState } from "react"
import { Search } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { BoardCardView } from "@/components/pos/BoardCard"
import { LANE_STYLE } from "@/components/pos/pos-helpers"
import { useBoard } from "@/hooks/usePos"
import { cn } from "@/lib/utils"

export default function PosBoardPage() {
  const board = useBoard()
  const [q, setQ] = useState("")
  const needle = q.trim().toLowerCase()
  const d = board.data

  return (
    <div className="space-y-3">
      <PageHeader title="Fulfillment board" subtitle="Every order in the store, from new to out for delivery. Updates live." />

      {d && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm" role="status">
          <span><strong>{d.totals.active}</strong> active</span>
          <span className={cn(d.totals.late > 0 && "font-semibold text-red-700")}><strong>{d.totals.late}</strong> late</span>
          <span><strong>{d.deliveredLast24h}</strong> delivered in 24 h</span>
          <span className={cn(d.printing.printers > 0 && d.printing.online === 0 && "font-semibold text-red-700")}>
            Printing: {d.printing.printers === 0 ? "no printer set up" : `${d.printing.online}/${d.printing.printers} online`}
            {d.printing.queued > 0 && ` · ${d.printing.queued} queued`}
            {d.printing.failed > 0 && <span className="text-red-700"> · {d.printing.failed} failed</span>}
          </span>
          <div className="relative ml-auto w-56">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find order number" aria-label="Find order number" className="pl-8" />
          </div>
        </div>
      )}

      {board.isLoading && <Skeleton className="h-64 w-full" />}
      {board.isError && <p role="alert" className="text-sm text-red-600">Could not load the board.</p>}

      {d && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {d.lanes.map((lane) => {
            const orders = needle ? lane.orders.filter((o) => o.orderNumber.toLowerCase().includes(needle)) : lane.orders
            const style = LANE_STYLE[lane.id]
            return (
              <section key={lane.id} aria-label={lane.label} className="w-64 shrink-0 rounded-lg bg-muted/40">
                <header className={cn("rounded-t-lg px-3 py-2", style.head)}>
                  <div className="flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-sm font-semibold"><span className={cn("h-2 w-2 rounded-full", style.dot)} aria-hidden />{lane.label}</h2>
                    <span className="text-xs font-semibold">{orders.length}</span>
                  </div>
                  <p className="text-[11px] opacity-75">{style.hint}</p>
                </header>
                <div className="space-y-2 p-2">
                  {orders.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">Nothing here</p>}
                  {orders.map((o) => <BoardCardView key={o.id} card={o} />)}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
