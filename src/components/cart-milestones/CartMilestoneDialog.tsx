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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import { useCreateCartMilestone, useUpdateCartMilestone } from "@/hooks/useCartMilestones"
import { useCustomerSegments } from "@/hooks/useCustomerSegments"
import { useCoupons } from "@/hooks/useCoupons"
import { getProductDetail } from "@/services/products.service"
import { CategoryScopePicker, ProductScopePicker } from "@/components/coupons/CouponScopePicker"
import type {
  CartMilestone,
  CreateCartMilestonePayload,
  CartMilestoneRewardType,
  MilestoneUserType,
  CashbackCreditTrigger,
} from "@/types/cart-milestone.types"

type AmountMode = "FLAT" | "PERCENTAGE"
type ScopeMode = "ALL" | "CATEGORY" | "PRODUCT"

interface CartMilestoneDialogProps {
  open: boolean
  onClose: () => void
  milestone?: CartMilestone | null
}

const REWARD_TYPE_LABELS: Record<CartMilestoneRewardType, string> = {
  CASHBACK: "Wallet cashback (₹)",
  FLAT_DISCOUNT: "Instant discount (₹)",
  COUPON_UNLOCK: "Unlock a coupon",
}

const USER_TYPE_LABELS: Record<MilestoneUserType, string> = {
  ALL: "All users",
  FIRST_TIME: "First-time users only",
  SEGMENT: "A customer segment",
}

const TRIGGER_LABELS: Record<CashbackCreditTrigger, string> = {
  PAYMENT_SUCCESS: "After payment success",
  ORDER_CONFIRMED: "After order confirmed",
  ORDER_DELIVERED: "After order delivered (safest)",
}

const INITIAL: CreateCartMilestonePayload & { isActive: boolean } = {
  name: "",
  minCartAmount: 0,
  rewardType: "CASHBACK",
  rewardValue: undefined,
  rewardPercent: undefined,
  maxDiscount: undefined,
  unlockCouponId: undefined,
  messageBefore: "",
  messageAfter: "",
  iconUrl: undefined,
  applicableUserType: "ALL",
  applicableSegmentId: undefined,
  excludedSegmentId: undefined,
  excludeFirstTimeUsers: false,
  stackableWithCoupon: true,
  priority: 0,
  cashbackCreditTrigger: "ORDER_DELIVERED",
  usageLimitPerUser: undefined,
  grantsFreeDelivery: false,
  applicableCategoryIds: [],
  applicableProductIds: [],
  isActive: true,
}

