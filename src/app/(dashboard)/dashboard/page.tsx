"use client"

import dynamic from "next/dynamic"
import { useState } from "react"
import Link from "next/link"
import { ArrowRight, RefreshCw, ShoppingCart, IndianRupee, RotateCcw, TrendingUp } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PendingActions } from "@/components/dashboard/PendingActions"
import { RecentOrders } from "@/components/dashboard/RecentOrders"
import { LowStockAlerts } from "@/components/dashboard/LowStockAlerts"
import { OverviewKpis, rangeText } from "@/components/erp/overview/OverviewKpis"
import { LiveOps } from "@/components/erp/overview/LiveOps"
import { TrendPanel } from "@/components/erp/overview/TrendPanel"
import { CategoryPanel, ChannelPanel, HoursPanel } from "@/components/erp/overview/MixPanels"
import { TopProductsPanel } from "@/components/erp/overview/TopProductsPanel"
import { Segmented, Tile } from "@/components/erp/kit"
import { useOverview, useRecentOrders } from "@/hooks/useDashboard"
import { useAbandonedCartsSummary } from "@/hooks/useAbandonedCarts"
import { formatShort, formatNumberShort } from "@/lib/utils"
import type { OverviewPeriod } from "@/types/overview.types"

// Heavy map — no SSR
const LiveRiderMap = dynamic(() => import("@/components/dashboard/LiveRiderMap").then((m) => m.LiveRiderMap), {
  ssr: false,
  loading: () => <div className="rounded-xl border bg-card p-5"><div className="h-[300px] animate-shimmer rounded-lg" /></div>,
})

const PERIODS: Array<{ id: OverviewPeriod; label: string }> = [
  { id: "today", label: "Today" },
  { id: "week", label: "7 days" },
  { id: "month", label: "30 days" },
  { id: "year", label: "Year" },
]

function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading overview">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-44 rounded-2xl md:col-span-2" /><Skeleton className="h-44 rounded-2xl" /><Skeleton className="h-44 rounded-2xl" />
      </div>
      <Skeleton className="h-[380px] rounded-2xl" />
    </div>
  )
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<OverviewPeriod>("week")
  const { data, isLoading, isError, isFetching, refetch, dataUpdatedAt } = useOverview(period)
  const { data: recentOrders, isLoading: ordersLoading } = useRecentOrders(10)
  const { data: abandoned } = useAbandonedCartsSummary()

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <PageHeader title="Command Center" subtitle={data ? `${rangeText(data)} · compared with the ${data.days === 1 ? "day" : `${data.days} days`} before` : "How the business is doing"} />
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<OverviewPeriod> label="Period" value={period} onChange={setPeriod} options={PERIODS} />
          <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={() => refetch()} aria-label="Refresh numbers" title={dataUpdatedAt ? `Updated ${new Date(dataUpdatedAt).toLocaleTimeString("en-IN")}` : "Refresh"}>
            <RefreshCw className={isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden />
          </Button>
        </div>
      </div>

      {isLoading ? <Loading /> : isError || !data ? (
        <div role="alert" className="rounded-2xl border border-rose-300 bg-rose-50 p-6 text-sm text-rose-900 dark:bg-rose-500/10 dark:text-rose-200">
          Could not load the numbers. <button type="button" className="font-semibold underline" onClick={() => refetch()}>Try again</button>
        </div>
      ) : (
        <>
          <LiveOps d={data} />
          <OverviewKpis d={data} />
          <TrendPanel d={data} />

          <div className="grid gap-4 lg:grid-cols-3">
            <ChannelPanel d={data} />
            <CategoryPanel d={data} />
            <HoursPanel d={data} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <TopProductsPanel d={data} />
            <PendingActions />
          </div>

          {abandoned && (
            <Link href="/abandoned-carts" className="block">
              <div className="rounded-2xl border bg-card p-4 shadow-sm transition-colors hover:border-emerald-400/60">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold"><ShoppingCart className="h-4 w-4 text-emerald-600" aria-hidden />Carts left behind</h3>
                  <span className="inline-flex items-center text-xs font-medium text-emerald-600">See all <ArrowRight className="ml-1 h-3 w-3" aria-hidden /></span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Tile tone="green" icon={<ShoppingCart className="h-5 w-5" />} label="Open" value={formatNumberShort(abandoned.openCount)} />
                  <Tile tone="amber" icon={<IndianRupee className="h-5 w-5" />} label="At risk" value={formatShort(abandoned.openValue)} />
                  <Tile tone="blue" icon={<RotateCcw className="h-5 w-5" />} label="Won back today" value={formatNumberShort(abandoned.recoveredToday)} />
                  <Tile tone="violet" icon={<TrendingUp className="h-5 w-5" />} label="7-day win-back" value={`${(abandoned.recoveryRate7d * 100).toFixed(0)}%`} />
                </div>
              </div>
            </Link>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <RecentOrders data={recentOrders} isLoading={ordersLoading} />
            <LowStockAlerts />
          </div>
          <LiveRiderMap />

          <details className="rounded-2xl border bg-card p-4 text-sm">
            <summary className="cursor-pointer font-medium">How these numbers are worked out</summary>
            <dl className="mt-3 space-y-2">
              {Object.entries(data.definitions).map(([k, v]) => (
                <div key={k}><dt className="inline font-semibold">{k}: </dt><dd className="inline text-muted-foreground">{v}</dd></div>
              ))}
            </dl>
          </details>
        </>
      )}
    </div>
  )
}
