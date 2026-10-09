"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { LineRow } from "@/components/pos/LineRow"
import { ScanBox } from "@/components/pos/ScanBox"
import { BillPanel, PeoplePicker, PrintPanel, RiderPanel, TimelinePanel } from "@/components/pos/OrderSidePanels"
import { BLOCKER_TEXT, orderStatusLabel, progressFor } from "@/components/pos/pos-helpers"
import { posErrorMessage, usePosMe, usePosMutations, usePosOrder } from "@/hooks/usePos"
import type { Stage } from "@/types/pos.types"

export default function PosOrderPage() {
  const { id } = useParams<{ id: string }>()
  const order = usePosOrder(id)
  const me = usePosMe()
  const m = usePosMutations()

  if (order.isLoading) return <Skeleton className="h-64 w-full" />
  if (order.isError || !order.data) {
    return (
      <div className="space-y-2">
        <Link href="/pos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Back to the board</Link>
        <p role="alert" className="text-sm text-red-600">{order.isError ? posErrorMessage(order.error) : "Order not found."}</p>
      </div>
    )
  }

  const o = order.data
  const stage: Stage | null = o.fulfillment?.stage === "PICKING" ? "PICK" : o.fulfillment?.stage === "PACKING" ? "PACK" : null
  const prog = stage ? progressFor(o.lines, stage) : null
  const blockers = stage === "PICK" ? o.blockers.pick : stage === "PACK" ? o.blockers.pack : []
  const canWork = stage === "PICK" ? o.can.pick : stage === "PACK" ? o.can.pack : false
  const busy = Object.values(m).some((x) => (x as { isPending?: boolean }).isPending)

  return (
    <div className="space-y-4">
      <Link href="/pos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Back to the board</Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Order #{o.orderNumber}</h1>
          <p className="text-sm text-muted-foreground">
            {o.laneLabel ?? orderStatusLabel(o.status)}{o.slot && ` · Slot ${o.slot}`}{o.area && ` · ${o.area}`}
          </p>
          {o.notes && <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-sm text-amber-900">Customer note: {o.notes}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {o.can.startPick && <Button disabled={busy} onClick={() => m.startPick.mutate(o.id)}>Start picking</Button>}
          {o.can.finishPick && <Button disabled={busy || blockers.length > 0} onClick={() => m.finishPick.mutate(o.id)}>Finish picking</Button>}
          {o.can.startPack && <Button disabled={busy} onClick={() => m.startPack.mutate(o.id)}>Start packing</Button>}
          {o.can.finishPack && <FinishPack disabled={busy || blockers.length > 0} onFinish={(n) => m.finishPack.mutate({ id: o.id, packages: n })} />}
        </div>
      </header>

      {prog && prog.total > 0 && (
        <div aria-label={`${prog.done} of ${prog.total} units done`}>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>{stage === "PICK" ? "Picked" : "Verified"}</span><span>{prog.done}/{prog.total}</span></div>
          <Progress value={Math.round((prog.done / prog.total) * 100)} className="h-2" />
        </div>
      )}

      {blockers.length > 0 && (
        <ul role="status" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          <li className="font-medium">Before you can finish:</li>
          {blockers.map((b) => <li key={b.lineId}>• {b.name} — {BLOCKER_TEXT[b.reason] ?? b.reason}{b.needed > 0 ? ` (${b.needed} to go)` : ""}</li>)}
        </ul>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {stage && canWork && <ScanBox orderId={o.id} stage={stage} />}
          {me.data && !canWork && stage && <p className="text-xs text-muted-foreground">Your role can look at this order but not {stage === "PICK" ? "pick" : "pack"} it.</p>}
          <ul className="space-y-2">
            {o.lines.map((l) => (
              <LineRow
                key={l.id}
                line={l}
                stage={stage}
                canWork={canWork}
                canDecide={o.can.decideMissing}
                busy={busy}
                onConfirm={(qty) => stage && m.confirmLine.mutate({ id: o.id, lineId: l.id, stage, qty })}
                onMissing={(note) => m.reportMissing.mutate({ id: o.id, lineId: l.id, note })}
                onDecide={(decision, note) => m.decideMissing.mutate({ id: o.id, lineId: l.id, decision, note })}
              />
            ))}
          </ul>
        </div>
        <aside className="space-y-3">
          <PeoplePicker order={o} />
          <RiderPanel order={o} />
          <BillPanel order={o} />
          <PrintPanel order={o} />
          <TimelinePanel orderId={o.id} />
        </aside>
      </div>
    </div>
  )
}

function FinishPack({ disabled, onFinish }: { disabled: boolean; onFinish: (n: number) => void }) {
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        const n = Number(new FormData(e.currentTarget).get("packages"))
        onFinish(Number.isInteger(n) && n >= 1 && n <= 20 ? n : 1)
      }}
    >
      <label className="text-xs text-muted-foreground" htmlFor="pkgs">Packages</label>
      <input id="pkgs" name="packages" type="number" min={1} max={20} defaultValue={1} className="h-9 w-16 rounded-md border bg-background px-2 text-sm" />
      <Button type="submit" disabled={disabled}>Finish packing & print</Button>
    </form>
  )
}
