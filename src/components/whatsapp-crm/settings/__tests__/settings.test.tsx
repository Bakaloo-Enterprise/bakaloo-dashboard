import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import type { WaSettingsView, WaTestResult } from "@/types/whatsapp-settings.types"

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }))
vi.mock("sonner", () => ({ toast }))
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: ReactNode }) => <a href={href} {...r}>{children}</a> }))

const api = { getWaSettings: vi.fn(), saveWaSettings: vi.fn(), testWaSettings: vi.fn(), enableWaSettings: vi.fn(), clearWaSettings: vi.fn(), getCrmMe: vi.fn(), getAnalyticsOverview: vi.fn(), getRateCards: vi.fn() }
vi.mock("@/services/whatsapp-crm.service", async (orig) => ({
  ...(await orig<object>()),
  getWaSettings: (...a: unknown[]) => api.getWaSettings(...a), saveWaSettings: (...a: unknown[]) => api.saveWaSettings(...a), testWaSettings: (...a: unknown[]) => api.testWaSettings(...a),
  enableWaSettings: (...a: unknown[]) => api.enableWaSettings(...a), clearWaSettings: (...a: unknown[]) => api.clearWaSettings(...a), getCrmMe: (...a: unknown[]) => api.getCrmMe(...a),
  getAnalyticsOverview: (...a: unknown[]) => api.getAnalyticsOverview(...a), getRateCards: (...a: unknown[]) => api.getRateCards(...a),
}))

import WhatsappSettingsPage from "@/app/(dashboard)/whatsapp-crm/settings/page"
import { numberSummary, tierText } from "../settings-helpers"

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
})
const wrap = (ui: ReactNode) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>)

const empty = (): WaSettingsView => ({
  state: "NOT_CONFIGURED", enabled: false, enabledSource: "server", connectedAt: null, lastTestedAt: null, lastTest: null, apiVersion: "v25.0",
  fields: { phoneNumberId: { value: null, source: null }, wabaId: { value: null, source: null }, appId: { value: null, source: null }, accessToken: { configured: false, masked: "", source: null }, appSecret: { configured: false, masked: "", source: null }, verifyToken: { configured: false, value: null, source: null } },
  webhook: { callbackUrl: "https://api.bakaloo.in/api/webhook/whatsapp", lastReceivedAt: null, last7d: 0 },
})
const GOOD: WaTestResult = {
  ok: true, level: "READY", headline: "Connected — everything checks out.", testedAt: "2026-10-02T10:00:00Z", durationMs: 840,
  checks: [
    { id: "credentials", label: "Details entered", status: "pass", summary: "Access token and Phone number ID are saved." },
    { id: "phone", label: "Access token & Phone number ID", status: "pass", summary: "Meta confirmed +91 99999 12345 (“Bakaloo”).", details: { number: "+91 99999 12345", name: "Bakaloo", quality: "GREEN", limitTier: "TIER_1K", verification: "VERIFIED" } },
    { id: "token", label: "Token lifetime", status: "pass", summary: "Permanent token (never expires) with the right permissions." },
  ],
}
const EXPIRED: WaTestResult = {
  ok: false, level: "FAILED", headline: "Not connected — Meta did not accept the access token / Phone number ID.", testedAt: "2026-10-02T10:00:00Z", durationMs: 600,
  checks: [
    { id: "phone", label: "Access token & Phone number ID", status: "fail", summary: "Your access token has expired", problem: {
      title: "Your access token has expired", cause: "Temporary tokens last only 24 hours.", fixes: ["Create a system user.", "Generate a token with expiry Never."],
      technical: { httpStatus: 401, code: 190, subcode: 463, message: "Session has expired", fbtraceId: "TRACE9" }, docs: null } },
    { id: "waba", label: "WhatsApp Business Account", status: "skip", summary: "Skipped until the access token and Phone number ID work." },
  ],
}
const connected = (): WaSettingsView => ({
  ...empty(), state: "CONNECTED", enabled: true, enabledSource: "dashboard", connectedAt: "2026-10-02T10:00:00Z", lastTestedAt: "2026-10-02T10:00:00Z", lastTest: GOOD,
  fields: { ...empty().fields, phoneNumberId: { value: "109876543210987", source: "dashboard" }, accessToken: { configured: true, masked: "EAAG…xYz4", source: "dashboard" }, appSecret: { configured: true, masked: "…c9d0", source: "dashboard" }, verifyToken: { configured: true, value: "bk_verify_word_123", source: "dashboard" } },
})

