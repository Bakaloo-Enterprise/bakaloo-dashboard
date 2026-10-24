import { describe, expect, it } from "vitest"
import { count, dayLabel, hourLabel, inr, pctText } from "../format"
import { monthRange, shiftMonth } from "../accounting/meta"

describe("inr", () => {
  it("writes small amounts in full, with Indian grouping above a thousand", () => {
    expect(inr(0)).toBe("₹0")
    expect(inr(850)).toBe("₹850")
    expect(inr(9999)).toBe("₹9,999")
  })
  it("shortens big amounts the way shopkeepers say them", () => {
    expect(inr(12500)).toBe("₹12.5K")
    expect(inr(218877.64)).toBe("₹2.19L")
    expect(inr(25000000)).toBe("₹2.50Cr")
  })
  it("keeps the sign for losses", () => {
    expect(inr(-1332.73)).toBe("-₹1,333")
    expect(inr(-250000)).toBe("-₹2.50L")
  })
  it("gives exact rupees and paise on request", () => {
    expect(inr(1234567.5, false)).toBe("₹12,34,567.50")
  })
  it("shows a dash for missing numbers instead of NaN", () => {
    expect(inr(null)).toBe("—")
    expect(inr(undefined)).toBe("—")
    expect(inr(Number.NaN)).toBe("—")
  })
})

describe("other formatters", () => {
  it("counts and percentages", () => {
    expect(count(1234567)).toBe("12,34,567")
    expect(count(null)).toBe("—")
    expect(pctText(12.345, 1)).toBe("12.3%")
    expect(pctText(null)).toBe("—")
  })
  it("day and hour labels", () => {
    expect(dayLabel("2026-10-05")).toBe("5 Oct")
    expect(hourLabel(0)).toBe("12 AM")
    expect(hourLabel(12)).toBe("12 PM")
    expect(hourLabel(19)).toBe("7 PM")
  })
})

describe("month helpers", () => {
  it("moves across year ends", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12")
    expect(shiftMonth("2026-12", 1)).toBe("2027-01")
    expect(shiftMonth("2026-03", 0)).toBe("2026-03")
  })
  it("knows how long a month is", () => {
    expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" })
    expect(monthRange("2028-02").to).toBe("2028-02-29")
    expect(monthRange("2026-10")).toEqual({ from: "2026-10-01", to: "2026-10-31" })
  })
})
