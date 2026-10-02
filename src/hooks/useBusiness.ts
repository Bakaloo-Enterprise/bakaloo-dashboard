"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import * as S from "@/services/business.service"
import type { AdjustmentKind, AnalyticsFilters, BulkRowStatus, NewEntryInput, PeriodQuery } from "@/types/business.types"

export function bizError(err: unknown): string {
  const e = err as { response?: { data?: { message?: string } }; message?: string }
  return e?.response?.data?.message ?? e?.message ?? "Something went wrong"
}

export function useBizMe() {
  return useQuery({ queryKey: ["biz", "me"], queryFn: S.getBizMe, staleTime: 5 * 60_000, retry: false })
}

// procurement
export const useVendors = (includeInactive = false) => useQuery({ queryKey: ["biz", "vendors", includeInactive], queryFn: () => S.getVendors(includeInactive), staleTime: 30_000 })
export const useEntries = (params: Parameters<typeof S.getEntries>[0]) => useQuery({ queryKey: ["biz", "entries", params], queryFn: () => S.getEntries(params), placeholderData: (p) => p })
export const useEntry = (id: string | null) => useQuery({ queryKey: ["biz", "entry", id], queryFn: () => S.getEntry(id as string), enabled: Boolean(id), retry: false })
export const useVendorReport = (q: PeriodQuery & { vendorId?: string }, enabled = true) => useQuery({ queryKey: ["biz", "vendor-report", q], queryFn: () => S.getVendorReport(q), enabled, placeholderData: (p) => p })
export const useReconciliation = (q: PeriodQuery & { productId?: string }, enabled = true) => useQuery({ queryKey: ["biz", "reconciliation", q], queryFn: () => S.getReconciliation(q), enabled, placeholderData: (p) => p })

/** Every procurement change can move stock and the reports, so each success re-reads all of "biz". */
export function useProcurementMutations() {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: ["biz"] })
  const base = { onError: (e: unknown) => toast.error(bizError(e)), onSuccess: refresh }
  return {
    createVendor: useMutation({ mutationFn: S.createVendor, ...base }),
    updateVendor: useMutation({ mutationFn: ({ id, ...rest }: { id: string; isActive?: boolean; name?: string }) => S.updateVendor(id, rest), ...base }),
    createEntry: useMutation({ mutationFn: (v: NewEntryInput) => S.createEntry(v), onError: base.onError, onSuccess: () => { toast.success("Purchase recorded"); refresh() } }),
    allocate: useMutation({ mutationFn: (v: { id: string; allocations: Array<{ shopId: string; quantity: number }>; note?: string; updateCostPrice?: boolean }) => S.allocateEntry(v.id, v.allocations, { note: v.note, updateCostPrice: v.updateCostPrice }), onError: base.onError, onSuccess: () => { toast.success("Stock sent to the stores"); refresh() } }),
    adjust: useMutation({ mutationFn: ({ id, ...rest }: { id: string; kind: AdjustmentKind; quantity: number; reason: string; shopId?: string }) => S.adjustEntry(id, rest), onError: base.onError, onSuccess: () => { toast.success("Adjustment recorded"); refresh() } }),
    reserve: useMutation({ mutationFn: (v: { id: string; note: string }) => S.reserveEntry(v.id, v.note), ...base }),
    release: useMutation({ mutationFn: (id: string) => S.releaseEntry(id), ...base }),
    cancel: useMutation({ mutationFn: (id: string) => S.cancelEntry(id), ...base }),
    reverse: useMutation({ mutationFn: (allocationId: string) => S.reverseAllocation(allocationId), ...base }),
  }
}

// bulk catalog
export const useUploads = () => useQuery({ queryKey: ["biz", "uploads"], queryFn: S.getUploads })
export const useUpload = (id: string | null) => useQuery({ queryKey: ["biz", "upload", id], queryFn: () => S.getUpload(id as string), enabled: Boolean(id) })
export const useUploadRows = (id: string | null, status: BulkRowStatus | undefined, offset: number) =>
  useQuery({ queryKey: ["biz", "upload-rows", id, status, offset], queryFn: () => S.getUploadRows(id as string, { status, limit: 100, offset }), enabled: Boolean(id), placeholderData: (p) => p })
export function useBulkMutations() {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: ["biz"] })
  const onError = (e: unknown) => toast.error(bizError(e))
  return {
    upload: useMutation({ mutationFn: (file: File) => S.uploadSheet(file), onError, onSuccess: refresh }),
    apply: useMutation({ mutationFn: (v: { id: string; skipErrors: boolean }) => S.applyUpload(v.id, v.skipErrors), onError, onSuccess: () => { toast.success("Changes applied"); refresh() } }),
    discard: useMutation({ mutationFn: (id: string) => S.discardUpload(id), onError, onSuccess: refresh }),
    availability: useMutation({ mutationFn: S.bulkAvailability, onError, onSuccess: (r) => { if (!r.dryRun) { toast.success(`${r.applied} product-store pair(s) updated`); refresh() } } }),
  }
}

// analytics
export const useOverview = (q: AnalyticsFilters, enabled = true) => useQuery({ queryKey: ["biz", "a", "overview", q], queryFn: () => S.getOverview(q), enabled, placeholderData: (p) => p })
export const useTopProducts = (q: AnalyticsFilters & { sort?: string }, enabled = true) => useQuery({ queryKey: ["biz", "a", "products", q], queryFn: () => S.getTopProducts(q), enabled, placeholderData: (p) => p })
export const useTopCustomers = (q: AnalyticsFilters, enabled = true) => useQuery({ queryKey: ["biz", "a", "customers", q], queryFn: () => S.getTopCustomers(q), enabled, placeholderData: (p) => p })
export const useStorePerf = (q: AnalyticsFilters, enabled = true) => useQuery({ queryKey: ["biz", "a", "stores", q], queryFn: () => S.getStorePerf(q), enabled, placeholderData: (p) => p })
export const useChannels = (q: AnalyticsFilters, enabled = true) => useQuery({ queryKey: ["biz", "a", "channels", q], queryFn: () => S.getChannels(q), enabled, placeholderData: (p) => p })
