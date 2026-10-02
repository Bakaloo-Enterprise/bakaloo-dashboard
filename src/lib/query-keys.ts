/**
 * Central TanStack Query key factory.
 *
 * Every shop-scoped query embeds `shopId` (or the literal `"ALL"`) as the
 * second key segment so a single predicate-based invalidation can drop every
 * entry tied to the previously-active shop in one pass. The first segment is
 * always the entity tag (e.g. `"shops"`, `"orders"`, `"shop-products"`),
 * which `isShopScopedKey` consults to decide whether a key participates in
 * shop-context invalidation at all.
 *
 * Design reference: design.md §5 "Central Query-Key Factory".
 *
 * Conventions:
 * - First segment: kebab-case entity tag matching the backend route family.
 * - Second segment for shop-aware existing surfaces: a `shopId` UUID or the
 *   literal `"ALL"` (when the Super_Admin is in `ALL_SHOPS` mode).
 * - Returned tuples are frozen via `as const` so TanStack Query treats them
 *   as readonly and can structurally diff them across renders.
 */

import type { ListParams } from "@/types/common.types"
import type { SpinHistoryFilters } from "@/types/spin-wheel.types"
import type { ScratchHistoryFilters } from "@/types/scratch-card.types"

/**
 * The set of first-segment tags that identify shop-scoped cache entries.
 *
 * Note: `my-shops` is intentionally excluded — it is per-user (the list of
 * shops the authenticated user can access) and must survive a shop switch.
 */
const SHOP_SCOPED_TAGS = [
  // First-class multi-vendor surfaces
  "shops",
  "shop-staff",
  "shop-products",
  "shop-financials",
  "shop-transactions",
  // Store Fulfillment POS (everything in it belongs to ONE store)
  "pos",
  // Existing surfaces wrapped to participate in shop-context invalidation
  "orders",
  "customers",
  "reviews",
  "products",
  "categories",
  "riders",
  "banners",
  "coupons",
  "wallet",
  "team",
  "settings",
  "notifications",
  "analytics",
  "dashboard-home",
  "activity-log",
] as const

type ShopScopedTag = (typeof SHOP_SCOPED_TAGS)[number]

const SHOP_SCOPED_TAG_SET: ReadonlySet<string> = new Set<string>(SHOP_SCOPED_TAGS)

/** Shop selector: a concrete shop id, or `"ALL"` for cross-shop (Super_Admin) views. */
export type ShopScope = string | "ALL"

/**
 * Central query-key factory. Every list-style builder accepts `ListParams`
 * (or an entity-specific extension thereof) so that filter changes cleanly
 * yield a new cache entry without losing the shape of the parent tag.
 */
