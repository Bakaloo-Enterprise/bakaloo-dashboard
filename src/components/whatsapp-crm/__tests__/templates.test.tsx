import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import type { TemplateDetail, WaTemplate } from "@/types/whatsapp-crm.types"

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() } }))
const api = {
  getTemplates: vi.fn(), getTemplate: vi.fn(), createTemplate: vi.fn(), updateTemplate: vi.fn(), submitTemplate: vi.fn(),
  getTemplateValues: vi.fn(), sendTemplate: vi.fn(),
}
vi.mock("@/services/whatsapp-crm.service", async (orig) => ({
  ...(await orig<object>()),
  getTemplates: (...a: unknown[]) => api.getTemplates(...a),
  getTemplate: (...a: unknown[]) => api.getTemplate(...a),
  createTemplate: (...a: unknown[]) => api.createTemplate(...a),
  updateTemplate: (...a: unknown[]) => api.updateTemplate(...a),
  submitTemplate: (...a: unknown[]) => api.submitTemplate(...a),
  getTemplateValues: (...a: unknown[]) => api.getTemplateValues(...a),
  sendTemplate: (...a: unknown[]) => api.sendTemplate(...a),
}))

import { TemplateEditorDialog } from "../TemplateEditorDialog"
import { SendTemplateDialog } from "../SendTemplateDialog"
import { TemplateStatusChip } from "../TemplateStatusChip"
import { MessageThread } from "../MessageThread"
import { detectVariables, previewFromInput, renderTemplateText, sendBlockReason, suggestName } from "../template-helpers"

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
})
beforeEach(() => Object.values(api).forEach((f) => f.mockReset()))

const wrap = (ui: ReactNode) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}
const purposes = [{ key: "custom", label: "Custom" }, { key: "abandoned_cart", label: "Abandoned Cart" }]

const tpl = (o: Partial<WaTemplate> = {}): WaTemplate => ({
  id: "t1", name: "abandoned_cart", language: "en", meta_category: "MARKETING", purpose: "abandoned_cart", parameter_format: "NAMED", status: "APPROVED",
  components: [
    { type: "HEADER", format: "TEXT", text: "Your cart is waiting" },
    { type: "BODY", text: "Hi {{customer_name}}, your cart worth Rs {{cart_value}} is still waiting for you." },
    { type: "FOOTER", text: "Bakaloo" },
    { type: "BUTTONS", buttons: [{ type: "QUICK_REPLY", text: "Need Help" }] },
  ],
  body_text: "Hi {{customer_name}}, your cart worth Rs {{cart_value}} is still waiting for you.", header_format: "TEXT",
  variables: [{ name: "customer_name", example: "Rahul", where: "body" }, { name: "cart_value", example: "1240", where: "body" }],
  allow_category_change: true, meta_template_id: "99", rejection_reason: null, rejection_detail: null, quality_score: "GREEN",
  pending_category: null, pending_category_at: null, flagged: false, locked: false, submitted_at: null, last_status_at: null, last_synced_at: null,
  created_at: "2026-10-01T10:00:00Z", updated_at: "2026-10-01T10:00:00Z", ...o,
})

