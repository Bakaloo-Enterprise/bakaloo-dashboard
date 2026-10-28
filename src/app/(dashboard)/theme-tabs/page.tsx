"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ExternalLink,
  ImageIcon,
  Loader2,
  MoreHorizontal,
  PackageSearch,
  Pencil,
  Plus,
  RotateCcw,
  Star,
  Tags,
  Trash2,
} from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { EmptyState } from "@/components/shared/EmptyState"
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton"
import { PageHeader } from "@/components/shared/PageHeader"
import { ImageUpload } from "@/components/products/ImageUpload"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useCategories } from "@/hooks/useCategories"
import {
  useArchiveThemeTab,
  useCreateThemeTab,
  useRestoreThemeTab,
  useThemeTabs,
  useUpdateThemeTab,
} from "@/hooks/useThemeTabs"
import { useDebounce } from "@/hooks/useDebounce"
import { getProducts } from "@/services/products.service"
import { defaultMerchConfig } from "@/services/theme-tabs.service"
import { ThemeColorPicker } from "@/components/themes/ThemeColorPicker"
import type { Category, Product } from "@/types"
import type {
  CategoryRailConfig,
  MerchSectionConfig,
  ThemeAudience,
  ThemeStoreKey,
  ThemeTab,
  ThemeTabMerchConfig,
} from "@/types/theme.types"

const AUDIENCE_OPTIONS: Array<{ value: ThemeAudience; label: string }> = [
  { value: "B2C", label: "B2C (regular storefront)" },
  { value: "B2B", label: "B2B (wholesale storefront)" },
]

const STORE_OPTIONS: Array<{ value: ThemeStoreKey; label: string }> = [
  { value: "zepto", label: "Zepto" },
  { value: "off_zone", label: "50% OFF ZONE" },
  { value: "super_mall", label: "Super Mall" },
  { value: "cafe", label: "Cafe" },
]

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
] as const

// Mirrors HOME_CAPS in bakaloo-backend/src/modules/themes/public.controller.js.
// The mobile home API always clamps to these caps regardless of what's saved
// here, so keep the dashboard input max in lock-step to avoid admins setting
// a number that silently gets truncated.
const MERCH_LIMIT_CAPS = {
  seasonal_mosaic: 8,
  featured: 12,
  deals: 12,
  trending: 12,
} as const
const CATEGORY_RAIL_LIMIT_CAP = 8

interface ThemeTabFormData {
  store_key: ThemeStoreKey
  key: string
  label: string
  image_url: string
  text_color: string
  sort_order: number
  status: ThemeTab["status"]
  is_default: boolean
  merch_config: ThemeTabMerchConfig
  /** Immutable after creation — see the disabled Select in the dialog. */
  audience: ThemeAudience
}

function createEmptyForm(
  storeKey: ThemeStoreKey = "zepto",
  audience: ThemeAudience = "B2C"
): ThemeTabFormData {
  return {
    store_key: storeKey,
    key: "",
    label: "",
    image_url: "",
    text_color: "#000000",
    sort_order: 0,
    status: "active",
    is_default: false,
    merch_config: defaultMerchConfig(),
    audience,
  }
}

function buildFormFromTab(tab: ThemeTab): ThemeTabFormData {
  return {
    store_key: tab.store_key,
    key: tab.key,
    label: tab.label,
    image_url: tab.image_url ?? "",
    text_color: tab.text_color ?? "#000000",
    sort_order: tab.sort_order,
    status: tab.status,
    is_default: tab.is_default,
    merch_config: mergeMerchConfig(tab.merch_config),
    audience: tab.audience,
  }
}