beforeEach(() => {
  vi.clearAllMocks()
  api.getCrmMe.mockResolvedValue({ userId: "u", isSuper: true, permissions: ["crm.settings.manage", "crm.analytics.view", "crm.inbox.view"] })
  api.getWaSettings.mockResolvedValue(empty())
  api.getAnalyticsOverview.mockResolvedValue({ range: {}, totals: { sent: 120, delivered: 110, read: 80, failed: 4, replied: 9, orders: 3, revenue: 900 }, cost: { total: 56.5, estimated: 0, billedMessages: 100, estimatedMessages: 0, unpricedMessages: 0, hasRates: true, byCategory: [{ category: "MARKETING", messages: 40, unpriced: 0, cost: 40 }, { category: "UTILITY", messages: 60, unpriced: 0, cost: 16.5 }] } })
  api.getRateCards.mockResolvedValue({ categories: [], cards: [{ id: "r" }] })
})

describe("helpers", () => {
  it("reads the number, name and chips out of the last test", () => {
    const s = numberSummary(connected())
    expect(s).toMatchObject({ number: "+91 99999 12345", name: "Bakaloo" })
    expect(s.chips).toEqual(expect.arrayContaining([["Quality", "green"], ["Daily limit", "1K customers / day"], ["Number", "verified"], ["Token", "permanent"]]))
    expect(numberSummary(undefined)).toEqual({ number: null, name: null, chips: [] })
    expect(tierText("TIER_UNLIMITED")).toBe("unlimited")
  })
})

