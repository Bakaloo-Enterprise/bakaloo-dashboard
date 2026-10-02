"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useState } from "react"
import { ArrowLeft } from "lucide-react"
import { Forbidden } from "@/components/shared/forbidden"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { AdjustDialog } from "@/components/business/AdjustDialog"
import { SplitDialog } from "@/components/business/SplitDialog"
import { formatRupees } from "@/components/business/business-helpers"
import { bizError, useBizMe, useEntry, useProcurementMutations } from "@/hooks/useBusiness"

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
const HISTORY: Record<string, string> = { CREATED: "Purchase recorded", ALLOCATED: "Sent to stores", ALLOCATION_REVERSED: "Allocation reversed", ADJUSTED: "Adjustment recorded", RESERVED: "Reserved for B2B", RELEASED: "Reservation released", CANCELLED: "Purchase cancelled" }

export default function ProcurementDetailPage() {
  const { id } = useParams<{ id: string }>()
  const me = useBizMe()
  const q = useEntry(id)
  const m = useProcurementMutations()
  const [split, setSplit] = useState(false)
  const [adjust, setAdjust] = useState(false)
  const [reserving, setReserving] = useState(false)
  const [reserveNote, setReserveNote] = useState("")

  if (me.isLoading || q.isLoading) return <Skeleton className="h-64 w-full" />
  if (!me.data?.procurementView) return <Forbidden />
  if (q.isError || !q.data) return <div className="space-y-2"><Link href="/procurement" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Back to purchases</Link><p role="alert" className="text-sm text-red-600">{q.isError ? bizError(q.error) : "Purchase not found."}</p></div>
  const e = q.data
  const manage = me.data.procurementManage
  const active = e.status === "ACTIVE"
  const reserved = e.purpose === "B2B_RESERVED"
  const untouched = e.allocations.length === 0 && e.adjustments.length === 0

  const figs: Array<[string, number | string]> = [["Ordered", e.expectedQty], ["Received", e.receivedQty], ["Short", e.shortage], ["Damaged on arrival", e.damagedQty], ["Usable", e.usable], ["Sent to stores", e.allocated], ["Returned / lost (central)", e.centralAdjusted], ["Available to split", e.available]]

  return (
    <div className="space-y-4">
      <Link href="/procurement" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Back to purchases</Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Purchase #{e.entryNo} — {e.product.name}</h1>
          <p className="text-sm text-muted-foreground">
            {e.vendor.name} · {e.procuredOn} · {formatRupees(e.unitPrice)} each · total {formatRupees(e.purchaseTotal)}{e.invoiceRef && ` · invoice ${e.invoiceRef}`}
          </p>
          {e.receivingNote && <p className="mt-1 text-sm">Receiving note: {e.receivingNote}</p>}
          <p className="mt-1 text-xs">
            {!active && <span className="rounded bg-slate-200 px-1.5 py-0.5 font-medium">Cancelled</span>}
            {active && reserved && <span className="rounded bg-violet-100 px-1.5 py-0.5 font-medium text-violet-900">Reserved for B2B{e.reservedFor?.note ? ` — ${e.reservedFor.note}` : e.reservedFor?.businessName ? ` — ${e.reservedFor.businessName}` : ""}</span>}
            {active && e.destination && <span className="rounded bg-sky-100 px-1.5 py-0.5 font-medium text-sky-900">Dedicated to {e.destination.name}</span>}
          </p>
        </div>
        {manage && active && (
          <div className="flex flex-wrap gap-2">
            <Button disabled={reserved || e.available < 1} onClick={() => setSplit(true)}>Send to stores</Button>
            <Button variant="outline" onClick={() => setAdjust(true)}>Return / damage / adjust</Button>
            {reserved ? <Button variant="outline" onClick={() => m.release.mutate(e.id)}>Release reservation</Button> : !e.destination && <Button variant="outline" onClick={() => setReserving(true)}>Reserve for B2B</Button>}
            {untouched && <Button variant="ghost" className="text-red-700" onClick={() => m.cancel.mutate(e.id)}>Cancel purchase</Button>}
          </div>
        )}
      </header>

      {reserved && active && <p role="status" className="rounded-md bg-violet-50 px-3 py-2 text-sm text-violet-900">This stock is held for B2B and cannot be sent to stores until the reservation is released.</p>}
      {reserving && (
        <form className="flex gap-2" onSubmit={(ev) => { ev.preventDefault(); if (reserveNote.trim()) m.reserve.mutate({ id: e.id, note: reserveNote.trim() }, { onSuccess: () => { setReserving(false); setReserveNote("") } }) }}>
          <Input aria-label="Reserved for" autoFocus placeholder="Which customer or order is it reserved for?" value={reserveNote} onChange={(ev) => setReserveNote(ev.target.value)} maxLength={300} />
          <Button type="submit" disabled={!reserveNote.trim()}>Reserve</Button><Button type="button" variant="ghost" onClick={() => setReserving(false)}>Cancel</Button>
        </form>
      )}

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {figs.map(([k, v]) => <div key={k} className="rounded-lg border p-3"><dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</dt><dd className={`text-xl font-semibold tabular-nums ${k === "Available to split" ? "text-emerald-700" : ""}`}>{v}</dd></div>)}
      </dl>

      <section className="rounded-md border p-3" aria-label="Sent to stores">
        <h2 className="mb-2 text-sm font-semibold">Sent to stores</h2>
        {e.allocations.length === 0 ? <p className="text-sm text-muted-foreground">Nothing sent yet.</p> : (
          <ul className="space-y-1">
            {e.allocations.map((a) => (
              <li key={a.id} className="flex items-center justify-between text-sm">
                <span className={a.status === "REVERSED" ? "text-muted-foreground line-through" : ""}>{a.shopName} — {a.quantity} <span className="text-xs text-muted-foreground">{when(a.at)}</span></span>
                {manage && a.status === "APPLIED" && <Button size="sm" variant="ghost" className="text-red-700" disabled={m.reverse.isPending} onClick={() => m.reverse.mutate(a.id)}>Take back</Button>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-md border p-3" aria-label="Returns, damage and adjustments">
        <h2 className="mb-2 text-sm font-semibold">Returns, damage and adjustments</h2>
        {e.adjustments.length === 0 ? <p className="text-sm text-muted-foreground">None recorded.</p> : (
          <ul className="space-y-1">
            {e.adjustments.map((a) => (
              <li key={a.id} className="text-sm">
                <strong>{a.label}</strong> — {a.quantity} {a.shopName ? `from ${a.shopName}` : "from central stock"} · {formatRupees(a.value)}{a.loss && <span className="ml-1 text-xs text-red-700">counted as loss</span>}
                <span className="block text-xs text-muted-foreground">{a.reason}{a.by && ` — ${a.by}`} · {when(a.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-md border p-3" aria-label="History">
        <h2 className="mb-2 text-sm font-semibold">History</h2>
        <ol className="space-y-1 text-xs">{e.history.map((h, i) => <li key={i}><span className="text-muted-foreground">{when(h.at)}</span> — {HISTORY[h.kind] ?? h.kind}{h.by && <span className="text-muted-foreground"> ({h.by})</span>}</li>)}</ol>
      </section>

      {split && <SplitDialog key={`s${e.available}`} entry={e} open={split} onOpenChange={setSplit} />}
      {adjust && <AdjustDialog key={`a${e.adjustments.length}`} entry={e} open={adjust} onOpenChange={setAdjust} />}
    </div>
  )
}
