import api from "@/lib/api"
import type {
  ApiResponse,
  DashboardStats,
  RevenueDataPoint,
  TopProduct,
  LowStockItem,
  PendingActions,
  LiveStats,
  OrderByHour,
  RecentOrder,
  CategoryRevenue,
} from "@/types"
import type { OverviewData, OverviewPeriod } from "@/types/overview.types"

/* ------------------------------------------------------------------ */
/*  Backend → Frontend transformers                                    */
/* ------------------------------------------------------------------ */

// Backend returns { current, previous, change_pct, sparkline }
// Frontend expects { value, change, sparkline }
interface BackendStatBlock {
  current?: number
  previous?: number
  change_pct?: number
  sparkline?: number[]
  total?: number
  active?: number
  out_of_stock?: number
  low_stock?: number
  new_orders?: number
  new_this_period?: number
  repeat_rate?: number
  online?: number
  on_delivery?: number
  offline?: number
}

interface BackendDashboardStats {
  revenue: BackendStatBlock
  orders: BackendStatBlock
  products: BackendStatBlock
  customers: BackendStatBlock
  riders: BackendStatBlock
  today: { revenue: number; orders: number; cod_to_collect: number; delivered: number }
}

function mapStats(raw: BackendDashboardStats): DashboardStats {
  return {
    revenue: {
      value: raw.revenue?.current ?? 0,
      change: raw.revenue?.change_pct ?? 0,
      sparkline: raw.revenue?.sparkline ?? [],
    },
    orders: {
      value: raw.orders?.current ?? 0,
      change: raw.orders?.change_pct ?? 0,
      sparkline: raw.orders?.sparkline ?? [],
    },
    products: {
      value: raw.products?.total ?? raw.products?.current ?? 0,
      change: raw.products?.change_pct ?? 0,
    },
    customers: {
      value: raw.customers?.current ?? 0,
      change: raw.customers?.change_pct ?? 0,
    },
    riders: {
      value: raw.riders?.total ?? raw.riders?.current ?? 0,
      active: raw.riders?.online ?? raw.riders?.active ?? 0,
    },
    today: {
      orders: raw.today?.orders ?? 0,
      revenue: raw.today?.revenue ?? 0,
      newCustomers: 0,
      codCollections: raw.today?.cod_to_collect ?? 0,
    },
    lowStockCount: (raw.products?.low_stock ?? 0) + (raw.products?.out_of_stock ?? 0),
    // New orders waiting to be prepared — NOT the period's order total (that is `orders.value`).
    pendingOrders: raw.orders?.new_orders ?? 0,
  }
}

export async function getDashboardStats(
  period: "today" | "week" | "month" | "year" = "week"
): Promise<DashboardStats> {
  const { data } = await api.get<ApiResponse<BackendDashboardStats>>(
    `/admin/dashboard/stats`,
    { params: { period } }
  )
  return mapStats(data.data)
}

export async function getRevenueChart(days: number = 30): Promise<RevenueDataPoint[]> {
  const { data } = await api.get<ApiResponse<RevenueDataPoint[]>>(
    `/admin/dashboard/revenue-chart`,
    { params: { days } }
  )
  return data.data
}

export async function getOrdersByHour(): Promise<OrderByHour[]> {
  const { data } = await api.get<ApiResponse<{ hours: { hour: number; order_count: number }[]; avgOrders: number }>>(
    `/admin/dashboard/orders-by-hour`
  )
  const result = data.data
  // Backend returns { hours: [...], avgOrders } — unwrap and remap
  const hours = Array.isArray(result) ? result : result?.hours ?? []
  return hours.map((h) => ({ hour: h.hour, orders: h.order_count ?? (h as unknown as OrderByHour).orders ?? 0 }))
}

export async function getTopProducts(limit: number = 5): Promise<TopProduct[]> {
  const { data } = await api.get<ApiResponse<TopProduct[]>>(
    `/admin/dashboard/top-products`,
    { params: { limit } }
  )
  return data.data
}

export async function getLowStockAlerts(threshold: number = 10): Promise<LowStockItem[]> {
  const { data } = await api.get<ApiResponse<Array<{
    id: string
    name: string
    thumbnail_url: string | null
    stock_quantity: number
    low_stock_threshold: number
    category_id?: string
    category?: string
  }>>>(
    `/admin/dashboard/low-stock-alerts`,
    { params: { threshold } }
  )
  const items = Array.isArray(data.data) ? data.data : []
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    thumbnail_url: item.thumbnail_url,
    stock_quantity: item.stock_quantity,
    low_stock_threshold: item.low_stock_threshold,
    category: item.category ?? item.category_id ?? "Uncategorized",
  }))
}

export async function getPendingActions(): Promise<PendingActions> {
  const { data } = await api.get<ApiResponse<{
    pending_orders?: number
    confirmed_orders?: number
    pending_riders?: number
    low_stock_products?: number
    pending_payouts?: number
  }>>(
    `/admin/dashboard/pending-actions`
  )
  const raw = data.data
  return {
    pendingOrders: raw.pending_orders ?? 0,
    lowStockProducts: raw.low_stock_products ?? 0,
    pendingRiderApprovals: raw.pending_riders ?? 0,
    scheduledCampaigns: 0, // not provided by backend
  }
}

export async function getLiveStats(): Promise<LiveStats> {
  const { data } = await api.get<ApiResponse<{
    today?: { revenue?: number; orders?: number; cod_to_collect?: number; delivered?: number }
    riders?: { total?: number; online?: number; on_delivery?: number; offline?: number }
  }>>(
    `/admin/dashboard/live-stats`
  )
  const raw = data.data
  return {
    activeOrders: raw.today?.orders ?? 0,
    onlineRiders: raw.riders?.online ?? 0,
    todayRevenue: raw.today?.revenue ?? 0,
    todayOrders: raw.today?.orders ?? 0,
  }
}

export async function getRecentOrders(limit: number = 10): Promise<RecentOrder[]> {
  const { data } = await api.get<ApiResponse<{ orders: RecentOrder[] }>>(
    `/admin/orders`,
    { params: { limit, sort: "created_at", order: "desc" } }
  )
  return data.data.orders ?? data.data as unknown as RecentOrder[]
}

export async function getCategoryRevenue(): Promise<CategoryRevenue[]> {
  const { data } = await api.get<ApiResponse<CategoryRevenue[]>>(
    `/admin/dashboard/category-revenue`
  )
  return data.data
}

export async function getOverview(period: OverviewPeriod = "week"): Promise<OverviewData> {
  const { data } = await api.get<ApiResponse<OverviewData>>(`/admin/dashboard/overview`, { params: { period } })
  return data.data
}
