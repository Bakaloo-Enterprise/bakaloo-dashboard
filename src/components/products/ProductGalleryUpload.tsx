"use client"

/**
 * ProductGalleryUpload — manage a product's image gallery (1–5 images).
 *
 * Contract with the rest of the app:
 *   - `value` is an ordered list of image URLs. Index 0 is ALWAYS the
 *     primary image. The parent form mirrors index 0 into `thumbnail_url`
 *     so product cards (which render `thumbnail_url`) keep showing the
 *     primary, while the product-detail gallery renders the full ordered
 *     `images` array.
 *   - Max 5 images, min 0 (the form enforces "at least 1" via the primary
 *     thumbnail). A 6th upload is rejected with a toast.
 *   - Reordering (drag) changes which image is primary (index 0). A
 *     "Set as primary" star button promotes any image to the front.
 *   - Backward compatible: existing single-image products are seeded with
 *     `[thumbnail_url]` by the parent, so they appear as a 1-image gallery.
 *
 * This component is intentionally self-contained and does NOT touch cart /
 * order / pricing logic — it only edits the image URL list.
 */

import { useCallback, useRef, useState } from "react"
import Image from "next/image"
import { ImagePlus, Loader2, Star, X, GripVertical, Plus } from "lucide-react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useUploadImage } from "@/hooks/useUploads"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const MAX_IMAGES = 5

function sanitizeCloudinaryUrl(value: string | null | undefined) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const httpsIndex = trimmed.lastIndexOf("https://res.cloudinary.com/")
  const httpIndex = trimmed.lastIndexOf("http://res.cloudinary.com/")
  const startIndex = Math.max(httpsIndex, httpIndex)
  if (startIndex >= 0) return trimmed.slice(startIndex)
  return trimmed
}

function SortableGalleryItem({
  id,
  url,
  index,
  isPrimary,
  onRemove,
  onSetPrimary,
}: {
  id: string
  url: string
  index: number
  isPrimary: boolean
  onRemove: () => void
  onSetPrimary: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group aspect-square rounded-lg overflow-hidden border-2",
        isPrimary ? "border-brand-500" : "border-border"
      )}
    >
      <Image
        src={sanitizeCloudinaryUrl(url) ?? url}
        alt={isPrimary ? "Primary image" : `Image ${index + 1}`}
        fill
        className="object-cover"
        sizes="160px"
      />

      {/* Primary badge */}
      {isPrimary && (
        <div className="absolute left-1 top-1 flex items-center gap-1 rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
          <Star className="h-3 w-3 fill-current" />
          Primary
        </div>
      )}

      {/* Hover controls */}
      <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          className="absolute bottom-1 left-1 flex h-6 w-6 cursor-grab items-center justify-center rounded bg-black/60 text-white active:cursor-grabbing"
          title="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        {!isPrimary && (
          <button
            type="button"
            onClick={onSetPrimary}
            title="Set as primary"
            className="absolute bottom-1 left-9 flex h-6 items-center gap-1 rounded bg-white/90 px-2 text-[10px] font-medium text-gray-800 hover:bg-white"
          >
            <Star className="h-3 w-3" />
            Primary
          </button>
        )}

        <button
          type="button"
          onClick={onRemove}
          title="Remove image"
          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

interface ProductGalleryUploadProps {
  value: string[]
  onChange: (urls: string[]) => void
  className?: string
}

export function ProductGalleryUpload({
  value,
  onChange,
  className,
}: ProductGalleryUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [urlInput, setUrlInput] = useState("")
  const uploadMutation = useUploadImage("products")

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const oldIndex = value.indexOf(active.id as string)
      const newIndex = value.indexOf(over.id as string)
      if (oldIndex === -1 || newIndex === -1) return
      onChange(arrayMove(value, oldIndex, newIndex))
    },
    [value, onChange]
  )

  const handleFiles = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? [])
      if (!files.length) return

      const remaining = MAX_IMAGES - value.length
      if (remaining <= 0) {
        toast.error(`Maximum ${MAX_IMAGES} images allowed`)
        if (fileRef.current) fileRef.current.value = ""
        return
      }

      const toUpload = files.slice(0, remaining)
      if (toUpload.length < files.length) {
        toast.warning(
          `Only uploading ${toUpload.length} of ${files.length} (max ${MAX_IMAGES} images)`
        )
      }

      // Reject oversize files up-front
      const valid = toUpload.filter((f) => {
        if (f.size > 5 * 1024 * 1024) {
          toast.error(`${f.name} is over 5MB — skipped`)
          return false
        }
        return true
      })

      setUploading(true)
      const newUrls: string[] = []
      for (const file of valid) {
        try {
          const result = await uploadMutation.mutateAsync(file)
          if (result?.url && !value.includes(result.url)) {
            newUrls.push(result.url)
          }
        } catch {
          // error toast handled by the mutation
        }
      }

      if (newUrls.length) {
        onChange([...value, ...newUrls])
        toast.success(`${newUrls.length} image(s) uploaded`)
      }
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    },
    [value, onChange, uploadMutation]
  )

  const addUrl = useCallback(() => {
    const url = urlInput.trim()
    if (!url) return
    if (value.length >= MAX_IMAGES) {
      toast.error(`Maximum ${MAX_IMAGES} images allowed`)
      return
    }
    if (value.includes(url)) {
      toast.warning("That image is already in the gallery")
      return
    }
    onChange([...value, url])
    setUrlInput("")
  }, [urlInput, value, onChange])

  const removeImage = (index: number) =>
    onChange(value.filter((_, i) => i !== index))

  const setPrimary = (index: number) => {
    if (index === 0) return
    const next = [...value]
    const [picked] = next.splice(index, 1)
    next.unshift(picked)
    onChange(next)
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {value.length} of {MAX_IMAGES} images
        </span>
        <span className="text-xs text-muted-foreground">
          Recommended: square 1:1, 800×800px, under 5MB
        </span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={value} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {value.map((url, i) => (
              <SortableGalleryItem
                key={url}
                id={url}
                url={url}
                index={i}
                isPrimary={i === 0}
                onRemove={() => removeImage(i)}
                onSetPrimary={() => setPrimary(i)}
              />
            ))}

            {value.length < MAX_IMAGES && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-muted-foreground transition-colors hover:border-brand-300 hover:bg-brand-50/50 disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <ImagePlus className="h-5 w-5" />
                    <span className="text-[10px]">Add image</span>
                  </>
                )}
              </button>
            )}
          </div>
        </SortableContext>
      </DndContext>

      <p className="text-xs text-muted-foreground">
        The first image is the <strong>primary</strong> shown on product cards.
        Drag to reorder or use the star to set a primary. The product detail
        page shows all images as a swipeable gallery.
      </p>

      {/* URL paste fallback */}
      <div className="flex gap-2">
        <Input
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              addUrl()
            }
          }}
          placeholder="Or paste an image URL (https://res.cloudinary.com/...)"
          className="text-xs"
          disabled={value.length >= MAX_IMAGES}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addUrl}
          disabled={value.length >= MAX_IMAGES || !urlInput.trim()}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFiles}
        className="hidden"
      />
    </div>
  )
}
