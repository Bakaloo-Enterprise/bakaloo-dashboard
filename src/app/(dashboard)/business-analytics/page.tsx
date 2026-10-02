"use client"

import dynamic from "next/dynamic"
import { useState } from "react"
import { PageHeader } from "@/components/shared/PageHeader"
import { Forbidden } from "@/components/shared/forbidden"
import { Skeleton } from "@/components/ui/skeleton"
import { PeriodBar, type PeriodState } from "@/components/business/PeriodBar"
import { ReconciliationTable } from "@/components/business/ReconciliationTable"
import { VendorTable } from "@/components/business/VendorTable"
import { CARD_HELP, formatCount, formatPct, formatRupees, periodProblem, toFilters, toPeriodQuery } from "@/components/business/business-helpers"
import { useBizMe, useChannels, useOverview, useTopCustomers, useTopProducts, useStorePerf, useAnalyticsVendors, useAnalyticsReconciliation } from "@/hooks/useBusiness"
import { cn } from "@/lib/utils"

const DailyGross = dynamic(() => import("@/components/business/DailyGross"), { ssr: false, loading: () => <Skeleton className="h-60 w-full" /> })

type Tab = "overview" | "products" | "customers" | "stores" | "channels" | "vendors" | "reconciliation"
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" }, { id: "products", label: "Top products" }, { id: "customers", label: "Top customers" }, { id: "stores", label: "Stores" },
  { id: "channels", label: "B2B vs B2C" }, { id: "vendors", label: "Vendors & purchases" }, { id: "reconciliation", label: "Procurement reconciliation" },
]
const Empty = ({ children }: { children: React.ReactNode }) => <p role="status" className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{children}</p>
const Err = () => <p role="alert" className="text-sm text-red-600">Could not load this report. Try again.</p>

