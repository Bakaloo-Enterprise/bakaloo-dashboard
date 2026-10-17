"use client"

import { useState } from "react"
import { CalendarDays, CheckCircle2, ClipboardList, Lock, Search, Truck, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useDebounce } from "@/hooks/useDebounce"
import { useRequirementMutations, useRequirements } from "@/hooks/useBusiness"
import { cn } from "@/lib/utils"
import type { Requirement, ReqStatus } from "@/types/business.types"
import { formatRupees, istToday } from "./business-helpers"
import { dayWord, PAY_UI, SOURCE_UI, STATUS_UI } from "./requirement-helpers"

const FILTERS: Array<[ReqStatus | "", string]> = [["", "All"], ["CONFIRMED", "Sure"], ["INQUIRY", "Maybe"], ["DELIVERED", "Delivered"], ["CANCELLED", "Cancelled"]]

function Card({ r, canManage, today }: { r: Requirement; canManage: boolean; today: string }) {
  const { setStatus } = useRequirementMutations()
  const src = SOURCE_UI[r.source]
  const st = STATUS_UI[r.status]
  const pay = PAY_UI[r.paymentTerms]
  const total = r.items.reduce((n, i) => n + (i.unitPrice ?? 0) * i.quantity, 0)
  const act = (status: ReqStatus) => setStatus.mutate({ id: r.id, status })
  const busy = setStatus.isPending
  return (
    <li className={cn("rounded-2xl border-2 bg-card p-3 shadow-sm", r.status === "CANCELLED" && "opacity-60")}>
      <div className="flex items-start gap-3">
        <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border", src.tone)} title={src.hint}><src.icon className="h-6 w-6" aria-label={src.label} /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">{r.customerName}</p>
          <p className="truncate text-xs text-muted-foreground">{src.label}{r.customerPhone ? ` · ${r.customerPhone}` : ""} · #{r.reqNo}</p>
        </div>
        <span className={cn("flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold", st.tone)}><st.icon className="h-4 w-4" aria-hidden />{st.label}</span>
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {r.items.map((i) => (
          <li key={i.productId} className="flex items-center gap-1.5 rounded-lg border bg-muted/40 px-2 py-1 text-sm">
            <strong className="tabular-nums">{i.quantity}</strong><span className="text-muted-foreground">×</span><span>{i.name}</span>{i.held > 0 && <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[11px] font-bold text-violet-700" title="Kept for this customer in the warehouse"><Lock className="h-3 w-3" aria-hidden />{i.held}</span>}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span className="flex items-center gap-1"><CalendarDays className="h-4 w-4" aria-hidden />{dayWord(r.deliveryDate, today)}</span>
        <span className="flex items-center gap-1"><pay.icon className="h-4 w-4" aria-hidden />{pay.label}</span>
        {total > 0 && <span className="font-medium text-foreground">{formatRupees(total)}</span>}
      </div>
      {r.note && <p className="mt-2 rounded-lg bg-muted/50 px-2 py-1 text-xs">{r.note}</p>}
      {canManage && (r.status === "INQUIRY" || r.status === "CONFIRMED") && (
        <div className="mt-3 flex flex-wrap gap-2">
          {r.status === "INQUIRY" && <Button className="h-11 flex-1 bg-green-600 text-base hover:bg-green-700" disabled={busy} onClick={() => act("CONFIRMED")}><CheckCircle2 className="mr-1.5 h-5 w-5" aria-hidden />Sure</Button>}
          {r.status === "CONFIRMED" && <Button className="h-11 flex-1 bg-sky-600 text-base hover:bg-sky-700" disabled={busy} onClick={() => act("DELIVERED")}><Truck className="mr-1.5 h-5 w-5" aria-hidden />Delivered</Button>}
          <Button variant="outline" className="h-11 border-red-300 text-red-700 hover:bg-red-50" disabled={busy} onClick={() => act("CANCELLED")} aria-label="Cancel this request"><XCircle className="mr-1.5 h-5 w-5" aria-hidden />Cancel</Button>
        </div>
      )}
    </li>
  )
}

/** Everything customers asked for outside the app: WhatsApp, calls, walk-ins. */
export function RequirementsList({ canManage }: { canManage: boolean }) {
  const [status, setStatus] = useState<ReqStatus | "">("")
  const [search, setSearch] = useState("")
  const q = useDebounce(search, 300)
  const list = useRequirements({ ...(status ? { status } : {}), ...(q ? { search: q } : {}), limit: 50 })
  const today = istToday()
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show">
          {FILTERS.map(([id, label]) => <button key={id} type="button" aria-pressed={status === id} onClick={() => setStatus(id)} className={cn("h-10 rounded-full border-2 px-4 text-sm font-semibold", status === id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>{label}</button>)}
        </div>
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or phone" aria-label="Search requests" className="h-10 rounded-full pl-9" />
        </div>
      </div>
      {list.isLoading ? <div className="grid gap-3 sm:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}</div> : list.isError ? <p role="alert" className="text-sm text-red-600">Could not load requests.</p> : (list.data?.items.length ?? 0) === 0 ? (
        <p role="status" className="rounded-2xl border-2 border-dashed p-10 text-center text-muted-foreground"><ClipboardList className="mx-auto mb-2 h-10 w-10" aria-hidden />No requests here yet.</p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">{list.data!.items.map((r) => <Card key={r.id} r={r} canManage={canManage} today={today} />)}</ul>
      )}
    </div>
  )
}
