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
import { useCreateScratchPrize, useUpdateScratchPrize } from "@/hooks/useScratchCard"
import { useCoupons } from "@/hooks/useCoupons"
import type {
  ScratchPrize,
  CreateScratchPrizePayload,
  ScratchPrizeType,
  ScratchIconKey,
} from "@/types/scratch-card.types"

interface ScratchPrizeDialogProps {
  open: boolean
  onClose: () => void
  prize?: ScratchPrize | null
}

export const SCRATCH_PRIZE_TYPE_LABELS: Record<ScratchPrizeType, string> = {
  FREE_DELIVERY: "Free delivery",
  PERCENTAGE_OFF: "Percentage off",
  FLAT_OFF: "Flat amount off",
  BUY_ONE_GET_ONE: "Buy 1 Get 1",
  CASHBACK: "Extra savings (wallet cashback)",
  BETTER_LUCK: "Better luck next time (no prize)",
}

const DEFAULT_ICON_FOR_TYPE: Record<ScratchPrizeType, ScratchIconKey> = {
  FREE_DELIVERY: "shopping_cart",
  PERCENTAGE_OFF: "percent",
  FLAT_OFF: "coins",
  BUY_ONE_GET_ONE: "gift",
  CASHBACK: "star",
  BETTER_LUCK: "sad_face",
}

const ICON_LABELS: Record<ScratchIconKey, string> = {
  shopping_cart: "Shopping cart",
  percent: "Percent badge",
  basket: "Basket",
  coins: "Coins",
  gift: "Gift box",
  sad_face: "Sad face",
  star: "Star",
  ticket: "Ticket",
}

// Mirrors COUPON_REQUIRED_TYPES in the backend's scratch-card.service.js.
const COUPON_REQUIRED_TYPES = new Set<ScratchPrizeType>([
  "FREE_DELIVERY",
  "PERCENTAGE_OFF",
  "FLAT_OFF",
  "BUY_ONE_GET_ONE",
])

const INITIAL: CreateScratchPrizePayload & { isActive: boolean } = {
  type: "CASHBACK",
  iconKey: "star",
  label: "",
  value: undefined,
  winProbability: 0,
  linkedCouponId: undefined,
  isActive: true,
}

export function ScratchPrizeDialog({ open, onClose, prize }: ScratchPrizeDialogProps) {
  const [form, setForm] = useState(INITIAL)
  const isEdit = !!prize
  const createMutation = useCreateScratchPrize()
  const updateMutation = useUpdateScratchPrize()
  // Scratch Card is platform-wide, not a shop feature — fetch regardless
  // of the admin's current shop selection (see useCoupons.ts's doc comment).
  const { data: couponsData } = useCoupons({ limit: 50 }, { shopScoped: false })

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
  const needsValue = form.type === "PERCENTAGE_OFF" || form.type === "FLAT_OFF" || form.type === "CASHBACK"
  const valueLabel =
    form.type === "PERCENTAGE_OFF" ? "Percentage (%)" : form.type === "CASHBACK" ? "Cashback amount (₹)" : "Amount (₹)"

  // Same "only show compatible coupons, but keep an already-linked
  // incompatible one selectable with a clear warning" treatment as
  // SpinPrizeDialog's coupon picker.
  const allCoupons = couponsData?.data ?? []
  const eligibleCoupons = allCoupons.filter((c) => c.targetType === "INDIVIDUAL" && c.isActive)
  const currentCoupon = form.linkedCouponId ? allCoupons.find((c) => c.id === form.linkedCouponId) : undefined
  const currentCouponIncompatible =
    !!currentCoupon && (currentCoupon.targetType !== "INDIVIDUAL" || !currentCoupon.isActive)
  const couponOptions = currentCouponIncompatible ? [currentCoupon, ...eligibleCoupons] : eligibleCoupons

  const handleTypeChange = (type: ScratchPrizeType) => {
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
          <DialogTitle>{isEdit ? "Edit Prize" : "New Prize"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Prize Type *</Label>
            <Select value={form.type} onValueChange={(v) => handleTypeChange(v as ScratchPrizeType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SCRATCH_PRIZE_TYPE_LABELS) as ScratchPrizeType[]).map((type) => (
                  <SelectItem key={type} value={type}>
                    {SCRATCH_PRIZE_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="scp-label">Label Revealed on the Card *</Label>
            <Input
              id="scp-label"
              placeholder="e.g. 10% OFF"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              required
              maxLength={50}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {needsValue && (
              <div className="space-y-1.5">
                <Label htmlFor="scp-value">{valueLabel} *</Label>
                <Input
                  id="scp-value"
                  type="number"
                  min={0}
                  max={form.type === "PERCENTAGE_OFF" ? 100 : undefined}
                  value={form.value ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, value: e.target.value ? parseFloat(e.target.value) : undefined })
                  }
                  required
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="scp-icon">Card Icon</Label>
              <Select
                value={form.iconKey}
                onValueChange={(v) => setForm({ ...form, iconKey: v as ScratchIconKey })}
              >
                <SelectTrigger id="scp-icon">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ICON_LABELS) as ScratchIconKey[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {ICON_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="scp-probability">Win Probability (%) *</Label>
            <Input
              id="scp-probability"
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
              The odds a scratch lands on this prize when it&apos;s active. Every active prize&apos;s
              probability must add up to exactly 100% — the total is shown on the Prizes tab.
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
                  only a coupon with Target Audience &quot;Individual&quot; works here. Create or edit one
                  from the Coupons page first, then link it.
                </p>
              )}
            </div>
          )}

          {isEdit && (
            <div className="flex items-center gap-3">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              <Label>Active on the card</Label>
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