export const qk = {
  // ── Per-user (NOT shop-scoped) ───────────────────────────────────────────
  myShops: () => ["my-shops"] as const,

  // ── Customer Segments (platform-wide, NOT shop-scoped — segments span
  //    the whole customer base regardless of which shop is active) ────────
  customerSegments: () => ["customer-segments", "list"] as const,
  customerSegmentMembers: (id: string, params: ListParams) =>
    ["customer-segments", id, "members", params] as const,

  // ── Area Segments (platform-wide, NOT shop-scoped — a segment's rider
  //    covers a set of exact customer+address pairs regardless of shop) ───
  areaSegments: () => ["area-segments", "list"] as const,
  areaSegmentAddresses: (id: string, params: ListParams) =>
    ["area-segments", id, "addresses", params] as const,
  areaSegmentActiveOrders: (id: string) => ["area-segments", id, "active-orders"] as const,

  // ── First-Time Offers (platform-wide, NOT shop-scoped) ──────────────────
  firstTimeOffers: () => ["first-time-offers", "list"] as const,

  // ── Tutorial Videos (platform-wide, NOT shop-scoped — the same in-app
  //    tutorial section shows regardless of which shop is active) ─────────
  tutorials: () => ["tutorials", "list"] as const,

  // ── Cart Milestones (platform-wide, NOT shop-scoped) ────────────────────
  cartMilestones: () => ["cart-milestones", "list"] as const,

  // ── Spin & Win (platform-wide, NOT shop-scoped — the wheel, its odds,
  //    and spin credits are the same for every customer regardless of
  //    which shop is active in the dashboard) ──────────────────────────────
  spinWheelPrizes: () => ["spin-wheel-prizes", "list"] as const,
  spinWheelFirstTimePrizes: () => ["spin-wheel-first-time-prizes", "list"] as const,
  spinWheelSettings: () => ["spin-wheel-settings"] as const,
  spinWheelMilestones: () => ["spin-wheel-milestones", "list"] as const,
  spinWheelHistory: (params: SpinHistoryFilters) => ["spin-wheel-history", "list", params] as const,
  scratchCardPrizes: () => ["scratch-card-prizes", "list"] as const,
  scratchCardFirstTimePrizes: () => ["scratch-card-first-time-prizes", "list"] as const,
  scratchCardSettings: () => ["scratch-card-settings"] as const,
  scratchCardMilestones: () => ["scratch-card-milestones", "list"] as const,
  scratchCardHistory: (params: ScratchHistoryFilters) => ["scratch-card-history", "list", params] as const,

  // ── Purchase Limit Rules (platform-wide, NOT shop-scoped — rules cap
  //    category/product purchase quantity across the whole platform; the
  //    dashboard only ever creates GLOBAL-scope rules) ────────────────────
  purchaseLimitRules: () => ["purchase-limits", "list"] as const,

  // ── Abandoned Carts (platform-wide, NOT shop-scoped — a cart can span
  //    multiple shops, so there is no single owning shop to key by) ───────
  abandonedCarts: (params: ListParams) => ["abandoned-carts", "list", params] as const,
  abandonedCart: (id: string) => ["abandoned-carts", "detail", id] as const,
  abandonedCartsSummary: () => ["abandoned-carts", "summary"] as const,

  // ── WhatsApp CRM (platform-wide) ────────────────────────────────────────
  crmStatus: () => ["crm", "status"] as const,
  crmConversations: (params: ListParams) => ["crm", "conversations", params] as const,
  crmConversation: (id: string) => ["crm", "conversation", id] as const,
  crmMessages: (id: string) => ["crm", "messages", id] as const,
  crmMe: () => ["crm", "me"] as const,
  crmTemplates: (params: ListParams) => ["crm", "templates", "list", params] as const,
  crmTemplate: (id: string) => ["crm", "templates", "detail", id] as const,
  crmTemplateValues: (conversationId: string) => ["crm", "templates", "values", conversationId] as const,
  crmBotSettings: () => ["crm", "bot", "settings"] as const,
  crmBotRules: () => ["crm", "bot", "rules"] as const,
  crmBotActivity: () => ["crm", "bot", "activity"] as const,
  crmPipeline: (params: ListParams) => ["crm", "pipeline", params] as const,
  crmAgents: () => ["crm", "agents"] as const,
  crmCampaigns: (params: Record<string, unknown>) => ["crm", "campaigns", "list", params] as const,
  crmCampaign: (id: string) => ["crm", "campaigns", "detail", id] as const,
  crmCampaignRecipients: (id: string, params: Record<string, unknown>) => ["crm", "campaigns", "recipients", id, params] as const,
  crmCampaignOptions: () => ["crm", "campaigns", "options"] as const,
  crmProspectImports: () => ["crm", "prospects", "list"] as const,
  crmProspectImport: (id: string) => ["crm", "prospects", "detail", id] as const,
  crmProspectRows: (id: string, params: Record<string, unknown>) => ["crm", "prospects", "rows", id, params] as const,
  chatMe: () => ["chat", "me"] as const,
  chatUnread: () => ["chat", "unread"] as const,
  chatPeople: (search: string) => ["chat", "people", search] as const,
  chatChannels: (archived: boolean) => ["chat", "channels", archived] as const,
  chatChannel: (id: string) => ["chat", "channel", id] as const,
  chatMessages: (id: string) => ["chat", "messages", id] as const,
  chatRefs: (type: string, q: string) => ["chat", "refs", type, q] as const,
  crmAnalyticsOverview: (q: Record<string, unknown>) => ["crm", "analytics", "overview", q] as const,
  crmAnalyticsBreakdown: (by: string, q: Record<string, unknown>) => ["crm", "analytics", "breakdown", by, q] as const,
  crmAnalyticsInbox: (q: Record<string, unknown>) => ["crm", "analytics", "inbox", q] as const,
  crmRateCards: () => ["crm", "rate-cards"] as const,
  crmSuppression: () => ["crm", "suppression"] as const,
  crmWorkflows: () => ["crm", "workflows", "list"] as const,
  crmWorkflow: (id: string) => ["crm", "workflows", "detail", id] as const,
  crmWorkflowCatalog: () => ["crm", "workflows", "catalog"] as const,
  crmLabels: () => ["crm", "labels"] as const,
  crmWorkload: () => ["crm", "workload"] as const,

  // ── Refund Requests (platform-wide, NOT shop-scoped — an order's shop
  //    isn't relevant to reviewing a customer's refund request) ───────────
  refundRequests: (params: ListParams) => ["refund-requests", "list", params] as const,
  refundRequest: (id: string) => ["refund-requests", "detail", id] as const,

  // ── Business Accounts (platform-wide, NOT shop-scoped — a business
  //    account belongs to a customer, not a shop) ─────────────────────────
  businessAccounts: (params: ListParams) => ["business-accounts", "list", params] as const,
  businessAccount: (id: string) => ["business-accounts", "detail", id] as const,

  // ── Shops_Management_UI ──────────────────────────────────────────────────
  shops: (params: ListParams) => ["shops", "list", params] as const,
  shop: (id: string) => ["shops", "detail", id] as const,
  shopActivity: (id: string, params: ListParams) =>
    ["shops", "activity", id, params] as const,

  // ── Shop_Staff_UI ────────────────────────────────────────────────────────
  shopStaff: (shopId: string, params: ListParams) =>
    ["shop-staff", shopId, params] as const,

  // ── Shop_Products_UI ─────────────────────────────────────────────────────
  shopProducts: (shopId: string, params: ListParams) =>
    ["shop-products", shopId, params] as const,
  shopProduct: (shopId: string, id: string) =>
    ["shop-products", shopId, "detail", id] as const,

  // ── Shop_Financials_UI ───────────────────────────────────────────────────
  shopFinancials: (shopId: string, period: string, range: string) =>
    ["shop-financials", shopId, period, range] as const,

  // ── Shop_Transactions_UI ─────────────────────────────────────────────────
  shopTransactions: (shopId: string, params: ListParams) =>
    ["shop-transactions", shopId, params] as const,

  // ── Existing surfaces wrapped with `shopId | "ALL"` so the Shop_Switcher
  //    can invalidate them via a single predicate (Req 3.4, 10.3). ─────────
  orders: (shopId: ShopScope, params: ListParams) =>
    ["orders", shopId, params] as const,
  customers: (shopId: ShopScope, params: ListParams) =>
    ["customers", shopId, params] as const,
  reviews: (shopId: ShopScope, params: ListParams) =>
    ["reviews", shopId, params] as const,
  products: (shopId: ShopScope, params: ListParams) =>
    ["products", shopId, params] as const,
  categories: (shopId: ShopScope, params: ListParams) =>
    ["categories", shopId, params] as const,
  riders: (shopId: ShopScope, params: ListParams) =>
    ["riders", shopId, params] as const,
  banners: (shopId: ShopScope, params: ListParams) =>
    ["banners", shopId, params] as const,
  coupons: (shopId: ShopScope, params: ListParams) =>
    ["coupons", shopId, params] as const,
  wallet: (shopId: ShopScope, params: ListParams) =>
    ["wallet", shopId, params] as const,
  team: (shopId: ShopScope, params: ListParams) =>
    ["team", shopId, params] as const,
  settings: (shopId: ShopScope, params: ListParams) =>
    ["settings", shopId, params] as const,
  notifications: (shopId: ShopScope, params: ListParams) =>
    ["notifications", shopId, params] as const,
  analytics: (shopId: ShopScope, params: ListParams) =>
    ["analytics", shopId, params] as const,
  dashboardHome: (shopId: ShopScope, params: ListParams) =>
    ["dashboard-home", shopId, params] as const,
  activityLog: (shopId: ShopScope, params: ListParams) =>
    ["activity-log", shopId, params] as const,
} as const

/**
 * Predicate used by `queryClient.invalidateQueries({ predicate })` whenever
 * the active shop changes. Returns `true` for any key whose first segment
 * is in the shop-scoped tag list, regardless of the rest of the key. The
 * caller is responsible for ensuring shop-scoped queries actually embed the
 * `shopId` (or `"ALL"`) in their second segment via the `qk` builders.
 *
 * The function is intentionally tolerant of any `readonly unknown[]` so it
 * can be applied to keys built outside the central factory without crashing.
 */
export function isShopScopedKey(key: readonly unknown[]): boolean {
  if (key.length === 0) return false
  const first = key[0]
  return typeof first === "string" && SHOP_SCOPED_TAG_SET.has(first)
}

/** Exported for tests and debugging only. */
export const __SHOP_SCOPED_TAGS_FOR_TEST: readonly ShopScopedTag[] =
  SHOP_SCOPED_TAGS
