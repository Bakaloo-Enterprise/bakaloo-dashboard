export type ConversationStatus = "OPEN" | "PENDING" | "RESOLVED"
export type MessageDirection = "INBOUND" | "OUTBOUND"
export type MessageStatus = "RECEIVED" | "QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED"
export type MarketingConsent = "UNKNOWN" | "OPTED_IN" | "OPTED_OUT"

export interface WaConversation {
  id: string
  status: ConversationStatus
  assigned_to: string | null
  unread_count: number
  last_message_at: string | null
  last_message_preview: string | null
  last_message_direction: MessageDirection | null
  last_inbound_at: string | null
  /** True while the customer wrote within the last 24 h (free-form replies allowed). */
  window_open: boolean
  contact_id: string
  wa_id: string | null
  phone: string | null
  bsuid: string | null
  wa_username: string | null
  profile_name: string | null
  source: "ORGANIC" | "META_AD" | "IMPORT" | "APP"
  marketing_consent: MarketingConsent
  /** Existing Bakaloo customer, or null when the number/username is not matched. */
  customer_id: string | null
  customer_name: string | null
  assigned_name: string | null
  labels: WaLabelRef[]
  bot_state: "BOT" | "HUMAN"
  bot_paused_until: string | null
  bot_handoff_reason: string | null
}

export interface WaConversationDetail extends WaConversation {
  referral: {
    source_url?: string
    source_type?: string
    source_id?: string
    headline?: string
    body?: string
  } | null
}

export interface WaMessage {
  id: string
  direction: MessageDirection
  wamid: string | null
  msg_type: string
  body: string | null
  media: Record<string, unknown> | null
  interactive: Record<string, unknown> | null
  template_name: string | null
  status: MessageStatus
  error_code: number | null
  error_title: string | null
  error_details: string | null
  sent_by: string | null
  is_bot: boolean
  created_at: string
  delivered_at: string | null
  read_at: string | null
}

export interface ConversationFilters {
  status?: ConversationStatus
  /** a user id, "me" or "unassigned" */
  assignedTo?: string
  labelId?: string
  search?: string
  limit?: number
  offset?: number
}

export interface WaConfigStatus {
  enabled: boolean
  apiVersion: string
  configured: {
    phoneNumberId: boolean
    wabaId: boolean
    accessToken: boolean
    verifyToken: boolean
    appSecret: boolean
  }
  webhookPath: string
  botEnabled: boolean
  /** WhatsApp Business Account id + token are set: submit / sync / send work. */
  templatesReady: boolean
}

/** Realtime payloads emitted by the backend. */
export interface CrmMessageEvent {
  conversationId: string
  contactId: string
  newContact?: boolean
  message: WaMessage
  unreadCount?: number
}
export interface CrmStatusEvent {
  conversationId: string
  messageId: string
  wamid: string
  status: MessageStatus
}

export interface WaLabelRef {
  id: string
  name: string
  color: string
}
export interface WaLabel extends WaLabelRef {
  description: string | null
  customer_count: number
}
export interface CrmAgent {
  id: string
  name: string | null
  email: string | null
  role_name: string | null
}
export type CrmPermission =
  | "crm.inbox.view"
  | "crm.settings.manage"
  | "crm.inbox.view_all"
  | "crm.inbox.reply"
  | "crm.labels.apply"
  | "crm.labels.manage"
  | "crm.conversations.assign"
  | "crm.workload.view"
  | "crm.pipeline.view"
  | "crm.pipeline.move"
  | "crm.bot.manage"
  | "crm.templates.view"
  | "crm.templates.send"
  | "crm.templates.manage"
  | "crm.campaigns.view"
  | "crm.campaigns.manage"
  | "crm.workflows.manage"
  | "crm.analytics.view"
  | "crm.rates.manage"
