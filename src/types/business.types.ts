// Phase 12 — procurement, bulk catalog, business analytics (shapes mirror the backend responses)

export interface BizMe { procurementView: boolean; procurementManage: boolean; catalogBulk: boolean; analyticsBusiness: boolean }

export type Channel = "ALL" | "B2B" | "B2C"
export type PeriodId = "today" | "7d" | "30d" | "custom"
export interface PeriodQuery { period: PeriodId; from?: string; to?: string }
export interface AnalyticsFilters extends PeriodQuery { shopId?: string; channel?: Channel }

export type VendorTerms = "CASH" | "UPI" | "BANK" | "CREDIT"
export type PayMethod = "CASH" | "UPI" | "BANK"
export interface Vendor {
  id: string; name: string; phone: string | null; notes: string | null; is_active: boolean; created_at: string; entries?: number
  tradeName?: string | null; gstin?: string | null; address?: string | null; contactPerson?: string | null; paymentTerms?: VendorTerms; creditDays?: number
  upiId?: string | null; bankName?: string | null; bankIfsc?: string | null; bankAccountMasked?: string | null; hasPayDetails?: boolean
}
export interface VendorInput {
  name?: string; phone?: string; notes?: string; isActive?: boolean; tradeName?: string; gstin?: string; address?: string; contactPerson?: string
  paymentTerms?: VendorTerms; creditDays?: number; upiId?: string; bankName?: string; bankAccountNo?: string; bankIfsc?: string
}
export interface PayableRow { vendorId: string; name: string; phone: string | null; paymentTerms: VendorTerms; creditDays: number; isActive: boolean; owed: number; overdue: number; nextDue: string | null; unpaidBills: number; onTheWay: { count: number; value: number } | null }
export interface Payables { totalOwed: number; totalOverdue: number; vendors: PayableRow[]; note: string }
export interface SupplierBill { entryId: string; entryNo: number; product: string; procuredOn: string; total: number; credit: number; bill: number; paid: number; left: number; dueOn: string; overdue: boolean; status: "PAID" | "PART" | "UNPAID"; invoiceRef: string | null; hasInvoice: boolean }
export interface SupplierPayment { id: string; amount: number; method: PayMethod; paidOn: string; reference: string | null; note: string | null; by: string | null; at: string; voided: boolean; voidReason: string | null }
export interface SupplierLedger { vendor: Vendor; owed: number; overdue: number; nextDue: string | null; totalBilled: number; totalPaid: number; onTheWay: { count: number; value: number } | null; bills: SupplierBill[]; payments: SupplierPayment[] }
export type DocKind = "INVOICE" | "DELIVERY_SLIP" | "CREDIT_NOTE"

