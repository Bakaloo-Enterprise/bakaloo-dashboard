"use client"

import { useState } from "react"
import { PageHeader } from "@/components/shared/PageHeader"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { formatWaiting } from "@/components/pos/pos-helpers"
import { posErrorMessage, usePerformance, usePosMe, usePosMutations, useStaff } from "@/hooks/usePos"
import type { PosStation } from "@/types/pos.types"

const NONE = "__none__"
const min = (n: number | null | undefined) => (n == null ? "—" : formatWaiting(Math.round(n)))

export default function TeamPage() {
  const me = usePosMe()
  const staff = useStaff()
  const { setStation } = usePosMutations()
  const [range, setRange] = useState<{ from?: string; to?: string }>({})
  const perf = usePerformance(range)
  const canManage = Boolean(me.data?.abilities.manage)
  const d = perf.data
  const t = d?.totals

  return (
    <div className="space-y-4">
      <PageHeader title="Team & performance" subtitle="Who picks and who packs, and how the store is doing. Last 7 days unless you pick dates." />

      <section className="rounded-md border p-3">
        <h2 className="mb-2 text-sm font-semibold">Stations</h2>
        <ul className="space-y-1.5">
          {(staff.data ?? []).map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
              <span>{s.name} <span className="text-xs text-muted-foreground">({s.role.toLowerCase().replaceAll("_", " ")})</span></span>
              <Select disabled={!canManage} value={s.pos_station ?? NONE} onValueChange={(v) => setStation.mutate({ userId: s.id, station: v === NONE ? null : (v as PosStation) })}>
                <SelectTrigger className="h-8 w-40 text-xs" aria-label={`Station for ${s.name}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>All-round</SelectItem>
                  <SelectItem value="PICKER">Picker only</SelectItem>
                  <SelectItem value="PACKER">Packer only</SelectItem>
                </SelectContent>
              </Select>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded-md border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold">Performance</h2>
          <Input type="date" aria-label="From" className="h-8 w-40" value={range.from ?? ""} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value || undefined }))} />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="date" aria-label="To" className="h-8 w-40" value={range.to ?? ""} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value || undefined }))} />
        </div>
        {perf.isLoading && <Skeleton className="h-24 w-full" />}
        {perf.isError && <p role="alert" className="text-sm text-red-600">{posErrorMessage(perf.error)}</p>}
        {t && (
          <>
            <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              {[
                ["Orders picked", t.pickedOrders], ["Orders packed", t.packedOrders], ["Avg pick time", min(t.avgPickMinutes)], ["Avg pack time", min(t.avgPackMinutes)],
                ["Wrong scans", t.scanMistakes], ["Confirmed by hand", t.manualConfirms], ["Reported missing", t.missingReports], ["Handovers", t.handovers],
                ["Rider wait (median)", min(t.riderWaitMedianMinutes)], ["Rider changes", t.reassignments],
              ].map(([k, v]) => (
                <div key={String(k)}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="text-lg font-semibold tabular-nums">{v}</dd></div>
              ))}
            </dl>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-1">Person</th><th>Picked</th><th>Packed</th><th>Scans (ok / hand / wrong)</th><th>Missing</th><th>Handovers</th></tr></thead>
                <tbody>
                  {d!.people.map((p) => (
                    <tr key={p.userId ?? p.name} className="border-b last:border-0">
                      <td className="py-1.5">{p.name}</td>
                      <td>{p.picked ? `${p.picked.orders} · ${min(p.picked.avgMinutes)}` : "—"}</td>
                      <td>{p.packed ? `${p.packed.orders} · ${min(p.packed.avgMinutes)}` : "—"}</td>
                      <td>{p.scans.ok} / {p.scans.manual} / {p.scans.mistakes}{p.scans.mistakeRate != null && ` (${p.scans.mistakeRate}%)`}</td>
                      <td>{p.missingReports}</td>
                      <td>{p.handovers}</td>
                    </tr>
                  ))}
                  {d!.people.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-xs text-muted-foreground">No activity in this period.</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
