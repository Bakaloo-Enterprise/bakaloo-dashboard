/**
 * The Excel / CSV sheet for Bulk purchase: the template people download and the reader for what they upload.
 * Accepts .xlsx and .csv. Reading and writing happen in the browser (exceljs is loaded only when needed); nothing is sent
 * anywhere until the rows have been checked and the person presses Record.
 */

export const SHEET_HEADERS = ["SKU", "Product name", "Quantity", "Price per unit (₹)", "Vendor", "Invoice no.", "Date (YYYY-MM-DD)"] as const
export const MAX_SHEET_ROWS = 300

export interface SheetLine { line: number; sku: string; name: string; qty: string; price: string; vendor: string; invoice: string; date: string }

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")
const ALIASES: Record<keyof Omit<SheetLine, "line">, string[]> = {
  sku: ["sku", "productcode", "code"],
  name: ["productname", "product", "name", "item", "itemname"],
  qty: ["quantity", "qty", "units"],
  price: ["priceperunitrs", "priceperunit", "price", "rate", "unitprice", "costperunit"],
  vendor: ["vendor", "supplier", "vendorname", "suppliername"],
  invoice: ["invoiceno", "invoice", "invoicenumber", "invoiceref", "reference", "billno"],
  date: ["dateyyyymmdd", "date", "purchasedate", "procuredon"],
}

const clean = (v: string) => v.replace(/[₹,\s]/g, "")
const isExample = (l: SheetLine) => /^example/i.test(l.name) || /^example/i.test(l.sku)

/** Turns the grid of cells (first row = headings) into lines. Unknown columns are ignored; empty lines and the template's example row are dropped. */
export function mapSheetRows(grid: string[][]): { lines: SheetLine[]; missing: string[] } {
  if (grid.length === 0) return { lines: [], missing: ["Quantity", "Price per unit"] }
  const heads = grid[0].map(key)
  const col = (f: keyof typeof ALIASES) => heads.findIndex((h) => ALIASES[f].includes(h))
  const idx = { sku: col("sku"), name: col("name"), qty: col("qty"), price: col("price"), vendor: col("vendor"), invoice: col("invoice"), date: col("date") }
  const missing: string[] = []
  if (idx.sku < 0 && idx.name < 0) missing.push("SKU or Product name")
  if (idx.qty < 0) missing.push("Quantity")
  if (idx.price < 0) missing.push("Price per unit")
  const get = (r: string[], i: number) => (i >= 0 ? String(r[i] ?? "").trim() : "")
  const lines: SheetLine[] = []
  grid.slice(1).forEach((r, n) => {
    const l: SheetLine = { line: n + 2, sku: get(r, idx.sku), name: get(r, idx.name), qty: clean(get(r, idx.qty)), price: clean(get(r, idx.price)), vendor: get(r, idx.vendor), invoice: get(r, idx.invoice), date: get(r, idx.date).slice(0, 10) }
    if (!l.sku && !l.name && !l.qty && !l.price) return
    if (isExample(l)) return
    lines.push(l)
  })
  return { lines, missing }
}

/** Small CSV reader (quotes, commas inside quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const out: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  const t = text.replace(/^﻿/, "")
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (quoted) {
      if (c === '"' && t[i + 1] === '"') { cell += '"'; i++ } else if (c === '"') quoted = false; else cell += c
    } else if (c === '"') quoted = true
    else if (c === ",") { row.push(cell); cell = "" }
    else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; row.push(cell); out.push(row); row = []; cell = "" }
    else cell += c
  }
  if (cell !== "" || row.length) { row.push(cell); out.push(row) }
  return out
}

const pad = (n: number) => String(n).padStart(2, "0")

/** Reads the first sheet of an .xlsx, or a .csv, into a grid of text. */
export async function readGrid(file: File): Promise<string[][]> {
  if (/\.csv$/i.test(file.name)) return parseCsv(await file.text())
  const ExcelJS = (await import("exceljs")).default
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await file.arrayBuffer())
  const ws = wb.worksheets[0]
  if (!ws) return []
  const grid: string[][] = []
  ws.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = []
    for (let c = 1; c <= row.cellCount; c++) {
      const v = row.getCell(c).value as unknown
      if (v == null) cells.push("")
      else if (v instanceof Date) cells.push(`${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`)
      else if (typeof v === "object") {
        const o = v as { result?: unknown; text?: unknown; richText?: Array<{ text: string }> }
        cells.push(o.richText ? o.richText.map((t) => t.text).join("") : String(o.result ?? o.text ?? ""))
      } else cells.push(String(v))
    }
    grid.push(cells)
  })
  return grid
}

/** Builds and downloads the blank template (one sheet to fill, one sheet explaining it). */
export async function downloadTemplate() {
  const ExcelJS = (await import("exceljs")).default
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet("Purchases")
  ws.addRow([...SHEET_HEADERS])
  ws.addRow(["EXAMPLE-SKU", "EXAMPLE – delete this row", 10, 55, "Your vendor name", "INV-001", "2026-11-03"])
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF215C49" } }
  ws.getRow(2).font = { italic: true, color: { argb: "FF94A3B8" } }
  ;[16, 34, 12, 20, 24, 16, 20].forEach((w, i) => { ws.getColumn(i + 1).width = w })
  ws.views = [{ state: "frozen", ySplit: 1 }]
  const help = wb.addWorksheet("How to fill")
  ;[
    ["Fill the Purchases sheet, one row per product bought. Save as .xlsx or .csv and upload it in Bulk purchase."],
    [""],
    ["SKU or Product name", "Required. At least one. SKU is safest; names must match the catalogue exactly (capitals do not matter)."],
    ["Quantity", "Required. A whole number, 1 or more. It is recorded as received in full."],
    ["Price per unit (₹)", "Required. What you paid for one unit."],
    ["Vendor", "Optional. Leave blank to use the vendor chosen on screen. A new name creates a new vendor."],
    ["Invoice no.", "Optional. Your supplier's invoice number."],
    ["Date (YYYY-MM-DD)", "Optional. Leave blank to use the date chosen on screen. Not in the future."],
    [""],
    ["The example row is ignored. You will see every row on screen and can fix it before anything is saved."],
  ].forEach((r) => help.addRow(r))
  help.getColumn(1).width = 26; help.getColumn(2).width = 100
  const buf = await wb.xlsx.writeBuffer()
  const a = document.createElement("a")
  a.href = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }))
  a.download = "bulk-purchase-template.xlsx"
  a.click()
  URL.revokeObjectURL(a.href)
}
