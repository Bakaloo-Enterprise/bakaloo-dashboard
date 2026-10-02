"use client"

/**
 * HQ Orders page (task 20.3) — cross-shop order view.
 *
 * Consumes `/api/v1/admin/orders` with shop filter, status filter,
 * date range, and search. Paginated with DataList.
 */

import { useMemo, useState } from "react"
import { Search, ShoppingCart } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

import { DataList, type DataListColumn } from "@/components/shared/data-list"
import { ErrorBlock } from "@/components/shared/error-block"
import { PageHeader } from "@/components/shared/PageHeader"

import { useDebounce } from "@/hooks/useDebounce"
import { useHQOrders } from "@/hooks/useHQ"
import { useActiveShopsForSwitcher } from "@/hooks/useShops"
import type { HQOrder, HQOrderFilters } from "@/services/hq.service"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 20

const ORDER_STATUSES = [
  { value: "__all__", label: "All Statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "PREPARING", label: "Preparing" },
  { value: "READY", label: "Ready" },
  { value: "PICKED_UP", label: "Picked Up" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
]

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  PREPARING: "bg-purple-100 text-purple-700",
  READY: "bg-cyan-100 text-cyan-700",
  PICKED_UP: "bg-indigo-100 text-indigo-700",
  DELIVERED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-700",
}

export default function HQOrdersPage() {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [shopId, setShopId] = useState("")
  const [page, setPage] = useState(1)

  const debouncedSearch = useDebounce(search, 300)
  const { data: shopsData } = useActiveShopsForSwitcher()
  const shops = shopsData?.items ?? []

  const filters: HQOrderFilters = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(debouncedSearch.trim() && { search: debouncedSearch.trim() }),
      ...(status && { status }),
      ...(shopId && { shop_id: shopId }),
    }),
    [page, debouncedSearch, status, shopId],
  )

  const { data, isLoading, isError, error, refetch } = useHQOrders(filters)
  const rows = data?.items ?? []
  const pagination = data?.pagination

  const columns: DataListColumn<HQOrder>[] = [
    {
      id: "order_number",
      header: "Order #",
      cell: (row) => (
        <span className="font-mono text-xs font-medium">{row.order_number}</span>
      ),
    },
    {
      id: "customer",
      header: "Customer",
      cell: (row) => (
        <div className="flex flex-col">
          <span className="text-sm">{row.customer_name}</span>
          <span className="text-xs text-muted-foreground">{row.customer_phone}</span>
        </div>
      ),
    },
    {
      id: "shop",
      header: "Shop",
      cell: (row) => <span className="text-sm">{row.shop_name}</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => (
        <Badge
          variant="secondary"
          className={cn("text-[11px]", STATUS_COLORS[row.status] ?? "bg-muted")}
        >
          {row.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      id: "amount",
      header: "Amount",
      cell: (row) => (
        <span className="text-sm font-medium tabular-nums">
          ₹{Number(row.total_amount).toLocaleString()}
        </span>
      ),
    },
    {
      id: "payment",
      header: "Payment",
      cell: (row) => (
        <span className="text-xs">{row.payment_method}</span>
      ),
    },
    {
      id: "rider",
      header: "Rider",
      cell: (row) => (
        <span className="text-sm">{row.rider_name ?? "—"}</span>
      ),
    },
    {
      id: "date",
      header: "Date",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">
          {new Date(row.created_at).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="HQ — Orders"
        subtitle="Cross-shop order management"
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search orders"
            placeholder="Search by order # or customer..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="h-9 pl-9"
          />
        </div>
        <Select value={status || "__all__"} onValueChange={(v) => { setStatus(v === "__all__" ? "" : v); setPage(1) }}>
          <SelectTrigger className="h-9 w-[150px]" aria-label="Filter by status">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            {ORDER_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={shopId || "__all__"} onValueChange={(v) => { setShopId(v === "__all__" ? "" : v); setPage(1) }}>
          <SelectTrigger className="h-9 w-[180px]" aria-label="Filter by shop">
            <SelectValue placeholder="All Shops" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Shops</SelectItem>
            {shops.map((shop) => (
              <SelectItem key={shop.id} value={shop.id}>{shop.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Body */}
      {isError ? (
        <ErrorBlock message={(error as Error)?.message ?? ""} onRetry={() => void refetch()} />
      ) : isLoading && rows.length === 0 ? (
        <Card><CardContent className="p-4 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent></Card>
      ) : rows.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <ShoppingCart className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No orders found</p>
        </CardContent></Card>
      ) : (
        <div className="rounded-xl border bg-card shadow-sm">
          <DataList<HQOrder>
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
          />
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
