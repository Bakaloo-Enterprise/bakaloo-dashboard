"use client"

import { useState } from "react"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useProcurementMutations } from "@/hooks/useBusiness"
import { cn } from "@/lib/utils"

const QUICK: Array<[string, number, "G" | "ML"]> = [["250 g", 250, "G"], ["500 g", 500, "G"], ["1 kg", 1000, "G"], ["5 kg", 5000, "G"], ["500 ml", 500, "ML"], ["1 L", 1000, "ML"]]

/** "How big is one unit?" — a few big buttons for the common sizes, or type your own. */
export function PackSizeEditor({ productId, compact = false }: { productId: string; compact?: boolean }) {
  const { packSize } = useProcurementMutations()
  const [custom, setCustom] = useState("")
  const [unit, setUnit] = useState<"G" | "ML">("G")
  const n = parseInt(custom.replace(/\D/g, ""), 10)
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {QUICK.map(([label, size, u]) => (
          <button key={label} type="button" disabled={packSize.isPending} onClick={() => packSize.mutate({ productId, size, unit: u })} className={cn("rounded-full border-2 font-bold hover:bg-muted", compact ? "px-2.5 py-1 text-xs" : "h-11 px-4 text-sm")}>{label}</button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Input className={compact ? "h-8 w-24" : "h-11 w-28"} inputMode="numeric" placeholder="Other" value={custom} onChange={(e) => setCustom(e.target.value)} aria-label="Size" />
        {(["G", "ML"] as const).map((u) => <button key={u} type="button" aria-pressed={unit === u} onClick={() => setUnit(u)} className={cn("rounded-lg border-2 px-3 font-bold", compact ? "h-8 text-xs" : "h-11 text-sm", unit === u ? "border-primary bg-primary/10" : "hover:bg-muted")}>{u === "G" ? "grams" : "ml"}</button>)}
        <Button type="button" size={compact ? "sm" : "default"} className={compact ? "" : "h-11"} disabled={!(n > 0) || packSize.isPending} onClick={() => packSize.mutate({ productId, size: n, unit })}><Check className="mr-1 h-4 w-4" aria-hidden />Save</Button>
      </div>
    </div>
  )
}
