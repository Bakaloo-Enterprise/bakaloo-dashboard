"use client"

/**
 * Building blocks copied from the MandiMetrics reference (`src/components/ui.tsx`): same classes, same sizes.
 * They only look right inside `<ErpSkin>` (see erp-skin.css — the skin runs at zoom .875 to match the reference's 14px root).
 */
import "./erp-skin.css"
import "./erp-palette.css"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { Minus, ShieldAlert, TrendingDown, TrendingUp } from "lucide-react"
import { Area, AreaChart, ResponsiveContainer } from "recharts"
import { cn } from "@/lib/utils"
import { Help } from "../kit"

/** Wrap each reference-styled page in this. */
export function ErpSkin({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("erp-skin", className)}>{children}</div>
}

export function CountUp({ value, format = (n: number) => Math.round(n).toLocaleString("en-IN"), dur = 650 }: {
  value: number; format?: (n: number) => string; dur?: number
}) {
  const [disp, setDisp] = useState(value)
  const fromRef = useRef(value)
  useEffect(() => {
    const from = fromRef.current, t0 = performance.now()
    let raf = 0
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur)
      setDisp(from + (value - from) * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(step); else fromRef.current = value
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, dur])
  return <span className="num">{format(disp)}</span>
}

export function Panel({ children, className, pad = true, hover = false }: {
  children: ReactNode; className?: string; pad?: boolean; hover?: boolean
}) {
  return (
    <div className={cn(
      "rounded-2xl border border-[#e3e8dd] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
      pad && "p-5", hover && "card-hover", className,
    )}>{children}</div>
  )
}

export function SectionTitle({ title, sub, right, icon, help }: { title: string; sub?: string; right?: ReactNode; icon?: ReactNode; help?: string }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        {icon && <div className="grid size-9 place-items-center rounded-xl bg-lime-100 text-lime-700 ring-1 ring-lime-200">{icon}</div>}
        <div>
          <h3 className="flex items-center gap-1.5 font-display font-semibold tracking-tight text-slate-900" style={{ fontSize: "calc(15px / .875)" }}>{title}{help && <Help text={help} className="text-slate-400 hover:text-slate-700" />}</h3>
          {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
        </div>
      </div>
      {right}
    </div>
  )
}

export type Accent = "lime" | "cyan" | "orange" | "rose" | "amber" | "violet"
const ACCENTS: Record<Accent, string> = {
  lime: "text-lime-700 bg-lime-100 ring-lime-200",
  cyan: "text-cyan-700 bg-cyan-100 ring-cyan-200",
  orange: "text-orange-700 bg-orange-100 ring-orange-200",
  rose: "text-rose-700 bg-rose-100 ring-rose-200",
  amber: "text-amber-700 bg-amber-100 ring-amber-200",
  violet: "text-violet-700 bg-violet-100 ring-violet-200",
}

export function Kpi({ label, value, sub, delta, spark, icon, accent = "lime", invert = false, help }: {
  label: string; value: ReactNode; sub?: string; delta?: number; spark?: number[]
  icon?: ReactNode; accent?: Accent; invert?: boolean; help?: string
}) {
  const good = delta !== undefined ? (invert ? delta < 0 : delta > 0) : true
  return (
    <Panel hover>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-e10.5 font-semibold uppercase tracking-[0.13em] text-slate-500">{label}{help && <Help text={help} className="ml-1 align-[-2px] text-slate-400 hover:text-slate-700" />}</p>
          <div className="mt-1.5 font-display text-2xl font-bold tracking-tight text-slate-900">{value}</div>
          {sub && <p className="mt-1 truncate text-xs text-slate-500">{sub}</p>}
        </div>
        <div className="flex flex-col items-end gap-2">
          {icon && <div className={cn("grid size-9 shrink-0 place-items-center rounded-xl ring-1", ACCENTS[accent])}>{icon}</div>}
          {spark && spark.length > 2 && <Spark data={spark} color={good ? "#65a30d" : "#e11d48"} />}
        </div>
      </div>
      {delta !== undefined && (
        <div className="mt-3 flex items-center gap-1.5 text-e11">
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ring-1",
            Math.abs(delta) < 0.05 ? "bg-slate-100 text-slate-500 ring-slate-200"
              : good ? "bg-lime-100 text-lime-700 ring-lime-200" : "bg-rose-100 text-rose-700 ring-rose-200")}>
            {Math.abs(delta) < 0.05 ? <Minus className="size-3" /> : delta > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
          <span className="text-slate-400">vs previous period</span>
        </div>
      )}
    </Panel>
  )
}

