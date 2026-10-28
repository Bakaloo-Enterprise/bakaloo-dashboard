"use client"

/**
 * Bundle creation — deliberately a separate, simpler dialog from the
 * regular Category dialog (name/description/image only, no parent picker
 * since bundles are always top-level promo groupings). Product membership
 * is managed afterward via ProductRankingPanel, not here, so creating a
 * bundle is a fast two-field action.
 */

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { ImageUpload } from "@/components/products/ImageUpload"
import { useCreateBundle } from "@/hooks/useCategories"

interface BundleDialogProps {
  open: boolean
  onClose: () => void
}

const INITIAL = { name: "", description: "", image_url: "" }

export function BundleDialog({ open, onClose }: BundleDialogProps) {
  const [form, setForm] = useState(INITIAL)
  const createBundle = useCreateBundle()

  function handleClose() {
    setForm(INITIAL)
    onClose()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    createBundle.mutate(
      {
        name: form.name,
        description: form.description || undefined,
        image_url: form.image_url || undefined,
      },
      { onSuccess: handleClose }
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Bundle</DialogTitle>
          <DialogDescription>
            A promo grouping of products (e.g. &ldquo;Milkshake Offer&rdquo;) — hidden from the
            normal category list, surfaced only through a banner you link to it. Add products
            after creating it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bundle-name">Name *</Label>
            <Input
              id="bundle-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Milkshake Offer"
              required
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bundle-desc">Description</Label>
            <Input
              id="bundle-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief description"
              maxLength={500}
            />
          </div>
          <div className="space-y-2">
            <Label>Bundle Image</Label>
            <ImageUpload kind="categories"
              value={form.image_url || null}
              onChange={(url) => setForm({ ...form, image_url: url ?? "" })}
              label="Upload Bundle Image"
              helperText={
                <span>Shown in admin tooling only — customers see the banner you link to this bundle.</span>
              }
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createBundle.isPending}>
              {createBundle.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Bundle
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
