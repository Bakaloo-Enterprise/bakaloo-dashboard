"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Check, Copy, MessageCircle, Phone, ShoppingBasket, Trash2, Truck } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useBuyList } from "@/hooks/useBuyList"
import { bizError, useVendors } from "@/hooks/useBusiness"
import { createEntry } from "@/services/business.service"
import { formatRupees, istToday } from "./business-helpers"
import { groupByVendor, lineTotal, orderMessage, telLink, whatsappLink, type BuyLine } from "./buylist"

/**
 * The buy list, one card per supplier: change quantities and prices, send the order on WhatsApp (or copy it), then record the
 * whole supplier's order as purchases "on the way" in one tap. A line that fails stays on the list with the reason.
 */
export function BuyListDialog({ open, onClose, manage }: { open: boolean; onClose: () => void; manage: boolean }) {
  const { list, update, remove, removeMany, clear } = useBuyList()
  const vendors = useVendors()
  const qc = useQueryClient()
  const [busy, setBusy] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const groups = groupByVendor(list)
  const indexOf = (l: BuyLine) => list.indexOf(l)
  const key = (l: BuyLine) => `${l.productId}:${l.vendorId}`
  const vendorsList = (vendors.data ?? []).filter((v) => v.is_active)

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast.success("Message copied") } catch { toast.error("Could not copy — select the text by hand") }
  }

  const record = async (lines: BuyLine[]) => {
    setBusy(lines[0].vendorId ?? "none")
    const done = new Set<string>()
    const errs: Record<string, string> = {}
    for (const l of lines) {
      if (!l.vendorId || l.price === null) { errs[key(l)] = !l.vendorId ? "Choose a supplier first." : "Enter the price."; continue }
      try {
        await createEntry({ productId: l.productId, vendorId: l.vendorId, expectedQty: l.qty, ordered: true, unitPrice: l.price, procuredOn: istToday() })
        done.add(key(l))
      } catch (e) { errs[key(l)] = bizError(e) }
    }
    removeMany((l) => !done.has(key(l)))
    setErrors(errs)
    setBusy(null)
    await qc.invalidateQueries({ queryKey: ["biz"] })
    if (done.size) toast.success(`${done.size} purchase${done.size > 1 ? "s" : ""} recorded — on the way`)
    if (Object.keys(errs).length) toast.error(`${Object.keys(errs).length} could not be saved — see the list`)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[94vh] max-w-2xl overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl"><ShoppingBasket className="h-6 w-6" aria-hidden />Buy list</DialogTitle>
          <DialogDescription>Products you decided to buy, grouped by supplier. Send the order, then record it. This list stays in this browser until you record or remove it.</DialogDescription>
        </DialogHeader>
        {groups.length === 0 ? (
          <p role="status" className="rounded-2xl border-2 border-dashed p-10 text-center text-muted-foreground"><ShoppingBasket className="mx-auto mb-2 h-10 w-10" aria-hidden />Nothing on the list yet.<br />Open a product under “To buy” and press “Add to buy list”.</p>
        ) : (
          <div className="space-y-4">
            {groups.map((g) => {
              const v = vendorsList.find((x) => x.id === g.vendorId)
              const msg = orderMessage(g.vendorName, g.lines, "today")
              const wa = whatsappLink(v?.phone, msg)
              const tel = telLink(v?.phone)
              const ready = g.vendorId !== null && g.lines.every((l) => l.price !== null)
              return (
                <section key={g.vendorId ?? "none"} className="rounded-2xl border-2 p-3">
                  <header className="mb-2 flex flex-wrap items-center gap-2">
                    <h3 className="mr-auto text-base font-bold">{g.vendorName ?? "No supplier yet"}</h3>
                    {tel && <a href={tel} className="inline-flex h-9 items-center gap-1 rounded-full border px-3 text-xs font-semibold hover:bg-muted"><Phone className="h-4 w-4" aria-hidden />Call</a>}
                    {g.vendorId && <>
                      {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1 rounded-full border border-green-300 bg-green-50 px-3 text-xs font-semibold text-green-800 hover:bg-green-100"><MessageCircle className="h-4 w-4" aria-hidden />WhatsApp order</a>}
                      <button type="button" onClick={() => copy(msg)} className="inline-flex h-9 items-center gap-1 rounded-full border px-3 text-xs font-semibold hover:bg-muted"><Copy className="h-4 w-4" aria-hidden />Copy</button>
                    </>}
                  </header>
                  <ul className="divide-y">
                    {g.lines.map((l) => { const i = indexOf(l); return (
                      <li key={key(l)} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{l.name} <span className="text-xs font-normal text-muted-foreground">{l.unit}</span></p>
                          {g.vendorId === null && (
                            <select aria-label={`Supplier for ${l.name}`} className="mt-1 h-8 w-full max-w-xs rounded-md border bg-background px-2 text-xs" value="" onChange={(e) => { const s = vendorsList.find((x) => x.id === e.target.value); if (s) update(i, { vendorId: s.id, vendorName: s.name }) }}>
                              <option value="">Choose supplier…</option>{vendorsList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                          )}
                          {errors[key(l)] && <p role="alert" className="mt-1 text-xs font-medium text-red-700">{errors[key(l)]}</p>}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <label className="sr-only" htmlFor={`bl-q-${i}`}>Quantity of {l.name}</label>
                          <Input id={`bl-q-${i}`} inputMode="numeric" className="h-9 w-16 text-center font-bold" value={l.qty} onChange={(e) => { const q = Number(e.target.value.replace(/\D/g, "")); if (q > 0) update(i, { qty: q }) }} />
                          <span className="text-xs text-muted-foreground">×</span>
                          <label className="sr-only" htmlFor={`bl-p-${i}`}>Price of {l.name}</label>
                          <Input id={`bl-p-${i}`} inputMode="decimal" placeholder="₹" className="h-9 w-20 text-right" value={l.price ?? ""} onChange={(e) => { const t = e.target.value.replace(/[^0-9.]/g, ""); update(i, { price: t === "" ? null : Number(t) }) }} />
                          <span className="w-16 text-right text-xs font-semibold tabular-nums">{formatRupees(lineTotal(l))}</span>
                          <button type="button" aria-label={`Remove ${l.name}`} onClick={() => remove(i)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-red-600"><Trash2 className="h-4 w-4" aria-hidden /></button>
                        </div>
                      </li>
                    ) })}
                  </ul>
                  <footer className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-sm">Total <b className="tabular-nums">{formatRupees(g.total)}</b></p>
                    {manage && g.vendorId !== null && <Button type="button" className="h-11 bg-green-600 font-bold hover:bg-green-700" disabled={!ready || busy !== null} onClick={() => record(g.lines)}><Truck className="mr-1.5 h-4 w-4" aria-hidden />{busy === g.vendorId ? "Saving…" : `Record ${g.lines.length} as on the way`}</Button>}
                  </footer>
                  {g.vendorId !== null && !ready && <p className="mt-1 text-xs text-amber-700">Enter a price on every line to record it.</p>}
                </section>
              )
            })}
            <div className="flex justify-end"><Button type="button" variant="ghost" className="text-red-700" onClick={() => { clear(); setErrors({}) }}><Trash2 className="mr-1.5 h-4 w-4" aria-hidden />Clear the whole list</Button></div>
          </div>
        )}
        {groups.length > 0 && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Check className="h-3.5 w-3.5" aria-hidden />“Record as on the way” saves each line as a purchase waiting to arrive; mark it received later under Bought.</p>}
      </DialogContent>
    </Dialog>
  )
}
