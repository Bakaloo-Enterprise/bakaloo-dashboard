import api from "@/lib/api"
import type { WaConnectRepliesResult, WaSettingsInput, WaSettingsView, WaTestResult } from "@/types/whatsapp-settings.types"
import type { ApiResponse } from "@/types/api.types"
import type {
  AudienceOptions,
  AudiencePreview,
  Campaign,
  CampaignInput,
  CampaignRecipient,
  CampaignStatus,
  ConsentResult,
  AnalyticsOverview,
  AnalyticsQuery,
  BreakdownBy,
  BreakdownRow,
  InboxReport,
  RateCards,
  RateCategory,
  ProspectImport,
  ProspectRow,
  ProspectRowStatus,
  SuppressedContact,
  Workflow,
  WorkflowCatalog,
  WorkflowInput,
  ConversationFilters,
  CrmAgent,
  CrmMe,
  BotEvent,
  BotRule,
  BotRuleInput,
  BotSettings,
  BotSettingsInput,
  BotTestResult,
  LabelInput,
  TemplateDetail,
  TemplateFilters,
  TemplateInput,
  TemplateListResponse,
  TemplateSyncResult,
  WaTemplate,
  PipelineBoard,
  PipelineFilters,
  WaLabel,
  WorkloadResponse,
  WaConfigStatus,
  WaConversation,
  WaConversationDetail,
  WaMessage,
} from "@/types/whatsapp-crm.types"

const BASE = "/admin/crm"

export async function getCrmStatus() {
  const { data } = await api.get<ApiResponse<WaConfigStatus>>(`${BASE}/status`)
  return data.data
}

/** WhatsApp history with a Bakaloo customer (nothing is created). `restricted` = the chat belongs to another agent. */
export async function getCustomerThread(userId: string) {
  const { data } = await api.get<ApiResponse<{ conversation: WaConversation | null; messages: WaMessage[]; restricted: boolean }>>(`${BASE}/customers/${userId}/thread`)
  return data.data
}

/** Find or create the customer's WhatsApp conversation so they can be messaged from their profile. */
export async function openCustomerConversation(userId: string) {
  const { data } = await api.post<ApiResponse<WaConversation>>(`${BASE}/customers/${userId}/conversation`)
  return data.data
}

// ─── Connection settings (WhatsApp CRM → Settings) ───
export async function getWaSettings() {
  const { data } = await api.get<ApiResponse<WaSettingsView>>(`${BASE}/settings`)
  return data.data
}
export async function saveWaSettings(input: WaSettingsInput) {
  const { data } = await api.put<ApiResponse<{ savedFields: string[]; credentialsChanged: boolean }>>(`${BASE}/settings`, input)
  return data.data
}
export async function testWaSettings(sendTo?: string) {
  const { data } = await api.post<ApiResponse<WaTestResult>>(`${BASE}/settings/test`, sendTo ? { sendTo } : {})
  return data.data
}
export async function connectWaReplies() {
  const { data } = await api.post<ApiResponse<WaConnectRepliesResult>>(`${BASE}/settings/connect-replies`, {})
  return data.data
}
export async function enableWaSettings(enabled: boolean) {
  const { data } = await api.post<ApiResponse<{ enabled: boolean }>>(`${BASE}/settings/enable`, { enabled })
  return data.data
}
export async function clearWaSettings() {
  const { data } = await api.delete<ApiResponse<object>>(`${BASE}/settings/credentials`)
  return data.data
}

export async function getConversations(filters: ConversationFilters = {}) {
  const params: Record<string, unknown> = {}
  if (filters.status) params.status = filters.status
  if (filters.search) params.search = filters.search
  if (filters.assignedTo) params.assignedTo = filters.assignedTo
  if (filters.labelId) params.labelId = filters.labelId
  if (filters.limit) params.limit = filters.limit
  if (filters.offset) params.offset = filters.offset
  const { data } = await api.get<ApiResponse<WaConversation[]>>(`${BASE}/conversations`, { params })
  return Array.isArray(data.data) ? data.data : []
}

export async function getConversation(id: string) {
  const { data } = await api.get<ApiResponse<WaConversationDetail>>(`${BASE}/conversations/${id}`)
  return data.data
}

export async function getMessages(id: string) {
  const { data } = await api.get<ApiResponse<WaMessage[]>>(`${BASE}/conversations/${id}/messages`, {
    params: { limit: 100 },
  })
  return Array.isArray(data.data) ? data.data : []
}

export async function sendMessage(id: string, body: string) {
  const { data } = await api.post<ApiResponse<WaMessage>>(`${BASE}/conversations/${id}/messages`, { body })
  return data.data
}

