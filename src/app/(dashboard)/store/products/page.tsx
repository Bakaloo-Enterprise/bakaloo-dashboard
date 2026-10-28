"use client"

/**
 * Store Products — task 21.3
 * List, edit, manual create. "Add Product" flow: search master catalog → if match,
 * attach via existing endpoint; else open manual create form (uploads images via
 * existing upload service to obtain image_ids, then submits POST /shops/:shopId/products/manual).
 * Hide control if shop_products.create absent.
 */

import { useMemo, useState } from "react"
import { Loader2, Package, Plus, Search } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyShopState } from "@/components/shared/empty-shop-state"
import { ErrorBlock } from "@/components/shared/error-block"
import { PermissionGate } from "@/components/shared/PermissionGate"
import { useDebounce } from "@/hooks/useDebounce"
import { useIsSuperAdmin, useShopContext } from "@/hooks/useShopContext"
import {
  useShopProductsList,
  useSearchProductCatalog,
  useAddShopProduct,
} from "@/hooks/useShopProducts"
import { useUploadMultipleImages } from "@/hooks/useUploads"
import type { ShopProductsListParams } from "@/services/shop-products.service"
import type { Product, ShopProduct } from "@/types"
import { formatCurrency } from "@/lib/i18n"
import api from "@/lib/api"
import type { ApiResponse } from "@/types"

const PAGE_SIZE = 20

