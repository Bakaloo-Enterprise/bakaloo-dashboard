"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronDown, ListPlus, Minus, PackageCheck, PackageOpen, Plus, Save, Search, Truck, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useBuyList } from "@/hooks/useBuyList"
import { usePlan, useProcurementMutations, useVendors } from "@/hooks/useBusiness"
import { useDebounce } from "@/hooks/useDebounce"
import { useProducts } from "@/hooks/useProducts"
import { cn } from "@/lib/utils"
import type { PlanItem, VendorTerms } from "@/types/business.types"
import { formatRupees, istToday } from "./business-helpers"
import { CREDIT_CHOICES, TERMS_ORDER, TERMS_UI } from "./supplier-helpers"

/** What the sheet needs to know about a product; a full plan row has all of it, a searched product has just the name. */
type Target = Pick<PlanItem, "productId" | "name"> & Partial<PlanItem>

const NEW = "__new__"
const whole = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s) : NaN)

function Form({ item, presetVendorId, onClose, onNext }: { item: Target | null; presetVendorId?: string; onClose: () => void; onNext?: () => void }) {
  const m = useProcurementMutations()
  const vendors = useVendors()
  const plan = usePlan()
  const buyList = useBuyList()
  const [product, setProduct] = useState<Target | null>(item)
  const [search, setSearch] = useState("")
  const q = useDebounce(search, 250)
  const found = useProducts({ search: q, limit: 6 })
  // a product picked by search may still be on the plan: borrow its suppliers and last price
  const info: Target | null = useMemo(() => (product ? plan.data?.items.find((i) => i.productId === product.productId) ?? product : null), [product, plan.data, ])
  const priceOf = (vid: string): number | null => info?.vendors?.find((v) => v.vendorId === vid)?.price ?? info?.lastPrice ?? null
  const firstVendor = presetVendorId ?? info?.vendors?.[0]?.vendorId ?? info?.lastVendorId ?? ""

  const [qty, setQty] = useState(String(Math.max(1, item?.toBuy ?? 1)))
  const [vendorId, setVendorId] = useState(firstVendor)
  const [price, setPrice] = useState(() => { const p = firstVendor ? priceOf(firstVendor) : null; return p === null ? "" : String(p) })
  const [priceTouched, setPriceTouched] = useState(false)
  const [here, setHere] = useState(false)
  const [came, setCame] = useState("")
  const [bad, setBad] = useState("0")
  const [on, setOn] = useState(istToday())
  const [invoice, setInvoice] = useState("")
  const [note, setNote] = useState("")
  const [adding, setAdding] = useState(false)
  const [nv, setNv] = useState({ name: "", phone: "", terms: "CASH" as VendorTerms, days: 7 })

  // pick a new product from search: reset the defaults for it
  useEffect(() => {
    if (!info || item?.productId === info.productId) return
    setQty(String(Math.max(1, info.toBuy ?? 1)))
    const v = presetVendorId ?? info.vendors?.[0]?.vendorId ?? info.lastVendorId ?? ""
    setVendorId(v); setPriceTouched(false)
    const p = v ? priceOf(v) : info.lastPrice ?? null
    setPrice(p === null ? "" : String(p))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info?.productId])

  const chooseVendor = (id: string) => { setVendorId(id); if (!priceTouched) { const p = priceOf(id); if (p !== null) setPrice(String(p)) } }
  const n = whole(qty)
  const unit = price.trim() === "" ? NaN : Number(price)
  const cameN = came.trim() === "" ? n : whole(came)
  const badN = whole(bad || "0")
  const total = Number.isFinite(unit) && Number.isInteger(here ? cameN : n) ? Math.round((here ? cameN : n) * unit * 100) / 100 : 0
  const vendorName = (vendors.data ?? []).find((v) => v.id === vendorId)?.name ?? info?.vendors?.find((v) => v.vendorId === vendorId)?.name ?? null
  const problems: string[] = []
  if (!product) problems.push("Choose a product.")
  if (!Number.isInteger(n) || n < 1) problems.push("How many? Enter a whole number.")
  if (!vendorId || vendorId === NEW) problems.push("Choose who you buy it from.")
  if (!Number.isFinite(unit) || unit < 0) problems.push("Enter the price for one.")
  if (here && (!Number.isInteger(cameN) || cameN < 1)) problems.push("How many came?")
  if (here && Number.isInteger(cameN) && badN > cameN) problems.push("Bad ones cannot be more than came.")

  const save = (next: boolean) => {
    if (problems.length || !product) return
    m.createEntry.mutate(
      { productId: product.productId, vendorId, expectedQty: n, ...(here ? { receivedQty: cameN, damagedQty: Number.isInteger(badN) ? badN : 0 } : { ordered: true }), unitPrice: unit, procuredOn: on, invoiceRef: invoice.trim() || undefined, receivingNote: note.trim() || undefined },
      { onSuccess: () => { if (next && onNext) onNext(); else onClose() } },
    )
  }
  const addToList = () => {
    if (!product || !Number.isInteger(n) || n < 1) return
    buyList.add({ productId: product.productId, name: product.name, unit: info?.unit ?? null, qty: n, price: Number.isFinite(unit) ? unit : null, vendorId: vendorId && vendorId !== NEW ? vendorId : null, vendorName })
    onClose()
  }
  const saveVendor = () => {
    if (nv.name.trim().length < 2) return
    m.createVendor.mutate({ name: nv.name.trim(), ...(nv.phone.trim() ? { phone: nv.phone.trim() } : {}), paymentTerms: nv.terms, creditDays: nv.terms === "CREDIT" ? nv.days : 0 }, { onSuccess: (v) => { chooseVendor(v.id); setAdding(false); setNv({ name: "", phone: "", terms: "CASH", days: 7 }) } })
  }

  const suggestions = info?.vendors ?? []
  const others = (vendors.data ?? []).filter((v) => v.is_active && !suggestions.some((s) => s.vendorId === v.id))
  const stepBtn = "h-12 w-12 shrink-0 rounded-xl text-lg"
  return (
    <form onSubmit={(e) => { e.preventDefault(); save(false) }} className="space-y-4">
      {/* product */}
      {product ? (
        <div className="flex items-center gap-3">
          {info?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={info.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl border object-cover" />
          ) : <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border bg-muted"><PackageOpen className="h-7 w-7 text-muted-foreground" aria-hidden /></span>}
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold">{product.name}</p>
            {info?.need !== undefined && <p className="text-sm text-muted-foreground">Need <b>{info.need}</b> · Have <b>{info.have}</b> · <b className={cn((info.toBuy ?? 0) > 0 ? "text-red-600" : "text-green-700")}>{(info.toBuy ?? 0) > 0 ? `Buy ${info.toBuy}` : "Enough"}</b></p>}
          </div>
          {!item && <button type="button" className="text-xs underline" onClick={() => { setProduct(null); setSearch("") }}>Change</button>}
        </div>
      ) : (
        <div>
          <label htmlFor="qb-search" className="mb-1 block text-sm font-semibold">Which product?</label>
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden /><Input id="qb-search" autoFocus autoComplete="off" className="h-12 pl-9 text-base" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Type a product name" /></div>
          {q.length > 0 && (
            <ul className="mt-1 max-h-48 overflow-auto rounded-xl border" role="listbox" aria-label="Products found">
              {(found.data?.products ?? []).map((p) => <li key={p.id}><button type="button" role="option" aria-selected="false" className="w-full px-3 py-2.5 text-left hover:bg-muted" onClick={() => { setProduct({ productId: p.id, name: p.name }); setSearch("") }}>{p.name}</button></li>)}
              {!found.isLoading && (found.data?.products ?? []).length === 0 && <li className="px-3 py-2.5 text-muted-foreground">No product found</li>}
            </ul>
          )}
        </div>
      )}

      {product && (
        <>
          {/* how many */}
          <div>
            <p className="mb-1.5 text-sm font-semibold">How many?</p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" className={stepBtn} aria-label="One less" onClick={() => setQty(String(Math.max(1, (Number.isInteger(n) ? n : 1) - 1)))}><Minus className="h-5 w-5" /></Button>
              <Input inputMode="numeric" aria-label="Quantity" className="h-12 w-24 text-center text-2xl font-extrabold" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} />
              <Button type="button" variant="outline" className={stepBtn} aria-label="One more" onClick={() => setQty(String((Number.isInteger(n) ? n : 0) + 1))}><Plus className="h-5 w-5" /></Button>
              <div className="ml-1 flex flex-wrap gap-1.5">
                {info?.toBuy ? <button type="button" onClick={() => setQty(String(info.toBuy))} className="rounded-full border px-3 py-1.5 text-xs font-semibold hover:bg-muted">Exactly {info.toBuy}</button> : null}
                {[5, 10, 25].map((a) => <button key={a} type="button" onClick={() => setQty(String((Number.isInteger(n) ? n : 0) + a))} className="rounded-full border px-3 py-1.5 text-xs font-semibold hover:bg-muted">+{a}</button>)}
              </div>
            </div>
          </div>

          {/* from whom */}
          <div>
            <p className="mb-1.5 text-sm font-semibold">From whom?</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((v) => (
                <button key={v.vendorId} type="button" aria-pressed={vendorId === v.vendorId} onClick={() => chooseVendor(v.vendorId)} className={cn("rounded-xl border-2 px-3 py-2 text-left", vendorId === v.vendorId ? "border-primary bg-primary/10" : "hover:bg-muted")}>
                  <span className="block text-sm font-bold">{v.name}</span>
                  <span className="block text-xs text-muted-foreground">{v.price !== null ? `${formatRupees(v.price)} last time` : "no price yet"}</span>
                </button>
              ))}
              {vendorId && !suggestions.some((s) => s.vendorId === vendorId) && vendorName && (
                <button type="button" aria-pressed className="rounded-xl border-2 border-primary bg-primary/10 px-3 py-2 text-left"><span className="block text-sm font-bold">{vendorName}</span><span className="block text-xs text-muted-foreground">chosen</span></button>
              )}
              <button type="button" onClick={() => setAdding((a) => !a)} className="flex items-center gap-1.5 rounded-xl border-2 border-dashed px-3 py-2 text-sm font-semibold hover:bg-muted"><UserPlus className="h-4 w-4" aria-hidden />New supplier</button>
            </div>
            {others.length > 0 && (
              <select aria-label="Another supplier" className="mt-2 h-10 w-full rounded-md border bg-background px-2 text-sm" value="" onChange={(e) => e.target.value && chooseVendor(e.target.value)}>
                <option value="">{suggestions.length ? "Another supplier…" : "Choose a supplier…"}</option>
                {others.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            )}
            {adding && (
              <div className="mt-2 space-y-3 rounded-xl border-2 border-dashed p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input aria-label="Supplier name" autoFocus placeholder="Supplier name" maxLength={120} value={nv.name} onChange={(e) => setNv({ ...nv, name: e.target.value })} className="h-11" />
                  <Input aria-label="Supplier phone" placeholder="Phone (optional)" inputMode="tel" maxLength={20} value={nv.phone} onChange={(e) => setNv({ ...nv, phone: e.target.value })} className="h-11" />
                </div>
                <div className="grid grid-cols-4 gap-2" role="group" aria-label="How do you pay them?">
                  {TERMS_ORDER.map((t) => { const u = TERMS_UI[t]; return <button key={t} type="button" aria-pressed={nv.terms === t} onClick={() => setNv({ ...nv, terms: t })} className={cn("flex flex-col items-center gap-0.5 rounded-xl border-2 py-2 text-xs font-bold", nv.terms === t ? `${u.tone} ring-2 ring-offset-1` : "hover:bg-muted")}><u.icon className="h-5 w-5" aria-hidden />{u.label}</button> })}
                </div>
                {nv.terms === "CREDIT" && <div className="flex flex-wrap items-center gap-2 text-sm">Pay within {CREDIT_CHOICES.map((d) => <button key={d} type="button" aria-pressed={nv.days === d} onClick={() => setNv({ ...nv, days: d })} className={cn("h-9 rounded-full border-2 px-3 text-xs font-bold", nv.days === d ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>{d} days</button>)}</div>}
                <Button type="button" className="h-11 w-full" disabled={nv.name.trim().length < 2 || m.createVendor.isPending} onClick={saveVendor}>Save supplier and choose them</Button>
              </div>
            )}
          </div>

          {/* price and total */}
          <div className="grid grid-cols-2 gap-3">
            <div><label htmlFor="qb-price" className="mb-1 block text-sm font-semibold">Price for one (₹)</label><Input id="qb-price" inputMode="decimal" className="h-12 text-lg font-bold" value={price} onChange={(e) => { setPrice(e.target.value.replace(/[^0-9.]/g, "")); setPriceTouched(true) }} /></div>
            <div className="rounded-xl bg-muted px-3 py-2"><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-extrabold tabular-nums">{formatRupees(total)}</p></div>
          </div>

          {/* arrived? */}
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Have the goods arrived?">
            {([[false, "On the way", "ordered, not here yet", Truck], [true, "Already here", "came with us", PackageCheck]] as const).map(([v, label, hint, Icon]) => (
              <button key={label} type="button" aria-pressed={here === v} onClick={() => setHere(v)} className={cn("flex items-center gap-2 rounded-xl border-2 p-2.5 text-left", here === v ? "border-primary bg-primary/10 ring-2 ring-primary/30" : "hover:bg-muted")}>
                <Icon className="h-7 w-7 shrink-0" aria-hidden /><span><span className="block text-sm font-bold">{label}</span><span className="text-xs text-muted-foreground">{hint}</span></span>
              </button>
            ))}
          </div>
          {here && (
            <div className="grid grid-cols-2 gap-3">
              <div><label htmlFor="qb-came" className="mb-1 block text-xs text-muted-foreground">How many came (blank = {Number.isInteger(n) ? n : "same"})</label><Input id="qb-came" inputMode="numeric" value={came} onChange={(e) => setCame(e.target.value.replace(/\D/g, ""))} /></div>
              <div><label htmlFor="qb-bad" className="mb-1 block text-xs text-muted-foreground">Bad ones</label><Input id="qb-bad" inputMode="numeric" value={bad} onChange={(e) => setBad(e.target.value.replace(/\D/g, ""))} /></div>
            </div>
          )}

          <details className="rounded-xl border p-3">
            <summary className="flex cursor-pointer select-none items-center gap-1 text-sm font-semibold"><ChevronDown className="h-4 w-4" aria-hidden />More (date, bill number, note)</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div><label htmlFor="qb-on" className="text-xs text-muted-foreground">Date</label><Input id="qb-on" type="date" max={istToday()} value={on} onChange={(e) => e.target.value && setOn(e.target.value)} /></div>
              <div><label htmlFor="qb-inv" className="text-xs text-muted-foreground">Bill number</label><Input id="qb-inv" maxLength={80} value={invoice} onChange={(e) => setInvoice(e.target.value)} /></div>
              <div><label htmlFor="qb-note" className="text-xs text-muted-foreground">Note</label><Input id="qb-note" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} /></div>
            </div>
          </details>

          {problems.length > 0 && n > 0 && <ul className="text-xs text-red-700" role="status">{problems.slice(0, 2).map((p) => <li key={p}>{p}</li>)}</ul>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="h-14 flex-1 bg-green-600 text-lg font-bold hover:bg-green-700" disabled={problems.length > 0 || m.createEntry.isPending}><Save className="mr-2 h-5 w-5" aria-hidden />Save purchase</Button>
            {onNext && <Button type="button" variant="outline" className="h-14 text-base font-bold" disabled={problems.length > 0 || m.createEntry.isPending} onClick={() => save(true)}>Save &amp; next</Button>}
            <Button type="button" variant="outline" className="h-14 text-base font-bold" disabled={!Number.isInteger(n) || n < 1} onClick={addToList}><ListPlus className="mr-2 h-5 w-5" aria-hidden />Add to buy list</Button>
          </div>
        </>
      )}
    </form>
  )
}

/**
 * Tap a product → a purchase that is already filled in (quantity to buy, usual supplier, last price). Change what is wrong,
 * press Save. Opened from a To-buy card, or from a supplier (supplier fixed, pick the product).
 */
export function QuickBuyDialog({ open, onClose, item, vendorId, onNext }: { open: boolean; onClose: () => void; item?: Target | null; vendorId?: string; onNext?: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[94vh] max-w-xl overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl"><Truck className="h-6 w-6" aria-hidden />Buy</DialogTitle>
          <DialogDescription>Everything is filled in from what you bought before. Change what is different, then save.</DialogDescription>
        </DialogHeader>
        {open && <Form key={`${item?.productId ?? "pick"}:${vendorId ?? ""}`} item={item ?? null} presetVendorId={vendorId} onClose={onClose} onNext={onNext} />}
      </DialogContent>
    </Dialog>
  )
}