function mergeMerchConfig(
  config?: Partial<ThemeTabMerchConfig> | null
): ThemeTabMerchConfig {
  const defaults = defaultMerchConfig()
  return {
    seasonal_mosaic: {
      ...defaults.seasonal_mosaic,
      ...(config?.seasonal_mosaic ?? {}),
      category_ids: [...(config?.seasonal_mosaic?.category_ids ?? defaults.seasonal_mosaic.category_ids)],
      product_ids: [...(config?.seasonal_mosaic?.product_ids ?? defaults.seasonal_mosaic.product_ids)],
    },
    featured: {
      ...defaults.featured,
      ...(config?.featured ?? {}),
      category_ids: [...(config?.featured?.category_ids ?? defaults.featured.category_ids)],
      product_ids: [...(config?.featured?.product_ids ?? defaults.featured.product_ids)],
    },
    deals: {
      ...defaults.deals,
      ...(config?.deals ?? {}),
      category_ids: [...(config?.deals?.category_ids ?? defaults.deals.category_ids)],
      product_ids: [...(config?.deals?.product_ids ?? defaults.deals.product_ids)],
    },
    trending: {
      ...defaults.trending,
      ...(config?.trending ?? {}),
      category_ids: [...(config?.trending?.category_ids ?? defaults.trending.category_ids)],
      product_ids: [...(config?.trending?.product_ids ?? defaults.trending.product_ids)],
    },
    category_rails: (config?.category_rails ?? defaults.category_rails).map((rail) => ({
      category_id: rail.category_id ?? "",
      product_ids: [...(rail.product_ids ?? [])],
      limit: rail.limit ?? 6,
      title: rail.title ?? null,
    })),
  }
}

