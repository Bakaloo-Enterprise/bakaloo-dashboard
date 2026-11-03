"use client"

/**
 * Bulk purchase entry: many products in one table (one row each: quantity, price, vendor, invoice), like the reference's bulk purchase.
 * Every row is saved through the same "new purchase" call as the single New purchase form — same checks, same stock and ledger effects.
 */
import { useRef, useState } from "react"
import { Download, Layers, Plus, Trash2, Upload } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { formatRupees, istToday } from "@/components/business/business-helpers"
import { useDebounce } from "@/hooks/useDebounce"
import { bizError, useVendors } from "@/hooks/useBusiness"
import { useProducts } from "@/hooks/useProducts"
import { createEntry } from "@/services/business.service"
import { getProducts } from "@/services/products.service"
import { MAX_SHEET_ROWS, downloadTemplate, mapSheetRows, readGrid } from "./purchase-sheet"
import { ErpSkin } from "./ui"
import { cn } from "@/lib/utils"

interface Row { key: number; productId: string; name: string; qty: string; price: string; vendorId: string; invoice: string; date?: string; vendorName?: string; error?: string }
const NEW = "__new__"
const rowTotal = (r: Row) => (Number(r.qty) > 0 && Number(r.price) >= 0 ? Math.round(Number(r.qty) * Number(r.price) * 100) / 100 : 0)

