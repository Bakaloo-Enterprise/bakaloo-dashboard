import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import type { PipelineBoard, PipelineCard, PipelineStage } from "@/types/whatsapp-crm.types"

const push = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }))
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))
const moveCardApi = vi.fn()
vi.mock("@/services/whatsapp-crm.service", async (orig) => ({ ...(await orig<object>()), moveCard: (...a: unknown[]) => moveCardApi(...a) }))

import { PipelineBoardView } from "../PipelineBoard"
import { PipelineCardView } from "../PipelineCardView"
import { formatWait } from "../pipeline-helpers"
import { useMoveCard } from "@/hooks/useWhatsappCrm"
import { toast } from "sonner"

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})
beforeEach(() => {
  push.mockClear()
  moveCardApi.mockReset()
})

const card = (over: Partial<PipelineCard> = {}): PipelineCard => ({
  contact_id: "ct1", conversation_id: "cv1", profile_name: "Mita Paul", phone: "9876543210", wa_username: null, bsuid: null,
  source: "META_AD", stage_id: "s-first", stage_source: "AUTO", customer_id: "u1", customer_name: null,
  assigned_to: "a1", assigned_name: "Sayan", unread_count: 0, last_message_at: "2026-10-02T10:00:00Z", last_message_direction: "INBOUND",
  window_open: true, order_count: 2, total_spend: 1240, open_cart_value: 1240, is_b2b: false, is_vip: true, labels: [],
  priority: "HIGH", score: 80, nextAction: "REPLY_NOW", waitingMinutes: 8, ...over,
})
const stage = (id: string, name: string, over: Partial<PipelineStage> = {}): PipelineStage => ({ id, key: id, name, position: 1, is_auto: true, color: "#2563EB", cards: [], ...over })
const board = (): PipelineBoard => ({
  stages: [
    stage("s-lead", "WhatsApp Lead"),
    stage("s-first", "1st Order", { cards: [card()] }),
    stage("s-follow", "Needs Follow-up", { is_auto: false, color: "#DC2626" }),
  ],
  unstaged: [],
  truncated: false,
})

describe("PipelineCardView", () => {
  it("shows name, source, orders, open cart, waiting time, owner, priority and next action", () => {
    render(<PipelineCardView card={card()} />)
    expect(screen.getByText("Mita Paul")).toBeInTheDocument()
    expect(screen.getByText("Meta Ad")).toBeInTheDocument()
    expect(screen.getByText("2")).toBeInTheDocument()
    expect(screen.getByText(/1,240/)).toBeInTheDocument()
    expect(screen.getByText("8 min")).toBeInTheDocument()
    expect(screen.getByText("Owner: Sayan")).toBeInTheDocument()
    expect(screen.getByText("High priority")).toBeInTheDocument()
    expect(screen.getByText("Next: Reply now")).toBeInTheDocument()
  })
  it("a quiet normal-priority card shows no priority or next-action noise", () => {
    render(<PipelineCardView card={card({ priority: "NORMAL", nextAction: "NO_ACTION", waitingMinutes: 0, open_cart_value: 0, assigned_name: null })} />)
    expect(screen.queryByText(/priority/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Next:/)).not.toBeInTheDocument()
    expect(screen.getByText("Unassigned")).toBeInTheDocument()
  })
  it("formats waiting time compactly", () => {
    expect([0, 8, 59, 60, 150, 1500].map(formatWait)).toEqual(["now", "8 min", "59 min", "1 h", "2 h", "1 d"])
  })
})

describe("PipelineBoardView", () => {
  it("renders every stage with its count and marks human-only stages", () => {
    render(<PipelineBoardView board={board()} canMove onMove={vi.fn()} />)
    expect(screen.getByRole("region", { name: "1st Order, 1 customers" })).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "WhatsApp Lead, 0 customers" })).toBeInTheDocument()
    const manual = screen.getByRole("region", { name: /Needs Follow-up/ })
    expect(manual.querySelector('[aria-label="Manual stage"]')).toBeTruthy()
    expect(screen.getByRole("region", { name: /1st Order/ }).querySelector('[aria-label="Manual stage"]')).toBeNull()
  })
  it("clicking a card opens that conversation in the inbox", () => {
    render(<PipelineBoardView board={board()} canMove onMove={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: /Mita Paul — open conversation/ }))
    expect(push).toHaveBeenCalledWith("/whatsapp-crm/inbox?conversation=cv1")
  })
  it("cards are keyboard-reachable and announce how to move them", () => {
    render(<PipelineBoardView board={board()} canMove onMove={vi.fn()} />)
    const c = screen.getByRole("button", { name: /Mita Paul/ })
    expect(c).toHaveAttribute("tabindex", "0")
    expect(c.getAttribute("aria-label")).toMatch(/space to pick up/i)
  })
  it("without move permission the hint is gone (read-only) but opening still works", () => {
    render(<PipelineBoardView board={board()} canMove={false} onMove={vi.fn()} />)
    const c = screen.getByRole("button", { name: /Mita Paul/ })
    expect(c.getAttribute("aria-label")).not.toMatch(/pick up/i)
    fireEvent.click(c)
    expect(push).toHaveBeenCalled()
  })
  it("shows a 'New' column only when there are unstaged cards", () => {
    const b = board()
    const { rerender } = render(<PipelineBoardView board={b} canMove onMove={vi.fn()} />)
    expect(screen.queryByRole("region", { name: /not staged yet/i })).not.toBeInTheDocument()
    rerender(<PipelineBoardView board={{ ...b, unstaged: [card({ contact_id: "ct9", profile_name: "Brand New" })] }} canMove onMove={vi.fn()} />)
    expect(screen.getByText("Brand New")).toBeInTheDocument()
  })
})

describe("useMoveCard — optimistic update and rollback", () => {
  const setup = () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    qc.setQueryData(["crm", "pipeline", {}], board())
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    return { qc, ...renderHook(() => useMoveCard(), { wrapper }) }
  }
  const stageOf = (qc: QueryClient, id: string) => qc.getQueryData<PipelineBoard>(["crm", "pipeline", {}])!.stages.find((s) => s.id === id)!

  it("moves the card in the cache immediately and marks it MANUAL", async () => {
    let release: () => void = () => {}
    moveCardApi.mockImplementation(() => new Promise((res) => { release = () => res({ changed: true, stageId: "s-follow" }) }))
    const { qc, result } = setup()
    act(() => result.current.mutate({ contactId: "ct1", stageId: "s-follow" }))
    await waitFor(() => expect(stageOf(qc, "s-follow").cards).toHaveLength(1))
    expect(stageOf(qc, "s-first").cards).toHaveLength(0)
    expect(stageOf(qc, "s-follow").cards[0].stage_source).toBe("MANUAL")
    release()
  })

  it("rolls the card back and shows the server's message when the move is refused", async () => {
    moveCardApi.mockRejectedValue({ response: { data: { message: "Customer not found" } } })
    const { qc, result } = setup()
    act(() => result.current.mutate({ contactId: "ct1", stageId: "s-follow" }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Customer not found"))
    await waitFor(() => expect(stageOf(qc, "s-first").cards).toHaveLength(1))
    expect(stageOf(qc, "s-follow").cards).toHaveLength(0)
  })
})
