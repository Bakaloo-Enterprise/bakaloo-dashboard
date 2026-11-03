"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, BarChart3, ClipboardList, FileText, Megaphone, MessageCircle, MessagesSquare, Settings, TrendingUp } from "lucide-react"
import Link from "next/link"
import { useBizMe } from "@/hooks/useBusiness"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { CustomerPanel } from "@/components/whatsapp-crm/CustomerPanel"
import { DoNotContactButton } from "@/components/whatsapp-crm/DoNotContactButton"
import { useDebounce } from "@/hooks/useDebounce"
import { AssignControl } from "@/components/whatsapp-crm/AssignControl"
import { BotStateControl } from "@/components/whatsapp-crm/BotStateControl"
import { SendTemplateDialog } from "@/components/whatsapp-crm/SendTemplateDialog"
import { WaChatList } from "@/components/whatsapp-crm/wa/WaChatList"
import { WaThread } from "@/components/whatsapp-crm/wa/WaThread"
import { WaFilterBar } from "@/components/whatsapp-crm/wa/WaFilterBar"
import { toQuery, activeCount } from "@/components/whatsapp-crm/inbox-filters"
import {
  useAgents,
  useBulkAssign,
  useConversation,
  useConversationsPaged,
  useCreateSavedFilter,
  useCrmMe,
  useCrmStatus,
  useDeleteSavedFilter,
  useLabels,
  useMarkRead,
  useMessages,
  useSavedFilters,
  useSendMedia,
  useSendMessage,
} from "@/hooks/useWhatsappCrm"
import type { InboxCriteria } from "@/types/whatsapp-crm.types"

const RAIL: Array<{ href: string; label: string; Icon: typeof MessageCircle }> = [
  { href: "/whatsapp-crm/pipeline", label: "Pipeline", Icon: TrendingUp },
  { href: "/whatsapp-crm/templates", label: "Templates", Icon: FileText },
  { href: "/whatsapp-crm/campaigns", label: "Campaigns", Icon: Megaphone },
  { href: "/whatsapp-crm/chat", label: "Team chat", Icon: MessagesSquare },
  { href: "/whatsapp-crm/analytics", label: "Analytics", Icon: BarChart3 },
]

function useViewportWidth() {
  const [w, setW] = useState(1280)
  useEffect(() => {
    const fit = () => setW(window.innerWidth)
    fit()
    window.addEventListener("resize", fit)
    return () => window.removeEventListener("resize", fit)
  }, [])
  return w
}

