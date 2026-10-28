"use client"

import { useState, useRef, useCallback } from "react"
import Image from "next/image"
import { Upload, X, Loader2, ImagePlus, GripVertical } from "lucide-react"
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
import { useUploadImage } from "@/hooks/useUploads"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

function sanitizeCloudinaryUrl(value: string | null | undefined) {
  if (!value) return null

  const trimmed = value.trim()
  if (!trimmed) return null

  const httpsIndex = trimmed.lastIndexOf("https://res.cloudinary.com/")
  const httpIndex = trimmed.lastIndexOf("http://res.cloudinary.com/")
  const startIndex = Math.max(httpsIndex, httpIndex)

  if (startIndex >= 0) {
    return trimmed.slice(startIndex)
  }

  return trimmed
}

interface ImageUploadProps {
  /** What the image is for, so the backend files it correctly (products, banners, themes, ...). */
  kind?: string
  value: string | null
  onChange: (url: string | null) => void
  className?: string
  label?: string
  helperText?: React.ReactNode
}

export function ImageUpload({
  kind = "general",
  value,
  onChange,
  className,
  label = "Upload Image",
  helperText,
}: ImageUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const uploadMutation = useUploadImage(kind)
  const previewSrc = sanitizeCloudinaryUrl(value)

  const handleFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image must be under 5MB")
        return
      }

      uploadMutation.mutate(file, {
        onSuccess: (data) => {
          onChange(data.url)
          toast.success("Image uploaded")
        },
      })
    },
    [onChange, uploadMutation]
  )

  return (
    <div className={cn("space-y-2", className)}>
      {previewSrc ? (
        <div className="relative group w-full aspect-square max-w-[200px] rounded-lg overflow-hidden border">
          <Image
            src={previewSrc}
            alt="Uploaded"
            fill
            className="object-cover"
            sizes="200px"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="destructive"
              size="icon"
              className="h-8 w-8"
              onClick={() => onChange(null)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploadMutation.isPending}
          className="w-full max-w-[200px] aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-brand-300 hover:bg-brand-50/50 transition-colors cursor-pointer disabled:opacity-50"
        >
          {uploadMutation.isPending ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <>
              <ImagePlus className="h-6 w-6" />
              <span className="text-xs">{label}</span>
            </>
          )}
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
      {helperText && (
        <div className="text-[11px] text-muted-foreground mt-1">
          {helperText}
        </div>
      )}
    </div>
  )
}

/* ---------- Sortable Image Item ---------- */
function SortableImageItem({
  id,
  url,
  index,
  onRemove,
}: {
  id: string
  url: string
  index: number
  onRemove: () => void
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
      className="relative group aspect-square rounded-lg overflow-hidden border"
    >
      <Image
        src={url}
        alt={`Image ${index + 1}`}
        fill
        className="object-cover"
        sizes="100px"
      />
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          className="absolute top-1 left-1 h-5 w-5 bg-black/60 text-white rounded cursor-grab active:cursor-grabbing flex items-center justify-center"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-1 right-1 h-5 w-5 bg-red-500 text-white rounded-full flex items-center justify-center"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

interface MultiImageUploadProps {
  value: string[]
  onChange: (urls: string[]) => void
  maxImages?: number
  className?: string
  helperText?: React.ReactNode
}

export function MultiImageUpload({
  value,
  onChange,
  maxImages = 8,
  className,
  helperText,
}: MultiImageUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
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

      const remaining = maxImages - value.length
      const toUpload = files.slice(0, remaining)
      if (toUpload.length < files.length) {
        toast.warning(`Only uploading ${toUpload.length} of ${files.length} (max ${maxImages})`)
      }

      setUploading(true)
      const newUrls: string[] = []

      for (const file of toUpload) {
        try {
          const result = await uploadMutation.mutateAsync(file)
          newUrls.push(result.url)
        } catch {
          // error toast handled by mutation
        }
      }

      if (newUrls.length) {
        onChange([...value, ...newUrls])
        toast.success(`${newUrls.length} image(s) uploaded`)
      }
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    },
    [value, onChange, maxImages, uploadMutation]
  )

  const removeImage = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div className={cn("space-y-2", className)}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={value} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-4 gap-2">
            {value.map((url, i) => (
              <SortableImageItem
                key={url}
                id={url}
                url={sanitizeCloudinaryUrl(url) ?? url}
                index={i}
                onRemove={() => removeImage(i)}
              />
            ))}

            {value.length < maxImages && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-brand-300 transition-colors cursor-pointer disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <ImagePlus className="h-5 w-5" />
                    <span className="text-[10px]">Add</span>
                  </>
                )}
              </button>
            )}
          </div>
        </SortableContext>
      </DndContext>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFiles}
        className="hidden"
      />
      {helperText && (
        <div className="text-[11px] text-muted-foreground mt-1">
          {helperText}
        </div>
      )}
    </div>
  )
}
