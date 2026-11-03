"use client"

import { ErpGuard } from "@/components/erp/ErpGuard"
import { ErpSkin } from "@/components/erp/skin/ui"
import { DailyOpsView } from "@/components/erp/skin/DailyOpsView"

export default function DailyOpsPage() {
  return <ErpGuard>{(manage) => <ErpSkin><DailyOpsView manage={manage} /></ErpSkin>}</ErpGuard>
}