export async function markConversationRead(id: string) {
  await api.post(`${BASE}/conversations/${id}/read`, {})
}

export async function getCrmMe() {
  const { data } = await api.get<ApiResponse<CrmMe>>(`${BASE}/me`)
  return data.data
}

export async function getAgents() {
  const { data } = await api.get<ApiResponse<CrmAgent[]>>(`${BASE}/agents`)
  return Array.isArray(data.data) ? data.data : []
}

export async function getWorkload() {
  const { data } = await api.get<ApiResponse<WorkloadResponse>>(`${BASE}/workload`)
  return data.data
}

/** userId = null unassigns. */
export async function assignConversation(id: string, userId: string | null) {
  const { data } = await api.post<ApiResponse<WaConversationDetail>>(`${BASE}/conversations/${id}/assign`, { userId })
  return data.data
}

export async function bulkAssign(conversationIds: string[], userId: string | null) {
  const { data } = await api.post<ApiResponse<{ requested: number; changed: number }>>(`${BASE}/conversations/bulk-assign`, {
    conversationIds,
    userId,
  })
  return data.data
}

export async function getLabels() {
  const { data } = await api.get<ApiResponse<WaLabel[]>>(`${BASE}/labels`)
  return Array.isArray(data.data) ? data.data : []
}

export async function createLabel(input: LabelInput) {
  const { data } = await api.post<ApiResponse<WaLabel>>(`${BASE}/labels`, input)
  return data.data
}

export async function updateLabel(id: string, input: LabelInput) {
  const { data } = await api.patch<ApiResponse<WaLabel>>(`${BASE}/labels/${id}`, input)
  return data.data
}

export async function deleteLabel(id: string) {
  await api.delete(`${BASE}/labels/${id}`)
}

export async function addConversationLabel(id: string, labelId: string) {
  const { data } = await api.post<ApiResponse<WaConversationDetail>>(`${BASE}/conversations/${id}/labels`, { labelId })
  return data.data
}

export async function removeConversationLabel(id: string, labelId: string) {
  const { data } = await api.delete<ApiResponse<WaConversationDetail>>(`${BASE}/conversations/${id}/labels/${labelId}`)
  return data.data
}

export async function getPipeline(filters: PipelineFilters = {}) {
  const params: Record<string, unknown> = {}
  if (filters.assignedTo) params.assignedTo = filters.assignedTo
  if (filters.labelId) params.labelId = filters.labelId
  if (filters.b2b) params.b2b = filters.b2b
  if (filters.search) params.search = filters.search
  const { data } = await api.get<ApiResponse<PipelineBoard>>(`${BASE}/pipeline`, { params })
  return data.data
}

export async function moveCard(contactId: string, stageId: string) {
  const { data } = await api.post<ApiResponse<{ changed: boolean; stageId: string }>>(
    `${BASE}/pipeline/contacts/${contactId}/stage`,
    { stageId },
  )
  return data.data
}

export async function getBotSettings() {
  const { data } = await api.get<ApiResponse<BotSettings>>(`${BASE}/bot/settings`)
  return data.data
}
export async function saveBotSettings(input: BotSettingsInput) {
  const { data } = await api.put<ApiResponse<BotSettings>>(`${BASE}/bot/settings`, input)
  return data.data
}
export async function getBotRules() {
  const { data } = await api.get<ApiResponse<BotRule[]>>(`${BASE}/bot/rules`)
  return Array.isArray(data.data) ? data.data : []
}
export async function createBotRule(input: BotRuleInput) {
  const { data } = await api.post<ApiResponse<BotRule>>(`${BASE}/bot/rules`, input)
  return data.data
}
export async function updateBotRule(id: string, input: BotRuleInput) {
  const { data } = await api.patch<ApiResponse<BotRule>>(`${BASE}/bot/rules/${id}`, input)
  return data.data
}
export async function deleteBotRule(id: string) {
  await api.delete(`${BASE}/bot/rules/${id}`)
}
export async function reorderBotRules(ids: string[]) {
  const { data } = await api.post<ApiResponse<BotRule[]>>(`${BASE}/bot/rules/reorder`, { ids })
  return data.data
}
export async function testBot(message: string, when: "NOW" | "OPEN" | "CLOSED") {
  const { data } = await api.post<ApiResponse<BotTestResult>>(`${BASE}/bot/test`, { message, when })
  return data.data
}
export async function getBotActivity() {
  const { data } = await api.get<ApiResponse<BotEvent[]>>(`${BASE}/bot/activity`, { params: { limit: 30 } })
  return Array.isArray(data.data) ? data.data : []
}
export async function setConversationBot(id: string, state: "BOT" | "HUMAN") {
  await api.post(`${BASE}/conversations/${id}/bot`, { state })
}