describe("helpers", () => {
  it("detects variables once, in order, across several texts", () => {
    expect(detectVariables("Hi {{a}} {{ b }}", undefined, "x {{a}} {{c}}")).toEqual(["a", "b", "c"])
    expect(detectVariables("none")).toEqual([])
  })
  it("turns a label into a Meta-valid name", () => {
    expect(suggestName("Abandoned Cart!")).toBe("abandoned_cart")
    expect(suggestName("  1st  Order – Thanks ")).toBe("1st_order_thanks")
    expect(suggestName("***")).toBe("")
  })
  it("previews with examples, keeping unfilled variables visible", () => {
    const out = previewFromInput({ headerText: "Hi {{n}}", bodyText: "Cart {{v}} awaits", footerText: "Bakaloo", buttons: [{ type: "QUICK_REPLY", text: "Help" }, { type: "QUICK_REPLY", text: " " }], examples: { n: "Rahul" } })
    expect(out).toBe("Hi Rahul\n\nCart {{v}} awaits\n\nBakaloo\n\n[ Help ]")
  })
  it("renders an existing template with values, positional keys included", () => {
    expect(renderTemplateText(tpl(), { customer_name: "Rahul", cart_value: "1240" })).toBe("Your cart is waiting\n\nHi Rahul, your cart worth Rs 1240 is still waiting for you.\n\nBakaloo\n\n[ Need Help ]")
    const pos = { components: [{ type: "BODY", text: "Hi {{1}}, code {{2}} soon" }], variables: [{ name: "1", example: "", where: "body", key: "body.1" }, { name: "2", example: "", where: "body", key: "body.2" }] }
    expect(renderTemplateText(pos, { "body.1": "Pablo", "body.2": "SAVE20" })).toBe("Hi Pablo, code SAVE20 soon")
  })
  it("explains why a template cannot be sent", () => {
    expect(sendBlockReason({ status: "APPROVED", meta_category: "UTILITY", header_format: null })).toBeNull()
    expect(sendBlockReason({ status: "PENDING", meta_category: "UTILITY", header_format: null })).toMatch(/reviewing/i)
    expect(sendBlockReason({ status: "PAUSED", meta_category: "UTILITY", header_format: null })).toMatch(/paused/i)
    expect(sendBlockReason({ status: "APPROVED", meta_category: "AUTHENTICATION", header_format: null })).toMatch(/not supported/)
    expect(sendBlockReason({ status: "APPROVED", meta_category: "UTILITY", header_format: "LOCATION" })).toMatch(/location/)
  })
})

describe("TemplateStatusChip", () => {
  it("shows status, quality, at-risk and a coming category change", () => {
    render(<TemplateStatusChip t={{ status: "APPROVED", flagged: true, quality_score: "YELLOW", pending_category: "MARKETING", pending_category_at: "2026-10-05T00:00:00Z" }} />)
    expect(screen.getByText("Approved")).toBeInTheDocument()
    expect(screen.getByText("At risk")).toBeInTheDocument()
    expect(screen.getByText("Medium quality")).toBeInTheDocument()
    expect(screen.getByText(/Becoming marketing on/)).toBeInTheDocument()
  })
  it("quality is only shown for approved templates", () => {
    render(<TemplateStatusChip t={{ status: "PENDING", flagged: false, quality_score: "GREEN", pending_category: null, pending_category_at: null }} />)
    expect(screen.getByText("In review")).toBeInTheDocument()
    expect(screen.queryByText("High quality")).not.toBeInTheDocument()
  })
})

