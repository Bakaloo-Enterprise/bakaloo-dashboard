import { describe, expect, it } from "vitest"
import { dayWord, PAY_ORDER, PAY_UI, SOURCE_ORDER, SOURCE_UI, STATUS_UI } from "../requirement-helpers"

describe("requirement helpers", () => {
  it("says Today / Tomorrow / a short date", () => {
    expect(dayWord("2026-10-17", "2026-10-17")).toBe("Today")
    expect(dayWord("2026-10-18", "2026-10-17")).toBe("Tomorrow")
    expect(dayWord("2026-10-25", "2026-10-17")).toMatch(/25/)
    expect(dayWord(null, "2026-10-17")).toBe("No date")
  })
  it("gives every source, status and payment type a picture and a short word", () => {
    for (const s of SOURCE_ORDER) expect(SOURCE_UI[s].icon).toBeTruthy()
    for (const p of PAY_ORDER) expect(PAY_UI[p].label.length).toBeLessThan(14)
    for (const st of Object.values(STATUS_UI)) expect(st.label.split(" ").length).toBe(1)
  })
})
