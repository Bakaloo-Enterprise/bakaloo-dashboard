"use client"

import { useState } from "react"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PrintStation } from "@/components/pos/PrintStation"
import { useJobs, usePosMe, usePosMutations, usePrinters } from "@/hooks/usePos"

export default function PrintingPage() {
  const me = usePosMe()
  const printers = usePrinters()
  const jobs = useJobs({ limit: 30 })
  const m = usePosMutations()
  const [name, setName] = useState("")
  const [paper, setPaper] = useState("80")
  const [stationFor, setStationFor] = useState<string | null>(null)
  const canManage = Boolean(me.data?.abilities.manage)
  const station = (printers.data ?? []).find((p) => p.id === stationFor)

  return (
    <div className="space-y-4">
      <PageHeader title="Printing" subtitle="Invoices and package labels are queued here and printed by the computer connected to the printer." />
      {station && <PrintStation printerId={station.id} printerName={station.name} />}

      <section className="space-y-2 rounded-md border p-3">
        <h2 className="text-sm font-semibold">Printers</h2>
        {(printers.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No printer yet. Add one below — until then packing still works, nothing is printed.</p>}
        <ul className="space-y-2">
          {(printers.data ?? []).map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                <strong>{p.name}</strong> · {p.paperMm} mm{p.isDefault && " · default"}
                <span className={p.online ? "ml-2 text-emerald-700" : "ml-2 text-red-700"}>{p.online ? "online" : "offline"}</span>
              </span>
              <span className="flex gap-1">
                <Button size="sm" variant={stationFor === p.id ? "default" : "outline"} onClick={() => setStationFor(stationFor === p.id ? null : p.id)}>
                  {stationFor === p.id ? "Stop printing here" : "Print from this computer"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => m.testPrint.mutate(p.id)}>Test page</Button>
                {canManage && !p.isDefault && <Button size="sm" variant="ghost" onClick={() => m.updatePrinter.mutate({ id: p.id, isDefault: true })}>Make default</Button>}
                {canManage && <Button size="sm" variant="ghost" className="text-red-700" onClick={() => m.removePrinter.mutate(p.id)}>Remove</Button>}
              </span>
            </li>
          ))}
        </ul>
        {canManage && (
          <form
            className="flex flex-wrap gap-2 pt-2"
            onSubmit={(e) => { e.preventDefault(); if (name.trim().length >= 2) m.addPrinter.mutate({ name: name.trim(), paperMm: Number(paper), isDefault: (printers.data ?? []).length === 0 }, { onSuccess: () => setName("") }) }}
          >
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Printer name, e.g. Packing counter" aria-label="Printer name" className="w-64" />
            <Select value={paper} onValueChange={setPaper}>
              <SelectTrigger className="w-28" aria-label="Paper width"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="58">58 mm</SelectItem><SelectItem value="80">80 mm</SelectItem><SelectItem value="210">A4 / 210 mm</SelectItem></SelectContent>
            </Select>
            <Button type="submit" disabled={name.trim().length < 2 || m.addPrinter.isPending}>Add printer</Button>
          </form>
        )}
      </section>

      <section className="rounded-md border p-3">
        <h2 className="mb-2 text-sm font-semibold">Recent print jobs</h2>
        <ul className="space-y-1.5">
          {(jobs.data ?? []).map((j) => (
            <li key={j.id} className="flex items-center justify-between gap-2 text-xs">
              <span>
                {j.kind.toLowerCase()}{j.orderNumber && ` · #${j.orderNumber}`}{j.printerName && ` · ${j.printerName}`}
                {j.error && <span className="block text-red-700">{j.error}</span>}
              </span>
              <span className="flex items-center gap-2">
                <span className="font-medium">{j.status.toLowerCase()}</span>
                {j.canRetry && <Button size="sm" variant="outline" className="h-6" onClick={() => m.retryJob.mutate(j.id)}>Retry</Button>}
              </span>
            </li>
          ))}
          {(jobs.data ?? []).length === 0 && <li className="text-xs text-muted-foreground">Nothing printed yet.</li>}
        </ul>
      </section>
    </div>
  )
}
