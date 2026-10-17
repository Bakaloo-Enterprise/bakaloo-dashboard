"use client"

import { useEffect, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { Building2, CheckCircle2, House, Phone, Search, UserPlus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useDebounce } from "@/hooks/useDebounce"
import { cn } from "@/lib/utils"
import { addOrderCustomer, lookupOrderCustomers, type StaffCustomer } from "@/services/uploads.service"

export type OrderKind = "B2C" | "B2B"

/** Small coloured labels, same picture + word everywhere. */
function Labels({ c }: { c: StaffCustomer }) {
  return (
    <span className="flex flex-wrap gap-1">
      {c.kind === "BUSINESS" ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-indigo-300 bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700"><Building2 className="h-3 w-3" aria-hidden />Business</span>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-700"><House className="h-3 w-3" aria-hidden />Home</span>
      )}
      {c.notOnApp && <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800"><UserPlus className="h-3 w-3" aria-hidden />Not on the app yet</span>}
      {c.orderCount > 0 && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{c.orderCount} {c.orderCount === 1 ? "order" : "orders"}</span>}
    </span>
  )
}

function Row({ c, onClick }: { c: StaffCustomer; onClick?: () => void }) {
  const Icon = c.kind === "BUSINESS" ? Building2 : House
  const body = (
    <>
      <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border", c.kind === "BUSINESS" ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-300 bg-slate-50 text-slate-700")}><Icon className="h-6 w-6" aria-hidden /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{c.businessName || c.name || "Unnamed"}</span>
        <span className="flex items-center gap-1 truncate text-xs text-muted-foreground"><Phone className="h-3 w-3" aria-hidden />{c.phone}{c.businessName && c.name ? ` · ${c.name}` : ""}</span>
        <Labels c={c} />
      </span>
    </>
  )
  return onClick ? <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl border-2 p-2.5 text-left transition hover:bg-muted">{body}</button> : <div className="flex items-center gap-3">{body}</div>
}

/**
 * Step 1 of Create Order: is it a home customer or a business, then find them — or add them if they are not on the
 * platform yet. Everything is a big tile with a picture and a label.
 */
export type NewCustomerHint = { name: string; phone: string; business?: string }

