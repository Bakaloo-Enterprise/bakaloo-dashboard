"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useProcurementMutations } from "@/hooks/useBusiness"
import { KIND_LABEL } from "./business-helpers"
import type { AdjustmentKind, ProcurementDetail } from "@/types/business.types"

const KINDS: AdjustmentKind[] = ["VENDOR_RETURN", "DAMAGE", "WASTAGE", "AUTHORIZED_ADJUSTMENT", "B2B_SUPPLY"]
const CENTRAL = ""

/** Return, damage or adjust stock from a purchase — from the unallocated stock or from a store that received it. */
export function AdjustDialog({ entry, open, onOpenChange }: { entry: ProcurementDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { adjust } = useProcurementMutations()
  const [kind, setKind] = useState<AdjustmentKind>("DAMAGE")
  const [qty, setQty] = useState("")
  const [where, setWhere] = useState(CENTRAL)
  const [reason, setReason] = useState("")

  // What each store still holds from this purchase.
  const held = new Map<string, { name: string; qty: number }>()
  for (const a of entry.allocations) if (a.status === "APPLIED") held.set(a.shopId, { name: a.shopName, qty: (held.get(a.shopId)?.qty ?? 0) + a.quantity })
  for (const j of entry.adjustments) if (j.shopId && held.has(j.shopId)) held.get(j.shopId)!.qty -= j.quantity
  const limit = where === CENTRAL ? entry.available : held.get(where)?.qty ?? 0
  const n = Number(qty)
  const problems: string[] = []
  if (!Number.isInteger(n) || n < 1) problems.push("Enter a whole quantity.")
  else if (n > limit) problems.push(`Only ${Math.max(0, limit)} ${where === CENTRAL ? "is in central stock" : "is held by that store from this purchase"}.`)
  if (!reason.trim()) problems.push("Give a reason.")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Return, damage or adjust</DialogTitle>
          <DialogDescription>{entry.product.name} — the record explains why stock differs from what was bought.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <label htmlFor="aj-kind" className="text-xs text-muted-foreground">What happened</label>
            <select id="aj-kind" className="h-9 w-full rounded-md border bg-background px-2" value={kind} onChange={(e) => { setKind(e.target.value as AdjustmentKind); if (e.target.value === "B2B_SUPPLY") setWhere(CENTRAL) }}>
              {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="aj-where" className="text-xs text-muted-foreground">Taken from</label>
            <select id="aj-where" className="h-9 w-full rounded-md border bg-background px-2" value={where} onChange={(e) => setWhere(e.target.value)} disabled={kind === "B2B_SUPPLY"}>
              <option value={CENTRAL}>Central stock ({entry.available} available)</option>
              {Array.from(held.entries()).filter(([, h]) => h.qty > 0).map(([id, h]) => <option key={id} value={id}>{h.name} ({h.qty} from this purchase)</option>)}
            </select>
          </div>
          <div><label htmlFor="aj-qty" className="text-xs text-muted-foreground">Quantity</label><Input id="aj-qty" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
          <div><label htmlFor="aj-why" className="text-xs text-muted-foreground">Reason</label><Input id="aj-why" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="e.g. water leak in the cold room" /></div>
          {where !== CENTRAL && <p className="text-xs text-muted-foreground">That store’s stock goes down by the same amount.</p>}
          {problems.length > 0 && qty !== "" && <ul className="text-xs text-red-700">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={problems.length > 0 || adjust.isPending} onClick={() => adjust.mutate({ id: entry.id, kind, quantity: n, reason: reason.trim(), ...(where ? { shopId: where } : {}) }, { onSuccess: () => { onOpenChange(false); setQty(""); setReason("") } })}>Record</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
