"use client"

/**
 * Small building blocks shared by every ERP screen: a plain-words tile, a change badge, a help tip, a segmented switch.
 * Rule of the house: colour + icon + one short word first, detail on hover.
 */
import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowDownRight, ArrowUpRight, HelpCircle, Minus } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export type Tone = "green" | "rose" | "amber" | "blue" | "violet" | "slate"

export const TONE: Record<Tone, { icon: string; soft: string; text: string; ring: string; bar: string; hex: string }> = {
  green: { icon: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", soft: "bg-emerald-50 dark:bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400", ring: "hover:border-emerald-400/60", bar: "bg-emerald-500", hex: "#10b981" },
  rose: { icon: "bg-rose-500/15 text-rose-600 dark:text-rose-400", soft: "bg-rose-50 dark:bg-rose-500/10", text: "text-rose-700 dark:text-rose-400", ring: "hover:border-rose-400/60", bar: "bg-rose-500", hex: "#f43f5e" },
  amber: { icon: "bg-amber-500/15 text-amber-600 dark:text-amber-400", soft: "bg-amber-50 dark:bg-amber-500/10", text: "text-amber-700 dark:text-amber-400", ring: "hover:border-amber-400/60", bar: "bg-amber-500", hex: "#f59e0b" },
  blue: { icon: "bg-sky-500/15 text-sky-600 dark:text-sky-400", soft: "bg-sky-50 dark:bg-sky-500/10", text: "text-sky-700 dark:text-sky-400", ring: "hover:border-sky-400/60", bar: "bg-sky-500", hex: "#0ea5e9" },
  violet: { icon: "bg-violet-500/15 text-violet-600 dark:text-violet-400", soft: "bg-violet-50 dark:bg-violet-500/10", text: "text-violet-700 dark:text-violet-400", ring: "hover:border-violet-400/60", bar: "bg-violet-500", hex: "#8b5cf6" },
  slate: { icon: "bg-slate-500/15 text-slate-600 dark:text-slate-300", soft: "bg-slate-50 dark:bg-slate-500/10", text: "text-slate-700 dark:text-slate-300", ring: "hover:border-slate-400/60", bar: "bg-slate-500", hex: "#64748b" },
}

/** "?" that explains where a number comes from. Keyboard-focusable. */
export function Help({ text, className }: { text: string; className?: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" aria-label="How is this worked out?" className={cn("inline-flex text-muted-foreground/70 hover:text-foreground focus-visible:text-foreground", className)}>
            <HelpCircle className="h-3.5 w-3.5" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-left leading-snug">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/** ▲ 12.5% / ▼ 3% — `goodWhenDown` flips the colours for things like refunds. */
export function Delta({ pct, goodWhenDown = false, label = "vs before", className }: { pct: number | null | undefined; goodWhenDown?: boolean; label?: string; className?: string }) {
  if (pct == null) return <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}><Minus className="h-3 w-3" aria-hidden />no earlier data</span>
  const up = pct > 0
  const flat = pct === 0
  const good = flat ? null : goodWhenDown ? !up : up
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", good == null ? "text-muted-foreground" : good ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400", className)}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {Math.abs(pct).toFixed(1)}%
      <span className="font-normal text-muted-foreground">{label}</span>
    </span>
  )
}

/** A card with a title row. */
export function Panel({ title, hint, help, right, children, className }: { title: string; hint?: string; help?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border bg-card p-5 shadow-sm", className)}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-1.5 text-base font-semibold tracking-tight">
            {title}
            {help && <Help text={help} />}
          </h2>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {right}
      </header>
      {children}
    </section>
  )
}

/** Big, icon-first number tile. Becomes a link when `href` is set. */
export function Tile({ icon, label, value, sub, tone = "green", href, help, big = false, className }: {
  icon: ReactNode; label: string; value: ReactNode; sub?: ReactNode; tone?: Tone; href?: string; help?: string; big?: boolean; className?: string
}) {
  const t = TONE[tone]
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
          {help && <Help text={help} />}
        </span>
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", t.icon)} aria-hidden>{icon}</span>
      </div>
      <div className={cn("mt-2 font-bold tabular-nums tracking-tight", big ? "text-3xl" : "text-2xl")}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </>
  )
  const cls = cn("block rounded-2xl border bg-card p-4 shadow-sm transition-colors", href && cn("cursor-pointer", t.ring), className)
  return href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>
}

/** Two-to-four way switch (Today / Week / Month / Year …). */
export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: Array<{ id: T; label: string }>; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex rounded-xl border bg-muted/60 p-1">
      {options.map((o) => (
        <button key={o.id} type="button" role="tab" aria-selected={value === o.id} onClick={() => onChange(o.id)}
          className={cn("rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors", value === o.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Bar({ pct, tone = "green", className }: { pct: number; tone?: Tone; className?: string }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)} role="presentation">
      <div className={cn("h-full rounded-full transition-all", TONE[tone].bar)} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p role="status" className="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{children}</p>
}
