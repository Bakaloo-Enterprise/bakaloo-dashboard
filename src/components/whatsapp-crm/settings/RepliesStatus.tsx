"use client"

import { AlertTriangle, CheckCircle2, Circle, Loader2, MessageSquareReply, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { WaConnectRepliesResult, WaSettingsView } from "@/types/whatsapp-settings.types"
import { formatWhen } from "./settings-helpers"

interface Props {
  view: WaSettingsView
  busy: boolean
  result: WaConnectRepliesResult | null
  onConnect: () => void
}

/**
 * "Connected" only means we can SEND. Customer replies reach the inbox only when Meta is also set up to send them to us
 * and we can check what it sends. This says plainly which of those is missing, and connects them in one click.
 */
export function RepliesStatus({ view, busy, result, onConnect }: Props) {
  const f = view.fields
  const items = [
    { ok: Boolean(f.appSecret.configured), label: "App Secret saved", why: "Meta signs every reply with it. With none saved we refuse every reply, so nothing reaches the inbox." },
    { ok: Boolean(f.appId.value), label: "App ID saved", why: "Needed so we can tell Meta where to send replies." },
    { ok: Boolean(f.verifyToken.configured), label: "Verify token saved", why: "The word Meta uses to confirm the webhook address is really ours." },
    { ok: Boolean(view.webhook.lastReceivedAt), label: "A message from Meta has arrived", why: "Reply to your business number from a phone, then check again." },
  ]
  const detailsReady = items[0].ok && items[1].ok && items[2].ok && Boolean(f.wabaId.value) && Boolean(f.accessToken.configured)
  const working = items.every((i) => i.ok)

  if (working) {
    return (
      <section aria-label="Customer replies" className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-900">
        <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
        <p><strong>Customer replies are working.</strong> Last message from Meta: {formatWhen(view.webhook.lastReceivedAt as string)} · {view.webhook.last7d} in the last 7 days.</p>
      </section>
    )
  }

  return (
    <section aria-label="Customer replies" className="space-y-4 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950">
      <header className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800"><MessageSquareReply className="h-5 w-5" aria-hidden /></span>
        <div>
          <h2 className="text-base font-semibold">Customer replies are not reaching your inbox yet</h2>
          <p className="text-sm text-amber-900/90">“Connected” means we can <em>send</em>. To <em>receive</em> replies, finish the steps below.</p>
        </div>
      </header>

      <ul className="space-y-2">
        {items.map((i) => (
          <li key={i.label} className="flex items-start gap-2 text-sm">
            {i.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-label="Done" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-label="Not done" />}
            <span><strong className={i.ok ? "font-medium" : ""}>{i.label}</strong>{!i.ok && <span className="text-amber-900/85"> — {i.why}</span>}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={onConnect} disabled={!detailsReady || busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
          {busy ? "Connecting…" : "Connect replies automatically"}
        </Button>
        <p className="text-xs text-amber-900/85">
          {detailsReady
            ? "Tells Meta to send replies to this server and subscribes to customer messages."
            : "First paste the App ID and App Secret above (Meta → App settings → Basic) and press “Save only”."}
        </p>
      </div>

      {result && (
        <div role="status" className="space-y-2 rounded-xl border bg-white/70 p-3 text-sm text-foreground">
          <p className="font-medium">{result.ok ? "Done. Now send a WhatsApp message to your business number to check." : "Meta did not accept everything:"}</p>
          <ul className="space-y-2">
            {result.steps.map((s) => (
              <li key={s.id} className="flex items-start gap-2">
                {s.status === "pass" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-label="Done" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-label="Failed" />}
                <div>
                  <p>{s.label}{s.status === "fail" && s.summary ? <span className="text-red-700"> — {s.summary}</span> : null}</p>
                  {s.problem && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      <p>{s.problem.cause}</p>
                      <ul className="mt-1 list-disc pl-4">{s.problem.fixes.map((fx) => <li key={fx}>{fx}</li>)}</ul>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!result && !detailsReady && <p className="flex items-center gap-1.5 text-xs text-amber-900/80"><AlertTriangle className="h-3.5 w-3.5" aria-hidden />Sending test messages works without these; only receiving needs them.</p>}
    </section>
  )
}
