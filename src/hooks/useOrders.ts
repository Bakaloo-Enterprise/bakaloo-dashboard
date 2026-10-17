import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  getOrders,
  getOrderStatusCounts,
  getOrderDetail,
  getOrderNotes,
  addOrderNote,
  updateOrderStatus,
  assignRider,
  bulkAssignRiders,
  exportOrdersCsv,
  downloadInvoice,
  refundOrder,
  cancelOrder,
  rescheduleOrder,
  bulkUpdateStatus,
  downloadPackingSlip,
  downloadTaxInvoice,
  resyncOrderPayment,
  markManualOrderPaid,
  getRazorpayDetails,
  bulkReconcilePayments,
  getB2BOrders,
  getB2BOrderDetail,
  approveB2BOrder,
  recordB2BSettlement,
  setB2BPaymentDueDate,
} from "@/services/orders.service"
import type { OrderFilters, UpdateOrderStatusPayload, AssignRiderPayload, RefundOrderPayload, CancelOrderPayload, RescheduleOrderPayload, BulkStatusPayload, B2BOrderFilters, RecordB2BSettlementPayload, SetB2BPaymentDueDatePayload } from "@/types"
import { toast } from "sonner"
import { useShopContext } from "@/hooks/useShopContext"
import { qk } from "@/lib/query-keys"

/**
 * Sentinel `shopKey` slot used while the Shop_Context_Store hydrates.
 *
 * `qk.orders(shopKey, filters)` requires a stable second segment for the
 * cache key, but we don't actually want to fire a request before the shop
 * context is ready (vendor) or the Super_Admin has chosen between
 * SINGLE_SHOP and ALL_SHOPS. Combining `shopKey === "NONE"` with
 * `enabled: shopKey !== "NONE"` gives us a stable key shape and a gated
 * request — matching the convention established by `useShopProductsList`
 * and `useShopFinancials`.
 *
 * Requirements: 10.1, 10.3, 10.4, 10.6.
 */
const NONE_SHOP_KEY = "NONE"

/**
 * Paginated orders list, keyed by the central query-key factory so the
 * Shop_Switcher's predicate-based invalidation (Req 3.4, 10.3) reaches
 * every orders cache entry in one pass.
 *
 * Scope semantics:
 *   - `mode === "HQ_MODE"` (Super_Admin viewing every shop):
 *     `shopKey = "ALL"`. The axios interceptor omits `X-Shop-Id`, the
 *     backend returns aggregated orders (Req 10.6).
 *   - `mode === "STORE_MODE"`: `shopKey = activeShopId`. The interceptor
 *     injects `X-Shop-Id`, the backend returns shop-scoped orders.
 *   - Otherwise (`UNSELECTED` / hydrating): `shopKey = "NONE"` and the
 *     query is gated off so no request is issued.
 *   The `Shop` table column itself is always rendered regardless of mode.
 */
export function useOrders(filters: OrderFilters) {
  const { mode, activeShopId } = useShopContext()
  const shopKey =
    mode === "HQ_MODE"
      ? "ALL"
      : activeShopId ?? NONE_SHOP_KEY

  return useQuery({
    queryKey: qk.orders(shopKey, filters),
    queryFn: () => getOrders(filters),
    enabled: shopKey !== NONE_SHOP_KEY,
    staleTime: 30 * 1000,
    placeholderData: (prev) => prev,
  })
}

export function useOrderStatusCounts() {
  return useQuery({
    queryKey: ["orders", "status-counts"],
    queryFn: getOrderStatusCounts,
    staleTime: 30 * 1000,
  })
}

export function useOrderDetail(orderId: string | null) {
  return useQuery({
    queryKey: ["orders", "detail", orderId],
    queryFn: () => getOrderDetail(orderId!),
    enabled: !!orderId,
    staleTime: 15 * 1000,
  })
}

export function useOrderNotes(orderId: string | null) {
  return useQuery({
    queryKey: ["orders", "notes", orderId],
    queryFn: () => getOrderNotes(orderId!),
    enabled: !!orderId,
    staleTime: 15 * 1000,
  })
}

