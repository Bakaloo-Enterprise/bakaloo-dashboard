"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Activity,
  BarChart3,
  Bell,
  BellRing,
  Bike,
  Briefcase,
  ChevronDown,
  ChevronLeft,
  ClipboardList,
  CalendarDays,
  Clock,
  Code2,
  Coffee,
  CreditCard,
  FileSpreadsheet,
  FileText,
  Gift,
  History,
  Image,
  Landmark,
  LayoutDashboard,
  LayoutGrid,
  Lock,
  LogOut,
  Map,
  Megaphone,
  MessageCircle,
  MessagesSquare,
  MapPin,
  MapPinned,
  Package,
  PackageCheck,
  Palette,
  Receipt,
  ScrollText,
  Settings,
  Shield,
  ShieldAlert,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Star,
  Store,
  Tags,
  Truck,
  Ticket,
  Timer,
  TrendingUp,
  Undo2,
  Users,
  Users2,
  Wallet,
  Workflow,
  Youtube,
  type LucideIcon,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { usePendingActions } from "@/hooks/useDashboard"
import { useChatUnread } from "@/hooks/useTeamChat"
import { featureForPath, useFeatures } from "@/hooks/useFeatures"
import { useMenuVisibility } from "@/hooks/useRBAC"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/store/auth.store"
import { useSidebarStore } from "@/store/sidebar.store"

type NavChild = {
  /** Stable id used for permission gating (looked up in `MENU_PERMISSIONS`). */
  id?: string
  label: string
  href: string
  icon: string
}

type NavItem = {
  /** Stable id used for permission gating (looked up in `MENU_PERMISSIONS`). */
  id?: string
  label: string
  href: string
  icon: string
  badgeKey?: "pendingOrders" | "lowStockProducts" | "pendingRiderApprovals" | "teamChatUnread"
  children?: NavChild[]
}

const ICON_MAP: Record<string, LucideIcon> = {
  Activity,
  Code2,
  BarChart3,
  Bell,
  BellRing,
  Bike,
  Briefcase,
  ClipboardList,
  CalendarDays,
  Clock,
  Coffee,
  CreditCard,
  FileSpreadsheet,
  FileText,
  Gift,
  History,
  Image,
  Landmark,
  LayoutDashboard,
  LayoutGrid,
  Map,
  MapPin,
  MapPinned,
  Megaphone,
  MessageCircle,
  MessagesSquare,
  Package,
  PackageCheck,
  Palette,
  Receipt,
  ScrollText,
  Settings,
  Shield,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Star,
  Store,
  Tags,
  Truck,
  Ticket,
  Timer,
  TrendingUp,
  Undo2,
  Users,
  Users2,
  Wallet,
  Workflow,
  Youtube,
}

