"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"
import type { AnalyticsOverview } from "@/types/whatsapp-crm.types"
import type { ChartMetric } from "./DailyChart"
import { CATEGORY_LABEL, formatCount, formatPct, formatRupees } from "./analytics-helpers"

const DailyChart = dynamic(() => import("./DailyChart"), { ssr: false, loading: () => <Skeleton className="h-[260px] w-full" /> })

const SOURCE_LABEL = { CAMPAIGN: "Campaigns", WORKFLOW: "Automatic messages", MANUAL: "Sent by a person" } as const

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function AnalyticsOverviewTab({ data, onGoToCost }: { data: AnalyticsOverview; onGoToCost: () => void }) {
  const [metric, setMetric] = useState<ChartMetric>("messages")
  const t = data.totals
  const c = data.cost
  const empty = t.sent === 0 && t.failed === 0

  return (
    <div className="space-y-5">
      {!c.hasRates && (
        <div role="note" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          No message prices are set up yet, so costs show as ₹0.{" "}
          <button type="button" className="font-semibold underline" onClick={onGoToCost}>Add prices</button> from Meta’s rate card to see what messaging costs.
        </div>
      )}
      {c.hasRates && c.unpricedMessages > 0 && (
        <div role="note" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          {formatCount(c.unpricedMessages)} billable message{c.unpricedMessages === 1 ? "" : "s"} had no price for their category and date, so they are not in the cost.{" "}
          <button type="button" className="font-semibold underline" onClick={onGoToCost}>Check prices</button>
        </div>
      )}

      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card label="Messages sent" value={formatCount(t.sent)} hint={t.failed ? `${formatCount(t.failed)} failed` : undefined} />
        <Card label="Delivered" value={formatPct(t.delivery_rate)} hint={`${formatCount(t.delivered)} of ${formatCount(t.sent)}`} />
        <Card label="Read" value={formatPct(t.read_rate)} hint={`${formatCount(t.read)} of ${formatCount(t.delivered)} delivered`} />
        <Card label="Replied within 24 h" value={formatPct(t.reply_rate)} hint={`${formatCount(t.replied)} replies`} />
        <Card label="Orders from messages" value={formatCount(t.orders)} hint={`within ${data.range.attributionDays} days of a message`} />
        <Card label="Revenue from those orders" value={formatRupees(t.revenue)} />
        <Card label="Messaging cost" value={formatRupees(c.total)} hint={c.estimated > 0 ? `${formatRupees(c.estimated)} estimated` : undefined} />
        <Card label="Revenue per ₹1 spent" value={t.revenue_per_rupee == null ? "—" : `₹${t.revenue_per_rupee}`} hint={t.cost_per_order == null ? undefined : `${formatRupees(t.cost_per_order)} cost per order`} />
      </section>

      <section aria-label="Daily trend" className="rounded-lg border bg-card p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">By day <span className="font-normal text-muted-foreground">(the day the message was sent)</span></h3>
          <div className="flex gap-1" role="tablist" aria-label="Chart">
            {([["messages", "Messages"], ["orders", "Orders & revenue"], ["cost", "Cost"]] as const).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={metric === id} onClick={() => setMetric(id)} className={`rounded-full border px-3 py-1 text-xs ${metric === id ? "border-primary bg-primary/10 font-semibold" : "hover:bg-muted"}`}>{label}</button>
            ))}
          </div>
        </div>
        {empty ? <p className="py-10 text-center text-sm text-muted-foreground">No messages were sent in this period.</p> : <DailyChart data={data.daily} metric={metric} />}
      </section>

      <section aria-label="By source" className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Messages by where they came from</caption>
          <thead className="bg-muted text-xs"><tr><th className="px-3 py-2">Source</th><th className="px-3 py-2 text-right">Sent</th><th className="px-3 py-2 text-right">Delivered</th><th className="px-3 py-2 text-right">Read</th><th className="px-3 py-2 text-right">Replied</th><th className="px-3 py-2 text-right">Orders</th><th className="px-3 py-2 text-right">Revenue</th></tr></thead>
          <tbody className="divide-y">
            {data.bySource.map((s) => (
              <tr key={s.source}>
                <td className="px-3 py-2 font-medium">{SOURCE_LABEL[s.source]}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCount(s.sent)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCount(s.delivered)} <span className="text-xs text-muted-foreground">{formatPct(s.delivery_rate)}</span></td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCount(s.read)} <span className="text-xs text-muted-foreground">{formatPct(s.read_rate)}</span></td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCount(s.replied)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{s.source === "MANUAL" ? "—" : formatCount(s.orders)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{s.source === "MANUAL" ? "—" : formatRupees(s.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-label="Health" className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold">Opt-outs and new contacts</h3>
          <p className="mt-2 text-sm"><strong>{formatCount(data.optedOut)}</strong> {data.optedOut === 1 ? "person" : "people"} opted out{data.optOutRate != null && <span className="text-muted-foreground"> ({data.optOutRate}% of delivered messages)</span>}</p>
          <p className="mt-1 text-sm"><strong>{formatCount(data.newContacts)}</strong> new WhatsApp contacts</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold">Why messages failed</h3>
          {data.failures.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No failed messages.</p> : (
            <ul className="mt-2 space-y-1 text-sm">
              {data.failures.map((f) => (
                <li key={String(f.code)} className="flex justify-between gap-2"><span>{f.title ?? (f.code ? `Meta error ${f.code}` : "Unknown reason")}{f.code && f.title ? <span className="text-xs text-muted-foreground"> · {f.code}</span> : null}</span><span className="tabular-nums">{formatCount(f.count)}</span></li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {c.byCategory.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Cost so far: {c.byCategory.map((x) => `${CATEGORY_LABEL[x.category] ?? x.category} ${formatRupees(x.cost)}`).join(" · ")}.
          {c.estimatedMessages > 0 && ` ${formatCount(c.estimatedMessages)} message${c.estimatedMessages === 1 ? " is" : "s are"} priced by template category until Meta’s own billing record arrives.`}
        </p>
      )}
    </div>
  )
}
