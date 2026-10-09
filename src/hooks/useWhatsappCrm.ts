"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  campaignAction,
  addRateCard,
  getAnalyticsBreakdown,
  getAnalyticsInbox,
  getAnalyticsOverview,
  getRateCards,
  removeRateCard,
  confirmProspectImport,
  discardProspectImport,
  getProspectImport,
  getProspectImports,
  getProspectRows,
  uploadProspectImport,
  createCampaign,
  createWorkflow,
  deleteCampaign,
  deleteWorkflow,
  getCampaign,
  getCampaignOptions,
  getCampaignRecipients,
  getCampaigns,
  getSuppressed,
  getWorkflow,
  getWorkflowCatalog,
  getWorkflows,
  launchCampaign,
  previewCampaign,
  recordConsent,
  setWorkflowActive,
  suppressContact,
  unsuppressContact,
  updateCampaign,
  updateWorkflow,
  addConversationLabel,
  assignConversation,
  bulkAssign,
  createLabel,
  deleteLabel,
  getAgents,
  getCrmMe,
  getLabels,
  getWorkload,
  getTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  submitTemplate,
  deleteTemplate,
  syncTemplates,
  getTemplateValues,
  sendTemplate,
  getBotSettings,
  saveBotSettings,
  getBotRules,
  createBotRule,
  updateBotRule,
  deleteBotRule,
  reorderBotRules,
  testBot,
  getBotActivity,
  getBotAreas,
  createBotArea,
  updateBotArea,
  deleteBotArea,
  getBotWaitingList,
  getBotProductWords,
  addBotProductWord,
  deleteBotProductWord,
  setConversationBot,
  getPipeline,
  moveCard,
  removeConversationLabel,
  updateLabel,
  getConversation,
  getConversations,
  getCrmStatus,
  getMessages,
  markConversationRead,
  sendMessage,
  sendMedia,
} from "@/services/whatsapp-crm.service"
import { qk } from "@/lib/query-keys"
import type { AnalyticsQuery, BreakdownBy, RateCategory, ProspectRowStatus, CampaignInput, CampaignStatus, WorkflowInput, TemplateFilters, TemplateFormError, TemplateInput, BotAreaInput, BotLanguage, BotRuleInput, BotSettingsInput, ConversationFilters, CrmPermission, LabelInput, PipelineBoard, PipelineFilters } from "@/types/whatsapp-crm.types"

export function errorMessage(error: unknown): string {
  const resp = (error as { response?: { data?: { message?: string } } })?.response
  if (resp?.data?.message) return resp.data.message
  if (error instanceof Error) return error.message
  return "Something went wrong"
}

export function useCrmStatus() {
  return useQuery({ queryKey: qk.crmStatus(), queryFn: getCrmStatus, staleTime: 60_000 })
}

export function useConversations(filters: ConversationFilters = {}) {
  return useQuery({
    queryKey: qk.crmConversations(filters),
    queryFn: () => getConversations(filters),
    staleTime: 10_000,
    // Safety net: the socket normally pushes new chats instantly, but if it is down (or the user's role is not
    // in the broadcast room) the list still catches up on its own.
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,
  })
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: qk.crmConversation(id ?? ""),
    queryFn: () => getConversation(id as string),
    enabled: Boolean(id),
    staleTime: 15_000,
  })
}

export function useMessages(id: string | null) {
  return useQuery({
    queryKey: qk.crmMessages(id ?? ""),
    queryFn: () => getMessages(id as string),
    enabled: Boolean(id),
    staleTime: 10_000,
    refetchInterval: 15_000,
  })
}

export function useSendMessage(conversationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: string) => sendMessage(conversationId, body),
    onError: (err) => toast.error(errorMessage(err)),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.crmMessages(conversationId) })
      qc.invalidateQueries({ queryKey: ["crm", "conversations"] })
      qc.invalidateQueries({ queryKey: qk.crmConversation(conversationId) })
    },
  })
}

export function useSendMedia(conversationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ file, caption }: { file: File; caption?: string }) => sendMedia(conversationId, file, caption),
    onError: (err) => toast.error(errorMessage(err)),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.crmMessages(conversationId) })
      qc.invalidateQueries({ queryKey: ["crm", "conversations"] })
      qc.invalidateQueries({ queryKey: qk.crmConversation(conversationId) })
    },
  })
}

