"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useDebounce } from "@/hooks/useDebounce"
import { useChatRefSearch } from "@/hooks/useTeamChat"
import type { ChatRefResult, ChatRefType } from "@/types/team-chat.types"
import { REF_TYPE_LABEL } from "./chat-helpers"

/** Pick an order, product or customer to attach to a message. Search results are already limited to what you may share. */
export function AttachPicker({ open, isHq, onClose, onPick }: { open: boolean; isHq: boolean; onClose: () => void; onPick: (r: ChatRefResult) => void }) {
  const [type, setType] = useState<ChatRefType>("ORDER")
  const [q, setQ] = useState("")
  const dq = useDebounce(q, 250)
  const results = useChatRefSearch(type, dq, open)
  const types: ChatRefType[] = isHq ? ["ORDER", "PRODUCT", "CUSTOMER"] : ["ORDER", "PRODUCT"]

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Attach to your message</DialogTitle>
          <DialogDescription>Everyone in this chat will see the label. {isHq ? "" : "You can share your own store’s orders and any product."}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-1" role="tablist" aria-label="What to attach">
          {types.map((t) => (
            <button key={t} type="button" role="tab" aria-selected={type === t} onClick={() => { setType(t); setQ("") }} className={`rounded-full border px-3 py-1 text-xs ${type === t ? "border-primary bg-primary/10 font-semibold" : "hover:bg-muted"}`}>
              {REF_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
        <Input autoFocus aria-label={`Search ${REF_TYPE_LABEL[type].toLowerCase()}s`} value={q} onChange={(e) => setQ(e.target.value)} placeholder={type === "ORDER" ? "Order number…" : type === "PRODUCT" ? "Name or SKU…" : "Customer name…"} />
        <ul className="max-h-60 divide-y overflow-y-auto rounded-md border text-sm" aria-label="Results">
          {dq.trim().length < 2 && <li className="p-3 text-xs text-muted-foreground">Type at least 2 characters.</li>}
          {dq.trim().length >= 2 && results.data?.length === 0 && <li className="p-3 text-xs text-muted-foreground">Nothing found.</li>}
          {(results.data ?? []).map((r) => (
            <li key={r.id}>
              <Button variant="ghost" className="h-auto w-full justify-between rounded-none px-3 py-2 text-left font-normal" onClick={() => { onPick(r); onClose() }}>
                <span className="truncate">{r.label}</span>
                {r.hint && <span className="ml-2 shrink-0 text-xs text-muted-foreground">{r.hint}</span>}
              </Button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
