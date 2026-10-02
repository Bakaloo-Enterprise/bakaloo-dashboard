"use client"

import { useRef, useState } from "react"
import { Download, FileSpreadsheet } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { Forbidden } from "@/components/shared/forbidden"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AvailabilityPanel } from "@/components/business/AvailabilityPanel"
import { BulkPreview } from "@/components/business/BulkPreview"
import { bizError, useBizMe, useBulkMutations, useUpload, useUploads } from "@/hooks/useBusiness"
import { downloadFile } from "@/services/business.service"
import { useActiveShopsForSwitcher } from "@/hooks/useShops"
import type { BulkBatch } from "@/types/business.types"

const STATUS_CLS = { PREVIEW: "bg-amber-100 text-amber-900", APPLIED: "bg-emerald-100 text-emerald-900", DISCARDED: "bg-slate-100 text-slate-600" } as const

export default function CatalogBulkPage() {
  const me = useBizMe()
  const uploads = useUploads()
  const { upload } = useBulkMutations()
  const shops = useActiveShopsForSwitcher()
  const [batchId, setBatchId] = useState<string | null>(null)
  const [exportShop, setExportShop] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BulkBatch | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const batch = useUpload(batchId)

  if (me.isLoading) return <Skeleton className="h-40 w-full" />
  if (!me.data?.catalogBulk) return <Forbidden />

  const pick = (file: File | undefined) => {
    if (!file) return
    setError(null)
    setResult(null)
    upload.mutate(file, { onSuccess: (b) => setBatchId(b.id), onError: (e) => setError(bizError(e)) })
    if (input.current) input.current.value = ""
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Bulk catalog" subtitle="Change stock, prices and availability for many products and stores at once — with a safe preview first." />

      <section className="space-y-3 rounded-lg border p-4" aria-label="Update from a sheet">
        <h2 className="font-semibold">Update from an Excel / CSV sheet</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Download the template (or your current catalog), change what you need, leave other cells blank.</li>
          <li>Upload it. You will see every change and every error — nothing is applied yet.</li>
          <li>Confirm to apply.</li>
        </ol>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void downloadFile("template")}><Download className="mr-1 h-4 w-4" />Template</Button>
          <select aria-label="Store to export" className="h-8 rounded-md border bg-background px-2 text-xs" value={exportShop} onChange={(e) => setExportShop(e.target.value)}>
            <option value="">All stores</option>
            {(shops.data?.items ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <Button variant="outline" size="sm" onClick={() => void downloadFile("export", exportShop ? { shopId: exportShop } : {})}><Download className="mr-1 h-4 w-4" />Current catalog</Button>
          <Button size="sm" disabled={upload.isPending} onClick={() => input.current?.click()}><FileSpreadsheet className="mr-1 h-4 w-4" />{upload.isPending ? "Checking…" : "Upload a sheet"}</Button>
          <input ref={input} type="file" accept=".csv,.xlsx" className="sr-only" aria-label="Choose a sheet" onChange={(e) => pick(e.target.files?.[0])} />
        </div>
        {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </section>

      {result?.result && (
        <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Applied {result.result.appliedRows} row(s) across {result.result.shops} store(s) and {result.result.products} product(s); {result.result.stockMovements} stock change(s) recorded
          {result.result.skippedRows > 0 && `; ${result.result.skippedRows} row(s) with errors skipped`}.
        </p>
      )}
      {batchId && batch.data?.status === "PREVIEW" && <BulkPreview batch={batch.data} onDone={(applied) => { setBatchId(null); setResult(applied ?? null) }} />}

      <AvailabilityPanel />

      <section className="rounded-lg border p-4" aria-label="Recent uploads">
        <h2 className="mb-2 font-semibold">Recent uploads</h2>
        {(uploads.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No uploads yet.</p> : (
          <ul className="space-y-1.5 text-sm">
            {uploads.data!.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{u.fileName ?? "upload"} <span className="text-xs text-muted-foreground">{new Date(u.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}{u.createdBy && ` · ${u.createdBy}`}</span></span>
                <span className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">{u.totals.valid} change · {u.totals.errors} errors</span>
                  <span className={`rounded px-1.5 py-0.5 font-medium ${STATUS_CLS[u.status]}`}>{u.status.toLowerCase()}</span>
                  {u.status === "PREVIEW" && <Button size="sm" variant="ghost" onClick={() => setBatchId(u.id)}>Open</Button>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
