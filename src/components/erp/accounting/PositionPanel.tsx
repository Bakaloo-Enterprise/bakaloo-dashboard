"use client"

import { Banknote, Landmark } from "lucide-react"
import type { AccountingSummary, Box } from "@/types/erp.types"
import { inr } from "../format"
import { Panel, TONE } from "../kit"
import { BOX_LABEL } from "./meta"
import { cn } from "@/lib/utils"

function Lines({ lines, tone }: { lines: Array<{ label: string; amount: number }>; tone: "in" | "out" }) {
  if (!lines.length) return <p className="py-1 text-xs text-muted-foreground">Nothing this month.</p>
  return <ul className="space-y-1">{lines.map((l) => <li key={l.label} className="flex justify-between gap-3 text-sm"><span className="text-muted-foreground">{l.label}</span><span className={cn("tabular-nums font-medium", tone === "in" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>{tone === "in" ? "+" : "−"}{inr(l.amount, false)}</span></li>)}</ul>
}

export function PositionPanel({ s, onSetOpening }: { s: AccountingSummary; onSetOpening: () => void }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {(["CASH", "BANK"] as Box[]).map((box) => {
        const p = s.position[box]
        const Icon = box === "CASH" ? Banknote : Landmark
        const t = TONE[box === "CASH" ? "amber" : "blue"]
        return (
          <Panel key={box} title={BOX_LABEL[box]} hint={box === "CASH" ? "Cash on delivery, cash from businesses, cash costs" : "Online payments, UPI and bank transfers"}
            right={<span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", t.icon)} aria-hidden><Icon className="h-5 w-5" /></span>}>
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{p.balance != null ? `Balance on ${s.to}` : "Moved this month"}</p>
                <p className={cn("text-3xl font-bold tabular-nums tracking-tight", (p.balance ?? p.net) < 0 && "text-rose-600 dark:text-rose-400")}>{inr(p.balance ?? p.net, false)}</p>
                {p.balance != null && p.opening && <p className="text-xs text-muted-foreground">counted from {inr(p.opening.amount, false)} on {p.opening.on}</p>}
              </div>
              {p.balance == null && <button type="button" onClick={onSetOpening} className="rounded-xl border px-3 py-2 text-xs font-medium hover:bg-muted">Set opening balance</button>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><p className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Came in <span className="tabular-nums">{inr(p.totalIn, false)}</span></p><Lines lines={p.in} tone="in" /></div>
              <div><p className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-400">Went out <span className="tabular-nums">{inr(p.totalOut, false)}</span></p><Lines lines={p.out} tone="out" /></div>
            </div>
            <p className={cn("mt-3 rounded-lg px-3 py-2 text-sm font-medium", p.net >= 0 ? TONE.green.soft : TONE.rose.soft)}>Net this month: <b className="tabular-nums">{p.net >= 0 ? "+" : "−"}{inr(Math.abs(p.net), false)}</b></p>
          </Panel>
        )
      })}
    </div>
  )
}