export default function BusinessAnalyticsPage() {
  const me = useBizMe()
  const [tab, setTab] = useState<Tab>("overview")
  const [period, setPeriod] = useState<PeriodState>({ period: "30d" })
  const [shopId, setShopId] = useState("")
  const [channel, setChannel] = useState("ALL")
  const [sort, setSort] = useState("revenue")
  const [vendorId, setVendorId] = useState("")

  const allowed = Boolean(me.data?.analyticsBusiness)
  const ok = allowed && !periodProblem(period)
  const f = toFilters(period, shopId, channel)
  const overview = useOverview(f, ok && tab === "overview")
  const products = useTopProducts({ ...f, sort }, ok && tab === "products")
  const customers = useTopCustomers(f, ok && tab === "customers")
  const stores = useStorePerf(f, ok && tab === "stores")
  const channels = useChannels(f, ok && tab === "channels")
  const vendors = useAnalyticsVendors({ ...toPeriodQuery(period), ...(vendorId ? { vendorId } : {}) }, ok && tab === "vendors")
  const recon = useAnalyticsReconciliation(toPeriodQuery(period), ok && tab === "reconciliation")

  if (me.isLoading) return <Skeleton className="h-40 w-full" />
  if (!allowed) return <Forbidden />
  const showShop = tab !== "vendors" && tab !== "reconciliation"
  const showChannel = tab !== "vendors" && tab !== "reconciliation" && tab !== "channels"

  return (
    <div className="space-y-5">
      <PageHeader title="Business Analytics" subtitle="Sales, what it cost, what we earned, and where money or stock is leaking." />
      <PeriodBar value={period} onChange={setPeriod} shopId={showShop ? shopId : undefined} onShop={showShop ? setShopId : undefined} channel={channel} onChannel={showChannel ? setChannel : undefined} />

      <div className="flex flex-wrap gap-1 border-b" role="tablist" aria-label="Reports">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cn("-mb-px border-b-2 px-3 py-2 text-sm", tab === t.id ? "border-primary font-semibold" : "border-transparent text-muted-foreground hover:text-foreground")}>{t.label}</button>
        ))}
      </div>

      {ok && (
        <div role="tabpanel" aria-label={TABS.find((t) => t.id === tab)?.label} className="space-y-4">
          {tab === "overview" && (overview.isLoading ? <Skeleton className="h-64 w-full" /> : overview.isError || !overview.data ? <Err /> : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {CARD_HELP.map((c) => (
                  <div key={c.key} className="rounded-lg border p-3" title={overview.data.definitions[c.def]}>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{c.label}</p>
                    <p className={cn("mt-1 text-xl font-semibold tabular-nums", c.tone === "bad" && overview.data.cards[c.key] > 0 && "text-red-700")}>{formatRupees(overview.data.cards[c.key])}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground" role="status">
                {formatCount(overview.data.counts.orders)} orders · {formatCount(overview.data.counts.customers)} customers · average order {formatRupees(overview.data.avgOrderValue)} · {overview.data.counts.purchases} purchase(s) recorded
              </p>
              {overview.data.warnings.map((w) => <p key={w} role="status" className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">{w}</p>)}
              {overview.data.series.length > 0 ? <DailyGross data={overview.data.series} /> : <Empty>No orders in this period.</Empty>}
              {overview.data.cards.trackedLoss > 0 && (
                <p className="text-xs text-muted-foreground">
                  Tracked loss: damaged at receiving {formatRupees(overview.data.lossBreakdown.damagedAtReceiving)} · damage / wastage / adjustments {formatRupees(overview.data.lossBreakdown.procurementAdjustments)} · written off at stores {formatRupees(overview.data.lossBreakdown.storeDamage)}
                </p>
              )}
              <details className="rounded-md border p-3 text-xs">
                <summary className="cursor-pointer font-medium">How these numbers are worked out</summary>
                <dl className="mt-2 space-y-1.5">
                  {Object.entries(overview.data.definitions).map(([k, v]) => <div key={k}><dt className="inline font-semibold">{k}: </dt><dd className="inline text-muted-foreground">{v}</dd></div>)}
                </dl>
              </details>
            </>
          ))}

          {tab === "products" && (
            <>
              <div className="flex gap-1" role="group" aria-label="Rank by">
                {[["revenue", "Revenue"], ["units", "Units sold"], ["trending", "Trending (growth)"]].map(([id, label]) => (
                  <button key={id} type="button" aria-pressed={sort === id} onClick={() => setSort(id)} className={cn("rounded-full border px-3 py-1 text-xs", sort === id ? "border-primary bg-primary/10 font-semibold" : "hover:bg-muted")}>{label}</button>
                ))}
              </div>
              {products.isLoading ? <Skeleton className="h-40 w-full" /> : products.isError || !products.data ? <Err /> : products.data.items.length === 0 ? <Empty>No sales in this period.</Empty> : (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="p-2">Product</th><th className="p-2 text-right">Units</th><th className="p-2 text-right">Revenue</th><th className="p-2 text-right">Orders</th><th className="p-2 text-right">Buyers</th><th className="p-2 text-right">Repeat buyers</th><th className="p-2 text-right">Growth</th></tr></thead>
                    <tbody>
                      {products.data.items.map((p) => (
                        <tr key={p.productId} className="border-t">
                          <td className="p-2 font-medium">{p.name}{p.sku && <span className="ml-1 text-xs text-muted-foreground">{p.sku}</span>}</td>
                          <td className="p-2 text-right tabular-nums">{p.units}</td><td className="p-2 text-right tabular-nums">{formatRupees(p.revenue)}</td><td className="p-2 text-right tabular-nums">{p.orders}</td>
                          <td className="p-2 text-right tabular-nums">{p.buyers}</td><td className="p-2 text-right tabular-nums">{p.repeatBuyers} ({formatPct(p.repeatRatePct)})</td>
                          <td className={cn("p-2 text-right tabular-nums", (p.growthPct ?? 0) < 0 && "text-red-700")}>{p.isNew ? "New" : formatPct(p.growthPct)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {tab === "customers" && (customers.isLoading ? <Skeleton className="h-40 w-full" /> : customers.isError || !customers.data ? <Err /> : (
            <>
              <p className="text-sm" role="status">{customers.data.summary.customers} customers · {customers.data.summary.repeatCustomers} repeat ({formatPct(customers.data.summary.repeatRatePct)})</p>
              {customers.data.items.length === 0 ? <Empty>No customers in this period.</Empty> : (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="p-2">Customer</th><th className="p-2">Type</th><th className="p-2 text-right">Orders</th><th className="p-2 text-right">Spend</th><th className="p-2 text-right">Avg order</th><th className="p-2">Repeat</th><th className="p-2">Last order</th></tr></thead>
                    <tbody>
                      {customers.data.items.map((c) => (
                        <tr key={c.userId} className="border-t">
                          <td className="p-2"><span className="font-medium">{c.company ?? c.name ?? "—"}</span>{c.phone && <span className="ml-1 text-xs text-muted-foreground">{c.phone}</span>}</td>
                          <td className="p-2">{c.channel}</td><td className="p-2 text-right tabular-nums">{c.orders}</td><td className="p-2 text-right tabular-nums">{formatRupees(c.spend)}</td><td className="p-2 text-right tabular-nums">{formatRupees(c.avgOrderValue)}</td>
                          <td className="p-2">{c.isRepeat ? "Yes" : "No"}</td><td className="p-2 text-xs text-muted-foreground">{new Date(c.lastOrderAt).toLocaleDateString("en-IN")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-xs text-muted-foreground">{customers.data.note}</p>
            </>
          ))}

          {tab === "stores" && (stores.isLoading ? <Skeleton className="h-40 w-full" /> : stores.isError || !stores.data ? <Err /> : stores.data.items.length === 0 ? <Empty>No active stores.</Empty> : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="p-2">Store</th><th className="p-2 text-right">Orders</th><th className="p-2 text-right">Sales</th><th className="p-2 text-right">Avg order</th><th className="p-2 text-right">Units</th><th className="p-2 text-right">Refunds</th><th className="p-2 text-right">Returns</th><th className="p-2 text-right">Cancelled</th><th className="p-2 text-right">Fulfilment (min)</th><th className="p-2 text-right">Stock in / sold / damaged</th></tr></thead>
                <tbody>
                  {stores.data.items.map((s) => (
                    <tr key={s.shopId} className="border-t">
                      <td className="p-2 font-medium">{s.name}<span className="ml-1 text-xs text-muted-foreground">{s.branchCode}</span></td>
                      <td className="p-2 text-right tabular-nums">{s.orders}</td><td className="p-2 text-right tabular-nums">{formatRupees(s.sales)}</td><td className="p-2 text-right tabular-nums">{formatRupees(s.avgOrderValue)}</td><td className="p-2 text-right tabular-nums">{s.unitsSold}</td>
                      <td className="p-2 text-right tabular-nums">{formatRupees(s.refunds)}</td><td className="p-2 text-right tabular-nums">{formatRupees(s.returns)}</td>
                      <td className="p-2 text-right tabular-nums">{s.cancelledOrders} ({formatRupees(s.cancelledValue)})</td><td className="p-2 text-right tabular-nums">{s.avgFulfillmentMinutes ?? "—"}</td>
                      <td className="p-2 text-right tabular-nums">{s.stock.receivedUnits} / {s.stock.soldUnits} / {s.stock.damagedUnits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {tab === "channels" && (channels.isLoading ? <Skeleton className="h-40 w-full" /> : channels.isError || !channels.data ? <Err /> : (
            <>
              <p className="text-sm" role="status">B2B share of sales: <strong>{formatPct(channels.data.b2bSharePct)}</strong></p>
              <div className="grid gap-4 md:grid-cols-2">
                {(["B2B", "B2C"] as const).map((k) => {
                  const c = channels.data![k]
                  return (
                    <section key={k} aria-label={k} className="rounded-lg border p-4">
                      <h3 className="font-semibold">{k === "B2B" ? "Business (B2B)" : "Retail (B2C)"}</h3>
                      <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                        <div><dt className="text-xs text-muted-foreground">Orders</dt><dd className="font-semibold tabular-nums">{c.orders}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Sales</dt><dd className="font-semibold tabular-nums">{formatRupees(c.sales)}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Average order</dt><dd className="font-semibold tabular-nums">{formatRupees(c.avgOrderValue)}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Customers</dt><dd className="font-semibold tabular-nums">{c.customers}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Value per customer</dt><dd className="font-semibold tabular-nums">{formatRupees(c.valuePerCustomer)}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Repeat rate</dt><dd className="font-semibold tabular-nums">{formatPct(c.repeatRatePct)}</dd></div>
                      </dl>
                      <h4 className="mt-3 text-xs font-semibold text-muted-foreground">Top products</h4>
                      <ul className="text-sm">{c.topProducts.length === 0 ? <li className="text-muted-foreground">None</li> : c.topProducts.map((p) => <li key={p.productId}>{p.name} — {p.units} units, {formatRupees(p.revenue)}</li>)}</ul>
                    </section>
                  )
                })}
              </div>
            </>
          ))}

          {tab === "vendors" && (vendors.isError ? <Err /> : <VendorTable data={vendors.data} loading={vendors.isLoading} selected={vendorId} onSelect={(id) => setVendorId(id === vendorId ? "" : id)} />)}
          {tab === "reconciliation" && (recon.isError ? <Err /> : <ReconciliationTable data={recon.data} loading={recon.isLoading} />)}
        </div>
      )}
    </div>
  )
}