export function Spark({ data, color = "#65a30d", h = 34 }: { data: number[]; color?: string; h?: number }) {
  return (
    <div className="kpi-spark" style={{ width: 82, height: h }}>
      <ResponsiveContainer>
        <AreaChart data={data.map((v, i) => ({ i, v }))} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.6} fill={color} fillOpacity={0.14} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function Seg<T extends string>({ options, value, onChange, size = "sm", label }: {
  options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; size?: "sm" | "xs"; label?: string
}) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex items-center gap-0.5 rounded-xl border border-[#e3e8dd] bg-[#f2f5ec] p-0.5">
      {options.map((o) => (
        <button key={o.id} type="button" role="tab" aria-selected={value === o.id} onClick={() => onChange(o.id)}
          className={cn("rounded-[9px] font-medium transition-all",
            size === "sm" ? "px-3 py-1.5 text-xs" : "px-2 py-1 text-e11",
            value === o.id ? "bg-white text-lime-700 shadow-sm ring-1 ring-lime-200" : "text-slate-500 hover:text-slate-800")}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

interface TipEntry { dataKey?: string | number; color?: string; stroke?: string; fill?: string; name?: string | number; value?: number | string }
export function ChartTip({ active, payload, label, money, unit, fmt }: {
  active?: boolean; payload?: TipEntry[]; label?: string | number; money?: boolean; unit?: string; fmt?: (v: number, p: TipEntry) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-[#e3e8dd] bg-white px-3 py-2.5 shadow-lg">
      <p className="num mb-1.5 text-e10 uppercase tracking-wider text-slate-400">{label}</p>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center gap-2 py-0.5 text-xs">
          <span className="size-2 rounded-full" style={{ background: p.color || p.stroke || p.fill }} />
          <span className="text-slate-500">{p.name}:</span>
          <span className="num font-semibold text-slate-900">
            {fmt ? fmt(Number(p.value), p) : money ? `₹${Number(p.value).toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : `${Number(p.value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}${unit ?? ""}`}
          </span>
        </div>
      ))}
    </div>
  )
}

const isDark = () => typeof document !== "undefined" && document.documentElement.classList.contains("dark")
/** Chart axes: 10.5px ticks in JetBrains Mono (12 here because the skin is zoomed to .875). */
export const AXIS = {
  get tick() { return { fill: isDark() ? "#7c8a74" : "#8a9480", fontSize: 12, fontFamily: "JetBrains Mono, ui-monospace, monospace" } },
  tickLine: false,
  get axisLine() { return { stroke: isDark() ? "#26301f" : "#e3e8dd" } },
}
export const GRID = {
  get stroke() { return isDark() ? "#1e2719" : "#eceff0" },
  strokeDasharray: "3 6",
}

export type TagTone = "slate" | "lime" | "rose" | "cyan" | "orange" | "amber" | "violet"
export function Tag({ children, tone = "slate", className, title }: { children: ReactNode; tone?: TagTone; className?: string; title?: string }) {
  const tones: Record<TagTone, string> = {
    slate: "bg-slate-100 text-slate-600 ring-slate-200",
    lime: "bg-lime-100 text-lime-700 ring-lime-200",
    rose: "bg-rose-100 text-rose-700 ring-rose-200",
    cyan: "bg-cyan-100 text-cyan-700 ring-cyan-200",
    orange: "bg-orange-100 text-orange-700 ring-orange-200",
    amber: "bg-amber-100 text-amber-700 ring-amber-200",
    violet: "bg-violet-100 text-violet-700 ring-violet-200",
  }
  return <span title={title} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-e10.5 font-semibold ring-1", tones[tone], className)}>{children}</span>
}

export function Bar({ pct, color = "#65a30d", h = 6 }: { pct: number; color?: string; h?: number }) {
  return (
    <div className="w-full overflow-hidden rounded-full bg-slate-100" style={{ height: h }}>
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }} />
    </div>
  )
}

/** labelled input used across entry forms */
export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="fld-lbl mb-1 block">{label}</span>
      {children}
      {hint && <span className="mt-0.5 block text-e10 text-slate-400">{hint}</span>}
    </label>
  )
}

/** read-only auto-calculated value cell */
export function Calc({ label, value, tone = "slate", hint }: {
  label: string; value: ReactNode; tone?: "slate" | "lime" | "rose" | "amber" | "cyan" | "violet"; hint?: string
}) {
  const colors = {
    slate: "text-slate-800", lime: "text-lime-700", rose: "text-rose-600",
    amber: "text-amber-600", cyan: "text-cyan-700", violet: "text-violet-700",
  } as const
  return (
    <div className="calc-cell rounded-xl px-3 py-2">
      <p className="fld-lbl">{label}</p>
      <p className={cn("num mt-0.5 font-bold leading-tight", colors[tone])} style={{ fontSize: "calc(15px / .875)" }}>{value}</p>
      {hint && <p className="mt-0.5 text-e9.5 leading-tight text-slate-400">{hint}</p>}
    </div>
  )
}

/** The page heading used on every reference screen: small tracked eyebrow, big title, one grey line. */
export function PageHead({ eyebrow, icon, eyebrowClass = "text-lime-700", title, sub, right, strong = false }: {
  eyebrow: string; icon: ReactNode; eyebrowClass?: string; title: ReactNode; sub?: ReactNode; right?: ReactNode; strong?: boolean
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className={cn("flex items-center gap-2 text-e11 uppercase", strong ? "font-semibold tracking-[0.18em]" : "font-medium tracking-[0.2em]", eyebrowClass)}>{icon} {eyebrow}</div>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
        {sub && <p className="mt-1 max-w-3xl text-sm text-slate-500">{sub}</p>}
      </div>
      {right}
    </div>
  )
}

/** Reference-style retry notice. */
export function LoadError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-e11.5 text-rose-700">Could not load {what}. <button type="button" className="font-semibold underline" onClick={onRetry}>Try again</button></p>
}

/** Small tinted stat box used inside founder panels. */
export function MetricPill({ label, value, detail, tone = "lime" }: { label: string; value: string; detail: string; tone?: "lime" | "amber" | "rose" | "cyan" }) {
  const tones = { lime: "border-lime-200 bg-lime-50 text-lime-800", amber: "border-amber-200 bg-amber-50 text-amber-800", rose: "border-rose-200 bg-rose-50 text-rose-800", cyan: "border-cyan-200 bg-cyan-50 text-cyan-800" }
  return (
    <div className={cn("rounded-xl border p-3", tones[tone])}>
      <p className="text-e10 font-bold uppercase tracking-wider opacity-75">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-e11 leading-snug opacity-80">{detail}</p>
    </div>
  )
}

/** A decision alert: tinted card with an icon, a headline and one line of detail. */
export function Insight({ title, detail, priority = "info" }: { title: string; detail?: string; priority?: "critical" | "warning" | "success" | "info" }) {
  const classes = { critical: "border-rose-200 bg-rose-50", warning: "border-amber-200 bg-amber-50", success: "border-lime-200 bg-lime-50", info: "border-slate-200 bg-slate-50" }
  const icon = { critical: "text-rose-600", warning: "text-amber-600", success: "text-lime-700", info: "text-slate-500" }
  return (
    <div className={cn("flex items-start gap-2.5 rounded-xl border p-3", classes[priority])}>
      <ShieldAlert className={cn("mt-0.5 size-4 shrink-0", icon[priority])} />
      <div className="min-w-0"><p className="text-xs font-semibold text-slate-800">{title}</p>{detail && <p className="mt-1 text-e11 leading-relaxed text-slate-600">{detail}</p>}</div>
    </div>
  )
}
