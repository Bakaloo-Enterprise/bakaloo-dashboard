"use client"

import { Forbidden } from "@/components/shared/forbidden"
import { Skeleton } from "@/components/ui/skeleton"
import { BusinessAnalyticsView } from "@/components/erp/skin/BusinessAnalyticsView"
import { ErpSkin } from "@/components/erp/skin/ui"
import { useBizMe } from "@/hooks/useBusiness"

export default function BusinessAnalyticsPage() {
  const me = useBizMe()
  if (me.isLoading) return <Skeleton className="h-40 w-full" />
  if (!me.data?.analyticsBusiness) return <Forbidden />
  return <ErpSkin><BusinessAnalyticsView /></ErpSkin>
}
