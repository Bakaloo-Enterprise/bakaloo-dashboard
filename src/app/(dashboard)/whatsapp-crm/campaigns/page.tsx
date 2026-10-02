"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { Forbidden } from "@/components/shared/forbidden"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { CampaignDetailSheet } from "@/components/whatsapp-crm/CampaignDetailSheet"
import { CampaignDialog } from "@/components/whatsapp-crm/CampaignDialog"
import { ConsentPanel } from "@/components/whatsapp-crm/ConsentPanel"
import { CAMPAIGN_STATUS, progressPercent } from "@/components/whatsapp-crm/campaign-helpers"
import { useCampaigns, useCampaignMutations, useCrmMe } from "@/hooks/useWhatsappCrm"
import { formatRelativeTime } from "@/lib/utils"
import type { Campaign, CampaignInput, CampaignStatus } from "@/types/whatsapp-crm.types"

const FILTERS: Array<{ v: CampaignStatus | undefined; label: string }> = [
  { v: undefined, label: "All" },
  { v: "DRAFT", label: "Drafts" },
  { v: "SCHEDULED", label: "Scheduled" },
  { v: "SENDING", label: "Sending" },
  { v: "PAUSED", label: "Paused" },
  { v: "COMPLETED", label: "Done" },
]

export default function CampaignsPage() {
  const me = useCrmMe()
  const canView = me.can("crm.campaigns.view")
  const canManage = me.can("crm.campaigns.manage")
  const [status, setStatus] = useState<CampaignStatus | undefined>(undefined)
  const list = useCampaigns(status, canView)
  const m = useCampaignMutations()
  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Campaign | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  if (me.isLoading) return <Skeleton className="h-40 w-full" />
  if (!canView) return <Forbidden />

  const save = (input: CampaignInput) => {
    const done = { onSuccess: (c: Campaign) => { setDialogOpen(false); setOpenId(c.id) } }
    if (editing) m.update.mutate({ id: editing.id, input }, done)
    else m.create.mutate(input, done)
  }
  const campaigns = list.data ?? []

  return (
    <div className="space-y-5">
      <PageHeader
        title="Campaigns"
        subtitle="Send an approved template to a group of customers who opted in. You see exactly who will receive it before anything goes out."
      >
        {canManage && <Button onClick={() => { setEditing(null); setDialogOpen(true) }}><Plus className="mr-1 h-4 w-4" /> New campaign</Button>}
      </PageHeader>

      <div role="note" className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
        Marketing messages are only sent between 9 am and 9 pm India time. People who opted out, are on the do-not-contact list, or haven’t opted in are always skipped.
      </div>

      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filter campaigns">
        {FILTERS.map((f) => (
          <button key={f.label} role="tab" aria-selected={status === f.v} type="button" onClick={() => setStatus(f.v)} className={`rounded-full border px-3 py-1 text-xs ${status === f.v ? "border-primary bg-primary/10 font-semibold" : "hover:bg-muted"}`}>
            {f.label}
          </button>
        ))}
      </div>

      <ul className="space-y-2" aria-label="Campaigns">
        {list.isLoading && <li><Skeleton className="h-20 w-full" /></li>}
        {!list.isLoading && campaigns.length === 0 && (
          <li className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No campaigns yet.{canManage ? " Create your first one." : ""}</li>
        )}
        {campaigns.map((c) => {
          const st = CAMPAIGN_STATUS[c.status]
          return (
            <li key={c.id}>
              <button type="button" onClick={() => setOpenId(c.id)} className="w-full rounded-lg border bg-card p-3 text-left hover:bg-muted/40" aria-label={`Open campaign ${c.name}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-medium">{c.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{formatRelativeTime(c.created_at)}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">Template “{c.template_name}”</p>
                {c.status !== "DRAFT" && (
                  <>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-emerald-500" style={{ width: `${progressPercent(c.stats)}%` }} /></div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {c.stats.sent} sent · {c.stats.delivered} delivered · {c.stats.read} read{c.stats.failed ? ` · ${c.stats.failed} failed` : ""}{c.stats.skipped ? ` · ${c.stats.skipped} skipped` : ""}
                    </p>
                  </>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      {canManage && <ConsentPanel />}

      <CampaignDetailSheet
        id={openId}
        onClose={() => setOpenId(null)}
        onEdit={(id) => { setEditing(campaigns.find((c) => c.id === id) ?? null); setDialogOpen(true) }}
      />
      <CampaignDialog open={dialogOpen} campaign={editing} saving={m.create.isPending || m.update.isPending} onClose={() => setDialogOpen(false)} onSave={save} />
    </div>
  )
}
