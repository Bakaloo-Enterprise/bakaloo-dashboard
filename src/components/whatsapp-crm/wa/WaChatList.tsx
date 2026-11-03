"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowLeft, Loader2, MoreVertical, Search, X } from "lucide-react"
import Link from "next/link"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { CrmAgent, WaConversation } from "@/types/whatsapp-crm.types"
import { conversationTitle } from "../helpers"
import { needsPerson } from "../BotStateControl"
import { listTime } from "../inbox-filters"
import { WaAvatar, WaTicks } from "./WaBits"

const UNASSIGNED = "__none__"

interface Props {
  conversations: WaConversation[]
  isLoading: boolean
  isRefreshing?: boolean
  isError?: boolean
  onRetry?: () => void
  hasMore?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void
  selectedId: string | null
  onSelect: (id: string) => void
  search: string
  onSearch: (v: string) => void
  filtersActive: boolean
  onClearFilters: () => void
  /** The filter button + panel (rendered by the filter bar). */
  filterButton: React.ReactNode
  /** The chips row. */
  chips: React.ReactNode
  banner?: React.ReactNode
  canBulk: boolean
  agents: CrmAgent[]
  checked: Set<string>
  onToggleChecked: (id: string) => void
  onClearChecked: () => void
  onBulkAssign: (userId: string | null) => void
  bulkPending: boolean
  /** Small screens: the rail is hidden, so the list header carries the back button. */
  showBack: boolean
}