export default function WhatsappInboxPage() {
  const [search, setSearch] = useState("")
  const [criteria, setCriteria] = useState<InboxCriteria>({})
  const [filterOpen, setFilterOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [profileOpen, setProfileOpen] = useState(false)
  const width = useViewportWidth()
  // wide = list | chat | details column, split = list | chat (+ details drawer), single = one pane at a time.
  const mode: "wide" | "split" | "single" = width >= 1240 ? "wide" : width >= 760 ? "split" : "single"
  const debouncedSearch = useDebounce(search, 300)

  const me = useCrmMe()
  const canAssign = me.can("crm.conversations.assign")
  const canReply = me.can("crm.inbox.reply")
  const agents = useAgents()
  const labels = useLabels()
  const bulk = useBulkAssign()
  const saved = useSavedFilters()
  const createSaved = useCreateSavedFilter()
  const deleteSaved = useDeleteSavedFilter()

  // Deep link from the pipeline board: /whatsapp-crm/inbox?conversation=<id>
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("conversation")
    if (id && /^[0-9a-f-]{36}$/i.test(id)) setSelectedId(id)
  }, [])

  const crm = useCrmStatus()
  const biz = useBizMe()
  const query = useMemo(() => toQuery(criteria, debouncedSearch), [criteria, debouncedSearch])
  const list = useConversationsPaged(query)
  const detail = useConversation(selectedId)
  const messages = useMessages(selectedId)
  const send = useSendMessage(selectedId ?? "")
  const sendFile = useSendMedia(selectedId ?? "")
  const markRead = useMarkRead()

  const conversations = useMemo(() => list.data?.pages.flat() ?? [], [list.data])
  const selectedSummary = conversations.find((c) => c.id === selectedId) ?? null
  const active = detail.data ?? selectedSummary

  const unread = selectedSummary?.unread_count ?? 0
  useEffect(() => {
    if (selectedId && unread > 0) markRead.mutate(selectedId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, unread])

  const notConfigured = crm.data && !crm.data.enabled

  const panel = detail.data ? (
    <CustomerPanel
      conversation={detail.data}
      canApplyLabels={me.can("crm.labels.apply")}
      footer={me.can("crm.campaigns.manage") ? <DoNotContactButton contactId={detail.data.contact_id} /> : undefined}
    />
  ) : null

  const showList = mode !== "single" || !selectedId
  const showThread = mode !== "single" || Boolean(selectedId)
  const showPanelColumn = mode === "wide" && profileOpen && panel
  const cols = [showList ? (mode === "single" ? "minmax(0,1fr)" : "clamp(320px,30vw,440px)") : null, showThread ? "minmax(0,1fr)" : null, showPanelColumn ? "340px" : null].filter(Boolean).join(" ")

  const filterProps = {
    criteria,
    onChange: setCriteria,
    labels: labels.data ?? [],
    agents: agents.data ?? [],
    saved: saved.data ?? [],
    onSave: (name: string, c: InboxCriteria) => createSaved.mutateAsync({ name, criteria: c }),
    onDeleteSaved: (id: string) => deleteSaved.mutate(id),
    open: filterOpen,
    onOpenChange: setFilterOpen,
  }

  return (
    <div className="wa-app fixed inset-0 z-50 flex bg-[var(--wa-app-bg)]" data-testid="wa-inbox">
      {/* Left rail: WhatsApp Web's icon column. Its first button takes you back to the dashboard. */}
      <nav aria-label="WhatsApp CRM" className="hidden w-[60px] shrink-0 flex-col items-center gap-1 border-r border-[var(--wa-border)] bg-[var(--wa-rail)] py-3 md:flex">
        <Link href="/dashboard" aria-label="Back to dashboard" title="Back to dashboard" className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--wa-secondary)] transition-colors hover:bg-black/5 dark:hover:bg-white/10">
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <span aria-current="page" title="Chats" className="mt-2 flex h-11 w-11 items-center justify-center rounded-full bg-black/10 text-[var(--wa-text)] dark:bg-white/10">
          <MessageCircle className="h-6 w-6" />
        </span>
        {RAIL.map(({ href, label, Icon }) => (
          <Link key={href} href={href} aria-label={label} title={label} className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--wa-secondary)] transition-colors hover:bg-black/5 dark:hover:bg-white/10">
            <Icon className="h-[22px] w-[22px]" />
          </Link>
        ))}
        <div className="flex-1" />
        <Link href="/whatsapp-crm/settings" aria-label="WhatsApp settings" title="WhatsApp settings" className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--wa-secondary)] transition-colors hover:bg-black/5 dark:hover:bg-white/10">
          <Settings className="h-[22px] w-[22px]" />
        </Link>
      </nav>

      <div className="grid min-w-0 flex-1" style={{ gridTemplateColumns: cols, gridTemplateRows: "minmax(0,1fr)" }}>
        {showList && (
          <div className="min-h-0 min-w-0 border-r border-[var(--wa-border)]">
            <WaChatList
              conversations={conversations}
              isLoading={list.isLoading}
              isRefreshing={list.isFetching && !list.isFetchingNextPage && !list.isLoading}
              isError={list.isError}
              onRetry={() => list.refetch()}
              hasMore={Boolean(list.hasNextPage)}
              loadingMore={list.isFetchingNextPage}
              onLoadMore={() => list.fetchNextPage()}
              selectedId={selectedId}
              onSelect={setSelectedId}
              search={search}
              onSearch={setSearch}
              filtersActive={activeCount(criteria) > 0}
              onClearFilters={() => setCriteria({})}
              filterButton={<WaFilterBar {...filterProps} part="button" />}
              chips={<WaFilterBar {...filterProps} part="chips" />}
              banner={
                notConfigured ? (
                  <div role="status" className="mx-3 mb-2 rounded-lg bg-[var(--wa-banner)] px-3 py-2 text-xs text-[var(--wa-text)]">
                    WhatsApp is not enabled on the server yet, so no customer messages can arrive. Add the Meta credentials in WhatsApp settings and register the webhook{" "}
                    <code className="rounded bg-black/5 px-1">{crm.data?.webhookPath}</code> in Meta.
                  </div>
                ) : undefined
              }
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
              showBack={mode === "single" || width < 768}
            />
          </div>
        )}

        {showThread && (
          <div className="min-h-0 min-w-0">
            {active ? (
              <WaThread
                conversation={active}
                messages={messages.data ?? []}
                isLoading={messages.isLoading}
                sending={send.isPending}
                sendingFile={sendFile.isPending}
                canSend={canReply}
                onBack={mode === "single" ? () => setSelectedId(null) : undefined}
                onOpenProfile={() => setProfileOpen((o) => (mode === "wide" ? !o : true))}
                templateButton={
                  <SendTemplateDialog
                    conversationId={active.id}
                    consent={active.marketing_consent}
                    windowOpen={active.window_open}
                    canSend={canReply && me.can("crm.templates.send")}
                    trigger={
                      active.window_open ? (
                        <button type="button" aria-label="Send a template message" title="Send a template message" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--wa-secondary)] hover:bg-black/5 dark:hover:bg-white/10">
                          <FileText className="h-6 w-6" />
                        </button>
                      ) : (
                        <button type="button" aria-label="Send a template message" className="shrink-0 rounded-full bg-[var(--wa-green)] px-4 py-1.5 text-sm font-medium text-white">
                          Send template
                        </button>
                      )
                    }
                  />
                }
                onSend={(body) => send.mutateAsync(body)}
                onSendFile={(file, caption) => sendFile.mutateAsync({ file, caption })}
                toolsBar={
                  <>
                    <BotStateControl conversation={active} botEnabled={Boolean(crm.data?.botEnabled)} canControl={canReply} />
                    {Boolean(biz.data?.procurementManage) && (
                      <Link
                        href={`/procurement?chat=${active.id}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--wa-green)] px-3 text-xs font-medium text-[var(--wa-green-dark)] hover:bg-black/5"
                        title="Write down what this customer wants to buy"
                      >
                        <ClipboardList className="h-3.5 w-3.5" aria-hidden />
                        Customer request
                      </Link>
                    )}
                    <AssignControl conversation={active} meId={me.data?.userId} canAssign={canAssign} canReply={canReply} />
                  </>
                }
              />
            ) : (
              <div className="wa-doodle flex h-full flex-col items-center justify-center bg-[var(--wa-panel-header)] px-8 text-center">
                <div className="relative z-10 flex flex-col items-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/whatsapp/wa-empty.svg" alt="" width={280} height={190} className="mb-6 opacity-90" />
                  <h2 className="text-[32px] font-light text-[var(--wa-text)]">Bakaloo on WhatsApp</h2>
                  <p className="mt-3 max-w-md text-sm text-[var(--wa-secondary)]">Pick a chat on the left to read and reply. Use the filter button to find unread chats, your own chats or chats from Meta ads.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {showPanelColumn && <div className="min-h-0 min-w-0 border-l border-[var(--wa-border)] bg-[var(--wa-panel)]">{panel}</div>}
      </div>

      {/* Below the wide layout the customer details open as a drawer instead of a column. */}
      <Sheet open={profileOpen && mode !== "wide"} onOpenChange={setProfileOpen}>
        <SheetContent side="right" className="w-[min(92vw,360px)] p-0 sm:max-w-[360px]">
          <SheetTitle className="sr-only">Customer details</SheetTitle>
          <SheetDescription className="sr-only">Labels, consent and ownership for this conversation</SheetDescription>
          {panel}
        </SheetContent>
      </Sheet>
    </div>
  )
}
