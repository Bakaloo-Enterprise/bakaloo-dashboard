"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { io, Socket } from "socket.io-client"
import { toast } from "sonner"
import { useAuthStore } from "@/store/auth.store"
import { useNotificationStore } from "@/store/notifications.store"
import { getQueryClient } from "@/lib/queryClient"
import {
  registerSocketDisconnect,
  unregisterSocketDisconnect,
} from "@/lib/socket-registry"
import { playOrderSound } from "@/lib/orderSound"

const SocketContext = createContext<Socket | null>(null)

export function useSocket() {
  return useContext(SocketContext)
}

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const token = useAuthStore((s) => s.accessToken)

  useEffect(() => {
    if (!token) return

    const s = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
      // Re-evaluate the token on every (re)connect so a refreshed/rotated
      // access token is picked up automatically (Req 11.1, 11.6). socket.io-client
      // invokes the function form as `auth(cb)` on each reconnect attempt, so we
      // must call `cb(...)` rather than returning the payload.
      auth: (cb) => cb({ token: localStorage.getItem("accessToken") ?? "" }),
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      // Exponential backoff: starts at 500ms, capped at 30s (Req 11.6).
      reconnectionDelay: 500,
      reconnectionDelayMax: 30_000,
      randomizationFactor: 0.5,
      timeout: 20000,
    })

    s.on("connect", () => {
      console.log("[Socket] Connected to dashboard")
      // Trigger a re-render for consumers by setting the socket in state
      setSocket(s)
    })

    s.on("disconnect", (reason) => {
      console.log("[Socket] Disconnected:", reason)
      // If server disconnected us, the socket will auto-reconnect
      // If we disconnected manually, don't reconnect
      if (reason === "io server disconnect") {
        s.connect() // manually reconnect
      }
    })

    s.on("connect_error", (err) => {
      console.warn("[Socket] Connection error:", err.message)
      // If auth error, don't keep retrying with bad token
      if (err.message?.includes("expired") || err.message?.includes("Invalid")) {
        console.warn("[Socket] Auth failed, stopping reconnection")
        s.disconnect()
      }
    })

    // ── Dashboard real-time events ─────────────────────
    s.on("dashboard:new_order", (order) => {
      // Distinct loud tone per delivery mode so an admin can tell an
      // incoming order needs immediate handling vs. can wait, by ear alone.
      playOrderSound(order.delivery_mode)
      toast.info(`🛒 New Order: ${order.order_number}`, {
        description: `₹${order.total} via ${order.payment_method}`,
      })
      useNotificationStore.getState().addNotification({
        id: `order-${order.id}`,
        title: "New Order",
        body: `${order.order_number} — ₹${order.total}`,
        type: "ORDER",
        read: false,
        created_at: order.created_at || new Date().toISOString(),
      })
      const qc = getQueryClient()
      // Use the central `dashboard-home` tag so the Shop_Switcher predicate
      // invalidation and these socket-driven invalidations target the same
      // cache entries (Req 11.5, 10.3).
      qc.invalidateQueries({ queryKey: ["dashboard-home"] })
      qc.invalidateQueries({ queryKey: ["orders"] })
      qc.invalidateQueries({ queryKey: ["order-status-counts"] })
    })

    // ── Order status changes (from riders/admin) ────────
    s.on("order:status", (data) => {
      const qc = getQueryClient()
      qc.invalidateQueries({ queryKey: ["orders"] })
      qc.invalidateQueries({ queryKey: ["order-status-counts"] })
      qc.invalidateQueries({ queryKey: ["dashboard-home"] })
      if (data?.orderId) {
        qc.invalidateQueries({ queryKey: ["order", data.orderId] })
      }
      if (data?.status && data?.message) {
        toast.info(`📦 Order ${data.status}`, {
          description: data.message,
        })
      }
    })

    s.on("dashboard:low_stock", (product) => {
      toast.warning(`⚠️ Low Stock: ${product.name}`, {
        description: `Only ${product.stock_quantity} left (threshold: ${product.low_stock_threshold})`,
      })
      useNotificationStore.getState().addNotification({
        id: `stock-${product.id}-${Date.now()}`,
        title: "Low Stock Alert",
        body: `${product.name} — ${product.stock_quantity} units`,
        type: "STOCK",
        read: false,
        created_at: new Date().toISOString(),
      })
      const qc = getQueryClient()
      qc.invalidateQueries({ queryKey: ["dashboard-home"] })
      qc.invalidateQueries({ queryKey: ["products"] })
    })

    // Fired in two situations, both meaning "the dashboard's picture of this
    // payment was wrong and just self-corrected" — never for a routine
    // successful payment, which doesn't need anyone's attention.
    s.on("dashboard:payment_received", (payment) => {
      if (payment.recoveredFromFailed) {
        // The order was shown as FAILED (customer saw a failure, support
        // may have already told them so) but Razorpay has now confirmed
        // the money actually arrived — usually a delayed bank-side
        // settlement. The order auto-confirmed; this is purely a "we were
        // wrong, here's the correction" alert.
        toast.warning(`💳 Payment recovered — Order ${payment.orderNumber ?? payment.orderId}`, {
          description: `Previously shown as failed — Razorpay now confirms ₹${payment.amount} was received. Order auto-confirmed.`,
        })
        useNotificationStore.getState().addNotification({
          id: `payment-recovered-${payment.orderId}-${Date.now()}`,
          title: "Payment recovered (was shown failed)",
          body: `Order ${payment.orderNumber ?? payment.orderId} — ₹${payment.amount} confirmed by Razorpay after showing failed`,
          type: "PAYMENT_REVIEW",
          read: false,
          created_at: new Date().toISOString(),
          data: { orderId: payment.orderId },
        })
      } else {
        // Razorpay captured a payment for an order that had already moved
        // on (almost always cancelled) — the backend deliberately does NOT
        // auto-confirm this case (stock may already be back on the shelf),
        // so it needs a human to review it.
        toast.warning(`🚨 Payment needs review — Order ${payment.orderNumber ?? payment.orderId}`, {
          description: `₹${payment.amount} was captured after the order had already ${payment.orderStatus === "CANCELLED" ? "been cancelled" : "moved on"} — check Orders → Needs Review.`,
        })
        useNotificationStore.getState().addNotification({
          id: `payment-review-${payment.orderId}-${Date.now()}`,
          title: "Payment needs review",
          body: `Order ${payment.orderNumber ?? payment.orderId} — ₹${payment.amount} captured after the order moved on`,
          type: "PAYMENT_REVIEW",
          read: false,
          created_at: new Date().toISOString(),
          data: { orderId: payment.orderId },
        })
      }
      const qc = getQueryClient()
      qc.invalidateQueries({ queryKey: ["dashboard-home"] })
      qc.invalidateQueries({ queryKey: ["orders"] })
    })

    // ── Abandoned cart status transitions (recovered/converted) ─────────
    // The live "00h 12m 05s" timer itself is pure client-side setInterval
    // math (see `AbandonedTimer`) — this socket event only fires on
    // discrete status changes so an open admin tab reflects them without a
    // manual refresh.
    s.on("abandoned_cart:update", () => {
      const qc = getQueryClient()
      qc.invalidateQueries({ queryKey: ["abandoned-carts"] })
    })

    // ── Store Fulfillment POS: anything changed in a store (content-free) → refetch the POS screens ──
    s.on("pos:update", () => {
      getQueryClient().invalidateQueries({ queryKey: ["pos"] })
    })

    // ── Internal team chat (sent only to the personal rooms of the chat's members) ──
    s.on("chat:message", (e: { channelId?: string }) => {
      const qc = getQueryClient()
      qc.invalidateQueries({ queryKey: ["chat", "channels"] })
      qc.invalidateQueries({ queryKey: ["chat", "unread"] })
      if (e?.channelId) qc.invalidateQueries({ queryKey: ["chat", "messages", e.channelId] })
    })
    s.on("chat:message_deleted", (e: { channelId?: string }) => {
      const qc = getQueryClient()
      qc.invalidateQueries({ queryKey: ["chat", "channels"] })
      qc.invalidateQueries({ queryKey: ["chat", "unread"] })
      if (e?.channelId) qc.invalidateQueries({ queryKey: ["chat", "messages", e.channelId] })
    })
    s.on("chat:channel", () => {
      const qc = getQueryClient()
      qc.invalidateQueries({ queryKey: ["chat", "channels"] })
      qc.invalidateQueries({ queryKey: ["chat", "channel"] })
      qc.invalidateQueries({ queryKey: ["chat", "unread"] })
    })
    s.on("chat:read", () => {
      const qc = getQueryClient()
      qc.invalidateQueries({ queryKey: ["chat", "channels"] })
      qc.invalidateQueries({ queryKey: ["chat", "unread"] })
    })

    // ── WhatsApp CRM realtime: new customer message / delivery status ──
    // Invalidate rather than patch the cache: the list order, unread counts
    // and the 24 h window all change, and the refetch is cheap.
    s.on("crm:message", (e: { conversationId?: string }) => {
      const qc = getQueryClient()
      qc.invalidateQueries({ queryKey: ["crm", "conversations"] })
      qc.invalidateQueries({ queryKey: ["crm", "pipeline"] })
      if (e?.conversationId) {
        qc.invalidateQueries({ queryKey: ["crm", "messages", e.conversationId] })
        qc.invalidateQueries({ queryKey: ["crm", "conversation", e.conversationId] })
      }
    })
    // Assignment / label changes (content-free event) — refresh lists, the open chat and workload.
    s.on("crm:conversation", () => {
      const qc = getQueryClient()
      qc.invalidateQueries({ queryKey: ["crm", "conversations"] })
      qc.invalidateQueries({ queryKey: ["crm", "conversation"] })
      qc.invalidateQueries({ queryKey: ["crm", "workload"] })
      qc.invalidateQueries({ queryKey: ["crm", "labels"] })
      qc.invalidateQueries({ queryKey: ["crm", "pipeline"] })
    })
    // Automatic or manual stage change (content-free).
    s.on("crm:pipeline", () => {
      getQueryClient().invalidateQueries({ queryKey: ["crm", "pipeline"] })
    })
    // Template approval changed (webhook or sync): refresh the library and any open template.
    s.on("crm:template", () => {
      getQueryClient().invalidateQueries({ queryKey: ["crm", "templates"] })
    })
    s.on("crm:status", (e: { conversationId?: string }) => {
      const qc = getQueryClient()
      if (e?.conversationId) qc.invalidateQueries({ queryKey: ["crm", "messages", e.conversationId] })
    })

    // Notification for any push
    s.on("notification", (n) => {
      useNotificationStore.getState().addNotification({
        id: n.id || `notif-${Date.now()}`,
        title: n.title,
        body: n.body,
        type: n.type,
        read: false,
        created_at: n.created_at || new Date().toISOString(),
        data: n.data,
      })
    })

    // Set immediately (even before connect) so consumers can attach listeners
    setSocket(s)

    // Register a disconnect callback so non-React code (the auth store's
    // `logout()` action and the 401 path in `lib/api.ts`) can issue a clean
    // `socket.disconnect()` before the redirect. The provider's own cleanup
    // below also disconnects when `accessToken` flips to `null`, but by then
    // the close handshake has already been sent so the backend sees the
    // disconnect promptly. Req 11.7.
    const disconnectFn = () => s.disconnect()
    registerSocketDisconnect(disconnectFn)

    return () => {
      unregisterSocketDisconnect(disconnectFn)
      s.disconnect()
      setSocket(null)
    }
  }, [token])

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  )
}

