import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import type { BotRule, WaConversation, WaMessage } from "@/types/whatsapp-crm.types"

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))
const testBotApi = vi.fn()
const setBotApi = vi.fn()
vi.mock("@/services/whatsapp-crm.service", async (orig) => ({
  ...(await orig<object>()),
  testBot: (...a: unknown[]) => testBotApi(...a),
  setConversationBot: (...a: unknown[]) => setBotApi(...a),
}))

import { BotRuleDialog } from "../BotRuleDialog"
import { BotTester } from "../BotTester"
import { BotStateControl, needsPerson } from "../BotStateControl"
import { MessageThread } from "../MessageThread"
import { keywordSummary, parseKeywords } from "../bot-helpers"

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
  // Radix Select needs these in jsdom
  Element.prototype.hasPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
})
beforeEach(() => {
  testBotApi.mockReset()
  setBotApi.mockReset().mockResolvedValue(undefined)
})

const wrap = (ui: ReactNode) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

const rule = (o: Partial<BotRule> = {}): BotRule => ({
  id: "r1", name: "Offers", position: 10, is_active: true, match_type: "CONTAINS", keywords: ["offer", "coupon"], exact_keywords: ["4"],
  when_hours: "ANY", action: "REPLY", reply_text: "See the app.", reply_text_gu: null, reply_text_gl: null, asks_area: false, cooldown_minutes: 0, ...o,
})

describe("bot helpers", () => {
  it("parses keywords from lines or commas, dropping blanks", () => {
    expect(parseKeywords("wholesale\n bulk order ,, \nrice")).toEqual(["wholesale", "bulk order", "rice"])
    expect(parseKeywords("  \n ")).toEqual([])
  })
  it("summarises keywords, truncating long lists and showing exact ones", () => {
    expect(keywordSummary(rule())).toBe("offer, coupon · exactly: 4")
    expect(keywordSummary(rule({ keywords: ["a1", "b1", "c1", "d1", "e1", "f1"], exact_keywords: [] }))).toBe("a1, b1, c1, d1 +2")
    expect(keywordSummary(rule({ match_type: "PINCODE", keywords: [], exact_keywords: [] }))).toBe("any 6-digit PIN code")
  })
})

