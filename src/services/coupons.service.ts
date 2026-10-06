import api from "@/lib/api"
import type {
  ApiResponse,
  PaginatedResponse,
} from "@/types"
import type {
  Coupon,
  CouponFilters,
  CreateCouponPayload,
  UpdateCouponPayload,
  CouponAnalytics,
} from "@/types/coupon.types"

export async function getCoupons(
  filters: CouponFilters = {}
): Promise<{ data: Coupon[]; pagination: PaginatedResponse<Coupon>["pagination"] }> {
  const params: Record<string, unknown> = {}
  if (filters.page) params.page = filters.page
  if (filters.limit) params.limit = filters.limit

  const { data } = await api.get<
    ApiResponse<Coupon[]> & { pagination?: { page: number; limit: number; total: number; totalPages: number } }
  >("/coupons", { params })

  // Backend returns { success, data: [...], pagination: {...} }
  return {
    data: Array.isArray(data.data) ? data.data : [],
    pagination: (data as unknown as { pagination: PaginatedResponse<Coupon>["pagination"] }).pagination ?? {
      page: filters.page ?? 1,
      limit: filters.limit ?? 20,
      total: 0,
      totalPages: 0,
    },
  }
}

/** Walks every page (backend caps limit at 50) so pickers never miss older coupons. */
export async function getAllCoupons(
  filters: CouponFilters = {}
): Promise<{ data: Coupon[]; pagination: PaginatedResponse<Coupon>["pagination"] }> {
  const limit = 50
  const first = await getCoupons({ ...filters, page: 1, limit })
  const all = [...first.data]
  for (let page = 2; page <= first.pagination.totalPages && page <= 50; page++) {
    all.push(...(await getCoupons({ ...filters, page, limit })).data)
  }
  return { data: all, pagination: { ...first.pagination, page: 1, limit: all.length, totalPages: 1 } }
}

export async function createCoupon(payload: CreateCouponPayload): Promise<Coupon> {
  const { data } = await api.post<ApiResponse<Coupon>>("/coupons", payload)
  return data.data
}

export async function updateCoupon(
  id: string,
  payload: UpdateCouponPayload
): Promise<Coupon> {
  const { data } = await api.put<ApiResponse<Coupon>>(`/coupons/${id}`, payload)
  return data.data
}

export async function deleteCoupon(id: string): Promise<void> {
  await api.delete(`/coupons/${id}`)
}

export async function getCouponAnalytics(couponId: string): Promise<CouponAnalytics> {
  const { data } = await api.get<ApiResponse<CouponAnalytics>>(`/coupons/${couponId}/analytics`)
  return data.data
}

/** Individually-targeted customers for a coupon (edit-dialog prefill when targetType === "INDIVIDUAL"). */
export async function getCouponTargetUsers(
  couponId: string
): Promise<{ id: string; name: string | null; phone: string; email: string | null }[]> {
  const { data } = await api.get<
    ApiResponse<{ id: string; name: string | null; phone: string; email: string | null }[]>
  >(`/coupons/${couponId}/target-users`)
  return data.data
}
