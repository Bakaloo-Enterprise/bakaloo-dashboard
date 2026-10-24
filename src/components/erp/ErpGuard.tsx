"use client"

import type { ReactNode } from "react"
import { FeatureGate } from "@/components/FeatureGate"
import { Forbidden } from "@/components/shared/forbidden"
import { Skeleton } from "@/components/ui/skeleton"
import { useBizMe } from "@/hooks/useBusiness"

function Allowed({ children }: { children: (manage: boolean) => ReactNode }) {
  const me = useBizMe()
  if (me.isLoading) return <Skeleton className="h-40 w-full" />
  if (!me.data?.analyticsBusiness) return <Forbidden />
  return <>{children(Boolean(me.data.procurementManage))}</>
}

/** Every Operations ERP page: the "in development" lock first, then the reader's permission. `manage` = may change targets. */
export function ErpGuard({ children }: { children: (manage: boolean) => ReactNode }) {
  return <FeatureGate feature="erp"><Allowed>{children}</Allowed></FeatureGate>
}
