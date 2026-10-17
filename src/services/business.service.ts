import api from "@/lib/api"
import type { ApiResponse } from "@/types/api.types"
import type {
  AdjustmentKind, AnalyticsFilters, AvailabilityResult, BizMe, BulkBatch, BulkRowStatus, BulkRows, ChannelSplit, EntryList, NewEntryInput, Overview, PeriodQuery,
  ProcurementDetail, MonthlyPreview, DistributeInput, DistributionPreview, Payables, PayMethod, PurchasePlan, SupplierLedger, VendorInput, DocKind, ReceiveInput, Reconciliation, NewRequirementInput, Requirement, RequirementCustomer, RequirementList, RequirementPrefill, StorePerf, TopCustomers, TopProducts, Vendor, VendorReport,
} from "@/types/business.types"

const get = async <T>(url: string, params?: object) => (await api.get<ApiResponse<T>>(`/admin${url}`, { params })).data.data
const post = async <T>(url: string, body: object = {}) => (await api.post<ApiResponse<T>>(`/admin${url}`, body)).data.data
const clean = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "" && v !== null)) as Partial<T>

export const getBizMe = () => get<BizMe>("/procurement/me")

// procurement
export const getVendors = (includeInactive = false) => get<Vendor[]>("/procurement/vendors", { includeInactive })
export const createVendor = (input: VendorInput & { name: string }) => post<Vendor>("/procurement/vendors", input)
export const updateVendor = async (id: string, input: VendorInput) => (await api.patch<ApiResponse<Vendor>>(`/admin/procurement/vendors/${id}`, input)).data.data
export const getEntries = (params: { from?: string; to?: string; vendorId?: string; productId?: string; shopId?: string; status?: string; purpose?: string; search?: string; limit?: number; offset?: number }) => get<EntryList>("/procurement/entries", clean(params))
export const getEntry = (id: string) => get<ProcurementDetail>(`/procurement/entries/${id}`)
export const createEntry = (input: NewEntryInput) => post<ProcurementDetail>("/procurement/entries", clean(input))
export const allocateEntry = (id: string, allocations: Array<{ shopId: string; quantity: number }>, opts: { note?: string; updateCostPrice?: boolean } = {}) => post<ProcurementDetail>(`/procurement/entries/${id}/allocations`, { allocations, ...clean(opts), ...(opts.updateCostPrice === undefined ? {} : { updateCostPrice: opts.updateCostPrice }) })
export const receiveEntry = (id: string, input: ReceiveInput) => post<ProcurementDetail>(`/procurement/entries/${id}/receive`, clean(input))
export const arrivedEntry = (id: string, quantity: number) => post<ProcurementDetail>(`/procurement/entries/${id}/arrived`, { quantity })
export const getDistribution = (id: string) => get<DistributionPreview>(`/procurement/entries/${id}/distribution`)
export const distributeEntry = (id: string, input: DistributeInput) => post<ProcurementDetail>(`/procurement/entries/${id}/distribute`, input)
export const releaseHold = (id: string) => post<ProcurementDetail>(`/procurement/reservations/${id}/release`)
export const adjustEntry = (id: string, input: { kind: AdjustmentKind; quantity: number; reason: string; shopId?: string }) => post<ProcurementDetail>(`/procurement/entries/${id}/adjustments`, clean(input))
export const reserveEntry = (id: string, note: string) => post<ProcurementDetail>(`/procurement/entries/${id}/reserve`, { note })
export const releaseEntry = (id: string) => post<ProcurementDetail>(`/procurement/entries/${id}/release`)
export const cancelEntry = (id: string) => post<ProcurementDetail>(`/procurement/entries/${id}/cancel`)
export const reverseAllocation = (allocationId: string) => post<ProcurementDetail>(`/procurement/allocations/${allocationId}/reverse`)