// ─── Templates (Phase 6) ─────────────────────────────────────────────
export async function getTemplates(filters: TemplateFilters = {}) {
  const params: Record<string, unknown> = {}
  if (filters.status) params.status = filters.status
  if (filters.metaCategory) params.metaCategory = filters.metaCategory
  if (filters.purpose) params.purpose = filters.purpose
  if (filters.search) params.search = filters.search
  const { data } = await api.get<ApiResponse<TemplateListResponse>>(`${BASE}/templates`, { params })
  return data.data
}
export async function getTemplate(id: string) {
  const { data } = await api.get<ApiResponse<TemplateDetail>>(`${BASE}/templates/${id}`)
  return data.data
}
export async function createTemplate(input: TemplateInput) {
  const { data } = await api.post<ApiResponse<{ template: WaTemplate; warnings: string[] }>>(`${BASE}/templates`, input)
  return data.data
}
export async function updateTemplate(id: string, input: Partial<TemplateInput>) {
  const { data } = await api.patch<ApiResponse<{ template: WaTemplate; warnings: string[] }>>(`${BASE}/templates/${id}`, input)
  return data.data
}
export async function submitTemplate(id: string) {
  const { data } = await api.post<ApiResponse<WaTemplate>>(`${BASE}/templates/${id}/submit`, {})
  return data.data
}
export async function deleteTemplate(id: string) {
  const { data } = await api.delete<ApiResponse<{ deleted: boolean; remote: boolean; nameReservedDays?: number }>>(`${BASE}/templates/${id}`)
  return data.data
}
export async function syncTemplates() {
  const { data } = await api.post<ApiResponse<TemplateSyncResult>>(`${BASE}/templates/sync`, {})
  return data.data
}
export async function getTemplateValues(conversationId: string) {
  const { data } = await api.get<ApiResponse<Record<string, string>>>(`${BASE}/conversations/${conversationId}/template-values`)
  return data.data
}
export async function sendTemplate(conversationId: string, payload: { templateId: string; values: Record<string, string>; headerMediaUrl?: string }) {
  const { data } = await api.post<ApiResponse<WaMessage>>(`${BASE}/conversations/${conversationId}/templates/send`, payload)
  return data.data
}

// ─── Campaigns, consent, workflows (Phase 7) ─────────────────────────
export async function getCampaigns(status?: CampaignStatus) {
  const { data } = await api.get<ApiResponse<Campaign[]>>(`${BASE}/campaigns`, { params: status ? { status } : {} })
  return data.data
}
export async function getCampaign(id: string) {
  const { data } = await api.get<ApiResponse<Campaign>>(`${BASE}/campaigns/${id}`)
  return data.data
}
export async function getCampaignOptions() {
  const { data } = await api.get<ApiResponse<AudienceOptions>>(`${BASE}/campaigns/options`)
  return data.data
}
export async function createCampaign(input: CampaignInput) {
  const { data } = await api.post<ApiResponse<Campaign>>(`${BASE}/campaigns`, input)
  return data.data
}
export async function updateCampaign(id: string, input: Partial<CampaignInput>) {
  const { data } = await api.patch<ApiResponse<Campaign>>(`${BASE}/campaigns/${id}`, input)
  return data.data
}
export async function deleteCampaign(id: string) {
  await api.delete(`${BASE}/campaigns/${id}`)
}
export async function previewCampaign(id: string) {
  const { data } = await api.post<ApiResponse<AudiencePreview>>(`${BASE}/campaigns/${id}/preview`, {})
  return data.data
}
export async function launchCampaign(id: string, scheduledAt?: string) {
  const { data } = await api.post<ApiResponse<Campaign>>(`${BASE}/campaigns/${id}/launch`, scheduledAt ? { scheduledAt } : {})
  return data.data
}
export async function campaignAction(id: string, action: "pause" | "resume" | "cancel") {
  const { data } = await api.post<ApiResponse<Campaign>>(`${BASE}/campaigns/${id}/${action}`, {})
  return data.data
}
export async function getCampaignRecipients(id: string, params: { status?: string; limit?: number; offset?: number } = {}) {
  const { data } = await api.get<ApiResponse<CampaignRecipient[]>>(`${BASE}/campaigns/${id}/recipients`, { params })
  return data.data
}
export async function recordConsent(input: { phones: string[]; source: string; confirm: boolean }) {
  const { data } = await api.post<ApiResponse<ConsentResult>>(`${BASE}/consent/record`, input)
  return data.data
}
export async function getSuppressed() {
  const { data } = await api.get<ApiResponse<SuppressedContact[]>>(`${BASE}/suppression`)
  return data.data
}
export async function suppressContact(contactId: string, reason?: string) {
  await api.post(`${BASE}/suppression/${contactId}`, reason ? { reason } : {})
}
export async function unsuppressContact(contactId: string) {
  await api.delete(`${BASE}/suppression/${contactId}`)
}
export async function getWorkflows() {
  const { data } = await api.get<ApiResponse<Workflow[]>>(`${BASE}/workflows`)
  return data.data
}
export async function getWorkflow(id: string) {
  const { data } = await api.get<ApiResponse<Workflow>>(`${BASE}/workflows/${id}`)
  return data.data
}
export async function getWorkflowCatalog() {
  const { data } = await api.get<ApiResponse<WorkflowCatalog>>(`${BASE}/workflows/catalog`)
  return data.data
}
export async function createWorkflow(input: WorkflowInput) {
  const { data } = await api.post<ApiResponse<Workflow>>(`${BASE}/workflows`, input)
  return data.data
}
export async function updateWorkflow(id: string, input: Partial<WorkflowInput>) {
  const { data } = await api.patch<ApiResponse<Workflow>>(`${BASE}/workflows/${id}`, input)
  return data.data
}
export async function setWorkflowActive(id: string, active: boolean) {
  const { data } = await api.post<ApiResponse<Workflow>>(`${BASE}/workflows/${id}/activate`, { active })
  return data.data
}
export async function deleteWorkflow(id: string) {
  await api.delete(`${BASE}/workflows/${id}`)
}