export function useAddOrderNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, body }: { orderId: string; body: string }) =>
      addOrderNote(orderId, body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["orders", "notes", variables.orderId] })
    },
    onError: (e: Error) => toast.error(e.message || "Failed to add note"),
  })
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      orderId,
      payload,
    }: {
      orderId: string
      payload: UpdateOrderStatusPayload
    }) => updateOrderStatus(orderId, payload),
    onSuccess: (data) => {
      toast.success(`Order status updated to ${data.newStatus}`)
      queryClient.invalidateQueries({ queryKey: ["orders"] })
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update status")
    },
  })
}

export function useAssignRider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      orderId,
      payload,
    }: {
      orderId: string
      payload: AssignRiderPayload
    }) => assignRider(orderId, payload),
    onSuccess: () => {
      toast.success("Rider assigned successfully")
      queryClient.invalidateQueries({ queryKey: ["orders"] })
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to assign rider")
    },
  })
}

export function useExportOrders() {
  return useMutation({
    mutationFn: (filters: { status?: string; startDate?: string; endDate?: string }) =>
      exportOrdersCsv(filters),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `orders-export-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Orders exported!")
    },
    onError: () => {
      toast.error("Failed to export orders")
    },
  })
}

export function useDownloadInvoice() {
  return useMutation({
    mutationFn: (orderId: string) => downloadInvoice(orderId),
    onSuccess: (blob, orderId) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `invoice-${orderId}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    },
    onError: () => {
      toast.error("Failed to download invoice")
    },
  })
}

export function useBulkAssignRiders() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (assignments: { orderId: string; riderId: string }[]) =>
      bulkAssignRiders(assignments),
    onSuccess: (data) => {
      toast.success(`${data.length} order(s) assigned`)
      qc.invalidateQueries({ queryKey: ["orders"] })
    },
    onError: (e: Error) => toast.error(e.message || "Bulk assign failed"),
  })
}

export function useRefundOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, payload }: { orderId: string; payload: RefundOrderPayload }) =>
      refundOrder(orderId, payload),
    onSuccess: () => {
      toast.success("Refund processed successfully")
      qc.invalidateQueries({ queryKey: ["orders"] })
    },
    onError: (e: Error) => toast.error(e.message || "Refund failed"),
  })
}

export function useCancelOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, payload }: { orderId: string; payload: CancelOrderPayload }) =>
      cancelOrder(orderId, payload),
    onSuccess: (data) => {
      toast.success("Order cancelled")
      // Previously silent — a failed stock restore (e.g. the listing was
      // deleted between order placement and cancellation) only showed up
      // in server logs, never here, so an admin had no way to know
      // inventory needed a manual check.
      if (data.stockRestoreWarning) {
        toast.warning(data.stockRestoreWarning)
      }
      qc.invalidateQueries({ queryKey: ["orders"] })
    },
    onError: (e: Error) => toast.error(e.message || "Cancel failed"),
  })
}

/** Lazy — only fetches once the "Razorpay Details" panel is actually
 *  expanded (`enabled`), since it's a live third-party API call, not a
 *  free local read. */
export function useRazorpayDetails(orderId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["orders", "razorpay-details", orderId],
    queryFn: () => getRazorpayDetails(orderId!),
    enabled: !!orderId && enabled,
    staleTime: 60 * 1000,
    retry: false,
  })
}

export function useResyncPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (orderId: string) => resyncOrderPayment(orderId),
    onSuccess: (data) => {
      if (!data.captured) {
        toast.info("Razorpay shows no captured payment for this order.")
      } else if (data.needsManualReview) {
        toast.warning(
          "Payment was captured, but the order had already moved on — still flagged for manual review."
        )
      } else {
        toast.success("Payment confirmed — order updated.")
      }
      qc.invalidateQueries({ queryKey: ["orders"] })
    },
    onError: (e: Error) => toast.error(e.message || "Re-check failed"),
  })
}

export function useMarkManualPaid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { orderId: string; note?: string }) => markManualOrderPaid(v.orderId, v.note),
    onSuccess: () => {
      toast.success("Marked as paid")
      qc.invalidateQueries({ queryKey: ["orders"] })
    },
    onError: (e: Error) => toast.error(e.message || "Could not mark as paid"),
  })
}

