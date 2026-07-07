import type { LucideIcon } from 'lucide-react';

export type CaseStateName =
  | 'Pendiente de Clasificación'
  | 'Clasificado'
  | 'Asignado'
  | 'En Gestión'
  | 'Pendiente de Información'
  | 'Respuesta Elaborada'
  | 'En Revisión / Aprobación'
  | 'Devuelto para Ajustes'
  | 'Aprobado'
  | 'Enviado'
  | 'Cerrado'
  | 'Cancelado';

export type CasePriorityName = 'Crítica' | 'Alta' | 'Media' | 'Baja';
export type SemColor = 'green' | 'yellow' | 'orange' | 'red';
export type SigcDataSource = 'demo' | 'supabase';

export interface SigcCase {
  id: string;
  databaseId?: string;
  radicado: string;
  organizationId?: string;
  typeId?: string;
  type: string;
  subject: string;
  description?: string;
  company: string;
  requester: string;
  requesterDocument?: string;
  requesterEmail?: string;
  requesterPhone?: string;
  areaId?: string;
  area: string;
  ownerId?: string;
  owner: string;
  stateId?: string;
  state: CaseStateName | string;
  priorityId?: string;
  priority: CasePriorityName;
  slaPolicyId?: string;
  sla: string;
  openedAt?: string;
  dueAt?: string | null;
  due: string;
  sem: SemColor;
  progress: number;
  updatedAt?: string;
  updated: string;
  risk: string;
  source: string;
  classificationObservations?: string;
  classifiedAt?: string | null;
}

