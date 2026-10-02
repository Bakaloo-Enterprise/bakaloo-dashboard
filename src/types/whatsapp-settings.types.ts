export type WaConnectionState = "NOT_CONFIGURED" | "SAVED" | "CONNECTED" | "FAILED" | "DISABLED"
export type WaCheckStatus = "pass" | "warn" | "fail" | "skip"
export type WaFieldSource = "dashboard" | "server" | null

export interface WaExplainedProblem {
  title: string
  cause: string
  fixes: string[]
  technical: { httpStatus?: number | null; code?: number | null; subcode?: number | null; type?: string | null; message?: string; fbtraceId?: string | null; network?: string | null }
  docs: string | null
}
export interface WaCheck {
  id: "credentials" | "phone" | "waba" | "templates" | "token" | "webhook" | "message"
  label: string
  status: WaCheckStatus
  summary: string
  details?: Record<string, unknown>
  problem?: WaExplainedProblem
}
export interface WaTestResult {
  ok: boolean
  level: "READY" | "PARTIAL" | "FAILED"
  headline: string
  checks: WaCheck[]
  testedAt: string
  durationMs: number
}
export interface WaSettingsView {
  state: WaConnectionState
  enabled: boolean
  enabledSource: "dashboard" | "server"
  connectedAt: string | null
  lastTestedAt: string | null
  lastTest: WaTestResult | null
  apiVersion: string
  fields: {
    phoneNumberId: { value: string | null; source: WaFieldSource }
    wabaId: { value: string | null; source: WaFieldSource }
    appId: { value: string | null; source: WaFieldSource }
    accessToken: { configured: boolean; masked: string; source: WaFieldSource }
    appSecret: { configured: boolean; masked: string; source: WaFieldSource }
    verifyToken: { configured: boolean; value: string | null; source: WaFieldSource }
  }
  webhook: { callbackUrl: string; lastReceivedAt: string | null; last7d: number }
}
export interface WaSettingsInput {
  phoneNumberId?: string
  wabaId?: string
  appId?: string
  accessToken?: string
  appSecret?: string
  verifyToken?: string
  generateVerifyToken?: boolean
  enabled?: boolean
  clear?: Array<"accessToken" | "verifyToken" | "appSecret">
}
