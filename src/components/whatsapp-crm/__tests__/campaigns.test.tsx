import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import type { Campaign, Workflow, WaTemplate } from "@/types/whatsapp-crm.types"

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))
vi.mock("@/hooks/useCoupons", () => ({
  useCoupons: () => ({ data: { data: [
    { id: "cp1", code: "SAVE10", isActive: true, targetType: "ALL" },
    { id: "cp2", code: "VIPONLY", isActive: true, targetType: "SEGMENT" },
  ] } }),
}))

const api = {
  getTemplates: vi.fn(), getCampaignOptions: vi.fn(), getLabels: vi.fn(), getCampaign: vi.fn(), getCampaignRecipients: vi.fn(),
  previewCampaign: vi.fn(), launchCampaign: vi.fn(), recordConsent: vi.fn(), getSuppressed: vi.fn(), getWorkflowCatalog: vi.fn(),
  getCrmMe: vi.fn(), getCampaigns: vi.fn(),
}
vi.mock("@/services/whatsapp-crm.service", async (orig) => ({
  ...(await orig<object>()),
  getTemplates: (...a: unknown[]) => api.getTemplates(...a),
  getCampaignOptions: (...a: unknown[]) => api.getCampaignOptions(...a),
  getLabels: (...a: unknown[]) => api.getLabels(...a),
  getCampaign: (...a: unknown[]) => api.getCampaign(...a),
  getCampaigns: (...a: unknown[]) => api.getCampaigns(...a),
  getCampaignRecipients: (...a: unknown[]) => api.getCampaignRecipients(...a),
  previewCampaign: (...a: unknown[]) => api.previewCampaign(...a),
  launchCampaign: (...a: unknown[]) => api.launchCampaign(...a),
  recordConsent: (...a: unknown[]) => api.recordConsent(...a),
  getSuppressed: (...a: unknown[]) => api.getSuppressed(...a),
  getWorkflowCatalog: (...a: unknown[]) => api.getWorkflowCatalog(...a),
  getCrmMe: (...a: unknown[]) => api.getCrmMe(...a),
}))

import { CampaignDialog } from "../CampaignDialog"
import { CampaignDetailSheet } from "../CampaignDetailSheet"
import { ConsentPanel } from "../ConsentPanel"
import { WorkflowDialog } from "../WorkflowDialog"
import {
  availableActions, cleanConditions, describeCondition, describeTrigger, isQuietHoursIST, localInputToIso, parsePhones, pct, progressPercent,
} from "../campaign-helpers"

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
})

const tpl = (o: Partial<WaTemplate> = {}): WaTemplate => ({
  id: "t1", name: "diwali_offer", language: "en", meta_category: "MARKETING", purpose: "custom", parameter_format: "NAMED", status: "APPROVED",
  components: [{ type: "BODY", text: "Hi {{customer_name}}, use code {{offer_code}} this week." }], body_text: "Hi {{customer_name}}, use code {{offer_code}} this week.",
  header_format: null, variables: [{ name: "customer_name", example: "Rahul", where: "body" }, { name: "offer_code", example: "DIWALI10", where: "body" }],
  allow_category_change: true, meta_template_id: "1", rejection_reason: null, rejection_detail: null, quality_score: null, pending_category: null,
  pending_category_at: null, flagged: false, locked: false, submitted_at: null, last_status_at: null, last_synced_at: null, created_at: "", updated_at: "", ...o,
})
const stats = (o = {}) => ({ total: 0, waiting: 0, skipped: 0, failed: 0, sent: 0, delivered: 0, read: 0, skipReasons: [], ...o })
const campaign = (o: Partial<Campaign> = {}): Campaign => ({
  id: "c1", name: "Diwali", template_id: "t1", template_name: "diwali_offer", template_status: "APPROVED", template_category: "UTILITY", template_values: {},
  header_media_url: null, audience: { type: "SEGMENT", ids: ["s1"] }, status: "DRAFT", pause_reason: null, scheduled_at: null, started_at: null, completed_at: null,
  rate_per_minute: 60, total_recipients: 0, created_at: new Date().toISOString(), stats: stats(), ...o,
})

