"use client"

import { Banknote, CalendarClock, Clock, QrCode } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn, formatINR } from "@/lib/utils"

export interface B2BPayment {
  dueDate: string
  /** Money received while taking the order ("" = none). */
  advance: string
  method: "CASH" | "UPI"
}

const today = () => new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10)
const plus = (n: number) => new Date(Date.parse(`${today()}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

/** A business buys on credit: when will they pay, and did they hand over anything now? */
export function B2BPaymentPanel({ value, onChange, total }: { value: B2BPayment; onChange: (v: B2BPayment) => void; total: number }) {
  const adv = Number(value.advance)
  const bad = value.advance !== "" && (!(adv > 0) || adv > total + 0.001)
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-2xl border-2 border-indigo-300 bg-indigo-50 p-3">
        <Clock className="h-8 w-8 shrink-0 text-indigo-700" aria-hidden />
        <div><p className="font-bold text-indigo-900">Pay later (on credit)</p><p className="text-xs text-indigo-900/80">It will appear in B2B Orders, where you record every payment they make.</p></div>
      </div>
      <div>
        <p className="mb-1.5 flex items-center gap-1 text-sm font-semibold"><CalendarClock className="h-4 w-4" aria-hidden />They will pay by</p>
        <div className="flex flex-wrap items-center gap-2">
          {[7, 15, 30].map((d) => <button key={d} type="button" aria-pressed={value.dueDate === plus(d)} onClick={() => onChange({ ...value, dueDate: plus(d) })} className={cn("h-11 rounded-full border-2 px-4 text-sm font-bold", value.dueDate === plus(d) ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>{d} days</button>)}
          <Input type="date" className="h-11 w-44" min={today()} value={value.dueDate} onChange={(e) => onChange({ ...value, dueDate: e.target.value })} aria-label="Pick a date" />
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-sm font-semibold">Did they pay anything now? <span className="font-normal text-muted-foreground">(optional)</span></p>
        <div className="flex flex-wrap items-center gap-2">
          <Input className="h-11 w-40 text-lg font-bold" inputMode="decimal" placeholder="₹ 0" aria-label="Money received now" value={value.advance} onChange={(e) => onChange({ ...value, advance: e.target.value.replace(/[^\d.]/g, "") })} />
          {([["CASH", "Cash", Banknote], ["UPI", "UPI", QrCode]] as const).map(([m, label, Icon]) => (
            <button key={m} type="button" aria-pressed={value.method === m} onClick={() => onChange({ ...value, method: m })} className={cn("flex h-11 items-center gap-1.5 rounded-xl border-2 px-4 font-bold", value.method === m ? "border-primary bg-primary/10" : "hover:bg-muted")}><Icon className="h-5 w-5" aria-hidden />{label}</button>
          ))}
        </div>
        {bad && <p role="alert" className="mt-1 text-sm font-semibold text-red-700">That is more than the order total ({formatINR(total)}).</p>}
      </div>
    </div>
  )
}
export const b2bPaymentProblem = (v: B2BPayment, total: number) => v.advance !== "" && (!(Number(v.advance) > 0) || Number(v.advance) > total + 0.001)
