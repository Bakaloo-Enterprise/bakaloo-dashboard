"use client"

import { DemoHeaderBadge } from "@/components/shared/DemoModeGuard"
import { Bell, Menu, Wifi, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useSidebarStore } from "@/store/sidebar.store"
import { useNotificationStore } from "@/store/notifications.store"
import { useConnectionStatus } from "@/hooks/useSocket"
import { NotificationPanel } from "./NotificationPanel"
import { GlobalSearch } from "./GlobalSearch"
import { ShopSwitcher } from "./shop-switcher"
import { ShopScopeIndicator } from "./shop-scope-indicator"
import { ReconnectingIndicator } from "./reconnecting-indicator"
import { ThemeToggle } from "./ThemeToggle"

const STATUS_CONFIG = {
  connected: {
    icon: Wifi,
    className: "text-green-500",
    label: "Live — real-time updates active",
    dot: "bg-green-500",
  },
  disconnected: {
    icon: WifiOff,
    className: "text-muted-foreground",
    label: "Disconnected — reconnecting...",
    dot: "bg-muted-foreground",
  },
  reconnecting: {
    icon: WifiOff,
    className: "text-yellow-500 animate-pulse",
    label: "Reconnecting...",
    dot: "bg-yellow-500 animate-pulse",
  },
} as const

export function Header() {
  const toggleSidebar = useSidebarStore((s) => s.toggle)
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const connStatus = useConnectionStatus()
  const statusCfg = STATUS_CONFIG[connStatus]
  const StatusIcon = statusCfg.icon

  return (
    <header aria-label="Top navigation bar" className="h-16 bg-background border-b border-border flex items-center px-4 md:px-6 gap-4 sticky top-0 z-30">
      {/* Mobile hamburger */}
      <Button
        variant="ghost"
        size="icon"
        aria-label="Open navigation menu"
        className="md:hidden shrink-0"
        onClick={toggleSidebar}
      >
        <Menu className="w-5 h-5" />
      </Button>

      {/* Global Search */}
      <GlobalSearch />

      <div className="flex items-center gap-2 ml-auto">
        <DemoHeaderBadge />
        {/* Shop scope indicator — shows shop name + branch_code in STORE_MODE.
            Self-gates: renders nothing in HQ_MODE / ALL_SHOPS (Task 17.6). */}
        <ShopScopeIndicator />

        {/* Super_Admin Shop_Switcher — self-gates on `useIsSuperAdmin()` and
            on `assignedShopIds.length > 0`, so it renders nothing for vendor
            users and unauthenticated states. Mounted inside the right-side
            cluster so it never displaces the left-aligned GlobalSearch
            (Req 3.1, 3.2, 3.3). */}
        <ShopSwitcher />

        {/* Non-blocking "Reconnecting…" pill — surfaces socket drops to all
            users (vendor + super admin) without interrupting workflow. Sits
            next to the Shop_Switcher per task 13.3 so the live-update health
            of the dashboard is visible right where the shop scope is chosen
            (Req 11.6, 15.6). The component renders nothing while connected
            so it doesn't add visual noise during the common case. */}
        <ReconnectingIndicator />

        {/* Connection status */}
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div role="status" aria-label={statusCfg.label} className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-muted cursor-default">
                <span className={`relative flex h-2 w-2`}>
                  {connStatus === "connected" && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  )}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${statusCfg.dot}`} />
                </span>
                <StatusIcon className={`h-4 w-4 ${statusCfg.className}`} />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">{statusCfg.label}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <NotificationPanel>
          <Button variant="ghost" size="icon" aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`} className="relative">
            <Bell className="w-5 h-5 text-muted-foreground" />
            {unreadCount > 0 && (
              <Badge className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 bg-danger text-white text-[10px] font-semibold border-2 border-background">
                {unreadCount > 99 ? "99+" : unreadCount}
              </Badge>
            )}
          </Button>
        </NotificationPanel>
      </div>
    </header>
  )
}
