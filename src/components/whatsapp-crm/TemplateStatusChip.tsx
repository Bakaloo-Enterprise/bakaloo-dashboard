"use client"

import { AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { WaTemplate } from "@/types/whatsapp-crm.types"
import { STATUS_STYLE } from "./template-helpers"

const QUALITY: Record<string, { label: string; cls: string }> = {
  GREEN: { label: "High quality", cls: "text-emerald-700" },
  YELLOW: { label: "Medium quality", cls: "text-amber-700" },
  RED: { label: "Low quality", cls: "text-red-700" },
}

/** Status + the things that matter next to it: flagged, quality, a coming category change. */
export function TemplateStatusChip({ t, showExtras = true }: { t: Pick<WaTemplate, "status" | "flagged" | "quality_score" | "pending_category" | "pending_category_at">; showExtras?: boolean }) {
  const st = STATUS_STYLE[t.status]
  const q = t.quality_score ? QUALITY[t.quality_score] : null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", st.cls)} title={st.hint}>
        {st.label}
      </span>
      {showExtras && t.flagged && (
        <span className="flex items-center gap-0.5 text-[11px] font-medium text-orange-700" title="Customers are giving this template negative feedback. Meta may disable it.">
          <AlertTriangle className="h-3 w-3" aria-hidden /> At risk
        </span>
      )}
      {showExtras && q && t.status === "APPROVED" && <span className={cn("text-[11px]", q.cls)}>{q.label}</span>}
      {showExtras && t.pending_category && (
        <span className="text-[11px] font-medium text-orange-700" title="Meta will change this template's category, which changes what each message costs.">
          Becoming {t.pending_category.toLowerCase()}
          {t.pending_category_at ? ` on ${new Date(t.pending_category_at).toLocaleDateString()}` : " soon"}
        </span>
      )}
    </div>
  )
}
