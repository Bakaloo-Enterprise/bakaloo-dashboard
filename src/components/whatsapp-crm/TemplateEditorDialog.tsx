"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ImageUploadField } from "./ImageUploadField"
import { uploadTemplateHeaderSample } from "@/services/whatsapp-crm.service"
import { templateFormErrors, useTemplate, useTemplateMutations } from "@/hooks/useWhatsappCrm"
import { cn, formatDateTime } from "@/lib/utils"
import type { MetaCategory, TemplateButtonInput, TemplateFormError, TemplateInput, WaTemplate } from "@/types/whatsapp-crm.types"
import { TemplateStatusChip } from "./TemplateStatusChip"
import { CATEGORY_HELP, detectVariables, EDITABLE_STATUSES, LANGUAGES, LIMITS, newButton, previewFromInput, renderTemplateText, STATUS_STYLE, suggestName } from "./template-helpers"

interface Props {
  open: boolean
  /** null = create a new template */
  templateId: string | null
  purposes: Array<{ key: string; label: string }>
  connected: boolean
  onClose: () => void
  onSaved?: (t: WaTemplate) => void
}

const EMPTY: TemplateInput = { name: "", language: "en", metaCategory: "UTILITY", purpose: "custom", headerText: "", bodyText: "", footerText: "", buttons: [], examples: {}, allowCategoryChange: true }

