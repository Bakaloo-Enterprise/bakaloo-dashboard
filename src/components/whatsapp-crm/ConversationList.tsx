"use client"

import { useState } from "react"
import { Search, X } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn, formatRelativeTime } from "@/lib/utils"
import type { ConversationStatus, CrmAgent, WaConversation, WaLabel } from "@/types/whatsapp-crm.types"
import { conversationTitle, initials } from "./helpers"
import { LabelChip } from "./LabelChip"
import { needsPerson } from "./BotStateControl"

const FILTERS: Array<{ label: string; value: ConversationStatus | undefined }> = [
  { label: "All", value: undefined },
  { label: "Open", value: "OPEN" },
  { label: "Pending", value: "PENDING" },
  { label: "Resolved", value: "RESOLVED" },
]
const ANY = "__any__"
const UNASSIGNED = "__none__"

interface Props {
  conversations: WaConversation[]
  isLoading: boolean
  selectedId: string | null
  onSelect: (id: string) => void
  search: string
  onSearch: (v: string) => void
  status: ConversationStatus | undefined
  onStatus: (v: ConversationStatus | undefined) => void
  /** "" = anyone, "me", "unassigned" */
  owner: string
  onOwner: (v: string) => void
  labelId: string
  onLabelId: (v: string) => void
  labels: WaLabel[]
  /** Bulk reassign (managers only). */
  canBulk: boolean
  agents: CrmAgent[]
  checked: Set<string>
  onToggleChecked: (id: string) => void
  onClearChecked: () => void
  onBulkAssign: (userId: string | null) => void
  bulkPending: boolean
}

export function ConversationList(p: Props) {
  const [bulkTarget, setBulkTarget] = useState<string>("")
  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      <div className="shrink-0 space-y-2.5 border-b p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={p.search}
            onChange={(e) => p.onSearch(e.target.value)}
            placeholder="Search name or number"
            className="h-9 rounded-full bg-muted/50 pl-9 pr-8"
            aria-label="Search conversations"
          />
          {p.search && (
            <button onClick={() => p.onSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground" aria-label="Clear search">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Conversation status">
          {FILTERS.map((f) => (
            <button
              key={f.label}
              role="tab"
              aria-selected={p.status === f.value}
              onClick={() => p.onStatus(f.value)}
              className={cn(
                "rounded-md px-2 py-1 text-xs font-medium transition-all",
                p.status === f.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Select value={p.owner || ANY} onValueChange={(v) => p.onOwner(v === ANY ? "" : v)}>
            <SelectTrigger className="h-8 rounded-lg text-xs" aria-label="Filter by owner">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any owner</SelectItem>
              <SelectItem value="me">Mine</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
            </SelectContent>
          </Select>
          <Select value={p.labelId || ANY} onValueChange={(v) => p.onLabelId(v === ANY ? "" : v)}>
            <SelectTrigger className="h-8 rounded-lg text-xs" aria-label="Filter by label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any label</SelectItem>
              {p.labels.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {p.canBulk && p.checked.size > 0 && (
          <div className="flex items-center gap-2 rounded-md bg-muted p-2" role="region" aria-label="Bulk reassign">
            <span className="text-xs font-medium">{p.checked.size} selected</span>
            <Select value={bulkTarget} onValueChange={setBulkTarget}>
              <SelectTrigger className="h-7 flex-1 text-xs" aria-label="Reassign selected to">
                <SelectValue placeholder="Assign to…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                {p.agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name || a.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={!bulkTarget || p.bulkPending}
              onClick={() => {
                p.onBulkAssign(bulkTarget === UNASSIGNED ? null : bulkTarget)
                setBulkTarget("")
                p.onClearChecked()
              }}
            >
              Move
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={p.onClearChecked}>
              Clear
            </Button>
          </div>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {p.isLoading && (
          <div className="space-y-3 p-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        )}
        {!p.isLoading && p.conversations.length === 0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">No conversations yet. New customer messages will appear here automatically.</p>
        )}
        <ul>
          {p.conversations.map((c) => {
            const title = conversationTitle(c)
            const selected = p.selectedId === c.id
            return (
              <li
                key={c.id}
                className={cn(
                  "group relative flex items-start gap-2 border-b border-border/60 px-3 py-3 transition-colors hover:bg-muted/60",
                  selected && "bg-emerald-50 hover:bg-emerald-50 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/30",
                )}
              >
                {selected && <span className="absolute inset-y-0 left-0 w-1 bg-emerald-600" aria-hidden />}
                {p.canBulk && (
                  <Checkbox
                    checked={p.checked.has(c.id)}
                    onCheckedChange={() => p.onToggleChecked(c.id)}
                    aria-label={`Select conversation with ${title}`}
                    className="mt-3.5"
                  />
                )}
                <button onClick={() => p.onSelect(c.id)} aria-current={selected} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                  <Avatar className="h-11 w-11">
                    <AvatarFallback className="bg-emerald-100 text-sm font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">{initials(title)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("truncate text-sm", c.unread_count > 0 ? "font-semibold" : "font-medium")}>{title}</span>
                      <span className={cn("shrink-0 text-[11px]", c.unread_count > 0 ? "font-medium text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>
                        {c.last_message_at ? formatRelativeTime(c.last_message_at) : ""}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <span className={cn("truncate text-xs", c.unread_count > 0 ? "text-foreground" : "text-muted-foreground")}>
                        {c.last_message_direction === "OUTBOUND" ? "You: " : ""}
                        {c.last_message_preview ?? ""}
                      </span>
                      {c.unread_count > 0 && (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[11px] font-semibold text-white">
                          {c.unread_count > 99 ? "99+" : c.unread_count}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      {needsPerson(c) && <Badge className="h-5 bg-red-600 px-1.5 text-[10px] text-white hover:bg-red-600">Needs a person</Badge>}
                      {!c.customer_id && <Badge variant="outline" className="h-5 px-1.5 text-[10px]">New lead</Badge>}
                      {c.source === "META_AD" && <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">Meta Ad</Badge>}
                      {!c.window_open && <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-amber-600">24h closed</Badge>}
                      {c.labels.slice(0, 3).map((l) => (
                        <LabelChip key={l.id} label={l} />
                      ))}
                      {c.labels.length > 3 && <span className="text-[10px] text-muted-foreground">+{c.labels.length - 3}</span>}
                    </div>
                    <p className="mt-1 truncate text-[11px] text-muted-foreground">{c.assigned_name ? `Owner: ${c.assigned_name}` : "Unassigned"}</p>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </ScrollArea>
    </div>
  )
}