export interface CrmMe {
  userId: string
  isSuper: boolean
  permissions: CrmPermission[]
}
export interface AgentWorkload {
  id: string
  name: string
  active: number
  unread: number
  awaiting_reply: number
  waiting_over_15m: number
}
export interface WorkloadResponse {
  agents: AgentWorkload[]
  unassigned: { active: number; unread: number; awaiting_reply: number }
}
export interface LabelInput {
  name?: string
  color?: string
  description?: string
}

// ─── Pipeline (Phase 4) ──────────────────────────────────────────────
export type CardPriority = "HIGH" | "MEDIUM" | "NORMAL"
export type NextAction = "REPLY_NOW" | "CALL_BACK" | "SEND_COUPON" | "ASSIGN_TO_B2B" | "NO_ACTION"

export interface PipelineCard {
  contact_id: string
  conversation_id: string
  profile_name: string | null
  phone: string | null
  wa_username: string | null
  bsuid: string | null
  source: "ORGANIC" | "META_AD" | "IMPORT" | "APP"
  stage_id: string | null
  stage_source: "AUTO" | "MANUAL"
  customer_id: string | null
  customer_name: string | null
  assigned_to: string | null
  assigned_name: string | null
  unread_count: number
  last_message_at: string | null
  last_message_direction: MessageDirection | null
  window_open: boolean
  order_count: number
  total_spend: number
  open_cart_value: number
  is_b2b: boolean
  is_vip: boolean
  labels: WaLabelRef[]
  priority: CardPriority
  score: number
  nextAction: NextAction
  waitingMinutes: number
}

export interface PipelineStage {
  id: string
  key: string
  name: string
  position: number
  is_auto: boolean
  color: string
  cards: PipelineCard[]
}

export interface PipelineBoard {
  stages: PipelineStage[]
  unstaged: PipelineCard[]
  truncated: boolean
}

export interface PipelineFilters {
  assignedTo?: string
  labelId?: string
  b2b?: "B2B" | "B2C"
  search?: string
}

// ─── Bot (Phase 5) ───────────────────────────────────────────────────
export type BotMatchType = "CONTAINS" | "EXACT" | "STARTS_WITH" | "PINCODE" | "AREA_YES" | "AREA_NO" | "AREA_ASKED" | "PRODUCT"
export type BotWhenHours = "ANY" | "OPEN" | "CLOSED"
export type BotAction = "REPLY" | "REPLY_HANDOFF" | "HANDOFF" | "OPT_OUT" | "OPT_IN" | "IGNORE"
export type BotLanguage = "en" | "gu" | "gl"

export interface BotRule {
  id: string
  name: string
  position: number
  is_active: boolean
  match_type: BotMatchType
  keywords: string[]
  exact_keywords: string[]
  when_hours: BotWhenHours
  action: BotAction
  reply_text: string | null
  reply_text_gu: string | null
  reply_text_gl: string | null
  asks_area: boolean
  cooldown_minutes: number
}

export interface BotRuleInput {
  name?: string
  matchType?: BotMatchType
  keywords?: string[]
  exactKeywords?: string[]
  whenHours?: BotWhenHours
  action?: BotAction
  replyText?: string | null
  replyTextGu?: string | null
  replyTextGl?: string | null
  asksArea?: boolean
  cooldownMinutes?: number
  isActive?: boolean
}

export interface BotSettings {
  enabled: boolean
  human_pause_minutes: number
  max_replies_per_hour: number
  fallback_enabled: boolean
  fallback_text: string
  fallback_text_gu: string | null
  fallback_text_gl: string | null
  play_store_url: string
  app_store_url: string
  website_url: string
  quote_prices: boolean
}

export interface BotSettingsInput {
  enabled?: boolean
  humanPauseMinutes?: number
  maxRepliesPerHour?: number
  fallbackEnabled?: boolean
  fallbackText?: string
  fallbackTextGu?: string
  fallbackTextGl?: string
  playStoreUrl?: string
  appStoreUrl?: string
  websiteUrl?: string
  quotePrices?: boolean
}

