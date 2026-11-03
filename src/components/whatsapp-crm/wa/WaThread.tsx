"use client"

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { ArrowDown, ArrowLeft, Bot, FileText, Image as ImageIcon, Info, Loader2, Megaphone, Mic, Paperclip, Plus, Send, Smile, X } from "lucide-react"
import { toast } from "sonner"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { getMessages } from "@/services/whatsapp-crm.service"
import type { WaConversation, WaConversationDetail, WaMessage } from "@/types/whatsapp-crm.types"
import { clockTime, conversationHandle, conversationTitle, dayLabel, formatBytes, mediaInfo, windowHoursLeft } from "../helpers"
import { MessageMedia } from "../MessageMedia"
import { EmojiPicker } from "./EmojiPicker"
import { IconButton, WaAvatar, WaTicks } from "./WaBits"

const MEDIA_TYPES = new Set(["image", "video", "audio", "document", "sticker", "location"])
const ACCEPT_MEDIA = "image/jpeg,image/png,video/mp4,video/3gpp"
const ACCEPT_DOCS = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
const ACCEPT_AUDIO = "audio/aac,audio/mp4,audio/mpeg,audio/amr,audio/ogg"
const MAX_FILE = 25 * 1024 * 1024

function Bubble({ m, conversationId, tail }: { m: WaMessage; conversationId: string; tail: boolean }) {
  const out = m.direction === "OUTBOUND"
  const isMedia = MEDIA_TYPES.has(m.msg_type)
  const caption = isMedia ? mediaInfo(m).caption ?? m.body : m.body
  const text = caption || (isMedia ? "" : m.template_name ? `Template: ${m.template_name}` : m.body ?? `[${m.msg_type}]`)
  const mediaOnly = isMedia && !text && m.msg_type !== "document" && m.msg_type !== "audio"
  const time = (
    <span className={cn("flex select-none items-center gap-1 whitespace-nowrap text-[11px] leading-[15px]", mediaOnly ? "text-white" : "text-[var(--wa-secondary)]")}>
      {clockTime(m.created_at).toLowerCase()}
      {out && <WaTicks status={m.status} />}
    </span>
  )

  return (
    <div className={cn("flex px-[6%] sm:px-[9%]", out ? "justify-end" : "justify-start", tail ? "mt-2" : "mt-0.5")}>
      <div
        className={cn(
          "wa-bubble relative min-w-0 max-w-[85%] text-[14.2px] leading-[19px] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] sm:max-w-[65%]",
          mediaOnly ? "p-[3px]" : "px-[9px] pb-[6px] pt-[6px]",
          out ? "bg-[var(--wa-bubble-out)] text-[var(--wa-text-out)]" : "bg-[var(--wa-bubble-in)] text-[var(--wa-text)]",
          tail ? (out ? "wa-tail-out rounded-lg rounded-tr-none" : "wa-tail-in rounded-lg rounded-tl-none") : "rounded-lg",
          m.status === "FAILED" && "ring-1 ring-red-400",
        )}
      >
        {m.is_bot && (
          <p className="mb-0.5 flex items-center gap-1 text-[11px] font-medium text-violet-600 dark:text-violet-300">
            <Bot className="h-3 w-3" /> Auto-reply (bot)
          </p>
        )}
        {m.template_name && <p className="mb-0.5 text-[11px] font-medium text-[var(--wa-secondary)]">Template</p>}
        {!isMedia && m.template_name && typeof (m.media as { url?: string } | null)?.url === "string" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={(m.media as { url: string }).url} alt="Template picture" className="mb-1.5 max-h-64 w-full rounded-md object-cover" loading="lazy" />
        )}
        {isMedia && (
          <div className={cn(text || !mediaOnly ? "mb-1" : "")}>
            <MessageMedia conversationId={conversationId} message={m} />
          </div>
        )}
        {text && (
          <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
            {text}
            <span className="invisible ml-2 inline-block align-bottom text-[11px]" aria-hidden>
              {clockTime(m.created_at).toLowerCase()}&nbsp;&nbsp;&nbsp;&nbsp;{out ? "✓✓" : ""}
            </span>
          </p>
        )}
        <div className={cn(mediaOnly ? "absolute bottom-2 right-2 rounded-full bg-black/45 px-1.5" : text ? "-mt-[15px] flex justify-end" : "flex justify-end")}>{time}</div>
        {m.status === "FAILED" && (
          <p className="mt-1 text-[11.5px] text-red-600 dark:text-red-200">
            Not delivered
            {m.error_code === 131049
              ? ": WhatsApp (Meta) limited this promotional message for this customer. It is not a problem with your template. Try again later, or wait for the customer to message you first."
              : m.error_details
                ? `: ${m.error_details}`
                : m.error_title
                  ? `: ${m.error_title}`
                  : ""}
          </p>
        )}
      </div>
    </div>
  )
}

