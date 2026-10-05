"use client"

import { useRef, useState } from "react"
import { ImagePlus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { uploadImage } from "@/services/uploads.service"

/** Pick an image from the computer, host it, and hand back its https link. WhatsApp accepts JPEG/PNG up to 5 MB. */
export function ImageUploadField({ onUploaded, label = "Upload image" }: { onUploaded: (url: string) => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pick = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    if (!["image/jpeg", "image/png"].includes(file.type)) return setError("WhatsApp accepts JPEG or PNG images only.")
    if (file.size > 5 * 1024 * 1024) return setError("The image is over 5 MB. Please use a smaller one.")
    setBusy(true)
    try {
      onUploaded((await uploadImage(file)).url)
    } catch {
      setError("Upload failed. Please try again.")
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ""
    }
  }

  return (
    <div>
      <input ref={input} type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => pick(e.target.files?.[0])} aria-label={label} />
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-1 h-4 w-4" />} {busy ? "Uploading…" : label}
      </Button>
      {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
