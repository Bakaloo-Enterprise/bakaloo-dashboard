/** Global wallet balance + transfer limits, admin-configurable. */
export interface WalletSettings {
  maxWalletBalance: number
  maxTransferAmount: number
  minTransferAmount: number
  transfersEnabled: boolean
  /** Kill-switch for wallet top-up (e.g. during a Razorpay outage). When
   * off, the app shows "Wallet top-up is currently unavailable" instead
   * of opening the payment flow — existing balance and spend are unaffected. */
  topupEnabled: boolean
  /** Master switch for expiring bonus/cashback. Top-ups and refunds never expire. */
  expiryEnabled: boolean
  /** Validity in days per credit type; 0 = that type never expires. */
  expirySpinDays: number
  expiryScratchDays: number
  expiryCouponDays: number
  expiryOfferDays: number
  expiryAdminDays: number
  /** Notify the customer this many days before expiry; 0 = no reminder. */
  expiryReminderDays: number
}

export type UpdateWalletSettingsPayload = Partial<WalletSettings>
