"use client"

import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Download, FileText, ImageOff, Loader2, MapPin, Play } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { fetchMessageMedia } from "@/services/whatsapp-crm.service"
import type { WaMessage } from "@/types/whatsapp-crm.types"
import { formatBytes, mediaInfo } from "./helpers"

/** Downloads the attachment once (cached for the session) and exposes it as a blob URL. */
function useMediaUrl(conversationId: string, messageId: string, enabled: boolean) {
  const q = useQuery({
    queryKey: ["crm", "media", messageId],
    queryFn: () => fetchMessageMedia(conversationId, messageId),
    enabled,
    staleTime: Infinity,
    gcTime: 10 * 60_000,
    retry: false,
  })
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!q.data) return setUrl(null)
    const u = URL.createObjectURL(q.data)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [q.data])
  return { url, isLoading: q.isLoading, isError: q.isError }
}

function Unavailable({ label }: { label: string }) {
  return (
    <div className="flex w-56 items-center gap-2 rounded-lg bg-black/5 px-3 py-4 text-xs text-muted-foreground dark:bg-white/5">
      <ImageOff className="h-4 w-4 shrink-0" />
      <span>{label} is no longer available (WhatsApp keeps files for about 30 days).</span>
    </div>
  )
}

export function MessageMedia({ conversationId, message }: { conversationId: string; message: WaMessage }) {
  const info = mediaInfo(message)
  const type = message.msg_type
  const hasFile = Boolean(info.id)
  const isLocation = type === "location" && info.latitude != null && info.longitude != null
  const { url, isLoading, isError } = useMediaUrl(conversationId, message.id, hasFile && (type === "image" || type === "sticker" || type === "video" || type === "audio"))
  const [zoom, setZoom] = useState(false)

  if (isLocation) {
    return (
      <a
        href={`https://www.google.com/maps?q=${info.latitude},${info.longitude}`}
        target="_blank"
        rel="noreferrer"
        className="flex w-56 items-center gap-3 rounded-lg bg-black/5 px-3 py-3 text-sm hover:bg-black/10 dark:bg-white/5"
      >
        <MapPin className="h-5 w-5 shrink-0 text-red-500" />
        <span className="min-w-0 truncate">Open location in Maps</span>
      </a>
    )
  }
  if (!hasFile) return null

  if (type === "image" || type === "sticker") {
    if (isLoading) return <div className="flex h-44 w-56 items-center justify-center rounded-lg bg-black/5 dark:bg-white/5"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
    if (isError || !url) return <Unavailable label="This photo" />
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={info.caption || info.filename || "Photo from WhatsApp"}
          onClick={() => setZoom(true)}
          className={type === "sticker" ? "h-28 w-28 cursor-zoom-in object-contain" : "max-h-72 w-full max-w-[320px] cursor-zoom-in rounded-lg object-cover"}
        />
        <Dialog open={zoom} onOpenChange={setZoom}>
          <DialogContent className="max-w-[min(92vw,900px)] border-0 bg-black/90 p-2">
            <DialogTitle className="sr-only">{info.filename || "Photo"}</DialogTitle>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="max-h-[85vh] w-full rounded object-contain" />
            <a href={url} download={info.filename || "photo"} className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-md bg-white/90 px-3 py-1.5 text-xs font-medium text-black hover:bg-white">
              <Download className="h-3.5 w-3.5" /> Download
            </a>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  if (type === "video") {
    if (isLoading) return <div className="flex h-40 w-56 items-center justify-center rounded-lg bg-black/5 dark:bg-white/5"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
    if (isError || !url) return <Unavailable label="This video" />
    return <video src={url} controls preload="metadata" className="max-h-72 w-full max-w-[320px] rounded-lg bg-black" />
  }

  if (type === "audio") {
    if (isLoading) return <div className="flex h-12 w-56 items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
    if (isError || !url) return <Unavailable label="This voice note" />
    return <audio src={url} controls preload="metadata" className="h-10 w-60 max-w-full" />
  }

  return <DocumentCard conversationId={conversationId} message={message} />
}

/** Documents download on demand — nothing is fetched until the agent clicks. */
function DocumentCard({ conversationId, message }: { conversationId: string; message: WaMessage }) {
  const info = mediaInfo(message)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  async function download() {
    setBusy(true)
    setFailed(false)
    try {
      const blob = await fetchMessageMedia(conversationId, message.id)
      const href = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = href
      a.download = info.filename || "document"
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(href), 10_000)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void download()}
      disabled={busy}
      className="flex w-64 max-w-full items-center gap-3 rounded-lg bg-black/5 px-3 py-3 text-left transition-colors hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-background/80">
        {message.msg_type === "video" ? <Play className="h-5 w-5" /> : <FileText className="h-5 w-5 text-sky-600" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{info.filename || "Document"}</span>
        <span className="block text-[11px] text-muted-foreground">
          {failed ? "Could not download — try again" : [formatBytes(info.size), info.mime_type?.split("/")[1]?.toUpperCase()].filter(Boolean).join(" · ") || "Tap to download"}
        </span>
      </span>
      {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Download className="h-4 w-4 shrink-0 text-muted-foreground" />}
    </button>
  )
}
