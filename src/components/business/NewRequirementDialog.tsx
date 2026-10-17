"use client"

import { useEffect, useState } from "react"
import { ArrowLeft, ArrowRight, Building2, CalendarDays, CheckCircle2, HelpCircle, Minus, Plus, Search, Trash2, User, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useDebounce } from "@/hooks/useDebounce"
import { useProducts } from "@/hooks/useProducts"
import { useRequirementCustomers, useRequirementMutations, useRequirementPrefill } from "@/hooks/useBusiness"
import { cn } from "@/lib/utils"
import type { PayTerms, ReqSource } from "@/types/business.types"
import { addDays, istToday } from "./business-helpers"
import { PAY_ORDER, PAY_UI, SOURCE_ORDER, SOURCE_UI } from "./requirement-helpers"

interface Line { productId: string; name: string; quantity: number }
const STEPS = ["How?", "Who?", "What?", "When?"] as const
const big = "h-12 text-base"

/** Four easy steps: how they asked → who → what → when & payment. Each step is mostly pictures. */
export function NewRequirementDialog({ open, onOpenChange, conversationId }: { open: boolean; onOpenChange: (o: boolean) => void; conversationId?: string | null }) {
  const { create } = useRequirementMutations()
  const prefill = useRequirementPrefill(open ? conversationId ?? null : null)
  const today = istToday()
  const [step, setStep] = useState(0)
  const [source, setSource] = useState<ReqSource | null>(null)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [accountId, setAccountId] = useState<string | null>(null)
  const [custSearch, setCustSearch] = useState("")
  const [lines, setLines] = useState<Line[]>([])
  const [prodSearch, setProdSearch] = useState("")
  const [date, setDate] = useState(addDays(today, 1))
  const [pay, setPay] = useState<PayTerms>("COD")
  const [note, setNote] = useState("")
  const cq = useDebounce(custSearch, 250)
  const pq = useDebounce(prodSearch, 250)
  const customers = useRequirementCustomers(cq, open && step === 1 && cq.length > 0)
  const found = useProducts({ search: pq, limit: 6 })

  useEffect(() => {
    if (!open) return
    setStep(conversationId ? 1 : 0); setSource(conversationId ? "WHATSAPP_META" : null); setName(""); setPhone(""); setAccountId(null); setCustSearch("")
    setLines([]); setProdSearch(""); setDate(addDays(istToday(), 1)); setPay("COD"); setNote("")
  }, [open, conversationId])
  useEffect(() => {
    const p = prefill.data
    if (!p) return
    setSource(p.source); setName(p.customerName); setPhone(p.customerPhone); setAccountId(p.businessAccountId)
  }, [prefill.data])

  const problem = step === 0 ? (source ? null : "Tap how they asked.") : step === 1 ? (name.trim().length < 2 ? "Write the name." : null) : step === 2 ? (lines.length === 0 ? "Add at least one product." : null) : null
  const addLine = (p: { id: string; name: string }) => { setLines((ls) => (ls.some((l) => l.productId === p.id) ? ls.map((l) => (l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l)) : [...ls, { productId: p.id, name: p.name, quantity: 1 }])); setProdSearch("") }
  const setQty = (id: string, q: number) => setLines((ls) => ls.map((l) => (l.productId === id ? { ...l, quantity: Math.max(1, Math.min(100000, q || 1)) } : l)))

  const save = (confirmed: boolean) => {
    if (!source) return
    create.mutate(
      { customerName: name.trim(), customerPhone: phone.trim() || undefined, businessAccountId: accountId ?? undefined, waConversationId: conversationId ?? undefined, source, paymentTerms: pay, deliveryDate: date || undefined, note: note.trim() || undefined, confirmed, items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })) },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">New customer request</DialogTitle>
          <DialogDescription className="sr-only">Record what a customer asked for</DialogDescription>
        </DialogHeader>
        <ol className="flex items-center gap-1" aria-label="Steps">
          {STEPS.map((s, i) => (
            <li key={s} className="flex flex-1 flex-col items-center gap-1" aria-current={i === step ? "step" : undefined}>
              <span className={cn("flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-bold", i < step ? "border-green-600 bg-green-600 text-white" : i === step ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")}>{i < step ? <CheckCircle2 className="h-5 w-5" aria-hidden /> : i + 1}</span>
              <span className={cn("text-xs font-semibold", i === step ? "text-foreground" : "text-muted-foreground")}>{s}</span>
            </li>
          ))}
        </ol>

        {step === 0 && (
          <section aria-label="How did they ask" className="grid grid-cols-2 gap-3">
            {SOURCE_ORDER.map((s) => {
              const u = SOURCE_UI[s]
              return (
                <button key={s} type="button" aria-pressed={source === s} onClick={() => { setSource(s); setStep(1) }} className={cn("flex flex-col items-center gap-1.5 rounded-2xl border-2 p-4 text-center transition", source === s ? "border-primary ring-2 ring-primary/30" : "hover:bg-muted", s === "OTHER" && "col-span-2")}>
                  <span className={cn("flex h-14 w-14 items-center justify-center rounded-2xl border", u.tone)}><u.icon className="h-8 w-8" aria-hidden /></span>
                  <span className="text-base font-bold">{u.label}</span><span className="text-xs text-muted-foreground">{u.hint}</span>
                </button>
              )
            })}
          </section>
        )}

        {step === 1 && (
          <section aria-label="Who is asking" className="space-y-3">
            {accountId ? (
              <p className="flex items-center gap-2 rounded-xl border-2 border-green-300 bg-green-50 p-3 text-sm font-semibold"><Building2 className="h-5 w-5 text-green-700" aria-hidden />Registered business: {name}<button type="button" className="ml-auto" onClick={() => setAccountId(null)} aria-label="Remove link"><X className="h-4 w-4" /></button></p>
            ) : (
              <div>
                <div className="relative"><Search className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" aria-hidden /><Input className={cn(big, "pl-10")} value={custSearch} onChange={(e) => setCustSearch(e.target.value)} placeholder="Find a registered business" aria-label="Find a registered business" autoComplete="off" /></div>
                {cq.length > 0 && (
                  <ul className="mt-1 max-h-44 overflow-auto rounded-xl border" aria-label="Businesses found">
                    {(customers.data ?? []).map((c) => (
                      <li key={c.id}><button type="button" className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-muted" onClick={() => { setAccountId(c.id); setName(c.company_name); setPhone(c.phone ?? ""); setCustSearch("") }}><Building2 className="h-5 w-5 text-muted-foreground" aria-hidden /><span><strong>{c.company_name}</strong><br /><span className="text-xs text-muted-foreground">{c.contact_name} {c.phone}</span></span></button></li>
                    ))}
                    {!customers.isLoading && (customers.data ?? []).length === 0 && <li className="px-3 py-2.5 text-sm text-muted-foreground">Not registered — just write the name below.</li>}
                  </ul>
                )}
              </div>
            )}
            <label className="block text-sm font-semibold" htmlFor="rq-name"><User className="mr-1 inline h-4 w-4" aria-hidden />Name</label>
            <Input id="rq-name" className={big} value={name} onChange={(e) => setName(e.target.value)} placeholder="Restaurant or person" maxLength={120} />
            <label className="block text-sm font-semibold" htmlFor="rq-phone">Phone</label>
            <Input id="rq-phone" className={big} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Mobile number (optional)" maxLength={20} />
          </section>
        )}

        {step === 2 && (
          <section aria-label="What do they need" className="space-y-3">
            <div className="relative"><Search className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" aria-hidden /><Input className={cn(big, "pl-10")} value={prodSearch} onChange={(e) => setProdSearch(e.target.value)} placeholder="Search a product, tap to add" aria-label="Search a product" autoComplete="off" /></div>
            {pq.length > 0 && (
              <ul className="max-h-48 overflow-auto rounded-xl border" aria-label="Products found">
                {(found.data?.products ?? []).map((p) => (
                  <li key={p.id}><button type="button" className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted" onClick={() => addLine(p)}>
                    {p.thumbnail_url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.thumbnail_url} alt="" className="h-10 w-10 rounded-lg border object-cover" /> : <span className="h-10 w-10 rounded-lg border bg-muted" />}
                    <span className="flex-1 font-medium">{p.name}</span><Plus className="h-5 w-5 text-green-600" aria-hidden />
                  </button></li>
                ))}
                {!found.isLoading && (found.data?.products ?? []).length === 0 && <li className="px-3 py-2.5 text-sm text-muted-foreground">Nothing found.</li>}
              </ul>
            )}
            <ul className="space-y-2" aria-label="Chosen products">
              {lines.map((l) => (
                <li key={l.productId} className="flex items-center gap-2 rounded-xl border-2 p-2">
                  <span className="min-w-0 flex-1 truncate pl-1 font-semibold">{l.name}</span>
                  <Button type="button" variant="outline" size="icon" className="h-11 w-11 rounded-full" onClick={() => setQty(l.productId, l.quantity - 1)} aria-label={`Less ${l.name}`}><Minus className="h-5 w-5" /></Button>
                  <Input className="h-11 w-16 text-center text-lg font-bold" inputMode="numeric" value={l.quantity} onChange={(e) => setQty(l.productId, parseInt(e.target.value.replace(/\D/g, ""), 10))} aria-label={`${l.name} quantity`} />
                  <Button type="button" variant="outline" size="icon" className="h-11 w-11 rounded-full" onClick={() => setQty(l.productId, l.quantity + 1)} aria-label={`More ${l.name}`}><Plus className="h-5 w-5" /></Button>
                  <Button type="button" variant="ghost" size="icon" className="h-11 w-11 text-red-600" onClick={() => setLines((ls) => ls.filter((x) => x.productId !== l.productId))} aria-label={`Remove ${l.name}`}><Trash2 className="h-5 w-5" /></Button>
                </li>
              ))}
              {lines.length === 0 && <li className="rounded-xl border-2 border-dashed p-6 text-center text-sm text-muted-foreground">Search above and tap a product.</li>}
            </ul>
          </section>
        )}

        {step === 3 && (
          <section aria-label="When and payment" className="space-y-4">
            <div>
              <p className="mb-1.5 text-sm font-semibold"><CalendarDays className="mr-1 inline h-4 w-4" aria-hidden />When do they need it?</p>
              <div className="flex flex-wrap gap-2">
                {[["Today", today], ["Tomorrow", addDays(today, 1)]].map(([label, d]) => <button key={label} type="button" aria-pressed={date === d} onClick={() => setDate(d)} className={cn("h-11 rounded-full border-2 px-5 font-semibold", date === d ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>{label}</button>)}
                <Input type="date" className="h-11 w-44" min={today} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Pick a date" />
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-semibold">How will they pay?</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {PAY_ORDER.map((p) => { const u = PAY_UI[p]; return (
                  <button key={p} type="button" aria-pressed={pay === p} onClick={() => setPay(p)} className={cn("flex flex-col items-center gap-1 rounded-xl border-2 px-1 py-2.5 text-xs font-semibold", pay === p ? "border-primary bg-primary/10" : "hover:bg-muted")}><u.icon className="h-6 w-6" aria-hidden />{u.label}</button>
                ) })}
              </div>
            </div>
            <Input className="h-11" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" maxLength={500} aria-label="Note" />
            <div className="grid grid-cols-2 gap-3 pt-1">
              <Button type="button" variant="outline" className="h-20 flex-col justify-center gap-0.5 border-2 border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100" disabled={create.isPending} onClick={() => save(false)}><HelpCircle className="h-6 w-6" aria-hidden /><span className="text-base font-bold">Maybe</span><span className="text-[11px] font-normal">just asking</span></Button>
              <Button type="button" className="h-20 flex-col justify-center gap-0.5 bg-green-600 hover:bg-green-700" disabled={create.isPending} onClick={() => save(true)}><CheckCircle2 className="h-6 w-6" aria-hidden /><span className="text-base font-bold">Sure</span><span className="text-[11px] font-normal">they will take it</span></Button>
            </div>
          </section>
        )}

        {problem && step < 3 && step > 0 && <p role="status" className="text-sm text-amber-700">{problem}</p>}
        <div className="flex justify-between gap-2">
          <Button type="button" variant="ghost" className="h-11" disabled={step === 0} onClick={() => setStep((s) => s - 1)}><ArrowLeft className="mr-1.5 h-5 w-5" aria-hidden />Back</Button>
          {step > 0 && step < 3 && <Button type="button" className="h-11 px-6" disabled={Boolean(problem)} onClick={() => setStep((s) => s + 1)}>Next<ArrowRight className="ml-1.5 h-5 w-5" aria-hidden /></Button>}
        </div>
      </DialogContent>
    </Dialog>
  )
}
