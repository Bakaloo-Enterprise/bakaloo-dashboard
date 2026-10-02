"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { SendTemplateDialog } from "@/components/whatsapp-crm/SendTemplateDialog"
import { useCrmMe, useCrmStatus, useSendMessage } from "@/hooks/useWhatsappCrm"
import { useCustomerThread, useOpenCustomerConversation, whatsappErrorMessage } from "@/hooks/useCustomerWhatsapp"
import { displayPhone, whatsappSetup } from "./whatsapp-setup"
import type { WaConversation } from "@/types/whatsapp-crm.types"

interface Props {
  customer: { id: string; name: string | null; phone: string }
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Message one customer on WhatsApp straight from their profile. */
export function CustomerWhatsappDialog({ customer, open, onOpenChange }: Props) {
  const status = useCrmStatus()
  const me = useCrmMe()
  const opener = useOpenCustomerConversation()
  const setup = whatsappSetup(status.data)
  const canReply = me.can("crm.inbox.reply")
  const name = customer.name ?? "this customer"

  // Find (or create) the customer's conversation when the dialog opens. Creating it does not open the 24-hour window.
  useEffect(() => {
    if (open && canReply && !opener.data && !opener.isPending && !opener.isError) opener.mutate(customer.id)
  }, [open, canReply, customer.id, opener])

  const conv = opener.data

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-emerald-600" aria-hidden />WhatsApp message</DialogTitle>
          <DialogDescription>To {name} · {displayPhone(customer.phone)}</DialogDescription>
        </DialogHeader>

        {!me.isLoading && !canReply ? (
          <p role="alert" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">You do not have permission to send WhatsApp messages. Ask an admin to give your role “reply in the WhatsApp inbox”.</p>
        ) : (
          <div className="space-y-3 text-sm">
            {status.data && !setup.canSend && (
              <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900">
                <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-4 w-4" aria-hidden />WhatsApp is not connected yet</p>
                <p className="mt-1 text-xs">Messages cannot be sent until these are set on the server:</p>
                <ul className="mt-1 list-disc pl-5 text-xs">{setup.missing.map((m) => <li key={m}>{m}</li>)}</ul>
              </div>
            )}
            {status.data && setup.canSend && !setup.receivesReplies && (
              <p role="status" className="rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-900">Replies and delivery ticks will not show until the webhook is set up ({setup.missingForReplies.join(", ")}).</p>
            )}

            {opener.isPending && <Skeleton className="h-24 w-full" />}
            {opener.isError && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{whatsappErrorMessage(opener.error)}</p>}
            {conv && <Composer key={conv.id} conversation={conv} customerId={customer.id} setupOk={setup.canSend} onSent={() => onOpenChange(false)} />}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Composer({ conversation, customerId, setupOk, onSent }: { conversation: WaConversation; customerId: string; setupOk: boolean; onSent: () => void }) {
  const me = useCrmMe()
  const send = useSendMessage(conversation.id)
  const thread = useCustomerThread(customerId)
  const [text, setText] = useState("")
  const optedOut = conversation.marketing_consent === "OPTED_OUT"
  const canSend = me.can("crm.inbox.reply") && setupOk
  const last = (thread.data?.messages ?? []).slice(-3)

  return (
    <div className="space-y-3">
      <p role="status" className="flex flex-wrap gap-2 text-xs">
        <span className={`rounded-full px-2 py-0.5 font-medium ${conversation.window_open ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{conversation.window_open ? "They wrote to you in the last 24 hours — you can send any message" : "Reply window closed"}</span>
        {optedOut && <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700">Opted out of marketing messages</span>}
      </p>

      {last.length > 0 && (
        <ul className="space-y-1 rounded-md bg-muted/50 p-2 text-xs" aria-label="Latest messages">
          {last.map((m) => <li key={m.id}><span className="font-medium">{m.direction === "OUTBOUND" ? "You" : "Customer"}:</span> {m.body ?? (m.template_name ? `Template ${m.template_name}` : `(${m.msg_type})`)}</li>)}
        </ul>
      )}

      {conversation.window_open ? (
        <form
          className="space-y-2"
          onSubmit={(e) => { e.preventDefault(); const body = text.trim(); if (body && canSend) send.mutate(body, { onSuccess: () => { setText(""); onSent() } }) }}
        >
          <label htmlFor="cw-text" className="text-xs text-muted-foreground">Message</label>
          <Textarea id="cw-text" rows={4} maxLength={4096} value={text} onChange={(e) => setText(e.target.value)} placeholder={`Write to ${conversation.customer_name ?? "the customer"}…`} />
          <div className="flex justify-end"><Button type="submit" disabled={!text.trim() || !canSend || send.isPending}>{send.isPending ? "Sending…" : "Send on WhatsApp"}</Button></div>
        </form>
      ) : (
        <div className="space-y-2 rounded-md border p-3">
          <p>WhatsApp only lets a business start a conversation with an <strong>approved message template</strong>. Once the customer replies, you can write freely for 24 hours.</p>
          <SendTemplateDialog conversationId={conversation.id} consent={conversation.marketing_consent} windowOpen={conversation.window_open} canSend={canSend} />
          {!setupOk && <p className="text-xs text-amber-800">Connect WhatsApp first (see above) to send.</p>}
        </div>
      )}
    </div>
  )
}
