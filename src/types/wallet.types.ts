/** Wallet entity */
export interface Wallet {
  id: string
  userId: string
  balance: number
  createdAt: string
  updatedAt: string
}

/** Wallet transaction */
export interface WalletTransaction {
  id: string
  walletId: string
  type: "CREDIT" | "DEBIT"
  subType?: "REFUND" | "BONUS" | "SCRATCH" | "CASHBACK" | "ORDER" | "TOPUP" | "EXPIRY" | null
  amount: number
  description: string
  referenceId: string | null
  balanceAfter: number | null
  status?: "PENDING" | "COMPLETED" | "FAILED"
  /** Set on expiring credits (spin / scratch / cashback / bonus); null for ordinary money. */
  expiresAt?: string | null
  createdAt: string
  /** Admin view fields — present when fetching via /admin/transactions */
  userId?: string
  userName?: string | null
  userPhone?: string | null
}

/** Transaction filters */
export interface WalletTransactionFilters {
  page?: number
  limit?: number
  type?: "CREDIT" | "DEBIT" | "REFUND" | null
  userId?: string
}

/** Wallet overview stats */
export interface WalletOverviewStats {
  totalBalance: number
  totalAdded: number
  totalUsed: number
  totalRefunded: number
  /** Bonus/cashback currently sitting in wallets that will expire. */
  expiringBalance: number
  /** Part of expiringBalance that lapses within the next 7 days. */
  expiringIn7Days: number
  /** Everything that has ever expired unused. */
  totalExpired: number
  expiredLast30Days: number
}

/** Admin credit payload */
export interface AdminCreditPayload {
  amount: number
  description?: string
  referenceId?: string
  /** true = promotional credit that expires (Settings → Wallet → Expiry); omit for plain money. */
  isBonus?: boolean
  /** Validity for this one bonus; defaults to the "Admin bonus" rule. */
  expiryDays?: number
}

/** Admin debit payload */
export interface AdminDebitPayload {
  amount: number
  description?: string
  referenceId?: string
}
