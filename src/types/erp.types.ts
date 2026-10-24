/** Operations ERP responses (GET /admin/erp/ops/*). */
export type PriceAdvice = "RAISE" | "OK" | "ROOM_TO_DISCOUNT" | null

export interface DayCloseItem {
  productId: string
  name: string
  category: string | null
  unit: string | null
  pack: string | null
  opening: number
  bought: number
  sold: number
  wasted: number
  returnedToShelf: number
  adjusted: number
  closing: number
  orders: number
  revenue: number
  unitCost: number
  cogs: number
  wasteValue: number
  profit: number
  marginPct: number | null
  wastePct: number | null
  targetWastePct: number
  doorDamage: { qty: number; value: number } | null
  price: { average: number | null; effectiveCost: number; targetMarginPct: number; suggested: number | null; advice: PriceAdvice }
  ledgerGap: number
  shelfMismatch: number
}

export interface DayClose {
  date: string
  shopId: string | null
  isToday: boolean
  inProgress: boolean
  totals: { revenue: number; cogs: number; wasteValue: number; profit: number; marginPct: number | null; unitsSold: number; unitsWasted: number; purchaseSpend: number; doorDamageValue: number }
  raise: number
  ledger: { gaps: number; items: Array<{ productId: string; name: string; gap: number; shelfMismatch: number }> }
  items: DayCloseItem[]
  definitions: Record<string, string>
}

export interface WastageProduct { productId: string; name: string; category: string | null; qty: number; value: number; handled: number; wastePct: number | null; targetPct: number; breach: boolean; topReason: string | null; cumulativePct: number | null }

export interface Wastage {
  period: string
  from: string
  to: string
  days: number
  shopId: string | null
  totals: { qty: number; value: number; wastePct: number | null; handled: number; perDay: number; doorDamageValue: number }
  breaches: number
  byReason: Array<{ reason: string; qty: number; value: number; sharePct: number | null }>
  byCategory: Array<{ category: string; qty: number; value: number; sharePct: number | null }>
  byWeekday: Array<{ weekday: number; value: number }>
  products: WastageProduct[]
  heatmap: Array<{ productId: string; name: string; weekdays: number[] }>
  daily: Array<{ day: string; value: number; qty: number }>
  doorDamage: { value: number; byVendor: Array<{ vendor: string; qty: number; value: number }> }
  definitions: Record<string, string>
}

export type ForecastRisk = "RUNS_OUT_TODAY" | "BUY_FOR_TOMORROW" | "LOW" | "WILL_SPOIL" | "OK" | "NO_DATA"

export interface ForecastItem {
  productId: string
  name: string
  category: string | null
  unit: string | null
  pack: string | null
  stock: number
  incoming: number
  expectedTonight: number
  avgPerDay: number
  today: number
  tomorrow: number
  nextWeek: number
  coverDays: number | null
  buy: number
  buyValue: number
  wastePct: number
  confidence: "none" | "low" | "fair" | "good"
  risk: ForecastRisk
  daily: Array<{ day: string; units: number }>
}

export interface Forecast {
  asOf: string
  forecastFrom: string
  shopId: string | null
  horizon: number
  cover: number
  shareOfDayLeft: number
  totals: { toBuy: number; buyValue: number; urgent: number; short: number; willSpoil: number }
  accuracy: { accuracyPct: number | null; soldUnits: number; missedUnits: number }
  items: ForecastItem[]
  definitions: Record<string, string>
}

// ── Accounting ──
export type ExpenseCategory = "RENT" | "SALARY" | "ELECTRICITY" | "INTERNET" | "TAXES" | "TRANSPORT" | "PACKING" | "RIDER_PAY" | "MARKETING" | "GATEWAY_FEES" | "MAINTENANCE" | "OTHER"
export type PayVia = "CASH" | "UPI" | "BANK"
export type CashKind = "OPENING_BALANCE" | "OWNER_CAPITAL" | "OWNER_DRAWING" | "OTHER_INCOME" | "BANK_DEPOSIT" | "BANK_WITHDRAWAL"
export type Box = "CASH" | "BANK"

