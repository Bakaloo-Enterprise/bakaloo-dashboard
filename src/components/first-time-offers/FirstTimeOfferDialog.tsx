"use client"

import { useEffect, useState } from "react"
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
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCreateFirstTimeOffer, useUpdateFirstTimeOffer } from "@/hooks/useFirstTimeOffers"
import { useCoupons } from "@/hooks/useCoupons"
import { getProductDetail } from "@/services/products.service"
import { CategoryScopePicker, ProductScopePicker } from "@/components/coupons/CouponScopePicker"
import type {
  FirstTimeOffer,
  CreateFirstTimeOfferPayload,
  FirstTimeOfferRewardType,
  CashbackCreditTrigger,
} from "@/types/first-time-offer.types"

type ScopeMode = "ALL" | "CATEGORY" | "PRODUCT"

interface FirstTimeOfferDialogProps {
  open: boolean
  onClose: () => void
  offer?: FirstTimeOffer | null
}

const REWARD_TYPE_LABELS: Record<FirstTimeOfferRewardType, string> = {
  FREE_DELIVERY: "Free delivery",
  FLAT_DISCOUNT: "Flat discount (₹)",
  PERCENTAGE_DISCOUNT: "Percentage discount (%)",
  WALLET_CASHBACK: "Wallet cashback (₹)",
  COUPON_UNLOCK: "Unlock a coupon",
}

const TRIGGER_LABELS: Record<CashbackCreditTrigger, string> = {
  PAYMENT_SUCCESS: "After payment success",
  ORDER_CONFIRMED: "After order confirmed",
  ORDER_DELIVERED: "After order delivered (safest)",
}

const INITIAL: CreateFirstTimeOfferPayload & { isActive: boolean } = {
  name: "",
  minOrderAmount: 0,
  rewardType: "FREE_DELIVERY",
  rewardValue: undefined,
  maxDiscount: undefined,
  unlockCouponId: undefined,
  startAt: "",
  endAt: "",
  autoApply: true,
  paymentMethodScope: "ALL",
  cashbackCreditTrigger: "ORDER_DELIVERED",
  applicableCategoryIds: [],
  applicableProductIds: [],
  grantsFreeDelivery: false,
  isActive: true,
}

