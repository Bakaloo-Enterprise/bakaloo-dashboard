"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Boxes, Clock, ClipboardList, FileSpreadsheet, Lock, PackageCheck, Send, Plus, Scale, Search, ShoppingCart, Truck, Users } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { Forbidden } from "@/components/shared/forbidden"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { NewRequirementDialog } from "@/components/business/NewRequirementDialog"
import { PurchasePlan } from "@/components/business/PurchasePlan"
import { RequirementsList } from "@/components/business/RequirementsList"
import { TransfersPanel } from "@/components/business/TransfersPanel"
import { RepackDialog } from "@/components/business/RepackDialog"
import { DistributeDialog } from "@/components/business/DistributeDialog"
import { MonthlyReport } from "@/components/business/MonthlyReport"
import { InvoiceButton } from "@/components/business/InvoiceButton"
import { SuppliersPanel } from "@/components/business/SuppliersPanel"
import { ReceiveDialog } from "@/components/business/ReceiveDialog"
import { NewPurchaseDialog } from "@/components/business/NewPurchaseDialog"
import { PeriodBar, type PeriodState } from "@/components/business/PeriodBar"
import { ReconciliationTable } from "@/components/business/ReconciliationTable"
import { VendorTable } from "@/components/business/VendorTable"
import { formatRupees, periodProblem, toPeriodQuery } from "@/components/business/business-helpers"
import { useBizMe, useEntries, useReconciliation, useVendorReport, useVendors } from "@/hooks/useBusiness"
import { useDebounce } from "@/hooks/useDebounce"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"

type Tab = "plan" | "requests" | "month" | "purchases" | "vendors" | "reconciliation"