export interface BotTestResult {
  matched: boolean
  isOpen: boolean
  outcome: "REPLIED" | "HANDOFF" | "NO_MATCH" | "IGNORED"
  handoff: boolean
  reply: string | null
  rule: { id: string; name: string; action: BotAction } | null
  language: BotLanguage
  area: { name: string; serviceable: boolean } | null
  product: string | null
}

export interface BotArea {
  id: string
  name: string
  name_gu: string | null
  aliases: string[]
  is_serviceable: boolean
  is_active: boolean
  position: number
}

export interface BotAreaInput {
  name?: string
  nameGu?: string | null
  aliases?: string[]
  isServiceable?: boolean
  isActive?: boolean
}

export interface BotWaitingRow {
  area_id: string | null
  area: string
  is_serviceable: boolean | null
  people: number
  opted_in: number
}

export interface BotProductWord {
  id: string
  alias: string
  search_term: string
}

export interface BotEvent {
  id: string
  outcome: string
  detail: string | null
  created_at: string
  conversation_id: string
  rule_name: string | null
  contact: string | null
}

// ─── Templates (Phase 6) ─────────────────────────────────────────────
export type TemplateStatus =
  | "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "PAUSED" | "DISABLED" | "IN_APPEAL" | "PENDING_DELETION" | "ARCHIVED" | "DELETED"
export type MetaCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION"

export interface TemplateVariable {
  name: string
  example: string
  where: string
  /** Key used when sending: the name for NAMED templates, "body.1" etc. for numbered ones. */
  key?: string
}

export interface WaTemplate {
  id: string
  name: string
  language: string
  meta_category: MetaCategory
  purpose: string
  parameter_format: "NAMED" | "POSITIONAL"
  status: TemplateStatus
  components: Array<Record<string, unknown>>
  body_text: string
  header_format: string | null
  variables: TemplateVariable[]
  allow_category_change: boolean
  meta_template_id: string | null
  rejection_reason: string | null
  rejection_detail: string | null
  quality_score: "GREEN" | "YELLOW" | "RED" | "UNKNOWN" | null
  pending_category: MetaCategory | null
  pending_category_at: string | null
  flagged: boolean
  locked: boolean
  submitted_at: string | null
  last_status_at: string | null
  last_synced_at: string | null
  created_at: string
  updated_at: string
}

export interface TemplateButtonInput {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER"
  text: string
  url?: string
  phoneNumber?: string
}

export interface TemplateInput {
  name: string
  language: string
  metaCategory: MetaCategory
  purpose: string
  headerText?: string
  /** Image header: the sample uploaded to Meta (headerHandle) and its type */
  headerFormat?: "IMAGE" | "VIDEO" | "DOCUMENT"
  headerHandle?: string
  bodyText: string
  footerText?: string
  buttons?: TemplateButtonInput[]
  examples?: Record<string, string>
  allowCategoryChange?: boolean
}

export interface TemplateListResponse {
  templates: WaTemplate[]
  counts: Partial<Record<TemplateStatus, number>>
  lastSyncedAt: string | null
  purposes: Array<{ key: string; label: string }>
}

export interface TemplateEvent {
  id: string
  event: string
  detail: string | null
  source: string
  created_at: string
}

export interface TemplateDetail {
  template: WaTemplate
  events: TemplateEvent[]
  editor: { editable: boolean; reason?: string; input?: Partial<TemplateInput> }
}

export interface TemplateFormError {
  field: string
  message: string
}

export interface TemplateFilters {
  status?: TemplateStatus
  metaCategory?: MetaCategory
  purpose?: string
  search?: string
}

export interface TemplateSyncResult {
  total: number
  created: number
  updated: number
  conflicts: number
  markedMissing: number
  warnings: string[]
}

