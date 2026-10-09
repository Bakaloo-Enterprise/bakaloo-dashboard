"use client"

import { useEffect, useMemo, useState } from "react"
import { FileText, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ImageUploadField } from "./ImageUploadField"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useSendTemplate, useTemplates, useTemplateValues } from "@/hooks/useWhatsappCrm"
import { cn } from "@/lib/utils"
import type { MarketingConsent, WaTemplate } from "@/types/whatsapp-crm.types"
import { TemplateStatusChip } from "./TemplateStatusChip"
import { renderTemplateText, sendBlockReason, sendVariables } from "./template-helpers"

interface Props {
  conversationId: string
  consent: MarketingConsent
  windowOpen: boolean
  /** The server will refuse otherwise; hiding the button is just politeness. */
  canSend: boolean
}

const MEDIA_HEADERS = new Set(["IMAGE", "VIDEO", "DOCUMENT"])

/** Pick an APPROVED template, fill it in (customer details are pre-filled), preview, send. */
export function SendTemplateDialog({ conversationId, consent, windowOpen, canSend }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [mediaUrl, setMediaUrl] = useState("")

  const list = useTemplates({ status: "APPROVED", search: search || undefined }, open)
  const known = useTemplateValues(conversationId, open)
  const send = useSendTemplate(conversationId)

  const templates = (list.data?.templates ?? []).filter((t) => t.name !== "hello_world") // Meta sample: only sendable from Meta test numbers
  const selected = templates.find((t) => t.id === selectedId) ?? null
  const vars = useMemo(() => (selected ? sendVariables(selected) : []), [selected])

  // Pre-fill from what we know about this customer, without overwriting what staff already typed.
  useEffect(() => {
    if (!selected || !known.data) return
    setValues((prev) => {
      const next = { ...prev }
      for (const v of vars) if (!next[v.key as string] && known.data[v.name]) next[v.key as string] = known.data[v.name]
      return next
    })
  }, [selected, known.data, vars])

  useEffect(() => {
    if (!open) {
      setSearch("")
      setSelectedId(null)
      setValues({})
      setMediaUrl("")
    }
  }, [open])

  if (!canSend) return null

  const blocked = selected ? sendBlockReason(selected) : null
  const optedOut = selected?.meta_category === "MARKETING" && consent === "OPTED_OUT"
  const needsMedia = Boolean(selected && MEDIA_HEADERS.has(selected.header_format ?? ""))
  const missing = vars.filter((v) => !values[v.key as string]?.trim())
  const ready = Boolean(selected) && !blocked && !optedOut && missing.length === 0 && (!needsMedia || /^https:\/\/\S+$/.test(mediaUrl.trim()))

  const choose = (t: WaTemplate) => {
    setSelectedId(t.id)
    setValues({})
    setMediaUrl(t.default_header_url ?? "")
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={windowOpen ? "outline" : "default"} size="sm" className="h-9" aria-label="Send a template message">
          <FileText className="mr-1 h-4 w-4" /> Template
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send a template message</DialogTitle>
          <DialogDescription>Only templates approved by Meta are listed. Templates work even after the 24-hour reply window has closed.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-[240px_1fr]">
          <div>
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates" className="pl-8" aria-label="Search approved templates" />
            </div>
            <ul className="max-h-80 space-y-1 overflow-y-auto" aria-label="Approved templates">
              {list.isLoading && <li className="p-2 text-sm text-muted-foreground">Loading…</li>}
              {!list.isLoading && templates.length === 0 && <li className="p-2 text-sm text-muted-foreground">No approved templates yet. Create one on the Templates page and wait for Meta’s approval.</li>}
              {templates.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => choose(t)}
                    aria-pressed={selectedId === t.id}
                    className={cn("w-full rounded-md border px-2 py-1.5 text-left text-sm hover:bg-muted", selectedId === t.id && "border-primary bg-muted")}
                  >
                    <span className="block truncate font-medium">{t.name}</span>
                    <span className="text-[11px] text-muted-foreground">{t.meta_category.toLowerCase()} · {t.language}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            {!selected && <p className="text-sm text-muted-foreground">Choose a template on the left.</p>}
            {selected && (
              <>
                <TemplateStatusChip t={selected} />
                {blocked && <p role="alert" className="rounded-md bg-red-50 p-2 text-sm text-red-900">{blocked}</p>}
                {optedOut && <p role="alert" className="rounded-md bg-red-50 p-2 text-sm text-red-900">This customer opted out of marketing messages, so a marketing template can’t be sent.</p>}

                {vars.map((v) => (
                  <div key={v.key}>
                    <Label htmlFor={`tv-${v.key}`} className="font-mono text-xs">{`{{${v.name}}}`}</Label>
                    <Input id={`tv-${v.key}`} value={values[v.key as string] ?? ""} onChange={(e) => setValues((p) => ({ ...p, [v.key as string]: e.target.value }))} placeholder={v.example || ""} maxLength={1000} />
                  </div>
                ))}
                {needsMedia && (
                  <div>
                    <Label htmlFor="tv-media">{selected.header_format?.toLowerCase()} link (https://)</Label>
                    <Input id="tv-media" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://…" />
                    {selected.header_format === "IMAGE" && <div className="mt-2"><ImageUploadField label="Upload product image / banner" onUploaded={setMediaUrl} /></div>}
                    {selected.header_format === "IMAGE" && /^https:\/\//.test(mediaUrl) && /* eslint-disable-next-line @next/next/no-img-element */ <img src={mediaUrl} alt="Selected header" className="mt-2 max-h-40 rounded-md" />}
                  </div>
                )}

                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Preview</h4>
                  <div className="rounded-xl bg-[#e7f3ec] p-3 dark:bg-emerald-950/40">
                    <div className="whitespace-pre-wrap rounded-lg bg-white p-3 text-sm shadow-sm dark:bg-card" data-testid="send-preview">{renderTemplateText(selected, values)}</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            disabled={!ready || send.isPending}
            onClick={() => selected && send.mutate({ templateId: selected.id, values, headerMediaUrl: needsMedia ? mediaUrl.trim() : undefined }, { onSuccess: () => setOpen(false) })}
          >
            {send.isPending ? "Sending…" : "Send template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
