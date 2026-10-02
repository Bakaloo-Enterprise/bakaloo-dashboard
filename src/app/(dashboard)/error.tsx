"use client"

import { useEffect } from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Catches a crash inside any dashboard page so the sidebar and header stay usable.
 * Without this, one broken page replaces the whole app with a blank error screen
 * until the browser is reloaded.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Dashboard page error:", error)
  }, [error])

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-8 text-center" role="alert">
      <AlertTriangle className="h-10 w-10 text-amber-500" aria-hidden="true" />
      <h2 className="text-lg font-semibold">This page hit a problem</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Something went wrong while showing this page. You can try again, or open another page from the menu.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  )
}
