"use client"

import { useState } from "react"
import { Bug, Clock, Droplets, Flame, HelpCircle, Minus, Plus, Search, Trash2, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useLogWastage, useShelf } from "@/hooks/useErp"
import { useActiveShopsForSwitcher } from "@/hooks/useShops"
import { count } from "../format"
import { TONE, type Tone } from "../kit"
import { cn } from "@/lib/utils"

const REASONS: Array<[string, string, typeof Flame, Tone]> = [
  ["Spoilage / Rot", "Rotten", Flame, "rose"], ["Over-ripe", "Over-ripe", Clock, "amber"], ["Transit damage", "Damaged", Truck, "blue"],
  ["Unsold dump (EOD)", "Unsold, thrown", Trash2, "slate"], ["Pest damage", "Pests", Bug, "violet"], ["Moisture / weight loss", "Dried out", Droplets, "green"], ["Other", "Other", HelpCircle, "slate"],
]

export function LogWastageDialog({ open, onClose, defaultShopId }: { open: boolean; onClose: () => void; defaultShopId: string }) {
  const shops = useActiveShopsForSwitcher()
  const [shopId, setShopId] = useState("")
  const shop = shopId || defaultShopId || shops.data?.items?.[0]?.id || ""
  const shelf = useShelf(shop)
  const log = useLogWastage()
  const [search, setSearch] = useState("")
  const [productId, setProductId] = useState("")
  const [qty, setQty] = useState(1)
  const [reason, setReason] = useState("")
  const [note, setNote] = useState("")
  const items = (shelf.data ?? []).filter((i) => i.name.toLowerCase().includes(search.trim().toLowerCase()))
  const picked = shelf.data?.find((i) => i.productId === productId)
  const reset = () => { setProductId(""); setQty(1); setReason(""); setNote(""); setSearch("") }
  const ok = Boolean(picked) && qty >= 1 && qty <= (picked?.stock ?? 0) && Boolean(reason)
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader><DialogTitle>Log wastage</DialogTitle><DialogDescription>Stock that spoiled or broke. It comes off the shelf now and shows up in the Wastage Lab and the day’s close.</DialogDescription></DialogHeader>
        <div className="space-y-5">
          <label className="block text-sm font-medium">Which store?
            <select className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm" value={shop} onChange={(e) => { setShopId(e.target.value); setProductId("") }}>{(shops.data?.items ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <div>
            <p className="mb-1.5 text-sm font-medium">Which product?</p>
            <label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden /><span className="sr-only">Search products</span><Input className="h-10 pl-9" placeholder="Search …" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
            <ul className="mt-2 max-h-44 divide-y overflow-auto rounded-xl border" role="listbox" aria-label="Products on the shelf">
              {shelf.isLoading ? <li className="p-3 text-sm text-muted-foreground">Loading …</li> : items.length === 0 ? <li className="p-3 text-sm text-muted-foreground">Nothing on the shelf matches.</li> : items.map((i) => (
                <li key={i.productId}><button type="button" role="option" aria-selected={productId === i.productId} onClick={() => { setProductId(i.productId); setQty(1) }} className={cn("flex w-full items-center justify-between px-3 py-2 text-left text-sm", productId === i.productId ? "bg-emerald-500/10 font-semibold" : "hover:bg-muted")}><span>{i.name} <span className="text-xs text-muted-foreground">{i.pack}</span></span><span className="tabular-nums text-xs text-muted-foreground">{count(i.stock)} on shelf</span></button></li>
              ))}
            </ul>
          </div>
          {picked && (
            <div className="flex items-center justify-between rounded-xl border p-3">
              <span className="text-sm font-medium">How many? <span className="text-xs font-normal text-muted-foreground">(of {count(picked.stock)})</span></span>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="icon" className="h-11 w-11" aria-label="One less" onClick={() => setQty(Math.max(1, qty - 1))}><Minus className="h-4 w-4" /></Button>
                <Input inputMode="numeric" aria-label="Quantity" className="h-11 w-20 text-center text-lg font-semibold" value={qty} onChange={(e) => { const n = Number(e.target.value.replace(/\D/g, "")); setQty(Math.min(picked.stock, Math.max(0, n))) }} />
                <Button type="button" variant="outline" size="icon" className="h-11 w-11" aria-label="One more" onClick={() => setQty(Math.min(picked.stock, qty + 1))}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
          <fieldset><legend className="mb-2 text-sm font-medium">What happened?</legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {REASONS.map(([id, label, Icon, tone]) => <button key={id} type="button" aria-pressed={reason === id} onClick={() => setReason(id)} className={cn("flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium", reason === id ? cn("border-2 border-current", TONE[tone].soft, TONE[tone].text) : "hover:bg-muted")}><Icon className="h-6 w-6" aria-hidden />{label}</button>)}
            </div>
          </fieldset>
          <label className="block text-sm font-medium">Note <span className="font-normal text-muted-foreground">(optional)</span><Input className="mt-1 h-11" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} /></label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" disabled={!ok || log.isPending} onClick={() => log.mutate({ shopId: shop, productId, quantity: qty, reason, ...(note.trim() ? { note: note.trim() } : {}) }, { onSuccess: () => { reset(); onClose() } })}>Remove {qty > 0 ? qty : ""} from shelf</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
