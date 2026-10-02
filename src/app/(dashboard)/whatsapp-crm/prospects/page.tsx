"use client"

import { useRef, useState } from "react"
import { Upload } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/shared/PageHeader"
import { Forbidden } from "@/components/shared/forbidden"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { ProspectPreview } from "@/components/whatsapp-crm/ProspectPreview"
import { fileProblem } from "@/components/whatsapp-crm/prospect-helpers"
import { useCrmMe, useProspectImports, useProspectMutations } from "@/hooks/useWhatsappCrm"
import { formatRelativeTime } from "@/lib/utils"

export default function ProspectsPage() {
  const me = useCrmMe()
  const canView = me.can("crm.campaigns.view")
  const canManage = me.can("crm.campaigns.manage")
  const list = useProspectImports(canView)
  const m = useProspectMutations()
  const [openId, setOpenId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  if (me.isLoading) return <Skeleton className="h-40 w-full" />
  if (!canView) return <Forbidden />

  const onFile = (file: File | undefined) => {
    if (!file) return
    const problem = fileProblem(file)
    if (problem) return void toast.error(problem)
    m.upload.mutate({ file, name }, { onSuccess: (imp) => { setOpenId(imp.id); setName("") } })
    if (fileRef.current) fileRef.current.value = ""
  }
  const imports = list.data ?? []

  return (
    <div className="space-y-5">
      <PageHeader title="Prospects" subtitle="Upload a sheet of wholesale prospects. You see who is new, already known, invalid or opted out before anyone is added. Nothing is sent from here." />

      {canManage && (
        <section className="rounded-lg border bg-card p-4" aria-label="Upload a prospect list">
          <h3 className="text-sm font-semibold">Upload a list</h3>
          <p className="mt-1 text-xs text-muted-foreground">A .csv or .xlsx file with a “Phone” column. “Name” and “Business” columns are optional. Up to 5,000 rows.</p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="p-name" className="text-xs">List name (optional)</Label>
              <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className="mt-1 w-64" placeholder="e.g. Kolkata kirana shops" />
            </div>
            <input ref={fileRef} type="file" accept=".csv,.xlsx" className="sr-only" aria-label="Choose a prospect file" onChange={(e) => onFile(e.target.files?.[0])} />
            <Button disabled={m.upload.isPending} onClick={() => fileRef.current?.click()}><Upload className="mr-1 h-4 w-4" /> {m.upload.isPending ? "Checking…" : "Choose file"}</Button>
          </div>
        </section>
      )}

      {openId && (
        <section className="rounded-lg border bg-card p-4" aria-label="List preview">
          <ProspectPreview id={openId} canManage={canManage} onDone={() => setOpenId(null)} />
        </section>
      )}

      <ul className="space-y-2" aria-label="Prospect lists">
        {list.isLoading && <li><Skeleton className="h-16 w-full" /></li>}
        {!list.isLoading && imports.length === 0 && <li className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No prospect lists yet.</li>}
        {imports.map((i) => (
          <li key={i.id}>
            <button type="button" onClick={() => setOpenId(i.id)} aria-label={`Open list ${i.name}`} className="w-full rounded-lg border bg-card p-3 text-left hover:bg-muted/40">
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">{i.name} <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${i.status === "CONFIRMED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{i.status === "CONFIRMED" ? "Added" : "Not added yet"}</span></span>
                <span className="text-xs text-muted-foreground">{formatRelativeTime(i.created_at)}</span>
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{i.total_rows} rows · {i.counts.NEW ?? 0} new · {(i.counts.INVALID ?? 0) + (i.counts.DUPLICATE ?? 0)} invalid or repeated</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
