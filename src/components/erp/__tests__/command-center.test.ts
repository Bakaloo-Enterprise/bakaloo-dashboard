import { describe, expect, it } from "vitest"
import { outcomeOf, withCancelDefaults } from "../skin/CommandCenterView"
import type { OverviewData } from "@/types/overview.types"

describe("Command Center order outcomes", () => {
  it("keeps cancelled, returned and unpaid orders apart from orders that stood", () => {
    expect(outcomeOf({ status: "DELIVERED", delivered_at: "2026-03-10T10:00:00Z" })).toBe("stood")
    expect(outcomeOf({ status: "PREPARING", delivered_at: null })).toBe("stood")
    expect(outcomeOf({ status: "CANCELLED", delivered_at: null })).toBe("cancelled")
    expect(outcomeOf({ status: "PENDING", delivered_at: null })).toBe("unpaid")
  })
  it("tells a return (refunded after delivery) from a cancel that was refunded", () => {
    expect(outcomeOf({ status: "REFUNDED", delivered_at: "2026-03-10T10:00:00Z" })).toBe("returned")
    expect(outcomeOf({ status: "REFUNDED", delivered_at: null })).toBe("cancelled")
  })
})

describe("Command Center with an older backend", () => {
  const old = {
    money: { grossSales: 100, refunds: 20, netRevenue: 80, cancelledValue: 50, avgOrderValue: 80 },
    orders: { placed: 2, fullyRefunded: 0, net: 2, refundEvents: 1, cancelled: 3 },
    series: [{ day: "2026-03-10", orders: 2, placed: 2, gross: 100, refunds: 20, net: 80, cancelled: 3, cod: 0 }],
  } as unknown as OverviewData
  it("falls back to the cancelled numbers it does send instead of crashing", () => {
    const d = withCancelDefaults(old)
    expect(d.cancellations).toMatchObject({ orders: 3, value: 50, afterConfirm: { orders: 3, value: 50 }, byReason: [] })
    expect(d.returns).toMatchObject({ orders: 1, value: 20 })
    expect(d.series[0].cancelledAll).toBe(3)
  })
  it("leaves a full response untouched", () => {
    const full = { ...old, cancellations: { orders: 9, value: 1, beforeConfirm: { orders: 4, value: 0 }, afterConfirm: { orders: 5, value: 1 }, byReason: [] }, returns: { orders: 2, value: 3, fullyRefundedOrders: 0 } } as unknown as OverviewData
    expect(withCancelDefaults(full).cancellations.orders).toBe(9)
    expect(withCancelDefaults(full).returns.orders).toBe(2)
  })
})
