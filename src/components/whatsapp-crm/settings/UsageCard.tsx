"use client"

import Link from "next/link"
import { ArrowUpRight, Receipt } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCount, formatRupees, istToday } from "@/components/whatsapp-crm/analytics-helpers"
import { CATEGORY_LABEL } from "@/components/whatsapp-crm/analytics-helpers"
import { useAnalyticsOverview, useCrmMe, useRateCards } from "@/hooks/useWhatsappCrm"
import { thisMonth } from "./settings-helpers"

/** This month’s WhatsApp usage and what Meta charges for it — the same figures as Analytics, in one glance. */
export function UsageCard() {
  const me = useCrmMe()
  const allowed = me.can("crm.analytics.view")
  const range = thisMonth(istToday())
  const overview = useAnalyticsOverview(range, allowed)
  const rates = useRateCards(allowed)
  const cost = overview.data?.cost
  const t = overview.data?.totals

  return (
    <section aria-label="Usage and charges" className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><Receipt className="h-5 w-5" aria-hidden /></span>
          <div>
            <h2 className="text-base font-semibold">Usage & charges — this month</h2>
            <p className="text-sm text-muted-foreground">{range.from} to {range.to}</p>
          </div>
        </div>
        {allowed && <Link href="/whatsapp-crm/analytics" className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline">Full report<ArrowUpRight className="h-3 w-3" aria-hidden /></Link>}
      </header>

      {!allowed ? (
        <p role="status" className="text-sm text-muted-foreground">You do not have access to WhatsApp analytics, so usage and charges are hidden here.</p>
      ) : overview.isLoading ? <Skeleton className="h-28 w-full" /> : overview.isError || !t || !cost ? (
        <p role="alert" className="text-sm text-red-600">Could not load usage.</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[["Sent", formatCount(t.sent)], ["Delivered", formatCount(t.delivered)], ["Failed", formatCount(t.failed)], ["Estimated charges", formatRupees(cost.total)]].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-muted/50 p-3"><dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</dt><dd className="mt-0.5 text-xl font-semibold tabular-nums">{v}</dd></div>
            ))}
          </dl>
          {cost.byCategory.length > 0 && (
            <ul className="divide-y rounded-xl border text-sm" aria-label="Charges by message type">
              {cost.byCategory.map((c) => (
                <li key={c.category} className="flex items-center justify-between px-3 py-2">
                  <span>{CATEGORY_LABEL[c.category] ?? c.category} <span className="text-xs text-muted-foreground">· {formatCount(c.messages)} message{c.messages === 1 ? "" : "s"}</span></span>
                  <span className="font-medium tabular-nums">{formatRupees(c.cost)}</span>
                </li>
              ))}
            </ul>
          )}
          {!cost.hasRates && (
            <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              No Meta prices entered yet, so charges show ₹0. Add Meta’s current India rates under <Link href="/whatsapp-crm/analytics" className="font-medium underline">Analytics → Cost & prices</Link> ({rates.data?.cards.length ?? 0} saved).
            </p>
          )}
          {cost.unpricedMessages > 0 && <p role="status" className="text-xs text-amber-800">{cost.unpricedMessages} delivered message(s) have no price for their type, so they are not counted yet.</p>}
        </>
      )}

      <details className="rounded-xl border px-3 py-2 text-sm">
        <summary className="cursor-pointer font-medium">How Meta charges for WhatsApp</summary>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-muted-foreground">
          <li><strong>Replies inside 24 hours</strong> after a customer messages you are free.</li>
          <li><strong>Template messages</strong> (to start a chat, or after 24 hours) are charged per <em>delivered</em> message, and the price depends on the type: Marketing costs most, Utility (order updates) less, Authentication (OTP) least.</li>
          <li>Meta bills your payment method directly. Prices differ by country and change over time — enter the current rates once and every report uses them.</li>
          <li>The figures here are <em>estimates</em>; Meta’s invoice is the final word.</li>
        </ul>
      </details>
    </section>
  )
}
