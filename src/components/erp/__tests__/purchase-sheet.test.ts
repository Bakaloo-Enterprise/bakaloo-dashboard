import { describe, expect, it } from "vitest"
import { mapSheetRows, parseCsv } from "../skin/purchase-sheet"

describe("parseCsv", () => {
  it("reads quotes, commas inside quotes, CRLF and a BOM", () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n')).toEqual([["a", "b"], ["x, y", 'say "hi"']])
  })
})

describe("mapSheetRows", () => {
  const head = ["SKU", "Product name", "Quantity", "Price per unit (₹)", "Vendor", "Invoice no.", "Date (YYYY-MM-DD)"]
  it("reads the template's columns", () => {
    const r = mapSheetRows([head, ["TOM-1", "Tomato", "12", "₹1,250.50", "Raju", "INV-9", "2026-11-02"]])
    expect(r.missing).toEqual([])
    expect(r.lines).toEqual([{ line: 2, sku: "TOM-1", name: "Tomato", qty: "12", price: "1250.50", vendor: "Raju", invoice: "INV-9", date: "2026-11-02" }])
  })
  it("understands other headings, any column order, and ignores unknown columns", () => {
    const r = mapSheetRows([["Rate", "qty", "Supplier", "Colour", "Item"], ["40", "5", "Asha", "red", "Onion"]])
    expect(r.lines[0]).toMatchObject({ name: "Onion", qty: "5", price: "40", vendor: "Asha", sku: "" })
  })
  it("drops empty lines and the template's example row, and numbers lines like the sheet does", () => {
    const r = mapSheetRows([head, ["EXAMPLE-SKU", "EXAMPLE – delete this row", "10", "55", "", "", ""], ["", "", "", "", "", "", ""], ["", "Potato", "3", "20", "", "", ""]])
    expect(r.lines.map((l) => [l.line, l.name])).toEqual([[4, "Potato"]])
  })
  it("says which required columns are missing", () => {
    expect(mapSheetRows([["Product", "Notes"], ["Tomato", "x"]]).missing).toEqual(["Quantity", "Price per unit"])
    expect(mapSheetRows([["Quantity", "Price"], ["1", "2"]]).missing).toEqual(["SKU or Product name"])
  })
})