export function FirstTimeOfferDialog({ open, onClose, offer }: FirstTimeOfferDialogProps) {
  const [form, setForm] = useState(INITIAL)
  const [scopeMode, setScopeMode] = useState<ScopeMode>("ALL")
  const [scopeProducts, setScopeProducts] = useState<{ id: string; name: string }[]>([])
  const isEdit = !!offer
  const createMutation = useCreateFirstTimeOffer()
  const updateMutation = useUpdateFirstTimeOffer()
  // First-time offers are platform-wide, not a shop feature — fetch
  // regardless of the admin's current shop selection (see useCoupons.ts's
  // doc comment).
  const { data: couponsData } = useCoupons({ limit: 50 }, { shopScoped: false, fetchAll: true })

  useEffect(() => {
    if (offer) {
      setForm({
        name: offer.name,
        minOrderAmount: offer.minOrderAmount,
        rewardType: offer.rewardType,
        rewardValue: offer.rewardValue ?? undefined,
        maxDiscount: offer.maxDiscount ?? undefined,
        unlockCouponId: offer.unlockCouponId ?? undefined,
        startAt: offer.startAt ? offer.startAt.slice(0, 16) : "",
        endAt: offer.endAt ? offer.endAt.slice(0, 16) : "",
        autoApply: offer.autoApply,
        paymentMethodScope: offer.paymentMethodScope,
        cashbackCreditTrigger: offer.cashbackCreditTrigger,
        applicableCategoryIds: offer.applicableCategoryIds ?? [],
        applicableProductIds: offer.applicableProductIds ?? [],
        grantsFreeDelivery: offer.grantsFreeDelivery ?? false,
        isActive: offer.isActive,
      })
      setScopeProducts([])
      if (offer.applicableCategoryIds?.length) {
        setScopeMode("CATEGORY")
      } else if (offer.applicableProductIds?.length) {
        setScopeMode("PRODUCT")
        Promise.all(offer.applicableProductIds.map((id) => getProductDetail(id))).then((products) =>
          setScopeProducts(products.map((p) => ({ id: p.id, name: p.name })))
        )
      } else {
        setScopeMode("ALL")
      }
    } else {
      setForm(INITIAL)
      setScopeMode("ALL")
      setScopeProducts([])
    }
  }, [offer, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const { isActive, ...rest } = form
    // null = "clear the scope" (accepted by the update schema); the create
    // schema doesn't accept null for these two fields, so createMutation
    // below swaps null back to undefined (= omit entirely, same effect).
    const scopeCategoryIds = scopeMode === "CATEGORY" && rest.applicableCategoryIds?.length ? rest.applicableCategoryIds : null
    const scopeProductIds = scopeMode === "PRODUCT" && rest.applicableProductIds?.length ? rest.applicableProductIds : null
    const payload = {
      ...rest,
      // datetime-local gives "2026-07-13T15:53" (no seconds/timezone) —
      // the backend requires a full RFC3339 date-time, which rejects that
      // with "must match format \"date-time\"".
      startAt: rest.startAt ? new Date(rest.startAt).toISOString() : undefined,
      endAt: rest.endAt ? new Date(rest.endAt).toISOString() : undefined,
      applicableCategoryIds: scopeCategoryIds,
      applicableProductIds: scopeProductIds,
    }

    if (isEdit && offer) {
      updateMutation.mutate({ id: offer.id, payload: { ...payload, isActive } }, { onSuccess: onClose })
    } else {
      createMutation.mutate(
        {
          ...payload,
          applicableCategoryIds: scopeCategoryIds ?? undefined,
          applicableProductIds: scopeProductIds ?? undefined,
        },
        { onSuccess: onClose }
      )
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const showRewardValue = form.rewardType === "FLAT_DISCOUNT" || form.rewardType === "PERCENTAGE_DISCOUNT" || form.rewardType === "WALLET_CASHBACK"
  const showMaxDiscount = form.rewardType === "PERCENTAGE_DISCOUNT"
  const showCouponPicker = form.rewardType === "COUPON_UNLOCK"
  const showCashbackTrigger = form.rewardType === "WALLET_CASHBACK"

  // Same constraint as Cart Milestones' COUPON_UNLOCK reward: unlocking a
  // coupon only takes effect for a coupon whose own Target Audience is
  // "Individual" — any other audience runs its own separate eligibility
  // rule and ignores this unlock entirely. Only offering compatible, active
  // coupons here prevents that dead-end instead of surfacing it as a
  // save-time error.
  const allCoupons = couponsData?.data ?? []
  const eligibleCoupons = allCoupons.filter((c) => c.targetType === "INDIVIDUAL" && c.isActive)
  // An offer that saved fine before can still end up pointing at an
  // incompatible coupon later — e.g. someone edits that SAME coupon's
  // Target Audience for an unrelated feature (like a Cart Milestone) after
  // it was already linked here. Keep it selectable (so the picker doesn't
  // just go blank) but call out exactly what's wrong.
  const currentCoupon = form.unlockCouponId
    ? allCoupons.find((c) => c.id === form.unlockCouponId)
    : undefined
  const currentCouponIncompatible =
    !!currentCoupon && (currentCoupon.targetType !== "INDIVIDUAL" || !currentCoupon.isActive)
  const couponOptions = currentCouponIncompatible
    ? [currentCoupon, ...eligibleCoupons]
    : eligibleCoupons

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit First-Time Offer" : "Create First-Time Offer"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ft-name">Offer Name *</Label>
            <Input
              id="ft-name"
              placeholder="e.g. First order above ₹999"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              maxLength={100}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ft-min">Minimum Order Amount</Label>
            <Input
              id="ft-min"
              type="number"
              min={0}
              value={form.minOrderAmount ?? ""}
              onChange={(e) => setForm({ ...form, minOrderAmount: parseFloat(e.target.value) || 0 })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Reward Type *</Label>
              <Select
                value={form.rewardType}
                onValueChange={(v) => setForm({ ...form, rewardType: v as FirstTimeOfferRewardType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(REWARD_TYPE_LABELS) as FirstTimeOfferRewardType[]).map((type) => (
                    <SelectItem key={type} value={type}>
                      {REWARD_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {showRewardValue && (
              <div className="space-y-1.5">
                <Label htmlFor="ft-value">Reward Value *</Label>
                <Input
                  id="ft-value"
                  type="number"
                  min={0}
                  value={form.rewardValue ?? ""}
                  onChange={(e) => setForm({ ...form, rewardValue: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>
            )}
          </div>

          {showMaxDiscount && (
            <div className="space-y-1.5">
              <Label htmlFor="ft-max">Max Discount Cap</Label>
              <Input
                id="ft-max"
                type="number"
                min={0}
                value={form.maxDiscount ?? ""}
                onChange={(e) =>
                  setForm({ ...form, maxDiscount: e.target.value ? parseFloat(e.target.value) : undefined })
                }
                placeholder="No cap"
              />
            </div>
          )}

          {/* Free delivery — independent of reward type. Can stack with a
              real discount/cashback reward instead of forcing a choice
              between the two, exactly like the equivalent coupon toggle. */}
          <div className="rounded-lg border p-3 space-y-1">
            <div className="flex items-center gap-3">
              <Switch
                checked={form.grantsFreeDelivery}
                onCheckedChange={(v) => setForm({ ...form, grantsFreeDelivery: v })}
              />
              <Label>Also grants free delivery</Label>
            </div>
            <p className="text-xs text-muted-foreground pl-[52px]">
              When on, this offer waives the delivery fee — on top of any discount/cashback above, not
              instead of it — as long as the order meets the Minimum Order Amount above.
            </p>
          </div>

          {/* Applies to — category/bundle/product scope. Empty scope
              (Whole Order) is the existing default: nothing here changes
              for an offer that doesn't set this. */}
          <div className="rounded-lg border p-3 space-y-2">
            <Label>Applies to</Label>
            <Select
              value={scopeMode}
              onValueChange={(v) => {
                const next = v as ScopeMode
                setScopeMode(next)
                setForm({ ...form, applicableCategoryIds: [], applicableProductIds: [] })
                setScopeProducts([])
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Whole order — every product</SelectItem>
                <SelectItem value="CATEGORY">Specific categories or bundles</SelectItem>
                <SelectItem value="PRODUCT">Specific products</SelectItem>
              </SelectContent>
            </Select>

            {scopeMode === "CATEGORY" && (
              <CategoryScopePicker
                selectedIds={form.applicableCategoryIds ?? []}
                onChange={(ids) => setForm({ ...form, applicableCategoryIds: ids })}
              />
            )}
            {scopeMode === "PRODUCT" && (
              <ProductScopePicker
                selected={scopeProducts}
                onChange={(next) => {
                  setScopeProducts(next)
                  setForm({ ...form, applicableProductIds: next.map((p) => p.id) })
                }}
              />
            )}

            <p className="text-xs text-muted-foreground">
              {scopeMode === "ALL"
                ? "The reward, and the Minimum Order Amount above, apply to the customer's entire cart."
                : "The reward, and the Minimum Order Amount above, only ever count the products in the picked categories/bundles/products — other items in the same order don't count toward it."}
            </p>
          </div>

          {showCouponPicker && (
            <div className="space-y-1.5">
              <Label>Coupon to Unlock *</Label>
              <Select
                value={form.unlockCouponId ?? ""}
                onValueChange={(v) => setForm({ ...form, unlockCouponId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a coupon..." />
                </SelectTrigger>
                <SelectContent>
                  {couponOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.code}
                      {(c.targetType !== "INDIVIDUAL" || !c.isActive) && " ⚠️ won't work as-is"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentCouponIncompatible ? (
                <p className="text-xs text-destructive">
                  &quot;{currentCoupon?.code}&quot; has Target Audience &quot;{currentCoupon?.targetType}
                  &quot;{!currentCoupon?.isActive ? " and is inactive" : ""} — pick a different coupon, or
                  go to Coupons and set its Target Audience to &quot;Individual&quot;
                  {!currentCoupon?.isActive ? " and reactivate it" : ""} to keep using this one.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Only active coupons with Target Audience &quot;Individual&quot; can be unlocked this
                  way — that&apos;s the only audience setting an unlock actually takes effect on.
                </p>
              )}
            </div>
          )}

          {showCashbackTrigger && (
            <div className="space-y-1.5">
              <Label>Cashback Credit Timing</Label>
              <Select
                value={form.cashbackCreditTrigger}
                onValueChange={(v) => setForm({ ...form, cashbackCreditTrigger: v as CashbackCreditTrigger })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TRIGGER_LABELS) as CashbackCreditTrigger[]).map((trigger) => (
                    <SelectItem key={trigger} value={trigger}>
                      {TRIGGER_LABELS[trigger]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Payment Method</Label>
            <Select
              value={form.paymentMethodScope}
              onValueChange={(v) => setForm({ ...form, paymentMethodScope: v as "ALL" | "ONLINE_ONLY" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All payment methods (incl. COD)</SelectItem>
                <SelectItem value="ONLINE_ONLY">Online payment only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ft-from">Start Date</Label>
              <Input
                id="ft-from"
                type="datetime-local"
                value={form.startAt ?? ""}
                onChange={(e) => setForm({ ...form, startAt: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ft-until">End Date</Label>
              <Input
                id="ft-until"
                type="datetime-local"
                value={form.endAt ?? ""}
                onChange={(e) => setForm({ ...form, endAt: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              checked={form.autoApply}
              onCheckedChange={(v) => setForm({ ...form, autoApply: v })}
            />
            <Label>Auto-apply (no claim step needed)</Label>
          </div>

          {isEdit && (
            <div className="flex items-center gap-3">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              <Label>Active</Label>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : isEdit ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
