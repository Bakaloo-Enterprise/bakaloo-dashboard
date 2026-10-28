"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Save, Loader2, Plus, Trash2, Globe, ArrowRight, ArrowLeft,
  ChevronDown, ChevronUp, Sparkles, ShieldCheck, Store, Star,
  Tag, Package, IndianRupee, Boxes, Ruler, Info,
  Megaphone, ListChecks, Layers, ShoppingCart, ScanBarcode,
  Hash, Scale, FileText, ToggleLeft, AlertTriangle, Gift, Building2,
} from "lucide-react"
import { useProductDetail, useCreateProduct, useUpdateProduct } from "@/hooks/useProducts"
import { useCategories, useCategoriesForProduct, useToggleCategoryMembership } from "@/hooks/useCategories"
import { ImageUpload } from "@/components/products/ImageUpload"
import { ProductGalleryUpload } from "@/components/products/ProductGalleryUpload"
import { AttributesEditor } from "@/components/products/attributes-editor"
import { HighlightsEditor } from "@/components/products/highlights-editor"
import { ProductFamilySelector } from "@/components/products/ProductFamilySelector"
import { ProductMetadataFields } from "@/components/products/ProductMetadataFields"
import { FamilyOptionsPanel } from "@/components/products/FamilyOptionsPanel"
import { toast } from "sonner"
import type {
  FoodType,
  OriginTag,
  ProductAttribute,
  ProductPayload,
  ProductReturnPolicy,
} from "@/types"
import { cn } from "@/lib/utils"

interface ProductFormProps {
  productId?: string
  /** Pre-fill product family when creating a new option from the family manager */
  initialFamilyId?: string
  initialFamilyName?: string
  /**
   * Pre-fill the option label (e.g. "500g") when creating a new option via a
   * quick preset from the family guided workflow.
   */
  initialOptionLabel?: string
  /**
   * Destination to navigate to after a successful create/update. Defaults to
   * the Master Catalog (`/products`). The store-selected (shop-products) flow
   * passes `/shop-products` so creating a new master product returns the
   * operator to their per-shop inventory, where they can immediately add the
   * freshly created product to the active shop (Issue 2 of the product
   * management access fix).
   */
  returnTo?: string
}

interface VariantRow {
  name: string
  price: string
  salePrice: string
  stock: string
  sku: string
  isActive: boolean
}

interface FormData {
  name: string
  description: string
  categoryId: string
  price: string
  salePrice: string
  costPrice: string
  /** B2B wholesale unit price — blank falls back to price/salePrice at checkout for wholesale-mode customers. */
  wholesalePrice: string
  stock: string
  unit: string
  sku: string
  barcode: string
  hsnCode: string
  uqc: string
  gstRate: string
  thumbnailUrl: string
  /** Ordered gallery (index 0 = primary). Mirrors thumbnailUrl on submit. */
  images: string[]
  tags: string
  isFeatured: boolean
  isActive: boolean
  lowStockThreshold: string
  maxOrderQty: string
  // Variants
  variantsEnabled: boolean
  variantGroupName: string
  variants: VariantRow[]
  // SEO
  metaTitle: string
  metaDescription: string
  // Nutrition
  ingredients: string
  allergenInfo: string
  shelfLife: string
  storageInstructions: string
  certifications: string[]
  nutritionRows: { key: string; value: string }[]
  // Brand & merchandising
  brand: string
  brandLogoUrl: string
  netQuantity: string
  highlights: Record<string, string>
  attributes: ProductAttribute[]
  // Vendor & settings
  vendorName: string
  vendorAddress: string
  vendorFssai: string
  returnPolicy: ProductReturnPolicy
  avgRating: string
  ratingCount: string
  isAuthentic: boolean
  // Product family / option fields (Phase 2)
  productFamilyId: string | null
  productFamilyName: string | null
  optionLabel: string
  optionSortOrder: string
  isDefaultOption: boolean
  foodType: FoodType
  originTag: OriginTag
  customBadges: string[]
  displayDeliveryMinutes: string
}

const UNITS = ["kg", "g", "l", "ml", "piece", "pack", "dozen", "box"]
const UNIT_LABELS: Record<string, string> = {
  kg: "Kilogram (kg)",
  g: "Gram (g)",
  l: "Litre (l)",
  ml: "Millilitre (ml)",
  piece: "Piece",
  pack: "Pack",
  dozen: "Dozen",
  box: "Box",
}
const CERT_OPTIONS = ["Organic", "FSSAI", "ISO", "Vegan", "Gluten-Free"]
const DEFAULT_NUTRITION_KEYS = ["Calories", "Protein", "Fat", "Carbs", "Fiber"]

// GST-standard Unit Quantity Codes (subset covering Bakaloo's product units).
const UQC_OPTIONS = ["KGS", "GMS", "LTR", "MLT", "NOS", "PAC", "BOX", "DOZ", "OTH"]
const UNIT_TO_UQC: Record<string, string> = {
  kg: "KGS",
  g: "GMS",
  l: "LTR",
  ml: "MLT",
  piece: "NOS",
  pack: "PAC",
  dozen: "DOZ",
  box: "BOX",
}

const INITIAL: FormData = {
  name: "",
  description: "",
  categoryId: "",
  price: "",
  salePrice: "",
  costPrice: "",
  wholesalePrice: "",
  stock: "0",
  unit: "piece",
  sku: "",
  barcode: "",
  hsnCode: "",
  uqc: "",
  gstRate: "",
  thumbnailUrl: "",
  images: [],
  tags: "",
  isFeatured: false,
  isActive: true,
  lowStockThreshold: "10",
  maxOrderQty: "",
  variantsEnabled: false,
  variantGroupName: "Size",
  variants: [],
  metaTitle: "",
  metaDescription: "",
  ingredients: "",
  allergenInfo: "",
  shelfLife: "",
  storageInstructions: "",
  certifications: [],
  nutritionRows: DEFAULT_NUTRITION_KEYS.map((k) => ({ key: k, value: "" })),
  brand: "",
  brandLogoUrl: "",
  netQuantity: "",
  highlights: {},
  attributes: [],
  vendorName: "",
  vendorAddress: "",
  vendorFssai: "",
  returnPolicy: "no_return",
  avgRating: "",
  ratingCount: "",
  isAuthentic: true,
  // Product family / option fields default to "no family / single option"
  productFamilyId: null,
  productFamilyName: null,
  optionLabel: "",
  optionSortOrder: "0",
  isDefaultOption: false,
  foodType: "NONE",
  originTag: "NONE",
  customBadges: [],
  displayDeliveryMinutes: "",
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === "string")
  )
}

function parseOptionalNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return ""
  const nextValue = typeof value === "string" ? Number(value) : value
  return Number.isFinite(nextValue) ? String(nextValue) : ""
}

export function ProductForm({
  productId,
  initialFamilyId,
  initialFamilyName,
  initialOptionLabel,
  returnTo,
}: ProductFormProps) {
  const router = useRouter()
  const isEdit = !!productId
  // Harden the post-save redirect against open-redirect: only honour an
  // app-internal absolute path ("/...") that is not protocol-relative
  // ("//host"). Anything else falls back to the Master Catalog.
  const safeReturnTo = useMemo(() => {
    if (
      typeof returnTo === "string" &&
      returnTo.startsWith("/") &&
      !returnTo.startsWith("//")
    ) {
      return returnTo
    }
    return "/products"
  }, [returnTo])
  const { data: product, isLoading: productLoading } = useProductDetail(productId ?? null)
  const { data: categories } = useCategories()
  const createProduct = useCreateProduct()
  const updateProduct = useUpdateProduct()

  // Build initial form state from product (if editing) — computed once
  const initialForm = useMemo<FormData>(() => {
    if (!product) {
      // For new products, allow pre-filling family from query param
      if (initialFamilyId) {
        return {
          ...INITIAL,
          productFamilyId: initialFamilyId,
          productFamilyName: initialFamilyName ?? null,
          optionLabel: initialOptionLabel ?? INITIAL.optionLabel,
        }
      }
      return INITIAL
    }
    return {
      name: product.name ?? "",
      description: product.description ?? "",
      categoryId: product.category_id ?? "",
      price: (product.price ?? product.mrp ?? 0).toString(),
      salePrice: product.sale_price ? product.sale_price.toString() : "",
      costPrice: product.cost_price ? product.cost_price.toString() : "",
      wholesalePrice: product.wholesale_price ? product.wholesale_price.toString() : "",
      stock: (product.stock_quantity ?? 0).toString(),
      unit: product.unit ?? "piece",
      sku: product.sku ?? "",
      barcode: product.barcode ?? "",
      hsnCode: product.hsn_code ?? "",
      uqc: product.uqc ?? "",
      gstRate: parseOptionalNumber(product.gst_rate),
      thumbnailUrl: product.thumbnail_url ?? "",
      // Seed gallery from images[]; fall back to a 1-image gallery built
      // from the legacy thumbnail so existing products keep working.
      images: (() => {
        const imgs = Array.isArray(product.images)
          ? product.images.filter((u): u is string => typeof u === "string" && u.length > 0)
          : []
        if (imgs.length > 0) return imgs
        return product.thumbnail_url ? [product.thumbnail_url] : []
      })(),
      tags: product.tags?.join(", ") ?? "",
      isFeatured: product.is_featured ?? false,
      isActive: product.is_active ?? true,
      lowStockThreshold: (product.low_stock_threshold ?? 10).toString(),
      maxOrderQty: product.max_order_qty ? product.max_order_qty.toString() : "",
      variantsEnabled: (product.variants?.length ?? 0) > 0,
      variantGroupName: "Size",
      variants: product.variants?.map((v) => ({
        name: v.name,
        price: (v.price ?? 0).toString(),
        salePrice: v.sale_price?.toString() ?? "",
        stock: (v.stock ?? 0).toString(),
        sku: v.sku ?? "",
        isActive: v.is_active ?? true,
      })) ?? [],
      metaTitle: product.meta_title ?? "",
      metaDescription: product.meta_description ?? "",
      ingredients: product.ingredients ?? "",
      allergenInfo: product.allergen_info ?? "",
      shelfLife: product.shelf_life ?? "",
      storageInstructions: product.storage_instructions ?? "",
      certifications: product.certifications ?? [],
      nutritionRows: product.nutrition_info
        ? Object.entries(product.nutrition_info).map(([key, value]) => ({ key, value }))
        : DEFAULT_NUTRITION_KEYS.map((k) => ({ key: k, value: "" })),
      brand: product.brand ?? "",
      brandLogoUrl: product.brandLogoUrl ?? product.brand_logo_url ?? "",
      netQuantity: product.netQuantity ?? product.net_quantity ?? "",
      highlights: isStringRecord(product.highlights) ? product.highlights : {},
      attributes: Array.isArray(product.attributes)
        ? product.attributes.map((attribute) => ({
          label: attribute.label ?? "",
          value: attribute.value ?? "",
        }))
        : [],
      vendorName: product.vendorName ?? product.vendor_name ?? "",
      vendorAddress: product.vendorAddress ?? product.vendor_address ?? "",
      vendorFssai: product.vendorFssai ?? product.vendor_fssai ?? "",
      returnPolicy: product.returnPolicy ?? product.return_policy ?? "no_return",
      avgRating: parseOptionalNumber(product.avgRating ?? product.avg_rating),
      ratingCount: parseOptionalNumber(product.ratingCount ?? product.rating_count),
      isAuthentic: product.isAuthentic ?? product.is_authentic ?? true,
      // Product family / option fields
      productFamilyId: product.product_family_id ?? null,
      productFamilyName: product.family_name ?? null,
      optionLabel: product.option_label ?? "",
      optionSortOrder: parseOptionalNumber(product.option_sort_order) || "0",
      isDefaultOption: product.is_default_option ?? false,
      foodType: (product.food_type as FoodType | null) ?? "NONE",
      originTag: (product.origin_tag as OriginTag | null) ?? "NONE",
      customBadges: Array.isArray(product.custom_badges)
        ? product.custom_badges
        : [],
      displayDeliveryMinutes: parseOptionalNumber(
        product.display_delivery_minutes
      ),
    }
  }, [product, initialFamilyId, initialFamilyName, initialOptionLabel])

  const [form, setForm] = useState<FormData>(initialForm)

  // Sync form when product data loads/changes (e.g. from cache → fresh fetch)
  useEffect(() => {
    setForm(initialForm)
  }, [initialForm])

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const addVariant = () =>
    setForm((prev) => ({
      ...prev,
      variants: [...prev.variants, { name: "", price: "", salePrice: "", stock: "0", sku: "", isActive: true }],
    }))

  const updateVariant = (idx: number, key: keyof VariantRow, val: string | boolean) =>
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((v, i) => (i === idx ? { ...v, [key]: val } : v)),
    }))

  const removeVariant = (idx: number) =>
    setForm((prev) => ({ ...prev, variants: prev.variants.filter((_, i) => i !== idx) }))

  const addNutritionRow = () =>
    setForm((prev) => ({ ...prev, nutritionRows: [...prev.nutritionRows, { key: "", value: "" }] }))

  const updateNutritionRow = (idx: number, field: "key" | "value", val: string) =>
    setForm((prev) => ({
      ...prev,
      nutritionRows: prev.nutritionRows.map((r, i) => (i === idx ? { ...r, [field]: val } : r)),
    }))

  const removeNutritionRow = (idx: number) =>
    setForm((prev) => ({ ...prev, nutritionRows: prev.nutritionRows.filter((_, i) => i !== idx) }))

  const toggleCert = (cert: string) =>
    setForm((prev) => ({
      ...prev,
      certifications: prev.certifications.includes(cert)
        ? prev.certifications.filter((c) => c !== cert)
        : [...prev.certifications, cert],
    }))

  const isPending = createProduct.isPending || updateProduct.isPending

  const STEPS = ["general", "pricing", "media", "details", "options", "variants", "nutrition", "seo"] as const
  type Step = (typeof STEPS)[number]
  const [step, setStep] = useState<Step>("general")

  const stepIdx = STEPS.indexOf(step)
  const canPrev = stepIdx > 0
  const canNext = stepIdx < STEPS.length - 1
  const goNext = () => canNext && setStep(STEPS[stepIdx + 1])
  const goPrev = () => canPrev && setStep(STEPS[stepIdx - 1])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const cleanedAttributes = form.attributes
      .map((attribute) => ({
        label: attribute.label.trim(),
        value: attribute.value.trim(),
      }))
      .filter((attribute) => attribute.label || attribute.value)

    if (cleanedAttributes.some((attribute) => !attribute.label || !attribute.value)) {
      toast.error("Each product attribute needs both a label and a value.")
      setStep("details")
      return
    }

    const cleanedHighlights = Object.fromEntries(
      Object.entries(form.highlights)
        .map(([key, value]) => [key.trim(), value.trim()])
        .filter(([key, value]) => key && value)
    )

    const payload: ProductPayload = {
      name: form.name,
      description: form.description || undefined,
      categoryId: form.categoryId || undefined,
      price: parseFloat(form.price),
      salePrice: form.salePrice ? parseFloat(form.salePrice) : undefined,
      costPrice: form.costPrice ? parseFloat(form.costPrice) : undefined,
      wholesalePrice: form.wholesalePrice ? parseFloat(form.wholesalePrice) : undefined,
      stock: parseInt(form.stock, 10),
      unit: form.unit,
      sku: form.sku || undefined,
      barcode: form.barcode || undefined,
      // GSTR-1: hsnCode/uqc are text, sent as "" (not undefined) so
      // clearing the field actually clears it — see the comment above on
      // metaTitle/vendorName for why. gstRate is a number field with no
      // clear-once-set path today, matching avgRating/ratingCount below.
      hsnCode: form.hsnCode || "",
      uqc: form.uqc || "",
      gstRate: form.gstRate ? parseFloat(form.gstRate) : undefined,
      thumbnailUrl: (form.images[0] ?? form.thumbnailUrl) || undefined,
      images: form.images.length > 0 ? form.images : undefined,
      lowStockThreshold: form.lowStockThreshold ? parseInt(form.lowStockThreshold, 10) : undefined,
      maxOrderQty: form.maxOrderQty ? parseInt(form.maxOrderQty, 10) : undefined,
      // Always send a real array (never `undefined`) here: `undefined` is
      // dropped by JSON serialization, and the backend's update endpoint
      // only touches the `tags` column when the key is present in the
      // request body. Previously an emptied tags field became `undefined`,
      // so removing the last/only tag and saving silently left the old
      // tags untouched in the database.
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      isFeatured: form.isFeatured,
      isActive: form.isActive,
      // Variants
      variants: form.variantsEnabled
        ? form.variants.map((v) => ({
          name: v.name,
          price: parseFloat(v.price) || 0,
          salePrice: v.salePrice ? parseFloat(v.salePrice) : undefined,
          stockQuantity: parseInt(v.stock, 10) || 0,
          sku: v.sku || undefined,
          isActive: v.isActive,
        }))
        : [],
      // SEO
      // These optional fields all used `|| undefined` for a blank value,
      // which drops the key from the JSON payload entirely. The backend's
      // update query only touches a column when its key is present in the
      // body, so blanking a field out on edit silently never reached the
      // database — the old value stayed forever and there was no way to
      // clear/disable it from the dashboard (vendor details, nutrition,
      // certifications). Sending '' / [] / {} instead keeps the key
      // present so the backend actually clears it; the repository already
      // converts an empty string to NULL for plain text columns.
      metaTitle: form.metaTitle || "",
      metaDescription: form.metaDescription || "",
      // Nutrition & Details
      ingredients: form.ingredients || "",
      allergenInfo: form.allergenInfo || "",
      shelfLife: form.shelfLife || "",
      storageInstructions: form.storageInstructions || "",
      certifications: form.certifications,
      nutritionInfo: Object.fromEntries(
        form.nutritionRows.filter((r) => r.key && r.value).map((r) => [r.key, r.value])
      ),
      brand: form.brand || "",
      brandLogoUrl: form.brandLogoUrl || "",
      netQuantity: form.netQuantity || "",
      highlights: Object.keys(cleanedHighlights).length > 0 ? cleanedHighlights : undefined,
      attributes: cleanedAttributes.length > 0 ? cleanedAttributes : undefined,
      vendorName: form.vendorName || "",
      vendorAddress: form.vendorAddress || "",
      vendorFssai: form.vendorFssai || "",
      returnPolicy: form.returnPolicy,
      avgRating: form.avgRating ? parseFloat(form.avgRating) : undefined,
      ratingCount: form.ratingCount ? parseInt(form.ratingCount, 10) : undefined,
      isAuthentic: form.isAuthentic,
      // Product family / option fields — only sent when set
      productFamilyId: form.productFamilyId || undefined,
      optionLabel: form.optionLabel.trim() || undefined,
      optionSortOrder: form.optionSortOrder
        ? parseInt(form.optionSortOrder, 10)
        : undefined,
      isDefaultOption: form.isDefaultOption,
      foodType: form.foodType,
      originTag: form.originTag,
      customBadges: form.customBadges.length > 0 ? form.customBadges : [],
      displayDeliveryMinutes: form.displayDeliveryMinutes
        ? parseInt(form.displayDeliveryMinutes, 10)
        : undefined,
    }

    if (isEdit && productId) {
      updateProduct.mutate(
        { id: productId, payload },
        { onSuccess: () => router.push(safeReturnTo) }
      )
    } else {
      createProduct.mutate(payload, {
        onSuccess: () => router.push(safeReturnTo),
      })
    }
  }

  if ((isEdit && productLoading) || !categories) {
    return <ProductFormSkeleton />
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs value={step} onValueChange={(v) => setStep(v as Step)}>
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1 md:grid-cols-8">
          <TabsTrigger value="general" className="text-xs">General</TabsTrigger>
          <TabsTrigger value="pricing" className="text-xs">Pricing</TabsTrigger>
          <TabsTrigger value="media" className="text-xs">Media</TabsTrigger>
          <TabsTrigger value="details" className="text-xs">Details</TabsTrigger>
          <TabsTrigger value="options" className="text-xs">Options</TabsTrigger>
          <TabsTrigger value="variants" className="text-xs">Legacy Variants</TabsTrigger>
          <TabsTrigger value="nutrition" className="text-xs">Nutrition</TabsTrigger>
          <TabsTrigger value="seo" className="text-xs">SEO</TabsTrigger>
        </TabsList>

        {/* ────── Step 1: General ────── */}
        <TabsContent value="general" className="space-y-6 mt-6">
          <StepIntro
            icon={<Tag className="h-5 w-5" />}
            title="Start with the basics"
            description="Tell shoppers what the product is. The name and category are what customers see and search for, so keep them clear and specific."
          />

          <SectionCard
            icon={<FileText className="h-4 w-4" />}
            title="Basic Information"
            description="The core identity of the product — its name, description, and the codes your team uses to track it."
          >
            <div className="space-y-2">
              <FieldLabel htmlFor="name" icon={<Package className="h-3.5 w-3.5" />} required>
                Product Name
              </FieldLabel>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Organic Whole Milk 500ml"
                required
              />
              <FieldHint>
                The full name shoppers see on the card and product page. Include the
                variant if it matters — e.g. &ldquo;Maggi Noodles 500g&rdquo;.
              </FieldHint>
            </div>
            <div className="space-y-2">
              <FieldLabel htmlFor="description" icon={<FileText className="h-3.5 w-3.5" />}>
                Description
              </FieldLabel>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Product details, ingredients, storage info..."
                rows={4}
              />
              <FieldHint>
                A short paragraph describing the product. Shown on the product detail
                page in the app.
              </FieldHint>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <FieldLabel htmlFor="sku" icon={<Hash className="h-3.5 w-3.5" />}>SKU</FieldLabel>
                <Input id="sku" value={form.sku} onChange={(e) => set("sku", e.target.value)} placeholder="e.g. MLK-ORG-500" />
                <FieldHint>Your internal stock code. Helps your team find this product — not shown to shoppers.</FieldHint>
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor="barcode" icon={<ScanBarcode className="h-3.5 w-3.5" />}>Barcode</FieldLabel>
                <Input id="barcode" value={form.barcode} onChange={(e) => set("barcode", e.target.value)} placeholder="e.g. 8901234567890" />
                <FieldHint>The printed EAN/UPC barcode on the pack. Used for scanning at the warehouse.</FieldHint>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            icon={<IndianRupee className="h-4 w-4" />}
            title="Tax / GST"
            description="Used to build the GSTR-1 HSN Summary report. Doesn't affect the price shown to shoppers — GST is still charged as one rate per order at checkout."
          >
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <FieldLabel htmlFor="hsnCode" icon={<Hash className="h-3.5 w-3.5" />}>HSN Code</FieldLabel>
                <Input
                  id="hsnCode"
                  value={form.hsnCode}
                  onChange={(e) => set("hsnCode", e.target.value)}
                  placeholder="e.g. 0401"
                  maxLength={8}
                />
                <FieldHint>The GST HSN code for this product. Leave blank if unknown — it&apos;ll show as &ldquo;Unknown&rdquo; on the HSN Summary report.</FieldHint>
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor="uqc" icon={<Scale className="h-3.5 w-3.5" />}>UQC (Unit)</FieldLabel>
                <select
                  id="uqc"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={form.uqc || UNIT_TO_UQC[form.unit] || ""}
                  onChange={(e) => set("uqc", e.target.value)}
                >
                  <option value="">Select unit code</option>
                  {UQC_OPTIONS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
                <FieldHint>GST&apos;s standard unit code. Defaults from the product unit above.</FieldHint>
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor="gstRate" icon={<IndianRupee className="h-3.5 w-3.5" />}>GST Rate (%)</FieldLabel>
                <Input
                  id="gstRate"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={form.gstRate}
                  onChange={(e) => set("gstRate", e.target.value)}
                  placeholder="Platform default"
                />
                <FieldHint>Leave blank to use the platform&apos;s default GST rate from Settings → Fees.</FieldHint>
              </div>
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            <SectionCard
              icon={<ToggleLeft className="h-4 w-4" />}
              title="Status"
              description="Control where this product shows up."
            >
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <Label htmlFor="isActive">Active</Label>
                  <FieldHint>Visible and buyable in the app.</FieldHint>
                </div>
                <Switch id="isActive" checked={form.isActive} onCheckedChange={(v) => set("isActive", v)} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <Label htmlFor="isFeatured">Featured</Label>
                  <FieldHint>Highlighted in featured rows.</FieldHint>
                </div>
                <Switch id="isFeatured" checked={form.isFeatured} onCheckedChange={(v) => set("isFeatured", v)} />
              </div>
            </SectionCard>

            <SectionCard
              icon={<Layers className="h-4 w-4" />}
              title="Category"
              description="Where the product is filed in the catalog."
            >
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={form.categoryId}
                onChange={(e) => set("categoryId", e.target.value)}
              >
                <option value="">Select category</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <FieldHint>Decides which category page and filters the product appears under.</FieldHint>
            </SectionCard>

            <SectionCard
              icon={<Tag className="h-4 w-4" />}
              title="Tags"
              description="Keywords that help shoppers find it in search."
            >
              <Input value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="organic, dairy, milk" />
              <FieldHint>Separate each tag with a comma. These boost search matches — e.g. &ldquo;organic, dairy, milk&rdquo;.</FieldHint>
            </SectionCard>
          </div>

          {/* Full-width on its own row — this list can get long, so it no
              longer shares a 3-column grid with the compact cards above
              (that made every card in the row stretch to match its height). */}
          {productId && (
            <SectionCard
              icon={<Gift className="h-4 w-4" />}
              title="Also show in other categories"
              description="Cross-list this product into other categories or bundles (e.g. Baby Potato under both Fresh Vegetables and Exotic Vegetables) without changing its real category above."
            >
              <CategoryMembershipFields productId={productId} />
            </SectionCard>
          )}
        </TabsContent>

        {/* ────── Step 2: Pricing & Inventory ────── */}
        <TabsContent value="pricing" className="space-y-6 mt-6">
          <StepIntro
            icon={<IndianRupee className="h-5 w-5" />}
            title="Set the price and how much is in the pack"
            description="Tell shoppers what they pay and exactly what they get — the price, the unit it’s sold by, and the pack size (like 500 g or 1 kg)."
          />

          <SectionCard
            icon={<IndianRupee className="h-4 w-4" />}
            title="Pricing"
            description="MRP is the printed price (shown struck-through). Sale Price is what the shopper actually pays — leave it blank for no discount. Per-store price and stock are set separately in Shop Products."
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <FieldLabel htmlFor="price" required>MRP (₹)</FieldLabel>
                <Input id="price" type="number" step="0.01" min="0" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="0.00" required />
                <FieldHint>The full printed price. Shown struck-through when there’s a discount.</FieldHint>
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor="salePrice">Sale Price (₹)</FieldLabel>
                <Input id="salePrice" type="number" step="0.01" min="0" value={form.salePrice} onChange={(e) => set("salePrice", e.target.value)} placeholder="0.00" />
                <FieldHint>What the shopper actually pays. Leave blank for no discount.</FieldHint>
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor="costPrice">Cost Price (₹)</FieldLabel>
                <Input id="costPrice" type="number" step="0.01" min="0" value={form.costPrice} onChange={(e) => set("costPrice", e.target.value)} placeholder="0.00" />
                <FieldHint>What it costs you. Used for profit reports — never shown to shoppers.</FieldHint>
              </div>
            </div>
            {form.salePrice && form.price && parseFloat(form.salePrice) < parseFloat(form.price) && (
              <div className="inline-flex items-center gap-1.5 rounded-md bg-success-bg px-2.5 py-1 text-xs font-medium text-success">
                <Tag className="h-3.5 w-3.5" />
                {Math.round(((parseFloat(form.price) - parseFloat(form.salePrice)) / parseFloat(form.price)) * 100)}% off for shoppers
              </div>
            )}
          </SectionCard>

          <SectionCard
            icon={<Building2 className="h-4 w-4" />}
            title="B2B Wholesale Pricing"
            description="What an approved, wholesale-enabled business account pays instead of MRP/Sale Price. Leave blank to charge those customers the regular price too — per-store wholesale price is set separately in Shop Products."
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <FieldLabel htmlFor="wholesalePrice">Wholesale Price (₹)</FieldLabel>
                <Input id="wholesalePrice" type="number" step="0.01" min="0" value={form.wholesalePrice} onChange={(e) => set("wholesalePrice", e.target.value)} placeholder="0.00" />
                <FieldHint>Only charged to customers browsing with B2B pricing switched on.</FieldHint>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            icon={<Ruler className="h-4 w-4" />}
            title="Pack Size & Unit"
            description="Say exactly how much is in one pack. “Sold By” is the measure (weight, volume, or count); “Pack Size” is the amount printed under the product name — e.g. 500 g noodles, 1 kg atta."
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <FieldLabel htmlFor="unit" icon={<Scale className="h-3.5 w-3.5" />}>Sold By (Unit)</FieldLabel>
                <Select value={form.unit} onValueChange={(v) => set("unit", v)}>
                  <SelectTrigger id="unit"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (<SelectItem key={u} value={u}>{UNIT_LABELS[u] ?? u}</SelectItem>))}
                  </SelectContent>
                </Select>
                <FieldHint>The base measure — by weight (kg/g), volume (l/ml), or count (piece/pack/dozen/box).</FieldHint>
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor="netQuantity" icon={<Package className="h-3.5 w-3.5" />}>Pack Size</FieldLabel>
                <Input
                  id="netQuantity"
                  value={form.netQuantity}
                  onChange={(e) => set("netQuantity", e.target.value)}
                  placeholder="e.g. 500 g, 1 kg, 6 pieces"
                  maxLength={200}
                />
                <FieldHint>The exact amount in one pack, exactly as the shopper should see it — this is the label under the product name (e.g. “500 g”).</FieldHint>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            icon={<Boxes className="h-4 w-4" />}
            title="Inventory"
            description="How many you have, when to be warned you’re running low, and the most a shopper can buy at once."
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <FieldLabel htmlFor="stock" icon={<Boxes className="h-3.5 w-3.5" />} required>Stock Quantity</FieldLabel>
                <Input id="stock" type="number" min="0" step="1" value={form.stock} onChange={(e) => set("stock", e.target.value)} required />
                <FieldHint>How many units are available to sell right now.</FieldHint>
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor="lowStock" icon={<Info className="h-3.5 w-3.5" />}>Low Stock Alert</FieldLabel>
                <Input id="lowStock" type="number" min="0" step="1" value={form.lowStockThreshold} onChange={(e) => set("lowStockThreshold", e.target.value)} />
                <FieldHint>Get warned when stock drops to this number, so you can restock in time.</FieldHint>
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor="maxOrder" icon={<ShoppingCart className="h-3.5 w-3.5" />}>Max Order Qty</FieldLabel>
                <Input id="maxOrder" type="number" min="1" step="1" value={form.maxOrderQty} onChange={(e) => set("maxOrderQty", e.target.value)} placeholder="No limit" />
                <FieldHint>The most a single shopper can buy in one order. Leave blank for no limit.</FieldHint>
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        {/* ────── Step 3: Media ────── */}
        <TabsContent value="media" className="mt-6">
          <Card className="p-6 space-y-4">
            <div className="space-y-1">
              <h3 className="font-semibold">Product Images</h3>
              <p className="text-sm text-muted-foreground">
                Add 1–5 images. The first (primary) image appears on product
                cards; the product detail page shows all images as a swipeable
                gallery.
              </p>
            </div>
            <ProductGalleryUpload
              value={form.images}
              onChange={(urls) =>
                setForm((prev) => ({
                  ...prev,
                  images: urls,
                  // Keep the legacy thumbnail in sync with the primary image
                  // so existing card rendering (which reads thumbnail_url)
                  // always shows the chosen primary.
                  thumbnailUrl: urls[0] ?? "",
                }))
              }
            />
          </Card>
        </TabsContent>

        {/* ────── Step 4: Details ────── */}
        <TabsContent value="details" className="space-y-6 mt-6">
          <StepIntro
            icon={<Sparkles className="h-5 w-5" />}
            title="Extra details that build trust"
            description="All optional, but they make the product page richer — brand info, key highlights, a spec table, and supplier/return settings. Pack size now lives on the Pricing step."
          />
          <CollapsibleCard
            title="Brand Details"
            description="Organize merchandising metadata for branding and packaging."
            icon={<Sparkles className="h-4 w-4" />}
            defaultOpen
          >
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_220px]">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="brand">Brand Name</Label>
                  <Input
                    id="brand"
                    value={form.brand}
                    onChange={(e) => set("brand", e.target.value)}
                    placeholder="e.g. Comfort Knit"
                    maxLength={200}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brandLogoUrl">Brand Logo URL</Label>
                  <Input
                    id="brandLogoUrl"
                    value={form.brandLogoUrl}
                    onChange={(e) => set("brandLogoUrl", e.target.value)}
                    placeholder="https://res.cloudinary.com/..."
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Brand Logo Upload</Label>
                <ImageUpload kind="products"
                  value={form.brandLogoUrl || null}
                  onChange={(url) => set("brandLogoUrl", url ?? "")}
                  label="Upload Logo"
                  helperText="Optional. Use a square logo for the cleanest card preview."
                />
              </div>
            </div>
          </CollapsibleCard>

          <Card className="p-6 space-y-4">
            <div className="space-y-1">
              <h3 className="font-semibold flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-brand-600" />
                Highlights
              </h3>
              <p className="text-sm text-muted-foreground">
                Short bullet points shown on the product page — e.g. &ldquo;100% whole wheat&rdquo;, &ldquo;No palm oil&rdquo;, &ldquo;Rich in protein&rdquo;.
              </p>
            </div>
            <HighlightsEditor
              value={form.highlights ?? {}}
              onChange={(nextHighlights) => set("highlights", nextHighlights)}
            />
          </Card>

          <Card className="p-6 space-y-4">
            <div className="space-y-1">
              <h3 className="font-semibold flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-brand-600" />
                Product Attributes
              </h3>
              <p className="text-sm text-muted-foreground">
                A spec table of label–value pairs shown on the product page — e.g. Material: Cotton, Size: Large, Weight: 250 g.
              </p>
            </div>
            <AttributesEditor
              value={form.attributes ?? []}
              onChange={(nextAttributes) => set("attributes", nextAttributes)}
            />
          </Card>

          <CollapsibleCard
            title="Vendor Details"
            description="Store supplier and compliance metadata without cluttering the main product entry flow."
            icon={<Store className="h-4 w-4" />}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="vendorName">Vendor Name</Label>
                <Input
                  id="vendorName"
                  value={form.vendorName}
                  onChange={(e) => set("vendorName", e.target.value)}
                  placeholder="e.g. Bakaloo Textiles Pvt. Ltd."
                  maxLength={200}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendorFssai">Vendor FSSAI</Label>
                <Input
                  id="vendorFssai"
                  value={form.vendorFssai}
                  onChange={(e) => set("vendorFssai", e.target.value)}
                  placeholder="FSSAI License Number"
                  maxLength={50}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendorAddress">Vendor Address</Label>
              <Textarea
                id="vendorAddress"
                value={form.vendorAddress}
                onChange={(e) => set("vendorAddress", e.target.value)}
                placeholder="Street, locality, city, state, pin code"
                rows={3}
              />
            </div>
            {(form.vendorName || form.vendorAddress || form.vendorFssai) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => {
                  set("vendorName", "")
                  set("vendorAddress", "")
                  set("vendorFssai", "")
                }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Clear vendor details
              </Button>
            )}
          </CollapsibleCard>

          <Card className="p-6 space-y-5">
            <div className="space-y-1">
              <h3 className="font-semibold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Settings
              </h3>
              <p className="text-sm text-muted-foreground">
                Configure post-purchase policy and trust signals for the storefront.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="returnPolicy">Return Policy</Label>
                <Select
                  value={form.returnPolicy}
                  onValueChange={(value: ProductReturnPolicy) => set("returnPolicy", value)}
                >
                  <SelectTrigger id="returnPolicy">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no_return">No Return</SelectItem>
                    <SelectItem value="7_day">7 Day Return</SelectItem>
                    <SelectItem value="instant">Instant Return</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-xl border border-border/70 bg-muted/30 px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="isAuthentic">Is Authentic</Label>
                    <p className="text-xs text-muted-foreground">
                      Mark products as verified and genuine for shopper trust.
                    </p>
                  </div>
                  <Switch
                    id="isAuthentic"
                    checked={form.isAuthentic}
                    onCheckedChange={(checked) => set("isAuthentic", checked)}
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="avgRating">Average Rating</Label>
                <div className="relative">
                  <Star className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-500" />
                  <Input
                    id="avgRating"
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    value={form.avgRating}
                    onChange={(e) => set("avgRating", e.target.value)}
                    placeholder="0.0"
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ratingCount">Rating Count</Label>
                <Input
                  id="ratingCount"
                  type="number"
                  min="0"
                  step="1"
                  value={form.ratingCount}
                  onChange={(e) => set("ratingCount", e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* ────── Step 5: Options ────── */}
        <TabsContent value="options" className="space-y-6 mt-6">
          <StepIntro
            icon={<Layers className="h-5 w-5" />}
            title="Optional — group sizes of the same product"
            description="Only needed if this product comes in more than one size or pack (like 250 g, 500 g, 1 kg). Grouping them lets the app show one card with a size picker. Selling a single size? You can skip this step."
          />

          {/* Plain-language explainer of the whole flow */}
          <div className="rounded-xl border border-info/30 bg-info-bg p-4 dark:bg-info/10">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
              <div className="space-y-2 text-xs leading-relaxed text-foreground/80">
                <p className="text-sm font-semibold text-foreground">How it works in 3 steps</p>
                <ol className="ml-4 list-decimal space-y-1">
                  <li><span className="font-medium text-foreground">Pick a family</span> — the shared name, e.g. &ldquo;Maggi Noodles&rdquo;.</li>
                  <li><span className="font-medium text-foreground">Label this size</span> — what this exact product is, e.g. &ldquo;500 g&rdquo;.</li>
                  <li><span className="font-medium text-foreground">Repeat</span> for each size — they all appear under one card with a picker.</li>
                </ol>
                <p>Each size stays a separate product with its own price and stock per shop.</p>
              </div>
            </div>
          </div>

          <SectionCard
            icon={<Boxes className="h-4 w-4" />}
            title="Step 1 — Product Family"
            description="The shared name that ties sizes together. Pick an existing family or create a new one. Leave empty for single-size products."
          >
            <ProductFamilySelector
              value={form.productFamilyId}
              onChange={(id, name) => {
                set("productFamilyId", id)
                set("productFamilyName", name)
              }}
              categoryId={form.categoryId || null}
            />
          </SectionCard>

          {form.productFamilyId && (
            <SectionCard
              icon={<Ruler className="h-4 w-4" />}
              title="Step 2 — This product’s size"
              description="Describe which size this specific product is within the family."
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel icon={<Tag className="h-3.5 w-3.5" />}>Option Label</FieldLabel>
                  <Input
                    value={form.optionLabel}
                    onChange={(e) => set("optionLabel", e.target.value)}
                    placeholder="e.g. 500g, 1kg, Pack of 2"
                    maxLength={100}
                  />
                  <FieldHint>The size shown in the picker on mobile. Keep it short — &ldquo;500 g&rdquo;, &ldquo;1 kg&rdquo;, &ldquo;Pack of 2&rdquo;.</FieldHint>
                </div>
                <div className="space-y-2">
                  <FieldLabel icon={<ListChecks className="h-3.5 w-3.5" />}>Sort Order</FieldLabel>
                  <Input
                    type="number"
                    min={0}
                    value={form.optionSortOrder}
                    onChange={(e) => set("optionSortOrder", e.target.value)}
                    placeholder="0"
                  />
                  <FieldHint>Controls the order in the picker. Lower numbers show first (0 = top).</FieldHint>
                </div>
              </div>

              <div className="flex items-start justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3">
                <div className="space-y-0.5">
                  <Label className="text-sm">Set as default size</Label>
                  <FieldHint>
                    The default size represents the whole family in listings. Only one
                    per family — turning this on may replace the previous default.
                  </FieldHint>
                </div>
                <Switch
                  checked={form.isDefaultOption}
                  onCheckedChange={(v) => set("isDefaultOption", v)}
                />
              </div>

              {!form.optionLabel.trim() && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    This product is in a family but has no size label yet. Shoppers
                    won&apos;t be able to tell the sizes apart — add a label like
                    &ldquo;500 g&rdquo; or &ldquo;Pack of 2&rdquo;.
                  </span>
                </div>
              )}
            </SectionCard>
          )}

          <SectionCard
            icon={<Sparkles className="h-4 w-4" />}
            title="Card Display"
            description="Controls how the product looks on the mobile card — the veg/non-veg dot, an Imported/Local tag, custom badges, and a delivery-time label."
          >
            <ProductMetadataFields
              foodType={form.foodType}
              originTag={form.originTag}
              customBadges={form.customBadges}
              displayDeliveryMinutes={form.displayDeliveryMinutes}
              onFoodTypeChange={(v) => set("foodType", v)}
              onOriginTagChange={(v) => set("originTag", v)}
              onCustomBadgesChange={(v) => set("customBadges", v)}
              onDisplayDeliveryMinutesChange={(v) =>
                set("displayDeliveryMinutes", v)
              }
            />
          </SectionCard>

          {isEdit && productId && form.productFamilyId && (
            <FamilyOptionsPanel
              productId={productId}
              familyId={form.productFamilyId}
              familyName={form.productFamilyName}
            />
          )}
        </TabsContent>

        {/* ────── Step 6: Legacy Display Variants ────── */}
        <TabsContent value="variants" className="mt-6">
          <Card className="p-6 space-y-4">
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <p className="font-medium">Legacy Display Variants</p>
              <p className="mt-1">
                These variants are display-only and are NOT used for cart,
                checkout, or stock. Use the <strong>Options</strong> tab
                above to create real purchasable grocery options.
              </p>
            </div>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Variants</h3>
              <Switch checked={form.variantsEnabled} onCheckedChange={(v) => set("variantsEnabled", v)} />
            </div>
            {form.variantsEnabled && (
              <>
                <div className="space-y-2">
                  <Label>Variant Group Name</Label>
                  <Input value={form.variantGroupName} onChange={(e) => set("variantGroupName", e.target.value)} placeholder='e.g. "Size", "Weight", "Pack"' />
                </div>
                <Separator />
                <div className="space-y-3">
                  {form.variants.map((v, i) => (
                    <div key={i} className="border rounded-lg p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Variant #{i + 1}</span>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs">Active</Label>
                          <Switch checked={v.isActive} onCheckedChange={(val) => updateVariant(i, "isActive", val)} />
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeVariant(i)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Name *</Label>
                          <Input placeholder="e.g. 250g" value={v.name} onChange={(e) => updateVariant(i, "name", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">SKU</Label>
                          <Input placeholder="e.g. PROD-250G" value={v.sku} onChange={(e) => updateVariant(i, "sku", e.target.value)} />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Price (₹) *</Label>
                          <Input type="number" step="0.01" min="0" value={v.price} onChange={(e) => updateVariant(i, "price", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Sale Price (₹)</Label>
                          <Input type="number" step="0.01" min="0" value={v.salePrice} onChange={(e) => updateVariant(i, "salePrice", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Stock *</Label>
                          <Input type="number" min="0" step="1" value={v.stock} onChange={(e) => updateVariant(i, "stock", e.target.value)} />
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" className="w-full" onClick={addVariant}>
                    <Plus className="h-4 w-4 mr-1" /> Add Variant
                  </Button>
                </div>
              </>
            )}
          </Card>
        </TabsContent>

        {/* ────── Step 6: Nutrition & Details ────── */}
        <TabsContent value="nutrition" className="mt-6">
          <Card className="p-6 space-y-4">
            <h3 className="font-semibold">Nutrition & Details</h3>
            <div className="space-y-2">
              <Label>Ingredients</Label>
              <Textarea value={form.ingredients} onChange={(e) => set("ingredients", e.target.value)} placeholder="e.g. Whole milk, Pasteurized cream, Vitamin D3..." rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Nutritional Info (per 100g/ml)</Label>
              <div className="space-y-2">
                {form.nutritionRows.map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input value={row.key} onChange={(e) => updateNutritionRow(i, "key", e.target.value)} placeholder="Nutrient" className="flex-1" />
                    <Input value={row.value} onChange={(e) => updateNutritionRow(i, "value", e.target.value)} placeholder="Value" className="w-28" />
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={() => removeNutritionRow(i)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addNutritionRow}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Row
                </Button>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Allergen Info</Label>
              <Input value={form.allergenInfo} onChange={(e) => set("allergenInfo", e.target.value)} placeholder="e.g. Contains milk, soy" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Shelf Life</Label>
                <Input value={form.shelfLife} onChange={(e) => set("shelfLife", e.target.value)} placeholder="e.g. 6 months" />
              </div>
              <div className="space-y-2">
                <Label>Storage Instructions</Label>
                <Input value={form.storageInstructions} onChange={(e) => set("storageInstructions", e.target.value)} placeholder="e.g. Keep refrigerated" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Certifications</Label>
              <div className="flex flex-wrap gap-3">
                {CERT_OPTIONS.map((cert) => (
                  <label key={cert} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox checked={form.certifications.includes(cert)} onCheckedChange={() => toggleCert(cert)} />
                    {cert}
                  </label>
                ))}
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* ────── Step 7: SEO ────── */}
        <TabsContent value="seo" className="mt-6">
          <Card className="p-6 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Globe className="h-4 w-4" /> SEO
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="metaTitle">Meta Title</Label>
                <span className={`text-[10px] ${form.metaTitle.length > 60 ? "text-destructive" : "text-muted-foreground"}`}>
                  {form.metaTitle.length}/60
                </span>
              </div>
              <Input id="metaTitle" value={form.metaTitle} onChange={(e) => set("metaTitle", e.target.value)} placeholder="Product title for search engines" maxLength={80} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="metaDesc">Meta Description</Label>
                <span className={`text-[10px] ${form.metaDescription.length > 160 ? "text-destructive" : "text-muted-foreground"}`}>
                  {form.metaDescription.length}/160
                </span>
              </div>
              <Textarea id="metaDesc" value={form.metaDescription} onChange={(e) => set("metaDescription", e.target.value)} placeholder="Brief description for search results" rows={3} maxLength={200} />
            </div>
            {(form.metaTitle || form.name) && (
              <div className="border rounded-lg p-3 space-y-1">
                <p className="text-xs text-muted-foreground">Google Preview</p>
                <p className="text-sm text-blue-600 dark:text-blue-400 font-medium truncate">
                  {form.metaTitle || form.name}
                </p>
                <p className="text-xs text-green-700 dark:text-green-400 truncate">
                  bakaloo.com/products/{form.name?.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "product-slug"}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {form.metaDescription || form.description || "No description provided"}
                </p>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Step navigation + submit */}
      <div className="flex items-center justify-between border-t pt-4">
        <Button type="button" variant="outline" onClick={goPrev} disabled={!canPrev}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Previous
        </Button>
        <p className="text-xs text-muted-foreground">
          Step {stepIdx + 1} of {STEPS.length}
        </p>
        <div className="flex items-center gap-2">
          {canNext && (
            <Button type="button" variant="outline" onClick={goNext}>
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          <Button type="submit" disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {isEdit ? "Update Product" : "Create Product"}
          </Button>
        </div>
      </div>
    </form>
  )
}

/**
 * StepIntro — a friendly banner at the top of each wizard step. Explains in
 * plain language what the step is for, so non-technical operators know why
 * they are filling it in.
 */
function StepIntro({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-brand-200/70 bg-brand-50/70 px-4 py-3 dark:border-brand-800/60 dark:bg-brand-900/20">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white shadow-sm">
        {icon}
      </div>
      <div className="space-y-0.5">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

/**
 * SectionCard — a card with an icon, title, and a short "why this matters"
 * description. Used to give every group of fields clear context.
 */
function SectionCard({
  icon,
  title,
  description,
  children,
  className,
}: {
  icon: React.ReactNode
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={cn("p-6 space-y-5", className)}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand-200 bg-brand-50 text-brand-600 dark:border-brand-800 dark:bg-brand-900/30 dark:text-brand-300">
          {icon}
        </div>
        <div className="space-y-0.5">
          <h3 className="font-semibold leading-tight">{title}</h3>
          {description ? (
            <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </Card>
  )
}

/** FieldLabel — a Label with an optional leading icon and required marker. */
function FieldLabel({
  htmlFor,
  icon,
  required,
  children,
}: {
  htmlFor?: string
  icon?: React.ReactNode
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <Label htmlFor={htmlFor} className="flex items-center gap-1.5">
      {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      {children}
      {required ? <span className="text-destructive">*</span> : null}
    </Label>
  )
}

/** FieldHint — consistent small helper text shown under a field. */
function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs leading-relaxed text-muted-foreground">{children}</p>
}

/**
 * "Also show in other categories" — a checkbox per cross-listable category
 * (every category except this product's own real one) and bundle. Each
 * toggle is its own request (useToggleCategoryMembership), independent of
 * the rest of the product form's save flow, since this is unrelated data
 * (category_products) rather than a field on the product row itself. This
 * is the multi-category feature: e.g. Baby Potato's real category stays
 * "Fresh Vegetables" (set above), and it can also be checked into "Exotic
 * Vegetables" here without duplicating the product.
 */
function CategoryMembershipFields({ productId }: { productId: string }) {
  const { data: categories, isLoading } = useCategoriesForProduct(productId)
  const toggleMembership = useToggleCategoryMembership()

  if (isLoading) {
    return <FieldHint>Loading categories…</FieldHint>
  }

  if (!categories || categories.length === 0) {
    return <FieldHint>No other categories to cross-list into yet.</FieldHint>
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2">
      {categories.map((category) => (
        <label
          key={category.id}
          className="flex items-center gap-2.5 text-sm cursor-pointer min-w-0"
        >
          <Checkbox
            checked={!!category.is_member}
            disabled={toggleMembership.isPending}
            onCheckedChange={(checked) =>
              toggleMembership.mutate({
                categoryId: category.id,
                productId,
                isMember: checked === true,
              })
            }
          />
          <span className="truncate">
            {category.category_type === "BUNDLE" ? "🎁 " : ""}
            {category.name}
          </span>
          {!category.is_active && (
            <span className="text-xs text-muted-foreground shrink-0">(inactive)</span>
          )}
        </label>
      ))}
    </div>
  )
}

function CollapsibleCard({
  title,
  description,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string
  description: string
  icon: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Card className="overflow-hidden border-border/80">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-muted/40"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full border border-border/70 bg-muted/50 p-2 text-muted-foreground">
            {icon}
          </div>
          <div className="space-y-1">
            <div className="font-semibold">{title}</div>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="rounded-full border border-border/70 bg-background p-2 text-muted-foreground">
          {open ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </div>
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border/70 px-6 py-5">
            {children}
          </div>
        </div>
      </div>
    </Card>
  )
}

function ProductFormSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-6 space-y-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </Card>
        ))}
      </div>
      <div className="space-y-6">
        <Card className="p-6 space-y-4">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
        </Card>
        <Card className="p-6 space-y-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-10 w-full" />
        </Card>
      </div>
    </div>
  )
}
