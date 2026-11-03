"use client"

import { ErpGuard } from "@/components/erp/ErpGuard"
import { ErpSkin } from "@/components/erp/skin/ui"
import { AccountingView } from "@/components/erp/skin/AccountingView"

export default function AccountingPage() {
  return <ErpGuard>{(manage) => <ErpSkin><AccountingView manage={manage} /></ErpSkin>}</ErpGuard>
}