export function TemplateEditorDialog({ open, templateId, purposes, connected, onClose, onSaved }: Props) {
  const detail = useTemplate(open ? templateId : null)
  const m = useTemplateMutations()
  const [form, setForm] = useState<TemplateInput>(EMPTY)
  const [errors, setErrors] = useState<TemplateFormError[]>([])
  const [nameTouched, setNameTouched] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [sampleBusy, setSampleBusy] = useState(false)
  const [sampleError, setSampleError] = useState<string | null>(null)

  const tpl = detail.data?.template ?? null
  const editor = detail.data?.editor
  const locked = Boolean(tpl) && (!editor?.editable || !EDITABLE_STATUSES.has(tpl!.status))
  const submitted = Boolean(tpl?.meta_template_id)

  useEffect(() => {
    if (!open) return
    setErrors([])
    setNameTouched(false)
    setImageUrl(null)
    setSampleError(null)
    if (!templateId) return setForm(EMPTY)
    if (tpl && editor?.input) {
      setForm({ ...EMPTY, name: tpl.name, language: tpl.language, metaCategory: tpl.meta_category, purpose: tpl.purpose, allowCategoryChange: tpl.allow_category_change, ...editor.input, buttons: editor.input.buttons ?? [], examples: editor.input.examples ?? {} } as TemplateInput)
    }
  }, [open, templateId, tpl, editor])

  const vars = useMemo(() => {
    const urlTexts = (form.buttons ?? []).filter((b) => b.type === "URL").map((b) => b.url)
    return detectVariables(form.headerText, form.bodyText, ...urlTexts)
  }, [form.headerText, form.bodyText, form.buttons])

  const set = <K extends keyof TemplateInput>(k: K, v: TemplateInput[K]) => setForm((f) => ({ ...f, [k]: v }))
  const err = (field: string) => errors.filter((e) => e.field === field || e.field.startsWith(`${field}.`) || e.field.startsWith(`${field}[`))
  const buttons = form.buttons ?? []
  const setButton = (i: number, patch: Partial<TemplateButtonInput>) => set("buttons", buttons.map((b, n) => (n === i ? { ...b, ...patch } : b)))

  const headerKind: "NONE" | "TEXT" | "IMAGE" = form.headerFormat === "IMAGE" ? "IMAGE" : form.headerText ? "TEXT" : "NONE"
  const [headerMode, setHeaderMode] = useState<"NONE" | "TEXT" | "IMAGE" | null>(null)
  const mode = headerMode ?? headerKind
  const chooseHeader = (v: "NONE" | "TEXT" | "IMAGE") => {
    setHeaderMode(v)
    setSampleError(null)
    if (v === "IMAGE") setForm((f) => ({ ...f, headerText: "" }))
    else setForm((f) => ({ ...f, headerFormat: undefined, headerHandle: undefined, ...(v === "NONE" ? { headerText: "" } : {}) }))
    if (v !== "IMAGE") setImageUrl(null)
  }
  const onImageUploaded = async (url: string) => {
    setSampleBusy(true)
    setSampleError(null)
    try {
      const r = await uploadTemplateHeaderSample(url, "IMAGE")
      setImageUrl(url)
      setForm((f) => ({ ...f, headerFormat: "IMAGE", headerHandle: r.handle, headerText: "" }))
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setSampleError(msg ?? "Could not send the image to Meta. Check the App ID in WhatsApp settings and try again.")
    } finally {
      setSampleBusy(false)
    }
  }

  const payload = (): TemplateInput => ({
    ...form,
    // only send examples for variables that still exist in the text
    examples: Object.fromEntries(vars.map((v) => [v, form.examples?.[v] ?? ""])),
  })

  const save = async (andSubmit: boolean) => {
    setErrors([])
    try {
      let saved: WaTemplate
      if (templateId) saved = (await m.update.mutateAsync({ id: templateId, input: payload() })).template
      else saved = (await m.create.mutateAsync(payload())).template
      if (andSubmit && saved.status === "DRAFT") saved = await m.submit.mutateAsync(saved.id)
      onSaved?.(saved)
      onClose()
    } catch (e) {
      setErrors(templateFormErrors(e))
    }
  }

  const busy = m.create.isPending || m.update.isPending || m.submit.isPending
  const isDraftOrNew = !templateId || tpl?.status === "DRAFT"
  const preview = tpl && locked ? renderTemplateText(tpl, {}) : previewFromInput(payload())

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{!templateId ? "New template" : locked ? tpl?.name ?? "Template" : `Edit ${tpl?.name ?? "template"}`}</DialogTitle>
          <DialogDescription>
            {!templateId ? "Write the message once; Meta reviews it before it can be sent." : tpl ? <TemplateStatusChip t={tpl} /> : "Loading…"}
          </DialogDescription>
        </DialogHeader>

        {errors.length > 0 && (
          <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/30 dark:text-red-100">
            <p className="mb-1 flex items-center gap-1 font-medium"><AlertTriangle className="h-4 w-4" aria-hidden /> Please fix these before saving:</p>
            <ul className="list-disc pl-5">
              {errors.map((e, i) => (
                <li key={i}>{e.message}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-[1fr_300px]">
          <div className="space-y-4">
            {tpl && locked && (
              <div className="rounded-md bg-muted p-3 text-sm">
                {editor && !editor.editable ? editor.reason : `This template cannot be edited while its status is “${STATUS_STYLE[tpl.status].label}”. ${STATUS_STYLE[tpl.status].hint}`}
              </div>
            )}
            {tpl?.status === "REJECTED" && (tpl.rejection_reason || tpl.rejection_detail) && (
              <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/30 dark:text-red-100">
                <p className="font-medium">Why Meta rejected it{tpl.rejection_reason ? `: ${tpl.rejection_reason.replace(/_/g, " ").toLowerCase()}` : ""}</p>
                {tpl.rejection_detail && <p className="mt-1">{tpl.rejection_detail}</p>}
              </div>
            )}
            {tpl?.status === "APPROVED" && !locked && (
              <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                Saving sends your changes to Meta for re-review. Until it is approved again this template cannot be sent. Meta allows an approved template to be edited once a day.
              </p>
            )}

            <fieldset disabled={locked || busy} className="space-y-4 disabled:opacity-70">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="tpl-name">Name</Label>
                  <Input
                    id="tpl-name"
                    value={form.name}
                    onChange={(e) => { setNameTouched(true); set("name", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_")) }}
                    disabled={submitted}
                    placeholder="abandoned_cart_reminder"
                    maxLength={512}
                    aria-invalid={err("name").length > 0}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Lowercase letters, numbers and underscores. {submitted ? "The name cannot change once submitted." : ""}</p>
                  {err("name").map((e, i) => <p key={i} className="text-xs text-red-600">{e.message}</p>)}
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={form.purpose} onValueChange={(v) => { set("purpose", v); if (!templateId && !nameTouched) set("name", suggestName(purposes.find((p) => p.key === v)?.label ?? v)) }}>
                    <SelectTrigger aria-label="Template type"><SelectValue /></SelectTrigger>
                    <SelectContent>{purposes.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Language</Label>
                  <Select value={form.language} onValueChange={(v) => set("language", v)} disabled={submitted}>
                    <SelectTrigger aria-label="Language"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[...LANGUAGES, ...(LANGUAGES.some((l) => l.code === form.language) ? [] : [{ code: form.language, label: form.language }])].map((l) => (
                        <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Category (decides the price)</Label>
                  <Select value={form.metaCategory} onValueChange={(v) => set("metaCategory", v as MetaCategory)} disabled={tpl?.status === "APPROVED"}>
                    <SelectTrigger aria-label="Meta category"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTILITY">Utility</SelectItem>
                      <SelectItem value="MARKETING">Marketing</SelectItem>
                    </SelectContent>
                  </Select>
                  {(form.metaCategory === "UTILITY" || form.metaCategory === "MARKETING") && <p className="mt-1 text-xs text-muted-foreground">{CATEGORY_HELP[form.metaCategory]}</p>}
                </div>
              </div>

              <div>
                <Label>Header (optional)</Label>
                <div className="mt-1 flex gap-2" role="radiogroup" aria-label="Header type">
                  {([["NONE", "None"], ["TEXT", "Text"], ["IMAGE", "Image / banner"]] as const).map(([k, label]) => (
                    <Button key={k} type="button" size="sm" variant={mode === k ? "default" : "outline"} role="radio" aria-checked={mode === k} disabled={submitted && !isDraftOrNew} onClick={() => chooseHeader(k)}>{label}</Button>
                  ))}
                </div>
                {mode === "TEXT" && (
                  <>
                    <Input id="tpl-header" className="mt-2" value={form.headerText ?? ""} onChange={(e) => set("headerText", e.target.value)} maxLength={200} aria-label="Header text" />
                    <p className={cn("mt-1 text-xs", (form.headerText?.length ?? 0) > LIMITS.header ? "text-red-600" : "text-muted-foreground")}>{form.headerText?.length ?? 0}/{LIMITS.header}</p>
                  </>
                )}
                {mode === "IMAGE" && (
                  <div className="mt-2 space-y-2">
                    <ImageUploadField label={form.headerHandle ? "Replace sample image" : "Upload sample image"} onUploaded={onImageUploaded} />
                    <p className="text-xs text-muted-foreground">This is only a sample so Meta can approve the template once. Later, when you send it, you choose the real picture: the customer’s cart product, a product on offer, or your own banner. Use JPEG or PNG, up to 5 MB, wide shape (like 1200 × 628).</p>
                    {sampleBusy && <p className="text-xs text-muted-foreground">Sending the sample to Meta…</p>}
                    {form.headerHandle && !sampleBusy && <p className="text-xs text-emerald-700">Sample ready for Meta review.</p>}
                    {sampleError && <p role="alert" className="text-xs text-red-600">{sampleError}</p>}
                  </div>
                )}
                {err("headerText").map((e, i) => <p key={i} className="text-xs text-red-600">{e.message}</p>)}
                {err("headerFormat").map((e, i) => <p key={i} className="text-xs text-red-600">{e.message}</p>)}
              </div>

              <div>
                <Label htmlFor="tpl-body">Message</Label>
                <Textarea id="tpl-body" rows={6} value={form.bodyText} onChange={(e) => set("bodyText", e.target.value)} aria-invalid={err("bodyText").length > 0} />
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>Add personal details with {"{{customer_name}}"}, {"{{cart_value}}"}, {"{{order_number}}"}. Don’t start or end the message with one.</span>
                  <span className={cn((form.bodyText.length > LIMITS.body) && "text-red-600")}>{form.bodyText.length}/{LIMITS.body}</span>
                </div>
                {err("bodyText").map((e, i) => <p key={i} className="text-xs text-red-600">{e.message}</p>)}
              </div>

              <div>
                <Label htmlFor="tpl-footer">Footer (optional)</Label>
                <Input id="tpl-footer" value={form.footerText ?? ""} onChange={(e) => set("footerText", e.target.value)} maxLength={200} />
                <p className={cn("mt-1 text-xs", (form.footerText?.length ?? 0) > LIMITS.footer ? "text-red-600" : "text-muted-foreground")}>{form.footerText?.length ?? 0}/{LIMITS.footer}</p>
                {err("footerText").map((e, i) => <p key={i} className="text-xs text-red-600">{e.message}</p>)}
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label>Buttons (optional)</Label>
                  <div className="flex gap-1">
                    {(["QUICK_REPLY", "URL", "PHONE_NUMBER"] as const).map((t) => (
                      <Button key={t} type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => set("buttons", [...buttons, newButton(t)])} disabled={buttons.length >= 10}>
                        <Plus className="mr-1 h-3 w-3" /> {t === "QUICK_REPLY" ? "Quick reply" : t === "URL" ? "Link" : "Call"}
                      </Button>
                    ))}
                  </div>
                </div>
                <ul className="mt-2 space-y-2">
                  {buttons.map((b, i) => (
                    <li key={i} className="flex flex-wrap items-start gap-2 rounded-md border p-2">
                      <span className="mt-2 w-16 shrink-0 text-[11px] font-medium uppercase text-muted-foreground">{b.type === "QUICK_REPLY" ? "Reply" : b.type === "URL" ? "Link" : "Call"}</span>
                      <Input aria-label={`Button ${i + 1} label`} value={b.text} onChange={(e) => setButton(i, { text: e.target.value })} placeholder="Label" maxLength={40} className="w-40" />
                      {b.type === "URL" && <Input aria-label={`Button ${i + 1} link`} value={b.url ?? ""} onChange={(e) => setButton(i, { url: e.target.value })} placeholder="https://bakaloo.in/cart/{{cart_id}}" className="min-w-48 flex-1" />}
                      {b.type === "PHONE_NUMBER" && <Input aria-label={`Button ${i + 1} phone`} value={b.phoneNumber ?? ""} onChange={(e) => setButton(i, { phoneNumber: e.target.value })} placeholder="+919876543210" className="w-44" />}
                      <Button type="button" variant="ghost" size="icon" aria-label={`Remove button ${i + 1}`} onClick={() => set("buttons", buttons.filter((_, n) => n !== i))}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                      {err(`buttons[${i}]`).map((e, k) => <p key={k} className="w-full text-xs text-red-600">{e.message}</p>)}
                    </li>
                  ))}
                </ul>
                {err("buttons").map((e, i) => <p key={i} className="text-xs text-red-600">{e.message}</p>)}
              </div>

              {vars.length > 0 && (
                <div>
                  <Label>Example for each variable</Label>
                  <p className="mb-2 text-xs text-muted-foreground">Meta needs a sample value to review the template. It is never sent to customers.</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {vars.map((v) => (
                      <div key={v}>
                        <Label htmlFor={`ex-${v}`} className="font-mono text-xs">{`{{${v}}}`}</Label>
                        <Input id={`ex-${v}`} value={form.examples?.[v] ?? ""} onChange={(e) => set("examples", { ...form.examples, [v]: e.target.value })} placeholder="e.g. Rahul" maxLength={200} />
                        {err(`examples.${v}`).map((e, i) => <p key={i} className="text-xs text-red-600">{e.message}</p>)}
                      </div>
                    ))}
                  </div>
                  {err("variables").map((e, i) => <p key={i} className="text-xs text-red-600">{e.message}</p>)}
                </div>
              )}

              {isDraftOrNew && (
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1" checked={form.allowCategoryChange !== false} onChange={(e) => set("allowCategoryChange", e.target.checked)} />
                  <span>Let Meta change the category if it disagrees. <span className="text-muted-foreground">(Otherwise it may be rejected. A change to Marketing makes each message cost more.)</span></span>
                </label>
              )}
            </fieldset>
          </div>

          <aside className="space-y-3" aria-label="Preview">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">What the customer sees</h4>
            <div className="rounded-xl bg-[#e7f3ec] p-3 dark:bg-emerald-950/40">
              <div className="whitespace-pre-wrap rounded-lg bg-white p-3 text-sm shadow-sm dark:bg-card" data-testid="template-preview">
                {imageUrl && mode === "IMAGE" && /* eslint-disable-next-line @next/next/no-img-element */ <img src={imageUrl} alt="Header sample" className="mb-2 w-full rounded-md object-cover" />}
                {preview || "Your message appears here"}
              </div>
            </div>
            {tpl && detail.data && detail.data.events.length > 0 && (
              <div>
                <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">History</h4>
                <ul className="space-y-1 text-xs">
                  {detail.data.events.slice(0, 8).map((e) => (
                    <li key={e.id}><span className="font-medium">{e.event.replace(/_/g, " ").toLowerCase()}</span>{e.detail ? ` — ${e.detail}` : ""} <span className="text-muted-foreground">{formatDateTime(e.created_at)}</span></li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>{locked ? "Close" : "Cancel"}</Button>
          {!locked && (
            <>
              <Button variant="outline" disabled={busy} onClick={() => save(false)}>{busy ? "Saving…" : templateId && !isDraftOrNew ? "Save and send to Meta" : "Save draft"}</Button>
              {isDraftOrNew && (
                <Button disabled={busy || !connected} onClick={() => save(true)} title={connected ? "" : "Connect WhatsApp first (server settings)"}>
                  Save and submit to Meta
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