const wrap = (ui: ReactNode) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  for (const f of Object.values(api)) f.mockReset()
  api.getTemplates.mockResolvedValue({ templates: [tpl()], counts: {}, lastSyncedAt: null, purposes: [] })
  api.getCampaignOptions.mockResolvedValue({ segments: [{ id: "s1", name: "Repeat customers", members: 120 }, { id: "s2", name: "New", members: 5 }], stages: [] })
  api.getLabels.mockResolvedValue([])
  api.getSuppressed.mockResolvedValue([])
  api.getCampaignRecipients.mockResolvedValue([])
  api.getWorkflowCatalog.mockResolvedValue({
    triggers: {
      CART_ABANDONED: { label: "Cart", fields: ["cart_value", "item_count", "order_count"], tokens: ["customer_name", "cart_value", "cart_link", "coupon_code"] },
      ORDER_STATUS: { label: "Order", fields: ["order_total", "order_count", "payment_method"], tokens: ["customer_name", "order_number", "order_status"] },
    },
    cartLinkConfigured: true,
  })
})

describe("campaign helpers", () => {
  it("computes progress and percentages without dividing by zero", () => {
    expect(progressPercent(stats({ total: 10, waiting: 4 }))).toBe(60)
    expect(progressPercent(stats())).toBe(0)
    expect(pct(3, 4)).toBe("75%")
    expect(pct(1, 0)).toBe("–")
  })
  it("offers only the actions that make sense for each status", () => {
    expect(availableActions({ status: "DRAFT" })).toEqual(["launch", "delete"])
    expect(availableActions({ status: "SENDING" })).toEqual(["pause", "cancel"])
    expect(availableActions({ status: "PAUSED" })).toEqual(["resume", "cancel"])
    expect(availableActions({ status: "COMPLETED" })).toEqual([])
    expect(availableActions({ status: "CANCELLED" })).toEqual([])
  })
  it("parses pasted phone lists into unique numbers", () => {
    expect(parsePhones("9876543210, 9876543210\n9123456789;  ")).toEqual(["9876543210", "9123456789"])
    expect(parsePhones("  ")).toEqual([])
  })
  it("turns a local date-time into ISO and ignores junk", () => {
    expect(localInputToIso("2026-10-05T10:30")).toMatch(/^2026-10-05T/)
    expect(localInputToIso("")).toBeUndefined()
    expect(localInputToIso("nope")).toBeUndefined()
  })
  it("knows India's quiet hours (9 pm – 9 am IST)", () => {
    expect(isQuietHoursIST(new Date("2026-10-01T15:30:00Z"))).toBe(true)
    expect(isQuietHoursIST(new Date("2026-10-01T03:30:00Z"))).toBe(false)
  })
  it("describes workflows in plain words and cleans condition rows", () => {
    expect(describeTrigger({ trigger_type: "CART_ABANDONED", trigger_config: { delay_minutes: 5 } })).toBe("A cart sits unbought for 5 minutes (one reminder per customer per 1 day)")
    expect(describeTrigger({ trigger_type: "CART_ABANDONED", trigger_config: { delay_minutes: 5, cooldown_hours: 0 } })).toBe("A cart sits unbought for 5 minutes")
    expect(describeTrigger({ trigger_type: "CART_ABANDONED", trigger_config: { delay_minutes: 120, cooldown_hours: 0 } })).toBe("A cart sits unbought for 2 hours")
    expect(describeTrigger({ trigger_type: "ORDER_STATUS", trigger_config: { status: "OUT_FOR_DELIVERY" } })).toBe("An order becomes “Out for delivery”")
    expect(describeCondition({ field: "cart_value", op: "gt", value: 500 })).toBe("Cart value (₹) is more than 500")
    expect(cleanConditions([{ field: "cart_value", op: "gt", value: "500" }, { field: "cart_value", op: "gt", value: "" }, { field: "payment_method", op: "eq", value: " COD " }, { field: "order_total", op: "gt", value: "abc" }]))
      .toEqual([{ field: "cart_value", op: "gt", value: 500 }, { field: "payment_method", op: "eq", value: "COD" }])
  })
})