export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => markConversationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "conversations"] }),
  })
}

// ─── Phase 3: access, agents, assignment, labels, workload ───────────

export function useCrmMe(enabled = true) {
  const q = useQuery({ queryKey: qk.crmMe(), queryFn: getCrmMe, enabled, staleTime: 5 * 60_000 })
  const perms = new Set<string>(q.data?.permissions ?? [])
  return { ...q, can: (p: CrmPermission) => perms.has(p) }
}

export function useAgents() {
  return useQuery({ queryKey: qk.crmAgents(), queryFn: getAgents, staleTime: 60_000 })
}

export function useLabels() {
  return useQuery({ queryKey: qk.crmLabels(), queryFn: getLabels, staleTime: 30_000 })
}

export function useWorkload(enabled = true) {
  return useQuery({ queryKey: qk.crmWorkload(), queryFn: getWorkload, enabled, staleTime: 10_000, refetchInterval: 30_000 })
}

function useInvalidateCrm() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ["crm", "conversations"] })
    qc.invalidateQueries({ queryKey: ["crm", "conversation"] })
    qc.invalidateQueries({ queryKey: qk.crmWorkload() })
    qc.invalidateQueries({ queryKey: qk.crmLabels() })
  }
}

export function useAssignConversation() {
  const invalidate = useInvalidateCrm()
  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string | null }) => assignConversation(id, userId),
    onSuccess: () => toast.success("Conversation updated"),
    onError: (err) => toast.error(errorMessage(err)),
    onSettled: invalidate,
  })
}

export function useBulkAssign() {
  const invalidate = useInvalidateCrm()
  return useMutation({
    mutationFn: ({ ids, userId }: { ids: string[]; userId: string | null }) => bulkAssign(ids, userId),
    onSuccess: (r) => {
      if (r.changed === 0) toast.info("No changes — those conversations already have that owner")
      else toast.success(`${r.changed} of ${r.requested} conversation${r.requested === 1 ? "" : "s"} reassigned`)
    },
    onError: (err) => toast.error(errorMessage(err)),
    onSettled: invalidate,
  })
}

export function useConversationLabel() {
  const invalidate = useInvalidateCrm()
  return useMutation({
    mutationFn: ({ id, labelId, add }: { id: string; labelId: string; add: boolean }) =>
      add ? addConversationLabel(id, labelId) : removeConversationLabel(id, labelId),
    onError: (err) => toast.error(errorMessage(err)),
    onSettled: invalidate,
  })
}

export function useLabelMutations() {
  const invalidate = useInvalidateCrm()
  const onError = (err: unknown) => toast.error(errorMessage(err))
  return {
    create: useMutation({
      mutationFn: (input: LabelInput) => createLabel(input),
      onSuccess: () => toast.success("Label created"),
      onError,
      onSettled: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: LabelInput }) => updateLabel(id, input),
      onSuccess: () => toast.success("Label updated"),
      onError,
      onSettled: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => deleteLabel(id),
      onSuccess: () => toast.success("Label deleted"),
      onError,
      onSettled: invalidate,
    }),
  }
}

// ─── Pipeline (Phase 4) ──────────────────────────────────────────────

export function usePipeline(filters: PipelineFilters, enabled = true) {
  return useQuery({
    queryKey: qk.crmPipeline(filters),
    queryFn: () => getPipeline(filters),
    enabled,
    staleTime: 10_000,
    placeholderData: (prev) => prev,
  })
}

/** Moves a card between stages with an optimistic update, rolling back if the server refuses. */
export function useMoveCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ contactId, stageId }: { contactId: string; stageId: string }) => moveCard(contactId, stageId),
    onMutate: async ({ contactId, stageId }) => {
      await qc.cancelQueries({ queryKey: ["crm", "pipeline"] })
      const snapshots = qc.getQueriesData<PipelineBoard>({ queryKey: ["crm", "pipeline"] })
      for (const [key, board] of snapshots) {
        if (!board) continue
        const all = [...board.stages.flatMap((s) => s.cards), ...board.unstaged]
        const card = all.find((c) => c.contact_id === contactId)
        if (!card) continue
        qc.setQueryData<PipelineBoard>(key, {
          ...board,
          unstaged: board.unstaged.filter((c) => c.contact_id !== contactId),
          stages: board.stages.map((s) => {
            const rest = s.cards.filter((c) => c.contact_id !== contactId)
            return s.id === stageId ? { ...s, cards: [{ ...card, stage_id: stageId, stage_source: "MANUAL" as const }, ...rest] } : { ...s, cards: rest }
          }),
        })
      }
      return { snapshots }
    },
    onError: (err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data))
      toast.error(errorMessage(err))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["crm", "pipeline"] }),
  })
}

