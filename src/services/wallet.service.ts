import api from "@/lib/api"
import type { ApiResponse } from "@/types"
import type {
  WalletTransaction,
  WalletTransactionFilters,
  AdminCreditPayload,
  AdminDebitPayload,
  WalletOverviewStats,
} from "@/types/wallet.types"

/** Get transaction list for all users (admin view) with optional userId filter */
export async function getWalletTransactions(
  filters: WalletTransactionFilters = {}
): Promise<{
  data: WalletTransaction[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}> {
  const params: Record<string, unknown> = {}
  if (filters.page) params.page = filters.page
  if (filters.limit) params.limit = filters.limit
  if (filters.type) params.type = filters.type
  if (filters.userId) params.userId = filters.userId

  const { data } = await api.get<
    ApiResponse<WalletTransaction[]> & {
      pagination?: { page: number; limit: number; total: number; totalPages: number }
    }
  >("/wallet/admin/transactions", { params })

  const txns = Array.isArray(data.data) ? data.data : []
  return {
    data: txns,
    pagination: (data as unknown as { pagination: { page: number; limit: number; total: number; totalPages: number } })
      .pagination ?? {
      page: filters.page ?? 1,
      limit: filters.limit ?? 20,
      total: txns.length,
      totalPages: 1,
    },
  }
}

/** Admin credit a user's wallet */
export async function adminCreditWallet(
  userId: string,
  payload: AdminCreditPayload
): Promise<{ wallet: { balance: number }; transaction: WalletTransaction }> {
  const { data } = await api.post<
    ApiResponse<{ wallet: { balance: number }; transaction: WalletTransaction }>
  >(`/wallet/admin/${userId}/credit`, payload)
  return data.data
}

/** Admin debit a user's wallet */
export async function adminDebitWallet(
  userId: string,
  payload: AdminDebitPayload
): Promise<{ wallet: { balance: number }; transaction: WalletTransaction }> {
  const { data } = await api.post<
    ApiResponse<{ wallet: { balance: number }; transaction: WalletTransaction }>
  >(`/wallet/admin/${userId}/debit`, payload)
  return data.data
}

export interface ResolvedWalletUser {
  id: string
  name: string | null
  phone: string
  /** This user's most recent actually-PAID orders (amount + order number) — used
   *  to warn an admin when a Credit Wallet amount doesn't match any real paid
   *  order, so money never gets refunded for an order that was never paid for
   *  (e.g. a COD order cancelled before delivery, or an expired ONLINE payment). */
  recentPaidOrders: { orderNumber: string; amount: number }[]
}

/** Resolve a User ID or phone number to the matching user's name/phone. */
export async function resolveWalletUser(query: string): Promise<ResolvedWalletUser | null> {
  try {
    const { data } = await api.get<ApiResponse<ResolvedWalletUser>>(
      "/wallet/admin/resolve-user",
      { params: { query } }
    )
    return data.data
  } catch {
    return null
  }
}

/** Get wallet overview stats */
export async function getWalletOverviewStats(): Promise<WalletOverviewStats> {
  try {
    const { data } = await api.get<ApiResponse<WalletOverviewStats>>("/wallet/admin/stats")
    return data.data
  } catch {
    return {
      totalBalance: 0,
      totalAdded: 0,
      totalUsed: 0,
      totalRefunded: 0,
      expiringBalance: 0,
      expiringIn7Days: 0,
      totalExpired: 0,
      expiredLast30Days: 0,
    }
  }
}
