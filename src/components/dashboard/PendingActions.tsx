"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { usePendingActions } from "@/hooks/useDashboard"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ClipboardList,
  AlertTriangle,
  UserCheck,
  Megaphone,
} from "lucide-react"

const ACTIONS = [
  {
    key: "pendingOrders" as const,
    label: "New Orders to Accept",
    icon: ClipboardList,
    href: "/orders?status=CONFIRMED",
    color: "#F59E0B",
    bg: "#FFFBEB",
  },
  {
    key: "lowStockProducts" as const,
    label: "Low Stock",
    icon: AlertTriangle,
    href: "/products?filter=low-stock",
    color: "#EF4444",
    bg: "#FEF2F2",
  },
  {
    key: "pendingRiderApprovals" as const,
    label: "Rider Approvals",
    icon: UserCheck,
    href: "/riders?status=pending",
    color: "#3B82F6",
    bg: "#EFF6FF",
  },
  {
    key: "scheduledCampaigns" as const,
    label: "Campaigns",
    icon: Megaphone,
    href: "/notifications",
    color: "#8B5CF6",
    bg: "#F5F3FF",
  },
]

export function PendingActions() {
  const { data, isLoading, isError } = usePendingActions()

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Pending Actions</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        ) : isError || !data ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Unable to load actions
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {ACTIONS.map((action) => {
              const count = data[action.key]
              const Icon = action.icon

              return (
                <div
                  key={action.key}
                  className="rounded-lg p-3 transition-colors cursor-pointer hover:opacity-80"
                  style={{ backgroundColor: action.bg }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-4 w-4" style={{ color: action.color }} />
                    <span className="text-xs font-medium text-muted-foreground">
                      {action.label}
                    </span>
                  </div>
                  <span
                    className="text-2xl font-bold"
                    style={{ color: action.color }}
                  >
                    {count}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
