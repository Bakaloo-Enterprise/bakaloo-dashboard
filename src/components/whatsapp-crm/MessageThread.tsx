"use client"

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  Bot,
  Check,
  CheckCheck,
  Clock,
  FileText,
  Image as ImageIcon,
  Loader2,
  PanelRight,
  Paperclip,
  Send,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { getMessages } from "@/services/whatsapp-crm.service"
import type { WaConversation, WaMessage } from "@/types/whatsapp-crm.types"
import { clockTime, conversationHandle, conversationTitle, dayLabel, formatBytes, initials, mediaInfo, STATUS_LABEL, windowHoursLeft } from "./helpers"
import { MessageMedia } from "./MessageMedia"

const MEDIA_TYPES = new Set(["image", "video", "audio", "document", "sticker", "location"])
/** What the file picker offers; the server checks again and explains anything WhatsApp would refuse. */
const ACCEPT_MEDIA = "image/jpeg,image/png,video/mp4,video/3gpp"
const ACCEPT_DOCS = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,audio/aac,audio/mp4,audio/mpeg,audio/amr,audio/ogg"
const MAX_FILE = 25 * 1024 * 1024

function Ticks({ status }: { status: WaMessage["status"] }) {
  if (status === "QUEUED") return <Clock className="h-3 w-3" aria-label="Sending" />
  if (status === "FAILED") return <AlertTriangle className="h-3 w-3 text-red-500" aria-label="Failed" />
  if (status === "SENT") return <Check className="h-3 w-3" aria-label="Sent" />
  return <CheckCheck className={cn("h-3 w-3", status === "READ" && "text-sky-500")} aria-label={STATUS_LABEL[status]} />
}

