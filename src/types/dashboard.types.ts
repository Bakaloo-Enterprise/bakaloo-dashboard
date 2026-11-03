/** Dashboard stat card data */
export interface DashboardStats {
  revenue: { value: number; change: number; sparkline: number[] }
  orders: { value: number; change: number; sparkline: number[] }
  products: { value: number; change: number }
  customers: { value: number; change: number }
  riders: { value: number; active: number }
  today: { orders: number; revenue: number; newCustomers: number; codCollections: number }
  lowStockCount: number
  pendingOrders: number
}

/** Revenue chart data point */
export interface RevenueDataPoint {
  date: string
  revenue: number
  orders: number
}

/** Top product item */
export interface TopProduct {
  id: string
  name: string
  thumbnail_url: string | null
  units_sold: number
  revenue: number
  category: string
}

/** Low stock alert item */
export interface LowStockItem {
  id: string
  name: string
  thumbnail_url: string | null
  stock_quantity: number
  low_stock_threshold: number
  category: string
}

/** Pending actions counts */
export interface PendingActions {
  pendingOrders: number
  lowStockProducts: number
  pendingRiderApprovals: number
  scheduledCampaigns: number
}

/** Live stats */
export interface LiveStats {
  activeOrders: number
  onlineRiders: number
  todayRevenue: number
  todayOrders: number
}

/** Orders by hour bar chart */
export interface OrderByHour {
  hour: number
  orders: number
}

/** Category revenue breakdown (for donut chart) */
export interface CategoryRevenue {
  category: string
  revenue: number
}

/** Recent order for dashboard widget */
export interface RecentOrder {
  id: string
  order_number: string
  customer_name: string
  total_amount: number
  status: string
  payment_method: string
  created_at: string
  item_count: number
  delivered_at?: string | null
  cancelled_reason?: string | null
}
