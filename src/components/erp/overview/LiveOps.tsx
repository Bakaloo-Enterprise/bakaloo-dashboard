"use client"

import { BellRing, ChefHat, CircleDollarSign, Clock3, HandCoins, Bike } from "lucide-react"
import type { OverviewData } from "@/types/overview.types"
import { count, inr } from "../format"
import { Tile } from "../kit"

/** Right-now work: what needs a hand this minute. Not tied to the period switch. */
export function LiveOps({ d }: { d: OverviewData }) {
  const l = d.live
  return (
    <section aria-label="Right now" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Tile tone={l.newOrders > 0 ? "rose" : "slate"} icon={<BellRing className="h-5 w-5" />} label="New" value={count(l.newOrders)} sub="to accept" href="/orders?status=CONFIRMED" />
      <Tile tone="amber" icon={<ChefHat className="h-5 w-5" />} label="Packing" value={count(l.preparing)} sub="being prepared" href="/orders?status=PREPARING" />
      <Tile tone="blue" icon={<Bike className="h-5 w-5" />} label="On the way" value={count(l.outForDelivery)} sub="with riders" href="/orders?status=OUT_FOR_DELIVERY" />
      <Tile tone="slate" icon={<Clock3 className="h-5 w-5" />} label="Unpaid" value={count(l.awaitingPayment)} sub="waiting to pay" href="/orders?status=PENDING" />
      <Tile tone="green" icon={<HandCoins className="h-5 w-5" />} label="Cash to collect" value={inr(l.codToCollect)} sub={`${inr(l.codCollectedToday)} collected today`} help={d.definitions.codToCollect} />
      <Tile tone={l.pendingRefundRequests > 0 ? "violet" : "slate"} icon={<CircleDollarSign className="h-5 w-5" />} label="Refund asks" value={count(l.pendingRefundRequests)} sub="waiting for you" href="/refund-requests" />
    </section>
  )
}
