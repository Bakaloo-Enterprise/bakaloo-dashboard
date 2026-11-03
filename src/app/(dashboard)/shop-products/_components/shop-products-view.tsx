"use client"

/**
 * Shop_Products view shell — task 12.5 of the multi-vendor dashboard.
 *
 * The Shop_Products inventory surface is exposed through two entry points:
 *   - The standalone `/shop-products` page (Section 8) for the dedicated
 *     inventory route owned by Shop_Admin, Shop_Manager, and Shop_Staff
 *     vendors plus the Super_Admin who pivots into a single shop via the
 *     topbar Shop_Switcher.
 *   - The "Shop Products" tab inside `/products` (Section 12.5), which the
 *     Super_Admin uses to compare master-catalog records against per-shop
 *     inventory without leaving the products surface.
 *
 * Both entry points render the exact same UI. To avoid forking the page
 * body, the original page's render tree was extracted into this component.
 * The standalone page is now a thin wrapper that renders
 * `<ShopProductsView />` with its default props; the Master_Catalog vs
 * Shop_Products tabs in `/products/page.tsx` mount the same component with
 * `embedded` set so the inner page header is suppressed (the parent tabs
 * shell already provides one).
 *
 * Functional behavior is preserved verbatim from the standalone page:
 *   - Empty state via `<EmptyShopState />` when `mode !== "STORE_MODE"`,
 *     and the underlying TanStack Query is disabled in that branch
 *     (Req 7.11, design §11).
 *   - Filters: availability (all / available / sold out), low-stock
 *     (all / at-or-below threshold), category, and a free-text search by
 *     name or SKU debounced at 300 ms (Req 7.3, 14.3).
 *   - Header chip showing `Low stock: <n>` computed from the currently
 *     visible page rows (Req 7.6).
 *   - Twelve columns rendered through `<DataList />` so the table collapses
 *     to stacked cards below md while preserving every column value
 *     (Req 7.2, 12.3, design §13).
 *   - "Add product" CTA visible only with `shop-products.write`; opens the
 *     two-step add dialog from task 8.5 (Req 7.4).
 *
 * Requirements: 7.1, 7.2, 7.3, 7.6, 7.7, 7.11, 10.7, 12.3, 14.2, 14.3
 */

import { useMemo, useState } from "react"
import { Loader2, Plus, Search } from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { DataList, type DataListColumn } from "@/components/shared/data-list"
import { EmptyShopState } from "@/components/shared/empty-shop-state"
import { ErrorBlock } from "@/components/shared/error-block"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useCategories } from "@/hooks/useCategories"
import { useDebounce } from "@/hooks/useDebounce"
import { useRouteRBAC } from "@/hooks/useRBAC"
import { useIsSuperAdmin, useShopContext } from "@/hooks/useShopContext"
import { useShopProductsList } from "@/hooks/useShopProducts"
import { t } from "@/lib/i18n"
import type { ShopProductsListParams } from "@/services/shop-products.service"
import type { ShopProduct } from "@/types"

import { BulkImportButton } from "@/components/erp/skin/BulkImportDialog"
import { AddProductDialog } from "./add-product-dialog"
import {
  ProductActions,
  ProductImage,
  ProductIsAvailable,
  ProductIsFeatured,
  ProductLowStockThreshold,
  ProductMaxOrderQty,
  ProductName,
  ProductPrice,
  ProductSalePrice,
  ProductSku,
  ProductSoldOutAt,
  ProductStock,
} from "./product-row"
import { useShopProductLiveUpdates } from "./use-shop-product-live-updates"

// ─────────────────────────────────────────────────────────────────────────────
// Filter primitives
// ─────────────────────────────────────────────────────────────────────────────

/** Availability filter options. `"all"` means "send no `is_available` param". */
type AvailabilityFilter = "all" | "available" | "sold_out"

/** Low-stock filter options. `"at_or_below"` maps to `low_stock=true`. */
type LowStockFilter = "all" | "at_or_below"

/** Sentinel category value meaning "no category filter". */
const ALL_CATEGORIES = "all"

/** Page-size constant — matches the canonical 20 rows/page used across the
 *  dashboard (Req 7.1). The service further caps `limit` at 100. */
const PAGE_SIZE = 20