// ─── Campaigns, consent, workflows (Phase 7) ─────────────────────────
export type CampaignStatus = "DRAFT" | "SCHEDULED" | "SENDING" | "PAUSED" | "COMPLETED" | "CANCELLED"
export type AudienceType = "SEGMENT" | "LABEL" | "STAGE" | "IMPORT" | "ALL_OPTED_IN"
export interface CampaignAudience {
  type: AudienceType
  ids: string[]
}
export interface CampaignStats {
  total: number
  waiting: number
  skipped: number
  failed: number
  sent: number
  delivered: number
  read: number
  skipReasons: Array<{ reason: string; n: number }>
}
export interface Campaign {
  id: string
  name: string
  template_id: string
  template_name: string
  template_status: TemplateStatus
  template_category: MetaCategory
  template_values: Record<string, string>
  header_media_url: string | null
  header_image_source?: PictureSource | null
  audience: CampaignAudience
  status: CampaignStatus
  pause_reason: string | null
  scheduled_at: string | null
  started_at: string | null
  completed_at: string | null
  rate_per_minute: number
  total_recipients: number
  created_at: string
  stats: CampaignStats
}
export interface CampaignInput {
  name: string
  templateId: string
  audience: CampaignAudience
  templateValues?: Record<string, string>
  headerMediaUrl?: string
  headerImageSource?: PictureSource | null
  ratePerMinute?: number
}
export interface AudiencePreview {
  audience: number
  willSend: number
  skipped: Record<string, number>
}
export interface CampaignRecipient {
  id: string
  contact_id: string
  name: string | null
  phone: string | null
  status: "PENDING" | "SENDING" | "SENT" | "FAILED" | "SKIPPED"
  skip_reason: string | null
  error_text: string | null
  message_status: string | null
  sent_at: string | null
}
export interface AudienceOptions {
  segments: Array<{ id: string; name: string; members: number }>
  stages: Array<{ id: string; name: string }>
  imports: Array<{ id: string; name: string; members: number }>
}
export interface SuppressedContact {
  contact_id: string
  name: string | null
  phone: string | null
  reason: string | null
  created_at: string
}
export interface ConsentResult {
  recorded: number
  invalid: string[]
  invalidCount: number
}

export type WorkflowTrigger = "CART_ABANDONED" | "ORDER_STATUS"
export type ConditionOp = "gt" | "gte" | "lt" | "lte" | "eq" | "neq"
export interface WorkflowCondition {
  field: string
  op: ConditionOp
  value: string | number
}
/** Where the picture of an image-header template comes from, chosen again for every message */
export type PictureSource =
  | { mode: "ONE" | "IMAGES"; urls: string[]; fallbackUrl?: string }
  | { mode: "PRODUCTS"; productIds: string[]; fallbackUrl?: string }
  | { mode: "OFFER_PRODUCTS"; fallbackUrl?: string }
  | { mode: "CART_PRODUCT"; pick: "TOP" | "RANDOM"; fallbackUrl?: string }

/** A normal (non-template) message in each language, sent when the template cannot be delivered and the customer wrote in the last 24 hours */
export interface FallbackTexts { gu?: string; en?: string; gl?: string }

export type WorkflowAction =
  | { type: "SEND_TEMPLATE"; templateId: string; values: Record<string, string>; couponId?: string; imageSource?: PictureSource; fallbackTexts?: FallbackTexts }
  | { type: "ADD_LABEL"; labelId: string }
export interface Workflow {
  id: string
  name: string
  description: string | null
  trigger_type: WorkflowTrigger
  trigger_config: { delay_minutes?: number; cooldown_hours?: number; status?: string }
  conditions: WorkflowCondition[]
  actions: WorkflowAction[]
  is_active: boolean
  activated_at: string | null
  created_at: string
  sent?: number
  skipped?: number
  failed?: number
  runs?: WorkflowRun[]
}
export interface WorkflowRun {
  id: string
  subject_type: string
  status: "RUNNING" | "SENT" | "SKIPPED" | "FAILED" | "INTERRUPTED"
  reason: string | null
  created_at: string
  customer: string | null
}
export interface WorkflowInput {
  name: string
  description?: string
  triggerType: WorkflowTrigger
  triggerConfig: { delayMinutes?: number; cooldownHours?: number; status?: string }
  conditions: WorkflowCondition[]
  actions: WorkflowAction[]
}
export interface WorkflowCatalog {
  triggers: Record<WorkflowTrigger, { label: string; fields: string[]; tokens: string[] }>
  cartLinkConfigured: boolean
}

