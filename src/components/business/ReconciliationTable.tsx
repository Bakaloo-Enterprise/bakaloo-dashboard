"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { formatRupees } from "./business-helpers"
import type { Reconciliation } from "@/types/business.types"

/** Procured → sent to stores → sold → remaining → returned / damaged / adjusted, with purchase cost beside sales value. */
export function ReconciliationTable({ data, loading }: { data?: Reconciliation; loading?: boolean }) {
  if (loading) return <Skeleton className="h-40 w-full" />
  if (!data || data.products.length === 0) return <p role="status" className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">No purchases in this period.</p>
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{data.note}</p>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-2">Product</th><th className="p-2 text-right">Procured</th><th className="p-2 text-right">Damaged at door</th><th className="p-2 text-right">Sent to stores</th>
              <th className="p-2 text-right">Returned / lost (central)</th><th className="p-2 text-right">Still central</th><th className="p-2 text-right">Written off at stores</th>
              <th className="p-2 text-right">Sold</th><th className="p-2 text-right">In stores now</th><th className="p-2 text-right">Purchase cost</th><th className="p-2 text-right">Sales value</th><th className="p-2 text-right">Loss value</th>
            </tr>
          </thead>
          <tbody>
            {data.products.map((p) => (
              <tr key={p.productId} className="border-t">
                <td className="p-2 font-medium">{p.name}</td>
                <td className="p-2 text-right tabular-nums">{p.received}</td>
                <td className="p-2 text-right tabular-nums">{p.damagedAtDoor}</td>
                <td className="p-2 text-right tabular-nums">{p.allocated}</td>
                <td className="p-2 text-right tabular-nums">{p.centralAdjusted}</td>
                <td className="p-2 text-right tabular-nums">{p.availableCentral}</td>
                <td className="p-2 text-right tabular-nums">{p.storeAdjusted}</td>
                <td className="p-2 text-right tabular-nums">{p.soldQty}</td>
                <td className="p-2 text-right tabular-nums">{p.storeStockNow}</td>
                <td className="p-2 text-right tabular-nums">{formatRupees(p.purchaseCost)}</td>
                <td className="p-2 text-right tabular-nums">{formatRupees(p.salesValue)}</td>
                <td className={`p-2 text-right tabular-nums ${p.lossValue > 0 ? "text-red-700" : ""}`}>{formatRupees(p.lossValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
