"use client"

/**
 * HQ Products — task 21.4
 * Allows HQ users with shop_products.create to select target shop,
 * then use the same Add Product flow. Renders target shop name + branch_code
 * prominently in dialog title and page header.
 */

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Loader2, Plus, Store } from "lucide-react"
import { toast } from "sonner"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PageHeader } from "@/components/shared/PageHeader"
import { PermissionGate } from "@/components/shared/PermissionGate"
import { useDebounce } from "@/hooks/useDebounce"
import { useIsSuperAdmin } from "@/hooks/useShopContext"
import {
  useSearchProductCatalog,
  useAddShopProduct,
} from "@/hooks/useShopProducts"
import { useUploadMultipleImages } from "@/hooks/useUploads"
import type { Product } from "@/types"
import api from "@/lib/api"
import type { ApiResponse } from "@/types"

interface ShopOption {
  id: string
  name: string
  branch_code: string
}

export default function HQProductsPage() {
  const isSuperAdmin = useIsSuperAdmin()
  const [selectedShop, setSelectedShop] = useState<ShopOption | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)

  const { data: shops, isLoading: shopsLoading } = useQuery({
    queryKey: ["hq-shops-list"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<{ items: ShopOption[] }>>("/shops", { params: { limit: 100 } })
      return data.data.items ?? []
    },
    enabled: isSuperAdmin,
    staleTime: 60_000,
  })

  if (!isSuperAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader title="HQ Products" subtitle="Super Admin access required" />
        <Card className="p-8 text-center text-muted-foreground">You need Super Admin access to manage HQ products.</Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="HQ Products" subtitle={selectedShop ? `Target: ${selectedShop.name} [${selectedShop.branch_code}]` : "Select a target shop"}>
        <PermissionGate require="shop_products.create">
          <Button size="sm" onClick={() => setShowAddDialog(true)} disabled={!selectedShop} className="gap-1.5"><Plus className="h-4 w-4" /> Add Product to Shop</Button>
        </PermissionGate>
      </PageHeader>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <Store className="h-5 w-5 text-muted-foreground" />
          <Label htmlFor="target-shop" className="whitespace-nowrap font-medium">Target Shop:</Label>
          {shopsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
            <Select value={selectedShop?.id ?? ""} onValueChange={(id) => setSelectedShop(shops?.find((s) => s.id === id) ?? null)}>
              <SelectTrigger className="w-[300px]" id="target-shop" aria-label="Select target shop"><SelectValue placeholder="Select a shop..." /></SelectTrigger>
              <SelectContent>{shops?.map((shop) => <SelectItem key={shop.id} value={shop.id}>{shop.name} [{shop.branch_code}]</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>
        {selectedShop && <p className="mt-2 text-sm font-semibold text-primary">Adding products to: {selectedShop.name} — {selectedShop.branch_code}</p>}
      </Card>

      {!selectedShop && <Card className="p-8 text-center text-muted-foreground">Select a target shop above to add products</Card>}
      {showAddDialog && selectedShop && <HQAddProductDialog shop={selectedShop} onClose={() => setShowAddDialog(false)} />}
    </div>
  )
}

function HQAddProductDialog({ shop, onClose }: { shop: ShopOption; onClose: () => void }) {
  const [step, setStep] = useState<"search" | "manual">("search")
  const [catalogSearch, setCatalogSearch] = useState("")
  const debouncedCatalog = useDebounce(catalogSearch, 300)
  const { data: catalogResults, isLoading: catalogLoading } = useSearchProductCatalog(debouncedCatalog)
  const addMutation = useAddShopProduct(shop.id)
  const [manualName, setManualName] = useState("")
  const [manualSku, setManualSku] = useState("")
  const [manualPrice, setManualPrice] = useState("")
  const [manualStock, setManualStock] = useState("0")
  const [manualDescription, setManualDescription] = useState("")
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const uploadImages = useUploadMultipleImages("products")

  const handleAttachCatalog = (product: Product) => {
    addMutation.mutate({ product_id: product.id, price: product.price ?? undefined, stock_quantity: 0 }, { onSuccess: () => { toast.success(`Product added to ${shop.name}`); onClose() } })
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
      await api.post<ApiResponse<unknown>>(`/shops/${shop.id}/products/manual`, { name: manualName.trim(), sku: manualSku.trim() || undefined, price: Number(manualPrice), stock_quantity: Number(manualStock) || 0, description: manualDescription.trim() || undefined, image_ids: image_ids.length > 0 ? image_ids : undefined })
      toast.success(`Product created for ${shop.name}`)
      onClose()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed to create product") } finally { setIsSubmitting(false) }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add Product — {shop.name} [{shop.branch_code}]</DialogTitle></DialogHeader>
        {step === "search" ? (
          <div className="space-y-4">
            <div><Label htmlFor="hq-catalog-search">Search Master Catalog</Label><Input id="hq-catalog-search" value={catalogSearch} onChange={(e) => setCatalogSearch(e.target.value)} placeholder="Type product name or SKU..." /></div>
            {catalogLoading && <Loader2 className="h-5 w-5 animate-spin mx-auto" />}
            {catalogResults && catalogResults.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto">{catalogResults.map((product) => (
                <div key={product.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 cursor-pointer" onClick={() => handleAttachCatalog(product)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && handleAttachCatalog(product)}>
                  <div><p className="text-sm font-medium">{product.name}</p><p className="text-xs text-muted-foreground">{product.sku}</p></div>
                  <Button size="sm" variant="outline">Attach</Button>
                </div>
              ))}</div>
            )}
            {debouncedCatalog.trim() && !catalogLoading && (!catalogResults || catalogResults.length === 0) && <p className="text-sm text-muted-foreground text-center py-4">No catalog match found</p>}
            <div className="border-t pt-4"><Button variant="outline" onClick={() => setStep("manual")} className="w-full gap-1.5"><Plus className="h-4 w-4" /> Create Manually</Button></div>
          </div>
        ) : (
          <div className="space-y-4">
            <div><Label htmlFor="hq-name">Product Name *</Label><Input id="hq-name" value={manualName} onChange={(e) => setManualName(e.target.value)} /></div>
            <div><Label htmlFor="hq-sku">SKU</Label><Input id="hq-sku" value={manualSku} onChange={(e) => setManualSku(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="hq-price">Price *</Label><Input id="hq-price" type="number" value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} /></div><div><Label htmlFor="hq-stock">Stock</Label><Input id="hq-stock" type="number" value={manualStock} onChange={(e) => setManualStock(e.target.value)} /></div></div>
            <div><Label htmlFor="hq-desc">Description</Label><Input id="hq-desc" value={manualDescription} onChange={(e) => setManualDescription(e.target.value)} /></div>
            <div><Label htmlFor="hq-images">Images</Label><Input id="hq-images" type="file" accept="image/*" multiple onChange={(e) => setImageFiles(Array.from(e.target.files ?? []))} /></div>
            <DialogFooter><Button variant="outline" onClick={() => setStep("search")}>Back</Button><Button disabled={!manualName.trim() || !manualPrice || isSubmitting} onClick={handleManualCreate}>{isSubmitting ? "Creating..." : "Create Product"}</Button></DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