interface Props {
  conversation: WaConversation | WaConversationDetail
  messages: WaMessage[]
  isLoading: boolean
  onSend: (body: string) => Promise<unknown>
  onSendFile?: (file: File, caption?: string) => Promise<unknown>
  sending: boolean
  sendingFile?: boolean
  /** Owner / bot / request controls shown in a slim bar under the header. */
  toolsBar?: React.ReactNode
  canSend?: boolean
  /** The “Template” button (works even when the 24-hour window is closed). */
  templateButton?: React.ReactNode
  onBack?: () => void
  onOpenProfile?: () => void
}

export function WaThread({ conversation, messages, isLoading, onSend, onSendFile, sending, sendingFile, toolsBar, canSend = true, templateButton, onBack, onOpenProfile }: Props) {
  const [text, setText] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [older, setOlder] = useState<WaMessage[]>([])
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [noMoreOlder, setNoMoreOlder] = useState(false)
  const [atBottom, setAtBottom] = useState(true)
  const [unseen, setUnseen] = useState(0)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const viewportRef = useRef<HTMLDivElement>(null)
  const photoInput = useRef<HTMLInputElement>(null)
  const docInput = useRef<HTMLInputElement>(null)
  const audioInput = useRef<HTMLInputElement>(null)
  const composer = useRef<HTMLTextAreaElement>(null)
  const dragDepth = useRef(0)
  const lastCount = useRef(0)
  const prependHeight = useRef<number | null>(null)

  const title = conversationTitle(conversation)
  const hoursLeft = windowHoursLeft(conversation.last_inbound_at)
  const canReply = conversation.window_open && canSend
  const busy = sending || Boolean(sendingFile)
  const referral = "referral" in conversation ? conversation.referral : null

  useEffect(() => {
    setOlder([])
    setNoMoreOlder(false)
    setFile(null)
    setText("")
    setUnseen(0)
    lastCount.current = 0
  }, [conversation.id])

  useLayoutEffect(() => {
    const el = composer.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
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

  function insertEmoji(e: string) {
    const el = composer.current
    const start = el?.selectionStart ?? text.length
    const end = el?.selectionEnd ?? text.length
    setText((t) => t.slice(0, start) + e + t.slice(end))
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + e.length, start + e.length)
    })
  }

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

  const hasText = text.trim().length > 0 || Boolean(file)

  return (
    <div
      className="relative flex h-full min-h-0 flex-col bg-[var(--wa-chat-bg)]"
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
      <header className="flex h-[59px] shrink-0 items-center gap-3 bg-[var(--wa-panel-header)] px-4 py-2.5">
        {onBack && (
          <button type="button" onClick={onBack} className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full text-[var(--wa-secondary)] hover:bg-black/5" aria-label="Back to conversations">
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <button type="button" onClick={onOpenProfile} disabled={!onOpenProfile} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label="Customer details">
          <WaAvatar size={40} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-normal leading-[21px] text-[var(--wa-text)]">{title}</h2>
            <p className="truncate text-[13px] leading-[20px] text-[var(--wa-secondary)]">
              {conversationHandle(conversation)}
              {conversation.window_open ? ` · ${Math.max(1, Math.floor(hoursLeft))}h left to reply` : " · reply window closed"}
            </p>
          </div>
        </button>
        {onOpenProfile && (
          <IconButton label="Customer details" onClick={onOpenProfile}>
            <Info className="h-5 w-5" />
          </IconButton>
        )}
      </header>

      {toolsBar && <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--wa-border)] bg-[var(--wa-panel)] px-4 py-1.5">{toolsBar}</div>}

      <div className="wa-doodle relative min-h-0 flex-1">
        <div ref={viewportRef} onScroll={onScroll} className="wa-scroll absolute inset-0 overflow-y-auto" role="log" aria-live="polite" aria-label="Messages">
          <div className="flex min-h-full flex-col justify-end py-3">
            {referral && (
              <div className="mx-auto mb-2 flex max-w-sm items-start gap-2 rounded-lg bg-[var(--wa-date-pill)] px-3 py-2 text-xs text-[var(--wa-text)] shadow-sm">
                <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-[#1877F2]" aria-hidden />
                <div className="min-w-0">
                  <p className="font-medium">Started from a Meta ad</p>
                  {referral.headline && <p className="break-words">{referral.headline}</p>}
                  {referral.body && <p className="line-clamp-2 break-words text-[var(--wa-secondary)]">{referral.body}</p>}
                </div>
              </div>
            )}
            {!isLoading && all.length >= 100 && !noMoreOlder && (
              <div className="mb-3 flex justify-center">
                <button onClick={() => void loadOlder()} disabled={loadingOlder} className="flex items-center gap-1.5 rounded-full bg-[var(--wa-date-pill)] px-3 py-1 text-xs text-[var(--wa-secondary)] shadow-sm">
                  {loadingOlder && <Loader2 className="h-3 w-3 animate-spin" />} Load earlier messages
                </button>
              </div>
            )}
            {isLoading && (
              <div className="space-y-3 px-[9%]">
                <div className="h-12 w-2/3 animate-pulse rounded-lg bg-[var(--wa-bubble-in)]" />
                <div className="ml-auto h-9 w-1/2 animate-pulse rounded-lg bg-[var(--wa-bubble-out)]" />
              </div>
            )}
            {!isLoading && all.length === 0 && <p className="mx-auto my-10 rounded-lg bg-[var(--wa-date-pill)] px-3 py-1.5 text-xs text-[var(--wa-secondary)]">No messages yet.</p>}
            {rows.map((r) => (
              <Fragment key={r.key}>
                {r.day ? (
                  <div className="my-2.5 flex justify-center">
                    <span className="rounded-lg bg-[var(--wa-date-pill)] px-3 py-1 text-[12.5px] uppercase text-[var(--wa-secondary)] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">{r.day}</span>
                  </div>
                ) : (
                  <Bubble m={r.msg as WaMessage} conversationId={conversation.id} tail={Boolean(r.tail)} />
                )}
              </Fragment>
            ))}
          </div>
        </div>

        {!atBottom && (
          <button
            onClick={() => scrollToBottom(true)}
            className="absolute bottom-3 right-4 flex h-10 items-center gap-1.5 rounded-full bg-[var(--wa-panel)] px-3 text-[var(--wa-secondary)] shadow-md"
            aria-label="Jump to latest message"
          >
            <ArrowDown className="h-5 w-5" />
            {unseen > 0 && <span className="text-xs font-semibold text-[var(--wa-green-dark)]">{unseen} new</span>}
          </button>
        )}

        {dragging && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center border-2 border-dashed border-[var(--wa-green)] bg-[var(--wa-panel)]/80 text-sm font-medium text-[var(--wa-green-dark)]">
            Drop the file to send it
          </div>
        )}
      </div>

      <footer className="shrink-0 bg-[var(--wa-composer)] px-3 py-2">
        {conversation.window_open && !canSend && <p className="mb-2 rounded-lg bg-[var(--wa-panel)] px-3 py-2 text-xs text-[var(--wa-secondary)]">You have view-only access to the inbox.</p>}
        {!conversation.window_open && (
          <div className="mb-2 flex flex-wrap items-center gap-3 rounded-lg bg-[var(--wa-banner)] px-3 py-2 text-[13px] text-[var(--wa-text)]">
            <span className="min-w-0 flex-1">More than 24 hours have passed since this customer last wrote. WhatsApp only allows an approved template message now.</span>
            {templateButton}
          </div>
        )}

        {file && (
          <div className="mb-2 flex items-center gap-3 rounded-lg bg-[var(--wa-panel)] p-2">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="h-14 w-14 rounded-md object-cover" />
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-md bg-[var(--wa-composer)]">
                <FileText className="h-6 w-6 text-[#7f66ff]" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[var(--wa-text)]">{file.name}</p>
              <p className="text-xs text-[var(--wa-secondary)]">{formatBytes(file.size)} · add a caption below if you like</p>
            </div>
            <IconButton label="Remove file" onClick={() => setFile(null)} disabled={busy}>
              <X className="h-5 w-5" />
            </IconButton>
          </div>
        )}

        <div className="flex items-end gap-1">
          <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
            <PopoverTrigger asChild>
              <button type="button" disabled={!canReply} aria-label="Emoji" title="Emoji" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--wa-secondary)] hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/10">
                <Smile className="h-6 w-6" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="wa-app w-auto border-0 bg-transparent p-0 shadow-none">
              <EmojiPicker onPick={insertEmoji} />
            </PopoverContent>
          </Popover>

          {onSendFile && (
            <>
              <input ref={photoInput} type="file" accept={ACCEPT_MEDIA} hidden onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = "" }} />
              <input ref={docInput} type="file" accept={ACCEPT_DOCS} hidden onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = "" }} />
              <input ref={audioInput} type="file" accept={ACCEPT_AUDIO} hidden onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = "" }} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" disabled={!canReply || busy} aria-label="Attach a file" title="Attach" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--wa-secondary)] hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/10">
                    <Plus className="h-6 w-6" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top">
                  <DropdownMenuItem onSelect={() => photoInput.current?.click()}>
                    <ImageIcon className="mr-2 h-4 w-4 text-[#007bfc]" /> Photos &amp; videos
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => docInput.current?.click()}>
                    <FileText className="mr-2 h-4 w-4 text-[#7f66ff]" /> Document
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => audioInput.current?.click()}>
                    <Paperclip className="mr-2 h-4 w-4 text-[#ff7a2f]" /> Audio file
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}

          {conversation.window_open && templateButton}

          <textarea
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
            placeholder={!canReply ? (conversation.window_open ? "View only" : "Reply window closed") : file ? "Add a caption (optional)…" : "Type a message"}
            rows={1}
            maxLength={file ? 1024 : 4096}
            aria-label="Reply to customer on WhatsApp"
            className="wa-scroll mx-1 max-h-[120px] min-h-10 flex-1 resize-none rounded-lg bg-[var(--wa-panel)] px-3 py-[9px] text-[15px] leading-[20px] text-[var(--wa-text)] outline-none placeholder:text-[var(--wa-secondary)] disabled:opacity-60"
          />

          {hasText ? (
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!canReply || busy}
              aria-label="Send message"
              title="Send"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--wa-secondary)] hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/10"
            >
              {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Send className="h-6 w-6 text-[var(--wa-green)]" />}
            </button>
          ) : (
            <IconButton label="Send an audio file" onClick={() => audioInput.current?.click()} disabled={!canReply || !onSendFile}>
              <Mic className="h-6 w-6" />
            </IconButton>
          )}
        </div>
      </footer>
    </div>
  )
}
