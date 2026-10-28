import axios, { AxiosError, type AxiosResponseHeaders, type RawAxiosResponseHeaders } from "axios"
import { toast } from "sonner"

import { useAuthStore } from "@/store/auth.store"
import { useShopContextStore } from "@/store/shop-context.store"
import { getQueryClient } from "@/lib/queryClient"
import { t } from "@/lib/i18n"
import { triggerSubmitCooldown } from "@/lib/submit-cooldown"

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
  timeout: 15000,
})

// ─────────────────────────────────────────────────────────────────────────────
// Request interceptor — JWT injection, RBAC viewer guard, X-Shop-Id header
// ─────────────────────────────────────────────────────────────────────────────
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("accessToken")
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    // ── RBAC: Block all mutations for Viewer users ──
    const method = (config.method || "get").toLowerCase()
    const isMutation = ["post", "put", "patch", "delete"].includes(method)
    const url = config.url || ""

    // Allow auth routes (login, me, logout) to pass through
    const isAuthRoute =
      url.includes("/auth/login") ||
      url.includes("/auth/me") ||
      url.includes("/auth/logout")

    if (isMutation && !isAuthRoute) {
      try {
        const stored = localStorage.getItem("admin-user")
        if (stored) {
          const user = JSON.parse(stored)
          const permissions: string[] = user?.state?.user?.permissions || user?.permissions || []

          // Check if user only has view permissions (Viewer role)
          const isViewer =
            permissions.length > 0 &&
            permissions.every((p: string) => p.endsWith(".view"))

          if (isViewer) {
            toast.error("Access denied — you have view-only permissions", {
              description: "Contact a Super Admin to request edit access.",
            })
            // Cancel the request by returning a rejected promise
            const cancelSource = axios.CancelToken.source()
            config.cancelToken = cancelSource.token
            cancelSource.cancel("VIEWER_BLOCKED")
            return config
          }
        }
      } catch {
        // If parsing fails, let the request through (safety)
      }
    }

    // ── Multi-vendor: inject X-Shop-Id from Shop_Context_Store ──
    // Read imperatively via getState() because axios runs outside React.
    // Inject X-Shop-Id when:
    //   - mode=STORE_MODE (always has activeShopId), OR
    //   - mode=HQ_MODE AND activeShopId is set (Super_Admin viewing specific shop)
    // Omit when mode=HQ_MODE AND activeShopId=null (cross-shop aggregate view)
    // or mode=UNSELECTED (Req 3.5, 3.6, 10.1, 16.1).
    const { activeShopId: shopId, mode: shopMode } = useShopContextStore.getState()
    if (shopId && (shopMode === "STORE_MODE" || shopMode === "HQ_MODE")) {
      config.headers["X-Shop-Id"] = shopId
    }
  }
  return config
})

// ─────────────────────────────────────────────────────────────────────────────
// Response interceptor — 401 / 403 / 429 / 5xx handling
// ─────────────────────────────────────────────────────────────────────────────

