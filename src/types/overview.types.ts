/** Response of GET /admin/dashboard/overview — every figure follows one set of rules (see `definitions`). */
export type OverviewPeriod = "today" | "week" | "month" | "year"

export interface OverviewChange {
  previous: number | null
  changePct: number | null
}

export interface OverviewDay {
  day: string
  /** Orders that stood (placed minus fully refunded). */
  orders: number
  placed: number
  gross: number
  refunds: number
  net: number
  cancelled: number
  /** Every cancellation that day, including orders stopped before confirmation. */
  cancelledAll: number
  cod: number
}

export interface OverviewData {
  period: OverviewPeriod
  from: string
  to: string
  days: number
  shopId: string | null
  previous: { from: string; to: string }
  money: { grossSales: number; refunds: number; netRevenue: number; cancelledValue: number; avgOrderValue: number | null }
  orders: { placed: number; fullyRefunded: number; net: number; refundEvents: number; cancelled: number }
  /** All cancelled orders in the period (any stage), never counted as orders or sales. */
  cancellations: {
    orders: number; value: number
    beforeConfirm: { orders: number; value: number }
    afterConfirm: { orders: number; value: number }
    byReason: Array<{ reason: string; orders: number; value: number }>
  }
  /** Money handed back on delivered orders — a different thing from a cancellation. */
  returns: { orders: number; value: number; fullyRefundedOrders: number }
  comparison: { netRevenue: OverviewChange; orders: OverviewChange; avgOrderValue: OverviewChange; refunds: OverviewChange }
  customers: { buyers: number; newBuyers: number; repeatBuyers: number; repeatRatePct: number | null; registered: number | null; joinedInPeriod: number | null }
  series: OverviewDay[]
  hours: Array<{ hour: number; orders: number }>
  topProducts: Array<{ id: string; name: string; thumbnailUrl: string | null; category: string | null; unitsSold: number; revenue: number; orders: number }>
  categories: Array<{ category: string; revenue: number; units: number; sharePct: number | null }>
  channels: Array<{ channel: "B2C" | "B2B"; orders: number; gross: number; sharePct: number | null }>
  live: { newOrders: number; preparing: number; outForDelivery: number; awaitingPayment: number; codToCollect: number; codCollectedToday: number; pendingRefundRequests: number }
  definitions: Record<string, string>
}
