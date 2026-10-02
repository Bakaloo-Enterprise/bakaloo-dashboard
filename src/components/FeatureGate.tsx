"use client"

/**
 * FeatureGate — the "in development" lock for features that only Developer Super Admins can use until they are
 * released. Children are NOT rendered (so none of their data hooks fire) unless the feature is open to this user.
 * The backend enforces the same lock on every API call; this is the friendly screen on top of it.
 */

import { type ReactNode } from "react"
import { Lock } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useFeatureAccess } from "@/hooks/useFeatures"
import type { FeatureKey } from "@/services/features.service"

export function FeatureGate({ feature, children }: { feature: FeatureKey; children: ReactNode }) {
  const { isLoading, canAccess, label } = useFeatureAccess(feature)

  if (isLoading) {
    return (
      <div className="space-y-3 p-2" aria-busy="true">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!canAccess) {
    return (
      <div
        role="status"
        data-testid="feature-locked"
        className="mx-auto mt-16 flex max-w-md flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold">{label} is in development</h2>
        <p className="text-sm text-muted-foreground">
          Right now this project is in development. It isn&apos;t available yet and will open up once it&apos;s ready.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