function slugifyTabKey(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

function moveItem<T>(items: T[], from: number, to: number) {
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

function categoryNameMap(categories: Category[] | undefined) {
  return new Map((categories ?? []).map((category) => [category.id, category.name]))
}

function productLookup(products: Product[] | undefined) {
  return new Map((products ?? []).map((product) => [product.id, product]))
}

export default function ThemeTabsPage() {
  const [storeFilter, setStoreFilter] = useState<"all" | ThemeStoreKey>("all")
  const [statusFilter, setStatusFilter] = useState<"all" | ThemeTab["status"]>("all")
  // Tabs are audience-scoped rows (B2C and B2B each own an independent tab
  // list) — this page only ever shows one audience at a time so reordering
  // and "default tab" logic below never mixes the two lists together.
  const [audienceFilter, setAudienceFilter] = useState<ThemeAudience>("B2C")
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTab, setEditingTab] = useState<ThemeTab | null>(null)
  const [form, setForm] = useState<ThemeTabFormData>(() => createEmptyForm())

  const { data: themeTabs, isLoading } = useThemeTabs({
    ...(storeFilter !== "all" ? { store_key: storeFilter } : {}),
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    audience: audienceFilter,
  })
  const { data: categories } = useCategories()
  const { data: productPage } = useQuery({
    queryKey: ["theme-tabs", "product-lookup"],
    queryFn: () => getProducts({ page: 1, limit: 100, status: "active" }),
    staleTime: 30_000,
  })
  const createThemeTab = useCreateThemeTab()
  const updateThemeTab = useUpdateThemeTab()
  const archiveThemeTab = useArchiveThemeTab()
  const restoreThemeTab = useRestoreThemeTab()

  const categoryMap = useMemo(() => categoryNameMap(categories), [categories])
  const productMap = useMemo(
    () => productLookup(productPage?.products),
    [productPage?.products]
  )

  const filteredTabs = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (themeTabs ?? []).filter((tab) => {
      if (!query) return true
      return (
        tab.label.toLowerCase().includes(query) ||
        tab.key.toLowerCase().includes(query) ||
        tab.store_key.toLowerCase().includes(query)
      )
    })
  }, [search, themeTabs])

  const activeTabsByStore = useMemo(() => {
    const grouped = new Map<ThemeStoreKey, ThemeTab[]>()

    STORE_OPTIONS.forEach((store) => {
      grouped.set(store.value, [])
    })

    ;(themeTabs ?? []).forEach((tab) => {
      if (tab.status !== "active") return
      const storeTabs = grouped.get(tab.store_key)
      if (!storeTabs) return
      storeTabs.push(tab)
    })

    grouped.forEach((tabs, storeKey) => {
      grouped.set(
        storeKey,
        [...tabs].sort(
          (a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label)
        )
      )
    })

    return grouped
  }, [themeTabs])

  const isSaving = createThemeTab.isPending || updateThemeTab.isPending

  const openCreate = () => {
    setEditingTab(null)
    setForm(createEmptyForm(storeFilter === "all" ? "zepto" : storeFilter, audienceFilter))
    setDialogOpen(true)
  }

  const openEdit = (tab: ThemeTab) => {
    setEditingTab(tab)
    setForm(buildFormFromTab(tab))
    setDialogOpen(true)
  }

  const updateForm = <K extends keyof ThemeTabFormData>(
    field: K,
    value: ThemeTabFormData[K]
  ) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const updateMerchSection = (
    section:
      | "seasonal_mosaic"
      | "featured"
      | "deals"
      | "trending",
    nextValue: MerchSectionConfig
  ) => {
    setForm((current) => ({
      ...current,
      merch_config: {
        ...current.merch_config,
        [section]: nextValue,
      },
    }))
  }

  const updateRail = (index: number, nextRail: CategoryRailConfig) => {
    setForm((current) => ({
      ...current,
      merch_config: {
        ...current.merch_config,
        category_rails: current.merch_config.category_rails.map((rail, railIndex) =>
          railIndex === index ? nextRail : rail
        ),
      },
    }))
  }

  const addRail = () => {
    setForm((current) => ({
      ...current,
      merch_config: {
        ...current.merch_config,
        category_rails: [
          ...current.merch_config.category_rails,
          {
            category_id: "",
            product_ids: [],
            limit: 6,
            title: null,
          },
        ],
      },
    }))
  }

  const removeRail = (index: number) => {
    setForm((current) => ({
      ...current,
      merch_config: {
        ...current.merch_config,
        category_rails: current.merch_config.category_rails.filter(
          (_, railIndex) => railIndex !== index
        ),
      },
    }))
  }

  const handleSubmit = () => {
    const payload = {
      store_key: form.store_key,
      key: slugifyTabKey(form.key || form.label),
      label: form.label.trim(),
      image_url: form.image_url.trim() || null,
      text_color: form.text_color.trim() || null,
      sort_order: Number(form.sort_order) || 0,
      status: form.status,
      is_default: form.is_default,
      merch_config: form.merch_config,
      // Audience is immutable after creation — only sent when creating.
      ...(editingTab ? {} : { audience: form.audience }),
    }

    if (editingTab) {
      updateThemeTab.mutate(
        { id: editingTab.id, payload },
        { onSuccess: () => setDialogOpen(false) }
      )
      return
    }

    createThemeTab.mutate(payload, {
      onSuccess: () => setDialogOpen(false),
    })
  }

  const handleMoveTab = (tab: ThemeTab, direction: -1 | 1) => {
    if (tab.status !== "active") return

    const storeTabs = activeTabsByStore.get(tab.store_key) ?? []
    const currentIndex = storeTabs.findIndex((storeTab) => storeTab.id === tab.id)
    const nextIndex = currentIndex + direction

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= storeTabs.length) {
      return
    }

    updateThemeTab.mutate({
      id: tab.id,
      payload: { sort_order: nextIndex },
    })
  }

  const handleSetDefaultTab = (tab: ThemeTab) => {
    updateThemeTab.mutate({
      id: tab.id,
      payload: { is_default: true },
    })
  }

  const handleArchiveTab = (tab: ThemeTab) => {
    if (
      !window.confirm(
        `Remove "${tab.label}" from the active tab strip? You can restore it later from Archived tabs.`
      )
    ) {
      return
    }

    archiveThemeTab.mutate(tab.id)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Theme Tabs"
          subtitle="Manage store-specific tabs, icons, and tab-driven product merchandising"
        />
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Theme Tab
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="max-w-sm"
            placeholder="Search by label, key, or store"
          />
          <Select
            value={storeFilter}
            onValueChange={(value) =>
              setStoreFilter(value as "all" | ThemeStoreKey)
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All stores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stores</SelectItem>
              {STORE_OPTIONS.map((store) => (
                <SelectItem key={store.value} value={store.value}>
                  {store.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(value) =>
              setStatusFilter(value as "all" | ThemeTab["status"])
            }
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={audienceFilter}
            onValueChange={(value) => setAudienceFilter(value as ThemeAudience)}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Audience" />
            </SelectTrigger>
            <SelectContent>
              {AUDIENCE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {isLoading ? (
        <LoadingSkeleton variant="table" count={8} />
      ) : filteredTabs.length === 0 ? (
        <EmptyState
          icon={<Tags className="h-10 w-10" />}
          title="No theme tabs found"
          description="Create a store-specific tab to control iconography, order, linked themes, and home merchandising."
          actionLabel="Create Theme Tab"
          onAction={openCreate}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tab</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Linked Themes</TableHead>
                <TableHead>Merchandising</TableHead>
                <TableHead className="w-[56px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTabs.map((tab) => {
                const storeTabs = activeTabsByStore.get(tab.store_key) ?? []
                const activeIndex = storeTabs.findIndex(
                  (storeTab) => storeTab.id === tab.id
                )
                const displayOrder =
                  tab.status === "active" && activeIndex >= 0
                    ? activeIndex
                    : tab.sort_order
                const canMoveUp = tab.status === "active" && activeIndex > 0
                const canMoveDown =
                  tab.status === "active" &&
                  activeIndex >= 0 &&
                  activeIndex < storeTabs.length - 1

                return (
                <TableRow key={tab.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border bg-muted/40">
                        {tab.image_url ? (
                          <Image
                            src={tab.image_url}
                            alt={tab.label}
                            fill
                            className="object-cover"
                            sizes="48px"
                          />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="font-medium">{tab.label}</div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline">{tab.key}</Badge>
                          {tab.is_default ? (
                            <Badge className="border-amber-200 bg-amber-500/15 text-amber-700">
                              <Star className="mr-1 h-3 w-3" />
                              Default
                            </Badge>
                          ) : null}
                          <span>{tab.id.slice(0, 8)}...</span>
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {STORE_OPTIONS.find((store) => store.value === tab.store_key)?.label ??
                        tab.store_key}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        tab.audience === "B2B"
                          ? "border-violet-200 bg-violet-500/15 text-violet-700"
                          : "border-sky-200 bg-sky-500/15 text-sky-700"
                      }
                    >
                      {tab.audience}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        tab.status === "active"
                          ? "border-emerald-200 bg-emerald-500/15 text-emerald-700"
                          : "border-red-200 bg-red-500/15 text-red-700"
                      }
                    >
                      {tab.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-sm text-muted-foreground">
                        #{displayOrder}
                      </span>
                      {tab.status === "active" ? (
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => handleMoveTab(tab, -1)}
                            disabled={!canMoveUp || updateThemeTab.isPending}
                            aria-label={`Move ${tab.label} up`}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => handleMoveTab(tab, 1)}
                            disabled={!canMoveDown || updateThemeTab.isPending}
                            aria-label={`Move ${tab.label} down`}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      <ThemeLinkPill label="A" theme={tab.theme_a} />
                      <ThemeLinkPill label="B" theme={tab.theme_b} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div>
                        Seasonal:{" "}
                        {tab.merch_config.seasonal_mosaic.product_ids.length} manual /{" "}
                        {tab.merch_config.seasonal_mosaic.category_ids.length} categories
                      </div>
                      <div>
                        Featured:{" "}
                        {tab.merch_config.featured.product_ids.length} manual /{" "}
                        {tab.merch_config.featured.category_ids.length} categories
                      </div>
                      <div>
                        Rails: {tab.merch_config.category_rails.length}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(tab)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        {tab.status === "active" && !tab.is_default ? (
                          <DropdownMenuItem
                            onClick={() => handleSetDefaultTab(tab)}
                            disabled={updateThemeTab.isPending}
                          >
                            <Star className="mr-2 h-4 w-4" />
                            Set as default
                          </DropdownMenuItem>
                        ) : null}
                        {tab.status === "active" ? (
                          <DropdownMenuItem
                            onClick={() => handleArchiveTab(tab)}
                            disabled={archiveThemeTab.isPending}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove Tab
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => restoreThemeTab.mutate(tab.id)}
                            disabled={restoreThemeTab.isPending}
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Restore
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => openEdit(tab)}>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Open Merchandising
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>
              {editingTab ? "Edit Theme Tab" : "Create Theme Tab"}
            </DialogTitle>
            <DialogDescription>
              Configure store-specific tab metadata, iconography, linked theme context, and manual-first product merchandising.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Tab Metadata</CardTitle>
                  <CardDescription>
                    Store, icon, order, and lifecycle for this managed tab.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Store</Label>
                    <Select
                      value={form.store_key}
                      onValueChange={(value) =>
                        updateForm("store_key", value as ThemeStoreKey)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a store" />
                      </SelectTrigger>
                      <SelectContent>
                        {STORE_OPTIONS.map((store) => (
                          <SelectItem key={store.value} value={store.value}>
                            {store.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Audience</Label>
                    <Select
                      value={form.audience}
                      disabled={!!editingTab}
                      onValueChange={(value) =>
                        updateForm("audience", value as ThemeAudience)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select an audience" />
                      </SelectTrigger>
                      <SelectContent>
                        {AUDIENCE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {editingTab ? (
                      <p className="text-xs text-muted-foreground">
                        Audience can&apos;t be changed after a tab is created.
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label>Tab Label</Label>
                    <Input
                      value={form.label}
                      onChange={(event) => {
                        const label = event.target.value
                        setForm((current) => ({
                          ...current,
                          label,
                          key: current.key ? current.key : slugifyTabKey(label),
                        }))
                      }}
                      placeholder="e.g. Navratri"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Tab Key</Label>
                    <Input
                      value={form.key}
                      onChange={(event) => updateForm("key", slugifyTabKey(event.target.value))}
                      placeholder="navratri"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Sort Order</Label>
                      <Input
                        type="number"
                        min={0}
                        value={form.sort_order}
                        onChange={(event) =>
                          updateForm("sort_order", Number(event.target.value) || 0)
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select
                        value={form.status}
                        onValueChange={(value) =>
                          updateForm("status", value as ThemeTab["status"])
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <Label>Default landing tab</Label>
                      <p className="text-xs text-muted-foreground">
                        Customers see this tab first when they open the app for this store.
                      </p>
                    </div>
                    <Switch
                      checked={form.is_default}
                      onCheckedChange={(checked) => updateForm("is_default", checked)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Tab Icon / Image</Label>
                    <ImageUpload kind="themes"
                      value={form.image_url || null}
                      onChange={(url) => updateForm("image_url", url ?? "")}
                      label="Upload Tab Icon"
                      helperText={
                        <div className="flex flex-col gap-0.5">
                          <span>• Use your real PNG / 3D icon image here</span>
                          <span>• Transparent PNG works best for the app tab strip</span>
                          <span>• Recommended square asset for consistent sizing</span>
                        </div>
                      }
                    />
                  </div>

                  <ThemeColorPicker
                    label="Tab Text Color"
                    value={form.text_color}
                    onChange={(value) => updateForm("text_color", value)}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Linked Themes</CardTitle>
                  <CardDescription>
                    Themes are linked from the Theme Editor by selecting this managed tab.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ThemeLinkSummaryCard label="Variant A" theme={editingTab?.theme_a ?? null} />
                  <ThemeLinkSummaryCard label="Variant B" theme={editingTab?.theme_b ?? null} />
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Merchandising Builder</CardTitle>
                  <CardDescription>
                    Manual products appear first in saved order. Remaining slots are filled from selected categories with product deduplication.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <MerchSectionEditor
                    title="Seasonal Mosaic"
                    description="Controls the products feeding the seasonal hero + mini tiles."
                    value={form.merch_config.seasonal_mosaic}
                    maxLimit={MERCH_LIMIT_CAPS.seasonal_mosaic}
                    categories={categories ?? []}
                    categoryMap={categoryMap}
                    productMap={productMap}
                    onChange={(value) => updateMerchSection("seasonal_mosaic", value)}
                  />
                  <Separator />
                  <MerchSectionEditor
                    title="Featured"
                    description="Primary featured products for this tab."
                    value={form.merch_config.featured}
                    maxLimit={MERCH_LIMIT_CAPS.featured}
                    categories={categories ?? []}
                    categoryMap={categoryMap}
                    productMap={productMap}
                    onChange={(value) => updateMerchSection("featured", value)}
                  />
                  <Separator />
                  <MerchSectionEditor
                    title="Deals"
                    description="Discount-led products and sale inventory."
                    value={form.merch_config.deals}
                    maxLimit={MERCH_LIMIT_CAPS.deals}
                    categories={categories ?? []}
                    categoryMap={categoryMap}
                    productMap={productMap}
                    onChange={(value) => updateMerchSection("deals", value)}
                  />
                  <Separator />
                  <MerchSectionEditor
                    title="Trending"
                    description="Fast-moving and high-intent items."
                    value={form.merch_config.trending}
                    maxLimit={MERCH_LIMIT_CAPS.trending}
                    categories={categories ?? []}
                    categoryMap={categoryMap}
                    productMap={productMap}
                    onChange={(value) => updateMerchSection("trending", value)}
                  />

                  <Separator />

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold">Category Rails</h3>
                        <p className="text-sm text-muted-foreground">
                          Add reusable product grids for the lower half of the home screen.
                        </p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={addRail}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Rail
                      </Button>
                    </div>

                    <div className="space-y-4">
                      {form.merch_config.category_rails.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border/80 p-4 text-sm text-muted-foreground">
                          No category rails yet. Add one to drive lower product sections for this tab.
                        </div>
                      ) : (
                        form.merch_config.category_rails.map((rail, index) => (
                          <CategoryRailEditor
                            key={`${rail.category_id}-${index}`}
                            index={index}
                            value={rail}
                            maxLimit={CATEGORY_RAIL_LIMIT_CAP}
                            categories={categories ?? []}
                            categoryMap={categoryMap}
                            productMap={productMap}
                            onChange={(value) => updateRail(index, value)}
                            onRemove={() => removeRail(index)}
                          />
                        ))
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                isSaving || !form.label.trim() || !slugifyTabKey(form.key || form.label)
              }
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingTab ? "Save Changes" : "Create Theme Tab"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ThemeLinkPill({
  label,
  theme,
}: {
  label: string
  theme: ThemeTab["theme_a"]
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Badge variant="outline" className="font-mono">
        {label}
      </Badge>
      {theme ? (
        <span className="truncate">{theme.name}</span>
      ) : (
        <span className="text-muted-foreground">Unlinked</span>
      )}
    </div>
  )
}

function ThemeLinkSummaryCard({
  label,
  theme,
}: {
  label: string
  theme: ThemeTab["theme_a"]
}) {
  return (
    <div className="rounded-xl border border-border/80 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        {theme ? (
          <Badge variant="secondary">{theme.status}</Badge>
        ) : (
          <Badge variant="outline">Unlinked</Badge>
        )}
      </div>
      <p className="mt-2 text-sm">
        {theme?.name ?? "Select this tab inside the Theme Editor to attach a theme variant."}
      </p>
      {theme?.updated_at && (
        <p className="mt-1 text-xs text-muted-foreground">
          Updated {new Date(theme.updated_at).toLocaleString()}
        </p>
      )}
    </div>
  )
}

function MerchSectionEditor({
  title,
  description,
  value,
  maxLimit,
  categories,
  categoryMap,
  productMap,
  onChange,
}: {
  title: string
  description: string
  value: MerchSectionConfig
  maxLimit: number
  categories: Category[]
  categoryMap: Map<string, string>
  productMap: Map<string, Product>
  onChange: (nextValue: MerchSectionConfig) => void
}) {
  const [selectedCategoryToAdd, setSelectedCategoryToAdd] = useState<string>("")

  const addCategory = () => {
    if (!selectedCategoryToAdd || value.category_ids.includes(selectedCategoryToAdd)) {
      return
    }
    onChange({
      ...value,
      category_ids: [...value.category_ids, selectedCategoryToAdd],
    })
    setSelectedCategoryToAdd("")
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="w-28 space-y-2">
          <Label>Limit</Label>
          <Input
            type="number"
            min={1}
            max={maxLimit}
            value={value.limit}
            onChange={(event) =>
              onChange({
                ...value,
                limit: Math.max(1, Math.min(maxLimit, Number(event.target.value) || 1)),
              })
            }
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Category Fill</Label>
        <div className="flex flex-wrap gap-2">
          {value.category_ids.map((categoryId) => (
            <Badge key={categoryId} variant="secondary" className="gap-2">
              {categoryMap.get(categoryId) ?? categoryId}
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...value,
                    category_ids: value.category_ids.filter((id) => id !== categoryId),
                  })
                }
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Select
            value={selectedCategoryToAdd}
            onValueChange={setSelectedCategoryToAdd}
          >
            <SelectTrigger>
              <SelectValue placeholder="Add category fill source" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" onClick={addCategory}>
            Add
          </Button>
        </div>
      </div>

      <ProductOrderEditor
        label="Manual Products"
        description="These products appear first in the saved order."
        productIds={value.product_ids}
        productMap={productMap}
        onChange={(productIds) =>
          onChange({
            ...value,
            product_ids: productIds,
          })
        }
      />
    </div>
  )
}

function CategoryRailEditor({
  index,
  value,
  maxLimit,
  categories,
  categoryMap,
  productMap,
  onChange,
  onRemove,
}: {
  index: number
  value: CategoryRailConfig
  maxLimit: number
  categories: Category[]
  categoryMap: Map<string, string>
  productMap: Map<string, Product>
  onChange: (value: CategoryRailConfig) => void
  onRemove: () => void
}) {
  return (
    <Card className="border-border/70">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-sm">Rail {index + 1}</CardTitle>
            <CardDescription>
              Configure one lower-home product grid.
            </CardDescription>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
            <Trash2 className="mr-2 h-4 w-4" />
            Remove
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-[1fr_220px_120px]">
          <div className="space-y-2">
            <Label>Title Override</Label>
            <Input
              value={value.title ?? ""}
              onChange={(event) =>
                onChange({
                  ...value,
                  title: event.target.value || null,
                })
              }
              placeholder="Leave empty to use category name"
            />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={value.category_id}
              onValueChange={(categoryId) =>
                onChange({
                  ...value,
                  category_id: categoryId,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Limit</Label>
            <Input
              type="number"
              min={1}
              max={maxLimit}
              value={value.limit}
              onChange={(event) =>
                onChange({
                  ...value,
                  limit: Math.max(1, Math.min(maxLimit, Number(event.target.value) || 1)),
                })
              }
            />
          </div>
        </div>

        {value.category_id ? (
          <Badge variant="outline">
            Fill source: {categoryMap.get(value.category_id) ?? value.category_id}
          </Badge>
        ) : (
          <p className="text-sm text-muted-foreground">
            Select a category to enable category-based fill after manual products.
          </p>
        )}

        <ProductOrderEditor
          label="Manual Products"
          description="Saved order is respected before category-fill products are added."
          productIds={value.product_ids}
          productMap={productMap}
          onChange={(productIds) =>
            onChange({
              ...value,
              product_ids: productIds,
            })
          }
        />
      </CardContent>
    </Card>
  )
}

function ProductOrderEditor({
  label,
  description,
  productIds,
  productMap,
  onChange,
}: {
  label: string
  description: string
  productIds: string[]
  productMap: Map<string, Product>
  onChange: (productIds: string[]) => void
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label>{label}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <ProductSearchPicker
        productIds={productIds}
        onAdd={(productId) => {
          if (productIds.includes(productId)) return
          onChange([...productIds, productId])
        }}
      />

      {productIds.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/80 p-4 text-sm text-muted-foreground">
          No manual products selected yet.
        </div>
      ) : (
        <div className="space-y-2">
          {productIds.map((productId, index) => {
            const product = productMap.get(productId)
            return (
              <div
                key={`${productId}-${index}`}
                className="flex items-center gap-3 rounded-xl border border-border/80 p-3"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/40">
                  <PackageSearch className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {product?.name ?? productId}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {product?.category_name ?? "Product ID"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={index === 0}
                    onClick={() => onChange(moveItem(productIds, index, index - 1))}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={index === productIds.length - 1}
                    onClick={() => onChange(moveItem(productIds, index, index + 1))}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() =>
                      onChange(productIds.filter((id) => id !== productId))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ProductSearchPicker({
  productIds,
  onAdd,
}: {
  productIds: string[]
  onAdd: (productId: string) => void
}) {
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search, 250)
  const shouldSearch = debouncedSearch.trim().length >= 2

  const { data, isFetching } = useQuery({
    queryKey: ["theme-tab-product-search", debouncedSearch],
    queryFn: () =>
      getProducts({
        page: 1,
        limit: 8,
        search: debouncedSearch,
        status: "active",
      }),
    enabled: shouldSearch,
    staleTime: 30_000,
  })

  return (
    <div className="space-y-2">
      <Label>Search Products</Label>
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search by product name, SKU, or barcode"
      />
      {shouldSearch && (
        <div className="rounded-xl border border-border/80 bg-background">
          {isFetching ? (
            <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching products...
            </div>
          ) : data?.products?.length ? (
            <div className="divide-y">
              {data.products.map((product) => {
                const alreadyAdded = productIds.includes(product.id)
                return (
                  <button
                    key={product.id}
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={alreadyAdded}
                    onClick={() => {
                      onAdd(product.id)
                      setSearch("")
                    }}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{product.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {product.category_name ?? "Uncategorized"}
                      </p>
                    </div>
                    {alreadyAdded ? (
                      <Badge variant="secondary">Added</Badge>
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    )}
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="p-3 text-sm text-muted-foreground">
              No active products matched this search.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
