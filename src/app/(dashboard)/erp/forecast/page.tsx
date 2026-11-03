"use client"

import { ErpGuard } from "@/components/erp/ErpGuard"
import { ErpSkin } from "@/components/erp/skin/ui"
import { ForecastView } from "@/components/erp/skin/ForecastView"

export default function ForecastPage() {
  return <ErpGuard>{() => <ErpSkin><ForecastView /></ErpSkin>}</ErpGuard>
}
