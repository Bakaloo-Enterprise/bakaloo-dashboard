"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Clock, Minus, PackageCheck, Plus, RefreshCw, ThumbsDown, ThumbsUp, Trash2, Truck, Undo2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useProcurementMutations } from "@/hooks/useBusiness"
import { cn } from "@/lib/utils"
import type { ProcurementEntry, RejectOutcome } from "@/types/business.types"

export const OUTCOME_UI: Record<RejectOutcome, { label: string; hint: string; icon: typeof Trash2; tone: string }> = {
  WASTAGE: { label: "Throw away", hint: "We lose it", icon: Trash2, tone: "border-red-400 bg-red-50 text-red-700" },
  RETURN: { label: "Send back", hint: "Get money back", icon: Undo2, tone: "border-sky-400 bg-sky-50 text-sky-700" },
  REPLACEMENT: { label: "Replace", hint: "They bring new", icon: RefreshCw, tone: "border-violet-400 bg-violet-50 text-violet-700" },
}

function Stepper({ label, icon: Icon, value, onChange, min, max, tone }: { label: string; icon: typeof Truck; value: number; onChange: (n: number) => void; min: number; max?: number; tone: string }) {
  const set = (n: number) => onChange(Math.max(min, Math.min(max ?? 10_000_000, Number.isFinite(n) ? n : min)))
  return (
    <div className={cn("flex items-center gap-2 rounded-2xl border-2 p-2.5", tone)}>
      <Icon className="ml-1 h-7 w-7 shrink-0" aria-hidden />
      <span className="flex-1 text-base font-bold">{label}</span>
      <Button type="button" variant="outline" size="icon" className="h-11 w-11 rounded-full bg-card" onClick={() => set(value - 1)} aria-label={`Less ${label}`}><Minus className="h-5 w-5" /></Button>
      <Input className="h-11 w-20 bg-card text-center text-xl font-bold" inputMode="numeric" value={value} onChange={(e) => set(parseInt(e.target.value.replace(/\D/g, ""), 10))} aria-label={label} />
      <Button type="button" variant="outline" size="icon" className="h-11 w-11 rounded-full bg-card" onClick={() => set(value + 1)} aria-label={`More ${label}`}><Plus className="h-5 w-5" /></Button>
    </div>
  )
}

