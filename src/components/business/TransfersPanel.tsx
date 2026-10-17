"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, PackageCheck, Trash2, Truck, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useBizMe, useProcurementMutations, useTransfers } from "@/hooks/useBusiness"
import { cn } from "@/lib/utils"
import type { Transfer } from "@/types/business.types"
import { QtyStepper } from "./QtyStepper"

const ago = (iso: string) => {
  const h = Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000)
  return h < 1 ? "just now" : h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`
}

/** The store counts what actually arrived. Fewer than sent = the rest is written off as lost on the way. */
function ArrivedDialog({ t, onClose }: { t: Transfer | null; onClose: () => void }) {
  const { receiveTransfer } = useProcurementMutations()
  const [got, setGot] = useState(0)
  const [note, setNote] = useState("")
  useEffect(() => { if (t) { setGot(t.quantity); setNote("") } }, [t])
  if (!t) return null
  const lost = t.quantity - got
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl"><PackageCheck className="h-6 w-6" aria-hidden />Did it arrive?</DialogTitle>
          <DialogDescription>{t.product} → {t.shop}</DialogDescription>
        </DialogHeader>
        <p className="rounded-xl bg-muted px-3 py-2 text-center text-sm">Sent <strong className="text-lg">{t.quantity}</strong></p>
        <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-green-300 bg-green-50 p-3"><span className="flex items-center gap-2 font-bold text-green-900"><Truck className="h-6 w-6" aria-hidden />Arrived</span><QtyStepper label="arrived" value={got} min={1} max={t.quantity} onChange={setGot} /></div>
        {lost > 0 && (
          <div className="space-y-2 rounded-2xl border-2 border-red-300 bg-red-50 p-3 text-red-900">
            <p className="flex items-center gap-2 font-bold"><Trash2 className="h-5 w-5" aria-hidden />{lost} lost on the way — written off</p>
            <Input className="h-10 bg-white" value={note} maxLength={150} onChange={(e) => setNote(e.target.value)} placeholder="What happened? (optional)" aria-label="What happened" />
          </div>
        )}
        <Button className="h-14 bg-green-600 text-lg font-bold hover:bg-green-700" disabled={receiveTransfer.isPending} onClick={() => receiveTransfer.mutate({ id: t.id, receivedQty: got, note: note.trim() || undefined }, { onSuccess: onClose })}><CheckCircle2 className="mr-2 h-6 w-6" aria-hidden />Put {got} on the shelf</Button>
      </DialogContent>
    </Dialog>
  )
}

/** Stock sent to a store "on the way": it is not on the shelf until the store says it arrived. */
export function TransfersPanel() {
  const me = useBizMe()
  const list = useTransfers()
  const { cancelTransfer } = useProcurementMutations()
  const [open, setOpen] = useState<Transfer | null>(null)
  const manage = Boolean(me.data?.procurementManage)
  const items = list.data ?? []
  if (items.length === 0) return null
  return (
    <section aria-label="On the way to stores" className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-3">
      <h2 className="mb-2 flex items-center gap-2 text-base font-bold text-amber-900"><Truck className="h-6 w-6" aria-hidden />On the way to stores <span className="rounded-full bg-amber-200 px-2 text-sm">{items.length}</span></h2>
      <ul className="space-y-2">
        {items.map((t) => (
          <li key={t.id} className={cn("flex flex-wrap items-center gap-3 rounded-xl border-2 bg-white p-2.5")}>
            <div className="min-w-0 flex-1"><p className="truncate font-semibold">{t.quantity} × {t.product} <span className="text-muted-foreground">→</span> {t.shop}</p><p className="text-xs text-muted-foreground">{t.vendor} · #{t.entryNo} · sent {ago(t.sentAt)}{t.by ? ` by ${t.by}` : ""}</p></div>
            {manage && <>
              <Button className="h-11 bg-green-600 font-bold hover:bg-green-700" onClick={() => setOpen(t)}><PackageCheck className="mr-1.5 h-5 w-5" aria-hidden />Arrived</Button>
              <Button variant="outline" className="h-11 border-red-300 text-red-700" disabled={cancelTransfer.isPending} onClick={() => cancelTransfer.mutate(t.id)} aria-label="Cancel this transfer"><XCircle className="mr-1 h-5 w-5" aria-hidden />Cancel</Button>
            </>}
          </li>
        ))}
      </ul>
      <ArrivedDialog t={open} onClose={() => setOpen(null)} />
    </section>
  )
}
