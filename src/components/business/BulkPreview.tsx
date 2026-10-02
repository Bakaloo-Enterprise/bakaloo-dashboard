"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useBulkMutations, useUploadRows } from "@/hooks/useBusiness"
import { cn } from "@/lib/utils"
import type { BulkBatch, BulkRowStatus } from "@/types/business.types"

const TABS: Array<{ id: BulkRowStatus; label: (b: BulkBatch) => string }> = [
  { id: "VALID", label: (b) => `Will change (${b.totals.valid})` },
  { id: "ERROR", label: (b) => `Errors (${b.totals.errors})` },
  { id: "UNCHANGED", label: (b) => `No change (${b.totals.unchanged})` },
]

/**
 * What the sheet WOULD do. Nothing is applied until the person confirms — and rows with errors are never applied
 * unless they explicitly choose to skip them.
 */
export function BulkPreview({ batch, onDone }: { batch: BulkBatch; onDone: (applied?: BulkBatch) => void }) {
  const m = useBulkMutations()
  const [status, setStatus] = useState<BulkRowStatus>(batch.totals.errors > 0 ? "ERROR" : "VALID")
  const [offset, setOffset] = useState(0)
  const [skip, setSkip] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const rows = useUploadRows(batch.id, status, offset)
  const t = batch.totals
  const blocked = t.errors > 0 && !skip
  const nothing = t.valid === 0

  return (
    <section className="space-y-3 rounded-lg border p-4" aria-label="Preview">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">Preview — {batch.fileName ?? "upload"}</h2>
          <p className="text-sm text-muted-foreground" role="status">
            {t.rows} rows · <strong className="text-emerald-700">{t.valid} will change</strong> across {t.shops ?? 0} store(s) and {t.products ?? 0} product(s) · <span className={t.errors ? "font-semibold text-red-700" : ""}>{t.errors} with errors</span> · {t.unchanged} already match
          </p>
          {(batch.ignoredColumns?.length ?? 0) > 0 && <p className="text-xs text-muted-foreground">Ignored columns: {batch.ignoredColumns!.join(", ")}</p>}
        </div>
        <Button variant="ghost" size="sm" disabled={m.discard.isPending} onClick={() => m.discard.mutate(batch.id, { onSuccess: () => onDone() })}>Discard</Button>
      </header>

      <div className="flex gap-1 border-b" role="tablist" aria-label="Rows">
        {TABS.map((tab) => <button key={tab.id} role="tab" type="button" aria-selected={status === tab.id} onClick={() => { setStatus(tab.id); setOffset(0) }} className={cn("-mb-px border-b-2 px-3 py-1.5 text-sm", status === tab.id ? "border-primary font-semibold" : "border-transparent text-muted-foreground")}>{tab.label(batch)}</button>)}
      </div>

      {rows.isLoading ? <Skeleton className="h-32 w-full" /> : (
        <div className="max-h-96 overflow-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground"><tr><th className="p-2">Row</th><th className="p-2">Product</th><th className="p-2">Store</th><th className="p-2">{status === "ERROR" ? "Problem" : "Change"}</th></tr></thead>
            <tbody>
              {(rows.data?.items ?? []).map((r) => (
                <tr key={r.rowNo} className="border-t align-top">
                  <td className="p-2 tabular-nums">{r.rowNo}</td>
                  <td className="p-2">{r.product ? <>{r.product.name}<span className="ml-1 text-xs text-muted-foreground">{r.product.sku}</span></> : <span className="text-muted-foreground">{Object.values(r.raw)[0] || "—"}</span>}</td>
                  <td className="p-2">{r.store ? r.store.branchCode : "—"}</td>
                  <td className={cn("p-2", status === "ERROR" && "text-red-700")}>{status === "ERROR" ? r.errors.join(" ") : status === "VALID" ? r.summary : "Same as the store has now"}</td>
                </tr>
              ))}
              {(rows.data?.items.length ?? 0) === 0 && <tr><td colSpan={4} className="p-4 text-center text-xs text-muted-foreground">Nothing here.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {(rows.data?.total ?? 0) > (rows.data?.limit ?? 100) && (
        <div className="flex items-center gap-2 text-xs">
          <Button size="sm" variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 100))}>Previous</Button>
          <span>{offset + 1}–{Math.min(offset + 100, rows.data!.total)} of {rows.data!.total}</span>
          <Button size="sm" variant="outline" disabled={offset + 100 >= rows.data!.total} onClick={() => setOffset(offset + 100)}>Next</Button>
        </div>
      )}

      {t.errors > 0 && (
        <label className="flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <input type="checkbox" checked={skip} onChange={(e) => setSkip(e.target.checked)} />
          Apply the {t.valid} good row(s) and skip the {t.errors} row(s) with errors
        </label>
      )}
      <div className="flex items-center gap-3">
        <Button disabled={blocked || nothing || m.apply.isPending} onClick={() => setConfirming(true)}>Apply {t.valid} change(s)…</Button>
        {blocked && <span className="text-xs text-red-700">Fix the sheet and upload again, or tick the box above to skip the errors.</span>}
        {nothing && <span className="text-xs text-muted-foreground">Nothing in this sheet would change anything.</span>}
      </div>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Apply these changes?</DialogTitle>
            <DialogDescription>
              {t.valid} row(s) across {t.shops ?? 0} store(s) and {t.products ?? 0} product(s) will be changed{t.errors > 0 ? `; ${t.errors} row(s) with errors will be skipped` : ""}. Stock changes are recorded in the stock history. This cannot be undone in one click.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirming(false)}>Not yet</Button>
            <Button disabled={m.apply.isPending} onClick={() => m.apply.mutate({ id: batch.id, skipErrors: skip }, { onSuccess: (done) => { setConfirming(false); onDone(done) }, onError: () => setConfirming(false) })}>Yes, apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
