"use client"

import Link from "next/link"
import { useState } from "react"
import { Plus, Search } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { Forbidden } from "@/components/shared/forbidden"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { NewPurchaseDialog } from "@/components/business/NewPurchaseDialog"
import { PeriodBar, type PeriodState } from "@/components/business/PeriodBar"
import { ReconciliationTable } from "@/components/business/ReconciliationTable"
import { VendorTable } from "@/components/business/VendorTable"
import { formatRupees, periodProblem, toPeriodQuery } from "@/components/business/business-helpers"
import { useBizMe, useEntries, useProcurementMutations, useReconciliation, useVendorReport, useVendors } from "@/hooks/useBusiness"
import { useDebounce } from "@/hooks/useDebounce"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"

type Tab = "purchases" | "vendors" | "reconciliation"

export default function ProcurementPage() {
  const router = useRouter()
  const me = useBizMe()
  const [tab, setTab] = useState<Tab>("purchases")
  const [period, setPeriod] = useState<PeriodState>({ period: "30d" })
  const [search, setSearch] = useState("")
  const [vendorFilter, setVendorFilter] = useState("")
  const [creating, setCreating] = useState(false)
  const [reportVendor, setReportVendor] = useState("")
  const debounced = useDebounce(search, 300)

  const allowed = Boolean(me.data?.procurementView)
  const manage = Boolean(me.data?.procurementManage)
  const ok = allowed && !periodProblem(period)
  const vendors = useVendors(true)
  const range = period.period === "custom" ? { from: period.from, to: period.to } : {}
  const entries = useEntries({ ...range, ...(vendorFilter ? { vendorId: vendorFilter } : {}), ...(debounced ? { search: debounced } : {}), limit: 50 })
  const vendorReport = useVendorReport({ ...toPeriodQuery(period), ...(reportVendor ? { vendorId: reportVendor } : {}) }, ok && tab === "vendors")
  const recon = useReconciliation(toPeriodQuery(period), ok && tab === "reconciliation")

  if (me.isLoading) return <Skeleton className="h-40 w-full" />
  if (!allowed) return <Forbidden />
  const TABS: Array<[Tab, string]> = [["purchases", "Purchases"], ["vendors", "Vendors"], ["reconciliation", "Reconciliation"]]

  return (
    <div className="space-y-4">
      <PageHeader title="Procurement" subtitle="What we bought, from whom, at what cost — and where it went.">
        {manage && <Button onClick={() => setCreating(true)}><Plus className="mr-1 h-4 w-4" />New purchase</Button>}
      </PageHeader>

      <div className="flex flex-wrap gap-1 border-b" role="tablist" aria-label="Procurement">
        {TABS.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn("-mb-px border-b-2 px-3 py-2 text-sm", tab === id ? "border-primary font-semibold" : "border-transparent text-muted-foreground hover:text-foreground")}>{label}</button>)}
      </div>

      {tab !== "purchases" && <PeriodBar value={period} onChange={setPeriod} />}

      {tab === "purchases" && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Product, invoice or number" aria-label="Search purchases" className="pl-8" />
            </div>
            <select aria-label="Vendor" className="h-9 rounded-md border bg-background px-2 text-sm" value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)}>
              <option value="">All vendors</option>
              {(vendors.data ?? []).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <span className="ml-auto text-xs text-muted-foreground">{entries.data?.total ?? 0} purchases</span>
          </div>
          {entries.isLoading ? <Skeleton className="h-40 w-full" /> : entries.isError ? <p role="alert" className="text-sm text-red-600">Could not load purchases.</p> : (entries.data?.items.length ?? 0) === 0 ? (
            <p role="status" className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">No purchases yet.{manage && " Record the first one with “New purchase”."}</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="p-2">#</th><th className="p-2">Date</th><th className="p-2">Product</th><th className="p-2">Vendor</th><th className="p-2 text-right">Received</th><th className="p-2 text-right">Price</th><th className="p-2 text-right">Total</th><th className="p-2 text-right">Sent</th><th className="p-2 text-right">Left</th><th className="p-2">For</th></tr></thead>
                <tbody>
                  {entries.data!.items.map((e) => (
                    <tr key={e.id} className={cn("border-t hover:bg-muted/40", e.status === "CANCELLED" && "text-muted-foreground line-through")}>
                      <td className="p-2"><Link className="font-medium underline-offset-2 hover:underline" href={`/procurement/${e.id}`}>#{e.entryNo}</Link></td>
                      <td className="p-2">{e.procuredOn}</td><td className="p-2">{e.product.name}</td><td className="p-2">{e.vendor.name}</td>
                      <td className="p-2 text-right tabular-nums">{e.receivedQty}{e.damagedQty > 0 && <span className="text-red-700"> (−{e.damagedQty})</span>}{e.shortage > 0 && <span className="text-amber-700"> short {e.shortage}</span>}</td>
                      <td className="p-2 text-right tabular-nums">{formatRupees(e.unitPrice)}</td><td className="p-2 text-right tabular-nums">{formatRupees(e.purchaseTotal)}</td>
                      <td className="p-2 text-right tabular-nums">{e.allocated}</td><td className="p-2 text-right tabular-nums">{e.available}</td>
                      <td className="p-2 text-xs">{e.purpose === "B2B_RESERVED" ? "B2B reserved" : e.destination ? e.destination.name : "Any store"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === "vendors" && (
        <>
          <VendorManager canManage={manage} />
          {vendorReport.isError ? <p role="alert" className="text-sm text-red-600">Could not load the vendor report.</p> : <VendorTable data={vendorReport.data} loading={vendorReport.isLoading} selected={reportVendor} onSelect={(id) => setReportVendor(id === reportVendor ? "" : id)} />}
        </>
      )}
      {tab === "reconciliation" && (recon.isError ? <p role="alert" className="text-sm text-red-600">Could not load the reconciliation.</p> : <ReconciliationTable data={recon.data} loading={recon.isLoading} />)}

      <NewPurchaseDialog open={creating} onOpenChange={setCreating} onCreated={(id) => router.push(`/procurement/${id}`)} />
    </div>
  )
}

function VendorManager({ canManage }: { canManage: boolean }) {
  const vendors = useVendors(true)
  const { createVendor, updateVendor } = useProcurementMutations()
  const [name, setName] = useState("")
  return (
    <section className="rounded-md border p-3" aria-label="Vendors">
      <h2 className="mb-2 text-sm font-semibold">Vendors</h2>
      <ul className="space-y-1">
        {(vendors.data ?? []).map((v) => (
          <li key={v.id} className="flex items-center justify-between text-sm">
            <span className={v.is_active ? "" : "text-muted-foreground line-through"}>{v.name} <span className="text-xs text-muted-foreground">{v.entries ?? 0} purchases</span></span>
            {canManage && <Button size="sm" variant="ghost" onClick={() => updateVendor.mutate({ id: v.id, isActive: !v.is_active })}>{v.is_active ? "Switch off" : "Switch on"}</Button>}
          </li>
        ))}
        {(vendors.data ?? []).length === 0 && <li className="text-sm text-muted-foreground">No vendors yet — one is created automatically when you name a new vendor on a purchase.</li>}
      </ul>
      {canManage && (
        <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim().length >= 2) createVendor.mutate({ name: name.trim() }, { onSuccess: () => setName("") }) }}>
          <Input aria-label="New vendor name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a vendor" className="w-64" />
          <Button type="submit" disabled={name.trim().length < 2 || createVendor.isPending}>Add</Button>
        </form>
      )}
    </section>
  )
}
