import api from "@/lib/api"
import type {
  ApiResponse,
  Order,
  OrderDetail,
  OrderStatusCounts,
  OrderFilters,
  OrderNote,
  UpdateOrderStatusPayload,
  AssignRiderPayload,
  RefundOrderPayload,
  CancelOrderPayload,
  RescheduleOrderPayload,
  BulkStatusPayload,
  RazorpayPaymentDetail,
  B2BOrder,
  B2BOrderDetail,
  B2BOrderFilters,
  RecordB2BSettlementPayload,
  SetB2BPaymentDueDatePayload,
} from "@/types"

/** List orders with filters + pagination */
export async function getOrders(filters: OrderFilters = {}) {
  const params: Record<string, string | number> = {}
  if (filters.page) params.page = filters.page
  if (filters.limit) params.limit = filters.limit
  if (filters.status) params.status = filters.status
  if (filters.paymentMethod) params.paymentMethod = filters.paymentMethod
  if (filters.search) params.search = filters.search
  if (filters.startDate) params.startDate = filters.startDate
  if (filters.endDate) params.endDate = filters.endDate
  if (filters.deliveryType) params.deliveryType = filters.deliveryType
  if (filters.needsPaymentReview) params.needsPaymentReview = "true"
  if (filters.recoveredFromFailed) params.recoveredFromFailed = "true"
  if (filters.paymentStatus) params.paymentStatus = filters.paymentStatus
  if (filters.riderId) params.riderId = filters.riderId
  if (filters.minAmount != null) params.minAmount = filters.minAmount
  if (filters.maxAmount != null) params.maxAmount = filters.maxAmount
  if (filters.area) params.area = filters.area
  if (filters.isB2B) params.isB2B = "true"

  const { data } = await api.get<
    ApiResponse<{
      orders: Order[]
      pagination: { page: number; limit: number; total: number; totalPages: number }
    }>
  >("/admin/orders", { params })

  return data.data
}

/** Get order counts by status (for tab badges) */
export async function getOrderStatusCounts(): Promise<OrderStatusCounts> {
  const { data } = await api.get<ApiResponse<OrderStatusCounts>>(
    "/admin/orders/stats-by-status"
  )
  return data.data
}

/** Get full order detail */
export async function getOrderDetail(orderId: string): Promise<OrderDetail> {
  const { data } = await api.get<ApiResponse<OrderDetail>>(
    `/admin/orders/${orderId}`
  )
  return data.data
}

/** List internal staff notes for an order (chronological, oldest first) */
export async function getOrderNotes(orderId: string): Promise<OrderNote[]> {
  const { data } = await api.get<ApiResponse<OrderNote[]>>(`/admin/orders/${orderId}/notes`)
  return data.data
}

/** Add an internal staff note to an order */
export async function addOrderNote(orderId: string, body: string): Promise<OrderNote> {
  const { data } = await api.post<ApiResponse<OrderNote>>(`/admin/orders/${orderId}/notes`, { body })
  return data.data
}

/** Update order status */
export async function updateOrderStatus(
  orderId: string,
  payload: UpdateOrderStatusPayload
) {
  const { data } = await api.put<
    ApiResponse<{ orderId: string; oldStatus: string; newStatus: string }>
  >(`/admin/orders/${orderId}/status`, payload)
  return data.data
}

/** Assign rider to order */
export async function assignRider(orderId: string, payload: AssignRiderPayload) {
  const { data } = await api.put<
    ApiResponse<{ orderId: string; riderId: string }>
  >(`/admin/orders/${orderId}/assign-rider`, payload)
  return data.data
}

/** Bulk assign riders */
export async function bulkAssignRiders(
  assignments: { orderId: string; riderId: string }[]
) {
  const { data } = await api.post<
    ApiResponse<{ orderId: string; riderId: string; status: string }[]>
  >("/admin/orders/bulk-assign", { assignments })
  return data.data
}

/** Export orders as CSV (returns blob) */
export async function exportOrdersCsv(filters: {
  status?: string
  startDate?: string
  endDate?: string
}) {
  const response = await api.get("/admin/orders/export", {
    params: filters,
    responseType: "blob",
  })
  return response.data
}

/** Download invoice PDF (returns blob) */
export async function downloadInvoice(orderId: string) {
  const response = await api.get(`/admin/orders/${orderId}/invoice`, {
    responseType: "blob",
  })
  return response.data
}

/** Refund order */
export async function refundOrder(
  orderId: string,
  payload: RefundOrderPayload
) {
  const { data } = await api.post<ApiResponse<{ orderId: string; refundAmount: number }>>(
    `/admin/orders/${orderId}/refund`,
    payload
  )
  return data.data
}

/** Cancel order */
export async function cancelOrder(
  orderId: string,
  payload: CancelOrderPayload
) {
  const { data } = await api.post<
    ApiResponse<{ orderId: string; status: string; stockRestoreWarning?: string }>
  >(`/admin/orders/${orderId}/cancel`, payload)
  return data.data
}