describe("TemplateEditorDialog — creating", () => {
  const open = (extra: Partial<React.ComponentProps<typeof TemplateEditorDialog>> = {}) =>
    wrap(<TemplateEditorDialog open templateId={null} purposes={purposes} connected onClose={vi.fn()} {...extra} />)

  it("detects variables, asks for an example of each, and sends a clean payload", async () => {
    api.createTemplate.mockResolvedValue({ template: tpl({ status: "DRAFT", meta_template_id: null }), warnings: [] })
    open()
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "abandoned_cart" } })
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Hi {{customer_name}}, your cart worth Rs {{cart_value}} is waiting." } })
    expect(screen.getByLabelText("{{customer_name}}")).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("{{customer_name}}"), { target: { value: "Rahul" } })
    fireEvent.change(screen.getByLabelText("{{cart_value}}"), { target: { value: "1240" } })
    expect(screen.getByTestId("template-preview").textContent).toBe("Hi Rahul, your cart worth Rs 1240 is waiting.")
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }))
    await waitFor(() => expect(api.createTemplate).toHaveBeenCalled())
    expect(api.createTemplate.mock.calls[0][0]).toMatchObject({
      name: "abandoned_cart", language: "en", metaCategory: "UTILITY", bodyText: "Hi {{customer_name}}, your cart worth Rs {{cart_value}} is waiting.",
      examples: { customer_name: "Rahul", cart_value: "1240" },
    })
  })

  it("drops examples for variables that were deleted from the text", async () => {
    api.createTemplate.mockResolvedValue({ template: tpl({ status: "DRAFT" }), warnings: [] })
    open()
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Hi {{customer_name}}, welcome to the store today." } })
    fireEvent.change(screen.getByLabelText("{{customer_name}}"), { target: { value: "Rahul" } })
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Welcome to the store today, friend." } })
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "welcome" } })
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }))
    await waitFor(() => expect(api.createTemplate).toHaveBeenCalled())
    expect(api.createTemplate.mock.calls[0][0].examples).toEqual({})
  })

  it("shows the server's problems next to the fields and in a summary, and keeps the dialog open", async () => {
    api.createTemplate.mockRejectedValue({ response: { data: { code: "INVALID_TEMPLATE", message: "Please fix", details: [
      { field: "name", message: "Name can only use lowercase letters" },
      { field: "bodyText", message: "The message cannot START with a variable." },
      { field: "examples.cart_value", message: "Add an example for {{cart_value}}" },
    ] } } })
    const onClose = vi.fn()
    open({ onClose })
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "x" } })
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "{{cart_value}} hello there my friend" } })
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }))
    const alert = await screen.findByRole("alert")
    expect(within(alert).getByText("The message cannot START with a variable.")).toBeInTheDocument()
    expect(within(alert).getAllByRole("listitem")).toHaveLength(3)
    expect(screen.getAllByText("Name can only use lowercase letters").length).toBeGreaterThanOrEqual(2) // summary + under the field
    expect(onClose).not.toHaveBeenCalled()
  })

  it("normalises typed names to what Meta allows", () => {
    open()
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "My Cart-Reminder!" } })
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("my_cart_reminder_")
  })

  it("buttons can be added with their own fields and removed", () => {
    open()
    fireEvent.click(screen.getByRole("button", { name: /Link/ }))
    fireEvent.change(screen.getByLabelText("Button 1 label"), { target: { value: "View Cart" } })
    expect((screen.getByLabelText("Button 1 link") as HTMLInputElement).value).toBe("https://")
    fireEvent.click(screen.getByRole("button", { name: /Quick reply/ }))
    expect(screen.getByLabelText("Button 2 label")).toBeInTheDocument()
    expect(screen.getByTestId("template-preview").textContent).toContain("[ View Cart ]")
    fireEvent.click(screen.getByRole("button", { name: "Remove button 1" }))
    expect(screen.queryByLabelText("Button 2 label")).not.toBeInTheDocument()
  })

  it("'Save and submit' is disabled until WhatsApp is connected, but drafts can still be saved", () => {
    open({ connected: false })
    expect(screen.getByRole("button", { name: "Save and submit to Meta" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Save draft" })).toBeEnabled()
  })

  it("'Save and submit' creates, then submits the new draft", async () => {
    api.createTemplate.mockResolvedValue({ template: tpl({ id: "new1", status: "DRAFT", meta_template_id: null }), warnings: [] })
    api.submitTemplate.mockResolvedValue(tpl({ id: "new1", status: "PENDING" }))
    open()
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "welcome" } })
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Welcome to Bakaloo, we deliver in minutes." } })
    fireEvent.click(screen.getByRole("button", { name: "Save and submit to Meta" }))
    await waitFor(() => expect(api.submitTemplate).toHaveBeenCalledWith("new1"))
  })
})

