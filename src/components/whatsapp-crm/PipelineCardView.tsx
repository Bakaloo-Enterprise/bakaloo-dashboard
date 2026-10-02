"use client"

import { Flame, ShoppingCart, Clock3, ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn, formatINR } from "@/lib/utils"
import type { PipelineCard } from "@/types/whatsapp-crm.types"
import { LabelChip } from "./LabelChip"
import { cardTitle, formatWait, NEXT_ACTION_LABEL, PRIORITY_LABEL } from "./pipeline-helpers"

/** The card's visual content. Used both in the column and in the drag overlay. */
export function PipelineCardView({ card, dragging = false }: { card: PipelineCard; dragging?: boolean }) {
  const title = cardTitle(card)
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3 text-left shadow-sm",
        card.priority === "HIGH" && "border-l-4 border-l-red-500",
        dragging && "rotate-1 shadow-lg ring-2 ring-primary/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="truncate text-sm font-semibold">{title}</span>
        {card.unread_count > 0 && (
          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[11px] font-semibold text-white" aria-label={`${card.unread_count} unread`}>
            {card.unread_count}
          </span>
        )}
      </div>

      <div className="mt-1 flex flex-wrap gap-1">
        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
          {card.source === "META_AD" ? "Meta Ad" : "WhatsApp"}
        </Badge>
        {card.is_b2b && <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">B2B</Badge>}
        {card.labels.slice(0, 2).map((l) => (
          <LabelChip key={l.id} label={l} />
        ))}
        {card.labels.length > 2 && <span className="text-[10px] text-muted-foreground">+{card.labels.length - 2}</span>}
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <dt className="sr-only">Orders</dt>
          <dd>Orders: <span className="font-medium text-foreground">{card.order_count}</span></dd>
        </div>
        {card.open_cart_value > 0 && (
          <div className="flex items-center gap-1">
            <ShoppingCart className="h-3 w-3" aria-hidden />
            <dt className="sr-only">Open cart</dt>
            <dd className="font-medium text-foreground">{formatINR(card.open_cart_value)}</dd>
          </div>
        )}
        {card.waitingMinutes > 0 && (
          <div className="col-span-2 flex items-center gap-1">
            <Clock3 className="h-3 w-3" aria-hidden />
            <dt className="sr-only">Waiting for reply</dt>
            <dd>Waiting <span className="font-medium text-foreground">{formatWait(card.waitingMinutes)}</span></dd>
          </div>
        )}
      </dl>

      <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2 text-[11px]">
        <span className="truncate text-muted-foreground">{card.assigned_name ? `Owner: ${card.assigned_name}` : "Unassigned"}</span>
        {card.priority !== "NORMAL" && (
          <span className={cn("flex shrink-0 items-center gap-0.5 font-medium", card.priority === "HIGH" ? "text-red-600" : "text-amber-600")}>
            <Flame className="h-3 w-3" aria-hidden /> {PRIORITY_LABEL[card.priority]}
          </span>
        )}
      </div>
      {card.nextAction !== "NO_ACTION" && (
        <div className="mt-1.5 flex items-center gap-1 rounded bg-muted px-2 py-1 text-[11px] font-medium">
          <ArrowRight className="h-3 w-3" aria-hidden /> Next: {NEXT_ACTION_LABEL[card.nextAction]}
        </div>
      )}
    </div>
  )
}
