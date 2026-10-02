"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { AlertTriangle, LayoutGrid, Printer, Users2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useAttention, usePosMe, posErrorMessage } from "@/hooks/usePos"
import { useShopContextStore } from "@/store/shop-context.store"
import { cn } from "@/lib/utils"
import { FeatureGate } from "@/components/FeatureGate"

const TABS = [
  { href: "/pos", label: "Live board", icon: LayoutGrid, exact: true },
  { href: "/pos/attention", label: "Needs attention", icon: AlertTriangle },
  { href: "/pos/printing", label: "Printing", icon: Printer },
  { href: "/pos/team", label: "Team & performance", icon: Users2 },
]

/** Locked until a Developer Super Admin releases it — the shell (and its data hooks) only mounts once it is open. */
export default function PosLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate feature="store_pos">
      <PosShell>{children}</PosShell>
    </FeatureGate>
  )
}

/** The POS works on ONE store at a time: a store user is always in theirs, HQ must pick one first. */
function PosShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const activeShopId = useShopContextStore((s) => s.activeShopId)
  const me = usePosMe()
  const attention = useAttention(Boolean(activeShopId) && me.isSuccess)

  if (!activeShopId) {
    return (
      <div role="status" className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        Choose a store from the store switcher at the top to open its fulfillment board.
      </div>
    )
  }
  if (me.isLoading) return <Skeleton className="h-40 w-full" />
  if (me.isError) {
    return <p role="alert" className="rounded-md bg-red-50 p-4 text-sm text-red-700">{posErrorMessage(me.error)}</p>
  }
  if (!me.data?.abilities.view) {
    return <p role="alert" className="rounded-md bg-amber-50 p-4 text-sm text-amber-900">Your role cannot open the fulfillment screens for this store.</p>
  }

  const high = attention.data?.counts.high ?? 0
  const total = attention.data?.counts.total ?? 0
  return (
    <div className="space-y-4">
      <nav aria-label="Fulfillment sections" className="flex flex-wrap gap-1 border-b">
        {TABS.map((t) => {
          const active = t.exact ? pathname === t.href || pathname.startsWith("/pos/orders") : pathname.startsWith(t.href)
          const Icon = t.icon
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn("-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm", active ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {t.label}
              {t.href === "/pos/attention" && total > 0 && (
                <span className={cn("rounded-full px-1.5 text-[11px] font-semibold", high > 0 ? "bg-red-600 text-white" : "bg-amber-200 text-amber-900")} aria-label={`${total} items need attention`}>
                  {total}
                </span>
              )}
            </Link>
          )
        })}
      </nav>
      {children}
    </div>
  )
}