describe("WhatsApp settings page", () => {
  it("shows a not-set-up hero and a form where Save & test needs the two essential values", async () => {
    wrap(<WhatsappSettingsPage />)
    expect(await screen.findByText("Connect your WhatsApp Business number")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save & test connection" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Test connection" })).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/Phone number ID/), { target: { value: "109876543210987" } })
    expect(screen.getByRole("button", { name: "Save & test connection" })).toBeDisabled() // still no token
    fireEvent.change(screen.getByLabelText(/^Access token/), { target: { value: "EAAGtoken" + "x".repeat(50) } })
    expect(screen.getByRole("button", { name: "Save & test connection" })).toBeEnabled()
  })

  it("Save & test saves ONLY what was typed, then tests, then shows the checklist and a success message", async () => {
    api.saveWaSettings.mockResolvedValue({ savedFields: ["phoneNumberId", "accessToken"], credentialsChanged: true })
    api.testWaSettings.mockResolvedValue(GOOD)
    wrap(<WhatsappSettingsPage />)
    await screen.findByText("Connect your WhatsApp Business number")
    fireEvent.change(screen.getByLabelText(/Phone number ID/), { target: { value: "109876543210987" } })
    fireEvent.change(screen.getByLabelText(/^Access token/), { target: { value: "EAAGtoken" + "x".repeat(50) } })
    fireEvent.click(screen.getByRole("button", { name: "Save & test connection" }))
    await waitFor(() => expect(api.saveWaSettings).toHaveBeenCalledWith({ phoneNumberId: "109876543210987", accessToken: "EAAGtoken" + "x".repeat(50) }))
    await waitFor(() => expect(api.testWaSettings).toHaveBeenCalled())
    const results = await screen.findByRole("region", { name: "Test results" })
    expect(within(results).getByText("Connected — everything checks out.")).toBeInTheDocument()
    expect(within(results).getByText("Meta confirmed +91 99999 12345 (“Bakaloo”).")).toBeInTheDocument()
    expect(toast.success).toHaveBeenCalledWith("Connected — everything checks out.")
  })

  it("shows the server's per-field problems next to the right field and does NOT test", async () => {
    api.saveWaSettings.mockRejectedValue({ response: { data: { message: "Some values need a look", details: { phoneNumberId: "The Phone number ID is only digits (about 15 of them). It is NOT the phone number itself." } } } })
    wrap(<WhatsappSettingsPage />)
    await screen.findByText("Connect your WhatsApp Business number")
    fireEvent.change(screen.getByLabelText(/Phone number ID/), { target: { value: "+91 98765" } })
    fireEvent.change(screen.getByLabelText(/^Access token/), { target: { value: "EAAGtoken" + "x".repeat(50) } })
    fireEvent.click(screen.getByRole("button", { name: "Save & test connection" }))
    expect(await screen.findByText(/NOT the phone number itself/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Phone number ID/)).toHaveAttribute("aria-invalid", "true")
    expect(api.testWaSettings).not.toHaveBeenCalled()
  })

  it("a failed test explains what happened, how to fix it, and keeps the technical details for support", async () => {
    api.getWaSettings.mockResolvedValue({ ...connected(), state: "SAVED", lastTest: null })
    api.testWaSettings.mockResolvedValue(EXPIRED)
    wrap(<WhatsappSettingsPage />)
    fireEvent.click(await screen.findByRole("button", { name: "Test connection" }))
    const results = await screen.findByRole("region", { name: "Test results" })
    expect(within(results).getAllByText("Your access token has expired").length).toBeGreaterThan(0)
    expect(within(results).getByText("Temporary tokens last only 24 hours.")).toBeInTheDocument()
    expect(within(results).getByText("Generate a token with expiry Never.")).toBeInTheDocument()
    expect(within(results).getByText("TRACE9")).toBeInTheDocument()
    expect(within(results).getByText("463")).toBeInTheDocument()
    expect(within(results).getByText("Skipped")).toBeInTheDocument()
    expect(toast.error).toHaveBeenCalledWith(EXPIRED.headline)
  })

  it("never shows a saved secret — only that it is saved — and an empty box keeps it", async () => {
    api.getWaSettings.mockResolvedValue(connected())
    wrap(<WhatsappSettingsPage />)
    expect(await screen.findByText("WhatsApp is connected")).toBeInTheDocument()
    expect(screen.getByText(/Saved · EAAG…xYz4/)).toBeInTheDocument()
    expect((screen.getByLabelText(/^Access token/) as HTMLInputElement).value).toBe("")
    expect(document.body.innerHTML).not.toMatch(/EAAGgood/)
    const save = screen.getByRole("button", { name: "Save only" })
    expect(save).toBeDisabled() // nothing changed
  })

  it("connected: shows the number and Meta's facts, and can be switched off and on", async () => {
    api.getWaSettings.mockResolvedValue(connected())
    api.enableWaSettings.mockResolvedValue({ enabled: false })
    wrap(<WhatsappSettingsPage />)
    expect(await screen.findByText(/Bakaloo · \+91 99999 12345/)).toBeInTheDocument()
    expect(screen.getByText("1K customers / day")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Switch WhatsApp off" }))
    await waitFor(() => expect(api.enableWaSettings).toHaveBeenCalledWith(false))
  })

  it("the webhook card gives the exact values to paste into Meta, and the last event", async () => {
    api.getWaSettings.mockResolvedValue({ ...connected(), webhook: { callbackUrl: "https://api.bakaloo.in/api/webhook/whatsapp", lastReceivedAt: "2026-10-02T09:00:00Z", last7d: 14 } })
    wrap(<WhatsappSettingsPage />)
    const card = await screen.findByRole("region", { name: "Webhook" })
    expect(within(card).getByText("https://api.bakaloo.in/api/webhook/whatsapp")).toBeInTheDocument()
    expect(within(card).getByText("bk_verify_word_123")).toBeInTheDocument()
    expect(within(card).getByText(/14 in the last 7 days/)).toBeInTheDocument()
    fireEvent.click(within(card).getByRole("button", { name: "Copy Callback URL" }))
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://api.bakaloo.in/api/webhook/whatsapp"))
  })

  it("can generate a verify token on the server", async () => {
    api.saveWaSettings.mockResolvedValue({ savedFields: ["verifyToken"], credentialsChanged: false })
    wrap(<WhatsappSettingsPage />)
    fireEvent.click(await screen.findByRole("button", { name: /Generate a secure token/ }))
    await waitFor(() => expect(api.saveWaSettings).toHaveBeenCalledWith({ generateVerifyToken: true }))
  })

  it("sends the sample message to a valid number only", async () => {
    api.getWaSettings.mockResolvedValue(connected())
    api.testWaSettings.mockResolvedValue({ ...GOOD, checks: [...GOOD.checks, { id: "message", label: "Test message", status: "pass", summary: "Meta accepted a test message to 919876543210." }] })
    wrap(<WhatsappSettingsPage />)
    const send = await screen.findByRole("button", { name: "Send test message" })
    expect(send).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/Mobile number/), { target: { value: "98765 43210" } })
    fireEvent.click(send)
    await waitFor(() => expect(api.testWaSettings).toHaveBeenCalledWith("9876543210"))
    expect(await screen.findByText(/Meta accepted a test message/)).toBeInTheDocument()
  })

  it("removing the saved details asks first", async () => {
    api.getWaSettings.mockResolvedValue(connected())
    api.clearWaSettings.mockResolvedValue({})
    wrap(<WhatsappSettingsPage />)
    fireEvent.click(await screen.findByRole("button", { name: "Remove saved details" }))
    expect(api.clearWaSettings).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Yes, remove" }))
    await waitFor(() => expect(api.clearWaSettings).toHaveBeenCalled())
  })

  it("usage & charges: this month's totals, charges by type, and the missing-prices warning", async () => {
    api.getWaSettings.mockResolvedValue(connected())
    wrap(<WhatsappSettingsPage />)
    const card = await screen.findByRole("region", { name: "Usage and charges" })
    expect(await within(card).findByText("₹56.50")).toBeInTheDocument()
    expect(within(card).getByText("120")).toBeInTheDocument()
    expect(within(card).getByRole("list", { name: "Charges by message type" })).toBeInTheDocument()
    expect(within(card).getByText(/How Meta charges for WhatsApp/)).toBeInTheDocument()
  })
  it("warns when no Meta prices are entered", async () => {
    api.getWaSettings.mockResolvedValue(connected())
    api.getAnalyticsOverview.mockResolvedValue({ range: {}, totals: { sent: 5, delivered: 5, read: 1, failed: 0, replied: 0, orders: 0, revenue: 0 }, cost: { total: 0, estimated: 0, billedMessages: 0, estimatedMessages: 0, unpricedMessages: 5, hasRates: false, byCategory: [] } })
    wrap(<WhatsappSettingsPage />)
    expect(await screen.findByText(/No Meta prices entered yet/)).toBeInTheDocument()
    expect(screen.getByText(/5 delivered message\(s\) have no price/)).toBeInTheDocument()
  })

  it("is not available without the settings permission, and asks the server for nothing", async () => {
    api.getCrmMe.mockResolvedValue({ userId: "u", isSuper: false, permissions: ["crm.inbox.view"] })
    wrap(<WhatsappSettingsPage />)
    await waitFor(() => expect(screen.queryByText("WhatsApp settings")).toBeNull())
    expect(api.getWaSettings).not.toHaveBeenCalled()
  })
})

