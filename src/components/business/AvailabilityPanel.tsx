"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useDebounce } from "@/hooks/useDebounce"
import { useProducts } from "@/hooks/useProducts"
import { useActiveShopsForSwitcher } from "@/hooks/useShops"
import { useBulkMutations } from "@/hooks/useBusiness"
import type { AvailabilityResult } from "@/types/business.types"

type Action = "ASSIGN" | "ENABLE" | "DISABLE"
const ACTIONS: Array<[Action, string, string]> = [
  ["ASSIGN", "Assign to stores", "Add the products to the chosen stores (stock 0, switched off until stocked)."],
  ["ENABLE", "Switch on", "Make the products available where they have stock."],
  ["DISABLE", "Switch off", "Hide the products in the chosen stores."],
]

/** Activate, deactivate or assign selected products across several stores in one controlled action. */
export function AvailabilityPanel() {
  const shops = useActiveShopsForSwitcher()
  const { availability } = useBulkMutations()
  const [action, setAction] = useState<Action>("ASSIGN")
  const [search, setSearch] = useState("")
  const q = useDebounce(search, 250)
  const found = useProducts({ search: q, limit: 8 })
  const [picked, setPicked] = useState<Array<{ id: string; name: string }>>([])
  const [shopIds, setShopIds] = useState<string[]>([])
  const [plan, setPlan] = useState<AvailabilityResult | null>(null)

  const reset = () => setPlan(null)
  const input = { action, productIds: picked.map((p) => p.id), shopIds }
  const ready = picked.length > 0 && shopIds.length > 0
  const allShops = shops.data?.items ?? []

  return (
    <section className="space-y-3 rounded-lg border p-4" aria-label="Assign, switch on or off">
      <h2 className="font-semibold">Assign, switch on or switch off</h2>
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Action">
        {ACTIONS.map(([id, label, hint]) => (
          <button key={id} type="button" role="radio" aria-checked={action === id} title={hint} onClick={() => { setAction(id); reset() }} className={`rounded-full border px-3 py-1 text-xs ${action === id ? "border-primary bg-primary/10 font-semibold" : "hover:bg-muted"}`}>{label}</button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{ACTIONS.find((a) => a[0] === action)![2]}</p>

      <div>
        <label htmlFor="av-search" className="text-xs text-muted-foreground">Products</label>
        <Input id="av-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a product to add" autoComplete="off" />
        {q.length > 0 && (
          <ul className="mt-1 max-h-40 overflow-auto rounded-md border" aria-label="Products found">
            {(found.data?.products ?? []).filter((p) => !picked.some((x) => x.id === p.id)).map((p) => (
              <li key={p.id}><button type="button" className="w-full px-2 py-1.5 text-left text-sm hover:bg-muted" onClick={() => { setPicked((x) => [...x, { id: p.id, name: p.name }]); setSearch(""); reset() }}>{p.name}</button></li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex flex-wrap gap-1">
          {picked.map((p) => <span key={p.id} className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">{p.name}<button type="button" aria-label={`Remove ${p.name}`} onClick={() => { setPicked((x) => x.filter((y) => y.id !== p.id)); reset() }}><X className="h-3 w-3" /></button></span>)}
        </div>
      </div>

      <fieldset>
        <legend className="text-xs text-muted-foreground">Stores</legend>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={allShops.length > 0 && shopIds.length === allShops.length} onChange={(e) => { setShopIds(e.target.checked ? allShops.map((s) => s.id) : []); reset() }} />All stores</label>
          {allShops.map((s) => <label key={s.id} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={shopIds.includes(s.id)} onChange={(e) => { setShopIds((x) => (e.target.checked ? [...x, s.id] : x.filter((y) => y !== s.id))); reset() }} />{s.name}</label>)}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" disabled={!ready || availability.isPending} onClick={() => availability.mutate({ ...input, dryRun: true }, { onSuccess: setPlan })}>Check what would change</Button>
        <Button disabled={!plan || !plan.dryRun || plan.willChange === 0 || availability.isPending} onClick={() => availability.mutate({ ...input, dryRun: false }, { onSuccess: setPlan })}>Apply to {plan?.willChange ?? 0}</Button>
      </div>
      {plan && (
        <p role="status" className={`rounded-md px-3 py-2 text-sm ${plan.dryRun ? "bg-muted" : "bg-emerald-50 text-emerald-900"}`}>
          {plan.dryRun ? `${plan.willChange} would change` : `${plan.applied} changed`} · {plan.alreadyDone} already done
          {plan.skipped.noStock > 0 && ` · ${plan.skipped.noStock} skipped (no stock)`}
          {plan.skipped.notAssigned > 0 && ` · ${plan.skipped.notAssigned} skipped (not in that store)`}
          {plan.skipped.removed > 0 && ` · ${plan.skipped.removed} skipped (removed from store)`}
          {plan.inactiveStores.length > 0 && ` · ignored inactive: ${plan.inactiveStores.join(", ")}`}
        </p>
      )}
    </section>
  )
}
