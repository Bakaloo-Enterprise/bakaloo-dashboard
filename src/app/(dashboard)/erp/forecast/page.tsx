"use client"

import { useState } from "react"
import Link from "next/link"
import { AlertOctagon, ArrowRight, ShoppingCart, Target, Trash2 } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { Skeleton } from "@/components/ui/skeleton"
import { ErpGuard } from "@/components/erp/ErpGuard"
import { ShopSelect } from "@/components/erp/ShopSelect"
import { ForecastTable } from "@/components/erp/ops/ForecastTable"
import { Segmented, Tile } from "@/components/erp/kit"
import { count, inr, pctText } from "@/components/erp/format"
import { useForecast } from "@/hooks/useErp"

function Body() {
  const [shopId, setShopId] = useState("")
  const [cover, setCover] = useState<"1" | "2" | "3">("1")
  const q = useForecast({ shopId, cover: Number(cover), horizon: 7 })
  const f = q.data
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <PageHeader title="Forecast" subtitle="What will sell, how long stock lasts, and what to buy — worked out from your real sales." />
        <div className="flex flex-wrap items-center gap-2">
          <ShopSelect value={shopId} onChange={setShopId} />
          <Segmented<"1" | "2" | "3"> label="Days to cover" value={cover} onChange={setCover} options={[{ id: "1", label: "1 day" }, { id: "2", label: "2 days" }, { id: "3", label: "3 days" }]} />
        </div>
      </div>
      {q.isLoading ? <div className="space-y-4"><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div><Skeleton className="h-96 rounded-2xl" /></div>
        : q.isError || !f ? <p role="alert" className="rounded-2xl border border-rose-300 bg-rose-50 p-6 text-sm text-rose-900 dark:bg-rose-500/10 dark:text-rose-200">Could not load the forecast. <button type="button" className="font-semibold underline" onClick={() => q.refetch()}>Try again</button></p>
        : (
          <>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Tile big tone="green" icon={<ShoppingCart className="h-5 w-5" />} label="To buy" value={count(f.totals.toBuy)} sub={`about ${inr(f.totals.buyValue)} of stock`} />
              <Tile tone={f.totals.urgent > 0 ? "rose" : "slate"} icon={<AlertOctagon className="h-5 w-5" />} label="Runs out today" value={count(f.totals.urgent)} sub="shelf empties before closing" />
              <Tile tone="violet" icon={<Trash2 className="h-5 w-5" />} label="May spoil" value={count(f.totals.willSpoil)} sub="more stock than will sell in time" />
              <Tile tone="blue" icon={<Target className="h-5 w-5" />} label="How right we were" value={pctText(f.accuracy.accuracyPct, 0)} sub="last 7 days, replayed" help={f.definitions.accuracy} />
            </div>
            <ForecastTable f={f} />
            <Link href="/procurement" className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400">Plan and record the purchase in Procurement <ArrowRight className="h-4 w-4" aria-hidden /></Link>
          </>
        )}
    </div>
  )
}

export default function ForecastPage() {
  return <ErpGuard>{() => <Body />}</ErpGuard>
}
