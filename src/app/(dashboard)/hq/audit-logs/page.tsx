"use client"

/**
 * HQ Audit Logs page (task 20.6) — consuming `/api/v1/admin/audit-logs`.
 *
 * Supports all filters from R28.6: admin_id, action, entity_type,
 * date range. Paginated with DataList.
 */

import { useMemo, useState } from "react"
import {
  Activity,
  Search,
  Filter,
  User,
  Package,
  ShoppingCart,
  Truck,
  Settings,
  Shield,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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

import { DataList, type DataListColumn } from "@/components/shared/data-list"
import { ErrorBlock } from "@/components/shared/error-block"
import { PageHeader } from "@/components/shared/PageHeader"

import { useDebounce } from "@/hooks/useDebounce"
import { useHQAuditLogs } from "@/hooks/useHQ"
import type { HQAuditLog, HQAuditLogFilters } from "@/services/hq.service"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 30

const ENTITY_TYPES = [
  { value: "__all__", label: "All Entities" },
  { value: "order", label: "Orders" },
  { value: "product", label: "Products" },
  { value: "shop", label: "Shops" },
  { value: "user", label: "Users" },
  { value: "rider", label: "Riders" },
  { value: "coupon", label: "Coupons" },
  { value: "banner", label: "Banners" },
  { value: "settings", label: "Settings" },
  { value: "role", label: "Roles" },
  { value: "finance", label: "Finance" },
]

const ENTITY_ICONS: Record<string, React.ReactNode> = {
  order: <ShoppingCart className="h-3 w-3" />,
  product: <Package className="h-3 w-3" />,
  shop: <Settings className="h-3 w-3" />,
  user: <User className="h-3 w-3" />,
  rider: <Truck className="h-3 w-3" />,
  role: <Shield className="h-3 w-3" />,
}

const ENTITY_COLORS: Record<string, string> = {
  order: "bg-blue-50 text-blue-600 border-blue-200",
  product: "bg-green-50 text-green-600 border-green-200",
  shop: "bg-purple-50 text-purple-600 border-purple-200",
  user: "bg-orange-50 text-orange-600 border-orange-200",
  rider: "bg-cyan-50 text-cyan-600 border-cyan-200",
  coupon: "bg-amber-50 text-amber-600 border-amber-200",
  banner: "bg-pink-50 text-pink-600 border-pink-200",
  settings: "bg-muted text-muted-foreground border-border",
  role: "bg-indigo-50 text-indigo-600 border-indigo-200",
  finance: "bg-emerald-50 text-emerald-600 border-emerald-200",
}

export default function HQAuditLogsPage() {
  const [action, setAction] = useState("")
  const [entityType, setEntityType] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [page, setPage] = useState(1)

  const debouncedAction = useDebounce(action, 300)

  const filters: HQAuditLogFilters = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(debouncedAction.trim() && { action: debouncedAction.trim() }),
      ...(entityType && { entity_type: entityType }),
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
    }),
    [page, debouncedAction, entityType, startDate, endDate],
  )

  const { data, isLoading, isError, error, refetch } = useHQAuditLogs(filters)
  const rows = data?.items ?? []
  const pagination = data?.pagination

  const columns: DataListColumn<HQAuditLog>[] = [
    {
      id: "admin",
      header: "Admin",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 bg-brand-100 rounded-full flex items-center justify-center text-brand-600 font-medium text-xs">
            {(row.admin_name || "A")[0].toUpperCase()}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium truncate max-w-[120px]">
              {row.admin_name || "System"}
            </span>
            <span className="text-xs text-muted-foreground truncate max-w-[120px]">
              {row.admin_email}
            </span>
          </div>
        </div>
      ),
    },
    {
      id: "action",
      header: "Action",
      cell: (row) => <span className="text-sm">{row.action}</span>,
    },
    {
      id: "entity",
      header: "Entity",
      cell: (row) => (
        <Badge
          variant="outline"
          className={cn("text-[10px] gap-1", ENTITY_COLORS[row.entity_type] ?? "bg-muted")}
        >
          {ENTITY_ICONS[row.entity_type] ?? <Activity className="h-3 w-3" />}
          <span className="capitalize">{row.entity_type}</span>
        </Badge>
      ),
    },
    {
      id: "changes",
      header: "Changes",
      cell: (row) => <ChangeCell oldValue={row.old_value} newValue={row.new_value} />,
    },
    {
      id: "ip",
      header: "IP",
      cell: (row) => (
        <span className="font-mono text-xs text-muted-foreground">{row.ip_address}</span>
      ),
    },
    {
      id: "time",
      header: "Time",
      cell: (row) => (
        <div className="text-xs">
          <p className="text-muted-foreground">
            {new Date(row.created_at).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </p>
          <p className="text-muted-foreground/60">
            {new Date(row.created_at).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="HQ — Audit Logs"
        subtitle="Track all admin actions across the platform"
      />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Search by action"
                placeholder="Search actions..."
                className="pl-9 h-9"
                value={action}
                onChange={(e) => { setAction(e.target.value); setPage(1) }}
              />
            </div>

            <Select value={entityType || "__all__"} onValueChange={(v) => { setEntityType(v === "__all__" ? "" : v); setPage(1) }}>
              <SelectTrigger className="h-9 w-[160px]" aria-label="Filter by entity type">
                <Filter className="h-3.5 w-3.5 mr-1.5" />
                <SelectValue placeholder="Entity Type" />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="space-y-1">
              <Label htmlFor="audit-start" className="text-xs">From</Label>
              <Input
                id="audit-start"
                type="date"
                className="h-9 w-[140px]"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="audit-end" className="text-xs">To</Label>
              <Input
                id="audit-end"
                type="date"
                className="h-9 w-[140px]"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
              />
            </div>

            <span className="text-xs text-muted-foreground ml-auto">
              {pagination?.total ?? 0} total entries
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Body */}
      {isError ? (
        <ErrorBlock message={(error as Error)?.message ?? ""} onRetry={() => void refetch()} />
      ) : isLoading && rows.length === 0 ? (
        <Card><CardContent className="p-4 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </CardContent></Card>
      ) : rows.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <Activity className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No audit logs found</p>
        </CardContent></Card>
      ) : (
        <div className="rounded-xl border bg-card shadow-sm">
          <DataList<HQAuditLog>
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
          />
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
              </p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Change Cell
// ─────────────────────────────────────────────────────────────────────────────

function ChangeCell({
  oldValue,
  newValue,
}: {
  oldValue: Record<string, unknown> | null
  newValue: Record<string, unknown> | null
}) {
  if (!oldValue && !newValue) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  const formatValue = (v: Record<string, unknown> | null) => {
    if (!v) return "—"
    try {
      const entries = Object.entries(v).slice(0, 3)
      return entries.map(([k, val]) => `${k}: ${val}`).join(", ")
    } catch {
      return JSON.stringify(v).slice(0, 60)
    }
  }

  return (
    <div className="text-xs max-w-[250px] truncate">
      {oldValue && (
        <span className="text-red-500 line-through mr-2">
          {formatValue(oldValue)}
        </span>
      )}
      {newValue && (
        <span className="text-green-600">{formatValue(newValue)}</span>
      )}
    </div>
  )
}
