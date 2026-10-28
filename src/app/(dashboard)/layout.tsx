"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { KeyboardShortcutsSheet } from "@/components/layout/KeyboardShortcutsSheet"
import { MobileNav } from "@/components/layout/MobileNav"
import { ShopContextHydrator } from "@/components/layout/shop-context-hydrator"
import { ShopScopeBadge } from "@/components/layout/shop-scope-badge"
import { SocketEventBridge } from "@/components/layout/socket-event-bridge"
import { SocketProvider } from "@/components/providers/SocketProvider"
import { ErrorBoundary } from "@/components/shared/error-boundary"
import { ViewerBanner } from "@/components/shared/PermissionGate"
import { DemoModeGuard } from "@/components/shared/DemoModeGuard"
import { ActiveShopCookieSync } from "@/hooks/useActiveShopCookieSync"
import { useAuthStore } from "@/store/auth.store"
import { useSidebarStore } from "@/store/sidebar.store"
import { validateSession } from "@/services/auth.service"
import { unlockOrderSounds } from "@/lib/orderSound"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated, isHydrated, hydrate, login, clearAuth } = useAuthStore()
  const isCollapsed = useSidebarStore((s) => s.isCollapsed)
  const isBuilderRoute = pathname === "/themes/builder"
  const [isValidating, setIsValidating] = useState(true)

  // Step 1: Hydrate auth from localStorage on mount
  useEffect(() => {
    hydrate()
  }, [hydrate])

  // New-order sound alerts are blocked by the browser until a real user
  // gesture has occurred on the page — "warm up" both clips on the first
  // click/keydown anywhere in the dashboard so the later programmatic
  // play() triggered by a Socket.IO event isn't silently rejected.
  useEffect(() => {
    const unlock = () => unlockOrderSounds()
    window.addEventListener("click", unlock, { once: true })
    window.addEventListener("keydown", unlock, { once: true })
    return () => {
      window.removeEventListener("click", unlock)
      window.removeEventListener("keydown", unlock)
    }
  }, [])

  // Step 2: After hydration, validate token against backend
  // This is the KEY fix for the stale cookie/restart bug
  useEffect(() => {
    if (!isHydrated) return

    const token = localStorage.getItem("accessToken")
    if (!token) {
      // No token at all — redirect to login
      setIsValidating(false)
      router.replace("/login")
      return
    }

    // Validate the token against the backend
    validateSession()
      .then((adminUser) => {
        // Token is valid — update store with fresh user data
        login(adminUser, token)
        setIsValidating(false)
      })
      .catch(() => {
        // Token is invalid/expired — clear everything and redirect
        clearAuth()
        setIsValidating(false)
        router.replace("/login")
      })
  // Only run once after hydration
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated])

  // Show nothing while validating to prevent flash of dashboard
  if (!isHydrated || isValidating) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--surface-bg)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  // If not authenticated after validation, show nothing (redirect is happening)
  if (!isAuthenticated) {
    return null
  }

  return (
    <SocketProvider>
      {/* Keep the Shop_Context_Store in sync with the auth lifecycle:
          hydrate the persisted snapshot on mount + token swap, and mirror
          the user's shop assignments into the vendor tamper-guard list
          (Req 3.1, 3.2, 4.6, 1.6, 1.10). */}
      <ShopContextHydrator />

      {/* Mirror activeShopId to a cookie so Next.js middleware can enforce
          shop-scoped routing rules during SSR (Task 18.2, Req 1.6, 1.10). */}
      <ActiveShopCookieSync />

      {/* Subscribe once to shop-scoped Socket.IO events that need to
          translate into TanStack Query cache invalidations across every
          dashboard surface (currently `new-order` → orders + dashboard
          home, Req 11.5). Mounted alongside the hydrator so the listener
          spans the full authed session. */}
      <SocketEventBridge />

      {/* Global keyboard shortcuts cheatsheet — opens via the `?` key
          anywhere in the dashboard (Req 13.7). Mounted once at the
          authed layout so every authed surface inherits the shortcut. */}
      <KeyboardShortcutsSheet />

      {/* Skip to main content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>

      {isBuilderRoute ? (
        <main
          id="main-content"
          aria-label="Dashboard content"
          className="h-screen overflow-hidden"
        >
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      ) : (
        <>
          {/* Desktop sidebar */}
          <div className="hidden md:block">
            <Sidebar />
          </div>

          {/* Mobile sidebar sheet */}
          <MobileNav />

          {/* Main content area */}
          <div
            className={cn(
              "min-h-screen transition-all duration-200",
              isCollapsed ? "md:ml-[72px]" : "md:ml-[260px]"
            )}
          >
            <Header />
            <main
              id="main-content"
              aria-label="Dashboard content"
              className="p-4 md:p-6"
            >
              <ErrorBoundary>
                <DemoModeGuard />
                <ViewerBanner />
                {/* Non-removable scope confirmation chip — mounted once so
                    every existing surface (orders, products, customers,
                    reviews, etc.) inherits it without per-page wiring.
                    Self-gates on `mode === "STORE_MODE"` and renders
                    nothing in `ALL_SHOPS` / `UNSELECTED` modes (Req 10.2). */}
                <ShopScopeBadge className="mb-4" />
                {children}
              </ErrorBoundary>
            </main>
          </div>
        </>
      )}
    </SocketProvider>
  )
}
