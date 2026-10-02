"use client"

import { AlertTriangle, CheckCircle2, Copy, MinusCircle, XCircle } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { WaCheck, WaTestResult } from "@/types/whatsapp-settings.types"
import { CHECK_STYLE, copyToClipboard, formatWhen } from "./settings-helpers"

const ICON = { pass: CheckCircle2, warn: AlertTriangle, fail: XCircle, skip: MinusCircle } as const

function Technical({ t }: { t?: NonNullable<WaCheck["problem"]>["technical"] }) {
  if (!t) return null // older results, and plain-language problems, carry no technical block
  const rows = [["HTTP status", t.httpStatus], ["Meta error code", t.code], ["Sub-code", t.subcode], ["Type", t.type], ["Network", t.network], ["Meta’s message", t.message], ["Trace ID (for support)", t.fbtraceId]].filter(([, v]) => v !== null && v !== undefined && v !== "")
  if (rows.length === 0) return null
  const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n")
  return (
    <details className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-xs dark:bg-slate-900/40">
      <summary className="cursor-pointer font-medium text-muted-foreground">Technical details</summary>
      <dl className="mt-2 space-y-1">
        {rows.map(([k, v]) => <div key={String(k)} className="flex gap-2"><dt className="w-36 shrink-0 text-muted-foreground">{k}</dt><dd className="break-all font-mono">{String(v)}</dd></div>)}
      </dl>
      <button type="button" className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium underline-offset-2 hover:underline" onClick={async () => toast[(await copyToClipboard(text)) ? "success" : "error"]((await copyToClipboard(text)) ? "Copied for support" : "Could not copy")}>
        <Copy className="h-3 w-3" aria-hidden />Copy for support
      </button>
    </details>
  )
}

/** The checklist: what Meta said for each step, and — when something is wrong — exactly what to do. */
export function TestResults({ result }: { result: WaTestResult }) {
  const tone = result.level === "READY" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : result.level === "PARTIAL" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-900"
  return (
    <section aria-label="Test results" className="space-y-3">
      <div role="status" className={cn("rounded-xl border px-4 py-3", tone)}>
        <p className="font-semibold">{result.headline}</p>
        <p className="text-xs opacity-80">Tested {formatWhen(result.testedAt)} · took {(result.durationMs / 1000).toFixed(1)} s</p>
      </div>
      <ol className="space-y-2">
        {result.checks.map((c) => {
          const Icon = ICON[c.status]
          const st = CHECK_STYLE[c.status]
          return (
            <li key={c.id} className="rounded-xl border bg-card p-3.5 shadow-sm">
              <div className="flex items-start gap-3">
                <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", st.ring)}><Icon className="h-4 w-4" aria-hidden /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{c.label}</p>
                    <span className={cn("text-[11px] font-medium", st.text)}>{st.label}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{c.summary}</p>
                  {c.problem && (
                    <div className="mt-3 rounded-lg border border-dashed p-3 text-sm">
                      <p className="font-semibold">{c.problem.title}</p>
                      <p className="mt-0.5 text-muted-foreground">{c.problem.cause}</p>
                      {(c.problem.fixes ?? []).length > 0 && (
                        <>
                          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">How to fix it</p>
                          <ol className="mt-1 list-decimal space-y-1 pl-5">{(c.problem.fixes ?? []).map((f) => <li key={f}>{f}</li>)}</ol>
                        </>
                      )}
                      <Technical t={c.problem.technical} />
                    </div>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