// ─── Bot (Phase 5) ───────────────────────────────────────────────────

export function useBotSettings(enabled = true) {
  return useQuery({ queryKey: qk.crmBotSettings(), queryFn: getBotSettings, enabled, staleTime: 15_000 })
}
export function useBotRules(enabled = true) {
  return useQuery({ queryKey: qk.crmBotRules(), queryFn: getBotRules, enabled, staleTime: 15_000 })
}
export function useBotActivity(enabled = true) {
  return useQuery({ queryKey: qk.crmBotActivity(), queryFn: getBotActivity, enabled, staleTime: 10_000, refetchInterval: 30_000 })
}

export function useBotMutations() {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: ["crm", "bot"] })
  const onError = (err: unknown) => toast.error(errorMessage(err))
  return {
    saveSettings: useMutation({
      mutationFn: (input: BotSettingsInput) => saveBotSettings(input),
      onSuccess: () => toast.success("Bot settings saved"),
      onError,
      onSettled: refresh,
    }),
    createRule: useMutation({ mutationFn: (input: BotRuleInput) => createBotRule(input), onSuccess: () => toast.success("Rule created"), onError, onSettled: refresh }),
    updateRule: useMutation({
      mutationFn: ({ id, input }: { id: string; input: BotRuleInput }) => updateBotRule(id, input),
      onError,
      onSettled: refresh,
    }),
    deleteRule: useMutation({ mutationFn: (id: string) => deleteBotRule(id), onSuccess: () => toast.success("Rule deleted"), onError, onSettled: refresh }),
    reorder: useMutation({ mutationFn: (ids: string[]) => reorderBotRules(ids), onError, onSettled: refresh }),
    test: useMutation({
      mutationFn: ({ message, when, language, awaitingArea }: { message: string; when: "NOW" | "OPEN" | "CLOSED"; language?: BotLanguage; awaitingArea?: boolean }) => testBot(message, when, { language, awaitingArea }),
      onError,
    }),
  }
}

export function useBotAreas(enabled = true) {
  return useQuery({ queryKey: qk.crmBotAreas(), queryFn: getBotAreas, enabled, staleTime: 15_000 })
}
export function useBotWaitingList(enabled = true) {
  return useQuery({ queryKey: qk.crmBotWaiting(), queryFn: getBotWaitingList, enabled, staleTime: 15_000 })
}
export function useBotProductWords(enabled = true) {
  return useQuery({ queryKey: qk.crmBotProductWords(), queryFn: getBotProductWords, enabled, staleTime: 30_000 })
}

/** Delivery areas + product words the bot understands. */
export function useBotKnowledgeMutations() {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: ["crm", "bot"] })
  const onError = (err: unknown) => toast.error(errorMessage(err))
  return {
    createArea: useMutation({ mutationFn: (input: BotAreaInput) => createBotArea(input), onSuccess: () => toast.success("Area added"), onError, onSettled: refresh }),
    updateArea: useMutation({ mutationFn: ({ id, input }: { id: string; input: BotAreaInput }) => updateBotArea(id, input), onSuccess: () => toast.success("Area saved"), onError, onSettled: refresh }),
    deleteArea: useMutation({ mutationFn: (id: string) => deleteBotArea(id), onSuccess: () => toast.success("Area deleted"), onError, onSettled: refresh }),
    addWord: useMutation({ mutationFn: ({ alias, searchTerm }: { alias: string; searchTerm: string }) => addBotProductWord(alias, searchTerm), onSuccess: () => toast.success("Word added"), onError, onSettled: refresh }),
    deleteWord: useMutation({ mutationFn: (id: string) => deleteBotProductWord(id), onError, onSettled: refresh }),
  }
}

/** Take over from / hand back to the bot on one conversation. */
export function useSetConversationBot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, state }: { id: string; state: "BOT" | "HUMAN" }) => setConversationBot(id, state),
    onSuccess: (_d, v) => toast.success(v.state === "BOT" ? "Bot resumed for this chat" : "You have taken over this chat"),
    onError: (err) => toast.error(errorMessage(err)),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["crm", "conversations"] })
      qc.invalidateQueries({ queryKey: ["crm", "conversation"] })
    },
  })
}

