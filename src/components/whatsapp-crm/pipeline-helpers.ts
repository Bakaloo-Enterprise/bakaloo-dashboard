import type { CardPriority, NextAction, PipelineCard } from "@/types/whatsapp-crm.types"
import { conversationTitle } from "./helpers"

export const NEXT_ACTION_LABEL: Record<NextAction, string> = {
  REPLY_NOW: "Reply now",
  CALL_BACK: "Call back",
  SEND_COUPON: "Send coupon",
  ASSIGN_TO_B2B: "Assign to B2B",
  NO_ACTION: "No action",
}

export const PRIORITY_LABEL: Record<CardPriority, string> = { HIGH: "High priority", MEDIUM: "Medium", NORMAL: "Normal" }

export function cardTitle(c: PipelineCard): string {
  return conversationTitle(c)
}

/** "8 min", "2 h", "3 d" — compact waiting time. */
export function formatWait(minutes: number): string {
  if (minutes < 1) return "now"
  if (minutes < 60) return `${minutes} min`
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} h`
  return `${Math.floor(minutes / (60 * 24))} d`
}
