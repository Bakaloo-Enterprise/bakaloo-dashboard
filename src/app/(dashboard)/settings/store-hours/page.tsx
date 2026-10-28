"use client"

/**
 * Store Hours — the "is the storefront open right now" evaluator's admin
 * controls (bakaloo-backend migration 071 / StoreStatusService). Global,
 * single-storefront: not per-shop.
 *
 * Priority: manual override (if set) > weekly schedule > fail-open default.
 * Fail-open is intentional — missing/malformed hours never silently block
 * ASAP ordering.
 */

import { useEffect, useMemo, useState } from "react"
import { CircleDot, Clock, ImageIcon, Save } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ImageUpload } from "@/components/products/ImageUpload"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { usePermissions } from "@/hooks/usePermissions"
import {
  useSetStoreOverride,
  useStoreStatus,
  useUpdateClosedBannerImage,
  useUpdateWeeklyHours,
} from "@/hooks/useStoreStatus"
import type { Weekday } from "@/types/common.types"
import type { WeekdayHours, WeeklyHours } from "@/types/store-status.types"

const WEEKDAYS: readonly Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]

const WEEKDAY_LABELS: Record<Weekday, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
}

const DEFAULT_DAY: WeekdayHours = { open: "09:00", close: "21:00", closed: false }

type OverrideChoice = "AUTO" | "OPEN" | "CLOSED"

function fillDefaults(hours: WeeklyHours): Record<Weekday, WeekdayHours> {
  const filled = {} as Record<Weekday, WeekdayHours>
  for (const day of WEEKDAYS) {
    filled[day] = hours[day] ?? { ...DEFAULT_DAY }
  }
  return filled
}

