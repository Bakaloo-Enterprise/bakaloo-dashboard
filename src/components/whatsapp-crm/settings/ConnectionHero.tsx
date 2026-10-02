"use client"

import { CheckCircle2, Loader2, Plug, PlugZap, RefreshCw, ShieldAlert, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { WaSettingsView } from "@/types/whatsapp-settings.types"
import { STATE_STYLE, formatWhen, numberSummary } from "./settings-helpers"

interface Props {
  view: WaSettingsView
  testing: boolean
  onTest: () => void
  onToggle: (on: boolean) => void
  toggling: boolean
}

const ICON = { CONNECTED: CheckCircle2, SAVED: PlugZap, FAILED: XCircle, DISABLED: Plug, NOT_CONFIGURED: ShieldAlert } as const

/** The first thing you see: is WhatsApp working, which number, and the one button that matters. */
export function ConnectionHero({ view, testing, onTest, onToggle, toggling }: Props) {
  const s = STATE_STYLE[view.state]
  const Icon = ICON[view.state]
  const sum = numberSummary(view)
  const canTest = view.state !== "NOT_CONFIGURED"

  return (
    <section aria-label="Connection status" className={cn("relative overflow-hidden rounded-2xl bg-gradient-to-br p-6 text-white shadow-lg", s.hero)}>
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-black/10 blur-3xl" />
      <div className="relative flex flex-wrap items-start justify-between gap-5">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
            <Icon className="h-7 w-7" aria-hidden />
          </div>
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/80">
              <span className={cn("h-2 w-2 rounded-full", s.dot, view.state === "CONNECTED" && "animate-pulse")} aria-hidden />
              {s.label}
            </p>
            <h2 className="mt-1 text-2xl font-semibold leading-tight">{s.headline}</h2>
            {sum.number ? (
              <p className="mt-1 text-sm text-white/90">{sum.name ? `${sum.name} · ` : ""}{sum.number}</p>
            ) : (
              <p className="mt-1 text-sm text-white/80">{view.state === "NOT_CONFIGURED" ? "Enter the details below, then press “Save & test connection”." : view.lastTestedAt ? `Last tested ${formatWhen(view.lastTestedAt)}` : "Not tested yet."}</p>
            )}
            {sum.chips.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {sum.chips.map(([k, v]) => (
                  <li key={k} className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium ring-1 ring-white/20">
                    <span className="text-white/70">{k}: </span>{v}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <Button onClick={onTest} disabled={!canTest || testing} className="bg-white text-slate-900 shadow-sm hover:bg-white/90">
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="mr-2 h-4 w-4" aria-hidden />}
            {testing ? "Testing…" : "Test connection"}
          </Button>
          {(view.state === "CONNECTED" || view.state === "DISABLED") && (
            <button type="button" disabled={toggling} onClick={() => onToggle(view.state === "DISABLED")} className="text-xs font-medium text-white/85 underline-offset-4 hover:underline disabled:opacity-60">
              {view.state === "DISABLED" ? "Switch WhatsApp on" : "Switch WhatsApp off"}
            </button>
          )}
          {view.lastTestedAt && <p className="text-[11px] text-white/70">Last test: {formatWhen(view.lastTestedAt)}</p>}
        </div>
      </div>
    </section>
  )
}
