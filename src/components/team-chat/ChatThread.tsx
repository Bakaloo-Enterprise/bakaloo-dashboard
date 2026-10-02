"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Paperclip, Send, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { cn, formatDateTime } from "@/lib/utils"
import type { ChatChannel, ChatMessage, ChatRefResult } from "@/types/team-chat.types"
import { AttachPicker } from "./AttachPicker"
import { activeMention, dayKey, dayLabel, extractMentions, REF_TYPE_LABEL, refHref, splitMentions, startsBlock, suggestPeople } from "./chat-helpers"

interface Props {
  channel: ChatChannel
  messages: ChatMessage[]
  isLoading: boolean
  meId: string
  isHq: boolean
  canModerate: boolean
  sending: boolean
  onSend: (input: { body: string; mentions: string[]; ref?: { type: ChatRefResult["type"]; id: string } }) => Promise<unknown>
  onDelete: (messageId: string) => void
  headerExtra?: React.ReactNode
}

export function ChatThread({ channel, messages, isLoading, meId, isHq, canModerate, sending, onSend, onDelete, headerExtra }: Props) {
  const [text, setText] = useState("")
  const [caret, setCaret] = useState(0)
  const [ref, setRef] = useState<ChatRefResult | null>(null)
  const [attachOpen, setAttachOpen] = useState(false)
  const [pick, setPick] = useState(0)
  const bottom = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLTextAreaElement>(null)

  const people = useMemo(() => (channel.members ?? []).filter((m) => m.name && m.user_id !== meId).map((m) => ({ id: m.user_id, name: m.name as string })), [channel.members, meId])
  const myName = (channel.members ?? []).find((m) => m.user_id === meId)?.name
  const myMention = myName ? `@${myName}` : null
  const everyone = useMemo(() => (channel.members ?? []).filter((m) => m.name).map((m) => ({ id: m.user_id, name: m.name as string })), [channel.members])

  useEffect(() => { bottom.current?.scrollIntoView?.({ block: "end" }) }, [messages.length, channel.id])
  useEffect(() => { setText(""); setRef(null) }, [channel.id])

  const am = activeMention(text, caret)
  const suggestions = am ? suggestPeople(people, am.query) : []
  const showSuggestions = suggestions.length > 0

  const insertMention = (name: string) => {
    if (!am) return
    const next = `${text.slice(0, am.start)}@${name} ${text.slice(caret)}`
    const pos = am.start + name.length + 2
    setText(next); setCaret(pos); setPick(0)
    requestAnimationFrame(() => { box.current?.focus(); box.current?.setSelectionRange(pos, pos) })
  }

  const canSend = channel.abilities.send && (text.trim().length > 0 || ref) && !sending
  const submit = async () => {
    if (!canSend) return
    const body = text
    await onSend({ body, mentions: extractMentions(body, people), ...(ref ? { ref: { type: ref.type, id: ref.id } } : {}) })
    setText(""); setRef(null)
  }

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault()
      setPick((p) => (e.key === "ArrowDown" ? (p + 1) % suggestions.length : (p - 1 + suggestions.length) % suggestions.length))
    } else if (showSuggestions && (e.key === "Enter" || e.key === "Tab")) {
      e.preventDefault()
      insertMention(suggestions[pick]?.name ?? suggestions[0].name)
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void submit()
    }
  }

  return (
    <section aria-label={`Chat ${channel.name}`} className="flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{channel.name}</h2>
          <p className="truncate text-xs text-muted-foreground">
            {channel.kind === "DM" ? "Direct message" : `${channel.member_count} people${channel.description ? ` · ${channel.description}` : ""}`}
            {channel.archived ? " · archived" : ""}
          </p>
        </div>
        {headerExtra}
      </header>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 py-3" role="log" aria-live="polite" aria-label="Messages">
        {isLoading && <Skeleton className="h-16 w-2/3" />}
        {!isLoading && messages.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No messages yet. Say hello.</p>}
        {messages.map((m, i) => {
          const prev = messages[i - 1]
          const mine = m.sender_id === meId
          const block = startsBlock(prev, m)
          return (
            <div key={m.id}>
              {(!prev || dayKey(prev.created_at) !== dayKey(m.created_at)) && (
                <p className="my-3 text-center text-[11px] font-medium text-muted-foreground">{dayLabel(m.created_at)}</p>
              )}
              <div className={cn("group flex", mine ? "justify-end" : "justify-start", block && i > 0 ? "mt-2" : "")}>
                <div className={cn("max-w-[78%] rounded-lg px-3 py-1.5 text-sm shadow-sm", mine ? "bg-emerald-100 text-emerald-950 dark:bg-emerald-900/50 dark:text-emerald-50" : "border bg-card")}>
                  {block && !mine && <p className="text-xs font-semibold text-muted-foreground">{m.sender_name}</p>}
                  {m.deleted ? (
                    <p className="italic text-muted-foreground">Message deleted</p>
                  ) : (
                    <>
                      {m.body && (
                        <p className="whitespace-pre-wrap break-words">
                          {splitMentions(m.body, m.mentions, everyone).map((s, k) =>
                            s.mention ? <mark key={k} className={cn("rounded px-0.5", s.text === myMention ? "bg-amber-200 text-amber-950" : "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100")}>{s.text}</mark> : <span key={k}>{s.text}</span>,
                          )}
                        </p>
                      )}
                      {m.ref && (
                        <Link href={refHref(m.ref)} className="mt-1 block rounded border bg-background/70 px-2 py-1 text-xs hover:bg-background">
                          <span className="text-muted-foreground">{REF_TYPE_LABEL[m.ref.type]} · </span><span className="font-medium">{m.ref.label}</span>
                        </Link>
                      )}
                    </>
                  )}
                  <p className="mt-0.5 flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
                    <span>{formatDateTime(m.created_at)}</span>
                    {!m.deleted && !channel.archived && (mine || canModerate) && (
                      <button type="button" aria-label="Delete message" title="Delete message" onClick={() => onDelete(m.id)} className="opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottom} />
      </div>

      <footer className="relative border-t p-3">
        {!channel.abilities.send ? (
          <p className="text-center text-xs text-muted-foreground">This chat is archived. {channel.abilities.unarchive ? "Restore it to write here." : "Ask the owner to restore it."}</p>
        ) : (
          <>
            {showSuggestions && (
              <ul role="listbox" aria-label="Mention someone" className="absolute bottom-full left-3 z-10 mb-1 w-64 overflow-hidden rounded-md border bg-popover text-sm shadow-md">
                {suggestions.map((p, i) => (
                  <li key={p.id} role="option" aria-selected={i === pick}>
                    <button type="button" onMouseDown={(e) => { e.preventDefault(); insertMention(p.name) }} className={cn("w-full px-3 py-1.5 text-left hover:bg-muted", i === pick && "bg-muted")}>{p.name}</button>
                  </li>
                ))}
              </ul>
            )}
            {ref && (
              <p className="mb-2 inline-flex items-center gap-2 rounded-full border bg-muted px-2 py-0.5 text-xs">
                {REF_TYPE_LABEL[ref.type]}: <strong>{ref.label}</strong>
                <button type="button" aria-label="Remove attachment" onClick={() => setRef(null)}><X className="h-3 w-3" /></button>
              </p>
            )}
            <div className="flex items-end gap-2">
              <Button type="button" variant="outline" size="icon" aria-label="Attach an order, product or customer" onClick={() => setAttachOpen(true)}><Paperclip className="h-4 w-4" /></Button>
              <Textarea
                ref={box}
                aria-label="Message"
                rows={2}
                value={text}
                maxLength={4000}
                placeholder="Write a message — @ to mention someone"
                onChange={(e) => { setText(e.target.value); setCaret(e.target.selectionStart ?? e.target.value.length); setPick(0) }}
                onKeyUp={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
                onClick={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
                onKeyDown={onKey}
                className="min-h-0 flex-1 resize-none"
              />
              <Button type="button" onClick={submit} disabled={!canSend} aria-label="Send"><Send className="mr-1 h-4 w-4" /> Send</Button>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Internal only — never sent to customers.</p>
          </>
        )}
      </footer>
      <AttachPicker open={attachOpen} isHq={isHq} onClose={() => setAttachOpen(false)} onPick={setRef} />
    </section>
  )
}