function Bubble({ m, conversationId, tail }: { m: WaMessage; conversationId: string; tail: boolean }) {
  const out = m.direction === "OUTBOUND"
  const isMedia = MEDIA_TYPES.has(m.msg_type)
  const caption = isMedia ? mediaInfo(m).caption ?? m.body : m.body
  const text = caption || (isMedia ? "" : m.template_name ? `Template: ${m.template_name}` : m.body ?? `[${m.msg_type}]`)
  const mediaOnly = isMedia && !text && m.msg_type !== "document" && m.msg_type !== "audio"

  return (
    <div className={cn("flex px-1", out ? "justify-end" : "justify-start", tail ? "mt-2" : "mt-0.5")}>
      <div
        className={cn(
          "relative min-w-0 max-w-[85%] rounded-2xl text-sm shadow-sm sm:max-w-[72%]",
          mediaOnly ? "p-1" : "px-3 py-2",
          out
            ? "rounded-br-md bg-emerald-100 text-emerald-950 dark:bg-emerald-900/60 dark:text-emerald-50"
            : "rounded-bl-md border bg-card text-card-foreground",
          m.status === "FAILED" && "ring-1 ring-red-300",
        )}
      >
        {m.is_bot && (
          <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
            <Bot className="h-3 w-3" /> Auto-reply (bot)
          </p>
        )}
        {m.template_name && <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Template</p>}
        {isMedia && (
          <div className={cn(text || !mediaOnly ? "mb-1.5" : "")}>
            <MessageMedia conversationId={conversationId} message={m} />
          </div>
        )}
        {text && <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{text}</p>}
        <div className={cn("flex items-center justify-end gap-1 text-[10px] text-muted-foreground", mediaOnly ? "absolute bottom-2 right-3 rounded-full bg-black/45 px-1.5 py-0.5 text-white" : "mt-1")}>
          <span>{clockTime(m.created_at)}</span>
          {out && <Ticks status={m.status} />}
        </div>
        {m.status === "FAILED" && (
          <p className="mt-1 text-[11px] text-red-600">Not delivered{m.error_details ? `: ${m.error_details}` : m.error_title ? `: ${m.error_title}` : ""}</p>
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
  onSendFile?: (file: File, caption?: string) => Promise<unknown>
  sending: boolean
  sendingFile?: boolean
  /** Owner / assignment control rendered in the header. */
  headerExtra?: React.ReactNode
  /** False when the user lacks crm.inbox.reply — composer is read-only. */
  canSend?: boolean
  /** Extra controls next to the Send button (e.g. “Send template”). Stays usable when the window is closed. */
  composerExtra?: React.ReactNode
  /** Mobile: back to the conversation list. */
  onBack?: () => void
  /** Smaller screens: open the customer details drawer. */
  onOpenProfile?: () => void
}

export function MessageThread({ conversation, messages, isLoading, onSend, onSendFile, sending, sendingFile, headerExtra, canSend = true, composerExtra, onBack, onOpenProfile }: Props) {
  const [text, setText] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [older, setOlder] = useState<WaMessage[]>([])
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [noMoreOlder, setNoMoreOlder] = useState(false)
  const [atBottom, setAtBottom] = useState(true)
  const [unseen, setUnseen] = useState(0)
  const viewportRef = useRef<HTMLDivElement>(null)
  const photoInput = useRef<HTMLInputElement>(null)
  const docInput = useRef<HTMLInputElement>(null)
  const composer = useRef<HTMLTextAreaElement>(null)
  const dragDepth = useRef(0)
  const lastCount = useRef(0)
  const prependHeight = useRef<number | null>(null)

  const title = conversationTitle(conversation)
  const hoursLeft = windowHoursLeft(conversation.last_inbound_at)
  const canReply = conversation.window_open && canSend
  const busy = sending || Boolean(sendingFile)

  // Older pages are loaded on demand and prepended; everything resets when another chat opens.
  useEffect(() => {
    setOlder([])
    setNoMoreOlder(false)
    setFile(null)
    setText("")
    setUnseen(0)
    lastCount.current = 0
  }, [conversation.id])

  // The reply box grows with what is typed (up to ~5 lines) and shrinks back after sending.
  useLayoutEffect(() => {
    const el = composer.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`
  }, [text])

  const all = useMemo(() => {
    const seen = new Set(messages.map((m) => m.id))
    return [...older.filter((m) => !seen.has(m.id)), ...messages]
  }, [older, messages])

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) return setPreview(null)
    const u = URL.createObjectURL(file)
    setPreview(u)
    return () => URL.revokeObjectURL(u)
  }, [file])

  const scrollToBottom = useCallback((smooth = false) => {
    const el = viewportRef.current
    if (el) {
      if (typeof el.scrollTo === "function") el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" })
      else el.scrollTop = el.scrollHeight
    }
    setUnseen(0)
  }, [])

  // New messages: stick to the bottom when the agent is already there (or just opened the chat / sent something);
  // otherwise leave their scroll position alone and show a "new messages" button.
  useLayoutEffect(() => {
    const el = viewportRef.current
    if (prependHeight.current != null && el) {
      el.scrollTop = el.scrollHeight - prependHeight.current
      prependHeight.current = null
      return
    }
    const grew = all.length - lastCount.current
    const newest = all[all.length - 1]
    if (lastCount.current === 0 || atBottom || newest?.direction === "OUTBOUND") scrollToBottom()
    else if (grew > 0) setUnseen((n) => n + grew)
    lastCount.current = all.length
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all.length, conversation.id])

  // Images finishing to load change the height — keep pinned to the bottom.
  useEffect(() => {
    const el = viewportRef.current
    if (!el || typeof ResizeObserver === "undefined") return
    const inner = el.firstElementChild
    if (!inner) return
    const ro = new ResizeObserver(() => {
      if (atBottom) el.scrollTop = el.scrollHeight
    })
    ro.observe(inner)
    return () => ro.disconnect()
  }, [atBottom, conversation.id])

  function onScroll() {
    const el = viewportRef.current
    if (!el) return
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    setAtBottom(near)
    if (near) setUnseen(0)
  }

  async function loadOlder() {
    const first = all[0]
    if (!first || loadingOlder) return
    setLoadingOlder(true)
    try {
      const page = await getMessages(conversation.id, first.created_at)
      if (page.length === 0) setNoMoreOlder(true)
      else {
        prependHeight.current = viewportRef.current?.scrollHeight ?? null
        setOlder((prev) => [...page, ...prev])
        if (page.length < 100) setNoMoreOlder(true)
      }
    } catch {
      toast.error("Could not load earlier messages")
    } finally {
      setLoadingOlder(false)
    }
  }

  function pickFile(f: File | null | undefined) {
    if (!f) return
    if (!canReply || !onSendFile) return
    if (f.size > MAX_FILE) return void toast.error("That file is too large. The limit is 25 MB (photos 5 MB, videos 16 MB).")
    if (f.type.startsWith("image/") && !/^image\/(jpeg|png)$/.test(f.type)) return void toast.error("WhatsApp only accepts JPG or PNG photos.")
    setFile(f)
  }

  async function submit() {
    if (!canReply || busy) return
    if (file && onSendFile) {
      try {
        await onSendFile(file, text.trim() || undefined)
        setFile(null)
        setText("")
        scrollToBottom(true)
      } catch {
        /* toast shown by the mutation; keep the file so nothing is lost */
      }
      return
    }
    const body = text.trim()
    if (!body) return
    try {
      await onSend(body)
      setText("")
      scrollToBottom(true)
    } catch {
      // error toast is shown by the mutation; keep the draft so nothing is lost
    }
  }

  // Rows with a day divider whenever the date changes, and tighter spacing inside a run from the same sender.
  const rows = useMemo(() => {
    const out: Array<{ key: string; day?: string; msg?: WaMessage; tail?: boolean }> = []
    let prev: WaMessage | null = null
    for (const m of all) {
      const d = dayLabel(m.created_at)
      if (!prev || dayLabel(prev.created_at) !== d) out.push({ key: `d-${m.id}`, day: d })
      out.push({ key: m.id, msg: m, tail: !prev || prev.direction !== m.direction || dayLabel(prev.created_at) !== d })
      prev = m
    }
    return out
  }, [all])

  return (
    <div
      className="relative flex h-full min-h-0 flex-col bg-background"
      onDragEnter={(e) => {
        if (!canReply || !onSendFile || !e.dataTransfer.types.includes("Files")) return
        dragDepth.current++
        setDragging(true)
      }}
      onDragOver={(e) => canReply && e.preventDefault()}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (dragDepth.current === 0) setDragging(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        dragDepth.current = 0
        setDragging(false)
        pickFile(e.dataTransfer.files?.[0])
      }}
    >
      <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b bg-card/60 px-3 py-2.5 backdrop-blur sm:px-4">
        {onBack && (
          <Button variant="ghost" size="icon" className="-ml-1 h-9 w-9 shrink-0" onClick={onBack} aria-label="Back to conversations">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-emerald-100 text-sm font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">{initials(title)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold leading-tight">{title}</h2>
          <p className="truncate text-xs text-muted-foreground">{conversationHandle(conversation)}</p>
        </div>
        {headerExtra && <div className="order-last flex w-full flex-wrap items-center gap-2">{headerExtra}</div>}
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              "whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium",
              conversation.window_open ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
            )}
          >
            {conversation.window_open ? `${Math.max(1, Math.floor(hoursLeft))}h left to reply` : "Reply window closed"}
          </span>
          {onOpenProfile && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onOpenProfile} aria-label="Customer details">
                    <PanelRight className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Customer details</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </header>

      <div className="relative min-h-0 flex-1 bg-[radial-gradient(circle_at_1px_1px,hsl(var(--muted-foreground)/0.08)_1px,transparent_0)] [background-size:22px_22px] bg-muted/30">
        <ScrollArea className="h-full" viewportRef={viewportRef} viewportClassName="[&>div]:!block" onScrollCapture={onScroll}>
          <div className="mx-auto flex max-w-3xl flex-col px-2 py-4 sm:px-4" aria-live="polite">
            {!isLoading && all.length >= 100 && !noMoreOlder && (
              <div className="mb-3 flex justify-center">
                <Button variant="outline" size="sm" className="h-7 rounded-full bg-card text-xs" onClick={() => void loadOlder()} disabled={loadingOlder}>
                  {loadingOlder && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />} Load earlier messages
                </Button>
              </div>
            )}
            {isLoading && (
              <div className="space-y-3">
                <Skeleton className="h-14 w-2/3" />
                <Skeleton className="ml-auto h-10 w-1/2" />
                <Skeleton className="h-16 w-3/5" />
              </div>
            )}
            {!isLoading && all.length === 0 && <p className="py-16 text-center text-sm text-muted-foreground">No messages yet.</p>}
            {rows.map((r) => (
              <Fragment key={r.key}>
                {r.day ? (
                  <div className="my-3 flex justify-center">
                    <span className="rounded-full bg-card px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm ring-1 ring-border">{r.day}</span>
                  </div>
                ) : (
                  <Bubble m={r.msg as WaMessage} conversationId={conversation.id} tail={Boolean(r.tail)} />
                )}
              </Fragment>
            ))}
          </div>
        </ScrollArea>

        {!atBottom && (
          <Button
            size="sm"
            variant="secondary"
            className="absolute bottom-3 right-4 h-9 gap-1.5 rounded-full px-3 shadow-md"
            onClick={() => scrollToBottom(true)}
            aria-label="Jump to latest message"
          >
            <ArrowDown className="h-4 w-4" />
            {unseen > 0 && <span className="text-xs font-semibold">{unseen} new</span>}
          </Button>
        )}

        {dragging && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-md border-2 border-dashed border-emerald-500 bg-emerald-50/80 text-sm font-medium text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200">
            Drop the file to send it
          </div>
        )}
      </div>

      <footer className="shrink-0 border-t bg-card px-3 pb-3 pt-2 sm:px-4">
        {conversation.window_open && !canSend && (
          <p className="mb-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">You have view-only access to the inbox.</p>
        )}
        {!conversation.window_open && (
          <p className="mb-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            More than 24 hours have passed since this customer last wrote. WhatsApp only allows an approved template message now. Use the Template button.
          </p>
        )}

        {file && (
          <div className="mb-2 flex items-center gap-3 rounded-lg border bg-muted/50 p-2">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="h-14 w-14 rounded-md object-cover" />
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-md bg-background">
                <FileText className="h-6 w-6 text-sky-600" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(file.size)} · add a caption below if you like</p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setFile(null)} disabled={busy} aria-label="Remove file">
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="flex items-end gap-2">
          {onSendFile && (
            <>
              <input ref={photoInput} type="file" accept={ACCEPT_MEDIA} hidden onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = "" }} />
              <input ref={docInput} type="file" accept={ACCEPT_DOCS} hidden onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = "" }} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 text-muted-foreground" disabled={!canReply || busy} aria-label="Attach a file">
                    <Paperclip className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top">
                  <DropdownMenuItem onSelect={() => photoInput.current?.click()}>
                    <ImageIcon className="mr-2 h-4 w-4 text-emerald-600" /> Photo or video
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => docInput.current?.click()}>
                    <FileText className="mr-2 h-4 w-4 text-sky-600" /> Document
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
          <Textarea
            ref={composer}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                void submit()
              }
            }}
            onPaste={(e) => {
              const f = Array.from(e.clipboardData.files)[0]
              if (f) {
                e.preventDefault()
                pickFile(f)
              }
            }}
            disabled={!canReply}
            placeholder={
              !canReply ? (conversation.window_open ? "View only" : "Reply window closed") : file ? "Add a caption (optional)…" : "Type a reply…"
            }
            rows={1}
            maxLength={file ? 1024 : 4096}
            aria-label="Reply to customer on WhatsApp"
            className="max-h-32 min-h-10 resize-none rounded-2xl py-2.5"
          />
          {composerExtra}
          <Button
            onClick={() => void submit()}
            disabled={!canReply || busy || (!text.trim() && !file)}
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
            aria-label="Send message"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </footer>
    </div>
  )
}
