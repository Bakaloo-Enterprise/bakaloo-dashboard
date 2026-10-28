"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ImageUpload } from "@/components/products/ImageUpload"
import { useCreateBanner, useUpdateBanner } from "@/hooks/useBanners"
import { useCategories, useBundles } from "@/hooks/useCategories"
import { useCustomerSegments } from "@/hooks/useCustomerSegments"
import type { Banner, CreateBannerPayload } from "@/types/banner.types"

/** Declared width x height for each placement's slot, shown as a guide next
 * to the dimension inputs — not enforced server-side, just what the
 * screen's layout actually expects so an admin can size/crop before
 * publishing instead of finding out live in the app. */
const PLACEMENT_GUIDE: Record<
  NonNullable<CreateBannerPayload["placement"]>,
  { label: string; suggested: string }
> = {
  HOME: { label: "Home screen", suggested: "1080 × 480 (9:4 wide carousel)" },
  PROFILE: { label: "Profile screen", suggested: "1080 × 360 (3:1 wide strip)" },
}

interface BannerDialogProps {
  open: boolean
  onClose: () => void
  banner?: Banner | null
}

const INITIAL: CreateBannerPayload & { isActive: boolean } = {
  title: "",
  imageUrl: "",
  bannerType: "carousel",
  linkType: "none",
  linkValue: "",
  isActive: true,
  startDate: "",
  endDate: "",
  triggerType: "ALWAYS",
  audience: "B2C",
  placement: "HOME",
  targetSegmentId: undefined,
  imageWidth: undefined,
  imageHeight: undefined,
}

/** Loads the uploaded image and reports its natural pixel size back, so the
 * form can warn when it doesn't match what the admin declared — the actual
 * "test multiple banners and check it's properly working before publishing"
 * step, done inline instead of only discoverable after it's already live in
 * the app. */