describe("CampaignDialog", () => {
  it("saves only when name, template, audience and the template's own values are filled; customer name is automatic", async () => {
    const onSave = vi.fn()
    wrap(<CampaignDialog open campaign={null} saving={false} onClose={vi.fn()} onSave={onSave} />)
    const save = screen.getByRole("button", { name: "Save draft" })
    expect(save).toBeDisabled()

    fireEvent.change(screen.getByLabelText("Campaign name"), { target: { value: "  Diwali  " } })
    await screen.findByRole("option", { name: /diwali_offer/ })
    fireEvent.change(screen.getByLabelText("Message template"), { target: { value: "t1" } })
    expect(screen.queryByLabelText("customer name")).toBeNull() // filled per customer by the system
    expect(await screen.findByLabelText("offer code")).toBeInTheDocument()
    fireEvent.click(await screen.findByLabelText(/Repeat customers/))
    expect(save).toBeDisabled() // offer code still empty
    fireEvent.change(screen.getByLabelText("offer code"), { target: { value: "DIWALI10" } })
    expect(save).toBeEnabled()

    fireEvent.click(save)
    expect(onSave).toHaveBeenCalledWith({
      name: "Diwali", templateId: "t1", audience: { type: "SEGMENT", ids: ["s1"] }, templateValues: { offer_code: "DIWALI10" }, ratePerMinute: 60,
    })
  })

  it("'Everyone who opted in' needs no selection", async () => {
    const onSave = vi.fn()
    api.getTemplates.mockResolvedValue({ templates: [tpl({ components: [{ type: "BODY", text: "Hi {{customer_name}} welcome back" }], body_text: "Hi {{customer_name}} welcome back", variables: [{ name: "customer_name", example: "R", where: "body" }] })], counts: {}, lastSyncedAt: null, purposes: [] })
    wrap(<CampaignDialog open campaign={null} saving={false} onClose={vi.fn()} onSave={onSave} />)
    fireEvent.change(screen.getByLabelText("Campaign name"), { target: { value: "All" } })
    await screen.findByRole("option", { name: /diwali_offer/ })
    fireEvent.change(screen.getByLabelText("Message template"), { target: { value: "t1" } })
    fireEvent.click(screen.getByRole("button", { name: "Everyone who opted in" }))
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ audience: { type: "ALL_OPTED_IN", ids: [] } }))
  })

  it("warns when there is no approved template", async () => {
    api.getTemplates.mockResolvedValue({ templates: [], counts: {}, lastSyncedAt: null, purposes: [] })
    wrap(<CampaignDialog open campaign={null} saving={false} onClose={vi.fn()} onSave={vi.fn()} />)
    expect(await screen.findByText(/No approved templates yet/)).toBeInTheDocument()
  })
})