export interface MoneyLine { label: string; amount: number }
export interface BoxPosition { in: MoneyLine[]; out: MoneyLine[]; totalIn: number; totalOut: number; net: number; opening: { on: string; amount: number } | null; balance: number | null }

export interface Pnl {
  sales: number
  cogs: number
  gross: number
  grossMarginPct: number | null
  wastage: number
  afterWastage: number
  expenses: { fixed: number; variable: number; total: number; byCategory: Array<{ category: ExpenseCategory; label: string; kind: "FIXED" | "VARIABLE"; amount: number; count: number }> }
  operatingProfit: number
  otherIncome: number
  netProfit: number
  netMarginPct: number | null
  breakEvenSales: number | null
}

export interface AccountingSummary {
  month: string
  label: string
  from: string
  to: string
  inProgress: boolean
  closed: { at: string; by: string | null } | null
  pnl: Pnl
  position: Record<Box, BoxPosition>
  counts: { expenses: number; cashEntries: number; codOrders: number; gatewayPayments: number }
  warnings: string[]
  notes: string[]
}

export interface Expense {
  id: string
  date: string
  category: ExpenseCategory
  categoryLabel: string
  kind: "FIXED" | "VARIABLE"
  amount: number
  paidVia: PayVia
  shopId: string | null
  shop: string | null
  party: string | null
  note: string | null
  createdBy: string | null
  voided: boolean
  voidReason: string | null
  voidedBy: string | null
}
export interface ExpenseList { from: string; to: string; total: number; items: Expense[]; categories: Array<{ id: ExpenseCategory; label: string; kind: "FIXED" | "VARIABLE" }> }

export interface CashEntry { id: string; date: string; kind: CashKind; kindLabel: string; account: Box | null; amount: number; note: string | null; createdBy: string | null; voided: boolean; voidReason: string | null; voidedBy: string | null }
export interface CashList { from: string; to: string; items: CashEntry[]; kinds: Array<{ id: CashKind; label: string; needsAccount: boolean }> }

export interface JournalRow { date: string; account: Box; direction: "in" | "out"; label: string; party: string | null; amount: number; source: string }
export interface Journal { month: string; label: string; from: string; to: string; rows: JournalRow[]; totals: Record<Box, { in: number; out: number }> }

// ── Data Explorer ──
export type ExplorerKind = "orders" | "lines" | "movements" | "purchases" | "refunds" | "expenses"
export interface ExplorerColumn { key: string; label: string; type: "text" | "number" | "money" | "datetime" | "phone" | "bool" }
export interface ExplorerPage { kind: ExplorerKind; label: string; from: string; to: string; total: number; limit: number; offset: number; columns: ExplorerColumn[]; rows: Array<Record<string, string | number | boolean | null>> }

// ── Founder view ──
export interface LadderStep { key: string; label: string; total: number; perOrder: number; pctOfSales: number | null; kind: "start" | "cost" | "subtotal" | "gain" | "end" }
export interface Founder {
  month: string
  label: string
  from: string
  to: string
  inProgress: boolean
  headline: { sales: number; netRevenue: number; orders: number; avgOrderValue: number | null; refundPct: number | null; netProfit: number; netMarginPct: number | null; cashBalance: number | null; bankBalance: number | null }
  ladder: { orders: number; steps: LadderStep[] } | null
  stores: Array<{ shopId: string; name: string; orders: number; sales: number; avgOrderValue: number | null; refunds: number; cancelledOrders: number; cancelledValue: number; avgFulfillmentMinutes: number | null; damagedUnits: number }>
  cohorts: Array<{ cohort: string; size: number; retention: Record<string, number | null> }>
  b2b: { billed: number; collected: number; outstanding: number; overdue: number; overdue30: number; aging: Array<{ bucket: string; orders: number; amount: number }>; topLate: Array<{ order: string; customer: string; outstanding: number; daysLate: number }> }
  alerts: Array<{ level: "bad" | "warn"; text: string; href: string }>
  notes: string[]
}