// ─── Templates (Phase 6) ─────────────────────────────────────────────

/** Field-level problems the server returned for a template form (HTTP 400, code INVALID_TEMPLATE). */
export function templateFormErrors(error: unknown): TemplateFormError[] {
  const details = (error as { response?: { data?: { details?: unknown } } })?.response?.data?.details
  return Array.isArray(details) ? (details as TemplateFormError[]) : []
}

export function useTemplates(filters: TemplateFilters, enabled = true) {
  return useQuery({
    queryKey: qk.crmTemplates(filters),
    queryFn: () => getTemplates(filters),
    enabled,
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  })
}

export function useTemplate(id: string | null) {
  return useQuery({ queryKey: qk.crmTemplate(id ?? ""), queryFn: () => getTemplate(id as string), enabled: Boolean(id), staleTime: 5_000 })
}

export function useTemplateMutations() {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: ["crm", "templates"] })
  const quiet = (err: unknown) => {
    // Form validation errors are shown next to the fields; everything else becomes a toast.
    if (templateFormErrors(err).length === 0) toast.error(errorMessage(err))
  }
  return {
    create: useMutation({ mutationFn: (i: TemplateInput) => createTemplate(i), onSuccess: () => toast.success("Template saved as draft"), onError: quiet, onSettled: refresh }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: Partial<TemplateInput> }) => updateTemplate(id, input),
      onSuccess: () => toast.success("Template updated"),
      onError: quiet,
      onSettled: refresh,
    }),
    submit: useMutation({
      mutationFn: (id: string) => submitTemplate(id),
      onSuccess: () => toast.success("Sent to Meta for review. Approval usually takes minutes to a day."),
      onError: quiet,
      onSettled: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => deleteTemplate(id),
      onSuccess: (r) => toast.success(r.nameReservedDays ? `Deleted. Meta keeps this name reserved for ${r.nameReservedDays} days.` : "Template deleted"),
      onError: quiet,
      onSettled: refresh,
    }),
    sync: useMutation({
      mutationFn: () => syncTemplates(),
      onSuccess: (r) => {
        toast.success(`Synced ${r.total} template${r.total === 1 ? "" : "s"}: ${r.created} new, ${r.updated} updated${r.markedMissing ? `, ${r.markedMissing} removed at Meta` : ""}`)
        r.warnings.forEach((w) => toast.warning(w))
      },
      onError: quiet,
      onSettled: refresh,
    }),
  }
}

export function useTemplateValues(conversationId: string | null, enabled = true) {
  return useQuery({
    queryKey: qk.crmTemplateValues(conversationId ?? ""),
    queryFn: () => getTemplateValues(conversationId as string),
    enabled: Boolean(conversationId) && enabled,
    staleTime: 0,
  })
}

export function useSendTemplate(conversationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: { templateId: string; values: Record<string, string>; headerMediaUrl?: string }) => sendTemplate(conversationId, p),
    onSuccess: () => toast.success("Template sent"),
    onError: (err) => toast.error(errorMessage(err)),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.crmMessages(conversationId) })
      qc.invalidateQueries({ queryKey: ["crm", "conversations"] })
      qc.invalidateQueries({ queryKey: ["crm", "conversation"] })
    },
  })
}

// ─── Campaigns, consent, workflows (Phase 7) ─────────────────────────
const ACTIVE_CAMPAIGN: ReadonlySet<CampaignStatus> = new Set<CampaignStatus>(["SENDING", "SCHEDULED"])

export function useCampaigns(status: CampaignStatus | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.crmCampaigns({ status }),
    queryFn: () => getCampaigns(status),
    enabled,
    // Running campaigns move every few seconds; everything else is quiet.
    refetchInterval: (q) => ((q.state.data ?? []).some((c) => ACTIVE_CAMPAIGN.has(c.status)) ? 8_000 : false),
    placeholderData: (prev) => prev,
  })
}

export function useCampaign(id: string | null) {
  return useQuery({
    queryKey: qk.crmCampaign(id ?? ""),
    queryFn: () => getCampaign(id as string),
    enabled: Boolean(id),
    refetchInterval: (q) => (q.state.data && ACTIVE_CAMPAIGN.has(q.state.data.status) ? 5_000 : false),
  })
}

