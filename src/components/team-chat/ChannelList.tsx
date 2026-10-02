"use client"

import { Hash, Lock, Users } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn, formatRelativeTime } from "@/lib/utils"
import type { ChatChannel } from "@/types/team-chat.types"

function KindIcon({ kind }: { kind: ChatChannel["kind"] }) {
  if (kind === "CHANNEL") return <Hash className="h-4 w-4" aria-hidden />
  if (kind === "GROUP") return <Users className="h-4 w-4" aria-hidden />
  return <Lock className="h-4 w-4" aria-hidden />
}

export function ChannelList({ channels, isLoading, selectedId, onSelect }: { channels: ChatChannel[]; isLoading: boolean; selectedId: string | null; onSelect: (id: string) => void }) {
  if (isLoading) return <div className="space-y-2 p-3"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
  if (channels.length === 0) return <p className="p-4 text-sm text-muted-foreground">No chats yet. Start one with “New chat”.</p>
  return (
    <ul aria-label="Chats" className="divide-y">
      {channels.map((c) => {
        const unread = c.unread ?? 0
        return (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              aria-current={selectedId === c.id ? "true" : undefined}
              aria-label={`${c.name}${unread ? `, ${unread} unread` : ""}`}
              className={cn("flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-muted/50", selectedId === c.id && "bg-muted")}
            >
              <span className="mt-0.5 text-muted-foreground"><KindIcon kind={c.kind} /></span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className={cn("truncate text-sm", unread ? "font-semibold" : "font-medium")}>{c.name}</span>
                  {c.last_message_at && <span className="shrink-0 text-[11px] text-muted-foreground">{formatRelativeTime(c.last_message_at)}</span>}
                </span>
                <span className="flex items-center justify-between gap-2">
                  <span className={cn("truncate text-xs", unread ? "text-foreground" : "text-muted-foreground")}>{c.preview || (c.kind === "DM" ? "Say hello" : `${c.member_count} people`)}</span>
                  {unread > 0 && (
                    <span className={cn("shrink-0 rounded-full px-1.5 text-[11px] font-semibold text-white", (c.unread_mentions ?? 0) > 0 ? "bg-red-600" : "bg-emerald-600")}>
                      {(c.unread_mentions ?? 0) > 0 ? "@ " : ""}{unread}
                    </span>
                  )}
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
