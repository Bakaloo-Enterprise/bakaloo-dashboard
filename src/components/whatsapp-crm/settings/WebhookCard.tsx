"use client"

import { Copy, Webhook } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import type { WaSettingsView } from "@/types/whatsapp-settings.types"
import { copyToClipboard, formatWhen } from "./settings-helpers"

function CopyRow({ label, value, mono = true }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <code className={`flex-1 truncate rounded-md bg-muted px-2.5 py-1.5 text-xs ${mono ? "font-mono" : ""}`}>{value || "— not set yet —"}</code>
        <Button type="button" size="icon" variant="outline" className="h-8 w-8" disabled={!value} aria-label={`Copy ${label}`} onClick={async () => { const ok = await copyToClipboard(value ?? ""); toast[ok ? "success" : "error"](ok ? `${label} copied` : "Could not copy") }}><Copy className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  )
}

/** What to paste into Meta so customer replies and delivery ticks reach us. */
export function WebhookCard({ view }: { view: WaSettingsView }) {
  const last = view.webhook.lastReceivedAt
  return (
    <section aria-label="Webhook" className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
      <header className="flex items-start gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-700"><Webhook className="h-5 w-5" aria-hidden /></span>
        <div>
          <h2 className="text-base font-semibold">Receive replies (webhook)</h2>
          <p className="text-sm text-muted-foreground">So customer replies and “delivered / read” ticks show up in your inbox.</p>
        </div>
      </header>
      <CopyRow label="Callback URL" value={view.webhook.callbackUrl} />
      <CopyRow label="Verify token" value={view.fields.verifyToken.value} />
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Meta → your app → <strong>WhatsApp → Configuration</strong> → Webhook → <strong>Edit</strong>.</li>
        <li>Paste the Callback URL and the Verify token above, then <strong>Verify and save</strong>.</li>
        <li>Under Webhook fields, <strong>Subscribe</strong> to <strong>messages</strong> (and message_template_status_update).</li>
        <li>Send a WhatsApp message to your business number — it should appear in the inbox.</li>
      </ol>
      <p role="status" className={`rounded-lg px-3 py-2 text-sm ${last ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
        {last ? `Last event from Meta: ${formatWhen(last)} · ${view.webhook.last7d} in the last 7 days.` : "Nothing received from Meta yet."}
      </p>
    </section>
  )
}
