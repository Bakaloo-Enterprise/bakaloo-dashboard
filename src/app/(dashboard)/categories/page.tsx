"use client"

import { useState, useCallback } from "react"
import Image from "next/image"
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
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { PageHeader } from "@/components/shared/PageHeader"
import { ImageUpload } from "@/components/products/ImageUpload"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BundlesTab } from "@/components/categories/BundlesTab"
import { ProductRankingPanel } from "@/components/categories/ProductRankingPanel"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tags,
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
  Loader2,
  ChevronRight,
  FolderOpen,
  GripVertical,
  ListOrdered,
} from "lucide-react"
import {
  useCategories,
  useCategoryTree,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from "@/hooks/useCategories"
import type { Category, CategoryTree } from "@/types"
import { usePermissions } from "@/hooks/usePermissions"

interface CategoryFormData {
  name: string
  description: string
  image_url: string
  parent_id: string
  sort_order: string
  is_active: boolean
}

const INITIAL_FORM: CategoryFormData = {
  name: "",
  description: "",
  image_url: "",
  parent_id: "none",
  sort_order: "0",
  is_active: true,
}

export default function CategoriesPage() {
  const { data: categories, isLoading } = useCategories()
  const { data: tree } = useCategoryTree()
  const createCategory = useCreateCategory()
  const updateCategory = useUpdateCategory()
  const deleteCategory = useDeleteCategory()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CategoryFormData>(INITIAL_FORM)
  const [rankingFor, setRankingFor] = useState<Category | null>(null)

  const isPending = createCategory.isPending || updateCategory.isPending
  const { can } = usePermissions()
  const canManage = can("categories.manage")

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  )

  /** Handle drag-end: reorder siblings at the same level */
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id || !categories) return

      // Find the dragged category and drop target
      const draggedCat = categories.find((c) => c.id === active.id)
      const overCat = categories.find((c) => c.id === over.id)
      if (!draggedCat || !overCat) return

      // Only allow reorder within same parent
      if (draggedCat.parent_id !== overCat.parent_id) return

      // Get siblings sorted by display_order
      const siblings = categories
        .filter((c) => c.parent_id === draggedCat.parent_id)
        .sort((a, b) => a.sort_order - b.sort_order)

      const oldIndex = siblings.findIndex((c) => c.id === active.id)
      const newIndex = siblings.findIndex((c) => c.id === over.id)
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return

      const reordered = arrayMove(siblings, oldIndex, newIndex)

      // Update display_order for each moved item
      reordered.forEach((cat, idx) => {
        if (cat.sort_order !== idx) {
          updateCategory.mutate({ id: cat.id, payload: { sort_order: idx } })
        }
      })
    },
    [categories, updateCategory]
  )

  const openCreate = useCallback((parentId?: string) => {
    setEditingId(null)
    setForm({
      ...INITIAL_FORM,
      parent_id: parentId ?? "none",
    })
    setDialogOpen(true)
  }, [])

  const openEdit = useCallback(
    (cat: Category) => {
      setEditingId(cat.id)
      setForm({
        name: cat.name,
        description: cat.description ?? "",
        image_url: cat.image_url ?? "",
        parent_id: cat.parent_id ?? "none",
        sort_order: cat.sort_order.toString(),
        is_active: cat.is_active,
      })
      setDialogOpen(true)
    },
    []
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      name: form.name,
      description: form.description || undefined,
      image_url: form.image_url || undefined,
      parent_id: form.parent_id === "none" ? null : form.parent_id,
      sort_order: parseInt(form.sort_order, 10) || 0,
      is_active: form.is_active,
    }

    if (editingId) {
      updateCategory.mutate(
        { id: editingId, payload },
        { onSuccess: () => setDialogOpen(false) }
      )
    } else {
      createCategory.mutate(payload, {
        onSuccess: () => setDialogOpen(false),
      })
    }
  }

  const set = (key: keyof CategoryFormData, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  // Categories are limited to two levels, so only top-level categories
  // (no parent of their own) can be picked as a parent — picking a
  // subcategory here would create a third level.
  const parentOptions = (categories ?? []).filter(
    (c) => c.id !== editingId && !c.parent_id
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <PageHeader title="Categories" subtitle="Organize products into categories, and group promo bundles" />
      </div>

      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="bundles">Bundles</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="space-y-4 pt-4">
          <div className="flex justify-end">
            {canManage && (
              <Button size="sm" onClick={() => openCreate()}>
                <Plus className="h-4 w-4 mr-1.5" />
                Add Category
              </Button>
            )}
          </div>

          {/* Category Tree */}
          {isLoading ? (
            <CategoriesSkeleton />
          ) : !tree || tree.length === 0 ? (
            <Card className="p-12 text-center">
              <Tags className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-3">No categories yet</p>
              {canManage && (
                <Button size="sm" onClick={() => openCreate()}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Create your first category
                </Button>
              )}
            </Card>
          ) : (
            <Card className="divide-y">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={tree.map((c) => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {tree.map((cat) => (
                    <CategoryRow
                      key={cat.id}
                      category={cat}
                      depth={0}
                      onEdit={canManage ? (cat) => setTimeout(() => openEdit(cat), 0) : undefined}
                      onDelete={canManage ? (id) => deleteCategory.mutate(id) : undefined}
                      onAddChild={
                        canManage
                          ? (parentId) => setTimeout(() => openCreate(parentId), 0)
                          : undefined
                      }
                      onRank={canManage ? (cat) => setRankingFor(cat) : undefined}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="bundles" className="pt-4">
          <BundlesTab canManage={canManage} />
        </TabsContent>
      </Tabs>

      <ProductRankingPanel category={rankingFor} onClose={() => setRankingFor(null)} />

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Category" : "New Category"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cat-name">Name *</Label>
              <Input
                id="cat-name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Fruits & Vegetables"
                required
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cat-desc">Description</Label>
              <Input
                id="cat-desc"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Brief description"
                maxLength={500}
              />
            </div>

            <div className="space-y-2">
              <Label>Category Image</Label>
              <ImageUpload kind="categories"
                value={form.image_url || null}
                onChange={(url) => set("image_url", url ?? "")}
                label="Upload Category Image"
                helperText={
                  <div className="flex flex-col gap-0.5">
                    <span>• <strong>Size:</strong> Max 5MB</span>
                    <span>• <strong>Format:</strong> PNG (Transparent recommended)</span>
                    <span>• <strong>Aspect Ratio:</strong> 1:1 (Square, e.g. 150x150px)</span>
                  </div>
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Parent Category</Label>
                <Select value={form.parent_id} onValueChange={(v) => set("parent_id", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="None (top-level)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (top-level)</SelectItem>
                    {parentOptions.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat-order">Sort Order</Label>
                <Input
                  id="cat-order"
                  type="number"
                  min="0"
                  step="1"
                  value={form.sort_order}
                  onChange={(e) => set("sort_order", e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="cat-active">Active</Label>
              <Switch
                id="cat-active"
                checked={form.is_active}
                onCheckedChange={(v) => set("is_active", v)}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingId ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CategoryRow({
  category,
  depth,
  onEdit,
  onDelete,
  onAddChild,
  onRank,
}: {
  category: CategoryTree
  depth: number
  onEdit?: (cat: Category) => void
  onDelete?: (id: string) => void
  onAddChild?: (parentId: string) => void
  onRank?: (cat: Category) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = category.children.length > 0

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    paddingLeft: `${16 + depth * 28}px`,
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
        {...attributes}
      >
        <button
          type="button"
          className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground/50" />
        </button>

        {/* Expand toggle */}
        <button
          type="button"
          className="flex-shrink-0 w-5 h-5 flex items-center justify-center"
          onClick={() => setExpanded(!expanded)}
        >
          {hasChildren ? (
            <ChevronRight
              className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""
                }`}
            />
          ) : (
            <span className="w-4" />
          )}
        </button>

        {/* Image */}
        <div className="relative h-8 w-8 rounded-md bg-muted overflow-hidden flex-shrink-0">
          {category.image_url ? (
            <Image
              src={category.image_url}
              alt={category.name}
              fill
              className="object-cover"
              sizes="32px"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{category.name}</p>
          {category.description && (
            <p className="text-xs text-muted-foreground truncate">{category.description}</p>
          )}
        </div>

        {/* Meta info */}
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground bg-transparent">
            {category.id}
          </Badge>
          <Badge variant="secondary" className="text-[10px] font-normal">
            {category.product_count ?? 0} products
          </Badge>
        </div>

        {/* Status */}
        {!category.is_active && (
          <Badge variant="secondary" className="text-[10px]">
            Inactive
          </Badge>
        )}

        {/* Actions */}
        {onEdit && onDelete && onAddChild && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(category)}>
              <Pencil className="h-3.5 w-3.5 mr-2" />
              Edit
            </DropdownMenuItem>
            {onRank && (
              <DropdownMenuItem onClick={() => onRank(category)}>
                <ListOrdered className="h-3.5 w-3.5 mr-2" />
                Rank products
              </DropdownMenuItem>
            )}
            {/* Categories are limited to two levels — a subcategory
                (depth > 0) can't have its own subcategory. */}
            {depth === 0 && (
              <DropdownMenuItem onClick={() => onAddChild(category.id)}>
                <Plus className="h-3.5 w-3.5 mr-2" />
                Add Subcategory
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => onDelete(category.id)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        )}
      </div>

      {/* Children */}
      {expanded && category.children.length > 0 && (
        <SortableContext
          items={category.children.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {category.children.map((child) => (
            <CategoryRow
              key={child.id}
              category={child}
              depth={depth + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
              onRank={onRank}
            />
          ))}
        </SortableContext>
      )}
    </>
  )
}

function CategoriesSkeleton() {
  return (
    <Card className="divide-y">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-8 w-8 rounded-md" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-7 w-7" />
        </div>
      ))}
    </Card>
  )
}