describe("after saving", () => {
  it("a secret that was just saved is cleared from its box and shows only as saved", async () => {
    api.saveWaSettings.mockResolvedValue({ savedFields: ["accessToken"], credentialsChanged: true })
    api.testWaSettings.mockResolvedValue(GOOD)
    api.getWaSettings.mockResolvedValueOnce({ ...connected(), state: "SAVED", lastTest: null, fields: { ...connected().fields, accessToken: { configured: true, masked: "EAAG…bbbb", source: "dashboard" } } })
    wrap(<WhatsappSettingsPage />)
    const box = (await screen.findByLabelText(/^Access token/)) as HTMLInputElement
    fireEvent.change(box, { target: { value: "EAAGnewtoken" + "z".repeat(50) } })
    expect(box.value).toHaveLength(62)
    api.getWaSettings.mockResolvedValue(connected()) // the server now reports the new masked value
    fireEvent.click(screen.getByRole("button", { name: "Save & test connection" }))
    await waitFor(() => expect(api.saveWaSettings).toHaveBeenCalled())
    await waitFor(() => expect((screen.getByLabelText(/^Access token/) as HTMLInputElement).value).toBe(""))
    expect(screen.getByText(/Saved · EAAG…xYz4/)).toBeInTheDocument()
  })
})