describe("BotRuleDialog", () => {
  it("Save is disabled until name, a keyword and a reply are filled", () => {
    const onSave = vi.fn()
    render(<BotRuleDialog open rule={null} saving={false} onClose={vi.fn()} onSave={onSave} />)
    const save = screen.getByRole("button", { name: "Save rule" })
    expect(save).toBeDisabled()
    fireEvent.change(screen.getByLabelText("Rule name"), { target: { value: "Wholesale" } })
    fireEvent.change(screen.getByLabelText(/Words or phrases/), { target: { value: "wholesale\nbulk order" } })
    expect(save).toBeDisabled() // still no reply
    fireEvent.change(screen.getByLabelText("Reply in English"), { target: { value: "Our team will call you." } })
    expect(save).toBeEnabled()
  })

  it("submits trimmed, parsed values", () => {
    const onSave = vi.fn()
    render(<BotRuleDialog open rule={null} saving={false} onClose={vi.fn()} onSave={onSave} />)
    fireEvent.change(screen.getByLabelText("Rule name"), { target: { value: "  Wholesale  " } })
    fireEvent.change(screen.getByLabelText(/Words or phrases/), { target: { value: "wholesale, bulk order" } })
    fireEvent.change(screen.getByLabelText(/Exact replies/), { target: { value: "7" } })
    fireEvent.change(screen.getByLabelText("Reply in English"), { target: { value: "  Hi {{customer_name}}  " } })
    fireEvent.change(screen.getByLabelText(/Reply in Gujarati \(/), { target: { value: "  નમસ્તે  " } })
    fireEvent.change(screen.getByLabelText(/Don’t repeat/), { target: { value: "30" } })
    fireEvent.click(screen.getByRole("button", { name: "Save rule" }))
    expect(onSave).toHaveBeenCalledWith({
      name: "Wholesale", matchType: "CONTAINS", keywords: ["wholesale", "bulk order"], exactKeywords: ["7"],
      whenHours: "ANY", action: "REPLY", replyText: "Hi {{customer_name}}", replyTextGu: "નમસ્તે", replyTextGl: null, asksArea: false, cooldownMinutes: 30,
    })
  })

  it("prefills when editing and inserts a variable at the end of the reply", () => {
    render(<BotRuleDialog open rule={rule()} saving={false} onClose={vi.fn()} onSave={vi.fn()} />)
    expect((screen.getByLabelText("Rule name") as HTMLInputElement).value).toBe("Offers")
    expect((screen.getByLabelText(/Words or phrases/) as HTMLTextAreaElement).value).toBe("offer\ncoupon")
    fireEvent.click(screen.getByRole("button", { name: "{{customer_name}}" }))
    expect((screen.getByLabelText("Reply in English") as HTMLTextAreaElement).value).toBe("See the app.{{customer_name}}")
  })

  it("a PIN-code rule needs no keywords", () => {
    render(<BotRuleDialog open rule={rule({ match_type: "PINCODE", keywords: [], exact_keywords: [], reply_text: "{{pincode_result}}" })} saving={false} onClose={vi.fn()} onSave={vi.fn()} />)
    expect(screen.queryByLabelText(/Words or phrases/)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save rule" })).toBeEnabled()
  })

  it("a hand-to-a-person rule needs no reply", () => {
    render(<BotRuleDialog open rule={rule({ action: "HANDOFF", reply_text: null })} saving={false} onClose={vi.fn()} onSave={vi.fn()} />)
    expect(screen.queryByLabelText("Reply in English")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save rule" })).toBeEnabled()
  })

  it("an area rule and a stay-silent rule need neither keywords nor (for silent) a reply", () => {
    const { rerender } = render(<BotRuleDialog open rule={rule({ match_type: "AREA_YES", keywords: [], exact_keywords: [] })} saving={false} onClose={vi.fn()} onSave={vi.fn()} />)
    expect(screen.queryByLabelText(/Words or phrases/)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save rule" })).toBeEnabled()
    rerender(<BotRuleDialog open rule={rule({ action: "IGNORE", reply_text: null })} saving={false} onClose={vi.fn()} onSave={vi.fn()} />)
    expect(screen.queryByLabelText("Reply in English")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save rule" })).toBeEnabled()
  })

  it("shows Saving… and blocks double submit", () => {
    render(<BotRuleDialog open rule={rule()} saving onClose={vi.fn()} onSave={vi.fn()} />)
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled()
  })
})

describe("BotTester", () => {
  it("shows the matching rule, the reply and what happens next — without sending anything", async () => {
    testBotApi.mockResolvedValue({ matched: true, isOpen: true, outcome: "HANDOFF", handoff: true, reply: "Connecting you with our team.", rule: { id: "r", name: "Talk to a person", action: "REPLY_HANDOFF" } })
    wrap(<BotTester />)
    fireEvent.change(screen.getByLabelText("Customer message to test"), { target: { value: "agent please" } })
    fireEvent.click(screen.getByRole("button", { name: "Test" }))
    await waitFor(() => expect(screen.getByText("Rule: Talk to a person")).toBeInTheDocument())
    expect(screen.getByText("The bot answers, then hands to a person")).toBeInTheDocument()
    expect(screen.getByText("Connecting you with our team.")).toBeInTheDocument()
    expect(testBotApi).toHaveBeenCalledWith("agent please", "NOW", { language: undefined, awaitingArea: false })
  })
  it("explains when no rule matches", async () => {
    testBotApi.mockResolvedValue({ matched: false, isOpen: false, outcome: "NO_MATCH", handoff: true, reply: null, rule: null })
    wrap(<BotTester />)
    fireEvent.change(screen.getByLabelText("Customer message to test"), { target: { value: "zzz" } })
    fireEvent.click(screen.getByRole("button", { name: "Test" }))
    await waitFor(() => expect(screen.getByText("No rule matched")).toBeInTheDocument())
    expect(screen.getByText("No rule matches: handed to a person")).toBeInTheDocument()
    expect(screen.getByText("The bot would send no message.")).toBeInTheDocument()
  })
  it("shows the detected language and area, and can force a language", async () => {
    testBotApi.mockResolvedValue({ matched: true, isOpen: true, outcome: "REPLIED", handoff: false, reply: "જણાવવા બદલ આભાર", rule: { id: "r", name: "Area we do not deliver to (yet)", action: "REPLY" }, language: "gu", area: { name: "Amroli", serviceable: false }, product: null })
    wrap(<BotTester />)
    fireEvent.change(screen.getByLabelText("Customer message to test"), { target: { value: "Amroli" } })
    fireEvent.click(screen.getByLabelText("Pretend we just asked “which area are you in?”".replace(/^/, "")) )
    fireEvent.click(screen.getByRole("button", { name: "Test" }))
    await waitFor(() => expect(screen.getByText(/Language: Gujarati/)).toBeInTheDocument())
    expect(screen.getByText(/Area: Amroli \(we do not deliver\)/)).toBeInTheDocument()
    expect(testBotApi).toHaveBeenCalledWith("Amroli", "NOW", { language: undefined, awaitingArea: true })
  })
  it("Test is disabled for an empty message", () => {
    wrap(<BotTester />)
    expect(screen.getByRole("button", { name: "Test" })).toBeDisabled()
  })
})

describe("BotStateControl", () => {
  const c = (o = {}) => ({ id: "c1", bot_state: "BOT" as const, bot_handoff_reason: null as string | null, ...o })

  it("is hidden entirely while the bot is switched off", () => {
    const { container } = wrap(<BotStateControl conversation={c()} botEnabled={false} canControl />)
    expect(container).toBeEmptyDOMElement()
  })
  it("bot active → offers Take over", async () => {
    wrap(<BotStateControl conversation={c()} botEnabled canControl />)
    expect(screen.getByText("Bot active")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Take over" }))
    await waitFor(() => expect(setBotApi).toHaveBeenCalledWith("c1", "HUMAN"))
  })
  it("with the team → offers Resume bot", async () => {
    wrap(<BotStateControl conversation={c({ bot_state: "HUMAN", bot_handoff_reason: "AGENT_REPLIED" })} botEnabled canControl />)
    expect(screen.getByText("With team")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Resume bot" }))
    await waitFor(() => expect(setBotApi).toHaveBeenCalledWith("c1", "BOT"))
  })
  it("flags a customer waiting for a person, and view-only users get no button", () => {
    wrap(<BotStateControl conversation={c({ bot_state: "HUMAN", bot_handoff_reason: "NO_MATCH" })} botEnabled canControl={false} />)
    expect(screen.getByText("Needs a person")).toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })
  it("needsPerson is true only for customer-waiting reasons", () => {
    const n = (bot_state: "BOT" | "HUMAN", bot_handoff_reason: string | null) => needsPerson({ bot_state, bot_handoff_reason })
    expect(n("HUMAN", "NO_MATCH")).toBe(true)
    expect(n("HUMAN", "REQUESTED")).toBe(true)
    expect(n("HUMAN", "MEDIA")).toBe(true)
    expect(n("HUMAN", "AGENT_REPLIED")).toBe(false) // an agent already has it
    expect(n("HUMAN", "MANUAL")).toBe(false)
    expect(n("BOT", "NO_MATCH")).toBe(false)
  })
})

describe("Bot messages in the thread", () => {
  const conv = { id: "c1", window_open: true, last_inbound_at: new Date().toISOString(), customer_name: null, profile_name: "Rahul", phone: "9876543210", wa_username: null, bsuid: null } as unknown as WaConversation
  const msg = (o: Partial<WaMessage>): WaMessage => ({
    id: "m", direction: "OUTBOUND", wamid: "w", msg_type: "text", body: "hi", media: null, interactive: null, template_name: null, status: "SENT",
    error_code: null, error_title: null, error_details: null, sent_by: null, is_bot: false, created_at: "2026-10-02T10:00:00Z", delivered_at: null, read_at: null, ...o,
  })
  it("labels automatic replies so staff can tell them from a person", () => {
    render(<MessageThread conversation={conv} messages={[msg({ id: "a", body: "Auto hello", is_bot: true }), msg({ id: "b", body: "Human hello" })]} isLoading={false} onSend={vi.fn()} sending={false} />)
    expect(screen.getAllByText("Auto-reply (bot)")).toHaveLength(1)
  })
})