// ─────────────────────────────────────────────────────────────────────────────
// View component
// ─────────────────────────────────────────────────────────────────────────────

export interface ShopProductsViewProps {
  /**
   * When true, the view suppresses its own `<PageHeader />` so a parent
   * surface (e.g. the Master_Catalog vs Shop_Products tabs in `/products`)
   * can supply the page title without a duplicate heading.
   *
   * The low-stock chip and the "Add product" CTA are still rendered above
   * the filters card so they remain visible in embedded mode — they are
   * action affordances, not headings, and parents never re-render them.
   */
  embedded?: boolean
}

export function ShopProductsView({ embedded = false }: ShopProductsViewProps) {
  // ─── Shop context gating ─────────────────────────────────────────────────
  // Req 7.11: render `<EmptyShopState />` when no single shop is active.
  // The list query's `enabled` flag also short-circuits in this branch (see
  // `useShopProductsList`), so no request is fired against the backend.
  const { mode } = useShopContext()
  const isSuperAdmin = useIsSuperAdmin()

  // ─── RBAC ────────────────────────────────────────────────────────────────
  // `canWrite` is true when the user holds `shop-products.write`; gates the
  // "Add product" CTA per Req 7.4.
  const { canWrite } = useRouteRBAC("/shop-products")

  // ─── Filter state ────────────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState("")
  const [availability, setAvailability] = useState<AvailabilityFilter>("all")
  const [lowStock, setLowStock] = useState<LowStockFilter>("all")
  const [category, setCategory] = useState<string>(ALL_CATEGORIES)
  const [page, setPage] = useState(1)

  // 300ms debounce on the free-text search field (Req 7.3, 14.3). The view
  // resets to page 1 whenever a filter changes (see the inline handlers).
  const debouncedSearch = useDebounce(searchInput, 300)

  // ─── Add-product dialog (task 8.5) ───────────────────────────────────────
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

  // ─── Categories for the category filter ──────────────────────────────────
  // Always fetched (the catalog is global and not shop-scoped) so the
  // dropdown is populated even before a shop is picked. Cheap call; cached
  // by the existing `useCategories` hook.
  const { data: categories } = useCategories()

  // ─── Build the list query params ─────────────────────────────────────────
  const filters = useMemo<ShopProductsListParams>(() => {
    const params: ShopProductsListParams = { page, limit: PAGE_SIZE }
    const trimmed = debouncedSearch.trim()
    if (trimmed.length > 0) params.search = trimmed
    if (availability === "available") params.is_available = true
    if (availability === "sold_out") params.is_available = false
    if (lowStock === "at_or_below") params.low_stock = true
    if (category !== ALL_CATEGORIES) params.category = category
    return params
  }, [page, debouncedSearch, availability, lowStock, category])

  // ─── List query ──────────────────────────────────────────────────────────
  // Disabled outside `SINGLE_SHOP` mode (Req 7.11) — the empty state below
  // short-circuits the render before this query is read.
  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useShopProductsList(filters)

  // ─── Socket-driven live updates (task 8.8) ───────────────────────────────
  // Subscribes to `stock-out` / `low-stock` events scoped to the active
  // shop and applies surgical in-place patches to every cached page so the
  // current pagination/ordering is preserved (Req 7.8, 11.3, 11.4, 14.5).
  // The hook itself short-circuits when `mode !== "STORE_MODE"`, but it
  // must be mounted unconditionally above the early-return below to keep
  // hook ordering stable across renders.
  useShopProductLiveUpdates()

  const rows: ShopProduct[] = data?.items ?? []

  // ─── Header chip — low-stock count of currently visible rows (Req 7.6) ──
  // Counts rows where stock is at or below the threshold (and includes 0,
  // since "at or below" is inclusive).
  const visibleLowStockCount = useMemo(
    () =>
      rows.filter((r) => r.stock_quantity <= r.low_stock_threshold).length,
    [rows],
  )

  // ─── Columns (12 columns per Req 7.2) ────────────────────────────────────
  // Cell renderers come from `./product-row.tsx` (task 8.7). The column
  // array re-renders whenever `canWrite` flips so the actions cell picks
  // up the new permission state without a page reload.
  const columns = useMemo<DataListColumn<ShopProduct>[]>(
    () => [
      {
        id: "image",
        header: t("shopProducts.list.column.image"),
        cell: (row) => <ProductImage product={row} />,
      },
      {
        id: "name",
        header: t("shopProducts.list.column.name"),
        cell: (row) => <ProductName product={row} />,
      },
      {
        id: "sku",
        header: t("shopProducts.list.column.sku"),
        cell: (row) => <ProductSku product={row} />,
      },
      {
        id: "category",
        header: "Category",
        cell: (row) => (
          <span className="text-xs text-muted-foreground">
            {row.product?.category_name ?? "—"}
          </span>
        ),
      },
      {
        id: "price",
        header: t("shopProducts.list.column.price"),
        cell: (row) => <ProductPrice product={row} />,
      },
      {
        id: "salePrice",
        header: t("shopProducts.list.column.salePrice"),
        cell: (row) => <ProductSalePrice product={row} />,
      },
      {
        id: "stockQuantity",
        header: t("shopProducts.list.column.stockQuantity"),
        cell: (row) => <ProductStock product={row} />,
      },
      {
        id: "lowStockThreshold",
        header: t("shopProducts.list.column.lowStockThreshold"),
        cell: (row) => <ProductLowStockThreshold product={row} />,
      },
      {
        id: "maxOrderQty",
        header: t("shopProducts.list.column.maxOrderQty"),
        cell: (row) => <ProductMaxOrderQty product={row} />,
      },
      {
        id: "isAvailable",
        header: t("shopProducts.list.column.isAvailable"),
        cell: (row) => <ProductIsAvailable product={row} />,
      },
      {
        id: "isFeatured",
        header: t("shopProducts.list.column.isFeatured"),
        cell: (row) => <ProductIsFeatured product={row} />,
      },
      {
        id: "soldOutAt",
        header: t("shopProducts.list.column.soldOutAt"),
        cell: (row) => <ProductSoldOutAt product={row} />,
      },
      {
        id: "actions",
        header: t("shopProducts.list.column.actions"),
        // Pass `canWrite` explicitly so each row reuses the page-level
        // RBAC lookup rather than re-resolving it per cell.
        cell: (row) => <ProductActions product={row} canWrite={canWrite} />,
      },
    ],
    [canWrite],
  )

  // ─── Empty-shop short-circuit (Req 7.11) ─────────────────────────────────
  // Rendered before the data hooks are read so no list request fires.
  if (mode !== "STORE_MODE") {
    return (
      <div className="space-y-6">
        {/* In embedded mode the parent surface owns the page title; suppress
            the inner header so the tab content does not duplicate the
            parent's H1. */}
        {!embedded && (
          <PageHeader
            title={t("shopProducts.list.title")}
            subtitle={t("emptyShop.description")}
          />
        )}
        <EmptyShopState isSuperAdmin={isSuperAdmin} />
      </div>
    )
  }

  // ─── Header actions — low-stock chip + Add CTA ───────────────────────────
  // Both affordances live in the same flex container so they can be slotted
  // into either a dedicated `<PageHeader />` (standalone mode) or an inline
  // toolbar above the filters card (embedded mode) without duplicating
  // markup or losing the trailing-edge alignment.
  const headerActions = (
    <div className="flex items-center gap-2">
      {/* Req 7.6 — header chip displays the visible-rows low-stock count.
          Always rendered (including 0) so users get a stable
          "this many items need attention" affordance per design §8. */}
      <Badge
        variant={visibleLowStockCount > 0 ? "destructive" : "secondary"}
        data-testid="low-stock-chip"
      >
        {t("shopProducts.list.lowStockHeader", {
          count: visibleLowStockCount,
        })}
      </Badge>

      {canWrite ? <BulkImportButton /> : null}

      {canWrite ? (
        <Button
          size="sm"
          onClick={() => setIsAddDialogOpen(true)}
          data-testid="add-product-cta"
        >
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {t("shopProducts.list.addButton")}
        </Button>
      ) : null}
    </div>
  )

  // ─── Standard list shell ─────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header row: title + low-stock chip + Add CTA (write only).
          Embedded mode suppresses the title and renders only the trailing
          affordances; the parent surface (e.g. `/products` tabs) supplies
          the page title. */}
      {embedded ? (
        <div className="flex items-center justify-end">{headerActions}</div>
      ) : (
        <PageHeader
          title={t("shopProducts.list.title")}
          subtitle={
            data?.pagination ? `${data.pagination.total} total` : undefined
          }
        >
          {headerActions}
        </PageHeader>
      )}

      {/* Filters row */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Free-text search by name or SKU (Req 7.3, debounced 300ms) */}
          <div className="relative min-w-[200px] max-w-sm flex-1">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              aria-label={t("shopProducts.list.searchPlaceholder")}
              placeholder={t("shopProducts.list.searchPlaceholder")}
              className="h-9 pl-9"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value)
                setPage(1)
              }}
            />
          </div>

          {/* Availability filter */}
          <Select
            value={availability}
            onValueChange={(v) => {
              setAvailability(v as AvailabilityFilter)
              setPage(1)
            }}
          >
            <SelectTrigger
              className="h-9 w-[160px]"
              aria-label={t("shopProducts.list.filter.availability")}
            >
              <SelectValue
                placeholder={t("shopProducts.list.filter.availability")}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("shopProducts.list.filter.availability.all")}
              </SelectItem>
              <SelectItem value="available">
                {t("shopProducts.list.filter.availability.available")}
              </SelectItem>
              <SelectItem value="sold_out">
                {t("shopProducts.list.filter.availability.soldOut")}
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Low-stock filter */}
          <Select
            value={lowStock}
            onValueChange={(v) => {
              setLowStock(v as LowStockFilter)
              setPage(1)
            }}
          >
            <SelectTrigger
              className="h-9 w-[200px]"
              aria-label={t("shopProducts.list.filter.lowStock")}
            >
              <SelectValue
                placeholder={t("shopProducts.list.filter.lowStock")}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("shopProducts.list.filter.lowStock.all")}
              </SelectItem>
              <SelectItem value="at_or_below">
                {t("shopProducts.list.filter.lowStock.atOrBelow")}
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Category filter */}
          <Select
            value={category}
            onValueChange={(v) => {
              setCategory(v)
              setPage(1)
            }}
          >
            <SelectTrigger
              className="h-9 w-[180px]"
              aria-label={t("shopProducts.list.filter.category")}
            >
              <SelectValue
                placeholder={t("shopProducts.list.filter.category")}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CATEGORIES}>
                {t("shopProducts.list.filter.availability.all")}
              </SelectItem>
              {categories?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Subtle background-fetch indicator so users get feedback when
              `placeholderData: (prev) => prev` keeps the previous page on
              screen during pagination/filter transitions. */}
          {isFetching && !isLoading ? (
            <Loader2
              className="ml-auto h-4 w-4 animate-spin text-muted-foreground"
              aria-label="Loading"
            />
          ) : null}
        </div>
      </Card>

      {/* Content */}
      {isError ? (
        <ErrorBlock
          message={
            error instanceof Error ? error.message : t("errors.genericError")
          }
          onRetry={() => refetch()}
        />
      ) : isLoading ? (
        <ListSkeleton />
      ) : (
        <Card className="p-0 md:p-2">
          <DataList<ShopProduct>
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            emptyMessage={t("shopProducts.list.empty")}
          />
        </Card>
      )}

      {/* Pagination */}
      {data?.pagination && data.pagination.totalPages > 1 ? (
        <Pagination
          page={data.pagination.page}
          totalPages={data.pagination.totalPages}
          onChange={setPage}
        />
      ) : null}

      {/* Add-product dialog (task 8.5) — two-step Combobox + form. Mounted
          unconditionally so it can drive both open/close transitions; the
          parent gates the CTA on `shop-products.write` (Req 7.4). */}
      <AddProductDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton + pagination
// ─────────────────────────────────────────────────────────────────────────────

function ListSkeleton() {
  return (
    <Card className="p-4">
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-md" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="ml-auto h-4 w-16" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    </Card>
  )
}

interface PaginationProps {
  page: number
  totalPages: number
  onChange: (next: number) => void
}

/**
 * Minimal previous/next pagination. The shop-products view is the first
 * surface owned by this task; a richer pagination control lives in the
 * shared layout and can be swapped in once the canonical row component
 * is finalised.
 */
function Pagination({ page, totalPages, onChange }: PaginationProps) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onChange(Math.max(1, page - 1))}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onChange(Math.min(totalPages, page + 1))}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
