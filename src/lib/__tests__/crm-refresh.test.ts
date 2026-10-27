import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createCrmRefresher } from "../crm-refresh"

describe("createCrmRefresher", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("turns a burst of events into one refetch per key, without cancelling in-flight requests", () => {
    const invalidateQueries = vi.fn()
    const r = createCrmRefresher(() => ({ invalidateQueries }) as never, 1000)
    for (let i = 0; i < 200; i++) r.invalidate(["crm", "conversations"], ["crm", "pipeline"])
    expect(invalidateQueries).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(invalidateQueries).toHaveBeenCalledTimes(2)
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["crm", "conversations"] }, { cancelRefetch: false })
  })

  it("keeps refreshing during a continuous stream (does not wait for quiet)", () => {
    const invalidateQueries = vi.fn()
    const r = createCrmRefresher(() => ({ invalidateQueries }) as never, 1000)
    for (let t = 0; t < 5; t++) {
      r.invalidate(["crm", "conversations"])
      vi.advanceTimersByTime(900)
    }
    expect(invalidateQueries.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it("cancel drops anything pending", () => {
    const invalidateQueries = vi.fn()
    const r = createCrmRefresher(() => ({ invalidateQueries }) as never, 1000)
    r.invalidate(["crm", "conversations"])
    r.cancel()
    vi.advanceTimersByTime(2000)
    expect(invalidateQueries).not.toHaveBeenCalled()
  })
})
