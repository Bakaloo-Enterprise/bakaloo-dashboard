"use client"

/**
 * Customers hooks — shop-scoped list + per-customer detail / mutations.
 *
 * Wave 12 of the multi-vendor dashboard. The list query reads `Active_Shop_Id`
 * via `useShopContext()` and keys its cache entry through the central
 * `qk.customers(shopKey, filters)` builder so the Shop_Switcher's predicate-
 * based invalidation drops it on every shop change (Req 3.4, 10.3).
 *
 * Filtering rules (Req 10.4, 10.8):
 *   - `mode === "STORE_MODE"`  → forward `shop_id = activeShopId` so the
 *     backend returns only customers with at least one allocation to that
 *     shop. The query is gated on `enabled: shopKey !== "NONE"` so it never
 *     fires while the Shop_Context_Store is still hydrating.
 *   - `mode === "HQ_MODE"`    → omit the `shop_id` filter; super-admins
 *     see the unscoped cross-shop list (Req 10.4).
 *   - `mode === "UNSELECTED"`   → `shopKey === "NONE"` and the query is
 *     disabled outright (matches the existing-page convention used by
 *     `useShopProductsList`).
 *
 * The detail hook is intentionally NOT shop-scoped in its key — a customer
 * can be allocated to multiple shops, and its `id` is globally unique. The
 * vendor-overlap 404 enforcement (Req 10.10) lives at the consumer (the
 * `<CustomerProfileDrawer />`) which compares the loaded customer's
 * `shop_allocations` to the user's `assignedShopIds`.
 *
 * Design references:
 *   - design.md §5  "Central Query-Key Factory"
 *   - design.md §11 "Existing-Page Shop Scoping"
 *   - requirements.md 10.1, 10.3, 10.4, 10.8, 10.10
 */

import { useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  getCustomers,
  getCustomerDetail,
  getCustomerOrders,
  getCustomerAddresses,
  toggleBlockCustomer,
  creditCustomerWallet,
  debitCustomerWallet,
  notifyCustomer,
  getCustomerNotifications,
  exportCustomersCsv,
} from "@/services/customers.service"
import { useShopContext } from "@/hooks/useShopContext"
import { qk } from "@/lib/query-keys"
import type { CustomerFilters } from "@/types"

/**
 * Sentinel `shopId` slot used in the list query key when the
 * Shop_Context_Store has not yet been hydrated. The query is gated by
 * `enabled` (see below) so it never fires in this state, but TanStack Query
 * still requires a stable key. Mirrors the convention from
 * `useShopProductsList` so cache snapshots line up across surfaces.
 */
const NONE_SHOP_KEY = "NONE"

export function useCustomers(filters: CustomerFilters) {
  const { activeShopId, mode } = useShopContext()

  // shopKey decides both the cache identity and the `shop_id` query param:
  //   - ALL_SHOPS  → "ALL"; cache by ALL, no shop_id filter on the request.
  //   - SINGLE_SHOP→ activeShopId; cache by id, forward shop_id=<id>.
  //   - UNSELECTED → "NONE"; query disabled, key still stable.
  const shopKey: string =
    mode === "HQ_MODE"
      ? "ALL"
      : activeShopId ?? NONE_SHOP_KEY

  // Build the merged filter set so the query key stays a structural function
  // of all inputs. Spreading inside `useMemo` keeps reference stability when
  // none of the inputs change, which TanStack Query's structural sharing
  // depends on for its previous-page placeholder behavior.
  const mergedFilters: CustomerFilters = useMemo(() => {
    if (mode === "STORE_MODE" && activeShopId) {
      return { ...filters, shop_id: activeShopId }
    }
    // ALL_SHOPS or UNSELECTED: drop any caller-supplied shop_id so the
    // cache identity matches the super-admin "all customers" view.
    if (filters.shop_id !== undefined) {
      const next: CustomerFilters = { ...filters }
      delete next.shop_id
      return next
    }
    return filters
  }, [filters, mode, activeShopId])

  return useQuery({
    queryKey: qk.customers(shopKey, mergedFilters),
    queryFn: () => getCustomers(mergedFilters),
    enabled: shopKey !== NONE_SHOP_KEY,
    staleTime: 30 * 1000,
    // Wallet balances and the Active Today count are live figures that can
    // change from outside the dashboard entirely (customer app top-ups,
    // debits, logins) — always refetch on mount so opening/revisiting this
    // page never shows a cached snapshot from a previous visit.
    refetchOnMount: "always",
    placeholderData: (prev) => prev,
  })
}

