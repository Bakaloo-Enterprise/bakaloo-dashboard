"use client"

import { Check, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useConversationLabel, useLabels } from "@/hooks/useWhatsappCrm"
import type { WaLabelRef } from "@/types/whatsapp-crm.types"
import { LabelChip } from "./LabelChip"

interface Props {
  conversationId: string
  applied: WaLabelRef[]
  canApply: boolean
}

/** Chips for the customer's labels plus a popover to toggle any label on/off. */
export function LabelPicker({ conversationId, applied, canApply }: Props) {
  const all = useLabels()
  const toggle = useConversationLabel()
  const appliedIds = new Set(applied.map((l) => l.id))

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {applied.length === 0 && <span className="text-xs text-muted-foreground">No labels</span>}
      {applied.map((l) => (
        <LabelChip
          key={l.id}
          label={l}
          onRemove={canApply ? () => toggle.mutate({ id: conversationId, labelId: l.id, add: false }) : undefined}
        />
      ))}
      {canApply && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-6 px-2 text-xs" aria-label="Add label">
              <Plus className="mr-1 h-3 w-3" /> Label
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-1">
            {(all.data ?? []).length === 0 && <p className="p-2 text-xs text-muted-foreground">No labels created yet.</p>}
            <ul className="max-h-64 overflow-y-auto">
              {(all.data ?? []).map((l) => {
                const on = appliedIds.has(l.id)
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      disabled={toggle.isPending}
                      onClick={() => toggle.mutate({ id: conversationId, labelId: l.id, add: !on })}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                    >
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: l.color }} />
                      <span className="flex-1 truncate">{l.name}</span>
                      {on && <Check className="h-4 w-4 text-emerald-600" aria-label="Applied" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
