"use client"

/**
 * "Bulk import" for Shop Products: the existing Bulk catalog (sheet upload with a safe preview, plus assign / switch on / switch off)
 * opened as a form from the Add product row, in the ERP look. Same endpoints and permission (`catalogBulk`) as the Bulk catalog page.
 */
import { useRef, useState } from "react"
import { CheckCircle2, Download, FileSpreadsheet, Layers, Upload, X } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useDebounce } from "@/hooks/useDebounce"
import { useFeatureAccess } from "@/hooks/useFeatures"
import { Button } from "@/components/ui/button"
import { bizError, useBizMe, useBulkMutations, useUpload, useUploadRows, useUploads } from "@/hooks/useBusiness"
import { useProducts } from "@/hooks/useProducts"
import { useActiveShopsForSwitcher } from "@/hooks/useShops"
import { downloadFile } from "@/services/business.service"
import type { AvailabilityResult, BulkBatch, BulkRowStatus } from "@/types/business.types"
import { ErpSkin, Seg, Tag } from "./ui"
import { cn } from "@/lib/utils"

const btn = "inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition"
const btnOutline = `${btn} border border-slate-200 bg-white text-slate-700 hover:border-emerald-300 disabled:opacity-50`
const btnPrimary = `${btn} bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50`
const STATUS_TONE = { PREVIEW: "amber", APPLIED: "lime", DISCARDED: "slate" } as const

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-emerald-700 text-e10 font-bold text-white">{n}</span>{children}</div>
}

// ─────────────── the preview of what a sheet would do ───────────────
const TABS: Array<{ id: BulkRowStatus; label: (b: BulkBatch) => string }> = [
  { id: "VALID", label: (b) => `Will change · ${b.totals.valid}` },
  { id: "ERROR", label: (b) => `Errors · ${b.totals.errors}` },
  { id: "UNCHANGED", label: (b) => `No change · ${b.totals.unchanged}` },
]

