import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import type { ProspectImport } from "@/types/whatsapp-crm.types"

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

const api = { getProspectImport: vi.fn(), getProspectRows: vi.fn(), confirmProspectImport: vi.fn(), discardProspectImport: vi.fn() }
vi.mock("@/services/whatsapp-crm.service", async (orig) => ({
  ...(await orig<object>()),
  getProspectImport: (...a: unknown[]) => api.getProspectImport(...a),
  getProspectRows: (...a: unknown[]) => api.getProspectRows(...a),
  confirmProspectImport: (...a: unknown[]) => api.confirmProspectImport(...a),
  discardProspectImport: (...a: unknown[]) => api.discardProspectImport(...a),
}))

import { ProspectPreview } from "../ProspectPreview"
import { fileProblem, reachableCount } from "../prospect-helpers"

const imp = (o: Partial<ProspectImport> = {}): ProspectImport => ({
  id: "i1", name: "Kolkata shops", filename: "k.csv", status: "PREVIEW", total_rows: 6, consent_source: null, include_existing: false,
  created_at: "", confirmed_at: null, counts: { NEW: 3, EXISTING_CUSTOMER: 1, INVALID: 1, OPTED_OUT: 1 },
  columns: { phone: "Mobile", name: "Name", business: null }, ...o,
})
const wrap = (ui: ReactNode) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>)

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset())
  api.getProspectImport.mockResolvedValue(imp())
  api.getProspectRows.mockResolvedValue([{ id: "r1", row_number: 2, name: "Ravi", business_name: null, phone_raw: "98765 43210", wa_id: "919876543210", status: "NEW", selected: false }])
})

describe("prospect helpers", () => {
  it("counts reachable rows like the server", () => {
    expect(reachableCount({ NEW: 3, EXISTING_CONTACT: 2, EXISTING_CUSTOMER: 4, OPTED_OUT: 9 }, false)).toBe(5)
    expect(reachableCount({ NEW: 3, EXISTING_CONTACT: 2, EXISTING_CUSTOMER: 4 }, true)).toBe(9)
  })
  it("checks the file before upload", () => {
    expect(fileProblem({ name: "a.pdf", size: 10 })).toMatch(/csv or .xlsx/)
    expect(fileProblem({ name: "a.csv", size: 6 * 1024 * 1024 })).toMatch(/5 MB/)
    expect(fileProblem({ name: "a.CSV", size: 10 })).toBeNull()
  })
})

describe("ProspectPreview", () => {
  it("shows the result of each row and which column was used", async () => {
    wrap(<ProspectPreview id="i1" canManage onDone={() => {}} />)
    expect(await screen.findByText("Ravi")).toBeTruthy()
    expect(screen.getByText(/Using column “Mobile”/)).toBeTruthy()
    expect(screen.getByRole("tab", { name: /Opted out 1/ })).toBeTruthy()
  })

  it("keeps Add disabled until a source is given and consent is confirmed", async () => {
    wrap(<ProspectPreview id="i1" canManage onDone={() => {}} />)
    const add = await screen.findByRole("button", { name: "Add 3 prospects" })
    expect((add as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText("Where did they agree?"), { target: { value: "trade show" } })
    expect((add as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByLabelText(/I confirm these people agreed/))
    expect((add as HTMLButtonElement).disabled).toBe(false)
  })

  it("adds existing customers to the count only when asked, and sends the attestation", async () => {
    api.confirmProspectImport.mockResolvedValue(imp({ status: "CONFIRMED" }))
    wrap(<ProspectPreview id="i1" canManage onDone={() => {}} />)
    await screen.findByRole("button", { name: "Add 3 prospects" })
    fireEvent.click(screen.getByLabelText(/Also include the 1 existing/))
    fireEvent.change(screen.getByLabelText("Where did they agree?"), { target: { value: "trade show" } })
    fireEvent.click(screen.getByLabelText(/I confirm these people agreed/))
    fireEvent.click(screen.getByRole("button", { name: "Add 4 prospects" }))
    await waitFor(() => expect(api.confirmProspectImport).toHaveBeenCalledWith("i1", { confirm: true, source: "trade show", includeExisting: true }))
  })

  it("shows no confirm form to someone who cannot manage, or once confirmed", async () => {
    const { unmount } = wrap(<ProspectPreview id="i1" canManage={false} onDone={() => {}} />)
    await screen.findByText("Ravi")
    expect(screen.queryByLabelText("Where did they agree?")).toBeNull()
    unmount()
    api.getProspectImport.mockResolvedValue(imp({ status: "CONFIRMED", consent_source: "PROSPECT_TRADE_SHOW" }))
    wrap(<ProspectPreview id="i1" canManage onDone={() => {}} />)
    expect(await screen.findByRole("status")).toBeTruthy()
    expect(screen.queryByLabelText("Where did they agree?")).toBeNull()
  })
})
