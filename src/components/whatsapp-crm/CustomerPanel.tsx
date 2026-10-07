"use client"

import Link from "next/link"
import { ExternalLink, Megaphone, Phone, UserRound } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn, formatDateTime } from "@/lib/utils"
import type { WaConversationDetail } from "@/types/whatsapp-crm.types"
import { conversationHandle, conversationTitle, initials } from "./helpers"
import { LabelPicker } from "./LabelPicker"

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium">{children}</dd>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2" aria-label={title}>
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      {children}
    </section>
  )
}

export function CustomerPanel({
  conversation,
  canApplyLabels = false,
  footer,
  className,
}: {
  conversation: WaConversationDetail
  canApplyLabels?: boolean
  footer?: React.ReactNode
  className?: string
}) {
  const matched = Boolean(conversation.customer_id)
  const ad = conversation.referral
  const title = conversationTitle(conversation)
  return (
    <aside className={cn("flex h-full min-h-0 flex-col bg-card", className)} aria-label="Customer information">
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-5 p-5">
          <div className="flex flex-col items-center text-center">
            <Avatar className="mb-3 h-16 w-16">
              <AvatarFallback className="bg-emerald-100 text-lg font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                {title === "Unknown" ? <UserRound className="h-7 w-7" /> : initials(title)}
              </AvatarFallback>
            </Avatar>
            <h3 className="max-w-full truncate text-base font-semibold">{title}</h3>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" /> {conversationHandle(conversation) || "No number"}
            </p>
            <Badge className={cn("mt-3", matched && "bg-emerald-600 hover:bg-emerald-600")} variant={matched ? "default" : "outline"}>
              {matched ? "Existing Bakaloo customer" : conversation.phone || conversation.wa_id ? "Not registered yet (lead)" : "Unmatched — phone not shared"}
            </Badge>
          </div>

          {!matched && !conversation.phone && !conversation.wa_id && (
            <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              This customer uses a WhatsApp username, so WhatsApp did not share their phone number. Ask them for their registered number to link this chat to their Bakaloo account.
            </p>
          )}

          <Section title="Labels">
            <LabelPicker conversationId={conversation.id} applied={conversation.labels} canApply={canApplyLabels} />
          </Section>

          <Separator />

          <Section title="Details">
            <dl className="divide-y">
              <Row label="Source">{conversation.source === "META_AD" ? "Meta Click-to-WhatsApp" : "WhatsApp organic"}</Row>
              <Row label="Marketing consent">
                {conversation.marketing_consent === "OPTED_OUT" ? (
                  <span className="text-red-600">Opted out</span>
                ) : conversation.marketing_consent === "OPTED_IN" ? (
                  <span className="text-emerald-700 dark:text-emerald-400">Opted in</span>
                ) : (
                  "Not recorded"
                )}
              </Row>
              <Row label="Last message">{conversation.last_message_at ? formatDateTime(conversation.last_message_at) : "—"}</Row>
              <Row label="Owner">{conversation.assigned_name ?? "Unassigned"}</Row>
              <Row label="Status">
                <Badge variant="secondary" className="font-semibold">{conversation.status}</Badge>
              </Row>
            </dl>
          </Section>

          {ad && (
            <section className="rounded-lg border bg-muted/40 p-3 text-xs">
              <h4 className="mb-1 flex items-center gap-1.5 font-semibold">
                <Megaphone className="h-3.5 w-3.5" /> Ad details
              </h4>
              {ad.headline && <p>{ad.headline}</p>}
              {ad.source_id && <p className="break-all text-muted-foreground">Ad ID: {ad.source_id}</p>}
            </section>
          )}

          <div className="space-y-2">
            {matched && (
              <Link
                href={`/customers?search=${encodeURIComponent(conversation.phone ?? "")}`}
                className="flex items-center justify-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                Open customer profile <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            )}
            {footer}
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">Orders, cart, notes and the activity timeline are added in the next phases.</p>
        </div>
      </ScrollArea>
    </aside>
  )
}
