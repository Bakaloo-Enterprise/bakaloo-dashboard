"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { CheckCircle2, FolderOpen, Hash, Loader2, MousePointerClick, Search, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { Product } from "@/types"
import { getProducts } from "@/services/products.service"
import { useDebounce } from "@/hooks/useDebounce"
import type {
  MerchBinding,
  UpdateSectionMerchPayload,
} from "@/types/theme.types"
import CategoryTree from "./CategoryTree"

interface ProductSourceConfigProps {
  merchBinding: MerchBinding | null
  onBindingChange: (binding: UpdateSectionMerchPayload) => void
}

// Backend caps every manifest section (product_carousel,
// category_product_grid, trending_products, arched_product_showcase) at 200
// products — see HOME_MANIFEST_SECTION_CAP in public.controller.js and the
// merch_binding.limit maximum in sections.schema.js. This is the single
// product-limit control for these sections; keep all three in lock-step.
const MOBILE_HOME_LIMIT_MAX = 200

type SourceMode = "category" | "tag" | "manual"

const SOURCE_OPTIONS: Array<{
  value: SourceMode
  label: string
  icon: React.ComponentType<{ className?: string }>
  hint: string
}> = [
  {
    value: "category",
    label: "By Category",
    icon: FolderOpen,
    hint: "Fill products from selected categories",
  },
  {
    value: "tag",
    label: "By Tag",
    icon: Hash,
    hint: "Use product tags as source",
  },
  {
    value: "manual",
    label: "Manual",
    icon: MousePointerClick,
    hint: "Hand-pick specific products",
  },
]

function normalizeMerchBinding(binding: MerchBinding | null) {
  return {
    source: (binding?.source ?? "category") as SourceMode,
    category_ids: binding?.category_ids ?? [],
    product_ids: binding?.product_ids ?? [],
    tags: binding?.tags ?? [],
    limit: binding?.limit ?? 12,
  }
}

function buildSummary(binding: ReturnType<typeof normalizeMerchBinding>) {
  switch (binding.source) {
    case "tag":
      return `${binding.limit} products · ${binding.tags.length} tag${binding.tags.length !== 1 ? "s" : ""}`
    case "manual":
      return `${binding.product_ids.length} product${binding.product_ids.length !== 1 ? "s" : ""} selected`
    case "category":
    default:
      return `${binding.limit} products · ${binding.category_ids.length} categor${binding.category_ids.length !== 1 ? "ies" : "y"}`
  }
}

