"use client"

import { Suspense, useState, useCallback, useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { format } from "date-fns"
import {
  Search,
  Download,
  Filter,
  X,
  Plus,
  CheckSquare,
  Truck,
  RefreshCw,
  Printer,
  AlertTriangle,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/PageHeader"
import { DateRangePicker } from "@/components/shared/DateRangePicker"
import { EmptyState } from "@/components/shared/EmptyState"
import { useOrders, useOrderStatusCounts, useExportOrders, useBulkUpdateStatus, useBulkAssignRiders, useBulkReconcilePayments } from "@/hooks/useOrders"
import { useRiders } from "@/hooks/useRiders"
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
import { Label } from "@/components/ui/label"
import { useDebounce } from "@/hooks/useDebounce"
import {
  ORDER_STATUSES,
  STATUS_CONFIG,
  ORDER_TYPE_CONFIG,
  PAYMENT_METHOD_LABELS,
  type OrderStatus,
  type OrderType,
  type PaymentMethod,
} from "@/lib/constants"
import { formatINR, formatRelativeTime, formatDateTime, cn } from "@/lib/utils"
import type { OrderFilters } from "@/types"
import { Checkbox } from "@/components/ui/checkbox"
import { OrderDetailDrawer } from "@/components/orders/OrderDetailDrawer"
import { OrderCountdown } from "@/components/orders/OrderCountdown"
import { useConnectionStatus } from "@/hooks/useSocket"
import { usePermissions } from "@/hooks/usePermissions"

export default function OrdersPage() {
  return (
    <Suspense fallback={<OrdersLoadingSkeleton />}>
      <OrdersContent />
    </Suspense>
  )
}

const DEFAULT_LIMIT = 20
const VALID_LIMITS = [20, 50, 100]
/** Statuses where an order is no longer actively in transit — the ASAP ETA countdown freezes rather than ticking (or going negative) forever. */
const TERMINAL_STATUSES = new Set<OrderStatus>(["DELIVERED", "CANCELLED", "REFUNDED"])

function OrdersContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Every filter (status tab, search, payment method, date range, amount
  // range, delivery type, rider, area), pagination, and the currently open
  // order are all seeded from the URL — a bookmarked/shared link, a page
  // refresh, or the browser back button all land back on the exact same
  // filtered view. Matches the routing already added to /products and
  // /customers (e.g. `?status=active&segment=vip&sort=name`).
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "")
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">(() => {
    const v = searchParams.get("status")
    return v && (ORDER_STATUSES as readonly string[]).includes(v) ? (v as OrderStatus) : ""
  })
  const [paymentFilter, setPaymentFilter] = useState<PaymentMethod | "">(() => {
    const v = searchParams.get("payment")
    return v && v in PAYMENT_METHOD_LABELS ? (v as PaymentMethod) : ""
  })
  const [page, setPageState] = useState(() => {
    const fromUrl = Number(searchParams.get("page"))
    return Number.isFinite(fromUrl) && fromUrl > 0 ? fromUrl : 1
  })
  const [limit, setLimit] = useState(() => {
    const fromUrl = Number(searchParams.get("limit"))
    return VALID_LIMITS.includes(fromUrl) ? fromUrl : DEFAULT_LIMIT
  })
  const [selectedOrderId, setSelectedOrderIdState] = useState<string | null>(
    () => searchParams.get("order")
  )
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>(() => {
    const start = searchParams.get("startDate")
    const end = searchParams.get("endDate")
    return {
      from: start ? new Date(start) : undefined,
      to: end ? new Date(end) : undefined,
    }
  })
  const [minAmount, setMinAmount] = useState(() => searchParams.get("minAmount") ?? "")
  const [maxAmount, setMaxAmount] = useState(() => searchParams.get("maxAmount") ?? "")
  const [deliveryType, setDeliveryType] = useState(() => searchParams.get("deliveryType") ?? "")
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false)
  const [bulkStatusValue, setBulkStatusValue] = useState<OrderStatus | "">("")
  const [confirmBulkCancel, setConfirmBulkCancel] = useState(false)
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false)
  const [bulkRiderId, setBulkRiderId] = useState("")
  const [riderFilter, setRiderFilter] = useState(() => searchParams.get("rider") ?? "")
  const [areaFilter, setAreaFilter] = useState(() => searchParams.get("area") ?? "")
  const [needsReviewOnly, setNeedsReviewOnly] = useState(
    () => searchParams.get("needsReview") === "true"
  )
  const [recoveredOnly, setRecoveredOnly] = useState(
    () => searchParams.get("recovered") === "true"
  )
  const [paymentStatusFilter, setPaymentStatusFilter] = useState(
    () => searchParams.get("paymentStatus") ?? ""
  )

  // Merges the given filter values into the URL query string in a single
  // `router.replace` (shallow, no scroll/refetch of the rest of the app).
  // A single call per action avoids two handlers racing each other over
  // the same tick — `useSearchParams()` doesn't reflect a `replace` until
  // the next render, so chaining separate single-param updates would have
  // the second call silently drop the first's change.
  const updateQuery = useCallback(
    (updates: Record<string, string | number | undefined>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === "") params.delete(key)
        else params.set(key, String(value))
      }
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      })
    },
    [pathname, router, searchParams],
  )

  const setPage = useCallback(
    (next: number | ((prev: number) => number)) => {
      setPageState((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next
        updateQuery({ page: resolved > 1 ? resolved : undefined })
        return resolved
      })
    },
    [updateQuery],
  )

  const openOrder = useCallback(
    (id: string) => {
      setSelectedOrderIdState(id)
      updateQuery({ order: id })
    },
    [updateQuery],
  )

  const closeOrder = useCallback(() => {
    setSelectedOrderIdState(null)
    updateQuery({ order: undefined })
  }, [updateQuery])

  const handleStatusTab = useCallback(
    (status: string) => {
      const next = status === "ALL" ? "" : (status as OrderStatus)
      setStatusFilter(next)
      setNeedsReviewOnly(false)
      setPageState(1)
      updateQuery({ status: next, needsReview: undefined, page: undefined })
    },
    [updateQuery],
  )

  const handleNeedsReviewToggle = useCallback(() => {
    setNeedsReviewOnly((prev) => {
      const next = !prev
      if (next) setStatusFilter("")
      setPageState(1)
      updateQuery({
        needsReview: next ? "true" : undefined,
        status: next ? undefined : undefined,
        page: undefined,
      })
      return next
    })
  }, [updateQuery])

  const handleRecoveredToggle = useCallback(() => {
    setRecoveredOnly((prev) => {
      const next = !prev
      if (next) setStatusFilter("")
      setPageState(1)
      updateQuery({ recovered: next ? "true" : undefined, page: undefined })
      return next
    })
  }, [updateQuery])

  const handlePaymentStatusChange = useCallback(
    (v: string) => {
      const next = v === "all_payment_statuses" ? "" : v
      setPaymentStatusFilter(next)
      setPageState(1)
      updateQuery({ paymentStatus: next, page: undefined })
    },
    [updateQuery],
  )

  const handlePaymentChange = useCallback(
    (v: string) => {
      const next = v === "all_methods" ? "" : (v as PaymentMethod)
      setPaymentFilter(next)
      setPageState(1)
      updateQuery({ payment: next, page: undefined })
    },
    [updateQuery],
  )

  const handleDateRangeChange = useCallback(
    (r: { from?: Date; to?: Date }) => {
      setDateRange(r)
      setPageState(1)
      updateQuery({
        startDate: r.from ? format(r.from, "yyyy-MM-dd") : undefined,
        endDate: r.to ? format(r.to, "yyyy-MM-dd") : undefined,
        page: undefined,
      })
    },
    [updateQuery],
  )

  const handleOrderTypeToggle = useCallback(
    (value: "express" | "scheduled" | "standard") => {
      const next = deliveryType === value ? "" : value
      setDeliveryType(next)
      setPageState(1)
      updateQuery({ deliveryType: next, page: undefined })
    },
    [deliveryType, updateQuery],
  )

  const handleMinAmountChange = useCallback(
    (v: string) => {
      setMinAmount(v)
      setPageState(1)
      updateQuery({ minAmount: v, page: undefined })
    },
    [updateQuery],
  )

  const handleMaxAmountChange = useCallback(
    (v: string) => {
      setMaxAmount(v)
      setPageState(1)
      updateQuery({ maxAmount: v, page: undefined })
    },
    [updateQuery],
  )

  const handleRiderChange = useCallback(
    (v: string) => {
      const next = v === "all_riders" ? "" : v
      setRiderFilter(next)
      setPageState(1)
      updateQuery({ rider: next, page: undefined })
    },
    [updateQuery],
  )

  const handleAreaChange = useCallback(
    (v: string) => {
      setAreaFilter(v)
      setPageState(1)
      updateQuery({ area: v, page: undefined })
    },
    [updateQuery],
  )

  const handleLimitChange = useCallback(
    (v: string) => {
      const next = Number(v)
      setLimit(next)
      setPageState(1)
      updateQuery({ limit: next === DEFAULT_LIMIT ? undefined : next, page: undefined })
    },
    [updateQuery],
  )

  // Search is debounced before it drives the query — the URL follows that
  // same debounced value rather than updating on every keystroke. The
  // `isFirstSearchSync` guard stops this from firing on mount, which would
  // otherwise strip `page`/other filters already present in a deep-linked
  // URL.
  const debouncedSearch = useDebounce(search, 400)
  const isFirstSearchSync = useRef(true)
  useEffect(() => {
    if (isFirstSearchSync.current) {
      isFirstSearchSync.current = false
      return
    }
    setPageState(1)
    updateQuery({ search: debouncedSearch, page: undefined })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  const filters: OrderFilters = {
    page,
    limit,
    ...(statusFilter && { status: statusFilter }),
    ...(paymentFilter && { paymentMethod: paymentFilter }),
    ...(debouncedSearch && { search: debouncedSearch }),
    ...(dateRange.from && { startDate: format(dateRange.from, "yyyy-MM-dd") }),
    ...(dateRange.to && { endDate: format(dateRange.to, "yyyy-MM-dd") }),
    ...(minAmount && { minAmount: Number(minAmount) }),
    ...(maxAmount && { maxAmount: Number(maxAmount) }),
    ...(deliveryType && { deliveryType }),
    ...(riderFilter && { riderId: riderFilter }),
    ...(areaFilter && { area: areaFilter }),
    ...(needsReviewOnly && { needsPaymentReview: true }),
    ...(recoveredOnly && { recoveredFromFailed: true }),
    ...(paymentStatusFilter && { paymentStatus: paymentStatusFilter }),
  }

  const { data, isLoading } = useOrders(filters)
  const { data: statusCounts } = useOrderStatusCounts()
  const exportOrders = useExportOrders()
  const bulkUpdateStatus = useBulkUpdateStatus()
  const bulkAssignRiders = useBulkAssignRiders()
  const bulkReconcilePayments = useBulkReconcilePayments()
  const { data: ridersData } = useRiders()
  const connStatus = useConnectionStatus()
  const { can } = usePermissions()
  const canManage = can("orders.manage")

  const orders = data?.orders ?? []
  const pagination = data?.pagination

  const handleExport = () => {
    exportOrders.mutate({
      status: statusFilter || undefined,
    })
  }

  const clearFilters = () => {
    setSearch("")
    setStatusFilter("")
    setPaymentFilter("")
    setDateRange({})
    setMinAmount("")
    setMaxAmount("")
    setDeliveryType("")
    setRiderFilter("")
    setAreaFilter("")
    setNeedsReviewOnly(false)
    setRecoveredOnly(false)
    setPaymentStatusFilter("")
    setPageState(1)
    setSelectedIds(new Set())
    updateQuery({
      search: undefined,
      status: undefined,
      payment: undefined,
      startDate: undefined,
      endDate: undefined,
      minAmount: undefined,
      maxAmount: undefined,
      deliveryType: undefined,
      rider: undefined,
      area: undefined,
      needsReview: undefined,
      recovered: undefined,
      paymentStatus: undefined,
      page: undefined,
    })
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === orders.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(orders.map((o) => o.id)))
    }
  }

  const hasActiveFilters = search || statusFilter || paymentFilter || dateRange.from || minAmount || maxAmount || deliveryType || riderFilter || areaFilter || needsReviewOnly || recoveredOnly || paymentStatusFilter
  const needsReviewCount = statusCounts?.NEEDS_REVIEW ?? 0
  const recoveredCount = statusCounts?.RECOVERED ?? 0

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <PageHeader title="Orders" subtitle="Manage and track customer orders">
        <div className="flex items-center gap-2">
          {connStatus === "connected" && (
            <div className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-md">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
              </span>
              Live
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exportOrders.isPending}
          >
            <Download className="h-4 w-4 mr-1.5" />
            Export CSV
          </Button>
          {canManage && (
            <Link href="/orders/new">
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1.5" />
                Create Order
              </Button>
            </Link>
          )}
        </div>
      </PageHeader>

      {/* Status Tabs */}
      <Tabs
        value={statusFilter || "ALL"}
        onValueChange={handleStatusTab}
        className="w-full"
      >
        <TabsList className="h-9 w-full justify-start overflow-x-auto flex-nowrap">
          <TabsTrigger value="ALL" className="text-xs px-3">
            All {statusCounts && `(${Object.values(statusCounts).reduce((s: number, c: number) => s + c, 0)})`}
          </TabsTrigger>
          {ORDER_STATUSES.map((s) => {
            const config = STATUS_CONFIG[s]
            const count = statusCounts?.[s] ?? 0
            return (
              <TabsTrigger key={s} value={s} className="text-xs px-3 whitespace-nowrap">
                {config.label}
                {count > 0 && (
                  <Badge
                    variant="outline"
                    className="ml-1.5 h-5 min-w-[20px] px-1 text-[10px] border-0"
                    style={{ backgroundColor: config.bg, color: config.text }}
                  >
                    {count}
                  </Badge>
                )}
              </TabsTrigger>
            )
          })}
        </TabsList>
      </Tabs>

      {/* Needs Review / Recovered — both payment-reconciliation flags, kept
          separate from the status tabs since either can happen to an order
          in any fulfillment status. */}
      {(needsReviewCount > 0 || recoveredCount > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {needsReviewCount > 0 && (
            <button
              type="button"
              onClick={handleNeedsReviewToggle}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                needsReviewOnly
                  ? "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
                  : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-500"
              )}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {needsReviewOnly ? "Showing: Needs Review" : "Needs Review"}
              <Badge variant="outline" className="h-5 min-w-[20px] px-1 text-[10px] border-0 bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-300">
                {needsReviewCount}
              </Badge>
              {needsReviewOnly && <X className="h-3.5 w-3.5 ml-1" />}
            </button>
          )}
          {recoveredCount > 0 && (
            <button
              type="button"
              onClick={handleRecoveredToggle}
              title="Orders where a payment previously shown FAILED was later confirmed captured by Razorpay"
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                recoveredOnly
                  ? "border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400"
                  : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-500"
              )}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {recoveredOnly ? "Showing: Recovered" : "Recovered (shown failed, actually paid)"}
              <Badge variant="outline" className="h-5 min-w-[20px] px-1 text-[10px] border-0 bg-blue-200 text-blue-900 dark:bg-blue-900 dark:text-blue-300">
                {recoveredCount}
              </Badge>
              {recoveredOnly && <X className="h-3.5 w-3.5 ml-1" />}
            </button>
          )}
        </div>
      )}

      {/* Search + Filter Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Search orders"
            placeholder="Search order ID, customer name, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {/* Quick order-type filter buttons — clicking the active one turns
            it off; no "all types" catch-all, matching the status tabs'
            already-selected-by-default "All" behavior via an empty filter. */}
        <div className="flex items-center gap-1.5">
          {(["express", "scheduled", "standard"] as const).map((value) => {
            const config = ORDER_TYPE_CONFIG[value.toUpperCase() as OrderType]
            return (
              <Button
                key={value}
                variant={deliveryType === value ? "default" : "outline"}
                size="sm"
                className="h-9 text-xs"
                onClick={() => handleOrderTypeToggle(value)}
              >
                {config.label}
              </Button>
            )
          })}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className={cn(showFilters && "bg-accent")}
        >
          <Filter className="h-4 w-4 mr-1.5" />
          Filters
        </Button>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Expanded Filters */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-muted/50 border animate-fade-in">
          <Select value={paymentFilter || "all_methods"} onValueChange={handlePaymentChange}>
            <SelectTrigger className="h-9 w-[170px]">
              <SelectValue placeholder="Payment Method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all_methods">All Methods</SelectItem>
              {Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DateRangePicker
            value={dateRange}
            onChange={handleDateRangeChange}
            className="w-[220px]"
          />

          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              placeholder="Min ₹"
              value={minAmount}
              onChange={(e) => handleMinAmountChange(e.target.value)}
              className="h-9 w-[90px] text-xs"
            />
            <span className="text-xs text-muted-foreground">–</span>
            <Input
              type="number"
              placeholder="Max ₹"
              value={maxAmount}
              onChange={(e) => handleMaxAmountChange(e.target.value)}
              className="h-9 w-[90px] text-xs"
            />
          </div>

          {/* Rider Filter */}
          <Select value={riderFilter || "all_riders"} onValueChange={handleRiderChange}>
            <SelectTrigger className="h-9 w-[170px]">
              <SelectValue placeholder="Assigned Rider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all_riders">All Riders</SelectItem>
              {(ridersData?.riders ?? []).map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Area / Pincode Filter */}
          <Input
            placeholder="Area / Pincode"
            value={areaFilter}
            onChange={(e) => handleAreaChange(e.target.value)}
            className="h-9 w-[140px] text-xs"
          />

          {/* Payment Status — independent of order fulfillment status, e.g.
              to find every FAILED-payment order for a historical bulk
              re-check against Razorpay. */}
          <Select value={paymentStatusFilter || "all_payment_statuses"} onValueChange={handlePaymentStatusChange}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue placeholder="Payment Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all_payment_statuses">Any Payment Status</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
              <SelectItem value="EXPIRED">Expired</SelectItem>
              <SelectItem value="REFUNDED">Refunded</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && canManage && (
        <div className="flex items-center gap-3 p-3 bg-brand-50 border border-brand-200 rounded-lg animate-fade-in">
          <CheckSquare className="h-4 w-4 text-brand-500" />
          <span className="text-sm font-medium">{selectedIds.size} order(s) selected</span>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkStatusOpen(true)}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Update Status
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkAssignOpen(true)}
            >
              <Truck className="h-3.5 w-3.5 mr-1" />
              Assign Rider
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-blue-600 border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-950/30"
              disabled={bulkReconcilePayments.isPending}
              onClick={() => bulkReconcilePayments.mutate(Array.from(selectedIds))}
              title="Re-verify each selected order's payment directly against Razorpay — the historical audit tool for old FAILED-payment orders"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1", bulkReconcilePayments.isPending && "animate-spin")} />
              {bulkReconcilePayments.isPending ? "Checking…" : "Re-check Payments"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const ids = Array.from(selectedIds)
                ids.forEach((id) => {
                  window.open(`/orders/${id}/packing-slip`, "_blank")
                })
              }}
            >
              <Printer className="h-3.5 w-3.5 mr-1" />
              Print Slips
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                exportOrders.mutate({
                  status: statusFilter || undefined,
                })
              }}
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              Export Selected
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Orders Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={orders.length > 0 && selectedIds.size === orders.length}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead className="w-[140px]">Order ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Shop</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Order Type</TableHead>
              <TableHead>Rider</TableHead>
              <TableHead className="text-right">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-60">
                  <EmptyState
                    title="No orders found"
                    description={
                      hasActiveFilters
                        ? "Try adjusting your filters"
                        : "Orders will appear here when customers place them"
                    }
                    actionLabel={hasActiveFilters ? "Clear Filters" : undefined}
                    onAction={hasActiveFilters ? clearFilters : undefined}
                  />
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => {
                // `order.status` should always be a known OrderStatus, but
                // fall back to a labeled "Unknown" badge (never a bare,
                // unlabeled dot) if a row ever shows up with a null/legacy
                // value the badge map doesn't recognize.
                const status = STATUS_CONFIG[order.status] ?? {
                  label: order.status || "Unknown",
                  bg: "#F3F4F6",
                  text: "#6B7280",
                  icon: "●",
                }
                return (
                  <TableRow
                    key={order.id}
                    className="cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => openOrder(order.id)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(order.id)}
                        onCheckedChange={() => toggleSelect(order.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      <div className="flex items-center gap-1.5">
                        #{order.order_number}
                        {order.buyer_gstin && (
                          <Badge
                            variant="secondary"
                            className="rounded-full bg-violet-100 px-1.5 py-0 text-[10px] font-semibold text-violet-700 hover:bg-violet-100"
                            title={order.buyer_company_name ?? undefined}
                          >
                            B2B
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium text-foreground truncate max-w-[180px]">
                          {order.customer_name || "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {order.customer_phone || "—"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-foreground truncate block max-w-[160px]">
                        {order.shop_name ?? order.shop?.name ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-sm">
                      {formatINR(order.total_amount)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-muted-foreground">
                          {PAYMENT_METHOD_LABELS[order.payment_method] ?? order.payment_method}
                        </span>
                        {/* Wallet split — a "COD" row used to hide that part of the
                            total was already paid from the wallet, so the rider's
                            cash amount didn't match the Total column. */}
                        {Number(order.wallet_amount_used) > 0 && (
                          <span className="text-[10px] font-medium text-primary">
                            Wallet {formatINR(Number(order.wallet_amount_used))}
                            {order.total_amount - Number(order.wallet_amount_used) > 0.005
                              ? ` + ${formatINR(order.total_amount - Number(order.wallet_amount_used))} ${order.payment_method === "COD" ? "cash" : "Razorpay"}`
                              : " (full)"}
                          </span>
                        )}
                        {/* Razorpay's own status, inline — so "did the money
                            actually come through" is visible while scanning
                            the list, not only after opening the order. */}
                        {order.payment_method === "ONLINE" && order.payment_status && (
                          <span
                            className={cn(
                              "text-[10px] font-medium",
                              order.payment_status === "PAID" && "text-success",
                              order.payment_status === "PENDING" && "text-amber-600",
                              (order.payment_status === "FAILED" || order.payment_status === "EXPIRED") && "text-destructive"
                            )}
                          >
                            {order.payment_status === "PAID" ? "✓ Razorpay: Paid" : `Razorpay: ${order.payment_status}`}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="text-[11px] px-2 py-0.5 border-0 font-medium"
                        style={{ backgroundColor: status.bg, color: status.text }}
                      >
                        {status.icon} {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {order.order_type ? (
                        <div className="space-y-0.5">
                          <Badge
                            variant="outline"
                            className="text-[11px] px-2 py-0.5 border-0 font-medium"
                            style={{
                              backgroundColor: ORDER_TYPE_CONFIG[order.order_type].bg,
                              color: ORDER_TYPE_CONFIG[order.order_type].text,
                            }}
                          >
                            {ORDER_TYPE_CONFIG[order.order_type].label}
                          </Badge>
                          {/* Express/Standard (ASAP) → live countdown to the
                              ETA. Scheduled → the exact booked slot. Neither
                              ticks/renders once the order is no longer
                              actively in transit. */}
                          {order.order_type === "SCHEDULED" ? (
                            <p className="text-[11px] text-muted-foreground">
                              {order.scheduled_slot_label ??
                                (order.scheduled_slot_start
                                  ? formatDateTime(order.scheduled_slot_start)
                                  : null)}
                            </p>
                          ) : order.estimated_delivery ? (
                            <OrderCountdown
                              estimatedDelivery={order.estimated_delivery}
                              frozen={TERMINAL_STATUSES.has(order.status)}
                            />
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {order.rider_name || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {formatRelativeTime(order.created_at)}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {pagination && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
            <div className="flex items-center gap-3">
              <p className="text-xs text-muted-foreground">
                Showing {(pagination.page - 1) * pagination.limit + 1}–
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                {pagination.total} orders
              </p>
              <Select value={String(limit)} onValueChange={handleLimitChange}>
                <SelectTrigger className="h-7 w-[110px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20 / page</SelectItem>
                  <SelectItem value="50">50 / page</SelectItem>
                  <SelectItem value="100">100 / page</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {pagination.totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="h-8 text-xs"
                >
                  Previous
                </Button>
                {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                  let pageNum: number
                  if (pagination.totalPages <= 5) {
                    pageNum = i + 1
                  } else if (page <= 3) {
                    pageNum = i + 1
                  } else if (page >= pagination.totalPages - 2) {
                    pageNum = pagination.totalPages - 4 + i
                  } else {
                    pageNum = page - 2 + i
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={pageNum === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPage(pageNum)}
                      className="h-8 w-8 text-xs p-0"
                    >
                      {pageNum}
                    </Button>
                  )
                })}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-8 text-xs"
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Order Detail Drawer */}
      <OrderDetailDrawer
        orderId={selectedOrderId}
        open={!!selectedOrderId}
        onClose={closeOrder}
      />

      {/* Bulk Status Update Dialog */}
      <Dialog open={bulkStatusOpen} onOpenChange={setBulkStatusOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Status for {selectedIds.size} Orders</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>New Status</Label>
            <Select value={bulkStatusValue} onValueChange={(v) => setBulkStatusValue(v as OrderStatus)}>
              <SelectTrigger>
                <SelectValue placeholder="Select status..." />
              </SelectTrigger>
              <SelectContent>
                {ORDER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkStatusOpen(false)}>Cancel</Button>
            <Button
              disabled={!bulkStatusValue || bulkUpdateStatus.isPending}
              onClick={() => {
                if (bulkStatusValue === "CANCELLED") {
                  setConfirmBulkCancel(true)
                  return
                }
                bulkUpdateStatus.mutate({
                  orderIds: Array.from(selectedIds),
                  status: bulkStatusValue as OrderStatus,
                }, {
                  onSuccess: () => {
                    setBulkStatusOpen(false)
                    setBulkStatusValue("")
                    setSelectedIds(new Set())
                  },
                })
              }}
            >
              {bulkUpdateStatus.isPending ? "Updating..." : "Update Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk cancel confirmation — a misclick here cancels many orders at once */}
      <AlertDialog open={confirmBulkCancel} onOpenChange={setConfirmBulkCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel {selectedIds.size} orders?</AlertDialogTitle>
            <AlertDialogDescription>
              This marks all {selectedIds.size} selected orders as cancelled with no refund and no
              reason recorded. This cannot be undone from here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, go back</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                bulkUpdateStatus.mutate({
                  orderIds: Array.from(selectedIds),
                  status: "CANCELLED" as OrderStatus,
                }, {
                  onSuccess: () => {
                    setBulkStatusOpen(false)
                    setBulkStatusValue("")
                    setSelectedIds(new Set())
                  },
                })
                setConfirmBulkCancel(false)
              }}
            >
              Yes, cancel {selectedIds.size} orders
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Assign Rider Dialog */}
      <Dialog open={bulkAssignOpen} onOpenChange={setBulkAssignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Rider to {selectedIds.size} Orders</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Select Rider</Label>
            <Select value={bulkRiderId} onValueChange={setBulkRiderId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a rider..." />
              </SelectTrigger>
              <SelectContent>
                {(ridersData?.riders ?? []).map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name} — {r.phone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAssignOpen(false)}>Cancel</Button>
            <Button
              disabled={!bulkRiderId || bulkAssignRiders.isPending}
              onClick={() => {
                bulkAssignRiders.mutate(
                  Array.from(selectedIds).map((orderId) => ({ orderId, riderId: bulkRiderId })),
                  {
                    onSuccess: () => {
                      setBulkAssignOpen(false)
                      setBulkRiderId("")
                      setSelectedIds(new Set())
                    },
                  }
                )
              }}
            >
              {bulkAssignRiders.isPending ? "Assigning..." : "Assign Rider"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function OrdersLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  )
}
