"use client"

import { useState } from "react"
import { Printer, Receipt, RotateCw } from "lucide-react"
import { BillSummary } from "@/components/orders/BillSummary"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RIDER_STATE } from "./pos-helpers"
import { useRiders, useStaff, useTimeline, usePosMutations } from "@/hooks/usePos"
import type { OrderDetail, PrintJob } from "@/types/pos.types"

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })

export function PeoplePicker({ order }: { order: OrderDetail }) {
  const staff = useStaff(order.can.assignPeople)
  const { assignPerson } = usePosMutations()
  if (!order.can.assignPeople) return null
  const pick = (role: "PICKER" | "PACKER") => (staff.data ?? []).filter((s) => !s.pos_station || s.pos_station === role)
  const row = (role: "PICKER" | "PACKER", current: string | undefined) => (
    <div className="flex items-center gap-2">
      <span className="w-14 text-xs text-muted-foreground">{role === "PICKER" ? "Picker" : "Packer"}</span>
      <Select value={current ?? ""} onValueChange={(userId) => assignPerson.mutate({ id: order.id, role, userId })}>
        <SelectTrigger className="h-8 text-xs" aria-label={`Assign ${role.toLowerCase()}`}><SelectValue placeholder="Not assigned" /></SelectTrigger>
        <SelectContent>{pick(role).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  )
  return (
    <section className="space-y-2 rounded-md border p-3">
      <h3 className="text-sm font-semibold">People</h3>
      {row("PICKER", order.fulfillment?.picker?.id)}
      {row("PACKER", order.fulfillment?.packer?.id)}
    </section>
  )
}

export function RiderPanel({ order }: { order: OrderDetail }) {
  const riders = useRiders(order.can.assignRider)
  const { assignRider, handover } = usePosMutations()
  const [choice, setChoice] = useState("")
  return (
    <section className="space-y-2 rounded-md border p-3">
      <h3 className="text-sm font-semibold">Rider & handover</h3>
      {order.rider ? (
        <p className="text-sm">
          {order.rider.name} <span className="text-xs text-muted-foreground">({order.rider.assignment.toLowerCase().replaceAll("_", " ")})</span>
          {order.rider.pickedUpAt && <span className="block text-xs text-muted-foreground">Picked up {when(order.rider.pickedUpAt)}</span>}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">No rider yet.</p>
      )}
      {order.handover && <p className="text-xs text-emerald-700">Handed over {when(order.handover.at)}{order.handover.by ? ` by ${order.handover.by}` : ""} ({order.handover.scan.toLowerCase().replaceAll("_", " ")})</p>}

      {order.can.assignRider && (
        <div className="flex gap-2">
          <Select value={choice} onValueChange={setChoice}>
            <SelectTrigger className="h-8 text-xs" aria-label="Choose a rider"><SelectValue placeholder={order.rider ? "Change rider…" : "Choose a rider…"} /></SelectTrigger>
            <SelectContent>
              {(riders.data ?? []).map((r) => (
                <SelectItem key={r.id} value={r.id} disabled={!r.online}>
                  {r.name} — {RIDER_STATE[r.state].label}{r.activeOrders ? ` (${r.activeOrders} active)` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" disabled={!choice || assignRider.isPending} onClick={() => assignRider.mutate({ id: order.id, riderId: choice }, { onSuccess: () => setChoice("") })}>Assign</Button>
        </div>
      )}
      {order.can.handover && !order.handover && (
        <Button className="w-full" disabled={handover.isPending} onClick={() => handover.mutate(order.id)}>Hand over to rider</Button>
      )}
    </section>
  )
}

const JOB_CLS: Record<PrintJob["status"], string> = {
  QUEUED: "bg-slate-100 text-slate-700", PRINTING: "bg-sky-100 text-sky-800", PRINTED: "bg-emerald-100 text-emerald-800", FAILED: "bg-red-100 text-red-800", CANCELLED: "bg-slate-100 text-slate-500",
}

export function BillPanel({ order }: { order: OrderDetail }) {
  if (!order.bill) return null
  return (
    <section className="space-y-2 rounded-md border p-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><Receipt className="h-4 w-4" aria-hidden />Bill &amp; payment</h3>
      <BillSummary bill={order.bill} />
    </section>
  )
}

export function PrintPanel({ order }: { order: OrderDetail }) {
  const { retryJob, reprintJob } = usePosMutations()
  if (order.printJobs.length === 0) return null
  return (
    <section className="space-y-2 rounded-md border p-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><Printer className="h-4 w-4" aria-hidden />Printing</h3>
      <ul className="space-y-1.5">
        {order.printJobs.map((j) => (
          <li key={j.id} className="flex items-center justify-between gap-2 text-xs">
            <span>
              {j.kind === "LABEL" ? `Label ${j.packageNo ?? ""}/${j.packageTotal ?? ""}` : j.kind === "INVOICE" ? "Invoice" : "Test"}
              {j.printerName && <span className="text-muted-foreground"> · {j.printerName}</span>}
              {j.error && <span className="block text-red-700">{j.error}</span>}
            </span>
            <span className="flex items-center gap-1">
              <span className={`rounded px-1.5 py-0.5 font-medium ${JOB_CLS[j.status]}`}>{j.status.toLowerCase()}</span>
              {j.canRetry && order.can.reprint && (
                <Button size="sm" variant="ghost" className="h-6 px-1.5" aria-label="Retry print" onClick={() => retryJob.mutate(j.id)}><RotateCw className="h-3 w-3" /></Button>
              )}
              {j.status === "PRINTED" && order.can.reprint && (
                <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs" onClick={() => reprintJob.mutate(j.id)}>Reprint</Button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function TimelinePanel({ orderId }: { orderId: string }) {
  const t = useTimeline(orderId)
  return (
    <section className="rounded-md border p-3">
      <h3 className="mb-2 text-sm font-semibold">History</h3>
      {t.isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
      <ol className="space-y-1.5">
        {(t.data ?? []).map((e, i) => (
          <li key={i} className="text-xs">
            <span className="text-muted-foreground">{when(e.at)}</span> — {e.text}
            {e.actor && <span className="text-muted-foreground"> ({e.actor})</span>}
          </li>
        ))}
      </ol>
    </section>
  )
}
