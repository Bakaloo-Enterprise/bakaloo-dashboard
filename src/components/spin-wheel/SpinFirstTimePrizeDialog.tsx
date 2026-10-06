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
import { useCreateSpinFirstTimePrize, useUpdateSpinFirstTimePrize } from "@/hooks/useSpinWheel"
import { useCoupons } from "@/hooks/useCoupons"
import type {
  SpinFirstTimePrize,
  CreateSpinFirstTimePrizePayload,
  SpinFirstTimePrizeType,
  SpinIconKey,
} from "@/types/spin-wheel.types"

interface SpinFirstTimePrizeDialogProps {
  open: boolean
  onClose: () => void
  prize?: SpinFirstTimePrize | null
}

// Same vocabulary as SPIN_PRIZE_TYPE_LABELS minus BETTER_LUCK — this pool
// exists specifically to guarantee a real win.
export const SPIN_FIRST_TIME_PRIZE_TYPE_LABELS: Record<SpinFirstTimePrizeType, string> = {
  FREE_DELIVERY: "Free delivery",
  PERCENTAGE_OFF: "Percentage off",
  FLAT_OFF: "Flat amount off",
  BUY_ONE_GET_ONE: "Buy 1 Get 1",
  CASHBACK: "Extra savings (wallet cashback)",
}

const DEFAULT_ICON_FOR_TYPE: Record<SpinFirstTimePrizeType, SpinIconKey> = {
  FREE_DELIVERY: "shopping_cart",
  PERCENTAGE_OFF: "percent",
  FLAT_OFF: "coins",
  BUY_ONE_GET_ONE: "gift",
  CASHBACK: "star",
}

const ICON_LABELS: Record<SpinIconKey, string> = {
  shopping_cart: "Shopping cart",
  percent: "Percent badge",
  basket: "Basket",
  coins: "Coins",
  gift: "Gift box",
  sad_face: "Sad face",
  star: "Star",
  ticket: "Ticket",
}

// Mirrors COUPON_REQUIRED_TYPES in the backend's spin-wheel.service.js.
const COUPON_REQUIRED_TYPES = new Set<SpinFirstTimePrizeType>([
  "FREE_DELIVERY",
  "PERCENTAGE_OFF",
  "FLAT_OFF",
  "BUY_ONE_GET_ONE",
])

const INITIAL: CreateSpinFirstTimePrizePayload & { isActive: boolean } = {
  type: "CASHBACK",
  iconKey: "star",
  label: "Welcome Gift",
  value: undefined,
  winProbability: 100,
  linkedCouponId: undefined,
  isActive: true,
}

export function SpinFirstTimePrizeDialog({ open, onClose, prize }: SpinFirstTimePrizeDialogProps) {
  const [form, setForm] = useState(INITIAL)
  const isEdit = !!prize
  const createMutation = useCreateSpinFirstTimePrize()
  const updateMutation = useUpdateSpinFirstTimePrize()
  // Spin & Win is platform-wide, not a shop feature — fetch regardless of
  // the admin's current shop selection (see useCoupons.ts's doc comment).
  const { data: couponsData } = useCoupons({ limit: 50 }, { shopScoped: false, fetchAll: true })

  useEffect(() => {
    if (prize) {
      setForm({
        type: prize.type,
        iconKey: prize.iconKey,
        label: prize.label,
        value: prize.value ?? undefined,
        winProbability: prize.winProbability,
        linkedCouponId: prize.linkedCouponId ?? undefined,
        isActive: prize.isActive,
      })
    } else {
      setForm(INITIAL)
    }
  }, [prize, open])

  const needsCoupon = COUPON_REQUIRED_TYPES.has(form.type)
  // Only CASHBACK needs a manually-entered value — it's a direct wallet
  // credit with no coupon behind it. Every coupon-backed type grants its
  // real discount entirely from the linked coupon picked below, so
  // re-entering that number here would just be a second, driftable copy.
  const needsValue = form.type === "CASHBACK"

  const allCoupons = couponsData?.data ?? []
  const eligibleCoupons = allCoupons.filter((c) => c.targetType === "INDIVIDUAL" && c.isActive)
  const currentCoupon = form.linkedCouponId ? allCoupons.find((c) => c.id === form.linkedCouponId) : undefined
  const currentCouponIncompatible =
    !!currentCoupon && (currentCoupon.targetType !== "INDIVIDUAL" || !currentCoupon.isActive)
  const couponOptions = currentCouponIncompatible ? [currentCoupon, ...eligibleCoupons] : eligibleCoupons

  const handleTypeChange = (type: SpinFirstTimePrizeType) => {
    setForm((f) => ({
      ...f,
      type,
      iconKey: DEFAULT_ICON_FOR_TYPE[type],
      value: undefined,
      linkedCouponId: COUPON_REQUIRED_TYPES.has(type) ? f.linkedCouponId : undefined,
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const { isActive, ...rest } = form
    const payload = {
      ...rest,
      value: needsValue ? rest.value : null,
      linkedCouponId: needsCoupon ? rest.linkedCouponId || null : null,
    }
    if (isEdit && prize) {
      updateMutation.mutate({ id: prize.id, payload: { ...payload, isActive } }, { onSuccess: onClose })
    } else {
      createMutation.mutate(payload, { onSuccess: onClose })
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit First-Time Prize" : "New First-Time Prize"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Prize Type *</Label>
            <Select value={form.type} onValueChange={(v) => handleTypeChange(v as SpinFirstTimePrizeType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SPIN_FIRST_TIME_PRIZE_TYPE_LABELS) as SpinFirstTimePrizeType[]).map((type) => (
                  <SelectItem key={type} value={type}>
                    {SPIN_FIRST_TIME_PRIZE_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sftp-label">Label on the Wheel *</Label>
            <Input
              id="sftp-label"
              placeholder="e.g. Welcome Gift"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              required
              maxLength={50}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {needsValue && (
              <div className="space-y-1.5">
                <Label htmlFor="sftp-value">Cashback amount (₹) *</Label>
                <Input
                  id="sftp-value"
                  type="number"
                  min={0}
                  value={form.value ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, value: e.target.value ? parseFloat(e.target.value) : undefined })
                  }
                  required
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="sftp-icon">Wheel Icon</Label>
              <Select
                value={form.iconKey}
                onValueChange={(v) => setForm({ ...form, iconKey: v as SpinIconKey })}
              >
                <SelectTrigger id="sftp-icon">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ICON_LABELS) as SpinIconKey[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {ICON_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sftp-probability">Win Probability (%) *</Label>
            <Input
              id="sftp-probability"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={form.winProbability ?? ""}
              onChange={(e) =>
                setForm({ ...form, winProbability: e.target.value ? parseFloat(e.target.value) : 0 })
              }
              required
            />
            <p className="text-xs text-muted-foreground">
              With just one active first-time prize, set this to 100% — every brand-new customer&apos;s
              first spin lands on it. Add more active first-time prizes to split the odds between
              them; there is no &quot;Better luck next time&quot; option here since a first spin always
              wins something.
            </p>
          </div>

          {needsCoupon && (
            <div className="space-y-1.5">
              <Label>Coupon to Grant *</Label>
              <Select
                value={form.linkedCouponId ?? ""}
                onValueChange={(v) => setForm({ ...form, linkedCouponId: v })}
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
                  Winning this prize adds the customer to this coupon&apos;s individual target list —
                  only a coupon with Target Audience &quot;Individual&quot; works here.
                </p>
              )}
            </div>
          )}

          {isEdit && (
            <div className="flex items-center gap-3">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              <Label>Active in the first-time pool</Label>
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
