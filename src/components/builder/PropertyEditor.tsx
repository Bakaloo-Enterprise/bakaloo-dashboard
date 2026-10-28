"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { ImagePlus, Loader2, Plus, Star, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ThemeColorPicker } from "@/components/themes/ThemeColorPicker"
import { ThemeImageUploader } from "@/components/themes/ThemeImageUploader"
import { useCategories } from "@/hooks/useCategories"
import { useBanners } from "@/hooks/useBanners"
import { useUploadImage } from "@/hooks/useUploads"
import type {
  SectionManifest,
  UpdateSectionMerchPayload,
} from "@/types/theme.types"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import CategoryBinder from "./CategoryBinder"
import { LinkPicker } from "./LinkPicker"
import { getSectionTypeMeta } from "./sectionTypesMeta"
import StylePresetPicker from "./StylePresetPicker"
import BannerEditor from "./editors/BannerEditor"
import MosaicEditor from "./editors/MosaicEditor"
import ProductConfigEditor from "./editors/ProductConfigEditor"
import AnimationPicker from "./editors/AnimationPicker"
import ArchedShowcaseEditor from "./editors/ArchedShowcaseEditor"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface PropertyEditorProps {
  section: SectionManifest
  onConfigChange: (config: Record<string, unknown>) => void
  onMerchBindingChange?: (binding: UpdateSectionMerchPayload) => void
}

function normalizeConfig(config: Record<string, unknown> | null | undefined) {
  return { ...(config ?? {}) }
}

const MERCH_BINDING_SECTION_TYPES = new Set([
  "seasonal_mosaic",
  "category_product_grid",
  "product_carousel",
  "trending_products",
  "promo_carousel",
  "arched_product_showcase",
])

