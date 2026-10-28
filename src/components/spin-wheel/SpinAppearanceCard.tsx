"use client"

import { useRef } from "react"
import Image from "next/image"
import { Upload, X, Loader2, ImagePlus, Ticket } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useUploadImage } from "@/hooks/useUploads"
import { toast } from "sonner"

/** Same helper as ImageUpload.tsx — Next/Image needs a bare Cloudinary URL, not one with an accidental prefix from a copy-pasted value. */
function sanitizeCloudinaryUrl(value: string | null | undefined) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const httpsIndex = trimmed.lastIndexOf("https://res.cloudinary.com/")
  const httpIndex = trimmed.lastIndexOf("http://res.cloudinary.com/")
  const startIndex = Math.max(httpsIndex, httpIndex)
  return startIndex >= 0 ? trimmed.slice(startIndex) : trimmed
}

export interface SpinAppearanceDraft {
  backgroundImageUrl: string | null
  backgroundImagePublicId: string | null
  bannerTitle: string
  bannerSubtitle: string
  bannerTagline: string
}

interface SpinAppearanceCardProps {
  draft: SpinAppearanceDraft
  onChange: (patch: Partial<SpinAppearanceDraft>) => void
  canManage: boolean
}

/**
 * Popup background image + banner-box copy for the Settings tab.
 * A dedicated (not the shared square ImageUpload) upload control since the
 * background is a 9:16 portrait — a square preview would misrepresent it.
 */
export function SpinAppearanceCard({ draft, onChange, canManage }: SpinAppearanceCardProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const uploadMutation = useUploadImage("spin-scratch")
  const previewSrc = sanitizeCloudinaryUrl(draft.backgroundImageUrl)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB")
      return
    }
    uploadMutation.mutate(file, {
      onSuccess: (data) => {
        onChange({ backgroundImageUrl: data.url, backgroundImagePublicId: data.publicId })
        toast.success("Background image uploaded")
      },
    })
    if (fileRef.current) fileRef.current.value = ""
  }

  return (
    <div className="grid gap-6 sm:grid-cols-[180px_1fr]">
      <div className="space-y-2">
        <Label>Popup Background Image</Label>
        {previewSrc ? (
          <div className="relative group w-full aspect-[9/16] max-w-[180px] rounded-lg overflow-hidden border">
            <Image src={previewSrc} alt="Spin & Win background" fill className="object-cover" sizes="180px" />
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
                  onClick={() => onChange({ backgroundImageUrl: null, backgroundImagePublicId: null })}
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
            className="w-full aspect-[9/16] max-w-[180px] border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-brand-300 hover:bg-brand-50/50 transition-colors cursor-pointer disabled:opacity-50"
          >
            {uploadMutation.isPending ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <ImagePlus className="h-6 w-6" />
                <span className="text-xs px-3 text-center">Upload background</span>
              </>
            )}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
        <p className="text-[11px] text-muted-foreground max-w-[200px]">
          Recommended <strong>1080 × 1920px</strong> (9:16 portrait), JPG/PNG, under 5MB. Served
          through Cloudinary&apos;s CDN — auto-compressed and capped at 1080px wide on delivery no
          matter what you upload. Leave empty to keep the app&apos;s built-in default.
        </p>
      </div>

      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          The small badge shown under the Spin button in the app.
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="sw-banner-title">Banner Title</Label>
          <Input
            id="sw-banner-title"
            value={draft.bannerTitle}
            maxLength={80}
            disabled={!canManage}
            onChange={(e) => onChange({ bannerTitle: e.target.value })}
            placeholder="Win up to ₹100 off"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sw-banner-subtitle">Banner Subtitle</Label>
          <Input
            id="sw-banner-subtitle"
            value={draft.bannerSubtitle}
            maxLength={80}
            disabled={!canManage}
            onChange={(e) => onChange({ bannerSubtitle: e.target.value })}
            placeholder="on your next order"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sw-banner-tagline">Corner Tagline</Label>
          <Textarea
            id="sw-banner-tagline"
            value={draft.bannerTagline}
            maxLength={80}
            rows={2}
            disabled={!canManage}
            onChange={(e) => onChange({ bannerTagline: e.target.value })}
            placeholder={"Good Deals\nEveryday!"}
          />
          <p className="text-[11px] text-muted-foreground">
            Shown right-aligned in purple italic — a line break makes it wrap as two short lines.
          </p>
        </div>

        <div className="space-y-1.5 pt-1">
          <Label className="text-xs text-muted-foreground">Preview</Label>
          <div className="flex items-center gap-2.5 rounded-2xl border border-[#E2D6F9] bg-white px-3.5 py-3 max-w-md">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F3EEFE]">
              <Ticket className="h-4 w-4 text-[#7C3AED]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">
                {draft.bannerTitle || "Win up to ₹100 off"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {draft.bannerSubtitle || "on your next order"}
              </p>
            </div>
            <p className="text-xs font-semibold italic text-[#7C3AED] text-right whitespace-pre-line shrink-0">
              {draft.bannerTagline || "Good Deals\nEveryday!"}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
