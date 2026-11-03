"use client"

import { ErpGuard } from "@/components/erp/ErpGuard"
import { ErpSkin } from "@/components/erp/skin/ui"
import { FounderView } from "@/components/erp/skin/FounderView"

export default function FounderPage() {
  return <ErpGuard>{() => <ErpSkin><FounderView /></ErpSkin>}</ErpGuard>
}
