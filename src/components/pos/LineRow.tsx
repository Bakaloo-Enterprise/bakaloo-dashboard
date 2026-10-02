"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LINE_STATUS, remainingFor } from "./pos-helpers"
import type { PosLine, Stage } from "@/types/pos.types"

interface Props {
  line: PosLine
  stage: Stage | null
  canWork: boolean
  canDecide: boolean
  busy: boolean
  onConfirm: (qty?: number) => void
  onMissing: (note: string) => void
  onDecide: (decision: "REPLACE" | "REMOVE" | "REFUND", note: string) => void
}

export function LineRow({ line, stage, canWork, canDecide, busy, onConfirm, onMissing, onDecide }: Props) {
  const [mode, setMode] = useState<null | "missing" | "decide">(null)
  const [note, setNote] = useState("")
  const status = LINE_STATUS[line.status]
  const left = stage ? remainingFor(line, stage) : 0
  const have = stage === "PACK" ? line.packed : line.picked
  const need = stage === "PACK" ? line.packTarget ?? 0 : line.required

  return (
    <li className="rounded-md border p-3">
      <div className="flex items-start gap-3">
        {line.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={line.imageUrl} alt="" className="h-12 w-12 rounded object-cover" />
        ) : (
          <div className="h-12 w-12 rounded bg-muted" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium leading-tight">{line.name}</p>
          <p className="text-xs text-muted-foreground">
            {[line.unit, line.sku && `SKU ${line.sku}`, line.barcode && `Code ${line.barcode}`].filter(Boolean).join(" · ")}
          </p>
          {line.missingNote && <p className="mt-1 text-xs text-red-700">Reported: {line.missingNote}</p>}
          {line.decision && <p className="mt-1 text-xs text-violet-700">Decision: {line.decision.toLowerCase()}{line.decisionNote ? ` — ${line.decisionNote}` : ""}</p>}
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold tabular-nums" aria-label={`${have} of ${need}`}>{have}<span className="text-muted-foreground">/{need}</span></p>
          <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${status.cls}`}>{status.label}</span>
        </div>
      </div>

      {mode === null && (
        <div className="mt-2 flex flex-wrap gap-2">
          {stage && canWork && left > 0 && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onConfirm()}>Confirm 1 by hand</Button>
          )}
          {stage && canWork && left > 1 && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onConfirm(left)}>Confirm all {left}</Button>
          )}
          {stage === "PICK" && canWork && line.status === "PENDING" && (
            <Button size="sm" variant="outline" className="text-red-700" disabled={busy} onClick={() => setMode("missing")}>Can’t find it</Button>
          )}
          {canDecide && line.status === "MISSING" && (
            <Button size="sm" disabled={busy} onClick={() => setMode("decide")}>Decide what to do</Button>
          )}
        </div>
      )}

      {mode === "missing" && (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => { e.preventDefault(); onMissing(note.trim()); setMode(null); setNote("") }}
        >
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="What happened? (optional)" aria-label="Note about the missing item" autoFocus />
          <Button size="sm" type="submit" variant="destructive" disabled={busy}>Report missing</Button>
          <Button size="sm" type="button" variant="ghost" onClick={() => setMode(null)}>Cancel</Button>
        </form>
      )}

      {mode === "decide" && (
        <div className="mt-2 space-y-2">
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Note for the record (optional)" aria-label="Decision note" />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => { onDecide("REPLACE", note.trim()); setMode(null); setNote("") }}>Replace it</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => { onDecide("REMOVE", note.trim()); setMode(null); setNote("") }}>Remove from order</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => { onDecide("REFUND", note.trim()); setMode(null); setNote("") }}>Refund the item</Button>
            <Button size="sm" variant="ghost" onClick={() => setMode(null)}>Cancel</Button>
          </div>
        </div>
      )}
    </li>
  )
}
