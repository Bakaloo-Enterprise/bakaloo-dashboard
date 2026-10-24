"use client"

import { Store } from "lucide-react"
import { useActiveShopsForSwitcher } from "@/hooks/useShops"

export function ShopSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const shops = useActiveShopsForSwitcher()
  return (
    <label className="relative inline-flex items-center">
      <Store className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" aria-hidden />
      <span className="sr-only">Store</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 appearance-none rounded-xl border bg-card pl-9 pr-8 text-sm font-medium shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <option value="">All stores</option>
        {(shops.data?.items ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    </label>
  )
}