export function useBulkReconcilePayments() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (orderIds: string[]) => bulkReconcilePayments(orderIds),
    onSuccess: (results) => {
      const recovered = results.filter((r) => r.captured).length
      const errored = results.filter((r) => r.error).length
      if (recovered > 0) {
        toast.success(`${recovered} of ${results.length} order(s) had a payment Razorpay confirms was captured`)
      } else {
        toast.info(`Checked ${results.length} order(s) — none show a captured payment on Razorpay`)
      }
      if (errored > 0) {
        toast.warning(`${errored} order(s) couldn't be checked — try again in a moment`)
      }
      qc.invalidateQueries({ queryKey: ["orders"] })
    },
    onError: (e: Error) => toast.error(e.message || "Bulk re-check failed"),
  })
}

export function useRescheduleOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, payload }: { orderId: string; payload: RescheduleOrderPayload }) =>
      rescheduleOrder(orderId, payload),
    onSuccess: () => {
      toast.success("Delivery rescheduled")
      qc.invalidateQueries({ queryKey: ["orders"] })
    },
    onError: (e: Error) => toast.error(e.message || "Reschedule failed"),
  })
}

export function useBulkUpdateStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: BulkStatusPayload) =>
      bulkUpdateStatus(payload),
    onSuccess: (data) => {
      toast.success(`${data.updated} order(s) updated`)
      qc.invalidateQueries({ queryKey: ["orders"] })
    },
    onError: (e: Error) => toast.error(e.message || "Bulk update failed"),
  })
}

export function useDownloadPackingSlip() {
  return useMutation({
    mutationFn: (orderId: string) => downloadPackingSlip(orderId),
    onSuccess: (blob, orderId) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `packing-slip-${orderId}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    },
    onError: () => toast.error("Failed to download packing slip"),
  })
}

export function useDownloadTaxInvoice() {
  return useMutation({
    mutationFn: (orderId: string) => downloadTaxInvoice(orderId),
    onSuccess: (blob, orderId) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `tax-invoice-${orderId}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    },
    onError: () => toast.error("Failed to download tax invoice"),
  })
}

// ── B2B "Place Order" ────────────────────────────────────────────────

export function useB2BOrders(filters: B2BOrderFilters) {
  return useQuery({
    queryKey: ["orders", "b2b", filters],
    queryFn: () => getB2BOrders(filters),
    staleTime: 15 * 1000,
    placeholderData: (prev) => prev,
  })
}

export function useB2BOrderDetail(orderId: string | null) {
  return useQuery({
    queryKey: ["orders", "b2b", "detail", orderId],
    queryFn: () => getB2BOrderDetail(orderId!),
    enabled: !!orderId,
    staleTime: 10 * 1000,
  })
}

export function useApproveB2BOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (orderId: string) => approveB2BOrder(orderId),
    onSuccess: () => {
      toast.success("Order approved — stock deducted and order confirmed")
      qc.invalidateQueries({ queryKey: ["orders"] })
    },
    onError: (err: Error) => toast.error(err.message || "Failed to approve order"),
  })
}

export function useRecordB2BSettlement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, payload }: { orderId: string; payload: RecordB2BSettlementPayload }) =>
      recordB2BSettlement(orderId, payload),
    onSuccess: () => {
      toast.success("Settlement recorded")
      qc.invalidateQueries({ queryKey: ["orders"] })
    },
    onError: (err: Error) => toast.error(err.message || "Failed to record settlement"),
  })
}

export function useSetB2BPaymentDueDate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, payload }: { orderId: string; payload: SetB2BPaymentDueDatePayload }) =>
      setB2BPaymentDueDate(orderId, payload),
    onSuccess: (_data, variables) => {
      toast.success(variables.payload.dueDate ? "Payment due date set" : "Payment due date cleared")
      qc.invalidateQueries({ queryKey: ["orders"] })
    },
    onError: (err: Error) => toast.error(err.message || "Failed to update payment due date"),
  })
}