export function CartMilestoneDialog({ open, onClose, milestone }: CartMilestoneDialogProps) {
  const [form, setForm] = useState(INITIAL)
  const [amountMode, setAmountMode] = useState<AmountMode>("FLAT")
  const [scopeMode, setScopeMode] = useState<ScopeMode>("ALL")
  const [scopeProducts, setScopeProducts] = useState<{ id: string; name: string }[]>([])
  const isEdit = !!milestone
  const createMutation = useCreateCartMilestone()
  const updateMutation = useUpdateCartMilestone()
  const { data: segments } = useCustomerSegments()
  // Cart milestones are platform-wide, not a shop feature — fetch
  // regardless of the admin's current shop selection (see useCoupons.ts's
  // doc comment).
  const { data: couponsData } = useCoupons({ limit: 50 }, { shopScoped: false, fetchAll: true })

  useEffect(() => {
    if (milestone) {
      setForm({
        name: milestone.name,
        minCartAmount: milestone.minCartAmount,
        rewardType: milestone.rewardType,
        rewardValue: milestone.rewardValue ?? undefined,
        rewardPercent: milestone.rewardPercent ?? undefined,
        maxDiscount: milestone.maxDiscount ?? undefined,
        unlockCouponId: milestone.unlockCouponId ?? undefined,
        messageBefore: milestone.messageBefore ?? "",
        messageAfter: milestone.messageAfter ?? "",
        iconUrl: milestone.iconUrl ?? undefined,
        applicableUserType: milestone.applicableUserType,
        applicableSegmentId: milestone.applicableSegmentId ?? undefined,
        excludedSegmentId: milestone.excludedSegmentId ?? undefined,
        excludeFirstTimeUsers: milestone.excludeFirstTimeUsers ?? false,
        stackableWithCoupon: milestone.stackableWithCoupon,
        priority: milestone.priority,
        cashbackCreditTrigger: milestone.cashbackCreditTrigger,
        usageLimitPerUser: milestone.usageLimitPerUser ?? undefined,
        grantsFreeDelivery: milestone.grantsFreeDelivery ?? false,
        applicableCategoryIds: milestone.applicableCategoryIds ?? [],
        applicableProductIds: milestone.applicableProductIds ?? [],
        isActive: milestone.isActive,
      })
      setAmountMode(milestone.rewardPercent != null ? "PERCENTAGE" : "FLAT")
      setScopeProducts([])
      if (milestone.applicableCategoryIds?.length) {
        setScopeMode("CATEGORY")
      } else if (milestone.applicableProductIds?.length) {
        setScopeMode("PRODUCT")
        Promise.all(milestone.applicableProductIds.map((id) => getProductDetail(id))).then((products) =>
          setScopeProducts(products.map((p) => ({ id: p.id, name: p.name })))
        )
      } else {
        setScopeMode("ALL")
      }
    } else {
      setForm(INITIAL)
      setAmountMode("FLAT")
      setScopeMode("ALL")
      setScopeProducts([])
    }
  }, [milestone, open])

  // CASHBACK and FLAT_DISCOUNT ("Instant discount") both support the same
  // flat-₹-or-percentage-capped shape — mirrors payment_offers.cashback_percent
  // and cart_milestones.reward_percent, which are reward-type-agnostic columns.
  const showAmountModeToggle = form.rewardType === "CASHBACK" || form.rewardType === "FLAT_DISCOUNT"
  const isPercentageMode = showAmountModeToggle && amountMode === "PERCENTAGE"
  const amountModeNoun = form.rewardType === "CASHBACK" ? "Cashback" : "Discount"

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const { isActive, ...rest } = form
    // null = "clear the scope" (accepted by the update schema); the create
    // schema doesn't accept null for these two fields, so createMutation
    // below swaps null back to undefined (= omit entirely, same effect).
    const scopeCategoryIds = scopeMode === "CATEGORY" && rest.applicableCategoryIds?.length ? rest.applicableCategoryIds : null
    const scopeProductIds = scopeMode === "PRODUCT" && rest.applicableProductIds?.length ? rest.applicableProductIds : null
    // Only meaningful for "All users" — cleared otherwise so switching away
    // from ALL doesn't leave a stale exclusion silently sitting on a
    // FIRST_TIME/SEGMENT milestone that never consults it.
    const isAllUsers = rest.applicableUserType === "ALL"
    const excludedSegmentId = isAllUsers && rest.excludedSegmentId ? rest.excludedSegmentId : null
    const excludeFirstTimeUsers = isAllUsers && !!rest.excludeFirstTimeUsers
    const payload = {
      ...rest,
      rewardValue: isPercentageMode ? undefined : rest.rewardValue,
      rewardPercent: isPercentageMode ? rest.rewardPercent : null,
      messageBefore: rest.messageBefore || undefined,
      messageAfter: rest.messageAfter || undefined,
      applicableCategoryIds: scopeCategoryIds,
      applicableProductIds: scopeProductIds,
      excludedSegmentId,
      excludeFirstTimeUsers,
    }
    if (isEdit && milestone) {
      updateMutation.mutate({ id: milestone.id, payload: { ...payload, isActive } }, { onSuccess: onClose })
    } else {
      createMutation.mutate(
        {
          ...payload,
          applicableCategoryIds: scopeCategoryIds ?? undefined,
          applicableProductIds: scopeProductIds ?? undefined,
          excludedSegmentId: excludedSegmentId ?? undefined,
        },
        { onSuccess: onClose }
      )
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const showRewardValue = form.rewardType !== "COUPON_UNLOCK" && !isPercentageMode
  const showMaxDiscount = showAmountModeToggle
  const showCouponPicker = form.rewardType === "COUPON_UNLOCK"
  const showCashbackTrigger = form.rewardType === "CASHBACK"

  // A milestone "unlocks" a coupon by adding the customer to that coupon's
  // individual target list — coupons.service.js only ever consults that
  // list for a coupon whose own Target Audience is "Individual". Any other
  // audience (All/Segment/First-time) runs its own separate eligibility
  // rule instead and ignores the unlock entirely, so linking one here would
  // silently do nothing. Only offering compatible, active coupons in this
  // list prevents that dead-end rather than surfacing it as a save error.
  const allCoupons = couponsData?.data ?? []
  const eligibleCoupons = allCoupons.filter((c) => c.targetType === "INDIVIDUAL" && c.isActive)
  // A milestone that saved fine before can still end up pointing at an
  // incompatible coupon later — e.g. someone edits that SAME coupon's
  // Target Audience for an unrelated feature (like First-Time Offers)
  // after it was already linked here. Keep it selectable (so the picker
  // doesn't just go blank) but call out exactly what's wrong instead of
  // letting the admin discover it only via the save-time error.
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
          <DialogTitle>{isEdit ? "Edit Cart Milestone" : "Create Cart Milestone"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cm-name">Milestone Name *</Label>
            <Input
              id="cm-name"
              placeholder="e.g. ₹500 cashback tier"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              maxLength={100}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cm-min">Minimum Cart Amount *</Label>
            <Input
              id="cm-min"
              type="number"
              min={0}
              value={form.minCartAmount ?? ""}
              onChange={(e) => setForm({ ...form, minCartAmount: parseFloat(e.target.value) || 0 })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Reward Type *</Label>
              <Select
                value={form.rewardType}
                onValueChange={(v) => setForm({ ...form, rewardType: v as CartMilestoneRewardType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(REWARD_TYPE_LABELS) as CartMilestoneRewardType[]).map((type) => (
                    <SelectItem key={type} value={type}>
                      {REWARD_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {showRewardValue && (
              <div className="space-y-1.5">
                <Label htmlFor="cm-value">Reward Value *</Label>
                <Input
                  id="cm-value"
                  type="number"
                  min={0}
                  value={form.rewardValue ?? ""}
                  onChange={(e) => setForm({ ...form, rewardValue: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>
            )}
            {isPercentageMode && (
              <div className="space-y-1.5">
                <Label htmlFor="cm-percent">{amountModeNoun} % *</Label>
                <Input
                  id="cm-percent"
                  type="number"
                  min={1}
                  max={100}
                  placeholder="80"
                  value={form.rewardPercent ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, rewardPercent: e.target.value ? parseFloat(e.target.value) : undefined })
                  }
                  required
                />
              </div>
            )}
          </div>

          {showAmountModeToggle && (
            <div className="space-y-1.5">
              <Label>{amountModeNoun} Type</Label>
              <RadioGroup
                className="grid grid-cols-2 gap-3"
                value={amountMode}
                onValueChange={(v) => setAmountMode(v as AmountMode)}
              >
                <Label
                  htmlFor="cm-mode-flat"
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 font-normal",
                    amountMode === "FLAT" && "border-primary bg-primary/5"
                  )}
                >
                  <RadioGroupItem value="FLAT" id="cm-mode-flat" className="mt-0.5" />
                  <span>
                    <span className="block text-sm font-medium">Flat amount</span>
                    <span className="block text-xs text-muted-foreground">Same ₹ every time, e.g. flat ₹10.</span>
                  </span>
                </Label>
                <Label
                  htmlFor="cm-mode-percentage"
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 font-normal",
                    amountMode === "PERCENTAGE" && "border-primary bg-primary/5"
                  )}
                >
                  <RadioGroupItem value="PERCENTAGE" id="cm-mode-percentage" className="mt-0.5" />
                  <span>
                    <span className="block text-sm font-medium">Percentage, capped</span>
                    <span className="block text-xs text-muted-foreground">
                      E.g. 80% {form.rewardType === "CASHBACK" ? "cashback" : "off"}, up to ₹50 max.
                    </span>
                  </span>
                </Label>
              </RadioGroup>
            </div>
          )}

          {showMaxDiscount && (
            <div className="space-y-1.5">
              <Label htmlFor="cm-max">Maximum Reward Cap{isPercentageMode ? " *" : ""}</Label>
              <Input
                id="cm-max"
                type="number"
                min={0}
                value={form.maxDiscount ?? ""}
                onChange={(e) =>
                  setForm({ ...form, maxDiscount: e.target.value ? parseFloat(e.target.value) : undefined })
                }
                placeholder="No cap"
                required={isPercentageMode}
              />
              {isPercentageMode && (
                <p className="text-xs text-muted-foreground">
                  {form.rewardPercent || "80"}% {form.rewardType === "CASHBACK" ? "cashback" : "off"}, capped at ₹
                  {form.maxDiscount || "50"} — never more, even on a bigger cart.
                </p>
              )}
            </div>
          )}

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
                  way — that&apos;s the only audience setting a milestone unlock actually takes effect on.
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
            <Label htmlFor="cm-before">Message Before Unlock</Label>
            <Input
              id="cm-before"
              placeholder="Add ₹{amount} more to unlock {name}"
              value={form.messageBefore ?? ""}
              onChange={(e) => setForm({ ...form, messageBefore: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Use <code>{"{amount}"}</code> and <code>{"{name}"}</code> as placeholders.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cm-after">Message After Unlock</Label>
            <Input
              id="cm-after"
              placeholder="Free delivery unlocked"
              value={form.messageAfter ?? ""}
              onChange={(e) => setForm({ ...form, messageAfter: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Applicable To</Label>
              <Select
                value={form.applicableUserType}
                onValueChange={(v) => setForm({ ...form, applicableUserType: v as MilestoneUserType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(USER_TYPE_LABELS) as MilestoneUserType[]).map((type) => (
                    <SelectItem key={type} value={type}>
                      {USER_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.applicableUserType === "SEGMENT" && (
              <div className="space-y-1.5">
                <Label>Segment</Label>
                <Select
                  value={form.applicableSegmentId ?? ""}
                  onValueChange={(v) => setForm({ ...form, applicableSegmentId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(segments ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Exclude a segment from "All users" — lets a segment that
              already has its own dedicated, segment-scoped milestone sit
              that one out here, instead of also qualifying for this
              broader one and double-dipping on both rewards for the same
              purchase. Only meaningful (and only shown) for "All users";
              switching away from that clears it. */}
          {form.applicableUserType === "ALL" && (
            <div className="space-y-1.5">
              <Label>Exclude a segment (optional)</Label>
              <Select
                value={form.excludedSegmentId ?? "none"}
                onValueChange={(v) => setForm({ ...form, excludedSegmentId: v === "none" ? undefined : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None — every user is eligible</SelectItem>
                  {(segments ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Customers in this segment won&apos;t see or earn this milestone — use this when that segment
                already has its own dedicated milestone, so they don&apos;t get both rewards for the same order.
              </p>
            </div>
          )}

          {/* Exclude first-time customers from "All users" — the same
              double-dip problem as the segment exclusion above, but for the
              separate First-Time Offer feature: without this, a brand-new
              customer could earn BOTH their dedicated First-Time Offer AND
              this general milestone on the same order. Only meaningful
              (and only shown) for "All users"; switching away from that
              clears it. */}
          {form.applicableUserType === "ALL" && (
            <div className="rounded-lg border p-3 space-y-1">
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.excludeFirstTimeUsers}
                  onCheckedChange={(v) => setForm({ ...form, excludeFirstTimeUsers: v })}
                />
                <Label>Exclude first-time customers</Label>
              </div>
              <p className="text-xs text-muted-foreground pl-[52px]">
                When on, a customer placing their first order won&apos;t see or earn this milestone — only
                their First-Time Offer applies. Turn this on if you don&apos;t want new customers getting
                both rewards on the same order.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="cm-priority">Priority (higher shows first when tied)</Label>
            <Input
              id="cm-priority"
              type="number"
              value={form.priority ?? 0}
              onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 0 })}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cm-usage-limit">Per-User Redemption Limit</Label>
            <Input
              id="cm-usage-limit"
              type="number"
              min={1}
              placeholder="Unlimited"
              value={form.usageLimitPerUser ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  usageLimitPerUser: e.target.value ? parseInt(e.target.value) : undefined,
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              How many times the same customer can earn this milestone&apos;s reward. Leave blank for unlimited (every qualifying order).
            </p>
          </div>

          <div className="rounded-lg border p-3 space-y-1">
            <div className="flex items-center gap-3">
              <Switch
                checked={form.grantsFreeDelivery}
                onCheckedChange={(v) => setForm({ ...form, grantsFreeDelivery: v })}
              />
              <Label>Also grants free delivery</Label>
            </div>
            <p className="text-xs text-muted-foreground pl-[52px]">
              When on, reaching this milestone waives the delivery fee — on top of the reward above, not
              instead of it — for any order that meets the Minimum Cart Amount.
            </p>
          </div>

          {/* Applies to — category/bundle/product scope. Empty scope
              (Whole Order) is the existing default: nothing here changes
              for a milestone that doesn't set this. */}
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
                ? "The reward, and the Minimum Cart Amount above, apply to the customer's entire cart."
                : "The reward, and the Minimum Cart Amount above, only ever count the products in the picked categories/bundles/products above — other items in the same order don't count toward the minimum or get discounted."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              checked={form.stackableWithCoupon}
              onCheckedChange={(v) => setForm({ ...form, stackableWithCoupon: v })}
            />
            <Label>Stackable with coupons</Label>
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
