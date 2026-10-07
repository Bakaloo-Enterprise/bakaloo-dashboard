"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { MessageCircle } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { ConversationList } from "@/components/whatsapp-crm/ConversationList"
import { MessageThread } from "@/components/whatsapp-crm/MessageThread"
import { CustomerPanel } from "@/components/whatsapp-crm/CustomerPanel"
import { DoNotContactButton } from "@/components/whatsapp-crm/DoNotContactButton"
import { useDebounce } from "@/hooks/useDebounce"
import { AssignControl } from "@/components/whatsapp-crm/AssignControl"
import { BotStateControl } from "@/components/whatsapp-crm/BotStateControl"
import { SendTemplateDialog } from "@/components/whatsapp-crm/SendTemplateDialog"
import {
  useAgents,
  useBulkAssign,
  useConversation,
  useConversations,
  useCrmMe,
  useCrmStatus,
  useLabels,
  useMarkRead,
  useMessages,
  useSendMedia,
  useSendMessage,
} from "@/hooks/useWhatsappCrm"
import type { ConversationStatus } from "@/types/whatsapp-crm.types"

export default function WhatsappInboxPage() {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<ConversationStatus | undefined>(undefined)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [owner, setOwner] = useState("")
  const [labelId, setLabelId] = useState("")
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [profileOpen, setProfileOpen] = useState(false)
  const shell = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | null>(null)
  // Layout follows the inbox's own width (the sidebar eats a variable amount of the screen):
  // wide = list | chat | details, split = list | chat (+ details drawer), single = one pane at a time.
  const [mode, setMode] = useState<"wide" | "split" | "single">("wide")
  const debouncedSearch = useDebounce(search, 300)

  const me = useCrmMe()
  const canAssign = me.can("crm.conversations.assign")
  const canReply = me.can("crm.inbox.reply")
  const agents = useAgents()
  const labels = useLabels()
  const bulk = useBulkAssign()

  // Deep link from the pipeline board: /whatsapp-crm/inbox?conversation=<id>
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("conversation")
    if (id && /^[0-9a-f-]{36}$/i.test(id)) setSelectedId(id)
  }, [])

  const crm = useCrmStatus()
  const list = useConversations({ search: debouncedSearch || undefined, status, assignedTo: owner || undefined, labelId: labelId || undefined, limit: 50 })
  const detail = useConversation(selectedId)
  const messages = useMessages(selectedId)
  const send = useSendMessage(selectedId ?? "")
  const sendFile = useSendMedia(selectedId ?? "")
  const markRead = useMarkRead()

  const conversations = useMemo(() => list.data ?? [], [list.data])
  const selectedSummary = conversations.find((c) => c.id === selectedId) ?? null
  const active = detail.data ?? selectedSummary

  // Opening a conversation (or receiving a message in the open one) clears its unread badge.
  const unread = selectedSummary?.unread_count ?? 0
  useEffect(() => {
    if (selectedId && unread > 0) markRead.mutate(selectedId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, unread])

  const notConfigured = crm.data && !crm.data.enabled

  // The inbox fills exactly the space under the page title — each column scrolls inside it, never the whole page.
  useLayoutEffect(() => {
    const fit = () => {
      const el = shell.current
      if (!el) return
      const top = el.getBoundingClientRect().top + window.scrollY
      setHeight(Math.max(440, Math.floor(window.innerHeight - top - 28)))
      const w = el.getBoundingClientRect().width
      setMode(w >= 1100 ? "wide" : w >= 700 ? "split" : "single")
    }
    fit()
    const raf = requestAnimationFrame(fit)
    window.addEventListener("resize", fit)
    const ro = typeof ResizeObserver !== "undefined" && shell.current ? new ResizeObserver(fit) : null
    if (ro && shell.current) ro.observe(shell.current)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", fit)
      ro?.disconnect()
    }
  }, [notConfigured, crm.isSuccess])

  const panel = detail.data ? (
    <CustomerPanel
      conversation={detail.data}
      canApplyLabels={me.can("crm.labels.apply")}
      footer={me.can("crm.campaigns.manage") ? <DoNotContactButton contactId={detail.data.contact_id} /> : undefined}
    />
  ) : null

  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="WhatsApp Inbox" subtitle="One shared inbox for customer WhatsApp conversations" />

      {notConfigured && (
        <div role="status" className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          WhatsApp is not enabled on the server yet, so no customer messages can arrive. Add the Meta credentials to the backend
          settings and register the webhook <code className="rounded bg-black/5 px-1">{crm.data?.webhookPath}</code> in Meta.
        </div>
      )}

      <div
        ref={shell}
        style={{
          ...(height ? { height } : {}),
          gridTemplateColumns: mode === "wide" ? "340px minmax(0,1fr) 320px" : mode === "split" ? "320px minmax(0,1fr)" : "minmax(0,1fr)",
        }}
        className="grid min-h-[440px] grid-rows-[minmax(0,1fr)] overflow-hidden rounded-xl border bg-card shadow-sm"
      >
        <div className={`min-h-0 min-w-0 border-r ${mode === "single" && selectedId ? "hidden" : "block"}`}>
          <ConversationList
            conversations={conversations}
            isLoading={list.isLoading}
            selectedId={selectedId}
            onSelect={setSelectedId}
            search={search}
            onSearch={setSearch}
            status={status}
            onStatus={setStatus}
            owner={owner}
            onOwner={setOwner}
            labelId={labelId}
            onLabelId={setLabelId}
            labels={labels.data ?? []}
            canBulk={canAssign}
            agents={agents.data ?? []}
            checked={checked}
            onToggleChecked={(id) =>
              setChecked((prev) => {
                const next = new Set(prev)
                if (next.has(id)) next.delete(id)
                else next.add(id)
                return next
              })
            }
            onClearChecked={() => setChecked(new Set())}
            onBulkAssign={(userId) => bulk.mutate({ ids: Array.from(checked), userId })}
            bulkPending={bulk.isPending}
          />
        </div>

        <div className={`min-h-0 min-w-0 ${mode === "single" && !selectedId ? "hidden" : "block"}`}>
          {active ? (
            <MessageThread
              conversation={active}
              messages={messages.data ?? []}
              isLoading={messages.isLoading}
              sending={send.isPending}
              sendingFile={sendFile.isPending}
              canSend={canReply}
              onBack={mode === "single" ? () => setSelectedId(null) : undefined}
              onOpenProfile={mode !== "wide" ? () => setProfileOpen(true) : undefined}
              composerExtra={<SendTemplateDialog conversationId={active.id} consent={active.marketing_consent} windowOpen={active.window_open} canSend={canReply && me.can("crm.templates.send")} />}
              onSend={(body) => send.mutateAsync(body)}
              onSendFile={(file, caption) => sendFile.mutateAsync({ file, caption })}
              headerExtra={
                <>
                  <BotStateControl conversation={active} botEnabled={Boolean(crm.data?.botEnabled)} canControl={canReply} />
                  <AssignControl conversation={active} meId={me.data?.userId} canAssign={canAssign} canReply={canReply} />
                </>
              }
            />
          ) : (
            <EmptyState
              icon={<MessageCircle className="h-6 w-6 text-muted-foreground" />}
              title="Select a conversation"
              description="Choose a customer on the left to read and reply."
              className="h-full"
            />
          )}
        </div>

        {mode === "wide" && <div className="min-h-0 min-w-0 border-l">{panel}</div>}
      </div>

      {/* Below the wide layout the customer details open as a drawer instead of a column. */}
      <Sheet open={profileOpen} onOpenChange={setProfileOpen}>
        <SheetContent side="right" className="w-[min(92vw,360px)] p-0 sm:max-w-[360px]">
          <SheetTitle className="sr-only">Customer details</SheetTitle>
          <SheetDescription className="sr-only">Labels, consent and ownership for this conversation</SheetDescription>
          {panel}
        </SheetContent>
      </Sheet>
    </div>
  )
}