export default function StoreProductsPage() {
  const { activeShopId, mode } = useShopContext()
  const isSuperAdmin = useIsSuperAdmin()

  const [searchInput, setSearchInput] = useState("")
  const [page, setPage] = useState(1)
  const [showAddDialog, setShowAddDialog] = useState(false)

  const debouncedSearch = useDebounce(searchInput, 300)

  const filters = useMemo<ShopProductsListParams>(() => {
    const params: ShopProductsListParams = { page, limit: PAGE_SIZE }
    if (debouncedSearch.trim()) params.search = debouncedSearch.trim()
    return params
  }, [page, debouncedSearch])

  const { data, isLoading, isError, error, refetch, isFetching } = useShopProductsList(filters)

  if (mode !== "STORE_MODE") {
    return (
      <div className="space-y-6">
        <PageHeader title="Store Products" subtitle="Select a shop to manage products" />
        <EmptyShopState isSuperAdmin={isSuperAdmin} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Store Products"
        subtitle={data?.pagination ? `${data.pagination.total} products` : undefined}
      >
        <PermissionGate require="shop_products.create">
          <Button size="sm" onClick={() => setShowAddDialog(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Product
          </Button>
        </PermissionGate>
      </PageHeader>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="relative min-w-[200px] max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search products..."
              aria-label="Search products"
              className="h-9 pl-9"
              value={searchInput}
              onChange={(e) => { setSearchInput(e.target.value); setPage(1) }}
            />
          </div>
          {isFetching && !isLoading && <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </Card>

      {isError ? (
        <ErrorBlock message={error instanceof Error ? error.message : "Failed to load products"} onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : !data?.items?.length ? (
        <Card className="p-8 text-center text-muted-foreground">No products found</Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {data.pagination.page} of {data.pagination.totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= data.pagination.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}

      {showAddDialog && activeShopId && (
        <AddProductDialog shopId={activeShopId} onClose={() => setShowAddDialog(false)} />
      )}
    </div>
  )
}

function ProductCard({ product }: { product: ShopProduct }) {
  return (
    <Card className="p-4 flex gap-3">
      {product.product?.image_url ? (
        <img src={product.product.image_url} alt={product.product.name ?? ""} className="h-16 w-16 rounded-lg object-cover" />
      ) : (
        <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center">
          <Package className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{product.product?.name ?? "Unknown"}</p>
        <p className="text-xs text-muted-foreground">{product.product?.sku}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="font-semibold text-sm tabular-nums">{formatCurrency(product.price)}</span>
          {product.sale_price && <span className="text-xs text-green-600 tabular-nums">{formatCurrency(product.sale_price)}</span>}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant={product.stock_quantity <= product.low_stock_threshold ? "destructive" : "secondary"} className="text-xs">
            Stock: {product.stock_quantity}
          </Badge>
          {!product.is_available && <Badge variant="outline" className="text-xs">Unavailable</Badge>}
        </div>
      </div>
    </Card>
  )
}

function AddProductDialog({ shopId, onClose }: { shopId: string; onClose: () => void }) {
  const [step, setStep] = useState<"search" | "manual">("search")
  const [catalogSearch, setCatalogSearch] = useState("")
  const debouncedCatalog = useDebounce(catalogSearch, 300)
  const { data: catalogResults, isLoading: catalogLoading } = useSearchProductCatalog(debouncedCatalog)
  const addMutation = useAddShopProduct(shopId)

  const [manualName, setManualName] = useState("")
  const [manualSku, setManualSku] = useState("")
  const [manualPrice, setManualPrice] = useState("")
  const [manualStock, setManualStock] = useState("0")
  const [manualDescription, setManualDescription] = useState("")
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const uploadImages = useUploadMultipleImages("products")

  const handleAttachCatalog = (product: Product) => {
    addMutation.mutate(
      { product_id: product.id, price: product.price ?? undefined, stock_quantity: 0 },
      { onSuccess: () => { toast.success("Product added from catalog"); onClose() } },
    )
  }

  const handleManualCreate = async () => {
    if (!manualName.trim() || !manualPrice) return
    setIsSubmitting(true)
    try {
      let image_ids: string[] = []
      if (imageFiles.length > 0) {
        const uploaded = await uploadImages.mutateAsync(imageFiles)
        image_ids = uploaded.map((img) => img.publicId)
      }
      await api.post<ApiResponse<unknown>>(`/shops/${shopId}/products/manual`, {
        name: manualName.trim(),
        sku: manualSku.trim() || undefined,
        price: Number(manualPrice),
        stock_quantity: Number(manualStock) || 0,
        description: manualDescription.trim() || undefined,
        image_ids: image_ids.length > 0 ? image_ids : undefined,
      })
      toast.success("Product created manually")
      onClose()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to create product")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add Product</DialogTitle></DialogHeader>
        {step === "search" ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="catalog-search">Search Master Catalog</Label>
              <Input id="catalog-search" value={catalogSearch} onChange={(e) => setCatalogSearch(e.target.value)} placeholder="Type product name or SKU..." />
            </div>
            {catalogLoading && <Loader2 className="h-5 w-5 animate-spin mx-auto" />}
            {catalogResults && catalogResults.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {catalogResults.map((product) => (
                  <div key={product.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 cursor-pointer" onClick={() => handleAttachCatalog(product)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && handleAttachCatalog(product)}>
                    <div><p className="text-sm font-medium">{product.name}</p><p className="text-xs text-muted-foreground">{product.sku}</p></div>
                    <Button size="sm" variant="outline">Attach</Button>
                  </div>
                ))}
              </div>
            )}
            {debouncedCatalog.trim() && !catalogLoading && (!catalogResults || catalogResults.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">No catalog match found</p>
            )}
            <div className="border-t pt-4">
              <Button variant="outline" onClick={() => setStep("manual")} className="w-full gap-1.5"><Plus className="h-4 w-4" /> Create Manually</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div><Label htmlFor="manual-name">Product Name *</Label><Input id="manual-name" value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Product name" /></div>
            <div><Label htmlFor="manual-sku">SKU</Label><Input id="manual-sku" value={manualSku} onChange={(e) => setManualSku(e.target.value)} placeholder="SKU (optional)" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="manual-price">Price *</Label><Input id="manual-price" type="number" value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} placeholder="0.00" /></div>
              <div><Label htmlFor="manual-stock">Stock</Label><Input id="manual-stock" type="number" value={manualStock} onChange={(e) => setManualStock(e.target.value)} placeholder="0" /></div>
            </div>
            <div><Label htmlFor="manual-desc">Description</Label><Input id="manual-desc" value={manualDescription} onChange={(e) => setManualDescription(e.target.value)} placeholder="Optional description" /></div>
            <div><Label htmlFor="manual-images">Images</Label><Input id="manual-images" type="file" accept="image/*" multiple onChange={(e) => setImageFiles(Array.from(e.target.files ?? []))} />{imageFiles.length > 0 && <p className="text-xs text-muted-foreground mt-1">{imageFiles.length} file(s) selected</p>}</div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("search")}>Back</Button>
              <Button disabled={!manualName.trim() || !manualPrice || isSubmitting} onClick={handleManualCreate}>{isSubmitting ? "Creating..." : "Create Product"}</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
