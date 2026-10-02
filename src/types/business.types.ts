// Phase 12 — procurement, bulk catalog, business analytics (shapes mirror the backend responses)

export interface BizMe { procurementView: boolean; procurementManage: boolean; catalogBulk: boolean; analyticsBusiness: boolean }

export type Channel = "ALL" | "B2B" | "B2C"
export type PeriodId = "today" | "7d" | "30d" | "custom"
export interface PeriodQuery { period: PeriodId; from?: string; to?: string }
export interface AnalyticsFilters extends PeriodQuery { shopId?: string; channel?: Channel }

export interface Vendor { id: string; name: string; phone: string | null; notes: string | null; is_active: boolean; created_at: string; entries?: number }

export type AdjustmentKind = "VENDOR_RETURN" | "DAMAGE" | "WASTAGE" | "AUTHORIZED_ADJUSTMENT" | "B2B_SUPPLY"
export interface ProcurementEntry {
  id: string; entryNo: number
  product: { id: string; name: string; sku: string | null }
  vendor: { id: string; name: string }
  unit: string | null; expectedQty: number; receivedQty: number; damagedQty: number; procuredOn: string
  invoiceRef: string | null; receivingNote: string | null; status: "ACTIVE" | "CANCELLED"; purpose: "RETAIL" | "B2B_RESERVED"
  destination: { id: string; name: string } | null
  reservedFor: { businessAccountId: string | null; businessName: string | null; note: string | null } | null
  createdAt: string; usable: number; shortage: number; allocated: number; centralAdjusted: number; available: number; purchaseTotal: number; unitPrice: number
}
export interface ProcurementDetail extends ProcurementEntry {
  allocations: Array<{ id: string; shopId: string; shopName: string; quantity: number; status: "APPLIED" | "REVERSED"; note: string | null; at: string; reversedAt: string | null }>
  adjustments: Array<{ id: string; kind: AdjustmentKind; label: string; quantity: number; shopId: string | null; shopName: string | null; reason: string; by: string | null; at: string; value: number; loss: boolean }>
  history: Array<{ kind: string; detail: Record<string, unknown>; by: string | null; at: string }>
}
export interface EntryList { items: ProcurementEntry[]; total: number; limit: number; offset: number }
export interface NewEntryInput {
  productId: string; vendorId?: string; vendorName?: string; expectedQty: number; receivedQty?: number; damagedQty?: number; unitPrice: number; purchaseTotal?: number
  procuredOn?: string; invoiceRef?: string; receivingNote?: string; destinationShopId?: string; purpose?: "RETAIL" | "B2B_RESERVED"; reservationNote?: string
}

export interface VendorReport {
  range: { period: string; from: string; to: string }; totalValue: number
  vendors: Array<{ vendorId: string; name: string; entries: number; products: number; receivedQty: number; shortageQty: number; damagedQty: number; purchaseValue: number; avgPrice: number | null; sharePct: number | null }>
  products?: Array<{ productId: string; name: string; receivedQty: number; damagedQty: number; purchaseValue: number; avgPrice: number | null; lastUnitPrice: number }>
}
export interface Reconciliation {
  range: { period: string; from: string; to: string }; note: string
  entries: Array<ProcurementEntry & { perShop: Array<{ shopId: string; shopName: string; quantity: number }>; centralByKind: Record<string, number>; storeByKind: Record<string, number>; lossValue: number }>
  products: Array<{
    productId: string; name: string; received: number; damagedAtDoor: number; shortage: number; allocated: number; centralAdjusted: number; storeAdjusted: number; availableCentral: number
    purchaseCost: number; lossValue: number; soldQty: number; salesValue: number; storeStockNow: number
  }>
}

export type BulkRowStatus = "VALID" | "ERROR" | "UNCHANGED"
export interface BulkBatch {
  id: string; fileName: string | null; status: "PREVIEW" | "APPLIED" | "DISCARDED"; createdAt: string; appliedAt: string | null; createdBy: string | null; appliedBy?: string | null
  totals: { rows: number; valid: number; errors: number; unchanged: number; shops?: number; products?: number }
  ignoredColumns?: string[]
  result?: { appliedRows: number; shops: number; products: number; stockMovements: number; skippedRows: number }
}
export interface BulkRow {
  rowNo: number; status: BulkRowStatus; errors: string[]; product: { name: string; sku: string | null } | null; store: { name: string; branchCode: string } | null
  changes: Record<string, { from: unknown; to: unknown }>; summary: string; raw: Record<string, string>
}
export interface BulkRows { total: number; limit: number; items: BulkRow[] }
export interface AvailabilityResult {
  action: "ENABLE" | "DISABLE" | "ASSIGN"; dryRun: boolean; stores: number; products: number; willChange: number; alreadyDone: number
  skipped: { noStock: number; notAssigned: number; removed: number }; inactiveStores: string[]; applied: number
}

export interface Overview {
  period: string; from: string; to: string; days: number; shopId: string | null; channel: Channel
  cards: { grossSales: number; netRevenue: number; procurementCost: number; commissionEarned: number; refunds: number; returns: number; cancelledValue: number; trackedLoss: number }
  counts: { orders: number; customers: number; refundedOrders: number; cancelledOrders: number; deliveredOrders: number; purchases: number; returnMovements: number }
  avgOrderValue: number | null
  lossBreakdown: { damagedAtReceiving: number; procurementAdjustments: number; storeDamage: number; unpricedStoreDamageRecords: number }
  series: Array<{ day: string; orders: number; gross: number }>
  warnings: string[]; definitions: Record<string, string>
}
export interface TopProducts { items: Array<{ productId: string; name: string; sku: string | null; units: number; revenue: number; orders: number; buyers: number; repeatBuyers: number; repeatRatePct: number | null; previousUnits: number; growthPct: number | null; isNew: boolean }> }
export interface TopCustomers {
  summary: { customers: number; repeatCustomers: number; repeatRatePct: number | null }; note: string
  items: Array<{ userId: string; name: string | null; phone: string | null; company: string | null; channel: "B2B" | "B2C"; orders: number; spend: number; avgOrderValue: number | null; lastOrderAt: string; isRepeat: boolean }>
}
export interface StorePerf {
  items: Array<{ shopId: string; name: string; branchCode: string; orders: number; sales: number; avgOrderValue: number | null; unitsSold: number; refunds: number; returns: number; cancelledOrders: number; cancelledValue: number; avgFulfillmentMinutes: number | null; stock: { receivedUnits: number; soldUnits: number; damagedUnits: number } }>
}
export interface ChannelSide { orders: number; sales: number; customers: number; avgOrderValue: number | null; valuePerCustomer: number | null; repeatRatePct: number | null; topProducts: Array<{ productId: string; name: string; units: number; revenue: number }> }
export interface ChannelSplit { B2B: ChannelSide; B2C: ChannelSide; b2bSharePct: number | null }
