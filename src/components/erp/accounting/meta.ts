import { Banknote, Bike, Coins, Home, Landmark, Megaphone, MoreHorizontal, Package, PiggyBank, Wifi, Wrench, Zap, Users, CreditCard, Truck, ArrowDownToLine, ArrowUpFromLine, Scale, type LucideIcon } from "lucide-react"
import type { Box, CashKind, ExpenseCategory, PayVia } from "@/types/erp.types"
import type { Tone } from "../kit"

export const EXPENSE_META: Record<ExpenseCategory, { icon: LucideIcon; tone: Tone; short: string }> = {
  RENT: { icon: Home, tone: "violet", short: "Rent" },
  SALARY: { icon: Users, tone: "blue", short: "Salaries" },
  ELECTRICITY: { icon: Zap, tone: "amber", short: "Power" },
  INTERNET: { icon: Wifi, tone: "blue", short: "Internet" },
  TAXES: { icon: Landmark, tone: "slate", short: "Taxes" },
  TRANSPORT: { icon: Truck, tone: "amber", short: "Transport" },
  PACKING: { icon: Package, tone: "green", short: "Packing" },
  RIDER_PAY: { icon: Bike, tone: "green", short: "Riders" },
  MARKETING: { icon: Megaphone, tone: "rose", short: "Ads" },
  GATEWAY_FEES: { icon: CreditCard, tone: "slate", short: "Gateway fees" },
  MAINTENANCE: { icon: Wrench, tone: "amber", short: "Repairs" },
  OTHER: { icon: MoreHorizontal, tone: "slate", short: "Other" },
}

export const VIA_LABEL: Record<PayVia, string> = { CASH: "Cash", UPI: "UPI", BANK: "Bank" }

export const CASH_META: Record<CashKind, { icon: LucideIcon; tone: Tone; short: string; help: string; sign: "+" | "−" | "↔" | "•" }> = {
  OPENING_BALANCE: { icon: Scale, tone: "slate", short: "Opening balance", help: "What was in the cash box or bank when you start counting", sign: "•" },
  OWNER_CAPITAL: { icon: PiggyBank, tone: "green", short: "Owner put in", help: "Your own money added to the business", sign: "+" },
  OWNER_DRAWING: { icon: ArrowUpFromLine, tone: "rose", short: "Owner took out", help: "Money you took out for yourself", sign: "−" },
  OTHER_INCOME: { icon: Coins, tone: "green", short: "Other income", help: "Money that is not a sale — e.g. selling old crates", sign: "+" },
  BANK_DEPOSIT: { icon: ArrowDownToLine, tone: "blue", short: "Cash → bank", help: "Cash counted and put in the bank", sign: "↔" },
  BANK_WITHDRAWAL: { icon: Banknote, tone: "amber", short: "Bank → cash", help: "Cash taken out of the bank for the box", sign: "↔" },
}

export const BOX_LABEL: Record<Box, string> = { CASH: "Cash box", BANK: "Bank & UPI" }

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number)
  const d = new Date(Date.UTC(y, m - 1 + by, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` }
}
