import { describe, expect, it } from "vitest"
import { addLine, groupByVendor, lineTotal, orderMessage, phoneDigits, telLink, whatsappLink, type BuyLine } from "../buylist"

const line = (o: Partial<BuyLine> = {}): BuyLine => ({ productId: "p1", name: "Banana", unit: "12 pcs", qty: 4, price: 40, vendorId: "v1", vendorName: "Mandi A", ...o })

describe("buy list lines", () => {
  it("adds a new product as a new line", () => {
    expect(addLine([line()], line({ productId: "p2", name: "Rice" }))).toHaveLength(2)
  })
  it("merges the same product from the same supplier: quantities add, newest price wins", () => {
    const out = addLine([line({ qty: 4, price: 40 })], line({ qty: 6, price: 44 }))
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ qty: 10, price: 44 })
  })
  it("keeps the old price when the new line has none", () => {
    expect(addLine([line({ price: 40 })], line({ price: null }))[0].price).toBe(40)
  })
  it("keeps the same product from two suppliers apart", () => {
    expect(addLine([line()], line({ vendorId: "v2", vendorName: "Farm B" }))).toHaveLength(2)
  })
  it("totals a line in rupees and paise, treating no price as zero", () => {
    expect(lineTotal(line({ qty: 3, price: 12.35 }))).toBe(37.05)
    expect(lineTotal(line({ price: null }))).toBe(0)
  })
})

describe("grouping by supplier", () => {
  const list = [
    line({ productId: "a", vendorId: null, vendorName: null }),
    line({ productId: "b", vendorId: "v2", vendorName: "Zed Foods", qty: 2, price: 10 }),
    line({ productId: "c", vendorId: "v1", vendorName: "Mandi A", qty: 1, price: 5 }),
    line({ productId: "d", vendorId: "v1", vendorName: "Mandi A", qty: 2, price: 7.5 }),
  ]
  const groups = groupByVendor(list)
  it("orders suppliers A→Z with the unassigned lines last", () => {
    expect(groups.map((g) => g.vendorName)).toEqual(["Mandi A", "Zed Foods", null])
  })
  it("adds up each supplier's total", () => {
    expect(groups[0].total).toBe(20) // 1×5 + 2×7.5
    expect(groups[1].total).toBe(20)
    expect(groups[0].lines).toHaveLength(2)
  })
})

describe("order message", () => {
  it("lists every product with its quantity and greets the supplier", () => {
    const m = orderMessage("Mandi A", [line(), line({ name: "Basmati Rice", unit: null, qty: 2 })], "tomorrow")
    expect(m).toBe("Hello Mandi A, my order for tomorrow:\n• Banana (12 pcs) — 4\n• Basmati Rice — 2\nPlease confirm. Thank you.")
  })
  it("works without a supplier name", () => {
    expect(orderMessage(null, [line()], "today").startsWith("Hello, my order for today:")).toBe(true)
  })
})

describe("phone links", () => {
  it("accepts the ways people write Indian mobiles", () => {
    expect(phoneDigits("98765 43210")).toBe("919876543210")
    expect(phoneDigits("09876543210")).toBe("919876543210")
    expect(phoneDigits("+91 98765-43210")).toBe("919876543210")
  })
  it("refuses things that cannot be a phone number", () => {
    for (const bad of ["", null, undefined, "12345", "abc", "1".repeat(20)]) expect(phoneDigits(bad as string)).toBeNull()
    expect(telLink("12")).toBeNull()
    expect(whatsappLink(null, "x")).toBeNull()
  })
  it("builds a call link and a WhatsApp link with the message safely encoded", () => {
    expect(telLink("9876543210")).toBe("tel:+919876543210")
    expect(whatsappLink("9876543210", "Hi & bye\n• Rice")).toBe("https://wa.me/919876543210?text=Hi%20%26%20bye%0A%E2%80%A2%20Rice")
  })
})
