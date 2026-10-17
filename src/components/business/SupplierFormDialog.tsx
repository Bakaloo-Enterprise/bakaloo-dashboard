"use client"

import { useEffect, useState } from "react"
import { Building2, ChevronDown, Phone, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useProcurementMutations } from "@/hooks/useBusiness"
import { cn } from "@/lib/utils"
import type { Vendor, VendorTerms } from "@/types/business.types"
import { CREDIT_CHOICES, TERMS_ORDER, TERMS_UI } from "./supplier-helpers"

const big = "h-12 text-base"

/** Add or change a supplier. The top half is enough; the rest is optional and folded away. */
export function SupplierFormDialog({ open, onOpenChange, vendor }: { open: boolean; onOpenChange: (o: boolean) => void; vendor?: Vendor | null }) {
  const { createVendor, updateVendor } = useProcurementMutations()
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [terms, setTerms] = useState<VendorTerms>("CASH")
  const [days, setDays] = useState(7)
  const [more, setMore] = useState({ tradeName: "", contactPerson: "", gstin: "", address: "", upiId: "", bankName: "", bankAccountNo: "", bankIfsc: "" })
  useEffect(() => {
    if (!open) return
    setName(vendor?.name ?? ""); setPhone(vendor?.phone ?? ""); setTerms(vendor?.paymentTerms ?? "CASH"); setDays(vendor?.creditDays || 7)
    setMore({ tradeName: vendor?.tradeName ?? "", contactPerson: vendor?.contactPerson ?? "", gstin: vendor?.gstin ?? "", address: vendor?.address ?? "", upiId: vendor?.upiId ?? "", bankName: vendor?.bankName ?? "", bankAccountNo: "", bankIfsc: vendor?.bankIfsc ?? "" })
  }, [open, vendor])

  const set = (k: keyof typeof more) => (e: React.ChangeEvent<HTMLInputElement>) => setMore((m) => ({ ...m, [k]: e.target.value }))
  const busy = createVendor.isPending || updateVendor.isPending
  const save = () => {
    if (name.trim().length < 2) return
    // Empty = clear on edit, skip on create. The account number is never shown back, so blank means "keep" when editing.
    const details: Record<string, string> = { ...more }
    if (vendor && !more.bankAccountNo) delete details.bankAccountNo
    if (!vendor) for (const k of Object.keys(details)) if (!details[k]) delete details[k]
    const body = { name: name.trim(), phone: phone.trim(), paymentTerms: terms, creditDays: terms === "CREDIT" ? days : 0, ...details }
    const done = { onSuccess: () => onOpenChange(false) }
    if (vendor) updateVendor.mutate({ id: vendor.id, ...body }, done)
    else createVendor.mutate({ ...body, phone: body.phone || undefined }, done)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl"><Building2 className="h-6 w-6" aria-hidden />{vendor ? "Change supplier" : "New supplier"}</DialogTitle>
          <DialogDescription className="sr-only">Supplier details and how we pay them</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div><label htmlFor="sp-name" className="mb-1 block text-sm font-semibold">Name</label><Input id="sp-name" className={big} value={name} onChange={(e) => setName(e.target.value)} placeholder="Supplier name" maxLength={120} /></div>
          <div><label htmlFor="sp-phone" className="mb-1 flex items-center gap-1 text-sm font-semibold"><Phone className="h-4 w-4" aria-hidden />Phone</label><Input id="sp-phone" className={big} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Mobile number" maxLength={20} /></div>
          <div>
            <p className="mb-1.5 text-sm font-semibold">How do we pay them?</p>
            <div className="grid grid-cols-4 gap-2">
              {TERMS_ORDER.map((t) => { const u = TERMS_UI[t]; return (
                <button key={t} type="button" aria-pressed={terms === t} onClick={() => setTerms(t)} className={cn("flex flex-col items-center gap-1 rounded-xl border-2 px-1 py-3 text-center", terms === t ? `${u.tone} ring-2 ring-offset-1` : "hover:bg-muted")}>
                  <u.icon className="h-7 w-7" aria-hidden /><span className="text-sm font-bold">{u.label}</span>
                </button>
              ) })}
            </div>
            {terms === "CREDIT" && (
              <div className="mt-2 flex flex-wrap items-center gap-2"><span className="text-sm">Pay within</span>
                {CREDIT_CHOICES.map((d) => <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)} className={cn("h-10 rounded-full border-2 px-4 text-sm font-bold", days === d ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>{d} days</button>)}
                <Input className="h-10 w-20 text-center" inputMode="numeric" value={days} onChange={(e) => setDays(Math.min(365, parseInt(e.target.value.replace(/\D/g, ""), 10) || 0))} aria-label="Days to pay" />
              </div>
            )}
          </div>
          <details className="rounded-xl border-2 p-3">
            <summary className="flex cursor-pointer select-none items-center gap-1 text-sm font-semibold"><ChevronDown className="h-4 w-4" aria-hidden />More details (optional)</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div><label htmlFor="sp-trade" className="text-xs text-muted-foreground">Business name</label><Input id="sp-trade" value={more.tradeName} onChange={set("tradeName")} maxLength={160} /></div>
              <div><label htmlFor="sp-contact" className="text-xs text-muted-foreground">Contact person</label><Input id="sp-contact" value={more.contactPerson} onChange={set("contactPerson")} maxLength={120} /></div>
              <div><label htmlFor="sp-gst" className="text-xs text-muted-foreground">GST number</label><Input id="sp-gst" value={more.gstin} onChange={set("gstin")} maxLength={15} placeholder="Only if they have one" /></div>
              <div><label htmlFor="sp-addr" className="text-xs text-muted-foreground">Address</label><Input id="sp-addr" value={more.address} onChange={set("address")} maxLength={300} /></div>
              <div><label htmlFor="sp-upi" className="text-xs text-muted-foreground">UPI ID</label><Input id="sp-upi" value={more.upiId} onChange={set("upiId")} maxLength={80} placeholder="name@bank" /></div>
              <div><label htmlFor="sp-bank" className="text-xs text-muted-foreground">Bank name</label><Input id="sp-bank" value={more.bankName} onChange={set("bankName")} maxLength={80} /></div>
              <div><label htmlFor="sp-acc" className="text-xs text-muted-foreground">Account number {vendor?.bankAccountMasked ? `(now ${vendor.bankAccountMasked})` : ""}</label><Input id="sp-acc" inputMode="numeric" value={more.bankAccountNo} onChange={set("bankAccountNo")} maxLength={24} placeholder={vendor?.bankAccountMasked ? "Leave empty to keep" : ""} /></div>
              <div><label htmlFor="sp-ifsc" className="text-xs text-muted-foreground">IFSC</label><Input id="sp-ifsc" value={more.bankIfsc} onChange={set("bankIfsc")} maxLength={11} /></div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">The GST number is only checked for the right shape — it is not verified with the government.</p>
          </details>
          <Button type="button" className="h-14 w-full bg-green-600 text-lg font-bold hover:bg-green-700" disabled={name.trim().length < 2 || busy} onClick={save}><Save className="mr-2 h-6 w-6" aria-hidden />Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