// month-end report
export const getMonthly = (month: string) => get<MonthlyPreview>("/procurement/reports/monthly", { month })
export async function downloadMonthly(month: string) {
  const res = await api.get("/admin/procurement/reports/monthly/download", { params: { month }, responseType: "blob" })
  const url = URL.createObjectURL(res.data as Blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `bakaloo-month-end-${month}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

// supplier money + papers
export const getPayables = () => get<Payables>("/procurement/payables")
export const getSupplierLedger = (id: string) => get<SupplierLedger>(`/procurement/vendors/${id}/ledger`)
export const paySupplier = (id: string, input: { amount: number; method: PayMethod; reference?: string; note?: string }) => post<SupplierLedger>(`/procurement/vendors/${id}/payments`, clean(input))
export const voidSupplierPayment = (id: string, reason: string) => post<SupplierLedger>(`/procurement/payments/${id}/void`, { reason })
export async function uploadEntryDocument(entryId: string, file: File, kind: DocKind = "INVOICE") {
  const form = new FormData()
  form.append("file", file)
  return (await api.post<ApiResponse<{ id: string }>>(`/admin/procurement/entries/${entryId}/documents`, form, { params: { kind }, headers: { "Content-Type": "multipart/form-data" } })).data.data
}
export async function openDocument(id: string) {
  const res = await api.get(`/admin/procurement/documents/${id}/file`, { responseType: "blob" })
  const url = URL.createObjectURL(res.data as Blob)
  window.open(url, "_blank", "noopener")
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
export const removeDocument = async (id: string) => (await api.delete<ApiResponse<unknown>>(`/admin/procurement/documents/${id}`)).data.data

// B2B requirements + purchase plan
export const getPlan = () => get<PurchasePlan>("/procurement/plan")
export const getRequirements = (params: { status?: string; source?: string; search?: string; limit?: number; offset?: number }) => get<RequirementList>("/procurement/requirements", clean(params))
export const getRequirementCustomers = (search: string) => get<RequirementCustomer[]>("/procurement/requirements/customers", { search })
export const getRequirementPrefill = (conversationId: string) => get<RequirementPrefill>("/procurement/requirements/prefill", { conversationId })
export const createRequirement = (input: NewRequirementInput) => post<Requirement>("/procurement/requirements", clean(input))
export const setRequirementStatus = (id: string, status: string) => post<Requirement>(`/procurement/requirements/${id}/status`, { status })

// reports
export const getVendorReport = (q: PeriodQuery & { vendorId?: string }) => get<VendorReport>("/procurement/reports/vendors", clean(q))
export const getReconciliation = (q: PeriodQuery & { productId?: string; vendorId?: string }) => get<Reconciliation>("/procurement/reports/reconciliation", clean(q))

// bulk catalog
export const getUploads = () => get<BulkBatch[]>("/catalog-bulk/uploads")
export const getUpload = (id: string) => get<BulkBatch>(`/catalog-bulk/uploads/${id}`)
export const getUploadRows = (id: string, params: { status?: BulkRowStatus; limit?: number; offset?: number }) => get<BulkRows>(`/catalog-bulk/uploads/${id}/rows`, clean(params))
export async function uploadSheet(file: File): Promise<BulkBatch> {
  const form = new FormData()
  form.append("file", file)
  return (await api.post<ApiResponse<BulkBatch>>("/admin/catalog-bulk/uploads", form, { headers: { "Content-Type": "multipart/form-data" } })).data.data
}
export const applyUpload = (id: string, skipErrors: boolean) => post<BulkBatch>(`/catalog-bulk/uploads/${id}/apply`, { confirm: true, skipErrors })
export const discardUpload = async (id: string) => (await api.delete<ApiResponse<{ id: string }>>(`/admin/catalog-bulk/uploads/${id}`)).data.data
export const bulkAvailability = (input: { action: "ENABLE" | "DISABLE" | "ASSIGN"; productIds: string[]; shopIds: string[]; dryRun: boolean }) => post<AvailabilityResult>("/catalog-bulk/availability", input)
export async function downloadFile(path: "template" | "export", params: { shopId?: string } = {}) {
  const res = await api.get(`/admin/catalog-bulk/${path}`, { params: clean(params), responseType: "blob" })
  const url = URL.createObjectURL(res.data as Blob)
  const a = document.createElement("a")
  a.href = url
  a.download = path === "template" ? "bakaloo-catalog-template.xlsx" : "bakaloo-catalog.xlsx"
  a.click()
  URL.revokeObjectURL(url)
}

// business analytics
export const getOverview = (q: AnalyticsFilters) => get<Overview>("/business-analytics/overview", clean(q))
export const getTopProducts = (q: AnalyticsFilters & { sort?: string }) => get<TopProducts>("/business-analytics/products", clean(q))
export const getTopCustomers = (q: AnalyticsFilters) => get<TopCustomers>("/business-analytics/customers", clean(q))
export const getStorePerf = (q: AnalyticsFilters) => get<StorePerf>("/business-analytics/stores", clean(q))
export const getChannels = (q: AnalyticsFilters) => get<ChannelSplit>("/business-analytics/channels", clean(q))
export const getAnalyticsVendors = (q: PeriodQuery & { vendorId?: string }) => get<VendorReport>("/business-analytics/vendors", clean(q))
export const getAnalyticsReconciliation = (q: PeriodQuery & { productId?: string }) => get<Reconciliation>("/business-analytics/reconciliation", clean(q))
