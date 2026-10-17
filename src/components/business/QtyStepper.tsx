"use client"

import { Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/** − [number] + : big round buttons so nobody has to type. */
export function QtyStepper({ value, onChange, min = 0, max, label }: { value: number; onChange: (n: number) => void; min?: number; max?: number; label: string }) {
  const set = (n: number) => onChange(Math.max(min, Math.min(max ?? 10_000_000, Number.isFinite(n) ? n : min)))
  return (
    <div className="flex items-center gap-1.5">
      <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-full" onClick={() => set(value - 1)} disabled={value <= min} aria-label={`Less ${label}`}><Minus className="h-4 w-4" /></Button>
      <Input className="h-10 w-16 text-center text-lg font-bold" inputMode="numeric" value={value} onChange={(e) => set(parseInt(e.target.value.replace(/\D/g, ""), 10))} aria-label={label} />
      <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-full" onClick={() => set(value + 1)} disabled={max !== undefined && value >= max} aria-label={`More ${label}`}><Plus className="h-4 w-4" /></Button>
    </div>
  )
}
