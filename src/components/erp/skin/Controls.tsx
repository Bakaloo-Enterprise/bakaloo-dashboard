"use client"

/** Small controls in the reference style: store picker, ← Today → day stepper, date window. */
import { CalendarRange } from "lucide-react"
import { useActiveShopsForSwitcher } from "@/hooks/useShops"
import { PERIODS } from "@/components/business/business-helpers"
import type { PeriodState } from "@/components/business/PeriodBar"
import { Seg } from "./ui"
import { cn } from "@/lib/utils"

/** `.fld` field, 190px in the reference (217 here: the skin runs at zoom .875). */
export function ShopPick({ value, onChange, className }: { value: string; onChange: (id: string) => void; className?: string }) {
  const shops = useActiveShopsForSwitcher()
  return (
    <select aria-label="Store" value={value} onChange={(e) => onChange(e.target.value)} className={cn("fld fld-sans !w-[217px] font-medium", className)}>
      <option value="">All stores</option>
      {(shops.data?.items ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
  )
}

const stepBtn = "rounded-lg border border-[#e3e8dd] bg-white px-2.5 py-2 text-xs text-slate-500 hover:border-lime-300 hover:text-lime-700 disabled:cursor-not-allowed disabled:opacity-40"

/** ← Today → */
export function DayStepper({ onPrev, onToday, onNext, canNext }: { onPrev: () => void; onToday: () => void; onNext: () => void; canNext: boolean }) {
  return (
    <div className="flex gap-1">
      <button type="button" aria-label="Previous day" onClick={onPrev} className={stepBtn}>←</button>
      <button type="button" onClick={onToday} className={cn(stepBtn, "font-medium text-slate-600")}>Today</button>
      <button type="button" aria-label="Next day" onClick={onNext} disabled={!canNext} className={stepBtn}>→</button>
    </div>
  )
}

/** The reference's "Date window" strip, driving the dashboard's own period state. */
export function DateWindow({ value, onChange, shopId, onShop, problem }: {
  value: PeriodState; onChange: (v: PeriodState) => void; shopId?: string; onShop?: (id: string) => void; problem?: string | null
}) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#e3e8dd] bg-white px-3 py-2">
        <CalendarRange className="size-3.5 text-emerald-700" />
        <span className="text-e10 font-semibold uppercase tracking-wide text-slate-400">Date window</span>
        <Seg size="xs" label="Period" value={value.period} onChange={(period) => onChange({ ...value, period })} options={PERIODS.map((p) => ({ id: p.id, label: p.label }))} />
        {value.period === "custom" && (
          <>
            <input aria-label="Start date" type="date" value={value.from ?? ""} onChange={(e) => onChange({ ...value, from: e.target.value })} className="w-[147px] bg-transparent text-xs outline-none" style={{ minHeight: 0 }} />
            <span className="text-slate-300">to</span>
            <input aria-label="End date" type="date" min={value.from} value={value.to ?? ""} onChange={(e) => onChange({ ...value, to: e.target.value })} className="w-[147px] bg-transparent text-xs outline-none" style={{ minHeight: 0 }} />
          </>
        )}
        {onShop && <ShopPick value={shopId ?? ""} onChange={onShop} className="ml-auto !w-[190px]" />}
      </div>
      {problem && <p role="alert" className="text-e11 text-rose-600">{problem}</p>}
    </div>
  )
}
