"use client"

import { useState } from "react"
import { Search } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { Forbidden } from "@/components/shared/forbidden"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PipelineBoardView } from "@/components/whatsapp-crm/PipelineBoard"
import { useDebounce } from "@/hooks/useDebounce"
import { useCrmMe, useLabels, useMoveCard, usePipeline } from "@/hooks/useWhatsappCrm"

const ANY = "__any__"

export default function PipelinePage() {
  const me = useCrmMe()
  const allowed = me.can("crm.pipeline.view")
  const [search, setSearch] = useState("")
  const [owner, setOwner] = useState("")
  const [labelId, setLabelId] = useState("")
  const [b2b, setB2b] = useState<"" | "B2B" | "B2C">("")
  const debounced = useDebounce(search, 300)

  const labels = useLabels()
  const board = usePipeline({ search: debounced || undefined, assignedTo: owner || undefined, labelId: labelId || undefined, b2b: b2b || undefined }, allowed)
  const move = useMoveCard()

  if (me.isLoading) return <Skeleton className="h-40 w-full" />
  if (!allowed) return <Forbidden />

  const total = (board.data?.stages ?? []).reduce((n, s) => n + s.cards.length, 0) + (board.data?.unstaged.length ?? 0)

  return (
    <div className="space-y-3">
      <PageHeader title="Customer Pipeline" subtitle="Drag a customer to another stage. Stages for orders update automatically." />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or number" className="pl-8" aria-label="Search customers" />
        </div>
        <Select value={owner || ANY} onValueChange={(v) => setOwner(v === ANY ? "" : v)}>
          <SelectTrigger className="h-9 w-36 text-xs" aria-label="Filter by owner"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any owner</SelectItem>
            <SelectItem value="me">Mine</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
          </SelectContent>
        </Select>
        <Select value={labelId || ANY} onValueChange={(v) => setLabelId(v === ANY ? "" : v)}>
          <SelectTrigger className="h-9 w-40 text-xs" aria-label="Filter by label"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any label</SelectItem>
            {(labels.data ?? []).map((l) => (
              <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={b2b || ANY} onValueChange={(v) => setB2b(v === ANY ? "" : (v as "B2B" | "B2C"))}>
          <SelectTrigger className="h-9 w-32 text-xs" aria-label="Filter B2B or B2C"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>B2B + B2C</SelectItem>
            <SelectItem value="B2B">B2B only</SelectItem>
            <SelectItem value="B2C">B2C only</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">{total} customers</span>
      </div>

      {board.data?.truncated && (
        <p role="status" className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          Showing the 500 most recently active customers. Use the filters to narrow down.
        </p>
      )}
      {board.isLoading && <Skeleton className="h-64 w-full" />}
      {board.isError && <p role="alert" className="text-sm text-red-600">Could not load the pipeline.</p>}
      {board.data && (
        <PipelineBoardView board={board.data} canMove={me.can("crm.pipeline.move")} onMove={(contactId, stageId) => move.mutate({ contactId, stageId })} />
      )}
    </div>
  )
}
