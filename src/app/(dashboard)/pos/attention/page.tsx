"use client"

import Link from "next/link"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ATTENTION_LINK, formatWaiting } from "@/components/pos/pos-helpers"
import { useAttention, usePosMe, usePosMutations } from "@/hooks/usePos"
import { cn } from "@/lib/utils"

const SEV = { HIGH: "border-red-300 bg-red-50", MEDIUM: "border-amber-300 bg-amber-50", LOW: "border-slate-200 bg-slate-50" } as const

export default function AttentionPage() {
  const q = useAttention()
  const me = usePosMe()
  const { resolve } = usePosMutations()
  return (
    <div className="space-y-3">
      <PageHeader title="Needs attention" subtitle="Problems found live: missing items, wrong scans, delays, no rider, rejected QR codes." />
      {q.isLoading && <Skeleton className="h-32 w-full" />}
      {q.isError && <p role="alert" className="text-sm text-red-600">Could not load this list.</p>}
      {q.data && q.data.items.length === 0 && <p role="status" className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">Nothing needs attention right now.</p>}
      <ul className="space-y-2">
        {(q.data?.items ?? []).map((i) => (
          <li key={`${i.kind}:${i.orderId}:${i.ref}`} className={cn("flex flex-wrap items-center justify-between gap-2 rounded-md border p-3", SEV[i.severity])}>
            <div>
              <p className="text-sm font-semibold">{i.label}{i.orderNumber && <> · #{i.orderNumber}</>}</p>
              <p className="text-xs">{i.text}{i.minutes != null && ` · ${formatWaiting(i.minutes)} ago`}</p>
            </div>
            <div className="flex gap-2">
              {i.orderId && <Button asChild size="sm" variant="outline"><Link href={`/pos/orders/${i.orderId}`}>{ATTENTION_LINK[i.kind] ?? "Open the order"}</Link></Button>}
              {i.resolvable && me.data?.abilities.manage && i.orderId && (
                <Button size="sm" variant="ghost" disabled={resolve.isPending} onClick={() => resolve.mutate({ orderId: i.orderId as string, kind: i.kind, ref: i.ref })}>Mark as dealt with</Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