export default function ProductSourceConfig({
  merchBinding,
  onBindingChange,
}: ProductSourceConfigProps) {
  const binding = useMemo(() => normalizeMerchBinding(merchBinding), [merchBinding])
  const [tagInput, setTagInput] = useState(binding.tags.join(", "))
  const [productSearch, setProductSearch] = useState("")
  const debouncedSearch = useDebounce(productSearch, 250)
  const shouldSearch = debouncedSearch.trim().length >= 2
  const [knownProducts, setKnownProducts] = useState<Record<string, Product>>({})

  const { data, isFetching } = useQuery({
    queryKey: ["builder", "product-search", debouncedSearch],
    queryFn: () =>
      getProducts({ page: 1, limit: 8, search: debouncedSearch, status: "active" }),
    enabled: shouldSearch,
    staleTime: 30_000,
  })

  useEffect(() => {
    setTagInput(binding.tags.join(", "))
  }, [binding.tags])

  useEffect(() => {
    if (!data?.products?.length) return
    setKnownProducts((current) => {
      const next = { ...current }
      data.products.forEach((p) => {
        next[p.id] = p
      })
      return next
    })
  }, [data?.products])

  const patchBinding = (patch: UpdateSectionMerchPayload) => {
    onBindingChange({
      category_ids: binding.category_ids,
      product_ids: binding.product_ids,
      tags: binding.tags,
      limit: binding.limit,
      source: binding.source,
      ...patch,
    })
  }

  const selectedProducts = binding.product_ids.map((id) => ({
    id,
    name: knownProducts[id]?.name ?? id,
  }))

  return (
    <div className="space-y-4">
      {/* ── Source selector — horizontal segmented control ── */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          Product Source
        </Label>

        {/* Segmented control row */}
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
          {SOURCE_OPTIONS.map((opt) => {
            const isActive = binding.source === opt.value
            const OptionIcon = opt.icon
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => patchBinding({ source: opt.value })}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-all duration-150",
                  isActive
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                )}
                aria-pressed={isActive}
                title={opt.hint}
              >
                <OptionIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">{opt.label}</span>
              </button>
            )
          })}
        </div>

        {/* Hint text for current mode */}
        <p className="text-[11px] text-slate-400">
          {SOURCE_OPTIONS.find((o) => o.value === binding.source)?.hint}
        </p>
      </div>

      {/* ── Category mode ── */}
      {binding.source === "category" ? (
        <CategoryTree
          selectedIds={binding.category_ids}
          onSelect={(categoryId) =>
            patchBinding({
              category_ids: binding.category_ids.includes(categoryId)
                ? binding.category_ids.filter((id) => id !== categoryId)
                : [...binding.category_ids, categoryId],
            })
          }
        />
      ) : null}

      {/* ── Tag mode ── */}
      {binding.source === "tag" ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
          <div className="space-y-1.5">
            <Label htmlFor="builder-tag-input" className="text-xs">
              Tags <span className="text-slate-400">(comma-separated)</span>
            </Label>
            <Input
              id="builder-tag-input"
              value={tagInput}
              onChange={(e) => {
                const next = e.target.value
                setTagInput(next)
                patchBinding({
                  tags: next
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                })
              }}
              placeholder="festive, diwali, sale"
              className="text-sm"
            />
          </div>

          {binding.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {binding.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="gap-1 rounded-full pl-2 pr-1 text-[11px]"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() =>
                      patchBinding({
                        tags: binding.tags.filter((t) => t !== tag),
                      })
                    }
                    aria-label={`Remove tag ${tag}`}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* ── Manual pick mode ── */}
      {binding.source === "manual" ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
          {/* Search */}
          <div className="space-y-1.5">
            <Label htmlFor="manual-product-search" className="text-xs">
              Search products
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                id="manual-product-search"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Name, SKU, barcode…"
                className="pl-8 text-sm"
              />
            </div>
          </div>

          {/* Results */}
          {shouldSearch ? (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              {isFetching ? (
                <div className="flex items-center gap-2 p-2.5 text-xs text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Searching…
                </div>
              ) : data?.products?.length ? (
                <div className="divide-y divide-slate-100">
                  {data.products.map((product) => {
                    const alreadyAdded = binding.product_ids.includes(product.id)
                    return (
                      <button
                        key={product.id}
                        type="button"
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={alreadyAdded}
                        onClick={() => {
                          patchBinding({
                            product_ids: [...binding.product_ids, product.id],
                          })
                          setProductSearch("")
                        }}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">
                            {product.name}
                          </p>
                          <p className="truncate text-slate-400">
                            {product.category_name ?? "Uncategorized"}
                          </p>
                        </div>
                        {alreadyAdded ? (
                          <Badge variant="secondary" className="shrink-0 text-[10px]">
                            Added
                          </Badge>
                        ) : (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                        )}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p className="p-2.5 text-xs text-slate-500">
                  No products matched.
                </p>
              )}
            </div>
          ) : null}

          {/* Selected products */}
          {selectedProducts.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {selectedProducts.map((p) => (
                <Badge
                  key={p.id}
                  variant="secondary"
                  className="max-w-[160px] gap-1 rounded-full pl-2 pr-1 text-[11px]"
                >
                  <span className="truncate">{p.name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      patchBinding({
                        product_ids: binding.product_ids.filter(
                          (id) => id !== p.id
                        ),
                      })
                    }
                    aria-label={`Remove ${p.name}`}
                  >
                    <X className="h-2.5 w-2.5 shrink-0" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            !shouldSearch && (
              <p className="text-[11px] text-slate-400">
                No products selected. Search above to add products.
              </p>
            )
          )}
        </div>
      ) : null}

      {/* ── Product limit ── */}
      <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs">Product limit</Label>
          <span className="text-xs font-semibold tabular-nums text-slate-600">
            {binding.limit}
          </span>
        </div>
        <input
          type="range"
          min={4}
          max={MOBILE_HOME_LIMIT_MAX}
          step={1}
          value={Math.min(binding.limit, MOBILE_HOME_LIMIT_MAX)}
          onChange={(e) => patchBinding({ limit: Number(e.target.value) || 12 })}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-violet-600"
          aria-label="Product limit"
        />
        <p className="text-[11px] text-slate-400">{buildSummary(binding)}</p>
      </div>
    </div>
  )
}
