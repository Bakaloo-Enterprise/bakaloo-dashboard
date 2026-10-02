"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { formatPct, formatRupees } from "./business-helpers"
import type { VendorReport } from "@/types/business.types"

/** Purchase quantity, value, average price and shortage / damage by vendor; click a vendor for its product mix. */
export function VendorTable({ data, loading, selected, onSelect }: { data?: VendorReport; loading?: boolean; selected?: string; onSelect: (id: string) => void }) {
  if (loading) return <Skeleton className="h-40 w-full" />
  if (!data || data.vendors.length === 0) return <p role="status" className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">No purchases in this period.</p>
  return (
    <div className="space-y-3">
      <p className="text-sm">Total purchased: <strong>{formatRupees(data.totalValue)}</strong></p>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr><th className="p-2">Vendor</th><th className="p-2 text-right">Purchases</th><th className="p-2 text-right">Products</th><th className="p-2 text-right">Received</th><th className="p-2 text-right">Short</th><th className="p-2 text-right">Damaged</th><th className="p-2 text-right">Value</th><th className="p-2 text-right">Avg price</th><th className="p-2 text-right">Share</th></tr>
          </thead>
          <tbody>
            {data.vendors.map((v) => (
              <tr key={v.vendorId} className={`cursor-pointer border-t hover:bg-muted/40 ${selected === v.vendorId ? "bg-muted/60" : ""}`} onClick={() => onSelect(v.vendorId)} aria-selected={selected === v.vendorId}>
                <td className="p-2 font-medium">{v.name}</td>
                <td className="p-2 text-right tabular-nums">{v.entries}</td><td className="p-2 text-right tabular-nums">{v.products}</td><td className="p-2 text-right tabular-nums">{v.receivedQty}</td>
                <td className={`p-2 text-right tabular-nums ${v.shortageQty ? "text-amber-700" : ""}`}>{v.shortageQty}</td><td className={`p-2 text-right tabular-nums ${v.damagedQty ? "text-red-700" : ""}`}>{v.damagedQty}</td>
                <td className="p-2 text-right tabular-nums">{formatRupees(v.purchaseValue)}</td><td className="p-2 text-right tabular-nums">{formatRupees(v.avgPrice)}</td><td className="p-2 text-right tabular-nums">{formatPct(v.sharePct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.products && (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <caption className="p-2 text-left text-xs text-muted-foreground">Products bought from this vendor</caption>
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="p-2">Product</th><th className="p-2 text-right">Received</th><th className="p-2 text-right">Damaged</th><th className="p-2 text-right">Value</th><th className="p-2 text-right">Avg price</th><th className="p-2 text-right">Last price</th></tr></thead>
            <tbody>
              {data.products.map((p) => (
                <tr key={p.productId} className="border-t"><td className="p-2">{p.name}</td><td className="p-2 text-right tabular-nums">{p.receivedQty}</td><td className="p-2 text-right tabular-nums">{p.damagedQty}</td><td className="p-2 text-right tabular-nums">{formatRupees(p.purchaseValue)}</td><td className="p-2 text-right tabular-nums">{formatRupees(p.avgPrice)}</td><td className="p-2 text-right tabular-nums">{formatRupees(p.lastUnitPrice)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