// ─── Prospect outreach (Phase 8) ─────────────────────────────────────
export async function getProspectImports() {
  const { data } = await api.get<ApiResponse<ProspectImport[]>>(`${BASE}/prospects/imports`)
  return data.data
}
export async function getProspectImport(id: string) {
  const { data } = await api.get<ApiResponse<ProspectImport>>(`${BASE}/prospects/imports/${id}`)
  return data.data
}
export async function getProspectRows(id: string, params: { status?: ProspectRowStatus; limit?: number; offset?: number } = {}) {
  const { data } = await api.get<ApiResponse<ProspectRow[]>>(`${BASE}/prospects/imports/${id}/rows`, { params })
  return data.data
}
export async function uploadProspectImport(file: File, name?: string) {
  const form = new FormData()
  if (name?.trim()) form.append("name", name.trim())
  form.append("file", file)
  const { data } = await api.post<ApiResponse<ProspectImport>>(`${BASE}/prospects/imports`, form)
  return data.data
}
export async function confirmProspectImport(id: string, input: { confirm: boolean; source: string; includeExisting: boolean }) {
  const { data } = await api.post<ApiResponse<ProspectImport>>(`${BASE}/prospects/imports/${id}/confirm`, input)
  return data.data
}
export async function discardProspectImport(id: string) {
  await api.delete(`${BASE}/prospects/imports/${id}`)
}

// ─── Analytics and cost (Phase 10) ───────────────────────────────────
export async function getAnalyticsOverview(q: AnalyticsQuery) {
  const { data } = await api.get<ApiResponse<AnalyticsOverview>>(`${BASE}/analytics/overview`, { params: q })
  return data.data
}
export async function getAnalyticsBreakdown(by: BreakdownBy, q: AnalyticsQuery) {
  const { data } = await api.get<ApiResponse<{ range: AnalyticsOverview["range"]; rows: BreakdownRow[] }>>(`${BASE}/analytics/breakdown/${by}`, { params: q })
  return data.data
}
export async function getAnalyticsInbox(q: Pick<AnalyticsQuery, "from" | "to">) {
  const { data } = await api.get<ApiResponse<InboxReport>>(`${BASE}/analytics/inbox`, { params: q })
  return data.data
}
export async function getRateCards() {
  const { data } = await api.get<ApiResponse<RateCards>>(`${BASE}/rate-cards`)
  return data.data
}
export async function addRateCard(input: { category: RateCategory; rate: number; effectiveFrom: string; note?: string }) {
  const { data } = await api.post<ApiResponse<RateCards>>(`${BASE}/rate-cards`, input)
  return data.data
}
export async function removeRateCard(id: string) {
  const { data } = await api.delete<ApiResponse<RateCards>>(`${BASE}/rate-cards/${id}`)
  return data.data
}
