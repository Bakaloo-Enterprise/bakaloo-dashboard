"use client"

import { useState } from "react"
import { Bell, MessageCircle } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useCustomerNotifications } from "@/hooks/useCustomers"
import { useCustomerThread } from "@/hooks/useCustomerWhatsapp"
import { formatRelativeTime } from "@/lib/utils"
import { cn } from "@/lib/utils"

type View = "personal" | "all" | "whatsapp"

const STATUS_TEXT: Record<string, string> = { QUEUED: "sending", SENT: "sent", DELIVERED: "delivered", READ: "read", FAILED: "failed", RECEIVED: "received" }

/** What this customer was sent: personal notifications, every notification, and the WhatsApp conversation. */
export function CustomerMessages({ customerId, canSeeWhatsapp }: { customerId: string; canSeeWhatsapp: boolean }) {
  const [view, setView] = useState<View>("personal")
  const notifications = useCustomerNotifications(customerId, view !== "all")
  const thread = useCustomerThread(customerId, canSeeWhatsapp && view === "whatsapp")

  const tabs: Array<[View, string]> = [["personal", "Sent personally"], ["all", "All notifications"], ...(canSeeWhatsapp ? ([["whatsapp", "WhatsApp"]] as Array<[View, string]>) : [])]

  return (
    <div>
      <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
        <Bell className="h-4 w-4 text-muted-foreground" />
        Messages sent to this customer
      </h4>
      <div className="mb-2 flex flex-wrap gap-1" role="tablist" aria-label="Message type">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)} className={cn("rounded-full border px-2.5 py-0.5 text-xs", view === id ? "border-primary bg-primary/10 font-semibold" : "hover:bg-muted")}>{label}</button>
        ))}
      </div>

      {view !== "whatsapp" && (
        notifications.isLoading ? <Skeleton className="h-16 rounded-lg" /> :
        notifications.isError ? <p role="alert" className="text-xs text-red-600">Could not load the notifications.</p> :
        (notifications.data ?? []).length === 0 ? (
          <p role="status" className="text-xs text-muted-foreground">{view === "personal" ? "No personal message has been sent to this customer yet." : "This customer has not received any notification yet."}</p>
        ) : (
          <ul className="space-y-2">
            {notifications.data!.map((n) => (
              <li key={n.id} className="rounded-lg border p-2.5 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium leading-tight">{n.title}</p>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{formatRelativeTime(n.createdAt)}</span>
                </div>
                {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
                <p className="mt-1 flex flex-wrap gap-x-2 text-[10px] text-muted-foreground">
                  <span>{n.personal ? `Personal${n.sentByName ? ` · by ${n.sentByName}` : ""}` : n.type.replaceAll("_", " ").toLowerCase()}</span>
                  <span className={n.isRead ? "text-emerald-700" : ""}>{n.isRead ? "Seen" : "Not seen yet"}</span>
                </p>
              </li>
            ))}
          </ul>
        )
      )}

      {view === "whatsapp" && (
        thread.isLoading ? <Skeleton className="h-16 rounded-lg" /> :
        thread.isError ? <p role="alert" className="text-xs text-red-600">Could not load the WhatsApp history.</p> :
        thread.data?.restricted ? <p role="status" className="text-xs text-muted-foreground">This conversation is handled by another team member.</p> :
        (thread.data?.messages ?? []).length === 0 ? <p role="status" className="text-xs text-muted-foreground">No WhatsApp message with this customer yet.</p> : (
          <ul className="space-y-1.5">
            {thread.data!.messages.map((m) => (
              <li key={m.id} className={cn("flex", m.direction === "OUTBOUND" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[85%] rounded-lg px-2.5 py-1.5 text-sm", m.direction === "OUTBOUND" ? "bg-emerald-50" : "bg-muted")}>
                  <p className="whitespace-pre-wrap break-words">{m.body ?? (m.template_name ? `Template: ${m.template_name}` : `(${m.msg_type})`)}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <MessageCircle className="h-2.5 w-2.5" />
                    {formatRelativeTime(m.created_at)}{m.direction === "OUTBOUND" && ` · ${m.is_bot ? "auto-reply" : STATUS_TEXT[m.status] ?? m.status.toLowerCase()}`}
                    {m.status === "FAILED" && m.error_title && <span className="text-red-700"> — {m.error_title}</span>}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  )
}