export function useCampaignRecipients(id: string | null, status?: string) {
  return useQuery({
    queryKey: qk.crmCampaignRecipients(id ?? "", { status }),
    queryFn: () => getCampaignRecipients(id as string, { status, limit: 100 }),
    enabled: Boolean(id),
  })
}

export function useCampaignOptions(enabled = true) {
  return useQuery({ queryKey: qk.crmCampaignOptions(), queryFn: getCampaignOptions, enabled, staleTime: 60_000 })
}

export function useCampaignMutations() {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: ["crm", "campaigns"] })
  const fail = (err: unknown) => toast.error(errorMessage(err))
  return {
    create: useMutation({ mutationFn: (i: CampaignInput) => createCampaign(i), onSuccess: () => toast.success("Campaign saved as a draft"), onError: fail, onSettled: refresh }),
    update: useMutation({ mutationFn: ({ id, input }: { id: string; input: Partial<CampaignInput> }) => updateCampaign(id, input), onSuccess: () => toast.success("Campaign updated"), onError: fail, onSettled: refresh }),
    remove: useMutation({ mutationFn: (id: string) => deleteCampaign(id), onSuccess: () => toast.success("Draft deleted"), onError: fail, onSettled: refresh }),
    preview: useMutation({ mutationFn: (id: string) => previewCampaign(id), onError: fail }),
    launch: useMutation({
      mutationFn: ({ id, scheduledAt }: { id: string; scheduledAt?: string }) => launchCampaign(id, scheduledAt),
      onSuccess: (c) => toast.success(c.status === "SCHEDULED" ? "Campaign scheduled" : "Campaign started"),
      onError: fail,
      onSettled: refresh,
    }),
    act: useMutation({
      mutationFn: ({ id, action }: { id: string; action: "pause" | "resume" | "cancel" }) => campaignAction(id, action),
      onSuccess: (c) => toast.success(`Campaign ${c.status.toLowerCase()}`),
      onError: fail,
      onSettled: refresh,
    }),
  }
}

export function useSuppressed(enabled = true) {
  return useQuery({ queryKey: qk.crmSuppression(), queryFn: getSuppressed, enabled, staleTime: 15_000 })
}

export function useConsentMutations() {
  const qc = useQueryClient()
  const fail = (err: unknown) => toast.error(errorMessage(err))
  return {
    record: useMutation({ mutationFn: (i: { phones: string[]; source: string; confirm: boolean }) => recordConsent(i), onError: fail }),
    suppress: useMutation({
      mutationFn: ({ contactId, reason }: { contactId: string; reason?: string }) => suppressContact(contactId, reason),
      onSuccess: () => toast.success("Added to the do-not-contact list"),
      onError: fail,
      onSettled: () => qc.invalidateQueries({ queryKey: qk.crmSuppression() }),
    }),
    unsuppress: useMutation({
      mutationFn: (contactId: string) => unsuppressContact(contactId),
      onSuccess: () => toast.success("Removed from the list"),
      onError: fail,
      onSettled: () => qc.invalidateQueries({ queryKey: qk.crmSuppression() }),
    }),
  }
}

export function useWorkflows(enabled = true) {
  return useQuery({ queryKey: qk.crmWorkflows(), queryFn: getWorkflows, enabled, staleTime: 10_000 })
}

export function useWorkflow(id: string | null) {
  return useQuery({ queryKey: qk.crmWorkflow(id ?? ""), queryFn: () => getWorkflow(id as string), enabled: Boolean(id), staleTime: 5_000 })
}

export function useWorkflowCatalog(enabled = true) {
  return useQuery({ queryKey: qk.crmWorkflowCatalog(), queryFn: getWorkflowCatalog, enabled, staleTime: 60_000 })
}

export function useWorkflowMutations() {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: ["crm", "workflows"] })
  const fail = (err: unknown) => toast.error(errorMessage(err))
  return {
    create: useMutation({ mutationFn: (i: WorkflowInput) => createWorkflow(i), onSuccess: () => toast.success("Workflow saved. It is switched off until you turn it on."), onError: fail, onSettled: refresh }),
    update: useMutation({ mutationFn: ({ id, input }: { id: string; input: Partial<WorkflowInput> }) => updateWorkflow(id, input), onSuccess: () => toast.success("Workflow updated"), onError: fail, onSettled: refresh }),
    activate: useMutation({
      mutationFn: ({ id, active }: { id: string; active: boolean }) => setWorkflowActive(id, active),
      onSuccess: (w) => toast.success(w.is_active ? "Workflow is ON. It reacts to new events from now on." : "Workflow is OFF"),
      onError: fail,
      onSettled: refresh,
    }),
    remove: useMutation({ mutationFn: (id: string) => deleteWorkflow(id), onSuccess: () => toast.success("Workflow deleted"), onError: fail, onSettled: refresh }),
  }
}