function Preview({ batch, onDone }: { batch: BulkBatch; onDone: (applied?: BulkBatch) => void }) {
  const m = useBulkMutations()
  const [status, setStatus] = useState<BulkRowStatus>(batch.totals.errors > 0 ? "ERROR" : "VALID")
  const [offset, setOffset] = useState(0)
  const [skip, setSkip] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const rows = useUploadRows(batch.id, status, offset)
  const t = batch.totals
  const blocked = t.errors > 0 && !skip
  const nothing = t.valid === 0
  return (
    <section aria-label="Preview" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-bold">Preview — {batch.fileName ?? "upload"}</h3>
          <p role="status" className="mt-0.5 text-xs text-slate-500">{t.rows} rows · <b className="text-emerald-700">{t.valid} will change</b> across {t.shops ?? 0} store(s) and {t.products ?? 0} product(s) · <span className={t.errors ? "font-semibold text-rose-600" : ""}>{t.errors} with errors</span> · {t.unchanged} already match</p>
          {(batch.ignoredColumns?.length ?? 0) > 0 && <p className="text-e11 text-slate-400">Ignored columns: {batch.ignoredColumns!.join(", ")}</p>}
        </div>
        <button type="button" disabled={m.discard.isPending} onClick={() => m.discard.mutate(batch.id, { onSuccess: () => onDone() })} className={btnOutline}>Discard</button>
      </header>
      <Seg<BulkRowStatus> size="xs" label="Rows" value={status} onChange={(s) => { setStatus(s); setOffset(0) }} options={TABS.map((x) => ({ id: x.id, label: x.label(batch) }))} />
      <div className="max-h-72 overflow-auto rounded-xl border border-[#e3e8dd]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#f6f8f2]"><tr className="text-left text-e10 uppercase tracking-wider text-slate-500"><th className="px-3 py-2">Row</th><th className="px-3 py-2">Product</th><th className="px-3 py-2">Store</th><th className="px-3 py-2">{status === "ERROR" ? "Problem" : "Change"}</th></tr></thead>
          <tbody>
            {(rows.data?.items ?? []).map((r) => (
              <tr key={r.rowNo} className="border-t border-[#eef1ea] align-top">
                <td className="num px-3 py-2 text-slate-500">{r.rowNo}</td>
                <td className="px-3 py-2 font-medium text-slate-800">{r.product ? <>{r.product.name}<span className="ml-1 text-e10 font-normal text-slate-400">{r.product.sku}</span></> : <span className="text-slate-400">{Object.values(r.raw)[0] || "—"}</span>}</td>
                <td className="px-3 py-2">{r.store ? r.store.branchCode : "—"}</td>
                <td className={cn("px-3 py-2", status === "ERROR" ? "text-rose-600" : "text-slate-600")}>{status === "ERROR" ? r.errors.join(" ") : status === "VALID" ? r.summary : "Same as the store has now"}</td>
              </tr>
            ))}
            {!rows.isLoading && (rows.data?.items.length ?? 0) === 0 && <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-400">Nothing here.</td></tr>}
          </tbody>
        </table>
      </div>
      {(rows.data?.total ?? 0) > (rows.data?.limit ?? 100) && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 100))} className={btnOutline}>Previous</button>
          <span className="num">{offset + 1}–{Math.min(offset + 100, rows.data!.total)} of {rows.data!.total}</span>
          <button type="button" disabled={offset + 100 >= rows.data!.total} onClick={() => setOffset(offset + 100)} className={btnOutline}>Next</button>
        </div>
      )}
      {t.errors > 0 && (
        <label className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <input type="checkbox" checked={skip} onChange={(e) => setSkip(e.target.checked)} className="accent-emerald-700" style={{ minHeight: 0 }} />
          Apply the {t.valid} good row(s) and skip the {t.errors} row(s) with errors
        </label>
      )}
      {confirming ? (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
          <p className="text-sm font-bold">Apply these changes?</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">{t.valid} row(s) across {t.shops ?? 0} store(s) and {t.products ?? 0} product(s) will be changed{t.errors > 0 ? `; ${t.errors} row(s) with errors will be skipped` : ""}. Stock changes are recorded in the stock history. This cannot be undone in one click.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => setConfirming(false)} className={btnOutline}>Not yet</button>
            <button type="button" disabled={m.apply.isPending} className={btnPrimary}
              onClick={() => m.apply.mutate({ id: batch.id, skipErrors: skip }, { onSuccess: (done) => { setConfirming(false); onDone(done) }, onError: () => setConfirming(false) })}><CheckCircle2 className="size-4" />Yes, apply</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={blocked || nothing || m.apply.isPending} onClick={() => setConfirming(true)} className={btnPrimary}>Apply {t.valid} change(s)…</button>
          {blocked && <span className="text-e11 text-rose-600">Fix the sheet and upload again, or tick the box above to skip the errors.</span>}
          {nothing && <span className="text-e11 text-slate-500">Nothing in this sheet would change anything.</span>}
        </div>
      )}
    </section>
  )
}

// ─────────────── assign / switch on / switch off ───────────────
type Action = "ASSIGN" | "ENABLE" | "DISABLE"
const ACTIONS: Array<[Action, string, string]> = [
  ["ASSIGN", "Assign to stores", "Add the products to the chosen stores (stock 0, switched off until stocked)."],
  ["ENABLE", "Switch on", "Make the products available where they have stock."],
  ["DISABLE", "Switch off", "Hide the products in the chosen stores."],
]