export default function StoreHoursPage() {
  const { can } = usePermissions()
  const canManage = can("settings.manage")

  const { data: status, isLoading } = useStoreStatus()
  const setOverride = useSetStoreOverride()
  const updateWeeklyHours = useUpdateWeeklyHours()
  const updateClosedBannerImage = useUpdateClosedBannerImage()

  const [overrideChoice, setOverrideChoice] = useState<OverrideChoice>("AUTO")
  const [overrideNote, setOverrideNote] = useState("")
  const [weeklyHours, setWeeklyHours] = useState<Record<Weekday, WeekdayHours> | null>(null)
  const [closedBannerImage, setClosedBannerImage] = useState<string | null>(null)

  useEffect(() => {
    if (!status) return
    setOverrideChoice(
      status.source === "MANUAL_OVERRIDE" ? (status.isOpen ? "OPEN" : "CLOSED") : "AUTO",
    )
    setOverrideNote(status.reason ?? "")
    setWeeklyHours(fillDefaults(status.weeklyHours))
    setClosedBannerImage(status.closedBannerImageUrl)
  }, [status])

  const overrideDirty =
    status !== undefined &&
    status !== null &&
    (overrideChoice === "AUTO"
      ? status.source === "MANUAL_OVERRIDE"
      : status.source !== "MANUAL_OVERRIDE" ||
        (overrideChoice === "OPEN") !== status.isOpen)

  function handleSaveOverride() {
    setOverride.mutate({
      status: overrideChoice === "AUTO" ? null : overrideChoice,
      note: overrideChoice === "AUTO" ? undefined : overrideNote.trim() || undefined,
    })
  }

  function updateDay(day: Weekday, patch: Partial<WeekdayHours>) {
    setWeeklyHours((prev) => {
      if (!prev) return prev
      return { ...prev, [day]: { ...prev[day], ...patch } }
    })
  }

  function handleSaveWeeklyHours() {
    if (!weeklyHours) return
    updateWeeklyHours.mutate(weeklyHours)
  }

  const closedBannerDirty = status !== undefined && status !== null && closedBannerImage !== status.closedBannerImageUrl

  function handleSaveClosedBanner() {
    updateClosedBannerImage.mutate(closedBannerImage)
  }

  const statusBadge = useMemo(() => {
    if (!status) return null
    return (
      <Badge
        variant={status.isOpen ? "default" : "destructive"}
        className={cn(
          "gap-1.5 text-xs",
          status.isOpen && "bg-emerald-600 hover:bg-emerald-600",
        )}
      >
        <CircleDot className="h-3 w-3" />
        {status.isOpen ? "Open now" : "Closed now"}
      </Badge>
    )
  }, [status])

  if (isLoading || !weeklyHours) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Store Hours"
          subtitle="Control when the storefront is open for ASAP ordering."
        />
        <Card className="max-w-2xl">
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Store Hours"
        subtitle="Control when the storefront is open for ASAP ordering."
      >
        {statusBadge}
      </PageHeader>

      <Card className="max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CircleDot className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">Store Status Override</CardTitle>
              <CardDescription>
                Takes priority over the weekly schedule below. Use this for unplanned
                closures or to force the store open outside normal hours.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={overrideChoice}
            onValueChange={(value) => setOverrideChoice(value as OverrideChoice)}
            className="grid gap-2"
          >
            <label
              className={cn(
                "flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition",
                overrideChoice === "AUTO" && "border-primary bg-primary/5",
              )}
            >
              <RadioGroupItem value="AUTO" disabled={!canManage} />
              <div>
                <p className="text-sm font-medium">Automatic</p>
                <p className="text-xs text-muted-foreground">
                  Follow the weekly schedule below.
                </p>
              </div>
            </label>
            <label
              className={cn(
                "flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition",
                overrideChoice === "OPEN" && "border-emerald-500 bg-emerald-50",
              )}
            >
              <RadioGroupItem value="OPEN" disabled={!canManage} />
              <div>
                <p className="text-sm font-medium">Force Open</p>
                <p className="text-xs text-muted-foreground">
                  Store accepts ASAP orders regardless of the weekly schedule.
                </p>
              </div>
            </label>
            <label
              className={cn(
                "flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition",
                overrideChoice === "CLOSED" && "border-destructive bg-destructive/5",
              )}
            >
              <RadioGroupItem value="CLOSED" disabled={!canManage} />
              <div>
                <p className="text-sm font-medium">Force Closed</p>
                <p className="text-xs text-muted-foreground">
                  Block ASAP ordering — customers are steered to scheduled delivery.
                </p>
              </div>
            </label>
          </RadioGroup>

          {overrideChoice !== "AUTO" && (
            <div className="space-y-1.5">
              <Label htmlFor="override-note">Note (shown internally, optional)</Label>
              <Textarea
                id="override-note"
                maxLength={500}
                disabled={!canManage}
                value={overrideNote}
                onChange={(e) => setOverrideNote(e.target.value)}
                placeholder="e.g. Unexpected closure due to staff shortage"
                className="max-w-md"
              />
            </div>
          )}

          {canManage && (
            <Button
              onClick={handleSaveOverride}
              disabled={setOverride.isPending || !overrideDirty}
            >
              <Save className="mr-2 h-4 w-4" />
              Save status
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg">Weekly Hours</CardTitle>
                <CardDescription>
                  Used automatically whenever the status above is set to
                  &ldquo;Automatic.&rdquo;
                </CardDescription>
              </div>
            </div>
            {canManage && (
              <Button
                size="sm"
                onClick={handleSaveWeeklyHours}
                disabled={updateWeeklyHours.isPending}
              >
                <Save className="mr-2 h-4 w-4" />
                Save hours
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="grid grid-cols-[110px_1fr_1fr_auto] gap-3 px-3 pb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Day
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Opens at
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Closes at
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Closed
              </span>
            </div>
            {WEEKDAYS.map((day) => {
              const dayHours = weeklyHours[day]
              return (
                <div
                  key={day}
                  className={cn(
                    "grid grid-cols-[110px_1fr_1fr_auto] items-center gap-3 rounded-lg border px-3 py-2.5 transition",
                    dayHours.closed && "opacity-60",
                  )}
                >
                  <span className="text-sm font-medium">{WEEKDAY_LABELS[day]}</span>
                  <Input
                    type="time"
                    disabled={!canManage || dayHours.closed}
                    value={dayHours.open}
                    onChange={(e) => updateDay(day, { open: e.target.value })}
                    className="h-9 text-xs font-mono"
                  />
                  <Input
                    type="time"
                    disabled={!canManage || dayHours.closed}
                    value={dayHours.close}
                    onChange={(e) => updateDay(day, { close: e.target.value })}
                    className="h-9 text-xs font-mono"
                  />
                  <div className="flex items-center gap-1.5">
                    <Switch
                      checked={dayHours.closed}
                      disabled={!canManage}
                      onCheckedChange={(checked) => updateDay(day, { closed: checked })}
                      className="data-[state=checked]:bg-red-500"
                      aria-label={`Mark ${WEEKDAY_LABELS[day]} as closed`}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg">&ldquo;We Are Closed&rdquo; Banner</CardTitle>
                <CardDescription>
                  Shown automatically at the top of the mobile home screen whenever the store
                  is closed (weekly schedule or the override above) — no app release needed to
                  change the image.
                </CardDescription>
              </div>
            </div>
            {canManage && (
              <Button
                size="sm"
                onClick={handleSaveClosedBanner}
                disabled={updateClosedBannerImage.isPending || !closedBannerDirty}
              >
                <Save className="mr-2 h-4 w-4" />
                Save banner
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ImageUpload kind="banners"
            value={closedBannerImage}
            onChange={canManage ? setClosedBannerImage : () => {}}
            label="Upload Closed Banner"
            helperText={
              <div className="flex flex-col gap-0.5">
                <span>• <strong>Size:</strong> Max 5MB</span>
                <span>• <strong>Format:</strong> JPG, PNG, WEBP</span>
                <span>• <strong>Recommended:</strong> Wide banner image, same shape as the promo banners on the home screen</span>
              </div>
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