function BannerSizeCheck({
  imageUrl,
  declaredWidth,
  declaredHeight,
  placement,
}: {
  imageUrl: string
  declaredWidth?: number
  declaredHeight?: number
  placement: NonNullable<CreateBannerPayload["placement"]>
}) {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setNatural(null)
    setFailed(false)
    if (!imageUrl) return
    const img = new window.Image()
    img.onload = () => setNatural({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => setFailed(true)
    img.src = imageUrl
  }, [imageUrl])

  if (!imageUrl) return null
  if (failed) {
    return <p className="text-xs text-destructive">Couldn&apos;t load this image URL to check its size.</p>
  }
  if (!natural) {
    return <p className="text-xs text-muted-foreground">Checking image size…</p>
  }

  const declared = declaredWidth && declaredHeight ? { w: declaredWidth, h: declaredHeight } : null
  const naturalRatio = natural.w / natural.h
  const declaredRatio = declared ? declared.w / declared.h : null
  // >8% off the declared aspect ratio is enough to visibly crop or letterbox
  // on the actual screen — anything tighter than that is normal
  // compression/export noise, not a real mismatch.
  const ratioMismatch =
    declaredRatio !== null && Math.abs(naturalRatio - declaredRatio) / declaredRatio > 0.08

  return (
    <div className="rounded-md border bg-muted/30 p-2.5 space-y-2">
      <div
        className="w-full overflow-hidden rounded bg-muted"
        style={{ aspectRatio: `${natural.w} / ${natural.h}`, maxHeight: 140 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="Banner preview" className="w-full h-full object-cover" />
      </div>
      <p className="text-xs text-muted-foreground">
        Uploaded image is {natural.w} × {natural.h}px for {PLACEMENT_GUIDE[placement].label}.
      </p>
      {declared && ratioMismatch && (
        <p className="text-xs text-amber-600">
          This doesn&apos;t match the declared {declared.w} × {declared.h}px — the app will crop or
          letterbox it to fit. Re-export at that size, or update the width/height above.
        </p>
      )}
      {declared && !ratioMismatch && (
        <p className="text-xs text-emerald-600">Matches the declared size — safe to publish.</p>
      )}
      {!declared && (
        <p className="text-xs text-muted-foreground">
          Set width/height above to check this image against the {PLACEMENT_GUIDE[placement].label}
          {" "}slot before publishing.
        </p>
      )}
    </div>
  )
}

function sanitizeBannerImageUrl(value: string | null | undefined) {
  if (!value) return ""

  const trimmed = value.trim()
  if (!trimmed) return ""

  const httpsIndex = trimmed.lastIndexOf("https://res.cloudinary.com/")
  const httpIndex = trimmed.lastIndexOf("http://res.cloudinary.com/")
  const startIndex = Math.max(httpsIndex, httpIndex)

  if (startIndex >= 0) {
    return trimmed.slice(startIndex)
  }

  return trimmed
}

export function BannerDialog({ open, onClose, banner }: BannerDialogProps) {
  const [form, setForm] = useState(INITIAL)
  const createMutation = useCreateBanner()
  const updateMutation = useUpdateBanner()
  const isEdit = !!banner
  const { data: categories } = useCategories()
  const { data: bundles } = useBundles()
  const { data: segments } = useCustomerSegments()

  useEffect(() => {
    if (banner) {
      setForm({
        title: banner.title ?? "",
        imageUrl: sanitizeBannerImageUrl(banner.image_url),
        bannerType: banner.banner_type ?? "carousel",
        linkType: banner.link_type ?? "none",
        linkValue: banner.link_value ?? "",
        isActive: banner.is_active,
        startDate: banner.start_date ? banner.start_date.slice(0, 16) : "",
        endDate: banner.end_date ? banner.end_date.slice(0, 16) : "",
        triggerType: banner.trigger_type ?? "ALWAYS",
        audience: banner.audience ?? "B2C",
        placement: banner.placement ?? "HOME",
        targetSegmentId: banner.target_segment_id ?? undefined,
        imageWidth: banner.image_width ?? undefined,
        imageHeight: banner.image_height ?? undefined,
      })
    } else {
      setForm(INITIAL)
    }
  }, [banner, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload: CreateBannerPayload = {
      title: form.title.trim(),
      imageUrl: sanitizeBannerImageUrl(form.imageUrl),
      bannerType: form.bannerType,
      linkType: form.linkType,
      linkValue: form.linkType !== "none" ? form.linkValue?.trim() : undefined,
      isActive: form.isActive,
      // datetime-local gives "2026-07-13T15:53" (no seconds/timezone) —
      // the backend requires a full RFC3339 date-time, which rejects that
      // with "must match format \"date-time\"".
      startDate: form.startDate ? new Date(form.startDate).toISOString() : undefined,
      endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
      triggerType: form.triggerType,
      audience: form.audience,
      placement: form.placement,
      targetSegmentId: form.targetSegmentId || undefined,
      imageWidth: form.imageWidth || undefined,
      imageHeight: form.imageHeight || undefined,
    }

    if (isEdit && banner) {
      updateMutation.mutate(
        { id: banner.id, payload },
        { onSuccess: onClose }
      )
    } else {
      createMutation.mutate(payload, { onSuccess: onClose })
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Banner" : "Add Banner"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Banner title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              maxLength={200}
            />
          </div>

          {/* Banner Type */}
          <div className="space-y-1.5">
            <Label>Banner Type</Label>
            <Select
              value={form.bannerType ?? "carousel"}
              onValueChange={(v) =>
                setForm({ ...form, bannerType: v as CreateBannerPayload["bannerType"] })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="carousel">Carousel</SelectItem>
                <SelectItem value="popup">Pop-up</SelectItem>
                <SelectItem value="announcement">Announcement Bar</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Show + Audience */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Show</Label>
              <Select
                value={form.triggerType ?? "ALWAYS"}
                onValueChange={(v) =>
                  setForm({ ...form, triggerType: v as CreateBannerPayload["triggerType"] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALWAYS">Always</SelectItem>
                  <SelectItem value="STORE_CLOSED">Only when store is closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Audience</Label>
              <Select
                value={form.audience ?? "B2C"}
                onValueChange={(v) =>
                  setForm({ ...form, audience: v as CreateBannerPayload["audience"] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="B2C">B2C</SelectItem>
                  <SelectItem value="B2B">B2B</SelectItem>
                  <SelectItem value="ALL">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Placement + Target segment */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Placement</Label>
              <Select
                value={form.placement ?? "HOME"}
                onValueChange={(v) =>
                  setForm({ ...form, placement: v as CreateBannerPayload["placement"] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HOME">Home screen</SelectItem>
                  <SelectItem value="PROFILE">Profile screen</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Suggested size: {PLACEMENT_GUIDE[form.placement ?? "HOME"].suggested}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Target segment</Label>
              <Select
                value={form.targetSegmentId ?? "__all__"}
                onValueChange={(v) =>
                  setForm({ ...form, targetSegmentId: v === "__all__" ? undefined : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Everyone in the audience" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Everyone (no segment)</SelectItem>
                  {(segments ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.member_count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.targetSegmentId && (
                <p className="text-xs text-muted-foreground">
                  Only signed-in members of this segment see this banner — combined with Audience above.
                </p>
              )}
            </div>
          </div>

          {/* Declared banner dimensions */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="imageWidth">Width (px)</Label>
              <Input
                id="imageWidth"
                type="number"
                min={1}
                placeholder="e.g. 1080"
                value={form.imageWidth ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    imageWidth: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="imageHeight">Height (px)</Label>
              <Input
                id="imageHeight"
                type="number"
                min={1}
                placeholder="e.g. 480"
                value={form.imageHeight ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    imageHeight: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </div>
          </div>

          {/* Banner Image */}
          <div className="space-y-2">
            <Label>Banner Image *</Label>
            <ImageUpload kind="banners"
              value={form.imageUrl || null}
              onChange={(url) => setForm({ ...form, imageUrl: url ?? "" })}
              label="Upload Banner Image"
              helperText={
                <div className="flex flex-col gap-0.5">
                  <span>• <strong>Size:</strong> Max 5MB</span>
                  <span>• <strong>Format:</strong> JPG, PNG, WEBP</span>
                  <span>• <strong>Recommended:</strong> Wide banner image (carousel ratio)</span>
                </div>
              }
            />

            <div className="space-y-1.5">
              <Label htmlFor="imageUrl">Image URL</Label>
              <Input
                id="imageUrl"
                type="url"
                placeholder="https://... or upload above"
                value={form.imageUrl}
                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                required
              />
            </div>

            <BannerSizeCheck
              imageUrl={form.imageUrl}
              declaredWidth={form.imageWidth ?? undefined}
              declaredHeight={form.imageHeight ?? undefined}
              placement={form.placement ?? "HOME"}
            />
          </div>

          {/* Link Type + Value */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Link Type</Label>
              <Select
                value={form.linkType}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    linkType: v as CreateBannerPayload["linkType"],
                    linkValue: v === "none" ? "" : form.linkValue,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="category">Category</SelectItem>
                  <SelectItem value="product">Product</SelectItem>
                  <SelectItem value="url">URL</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.linkType === "category" && (
              <div className="space-y-1.5">
                <Label>Category / Bundle</Label>
                <Select
                  value={form.linkValue || undefined}
                  onValueChange={(v) => setForm({ ...form, linkValue: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category or bundle" />
                  </SelectTrigger>
                  <SelectContent>
                    {bundles?.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        🎁 {b.name}
                      </SelectItem>
                    ))}
                    {categories?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {(form.linkType === "product" || form.linkType === "url") && (
              <div className="space-y-1.5">
                <Label htmlFor="linkValue">
                  {form.linkType === "url" ? "URL" : "Product ID"}
                </Label>
                <Input
                  id="linkValue"
                  placeholder={form.linkType === "url" ? "https://..." : "Enter product ID"}
                  value={form.linkValue ?? ""}
                  onChange={(e) => setForm({ ...form, linkValue: e.target.value })}
                />
              </div>
            )}
          </div>

          {/* Schedule */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="datetime-local"
                value={form.startDate ?? ""}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="datetime-local"
                value={form.endDate ?? ""}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <Switch
              checked={form.isActive}
              onCheckedChange={(v) => setForm({ ...form, isActive: v })}
            />
            <Label>Active</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : isEdit ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