// ─── Prospect outreach (Phase 8) ─────────────────────────────────────
export type ProspectRowStatus = "NEW" | "EXISTING_CONTACT" | "EXISTING_CUSTOMER" | "INVALID" | "DUPLICATE" | "OPTED_OUT" | "SUPPRESSED"
export interface ProspectImport {
  id: string
  name: string
  filename: string | null
  status: "PREVIEW" | "CONFIRMED"
  total_rows: number
  consent_source: string | null
  include_existing: boolean
  created_at: string
  confirmed_at: string | null
  counts: Partial<Record<ProspectRowStatus, number>>
  columns?: { phone: string | null; name: string | null; business: string | null }
  reachable?: number
}
export interface ProspectRow {
  id: string
  row_number: number
  name: string | null
  business_name: string | null
  phone_raw: string | null
  wa_id: string | null
  status: ProspectRowStatus
  selected: boolean
}

// ─── Analytics and cost (Phase 10) ───────────────────────────────────
export type AnalyticsSource = "CAMPAIGN" | "WORKFLOW" | "MANUAL"
export type BreakdownBy = "campaign" | "workflow" | "template"
export interface AnalyticsRange {
  from: string
  to: string
  days: number
  attributionDays: number
}
export interface FunnelRow {
  sent: number
  delivered: number
  read: number
  failed: number
  replied: number
  orders: number
  revenue: number
  cost?: number
  delivery_rate: number | null
  read_rate: number | null
  reply_rate: number | null
  failure_rate: number | null
  cost_per_order: number | null
  revenue_per_rupee: number | null
}
export interface AnalyticsDay {
  day: string
  sent: number
  delivered: number
  read: number
  replied: number
  cost: number
  orders: number
  revenue: number
}
export interface CostSummary {
  total: number
  estimated: number
  billedMessages: number
  estimatedMessages: number
  unpricedMessages: number
  hasRates: boolean
  byCategory: Array<{ category: string; messages: number; unpriced: number; cost: number }>
}
export interface AnalyticsOverview {
  range: AnalyticsRange
  totals: FunnelRow
  bySource: Array<FunnelRow & { source: AnalyticsSource }>
  newContacts: number
  optedOut: number
  optOutRate: number | null
  failures: Array<{ code: number | null; title: string | null; count: number }>
  cost: CostSummary
  daily: AnalyticsDay[]
}
export interface BreakdownRow extends FunnelRow {
  id: string
  name: string
  cost: number
  unpriced: number
  template_name?: string
  campaign_status?: string
  trigger_type?: string
  category?: string
  template_status?: string
}
export interface InboxReport {
  range: Omit<AnalyticsRange, "attributionDays">
  volume: { inbound: number; by_people: number; by_bot: number; automated: number }
  responses: {
    waiting_starts: number
    answered_by_people: number
    answered_by_bot: number
    unanswered: number
    within_15: number
    within_15_rate: number | null
    median_minutes: number | null
    p90_minutes: number | null
  }
  agents: Array<{ id: string; name: string; messages: number; conversations: number; first_replies: number; median_minutes: number | null }>
  bot: Array<{ outcome: string; n: number }>
}
export type RateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION" | "SERVICE"
export interface RateCard {
  id: string
  category: RateCategory
  rate: number
  effective_from: string
  note: string | null
  created_by_name: string | null
  current: boolean
  future: boolean
}
export interface RateCards {
  categories: RateCategory[]
  cards: RateCard[]
}
export interface AnalyticsQuery {
  from?: string
  to?: string
  attributionDays?: number
}
