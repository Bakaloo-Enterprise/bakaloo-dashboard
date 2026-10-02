import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import type { WaConfigStatus, WaConversation } from "@/types/whatsapp-crm.types"

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

const api = { getCustomerNotifications: vi.fn(), getCustomerThread: vi.fn(), openCustomerConversation: vi.fn(), getCrmMe: vi.fn(), getCrmStatus: vi.fn(), sendMessage: vi.fn(), getTemplates: vi.fn() }
vi.mock("@/services/customers.service", async (orig) => ({ ...(await orig<object>()), getCustomerNotifications: (...a: unknown[]) => api.getCustomerNotifications(...a) }))
vi.mock("@/services/whatsapp-crm.service", async (orig) => ({
  ...(await orig<object>()),
  getCustomerThread: (...a: unknown[]) => api.getCustomerThread(...a), openCustomerConversation: (...a: unknown[]) => api.openCustomerConversation(...a),
  getCrmMe: (...a: unknown[]) => api.getCrmMe(...a), getCrmStatus: (...a: unknown[]) => api.getCrmStatus(...a), sendMessage: (...a: unknown[]) => api.sendMessage(...a),
  getTemplates: (...a: unknown[]) => api.getTemplates(...a),
}))

import { CustomerMessages } from "../CustomerMessages"
import { CustomerWhatsappDialog } from "../CustomerWhatsappDialog"
import { displayPhone, whatsappSetup } from "../whatsapp-setup"

beforeAll(() => { Element.prototype.scrollIntoView = vi.fn() })
const wrap = (ui: ReactNode) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>)

const status = (o: Partial<WaConfigStatus["configured"]> = {}, enabled = true): WaConfigStatus => ({
  enabled, apiVersion: "v25.0", configured: { phoneNumberId: true, wabaId: true, accessToken: true, verifyToken: true, appSecret: true, ...o }, webhookPath: "/api/webhook/whatsapp", botEnabled: false, templatesReady: true,
})
const conv = (o: Partial<WaConversation> = {}) => ({ id: "c1", window_open: false, marketing_consent: "UNKNOWN", customer_name: "Asha", wa_id: "919999912345", ...o }) as unknown as WaConversation
const note = (o = {}) => ({ id: "n1", title: "Your refund", body: "Rs 40 is on its way", type: "ADMIN_MESSAGE", personal: true, isRead: false, readAt: null, createdAt: new Date().toISOString(), sentByName: "Mira", ...o })

beforeEach(() => {
  vi.clearAllMocks()
  api.getCrmMe.mockResolvedValue({ userId: "u", isSuper: false, permissions: ["crm.inbox.view", "crm.inbox.reply"] })
  api.getCrmStatus.mockResolvedValue(status())
  api.getCustomerThread.mockResolvedValue({ conversation: null, messages: [], restricted: false })
  api.getTemplates.mockResolvedValue({ templates: [], counts: {} })
})

describe("whatsapp setup helper", () => {
  it("says what is missing in plain words", () => {
    expect(whatsappSetup(status({ phoneNumberId: false, accessToken: false }))).toMatchObject({ canSend: false, missing: [expect.stringContaining("Phone number ID"), expect.stringContaining("Access token")] })
    expect(whatsappSetup(status({}, false)).missing[0]).toMatch(/switched off/)
    expect(whatsappSetup(status())).toMatchObject({ canSend: true, receivesReplies: true, missing: [] })
    expect(whatsappSetup(status({ verifyToken: false }))).toMatchObject({ canSend: true, receivesReplies: false })
    expect(whatsappSetup(undefined)).toMatchObject({ canSend: false, missing: [] })
  })
  it("formats Indian numbers", () => {
    expect(displayPhone("9999912345")).toBe("+91 99999 12345")
    expect(displayPhone("919999912345")).toBe("+91 99999 12345")
    expect(displayPhone("12345")).toBe("12345")
  })
})

describe("messages sent to the customer", () => {
  it("starts on personal messages and shows who sent each and whether it was seen", async () => {
    api.getCustomerNotifications.mockResolvedValue([note(), note({ id: "n2", title: "Hello", isRead: true, sentByName: null })])
    wrap(<CustomerMessages customerId="u1" canSeeWhatsapp />)
    expect(await screen.findByText("Your refund")).toBeInTheDocument()
    expect(api.getCustomerNotifications).toHaveBeenCalledWith("u1", true)
    expect(screen.getByText("Personal · by Mira")).toBeInTheDocument()
    expect(screen.getByText("Not seen yet")).toBeInTheDocument()
    expect(screen.getByText("Seen")).toBeInTheDocument()
  })
  it("'All notifications' asks for everything and labels automatic ones by type", async () => {
    api.getCustomerNotifications.mockResolvedValue([note({ title: "Order delivered", type: "ORDER_STATUS", personal: false, sentByName: null })])
    wrap(<CustomerMessages customerId="u1" canSeeWhatsapp />)
    fireEvent.click(screen.getByRole("tab", { name: "All notifications" }))
    expect(await screen.findByText("Order delivered")).toBeInTheDocument()
    expect(api.getCustomerNotifications).toHaveBeenLastCalledWith("u1", false)
    expect(screen.getByText("order status")).toBeInTheDocument()
  })
  it("says so when nothing was sent", async () => {
    api.getCustomerNotifications.mockResolvedValue([])
    wrap(<CustomerMessages customerId="u1" canSeeWhatsapp={false} />)
    expect(await screen.findByText(/No personal message has been sent/)).toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: "WhatsApp" })).toBeNull() // no CRM access → no WhatsApp tab
  })
  it("shows the WhatsApp conversation, with failures, and the 'another team member' case", async () => {
    api.getCustomerNotifications.mockResolvedValue([])
    api.getCustomerThread.mockResolvedValueOnce({ conversation: conv(), restricted: false, messages: [
      { id: "m1", direction: "OUTBOUND", body: "Your order is ready", msg_type: "text", status: "READ", template_name: null, is_bot: false, created_at: new Date().toISOString(), error_title: null },
      { id: "m2", direction: "OUTBOUND", body: "Second", msg_type: "text", status: "FAILED", template_name: null, is_bot: false, created_at: new Date().toISOString(), error_title: "Not on WhatsApp" },
      { id: "m3", direction: "INBOUND", body: "Thanks!", msg_type: "text", status: "RECEIVED", template_name: null, is_bot: false, created_at: new Date().toISOString(), error_title: null },
    ] })
    wrap(<CustomerMessages customerId="u1" canSeeWhatsapp />)
    fireEvent.click(screen.getByRole("tab", { name: "WhatsApp" }))
    expect(await screen.findByText("Your order is ready")).toBeInTheDocument()
    expect(screen.getByText(/· read$/)).toBeInTheDocument()
    expect(screen.getByText(/Not on WhatsApp/)).toBeInTheDocument()
    expect(screen.getByText("Thanks!")).toBeInTheDocument()
  })
  it("a conversation owned by another agent is not shown", async () => {
    api.getCustomerNotifications.mockResolvedValue([])
    api.getCustomerThread.mockResolvedValue({ conversation: null, messages: [], restricted: true })
    wrap(<CustomerMessages customerId="u1" canSeeWhatsapp />)
    fireEvent.click(screen.getByRole("tab", { name: "WhatsApp" }))
    expect(await screen.findByText(/handled by another team member/)).toBeInTheDocument()
  })
})

