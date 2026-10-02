"use client"

import { Input } from "@/components/ui/input"
import { useActiveShopsForSwitcher } from "@/hooks/useShops"
import { PERIODS, periodProblem } from "./business-helpers"
import type { PeriodId } from "@/types/business.types"

export interface PeriodState { period: PeriodId; from?: string; to?: string }

interface Props {
  value: PeriodState
  onChange: (v: PeriodState) => void
  shopId?: string
  onShop?: (id: string) => void
  channel?: string
  onChannel?: (c: string) => void
}

/** Today / 7 Days / 30 Days / Custom, plus the optional store and B2B-B2C filters from the agreement. */
export function PeriodBar({ value, onChange, shopId, onShop, channel, onChannel }: Props) {
  const shops = useActiveShopsForSwitcher()
  const problem = periodProblem(value)
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1" role="group" aria-label="Period">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={value.period === p.id}
              onClick={() => onChange({ ...value, period: p.id })}
              className={`rounded-full border px-3 py-1 text-xs ${value.period === p.id ? "border-primary bg-primary/10 font-semibold" : "hover:bg-muted"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {value.period === "custom" && (
          <div className="flex items-center gap-2 text-xs">
            <label htmlFor="bp-from">From</label>
            <Input id="bp-from" type="date" value={value.from ?? ""} onChange={(e) => onChange({ ...value, from: e.target.value })} className="h-8 w-36" />
            <label htmlFor="bp-to">To</label>
            <Input id="bp-to" type="date" value={value.to ?? ""} onChange={(e) => onChange({ ...value, to: e.target.value })} className="h-8 w-36" />
          </div>
        )}
        {onShop && (
          <select aria-label="Store" className="h-8 rounded-md border bg-background px-2 text-xs" value={shopId ?? ""} onChange={(e) => onShop(e.target.value)}>
            <option value="">All stores</option>
            {(shops.data?.items ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        {onChannel && (
          <div className="flex gap-1" role="group" aria-label="Customer type">
            {[["ALL", "All"], ["B2B", "B2B"], ["B2C", "B2C"]].map(([id, label]) => (
              <button key={id} type="button" aria-pressed={(channel ?? "ALL") === id} onClick={() => onChannel(id)} className={`rounded-full border px-3 py-1 text-xs ${(channel ?? "ALL") === id ? "border-primary bg-primary/10 font-semibold" : "hover:bg-muted"}`}>{label}</button>
            ))}
          </div>
        )}
      </div>
      {problem && <p role="alert" className="text-xs text-red-600">{problem}</p>}
    </div>
  )
}
