"use client"

import { useState } from "react"
import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useActiveShopsForSwitcher } from "@/hooks/useShops"
import { useProcurementMutations } from "@/hooks/useBusiness"
import type { ProcurementDetail } from "@/types/business.types"

interface Row { shopId: string; qty: string }

/** Send some of the received stock to one or more stores. Cannot exceed what is available. */
export function SplitDialog({ entry, open, onOpenChange }: { entry: ProcurementDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
  const shops = useActiveShopsForSwitcher()
  const { allocate } = useProcurementMutations()
  const only = entry.destination?.id
  const [rows, setRows] = useState<Row[]>([{ shopId: only ?? "", qty: "" }])
  const [updateCost, setUpdateCost] = useState(true)
  const all = (shops.data?.items ?? []).filter((s) => !only || s.id === only)

  const parsed = rows.map((r) => ({ shopId: r.shopId, quantity: Number(r.qty) }))
  const total = parsed.reduce((n, r) => n + (Number.isInteger(r.quantity) && r.quantity > 0 ? r.quantity : 0), 0)
  const left = entry.available - total
  const ids = rows.map((r) => r.shopId).filter(Boolean)
  const problems: string[] = []
  if (parsed.some((r) => !r.shopId)) problems.push("Choose a store on every row.")
  if (parsed.some((r) => !Number.isInteger(r.quantity) || r.quantity < 1)) problems.push("Quantities must be whole numbers of at least 1.")
  if (new Set(ids).size !== ids.length) problems.push("A store appears twice — combine its quantities.")
  if (left < 0) problems.push(`That is ${-left} more than is available.`)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send stock to stores</DialogTitle>
          <DialogDescription>{entry.product.name} — {entry.available} available to split. Each store’s stock goes up straight away.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <select aria-label={`Store for row ${i + 1}`} className="h-9 flex-1 rounded-md border bg-background px-2 text-sm" value={r.shopId} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, shopId: e.target.value } : y)))}>
                <option value="">Choose a store…</option>
                {all.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <Input aria-label={`Quantity for row ${i + 1}`} inputMode="numeric" className="w-24" value={r.qty} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, qty: e.target.value } : y)))} />
              {rows.length > 1 && <Button variant="ghost" size="icon" aria-label={`Remove row ${i + 1}`} onClick={() => setRows((x) => x.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>}
            </div>
          ))}
          {!only && <Button variant="outline" size="sm" onClick={() => setRows((x) => [...x, { shopId: "", qty: "" }])}><Plus className="mr-1 h-3 w-3" />Add a store</Button>}
        </div>
        <p role="status" className={`text-sm ${left < 0 ? "font-semibold text-red-700" : ""}`}>Sending {total} · {left >= 0 ? `${left} will stay unallocated` : "too much"}</p>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={updateCost} onChange={(e) => setUpdateCost(e.target.checked)} />Set each store’s cost price to ₹{entry.unitPrice} (you still control the selling price)</label>
        {problems.length > 0 && total > 0 && <ul className="text-xs text-red-700">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={problems.length > 0 || total === 0 || allocate.isPending} onClick={() => allocate.mutate({ id: entry.id, allocations: parsed, updateCostPrice: updateCost }, { onSuccess: () => onOpenChange(false) })}>Send to stores</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