function Availability() {
  const shops = useActiveShopsForSwitcher()
  const { availability } = useBulkMutations()
  const [action, setAction] = useState<Action>("ASSIGN")
  const [search, setSearch] = useState("")
  const q = useDebounce(search, 250)
  const found = useProducts({ search: q, limit: 8 })
  const [picked, setPicked] = useState<Array<{ id: string; name: string }>>([])
  const [shopIds, setShopIds] = useState<string[]>([])
  const [plan, setPlan] = useState<AvailabilityResult | null>(null)
  const reset = () => setPlan(null)
  const input = { action, productIds: picked.map((p) => p.id), shopIds }
  const ready = picked.length > 0 && shopIds.length > 0
  const allShops = shops.data?.items ?? []
  return (
    <section aria-label="Assign, switch on or off" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div><h3 className="text-base font-bold">Assign, switch on or switch off</h3><p className="text-xs text-slate-500">{ACTIONS.find((a) => a[0] === action)![2]}</p></div>
      <Seg<Action> size="xs" label="Action" value={action} onChange={(a) => { setAction(a); reset() }} options={ACTIONS.map(([id, label]) => ({ id, label }))} />
      <div>
        <label htmlFor="bulk-av-search" className="fld-lbl mb-1 block">Products</label>
        <input id="bulk-av-search" className="fld fld-sans" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a product to add" autoComplete="off" />
        {q.length > 0 && (
          <ul aria-label="Products found" className="mt-1 max-h-40 overflow-auto rounded-xl border border-[#e3e8dd] bg-white">
            {(found.data?.products ?? []).filter((p) => !picked.some((x) => x.id === p.id)).map((p) => (
              <li key={p.id}><button type="button" className="w-full px-3 py-2 text-left text-xs hover:bg-lime-50" style={{ minHeight: 0 }} onClick={() => { setPicked((x) => [...x, { id: p.id, name: p.name }]); setSearch(""); reset() }}>{p.name}</button></li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {picked.map((p) => <span key={p.id} className="inline-flex items-center gap-1 rounded-full bg-lime-100 px-2.5 py-1 text-e11 font-semibold text-lime-700 ring-1 ring-lime-200">{p.name}<button type="button" aria-label={`Remove ${p.name}`} style={{ minHeight: 0 }} onClick={() => { setPicked((x) => x.filter((y) => y.id !== p.id)); reset() }}><X className="size-3" /></button></span>)}
        </div>
      </div>
      <fieldset>
        <legend className="fld-lbl mb-1">Stores</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
          <label className="flex items-center gap-1.5 font-semibold"><input type="checkbox" className="accent-emerald-700" style={{ minHeight: 0 }} checked={allShops.length > 0 && shopIds.length === allShops.length} onChange={(e) => { setShopIds(e.target.checked ? allShops.map((s) => s.id) : []); reset() }} />All stores</label>
          {allShops.map((s) => <label key={s.id} className="flex items-center gap-1.5"><input type="checkbox" className="accent-emerald-700" style={{ minHeight: 0 }} checked={shopIds.includes(s.id)} onChange={(e) => { setShopIds((x) => (e.target.checked ? [...x, s.id] : x.filter((y) => y !== s.id))); reset() }} />{s.name}</label>)}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btnOutline} disabled={!ready || availability.isPending} onClick={() => availability.mutate({ ...input, dryRun: true }, { onSuccess: setPlan })}>Check what would change</button>
        <button type="button" className={btnPrimary} disabled={!plan || !plan.dryRun || plan.willChange === 0 || availability.isPending} onClick={() => availability.mutate({ ...input, dryRun: false }, { onSuccess: setPlan })}>Apply to {plan?.willChange ?? 0}</button>
      </div>
      {plan && (
        <p role="status" className={cn("rounded-xl border px-3 py-2 text-xs", plan.dryRun ? "border-slate-200 bg-slate-50 text-slate-700" : "border-lime-200 bg-lime-50 text-lime-800")}>
          {plan.dryRun ? `${plan.willChange} would change` : `${plan.applied} changed`} · {plan.alreadyDone} already done
          {plan.skipped.noStock > 0 && ` · ${plan.skipped.noStock} skipped (no stock)`}
          {plan.skipped.notAssigned > 0 && ` · ${plan.skipped.notAssigned} skipped (not in that store)`}
          {plan.skipped.removed > 0 && ` · ${plan.skipped.removed} skipped (removed from store)`}
          {plan.inactiveStores.length > 0 && ` · ignored inactive: ${plan.inactiveStores.join(", ")}`}
        </p>
      )}
    </section>
  )
}

// ─────────────── the dialog ───────────────
export function BulkImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<"sheet" | "availability">("sheet")
  const uploads = useUploads()
  const { upload } = useBulkMutations()
  const shops = useActiveShopsForSwitcher()
  const [batchId, setBatchId] = useState<string | null>(null)
  const [exportShop, setExportShop] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BulkBatch | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const batch = useUpload(batchId)

  const pick = (file: File | undefined) => {
    if (!file) return
    setError(null); setResult(null)
    upload.mutate(file, { onSuccess: (b) => setBatchId(b.id), onError: (e) => setError(bizError(e)) })
    if (input.current) input.current.value = ""
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-h-[92vh] max-w-5xl gap-0 overflow-y-auto border-0 bg-white p-0 sm:rounded-2xl">
        <ErpSkin className="p-5 sm:p-6">
          <div className="mb-5 flex items-start gap-3 pr-8">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Layers className="size-5" /></div>
            <div>
              <DialogTitle className="text-lg font-bold tracking-tight">Bulk import</DialogTitle>
              <DialogDescription className="text-xs text-slate-500">Change stock, prices and availability for many products and stores at once — with a safe preview first. Nothing is applied until you confirm.</DialogDescription>
            </div>
          </div>
          <Seg<"sheet" | "availability"> label="Bulk catalog" value={tab} onChange={setTab} options={[{ id: "sheet", label: "Update from a sheet" }, { id: "availability", label: "Assign / switch on or off" }]} />

          {tab === "sheet" && (
            <div className="mt-4 space-y-4">
              <section aria-label="Update from a sheet" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="text-base font-bold">Update from an Excel / CSV sheet</h3>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Step n={1}>Download the template (or your current catalog), change what you need, leave other cells blank.</Step>
                  <Step n={2}>Upload it. You will see every change and every error — nothing is applied yet.</Step>
                  <Step n={3}>Confirm to apply.</Step>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className={btnOutline} onClick={() => void downloadFile("template")}><Download className="size-4" />Template</button>
                  <select aria-label="Store to export" className="fld fld-sans !w-[190px]" value={exportShop} onChange={(e) => setExportShop(e.target.value)}>
                    <option value="">All stores</option>
                    {(shops.data?.items ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <button type="button" className={btnOutline} onClick={() => void downloadFile("export", exportShop ? { shopId: exportShop } : {})}><Download className="size-4" />Current catalog</button>
                  <button type="button" className={cn(btnPrimary, "sm:ml-auto")} disabled={upload.isPending} onClick={() => input.current?.click()}><Upload className="size-4" />{upload.isPending ? "Checking…" : "Upload a sheet"}</button>
                  <input ref={input} type="file" accept=".csv,.xlsx" className="sr-only" aria-label="Choose a sheet" onChange={(e) => pick(e.target.files?.[0])} />
                </div>
                {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
              </section>

              {result?.result && (
                <p role="status" className="flex items-start gap-2 rounded-xl border border-lime-200 bg-lime-50 px-3 py-2.5 text-xs text-lime-800"><CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                  Applied {result.result.appliedRows} row(s) across {result.result.shops} store(s) and {result.result.products} product(s); {result.result.stockMovements} stock change(s) recorded
                  {result.result.skippedRows > 0 && `; ${result.result.skippedRows} row(s) with errors skipped`}.</p>
              )}
              {batchId && batch.data?.status === "PREVIEW" && <Preview batch={batch.data} onDone={(applied) => { setBatchId(null); setResult(applied ?? null) }} />}

              <section aria-label="Recent uploads" className="rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="mb-2 flex items-center gap-2 text-base font-bold"><FileSpreadsheet className="size-4 text-emerald-700" />Recent uploads</h3>
                {(uploads.data ?? []).length === 0 ? <p className="rounded-xl bg-slate-50 px-3 py-5 text-center text-xs text-slate-500">No uploads yet.</p> : (
                  <ul className="space-y-1.5 text-xs">
                    {uploads.data!.map((u) => (
                      <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2">
                        <span className="font-semibold text-slate-800">{u.fileName ?? "upload"} <span className="font-normal text-slate-400">{new Date(u.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}{u.createdBy && ` · ${u.createdBy}`}</span></span>
                        <span className="flex items-center gap-2">
                          <span className="text-slate-500">{u.totals.valid} change · {u.totals.errors} errors</span>
                          <Tag tone={STATUS_TONE[u.status]}>{u.status.toLowerCase()}</Tag>
                          {u.status === "PREVIEW" && <button type="button" onClick={() => setBatchId(u.id)} className="font-semibold text-emerald-700 hover:underline" style={{ minHeight: 0 }}>Open</button>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
          {tab === "availability" && <div className="mt-4"><Availability /></div>}
        </ErpSkin>
      </DialogContent>
    </Dialog>
  )
}

/** The "Bulk import" button for the Add product row. Shows only to people who may use the Bulk catalog and only once the feature is released. */
export function BulkImportButton() {
  const me = useBizMe()
  const lock = useFeatureAccess("catalog_bulk") // the "in development" lock that used to guard the Bulk catalog page
  const [open, setOpen] = useState(false)
  if (!me.data?.catalogBulk || lock.isLoading || !lock.canAccess) return null
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} data-testid="bulk-import-cta" className="border-[#dce3d4] hover:border-emerald-400 hover:text-emerald-800">
        <Upload className="mr-1.5 h-4 w-4" aria-hidden="true" />Bulk import
      </Button>
      {open && <BulkImportDialog open={open} onClose={() => setOpen(false)} />}
    </>
  )
}
