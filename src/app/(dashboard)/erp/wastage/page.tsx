"use client"

import { useState } from "react"
import { AlertTriangle, Flame, PackageX, Percent, Truck } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { Skeleton } from "@/components/ui/skeleton"
import { PeriodBar, type PeriodState } from "@/components/business/PeriodBar"
import { periodProblem, toPeriodQuery } from "@/components/business/business-helpers"
import { ErpGuard } from "@/components/erp/ErpGuard"
import { DailyLoss, DoorDamage, Heatmap, ProductLoss, ReasonPanel } from "@/components/erp/ops/WastagePanels"
import { Tile } from "@/components/erp/kit"
import { count, inr, pctText } from "@/components/erp/format"
import { useWastage } from "@/hooks/useErp"

function Body() {
  const [period, setPeriod] = useState<PeriodState>({ period: "30d" })
  const [shopId, setShopId] = useState("")
  const ok = !periodProblem(period)
  const q = useWastage({ ...toPeriodQuery(period), ...(shopId ? { shopId } : {}) }, ok)
  const w = q.data
  return (
    <div className="space-y-5">
      <PageHeader title="Wastage Lab" subtitle="Where the money is going bad — and what to do about it." />
      <PeriodBar value={period} onChange={setPeriod} shopId={shopId} onShop={setShopId} />
      {q.isLoading ? <div className="space-y-4"><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div><Skeleton className="h-72 rounded-2xl" /></div>
        : q.isError || !w ? <p role="alert" className="rounded-2xl border border-rose-300 bg-rose-50 p-6 text-sm text-rose-900 dark:bg-rose-500/10 dark:text-rose-200">Could not load wastage. <button type="button" className="font-semibold underline" onClick={() => q.refetch()}>Try again</button></p>
        : (
          <>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Tile big tone="rose" icon={<Flame className="h-5 w-5" />} label="Money lost" value={inr(w.totals.value)} sub={`${count(w.totals.qty)} items · ${inr(w.totals.perDay)} a day`} help={w.definitions.wasted} />
              <Tile tone="amber" icon={<Percent className="h-5 w-5" />} label="Of all stock" value={pctText(w.totals.wastePct, 1)} sub={`of ${count(w.totals.handled)} items handled`} />
              <Tile tone={w.breaches > 0 ? "rose" : "green"} icon={<AlertTriangle className="h-5 w-5" />} label="Too high" value={count(w.breaches)} sub="products over their target" />
              <Tile tone="blue" icon={<Truck className="h-5 w-5" />} label="Broken at the door" value={inr(w.totals.doorDamageValue)} sub="found when purchases arrived" />
            </div>
            <div className="grid gap-4 lg:grid-cols-3"><div className="lg:col-span-2"><DailyLoss w={w} /></div><ReasonPanel w={w} /></div>
            <Heatmap w={w} />
            <div className="grid gap-4 lg:grid-cols-2"><ProductLoss w={w} /><DoorDamage w={w} /></div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><PackageX className="h-3.5 w-3.5" aria-hidden />Loss is valued at the price we paid for that stock (the last purchase before it was written off).</p>
          </>
        )}
    </div>
  )
}

export default function WastagePage() {
  return <ErpGuard>{() => <Body />}</ErpGuard>
}
