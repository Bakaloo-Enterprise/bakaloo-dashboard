"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCampaignOptions, useLabels, useTemplates } from "@/hooks/useWhatsappCrm"
import type { AudienceType, Campaign, CampaignInput } from "@/types/whatsapp-crm.types"
import { renderTemplateText, sendVariables } from "./template-helpers"

interface Props {
  open: boolean
  campaign: Campaign | null
  saving: boolean
  onClose: () => void
  onSave: (input: CampaignInput) => void
}

const AUDIENCE_LABEL: Record<AudienceType, string> = {
  SEGMENT: "Customer segments",
  LABEL: "WhatsApp labels",
  STAGE: "Pipeline stages",
  IMPORT: "Prospect lists",
  ALL_OPTED_IN: "Everyone who opted in",
}

const RATES = [
  { v: 20, label: "Gentle — 20 per minute" },
  { v: 60, label: "Normal — 60 per minute" },
  { v: 200, label: "Fast — 200 per minute" },
]

/** Build or edit a DRAFT campaign: template, who gets it, values, speed. Sending is a separate, deliberate step. */
export function CampaignDialog({ open, campaign, saving, onClose, onSave }: Props) {
  const [name, setName] = useState("")
  const [templateId, setTemplateId] = useState("")
  const [type, setType] = useState<AudienceType>("SEGMENT")
  const [ids, setIds] = useState<string[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [rate, setRate] = useState(60)
  const [mediaUrl, setMediaUrl] = useState("")

  const templates = useTemplates({ status: "APPROVED" }, open)
  const options = useCampaignOptions(open)
  const labels = useLabels()

  useEffect(() => {
    if (!open) return
    setName(campaign?.name ?? "")
    setTemplateId(campaign?.template_id ?? "")
    setType(campaign?.audience.type ?? "SEGMENT")
    setIds(campaign?.audience.ids ?? [])
    setValues(campaign?.template_values ?? {})
    setRate(campaign?.rate_per_minute ?? 60)
    setMediaUrl(campaign?.header_media_url ?? "")
  }, [open, campaign])

  const approved = templates.data?.templates ?? []
  const tpl = approved.find((t) => t.id === templateId)
  // customer_name is filled automatically per customer; anything else must be typed once here.
  const vars = useMemo(() => (tpl ? sendVariables(tpl).filter((v) => (v.key ?? v.name) !== "customer_name") : []), [tpl])
  const needsMedia = Boolean(tpl && ["IMAGE", "VIDEO", "DOCUMENT"].includes(tpl.header_format ?? ""))

  const choices: Array<{ id: string; name: string; hint?: string }> =
    type === "SEGMENT" ? (options.data?.segments ?? []).map((s) => ({ id: s.id, name: s.name, hint: `${s.members} customers` }))
    : type === "STAGE" ? (options.data?.stages ?? []).map((s) => ({ id: s.id, name: s.name }))
    : type === "IMPORT" ? (options.data?.imports ?? []).map((i) => ({ id: i.id, name: i.name, hint: `${i.members} prospects` }))
    : type === "LABEL" ? (labels.data ?? []).map((l) => ({ id: l.id, name: l.name, hint: `${l.customer_count} customers` }))
    : []

  const toggle = (id: string) => setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 20 ? cur : [...cur, id]))
  const missingValue = vars.some((v) => !values[v.key ?? v.name]?.trim())
  const audienceOk = type === "ALL_OPTED_IN" || ids.length > 0
  const valid = name.trim() && templateId && audienceOk && !missingValue && (!needsMedia || /^https:\/\/\S+$/.test(mediaUrl.trim()))

  const submit = () => {
    const typed: Record<string, string> = {}
    for (const v of vars) typed[v.key ?? v.name] = values[v.key ?? v.name] ?? ""
    onSave({
      name: name.trim(),
      templateId,
      audience: { type, ids: type === "ALL_OPTED_IN" ? [] : ids },
      templateValues: typed,
      ratePerMinute: rate,
      ...(needsMedia ? { headerMediaUrl: mediaUrl.trim() } : {}),
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{campaign ? "Edit campaign" : "New campaign"}</DialogTitle>
          <DialogDescription>Saved as a draft first. Nothing is sent until you launch it.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="c-name">Campaign name</Label>
            <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="e.g. Diwali offer — repeat customers" className="mt-1" />
          </div>

          <div>
            <Label htmlFor="c-tpl">Message template</Label>
            <select id="c-tpl" className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm" value={templateId} onChange={(e) => { setTemplateId(e.target.value); setValues({}) }}>
              <option value="">Choose an approved template…</option>
              {approved.map((t) => (
                <option key={t.id} value={t.id}>{t.name} · {t.meta_category.toLowerCase()}</option>
              ))}
            </select>
            {!templates.isLoading && approved.length === 0 && <p className="mt-1 text-xs text-amber-700">No approved templates yet. Create one in Templates and wait for Meta’s approval.</p>}
            {tpl && <p className="mt-2 whitespace-pre-line rounded-md bg-emerald-50 p-2 text-xs dark:bg-emerald-950/30">{renderTemplateText(tpl, { customer_name: "Priya", ...values })}</p>}
          </div>

          {vars.length > 0 && (
            <div className="space-y-2" aria-label="Template values">
              <p className="text-xs text-muted-foreground">{"The customer’s name is filled in automatically. Fill in the rest once — everyone gets the same."}</p>
              {vars.map((v) => (
                <div key={v.key ?? v.name}>
                  <Label htmlFor={`v-${v.name}`} className="text-xs">{v.name.replace(/_/g, " ")}</Label>
                  <Input id={`v-${v.name}`} value={values[v.key ?? v.name] ?? ""} onChange={(e) => setValues((cur) => ({ ...cur, [v.key ?? v.name]: e.target.value }))} placeholder={v.example} maxLength={500} className="mt-0.5" />
                </div>
              ))}
            </div>
          )}

          {needsMedia && (
            <div>
              <Label htmlFor="c-media">Link to the {tpl?.header_format?.toLowerCase()} (https://)</Label>
              <Input id="c-media" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} className="mt-1" />
            </div>
          )}

          <fieldset>
            <legend className="text-sm font-medium">Who receives it</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {(Object.keys(AUDIENCE_LABEL) as AudienceType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setType(t); setIds([]) }}
                  aria-pressed={type === t}
                  className={`rounded-full border px-3 py-1 text-xs ${type === t ? "border-primary bg-primary/10 font-semibold" : "hover:bg-muted"}`}
                >
                  {AUDIENCE_LABEL[t]}
                </button>
              ))}
            </div>
            {type !== "ALL_OPTED_IN" ? (
              <ul className="mt-2 max-h-40 divide-y overflow-y-auto rounded-md border text-sm">
                {choices.length === 0 && <li className="p-2 text-xs text-muted-foreground">Nothing to choose yet.</li>}
                {choices.map((c) => (
                  <li key={c.id}>
                    <label className="flex cursor-pointer items-center gap-2 px-2 py-1.5 hover:bg-muted/50">
                      <input type="checkbox" checked={ids.includes(c.id)} onChange={() => toggle(c.id)} />
                      <span className="flex-1">{c.name}</span>
                      {c.hint && <span className="text-xs text-muted-foreground">{c.hint}</span>}
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Every WhatsApp contact with a recorded opt-in.</p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">Only people who have opted in will get the message. Others are skipped, and you’ll see exactly how many before you launch.</p>
          </fieldset>

          <div>
            <Label htmlFor="c-rate">Sending speed</Label>
            <select id="c-rate" className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm" value={rate} onChange={(e) => setRate(Number(e.target.value))}>
              {RATES.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
              {!RATES.some((r) => r.v === rate) && <option value={rate}>{rate} per minute</option>}
            </select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!valid || saving} onClick={submit}>{saving ? "Saving…" : "Save draft"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
