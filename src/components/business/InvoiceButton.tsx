"use client"

import { useRef } from "react"
import { FileCheck2, FileUp, FileX2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useProcurementMutations } from "@/hooks/useBusiness"
import { openDocument } from "@/services/business.service"
import { getEntry } from "@/services/business.service"
import { cn } from "@/lib/utils"

/** Tick = invoice is on file (tap to see it). Warning = no invoice yet (tap to add a PDF or a photo). */
export function InvoiceButton({ entryId, hasInvoice, canUpload, compact = false }: { entryId: string; hasInvoice: boolean; canUpload: boolean; compact?: boolean }) {
  const { upload } = useProcurementMutations()
  const input = useRef<HTMLInputElement>(null)
  const view = async () => {
    try {
      const entry = await getEntry(entryId)
      const doc = entry.documents.find((d) => d.kind === "INVOICE")
      if (doc) await openDocument(doc.id)
    } catch { toast.error("Could not open the invoice") }
  }
  if (hasInvoice) {
    return <button type="button" onClick={view} className={cn("inline-flex items-center gap-1 rounded-full border-2 border-green-400 bg-green-50 font-bold text-green-800 hover:bg-green-100", compact ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm")} aria-label="View the invoice"><FileCheck2 className="h-4 w-4" aria-hidden />Invoice</button>
  }
  return (
    <>
      <button type="button" disabled={!canUpload || upload.isPending} onClick={() => input.current?.click()} className={cn("inline-flex items-center gap-1 rounded-full border-2 border-amber-400 bg-amber-50 font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-60", compact ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm")} aria-label="Add the invoice">
        {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : canUpload ? <FileUp className="h-4 w-4" aria-hidden /> : <FileX2 className="h-4 w-4" aria-hidden />}No invoice
      </button>
      <input ref={input} type="file" accept="application/pdf,image/jpeg,image/png" className="sr-only" aria-label="Choose the invoice file" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload.mutate({ entryId, file: f }) }} />
    </>
  )
}
