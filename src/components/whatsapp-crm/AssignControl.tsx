"use client"

import { Hand } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAgents, useAssignConversation } from "@/hooks/useWhatsappCrm"
import type { WaConversation } from "@/types/whatsapp-crm.types"

const UNASSIGNED = "__none__"

interface Props {
  conversation: Pick<WaConversation, "id" | "assigned_to" | "assigned_name">
  meId: string | undefined
  canAssign: boolean
  canReply: boolean
}

/**
 * Managers pick any agent (or "Unassigned"); an agent just sees the owner and,
 * on an unassigned chat, a "Take" button. Server rules mirror this exactly.
 */
export function AssignControl({ conversation, meId, canAssign, canReply }: Props) {
  const agents = useAgents()
  const assign = useAssignConversation()
  const owner = conversation.assigned_to

  if (canAssign) {
    return (
      <Select
        value={owner ?? UNASSIGNED}
        onValueChange={(v) => assign.mutate({ id: conversation.id, userId: v === UNASSIGNED ? null : v })}
        disabled={assign.isPending}
      >
        <SelectTrigger className="h-8 w-44 text-xs" aria-label="Assigned to">
          <SelectValue placeholder="Assign to…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
          {(agents.data ?? []).map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.name || a.email}
              {a.id === meId ? " (you)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (!owner && canReply && meId) {
    return (
      <Button size="sm" variant="outline" className="h-8" disabled={assign.isPending} onClick={() => assign.mutate({ id: conversation.id, userId: meId })}>
        <Hand className="mr-1 h-3.5 w-3.5" /> Take this chat
      </Button>
    )
  }

  return <span className="text-xs text-muted-foreground">{owner ? `Owner: ${conversation.assigned_name ?? "—"}` : "Unassigned"}</span>
}