export function CustomerPicker({ orderType, onOrderType, selected, onSelect, initialNew }: { orderType: OrderKind; onOrderType: (k: OrderKind) => void; selected: StaffCustomer | null; onSelect: (c: StaffCustomer | null) => void; initialNew?: NewCustomerHint | null }) {
  const [search, setSearch] = useState("")
  const q = useDebounce(search, 300)
  const [adding, setAdding] = useState(false)
  // Opened from a customer request whose person is not on the platform yet: start with the form filled in.
  useEffect(() => { if (initialNew && !selected) setAdding(true) }, [initialNew]) // eslint-disable-line react-hooks/exhaustive-deps
  const list = useQuery({ queryKey: ["order-customers", q], queryFn: () => lookupOrderCustomers(q), staleTime: 15_000, enabled: !selected })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3" role="group" aria-label="Type of customer">
        {([["B2C", "Home customer", "Buys for the house", House], ["B2B", "Business", "Restaurant, shop, hotel…", Building2]] as const).map(([k, label, hint, Icon]) => (
          <button key={k} type="button" aria-pressed={orderType === k} onClick={() => onOrderType(k)} className={cn("flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition", orderType === k ? (k === "B2B" ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-300" : "border-green-500 bg-green-50 ring-2 ring-green-300") : "hover:bg-muted")}>
            <Icon className="h-9 w-9 shrink-0" aria-hidden />
            <span><span className="block text-base font-bold">{label}</span><span className="text-xs text-muted-foreground">{hint}</span></span>
          </button>
        ))}
      </div>

      {selected ? (
        <div className="rounded-2xl border-2 border-green-400 bg-green-50 p-3">
          <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden /><span className="flex-1 text-sm font-bold text-green-800">Customer chosen</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => onSelect(null)}><X className="mr-1 h-4 w-4" aria-hidden />Change</Button></div>
          <div className="mt-2"><Row c={selected} /></div>
          {orderType === "B2B" && selected.kind === "HOME" && <p className="mt-2 rounded-lg bg-white/70 px-2 py-1 text-xs">This is not a business yet. The order is still billed on credit under their name.</p>}
          {orderType === "B2C" && selected.kind === "BUSINESS" && <p className="mt-2 rounded-lg bg-white/70 px-2 py-1 text-xs">This is a business. Switch to “Business” above to bill them on credit.</p>}
        </div>
      ) : adding ? (
        <NewCustomerForm kind={orderType === "B2B" ? "BUSINESS" : "HOME"} hint={initialNew ?? null} onCancel={() => setAdding(false)} onDone={(c) => { setAdding(false); onSelect(c) }} />
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" aria-hidden />
            <Input aria-label="Search customers" className="h-12 pl-10 text-base" placeholder="Search by name, business or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <ul className="space-y-2" aria-label="Customers found">
            {(list.data ?? []).map((c) => <li key={c.id}><Row c={c} onClick={() => onSelect(c)} /></li>)}
            {!list.isLoading && (list.data ?? []).length === 0 && <li className="rounded-xl border-2 border-dashed p-4 text-center text-sm text-muted-foreground">{q ? `No one found for “${q}”.` : "No customers yet."} Add them below.</li>}
          </ul>
          <button type="button" onClick={() => setAdding(true)} className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50 p-3 text-left hover:bg-amber-100">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-200 text-amber-900"><UserPlus className="h-6 w-6" aria-hidden /></span>
            <span><span className="block font-bold text-amber-900">Not on the platform? Add a new customer</span><span className="text-xs text-amber-900/80">Just a name and a phone number</span></span>
          </button>
        </>
      )}
    </div>
  )
}

function NewCustomerForm({ kind, hint, onCancel, onDone }: { kind: "HOME" | "BUSINESS"; hint: NewCustomerHint | null; onCancel: () => void; onDone: (c: StaffCustomer) => void }) {
  const [name, setName] = useState(hint?.name ?? "")
  const [phone, setPhone] = useState(hint?.phone ?? "")
  const [business, setBusiness] = useState(hint?.business ?? "")
  const [gstin, setGstin] = useState("")
  const [type, setType] = useState(kind)
  useEffect(() => setType(kind), [kind])
  const add = useMutation({
    mutationFn: () => addOrderCustomer({ name: name.trim(), phone: phone.trim(), kind: type, ...(type === "BUSINESS" ? { businessName: business.trim(), gstin: gstin.trim() || undefined } : {}) }),
    onSuccess: (c) => { toast.success(c.existing ? "This number already has an account — chosen." : "Customer added"); onDone(c) },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Could not add the customer"),
  })
  const digits = phone.replace(/\D/g, "")
  const ok = name.trim().length >= 2 && (digits.length === 10 || (digits.length === 12 && digits.startsWith("91"))) && (type === "HOME" || business.trim().length >= 2)
  return (
    <div className="space-y-3 rounded-2xl border-2 border-amber-400 bg-amber-50/60 p-3">
      <p className="flex items-center gap-2 font-bold text-amber-900"><UserPlus className="h-5 w-5" aria-hidden />New customer <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[11px]">Not on the app yet</span></p>
      <div className="grid grid-cols-2 gap-2">
        {([["HOME", "Home", House], ["BUSINESS", "Business", Building2]] as const).map(([k, label, Icon]) => (
          <button key={k} type="button" aria-pressed={type === k} onClick={() => setType(k)} className={cn("flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 font-bold", type === k ? "border-primary bg-primary/10" : "bg-card hover:bg-muted")}><Icon className="h-5 w-5" aria-hidden />{label}</button>
        ))}
      </div>
      {type === "BUSINESS" && <div><label htmlFor="nc-biz" className="mb-1 block text-sm font-semibold">Business name</label><Input id="nc-biz" className="h-11 bg-card" value={business} onChange={(e) => setBusiness(e.target.value)} maxLength={160} placeholder="e.g. Royal Biryani" /></div>}
      <div><label htmlFor="nc-name" className="mb-1 block text-sm font-semibold">{type === "BUSINESS" ? "Contact person" : "Name"}</label><Input id="nc-name" className="h-11 bg-card" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} /></div>
      <div><label htmlFor="nc-phone" className="mb-1 block text-sm font-semibold">Mobile number</label><Input id="nc-phone" className="h-11 bg-card" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} placeholder="10 digits" /></div>
      {type === "BUSINESS" && <div><label htmlFor="nc-gst" className="mb-1 block text-sm font-semibold">GST number <span className="font-normal text-muted-foreground">(optional)</span></label><Input id="nc-gst" className="h-11 bg-card" value={gstin} onChange={(e) => setGstin(e.target.value)} maxLength={15} /></div>}
      <p className="text-xs text-muted-foreground">They can open the app later with this same number and will see this order.</p>
      <div className="grid grid-cols-3 gap-2">
        <Button type="button" variant="outline" className="h-12 border-2" onClick={onCancel}>Back</Button>
        <Button type="button" className="col-span-2 h-12 bg-green-600 text-base font-bold hover:bg-green-700" disabled={!ok || add.isPending} onClick={() => add.mutate()}>Add and use</Button>
      </div>
    </div>
  )
}