const NAV_SECTIONS: Array<{ section: string; items: NavItem[] }> = [
  {
    section: "MAIN",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
      {
        label: "Orders",
        href: "/orders",
        icon: "ClipboardList",
        badgeKey: "pendingOrders",
      },
      {
        label: "Refund Requests",
        href: "/refund-requests",
        icon: "Undo2",
      },
      {
        id: "settings",
        label: "Settings",
        href: "/settings/fees",
        icon: "Settings",
        children: [
          { label: "Fees", href: "/settings/fees", icon: "FileText" },
          { label: "Tip Presets", href: "/settings/tip-presets", icon: "Coffee" },
          {
            label: "Payment Offers",
            href: "/settings/payment-offers",
            icon: "Gift",
          },
          { label: "Payments", href: "/settings/payments", icon: "CreditCard" },
          { label: "Wallet Settings", href: "/settings/wallet", icon: "Wallet" },
          {
            label: "Order Notifications",
            href: "/settings/order-notifications",
            icon: "BellRing",
          },
          { label: "Product Suggestions", href: "/settings/product-suggestions", icon: "Sparkles" },
          { label: "Delivery Timer", href: "/settings/delivery-timer", icon: "Timer" },
          { label: "Pincode Mapping", href: "/settings/pincode-mapping", icon: "MapPin" },
          { label: "Maps", href: "/settings/maps", icon: "Map" },
          { label: "Store Hours", href: "/settings/store-hours", icon: "Clock" },
          { label: "Delivery Calendar", href: "/settings/delivery-calendar", icon: "CalendarDays" },
          { label: "App Version", href: "/settings/app-version", icon: "Smartphone" },
          { label: "App Branding", href: "/settings/app-branding", icon: "Image" },
          { label: "Legal Pages", href: "/settings/legal-pages", icon: "ScrollText" },
        ],
      },
      {
        label: "Products",
        href: "/products",
        icon: "Package",
        badgeKey: "lowStockProducts",
      },
      { label: "Abandoned Carts", href: "/abandoned-carts", icon: "Clock" },
      { label: "Categories", href: "/categories", icon: "Tags" },
      { label: "Customers", href: "/customers", icon: "Users" },
      {
        label: "Riders",
        href: "/riders",
        icon: "Bike",
        badgeKey: "pendingRiderApprovals",
      },
      { label: "Area Segments", href: "/area-segments", icon: "MapPinned" },
    ],
  },
  {
    section: "SHOPS",
    items: [
      // Ids match `MENU_PERMISSIONS` keys — `useMenuRBAC` consults that map
      // to hide super-admin-only or `requiresActiveShop` items as the user's
      // role and Shop_Switcher selection change (Req 4.2, 4.5, 4.6, 4.7).
      { id: "shops", label: "Shops", href: "/shops", icon: "Store" },
      {
        id: "coverageMap",
        label: "Coverage Map",
        href: "/hq/coverage-map",
        icon: "Map",
      },
      {
        id: "shopProducts",
        label: "Shop Products",
        href: "/shop-products",
        icon: "Package",
      },
      {
        id: "shopFinancials",
        label: "Shop Financials",
        href: "/shop-financials",
        icon: "CreditCard",
      },
      {
        id: "shopTransactions",
        label: "Shop Transactions",
        href: "/shop-transactions",
        icon: "Receipt",
      },
      { label: "GSTR-1", href: "/hq/finance/gstr1", icon: "FileText" },
    ],
  },
  {
    section: "COMMERCE",
    items: [
      { label: "Coupons", href: "/coupons", icon: "Ticket" },
      { label: "Purchase Limits", href: "/purchase-limits", icon: "ShieldAlert" },
      { label: "Customer Segments", href: "/customer-segments", icon: "Users2" },
      { label: "First-Time Offers", href: "/first-time-offers", icon: "Gift" },
      { label: "Cart Milestones", href: "/cart-milestones", icon: "TrendingUp" },
      { label: "Spin & Win", href: "/spin-wheel", icon: "Sparkles" },
      { label: "Scratch Card", href: "/scratch-card", icon: "CreditCard" },
      { label: "Wallet & Refunds", href: "/wallet", icon: "Wallet" },
      { label: "Notifications", href: "/notifications", icon: "Bell" },
      { label: "Reviews", href: "/reviews", icon: "Star" },
    ],
  },
  {
    section: "BUSINESS",
    items: [
      { label: "Business Analytics", href: "/business-analytics", icon: "BarChart3" },
      { label: "Procurement", href: "/procurement", icon: "Truck" },
      { label: "Bulk Catalog", href: "/catalog-bulk", icon: "FileSpreadsheet" },
    ],
  },
  {
    section: "FULFILLMENT",
    items: [
      { label: "Fulfillment Board", href: "/pos", icon: "PackageCheck" },
    ],
  },
  {
    section: "WHATSAPP CRM",
    items: [
      { label: "Inbox", href: "/whatsapp-crm/inbox", icon: "MessageCircle" },
      { label: "Team Chat", href: "/whatsapp-crm/chat", icon: "MessagesSquare", badgeKey: "teamChatUnread" },
      { label: "Pipeline", href: "/whatsapp-crm/pipeline", icon: "TrendingUp" },
      { label: "Templates", href: "/whatsapp-crm/templates", icon: "FileText" },
      { label: "Campaigns", href: "/whatsapp-crm/campaigns", icon: "Megaphone" },
      { label: "Prospects", href: "/whatsapp-crm/prospects", icon: "FileSpreadsheet" },
      { label: "Workflows", href: "/whatsapp-crm/workflows", icon: "Workflow" },
      { label: "Auto-reply Bot", href: "/whatsapp-crm/bot", icon: "Sparkles" },
      { label: "Analytics", href: "/whatsapp-crm/analytics", icon: "BarChart3" },
      { label: "Workload", href: "/whatsapp-crm/workload", icon: "Users2" },
      { label: "Labels", href: "/whatsapp-crm/labels", icon: "Tags" },
      { label: "WhatsApp Settings", href: "/whatsapp-crm/settings", icon: "Settings" },
    ],
  },
  {
    section: "B2B",
    items: [
      { label: "Applications", href: "/b2b/applications", icon: "Briefcase" },
      { label: "Orders", href: "/b2b/orders", icon: "ClipboardList" },
      { label: "Collections", href: "/b2b/collections", icon: "Receipt" },
      { label: "GST & Invoices", href: "/b2b/gst", icon: "FileSpreadsheet" },
    ],
  },
  {
    section: "ANALYTICS",
    items: [{ label: "Analytics", href: "/analytics", icon: "BarChart3" }],
  },
  {
    section: "SYSTEM",
    items: [
      // The general Home-screen Banners module (carousel/popup/announcement
      // + a placement selector) is temporarily hidden from navigation —
      // confusing to manage alongside Profile banners in one place. The
      // page and backend API are untouched; only this menu entry is gone.
      // Restore by uncommenting once the two are split more thoroughly.
      // { label: "Banners", href: "/banners", icon: "Image" },
      { label: "Profile Banner", href: "/profile-banners", icon: "Image" },
      { label: "Nav & Menu Buttons", href: "/nav-button", icon: "LayoutGrid" },
      { label: "Tutorials", href: "/tutorials", icon: "Youtube" },
      { label: "Activity Log", href: "/activity-log", icon: "Activity" },
      { label: "Customer Activity", href: "/customer-activity", icon: "History" },
      { label: "Team & Roles", href: "/team", icon: "Shield" },
      { label: "Themes", href: "/themes", icon: "Palette" },
      { label: "Theme Tabs", href: "/theme-tabs", icon: "Tags" },
    ],
  },
]

