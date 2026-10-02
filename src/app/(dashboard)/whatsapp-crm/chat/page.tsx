"use client"

import { useEffect, useState } from "react"
import { MessagesSquare, Plus, Settings2 } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { Forbidden } from "@/components/shared/forbidden"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ChannelList } from "@/components/team-chat/ChannelList"
import { ChannelSettings } from "@/components/team-chat/ChannelSettings"
import { ChatThread } from "@/components/team-chat/ChatThread"
import { NewChatDialog } from "@/components/team-chat/NewChatDialog"
import { useChatChannel, useChatChannels, useChatMe, useChatMessages, useChatMutations } from "@/hooks/useTeamChat"

export default function TeamChatPage() {
  const me = useChatMe()
  const [archived, setArchived] = useState(false)
  const channels = useChatChannels(archived)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const detail = useChatChannel(selectedId)
  const messages = useChatMessages(selectedId)
  const m = useChatMutations()
  const [newOpen, setNewOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Deep link: /whatsapp-crm/chat?channel=<id>
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("channel")
    if (id && /^[0-9a-f-]{36}$/i.test(id)) setSelectedId(id)
  }, [])

  // Opening a chat (and new messages arriving while it is open) marks it read.
  const newest = messages.data?.at(-1)?.seq
  const selectedUnread = channels.data?.find((c) => c.id === selectedId)?.unread ?? 0
  // A tab in the background must not clear unread; coming back to it does.
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const sync = () => setVisible(document.visibilityState !== "hidden")
    sync()
    document.addEventListener("visibilitychange", sync)
    return () => document.removeEventListener("visibilitychange", sync)
  }, [])
  useEffect(() => {
    if (selectedId && selectedUnread > 0 && visible) m.markRead.mutate(selectedId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, newest, selectedUnread, visible])

  // A chat you can no longer open (removed, deactivated link) just closes.
  useEffect(() => { if (detail.isError) setSelectedId(null) }, [detail.isError])

  if (me.isLoading) return <Skeleton className="h-40 w-full" />
  if (me.isError || !me.data) return <Forbidden />
  const meData = me.data
  const list = channels.data ?? []
  const channel = detail.data ?? null

  return (
    <div className="space-y-4">
      <PageHeader title="Team Chat" subtitle="Message your team — HQ and stores. Internal only: nothing here is ever sent to a customer.">
        <Button onClick={() => setNewOpen(true)}><Plus className="mr-1 h-4 w-4" /> New chat</Button>
      </PageHeader>

      <div className="grid h-[calc(100vh-14rem)] min-h-[28rem] grid-cols-1 overflow-hidden rounded-lg border bg-card md:grid-cols-[20rem_1fr]">
        <aside className={`${selectedId ? "hidden md:flex" : "flex"} min-h-0 flex-col border-r`} aria-label="Your chats">
          <div className="flex gap-1 border-b p-2" role="tablist" aria-label="Chat list">
            <button type="button" role="tab" aria-selected={!archived} onClick={() => { setArchived(false); setSelectedId(null) }} className={`rounded-full border px-3 py-1 text-xs ${!archived ? "border-primary bg-primary/10 font-semibold" : "hover:bg-muted"}`}>Active</button>
            <button type="button" role="tab" aria-selected={archived} onClick={() => { setArchived(true); setSelectedId(null) }} className={`rounded-full border px-3 py-1 text-xs ${archived ? "border-primary bg-primary/10 font-semibold" : "hover:bg-muted"}`}>Archived</button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ChannelList channels={list} isLoading={channels.isLoading} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
        </aside>

        <div className={`${selectedId ? "flex" : "hidden md:flex"} min-h-0 flex-col`}>
          {channel ? (
            <>
              <button type="button" className="border-b px-4 py-1.5 text-left text-xs text-muted-foreground md:hidden" onClick={() => setSelectedId(null)}>← All chats</button>
              <ChatThread
                channel={channel}
                messages={messages.data ?? []}
                isLoading={messages.isLoading}
                meId={meData.userId}
                isHq={meData.isHq}
                canModerate={meData.canManage}
                sending={m.send.isPending}
                onSend={(input) => m.send.mutateAsync({ id: channel.id, ...input }).catch(() => undefined)}
                onDelete={(messageId) => m.remove.mutate({ id: channel.id, messageId })}
                headerExtra={channel.kind !== "DM" || channel.abilities.unarchive ? (
                  <Button variant="outline" size="sm" aria-label="Chat settings" onClick={() => setSettingsOpen(true)}><Settings2 className="mr-1 h-4 w-4" /> Details</Button>
                ) : undefined}
              />
              <ChannelSettings channel={channel} meId={meData.userId} open={settingsOpen} onClose={() => setSettingsOpen(false)} onGone={() => setSelectedId(null)} />
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState icon={<MessagesSquare className="h-6 w-6 text-muted-foreground" />} title="Pick a chat" description="Choose a conversation on the left, or start a new one." />
            </div>
          )}
        </div>
      </div>

      <NewChatDialog
        open={newOpen}
        canManage={meData.canManage}
        saving={m.create.isPending}
        onClose={() => setNewOpen(false)}
        onCreate={(input) => m.create.mutate(input, { onSuccess: (c) => { setNewOpen(false); setArchived(false); setSelectedId(c.id); toast.success(c.kind === "DM" ? "Chat opened" : "Chat created") } })}
      />
    </div>
  )
}