describe("TemplateEditorDialog — existing templates", () => {
  const detail = (t: WaTemplate, editor: TemplateDetail["editor"], events: TemplateDetail["events"] = []): TemplateDetail => ({ template: t, events, editor })
  const input = { headerText: "", bodyText: "Hi {{customer_name}}, your cart is waiting for you today.", footerText: "", buttons: [], examples: { customer_name: "Rahul" } }

  it("a template in Meta review is read-only with the reason, plus its history", async () => {
    api.getTemplate.mockResolvedValue(detail(tpl({ status: "PENDING" }), { editable: true, input }, [{ id: "e1", event: "SUBMITTED", detail: "Sent to Meta", source: "SUBMIT", created_at: "2026-10-01T10:00:00Z" }]))
    wrap(<TemplateEditorDialog open templateId="t1" purposes={purposes} connected onClose={vi.fn()} />)
    expect(await screen.findByText(/cannot be edited while its status is “In review”/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Save/ })).not.toBeInTheDocument()
    expect(screen.getByText("submitted")).toBeInTheDocument() // the history entry
    expect(screen.getByText(/Sent to Meta/)).toBeInTheDocument()
  })

  it("a rejected template shows Meta's reason prominently and is editable", async () => {
    api.getTemplate.mockResolvedValue(detail(tpl({ status: "REJECTED", rejection_reason: "INVALID_FORMAT", rejection_detail: "Parameters are next to each other." }), { editable: true, input }))
    wrap(<TemplateEditorDialog open templateId="t1" purposes={purposes} connected onClose={vi.fn()} />)
    expect(await screen.findByText(/Why Meta rejected it: invalid format/)).toBeInTheDocument()
    expect(screen.getByText("Parameters are next to each other.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save and send to Meta" })).toBeEnabled()
  })

  it("an approved template warns that saving triggers a re-review, and name/language are locked", async () => {
    api.getTemplate.mockResolvedValue(detail(tpl({ status: "APPROVED" }), { editable: true, input }))
    wrap(<TemplateEditorDialog open templateId="t1" purposes={purposes} connected onClose={vi.fn()} />)
    expect(await screen.findByText(/re-review/)).toBeInTheDocument()
    expect((screen.getByLabelText("Name") as HTMLInputElement).disabled).toBe(true)
    await waitFor(() => expect((screen.getByLabelText("Message") as HTMLTextAreaElement).value).toMatch(/cart is waiting/))
  })

  it("templates from WhatsApp Manager that cannot be edited here say why", async () => {
    api.getTemplate.mockResolvedValue(detail(tpl({ parameter_format: "POSITIONAL" }), { editable: false, reason: "This template uses numbered variables ({{1}}). Edit it in WhatsApp Manager." }))
    wrap(<TemplateEditorDialog open templateId="t1" purposes={purposes} connected onClose={vi.fn()} />)
    expect(await screen.findByText(/numbered variables/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Save/ })).not.toBeInTheDocument()
  })
})