export default function PropertyEditor({
  section,
  onConfigChange,
  onMerchBindingChange,
}: PropertyEditorProps) {
  const [localConfig, setLocalConfig] = useState<Record<string, unknown>>(
    normalizeConfig(section.config)
  )
  const meta = useMemo(
    () => getSectionTypeMeta(section.section_type),
    [section.section_type]
  )
  const supportsMerchBinding = MERCH_BINDING_SECTION_TYPES.has(
    section.section_type
  )

  useEffect(() => {
    setLocalConfig(normalizeConfig(section.config))
  }, [section.id, section.updated_at, section.config])

  const handleConfigChange = (nextConfig: Record<string, unknown>) => {
    setLocalConfig(nextConfig)
    onConfigChange(nextConfig)
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4">
        <div className="text-sm font-semibold text-slate-900">{meta.label}</div>
        <div className="mt-1 text-sm text-slate-500">{meta.description}</div>
      </div>

      <Tabs
        key={`${section.id}-${supportsMerchBinding ? "with-data" : "style-only"}`}
        defaultValue="style"
        className="w-full"
      >
        <TabsList
          className={`grid h-auto min-h-11 w-full rounded-2xl bg-slate-100 p-1 ${
            supportsMerchBinding ? "grid-cols-2" : "grid-cols-1"
          }`}
        >
          <TabsTrigger value="style" className="min-h-[40px] rounded-xl px-3 text-sm">
            🎨 Style
          </TabsTrigger>
          {supportsMerchBinding ? (
            <TabsTrigger value="data" className="min-h-[40px] rounded-xl px-3 text-sm">
              📁 Data
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="style" className="mt-5 space-y-4">
          <StylePresetPicker
            sectionType={section.section_type}
            config={localConfig}
            onChange={handleConfigChange}
          />
          <StyleEditorRouter
            section={section}
            config={localConfig}
            onChange={handleConfigChange}
          />
        </TabsContent>

        {supportsMerchBinding ? (
          <TabsContent value="data" className="mt-5">
            <CategoryBinder
              section={section}
              onMerchBindingChange={onMerchBindingChange ?? (() => {})}
              persistOnChange={false}
            />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  )
}

function StyleEditorRouter({
  section,
  config,
  onChange,
}: {
  section: SectionManifest
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
}) {
  switch (section.section_type) {
    case "animated_banner":
      return <BannerEditor config={config} onChange={onChange} />
    case "seasonal_mosaic":
      return <MosaicEditor config={config} onChange={onChange} />
    case "category_product_grid":
    case "product_carousel":
    case "trending_products":
      return (
        <ProductConfigEditor
          config={config}
          onChange={onChange}
          sectionType={section.section_type}
        />
      )
    case "round_category_icons":
      return <CategoryIconsEditor config={config} onChange={onChange} />
    case "fee_strip":
      return (
        <StripEditor
          config={config}
          onChange={onChange}
          title="Fee Strip"
        />
      )
    case "bank_offers":
      return <BankOffersEditor config={config} onChange={onChange} />
    case "promo_carousel":
      return <PromoCarouselEditor config={config} onChange={onChange} />
    case "arched_product_showcase":
      return <ArchedShowcaseEditor config={config} onChange={onChange} />
    case "custom_banner":
      return <CustomBannerEditor config={config} onChange={onChange} />
    case "text_header":
      return <TextHeaderEditor config={config} onChange={onChange} />
    case "spacer":
      return <SpacerEditor config={config} onChange={onChange} />
    default:
      return null
  }
}

interface CategoryIconConfigItem {
  category_id?: string
  label?: string
  image_url?: string
}

function normalizeCategoryIconItems(value: unknown): CategoryIconConfigItem[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      category_id:
        typeof item.category_id === "string" ? item.category_id : undefined,
      label: typeof item.label === "string" ? item.label : undefined,
      image_url:
        typeof item.image_url === "string" ? item.image_url : undefined,
    }))
}

function CategoryIconsEditor({
  config,
  onChange,
}: {
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
}) {
  const { data: categories } = useCategories()
  const iconSize = typeof config.icon_size === "number" ? config.icon_size : 64
  const gap = typeof config.gap === "number" ? config.gap : 12
  const showLabels =
    typeof config.show_labels === "boolean" ? config.show_labels : true
  const items = normalizeCategoryIconItems(config.items)
  const availableCategories = (categories ?? [])
    .filter((category) => category.is_active)
    .sort((left, right) => left.sort_order - right.sort_order)

  const categoryMap = new Map(
    availableCategories.map((category) => [category.id, category])
  )

  const patch = (patchConfig: Partial<Record<string, unknown>>) => {
    onChange({ ...config, ...patchConfig })
  }

  const patchItems = (nextItems: CategoryIconConfigItem[]) => {
    patch({ items: nextItems })
  }

  const updateItem = (
    index: number,
    patchItem: Partial<CategoryIconConfigItem>
  ) => {
    const nextItems = items.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patchItem } : item
    )
    patchItems(nextItems)
  }

  const addItem = () => {
    patchItems([...items, {}])
  }

  return (
    <div className="space-y-6">
      <RangeControl
        id="category-icon-size"
        label="Icon Size"
        value={iconSize}
        min={40}
        max={96}
        step={4}
        unit="px"
        onChange={(value) => patch({ icon_size: value })}
      />

      <RangeControl
        id="category-icon-gap"
        label="Gap"
        value={gap}
        min={4}
        max={24}
        step={2}
        unit="px"
        onChange={(value) => patch({ gap: value })}
      />

      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <div>
          <div className="text-sm font-medium text-slate-900">Show Labels</div>
          <div className="text-xs text-slate-500">
            Display category names under the icon rail.
          </div>
        </div>
        <Switch checked={showLabels} onCheckedChange={(checked) => patch({ show_labels: checked })} />
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              Icon Items
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Add custom category icons here. If empty, the app keeps using the
              bound catalog categories.
            </div>
          </div>
          <Button type="button" variant="outline" onClick={addItem}>
            <Plus className="mr-2 h-4 w-4" />
            Add Icon
          </Button>
        </div>

        {items.length ? (
          <div className="space-y-4">
            {items.map((item, index) => {
              const linkedCategory =
                item.category_id != null
                  ? categoryMap.get(item.category_id)
                  : undefined

              return (
                <div
                  key={`${item.category_id ?? "custom"}-${index}`}
                  className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-slate-900">
                      Icon {index + 1}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        patchItems(items.filter((_, itemIndex) => itemIndex !== index))
                      }
                    >
                      <Trash2 className="h-4 w-4 text-slate-500" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label>Linked Category</Label>
                    <Select
                      value={item.category_id && item.category_id.length > 0
                        ? item.category_id
                        : "__none__"}
                      onValueChange={(value) =>
                        updateItem(index, {
                          category_id: value === "__none__" ? "" : value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No linked category</SelectItem>
                        {availableCategories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`category-icon-label-${index}`}>
                      Label Override
                    </Label>
                    <Input
                      id={`category-icon-label-${index}`}
                      value={item.label ?? ""}
                      placeholder={linkedCategory?.name ?? "Use category name"}
                      onChange={(event) =>
                        updateItem(index, { label: event.target.value })
                      }
                    />
                  </div>

                  <ThemeImageUploader
                    label="Icon Image Override"
                    value={item.image_url ?? null}
                    onChange={(value) =>
                      updateItem(index, { image_url: value ?? "" })
                    }
                  />
                </div>
              )
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500">
            No custom icon items yet.
          </div>
        )}
      </div>

      <AnimationPicker
        value={typeof config.animation === "string" ? config.animation : "none"}
        onChange={(value) => patch({ animation: value })}
      />
    </div>
  )
}

function StripEditor({
  config,
  onChange,
  title,
}: {
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
  title: string
}) {
  const visible = typeof config.visible === "boolean" ? config.visible : true
  const containerColor =
    typeof config.container_color === "string"
      ? config.container_color
      : "#BFEFFF"
  const patch = (patchConfig: Partial<Record<string, unknown>>) => {
    onChange({ ...config, ...patchConfig })
  }

  return (
    <div className="space-y-6">
      <ThemeImageUploader
        label={`${title} Image`}
        value={typeof config.image_url === "string" ? config.image_url : null}
        onChange={(value) => patch({ image_url: value })}
      />

      <ThemeColorPicker
        label="Container Color"
        value={containerColor}
        onChange={(value) => patch({ container_color: value })}
      />

      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <div>
          <div className="text-sm font-medium text-slate-900">Visible</div>
          <div className="text-xs text-slate-500">
            Toggle fallback strip content when no image is present.
          </div>
        </div>
        <Switch checked={visible} onCheckedChange={(checked) => patch({ visible: checked })} />
      </div>

      <AnimationPicker
        value={typeof config.animation === "string" ? config.animation : "none"}
        onChange={(value) => patch({ animation: value })}
      />
    </div>
  )
}

function BankOffersEditor({
  config,
  onChange,
}: {
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
}) {
  const visible = typeof config.visible === "boolean" ? config.visible : true
  const imageUrls = Array.isArray(config.image_urls)
    ? (config.image_urls as string[]).filter(
        (value): value is string => typeof value === "string"
      )
    : typeof config.image_url === "string" && config.image_url.trim()
      ? [config.image_url]
      : []

  const patch = (patchConfig: Partial<Record<string, unknown>>) => {
    onChange({ ...config, ...patchConfig })
  }

  const patchImageUrls = (nextUrls: string[]) => {
    patch({
      image_urls: nextUrls,
      image_url: nextUrls[0] ?? null,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <div className="text-sm font-medium text-slate-900">Offer Banners</div>
          <div className="text-xs text-slate-500">
            Add up to 10 bank offer images. The app shows them side by side.
          </div>
        </div>
        <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
          {imageUrls.length}/10
        </div>
      </div>

      <div className="space-y-4">
        {imageUrls.map((imageUrl, index) => (
          <div
            key={`bank-offer-image-${index}`}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-slate-900">
                  Banner {index + 1}
                </div>
                <div className="text-xs text-slate-500">
                  Horizontal bank offer card shown in the app row.
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  patchImageUrls(
                    imageUrls.filter((_, imageIndex) => imageIndex !== index)
                  )
                }
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remove
              </Button>
            </div>

            <ThemeImageUploader
              label={`Bank Offer Image ${index + 1}`}
              value={imageUrl || null}
              onChange={(value) =>
                patchImageUrls(
                  imageUrls.map((item, imageIndex) =>
                    imageIndex === index ? value ?? "" : item
                  )
                )
              }
            />
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          className="w-full rounded-2xl border-dashed"
          onClick={() => patchImageUrls([...imageUrls, ""])}
          disabled={imageUrls.length >= 10}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Bank Offer Image
        </Button>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <div>
          <div className="text-sm font-medium text-slate-900">Visible</div>
          <div className="text-xs text-slate-500">
            Show this bank-offer row in the phone feed.
          </div>
        </div>
        <Switch checked={visible} onCheckedChange={(checked) => patch({ visible: checked })} />
      </div>

      <AnimationPicker
        value={typeof config.animation === "string" ? config.animation : "none"}
        onChange={(value) => patch({ animation: value })}
      />
    </div>
  )
}

function PromoCarouselEditor({
  config,
  onChange,
}: {
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
}) {
  const aspectRatio =
    typeof config.aspect_ratio === "string" ? config.aspect_ratio : "16:9"
  const borderRadius =
    typeof config.border_radius === "number" ? config.border_radius : 12
  const autoScrollSpeed =
    typeof config.auto_scroll_speed === "number" ? config.auto_scroll_speed : 3000

  // ── Banner source ─────────────────────────────────────────────────────────
  // "system"  → pull from /banners (the /banners admin page)
  // "custom"  → use the images[] array uploaded directly here (1–5 images)
  // If there are already custom images in config and banner_source is unset,
  // treat it as "custom" (backward compat for sections saved before banner_source existed).
  const rawCustomImages = Array.isArray(config.images)
    ? (config.images as string[]).filter((u) => typeof u === "string" && u.trim())
    : []

  const bannerSource: "system" | "custom" =
    typeof config.banner_source === "string"
      ? (config.banner_source as "system" | "custom")
      : rawCustomImages.length > 0
        ? "custom"
        : "system"

  // System banners preview
  const { data: systemBanners = [] } = useBanners()
  const activeBanners = systemBanners.filter((b) => b.is_active)

  const patch = (patchConfig: Partial<Record<string, unknown>>) => {
    onChange({ ...config, ...patchConfig })
  }

  const switchMode = (mode: "system" | "custom") => {
    patch({ banner_source: mode })
  }

  return (
    <div className="space-y-6">
      {/* ── Banner Source mode selector ── */}
      <div className="space-y-2">
        <Label>Banner Source</Label>
        <div className="grid grid-cols-2 gap-2">
          {(["system", "custom"] as const).map((mode) => {
            const isActive = bannerSource === mode
            return (
              <button
                key={mode}
                type="button"
                onClick={() => switchMode(mode)}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-xl border-2 px-4 py-3 text-left transition-colors",
                  isActive
                    ? "border-brand-500 bg-brand-50"
                    : "border-border bg-muted/30 hover:bg-muted"
                )}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "flex h-3.5 w-3.5 items-center justify-center rounded-full border-2",
                      isActive
                        ? "border-brand-600 bg-brand-600"
                        : "border-muted-foreground/40"
                    )}
                  >
                    {isActive && (
                      <div className="h-1.5 w-1.5 rounded-full bg-white" />
                    )}
                  </div>
                  <span className="text-sm font-semibold capitalize">{mode === "system" ? "System" : "Custom"}</span>
                </div>
                <span className="text-[11px] text-muted-foreground leading-tight">
                  {mode === "system"
                    ? "Use banners from the /banners page"
                    : "Upload your own banner images here"}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Mode-specific content ── */}
      {bannerSource === "system" ? (
        <div className="space-y-3">
          <div className="rounded-xl border bg-muted/20 p-4">
            <p className="text-xs font-medium text-muted-foreground mb-3">
              Active system banners ({activeBanners.length})
            </p>
            {activeBanners.length === 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground italic">
                  No active banners found.
                </p>
                <a
                  href="/banners"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100 transition-colors"
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  Go to /banners to add banners
                </a>
              </div>
            ) : (
              <div className="space-y-2">
                {activeBanners.slice(0, 5).map((b, i) => (
                  <div key={b.id} className="flex items-center gap-3">
                    <div className="relative h-10 w-16 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                      {b.image_url && (
                        <Image
                          src={b.image_url}
                          alt={b.title}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{b.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        #{i + 1} · {b.link_type !== "none" ? b.link_type : "No link"}
                      </p>
                    </div>
                  </div>
                ))}
                {activeBanners.length > 5 && (
                  <p className="text-[10px] text-muted-foreground">
                    +{activeBanners.length - 5} more
                  </p>
                )}
              </div>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Banners are sorted by the order set on the{" "}
            <a href="/banners" target="_blank" className="underline text-brand-600">
              Banners page
            </a>
            . Only active banners within their date window are shown.
          </p>
        </div>
      ) : (
        <>
          <PromoCustomImagesEditor
            images={rawCustomImages}
            onChange={(images) => patch({ images, banner_source: "custom" })}
          />
          <div className="space-y-2">
            <Label>On tap (applies to every custom image in this carousel)</Label>
            <LinkPicker
              value={typeof config.link_url === "string" ? config.link_url : ""}
              onChange={(value) => patch({ link_url: value || null })}
            />
          </div>
        </>
      )}

      {/* ── Appearance settings (shared) ── */}
      <div className="space-y-2">
        <Label htmlFor="promo-aspect-ratio">Aspect Ratio</Label>
        <Input
          id="promo-aspect-ratio"
          value={aspectRatio}
          onChange={(event) => patch({ aspect_ratio: event.target.value })}
          placeholder="16:9"
        />
        <p className="text-[10px] text-muted-foreground">
          Use W:H format, e.g. 16:9 · 2:1 · 3:1. Match your uploaded image ratio for best results.
        </p>
      </div>

      <RangeControl
        id="promo-border-radius"
        label="Border Radius"
        value={borderRadius}
        min={0}
        max={32}
        step={2}
        unit="px"
        onChange={(value) => patch({ border_radius: value })}
      />

      <RangeControl
        id="promo-auto-scroll-speed"
        label="Auto Scroll Speed"
        value={autoScrollSpeed}
        min={1000}
        max={8000}
        step={250}
        unit="ms"
        onChange={(value) => patch({ auto_scroll_speed: value })}
      />

      <AnimationPicker
        value={typeof config.animation === "string" ? config.animation : "none"}
        onChange={(value) => patch({ animation: value })}
      />
    </div>
  )
}

/** Inner component: 1–5 custom promo images with upload + URL paste + primary-badge */
function PromoCustomImagesEditor({
  images,
  onChange,
}: {
  images: string[]
  onChange: (images: string[]) => void
}) {
  const MIN = 1
  const MAX = 5
  const fileRef = useRef<HTMLInputElement>(null)
  const [urlInput, setUrlInput] = useState("")
  const [uploading, setUploading] = useState(false)
  const uploadMutation = useUploadImage("themes")

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const remaining = MAX - images.length
    if (remaining <= 0) {
      toast.error(`Maximum ${MAX} banners allowed`)
      if (fileRef.current) fileRef.current.value = ""
      return
    }
    const toUpload = files.slice(0, remaining)
    if (toUpload.length < files.length)
      toast.warning(`Only uploading ${toUpload.length} of ${files.length} (max ${MAX})`)
    const large = toUpload.filter((f) => f.size > 5 * 1024 * 1024)
    if (large.length) {
      toast.error(`${large.map((f) => f.name).join(", ")} exceed 5MB — skipped`)
    }
    const valid = toUpload.filter((f) => f.size <= 5 * 1024 * 1024)
    setUploading(true)
    const newUrls: string[] = []
    for (const file of valid) {
      try {
        const result = await uploadMutation.mutateAsync(file)
        if (result?.url && !images.includes(result.url)) newUrls.push(result.url)
      } catch { /* toast handled by mutation */ }
    }
    if (newUrls.length) {
      onChange([...images, ...newUrls])
      toast.success(`${newUrls.length} banner(s) uploaded`)
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ""
  }

  const addUrl = () => {
    const url = urlInput.trim()
    if (!url) return
    if (images.length >= MAX) { toast.error(`Maximum ${MAX} banners`); return }
    if (images.includes(url)) { toast.warning("Already in the list"); return }
    onChange([...images, url])
    setUrlInput("")
  }

  const moveUp = (i: number) => {
    if (i === 0) return
    const next = [...images]
    ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
    onChange(next)
  }

  const moveDown = (i: number) => {
    if (i === images.length - 1) return
    const next = [...images]
    ;[next[i], next[i + 1]] = [next[i + 1], next[i]]
    onChange(next)
  }

  return (
    <div className="space-y-3">
      {/* Size hint banner */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
        <p className="text-[11px] font-semibold text-amber-800 mb-1">
          Recommended Banner Size
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
          <p className="text-[10px] text-amber-700">
            <strong>16:9 ratio</strong> — 1200 × 675 px
          </p>
          <p className="text-[10px] text-amber-700">
            <strong>2.5:1 ratio</strong> — 1200 × 480 px
          </p>
          <p className="text-[10px] text-amber-700">
            <strong>3:1 ratio</strong> — 1200 × 400 px
          </p>
          <p className="text-[10px] text-amber-700">
            <strong>Max file size:</strong> 5 MB
          </p>
        </div>
        <p className="text-[10px] text-amber-600 mt-1">
          Format: JPG, PNG, or WEBP. Use the same ratio as the Aspect Ratio setting above.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <Label>
          Custom Banners ({images.length}/{MAX})
          {images.length < MIN && (
            <span className="ml-2 text-[10px] font-normal text-destructive">
              — add at least {MIN} banner
            </span>
          )}
        </Label>
      </div>

      {/* Image list */}
      <div className="space-y-2">
        {images.map((url, i) => (
          <div key={`${url}-${i}`} className="flex items-center gap-3 rounded-xl border bg-muted/20 p-2">
            <div className="relative h-14 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Banner ${i + 1}`} className="h-full w-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                {i === 0 && (
                  <span className="flex items-center gap-1 rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                    <Star className="h-2.5 w-2.5 fill-current" /> Primary
                  </span>
                )}
                <span className="text-xs text-muted-foreground truncate">Banner {i + 1}</span>
              </div>
              <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                {url.slice(url.lastIndexOf("/") + 1).split("?")[0]}
              </p>
            </div>
            {/* Reorder + remove */}
            <div className="flex flex-col gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground disabled:opacity-30"
                disabled={i === 0}
                onClick={() => moveUp(i)}
                title="Move up"
              >
                <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M6 2L10 8H2L6 2Z" />
                </svg>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground disabled:opacity-30"
                disabled={i === images.length - 1}
                onClick={() => moveDown(i)}
                title="Move down"
              >
                <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M6 10L2 4H10L6 10Z" />
                </svg>
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0 text-destructive hover:bg-destructive/10"
              onClick={() => onChange(images.filter((_, j) => j !== i))}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}

        {images.length < MAX && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed py-5 text-muted-foreground transition-colors hover:border-brand-300 hover:bg-brand-50/40 disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
                <span className="text-xs font-medium text-brand-600">Uploading…</span>
              </>
            ) : (
              <>
                <ImagePlus className="h-5 w-5" />
                <span className="text-xs font-medium">
                  {images.length === 0 ? "Upload first banner image" : "Add another banner image"}
                </span>
                <span className="text-[10px] text-muted-foreground/70">
                  {MAX - images.length} slot{MAX - images.length !== 1 ? "s" : ""} remaining
                </span>
              </>
            )}
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <Input
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addUrl() } }}
          placeholder="Or paste a banner image URL…"
          className="text-xs"
          disabled={images.length >= MAX}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addUrl}
          disabled={images.length >= MAX || !urlInput.trim()}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleFiles} className="hidden" />
    </div>
  )
}

function CustomBannerEditor({
  config,
  onChange,
}: {
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
}) {
  const borderRadius =
    typeof config.border_radius === "number" ? config.border_radius : 12
  const patch = (patchConfig: Partial<Record<string, unknown>>) => {
    onChange({ ...config, ...patchConfig })
  }

  return (
    <div className="space-y-6">
      <ThemeImageUploader
        label="Custom Banner"
        value={typeof config.image_url === "string" ? config.image_url : null}
        onChange={(value) => patch({ image_url: value })}
      />

      <RangeControl
        id="custom-banner-radius"
        label="Border Radius"
        value={borderRadius}
        min={0}
        max={32}
        step={2}
        unit="px"
        onChange={(value) => patch({ border_radius: value })}
      />

      <AnimationPicker
        value={typeof config.animation === "string" ? config.animation : "none"}
        onChange={(value) => patch({ animation: value })}
      />

      <div className="space-y-2">
        <Label>On tap</Label>
        <LinkPicker
          value={typeof config.link_url === "string" ? config.link_url : ""}
          onChange={(value) => patch({ link_url: value || null })}
        />
      </div>
    </div>
  )
}

function TextHeaderEditor({
  config,
  onChange,
}: {
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
}) {
  const text = typeof config.text === "string" ? config.text : "Section Title"
  const fontSize = typeof config.font_size === "number" ? config.font_size : 18
  const color = typeof config.color === "string" ? config.color : "#000000"
  const alignment =
    typeof config.alignment === "string" ? config.alignment : "left"

  const patch = (patchConfig: Partial<Record<string, unknown>>) => {
    onChange({ ...config, ...patchConfig })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="text-header-text">Text</Label>
        <Input
          id="text-header-text"
          value={text}
          onChange={(event) => patch({ text: event.target.value })}
          placeholder="Section Title"
        />
      </div>

      <RangeControl
        id="text-header-font-size"
        label="Font Size"
        value={fontSize}
        min={12}
        max={40}
        step={1}
        unit="px"
        onChange={(value) => patch({ font_size: value })}
      />

      <ThemeColorPicker
        label="Text Color"
        value={color}
        onChange={(value) => patch({ color: value })}
      />

      <div className="space-y-3">
        <div className="text-sm font-medium text-slate-900">Alignment</div>
        <div className="grid grid-cols-3 gap-3">
          {["left", "center", "right"].map((option) => {
            const isActive = alignment === option
            return (
              <button
                key={option}
                type="button"
                onClick={() => patch({ alignment: option })}
                className={`rounded-2xl border px-3 py-3 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "border-blue-500 bg-blue-50 text-blue-700 shadow-[0_0_0_3px_rgba(59,130,246,0.12)]"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
                aria-pressed={isActive}
              >
                {option}
              </button>
            )
          })}
        </div>
      </div>

      <AnimationPicker
        value={typeof config.animation === "string" ? config.animation : "none"}
        onChange={(value) => patch({ animation: value })}
      />
    </div>
  )
}

function SpacerEditor({
  config,
  onChange,
}: {
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
}) {
  const height = typeof config.height === "number" ? config.height : 16

  return (
    <RangeControl
      id="spacer-height"
      label="Spacer Height"
      value={height}
      min={4}
      max={80}
      step={2}
      unit="px"
      onChange={(value) => onChange({ ...config, height: value })}
    />
  )
}

function RangeControl({
  id,
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (value: number) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        <span className="text-sm font-medium text-slate-600">
          {value}
          {unit}
        </span>
      </div>
      <Input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || value)}
        className="h-3 cursor-pointer rounded-full border-0 bg-transparent px-0 shadow-none"
      />
    </div>
  )
}
