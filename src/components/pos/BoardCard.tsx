import Link from "next/link"
import { AlertTriangle, Bike, Clock, Package, Printer } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { formatWaiting } from "./pos-helpers"
import type { BoardCard as Card } from "@/types/pos.types"

export function BoardCardView({ card }: { card: Card }) {
  const flags: string[] = []
  if (card.flags.missing) flags.push("Item missing")
  if (card.flags.printFailed) flags.push("Print failed")
  if (card.flags.paymentFailed) flags.push("Payment issue")
  const pct = card.progress && card.progress.total > 0 ? Math.round((card.progress.done / card.progress.total) * 100) : null
  return (
    <Link
      href={`/pos/orders/${card.id}`}
      className={cn("block rounded-lg border bg-card p-3 text-sm shadow-sm transition hover:border-primary hover:shadow", card.late && "border-red-300 bg-red-50/60 dark:bg-red-950/20")}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold">#{card.orderNumber}</span>
        <span className={cn("flex items-center gap-1 text-xs", card.late ? "font-semibold text-red-700" : "text-muted-foreground")} title={card.late ? "Waiting longer than expected" : undefined}>
          <Clock className="h-3 w-3" aria-hidden />
          {formatWaiting(card.waitingMinutes)}
          {card.late && <span className="sr-only"> — late</span>}
        </span>
      </div>
      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        <Package className="h-3 w-3" aria-hidden />
        {card.items.lines} item{card.items.lines === 1 ? "" : "s"} · {card.items.units} unit{card.items.units === 1 ? "" : "s"}
        {card.packages > 0 && card.lane !== "NEW" && card.lane !== "PICKING" && card.lane !== "PACKING" && <> · {card.packages} package{card.packages === 1 ? "" : "s"}</>}
      </p>
      {card.area && <p className="mt-0.5 truncate text-xs text-muted-foreground">{card.area}</p>}
      {card.slot && <p className="mt-0.5 text-xs text-muted-foreground">Slot: {card.slot}</p>}
      {pct != null && (
        <div className="mt-2" aria-label={`${card.progress!.done} of ${card.progress!.total} done`}>
          <Progress value={pct} className="h-1.5" />
        </div>
      )}
      {(card.picker || card.packer) && (
        <p className="mt-2 text-xs">
          {card.picker && <span>Picker: {card.picker.name ?? "—"}</span>}
          {card.picker && card.packer && " · "}
          {card.packer && <span>Packer: {card.packer.name ?? "—"}</span>}
        </p>
      )}
      {card.rider && (
        <p className="mt-1 flex items-center gap-1 text-xs">
          <Bike className="h-3 w-3" aria-hidden />
          {card.rider.name}
        </p>
      )}
      {flags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {flags.map((f) => (
            <span key={f} className="flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-medium text-red-800">
              {f === "Print failed" ? <Printer className="h-3 w-3" aria-hidden /> : <AlertTriangle className="h-3 w-3" aria-hidden />}
              {f}
            </span>
          ))}
        </div>
      )}
    </Link>
  )
}