describe("SendTemplateDialog", () => {
  const list = (templates: WaTemplate[]) => api.getTemplates.mockResolvedValue({ templates, counts: {}, lastSyncedAt: null, purposes })
  const props = { conversationId: "c1", consent: "UNKNOWN" as const, windowOpen: false, canSend: true }
  const openDialog = async () => {
    wrap(<SendTemplateDialog {...props} />)
    fireEvent.click(screen.getByRole("button", { name: "Send a template message" }))
    return screen.findByRole("dialog")
  }

  it("is hidden for users without permission", () => {
    wrap(<SendTemplateDialog {...props} canSend={false} />)
    expect(screen.queryByRole("button", { name: "Send a template message" })).not.toBeInTheDocument()
  })

  it("pre-fills customer details, previews the message and sends the exact payload", async () => {
    list([tpl()])
    api.getTemplateValues.mockResolvedValue({ customer_name: "Priya", cart_value: "1240" })
    api.sendTemplate.mockResolvedValue({})
    const dialog = await openDialog()
    fireEvent.click(await within(dialog).findByRole("button", { name: /abandoned_cart/ }))
    await waitFor(() => expect((within(dialog).getByLabelText("{{customer_name}}") as HTMLInputElement).value).toBe("Priya"))
    expect(within(dialog).getByTestId("send-preview").textContent).toContain("Hi Priya, your cart worth Rs 1240 is still waiting for you.")
    fireEvent.change(within(dialog).getByLabelText("{{cart_value}}"), { target: { value: "999" } }) // staff can override
    fireEvent.click(within(dialog).getByRole("button", { name: "Send template" }))
    await waitFor(() => expect(api.sendTemplate).toHaveBeenCalledWith("c1", { templateId: "t1", values: { customer_name: "Priya", cart_value: "999" }, headerMediaUrl: undefined }))
  })

  it("cannot send until every variable has a value", async () => {
    list([tpl()])
    api.getTemplateValues.mockResolvedValue({ customer_name: "Priya" }) // no cart value known
    const dialog = await openDialog()
    fireEvent.click(await within(dialog).findByRole("button", { name: /abandoned_cart/ }))
    await waitFor(() => expect((within(dialog).getByLabelText("{{customer_name}}") as HTMLInputElement).value).toBe("Priya"))
    const send = within(dialog).getByRole("button", { name: "Send template" })
    expect(send).toBeDisabled()
    fireEvent.change(within(dialog).getByLabelText("{{cart_value}}"), { target: { value: "500" } })
    expect(send).toBeEnabled()
  })

  it("blocks a marketing template for a customer who opted out", async () => {
    list([tpl()])
    api.getTemplateValues.mockResolvedValue({ customer_name: "Priya", cart_value: "1" })
    wrap(<SendTemplateDialog {...props} consent="OPTED_OUT" />)
    fireEvent.click(screen.getByRole("button", { name: "Send a template message" }))
    const dialog = await screen.findByRole("dialog")
    fireEvent.click(await within(dialog).findByRole("button", { name: /abandoned_cart/ }))
    expect(await within(dialog).findByText(/opted out of marketing/)).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: "Send template" })).toBeDisabled()
  })

  it("an image-header template needs an https link before it can be sent", async () => {
    list([tpl({ name: "promo_image", header_format: "IMAGE", meta_category: "UTILITY", components: [{ type: "HEADER", format: "IMAGE" }, { type: "BODY", text: "Fresh offers for you today at Bakaloo." }], variables: [] })])
    api.getTemplateValues.mockResolvedValue({})
    const dialog = await openDialog()
    fireEvent.click(await within(dialog).findByRole("button", { name: /promo_image/ }))
    const send = within(dialog).getByRole("button", { name: "Send template" })
    expect(send).toBeDisabled()
    fireEvent.change(within(dialog).getByLabelText(/image link/), { target: { value: "http://insecure/a.jpg" } })
    expect(send).toBeDisabled()
    fireEvent.change(within(dialog).getByLabelText(/image link/), { target: { value: "https://cdn.bakaloo.in/a.jpg" } })
    expect(send).toBeEnabled()
  })

  it("explains when there are no approved templates yet", async () => {
    list([])
    api.getTemplateValues.mockResolvedValue({})
    const dialog = await openDialog()
    expect(await within(dialog).findByText(/No approved templates yet/)).toBeInTheDocument()
  })

  it("the button is the primary action once the 24-hour window is closed", () => {
    wrap(<SendTemplateDialog {...props} windowOpen={false} />)
    expect(screen.getByRole("button", { name: "Send a template message" }).className).toMatch(/bg-primary/)
  })
})

describe("MessageThread — template entry point", () => {
  const conv = { id: "c1", window_open: false, last_inbound_at: "2026-09-01T00:00:00Z", customer_name: null, profile_name: "Rahul", phone: "9876543210", wa_username: null, bsuid: null } as never
  it("points to the Template button when the window is closed, and renders the extra control", () => {
    render(<MessageThread conversation={conv} messages={[]} isLoading={false} onSend={vi.fn()} sending={false} composerExtra={<button>TPL-BTN</button>} />)
    expect(screen.getByText(/Use the Template button/)).toBeInTheDocument()
    expect(screen.getByText("TPL-BTN")).toBeInTheDocument()
    expect(screen.queryByText(/later phase/)).not.toBeInTheDocument()
  })
})