export function BulkPurchaseDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const vendors = useVendors()
  const [date, setDate] = useState(istToday())
  const [vendorId, setVendorId] = useState("")
  const [vendorName, setVendorName] = useState("")
  const [rows, setRows] = useState<Row[]>([])
  const [search, setSearch] = useState("")
  const q = useDebounce(search, 250)
  const found = useProducts({ search: q, limit: 8 })
  const [busy, setBusy] = useState(false)
  const [seq, setSeq] = useState(1)
  const fileRef = useRef<HTMLInputElement>(null)
  const [reading, setReading] = useState(false)
  const [skipped, setSkipped] = useState<string[]>([])

  /** Reads a sheet, finds each product by SKU or exact name, and puts the good rows in the table for review. Nothing is saved yet. */
  const importSheet = async (file: File | undefined) => {
    if (!file) return
    setReading(true); setSkipped([])
    try {
      const { lines, missing } = mapSheetRows(await readGrid(file))
      if (missing.length) { toast.error(`The sheet needs a column for: ${missing.join(", ")}.`); return }
      if (lines.length === 0) { toast.error("No rows found in the sheet."); return }
      if (lines.length > MAX_SHEET_ROWS) { toast.error(`Up to ${MAX_SHEET_ROWS} rows at a time — this sheet has ${lines.length}.`); return }
      const today = istToday()
      const vlist = vendors.data ?? []
      const good: Row[] = []
      const notes: string[] = []
      let next = seq
      const look = async (l: (typeof lines)[number]) => {
        const term = l.sku || l.name
        const hits = (await getProducts({ search: term, limit: 20 })).products ?? []
        const same = (a?: string | null, b?: string) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase()
        return hits.find((p) => same(p.sku, l.sku)) ?? hits.find((p) => same(p.name, l.name || l.sku)) ?? null
      }
      for (let i = 0; i < lines.length; i += 5) {
        const batch = lines.slice(i, i + 5)
        const found = await Promise.all(batch.map((l) => look(l).catch(() => null)))
        batch.forEach((l, j) => {
          const p = found[j]
          const why = !p ? `product “${l.sku || l.name}” not found in the catalogue`
            : !(Number.isInteger(Number(l.qty)) && Number(l.qty) >= 1) ? "quantity must be a whole number, 1 or more"
            : !(l.price !== "" && Number(l.price) >= 0) ? "price is missing or not a number"
            : l.date && (!/^\d{4}-\d{2}-\d{2}$/.test(l.date) || l.date > today) ? "date must be YYYY-MM-DD and not in the future" : null
          if (why || !p) { notes.push(`Line ${l.line}: ${why}`); return }
          const v = l.vendor ? vlist.find((x) => x.name.trim().toLowerCase() === l.vendor.trim().toLowerCase()) : undefined
          good.push({ key: next++, productId: p.id, name: p.name, qty: l.qty, price: l.price, vendorId: v?.id ?? "", vendorName: l.vendor && !v ? l.vendor : undefined, invoice: l.invoice, date: l.date || undefined })
        })
      }
      setSeq(next)
      setRows((r) => [...r, ...good])
      setSkipped(notes)
      if (good.length) toast.success(`${good.length} row(s) added from the sheet — check them, then record`)
      if (notes.length) toast.error(`${notes.length} row(s) were left out`)
    } catch { toast.error("Could not read that file. Use the template (.xlsx) or a .csv.") } finally { setReading(false); if (fileRef.current) fileRef.current.value = "" }
  }

  const set = (key: number, patch: Partial<Row>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch, error: undefined } : x)))
  const sharedOk = (vendorId && vendorId !== NEW ? true : vendorName.trim().length > 0) || (rows.length > 0 && rows.every((r) => r.vendorId || r.vendorName))
  const problem = (r: Row) => !(Number.isInteger(Number(r.qty)) && Number(r.qty) >= 1) ? "Enter a whole quantity." : !(r.price !== "" && Number(r.price) >= 0) ? "Enter the price." : null
  const bad = rows.filter((r) => problem(r))
  const total = rows.reduce((t, r) => t + rowTotal(r), 0)
  const ready = rows.length > 0 && bad.length === 0 && sharedOk

  const save = async () => {
    setBusy(true)
    const left: Row[] = []
    let saved = 0
    for (const r of rows) {
      const v = r.vendorId || (r.vendorName ? "" : vendorId)
      try {
        await createEntry({
          productId: r.productId, ...(v && v !== NEW ? { vendorId: v } : { vendorName: (r.vendorName || vendorName).trim() }),
          expectedQty: Number(r.qty), receivedQty: Number(r.qty), damagedQty: 0, unitPrice: Number(r.price), procuredOn: r.date || date, invoiceRef: r.invoice.trim() || undefined,
        })
        saved += 1
      } catch (e) { left.push({ ...r, error: bizError(e) }) }
    }
    setBusy(false)
    qc.invalidateQueries({ queryKey: ["biz"] })
    if (saved) toast.success(`${saved} purchase${saved > 1 ? "s" : ""} recorded`)
    if (left.length) { setRows(left); toast.error(`${left.length} row(s) could not be saved — see the red notes`) } else { setRows([]); onClose() }
  }

  const input = "fld fld-sans"
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) onClose() }}>
      <DialogContent className="max-h-[92vh] max-w-5xl gap-0 overflow-y-auto border-0 bg-white p-0 sm:rounded-2xl">
        <ErpSkin className="p-5 sm:p-6">
          <div className="mb-5 flex items-start gap-3 pr-8">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Layers className="size-5" /></div>
            <div>
              <DialogTitle className="text-lg font-bold tracking-tight">Bulk purchase</DialogTitle>
              <DialogDescription className="text-xs text-slate-500">Record many purchases at once. Each row becomes its own purchase, received in full, exactly as if you had used “New purchase”.</DialogDescription>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label><span className="fld-lbl mb-1 block">Purchase date</span><input type="date" className="fld" max={istToday()} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /></label>
            <label><span className="fld-lbl mb-1 block">Vendor (for every row)</span>
              <select className={input} value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
                <option value="">Choose…</option>
                {(vendors.data ?? []).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                <option value={NEW}>+ A new vendor…</option>
              </select></label>
            {vendorId === NEW && <label><span className="fld-lbl mb-1 block">New vendor name</span><input className={input} value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="Vendor name" /></label>}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-[#cdd9c3] bg-[#f6f8f2] p-3">
            <p className="mr-auto text-xs text-slate-600"><b>Have it in Excel?</b> Download the template, fill it, and upload it — the rows land in the table below for you to check. Works with <b>.xlsx</b> and <b>.csv</b>.</p>
            <button type="button" onClick={() => void downloadTemplate()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:border-emerald-300"><Download className="size-4" />Template (.xlsx)</button>
            <button type="button" disabled={reading || busy} onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"><Upload className="size-4" />{reading ? "Reading…" : "Upload Excel / CSV"}</button>
            <input ref={fileRef} type="file" accept=".xlsx,.csv" className="sr-only" aria-label="Choose a purchase sheet" onChange={(e) => void importSheet(e.target.files?.[0])} />
          </div>
          {skipped.length > 0 && (
            <div role="alert" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <p className="font-semibold">{skipped.length} row(s) from the sheet were left out:</p>
              <ul className="mt-1 list-disc pl-5">{skipped.slice(0, 8).map((x) => <li key={x}>{x}</li>)}{skipped.length > 8 && <li>…and {skipped.length - 8} more</li>}</ul>
            </div>
          )}

          <div className="relative mt-4">
            <span className="fld-lbl mb-1 block">Add a product</span>
            <input className={input} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a product by name…" autoComplete="off" />
            {q.length > 0 && (
              <ul aria-label="Products found" className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-[#e3e8dd] bg-white shadow-lg">
                {(found.data?.products ?? []).map((p) => (
                  <li key={p.id}><button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-lime-50" style={{ minHeight: 0 }}
                    onClick={() => { setRows((r) => [...r, { key: seq, productId: p.id, name: p.name, qty: "", price: "", vendorId: "", invoice: "" }]); setSeq((n) => n + 1); setSearch("") }}><Plus className="size-3.5 text-emerald-700" />{p.name}</button></li>
                ))}
                {!found.isLoading && (found.data?.products ?? []).length === 0 && <li className="px-3 py-2 text-xs text-slate-400">No product found</li>}
              </ul>
            )}
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-[#e3e8dd]">
            <table className="w-full min-w-[820px] text-xs">
              <thead className="bg-[#eef3ef] text-[#244538]"><tr className="text-left text-e10 uppercase tracking-wider">{["Product", "Quantity", "Price / unit ₹", "Vendor (optional override)", "Invoice no.", "Total ₹", ""].map((h) => <th key={h} className="px-3 py-2.5 font-bold">{h}</th>)}</tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className={cn("border-t border-[#eef1ea] align-top", r.qty && "bg-emerald-50/60")}>
                    <td className="px-3 py-2"><p className="font-semibold text-slate-800">{r.name}{r.date && <span className="num ml-1.5 text-e10 font-normal text-slate-400">{r.date}</span>}</p>{r.error && <p className="mt-0.5 text-e10.5 text-rose-600">{r.error}</p>}{!r.error && problem(r) && (r.qty || r.price) && <p className="mt-0.5 text-e10.5 text-amber-700">{problem(r)}</p>}</td>
                    <td className="px-2 py-2"><input aria-label={`${r.name} quantity`} className="fld !w-[110px]" inputMode="numeric" value={r.qty} onChange={(e) => set(r.key, { qty: e.target.value.replace(/[^0-9]/g, "") })} /></td>
                    <td className="px-2 py-2"><input aria-label={`${r.name} price`} className="fld !w-[130px]" inputMode="decimal" value={r.price} onChange={(e) => set(r.key, { price: e.target.value.replace(/[^0-9.]/g, "") })} /></td>
                    <td className="px-2 py-2"><select aria-label={`${r.name} vendor`} className={cn(input, "!w-[190px]")} value={r.vendorId} onChange={(e) => set(r.key, { vendorId: e.target.value, vendorName: e.target.value ? undefined : r.vendorName })}><option value="">{r.vendorName ? `New: ${r.vendorName}` : "Same as above"}</option>{(vendors.data ?? []).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></td>
                    <td className="px-2 py-2"><input aria-label={`${r.name} invoice`} className="fld !w-[140px]" maxLength={80} value={r.invoice} onChange={(e) => set(r.key, { invoice: e.target.value })} /></td>
                    <td className="num px-3 py-2 text-right font-bold tabular-nums text-slate-800">{formatRupees(rowTotal(r))}</td>
                    <td className="px-2 py-2"><button type="button" aria-label={`Remove ${r.name}`} onClick={() => setRows((x) => x.filter((y) => y.key !== r.key))} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600" style={{ minHeight: 0 }}><Trash2 className="size-4" /></button></td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-400">Search above and add the products you bought.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-600"><b>{rows.length}</b> product(s) · total <b className="num">{formatRupees(total)}</b>{!sharedOk && rows.length > 0 && <span className="ml-2 text-amber-700">Choose or name a vendor.</span>}</p>
            <div className="flex gap-2">
              <Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
              <Button disabled={!ready || busy} onClick={save} className="bg-emerald-700 hover:bg-emerald-800">{busy ? "Saving…" : `Record ${rows.length || ""} purchase${rows.length === 1 ? "" : "s"}`}</Button>
            </div>
          </div>
        </ErpSkin>
      </DialogContent>
    </Dialog>
  )
}
