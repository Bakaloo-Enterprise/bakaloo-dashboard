"use client"

/**
 * Dashboard home hooks — wraps the existing dashboard endpoints so each
 * cache entry starts with the central `dashboard-home` tag and includes
 * `shopKey`, allowing the Shop_Switcher's predicate-based invalidation
 * to reach them on every pivot (Req 3.4, 10.3).
 *
 * Dashboard home is one of the ALL_SHOPS-friendly surfaces (Req 10.4) —
 * when `mode === "HQ_MODE"` the axios interceptor omits the `X-Shop-Id`
 * header and the backend returns cross-shop aggregates. The hooks
 * therefore key by `"ALL"` in that mode and by `activeShopId` in
 * `SINGLE_SHOP` mode; while the Shop_Context_Store is hydrating
 * (`UNSELECTED`) the queries are gated off via `enabled`.
 *
 * Note: the legacy `["dashboard", …]` cache prefix is no longer in use —
 * every reader now goes through the central `dashboard-home` prefix so
 * the Shop_Switcher predicate invalidation covers them in one pass. The
 * `SocketProvider` was updated to invalidate `["dashboard-home"]` to
 * match.
 *
 * Requirements: 10.1, 10.3, 10.4
 */

import { useQuery } from "@tanstack/react-query"

import {
  getDashboardStats,
  getRevenueChart,
  getOrdersByHour,
  getTopProducts,
  getLowStockAlerts,
  getPendingActions,
  getLiveStats,
  getRecentOrders,
  getCategoryRevenue,
  getOverview,
} from "@/services/dashboard.service"
import type { OverviewPeriod } from "@/types/overview.types"
import { useShopContext } from "@/hooks/useShopContext"

/** Sentinel used while the Shop_Context_Store is hydrating. */
const NONE_SHOP_KEY = "NONE"

/**
 * Resolve the `shopKey` used by every dashboard-home query. `ALL_SHOPS` →
 * `"ALL"`; `SINGLE_SHOP` → `activeShopId`; otherwise the sentinel `"NONE"`
 * (which gates the query off via `enabled`).
 */
function useShopKey(): string {
  const { mode, activeShopId } = useShopContext()
  return mode === "HQ_MODE" ? "ALL" : activeShopId ?? NONE_SHOP_KEY
}

export function useDashboardStats(period: "today" | "week" | "month" | "year" = "week") {
  const shopKey = useShopKey()
  return useQuery({
    queryKey: ["dashboard-home", shopKey, "stats", period] as const,
    queryFn: () => getDashboardStats(period),
    enabled: shopKey !== NONE_SHOP_KEY,
    staleTime: 60 * 1000,
    placeholderData: (prev) => prev,
  })
}

export function useRevenueChart(days: number = 30) {
  const shopKey = useShopKey()
  return useQuery({
    queryKey: ["dashboard-home", shopKey, "revenue-chart", days] as const,
    queryFn: () => getRevenueChart(days),
    enabled: shopKey !== NONE_SHOP_KEY,
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  })
}

export function useOrdersByHour() {
  const shopKey = useShopKey()
  return useQuery({
    queryKey: ["dashboard-home", shopKey, "orders-by-hour"] as const,
    queryFn: getOrdersByHour,
    enabled: shopKey !== NONE_SHOP_KEY,
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  })
}

export function useTopProducts(limit: number = 5) {
  const shopKey = useShopKey()
  return useQuery({
    queryKey: ["dashboard-home", shopKey, "top-products", limit] as const,
    queryFn: () => getTopProducts(limit),
    enabled: shopKey !== NONE_SHOP_KEY,
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  })
}

export function useLowStockAlerts(threshold: number = 10) {
  const shopKey = useShopKey()
  return useQuery({
    queryKey: ["dashboard-home", shopKey, "low-stock", threshold] as const,
    queryFn: () => getLowStockAlerts(threshold),
    enabled: shopKey !== NONE_SHOP_KEY,
    staleTime: 2 * 60 * 1000,
    placeholderData: (prev) => prev,
  })
}

export function usePendingActions() {
  const shopKey = useShopKey()
  return useQuery({
    queryKey: ["dashboard-home", shopKey, "pending-actions"] as const,
    queryFn: getPendingActions,
    enabled: shopKey !== NONE_SHOP_KEY,
    staleTime: 30 * 1000,
    placeholderData: (prev) => prev,
  })
}

export function useLiveStats() {
  const shopKey = useShopKey()
  return useQuery({
    queryKey: ["dashboard-home", shopKey, "live-stats"] as const,
    queryFn: getLiveStats,
    enabled: shopKey !== NONE_SHOP_KEY,
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000, // Auto-refresh every 15s
    placeholderData: (prev) => prev,
  })
}

export function useRecentOrders(limit: number = 10) {
  const shopKey = useShopKey()
  return useQuery({
    queryKey: ["dashboard-home", shopKey, "recent-orders", limit] as const,
    queryFn: () => getRecentOrders(limit),
    enabled: shopKey !== NONE_SHOP_KEY,
    staleTime: 30 * 1000,
    placeholderData: (prev) => prev,
  })
}

export function useCategoryRevenue() {
  const shopKey = useShopKey()
  return useQuery({
    queryKey: ["dashboard-home", shopKey, "category-revenue"] as const,
    queryFn: getCategoryRevenue,
    enabled: shopKey !== NONE_SHOP_KEY,
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  })
}

/** The accurate overview (one call, one set of rules). Refreshes itself every 20 seconds while the page is open. */
export function useOverview(period: OverviewPeriod = "week") {
  const shopKey = useShopKey()
  return useQuery({
    queryKey: ["dashboard-home", shopKey, "overview", period] as const,
    queryFn: () => getOverview(period),
    enabled: shopKey !== NONE_SHOP_KEY,
    staleTime: 15 * 1000,
    refetchInterval: 20 * 1000,
    refetchIntervalInBackground: true, // a Command Center left open on a side screen keeps itself current
    placeholderData: (prev) => prev,
  })
}
