"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { Forbidden } from "@/components/shared/forbidden"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { WorkflowDialog } from "@/components/whatsapp-crm/WorkflowDialog"
import { describeAction, describeCondition, describeTrigger, RUN_REASON } from "@/components/whatsapp-crm/campaign-helpers"
import { useCrmMe, useLabels, useTemplates, useWorkflow, useWorkflowMutations, useWorkflows } from "@/hooks/useWhatsappCrm"
import { formatRelativeTime } from "@/lib/utils"
import type { Workflow, WorkflowInput } from "@/types/whatsapp-crm.types"

const RUN_STYLE: Record<string, string> = {
  SENT: "text-emerald-700",
  SKIPPED: "text-muted-foreground",
  FAILED: "text-red-700",
  INTERRUPTED: "text-red-700",
  RUNNING: "text-sky-700",
}

function RunLog({ id }: { id: string }) {
  const wf = useWorkflow(id)
  const runs = wf.data?.runs ?? []
  return (
    <ul className="mt-2 divide-y rounded-md border text-xs" aria-label="Recent activity">
      {wf.isLoading && <li className="p-2"><Skeleton className="h-5 w-full" /></li>}
      {!wf.isLoading && runs.length === 0 && <li className="p-2 text-muted-foreground">Nothing has happened yet. It reacts to new events after it is switched on.</li>}
      {runs.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-2 py-1.5">
          <span>{r.customer ?? "Customer"} — <span className={RUN_STYLE[r.status]}>{r.status === "SENT" ? "Sent" : r.status === "SKIPPED" ? "Skipped" : r.status === "RUNNING" ? "Running" : "Failed"}</span>{r.reason && r.reason !== "LABEL_ONLY" ? ` (${RUN_REASON[r.reason] ?? r.reason})` : ""}</span>
          <span className="text-muted-foreground">{formatRelativeTime(r.created_at)}</span>
        </li>
      ))}
    </ul>
  )
}

export default function WorkflowsPage() {
  const me = useCrmMe()
  const allowed = me.can("crm.workflows.manage")
  const list = useWorkflows(allowed)
  const templates = useTemplates({}, allowed)
  const labels = useLabels()
  const m = useWorkflowMutations()
  const [editing, setEditing] = useState<Workflow | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  if (me.isLoading) return <Skeleton className="h-40 w-full" />
  if (!allowed) return <Forbidden />

  const tplName = (id: string) => templates.data?.templates.find((t) => t.id === id)?.name
  const labelName = (id: string) => labels.data?.find((l) => l.id === id)?.name
  const save = (input: WorkflowInput) => {
    const done = { onSuccess: () => setDialogOpen(false) }
    if (editing) {
      // The trigger type is fixed after creation.
      const { triggerType: _t, ...rest } = input
      void _t
      m.update.mutate({ id: editing.id, input: rest }, done)
    } else m.create.mutate(input, done)
  }
  const workflows = list.data ?? []

  return (
    <div className="space-y-5">
      <PageHeader title="Workflows" subtitle="Automatic messages. When something happens and it matches your conditions, a template is sent — no one has to remember.">
        <Button onClick={() => { setEditing(null); setDialogOpen(true) }}><Plus className="mr-1 h-4 w-4" /> New workflow</Button>
      </PageHeader>

      <div role="note" className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
        Each event is handled once. Customers who have not opted in, opted out, or are on the do-not-contact list are skipped. Marketing messages are held back between 9 pm and 9 am India time.
      </div>

      <ul className="space-y-2" aria-label="Workflows">
        {list.isLoading && <li><Skeleton className="h-24 w-full" /></li>}
        {!list.isLoading && workflows.length === 0 && (
          <li className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No workflows yet. Start with a cart reminder or an “out for delivery” message.</li>
        )}
        {workflows.map((w) => (
          <li key={w.id} className="rounded-lg border bg-card p-3">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{w.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${w.is_active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>{w.is_active ? "ON" : "OFF"}</span>
                </div>
                <p className="mt-1 text-xs"><span className="font-semibold text-muted-foreground">WHEN</span> {describeTrigger(w)}</p>
                {w.conditions.length > 0 && <p className="text-xs"><span className="font-semibold text-muted-foreground">IF</span> {w.conditions.map(describeCondition).join(" and ")}</p>}
                <p className="text-xs"><span className="font-semibold text-muted-foreground">DO</span> {w.actions.map((a) => describeAction(a, { template: tplName, label: labelName })).join(", then ")}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{w.sent ?? 0} sent · {w.skipped ?? 0} skipped{w.failed ? ` · ${w.failed} failed` : ""}</p>
              </div>
              <Switch checked={w.is_active} disabled={m.activate.isPending} onCheckedChange={(v) => m.activate.mutate({ id: w.id, active: v })} aria-label={`${w.name} on or off`} />
              <Button variant="ghost" size="icon" aria-label={`Edit ${w.name}`} onClick={() => { setEditing(w); setDialogOpen(true) }}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" aria-label={`Delete ${w.name}`} onClick={() => { if (window.confirm(`Delete the workflow “${w.name}”? Its history is deleted too.`)) m.remove.mutate(w.id) }}><Trash2 className="h-4 w-4 text-red-600" /></Button>
            </div>
            <button type="button" className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" aria-expanded={expanded === w.id} onClick={() => setExpanded(expanded === w.id ? null : w.id)}>
              {expanded === w.id ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />} Recent activity
            </button>
            {expanded === w.id && <RunLog id={w.id} />}
          </li>
        ))}
      </ul>

      <WorkflowDialog open={dialogOpen} workflow={editing} saving={m.create.isPending || m.update.isPending} onClose={() => setDialogOpen(false)} onSave={save} />
    </div>
  )
}