export default function ProcurementPage() {
  const router = useRouter()
  const me = useBizMe()
  const [tab, setTab] = useState<Tab>("plan")
  const [period, setPeriod] = useState<PeriodState>({ period: "30d" })
  const [search, setSearch] = useState("")
  const [vendorFilter, setVendorFilter] = useState("")
  const [creating, setCreating] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [receiving, setReceiving] = useState<import("@/types/business.types").ProcurementEntry | null>(null)
  const [repacking, setRepacking] = useState<import("@/types/business.types").ProcurementEntry | null>(null)
  const [sending, setSending] = useState<import("@/types/business.types").ProcurementEntry | null>(null)
  const [chatId, setChatId] = useState<string | null>(null)
  const [reportVendor, setReportVendor] = useState("")
  const debounced = useDebounce(search, 300)

  // The WhatsApp inbox sends people here with ?chat=<conversation id> to log what that customer asked for.
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("chat")
    if (c) { setChatId(c); setTab("requests"); setRequesting(true); window.history.replaceState(null, "", "/procurement") }
  }, [])

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
  const TABS: Array<[Tab, string, typeof Truck]> = [["plan", "To buy", ShoppingCart], ["requests", "Requests", ClipboardList], ["purchases", "Bought", Truck], ["vendors", "Suppliers", Users], ["month", "Month", FileSpreadsheet], ["reconciliation", "Check", Scale]]

  return (
    <div className="space-y-4">
      <PageHeader title="Procurement" subtitle="What we bought, from whom, at what cost — and where it went.">
        {manage && <Button variant="outline" className="h-11 border-2 border-green-600 text-green-700 hover:bg-green-50" onClick={() => { setChatId(null); setRequesting(true) }}><ClipboardList className="mr-1.5 h-5 w-5" aria-hidden />New request</Button>}
        {manage && <Button className="h-11" onClick={() => setCreating(true)}><Plus className="mr-1.5 h-5 w-5" aria-hidden />New purchase</Button>}
      </PageHeader>

      <div className="flex flex-wrap gap-1 border-b" role="tablist" aria-label="Procurement">
        {TABS.map(([id, label, Icon]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn("-mb-px flex items-center gap-1.5 border-b-4 px-4 py-3 text-base", tab === id ? "border-primary font-bold" : "border-transparent text-muted-foreground hover:text-foreground")}><Icon className="h-5 w-5" aria-hidden />{label}</button>)}
      </div>

      {tab === "plan" && <PurchasePlan manage={manage} />}
      {tab === "month" && <MonthlyReport />}
      {tab === "requests" && <RequirementsList canManage={manage} />}

      {(tab === "vendors" || tab === "reconciliation") && <PeriodBar value={period} onChange={setPeriod} />}

      {tab === "purchases" && (
        <>
          <TransfersPanel />
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
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="p-2">#</th><th className="p-2">Date</th><th className="p-2">Product</th><th className="p-2">Vendor</th><th className="p-2 text-right">Received</th><th className="p-2 text-right">Price</th><th className="p-2 text-right">Total</th><th className="p-2 text-right">Sent</th><th className="p-2 text-right">Left</th><th className="p-2">For</th><th className="p-2">Status</th><th className="p-2">Invoice</th></tr></thead>
                <tbody>
                  {entries.data!.items.map((e) => (
                    <tr key={e.id} className={cn("border-t hover:bg-muted/40", e.status === "CANCELLED" && "text-muted-foreground line-through")}>
                      <td className="p-2"><Link className="font-medium underline-offset-2 hover:underline" href={`/procurement/${e.id}`}>#{e.entryNo}</Link></td>
                      <td className="p-2">{e.procuredOn}</td><td className="p-2">{e.product.name}</td><td className="p-2">{e.vendor.name}</td>
                      <td className="p-2 text-right tabular-nums">{e.receivedQty}{e.damagedQty > 0 && <span className="text-red-700"> (−{e.damagedQty})</span>}{e.shortage > 0 && <span className="text-amber-700"> short {e.shortage}</span>}</td>
                      <td className="p-2 text-right tabular-nums">{formatRupees(e.unitPrice)}</td><td className="p-2 text-right tabular-nums">{formatRupees(e.purchaseTotal)}</td>
                      <td className="p-2 text-right tabular-nums">{e.allocated}</td><td className="p-2 text-right tabular-nums">{e.available}</td>
                      <td className="p-2 text-xs">{e.purpose === "B2B_RESERVED" ? "B2B reserved" : e.destination ? e.destination.name : "Any store"}</td>
                      <td className="p-2">
                        {e.status === "ORDERED" ? (
                          <button type="button" disabled={!manage} onClick={() => setReceiving(e)} className="flex items-center gap-1.5 rounded-full border-2 border-amber-400 bg-amber-50 px-3 py-1.5 text-sm font-bold text-amber-900 hover:bg-amber-100"><Truck className="h-4 w-4" aria-hidden />On the way · Arrived?</button>
                        ) : e.status === "ACTIVE" && e.owedQty > 0 ? (
                          <button type="button" disabled={!manage} onClick={() => setReceiving(e)} className="flex items-center gap-1.5 rounded-full border-2 border-violet-400 bg-violet-50 px-3 py-1.5 text-sm font-bold text-violet-900 hover:bg-violet-100"><Clock className="h-4 w-4" aria-hidden />Owes {e.owedQty}</button>
                        ) : e.status === "ACTIVE" ? <span className="flex items-center gap-1 text-green-700"><PackageCheck className="h-4 w-4" aria-hidden />Received</span> : null}
                        {e.status === "ACTIVE" && e.purpose === "RETAIL" && e.available > 0 && (
                          <button type="button" disabled={!manage} onClick={() => setSending(e)} className="mt-1 flex items-center gap-1.5 rounded-full border-2 border-sky-400 bg-sky-50 px-3 py-1.5 text-sm font-bold text-sky-900 hover:bg-sky-100"><Send className="h-4 w-4" aria-hidden />Send {e.available}</button>
                        )}
                        {e.status === "ACTIVE" && e.purpose === "RETAIL" && e.available > 0 && (
                          <button type="button" disabled={!manage} onClick={() => setRepacking(e)} className="mt-1 flex items-center gap-1.5 rounded-full border-2 border-emerald-400 bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-900 hover:bg-emerald-100"><Boxes className="h-4 w-4" aria-hidden />Make packs</button>
                        )}
                        {e.inTransit > 0 && <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-amber-700"><Truck className="h-3 w-3" aria-hidden />{e.inTransit} on the way to stores</span>}
                        {e.converted > 0 && <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-emerald-700"><Boxes className="h-3 w-3" aria-hidden />{e.converted} made into packs</span>}
                        {e.reserved > 0 && <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-violet-700"><Lock className="h-3 w-3" aria-hidden />{e.reserved} kept for customers</span>}
                      </td>
                      <td className="p-2">{e.status !== "CANCELLED" && <InvoiceButton entryId={e.id} hasInvoice={e.invoiceCount > 0} canUpload={manage} compact />}</td>
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
          <SuppliersPanel canManage={manage} />
          <h2 className="pt-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">What we bought from each supplier</h2>
          {vendorReport.isError ? <p role="alert" className="text-sm text-red-600">Could not load the vendor report.</p> : <VendorTable data={vendorReport.data} loading={vendorReport.isLoading} selected={reportVendor} onSelect={(id) => setReportVendor(id === reportVendor ? "" : id)} />}
        </>
      )}
      {tab === "reconciliation" && (recon.isError ? <p role="alert" className="text-sm text-red-600">Could not load the reconciliation.</p> : <ReconciliationTable data={recon.data} loading={recon.isLoading} />)}

      <RepackDialog entry={repacking} onOpenChange={(o) => !o && setRepacking(null)} />
      <DistributeDialog entry={sending} onOpenChange={(o) => !o && setSending(null)} />
      <ReceiveDialog entry={receiving} onOpenChange={(o) => !o && setReceiving(null)} />
      <NewRequirementDialog open={requesting} onOpenChange={setRequesting} conversationId={chatId} />
      <NewPurchaseDialog open={creating} onOpenChange={setCreating} onCreated={(id) => router.push(`/procurement/${id}`)} />
    </div>
  )
}
