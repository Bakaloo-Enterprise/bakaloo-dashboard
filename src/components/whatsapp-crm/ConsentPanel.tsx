"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useConsentMutations, useSuppressed } from "@/hooks/useWhatsappCrm"
import { formatRelativeTime } from "@/lib/utils"
import type { ConsentResult } from "@/types/whatsapp-crm.types"
import { parsePhones } from "./campaign-helpers"

/** Record opt-ins you collected elsewhere (e.g. a checkout checkbox) and manage the do-not-contact list. */
export function ConsentPanel() {
  const [text, setText] = useState("")
  const [source, setSource] = useState("")
  const [confirm, setConfirm] = useState(false)
  const [result, setResult] = useState<ConsentResult | null>(null)
  const m = useConsentMutations()
  const suppressed = useSuppressed()

  const phones = parsePhones(text)
  const ready = phones.length > 0 && phones.length <= 5000 && source.trim().length >= 3 && confirm

  return (
    <section className="grid gap-4 md:grid-cols-2" aria-label="Consent and do-not-contact">
      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-semibold">Record opt-ins</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Campaigns only reach people who agreed to WhatsApp messages. If you collected that agreement elsewhere (a checkout checkbox, a signed form), paste their numbers here. Customers who reply STOP are never overridden.
        </p>
        <Label htmlFor="consent-phones" className="mt-3 block text-xs">Phone numbers (10-digit, one per line or separated by commas)</Label>
        <Textarea id="consent-phones" rows={4} value={text} onChange={(e) => { setText(e.target.value); setResult(null) }} className="mt-1" />
        <p className="mt-0.5 text-[11px] text-muted-foreground">{phones.length} number{phones.length === 1 ? "" : "s"}{phones.length > 5000 ? " — at most 5000 at a time" : ""}</p>
        <Label htmlFor="consent-source" className="mt-3 block text-xs">Where did they agree?</Label>
        <Input id="consent-source" value={source} onChange={(e) => setSource(e.target.value)} maxLength={40} placeholder="e.g. checkout checkbox" className="mt-1" />
        <label className="mt-3 flex items-start gap-2 text-xs">
          <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5" />
          <span>I confirm these customers agreed to receive WhatsApp messages from Bakaloo.</span>
        </label>
        <Button className="mt-3" size="sm" disabled={!ready || m.record.isPending} onClick={() => m.record.mutate({ phones, source: source.trim(), confirm }, { onSuccess: (r) => { setResult(r); setText("") } })}>
          {m.record.isPending ? "Saving…" : "Record opt-in"}
        </Button>
        {result && (
          <p role="status" className="mt-2 text-xs">
            Recorded <strong>{result.recorded}</strong>.{result.invalidCount > 0 && <> {result.invalidCount} not valid Indian mobile numbers: {result.invalid.join(", ")}{result.invalidCount > result.invalid.length ? "…" : ""}</>}
          </p>
        )}
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-semibold">Do-not-contact list</h3>
        <p className="mt-1 text-xs text-muted-foreground">People here get no campaign or automatic message, even if they once opted in. Add someone from their chat’s customer panel.</p>
        <ul className="mt-3 max-h-64 divide-y overflow-y-auto rounded-md border text-sm">
          {(suppressed.data ?? []).length === 0 && <li className="p-2 text-xs text-muted-foreground">No one on the list.</li>}
          {(suppressed.data ?? []).map((s) => (
            <li key={s.contact_id} className="flex items-center justify-between gap-2 px-2 py-1.5">
              <span className="min-w-0 truncate">{s.name ?? "Unknown"} <span className="text-xs text-muted-foreground">{s.phone ?? ""}</span>{s.reason && <span className="block truncate text-xs text-muted-foreground">{s.reason} · {formatRelativeTime(s.created_at)}</span>}</span>
              <Button variant="ghost" size="sm" disabled={m.unsuppress.isPending} onClick={() => m.unsuppress.mutate(s.contact_id)}>Remove</Button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
