import { describe, expect, it } from "vitest"
import { QUICK_FILTERS, activeCount, describeCriteria, listTime, matchingQuickFilter, normalizeCriteria, sameCriteria, toQuery } from "../inbox-filters"

describe("inbox filters", () => {
  it("every chip maps to the API query it promises", () => {
    const q = (key: string) => toQuery(QUICK_FILTERS.find((f) => f.key === key)!.criteria, "")
    expect(q("all")).toEqual({})
    expect(q("unread")).toEqual({ unread: true })
    expect(q("open")).toEqual({ status: "OPEN" })
    expect(q("mine")).toEqual({ assignedTo: "me" })
    expect(q("unassigned")).toEqual({ assignedTo: "unassigned" })
    expect(q("needs")).toEqual({ needsPerson: true })
    expect(q("meta")).toEqual({ source: "META_AD" })
  })

  it("search is trimmed and sent next to the filters", () => {
    expect(toQuery({ unread: true }, "  rahul ")).toEqual({ unread: true, search: "rahul" })
    expect(toQuery({}, "   ")).toEqual({})
  })

  it("combines labels, window, lead and period; days become a from-date", () => {
    const now = Date.parse("2026-11-03T12:00:00Z")
    const q = toQuery({ labelIds: ["b", "a"], windowOpen: false, lead: true, days: 7 }, "", now)
    expect(q).toEqual({ labelIds: ["a", "b"], windowOpen: false, lead: true, from: "2026-10-27T12:00:00.000Z" })
  })

  it("keeps windowOpen=false and lead=false (they are real filters, not 'off')", () => {
    expect(toQuery({ windowOpen: false, lead: false }, "")).toEqual({ windowOpen: false, lead: false })
  })

  it("ignores empty values and compares criteria regardless of label order", () => {
    expect(normalizeCriteria({ labelIds: [], unread: false, assignedTo: "" })).toEqual({})
    expect(sameCriteria({ labelIds: ["b", "a"] }, { labelIds: ["a", "b"] })).toBe(true)
    expect(sameCriteria({ unread: true }, {})).toBe(false)
    expect(activeCount({ unread: true, source: "META_AD", labelIds: ["x"] })).toBe(3)
    expect(activeCount({})).toBe(0)
  })

  it("highlights a chip only when the criteria are exactly that chip", () => {
    expect(matchingQuickFilter({})?.key).toBe("all")
    expect(matchingQuickFilter({ source: "META_AD" })?.key).toBe("meta")
    expect(matchingQuickFilter({ source: "META_AD", unread: true })).toBeUndefined()
  })

  it("describes a filter in plain words", () => {
    const labels = [{ id: "1", name: "Instagram Ad" }]
    expect(describeCriteria({ source: "META_AD", unread: true, labelIds: ["1"], days: 7 }, labels)).toBe("Unread · From Meta ads · Instagram Ad · Last 7 days")
    expect(describeCriteria({}, labels)).toBe("Everything")
  })

  it("formats the list time like WhatsApp", () => {
    const now = new Date(2026, 10, 3, 15, 0)
    expect(listTime(new Date(2026, 10, 3, 9, 5).toISOString(), now)).toBe("9:05 am")
    expect(listTime(new Date(2026, 10, 2, 23, 0).toISOString(), now)).toBe("Yesterday")
    expect(listTime(new Date(2026, 10, 1, 10, 0).toISOString(), now)).toMatch(/Sunday/)
    expect(listTime(new Date(2026, 9, 1, 10, 0).toISOString(), now)).toBe("01/10/2026")
    expect(listTime(null, now)).toBe("")
  })
})
