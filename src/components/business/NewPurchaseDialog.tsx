"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useDebounce } from "@/hooks/useDebounce"
import { useProducts } from "@/hooks/useProducts"
import { useActiveShopsForSwitcher } from "@/hooks/useShops"
import { useProcurementMutations, useVendors } from "@/hooks/useBusiness"
import { formatRupees, istToday } from "./business-helpers"

const NEW_VENDOR = "__new__"
const field = "h-9 w-full rounded-md border bg-background px-2 text-sm"

/** Record what was bought: product, vendor, received quantity, price, date, invoice, receiving check, and where it goes. */
export function NewPurchaseDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void }) {
  const m = useProcurementMutations()
  const vendors = useVendors()
  const shops = useActiveShopsForSwitcher()
  const [search, setSearch] = useState("")
  const q = useDebounce(search, 250)
  const found = useProducts({ search: q, limit: 8 }, )
  const [product, setProduct] = useState<{ id: string; name: string } | null>(null)
  const [vendorId, setVendorId] = useState("")
  const [vendorName, setVendorName] = useState("")
  const [expected, setExpected] = useState("")
  const [received, setReceived] = useState("")
  const [damaged, setDamaged] = useState("0")
  const [price, setPrice] = useState("")
  const [on, setOn] = useState(istToday())
  const [invoice, setInvoice] = useState("")
  const [note, setNote] = useState("")
  const [dest, setDest] = useState("")
  const [b2b, setB2b] = useState(false)
  const [reserveNote, setReserveNote] = useState("")

  const exp = Number(expected)
  const rec = received === "" ? exp : Number(received)
  const dmg = Number(damaged || 0)
  const unit = Number(price)
  const total = Number.isFinite(rec * unit) ? Math.round(rec * unit * 100) / 100 : 0
  const problems: string[] = []
  if (!product) problems.push("Choose a product.")
  if (!vendorId && !vendorName.trim()) problems.push("Choose or name a vendor.")
  if (!Number.isInteger(exp) || exp < 1) problems.push("Enter the quantity (whole units).")
  if (!Number.isInteger(rec) || rec < 1) problems.push("Received quantity must be at least 1.")
  if (Number.isInteger(rec) && dmg > rec) problems.push("Damaged cannot be more than received.")
  if (!(unit >= 0) || price === "") problems.push("Enter the purchase price.")
  if (b2b && !reserveNote.trim()) problems.push("Say who the B2B stock is reserved for.")

  const submit = () => {
    if (problems.length || !product) return
    m.createEntry.mutate(
      {
        productId: product.id, ...(vendorId && vendorId !== NEW_VENDOR ? { vendorId } : { vendorName: vendorName.trim() }), expectedQty: exp, receivedQty: rec, damagedQty: dmg, unitPrice: unit, procuredOn: on,
        invoiceRef: invoice.trim() || undefined, receivingNote: note.trim() || undefined, destinationShopId: !b2b && dest ? dest : undefined, ...(b2b ? { purpose: "B2B_RESERVED" as const, reservationNote: reserveNote.trim() } : {}),
      },
      { onSuccess: (e) => { onOpenChange(false); onCreated(e.id) } },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New purchase</DialogTitle>
          <DialogDescription>Record stock you bought. After receiving it you decide which store gets how much.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 text-sm md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="pp-search" className="text-xs text-muted-foreground">Product</label>
            {product ? (
              <p className="flex items-center justify-between rounded-md border px-2 py-1.5"><strong>{product.name}</strong><button type="button" className="text-xs underline" onClick={() => setProduct(null)}>Change</button></p>
            ) : (
              <>
                <Input id="pp-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by product name" autoComplete="off" />
                {q.length > 0 && (
                  <ul className="mt-1 max-h-40 overflow-auto rounded-md border" role="listbox" aria-label="Products found">
                    {(found.data?.products ?? []).map((p) => (
                      <li key={p.id}><button type="button" role="option" aria-selected="false" className="w-full px-2 py-1.5 text-left hover:bg-muted" onClick={() => { setProduct({ id: p.id, name: p.name }); setSearch("") }}>{p.name}</button></li>
                    ))}
                    {!found.isLoading && (found.data?.products ?? []).length === 0 && <li className="px-2 py-1.5 text-muted-foreground">No product found</li>}
                  </ul>
                )}
              </>
            )}
          </div>
          <div>
            <label htmlFor="pp-vendor" className="text-xs text-muted-foreground">Vendor</label>
            <select id="pp-vendor" className={field} value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
              <option value="">Choose…</option>
              {(vendors.data ?? []).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              <option value={NEW_VENDOR}>+ A new vendor…</option>
            </select>
            {vendorId === NEW_VENDOR && <Input className="mt-1" aria-label="New vendor name" placeholder="Vendor name" value={vendorName} onChange={(e) => setVendorName(e.target.value)} />}
          </div>
          <div>
            <label htmlFor="pp-date" className="text-xs text-muted-foreground">Purchase date</label>
            <Input id="pp-date" type="date" max={istToday()} value={on} onChange={(e) => setOn(e.target.value)} />
          </div>
          <div><label htmlFor="pp-exp" className="text-xs text-muted-foreground">Quantity ordered</label><Input id="pp-exp" inputMode="numeric" value={expected} onChange={(e) => setExpected(e.target.value)} /></div>
          <div><label htmlFor="pp-rec" className="text-xs text-muted-foreground">Quantity received (blank = same)</label><Input id="pp-rec" inputMode="numeric" value={received} onChange={(e) => setReceived(e.target.value)} /></div>
          <div><label htmlFor="pp-dmg" className="text-xs text-muted-foreground">Damaged on arrival</label><Input id="pp-dmg" inputMode="numeric" value={damaged} onChange={(e) => setDamaged(e.target.value)} /></div>
          <div><label htmlFor="pp-price" className="text-xs text-muted-foreground">Purchase price per unit (₹)</label><Input id="pp-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
          <p className="md:col-span-2" role="status">
            Purchase total: <strong>{formatRupees(total)}</strong>
            {Number.isInteger(exp) && Number.isInteger(rec) && rec < exp && <span className="ml-2 text-amber-700">Short by {exp - rec}</span>}
          </p>
          <div><label htmlFor="pp-inv" className="text-xs text-muted-foreground">Supplier invoice / reference</label><Input id="pp-inv" value={invoice} onChange={(e) => setInvoice(e.target.value)} maxLength={80} /></div>
          <div><label htmlFor="pp-note" className="text-xs text-muted-foreground">Receiving note</label><Input id="pp-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="e.g. two crates crushed" /></div>
          <div className="md:col-span-2 space-y-2 rounded-md border p-3">
            <p className="text-xs font-semibold text-muted-foreground">Where is this stock for?</p>
            <label className="flex items-center gap-2"><input type="radio" name="pp-for" aria-label="Any store" checked={!b2b && !dest} onChange={() => { setB2b(false); setDest("") }} />Any store — I will split it after receiving</label>
            <label className="flex items-center gap-2">
              <input type="radio" name="pp-for" aria-label="One dedicated store only" checked={!b2b && Boolean(dest)} onChange={() => { setB2b(false); setDest((shops.data?.items ?? [])[0]?.id ?? "") }} />One dedicated store only
              {!b2b && dest && <select aria-label="Dedicated store" className="h-8 rounded-md border bg-background px-2 text-xs" value={dest} onChange={(e) => setDest(e.target.value)}>{(shops.data?.items ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
            </label>
            <label className="flex items-center gap-2"><input type="radio" name="pp-for" aria-label="Reserved for a B2B or bulk order" checked={b2b} onChange={() => { setB2b(true); setDest("") }} />Reserved for a B2B / bulk order</label>
            {b2b && <Input aria-label="Reserved for" placeholder="Which customer or order?" value={reserveNote} onChange={(e) => setReserveNote(e.target.value)} maxLength={300} />}
          </div>
        </div>
        {problems.length > 0 && expected !== "" && <ul className="text-xs text-red-700">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={problems.length > 0 || m.createEntry.isPending} onClick={submit}>Record purchase</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
