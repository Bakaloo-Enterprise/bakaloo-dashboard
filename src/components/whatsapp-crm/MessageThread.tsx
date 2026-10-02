"use client"

import { useEffect, useRef, useState } from "react"
import { AlertTriangle, Check, CheckCheck, Clock, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { cn, formatDateTime } from "@/lib/utils"
import type { WaConversation, WaMessage } from "@/types/whatsapp-crm.types"
import { conversationHandle, conversationTitle, messageText, STATUS_LABEL, windowHoursLeft } from "./helpers"

function Ticks({ status }: { status: WaMessage["status"] }) {
  if (status === "QUEUED") return <Clock className="h-3 w-3" aria-label="Sending" />
  if (status === "FAILED") return <AlertTriangle className="h-3 w-3 text-red-500" aria-label="Failed" />
  if (status === "SENT") return <Check className="h-3 w-3" aria-label="Sent" />
  return <CheckCheck className={cn("h-3 w-3", status === "READ" && "text-sky-500")} aria-label={STATUS_LABEL[status]} />
}

function Bubble({ m }: { m: WaMessage }) {
  const out = m.direction === "OUTBOUND"
  return (
    <div className={cn("flex", out ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] rounded-lg px-3 py-2 text-sm shadow-sm",
          out ? "bg-emerald-100 text-emerald-950 dark:bg-emerald-900/50 dark:text-emerald-50" : "bg-card border",
        )}
      >
        {m.is_bot && <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">Auto-reply (bot)</p>}
        {m.msg_type !== "text" && m.msg_type !== "button" && m.msg_type !== "interactive" && (
          <p className="mb-1 text-[11px] font-medium uppercase text-muted-foreground">{m.msg_type}</p>
        )}
        <p className="whitespace-pre-wrap break-words">{messageText(m)}</p>
        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
          <span>{formatDateTime(m.created_at)}</span>
          {out && <Ticks status={m.status} />}
        </div>
        {m.status === "FAILED" && (
          <p className="mt-1 text-[11px] text-red-600">
            Not delivered{m.error_details ? `: ${m.error_details}` : m.error_title ? `: ${m.error_title}` : ""}
          </p>
        )}
      </div>
    </div>
  )
}

interface Props {
  conversation: WaConversation
  messages: WaMessage[]
  isLoading: boolean
  onSend: (body: string) => Promise<unknown>
  sending: boolean
  /** Owner / assignment control rendered in the header. */
  headerExtra?: React.ReactNode
  /** False when the user lacks crm.inbox.reply — composer is read-only. */
  canSend?: boolean
  /** Extra controls next to the Send button (e.g. “Send template”). Stays usable when the window is closed. */
  composerExtra?: React.ReactNode
}

export function MessageThread({ conversation, messages, isLoading, onSend, sending, headerExtra, canSend = true, composerExtra }: Props) {
  const [text, setText] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)
  const title = conversationTitle(conversation)
  const hoursLeft = windowHoursLeft(conversation.last_inbound_at)
  const canReply = conversation.window_open && canSend

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" })
  }, [messages.length, conversation.id])

  async function submit() {
    const body = text.trim()
    if (!body || sending || !canReply) return
    try {
      await onSend(body)
      setText("")
    } catch {
      // error toast is shown by the mutation; keep the draft so nothing is lost
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{conversationHandle(conversation)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {headerExtra}
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", conversation.window_open ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
            {conversation.window_open ? `Reply window: ${Math.max(1, Math.floor(hoursLeft))}h left` : "Reply window closed"}
          </span>
        </div>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto bg-muted/30 p-4" aria-live="polite">
        {isLoading && <Skeleton className="h-16 w-2/3" />}
        {messages.map((m) => (
          <Bubble key={m.id} m={m} />
        ))}
        <div ref={bottomRef} />
      </div>

      <footer className="border-t p-3">
        {conversation.window_open && !canSend && (
          <p className="mb-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">You have view-only access to the inbox.</p>
        )}
        {!conversation.window_open && (
          <p className="mb-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            More than 24 hours have passed since this customer last wrote. WhatsApp only allows an approved template message now.
            Use the Template button.
          </p>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                void submit()
              }
            }}
            disabled={!canReply}
            placeholder={canReply ? "Type a reply to the customer… (Enter to send)" : conversation.window_open ? "View only" : "Reply window closed"}
            rows={2}
            maxLength={4096}
            aria-label="Reply to customer on WhatsApp"
            className="resize-none"
          />
          {composerExtra}
          <Button onClick={() => void submit()} disabled={!canReply || sending || !text.trim()} aria-label="Send message">
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">This message goes to the customer on WhatsApp. Internal notes are kept separate.</p>
      </footer>
    </div>
  )
}
