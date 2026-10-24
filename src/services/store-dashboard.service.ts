import api from "@/lib/api"
import type { ApiResponse } from "@/types"

/** KPI summary for the store dashboard */
export interface StoreDashboardKPIs {
  today_orders: number
  today_revenue: number
  /** orders waiting for the store to accept them */
  pending_orders: number
  awaiting_payment?: number
  preparing?: number
  out_for_delivery?: number
  out_of_stock_count?: number
  low_stock_count: number
  avg_order_value: number
  total_products: number
}

/** Recent order summary */
export interface RecentOrder {
  id: string
  order_number: string
  customer_name: string
  total_amount: number
  status: string
  created_at: string
}

export interface StoreDashboardData {
  kpis: StoreDashboardKPIs
  recent_orders: RecentOrder[]
}

export const storeDashboardService = {
  async getDashboard(): Promise<StoreDashboardData> {
    const { data } = await api.get<ApiResponse<StoreDashboardData>>(
      "/shop-dashboard",
    )
    return data.data
  },

  async getLowStockCount(): Promise<number> {
    const { data } = await api.get<ApiResponse<{ count: number }>>(
      "/shop-products/low-stock-count",
    )
    return data.data.count
  },
}
