"use client"

/**
 * HQ Dashboard page (task 20.1) — KPI summary across all shops.
 *
 * Uses cached HQ report endpoints via `useHQDashboard` hook.
 * Only accessible to Super_Admin users.
 */

import {
  IndianRupee,
  ShoppingCart,
  Store,
  Users,
  Bike,
  TrendingUp,
  TrendingDown,
  Clock,
  Activity,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/PageHeader"
import { ErrorBlock } from "@/components/shared/error-block"
import { useHQDashboard } from "@/hooks/useHQ"
import { cn } from "@/lib/utils"

function formatCurrency(value: number): string {
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(1)}Cr`
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(1)}L`
  if (value >= 1_000) return `₹${(value / 1_000).toFixed(1)}K`
  return `₹${value.toFixed(0)}`
}

function formatNumber(value: number): string {
  if (value >= 100_000) return `${(value / 100_000).toFixed(1)}L`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString()
}

interface KPICardProps {
  label: string
  value: string
  change?: number
  icon: React.ReactNode
  variant?: "primary" | "default"
}

function KPICard({ label, value, change, icon, variant = "default" }: KPICardProps) {
  return (
    <Card className={cn(variant === "primary" && "border-brand-200 bg-brand-50/50")}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold tabular-nums">{value}</p>
            {change !== undefined && (
              <div className="flex items-center gap-1">
                {change >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span
                  className={cn(
                    "text-xs font-medium",
                    change >= 0 ? "text-emerald-600" : "text-red-500",
                  )}
                >
                  {change >= 0 ? "+" : ""}
                  {change.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg",
              variant === "primary"
                ? "bg-brand-500 text-white"
                : "bg-muted text-muted-foreground",
            )}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function KPILoadingSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-3 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default function HQDashboardPage() {
  const { data: kpis, isLoading, isError, error, refetch } = useHQDashboard()

  return (
    <div className="space-y-6">
      <PageHeader
        title="HQ Dashboard"
        subtitle="Cross-shop performance overview"
      />

      {isLoading ? (
        <KPILoadingSkeleton />
      ) : isError ? (
        <ErrorBlock
          message={(error as Error)?.message ?? "Failed to load dashboard"}
          onRetry={() => void refetch()}
        />
      ) : kpis ? (
        <>
          {/* Primary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <KPICard
              label="Total Revenue (after refunds)"
              value={formatCurrency(kpis.totalRevenue)}
              icon={<IndianRupee className="h-5 w-5" />}
              variant="primary"
            />
            <KPICard
              label="Total Orders (not cancelled or refunded)"
              value={formatNumber(kpis.totalOrders)}
              icon={<ShoppingCart className="h-5 w-5" />}
            />
            <KPICard
              label="Today's Revenue (vs yesterday)"
              value={formatCurrency(kpis.todayRevenue)}
              change={kpis.revenueChange}
              icon={<IndianRupee className="h-5 w-5" />}
            />
            <KPICard
              label="Today's Orders (vs yesterday)"
              value={formatNumber(kpis.todayOrders)}
              change={kpis.ordersChange}
              icon={<Activity className="h-5 w-5" />}
            />
          </div>

          {/* Secondary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <KPICard
              label="Total Shops"
              value={formatNumber(kpis.totalShops)}
              icon={<Store className="h-5 w-5" />}
            />
            <KPICard
              label="Active Shops"
              value={formatNumber(kpis.activeShops)}
              icon={<Store className="h-5 w-5" />}
            />
            <KPICard
              label="Customers who bought"
              value={formatNumber(kpis.totalCustomers)}
              icon={<Users className="h-5 w-5" />}
            />
            <KPICard
              label="Online Riders"
              value={`${kpis.onlineRiders} / ${kpis.totalRiders}`}
              icon={<Bike className="h-5 w-5" />}
            />
            <KPICard
              label="New orders to accept"
              value={formatNumber(kpis.pendingOrders)}
              icon={<Clock className="h-5 w-5" />}
            />
          </div>

          {/* Avg Order Value */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Average Order Value (all time)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums">
                {formatCurrency(kpis.avgOrderValue)}
              </p>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}
