"use client"

import { useState } from "react"
import { CheckCircle2, Eye, ListPlus, PackageOpen, Search, ShoppingBasket, ShoppingCart, Warehouse } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { useBuyList } from "@/hooks/useBuyList"
import { BuyListDialog } from "./BuyListDialog"
import { QuickBuyDialog } from "./QuickBuyDialog"
import { cn } from "@/lib/utils"
import type { PlanItem } from "@/types/business.types"
import { Button } from "@/components/ui/button"
import { usePlan } from "@/hooks/useBusiness"
import { formatRupees, istToday } from "./business-helpers"
import { dayWord } from "./requirement-helpers"

/** Big number + picture + one word. Reads the same without any language. */
function Stat({ icon: Icon, value, label, tone }: { icon: typeof Warehouse; value: number; label: string; tone: string }) {
  return (
    <div className={cn("flex flex-1 flex-col items-center rounded-xl border px-2 py-2", tone)}>
      <Icon className="h-5 w-5" aria-hidden />
      <span className="text-xl font-bold tabular-nums leading-tight">{value}</span>
      <span className="text-[11px] font-medium">{label}</span>
    </div>
  )
}

function Card({ p, today, onBuy, inList }: { p: PlanItem; today: string; onBuy?: () => void; inList: number }) {
  const buy = p.status === "BUY"
  const tone = buy ? "border-red-300" : p.status === "WATCH" ? "border-amber-300" : "border-green-300"
  return (
    <li className={cn("relative flex flex-col gap-3 rounded-2xl border-2 bg-card p-3 shadow-sm transition-shadow", tone, onBuy && "cursor-pointer hover:shadow-md focus-within:ring-2 focus-within:ring-primary")}>
      {onBuy && <button type="button" onClick={onBuy} className="absolute inset-0 z-10 rounded-2xl focus:outline-none" aria-label={`Buy ${p.name}${buy ? `, ${p.toBuy} needed` : ""}`} />}
      <div className="flex items-center gap-3">
        {p.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl border object-cover" />
        ) : (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border bg-muted"><PackageOpen className="h-7 w-7 text-muted-foreground" aria-hidden /></span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">{p.name}</p>
          <p className="truncate text-xs text-muted-foreground">{p.unit ?? "per piece"}{p.firstDue ? ` · needed ${dayWord(p.firstDue, today)}` : ""}</p>
        </div>
        {buy ? (
          <span className="flex shrink-0 flex-col items-center rounded-xl bg-red-600 px-3 py-1.5 text-white" aria-label={`Buy ${p.toBuy}`}>
            <ShoppingCart className="h-5 w-5" aria-hidden /><span className="text-xl font-extrabold leading-none tabular-nums">{p.toBuy}</span><span className="text-[10px] font-semibold uppercase">to buy</span>
          </span>
        ) : p.status === "WATCH" ? (
          <span className="flex shrink-0 flex-col items-center rounded-xl bg-amber-100 px-3 py-1.5 text-amber-800" aria-label="Keep an eye">
            <Eye className="h-5 w-5" aria-hidden /><span className="text-[11px] font-semibold">Watch</span>
          </span>
        ) : (
          <span className="flex shrink-0 flex-col items-center rounded-xl bg-green-100 px-3 py-1.5 text-green-700" aria-label="Enough stock">
            <CheckCircle2 className="h-6 w-6" aria-hidden /><span className="text-[11px] font-semibold">Enough</span>
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <Stat icon={ShoppingBasket} value={p.need} label="Need" tone="border-slate-200 bg-slate-50 text-slate-700" />
        <Stat icon={Warehouse} value={p.have} label="Have" tone="border-sky-200 bg-sky-50 text-sky-700" />
        <Stat icon={ShoppingCart} value={p.toBuy} label="Buy" tone={buy ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"} />
      </div>
      {onBuy && <p className={cn("flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-bold", buy ? "bg-red-600 text-white" : "bg-muted text-foreground")}><span className="flex items-center gap-1.5"><ShoppingCart className="h-4 w-4" aria-hidden />{buy ? `Tap to buy ${p.toBuy}` : "Tap to buy anyway"}</span>{inList > 0 && <span className="flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-xs text-red-700"><ListPlus className="h-3.5 w-3.5" aria-hidden />{inList} in list</span>}</p>}
      <p className="text-xs text-muted-foreground">
        {p.committed > 0 && <span>Customers: <strong>{p.committed}</strong> </span>}
        {p.shopLow > 0 && <span>· Shelves low: <strong>{p.shopLow}</strong> </span>}
        {p.incoming > 0 && <span>· On the way: <strong>{p.incoming}</strong> </span>}
        {p.projected > 0 && <span>· Maybe: <strong>{p.projected}</strong> </span>}
        {p.lastPrice !== null && <span>· Last paid {formatRupees(p.lastPrice)}{p.lastVendor ? ` (${p.lastVendor})` : ""}</span>}
      </p>
    </li>
  )
}

/** "What do we need to buy?" — every product somebody needs, red ones first. */
export function PurchasePlan({ manage = false }: { manage?: boolean }) {
  const plan = usePlan()
  const today = istToday()
  const buyList = useBuyList()
  const [show, setShow] = useState<"buy" | "all">("buy")
  const [search, setSearch] = useState("")
  const [target, setTarget] = useState<string | null>(null)
  const [listOpen, setListOpen] = useState(false)
  if (plan.isLoading) return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}</div>
  if (plan.isError) return <p role="alert" className="text-sm text-red-600">Could not load the shopping list.</p>
  const all = plan.data?.items ?? []
  const buyCount = plan.data?.totals.toBuyProducts ?? 0
  const items = all.filter((p) => (show === "all" || p.status !== "OK") && p.name.toLowerCase().includes(search.trim().toLowerCase()))
  const buyItems = all.filter((p) => p.status === "BUY")
  const current = all.find((p) => p.productId === target) ?? null
  const nextBuy = current ? buyItems.find((p) => p.productId !== current.productId && !buyList.list.some((l) => l.productId === p.productId)) : undefined
  const inList = (id: string) => buyList.list.filter((l) => l.productId === id).reduce((n, l) => n + l.qty, 0)
  return (
    <div className="space-y-3">
      <div className={cn("flex items-center gap-3 rounded-2xl border-2 p-4", buyCount > 0 ? "border-red-300 bg-red-50" : "border-green-300 bg-green-50")}>
        {buyCount > 0 ? <ShoppingCart className="h-9 w-9 text-red-600" aria-hidden /> : <CheckCircle2 className="h-9 w-9 text-green-600" aria-hidden />}
        <div>
          <p className="text-lg font-bold">{buyCount > 0 ? `${buyCount} ${buyCount === 1 ? "thing" : "things"} to buy` : "Nothing to buy"}</p>
          <p className="text-sm text-muted-foreground">{buyCount > 0 ? (manage ? "Tap a card to buy it — the quantity and supplier are filled in for you." : "Red cards first.") : "All customer needs are covered by stock."}</p>
        </div>
        {manage && <Button type="button" variant="outline" className="ml-auto h-12 border-2 text-base font-bold" onClick={() => setListOpen(true)}><ShoppingBasket className="mr-1.5 h-5 w-5" aria-hidden />Buy list{buyList.list.length > 0 && <span className="ml-1.5 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">{buyList.list.length}</span>}</Button>}
      </div>
      {all.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {([["buy", "Needs buying", all.filter((p) => p.status !== "OK").length], ["all", "Everything", all.length]] as const).map(([id, label, n]) => (
            <button key={id} type="button" aria-pressed={show === id} onClick={() => setShow(id)} className={cn("rounded-full border px-3.5 py-1.5 text-sm font-semibold", show === id ? "border-primary bg-primary/10" : "hover:bg-muted")}>{label} <span className="ml-1 text-muted-foreground">{n}</span></button>
          ))}
          <label className="relative ml-auto min-w-[200px]"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden /><span className="sr-only">Search the list</span><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a product" className="h-10 rounded-full pl-9" /></label>
        </div>
      )}
      {items.length === 0 ? (
        <p role="status" className="rounded-2xl border-2 border-dashed p-10 text-center text-muted-foreground"><PackageOpen className="mx-auto mb-2 h-10 w-10" aria-hidden />{all.length === 0 ? <>No one needs anything yet.<br />Add a customer request to start.</> : "Nothing matches."}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map((p) => <Card key={p.productId} p={p} today={today} inList={inList(p.productId)} onBuy={manage ? () => setTarget(p.productId) : undefined} />)}</ul>
      )}
      <QuickBuyDialog open={Boolean(current)} item={current} onClose={() => setTarget(null)} onNext={nextBuy ? () => setTarget(nextBuy.productId) : undefined} />
      <BuyListDialog open={listOpen} onClose={() => setListOpen(false)} manage={manage} />
      <details className="text-xs text-muted-foreground"><summary className="cursor-pointer select-none">How is this worked out?</summary><p className="mt-1">{plan.data?.note}</p></details>
    </div>
  )
}