/** Goods arrived: count them, check them, say what happens to the bad ones. Or: the supplier brought what it owed. */
export function ReceiveDialog({ entry, onOpenChange }: { entry: ProcurementEntry | null; onOpenChange: (o: boolean) => void }) {
  const { receive, arrived } = useProcurementMutations()
  const [came, setCame] = useState(0)
  const [bad, setBad] = useState(0)
  const [outcome, setOutcome] = useState<RejectOutcome | null>(null)
  const [rest, setRest] = useState<boolean | null>(null)
  const [later, setLater] = useState(0)
  const [note, setNote] = useState("")
  useEffect(() => { if (entry) { setCame(entry.expectedQty); setBad(0); setOutcome(null); setRest(null); setLater(entry.owedQty); setNote("") } }, [entry])
  if (!entry) return null

  const first = entry.status === "ORDERED"
  const good = Math.max(0, came - bad)
  const short = Math.max(0, entry.expectedQty - came)
  const problem = first ? (came < 1 ? "Enter how many came." : bad > came ? "Bad cannot be more than came." : bad > 0 && !outcome ? "Tap what happens to the bad ones." : short > 0 && rest === null ? "Tap if the rest is coming." : null) : later < 1 ? "Enter how many came." : later > entry.owedQty ? `Only ${entry.owedQty} is owed.` : null
  const busy = receive.isPending || arrived.isPending
  const save = () => {
    if (problem) return
    if (first) receive.mutate({ id: entry.id, receivedQty: came, rejectedQty: bad, outcome: bad > 0 ? outcome ?? undefined : undefined, restComing: short > 0 && rest === true, note: note.trim() || undefined }, { onSuccess: () => onOpenChange(false) })
    else arrived.mutate({ id: entry.id, quantity: later }, { onSuccess: () => onOpenChange(false) })
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl"><Truck className="h-6 w-6" aria-hidden />{first ? "Goods arrived" : "Supplier brought more"}</DialogTitle>
          <DialogDescription>{entry.product.name} · {entry.vendor.name} · #{entry.entryNo}</DialogDescription>
        </DialogHeader>

        {first ? (
          <div className="space-y-4">
            <p className="rounded-xl bg-muted px-3 py-2 text-center text-sm">We ordered <strong className="text-lg">{entry.expectedQty}</strong></p>
            <Stepper label="Came" icon={Truck} value={came} onChange={setCame} min={0} tone="border-slate-300 bg-slate-50" />
            <Stepper label="Bad" icon={ThumbsDown} value={bad} onChange={setBad} min={0} max={came} tone="border-red-300 bg-red-50 text-red-800" />
            <div className="grid grid-cols-3 gap-2 text-center" aria-live="polite">
              <div className="rounded-xl border-2 border-green-400 bg-green-50 p-2 text-green-800"><ThumbsUp className="mx-auto h-5 w-5" aria-hidden /><p className="text-2xl font-extrabold tabular-nums">{good}</p><p className="text-xs font-semibold">Good to sell</p></div>
              <div className={cn("rounded-xl border-2 p-2", bad > 0 ? "border-red-400 bg-red-50 text-red-800" : "bg-muted/40 text-muted-foreground")}><ThumbsDown className="mx-auto h-5 w-5" aria-hidden /><p className="text-2xl font-extrabold tabular-nums">{bad}</p><p className="text-xs font-semibold">Bad</p></div>
              <div className={cn("rounded-xl border-2 p-2", short > 0 ? "border-amber-400 bg-amber-50 text-amber-800" : "bg-muted/40 text-muted-foreground")}><Clock className="mx-auto h-5 w-5" aria-hidden /><p className="text-2xl font-extrabold tabular-nums">{short}</p><p className="text-xs font-semibold">Short</p></div>
            </div>
            {bad > 0 && (
              <div>
                <p className="mb-1.5 text-sm font-semibold">What happens to the {bad} bad?</p>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(OUTCOME_UI) as RejectOutcome[]).map((k) => { const u = OUTCOME_UI[k]; return (
                    <button key={k} type="button" aria-pressed={outcome === k} onClick={() => setOutcome(k)} className={cn("flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-center", outcome === k ? `${u.tone} ring-2 ring-offset-1` : "hover:bg-muted")}>
                      <u.icon className="h-7 w-7" aria-hidden /><span className="text-sm font-bold">{u.label}</span><span className="text-[11px] text-muted-foreground">{u.hint}</span>
                    </button>
                  ) })}
                </div>
              </div>
            )}
            {short > 0 && (
              <div>
                <p className="mb-1.5 text-sm font-semibold">{short} less than ordered. Will they bring the rest?</p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" aria-pressed={rest === true} onClick={() => setRest(true)} className={cn("flex items-center justify-center gap-2 rounded-xl border-2 p-3 font-bold", rest === true ? "border-amber-400 bg-amber-50 text-amber-800 ring-2 ring-offset-1" : "hover:bg-muted")}><Clock className="h-6 w-6" aria-hidden />Rest is coming</button>
                  <button type="button" aria-pressed={rest === false} onClick={() => setRest(false)} className={cn("flex items-center justify-center gap-2 rounded-xl border-2 p-3 font-bold", rest === false ? "border-slate-400 bg-slate-100 ring-2 ring-offset-1" : "hover:bg-muted")}><XCircle className="h-6 w-6" aria-hidden />Not coming</button>
                </div>
              </div>
            )}
            <Input className="h-11" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" maxLength={300} aria-label="Note" />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-center text-sm text-amber-900">Supplier still owes <strong className="text-lg">{entry.owedQty}</strong></p>
            <Stepper label="Came now" icon={Truck} value={later} onChange={setLater} min={0} max={entry.owedQty} tone="border-slate-300 bg-slate-50" />
          </div>
        )}

        {problem && <p role="status" className="text-sm text-amber-700">{problem}</p>}
        <Button type="button" className="h-14 bg-green-600 text-lg font-bold hover:bg-green-700" disabled={Boolean(problem) || busy} onClick={save}>
          {first ? <PackageCheck className="mr-2 h-6 w-6" aria-hidden /> : <CheckCircle2 className="mr-2 h-6 w-6" aria-hidden />}{first ? "Save" : "Add to stock"}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
