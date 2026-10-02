"use client"

import { useMemo, useState } from "react"
import { PageHeader } from "@/components/shared/PageHeader"
import { Forbidden } from "@/components/shared/forbidden"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { AnalyticsOverviewTab } from "@/components/whatsapp-crm/AnalyticsOverviewTab"
import { BreakdownTab } from "@/components/whatsapp-crm/BreakdownTab"
import { CostTab } from "@/components/whatsapp-crm/CostTab"
import { InboxReportTab } from "@/components/whatsapp-crm/InboxReportTab"
import { ORDER_WINDOWS, PRESETS, presetRange, rangeProblem, toQuery, type RangePreset } from "@/components/whatsapp-crm/analytics-helpers"
import { useAnalyticsOverview, useCrmMe } from "@/hooks/useWhatsappCrm"

type Tab = "overview" | "campaigns" | "workflows" | "templates" | "inbox" | "cost"
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "campaigns", label: "Campaigns" },
  { id: "workflows", label: "Automatic messages" },
  { id: "templates", label: "Templates" },
  { id: "inbox", label: "Inbox & team" },
  { id: "cost", label: "Cost & prices" },
]

export default function WhatsappAnalyticsPage() {
  const me = useCrmMe()
  const canView = me.can("crm.analytics.view")
  const [tab, setTab] = useState<Tab>("overview")
  const [preset, setPreset] = useState<RangePreset>("30d")
  const [custom, setCustom] = useState(() => presetRange("30d"))
  const [window, setWindow] = useState(7)

  const range = useMemo(() => (preset === "custom" ? custom : presetRange(preset)), [preset, custom])
  const problem = preset === "custom" ? rangeProblem(range.from, range.to) : null
  const query = toQuery(range, window)
  const overview = useAnalyticsOverview(query, canView && !problem)

  if (me.isLoading) return <Skeleton className="h-40 w-full" />
  if (!canView) return <Forbidden />

  return (
    <div className="space-y-5">
      <PageHeader title="Analytics" subtitle="How your WhatsApp messages perform, what they earn, and what they cost. Figures update as Meta reports delivery." />

      <div className="flex flex-wrap items-end gap-3" aria-label="Period">
        <div className="flex gap-1" role="group" aria-label="Period">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" aria-pressed={preset === p.id} onClick={() => setPreset(p.id)} className={`rounded-full border px-3 py-1 text-xs ${preset === p.id ? "border-primary bg-primary/10 font-semibold" : "hover:bg-muted"}`}>{p.label}</button>
          ))}
          <button type="button" aria-pressed={preset === "custom"} onClick={() => setPreset("custom")} className={`rounded-full border px-3 py-1 text-xs ${preset === "custom" ? "border-primary bg-primary/10 font-semibold" : "hover:bg-muted"}`}>Custom</button>
        </div>
        {preset === "custom" && (
          <div className="flex items-center gap-2 text-xs">
            <label htmlFor="a-from">From</label>
            <Input id="a-from" type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className="h-8 w-36" />
            <label htmlFor="a-to">To</label>
            <Input id="a-to" type="date" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className="h-8 w-36" />
          </div>
        )}
        <div className="text-xs">
          <label htmlFor="a-window" className="mr-2 text-muted-foreground">Count orders placed within</label>
          <select id="a-window" className="h-8 rounded-md border bg-background px-2 text-xs" value={window} onChange={(e) => setWindow(Number(e.target.value))}>
            {ORDER_WINDOWS.map((d) => <option key={d} value={d}>{d} day{d === 1 ? "" : "s"}</option>)}
          </select>
          <span className="ml-2 text-muted-foreground">of a message</span>
        </div>
      </div>
      {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}

      <div className="flex flex-wrap gap-1 border-b" role="tablist" aria-label="Reports">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === t.id ? "border-primary font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{t.label}</button>
        ))}
      </div>

      {!problem && (
        <div role="tabpanel" aria-label={TABS.find((t) => t.id === tab)?.label}>
          {tab === "overview" && (overview.isLoading ? <Skeleton className="h-64 w-full" /> : overview.isError || !overview.data ? <p role="alert" className="text-sm text-red-600">Could not load the report. Try again.</p> : <AnalyticsOverviewTab data={overview.data} onGoToCost={() => setTab("cost")} />)}
          {tab === "campaigns" && <BreakdownTab by="campaign" query={query} />}
          {tab === "workflows" && <BreakdownTab by="workflow" query={query} />}
          {tab === "templates" && <BreakdownTab by="template" query={query} />}
          {tab === "inbox" && <InboxReportTab query={{ from: query.from, to: query.to }} />}
          {tab === "cost" && <CostTab overview={overview.data} canManage={me.can("crm.rates.manage")} />}
        </div>
      )}
    </div>
  )
}
