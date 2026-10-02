"use client"

import { usePathname } from "next/navigation"
import { FeatureGate } from "@/components/FeatureGate"
import { featureForPath } from "@/hooks/useFeatures"

/** WhatsApp CRM pages are locked until released; Team Chat (which lives in this section) has its own lock. */
export default function WhatsappCrmLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? ""
  // WhatsApp settings is readable by everyone; the page and the server decide what each person may do on it.
  if (pathname === "/whatsapp-crm/settings") return <>{children}</>
  return <FeatureGate feature={featureForPath(pathname) ?? "whatsapp_crm"}>{children}</FeatureGate>
}
