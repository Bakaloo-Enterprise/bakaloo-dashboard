"use client"

import { BillSummary } from "@/components/orders/BillSummary"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { RiderAssignmentSection } from "@/components/orders/RiderAssignmentSection"
import { B2BApprovalSection } from "@/components/orders/B2BApprovalSection"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  FileText,
  Phone,
  MapPin,
  Package,
  Truck,
  Clock,
  CheckCircle2,
  XCircle,
  Circle,
  User,
  CreditCard,
  RotateCcw,
  RefreshCw,
  Ban,
  Printer,
  Navigation,
  CalendarClock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Landmark,
  Receipt,
} from "lucide-react"
import {
  useOrderDetail,
  useUpdateOrderStatus,
  useDownloadInvoice,
  useRefundOrder,
  useCancelOrder,
  useRescheduleOrder,
  useDownloadPackingSlip,
  useDownloadTaxInvoice,
  useOrderNotes,
  useAddOrderNote,
  useResyncPayment,
  useRazorpayDetails,
} from "@/hooks/useOrders"
import { useCustomerDetail } from "@/hooks/useCustomers"
import { useShopContextStore } from "@/store/shop-context.store"
import {
  STATUS_CONFIG,
  STATUS_TRANSITIONS,
  PAYMENT_METHOD_LABELS,
  type OrderStatus,
} from "@/lib/constants"
import { formatINR, formatDateTime, formatRelativeTime, cn } from "@/lib/utils"

interface OrderDetailDrawerProps {
  orderId: string | null
  open: boolean
  onClose: () => void
}

const TIMELINE_ICONS: Record<string, React.ReactNode> = {
  PENDING: <Clock className="h-3.5 w-3.5" />,
  CONFIRMED: <CheckCircle2 className="h-3.5 w-3.5" />,
  PREPARING: <Package className="h-3.5 w-3.5" />,
  PACKED: <Package className="h-3.5 w-3.5" />,
  OUT_FOR_DELIVERY: <Truck className="h-3.5 w-3.5" />,
  DELIVERED: <CheckCircle2 className="h-3.5 w-3.5" />,
  CANCELLED: <XCircle className="h-3.5 w-3.5" />,
  REFUNDED: <Circle className="h-3.5 w-3.5" />,
}

