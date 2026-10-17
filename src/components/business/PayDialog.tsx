"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, HandCoins } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useProcurementMutations } from "@/hooks/useBusiness"
import { cn } from "@/lib/utils"
import type { PayMethod } from "@/types/business.types"
import { formatRupees } from "./business-helpers"
import { METHOD_ORDER, TERMS_UI } from "./supplier-helpers"

/** "I paid the supplier": how much, and cash / UPI / bank. You can never pay more than is owed. */
export function PayDialog({ vendorId, vendorName, owed, upiId, open, onOpenChange }: { vendorId: string; vendorName: string; owed: number; upiId?: string | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { pay } = useProcurementMutations()
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState<PayMethod>("CASH")
  const [ref, setRef] = useState("")
  useEffect(() => { if (open) { setAmount(String(owed)); setMethod("CASH"); setRef("") } }, [open, owed])
  const n = Number(amount)
  const problem = !(n > 0) ? "Enter how much you paid." : n > owed ? `You only owe ${formatRupees(owed)}.` : null
  const half = Math.round((owed / 2) * 100) / 100
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl"><HandCoins className="h-6 w-6" aria-hidden />Pay {vendorName}</DialogTitle>
          <DialogDescription>You owe <strong>{formatRupees(owed)}</strong></DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label htmlFor="pay-amt" className="mb-1 block text-sm font-semibold">How much did you pay? (₹)</label>
            <Input id="pay-amt" className="h-14 text-center text-2xl font-extrabold" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} />
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => setAmount(String(owed))} className="h-10 flex-1 rounded-full border-2 text-sm font-bold hover:bg-muted">All {formatRupees(owed)}</button>
              {half > 0 && half < owed && <button type="button" onClick={() => setAmount(String(half))} className="h-10 flex-1 rounded-full border-2 text-sm font-bold hover:bg-muted">Half {formatRupees(half)}</button>}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Paid by">
            {METHOD_ORDER.map((m) => { const u = TERMS_UI[m]; return (
              <button key={m} type="button" aria-pressed={method === m} onClick={() => setMethod(m)} className={cn("flex flex-col items-center gap-1 rounded-xl border-2 py-3", method === m ? `${u.tone} ring-2 ring-offset-1` : "hover:bg-muted")}><u.icon className="h-7 w-7" aria-hidden /><span className="text-sm font-bold">{u.label}</span></button>
            ) })}
          </div>
          {method === "UPI" && upiId && <p className="rounded-xl bg-violet-50 px-3 py-2 text-sm">Their UPI: <strong>{upiId}</strong></p>}
          {method !== "CASH" && <Input className="h-11" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Payment ID / reference (optional)" maxLength={80} aria-label="Reference" />}
          {problem && <p role="status" className="text-sm text-amber-700">{problem}</p>}
          <Button type="button" className="h-14 w-full bg-green-600 text-lg font-bold hover:bg-green-700" disabled={Boolean(problem) || pay.isPending} onClick={() => pay.mutate({ id: vendorId, amount: n, method, reference: ref.trim() || undefined }, { onSuccess: () => onOpenChange(false) })}>
            <CheckCircle2 className="mr-2 h-6 w-6" aria-hidden />I paid {n > 0 ? formatRupees(n) : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