export type AdjustmentKind = "VENDOR_RETURN" | "DAMAGE" | "WASTAGE" | "AUTHORIZED_ADJUSTMENT" | "B2B_SUPPLY"
export interface ProcurementEntry {
  id: string; entryNo: number
  product: { id: string; name: string; sku: string | null }
  vendor: { id: string; name: string }
  unit: string | null; expectedQty: number; receivedQty: number; damagedQty: number; procuredOn: string
  invoiceRef: string | null; invoiceCount: number; receivingNote: string | null; status: "ORDERED" | "ACTIVE" | "CANCELLED"; purpose: "RETAIL" | "B2B_RESERVED"; owedQty: number; receivedAt: string | null
  destination: { id: string; name: string } | null
  reservedFor: { businessAccountId: string | null; businessName: string | null; note: string | null } | null
  createdAt: string; reserved: number; usable: number; shortage: number; allocated: number; centralAdjusted: number; available: number; purchaseTotal: number; unitPrice: number
}
export interface ProcurementDetail extends ProcurementEntry {
  allocations: Array<{ id: string; shopId: string; shopName: string; quantity: number; status: "APPLIED" | "REVERSED"; note: string | null; at: string; reversedAt: string | null }>
  adjustments: Array<{ id: string; kind: AdjustmentKind; label: string; quantity: number; shopId: string | null; shopName: string | null; reason: string; by: string | null; at: string; value: number; loss: boolean }>
  documents: Array<{ id: string; kind: DocKind; fileName: string; mime: string; size: number; at: string }>
  history: Array<{ kind: string; detail: Record<string, unknown>; by: string | null; at: string }>
}
export interface EntryList { items: ProcurementEntry[]; total: number; limit: number; offset: number }
export interface NewEntryInput {
  productId: string; vendorId?: string; vendorName?: string; expectedQty: number; receivedQty?: number; damagedQty?: number; unitPrice: number; purchaseTotal?: number
  procuredOn?: string; invoiceRef?: string; receivingNote?: string; destinationShopId?: string; purpose?: "RETAIL" | "B2B_RESERVED"; reservationNote?: string; ordered?: boolean
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

// B2B requirements + purchase plan
export type ReqSource = "WHATSAPP_META" | "WHATSAPP_PERSONAL" | "PHONE_CALL" | "WALK_IN" | "OTHER"
export type ReqStatus = "INQUIRY" | "CONFIRMED" | "DELIVERED" | "CANCELLED"
export type PayTerms = "COD" | "UPI" | "ADVANCE_PAID" | "CREDIT" | "PARTIAL"
export interface Requirement {
  id: string; reqNo: number; customerName: string; customerPhone: string | null; business: { id: string; name: string } | null
  conversationId: string | null; source: ReqSource; sourceLabel: string; status: ReqStatus; deliveryDate: string | null; paymentTerms: PayTerms
  note: string | null; createdAt: string; createdBy: string | null
  items: Array<{ productId: string; name: string; unit: string | null; imageUrl: string | null; quantity: number; unitPrice: number | null; held: number }>
  history?: Array<{ kind: string; detail: Record<string, unknown>; by: string | null; at: string }>
}
export interface RequirementList { items: Requirement[]; total: number; limit: number; offset: number }
export interface NewRequirementInput {
  customerName: string; customerPhone?: string; businessAccountId?: string; waConversationId?: string; source: ReqSource; paymentTerms: PayTerms
  deliveryDate?: string; note?: string; confirmed: boolean; items: Array<{ productId: string; quantity: number; unitPrice?: number }>
}
export interface RequirementCustomer { id: string; company_name: string; contact_name: string | null; phone: string | null }
export interface RequirementPrefill { conversationId: string; customerName: string; customerPhone: string; businessAccountId: string | null; source: ReqSource }
export interface PlanItem {
  productId: string; name: string; unit: string | null; imageUrl: string | null; firstDue: string | null; appOrders: number; confirmed: number
  storeStock: number; centralStock: number; incoming: number; lastPrice: number | null; lastVendor: string | null
  committed: number; projected: number; shopLow: number; have: number; need: number; toBuy: number; status: "BUY" | "WATCH" | "OK"
}
export interface PurchasePlan { items: PlanItem[]; totals: { toBuyProducts: number; committedProducts: number; inquiryProducts: number }; note: string }

export type RejectOutcome = "WASTAGE" | "RETURN" | "REPLACEMENT"
export interface ReceiveInput { receivedQty: number; rejectedQty: number; outcome?: RejectOutcome; restComing: boolean; note?: string }

export interface DistributionPreview {
  entry: { id: string; entryNo: number; product: { id: string; name: string }; vendor: string; unit: string | null; dedicatedTo: string | null }
  available: number; blocked: string | null
  requests: Array<{ id: string; reqNo: number; customer: string; due: string | null; open: number }>
  suggestion: {
    available: number; keepCentral: number; shortages: { b2b: number; appOrders: number; shelves: number }
    reservations: Array<{ requirementId: string; reqNo?: number; customer: string; due: string | null; wanted: number; quantity: number }>
    stores: Array<{ shopId: string; name: string; stock: number; low: number; appOrders: number; b2bQty: number; retailQty: number; retailNeed: number; total: number }>
  }
  note: string
}
export interface DistributeInput { reservations: Array<{ requirementId: string; quantity: number }>; allocations: Array<{ shopId: string; quantity: number }>; note?: string }

export interface MonthlyPreview {
  window: { month: string; label: string; from: string; to: string; asOf: string; inProgress: boolean }
  summary: {
    purchases: { count: number; value: number; onTheWay: number; receivedUnits: number; acceptedUnits: number }
    suppliers: { opening: number; billed: number; returned: number; paid: number; closing: number; overdue: number }
    loss: { wastage: number; recovered: number; units: number }
    b2b: { billed: number; collected: number; cash: number; upi: number; razorpay: number; other: number; outstanding: number; overdue: number }
    moneyIn: { b2b: number; cod: number; codOrders: number; gateway: number; gatewayPayments: number; total: number }
  }
  agingTotals: Array<{ bucket: string; orders: number; amount: number }>
  exceptions: Array<{ code: string; level: "bad" | "warn" | "info"; text: string; count: number }>
  counts: { purchases: number; payments: number; losses: number; collections: number; receivables: number }
  definitions: Array<{ term: string; text: string }>
}