export function useCustomerDetail(customerId: string | null) {
  return useQuery({
    queryKey: ["customers", "detail", customerId],
    queryFn: () => getCustomerDetail(customerId!),
    enabled: !!customerId,
    staleTime: 30 * 1000,
    // Wallet balance shown here can change from outside the dashboard
    // (customer app top-up/debit) — always refetch when the profile
    // drawer opens rather than trusting a cached snapshot.
    refetchOnMount: "always",
  })
}

export function useCustomerAddresses(customerId: string | null) {
  return useQuery({
    queryKey: ["customers", "addresses", customerId],
    queryFn: () => getCustomerAddresses(customerId!),
    enabled: !!customerId,
    staleTime: 30 * 1000,
  })
}

export function useCustomerOrders(customerId: string | null, page = 1) {
  return useQuery({
    queryKey: ["customers", "orders", customerId, page],
    queryFn: () => getCustomerOrders(customerId!, page),
    enabled: !!customerId,
    staleTime: 30 * 1000,
  })
}

export function useToggleBlockCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, blocked }: { id: string; blocked: boolean }) =>
      toggleBlockCustomer(id, blocked),
    onSuccess: (_, { blocked }) => {
      toast.success(blocked ? "Customer blocked" : "Customer unblocked")
      // Prefix-based invalidate so every shop-scoped customers cache entry
      // (ALL, single-shop ids, "NONE") is dropped without us having to
      // enumerate scopes. Matches the convention from `useOrders`.
      qc.invalidateQueries({ queryKey: ["customers"] })
    },
    onError: (e: Error) => toast.error(e.message || "Failed to update customer"),
  })
}

export function useCreditWallet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      amount,
      description,
    }: {
      id: string
      amount: number
      description?: string
    }) => creditCustomerWallet(id, { amount, description }),
    onSuccess: () => {
      toast.success("Wallet credited")
      // Also drop the standalone Wallet page's cache ("wallet") — a credit
      // from this drawer used to only invalidate "customers", leaving the
      // Wallet page showing a stale balance/transaction list until its own
      // cache separately expired.
      qc.invalidateQueries({ queryKey: ["customers"] })
      qc.invalidateQueries({ queryKey: ["wallet"] })
    },
    onError: (e: Error) => toast.error(e.message || "Failed to credit wallet"),
  })
}

export function useDebitWallet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      amount,
      description,
    }: {
      id: string
      amount: number
      description?: string
    }) => debitCustomerWallet(id, { amount, description }),
    onSuccess: () => {
      toast.success("Wallet debited")
      // Also drop the standalone Wallet page's cache — see useCreditWallet.
      qc.invalidateQueries({ queryKey: ["customers"] })
      qc.invalidateQueries({ queryKey: ["wallet"] })
    },
    onError: (e: Error) => toast.error(e.message || "Failed to debit wallet"),
  })
}

export function useCustomerNotifications(customerId: string | null, personal: boolean) {
  return useQuery({
    queryKey: ["customers", "notifications", customerId, personal],
    queryFn: () => getCustomerNotifications(customerId as string, personal),
    enabled: Boolean(customerId),
    staleTime: 15_000,
  })
}

export function useNotifyCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      title,
      body,
    }: {
      id: string
      title: string
      body: string
    }) => notifyCustomer(id, { title, body }),
    onSuccess: () => {
      toast.success("Notification sent")
      qc.invalidateQueries({ queryKey: ["customers", "notifications"] })
    },
    onError: (e: Error) => toast.error(e.message || "Failed to send notification"),
  })
}

export function useExportCustomers() {
  return useMutation({
    mutationFn: () => exportCustomersCsv(),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `customers-export-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Customers exported!")
    },
    onError: () => toast.error("Failed to export customers"),
  })
}