export function OrderDetailDrawer({ orderId, open, onClose }: OrderDetailDrawerProps) {
  const router = useRouter()
  const { data: order, isLoading } = useOrderDetail(orderId)
  const {
    data: customer,
    isLoading: customerLoading,
    isError: customerErrored,
  } = useCustomerDetail(order?.user_id ?? null)
  const updateStatus = useUpdateOrderStatus()
  const downloadInvoice = useDownloadInvoice()
  const refundOrder = useRefundOrder()
  const cancelOrder = useCancelOrder()
  const resyncPayment = useResyncPayment()
  const [showRazorpayDetails, setShowRazorpayDetails] = useState(false)
  const {
    data: razorpayDetails,
    isLoading: razorpayDetailsLoading,
    isError: razorpayDetailsErrored,
  } = useRazorpayDetails(order?.id ?? null, showRazorpayDetails)
  const rescheduleOrder = useRescheduleOrder()
  const downloadPacking = useDownloadPackingSlip()
  const downloadTaxInvoice = useDownloadTaxInvoice()
  const { data: notes, isLoading: notesLoading } = useOrderNotes(orderId)
  const addOrderNote = useAddOrderNote()
  const [noteDraft, setNoteDraft] = useState("")

  // Vendor scope enforcement (Req 10.10): a vendor (`assignedShopIds.length > 0`)
  // who opens an order whose `shop_id` is not in their locked shop list must
  // see the 404 empty state rather than the underlying record. Super-admins
  // (`assignedShopIds = []`) bypass the check entirely. The check is skipped
  // while the detail is still loading so the loading skeleton renders
  // normally; once the response arrives, an unknown `shop_id` triggers the
  // 404 path. A missing/`null`/`undefined` `shop_id` is treated as "not
  // enforced" so legacy unscoped order responses (pre task 12.1) do not
  // regress before the backend ships the new field on every endpoint.
  const assignedShopIds = useShopContextStore((s) => s.assignedShopIds)
  const isVendor = assignedShopIds.length > 0
  const orderShopId = order?.shop_id
  const vendorHasAccess =
    !isVendor ||
    orderShopId == null ||
    assignedShopIds.includes(orderShopId)
  const showNotFound = !isLoading && !!order && !vendorHasAccess

  const [refundOpen, setRefundOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [refundForm, setRefundForm] = useState({ reason: "", refundTo: "wallet" })
  const [cancelForm, setCancelForm] = useState({ reason: "", refundTo: "wallet" })
  const [rescheduleForm, setRescheduleForm] = useState({ date: "", startTime: "", endTime: "", reason: "" })
  // A wrong click on the "Update Status" dropdown or either destructive
  // dialog's submit button used to fire the mutation immediately — one
  // misclick silently cancelled/refunded a real order. Each of these gates
  // a second, explicit "are you sure?" step in front of the actual mutation.
  const [pendingStatusCancel, setPendingStatusCancel] = useState(false)
  const [confirmCancelSubmit, setConfirmCancelSubmit] = useState(false)
  const [confirmRefundSubmit, setConfirmRefundSubmit] = useState(false)
  // The status Select is uncontrolled (no `value` prop) so it visually
  // "sticks" on whatever was last picked — bumping this key remounts it
  // back to the placeholder when a pending cancel is declined.
  const [statusSelectResetKey, setStatusSelectResetKey] = useState(0)

  // A B2B credit order awaiting admin approval must never be moved by the
  // generic status dropdown — the dedicated Approve action (B2BApprovalSection
  // below) is the only door out of PENDING, since that's what actually
  // deducts stock (re-checked fresh at that moment). The backend rejects
  // this too; hiding the options here just avoids a round-trip error.
  const allowedTransitions = order && order.b2b_approval_status !== "PENDING"
    ? STATUS_TRANSITIONS[order.status] ?? []
    : []

  // A refund only makes sense once money has actually changed hands —
  // `payment_status` is set to PAID for both online orders (at capture)
  // and COD orders (when the rider marks the order delivered, i.e. cash
  // collected — see `delivery.repository.js`). "Original Payment Method"
  // is further restricted to orders with a captured Razorpay transaction —
  // there's no gateway charge to reverse for COD cash. The refund amount
  // itself is never admin-editable: it's always exactly what was paid.
  const isPaid = order?.payment_status === "PAID"
  const paidAmount = order?.payment?.amount ?? order?.total_amount ?? 0
  const hasGatewayPayment = !!(
    order?.payment?.status === "PAID" && order?.payment?.razorpay_payment_id
  )

  // Checkout stores the address snapshot with camelCase keys
  // (`addressLine1`/`addressLine2`, from the addresses repository's
  // snake_case -> camelCase formatter) — fall back to the older
  // `line1`/`address_line` keys for any legacy/manually-created orders.
  // This snapshot is what was saved at order time — never the customer's
  // current/updated profile address — so it stays accurate for old orders.
  const deliveryAddr = order?.delivery_address
  const streetAddress =
    deliveryAddr?.addressLine1 || deliveryAddr?.line1 || deliveryAddr?.address_line
  const deliveryLat = deliveryAddr?.lat ?? deliveryAddr?.latitude
  const deliveryLng = deliveryAddr?.lng ?? deliveryAddr?.longitude
  const hasDeliveryCoords =
    typeof deliveryLat === "number" &&
    typeof deliveryLng === "number" &&
    Number.isFinite(deliveryLat) &&
    Number.isFinite(deliveryLng)
  const hasAnyAddressData = !!(
    streetAddress ||
    deliveryAddr?.addressLine2 ||
    deliveryAddr?.city ||
    deliveryAddr?.pincode
  )

  const storeLat = order?.store?.lat
  const storeLng = order?.store?.lng
  const hasStoreCoords =
    typeof storeLat === "number" &&
    typeof storeLng === "number" &&
    Number.isFinite(storeLat) &&
    Number.isFinite(storeLng)

  // Prefer real turn-by-turn driving directions (store -> customer) — only
  // fall back to a destination-only pin when the fulfilling shop has no
  // saved coordinates (e.g. a legacy order with no shop attribution). The
  // button itself is disabled entirely when even the destination is
  // unknown; it never uses the admin's own browser location.
  const deliveryMapsUrl = hasDeliveryCoords
    ? hasStoreCoords
      ? `https://www.google.com/maps/dir/?api=1&origin=${storeLat},${storeLng}&destination=${deliveryLat},${deliveryLng}&travelmode=driving`
      : `https://www.google.com/maps/search/?api=1&query=${deliveryLat},${deliveryLng}`
    : null

  // Road distance: only ever a genuine stored Google route (see
  // `resolveRoadRouteDistance` on the backend) — never a haversine
  // straight-line value, even as a fallback.
  const roadDistanceKm = order?.delivery_route?.distance_km ?? null

  const handleStatusChange = (newStatus: string) => {
    if (!order) return
    if (newStatus === "CANCELLED") {
      setPendingStatusCancel(true)
      return
    }
    updateStatus.mutate({
      orderId: order.id,
      payload: { status: newStatus as OrderStatus },
    })
  }

  return (
    <>
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg p-0">
        <SheetHeader className="px-6 pt-6 pb-3">
          <SheetTitle className="flex items-center justify-between">
            <span>
              {isLoading ? (
                <Skeleton className="h-6 w-40" />
              ) : showNotFound ? (
                <>Order</>
              ) : (
                <>Order #{order?.order_number}</>
              )}
            </span>
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-80px)]">
          <div className="px-6 pb-6 space-y-5">
            {isLoading ? (
              <OrderDrawerSkeleton />
            ) : showNotFound ? (
              <OrderNotFound />
            ) : !order ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Order not found
              </div>
            ) : (
              <>
                {/* Status + Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className="text-xs px-2.5 py-1 border-0 font-medium"
                    style={{
                      backgroundColor: STATUS_CONFIG[order.status]?.bg ?? "#F3F4F6",
                      color: STATUS_CONFIG[order.status]?.text ?? "#6B7280",
                    }}
                  >
                    {STATUS_CONFIG[order.status]?.icon} {STATUS_CONFIG[order.status]?.label ?? order.status ?? "Unknown"}
                  </Badge>

                  {allowedTransitions.length > 0 && (
                    <Select
                      key={statusSelectResetKey}
                      onValueChange={handleStatusChange}
                      disabled={updateStatus.isPending}
                    >
                      <SelectTrigger className="h-8 w-[160px] text-xs">
                        <SelectValue placeholder="Update Status" />
                      </SelectTrigger>
                      <SelectContent>
                        {allowedTransitions.map((s) => (
                          <SelectItem key={s} value={s} className="text-xs">
                            → {STATUS_CONFIG[s]?.label ?? s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  <div className="flex flex-wrap items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => downloadPacking.mutate(order.id)}
                      disabled={downloadPacking.isPending}
                    >
                      <Printer className="h-3.5 w-3.5 mr-1" />
                      Slip
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => downloadInvoice.mutate(order.id)}
                      disabled={downloadInvoice.isPending}
                    >
                      <FileText className="h-3.5 w-3.5 mr-1" />
                      Invoice
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => downloadTaxInvoice.mutate(order.id)}
                      disabled={downloadTaxInvoice.isPending}
                    >
                      <Receipt className="h-3.5 w-3.5 mr-1" />
                      Tax Invoice
                    </Button>
                  </div>
                </div>

                {/* Re-check with Razorpay — for a payment stuck PENDING, or one
                    flagged needs_manual_review (captured after the order had
                    already moved on, e.g. cancelled — the backend won't
                    auto-confirm that case, since stock may already be back
                    on the shelf). Shown regardless of order status, since a
                    stuck payment can outlive whatever the order did. */}
                {order.payment?.razorpay_order_id &&
                  (order.payment.status === "PENDING" ||
                    order.payment.metadata?.needs_manual_review) && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs text-blue-600 border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                        onClick={() => resyncPayment.mutate(order.id)}
                        disabled={resyncPayment.isPending}
                      >
                        <RefreshCw
                          className={cn(
                            "h-3.5 w-3.5 mr-1",
                            resyncPayment.isPending && "animate-spin"
                          )}
                        />
                        Re-check with Razorpay
                      </Button>
                    </div>
                  )}

                {/* Refund / Cancel Actions */}
                {order.status !== "CANCELLED" && order.status !== "REFUNDED" && (
                  <div className="flex items-center gap-2">
                    {order.status === "DELIVERED" && isPaid && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs text-amber-600 border-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                        onClick={() => {
                          setRefundForm({ reason: "", refundTo: "wallet" })
                          setRefundOpen(true)
                        }}
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        Process Refund
                      </Button>
                    )}
                    {!["DELIVERED", "OUT_FOR_DELIVERY"].includes(order.status) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30"
                        onClick={() => {
                          setCancelForm({ reason: "", refundTo: isPaid ? "wallet" : "none" })
                          setCancelOpen(true)
                        }}
                      >
                        <Ban className="h-3.5 w-3.5 mr-1" />
                        Cancel Order
                      </Button>
                    )}
                  </div>
                )}

                {/* Customer's own stated cancellation reason — populated
                    only for customer self-cancellations (orders.cancelled_reason).
                    Admin-initiated cancels store their reason separately in
                    order_status_history.note instead, already shown below in
                    the Status Timeline, so this intentionally shows "No
                    reason provided" for those rather than being a bug. */}
                {order.status === "CANCELLED" && (
                  <div className="rounded-lg p-3 text-sm" style={{ backgroundColor: "#FEF2F2" }}>
                    <p className="font-medium" style={{ color: "#EF4444" }}>
                      Cancellation reason
                    </p>
                    <p className="text-muted-foreground mt-0.5">
                      {order.cancelled_reason
                        ? order.cancelled_reason.replace(/^OTHER:\s*/, "")
                        : "No reason provided"}
                    </p>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Placed {formatDateTime(order.created_at)} · {formatRelativeTime(order.created_at)}
                </p>

                {/* Rider Assignment — first section in the drawer, not
                    buried below Status Timeline/Notes/Customer/Items, so
                    it's the first thing an admin sees on a Packed order
                    that still needs a rider picked. Editable once Packed,
                    read-only chip otherwise. Hidden entirely for B2B
                    "Place Order" credit orders — those are distributed
                    manually by an admin outside the rider-assignment
                    system, so this section (and the whole concept of a
                    rider) is never applicable to them. */}
                {order.b2b_approval_status ? (
                  <B2BApprovalSection order={order} />
                ) : order.status === "PACKED" ? (
                  <RiderAssignmentSection order={order} />
                ) : (
                  order.rider_name && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                      <Truck className="h-4 w-4 text-brand-500" />
                      <div className="text-sm">
                        <span className="font-medium">{order.rider_name}</span>
                        {order.rider_phone && (
                          <span className="text-muted-foreground ml-2 text-xs">
                            <Phone className="h-3 w-3 inline mr-0.5" />
                            {order.rider_phone}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                )}

                <Separator />

                {/* Status Timeline */}
                <div>
                  <h4 className="text-sm font-semibold mb-3">Status Timeline</h4>
                  <div className="space-y-0">
                    {order.timeline.map((entry, i) => {
                      const config = STATUS_CONFIG[entry.to_status as OrderStatus]
                      const isLast = i === order.timeline.length - 1
                      return (
                        <div key={entry.changed_at + entry.to_status} className="flex gap-3">
                          {/* Dot + Line */}
                          <div className="flex flex-col items-center">
                            <div
                              className={cn(
                                "flex h-6 w-6 items-center justify-center rounded-full",
                                isLast ? "bg-brand-500 text-white" : "bg-muted text-muted-foreground"
                              )}
                            >
                              {TIMELINE_ICONS[entry.to_status] ?? <Circle className="h-3.5 w-3.5" />}
                            </div>
                            {!isLast && <div className="w-px h-6 bg-border" />}
                          </div>
                          {/* Content */}
                          <div className="pb-3">
                            <p className="text-sm font-medium" style={{ color: config?.text }}>
                              {config?.label ?? entry.to_status}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {formatDateTime(entry.changed_at)}
                              {entry.changed_by_name && ` · by ${entry.changed_by_name}`}
                            </p>
                            {entry.note && (
                              <p className="text-xs text-muted-foreground mt-0.5 italic">
                                &quot;{entry.note}&quot;
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <Separator />

                {/* Notes — internal, staff-only CRM-style thread on this
                    order (e.g. "customer asked for extra veggies"),
                    independent of status changes. Oldest first so the
                    first note added shows first. */}
                <div>
                  <h4 className="text-sm font-semibold mb-3">Notes</h4>
                  <div className="space-y-2">
                    {notesLoading ? (
                      <>
                        <Skeleton className="h-12 w-full rounded-lg" />
                        <Skeleton className="h-12 w-full rounded-lg" />
                      </>
                    ) : notes && notes.length > 0 ? (
                      notes.map((n) => (
                        <div key={n.id} className="rounded-lg bg-muted/40 p-2.5">
                          <p className="text-sm text-foreground whitespace-pre-wrap">{n.body}</p>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            {n.author_name ?? "Unknown"} · {formatDateTime(n.created_at)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground">No notes yet.</p>
                    )}
                  </div>
                  <div className="mt-3 space-y-2">
                    <Textarea
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      placeholder="Add an internal note..."
                      rows={2}
                    />
                    <Button
                      size="sm"
                      className="h-8 text-xs"
                      disabled={!noteDraft.trim() || addOrderNote.isPending}
                      onClick={() => {
                        if (!order) return
                        addOrderNote.mutate(
                          { orderId: order.id, body: noteDraft.trim() },
                          { onSuccess: () => setNoteDraft("") }
                        )
                      }}
                    >
                      {addOrderNote.isPending ? "Adding..." : "Add Note"}
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Customer */}
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <User className="h-4 w-4 text-muted-foreground" />
                    Customer
                  </h4>
                  <div className="text-sm">
                    <button
                      type="button"
                      onClick={() => router.push(`/customers?customer=${order.user_id}`)}
                      className="font-medium text-brand-600 hover:underline text-left"
                    >
                      {order.customer_name}
                    </button>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      {order.customer_phone}
                      {order.customer_email && ` · ${order.customer_email}`}
                    </p>
                    {/* Reliability signal — how many of this customer's past
                        orders actually completed vs. were cancelled/returned,
                        so an admin can gauge trustworthiness without leaving
                        this drawer. Three explicit states: skeleton while
                        loading (never a flashed "0"), the real counts once
                        loaded, or "—" per box on a genuine fetch failure —
                        the labels stay visible either way rather than the
                        whole row silently disappearing. */}
                    {customerLoading ? (
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <Skeleton className="h-5 w-24 rounded-full" />
                        <Skeleton className="h-5 w-24 rounded-full" />
                        <Skeleton className="h-5 w-24 rounded-full" />
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <StatBadge
                          label="Completed"
                          value={customerErrored ? null : customer?.completed_orders}
                          bg="#ECFDF5"
                          fg="#10B981"
                        />
                        <StatBadge
                          label="Returned"
                          value={customerErrored ? null : customer?.returned_orders}
                          bg="#F5F3FF"
                          fg="#8B5CF6"
                        />
                        <StatBadge
                          label="Cancelled"
                          value={customerErrored ? null : customer?.cancelled_orders}
                          bg="#FEF2F2"
                          fg="#EF4444"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Order Items */}
                <div>
                  <h4 className="text-sm font-semibold mb-3">
                    Items ({order.items?.length ?? 0})
                  </h4>
                  <div className="space-y-3">
                    {order.items?.map((item) => (
                      <div key={item.id ?? item.product_id} className="flex items-center gap-3">
                        <div className="relative h-10 w-10 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                          {item.thumbnail_url ? (
                            <Image
                              src={item.thumbnail_url}
                              alt={item.name}
                              fill
                              className="object-cover"
                              sizes="40px"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center">
                              <Package className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.quantity} × {formatINR(item.price)}
                            {item.net_quantity
                              ? ` · ${item.net_quantity}`
                              : item.unit && ` · ${item.unit}`}
                          </p>
                        </div>
                        <span className="text-sm font-semibold">{formatINR(item.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Payment — every line item that actually adds up to Total
                    lives in one place now. Previously "Cart Enhancement
                    Details" (Handling Fee, Late Night Fee, Tip) was a
                    separate section below this one, so Subtotal + Delivery
                    Fee visibly didn't reach Total and looked like a
                    calculation error. Savings Total is informational only
                    (it doesn't subtract again from Total — the coupon
                    portion is already reflected in Discount), so it's shown
                    as a callout rather than a line in the running sum. */}
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    Payment
                  </h4>
                  <div className="space-y-1.5 text-sm">
                    {order.bill ? (
                      <BillSummary bill={order.bill} />
                    ) : (
                      <>
                        <Row label="Subtotal" value={formatINR(order.subtotal)} />
                        <Row label="Delivery Fee" value={formatINR(order.delivery_fee)} />
                        {order.platform_fee > 0 && <Row label="Platform Fee" value={formatINR(order.platform_fee)} />}
                        {order.handling_fee > 0 && <Row label="Handling Fee" value={formatINR(order.handling_fee)} />}
                        {order.late_night_fee > 0 && <Row label="Late Night Fee" value={formatINR(order.late_night_fee)} />}
                        {order.tip_amount > 0 && <Row label="Tip Amount" value={formatINR(order.tip_amount)} />}
                        {order.tax_amount > 0 && <Row label="Tax" value={formatINR(order.tax_amount)} />}
                        {order.discount_amount > 0 && (
                          <Row
                            label={`Discount${order.coupon_code ? ` (${order.coupon_code})` : ""}`}
                            value={`-${formatINR(order.discount_amount)}`}
                            className="text-success font-semibold"
                          />
                        )}
                        <Separator />
                        <Row label="Total" value={formatINR(order.total_amount)} className="font-bold text-base text-foreground" />
                      </>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {order.payment?.status && `Razorpay: ${order.payment.status}`}
                      {order.payment?.razorpay_payment_id &&
                        ` · ${order.payment.razorpay_payment_id}`}
                    </p>
                    {order.payment?.status === "FAILED" &&
                      (order.payment.error_reason || order.payment.error_description) && (
                        <p className="text-xs text-red-600 mt-1">
                          Declined: {order.payment.error_reason ?? order.payment.error_description}
                        </p>
                      )}
                    {order.payment?.metadata?.needs_manual_review && (
                      <div className="flex items-start gap-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 p-2 mt-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                          Razorpay captured this payment after the order had already{" "}
                          {order.status === "CANCELLED" ? "been cancelled" : "moved on"} — it
                          was <strong>not</strong> auto-confirmed since stock may already be
                          back on the shelf. Re-confirm manually if fulfillable, or refund.
                        </p>
                      </div>
                    )}
                    {order.payment?.razorpay_payment_id && (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => setShowRazorpayDetails((v) => !v)}
                          className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                        >
                          <Landmark className="h-3.5 w-3.5" />
                          Razorpay Details
                          {showRazorpayDetails ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </button>
                        {showRazorpayDetails && (
                          <div className="mt-2 rounded-lg border bg-muted/30 p-3 text-xs">
                            {razorpayDetailsLoading ? (
                              <p className="text-muted-foreground">Fetching from Razorpay…</p>
                            ) : razorpayDetailsErrored || !razorpayDetails ? (
                              <p className="text-muted-foreground">
                                Couldn&apos;t fetch live details from Razorpay right now.
                              </p>
                            ) : (
                              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                                <RzpRow label="Method" value={razorpayDetails.method} />
                                {razorpayDetails.vpa && <RzpRow label="UPI ID" value={razorpayDetails.vpa} />}
                                {razorpayDetails.bank && <RzpRow label="Bank" value={razorpayDetails.bank} />}
                                {razorpayDetails.wallet && <RzpRow label="Wallet" value={razorpayDetails.wallet} />}
                                {razorpayDetails.card && (
                                  <RzpRow
                                    label="Card"
                                    value={`${razorpayDetails.card.network} •••• ${razorpayDetails.card.last4} (${razorpayDetails.card.type})`}
                                  />
                                )}
                                <RzpRow label="International" value={razorpayDetails.international ? "Yes" : "No"} />
                                {razorpayDetails.fee != null && <RzpRow label="Razorpay fee" value={formatINR(razorpayDetails.fee)} />}
                                {razorpayDetails.tax != null && <RzpRow label="Tax (GST)" value={formatINR(razorpayDetails.tax)} />}
                                {razorpayDetails.acquirerReference && (
                                  <RzpRow label="Acquirer ref (ARN)" value={razorpayDetails.acquirerReference} mono />
                                )}
                                {razorpayDetails.upiTransactionId && (
                                  <RzpRow label="UPI txn ID" value={razorpayDetails.upiTransactionId} mono />
                                )}
                                {razorpayDetails.createdAt && (
                                  <RzpRow label="Captured at" value={formatDateTime(razorpayDetails.createdAt)} />
                                )}
                                {razorpayDetails.amountRefunded > 0 && (
                                  <RzpRow
                                    label="Refunded"
                                    value={`${formatINR(razorpayDetails.amountRefunded)} (${razorpayDetails.refundStatus ?? "—"})`}
                                  />
                                )}
                                {(razorpayDetails.errorReason || razorpayDetails.errorDescription) && (
                                  <RzpRow
                                    label="Decline reason"
                                    value={razorpayDetails.errorReason ?? razorpayDetails.errorDescription ?? ""}
                                  />
                                )}
                              </dl>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {!order.bill && order.savings_total > 0 && (
                      <p className="text-xs text-success font-semibold mt-1">
                        Customer saved {formatINR(order.savings_total)} on this order
                      </p>
                    )}
                    {order.delivery_instructions?.trim() && (
                      <div className="flex flex-col gap-1 rounded-lg bg-muted/40 p-3 mt-2">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Delivery Instructions
                        </span>
                        <p className="text-sm leading-5 text-foreground">
                          {order.delivery_instructions}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Delivery */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <h4 className="text-sm font-semibold flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      Delivery
                    </h4>
                    {/* Always rendered — disabled only when the customer's
                        own delivery coordinates are missing, per spec, with
                        a tooltip explaining why rather than just vanishing. */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={!deliveryMapsUrl}
                      title={
                        deliveryMapsUrl
                          ? undefined
                          : "Customer location is not available for this order"
                      }
                      asChild={!!deliveryMapsUrl}
                    >
                      {deliveryMapsUrl ? (
                        <a
                          href={deliveryMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Navigation className="h-3 w-3 mr-1" />
                          View live on Map
                        </a>
                      ) : (
                        <span>
                          <Navigation className="h-3 w-3 mr-1" />
                          View live on Map
                        </span>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    {roadDistanceKm != null
                      ? `Road distance: ${roadDistanceKm} km`
                      : "Road distance unavailable"}
                  </p>
                  <div className="text-sm text-muted-foreground space-y-1">

                    {/* Scheduled delivery badge */}
                    {order.delivery_mode === 'SCHEDULED' && order.scheduled_slot_label && (
                      <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg"
                        style={{ backgroundColor: '#F5F3FF', border: '1px solid #DDD6FE' }}>
                        <Clock className="h-4 w-4 flex-shrink-0" style={{ color: '#7C3AED' }} />
                        <div>
                          <p className="text-xs font-semibold" style={{ color: '#7C3AED' }}>
                            Scheduled delivery
                          </p>
                          <p className="text-xs" style={{ color: '#7C3AED' }}>
                            {order.scheduled_slot_label}
                          </p>
                        </div>
                      </div>
                    )}
                    {(!order.delivery_mode || order.delivery_mode === 'ASAP') && (
                      <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg bg-green-50 border border-green-100">
                        <Truck className="h-4 w-4 flex-shrink-0 text-green-600" />
                        <p className="text-xs font-medium text-green-700">ASAP delivery</p>
                      </div>
                    )}
                    {!["OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "REFUNDED"].includes(order.status) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs mb-2"
                        onClick={() => {
                          setRescheduleForm({
                            date: order.scheduled_slot_start ? order.scheduled_slot_start.slice(0, 10) : "",
                            startTime: order.scheduled_slot_start
                              ? new Date(order.scheduled_slot_start).toTimeString().slice(0, 5)
                              : "",
                            endTime: order.scheduled_slot_end
                              ? new Date(order.scheduled_slot_end).toTimeString().slice(0, 5)
                              : "",
                            reason: "",
                          })
                          setRescheduleOpen(true)
                        }}
                      >
                        <CalendarClock className="h-3.5 w-3.5 mr-1" />
                        Change delivery slot
                      </Button>
                    )}

                    {hasAnyAddressData ? (
                      <>
                        {deliveryAddr?.label && (
                          <p className="text-xs font-medium text-foreground">
                            {deliveryAddr.label}
                          </p>
                        )}
                        <p>{streetAddress || "—"}</p>
                        {deliveryAddr?.addressLine2 && <p>{deliveryAddr.addressLine2}</p>}
                        {deliveryAddr?.landmark && (
                          <p className="text-xs">Landmark: {deliveryAddr.landmark}</p>
                        )}
                        {deliveryAddr?.city && (
                          <p>
                            {deliveryAddr.city}
                            {deliveryAddr.state && `, ${deliveryAddr.state}`}
                            {deliveryAddr.pincode && ` – ${deliveryAddr.pincode}`}
                          </p>
                        )}
                        {hasDeliveryCoords && (
                          <p className="text-xs font-mono">
                            {deliveryLat!.toFixed(6)}, {deliveryLng!.toFixed(6)}
                          </p>
                        )}
                      </>
                    ) : (
                      <p>Delivery address unavailable</p>
                    )}
                    {order.delivery_notes && (
                      <p className="text-xs italic mt-1">📝 {order.delivery_notes}</p>
                    )}
                  </div>

                  {/* Delivery assignment details */}
                  {order.delivery && (
                    <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                      {order.delivery.distance_km && (
                        <p>Distance: {order.delivery.distance_km} km</p>
                      )}
                      {order.delivery.delivery_time_minutes && (
                        <p>Delivery time: {order.delivery.delivery_time_minutes} min</p>
                      )}
                      {order.delivery.delivery_otp && (
                        <p>OTP: <span className="font-mono font-semibold text-foreground">{order.delivery.delivery_otp}</span></p>
                      )}
                    </div>
                  )}

                  {/* COD payment collection — only present once the rider
                      has gone through the collect-payment step at delivery;
                      null for Wallet/Online orders (already paid). */}
                  {order.delivery &&
                    (order.delivery.cash_collected != null ||
                      order.delivery.upi_collected != null) && (
                      <div className="mt-2 rounded-lg bg-muted/40 p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
                          Payment Collected
                        </p>
                        <div className="space-y-1 text-sm">
                          {order.delivery.cash_collected != null && (
                            <Row
                              label="Cash"
                              value={formatINR(order.delivery.cash_collected)}
                            />
                          )}
                          {order.delivery.upi_collected != null && (
                            <Row
                              label="UPI"
                              value={formatINR(order.delivery.upi_collected)}
                            />
                          )}
                          <Row
                            label="Total collected"
                            value={formatINR(
                              // Postgres DECIMAL columns come back as strings
                              // (no type parser registered backend-side, same
                              // as total_amount elsewhere on this object) —
                              // Number() first so this sums instead of
                              // string-concatenating "0.00" + "55.00".
                              Number(order.delivery.cash_collected ?? 0) +
                                Number(order.delivery.upi_collected ?? 0)
                            )}
                            className="font-semibold text-foreground"
                          />
                        </div>
                      </div>
                    )}

                  {/* Proof photo */}
                  {order.proof_photo_url && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-foreground mb-1">Delivery Proof</p>
                      <div className="relative h-32 w-full rounded-lg overflow-hidden bg-muted">
                        <Image
                          src={order.proof_photo_url}
                          alt="Delivery proof"
                          fill
                          className="object-cover"
                          sizes="400px"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>

    {/* Refund Dialog */}
    <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Process Refund</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Refund Amount</Label>
            <p className="text-lg font-semibold mt-1">{formatINR(paidAmount)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Locked to the amount the customer actually paid — not editable.
            </p>
          </div>
          <div>
            <Label>Reason</Label>
            <Textarea
              value={refundForm.reason}
              onChange={(e) => setRefundForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder="Reason for refund..."
              rows={2}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Refund To</Label>
            <Select
              value={refundForm.refundTo}
              onValueChange={(v) => setRefundForm((f) => ({ ...f, refundTo: v }))}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {hasGatewayPayment && (
                  <SelectItem value="original">Original Payment Method</SelectItem>
                )}
                <SelectItem value="wallet">Wallet Balance</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setRefundOpen(false)}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={!refundForm.reason || refundOrder.isPending}
            onClick={() => setConfirmRefundSubmit(true)}
          >
            {refundOrder.isPending ? "Processing..." : "Process Refund"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Refund confirmation */}
    <AlertDialog open={confirmRefundSubmit} onOpenChange={setConfirmRefundSubmit}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Refund {formatINR(paidAmount)} to the customer?</AlertDialogTitle>
          <AlertDialogDescription>
            This immediately moves money to order #{order?.order_number}&apos;s customer via{" "}
            {refundForm.refundTo === "original" ? "their original payment method" : "wallet credit"}. This cannot be undone from here.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>No, go back</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              if (!order) return
              refundOrder.mutate({
                orderId: order.id,
                payload: {
                  reason: refundForm.reason,
                  refundTo: refundForm.refundTo as "wallet" | "original",
                },
              }, { onSuccess: () => { setRefundOpen(false); setConfirmRefundSubmit(false) } })
            }}
          >
            Yes, process refund
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Cancel Dialog */}
    <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel Order</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Cancellation Reason</Label>
            <Select
              value={cancelForm.reason}
              onValueChange={(v) => setCancelForm((f) => ({ ...f, reason: v }))}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select reason..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Customer requested">Customer requested</SelectItem>
                <SelectItem value="Out of stock">Out of stock</SelectItem>
                <SelectItem value="Payment failed">Payment failed</SelectItem>
                <SelectItem value="Fraudulent order">Fraudulent order</SelectItem>
                <SelectItem value="Delivery not possible">Delivery not possible</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isPaid ? (
            <div>
              <Label>Refund To</Label>
              <p className="text-xs text-muted-foreground mb-1.5">
                Customer paid {formatINR(paidAmount)} — refund is locked to that amount.
              </p>
              <Select
                value={cancelForm.refundTo}
                onValueChange={(v) => setCancelForm((f) => ({ ...f, refundTo: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {hasGatewayPayment && (
                    <SelectItem value="original">Original Payment Method</SelectItem>
                  )}
                  <SelectItem value="wallet">Wallet Balance</SelectItem>
                  <SelectItem value="none">No Refund</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              This order was never paid — there is nothing to refund.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setCancelOpen(false)}>Back</Button>
          <Button
            variant="destructive"
            disabled={!cancelForm.reason || cancelOrder.isPending}
            onClick={() => setConfirmCancelSubmit(true)}
          >
            {cancelOrder.isPending ? "Cancelling..." : "Cancel Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Cancel-order confirmation */}
    <AlertDialog open={confirmCancelSubmit} onOpenChange={setConfirmCancelSubmit}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure you want to cancel this order?</AlertDialogTitle>
          <AlertDialogDescription>
            Order #{order?.order_number} will be cancelled
            {cancelForm.refundTo !== "none"
              ? ` and ${formatINR(paidAmount)} will be refunded to the customer's ${cancelForm.refundTo === "original" ? "original payment method" : "wallet"}.`
              : " with no refund."}{" "}
            This cannot be undone from here.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>No, go back</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              if (!order) return
              cancelOrder.mutate({
                orderId: order.id,
                payload: {
                  reason: cancelForm.reason,
                  refundTo: cancelForm.refundTo as "wallet" | "original" | "none",
                },
              }, { onSuccess: () => { setCancelOpen(false); setConfirmCancelSubmit(false) } })
            }}
          >
            Yes, cancel order
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Cancel-via-status-dropdown confirmation */}
    <AlertDialog
      open={pendingStatusCancel}
      onOpenChange={(v) => {
        setPendingStatusCancel(v)
        if (!v) setStatusSelectResetKey((k) => k + 1)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
          <AlertDialogDescription>
            This marks order #{order?.order_number} as cancelled with no refund and no reason
            recorded. To issue a refund or record a cancellation reason, use the dedicated
            &quot;Cancel Order&quot; button instead.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>No, go back</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              if (!order) return
              updateStatus.mutate({
                orderId: order.id,
                payload: { status: "CANCELLED" as OrderStatus },
              })
              setPendingStatusCancel(false)
              setStatusSelectResetKey((k) => k + 1)
            }}
          >
            Yes, cancel order
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Reschedule Delivery Dialog */}
    <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change Delivery Slot</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Delivery date</Label>
            <input
              type="date"
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
              value={rescheduleForm.date}
              onChange={(e) => setRescheduleForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <Label>Start time</Label>
              <input
                type="time"
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                value={rescheduleForm.startTime}
                onChange={(e) => setRescheduleForm((f) => ({ ...f, startTime: e.target.value }))}
              />
            </div>
            <div className="flex-1">
              <Label>End time</Label>
              <input
                type="time"
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                value={rescheduleForm.endTime}
                onChange={(e) => setRescheduleForm((f) => ({ ...f, endTime: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label>Reason (internal note)</Label>
            <Textarea
              className="mt-1"
              placeholder="e.g. Store closed unexpectedly"
              value={rescheduleForm.reason}
              onChange={(e) => setRescheduleForm((f) => ({ ...f, reason: e.target.value }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setRescheduleOpen(false)}>Back</Button>
          <Button
            disabled={
              !rescheduleForm.date ||
              !rescheduleForm.startTime ||
              !rescheduleForm.endTime ||
              rescheduleOrder.isPending
            }
            onClick={() => {
              if (!order) return
              const start = new Date(`${rescheduleForm.date}T${rescheduleForm.startTime}:00`)
              const end = new Date(`${rescheduleForm.date}T${rescheduleForm.endTime}:00`)
              const label = `${start.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}, ${start.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })} – ${end.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`
              rescheduleOrder.mutate(
                {
                  orderId: order.id,
                  payload: {
                    scheduledSlotStart: start.toISOString(),
                    scheduledSlotEnd: end.toISOString(),
                    scheduledSlotLabel: label,
                    reason: rescheduleForm.reason || undefined,
                  },
                },
                { onSuccess: () => setRescheduleOpen(false) },
              )
            }}
          >
            {rescheduleOrder.isPending ? "Saving..." : "Save new slot"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}

/** One "Completed 12" / "Returned —" pill in the customer reliability row. */
function StatBadge({
  label,
  value,
  bg,
  fg,
}: {
  label: string
  value: number | null | undefined
  bg: string
  fg: string
}) {
  return (
    <Badge
      variant="outline"
      className="text-[11px] px-2 py-0.5 border-0 font-medium gap-1"
      style={{ backgroundColor: bg, color: fg }}
    >
      <span>{label}</span>
      <span className="font-bold">{value == null ? "—" : value}</span>
    </Badge>
  )
}

function Row({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  )
}

/** One key/value pair in the Razorpay Details grid. */
function RzpRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("text-right font-medium text-foreground", mono && "font-mono text-[11px]")}>
        {value}
      </dd>
    </>
  )
}

/**
 * 404 state shown when a vendor user opens an order whose `shop_id` is not
 * in their `assignedShopIds` (Req 10.10). The textual wording mirrors a
 * generic "not found" so vendors cannot infer the existence of orders
 * outside their shop scope from the UX alone — the drawer reads as a plain
 * 404 rather than a "blocked" state. Mirrors the convention from
 * `<CustomerProfileDrawer />` `<CustomerNotFound />` and `<ReviewNotFound />`.
 */
function OrderNotFound() {
  return (
    <div className="py-16 flex flex-col items-center justify-center text-center">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <FileText className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold">404 — Order not found</h3>
      <p className="text-xs text-muted-foreground mt-2 max-w-xs">
        This order is not part of your shop. Switch to a shop that placed
        the order to view its details.
      </p>
    </div>
  )
}

function OrderDrawerSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-8 w-[160px]" />
      </div>
      <Skeleton className="h-3 w-48" />
      <Separator />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-6 w-6 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
      <Separator />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-4 w-14" />
          </div>
        ))}
      </div>
      <Separator />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}
