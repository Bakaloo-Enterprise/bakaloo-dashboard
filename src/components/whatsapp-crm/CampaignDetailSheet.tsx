"use client"

import { useState } from "react"
import { CalendarClock, Pause, Play, Rocket, Trash2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { useCampaign, useCampaignMutations, useCampaignRecipients } from "@/hooks/useWhatsappCrm"
import { formatRelativeTime } from "@/lib/utils"
import type { AudiencePreview } from "@/types/whatsapp-crm.types"
import { availableActions, CAMPAIGN_STATUS, isQuietHoursIST, localInputToIso, minScheduleLocal, pct, progressPercent, SKIP_REASON } from "./campaign-helpers"

const RECIPIENT_FILTERS = [
  { v: "", label: "All" },
  { v: "SENT", label: "Sent" },
  { v: "FAILED", label: "Failed" },
  { v: "SKIPPED", label: "Skipped" },
  { v: "PENDING", label: "Waiting" },
]

const MSG_STATUS: Record<string, string> = { SENT: "Sent", DELIVERED: "Delivered", READ: "Read", FAILED: "Failed", QUEUED: "Sending" }

function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-md border p-2 text-center">
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  )
}

/** One campaign: results, the launch checklist (audience check + schedule), and controls. */
export function CampaignDetailSheet({ id, onClose, onEdit }: { id: string | null; onClose: () => void; onEdit: (id: string) => void }) {
  const campaign = useCampaign(id)
  const [filter, setFilter] = useState("")
  const recipients = useCampaignRecipients(id, filter || undefined)
  const m = useCampaignMutations()
  const [preview, setPreview] = useState<AudiencePreview | null>(null)
  const [when, setWhen] = useState("")

  const c = campaign.data
  const st = c ? CAMPAIGN_STATUS[c.status] : null
  const actions = c ? availableActions(c) : []
  const marketingAtNight = c?.template_category === "MARKETING" && isQuietHoursIST()

  const close = () => {
    setPreview(null)
    setWhen("")
    setFilter("")
    onClose()
  }
  const scheduledIso = localInputToIso(when)

  return (
    <Sheet open={Boolean(id)} onOpenChange={(o) => !o && close()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {!c ? (
          <>
            <SheetTitle className="sr-only">Campaign</SheetTitle>
            <SheetDescription className="sr-only">Loading campaign details</SheetDescription>
            <Skeleton className="mt-8 h-40 w-full" />
          </>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                {c.name}
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${st?.cls}`} title={st?.hint}>{st?.label}</span>
              </SheetTitle>
              <SheetDescription>
                Template “{c.template_name}” · {c.rate_per_minute} per minute
                {c.scheduled_at && c.status === "SCHEDULED" ? ` · starts ${new Date(c.scheduled_at).toLocaleString()}` : ""}
              </SheetDescription>
            </SheetHeader>

            {c.pause_reason && c.status === "PAUSED" && (
              <p role="status" className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">Paused: {c.pause_reason}</p>
            )}

            {/* results */}
            <section className="mt-4" aria-label="Results">
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>{progressPercent(c.stats)}% handled</span>
                <span>{c.stats.total} in audience</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progressPercent(c.stats)} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progressPercent(c.stats)}%` }} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                <Stat label="Sent" value={c.stats.sent} />
                <Stat label="Delivered" value={c.stats.delivered} sub={pct(c.stats.delivered, c.stats.sent)} />
                <Stat label="Read" value={c.stats.read} sub={pct(c.stats.read, c.stats.delivered)} />
                <Stat label="Failed" value={c.stats.failed} />
                <Stat label="Skipped" value={c.stats.skipped} />
              </div>
              {c.stats.skipReasons.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                  {c.stats.skipReasons.map((r) => <li key={r.reason}>{r.n} × {SKIP_REASON[r.reason] ?? r.reason}</li>)}
                </ul>
              )}
            </section>

            {/* draft: launch checklist */}
            {c.status === "DRAFT" && (
              <section className="mt-5 space-y-3 rounded-lg border p-3" aria-label="Launch">
                <h4 className="text-sm font-semibold">Before you send</h4>
                <Button variant="outline" size="sm" disabled={m.preview.isPending} onClick={() => m.preview.mutate(c.id, { onSuccess: setPreview })}>
                  {m.preview.isPending ? "Checking…" : "Check who will receive it"}
                </Button>
                {preview && (
                  <div className="rounded-md bg-muted/50 p-2 text-sm" role="status">
                    <p><strong>{preview.willSend}</strong> of {preview.audience} will receive it.</p>
                    {Object.entries(preview.skipped).map(([k, n]) => <p key={k} className="text-xs text-muted-foreground">{n} skipped — {SKIP_REASON[k] ?? k}</p>)}
                    {preview.willSend === 0 && <p className="mt-1 text-xs text-amber-800">Nobody can receive this yet. Record opt-ins below the campaign list, or pick another audience.</p>}
                  </div>
                )}
                {marketingAtNight && <p className="text-xs text-amber-800">It is night in India (9 pm – 9 am). A marketing campaign started now begins sending at 9 am.</p>}
                <div className="flex flex-wrap items-end gap-2">
                  <Button disabled={!preview || preview.willSend === 0 || m.launch.isPending} onClick={() => m.launch.mutate({ id: c.id }, { onSuccess: () => setPreview(null) })}>
                    <Rocket className="mr-1 h-4 w-4" /> Send now
                  </Button>
                  <span className="text-xs text-muted-foreground">or</span>
                  <div>
                    <label htmlFor="when" className="sr-only">Schedule for</label>
                    <input id="when" type="datetime-local" min={minScheduleLocal()} value={when} onChange={(e) => setWhen(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm" />
                  </div>
                  <Button variant="outline" disabled={!preview || preview.willSend === 0 || !scheduledIso || m.launch.isPending} onClick={() => m.launch.mutate({ id: c.id, scheduledAt: scheduledIso }, { onSuccess: () => setPreview(null) })}>
                    <CalendarClock className="mr-1 h-4 w-4" /> Schedule
                  </Button>
                </div>
              </section>
            )}

            {/* controls */}
            <div className="mt-4 flex flex-wrap gap-2">
              {c.status === "DRAFT" && <Button variant="outline" size="sm" onClick={() => onEdit(c.id)}>Edit</Button>}
              {actions.includes("pause") && <Button variant="outline" size="sm" disabled={m.act.isPending} onClick={() => m.act.mutate({ id: c.id, action: "pause" })}><Pause className="mr-1 h-4 w-4" /> Pause</Button>}
              {actions.includes("resume") && <Button size="sm" disabled={m.act.isPending} onClick={() => m.act.mutate({ id: c.id, action: "resume" })}><Play className="mr-1 h-4 w-4" /> Resume</Button>}
              {actions.includes("cancel") && (
                <Button variant="outline" size="sm" disabled={m.act.isPending} onClick={() => { if (window.confirm("Cancel this campaign? Messages not yet sent will never be sent.")) m.act.mutate({ id: c.id, action: "cancel" }) }}>
                  <XCircle className="mr-1 h-4 w-4 text-red-600" /> Cancel
                </Button>
              )}
              {actions.includes("delete") && (
                <Button variant="ghost" size="sm" disabled={m.remove.isPending} onClick={() => { if (window.confirm("Delete this draft?")) m.remove.mutate(c.id, { onSuccess: close }) }}>
                  <Trash2 className="mr-1 h-4 w-4 text-red-600" /> Delete
                </Button>
              )}
            </div>

            {/* recipients */}
            {c.status !== "DRAFT" && (
              <section className="mt-5" aria-label="Recipients">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-semibold">People</h4>
                  <div className="flex gap-1">
                    {RECIPIENT_FILTERS.map((f) => (
                      <button key={f.v} type="button" onClick={() => setFilter(f.v)} aria-pressed={filter === f.v} className={`rounded-full border px-2 py-0.5 text-[11px] ${filter === f.v ? "border-primary bg-primary/10 font-semibold" : "hover:bg-muted"}`}>{f.label}</button>
                    ))}
                  </div>
                </div>
                <ul className="divide-y rounded-md border text-sm">
                  {recipients.isLoading && <li className="p-2"><Skeleton className="h-6 w-full" /></li>}
                  {(recipients.data ?? []).length === 0 && !recipients.isLoading && <li className="p-2 text-xs text-muted-foreground">No one here.</li>}
                  {(recipients.data ?? []).map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2 px-2 py-1.5">
                      <span className="min-w-0 truncate">{r.name ?? "Unknown"} <span className="text-xs text-muted-foreground">{r.phone ?? ""}</span></span>
                      <span className="shrink-0 text-xs text-muted-foreground" title={r.error_text ?? undefined}>
                        {r.status === "SKIPPED" ? SKIP_REASON[r.skip_reason ?? ""] ?? "Skipped" : r.status === "FAILED" ? SKIP_REASON[r.skip_reason ?? ""] ?? "Failed" : r.message_status ? MSG_STATUS[r.message_status] ?? r.message_status : r.status === "PENDING" ? "Waiting" : "Sending"}
                        {r.sent_at ? ` · ${formatRelativeTime(r.sent_at)}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