/** Only Developer Super Admins ever see this section. */
const DEVELOPER_SECTION = {
  section: "DEVELOPER",
  items: [{ label: "Developer Access", href: "/developer", icon: "Code2" }],
}

function isPathActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

interface NavItemProps {
  item: NavItem
  pathname: string
  isCollapsed: boolean
  badgeCount: number
  openGroups: Set<string>
  onToggleGroup: (id: string) => void
}

/**
 * Renders a single nav item (leaf or grouped). Visibility is decided by the
 * parent section via `useMenuVisibility` so hook-call order stays stable
 * regardless of the gated state. Items without an `id` are legacy and
 * unconditionally rendered (the parent passes `true` for them).
 */
function NavSectionItem({
  item,
  pathname,
  isCollapsed,
  badgeCount,
  openGroups,
  onToggleGroup,
}: NavItemProps) {
  const Icon = ICON_MAP[item.icon]
  // Features still in development stay visible (so people know they're coming) but show a lock until released.
  const features = useFeatures().data
  const featureKey = featureForPath(item.href)
  const locked = Boolean(featureKey && features && !features.features?.[featureKey]?.canAccess)

  if (item.children && !isCollapsed) {
    const groupId = item.id ?? item.href
    const isOpen = openGroups.has(groupId)
    const isGroupActive = item.children.some((child) =>
      isPathActive(pathname, child.href),
    )

    return (
      <div className="space-y-1">
        <button
          type="button"
          role="menuitem"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          onClick={() => onToggleGroup(groupId)}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg border-l-[3px] px-3 py-2.5 text-sm transition-all duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            isGroupActive
              ? "border-brand-500 bg-brand-50 font-semibold text-brand-500"
              : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Icon
            className={cn(
              "h-5 w-5 shrink-0",
              isGroupActive ? "text-brand-500" : "text-muted-foreground",
            )}
          />
          <span className="flex-1 truncate text-left">{item.label}</span>
          {badgeCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
              {badgeCount > 99 ? "99+" : badgeCount}
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform",
              isOpen && "rotate-180",
            )}
          />
        </button>

        {isOpen && (
          <div className="ml-6 space-y-1 border-l border-border/80 pl-3" role="menu">
            {item.children.map((child) => {
              const ChildIcon = ICON_MAP[child.icon]
              const childActive = isPathActive(pathname, child.href)

              return (
                <Link
                  key={child.href}
                  href={child.href}
                  role="menuitem"
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    childActive
                      ? "bg-brand-50 font-medium text-brand-500"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <ChildIcon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{child.label}</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const isActive = isPathActive(pathname, item.href)
  const link = (
    <Link
      href={item.href}
      role="menuitem"
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg border-l-[3px] px-3 py-2.5 text-sm transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isActive
          ? "border-brand-500 bg-brand-50 font-semibold text-brand-500"
          : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
        isCollapsed && "justify-center px-0",
      )}
    >
      <Icon
        className={cn(
          "h-5 w-5 shrink-0",
          isActive ? "text-brand-500" : "text-muted-foreground",
        )}
      />
      {!isCollapsed && <span className="flex-1 truncate">{item.label}</span>}
      {!isCollapsed && locked && (
        <Lock aria-label="In development" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      {!isCollapsed && badgeCount > 0 && (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      )}
    </Link>
  )

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {item.label}
        </TooltipContent>
      </Tooltip>
    )
  }

  return link
}

interface SidebarSectionProps {
  section: string
  items: NavItem[]
  pathname: string
  isCollapsed: boolean
  badgeCounts: Record<string, number>
  openGroups: Set<string>
  onToggleGroup: (id: string) => void
}

/**
 * Renders a labelled group of nav items. Item visibility is computed in a
 * single hook call (`useMenuVisibility`) so hook-call order is stable across
 * renders. The section heading is hidden when none of its items are visible
 * to avoid leaving an empty label in the sidebar (Req 4.2). Re-evaluation on
 * Shop_Switcher changes happens automatically via the underlying selectors
 * (Req 4.6).
 */
function SidebarSection({
  section,
  items,
  pathname,
  isCollapsed,
  badgeCounts,
  openGroups,
  onToggleGroup,
}: SidebarSectionProps) {
  // Stable id list: items without an id get the empty string, which
  // `isMenuItemAllowed` resolves to "always allowed" (legacy item).
  const ids = items.map((item) => item.id ?? "")
  const visibility = useMenuVisibility(ids)
  const visibleItems = items.filter((item) => visibility[item.id ?? ""])
  if (visibleItems.length === 0) return null

  return (
    <div>
      {!isCollapsed && (
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {section}
        </p>
      )}
      <div className="space-y-0.5">
        {visibleItems.map((item) => {
          const badgeCount = item.badgeKey
            ? badgeCounts[item.badgeKey] ?? 0
            : 0
          return (
            <NavSectionItem
              key={item.id ?? item.href}
              item={item}
              pathname={pathname}
              isCollapsed={isCollapsed}
              badgeCount={badgeCount}
              openGroups={openGroups}
              onToggleGroup={onToggleGroup}
            />
          )
        })}
      </div>
    </div>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const { isCollapsed, setCollapsed } = useSidebarStore()
  const { data: pendingActions } = usePendingActions()
  const features = useFeatures().data
  const { data: chatUnread } = useChatUnread(features?.features?.team_chat?.canAccess === true)
  const isDeveloper = features?.isDeveloper === true
  const sections = isDeveloper ? [...NAV_SECTIONS, DEVELOPER_SECTION] : NAV_SECTIONS
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    if (pathname.startsWith("/settings")) initial.add("settings")
    if (pathname.startsWith("/products")) initial.add("products")
    return initial
  })

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      let changed = false
      if (pathname.startsWith("/settings") && !next.has("settings")) {
        next.add("settings")
        changed = true
      }
      if (pathname.startsWith("/products") && !next.has("products")) {
        next.add("products")
        changed = true
      }
      return changed ? next : prev
    })
  }, [pathname])

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const badgeCounts: Record<string, number> = {
    pendingOrders: pendingActions?.pendingOrders ?? 0,
    lowStockProducts: pendingActions?.lowStockProducts ?? 0,
    pendingRiderApprovals: pendingActions?.pendingRiderApprovals ?? 0,
    teamChatUnread: chatUnread?.unread ?? 0,
  }

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        aria-label="Main navigation"
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border bg-background transition-all duration-200",
          isCollapsed ? "w-[72px]" : "w-[260px]"
        )}
      >
        <div className="flex h-16 items-center gap-3 px-4 shrink-0">
          <div className="stat-card-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
            <ShoppingCart className="h-5 w-5 text-white" />
          </div>
          {!isCollapsed && (
            <span className="truncate text-base font-semibold text-foreground">
              Bakaloo Admin
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "ml-auto h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground",
              isCollapsed && "ml-0"
            )}
            onClick={() => setCollapsed(!isCollapsed)}
          >
            <ChevronLeft
              className={cn(
                "h-4 w-4 transition-transform",
                isCollapsed && "rotate-180"
              )}
            />
          </Button>
        </div>

        <Separator />

        <ScrollArea className="flex-1 py-3">
          <nav aria-label="Main menu" role="menubar" className="space-y-5 px-3">
            {sections.map((section) => (
              <SidebarSection
                key={section.section}
                section={section.section}
                items={section.items}
                pathname={pathname}
                isCollapsed={isCollapsed}
                badgeCounts={badgeCounts}
                openGroups={openGroups}
                onToggleGroup={toggleGroup}
              />
            ))}
          </nav>
        </ScrollArea>

        <Separator />

        <div className="shrink-0 p-3">
          <div
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-muted",
              isCollapsed && "justify-center"
            )}
          >
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-brand-50 text-xs font-semibold text-brand-500">
                {user?.name?.charAt(0)?.toUpperCase() || "A"}
              </AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {user?.name || "Admin"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {isDeveloper ? "Developer Super Admin" : user?.role_name || user?.email}
                </p>
              </div>
            )}
            {!isCollapsed && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Logout"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-danger"
                    onClick={logout}
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Logout</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </aside>
    </TooltipProvider>
  )
}