// ─── Prospect outreach (Phase 8) ─────────────────────────────────────
export function useProspectImports(enabled = true) {
  return useQuery({ queryKey: qk.crmProspectImports(), queryFn: getProspectImports, enabled, staleTime: 10_000 })
}

export function useProspectImport(id: string | null) {
  return useQuery({ queryKey: qk.crmProspectImport(id ?? ""), queryFn: () => getProspectImport(id as string), enabled: Boolean(id) })
}

export function useProspectRows(id: string | null, status?: ProspectRowStatus) {
  return useQuery({
    queryKey: qk.crmProspectRows(id ?? "", { status }),
    queryFn: () => getProspectRows(id as string, { status, limit: 100 }),
    enabled: Boolean(id),
  })
}

export function useProspectMutations() {
  const qc = useQueryClient()
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["crm", "prospects"] })
    qc.invalidateQueries({ queryKey: qk.crmCampaignOptions() })
  }
  const fail = (err: unknown) => toast.error(errorMessage(err))
  return {
    upload: useMutation({ mutationFn: ({ file, name }: { file: File; name?: string }) => uploadProspectImport(file, name), onError: fail, onSettled: refresh }),
    confirm: useMutation({
      mutationFn: ({ id, ...input }: { id: string; confirm: boolean; source: string; includeExisting: boolean }) => confirmProspectImport(id, input),
      onSuccess: () => toast.success("Prospects added — pick this list when you create a campaign"),
      onError: fail,
      onSettled: refresh,
    }),
    discard: useMutation({ mutationFn: (id: string) => discardProspectImport(id), onSuccess: () => toast.success("List discarded"), onError: fail, onSettled: refresh }),
  }
}

// ─── Analytics and cost (Phase 10) ───────────────────────────────────
// Reports are computed on demand; a minute of caching keeps tab switches instant without going stale.
export function useAnalyticsOverview(q: AnalyticsQuery, enabled = true) {
  return useQuery({ queryKey: qk.crmAnalyticsOverview({ ...q }), queryFn: () => getAnalyticsOverview(q), enabled, staleTime: 60_000, placeholderData: (prev) => prev })
}

export function useAnalyticsBreakdown(by: BreakdownBy, q: AnalyticsQuery, enabled = true) {
  return useQuery({ queryKey: qk.crmAnalyticsBreakdown(by, { ...q }), queryFn: () => getAnalyticsBreakdown(by, q), enabled, staleTime: 60_000, placeholderData: (prev) => prev })
}

export function useAnalyticsInbox(q: Pick<AnalyticsQuery, "from" | "to">, enabled = true) {
  return useQuery({ queryKey: qk.crmAnalyticsInbox({ ...q }), queryFn: () => getAnalyticsInbox(q), enabled, staleTime: 60_000, placeholderData: (prev) => prev })
}

export function useRateCards(enabled = true) {
  return useQuery({ queryKey: qk.crmRateCards(), queryFn: getRateCards, enabled, staleTime: 30_000 })
}

export function useRateCardMutations() {
  const qc = useQueryClient()
  // A new price changes every cost figure, so drop the cached reports too.
  const refresh = () => {
    qc.invalidateQueries({ queryKey: qk.crmRateCards() })
    qc.invalidateQueries({ queryKey: ["crm", "analytics"] })
  }
  const fail = (err: unknown) => toast.error(errorMessage(err))
  return {
    add: useMutation({
      mutationFn: (i: { category: RateCategory; rate: number; effectiveFrom: string; note?: string }) => addRateCard(i),
      onSuccess: () => toast.success("Price saved"),
      onError: fail,
      onSettled: refresh,
    }),
    remove: useMutation({ mutationFn: (id: string) => removeRateCard(id), onSuccess: () => toast.success("Price removed"), onError: fail, onSettled: refresh }),
  }
}
