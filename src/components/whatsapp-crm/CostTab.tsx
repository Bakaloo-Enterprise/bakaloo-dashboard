"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useRateCardMutations, useRateCards } from "@/hooks/useWhatsappCrm"
import type { AnalyticsOverview, RateCategory } from "@/types/whatsapp-crm.types"
import { CATEGORY_LABEL, formatCount, formatRupees, istToday } from "./analytics-helpers"

/** What a message costs, per category, from a date. A change is a new price from a new date — old prices stay so past reports do not move. */
export function CostTab({ overview, canManage }: { overview?: AnalyticsOverview; canManage: boolean }) {
  const cards = useRateCards()
  const m = useRateCardMutations()
  const [category, setCategory] = useState<RateCategory>("MARKETING")
  const [rate, setRate] = useState("")
  const [from, setFrom] = useState(istToday())
  const [note, setNote] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})

  const rateNum = Number(rate)
  const ready = rate.trim() !== "" && Number.isFinite(rateNum) && rateNum >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(from)

  const save = () =>
    m.add.mutate({ category, rate: rateNum, effectiveFrom: from, ...(note.trim() ? { note: note.trim() } : {}) }, {
      onSuccess: () => { setRate(""); setNote(""); setErrors({}) },
      onError: (err) => setErrors((err as { response?: { data?: { details?: Record<string, string> } } })?.response?.data?.details ?? {}),
    })

  const c = overview?.cost
  return (
    <div className="space-y-5">
      {c && (
        <section aria-label="Cost in this period" className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold">Cost in the period you are viewing</h3>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatRupees(c.total)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatCount(c.billedMessages)} billable message{c.billedMessages === 1 ? "" : "s"}
            {c.estimatedMessages > 0 && <> · {formatCount(c.estimatedMessages)} priced by template category (an estimate) = {formatRupees(c.estimated)}</>}
            {c.unpricedMessages > 0 && <> · <span className="text-amber-700">{formatCount(c.unpricedMessages)} with no price set</span></>}
          </p>
          {c.byCategory.length > 0 && (
            <ul className="mt-3 divide-y rounded-md border text-sm">
              {c.byCategory.map((x) => <li key={x.category} className="flex justify-between px-3 py-1.5"><span>{CATEGORY_LABEL[x.category] ?? x.category} <span className="text-xs text-muted-foreground">· {formatCount(x.messages)} messages</span></span><span className="tabular-nums">{formatRupees(x.cost)}</span></li>)}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">Meta charges when a template message is delivered. When Meta’s billing record is available it decides what is billable and in which category; replies you type inside the 24-hour window are free.</p>
        </section>
      )}

      <section aria-label="Prices" className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-semibold">Message prices (₹ per message)</h3>
        <p className="mt-1 text-xs text-muted-foreground">Copy these from Meta’s current rate card for India. Nothing is pre-filled because Meta changes prices; each price applies from the date you choose, and earlier prices are kept.</p>
        {cards.isLoading ? <Skeleton className="mt-3 h-24 w-full" /> : (
          <div className="mt-3 overflow-x-auto rounded-md border">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Price history</caption>
              <thead className="bg-muted text-xs"><tr><th className="px-3 py-2">Category</th><th className="px-3 py-2 text-right">Price</th><th className="px-3 py-2">From</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Note</th><th className="px-3 py-2" /></tr></thead>
              <tbody className="divide-y">
                {(cards.data?.cards ?? []).length === 0 && <tr><td colSpan={6} className="p-4 text-center text-xs text-muted-foreground">No prices yet.</td></tr>}
                {(cards.data?.cards ?? []).map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2">{CATEGORY_LABEL[r.category]}</td>
                    <td className="px-3 py-2 text-right tabular-nums">₹{r.rate}</td>
                    <td className="px-3 py-2 tabular-nums">{r.effective_from}</td>
                    <td className="px-3 py-2 text-xs">{r.current ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">In use</span> : r.future ? <span className="rounded-full bg-sky-100 px-2 py-0.5 font-semibold text-sky-800">Starts later</span> : <span className="text-muted-foreground">Replaced</span>}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{r.note ?? ""}</td>
                    <td className="px-3 py-2 text-right">{canManage && r.future && <Button variant="ghost" size="sm" disabled={m.remove.isPending} aria-label={`Remove the ${r.category.toLowerCase()} price starting ${r.effective_from}`} onClick={() => m.remove.mutate(r.id)}>Remove</Button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canManage ? (
          <form className="mt-4 grid gap-3 md:grid-cols-5" onSubmit={(e) => { e.preventDefault(); if (ready) save() }} aria-label="Add a price">
            <div>
              <Label htmlFor="rc-cat" className="text-xs">Category</Label>
              <select id="rc-cat" className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value as RateCategory)}>
                {(cards.data?.categories ?? ["MARKETING", "UTILITY", "AUTHENTICATION", "SERVICE"]).map((c2) => <option key={c2} value={c2}>{CATEGORY_LABEL[c2]}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="rc-rate" className="text-xs">Price (₹)</Label>
              <Input id="rc-rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="e.g. 0.86" className="mt-1" aria-invalid={Boolean(errors.rate)} />
              {errors.rate && <p role="alert" className="mt-0.5 text-xs text-red-600">{errors.rate}</p>}
            </div>
            <div>
              <Label htmlFor="rc-from" className="text-xs">Applies from</Label>
              <Input id="rc-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1" aria-invalid={Boolean(errors.effectiveFrom)} />
              {errors.effectiveFrom && <p role="alert" className="mt-0.5 text-xs text-red-600">{errors.effectiveFrom}</p>}
            </div>
            <div>
              <Label htmlFor="rc-note" className="text-xs">Note (optional)</Label>
              <Input id="rc-note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Meta rate card Oct 2026" className="mt-1" />
            </div>
            <div className="flex items-end"><Button type="submit" disabled={!ready || m.add.isPending}>{m.add.isPending ? "Saving…" : "Add price"}</Button></div>
          </form>
        ) : <p className="mt-3 text-xs text-muted-foreground">You can see prices but not change them.</p>}
        <p className="mt-2 text-[11px] text-muted-foreground">Adding a price from a past date re-prices reports for that period.</p>
      </section>
    </div>
  )
}