/**
 * Manually re-check an order's payment directly against Razorpay — for a
 * payment stuck PENDING, or one flagged `needs_manual_review` (captured
 * after the order had already moved on). Shares the same reconciliation
 * path the backend's own webhook and safety-net worker use.
 */
export async function resyncOrderPayment(orderId: string) {
  const { data } = await api.post<
    ApiResponse<{ captured: boolean; needsManualReview: boolean; order: unknown }>
  >(`/admin/orders/${orderId}/reconcile-payment`)
  return data.data
}

/** A manual order was created unpaid; say the money has now arrived. */
export async function markManualOrderPaid(orderId: string, note?: string) {
  const { data } = await api.post<ApiResponse<{ id: string }>>(`/admin/orders/${orderId}/payment-received`, { note })
  return data.data
}

/** Historical audit tool — select a batch of old orders (e.g. everything
 *  filtered to payment status FAILED) and re-verify each directly against
 *  Razorpay, recovering any that were actually captured. */
export async function bulkReconcilePayments(orderIds: string[]) {
  const { data } = await api.post<
    ApiResponse<Array<{ orderId: string; captured?: boolean; needsManualReview?: boolean; error?: string }>>
  >("/admin/orders/bulk-reconcile-payment", { orderIds })
  return data.data
}

/** Full payment detail fetched live from Razorpay — not mirrored into our
 *  own schema, so this is always complete and current. */
export async function getRazorpayDetails(orderId: string) {
  const { data } = await api.get<ApiResponse<RazorpayPaymentDetail>>(
    `/admin/orders/${orderId}/razorpay-details`
  )
  return data.data
}

/** Reschedule an order's delivery slot (admin mistake-correction action) */
export async function rescheduleOrder(
  orderId: string,
  payload: RescheduleOrderPayload
) {
  const { data } = await api.put<ApiResponse<Order>>(
    `/admin/orders/${orderId}/reschedule`,
    payload
  )
  return data.data
}

/** Bulk status update */
export async function bulkUpdateStatus(
  payload: BulkStatusPayload
) {
  const { data } = await api.post<ApiResponse<{ updated: number }>>(
    "/admin/orders/bulk-status",
    payload
  )
  return data.data
}

/** Download packing slip PDF */
export async function downloadPackingSlip(orderId: string) {
  const response = await api.get(`/admin/orders/${orderId}/packing-slip`, {
    responseType: "blob",
  })
  return response.data
}

/** Download A4 GST tax invoice PDF (buyer GSTIN/company snapshotted at checkout) */
export async function downloadTaxInvoice(orderId: string) {
  const response = await api.get(`/admin/orders/${orderId}/tax-invoice`, {
    responseType: "blob",
  })
  return response.data
}

// ── B2B "Place Order" ────────────────────────────────────────────────

/** List B2B credit orders (payment_method 'B2B_CREDIT') for the /b2b/orders page */
export async function getB2BOrders(filters: B2BOrderFilters = {}) {
  const params: Record<string, string | number | boolean> = {}
  if (filters.page) params.page = filters.page
  if (filters.limit) params.limit = filters.limit
  if (filters.status) params.status = filters.status
  if (filters.hasPendingCollection) params.hasPendingCollection = true

  const { data } = await api.get<
    ApiResponse<{
      orders: B2BOrder[]
      pagination: { page: number; limit: number; total: number; totalPages: number }
    }>
  >("/admin/orders/b2b", { params })
  return data.data
}

/** B2B credit order detail, including its settlement history */
export async function getB2BOrderDetail(orderId: string): Promise<B2BOrderDetail> {
  const { data } = await api.get<ApiResponse<B2BOrderDetail>>(`/admin/orders/b2b/${orderId}`)
  return data.data
}

/** Approve a pending B2B credit order — deducts stock and confirms it */
export async function approveB2BOrder(orderId: string): Promise<OrderDetail> {
  const { data } = await api.post<ApiResponse<OrderDetail>>(`/admin/orders/b2b/${orderId}/approve`)
  return data.data
}

/** Record a manual payment-collection entry against a B2B credit order */
export async function recordB2BSettlement(
  orderId: string,
  payload: RecordB2BSettlementPayload
): Promise<OrderDetail> {
  const { data } = await api.post<ApiResponse<OrderDetail>>(
    `/admin/orders/b2b/${orderId}/settlements`,
    payload
  )
  return data.data
}

/** Set (or clear, passing dueDate: null) the date a B2B customer promised to pay by */
export async function setB2BPaymentDueDate(
  orderId: string,
  payload: SetB2BPaymentDueDatePayload
): Promise<OrderDetail> {
  const { data } = await api.put<ApiResponse<OrderDetail>>(
    `/admin/orders/b2b/${orderId}/due-date`,
    payload
  )
  return data.data
}
