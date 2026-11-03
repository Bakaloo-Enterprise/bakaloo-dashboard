"use client"

import { ErpGuard } from "@/components/erp/ErpGuard"
import { ErpSkin } from "@/components/erp/skin/ui"
import { WastageView } from "@/components/erp/skin/WastageView"

export default function WastagePage() {
  return <ErpGuard>{() => <ErpSkin><WastageView /></ErpSkin>}</ErpGuard>
}
