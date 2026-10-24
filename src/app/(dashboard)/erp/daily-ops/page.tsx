"use client"

import { useState } from "react"
import { AlertTriangle, ChevronLeft, ChevronRight, Flame, IndianRupee, PackagePlus, PiggyBank, ShoppingBasket, Trash2 } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ErpGuard } from "@/components/erp/ErpGuard"
import { ShopSelect } from "@/components/erp/ShopSelect"
import { DayCloseTable } from "@/components/erp/ops/DayCloseTable"
import { LogWastageDialog } from "@/components/erp/ops/LogWastageDialog"
import { Tile } from "@/components/erp/kit"
import { count, dayLabel, inr, pctText } from "@/components/erp/format"
import { useDayClose } from "@/hooks/useErp"
import { addDays, istToday } from "@/components/business/business-helpers"

function Body({ manage }: { manage: boolean }) {
  const today = istToday()
  const [date, setDate] = useState(today)
  const [shopId, setShopId] = useState("")
  const [logging, setLogging] = useState(false)
  const q = useDayClose({ date, shopId })
  const d = q.data
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <PageHeader title="Daily Ops" subtitle="Close the day: what we had, bought, sold and lost — and whether the prices earned their keep." />
        <div className="flex flex-wrap items-center gap-2">
          <ShopSelect value={shopId} onChange={setShopId} />
          <div className="inline-flex items-center rounded-xl border bg-card shadow-sm">
            <Button type="button" variant="ghost" size="icon" className="h-10 w-10" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}><ChevronLeft className="h-4 w-4" /></Button>
            <Input type="date" aria-label="Day" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-10 w-[150px] border-0 bg-transparent text-center shadow-none focus-visible:ring-0" />
            <Button type="button" variant="ghost" size="icon" className="h-10 w-10" aria-label="Next day" disabled={date >= today} onClick={() => setDate(addDays(date, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          {date !== today && <Button type="button" variant="outline" className="h-10 rounded-xl" onClick={() => setDate(today)}>Today</Button>}
          {manage && <Button type="button" className="h-10 rounded-xl" onClick={() => setLogging(true)}><Trash2 className="mr-1.5 h-4 w-4" aria-hidden />Log wastage</Button>}
        </div>
      </div>

      {q.isLoading ? (
        <div className="space-y-4"><div className="grid grid-cols-2 gap-3 md:grid-cols-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div><Skeleton className="h-96 rounded-2xl" /></div>
      ) : q.isError || !d ? (
        <p role="alert" className="rounded-2xl border border-rose-300 bg-rose-50 p-6 text-sm text-rose-900 dark:bg-rose-500/10 dark:text-rose-200">Could not load this day. <button type="button" className="font-semibold underline" onClick={() => q.refetch()}>Try again</button></p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{dayLabel(d.date)}{d.inProgress ? " · today is still running, so these numbers keep moving" : ""}</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <Tile tone="green" icon={<IndianRupee className="h-5 w-5" />} label="Sales" value={inr(d.totals.revenue)} sub={`${count(d.totals.unitsSold)} items sold`} help={d.definitions.revenue} />
            <Tile tone="amber" icon={<ShoppingBasket className="h-5 w-5" />} label="Cost of those" value={inr(d.totals.cogs)} sub="what we paid for them" help={d.definitions.cogs} />
            <Tile tone="rose" icon={<Flame className="h-5 w-5" />} label="Lost" value={inr(d.totals.wasteValue)} sub={`${count(d.totals.unitsWasted)} items spoiled`} help={d.definitions.wasted} />
            <Tile tone={d.totals.profit < 0 ? "rose" : "violet"} icon={<PiggyBank className="h-5 w-5" />} label="Profit" value={inr(d.totals.profit)} sub={`${pctText(d.totals.marginPct, 1)} of sales`} help={d.definitions.profit} />
            <Tile tone="blue" icon={<PackagePlus className="h-5 w-5" />} label="Bought" value={inr(d.totals.purchaseSpend)} sub={d.totals.doorDamageValue > 0 ? `${inr(d.totals.doorDamageValue)} damaged at the door` : "stock bought today"} />
          </div>

          {(d.ledger.gaps > 0 || d.raise > 0) && (
            <div className="grid gap-3 md:grid-cols-2">
              {d.raise > 0 && <div className="flex items-start gap-3 rounded-2xl border border-amber-300/60 bg-amber-50 p-4 text-sm dark:bg-amber-500/10"><span className="mt-0.5 rounded-lg bg-amber-500/20 p-1.5 text-amber-700 dark:text-amber-300"><IndianRupee className="h-4 w-4" aria-hidden /></span><p><b>{d.raise} product{d.raise > 1 ? "s" : ""} sell below the price that earns your target profit</b> once spoilage is paid for. See “Fix the price” below.</p></div>}
              {d.ledger.gaps > 0 && <div className="flex items-start gap-3 rounded-2xl border border-rose-300/60 bg-rose-50 p-4 text-sm dark:bg-rose-500/10"><span className="mt-0.5 rounded-lg bg-rose-500/20 p-1.5 text-rose-700 dark:text-rose-300"><AlertTriangle className="h-4 w-4" aria-hidden /></span><p><b>{d.ledger.gaps} product{d.ledger.gaps > 1 ? "s" : ""} where the stock records don’t add up</b> ({d.ledger.items.slice(0, 3).map((x) => x.name).join(", ")}). Someone changed stock without a record.</p></div>}
            </div>
          )}
          <DayCloseTable items={d.items} manage={manage} />
          <details className="rounded-2xl border bg-card p-4 text-sm"><summary className="cursor-pointer font-medium">How these numbers are worked out</summary>
            <dl className="mt-3 space-y-2">{Object.entries(d.definitions).map(([k, v]) => <div key={k}><dt className="inline font-semibold">{k}: </dt><dd className="inline text-muted-foreground">{v}</dd></div>)}</dl></details>
        </>
      )}
      <LogWastageDialog open={logging} onClose={() => setLogging(false)} defaultShopId={shopId} />
    </div>
  )
}

export default function DailyOpsPage() {
  return <ErpGuard>{(manage) => <Body manage={manage} />}</ErpGuard>
}
