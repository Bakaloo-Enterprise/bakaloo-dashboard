"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useProspectImport, useProspectMutations, useProspectRows } from "@/hooks/useWhatsappCrm"
import type { ProspectRowStatus } from "@/types/whatsapp-crm.types"
import { reachableCount, ROW_STATUS, ROW_STATUS_ORDER } from "./prospect-helpers"

/** Check a prospect list: what the file contained, who is reachable, then confirm with a consent statement. */
export function ProspectPreview({ id, canManage, onDone }: { id: string; canManage: boolean; onDone: () => void }) {
  const imp = useProspectImport(id)
  const [filter, setFilter] = useState<ProspectRowStatus | undefined>(undefined)
  const rows = useProspectRows(id, filter)
  const m = useProspectMutations()
  const [source, setSource] = useState("")
  const [agreed, setAgreed] = useState(false)
  const [includeExisting, setIncludeExisting] = useState(false)

  if (!imp.data) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>
  const data = imp.data
  const confirmed = data.status === "CONFIRMED"
  const reachable = confirmed ? (data.counts.NEW ?? 0) + (data.counts.EXISTING_CONTACT ?? 0) + (data.include_existing ? data.counts.EXISTING_CUSTOMER ?? 0 : 0) : reachableCount(data.counts, includeExisting)
  const ready = canManage && !confirmed && agreed && source.trim().length >= 3 && reachable > 0

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">{data.name}</h3>
        <p className="text-xs text-muted-foreground">{data.total_rows} rows{data.filename ? ` · ${data.filename}` : ""}{confirmed ? " · confirmed" : " · not saved yet"}</p>
        {data.columns && !confirmed && (
          <p className="mt-1 text-xs text-muted-foreground">
            Using column “{data.columns.phone}” for the phone{data.columns.name ? `, “${data.columns.name}” for the name` : ""}{data.columns.business ? `, “${data.columns.business}” for the business` : ""}.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter rows">
        <button type="button" role="tab" aria-selected={!filter} onClick={() => setFilter(undefined)} className={`rounded-full border px-3 py-1 text-xs ${!filter ? "border-primary bg-primary/10 font-semibold" : "hover:bg-muted"}`}>All {data.total_rows}</button>
        {ROW_STATUS_ORDER.filter((s) => (data.counts[s] ?? 0) > 0).map((s) => (
          <button key={s} type="button" role="tab" aria-selected={filter === s} title={ROW_STATUS[s].hint} onClick={() => setFilter(s)} className={`rounded-full border px-3 py-1 text-xs ${filter === s ? "border-primary bg-primary/10 font-semibold" : "hover:bg-muted"}`}>
            {ROW_STATUS[s].label} {data.counts[s]}
          </button>
        ))}
      </div>

      <div className="max-h-72 overflow-auto rounded-md border">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Rows in the uploaded file</caption>
          <thead className="sticky top-0 bg-muted text-xs"><tr><th className="px-2 py-1.5">Row</th><th className="px-2 py-1.5">Name</th><th className="px-2 py-1.5">Business</th><th className="px-2 py-1.5">Phone</th><th className="px-2 py-1.5">Result</th></tr></thead>
          <tbody className="divide-y">
            {(rows.data ?? []).map((r) => (
              <tr key={r.id}>
                <td className="px-2 py-1 text-xs text-muted-foreground">{r.row_number}</td>
                <td className="px-2 py-1">{r.name ?? "—"}</td>
                <td className="px-2 py-1">{r.business_name ?? "—"}</td>
                <td className="px-2 py-1">{r.phone_raw ?? "—"}</td>
                <td className="px-2 py-1"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ROW_STATUS[r.status].cls}`}>{ROW_STATUS[r.status].label}</span></td>
              </tr>
            ))}
            {rows.data && rows.data.length === 0 && <tr><td colSpan={5} className="p-3 text-center text-xs text-muted-foreground">No rows.</td></tr>}
          </tbody>
        </table>
      </div>
      {rows.data && rows.data.length === 100 && <p className="text-xs text-muted-foreground">Showing the first 100 rows of this view.</p>}

      {confirmed ? (
        <p role="status" className="rounded-md border bg-emerald-50 p-3 text-sm dark:bg-emerald-950/30">
          <strong>{reachable}</strong> prospect{reachable === 1 ? " is" : "s are"} ready. Choose “Prospect lists” when you create a campaign. Consent recorded as “{data.consent_source}”.
        </p>
      ) : canManage ? (
        <fieldset className="space-y-3 rounded-md border p-3">
          <legend className="px-1 text-sm font-medium">Add {reachable} prospect{reachable === 1 ? "" : "s"}</legend>
          <p className="text-xs text-muted-foreground">Nothing is sent now. Adding records that these people agreed to be messaged; you then send to them with a normal campaign, which still skips anyone who opts out.</p>
          {(data.counts.EXISTING_CUSTOMER ?? 0) > 0 && (
            <label className="flex items-start gap-2 text-xs">
              <input type="checkbox" checked={includeExisting} onChange={(e) => setIncludeExisting(e.target.checked)} className="mt-0.5" />
              <span>Also include the {data.counts.EXISTING_CUSTOMER} existing Bakaloo customer{data.counts.EXISTING_CUSTOMER === 1 ? "" : "s"}.</span>
            </label>
          )}
          <div>
            <Label htmlFor="p-source" className="text-xs">Where did they agree?</Label>
            <Input id="p-source" value={source} onChange={(e) => setSource(e.target.value)} maxLength={30} placeholder="e.g. trade show form" className="mt-1" />
          </div>
          <label className="flex items-start gap-2 text-xs">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5" />
            <span>I confirm these people agreed to be contacted on WhatsApp by Bakaloo.</span>
          </label>
          <div className="flex gap-2">
            <Button size="sm" disabled={!ready || m.confirm.isPending} onClick={() => m.confirm.mutate({ id, confirm: true, source: source.trim(), includeExisting })}>
              {m.confirm.isPending ? "Adding…" : `Add ${reachable} prospect${reachable === 1 ? "" : "s"}`}
            </Button>
            <Button size="sm" variant="outline" disabled={m.discard.isPending} onClick={() => m.discard.mutate(id, { onSuccess: onDone })}>Discard this list</Button>
          </div>
        </fieldset>
      ) : null}
    </div>
  )
}
