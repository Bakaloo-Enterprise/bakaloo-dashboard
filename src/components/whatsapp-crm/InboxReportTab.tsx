"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { useAnalyticsInbox } from "@/hooks/useWhatsappCrm"
import type { AnalyticsQuery } from "@/types/whatsapp-crm.types"
import { BOT_OUTCOME_LABEL, formatCount, formatMinutes, formatPct } from "./analytics-helpers"

export function InboxReportTab({ query }: { query: Pick<AnalyticsQuery, "from" | "to"> }) {
  const { data, isLoading, isError } = useAnalyticsInbox(query)
  if (isLoading) return <Skeleton className="h-48 w-full" />
  if (isError || !data) return <p role="alert" className="text-sm text-red-600">Could not load this report. Try again.</p>
  const r = data.responses
  const answered = r.answered_by_people + r.answered_by_bot

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">A “wait” starts when a customer writes and nobody has replied since. Times are clock time, including nights and holidays.</p>
      <section aria-label="Response times" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-3"><p className="text-xs text-muted-foreground">Typical reply time</p><p className="mt-1 text-xl font-semibold">{formatMinutes(r.median_minutes)}</p><p className="text-[11px] text-muted-foreground">half are faster · 9 in 10 within {formatMinutes(r.p90_minutes)}</p></div>
        <div className="rounded-lg border bg-card p-3"><p className="text-xs text-muted-foreground">Answered within 15 min</p><p className="mt-1 text-xl font-semibold">{formatPct(r.within_15_rate)}</p><p className="text-[11px] text-muted-foreground">of replies by people</p></div>
        <div className="rounded-lg border bg-card p-3"><p className="text-xs text-muted-foreground">Waits started</p><p className="mt-1 text-xl font-semibold">{formatCount(r.waiting_starts)}</p><p className="text-[11px] text-muted-foreground">{formatCount(r.answered_by_people)} by people · {formatCount(r.answered_by_bot)} by the bot</p></div>
        <div className="rounded-lg border bg-card p-3"><p className="text-xs text-muted-foreground">Still unanswered</p><p className={`mt-1 text-xl font-semibold ${r.unanswered > 0 ? "text-red-600" : ""}`}>{formatCount(r.unanswered)}</p><p className="text-[11px] text-muted-foreground">{answered} answered in total</p></div>
      </section>

      <section aria-label="Messages" className="rounded-lg border bg-card p-4 text-sm">
        <h3 className="font-semibold">Messages in this period</h3>
        <p className="mt-2">{formatCount(data.volume.inbound)} from customers · {formatCount(data.volume.by_people)} replies by people · {formatCount(data.volume.by_bot)} by the bot · {formatCount(data.volume.automated)} campaign / automatic</p>
      </section>

      <section aria-label="People" className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Replies by person</caption>
          <thead className="bg-muted text-xs"><tr><th className="px-3 py-2">Person</th><th className="px-3 py-2 text-right">Messages sent</th><th className="px-3 py-2 text-right">Chats</th><th className="px-3 py-2 text-right">First replies</th><th className="px-3 py-2 text-right">Typical first reply</th></tr></thead>
          <tbody className="divide-y">
            {data.agents.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-xs text-muted-foreground">Nobody replied to a customer in this period.</td></tr>}
            {data.agents.map((a) => (
              <tr key={a.id}><td className="px-3 py-2 font-medium">{a.name}</td><td className="px-3 py-2 text-right tabular-nums">{formatCount(a.messages)}</td><td className="px-3 py-2 text-right tabular-nums">{formatCount(a.conversations)}</td><td className="px-3 py-2 text-right tabular-nums">{formatCount(a.first_replies)}</td><td className="px-3 py-2 text-right tabular-nums">{formatMinutes(a.median_minutes)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      {data.bot.length > 0 && (
        <section aria-label="Bot" className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold">Auto-reply bot</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {data.bot.map((b) => <li key={b.outcome} className="flex justify-between gap-2"><span>{BOT_OUTCOME_LABEL[b.outcome] ?? b.outcome}</span><span className="tabular-nums">{formatCount(b.n)}</span></li>)}
          </ul>
        </section>
      )}
    </div>
  )
}