describe("CampaignDetailSheet", () => {
  it("a draft can only be sent after checking the audience, and never when nobody can receive it", async () => {
    api.getCampaign.mockResolvedValue(campaign())
    api.previewCampaign.mockResolvedValue({ audience: 3, willSend: 0, skipped: { NO_CONSENT: 3 } })
    wrap(<CampaignDetailSheet id="c1" onClose={vi.fn()} onEdit={vi.fn()} />)
    const send = await screen.findByRole("button", { name: /Send now/ })
    expect(send).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Check who will receive it" }))
    expect(await screen.findByText(/3 skipped — No recorded opt-in/)).toBeInTheDocument()
    expect(send).toBeDisabled()
    expect(screen.getByText(/Nobody can receive this yet/)).toBeInTheDocument()
  })

  it("launches once the preview shows recipients", async () => {
    api.getCampaign.mockResolvedValue(campaign())
    api.previewCampaign.mockResolvedValue({ audience: 5, willSend: 4, skipped: { OPTED_OUT: 1 } })
    api.launchCampaign.mockResolvedValue(campaign({ status: "SENDING" }))
    wrap(<CampaignDetailSheet id="c1" onClose={vi.fn()} onEdit={vi.fn()} />)
    fireEvent.click(await screen.findByRole("button", { name: "Check who will receive it" }))
    expect(await screen.findByText(/of 5 will receive it/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Send now/ }))
    await waitFor(() => expect(api.launchCampaign).toHaveBeenCalledWith("c1", undefined))
  })

  it("shows results and the right controls for a running campaign", async () => {
    api.getCampaign.mockResolvedValue(campaign({ status: "SENDING", stats: stats({ total: 10, waiting: 4, sent: 5, delivered: 4, read: 2, failed: 1, skipped: 0 }) }))
    wrap(<CampaignDetailSheet id="c1" onClose={vi.fn()} onEdit={vi.fn()} />)
    expect(await screen.findByText("60% handled")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Pause/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Cancel/ })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Send now/ })).toBeNull()
  })

  it("explains an automatic pause", async () => {
    api.getCampaign.mockResolvedValue(campaign({ status: "PAUSED", pause_reason: "Meta paused this template because of customer feedback." }))
    wrap(<CampaignDetailSheet id="c1" onClose={vi.fn()} onEdit={vi.fn()} />)
    expect(await screen.findByText(/Paused: Meta paused this template/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Resume/ })).toBeInTheDocument()
  })
})

describe("ConsentPanel", () => {
  it("records opt-ins only with numbers, a source and an explicit confirmation", async () => {
    api.recordConsent.mockResolvedValue({ recorded: 2, invalid: ["12345"], invalidCount: 1 })
    wrap(<ConsentPanel />)
    const btn = screen.getByRole("button", { name: "Record opt-in" })
    expect(btn).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/Phone numbers/), { target: { value: "9876543210, 9123456789, 12345" } })
    fireEvent.change(screen.getByLabelText("Where did they agree?"), { target: { value: "checkout checkbox" } })
    expect(btn).toBeDisabled() // not confirmed yet
    fireEvent.click(screen.getByLabelText(/I confirm these customers agreed/))
    expect(btn).toBeEnabled()
    fireEvent.click(btn)
    await waitFor(() => expect(api.recordConsent).toHaveBeenCalledWith({ phones: ["9876543210", "9123456789", "12345"], source: "checkout checkbox", confirm: true }))
    expect(await screen.findByText(/not valid Indian mobile numbers: 12345/)).toBeInTheDocument()
  })

  it("lists the do-not-contact people", async () => {
    api.getSuppressed.mockResolvedValue([{ contact_id: "x", name: "Asha", phone: "9876543210", reason: "complaint", created_at: new Date().toISOString() }])
    wrap(<ConsentPanel />)
    expect(await screen.findByText("Asha")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument()
  })
})

