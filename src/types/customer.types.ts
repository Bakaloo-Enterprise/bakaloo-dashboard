/** Customer in list view */
export interface Customer {
  id: string
  name: string | null
  phone: string
  email: string | null
  is_blocked: boolean
  block_reason: string | null
  order_count: number
  total_spent: number
  wallet_balance: number
  loyalty_points: number
  last_order_at: string | null
  created_at: string
  /**
   * Shop ids the customer has at least one allocation to (e.g. via past
   * orders or pincode/radius eligibility). The backend includes this on
   * shop-scoped responses so the dashboard can enforce vendor visibility
   * rules client-side without a second round-trip (Req 10.8, 10.10).
   *
   * Optional because the legacy `/admin/customers` endpoint does not yet
   * emit it for super-admin "HQ_MODE" responses; consumers must treat
   * `undefined` as "not enforced" and a present array as authoritative.
   */
  shop_allocations?: string[]
}

/** Customer detail with expanded info */
export interface CustomerDetail extends Customer {
  recent_orders: CustomerOrder[]
  avg_rating_given: number | null
  app_version: string | null
  platform: string | null
  membership_tier: string | null
  /** Reliability signal — how many of this customer's orders actually
   * completed vs. were cancelled or refunded ("returned"). */
  completed_orders: number
  cancelled_orders: number
  returned_orders: number
}

/**
 * Customer's saved delivery address, as returned by
 * `GET /admin/customers/:id/addresses`. Mirrors the addresses repository's
 * camelCase format (`addressLine1` etc — same convention documented on
 * `DeliveryAddress` in order.types.ts).
 *
 * The endpoint returns both active and recently-removed addresses:
 * `deletedAt` is null for an active address. A removed address is kept for
 * a retention window (see backend `ADDRESS_RETENTION_DAYS`) for
 * delivery-dispute/security review — `purgeAt`/`daysUntilPurge` describe
 * when it will be hard-deleted for good.
 */
export interface CustomerAddress {
  id: string
  label: string
  addressLine1: string
  addressLine2: string | null
  landmark: string | null
  city: string
  state: string | null
  pincode: string
  lat: number | null
  lng: number | null
  isDefault: boolean
  createdAt: string
  updatedAt?: string
  deletedAt: string | null
  purgeAt: string | null
  daysUntilPurge: number | null
}

/** Lightweight order for customer profile */
export interface CustomerOrder {
  id: string
  order_number: string
  total_amount: number
  status: string
  created_at: string
}

/** Filters for customer list */
export interface CustomerFilters {
  page?: number
  limit?: number
  search?: string
  status?: "active" | "blocked" | ""
  segment?: "vip" | "churned" | ""
  minOrders?: number
  maxOrders?: number
  minSpent?: number
  maxSpent?: number
  startDate?: string
  endDate?: string
  sort?: string
  order?: "asc" | "desc"
  /**
   * Restrict the result set to customers with at least one allocation to
   * this shop. Forwarded as the `shop_id` query param. Set by the
   * `useCustomers` hook in `SINGLE_SHOP` mode; omitted in `ALL_SHOPS` mode
   * (Req 10.8).
   */
  shop_id?: string
}

/** A notification this customer received. `personal` = sent to them by hand from the dashboard. */
export interface CustomerNotification {
  id: string
  title: string
  body: string | null
  type: string
  personal: boolean
  isRead: boolean
  readAt: string | null
  createdAt: string
  sentByName: string | null
}