export function WaChatList(p: Props) {
  const [selectMode, setSelectMode] = useState(false)
  const [bulkTarget, setBulkTarget] = useState("")
  const sentinel = useRef<HTMLLIElement>(null)
  const { hasMore, loadingMore, onLoadMore } = p

  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasMore || loadingMore || !onLoadMore || typeof IntersectionObserver === "undefined") return
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && onLoadMore(), { rootMargin: "160px" })
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, loadingMore, onLoadMore, p.conversations.length])

  const exitSelect = () => {
    setSelectMode(false)
    p.onClearChecked()
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--wa-panel)]">
      <div className="flex h-[59px] shrink-0 items-center gap-1 px-4">
        {p.showBack && (
          <Link href="/" aria-label="Back to dashboard" className="-ml-2 mr-1 flex h-10 w-10 items-center justify-center rounded-full text-[var(--wa-secondary)] hover:bg-black/5">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        )}
        <h1 className="flex-1 text-[22px] font-bold leading-none text-[var(--wa-text)]">Chats</h1>
        {p.filterButton}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="Menu" title="Menu" className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--wa-secondary)] hover:bg-black/5 dark:hover:bg-white/10">
              <MoreVertical className="h-5 w-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {p.canBulk && <DropdownMenuItem onSelect={() => (selectMode ? exitSelect() : setSelectMode(true))}>{selectMode ? "Stop selecting chats" : "Select chats to reassign"}</DropdownMenuItem>}
            <DropdownMenuItem onSelect={p.onRetry}>Refresh</DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/whatsapp-crm/pipeline">Open pipeline</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {p.banner}

      <div className="shrink-0 px-3 pb-2 pt-1">
        <div className="relative flex h-9 items-center rounded-lg bg-[var(--wa-input-bg)]">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-[var(--wa-secondary)]" aria-hidden />
          <input
            value={p.search}
            onChange={(e) => p.onSearch(e.target.value)}
            placeholder="Search name or number"
            aria-label="Search conversations"
            className="h-full w-full bg-transparent pl-14 pr-8 text-sm text-[var(--wa-text)] outline-none placeholder:text-[var(--wa-secondary)]"
          />
          {p.search && (
            <button onClick={() => p.onSearch("")} className="absolute right-2 rounded-full p-1 text-[var(--wa-secondary)]" aria-label="Clear search">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {p.chips}

      {p.canBulk && selectMode && (
        <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg bg-[var(--wa-panel-header)] p-2" role="region" aria-label="Bulk reassign">
          <span className="text-xs font-medium">{p.checked.size} selected</span>
          <Select value={bulkTarget} onValueChange={setBulkTarget}>
            <SelectTrigger className="h-8 flex-1 text-xs" aria-label="Reassign selected to">
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
          <button
            type="button"
            disabled={!bulkTarget || p.checked.size === 0 || p.bulkPending}
            onClick={() => {
              p.onBulkAssign(bulkTarget === UNASSIGNED ? null : bulkTarget)
              setBulkTarget("")
              exitSelect()
            }}
            className="rounded-md bg-[var(--wa-green)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
          >
            Move
          </button>
          <button type="button" onClick={exitSelect} className="text-xs text-[var(--wa-secondary)]">
            Cancel
          </button>
        </div>
      )}

      <div className="wa-scroll relative min-h-0 flex-1 overflow-y-auto">
        {p.isRefreshing && <div className="sticky top-0 z-10 h-0.5 w-full animate-pulse bg-[var(--wa-green)]" role="progressbar" aria-label="Updating list" />}
        {p.isLoading && (
          <div className="space-y-4 p-4">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-[49px] w-[49px] shrink-0 animate-pulse rounded-full bg-[var(--wa-avatar)]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-1/2 animate-pulse rounded bg-[var(--wa-panel-header)]" />
                  <div className="h-3 w-4/5 animate-pulse rounded bg-[var(--wa-panel-header)]" />
                </div>
              </div>
            ))}
          </div>
        )}
        {p.isError && (
          <div role="alert" className="m-3 rounded-lg bg-red-50 p-3 text-xs text-red-800">
            Could not load conversations.{" "}
            {p.onRetry && (
              <button onClick={p.onRetry} className="font-semibold underline">
                Try again
              </button>
            )}
          </div>
        )}
        {!p.isLoading && !p.isError && p.conversations.length === 0 && (
          <div className="px-8 py-14 text-center text-sm text-[var(--wa-secondary)]">
            {p.filtersActive || p.search ? (
              <>
                <p>No chats match these filters.</p>
                <button onClick={() => { p.onClearFilters(); p.onSearch("") }} className="mt-2 font-medium text-[var(--wa-green-dark)] underline">
                  Show all chats
                </button>
              </>
            ) : (
              <p>No conversations yet. New customer messages will appear here automatically.</p>
            )}
          </div>
        )}
        <ul role="list" aria-label="Chats">
          {p.conversations.map((c) => {
            const title = conversationTitle(c)
            const selected = p.selectedId === c.id
            const unread = c.unread_count > 0
            return (
              <li key={c.id} className={cn("relative flex items-center transition-colors", selected ? "bg-[var(--wa-selected)]" : "hover:bg-[var(--wa-hover)]")}>
                {p.canBulk && selectMode && (
                  <Checkbox className="ml-3" checked={p.checked.has(c.id)} onCheckedChange={() => p.onToggleChecked(c.id)} aria-label={`Select conversation with ${title}`} />
                )}
                <button onClick={() => (selectMode ? p.onToggleChecked(c.id) : p.onSelect(c.id))} aria-current={selected} className="flex min-w-0 flex-1 items-center gap-3 pl-3 text-left">
                  <WaAvatar />
                  <div className="min-w-0 flex-1 border-b border-[var(--wa-border)] py-3 pr-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[17px] leading-[21px] text-[var(--wa-text)]">{title}</span>
                      <span className={cn("shrink-0 text-xs", unread ? "font-medium text-[var(--wa-unread)]" : "text-[var(--wa-secondary)]")}>{listTime(c.last_message_at)}</span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1 text-sm leading-5 text-[var(--wa-secondary)]">
                        {c.last_message_direction === "OUTBOUND" && <WaTicks status={c.last_message_status} />}
                        <span className="truncate">{c.last_message_preview ?? ""}</span>
                      </span>
                      {unread && (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[var(--wa-unread)] px-1.5 text-xs font-semibold text-white" aria-label={`${c.unread_count} unread`}>
                          {c.unread_count > 99 ? "99+" : c.unread_count}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {needsPerson(c) && <span className="rounded bg-red-600 px-1.5 text-[10px] font-medium leading-4 text-white">Needs a person</span>}
                      {c.source === "META_AD" && <span className="rounded bg-[#1877F2] px-1.5 text-[10px] font-medium leading-4 text-white">Meta Ad</span>}
                      {!c.customer_id && <span className="rounded border border-[var(--wa-border)] px-1.5 text-[10px] leading-4 text-[var(--wa-secondary)]">New lead</span>}
                      {!c.window_open && <span className="rounded border border-amber-400/60 px-1.5 text-[10px] leading-4 text-amber-600">24h closed</span>}
                      {c.labels
                        .filter((l) => !(c.source === "META_AD" && l.name === "Meta Ad"))
                        .slice(0, 3)
                        .map((l) => (
                          <span key={l.id} className="rounded px-1.5 text-[10px] font-medium leading-4 text-white" style={{ background: l.color }}>
                            {l.name}
                          </span>
                        ))}
                      {c.assigned_name && <span className="truncate text-[10px] text-[var(--wa-secondary)]">· {c.assigned_name}</span>}
                    </div>
                  </div>
                </button>
              </li>
            )
          })}
          {p.hasMore && (
            <li ref={sentinel} className="flex justify-center p-3">
              <button disabled={p.loadingMore} onClick={p.onLoadMore} className="flex items-center gap-1.5 rounded-full bg-[var(--wa-panel-header)] px-4 py-1.5 text-xs text-[var(--wa-secondary)]">
                {p.loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {p.loadingMore ? "Loading…" : "Load more"}
              </button>
            </li>
          )}
        </ul>
      </div>
      <span className="sr-only" aria-live="polite">{p.conversations.length} chats</span>
    </div>
  )
}
