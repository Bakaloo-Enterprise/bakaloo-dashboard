"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import * as S from "@/services/business.service"
import type { AdjustmentKind, AnalyticsFilters, BulkRowStatus, NewEntryInput, NewRequirementInput, PeriodQuery, ReceiveInput, DistributeInput, VendorInput, PayMethod, DocKind } from "@/types/business.types"

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
// Business Analytics must not depend on the Procurement lock, so it reads the same reports through its own endpoints.
export const useAnalyticsVendors = (q: PeriodQuery & { vendorId?: string }, enabled = true) => useQuery({ queryKey: ["biz", "analytics-vendors", q], queryFn: () => S.getAnalyticsVendors(q), enabled, placeholderData: (p) => p })
export const useAnalyticsReconciliation = (q: PeriodQuery & { productId?: string }, enabled = true) => useQuery({ queryKey: ["biz", "analytics-reconciliation", q], queryFn: () => S.getAnalyticsReconciliation(q), enabled, placeholderData: (p) => p })

export const useVendorReport = (q: PeriodQuery & { vendorId?: string }, enabled = true) => useQuery({ queryKey: ["biz", "vendor-report", q], queryFn: () => S.getVendorReport(q), enabled, placeholderData: (p) => p })
export const useReconciliation = (q: PeriodQuery & { productId?: string }, enabled = true) => useQuery({ queryKey: ["biz", "reconciliation", q], queryFn: () => S.getReconciliation(q), enabled, placeholderData: (p) => p })

/** Every procurement change can move stock and the reports, so each success re-reads all of "biz". */
export function useProcurementMutations() {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: ["biz"] })
  const base = { onError: (e: unknown) => toast.error(bizError(e)), onSuccess: refresh }
  return {
    createVendor: useMutation({ mutationFn: S.createVendor, ...base }),
    updateVendor: useMutation({ mutationFn: ({ id, ...rest }: { id: string } & VendorInput) => S.updateVendor(id, rest), ...base }),
    pay: useMutation({ mutationFn: (v: { id: string; amount: number; method: PayMethod; reference?: string }) => { const { id, ...rest } = v; return S.paySupplier(id, rest) }, onError: base.onError, onSuccess: () => { toast.success("Payment saved"); refresh() } }),
    voidPayment: useMutation({ mutationFn: (v: { id: string; reason: string }) => S.voidSupplierPayment(v.id, v.reason), onError: base.onError, onSuccess: () => { toast.success("Payment cancelled"); refresh() } }),
    upload: useMutation({ mutationFn: (v: { entryId: string; file: File; kind?: DocKind }) => S.uploadEntryDocument(v.entryId, v.file, v.kind), onError: base.onError, onSuccess: () => { toast.success("Invoice saved"); refresh() } }),
    createEntry: useMutation({ mutationFn: (v: NewEntryInput) => S.createEntry(v), onError: base.onError, onSuccess: () => { toast.success("Purchase recorded"); refresh() } }),
    receive: useMutation({ mutationFn: (v: { id: string } & ReceiveInput) => { const { id, ...rest } = v; return S.receiveEntry(id, rest) }, onError: base.onError, onSuccess: () => { toast.success("Goods checked and saved"); refresh() } }),
    arrived: useMutation({ mutationFn: (v: { id: string; quantity: number }) => S.arrivedEntry(v.id, v.quantity), onError: base.onError, onSuccess: () => { toast.success("Delivery added"); refresh() } }),
    distribute: useMutation({ mutationFn: (v: { id: string } & DistributeInput) => { const { id, ...rest } = v; return S.distributeEntry(id, rest) }, onError: base.onError, onSuccess: () => { toast.success("Stock sent"); refresh() } }),
    allocate: useMutation({ mutationFn: (v: { id: string; allocations: Array<{ shopId: string; quantity: number }>; note?: string; updateCostPrice?: boolean }) => S.allocateEntry(v.id, v.allocations, { note: v.note, updateCostPrice: v.updateCostPrice }), onError: base.onError, onSuccess: () => { toast.success("Stock sent to the stores"); refresh() } }),
    adjust: useMutation({ mutationFn: ({ id, ...rest }: { id: string; kind: AdjustmentKind; quantity: number; reason: string; shopId?: string }) => S.adjustEntry(id, rest), onError: base.onError, onSuccess: () => { toast.success("Adjustment recorded"); refresh() } }),
    reserve: useMutation({ mutationFn: (v: { id: string; note: string }) => S.reserveEntry(v.id, v.note), ...base }),
    release: useMutation({ mutationFn: (id: string) => S.releaseEntry(id), ...base }),
    cancel: useMutation({ mutationFn: (id: string) => S.cancelEntry(id), ...base }),
    reverse: useMutation({ mutationFn: (allocationId: string) => S.reverseAllocation(allocationId), ...base }),
  }
}

export const useDistribution = (entryId: string | null) => useQuery({ queryKey: ["biz", "distribution", entryId], queryFn: () => S.getDistribution(entryId as string), enabled: Boolean(entryId), staleTime: 0, gcTime: 0 })
export const useMonthly = (month: string, enabled = true) => useQuery({ queryKey: ["biz", "monthly", month], queryFn: () => S.getMonthly(month), enabled, placeholderData: (p) => p })
export const usePayables = (enabled = true) => useQuery({ queryKey: ["biz", "payables"], queryFn: S.getPayables, enabled })
export const useSupplierLedger = (id: string | null) => useQuery({ queryKey: ["biz", "ledger", id], queryFn: () => S.getSupplierLedger(id as string), enabled: Boolean(id) })

// B2B requirements + purchase plan
export const usePlan = (enabled = true) => useQuery({ queryKey: ["biz", "plan"], queryFn: S.getPlan, enabled, refetchInterval: 60_000 })
export const useRequirements = (params: Parameters<typeof S.getRequirements>[0], enabled = true) => useQuery({ queryKey: ["biz", "requirements", params], queryFn: () => S.getRequirements(params), enabled, placeholderData: (p) => p })
export const useRequirementCustomers = (search: string, enabled = true) => useQuery({ queryKey: ["biz", "req-customers", search], queryFn: () => S.getRequirementCustomers(search), enabled, staleTime: 15_000 })
export const useRequirementPrefill = (conversationId: string | null) => useQuery({ queryKey: ["biz", "req-prefill", conversationId], queryFn: () => S.getRequirementPrefill(conversationId as string), enabled: Boolean(conversationId), retry: false })
export function useRequirementMutations() {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: ["biz"] })
  const onError = (e: unknown) => toast.error(bizError(e))
  return {
    create: useMutation({ mutationFn: (v: NewRequirementInput) => S.createRequirement(v), onError, onSuccess: () => { toast.success("Saved"); refresh() } }),
    setStatus: useMutation({ mutationFn: (v: { id: string; status: string }) => S.setRequirementStatus(v.id, v.status), onError, onSuccess: refresh }),
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
