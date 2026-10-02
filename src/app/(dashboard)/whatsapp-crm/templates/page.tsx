"use client"

import { useState } from "react"
import { Pencil, Plus, RefreshCw, Search, Send, Trash2 } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { Forbidden } from "@/components/shared/forbidden"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TemplateEditorDialog } from "@/components/whatsapp-crm/TemplateEditorDialog"
import { TemplateStatusChip } from "@/components/whatsapp-crm/TemplateStatusChip"
import { STATUS_STYLE } from "@/components/whatsapp-crm/template-helpers"
import { useDebounce } from "@/hooks/useDebounce"
import { useCrmMe, useCrmStatus, useTemplateMutations, useTemplates } from "@/hooks/useWhatsappCrm"
import { cn, formatRelativeTime } from "@/lib/utils"
import type { MetaCategory, TemplateStatus, WaTemplate } from "@/types/whatsapp-crm.types"

const ANY = "__any__"
const STATUS_TABS: Array<TemplateStatus | undefined> = [undefined, "APPROVED", "PENDING", "REJECTED", "DRAFT", "PAUSED"]

export default function TemplatesPage() {
  const me = useCrmMe()
  const allowed = me.can("crm.templates.view")
  const canManage = me.can("crm.templates.manage")
  const crm = useCrmStatus()
  const connected = Boolean(crm.data?.templatesReady)

  const [status, setStatus] = useState<TemplateStatus | undefined>(undefined)
  const [category, setCategory] = useState<MetaCategory | "">("")
  const [purpose, setPurpose] = useState("")
  const [search, setSearch] = useState("")
  const debounced = useDebounce(search, 300)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const list = useTemplates({ status, metaCategory: category || undefined, purpose: purpose || undefined, search: debounced || undefined }, allowed)
  const m = useTemplateMutations()

  if (me.isLoading) return <Skeleton className="h-40 w-full" />
  if (!allowed) return <Forbidden />

  const data = list.data
  const purposes = data?.purposes ?? []
  const labelOf = (k: string) => purposes.find((p) => p.key === k)?.label ?? k
  const counts = data?.counts ?? {}
  const total = Object.values(counts).reduce((n, c) => n + (c ?? 0), 0)

  const open = (t: WaTemplate | null) => {
    setEditingId(t?.id ?? null)
    setEditorOpen(true)
  }
  const confirmSubmit = (t: WaTemplate) => {
    if (window.confirm(`Send “${t.name}” to Meta for review?\n\nWhile Meta reviews it you won’t be able to edit it.`)) m.submit.mutate(t.id)
  }
  const confirmDelete = (t: WaTemplate) => {
    const msg =
      t.status === "DRAFT"
        ? `Delete the draft “${t.name}”?`
        : `Delete “${t.name}” at Meta too?\n\n${t.status === "APPROVED" ? "Meta will keep this name reserved for 30 days, so you cannot create a template with the same name until then.\n\n" : ""}Messages already sent are not affected.`
    if (window.confirm(msg)) m.remove.mutate(t.id)
  }

  return (
    <div className="space-y-4">
      <PageHeader title="WhatsApp Templates" subtitle="Messages Meta has approved, so you can write to customers even after the 24-hour reply window closes." />

      {crm.data && !connected && (
        <div role="status" className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          WhatsApp is not connected yet (the WhatsApp Business Account id and access token are missing on the server). You can write drafts now; submitting to Meta, syncing and sending start working once it is connected.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Template status">
          {STATUS_TABS.map((s) => {
            const n = s ? counts[s] ?? 0 : total
            return (
              <button
                key={s ?? "all"}
                role="tab"
                aria-selected={status === s}
                onClick={() => setStatus(s)}
                className={cn("rounded-full px-3 py-1 text-xs font-medium transition-colors", status === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70")}
              >
                {s ? STATUS_STYLE[s].label : "All"} <span className="opacity-70">{n}</span>
              </button>
            )
          })}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {data?.lastSyncedAt && <span className="text-xs text-muted-foreground">Synced {formatRelativeTime(data.lastSyncedAt)}</span>}
          {canManage && (
            <>
              <Button variant="outline" size="sm" disabled={!connected || m.sync.isPending} onClick={() => m.sync.mutate()} title={connected ? "" : "Connect WhatsApp first"}>
                <RefreshCw className={cn("mr-1 h-4 w-4", m.sync.isPending && "animate-spin")} /> Sync with Meta
              </Button>
              <Button size="sm" onClick={() => open(null)}><Plus className="mr-1 h-4 w-4" /> New template</Button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or text" className="pl-8" aria-label="Search templates" />
        </div>
        <Select value={category || ANY} onValueChange={(v) => setCategory(v === ANY ? "" : (v as MetaCategory))}>
          <SelectTrigger className="h-9 w-36 text-xs" aria-label="Filter by category"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any category</SelectItem>
            <SelectItem value="MARKETING">Marketing</SelectItem>
            <SelectItem value="UTILITY">Utility</SelectItem>
            <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
          </SelectContent>
        </Select>
        <Select value={purpose || ANY} onValueChange={(v) => setPurpose(v === ANY ? "" : v)}>
          <SelectTrigger className="h-9 w-44 text-xs" aria-label="Filter by type"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any type</SelectItem>
            {purposes.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Language</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-36 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading && (
              <TableRow><TableCell colSpan={6}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
            )}
            {!list.isLoading && (data?.templates.length ?? 0) === 0 && (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">No templates match. {canManage ? "Create one, or use “Sync with Meta” to bring in the ones you already have." : ""}</TableCell></TableRow>
            )}
            {data?.templates.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <button className="text-left" onClick={() => open(t)}>
                    <span className="block text-sm font-medium">{t.name}</span>
                    <span className="block text-xs text-muted-foreground">{labelOf(t.purpose)}</span>
                    <span className="mt-0.5 line-clamp-1 block max-w-xs text-xs text-muted-foreground">{t.body_text}</span>
                  </button>
                </TableCell>
                <TableCell className="text-sm capitalize">{t.meta_category.toLowerCase()}</TableCell>
                <TableCell className="text-sm">{t.language}</TableCell>
                <TableCell>
                  <TemplateStatusChip t={t} />
                  {t.status === "REJECTED" && t.rejection_reason && <p className="mt-0.5 text-[11px] text-red-700">{t.rejection_reason.replace(/_/g, " ").toLowerCase()}</p>}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatRelativeTime(t.updated_at)}</TableCell>
                <TableCell className="text-right">
                  {canManage && t.status === "DRAFT" && (
                    <Button variant="ghost" size="icon" aria-label={`Submit ${t.name} to Meta`} disabled={!connected || m.submit.isPending} title={connected ? "Submit to Meta" : "Connect WhatsApp first"} onClick={() => confirmSubmit(t)}><Send className="h-4 w-4" /></Button>
                  )}
                  <Button variant="ghost" size="icon" aria-label={`${canManage ? "Open" : "View"} ${t.name}`} onClick={() => open(t)}><Pencil className="h-4 w-4" /></Button>
                  {canManage && <Button variant="ghost" size="icon" aria-label={`Delete ${t.name}`} onClick={() => confirmDelete(t)}><Trash2 className="h-4 w-4 text-red-600" /></Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <TemplateEditorDialog open={editorOpen} templateId={editingId} purposes={purposes} connected={connected} onClose={() => setEditorOpen(false)} />
    </div>
  )
}
