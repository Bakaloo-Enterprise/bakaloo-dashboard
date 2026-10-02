"use client"

import { Bot, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSetConversationBot } from "@/hooks/useWhatsappCrm"
import { cn } from "@/lib/utils"
import type { WaConversation } from "@/types/whatsapp-crm.types"

/** Handoff reasons that mean "a customer is waiting for a person" (not just "an agent took over"). */
export const NEEDS_PERSON_REASONS = new Set(["NO_MATCH", "REQUESTED", "MEDIA", "RATE_LIMITED", "SEND_FAILED", "ERROR"])

export function needsPerson(c: Pick<WaConversation, "bot_state" | "bot_handoff_reason">): boolean {
  return c.bot_state === "HUMAN" && NEEDS_PERSON_REASONS.has(c.bot_handoff_reason ?? "")
}

interface Props {
  conversation: Pick<WaConversation, "id" | "bot_state" | "bot_handoff_reason">
  botEnabled: boolean
  canControl: boolean
}

/** Shows who is answering this chat and lets an agent take over or hand it back. Hidden while the bot is globally off. */
export function BotStateControl({ conversation, botEnabled, canControl }: Props) {
  const set = useSetConversationBot()
  if (!botEnabled) return null
  const human = conversation.bot_state === "HUMAN"

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          "flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
          human ? (needsPerson(conversation) ? "bg-red-100 text-red-700" : "bg-sky-100 text-sky-700") : "bg-violet-100 text-violet-700",
        )}
      >
        {human ? <UserRound className="h-3 w-3" aria-hidden /> : <Bot className="h-3 w-3" aria-hidden />}
        {human ? (needsPerson(conversation) ? "Needs a person" : "With team") : "Bot active"}
      </span>
      {canControl && (
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={set.isPending} onClick={() => set.mutate({ id: conversation.id, state: human ? "BOT" : "HUMAN" })}>
          {human ? "Resume bot" : "Take over"}
        </Button>
      )}
    </div>
  )
}
