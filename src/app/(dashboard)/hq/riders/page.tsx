"use client"

/**
 * HQ Riders page (task 20.7) — consuming `/api/v1/admin/riders` and
 * `/admin/riders/:id/approve`.
 *
 * Lists all riders with filters, supports approve/reject actions.
 */

import { useMemo, useState } from "react"
import {
  Bike,
  CheckCircle,
  Search,
  XCircle,
  Loader2,
  Star,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Textarea } from "@/components/ui/textarea"

import { DataList, type DataListColumn } from "@/components/shared/data-list"
import { ErrorBlock } from "@/components/shared/error-block"
import { PageHeader } from "@/components/shared/PageHeader"

import { useDebounce } from "@/hooks/useDebounce"
import { useHQRiders, useApproveRider, useRejectRider } from "@/hooks/useHQ"
import type { HQRider, HQRiderFilters } from "@/services/hq.service"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 20

export default function HQRidersPage() {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [approvalFilter, setApprovalFilter] = useState("")
  const [page, setPage] = useState(1)
  const [rejectingRider, setRejectingRider] = useState<HQRider | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  const debouncedSearch = useDebounce(search, 300)
  const approveRider = useApproveRider()
  const rejectRider = useRejectRider()

  const filters: HQRiderFilters = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(debouncedSearch.trim() && { search: debouncedSearch.trim() }),
      ...(status && { status }),
      ...(approvalFilter === "approved" && { is_approved: true }),
      ...(approvalFilter === "pending" && { is_approved: false }),
    }),
    [page, debouncedSearch, status, approvalFilter],
  )

  const { data, isLoading, isError, error, refetch } = useHQRiders(filters)
  const rows = data?.items ?? []
  const pagination = data?.pagination

  function handleReject() {
    if (!rejectingRider || !rejectReason.trim()) {
      toast.error("Please provide a reason for rejection")
      return
    }
    rejectRider.mutate(
      { riderId: rejectingRider.id, reason: rejectReason.trim() },
      {
        onSuccess: () => {
          setRejectingRider(null)
          setRejectReason("")
        },
      },
    )
  }

  const columns: DataListColumn<HQRider>[] = [
    {
      id: "rider",
      header: "Rider",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
            {row.avatar_url ? (
              <img
                src={row.avatar_url}
                alt={row.name}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <Bike className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{row.name}</span>
            <span className="text-xs text-muted-foreground">{row.phone}</span>
          </div>
        </div>
      ),
    },
    {
      id: "vehicle",
      header: "Vehicle",
      cell: (row) => (
        <div className="flex flex-col">
          <span className="text-xs">{row.vehicle_type}</span>
          <span className="text-xs text-muted-foreground font-mono">{row.vehicle_number}</span>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => (
        <div className="flex flex-col gap-1">
          <Badge
            variant="secondary"
            className={cn(
              "text-[10px] w-fit",
              row.is_online ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground",
            )}
          >
            {row.is_online ? "Online" : "Offline"}
          </Badge>
          {!row.is_approved && (
            <Badge variant="outline" className="text-[10px] w-fit border-amber-200 bg-amber-50 text-amber-700">
              Pending Approval
            </Badge>
          )}
        </div>
      ),
    },
    {
      id: "rating",
      header: "Rating",
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
          <span className="text-sm tabular-nums">{Number(row.rating ?? 0).toFixed(1)}</span>
        </div>
      ),
    },
    {
      id: "deliveries",
      header: "Deliveries",
      cell: (row) => (
        <span className="text-sm tabular-nums">{row.total_deliveries.toLocaleString()}</span>
      ),
    },
    {
      id: "joined",
      header: "Joined",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">
          {new Date(row.created_at).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex items-center gap-1">
          {!row.is_approved && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-emerald-600 hover:text-emerald-700"
                disabled={approveRider.isPending}
                onClick={() => approveRider.mutate(row.id)}
              >
                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                Approve
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-red-600 hover:text-red-700"
                onClick={() => setRejectingRider(row)}
              >
                <XCircle className="h-3.5 w-3.5 mr-1" />
                Reject
              </Button>
            </>
          )}
          {row.is_approved && (
            <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700">
              Approved
            </Badge>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="HQ — Riders"
        subtitle="Manage and approve delivery riders"
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search riders"
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="h-9 pl-9"
          />
        </div>
        <Select value={status || "__all__"} onValueChange={(v) => { setStatus(v === "__all__" ? "" : v); setPage(1) }}>
          <SelectTrigger className="h-9 w-[140px]" aria-label="Filter by online status">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Status</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
          </SelectContent>
        </Select>
        <Select value={approvalFilter || "__all__"} onValueChange={(v) => { setApprovalFilter(v === "__all__" ? "" : v); setPage(1) }}>
          <SelectTrigger className="h-9 w-[160px]" aria-label="Filter by approval">
            <SelectValue placeholder="All Approval" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="pending">Pending Approval</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Body */}
      {isError ? (
        <ErrorBlock message={(error as Error)?.message ?? ""} onRetry={() => void refetch()} />
      ) : isLoading && rows.length === 0 ? (
        <Card><CardContent className="p-4 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </CardContent></Card>
      ) : rows.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <Bike className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No riders found</p>
        </CardContent></Card>
      ) : (
        <div className="rounded-xl border bg-card shadow-sm">
          <DataList<HQRider>
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
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectingRider !== null} onOpenChange={(open) => { if (!open) { setRejectingRider(null); setRejectReason("") } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Rider</DialogTitle>
          </DialogHeader>
          {rejectingRider && (
            <p className="text-sm text-muted-foreground">
              Rejecting <strong>{rejectingRider.name}</strong> ({rejectingRider.phone})
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Reason *</Label>
            <Textarea
              id="reject-reason"
              placeholder="Provide a reason for rejection..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectingRider(null); setRejectReason("") }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectRider.isPending || !rejectReason.trim()}
            >
              {rejectRider.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
