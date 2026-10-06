"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCoupons } from "@/hooks/useCoupons"
import { issueAbandonedCartCoupon } from "@/services/abandoned-carts.service"
import type { IssueCouponPayload } from "@/types/abandoned-cart.types"

interface SendCouponDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Abandoned-cart episode ids to issue a coupon to — one for a row action, many for a bulk action. */
  cartIds: string[]
}

const CREATE_INITIAL = {
  code: "",
  description: "",
  discountType: "PERCENTAGE" as "PERCENTAGE" | "FLAT" | "FREE_DELIVERY" | "CASHBACK",
  discountValue: 0,
  minOrderAmount: 0,
  maxDiscount: undefined as number | undefined,
  usageLimit: undefined as number | undefined,
  perUserLimit: 1,
  validFrom: "",
  validUntil: "",
}

/**
 * Thin orchestration over the app's real coupon engine — "Create new" calls
 * `CouponsService.create()` with `targetType` forced server-side to the
 * episode's single user; "Assign existing" calls the existing non-destructive
 * `CouponsRepository.addTargetUser()`. No parallel coupon system.
 *
 * "Create new" is a single-target action only: a coupon's `code` is
 * globally unique, so looping a create across a bulk selection would
 * collide on the 2nd call. Bulk selections (`cartIds.length > 1`) can only
 * assign an already-existing coupon to every selected episode's user.
 */
export function SendCouponDialog({ open, onOpenChange, cartIds }: SendCouponDialogProps) {
  const count = cartIds.length
  const canCreateNew = count === 1
  const [mode, setMode] = useState<"create" | "assign">(canCreateNew ? "create" : "assign")
  const [form, setForm] = useState(CREATE_INITIAL)
  const [couponId, setCouponId] = useState("")
  const [sending, setSending] = useState(false)
  // Sending a coupon to a specific customer isn't a shop feature — fetch
  // regardless of the admin's current shop selection (see useCoupons.ts's
  // doc comment).
  const { data: couponsData } = useCoupons({ limit: 50 }, { shopScoped: false, fetchAll: true })
  const qc = useQueryClient()

  const activeCoupons = (couponsData?.data ?? []).filter((c) => c.isActive)

  function reset() {
    setForm(CREATE_INITIAL)
    setCouponId("")
    setMode(canCreateNew ? "create" : "assign")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)

    let payload: IssueCouponPayload
    if (mode === "assign") {
      payload = { couponId }
    } else {
      payload = {
        code: form.code.toUpperCase().trim(),
        ...(form.description && { description: form.description }),
        discountType: form.discountType,
        discountValue: form.discountValue,
        ...(form.minOrderAmount ? { minOrderAmount: form.minOrderAmount } : {}),
        ...(form.maxDiscount ? { maxDiscount: form.maxDiscount } : {}),
        ...(form.usageLimit ? { usageLimit: form.usageLimit } : {}),
        ...(form.perUserLimit ? { perUserLimit: form.perUserLimit } : {}),
        // datetime-local gives "2026-07-13T15:53" (no seconds/timezone) —
        // stored as-is this lands in Postgres under the server's local
        // session timezone instead of the admin's intended moment.
        ...(form.validFrom ? { validFrom: new Date(form.validFrom).toISOString() } : {}),
        ...(form.validUntil ? { validUntil: new Date(form.validUntil).toISOString() } : {}),
      }
    }

    const results = await Promise.allSettled(
      cartIds.map((id) => issueAbandonedCartCoupon(id, payload)),
    )
    setSending(false)
    const failed = results.filter((r) => r.status === "rejected").length
    const succeeded = results.length - failed
    if (succeeded > 0) {
      toast.success(succeeded === 1 ? "Coupon issued" : `Coupon issued to ${succeeded} customers`)
    }
    if (failed > 0) {
      toast.error(`${failed} coupon${failed === 1 ? "" : "s"} failed to issue`)
    }
    qc.invalidateQueries({ queryKey: ["abandoned-carts"] })
    qc.invalidateQueries({ queryKey: ["coupons"] })
    if (succeeded > 0) {
      onOpenChange(false)
      reset()
    }
  }

  const canSubmit =
    mode === "assign" ? !!couponId : !!form.code && form.discountType !== undefined &&
      (form.discountType === "FREE_DELIVERY" || form.discountValue > 0)

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Send Coupon {count > 1 ? `to ${count} Customers` : ""}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Coupon Source</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as "create" | "assign")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="create" disabled={!canCreateNew}>
                  Create a new coupon
                </SelectItem>
                <SelectItem value="assign">Assign an existing coupon</SelectItem>
              </SelectContent>
            </Select>
            {!canCreateNew && (
              <p className="text-xs text-muted-foreground">
                Bulk selections can only assign an existing coupon — a coupon code must be
                unique, so creating one new code per customer isn&apos;t possible here.
              </p>
            )}
          </div>

          {mode === "assign" ? (
            <div className="space-y-1.5">
              <Label>Coupon *</Label>
              <Select value={couponId} onValueChange={setCouponId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an active coupon…" />
                </SelectTrigger>
                <SelectContent>
                  {activeCoupons.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.code} —{" "}
                      {c.discountType === "PERCENTAGE"
                        ? `${c.discountValue}% off`
                        : c.discountType === "FLAT"
                        ? `₹${c.discountValue} off`
                        : c.discountType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activeCoupons.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No active coupons yet — create one under Coupons first.
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="cc-code">Coupon Code *</Label>
                <Input
                  id="cc-code"
                  placeholder="e.g. COMEBACK20"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  required
                  maxLength={50}
                  className="font-mono uppercase"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cc-desc">Description</Label>
                <Textarea
                  id="cc-desc"
                  placeholder="Optional description..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  maxLength={500}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Discount Type *</Label>
                  <Select
                    value={form.discountType}
                    onValueChange={(v) =>
                      setForm({ ...form, discountType: v as typeof form.discountType })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERCENTAGE">Percentage (%)</SelectItem>
                      <SelectItem value="FLAT">Flat (₹)</SelectItem>
                      <SelectItem value="FREE_DELIVERY">Free Delivery</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.discountType !== "FREE_DELIVERY" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="cc-value">Discount Value *</Label>
                    <Input
                      id="cc-value"
                      type="number"
                      min={0.01}
                      step={0.01}
                      value={form.discountValue || ""}
                      onChange={(e) =>
                        setForm({ ...form, discountValue: parseFloat(e.target.value) || 0 })
                      }
                      required
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cc-min">Min Order Amount</Label>
                  <Input
                    id="cc-min"
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.minOrderAmount || ""}
                    onChange={(e) =>
                      setForm({ ...form, minOrderAmount: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cc-max">Max Discount</Label>
                  <Input
                    id="cc-max"
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.maxDiscount ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        maxDiscount: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                    placeholder="No limit"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cc-from">Valid From</Label>
                  <Input
                    id="cc-from"
                    type="datetime-local"
                    value={form.validFrom}
                    onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cc-until">Valid Until</Label>
                  <Input
                    id="cc-until"
                    type="datetime-local"
                    value={form.validUntil}
                    onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                This coupon will be individually targeted to this customer only — nobody else
                can redeem it.
              </p>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={sending || !canSubmit}>
              {sending ? "Issuing…" : count > 1 ? `Issue to ${count}` : "Issue Coupon"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