describe("WhatsApp message dialog", () => {
  const customer = { id: "u1", name: "Asha", phone: "9999912345" }

  it("opens the customer's conversation, shows the number, and lets staff type when the 24-hour window is open", async () => {
    api.openCustomerConversation.mockResolvedValue(conv({ window_open: true }))
    api.sendMessage.mockResolvedValue({})
    const onOpenChange = vi.fn()
    wrap(<CustomerWhatsappDialog customer={customer} open onOpenChange={onOpenChange} />)
    expect(screen.getByText(/\+91 99999 12345/)).toBeInTheDocument()
    const box = await screen.findByLabelText("Message")
    expect(api.openCustomerConversation).toHaveBeenCalledWith("u1")
    const send = screen.getByRole("button", { name: "Send on WhatsApp" })
    expect(send).toBeDisabled()
    fireEvent.change(box, { target: { value: "Your order is ready" } })
    await waitFor(() => expect(send).toBeEnabled())
    fireEvent.click(send)
    await waitFor(() => expect(api.sendMessage).toHaveBeenCalledWith("c1", "Your order is ready"))
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it("with the window closed it offers an approved template instead of a text box", async () => {
    api.openCustomerConversation.mockResolvedValue(conv({ window_open: false }))
    wrap(<CustomerWhatsappDialog customer={customer} open onOpenChange={() => undefined} />)
    expect(await screen.findByText(/approved message template/)).toBeInTheDocument()
    expect(screen.queryByLabelText("Message")).toBeNull()
    expect(screen.getByText("Reply window closed")).toBeInTheDocument()
  })

  it("says clearly that WhatsApp is not connected, lists what is missing, and blocks sending", async () => {
    api.getCrmStatus.mockResolvedValue(status({ phoneNumberId: false, accessToken: false }, false))
    api.openCustomerConversation.mockResolvedValue(conv({ window_open: true }))
    wrap(<CustomerWhatsappDialog customer={customer} open onOpenChange={() => undefined} />)
    expect(await screen.findByText("WhatsApp is not connected yet")).toBeInTheDocument()
    expect(screen.getByText(/WHATSAPP_PHONE_NUMBER_ID/)).toBeInTheDocument()
    expect(screen.getByText(/WHATSAPP_ACCESS_TOKEN/)).toBeInTheDocument()
    fireEvent.change(await screen.findByLabelText("Message"), { target: { value: "hi" } })
    expect(screen.getByRole("button", { name: "Send on WhatsApp" })).toBeDisabled()
  })

  it("warns about marketing opt-out", async () => {
    api.openCustomerConversation.mockResolvedValue(conv({ marketing_consent: "OPTED_OUT" }))
    wrap(<CustomerWhatsappDialog customer={customer} open onOpenChange={() => undefined} />)
    expect(await screen.findByText("Opted out of marketing messages")).toBeInTheDocument()
  })

  it("shows the reason in place when the customer cannot be reached (and no extra toast)", async () => {
    api.openCustomerConversation.mockRejectedValue({ response: { data: { message: "This customer has no valid mobile number, so they cannot be reached on WhatsApp." } } })
    wrap(<CustomerWhatsappDialog customer={customer} open onOpenChange={() => undefined} />)
    expect(await screen.findByRole("alert", {}, { timeout: 3000 })).toHaveTextContent(/no valid mobile number/)
  })

  it("without the reply permission it explains instead of opening anything", async () => {
    api.getCrmMe.mockResolvedValue({ userId: "u", isSuper: false, permissions: ["crm.inbox.view"] })
    wrap(<CustomerWhatsappDialog customer={customer} open onOpenChange={() => undefined} />)
    expect(await screen.findByText(/do not have permission to send WhatsApp messages/)).toBeInTheDocument()
    expect(api.openCustomerConversation).not.toHaveBeenCalled()
  })

  it("does nothing while closed", () => {
    wrap(<CustomerWhatsappDialog customer={customer} open={false} onOpenChange={() => undefined} />)
    expect(api.openCustomerConversation).not.toHaveBeenCalled()
  })
})
