"use client"

import { useMemo, useRef, useState } from "react"
import { Loader2, Trash2, FileImage, FileJson } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { uploadFile, uploadImage } from "@/services/uploads.service"

interface ThemeImageUploaderProps {
  label: string
  value: string | null
  onChange: (url: string | null) => void
  accept?: string
}

function isImageUpload(accept?: string) {
  if (!accept) return true
  return !accept.includes(".lottie") && !accept.includes(".json")
}

function looksLikeImageUrl(value: string | null) {
  if (!value) return false
  return /\.(png|jpe?g|gif|webp|svg|avif)(\?|$)/i.test(value)
    || value.includes("/image/upload/")
}

export function ThemeImageUploader({
  label,
  value,
  onChange,
  accept = "image/*",
}: ThemeImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const shouldUseImageUpload = useMemo(() => isImageUpload(accept), [accept])
  const showImagePreview = shouldUseImageUpload && looksLikeImageUrl(value)

  const handleFile = async (file: File) => {
    setIsUploading(true)
    setProgress(0)

    try {
      const result = shouldUseImageUpload
        ? await uploadImage(file, setProgress, "themes")
        : await uploadFile(file, setProgress)
      setProgress(100)
      onChange(result.url)
      toast.success("Asset uploaded")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to upload asset"
      toast.error(message)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      <div className="space-y-3 rounded-lg border bg-card p-4">
        <button
          type="button"
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-muted/30"
          )}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={(event) => {
            event.preventDefault()
            setIsDragging(false)
          }}
          onDrop={(event) => {
            event.preventDefault()
            setIsDragging(false)
            const file = event.dataTransfer.files?.[0]
            if (file) void handleFile(file)
          }}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <div className="w-full max-w-sm space-y-2">
                <Progress value={progress} />
                <p className="text-xs text-muted-foreground">
                  Uploading... {progress}%
                </p>
              </div>
            </>
          ) : shouldUseImageUpload ? (
            <>
              <FileImage className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium">Drop an image here or click to upload</p>
            </>
          ) : (
            <>
              <FileJson className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium">Drop a Lottie or JSON file here</p>
            </>
          )}
          <p className="text-xs text-muted-foreground">
            Accepted: {accept}
          </p>
        </button>

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void handleFile(file)
            event.currentTarget.value = ""
          }}
        />

        {value && (
          <div className="space-y-3 rounded-md border bg-muted/20 p-3">
            {showImagePreview && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={value}
                  alt={label}
                  className="h-40 w-full rounded-md object-cover"
                />
              </>
            )}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Uploaded Asset
                </p>
                <a
                  href={value}
                  target="_blank"
                  rel="noreferrer"
                  className="block break-all text-sm text-primary underline-offset-4 hover:underline"
                >
                  {value}
                </a>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onChange(null)}
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
