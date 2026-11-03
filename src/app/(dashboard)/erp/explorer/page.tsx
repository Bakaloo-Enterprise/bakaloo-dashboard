"use client"

import { ErpGuard } from "@/components/erp/ErpGuard"
import { ErpSkin } from "@/components/erp/skin/ui"
import { ExplorerView } from "@/components/erp/skin/ExplorerView"

export default function ExplorerPage() {
  return <ErpGuard>{() => <ErpSkin><ExplorerView /></ErpSkin>}</ErpGuard>
}
