"use client"

import Link from "next/link"
import { ExternalLink, UserRound } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatDateTime } from "@/lib/utils"
import type { WaConversationDetail } from "@/types/whatsapp-crm.types"
import { conversationHandle, conversationTitle } from "./helpers"
import { LabelPicker } from "./LabelPicker"

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  )
}

export function CustomerPanel({ conversation, canApplyLabels = false, footer }: { conversation: WaConversationDetail; canApplyLabels?: boolean; footer?: React.ReactNode }) {
  const matched = Boolean(conversation.customer_id)
  const ad = conversation.referral
  return (
    <aside className="h-full overflow-y-auto border-l p-4" aria-label="Customer information">
      <div className="mb-4 flex flex-col items-center text-center">
        <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <UserRound className="h-7 w-7 text-muted-foreground" />
        </div>
        <h3 className="text-sm font-semibold">{conversationTitle(conversation)}</h3>
        <p className="text-xs text-muted-foreground">{conversationHandle(conversation)}</p>
        <Badge className="mt-2" variant={matched ? "default" : "outline"}>
          {matched ? "Existing Bakaloo customer" : conversation.phone ? "Not registered yet (lead)" : "Unmatched — phone not shared"}
        </Badge>
      </div>

      {!matched && !conversation.phone && (
        <p className="mb-4 rounded-md bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          This customer uses a WhatsApp username, so WhatsApp did not share their phone number. Ask them for their registered
          number to link this chat to their Bakaloo account.
        </p>
      )}

      <section className="mb-4" aria-label="Labels">
        <h4 className="mb-1.5 text-xs font-semibold uppercase text-muted-foreground">Labels</h4>
        <LabelPicker conversationId={conversation.id} applied={conversation.labels} canApply={canApplyLabels} />
      </section>

      <dl className="divide-y">
        <Row label="Source">{conversation.source === "META_AD" ? "Meta Click-to-WhatsApp" : "WhatsApp organic"}</Row>
        <Row label="Marketing consent">
          {conversation.marketing_consent === "OPTED_OUT" ? (
            <span className="text-red-600">Opted out</span>
          ) : conversation.marketing_consent === "OPTED_IN" ? (
            "Opted in"
          ) : (
            "Not recorded"
          )}
        </Row>
        <Row label="Last message">{conversation.last_message_at ? formatDateTime(conversation.last_message_at) : "—"}</Row>
        <Row label="Owner">{conversation.assigned_name ?? "Unassigned"}</Row>
        <Row label="Status">{conversation.status}</Row>
      </dl>

      {ad && (
        <section className="mt-4 rounded-md border p-3 text-xs">
          <h4 className="mb-1 font-semibold">Ad details</h4>
          {ad.headline && <p>{ad.headline}</p>}
          {ad.source_id && <p className="text-muted-foreground">Ad ID: {ad.source_id}</p>}
        </section>
      )}

      {matched && (
        <Link
          href={`/customers?search=${encodeURIComponent(conversation.phone ?? "")}`}
          className="mt-4 flex items-center justify-center gap-1 rounded-md border px-3 py-2 text-sm hover:bg-muted"
        >
          Open customer profile <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      )}

      {footer}

      <p className="mt-6 text-[11px] text-muted-foreground">
        Orders, cart, notes and the activity timeline are added in the next phases.
      </p>
    </aside>
  )
}
