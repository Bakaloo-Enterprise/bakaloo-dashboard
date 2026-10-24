"use client"

/**
 * Store Orders — task 21.2
 * Consumes /api/v1/shop-orders with filters, state-transition action buttons
 * (gated by shop_orders.update_status), assign-rider, cancel, refund,
 * packing-slip, CSV export.
 */

import { useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Download,
  FileText,
  Loader2,
  Search,
  Truck,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyShopState } from "@/components/shared/empty-shop-state"
import { ErrorBlock } from "@/components/shared/error-block"
import { PermissionGate } from "@/components/shared/PermissionGate"
import { useDebounce } from "@/hooks/useDebounce"
import { useIsSuperAdmin, useShopContext } from "@/hooks/useShopContext"
import {
  shopOrdersService,
  type ShopOrder,
  type ShopOrderStatus,
  type ShopOrdersListParams,
} from "@/services/shop-orders.service"
import { formatCurrency } from "@/lib/i18n"

const PAGE_SIZE = 20

const ALL_STATUSES: ShopOrderStatus[] = [
  "PENDING", "CONFIRMED", "PREPARING", "READY",
  "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "REFUNDED",
]

const STATUS_TRANSITIONS: Record<ShopOrderStatus, ShopOrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
  REFUNDED: [],
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function StoreOrdersPage() {
  const { activeShopId, mode } = useShopContext()
  const isSuperAdmin = useIsSuperAdmin()
  const queryClient = useQueryClient()

  const [searchInput, setSearchInput] = useState("")
  // a link such as /store/orders?status=CONFIRMED (from the dashboard) opens already filtered
  const searchParams = useSearchParams()
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    const v = searchParams.get("status")
    return v && (ALL_STATUSES as readonly string[]).includes(v) ? v : "all"
  })
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [page, setPage] = useState(1)

  const [assignRiderOrder, setAssignRiderOrder] = useState<ShopOrder | null>(null)
  const [riderId, setRiderId] = useState("")
  const [cancelOrder, setCancelOrder] = useState<ShopOrder | null>(null)
  const [cancelReason, setCancelReason] = useState("")
  const [refundOrder, setRefundOrder] = useState<ShopOrder | null>(null)
  const [refundAmount, setRefundAmount] = useState("")
  const [refundReason, setRefundReason] = useState("")

  const debouncedSearch = useDebounce(searchInput, 300)

  const filters = useMemo<ShopOrdersListParams>(() => {
    const params: ShopOrdersListParams = { page, limit: PAGE_SIZE }
    if (debouncedSearch.trim()) params.search = debouncedSearch.trim()
    if (statusFilter !== "all") params.status = statusFilter as ShopOrderStatus
    if (fromDate) params.from = `${fromDate}T00:00:00.000Z`
    if (toDate) params.to = `${toDate}T23:59:59.999Z`
    return params
  }, [page, debouncedSearch, statusFilter, fromDate, toDate])

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["shop-orders", activeShopId, filters],
    queryFn: () => shopOrdersService.list(filters),
    enabled: mode === "STORE_MODE" && !!activeShopId,
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: ShopOrderStatus }) =>
      shopOrdersService.updateStatus(orderId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shop-orders", activeShopId] })
      toast.success("Order status updated")
    },
    onError: (e: Error) => toast.error(e.message || "Failed to update status"),
  })

  const assignRiderMutation = useMutation({
    mutationFn: ({ orderId, riderId }: { orderId: string; riderId: string }) =>
      shopOrdersService.assignRider(orderId, riderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shop-orders", activeShopId] })
      toast.success("Rider assigned")
      setAssignRiderOrder(null)
      setRiderId("")
    },
    onError: (e: Error) => toast.error(e.message || "Failed to assign rider"),
  })

  const cancelMutation = useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) =>
      shopOrdersService.cancel(orderId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shop-orders", activeShopId] })
      toast.success("Order cancelled")
      setCancelOrder(null)
      setCancelReason("")
    },
    onError: (e: Error) => toast.error(e.message || "Failed to cancel order"),
  })

  const refundMutation = useMutation({
    mutationFn: ({ orderId, amount, reason }: { orderId: string; amount: number; reason: string }) =>
      shopOrdersService.refund(orderId, amount, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shop-orders", activeShopId] })
      toast.success("Refund processed")
      setRefundOrder(null)
      setRefundAmount("")
      setRefundReason("")
    },
    onError: (e: Error) => toast.error(e.message || "Failed to process refund"),
  })

  const handlePackingSlip = async (orderId: string) => {
    try {
      const blob = await shopOrdersService.getPackingSlip(orderId)
      downloadBlob(blob, `packing-slip-${orderId}.pdf`)
    } catch {
      toast.error("Failed to download packing slip")
    }
  }

  const handleExportCsv = async () => {
    try {
      const blob = await shopOrdersService.exportCsv(filters)
      downloadBlob(blob, `orders-export-${new Date().toISOString().slice(0, 10)}.csv`)
      toast.success("CSV exported")
    } catch {
      toast.error("Failed to export CSV")
    }
  }

  if (mode !== "STORE_MODE") {
    return (
      <div className="space-y-6">
        <PageHeader title="Store Orders" subtitle="Select a shop to view orders" />
        <EmptyShopState isSuperAdmin={isSuperAdmin} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Store Orders"
        subtitle={data?.pagination ? `${data.pagination.total} total` : undefined}
      >
        <Button variant="outline" size="sm" onClick={handleExportCsv} className="gap-1.5">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </PageHeader>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search orders..."
              aria-label="Search orders"
              className="h-9 pl-9"
              value={searchInput}
              onChange={(e) => { setSearchInput(e.target.value); setPage(1) }}
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
            <SelectTrigger className="h-9 w-[160px]" aria-label="Filter by status">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" aria-label="From date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1) }} className="h-9 w-[140px] text-xs" />
          <span className="text-xs text-muted-foreground">–</span>
          <Input type="date" aria-label="To date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1) }} className="h-9 w-[140px] text-xs" />
          {isFetching && !isLoading && <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </Card>

      {isError ? (
        <ErrorBlock message={error instanceof Error ? error.message : "Failed to load orders"} onRetry={() => refetch()} />
      ) : isLoading ? (
        <Card className="p-4"><div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div></Card>
      ) : (
        <div className="space-y-3">
          {!data?.items?.length ? (
            <Card className="p-8 text-center text-muted-foreground">No orders found</Card>
          ) : data.items.map((order) => (
            <OrderRow
              key={order.id}
              order={order}
              onUpdateStatus={(status) => updateStatusMutation.mutate({ orderId: order.id, status })}
              onAssignRider={() => setAssignRiderOrder(order)}
              onCancel={() => setCancelOrder(order)}
              onRefund={() => setRefundOrder(order)}
              onPackingSlip={() => handlePackingSlip(order.id)}
            />
          ))}
        </div>
      )}

      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {data.pagination.page} of {data.pagination.totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= data.pagination.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Assign Rider Dialog */}
      <Dialog open={!!assignRiderOrder} onOpenChange={() => setAssignRiderOrder(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Rider — #{assignRiderOrder?.order_number}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="rider-id">Rider ID</Label>
            <Input id="rider-id" value={riderId} onChange={(e) => setRiderId(e.target.value)} placeholder="Enter rider ID" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignRiderOrder(null)}>Cancel</Button>
            <Button disabled={!riderId.trim() || assignRiderMutation.isPending} onClick={() => assignRiderOrder && assignRiderMutation.mutate({ orderId: assignRiderOrder.id, riderId })}>
              {assignRiderMutation.isPending ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={!!cancelOrder} onOpenChange={() => setCancelOrder(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancel Order — #{cancelOrder?.order_number}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="cancel-reason">Reason</Label>
            <Input id="cancel-reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Reason for cancellation" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOrder(null)}>Back</Button>
            <Button variant="destructive" disabled={!cancelReason.trim() || cancelMutation.isPending} onClick={() => cancelOrder && cancelMutation.mutate({ orderId: cancelOrder.id, reason: cancelReason })}>
              {cancelMutation.isPending ? "Cancelling..." : "Cancel Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund Dialog */}
      <Dialog open={!!refundOrder} onOpenChange={() => setRefundOrder(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Refund Order — #{refundOrder?.order_number}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="refund-amount">Amount (max {formatCurrency(refundOrder?.total_amount ?? 0)})</Label>
            <Input id="refund-amount" type="number" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} placeholder="Refund amount" max={refundOrder?.total_amount} />
            <Label htmlFor="refund-reason">Reason</Label>
            <Input id="refund-reason" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder="Reason for refund" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundOrder(null)}>Back</Button>
            <Button disabled={!refundAmount || !refundReason.trim() || refundMutation.isPending} onClick={() => refundOrder && refundMutation.mutate({ orderId: refundOrder.id, amount: Number(refundAmount), reason: refundReason })}>
              {refundMutation.isPending ? "Processing..." : "Process Refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function OrderRow({ order, onUpdateStatus, onAssignRider, onCancel, onRefund, onPackingSlip }: {
  order: ShopOrder
  onUpdateStatus: (status: ShopOrderStatus) => void
  onAssignRider: () => void
  onCancel: () => void
  onRefund: () => void
  onPackingSlip: () => void
}) {
  const nextStatuses = STATUS_TRANSITIONS[order.status] ?? []
  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold">#{order.order_number}</span>
            <Badge variant="outline" className="text-xs">{order.status.replace(/_/g, " ")}</Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{order.customer_name}</span>
            <span>{order.items_count} items</span>
            <span className="font-semibold text-foreground tabular-nums">{formatCurrency(order.total_amount)}</span>
          </div>
          {order.rider_name && <span className="text-xs text-muted-foreground flex items-center gap-1"><Truck className="h-3 w-3" /> {order.rider_name}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PermissionGate require="shop_orders.update_status">
            {nextStatuses.map((status) => (
              <Button key={status} size="sm" variant={status === "CANCELLED" ? "destructive" : "default"} onClick={() => status === "CANCELLED" ? onCancel() : onUpdateStatus(status)}>
                {status.replace(/_/g, " ")}
              </Button>
            ))}
          </PermissionGate>
          {(order.status === "READY" || order.status === "CONFIRMED") && !order.rider_id && (
            <PermissionGate require="shop_orders.update_status">
              <Button size="sm" variant="outline" onClick={onAssignRider} className="gap-1"><Truck className="h-3.5 w-3.5" /> Assign Rider</Button>
            </PermissionGate>
          )}
          {order.status === "DELIVERED" && (
            <PermissionGate require="shop_orders.update_status">
              <Button size="sm" variant="outline" onClick={onRefund}>Refund</Button>
            </PermissionGate>
          )}
          <Button size="sm" variant="ghost" onClick={onPackingSlip} title="Download packing slip"><FileText className="h-4 w-4" /></Button>
        </div>
      </div>
    </Card>
  )
}
