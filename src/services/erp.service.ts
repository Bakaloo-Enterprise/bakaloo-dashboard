import api from "@/lib/api"
import type { ApiResponse } from "@/types/api.types"
import type { DayClose, Forecast, Wastage } from "@/types/erp.types"
import type { PeriodQuery } from "@/types/business.types"

const get = async <T>(url: string, params?: object) => (await api.get<ApiResponse<T>>(`/admin/erp${url}`, { params })).data.data
const clean = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "" && v !== null)) as Partial<T>

export const getDayClose = (p: { date?: string; shopId?: string }) => get<DayClose>("/ops/day-close", clean(p))
export const getWastage = (p: PeriodQuery & { shopId?: string }) => get<Wastage>("/ops/wastage", clean(p))
export const getForecast = (p: { shopId?: string; horizon?: number; cover?: number }) => get<Forecast>("/ops/forecast", clean(p))
export const saveTargets = async (productId: string, body: { marginPct: number | null; wastagePct: number | null }) =>
  (await api.patch<ApiResponse<{ productId: string; marginPct: number | null; wastagePct: number | null }>>(`/admin/erp/ops/products/${productId}/targets`, body)).data.data

// ── Accounting ──
import type { AccountingSummary, CashKind, CashList, Box, ExpenseCategory, ExpenseList, Journal, PayVia } from "@/types/erp.types"

export const getAccountingSummary = (month?: string) => get<AccountingSummary>("/accounting/summary", clean({ month }))
export const getJournal = (month?: string) => get<Journal>("/accounting/journal", clean({ month }))
export const getExpenses = (p: { from?: string; to?: string; category?: string; shopId?: string; includeVoided?: boolean }) => get<ExpenseList>("/accounting/expenses", clean(p))
export const getCashEntries = (p: { from?: string; to?: string; includeVoided?: boolean }) => get<CashList>("/accounting/cash-entries", clean(p))
export const createExpense = async (b: { spentOn: string; category: ExpenseCategory; amount: number; paidVia: PayVia; shopId?: string; party?: string; note?: string }) =>
  (await api.post<ApiResponse<{ id: string }>>("/admin/erp/accounting/expenses", clean(b))).data.data
export const voidExpense = async (id: string, reason: string) => (await api.post<ApiResponse<{ id: string }>>(`/admin/erp/accounting/expenses/${id}/void`, { reason })).data.data
export const createCashEntry = async (b: { entryOn: string; kind: CashKind; account?: Box; amount: number; note?: string }) =>
  (await api.post<ApiResponse<{ id: string }>>("/admin/erp/accounting/cash-entries", clean(b))).data.data
export const voidCashEntry = async (id: string, reason: string) => (await api.post<ApiResponse<{ id: string }>>(`/admin/erp/accounting/cash-entries/${id}/void`, { reason })).data.data

// ── Data Explorer ──
import type { ExplorerKind, ExplorerPage } from "@/types/erp.types"
export type ExplorerParams = PeriodQuery & { shopId?: string; q?: string; limit?: number; offset?: number }
export const getExplorer = (kind: ExplorerKind, p: ExplorerParams) => get<ExplorerPage>(`/explorer/${kind}`, clean(p))
/** Downloads through the signed-in session (a plain link could not send the login token). */
export async function downloadExplorerCsv(kind: ExplorerKind, p: Omit<ExplorerParams, "limit" | "offset">) {
  const res = await api.get<Blob>(`/admin/erp/explorer/${kind}/export`, { params: clean(p), responseType: "blob" })
  const name = /filename="([^"]+)"/.exec(String(res.headers["content-disposition"] ?? ""))?.[1] ?? `${kind}.csv`
  const url = URL.createObjectURL(res.data)
  const a = document.createElement("a")
  a.href = url; a.download = name; a.click()
  URL.revokeObjectURL(url)
  return { truncated: res.headers["x-export-truncated"] === "true" }
}

// ── Founder view ──
import type { Founder } from "@/types/erp.types"
export const getFounder = (month?: string) => get<Founder>("/founder", clean({ month }))

// ── Log wastage (Daily Ops) ──
export interface ShelfItem { productId: string; name: string; pack: string | null; category: string | null; stock: number }
export const getShelf = (shopId: string) => get<ShelfItem[]>("/ops/shelf", { shopId })
export const logWastage = async (b: { shopId: string; productId: string; quantity: number; reason: string; note?: string }) =>
  (await api.post<ApiResponse<{ movementId: string; product: string; removed: number; left: number; reason: string }>>("/admin/erp/ops/wastage", clean(b))).data.data
