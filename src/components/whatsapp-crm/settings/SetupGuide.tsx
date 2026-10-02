"use client"

import { ExternalLink } from "lucide-react"

const STEPS: Array<{ title: string; body: React.ReactNode }> = [
  { title: "Create a Meta app", body: <>Go to <a className="underline" href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">developers.facebook.com/apps</a> → Create app → type <strong>Business</strong> → add the <strong>WhatsApp</strong> product.</> },
  { title: "Copy the IDs", body: <>Open <strong>WhatsApp → API Setup</strong>. Copy the <strong>Phone number ID</strong> and the <strong>WhatsApp Business Account ID</strong> shown there.</> },
  { title: "Create a permanent access token", body: <>The token on the API Setup page lasts only 24 hours. In <strong>Business Settings → Users → System users</strong>, add a system user (Admin), assign your WhatsApp account with full control, then <strong>Generate token</strong> with <em>whatsapp_business_messaging</em> and <em>whatsapp_business_management</em>, expiry “Never”.</> },
  { title: "Copy the App Secret and App ID", body: <>Meta → <strong>App settings → Basic</strong>. Show and copy the <strong>App secret</strong> and the <strong>App ID</strong>.</> },
  { title: "Save & test here", body: <>Paste everything above, press <strong>Save & test connection</strong>. If Meta answers, WhatsApp connects automatically; if not, you will see exactly what to fix.</> },
  { title: "Connect the webhook", body: <>Paste the Callback URL and Verify token (from the Webhook card) into Meta → <strong>WhatsApp → Configuration</strong> and subscribe to <strong>messages</strong>.</> },
]

export function SetupGuide() {
  return (
    <details className="rounded-2xl border bg-card p-5 shadow-sm">
      <summary className="flex cursor-pointer items-center justify-between text-base font-semibold">
        Where do I find these values in Meta?
        <a className="inline-flex items-center gap-1 text-xs font-medium text-primary" href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Meta’s guide<ExternalLink className="h-3 w-3" aria-hidden /></a>
      </summary>
      <ol className="mt-4 space-y-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-3 text-sm">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-800">{i + 1}</span>
            <div><p className="font-medium">{s.title}</p><p className="text-muted-foreground">{s.body}</p></div>
          </li>
        ))}
      </ol>
    </details>
  )
}