export interface SigcCaseFilters {
  query?: string;
  stateId?: string;
  areaId?: string;
  ownerId?: string;
  caseTypeId?: string;
  priorityId?: string;
  overdueOnly?: boolean;
  upcomingOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export interface SigcCasePage {
  items: SigcCase[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PublicCaseTypeOption {
  id: string;
  name: string;
  description?: string | null;
  slaLabel: string;
}

export interface PublicIntakeBranding {
  productName: string;
  shortName: string;
  logoUrl?: string | null;
  primaryColor: string;
  accentColor: string;
  supportEmail?: string | null;
  customDomain?: string | null;
}

export interface PublicIntakeSettings {
  enabled: boolean;
  formTitle: string;
  formDescription: string;
  confirmationMessage: string;
  allowAttachments: boolean;
  maxFiles: number;
  maxFileSizeBytes: number;
}

export interface PublicIntakeContext {
  organizationName: string;
  organizationSlug: string;
  branding: PublicIntakeBranding;
  intake: PublicIntakeSettings;
  caseTypes: PublicCaseTypeOption[];
}

export interface PublicIntakeLocator {
  tenant?: string;
  hostname?: string;
}

export interface PublicCaseCreateInput extends PublicIntakeLocator {
  caseTypeId: string;
  requesterName: string;
  requesterCompany: string;
  requesterDocument: string;
  requesterEmail: string;
  requesterPhone: string;
  subject: string;
  description: string;
  website?: string;
  attachments?: File[];
}

export interface PublicCaseSubmissionResult extends CreatedCaseResult {
  attachmentCount: number;
  failedAttachments: string[];
  attachmentSessionFinalized: boolean;
  attachmentFinalizeError?: string;
}

export interface ManualCaseAssignmentInput {
  areaId: string;
  responsibleUserId?: string;
  dueAt?: string;
  observations?: string;
  isPrimary?: boolean;
}

export interface ManualCaseCreateInput {
  idempotencyKey: string;
  caseTypeId: string;
  priorityId: string;
  requesterName: string;
  requesterCompany: string;
  requesterDocument: string;
  requesterEmail: string;
  requesterPhone: string;
  subject: string;
  description: string;
  riskLevel?: string;
  assignments: ManualCaseAssignmentInput[];
}

export interface CreatedCaseResult {
  caseId: string;
  radicado: string;
  dueAt: string | null;
}

export interface SigcMember {
  userId: string;
  name: string;
  email: string;
  roleName: string;
}

export interface SigcAssignment {
  id: string;
  areaId: string;
  areaName: string;
  responsibleUserId?: string;
  responsibleName: string;
  assignedAt: string;
  assignedLabel: string;
  dueAt?: string | null;
  due: string;
  state: string;
  observations?: string | null;
  progress: number;
  isPrimary: boolean;
  isActive: boolean;
  updatedAt?: string;
  completedAt?: string | null;
}

export interface AllowedCaseState {
  id: string;
  name: string;
  code: string;
  color?: string | null;
  requiresJustification: boolean;
}

export interface CaseAssignmentInput {
  caseId: string;
  areaId: string;
  responsibleUserId?: string;
  dueAt?: string;
  observations?: string;
  isPrimary?: boolean;
}

export interface ClassifyCaseInput {
  caseId: string;
  caseTypeId: string;
  priorityId: string;
  riskLevel: string;
  observations?: string;
  dueAt?: string;
  assignments: Array<CaseAssignmentInput & { caseId?: string }>;
}

export interface UpdateCaseAssignmentInput {
  assignmentId: string;
  caseId: string;
  areaId: string;
  responsibleUserId?: string;
  dueAt?: string;
  state: string;
  observations?: string;
  progress: number;
  isPrimary: boolean;
}

export interface DeactivateCaseAssignmentInput {
  assignmentId: string;
  caseId: string;
  reason: string;
}

export interface ChangeCaseStateInput {
  caseId: string;
  toStateId: string;
  justification?: string;
}

export interface Subtask {
  title: string;
  owner: string;
  due: string;
  state: string;
  priority: CasePriorityName;
  progress: number;
  caseId: string;
  comments: number;
  attachments: number;
}

export interface DocumentRecord {
  name: string;
  type: string;
  version: string;
  owner: string;
  date: string;
  state: string;
  caseId: string;
}

export interface TimelineItem {
  title: string;
  description: string;
  actor: string;
  date: string;
  icon: LucideIcon;
}

export interface SigcCatalogOption {
  id: string;
  name: string;
  code?: string;
  color?: string | null;
  isActive?: boolean;
}

export interface SigcCatalogs {
  organizationId: string | null;
  areas: SigcCatalogOption[];
  caseTypes: SigcCatalogOption[];
  states: SigcCatalogOption[];
  priorities: SigcCatalogOption[];
  roles: SigcCatalogOption[];
}


export type SubtaskState = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface SigcSubtask {
  id: string;
  caseId: string;
  assignmentId?: string;
  areaId?: string;
  areaName: string;
  caseRadicado: string;
  caseSubject: string;
  title: string;
  description: string;
  responsibleUserId?: string;
  responsibleName: string;
  priorityId?: string;
  priority: CasePriorityName;
  dueAt?: string | null;
  due: string;
  state: SubtaskState;
  stateLabel: string;
  progress: number;
  comments: number;
  attachments: number;
  createdAt: string;
  updatedAt: string;
}

export interface SigcSubtaskFilters {
  caseId?: string;
  query?: string;
  state?: SubtaskState | '';
  responsibleUserId?: string;
}

export interface CreateSubtaskInput {
  caseId: string;
  assignmentId?: string;
  areaId?: string;
  title: string;
  description: string;
  responsibleUserId?: string;
  dueAt?: string;
  priorityId?: string;
  files?: File[];
}

export interface UpdateSubtaskInput {
  subtaskId: string;
  caseId: string;
  assignmentId?: string;
  areaId?: string;
  title: string;
  description: string;
  responsibleUserId?: string;
  dueAt?: string;
  priorityId?: string;
  state: SubtaskState;
  progress: number;
  files?: File[];
}

export interface CreatedSubtaskResult {
  subtaskId: string;
  failedAttachments?: string[];
}

export interface SigcComment {
  id: string;
  caseId: string;
  subtaskId?: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
  createdLabel: string;
  attachmentCount: number;
}

export interface AddCommentInput {
  caseId: string;
  content: string;
  subtaskId?: string;
  files?: File[];
}

export interface CreatedCommentResult {
  commentId: string;
  failedAttachments?: string[];
}

export interface SigcDocument {
  id: string;
  caseId: string;
  caseRadicado: string;
  caseSubject: string;
  subtaskId?: string;
  commentId?: string;
  name: string;
  category: string;
  state: string;
  currentVersion: number;
  ownerId?: string;
  ownerName: string;
  createdAt: string;
  updatedAt: string;
  date: string;
  currentFilename: string;
  currentStoragePath: string;
  currentMimeType?: string;
  currentSizeBytes: number;
}

export interface UploadCaseDocumentInput {
  caseId: string;
  name: string;
  category: string;
  state?: string;
  file: File;
  changeNotes?: string;
  subtaskId?: string;
  commentId?: string;
}

export interface AddDocumentVersionInput {
  documentId: string;
  caseId: string;
  currentVersion: number;
  file: File;
  changeNotes?: string;
}

export interface SigcTimelineEvent {
  id: string;
  caseId: string;
  eventType: string;
  entityType: string;
  title: string;
  description: string;
  actorId?: string;
  actorName: string;
  createdAt: string;
  date: string;
}

export interface SigcRepositoryResult<T> {
  data: T;
  source: SigcDataSource;
  warning?: string;
}

export interface SigcSlaOverride {
  id: string;
  caseId: string;
  previousDueAt?: string | null;
  newDueAt: string;
  justification: string;
  changedBy?: string;
  changedByName: string;
  changedAt: string;
  changedLabel: string;
}

export interface OverrideCaseSlaInput {
  caseId: string;
  newDueAt: string;
  justification: string;
}

export interface SigcCaseReview {
  id: string;
  caseId: string;
  reviewRound: number;
  status: 'pending' | 'approved' | 'returned' | 'cancelled';
  requestedBy?: string;
  requestedByName: string;
  reviewerUserId?: string;
  reviewerName: string;
  requestNote?: string;
  requestedAt: string;
  requestedLabel: string;
  decidedBy?: string;
  decidedByName?: string;
  decisionComments?: string;
  decidedAt?: string;
  decidedLabel?: string;
}

export interface SubmitCaseReviewInput {
  caseId: string;
  reviewerUserId?: string;
  note?: string;
}

export interface DecideCaseReviewInput {
  reviewId: string;
  decision: 'approved' | 'returned';
  comments?: string;
}

export interface SigcCaseDelivery {
  id: string;
  caseId: string;
  channel: 'email' | 'physical' | 'portal' | 'courier' | 'other';
  recipient: string;
  reference?: string;
  notes?: string;
  deliveredBy?: string;
  deliveredByName: string;
  deliveredAt: string;
  deliveredLabel: string;
}

export interface RegisterCaseDeliveryInput {
  caseId: string;
  channel: SigcCaseDelivery['channel'];
  recipient: string;
  reference?: string;
  notes?: string;
}

export interface SigcCaseReminder {
  id: string;
  caseId: string;
  ruleName?: string;
  recipientUserId?: string;
  recipientName: string;
  reminderType: 'automatic' | 'manual';
  message: string;
  sentBy?: string;
  sentByName: string;
  deliveredAt: string;
  deliveredLabel: string;
}

export interface SendManualReminderInput {
  caseId: string;
  message: string;
  recipientUserIds?: string[];
}

// SIGC Fases 5 y 6 · administración parametrizable y automatizaciones
export type AdminCatalogKind = 'areas' | 'priorities' | 'caseTypes' | 'states';

export interface AdminCatalogItem {
  id: string;
  code: string;
  name: string;
  description?: string;
  color?: string;
  sortOrder: number;
  isActive: boolean;
  isInitial?: boolean;
  isTerminal?: boolean;
}

export interface AdminSlaPolicy {
  id: string;
  caseTypeId?: string;
  caseTypeName: string;
  name: string;
  durationValue: number;
  durationUnit: 'hours' | 'calendar_days' | 'business_days';
  timezone: string;
  pauseOnPendingInformation: boolean;
  isDefault: boolean;
  isActive: boolean;
}

export interface AdminHoliday {
  id: string;
  holidayDate: string;
  name: string;
  isActive: boolean;
}

export interface AdminPermission {
  id: string;
  code: string;
  name: string;
  description?: string;
}

export interface AdminRole {
  id: string;
  code: string;
  name: string;
  description?: string;
  isSystem: boolean;
  isActive: boolean;
  permissionIds: string[];
}

export interface AdminMember {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  roleId?: string;
  roleName: string;
  isActive: boolean;
}

export interface AdminWorkflowState {
  stateId: string;
  stateName: string;
  sortOrder: number;
  isRequired: boolean;
}

export interface AdminTransition {
  id: string;
  caseTypeId?: string;
  fromStateId: string;
  toStateId: string;
  requiredPermissionCode?: string;
  requiresJustification: boolean;
  isActive: boolean;
}

export interface AdminWorkflow {
  caseTypeId: string;
  caseTypeName: string;
  states: AdminWorkflowState[];
  transitions: AdminTransition[];
}

export interface AdminEmailTemplate {
  id: string;
  code: string;
  name: string;
  eventType?: string;
  subject: string;
  bodyText: string;
  isActive: boolean;
}

export interface AdminReminderRule {
  id: string;
  code: string;
  name: string;
  triggerKind: 'before_due' | 'overdue';
  offsetMinutes: number;
  includeManagers: boolean;
  isActive: boolean;
}

export interface AutomationCondition {
  field: 'case_type_id' | 'priority_id' | 'state_id' | 'primary_area_id' | 'primary_owner_id' | 'source' | 'risk_level' | 'overdue' | 'all_subtasks_completed';
  operator: 'equals' | 'not_equals' | 'contains' | 'in' | 'is_true' | 'is_false';
  value: string;
  values?: string[];
}

export type AutomationAction =
  | { type: 'assign_area'; areaId: string }
  | { type: 'assign_user'; userId: string; areaId?: string }
  | { type: 'set_priority'; priorityId: string }
  | { type: 'create_subtask'; title: string; description?: string; responsibleUserId?: string; priorityId?: string; dueInHours?: number }
  | { type: 'notify_user'; userId: string; title?: string; message?: string }
  | { type: 'notify_role'; roleCode: string; title?: string; message?: string }
  | { type: 'change_state'; stateId: string; justification?: string }
  | { type: 'email_requester'; templateCode: string }
  | { type: 'suggest_close' };

export interface AutomationRule {
  id: string;
  code: string;
  name: string;
  description?: string;
  triggerEvent: string;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  stopOnError: boolean;
  sortOrder: number;
  isActive: boolean;
  lastRunAt?: string;
  runCount: number;
  maxAttempts: number;
  retryDelayMinutes: number;
}

export interface AutomationExecution {
  id: string;
  ruleId: string;
  ruleName: string;
  caseId?: string;
  caseRadicado?: string;
  triggerEvent: string;
  status: 'running' | 'success' | 'partial' | 'failed' | 'skipped';
  matched: boolean;
  actionsTotal: number;
  actionsSucceeded: number;
  errorMessage?: string;
  executionLog: Array<Record<string, unknown>>;
  attemptCount: number;
  maxAttempts: number;
  nextRetryAt?: string;
  retryOfId?: string;
  startedAt: string;
  finishedAt?: string;
}

export interface SigcUserManagementSnapshot {
  organizationId: string;
  roles: AdminRole[];
  members: AdminMember[];
}

export interface SigcAdminSnapshot {
  organizationId: string;
  areas: AdminCatalogItem[];
  priorities: AdminCatalogItem[];
  caseTypes: AdminCatalogItem[];
  states: AdminCatalogItem[];
  slaPolicies: AdminSlaPolicy[];
  holidays: AdminHoliday[];
  permissions: AdminPermission[];
  roles: AdminRole[];
  members: AdminMember[];
  workflows: AdminWorkflow[];
  emailTemplates: AdminEmailTemplate[];
  reminderRules: AdminReminderRule[];
  automationRules: AutomationRule[];
  automationExecutions: AutomationExecution[];
}

export interface SaveAdminCatalogInput {
  kind: AdminCatalogKind;
  id?: string;
  code: string;
  name: string;
  description?: string;
  color?: string;
  sortOrder?: number;
  isInitial?: boolean;
  isTerminal?: boolean;
  isActive?: boolean;
}

export interface SaveSlaPolicyInput {
  id?: string;
  caseTypeId?: string;
  name: string;
  durationValue: number;
  durationUnit: AdminSlaPolicy['durationUnit'];
  timezone: string;
  pauseOnPendingInformation: boolean;
  isDefault: boolean;
  isActive: boolean;
}

export interface SaveHolidayInput {
  id?: string;
  holidayDate: string;
  name: string;
  isActive: boolean;
}

export interface SaveRoleInput {
  id?: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
}

export interface SaveTransitionInput {
  id?: string;
  caseTypeId: string;
  fromStateId: string;
  toStateId: string;
  requiredPermissionCode?: string;
  requiresJustification: boolean;
  isActive: boolean;
}

export interface SaveEmailTemplateInput {
  id?: string;
  code: string;
  name: string;
  eventType?: string;
  subject: string;
  bodyText: string;
  isActive: boolean;
}

export interface SaveReminderRuleInput {
  id?: string;
  code: string;
  name: string;
  triggerKind: AdminReminderRule['triggerKind'];
  offsetMinutes: number;
  includeManagers: boolean;
  isActive: boolean;
}

export interface SaveAutomationRuleInput {
  id?: string;
  code: string;
  name: string;
  description?: string;
  triggerEvent: string;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  stopOnError: boolean;
  sortOrder: number;
  isActive: boolean;
  maxAttempts: number;
  retryDelayMinutes: number;
}

// SIGC Fases 7 y 8 · analítica, reportes y operación SaaS
export interface AnalyticsValue {
  id?: string;
  label: string;
  value: number;
}

export interface DashboardSummary {
  openCases: number;
  closedCases: number;
  overdueCases: number;
  dueSoonCases: number;
  createdToday: number;
  criticalCases: number;
  slaCompliancePct: number;
  avgResolutionHours: number;
}

export interface DashboardMonthlyPoint {
  month: string;
  label: string;
  created: number;
  closed: number;
}

export interface DashboardCriticalCase {
  id: string;
  radicado: string;
  subject: string;
  priority: string;
  owner: string;
  dueAt?: string | null;
  overdue: boolean;
}

export interface DashboardWorkItem {
  id: string;
  title: string;
  caseId: string;
  radicado: string;
  dueAt?: string | null;
  state: string;
  progress: number;
}

export interface DashboardActivityItem {
  id: number | string;
  eventType: string;
  entityType: string;
  actor: string;
  createdAt: string;
  caseId?: string | null;
  radicado?: string | null;
}

export interface SigcDashboardAnalytics {
  organizationId: string;
  generatedAt: string;
  summary: DashboardSummary;
  monthly: DashboardMonthlyPoint[];
  byArea: AnalyticsValue[];
  byOwner: AnalyticsValue[];
  byType: AnalyticsValue[];
  byPriority: AnalyticsValue[];
  criticalCases: DashboardCriticalCase[];
  myWork: DashboardWorkItem[];
  recentActivity: DashboardActivityItem[];
}

export interface SigcReportFilters {
  from: string;
  to: string;
  stateId?: string;
  areaId?: string;
  ownerId?: string;
  caseTypeId?: string;
  priorityId?: string;
  overdueOnly?: boolean;
}

export interface SigcReportRow {
  id: string;
  radicado: string;
  subject: string;
  requesterName: string;
  requesterCompany: string;
  source: string;
  riskLevel?: string;
  openedAt: string;
  dueAt?: string | null;
  closedAt?: string | null;
  progress: number;
  updatedAt: string;
  caseType: string;
  state: string;
  priority: string;
  area: string;
  owner: string;
  overdue: boolean;
  slaMet?: boolean | null;
  resolutionHours?: number | null;
}

export interface SigcReportSummary {
  totalCases: number;
  openCases: number;
  closedCases: number;
  overdueCases: number;
  slaCompliancePct: number;
  avgResolutionHours: number;
}

export interface SigcReportResult {
  organizationId: string;
  generatedAt: string;
  from: string;
  to: string;
  summary: SigcReportSummary;
  byArea: AnalyticsValue[];
  byOwner: AnalyticsValue[];
  byType: AnalyticsValue[];
  byState: AnalyticsValue[];
  byPriority: AnalyticsValue[];
  byRisk: AnalyticsValue[];
  agingBuckets: AnalyticsValue[];
  slaByArea: Array<AnalyticsValue & { total: number; compliant: number }>;
  throughput: DashboardMonthlyPoint[];
  rows: SigcReportRow[];
  isTruncated: boolean;
}


export interface SigcAuthorizationRole {
  id: string;
  code: string;
  name: string;
}

export interface SigcAuthorizationContext {
  userId: string;
  organizationId: string;
  membershipId: string;
  isActive: boolean;
  role: SigcAuthorizationRole;
  permissions: string[];
}

export interface SaasBranding {
  productName: string;
  shortName: string;
  logoUrl?: string | null;
  primaryColor: string;
  accentColor: string;
  sidebarColor: string;
  supportEmail?: string | null;
  customDomain?: string | null;
}

export interface SaasPlan {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  monthlyPriceCop: number;
  limits: Record<string, number>;
  features: Record<string, boolean>;
}

export interface SaasSubscription {
  status: 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled';
  trialEndsAt?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  plan: SaasPlan;
}

export interface SaasUsage {
  members: number;
  cases: number;
  activeCases: number;
  automations: number;
  storageBytes: number;
}

export interface SaasOrganizationOption {
  id: string;
  name: string;
  slug: string;
  roleName: string;
  roleCode: string;
  planCode: string;
  planName: string;
  isActive: boolean;
}

export interface SaasInvitation {
  id: string;
  email: string;
  roleId: string;
  roleName: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  token: string;
  expiresAt: string;
  createdAt: string;
}

export interface SaasOnboardingStep {
  code: string;
  label: string;
  completed: boolean;
}

export interface SaasHealth {
  errorsLast24h: number;
  auditEvents30d: number;
  queuedEmails: number;
}

export interface SaasActiveOrganization {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  createdBy?: string | null;
  settings: Record<string, unknown>;
}

export interface SigcSaasContext {
  activeOrganization: SaasActiveOrganization;
  branding: SaasBranding;
  subscription: SaasSubscription;
  usage: SaasUsage;
  organizations: SaasOrganizationOption[];
  invitations: SaasInvitation[];
  onboarding: SaasOnboardingStep[];
  health: SaasHealth;
  canManage: boolean;
}

export interface UpdateOrganizationProfileInput extends SaasBranding {
  name: string;
  slug: string;
}

export interface UpdatePublicIntakeSettingsInput {
  enabled: boolean;
  formTitle: string;
  formDescription: string;
  confirmationMessage: string;
  allowAttachments: boolean;
  maxFiles: number;
  maxFileSizeBytes: number;
}

export interface CreateSaasOrganizationInput {
  name: string;
  slug: string;
}

export interface CreateOrganizationInvitationInput {
  email: string;
  roleId: string;
  expiresDays?: number;
}

export interface CreatedOrganizationInvitation {
  invitationId: string;
  token: string;
  expiresAt: string;
}

export interface PublicOrganizationInvitation {
  organizationName: string;
  organizationSlug: string;
  email: string;
  roleName: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expiresAt: string;
}

export interface ClientErrorInput {
  message: string;
  stack?: string;
  route?: string;
  severity?: 'info' | 'warning' | 'error' | 'fatal';
  metadata?: Record<string, unknown>;
}

// SIGC Fase 10 · agenda operativa centrada en casos
export type SigcAgendaItemKind = 'case_due' | 'assignment_due' | 'subtask_due' | 'review_pending' | 'reminder';

export interface SigcAgendaItem {
  id: string;
  kind: SigcAgendaItemKind;
  caseId: string;
  caseRadicado: string;
  caseSubject: string;
  title: string;
  description: string;
  scheduledAt: string;
  dateKey: string;
  state: string;
  priority: string;
  owner: string;
  area: string;
  progress: number;
  completed: boolean;
  overdue: boolean;
  actionUrl: string;
  metadata: Record<string, unknown>;
}

export interface SigcAgendaSummary {
  total: number;
  overdue: number;
  dueToday: number;
  next7Days: number;
  pendingReviews: number;
}

export interface SigcAgendaSnapshot {
  organizationId: string;
  timezone: string;
  from: string;
  to: string;
  summary: SigcAgendaSummary;
  items: SigcAgendaItem[];
}

// SIGC Fase 13 · tablero dinámico por flujo
export interface WorkflowBoardCard {
  id: string;
  radicado: string;
  subject: string;
  company: string;
  requester: string;
  stateId: string;
  stateName: string;
  priorityId?: string;
  priorityName: string;
  priorityColor?: string | null;
  areaId?: string;
  areaName: string;
  ownerId?: string;
  ownerName: string;
  dueAt?: string | null;
  progress: number;
  riskLevel?: string | null;
  source: string;
  updatedAt: string;
  overdue: boolean;
}

export interface WorkflowBoardColumn {
  stateId: string;
  code: string;
  name: string;
  color?: string | null;
  sortOrder: number;
  isInitial: boolean;
  isTerminal: boolean;
  cards: WorkflowBoardCard[];
}

export interface WorkflowBoardTransition {
  id: string;
  fromStateId: string;
  toStateId: string;
  requiresJustification: boolean;
  requiredPermissionCode?: string | null;
  allowed: boolean;
}

export interface WorkflowBoardCaseType {
  id: string;
  code: string;
  name: string;
  caseCount: number;
}

export interface WorkflowBoardFilters {
  caseTypeId?: string;
  query?: string;
  areaId?: string;
  ownerId?: string;
  priorityId?: string;
}

export interface WorkflowBoardSnapshot {
  organizationId: string;
  selectedCaseTypeId: string | null;
  caseTypes: WorkflowBoardCaseType[];
  columns: WorkflowBoardColumn[];
  transitions: WorkflowBoardTransition[];
  generatedAt?: string;
}

export interface MoveWorkflowCaseInput {
  caseId: string;
  toStateId: string;
  expectedFromStateId: string;
  justification?: string;
}

export interface MoveWorkflowCaseResult {
  caseId: string;
  stateId: string;
  stateName: string;
  updatedAt?: string;
}

// SIGC Fase 15 · salud del runtime de automatización
export interface AutomationRuntimeHealth {
  organizationId: string;
  generatedAt: string;
  activeRules: number;
  executions24h: number;
  failedExecutions24h: number;
  pendingRetries: number;
  reminders24h: number;
  queuedEmails: number;
  failedEmails: number;
  oldestQueuedEmailAt?: string | null;
}

