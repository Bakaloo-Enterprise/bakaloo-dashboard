"use client"

/**
 * Coupons hooks — wraps the existing coupon endpoints so each cache entry
 * is keyed by `qk.coupons(shopKey, params)` and therefore participates in
 * the Shop_Switcher's predicate-based invalidation (Req 3.4, 10.3).
 *
 * Coupons are designed as a per-shop surface (Req 10.5 lists "shop-scoped
 * coupons" among the SINGLE_SHOP-only sections); the page itself renders
 * `<EmptyShopState />` outside `SINGLE_SHOP` mode, but the hook still
 * keys its query by `shopKey` so the cache lines never bleed across shops.
 *
 * The list query is gated by `enabled: shopKey !== "NONE"` to mirror the
 * convention from `useOrders` / `useShopProductsList`. `mode` defaults to
 * `"UNSELECTED"` (see shop-context.store.ts) until an admin explicitly
 * enters a shop or HQ mode, so that gate is `false` by default.
 *
 * That default-off gate is right for the Coupons page itself, but several
 * other admin surfaces (Spin & Win / Scratch Card prizes, cart milestones,
 * first-time offers, abandoned-cart coupon sends) reuse this same hook just
 * to populate a "pick an existing coupon" dropdown for a feature that has
 * no shop concept at all — GET /coupons isn't even shop-filtered server-side
 * (see coupons.controller.js#listAll). Left at the default, those pickers
 * silently render empty until the admin happens to have a shop selected,
 * which looks exactly like "the coupon isn't there" even though it is.
 * Pass `{ shopScoped: false }` from any such caller to fetch unconditionally.
 *

 * The per-coupon analytics query is keyed on `id` only — it is not
 * shop-scoped on the backend, and the coupon id itself uniquely identifies
 * the analytics row.
 *
 * Requirements: 10.1, 10.3, 10.5
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  getCoupons,
  getAllCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  getCouponAnalytics,
} from "@/services/coupons.service"
import { useShopContext } from "@/hooks/useShopContext"
import { qk } from "@/lib/query-keys"
import type { CouponFilters, CreateCouponPayload, UpdateCouponPayload } from "@/types/coupon.types"

/** Sentinel used while the Shop_Context_Store is hydrating. */
const NONE_SHOP_KEY = "NONE"

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: unknown }).response === "object"
  ) {
    const resp = (error as { response?: { data?: { message?: string } } }).response
    if (resp?.data?.message) return resp.data.message
  }
  if (error instanceof Error) return error.message
  return "Something went wrong"
}

export function useCoupons(filters: CouponFilters = {}, options: { shopScoped?: boolean; fetchAll?: boolean } = {}) {
  const { shopScoped = true, fetchAll = false } = options
  const { mode, activeShopId } = useShopContext()
  const shopKey =
    mode === "HQ_MODE" ? "ALL" : activeShopId ?? NONE_SHOP_KEY

  return useQuery({
    // Unscoped callers share one "ALL" cache line — same key HQ_MODE
    // already uses, which is correct here since the underlying data isn't
    // actually shop-filtered either way.
    queryKey: qk.coupons(shopScoped ? shopKey : "ALL", fetchAll ? { ...filters, limit: 0 } : filters),
    queryFn: () => (fetchAll ? getAllCoupons(filters) : getCoupons(filters)),
    enabled: shopScoped ? shopKey !== NONE_SHOP_KEY : true,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })
}

export function useCreateCoupon() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateCouponPayload) => createCoupon(payload),
    onSuccess: () => {
      toast.success("Coupon created successfully")
      // Prefix-based invalidate drops every shop-keyed `coupons` entry in
      // one pass — TanStack Query matches the first key segment so the new
      // `qk.coupons(shopKey, …)` shape is covered without enumerating
      // scopes.
      qc.invalidateQueries({ queryKey: ["coupons"] })
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useUpdateCoupon() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateCouponPayload }) =>
      updateCoupon(id, payload),
    onSuccess: () => {
      toast.success("Coupon updated successfully")
      qc.invalidateQueries({ queryKey: ["coupons"] })
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useDeleteCoupon() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCoupon(id),
    onSuccess: () => {
      toast.success("Coupon deleted")
      qc.invalidateQueries({ queryKey: ["coupons"] })
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useCouponAnalytics(couponId: string | null) {
  return useQuery({
    queryKey: ["coupon-analytics", couponId],
    queryFn: () => getCouponAnalytics(couponId!),
    enabled: !!couponId,
    staleTime: 60_000,
  })
}
