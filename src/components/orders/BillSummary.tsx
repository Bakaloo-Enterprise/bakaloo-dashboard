"use client"

import { Banknote, CreditCard, Gift, Landmark, Wallet } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn, formatINR } from "@/lib/utils"
import type { BillLine, BillPaymentPart, OrderBill } from "@/types/order.types"

const PART_ICON: Record<string, typeof Wallet> = {
  WALLET: Wallet,
  RAZORPAY: CreditCard,
  COD: Banknote,
}

const STATE_STYLE: Record<BillPaymentPart["state"], string> = {
  PAID: "bg-success/10 text-success",
  DUE: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  FAILED: "bg-destructive/10 text-destructive",
}

const STATE_LABEL: Record<BillPaymentPart["state"], string> = {
  PAID: "Paid",
  DUE: "Collect on delivery",
  PENDING: "Pending",
  FAILED: "Failed",
}

function money(amount: number) {
  return amount < 0 ? `-${formatINR(-amount)}` : formatINR(amount)
}

function LineRow({ line }: { line: BillLine }) {
  const discount = line.kind === "discount"
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <span className={cn("text-muted-foreground", discount && "text-success")}>{line.label}</span>
        {line.waived ? (
          <span className="flex items-baseline gap-1.5">
            {!!line.originalAmount && (
              <span className="text-xs text-muted-foreground line-through">{formatINR(line.originalAmount)}</span>
            )}
            <span className="font-semibold text-success">FREE</span>
          </span>
        ) : (
          <span className={cn(discount && "font-semibold text-success", line.kind === "adjustment" && "text-amber-600")}>
            {money(line.amount)}
          </span>
        )}
      </div>
      {line.waived && line.note && <p className="text-[11px] text-muted-foreground">{line.note}</p>}
    </div>
  )
}

/**
 * The itemised bill: item total → each named discount → every fee → GST split
 * → tip → grand total, followed by how it is being paid (wallet / Razorpay /
 * cash to collect). Renders the server-built `order.bill`, so it always
 * matches the printed receipt and the customer app.
 */
export function BillSummary({ bill, className }: { bill: OrderBill; className?: string }) {
  const { payment } = bill
  return (
    <div className={cn("space-y-3 text-sm", className)}>
      <div className="space-y-1.5">
        {bill.lines.map((line) => (
          <LineRow key={`${line.code}-${line.label}`} line={line} />
        ))}
        <div className="flex items-center justify-between border-t pt-2 text-base font-bold">
          <span>Grand total</span>
          <span>{formatINR(bill.grandTotal)}</span>
        </div>
        {!bill.reconciled && (
          <p className="text-[11px] text-amber-600">
            Part of this total isn&apos;t itemised on the order record (shown as &quot;Other adjustments&quot;).
          </p>
        )}
      </div>

      <div className="rounded-lg border bg-muted/30 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            How it&apos;s paid
          </span>
          <span className="text-xs text-muted-foreground">{payment.methodLabel}</span>
        </div>
        <div className="space-y-2">
          {payment.parts.map((part) => {
            const Icon = PART_ICON[part.code] ?? Landmark
            return (
              <div key={part.code} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span>{part.label}</span>
                  <Badge variant="outline" className={cn("border-0 px-1.5 py-0 text-[10px] font-medium", STATE_STYLE[part.state])}>
                    {STATE_LABEL[part.state]}
                  </Badge>
                </span>
                <span className="font-semibold">{formatINR(part.amount)}</span>
              </div>
            )
          })}
          {payment.parts.length === 0 && (
            <p className="text-xs text-muted-foreground">No payment recorded ({payment.status})</p>
          )}
        </div>
        {payment.collectOnDelivery > 0 && (
          <div className="mt-2 flex items-center justify-between rounded-md bg-amber-100 px-2.5 py-1.5 text-sm font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            <span>Rider collects in cash</span>
            <span>{formatINR(payment.collectOnDelivery)}</span>
          </div>
        )}
        {payment.refundAmount > 0 && (
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Refunded to customer</span>
            <span>{formatINR(payment.refundAmount)}</span>
          </div>
        )}
      </div>

      {(bill.savings.total > 0 || bill.cashback.length > 0) && (
        <div className="space-y-1 text-xs">
          {bill.savings.total > 0 && (
            <p className="font-semibold text-success">
              Customer saved {formatINR(bill.savings.total)}
              {bill.savings.parts.length > 0 &&
                ` (${bill.savings.parts.map((p) => `${p.label} ${formatINR(p.amount)}`).join(" + ")})`}
            </p>
          )}
          {bill.cashback.map((c, i) => (
            <p key={i} className="flex items-center gap-1 text-muted-foreground">
              <Gift className="h-3.5 w-3.5" />
              Cashback {formatINR(c.amount)} — {c.status === "CREDITED" ? "credited to wallet" : "pending, credits to wallet later"}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