/** Pull the `x-request-id` header out of an axios error in a header-shape-agnostic way. */
function readRequestId(
  headers: RawAxiosResponseHeaders | AxiosResponseHeaders | undefined,
): string | undefined {
  if (!headers) return undefined
  // axios may hand us either a plain object or an AxiosHeaders instance —
  // both expose lower-case keys.
  const direct = (headers as Record<string, unknown>)["x-request-id"]
  if (typeof direct === "string" && direct.length > 0) return direct
  // AxiosHeaders.get() fallback
  const maybeGet = (headers as { get?: (k: string) => unknown }).get
  if (typeof maybeGet === "function") {
    const v = maybeGet.call(headers, "x-request-id")
    if (typeof v === "string" && v.length > 0) return v
  }
  return undefined
}

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ code?: string; message?: string }>) => {
    // Don't show errors for cancelled requests (Viewer blocks)
    if (axios.isCancel(error)) {
      return Promise.reject(error)
    }

    const status = error.response?.status
    const code = error.response?.data?.code
    const url = error.config?.url || ""

    if (typeof window === "undefined") {
      return Promise.reject(error)
    }

    const onLoginPage = window.location.pathname === "/login"
    const isAuthMe = url.includes("/auth/me")
    const isAuthLogin = url.includes("/auth/login")

    // ── 401 unauthorized ──────────────────────────────────────────────
    // Clear auth + shop context + query cache and bounce to /login.
    // Skip when:
    //   - the request is the /auth/me probe or the /auth/login attempt
    //     (those callers handle the failure inline), or
    //   - we are already on /login (avoid redirect loops).
    // Req 1.7
    if (status === 401 && !isAuthMe && !isAuthLogin && !onLoginPage) {
      useAuthStore.getState().clearAuth()
      useShopContextStore.getState().clear()
      // Clear residual cookies left by older sessions.
      document.cookie = "auth_session=; path=/; max-age=0"
      document.cookie = "accessToken=; path=/; max-age=0"
      try {
        getQueryClient().clear()
      } catch {
        // Defensive: clear() is safe on a fresh client too.
      }
      window.location.href = "/login"
      return Promise.reject(error)
    }

    // ── 403 SHOP_SELECTION_REQUIRED ───────────────────────────────────
    // Backend tells us this user has no Active_Shop_Id but the route needs
    // one — bounce to the Shop_Selector. Req 1.8 / 3.6.
    if (status === 403 && code === "SHOP_SELECTION_REQUIRED") {
      if (window.location.pathname !== "/select-shop") {
        window.location.href = "/select-shop"
      }
      return Promise.reject(error)
    }

    // ── 403 DEMO_READ_ONLY ────────────────────────────────────────────
    // The demo viewer account can look at everything but not change or send anything (save, delete, block, credit,
    // WhatsApp / notification sends, theme publish ...). One fixed toast id so repeated clicks don't stack.
    if (status === 403 && code === "DEMO_READ_ONLY") {
      // Pages show their own error toast with the server message too; after a beat, replace everything with one
      // clear message so the demo viewer never sees two stacked.
      window.setTimeout(() => {
        toast.dismiss()
        toast.error("Submit is not eligible for this account", {
          id: "demo-read-only",
          description: "This is a view-only demo account. You can review everything, but nothing can be changed or sent.",
        })
      }, 150)
      return Promise.reject(error)
    }

    // ── 403 PERMISSION_DENIED ─────────────────────────────────────────
    // Server-side RBAC rejection — surface a Sonner toast with the
    // server-provided message. Do NOT clear auth (Req 15.3 / design §2).
    if (status === 403 && code === "PERMISSION_DENIED") {
      toast.error(t("errors.permissionDenied"), {
        description: error.response?.data?.message,
      })
      return Promise.reject(error)
    }

    // ── 403 PASSWORD_CHANGE_REQUIRED ──────────────────────────────────
    // Backend signals the user must change their password before accessing
    // any other resource. Navigate to /change-password and block all other
    // routes. Do NOT clear auth — the session is valid but restricted.
    if (status === 403 && code === "PASSWORD_CHANGE_REQUIRED") {
      if (window.location.pathname !== "/change-password") {
        window.location.href = "/change-password"
      }
      return Promise.reject(error)
    }

    // ── 429 rate limited ──────────────────────────────────────────────
    // Show a single toast and arm the shared 5-second submit cooldown so
    // pages that mount useSubmitCooldown() disable their submit buttons.
    // Req 15.4
    if (status === 429) {
      toast.error(t("errors.tooManyRequests"))
      triggerSubmitCooldown(5000)
      return Promise.reject(error)
    }

    // ── 5xx server errors ─────────────────────────────────────────────
    // Destructive toast with a "Copy error id" affordance using the
    // x-request-id header so users can hand the id to support. Req 15.5
    if (typeof status === "number" && status >= 500) {
      const requestId = readRequestId(error.response?.headers)
      toast.error(t("errors.genericError"), {
        description: requestId ? `Error id: ${requestId}` : undefined,
        action: requestId
          ? {
              label: t("errors.copyErrorId"),
              onClick: () => {
                // Best-effort: clipboard may be unavailable in insecure contexts.
                navigator.clipboard
                  ?.writeText(requestId)
                  .then(() => {
                    toast.success(t("errors.errorIdCopied"))
                  })
                  .catch(() => {
                    /* no-op */
                  })
              },
            }
          : undefined,
      })
      return Promise.reject(error)
    }

    return Promise.reject(error)
  },
)

export default api
