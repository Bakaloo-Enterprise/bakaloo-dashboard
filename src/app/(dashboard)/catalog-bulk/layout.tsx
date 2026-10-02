"use client"

import { FeatureGate } from "@/components/FeatureGate"

/** Locked until a Developer Super Admin releases it. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <FeatureGate feature="catalog_bulk">{children}</FeatureGate>
}
