"use client"

import { useState } from "react"
import { Search } from "lucide-react"
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
    <div className="flex h-full flex-col border-r">
      <div className="space-y-2 border-b p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={p.search}
            onChange={(e) => p.onSearch(e.target.value)}
            placeholder="Search name or number"
            className="pl-8"
            aria-label="Search conversations"
          />
        </div>
        <div className="flex gap-1" role="tablist" aria-label="Conversation status">
          {FILTERS.map((f) => (
            <button
              key={f.label}
              role="tab"
              aria-selected={p.status === f.value}
              onClick={() => p.onStatus(f.value)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                p.status === f.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Select value={p.owner || ANY} onValueChange={(v) => p.onOwner(v === ANY ? "" : v)}>
            <SelectTrigger className="h-8 text-xs" aria-label="Filter by owner">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any owner</SelectItem>
              <SelectItem value="me">Mine</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
            </SelectContent>
          </Select>
          <Select value={p.labelId || ANY} onValueChange={(v) => p.onLabelId(v === ANY ? "" : v)}>
            <SelectTrigger className="h-8 text-xs" aria-label="Filter by label">
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

      <div className="flex-1 overflow-y-auto">
        {p.isLoading && (
          <div className="space-y-3 p-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        )}
        {!p.isLoading && p.conversations.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">No conversations yet. Customer messages will appear here.</p>
        )}
        {p.conversations.map((c) => {
          const title = conversationTitle(c)
          return (
            <div
              key={c.id}
              className={cn("flex items-start gap-2 border-b px-3 py-3 transition-colors hover:bg-muted/50", p.selectedId === c.id && "bg-muted")}
            >
              {p.canBulk && (
                <Checkbox
                  checked={p.checked.has(c.id)}
                  onCheckedChange={() => p.onToggleChecked(c.id)}
                  aria-label={`Select conversation with ${title}`}
                  className="mt-3"
                />
              )}
              <button onClick={() => p.onSelect(c.id)} aria-current={p.selectedId === c.id} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                  {initials(title)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{title}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {c.last_message_at ? formatRelativeTime(c.last_message_at) : ""}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-muted-foreground">
                      {c.last_message_direction === "OUTBOUND" ? "You: " : ""}
                      {c.last_message_preview ?? ""}
                    </span>
                    {c.unread_count > 0 && (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[11px] font-semibold text-white">
                        {c.unread_count}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {needsPerson(c) && <Badge className="h-5 bg-red-600 px-1.5 text-[10px] text-white hover:bg-red-600">Needs a person</Badge>}
                    {!c.customer_id && <Badge variant="outline" className="h-5 px-1.5 text-[10px]">New lead</Badge>}
                    {c.source === "META_AD" && <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">Meta Ad</Badge>}
                    {!c.window_open && <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-amber-600">24h closed</Badge>}
                    {c.labels.slice(0, 3).map((l) => (
                      <LabelChip key={l.id} label={l} />
                    ))}
                    {c.labels.length > 3 && <span className="text-[10px] text-muted-foreground">+{c.labels.length - 3}</span>}
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">{c.assigned_name ? `Owner: ${c.assigned_name}` : "Unassigned"}</p>
                </div>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
