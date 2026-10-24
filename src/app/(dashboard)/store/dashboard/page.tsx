"use client"

/**
 * Store Dashboard — task 21.1
 * Today's KPIs, low-stock badge (polling 60s), recent orders for the active shop.
 */

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import {
  AlertTriangle,
  ArrowRight,
  DollarSign,
  Loader2,
  Package,
  ShoppingCart,
  TrendingUp,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyShopState } from "@/components/shared/empty-shop-state"
import { ErrorBlock } from "@/components/shared/error-block"
import { useIsSuperAdmin, useShopContext } from "@/hooks/useShopContext"
import { storeDashboardService } from "@/services/store-dashboard.service"
import { shopInventoryService } from "@/services/shop-inventory.service"
import { formatCurrency } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export default function StoreDashboardPage() {
  const { activeShopId, mode, shopMeta } = useShopContext()
  const isSuperAdmin = useIsSuperAdmin()

  const {
    data: dashboard,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["store-dashboard", activeShopId],
    queryFn: () => storeDashboardService.getDashboard(),
    enabled: mode === "STORE_MODE" && !!activeShopId,
    staleTime: 30_000,
  })

  // Low-stock badge with 60s polling
  const { data: lowStockCount } = useQuery({
    queryKey: ["store-low-stock-count", activeShopId],
    queryFn: () => shopInventoryService.getLowStockCount(),
    enabled: mode === "STORE_MODE" && !!activeShopId,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  if (mode !== "STORE_MODE") {
    return (
      <div className="space-y-6">
        <PageHeader title="Store Dashboard" subtitle="Select a shop to view dashboard" />
        <EmptyShopState isSuperAdmin={isSuperAdmin} />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Store Dashboard" subtitle={shopMeta?.name} />
        <ErrorBlock
          message={error instanceof Error ? error.message : "Failed to load dashboard"}
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  const kpis = dashboard?.kpis

  return (
    <div className="space-y-6">
      <PageHeader title="Store Dashboard" subtitle={shopMeta?.name}>
        {(lowStockCount ?? 0) > 0 && (
          <Link href="/store/inventory?low_stock=true">
            <Badge variant="destructive" className="gap-1.5 cursor-pointer">
              <AlertTriangle className="h-3.5 w-3.5" />
              {lowStockCount} Low Stock
            </Badge>
          </Link>
        )}
      </PageHeader>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-32" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KPICard
            icon={ShoppingCart}
            label="Today's Orders (not cancelled or refunded)"
            value={String(kpis?.today_orders ?? 0)}
            href="/store/orders"
          />
          <KPICard
            icon={DollarSign}
            label="Today's Revenue (after refunds)"
            value={formatCurrency(kpis?.today_revenue ?? 0)}
            href="/store/financials"
          />
          <KPICard
            icon={Loader2}
            label="New orders to accept"
            value={String(kpis?.pending_orders ?? 0)}
            href="/store/orders?status=CONFIRMED"
            highlight={!!kpis?.pending_orders}
          />
          <KPICard
            icon={AlertTriangle}
            label="Low Stock Items"
            value={String(lowStockCount ?? kpis?.low_stock_count ?? 0)}
            href="/store/inventory?low_stock=true"
            highlight={(lowStockCount ?? kpis?.low_stock_count ?? 0) > 0}
          />
          <KPICard
            icon={TrendingUp}
            label="Avg Order Value (30 days)"
            value={formatCurrency(kpis?.avg_order_value ?? 0)}
          />
          <KPICard
            icon={Package}
            label="Total Products"
            value={String(kpis?.total_products ?? 0)}
            href="/store/products"
          />
        </div>
      )}

      {/* Recent Orders */}
      <Card className="p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Orders</h2>
          <Link href="/store/orders">
            <Button variant="ghost" size="sm" className="gap-1">
              View All <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !dashboard?.recent_orders?.length ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No orders yet
          </p>
        ) : (
          <div className="space-y-2">
            {dashboard.recent_orders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-sm">#{order.order_number}</span>
                  <span className="text-xs text-muted-foreground">{order.customer_name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant={order.status === "DELIVERED" ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {order.status}
                  </Badge>
                  <span className="font-semibold text-sm tabular-nums">
                    {formatCurrency(order.total_amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function KPICard({
  icon: Icon,
  label,
  value,
  href,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  href?: string
  highlight?: boolean
}) {
  const content = (
    <Card
      className={cn(
        "p-4 transition-colors",
        href && "hover:bg-muted/50 cursor-pointer",
        highlight && "border-amber-300 dark:border-amber-700",
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          "rounded-lg p-2",
          highlight ? "bg-amber-100 dark:bg-amber-900/30" : "bg-muted",
        )}>
          <Icon className={cn("h-5 w-5", highlight ? "text-amber-600" : "text-muted-foreground")} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold tabular-nums">{value}</p>
        </div>
      </div>
    </Card>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }
  return content
}
