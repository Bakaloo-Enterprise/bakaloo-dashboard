"use client"

import { useState } from "react"
import { Ban } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useConsentMutations, useSuppressed } from "@/hooks/useWhatsappCrm"

/** Puts this customer on (or takes them off) the do-not-contact list: no campaigns, no automatic messages. */
export function DoNotContactButton({ contactId }: { contactId: string }) {
  const suppressed = useSuppressed()
  const m = useConsentMutations()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const on = (suppressed.data ?? []).some((s) => s.contact_id === contactId)

  if (on) {
    return (
      <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-900 dark:bg-red-950/30 dark:text-red-200">
        <p className="font-medium">On the do-not-contact list</p>
        <p className="mt-0.5">No campaigns or automatic messages are sent to this customer.</p>
        <Button variant="outline" size="sm" className="mt-2" disabled={m.unsuppress.isPending} onClick={() => m.unsuppress.mutate(contactId)}>Remove from the list</Button>
      </div>
    )
  }
  if (!open) {
    return (
      <Button variant="ghost" size="sm" className="mt-4 w-full text-xs text-muted-foreground" onClick={() => setOpen(true)}>
        <Ban className="mr-1 h-3.5 w-3.5" /> Do not contact…
      </Button>
    )
  }
  return (
    <div className="mt-4 rounded-md border p-3 text-xs">
      <label htmlFor="dnc-reason" className="font-medium">Why? (optional)</label>
      <Input id="dnc-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} className="mt-1 h-8" />
      <div className="mt-2 flex gap-2">
        <Button size="sm" variant="destructive" disabled={m.suppress.isPending} onClick={() => m.suppress.mutate({ contactId, reason: reason.trim() || undefined }, { onSuccess: () => setOpen(false) })}>Add to the list</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  )
}
