"use client"

import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { WaLabelRef } from "@/types/whatsapp-crm.types"

/** Readable text colour (black/white) for a hex background. */
export function readableOn(hex: string): string {
  const h = hex.replace("#", "")
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#111827" : "#FFFFFF"
}

interface Props {
  label: WaLabelRef
  onRemove?: () => void
  className?: string
}

export function LabelChip({ label, onRemove, className }: Props) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium leading-4", className)}
      style={{ backgroundColor: label.color, color: readableOn(label.color) }}
    >
      {label.name}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Remove label ${label.name}`} className="opacity-80 hover:opacity-100">
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  )
}
