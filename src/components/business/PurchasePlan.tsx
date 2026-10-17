"use client"

import { CheckCircle2, Eye, PackageOpen, ShoppingBasket, ShoppingCart, Warehouse } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { PlanItem } from "@/types/business.types"
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

function Card({ p, today }: { p: PlanItem; today: string }) {
  const buy = p.status === "BUY"
  return (
    <li className={cn("flex flex-col gap-3 rounded-2xl border-2 bg-card p-3 shadow-sm", buy ? "border-red-300" : p.status === "WATCH" ? "border-amber-300" : "border-green-300")}>
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
export function PurchasePlan() {
  const plan = usePlan()
  const today = istToday()
  if (plan.isLoading) return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}</div>
  if (plan.isError) return <p role="alert" className="text-sm text-red-600">Could not load the shopping list.</p>
  const items = plan.data?.items ?? []
  const buyCount = plan.data?.totals.toBuyProducts ?? 0
  return (
    <div className="space-y-3">
      <div className={cn("flex items-center gap-3 rounded-2xl border-2 p-4", buyCount > 0 ? "border-red-300 bg-red-50" : "border-green-300 bg-green-50")}>
        {buyCount > 0 ? <ShoppingCart className="h-9 w-9 text-red-600" aria-hidden /> : <CheckCircle2 className="h-9 w-9 text-green-600" aria-hidden />}
        <div>
          <p className="text-lg font-bold">{buyCount > 0 ? `${buyCount} ${buyCount === 1 ? "thing" : "things"} to buy` : "Nothing to buy"}</p>
          <p className="text-sm text-muted-foreground">{buyCount > 0 ? "Red cards first. Call the vendor, then tap “New purchase”." : "All customer needs are covered by stock."}</p>
        </div>
      </div>
      {items.length === 0 ? (
        <p role="status" className="rounded-2xl border-2 border-dashed p-10 text-center text-muted-foreground"><PackageOpen className="mx-auto mb-2 h-10 w-10" aria-hidden />No one needs anything yet.<br />Add a customer request to start.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map((p) => <Card key={p.productId} p={p} today={today} />)}</ul>
      )}
      <details className="text-xs text-muted-foreground"><summary className="cursor-pointer select-none">How is this worked out?</summary><p className="mt-1">{plan.data?.note}</p></details>
    </div>
  )
}
