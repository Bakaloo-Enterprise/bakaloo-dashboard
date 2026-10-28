"use client"

import { useRef } from "react"
import Image from "next/image"
import { Upload, X, Loader2, ImagePlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useUploadImage } from "@/hooks/useUploads"
import { toast } from "sonner"

/** Same helper as ImageUpload.tsx / SpinAppearanceCard.tsx. */
function sanitizeCloudinaryUrl(value: string | null | undefined) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const httpsIndex = trimmed.lastIndexOf("https://res.cloudinary.com/")
  const httpIndex = trimmed.lastIndexOf("http://res.cloudinary.com/")
  const startIndex = Math.max(httpsIndex, httpIndex)
  return startIndex >= 0 ? trimmed.slice(startIndex) : trimmed
}

export interface ScratchAppearanceDraft {
  coverImageUrl: string | null
  coverImagePublicId: string | null
}

interface ScratchAppearanceCardProps {
  draft: ScratchAppearanceDraft
  onChange: (patch: Partial<ScratchAppearanceDraft>) => void
  canManage: boolean
}

/**
 * The "foil" cover image scratched away to reveal the prize — a tall 2:3
 * "trading card" upload, matching the actual card shape rendered in the
 * app (see scratch_card_dialog.dart's _cardAspectRatio), not a square or a
 * full-screen background.
 */
export function ScratchAppearanceCard({ draft, onChange, canManage }: ScratchAppearanceCardProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const uploadMutation = useUploadImage("spin-scratch")
  const previewSrc = sanitizeCloudinaryUrl(draft.coverImageUrl)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB")
      return
    }
    uploadMutation.mutate(file, {
      onSuccess: (data) => {
        onChange({ coverImageUrl: data.url, coverImagePublicId: data.publicId })
        toast.success("Cover image uploaded")
      },
    })
    if (fileRef.current) fileRef.current.value = ""
  }

  return (
    <div className="space-y-2">
      <Label>Scratch Card Cover (&quot;Foil&quot;) Image</Label>
      {previewSrc ? (
        <div className="relative group w-full aspect-[2/3] max-w-[200px] rounded-xl overflow-hidden border">
          <Image src={previewSrc} alt="Scratch card cover" fill className="object-cover" sizes="200px" />
          {canManage && (
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="h-8 w-8"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="h-8 w-8"
                onClick={() => onChange({ coverImageUrl: null, coverImagePublicId: null })}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={!canManage || uploadMutation.isPending}
          className="w-full aspect-[2/3] max-w-[200px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-brand-300 hover:bg-brand-50/50 transition-colors cursor-pointer disabled:opacity-50"
        >
          {uploadMutation.isPending ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <>
              <ImagePlus className="h-6 w-6" />
              <span className="text-xs px-3 text-center">Upload cover image</span>
            </>
          )}
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      <p className="text-[11px] text-muted-foreground max-w-[320px]">
        Recommended <strong>1000 × 1500px</strong> (2:3 portrait card), JPG/PNG, under 5MB. Served
        through Cloudinary&apos;s CDN — auto-compressed and capped at 1080px wide on delivery no
        matter what you upload. Leave empty to keep the app&apos;s built-in default foil design.
      </p>
    </div>
  )
}