describe("WorkflowDialog", () => {
  const cartTpl = tpl({
    id: "t9", name: "cart_reminder",
    components: [{ type: "BODY", text: "Hi {{customer_name}}, your cart of Rs {{cart_value}} waits. Code {{coupon_code}} {{cart_link}}" }],
    body_text: "Hi {{customer_name}}, your cart of Rs {{cart_value}} waits. Code {{coupon_code}} {{cart_link}}",
    variables: ["customer_name", "cart_value", "coupon_code", "cart_link"].map((n) => ({ name: n, example: "x", where: "body" })),
  })

  it("builds a cart reminder: delay, condition, coupon — and asks for nothing the system fills itself", async () => {
    api.getTemplates.mockResolvedValue({ templates: [cartTpl], counts: {}, lastSyncedAt: null, purposes: [] })
    const onSave = vi.fn()
    wrap(<WorkflowDialog open workflow={null} saving={false} onClose={vi.fn()} onSave={onSave} />)
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: " Cart rescue " } })
    fireEvent.change(await screen.findByLabelText("…and still hasn’t bought after"), { target: { value: "15" } })
    fireEvent.click(screen.getByRole("button", { name: /Add condition/ }))
    fireEvent.change(screen.getByLabelText("Condition 1 value"), { target: { value: "500" } })
    await screen.findByRole("option", { name: /cart_reminder/ })
    fireEvent.change(screen.getByLabelText("Send this message"), { target: { value: "t9" } })

    // coupon_code is NOT auto-filled until a coupon is attached → asked for
    expect(await screen.findByLabelText("coupon code")).toBeInTheDocument()
    expect(screen.queryByLabelText("cart value")).toBeNull()
    expect(screen.queryByLabelText("cart link")).toBeNull()
    fireEvent.change(screen.getByLabelText("Attach a coupon (optional)"), { target: { value: "cp1" } })
    await waitFor(() => expect(screen.queryByLabelText("coupon code")).toBeNull())
    expect(screen.queryByRole("option", { name: "VIPONLY" })).toBeNull() // private coupons are not offered

    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(onSave).toHaveBeenCalledWith({
      name: "Cart rescue",
      triggerType: "CART_ABANDONED",
      triggerConfig: { delayMinutes: 15, cooldownHours: 24 },
      conditions: [{ field: "cart_value", op: "gt", value: 500 }],
      actions: [{ type: "SEND_TEMPLATE", templateId: "t9", values: {}, couponId: "cp1" }],
    })
  })

  it("cart reminder: sets the reminder gap and a normal-message fallback in three languages, and sends only the filled ones", async () => {
    api.getTemplates.mockResolvedValue({ templates: [cartTpl], counts: {}, lastSyncedAt: null, purposes: [] })
    const onSave = vi.fn()
    wrap(<WorkflowDialog open workflow={null} saving={false} onClose={vi.fn()} onSave={onSave} />)
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Cart" } })
    await screen.findByRole("option", { name: /cart_reminder/ })
    fireEvent.change(screen.getByLabelText("Send this message"), { target: { value: "t9" } })
    fireEvent.change(await screen.findByLabelText("coupon code"), { target: { value: "SAVE10" } })
    fireEvent.change(screen.getByLabelText("Remind the same customer at most once every"), { target: { value: "48" } })
    fireEvent.change(screen.getByLabelText("English"), { target: { value: "  Hi {{customer_name}} {{cart_link}}  " } })
    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      triggerConfig: { delayMinutes: 5, cooldownHours: 48 },
      actions: [expect.objectContaining({ type: "SEND_TEMPLATE", fallbackTexts: { en: "Hi {{customer_name}} {{cart_link}}" } })],
    }))
  })

  it("“Use suggested text” fills Gujarati, English and Roman Gujarati", async () => {
    wrap(<WorkflowDialog open workflow={null} saving={false} onClose={vi.fn()} onSave={vi.fn()} />)
    fireEvent.click(await screen.findByRole("button", { name: "Use suggested text" }))
    expect((screen.getByLabelText("Gujarati (ગુજરાતી)") as HTMLTextAreaElement).value).toMatch(/\{\{cart_link\}\}/)
    expect((screen.getByLabelText("English") as HTMLTextAreaElement).value).toMatch(/Complete your order/)
    expect((screen.getByLabelText("Gujarati in English letters") as HTMLTextAreaElement).value).toMatch(/Namaste/)
  })

  it("an existing workflow keeps its trigger type fixed", async () => {
    const wf: Workflow = {
      id: "w1", name: "Packed", description: null, trigger_type: "ORDER_STATUS", trigger_config: { status: "PACKED" }, conditions: [],
      actions: [{ type: "SEND_TEMPLATE", templateId: "t1", values: { offer_code: "X" } }], is_active: false, activated_at: null, created_at: "",
    }
    wrap(<WorkflowDialog open workflow={wf} saving={false} onClose={vi.fn()} onSave={vi.fn()} />)
    expect(await screen.findByLabelText("What starts this workflow")).toBeDisabled()
    expect(screen.getByText(/The trigger can’t be changed/)).toBeInTheDocument()
  })
})
