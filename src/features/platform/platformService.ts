import { supabase } from '../../lib/supabaseClient';
import type {
  OrganizationBackupJob,
  PaginatedResult,
  PlatformAccessContext,
  PlatformAuditEvent,
  PlatformDashboard,
  PlatformOperationsSnapshot,
  PlatformOrganizationDetail,
  PlatformOrganizationSummary,
  PlatformSupportSession,
  PlatformUser,
  SupportTicket,
  PlatformSecuritySnapshot,
  PlatformSupportAccessSnapshot,
  PlatformSupportAccessRequest,
  PlatformRecoverySnapshot,
  BackupRestoreRequest,
  OrganizationUsageControl,
  PlatformExplorerResult,
  PlatformAdminRole,
  CommercialDashboard,
  CommercialCatalog,
  BillingSnapshot,
  OnboardingRecord,
  OrganizationSubscriptionPortal
} from './types';

type JsonRecord = Record<string, unknown>;

function client(): any {
  if (!supabase) throw new Error('Supabase no está configurado para operar el Super Admin.');
  return supabase as any;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' ? value as JsonRecord : {};
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function normalizePage<T>(payload: unknown): PaginatedResult<T> {
  const row = asRecord(payload);
  return {
    rows: asArray<T>(row.rows),
    total: Number(row.total ?? 0),
    page: Number(row.page ?? 1),
    pageSize: Number(row.pageSize ?? row.page_size ?? 25)
  };
}

async function rpc<T>(name: string, args: JsonRecord = {}): Promise<T> {
  const { data, error } = await client().rpc(name, args);
  if (error) throw new Error(error.message || `No fue posible ejecutar ${name}.`);
  return data as T;
}

export const platformService = {
  async getAccessContext(): Promise<PlatformAccessContext> {
    const result = await rpc<unknown>('platform_get_context_v2');
    const row = asRecord(result);
    return {
      isPlatformAdmin: Boolean(row.isPlatformAdmin ?? row.is_platform_admin),
      userId: row.userId ? String(row.userId) : row.user_id ? String(row.user_id) : null,
      roleCode: String(row.roleCode ?? row.role_code ?? '') as PlatformAccessContext['roleCode'],
      roleName: String(row.roleName ?? row.role_name ?? 'Sin acceso de plataforma'),
      permissions: asArray<string>(row.permissions).map(String),
      aal: String(row.aal ?? 'aal1'),
      mfaEnrolled: Boolean(row.mfaEnrolled ?? row.mfa_enrolled),
      mfaVerified: Boolean(row.mfaVerified ?? row.mfa_verified),
      verifiedFactors: Number(row.verifiedFactors ?? row.verified_factors ?? 0)
    };
  },

  getDashboard(): Promise<PlatformDashboard> {
    return rpc<PlatformDashboard>('platform_get_dashboard_v1');
  },

  async listOrganizations(params: { search?: string; status?: string; page?: number; pageSize?: number } = {}): Promise<PaginatedResult<PlatformOrganizationSummary>> {
    const result = await rpc<unknown>('platform_list_organizations_v1', {
      p_search: params.search || null,
      p_status: params.status || null,
      p_page: params.page ?? 1,
      p_page_size: params.pageSize ?? 25
    });
    return normalizePage<PlatformOrganizationSummary>(result);
  },

  getOrganizationDetail(organizationId: string): Promise<PlatformOrganizationDetail> {
    return rpc<PlatformOrganizationDetail>('platform_get_organization_detail_v1', { p_organization_id: organizationId });
  },

  async listUsers(params: { search?: string; organizationId?: string; page?: number; pageSize?: number } = {}): Promise<PaginatedResult<PlatformUser>> {
    const result = await rpc<unknown>('platform_list_users_v1', {
      p_search: params.search || null,
      p_organization_id: params.organizationId || null,
      p_page: params.page ?? 1,
      p_page_size: params.pageSize ?? 25
    });
    return normalizePage<PlatformUser>(result);
  },

  async listAudit(params: { organizationId?: string; search?: string; eventType?: string; from?: string; to?: string; page?: number; pageSize?: number } = {}): Promise<PaginatedResult<PlatformAuditEvent>> {
    const result = await rpc<unknown>('platform_list_audit_v1', {
      p_organization_id: params.organizationId || null,
      p_search: params.search || null,
      p_event_type: params.eventType || null,
      p_from: params.from || null,
      p_to: params.to || null,
      p_page: params.page ?? 1,
      p_page_size: params.pageSize ?? 50
    });
    return normalizePage<PlatformAuditEvent>(result);
  },

  async listTickets(params: { organizationId?: string; status?: string; priority?: string; search?: string; page?: number; pageSize?: number } = {}): Promise<PaginatedResult<SupportTicket>> {
    const result = await rpc<unknown>('platform_list_support_tickets_v1', {
      p_organization_id: params.organizationId || null,
      p_status: params.status || null,
      p_priority: params.priority || null,
      p_search: params.search || null,
      p_page: params.page ?? 1,
      p_page_size: params.pageSize ?? 25
    });
    return normalizePage<SupportTicket>(result);
  },

  getTicket(ticketId: string): Promise<SupportTicket> {
    return rpc<SupportTicket>('platform_get_support_ticket_v1', { p_ticket_id: ticketId });
  },

  createTicket(input: { category: string; subcategory?: string; priority: string; subject: string; description: string; relatedCaseId?: string }): Promise<SupportTicket> {
    return rpc<SupportTicket>('platform_create_support_ticket_v1', {
      p_category: input.category,
      p_subcategory: input.subcategory || null,
      p_priority: input.priority,
      p_subject: input.subject,
      p_description: input.description,
      p_related_case_id: input.relatedCaseId || null
    });
  },

  async listMyTickets(page = 1, pageSize = 25): Promise<PaginatedResult<SupportTicket>> {
    const result = await rpc<unknown>('platform_list_my_support_tickets_v1', { p_page: page, p_page_size: pageSize });
    return normalizePage<SupportTicket>(result);
  },

  replyTicket(ticketId: string, body: string, isInternal = false): Promise<void> {
    return rpc<void>('platform_reply_support_ticket_v1', { p_ticket_id: ticketId, p_body: body, p_is_internal: isInternal });
  },

  updateTicket(input: { ticketId: string; status?: string; priority?: string; assignedTo?: string | null; slaDueAt?: string | null }): Promise<void> {
    return rpc<void>('platform_update_support_ticket_v1', {
      p_ticket_id: input.ticketId,
      p_status: input.status || null,
      p_priority: input.priority || null,
      p_assigned_to: input.assignedTo ?? null,
      p_sla_due_at: input.slaDueAt ?? null
    });
  },

  async listBackups(params: { organizationId?: string; status?: string; page?: number; pageSize?: number } = {}): Promise<PaginatedResult<OrganizationBackupJob>> {
    const result = await rpc<unknown>('platform_list_backups_v1', {
      p_organization_id: params.organizationId || null,
      p_status: params.status || null,
      p_page: params.page ?? 1,
      p_page_size: params.pageSize ?? 25
    });
    return normalizePage<OrganizationBackupJob>(result);
  },

  async requestBackup(organizationId: string, scope: OrganizationBackupJob['scope'], reason: string): Promise<OrganizationBackupJob> {
    const job = await rpc<OrganizationBackupJob>('platform_request_backup_v1', {
      p_organization_id: organizationId,
      p_scope: scope,
      p_reason: reason
    });
    const { error } = await client().functions.invoke('process-organization-backup', { body: { jobId: job.id } });
    if (error) {
      throw new Error(`El backup quedó en cola, pero el procesador no pudo iniciarse: ${error.message}`);
    }
    return job;
  },

  updateSubscription(input: { organizationId: string; planId?: string | null; status?: string | null; currentPeriodEnd?: string | null; limitsOverride?: Record<string, unknown>; reason: string }): Promise<void> {
    return rpc<void>('platform_update_subscription_v1', {
      p_organization_id: input.organizationId,
      p_plan_id: input.planId ?? null,
      p_status: input.status ?? null,
      p_current_period_end: input.currentPeriodEnd ?? null,
      p_limits_override: input.limitsOverride ?? null,
      p_reason: input.reason
    });
  },

  setOrganizationActive(organizationId: string, isActive: boolean, reason: string): Promise<void> {
    return rpc<void>('platform_set_organization_active_v1', {
      p_organization_id: organizationId,
      p_is_active: isActive,
      p_reason: reason
    });
  },

  startSupportSession(input: { organizationId: string; mode: PlatformSupportSession['mode']; reason: string; ticketId?: string; durationMinutes?: number }): Promise<PlatformSupportSession> {
    return rpc<PlatformSupportSession>('platform_start_support_session_v1', {
      p_organization_id: input.organizationId,
      p_mode: input.mode,
      p_reason: input.reason,
      p_ticket_id: input.ticketId || null,
      p_duration_minutes: input.durationMinutes ?? 30
    });
  },

  endSupportSession(sessionId: string): Promise<void> {
    return rpc<void>('platform_end_support_session_v1', { p_session_id: sessionId });
  },

  getOperations(organizationId?: string): Promise<PlatformOperationsSnapshot> {
    return rpc<PlatformOperationsSnapshot>('platform_get_operations_v1', { p_organization_id: organizationId || null });
  },

  resolveError(errorId: number, resolution: string): Promise<void> {
    return rpc<void>('platform_resolve_error_v1', { p_error_id: errorId, p_resolution: resolution });
  },

  retryEmail(emailQueueId: string, reason: string): Promise<void> {
    return rpc<void>('platform_retry_email_v1', { p_email_queue_id: emailQueueId, p_reason: reason });
  },

  retryAutomation(executionId: string, reason: string): Promise<string> {
    return rpc<string>('platform_retry_automation_v1', { p_execution_id: executionId, p_reason: reason });
  },

  cancelBackup(backupId: string, reason: string): Promise<void> {
    return rpc<void>('platform_cancel_backup_v1', { p_backup_id: backupId, p_reason: reason });
  },

  setMembershipActive(membershipId: string, isActive: boolean, reason: string): Promise<void> {
    return rpc<void>('platform_set_membership_active_v1', { p_membership_id: membershipId, p_is_active: isActive, p_reason: reason });
  },

  getSecurity(): Promise<PlatformSecuritySnapshot> {
    return rpc<PlatformSecuritySnapshot>('platform_get_security_v2');
  },

  updateSecurity(settings: Record<string, unknown>, reason: string): Promise<void> {
    return rpc<void>('platform_update_security_v2', { p_settings: settings, p_reason: reason });
  },

  upsertPlatformAdmin(input: { userId: string; roleCode: PlatformAdminRole; isActive: boolean; reason: string }): Promise<void> {
    return rpc<void>('platform_upsert_admin_v2', {
      p_user_id: input.userId,
      p_role_code: input.roleCode,
      p_is_active: input.isActive,
      p_reason: input.reason
    });
  },

  listSupportAccess(status?: string, organizationId?: string): Promise<PlatformSupportAccessSnapshot> {
    return rpc<PlatformSupportAccessSnapshot>('platform_list_support_access_v2', {
      p_status: status || null,
      p_organization_id: organizationId || null
    });
  },

  requestSupportAccess(input: { organizationId: string; mode: 'read_only' | 'support' | 'admin'; scopes: string[]; reason: string; ticketId?: string; durationMinutes?: number }): Promise<PlatformSupportAccessRequest> {
    return rpc<PlatformSupportAccessRequest>('platform_request_support_access_v2', {
      p_organization_id: input.organizationId,
      p_mode: input.mode,
      p_scopes: input.scopes,
      p_reason: input.reason,
      p_ticket_id: input.ticketId || null,
      p_duration_minutes: input.durationMinutes ?? null
    });
  },

  decideSupportAccess(requestId: string, approved: boolean, reason: string): Promise<void> {
    return rpc<void>('platform_decide_support_access_v2', {
      p_request_id: requestId,
      p_approved: approved,
      p_reason: reason
    });
  },

  startApprovedSupportSession(requestId: string): Promise<PlatformSupportSession> {
    return rpc<PlatformSupportSession>('platform_start_support_session_v2', { p_request_id: requestId });
  },

  endSupportSessionV2(sessionId: string, reason: string): Promise<void> {
    return rpc<void>('platform_end_support_session_v2', { p_session_id: sessionId, p_reason: reason });
  },

  updateTicketV2(input: { ticketId: string; status?: string; priority?: string; assignedTo?: string | null; tags?: string[]; escalate?: boolean; escalationReason?: string }): Promise<void> {
    return rpc<void>('platform_update_support_ticket_v2', {
      p_ticket_id: input.ticketId,
      p_status: input.status || null,
      p_priority: input.priority || null,
      p_assigned_to: input.assignedTo ?? null,
      p_tags: input.tags ?? null,
      p_escalate: Boolean(input.escalate),
      p_escalation_reason: input.escalationReason || null
    });
  },

  listRecovery(organizationId?: string): Promise<PlatformRecoverySnapshot> {
    return rpc<PlatformRecoverySnapshot>('platform_list_recovery_v2', { p_organization_id: organizationId || null });
  },

  upsertBackupSchedule(input: { organizationId: string; enabled: boolean; frequency: 'daily' | 'weekly' | 'monthly'; localTime: string; timezone: string; dayOfWeek?: number | null; dayOfMonth?: number | null; scope: OrganizationBackupJob['scope']; retentionDays: number; reason: string }): Promise<void> {
    return rpc<void>('platform_upsert_backup_schedule_v2', {
      p_organization_id: input.organizationId,
      p_enabled: input.enabled,
      p_frequency: input.frequency,
      p_local_time: input.localTime,
      p_timezone: input.timezone,
      p_day_of_week: input.dayOfWeek ?? null,
      p_day_of_month: input.dayOfMonth ?? null,
      p_scope: input.scope,
      p_retention_days: input.retentionDays,
      p_reason: input.reason
    });
  },

  requestRestore(input: { backupJobId: string; reason: string; restoreMode: 'merge' | 'replace'; targetEnvironment: 'validation' | 'production' }): Promise<BackupRestoreRequest> {
    return rpc<BackupRestoreRequest>('platform_request_restore_v2', {
      p_backup_job_id: input.backupJobId,
      p_reason: input.reason,
      p_restore_mode: input.restoreMode,
      p_target_environment: input.targetEnvironment
    });
  },

  decideRestore(restoreRequestId: string, approved: boolean, reason: string): Promise<void> {
    return rpc<void>('platform_decide_restore_v2', {
      p_restore_request_id: restoreRequestId,
      p_approved: approved,
      p_reason: reason
    });
  },

  async processRestore(restoreRequestId: string, operation: 'validate' | 'apply', confirmationCode?: string): Promise<Record<string, unknown>> {
    const { data, error } = await client().functions.invoke('process-organization-restore', {
      body: { restoreRequestId, operation, confirmationCode }
    });
    if (error) throw new Error(error.message || 'No fue posible procesar la restauración.');
    return asRecord(data);
  },

  refreshUsage(organizationId?: string): Promise<number> {
    return rpc<number>('platform_refresh_usage_snapshot_v2', { p_organization_id: organizationId || null });
  },

  getUsageControl(organizationId: string): Promise<OrganizationUsageControl> {
    return rpc<OrganizationUsageControl>('platform_get_usage_control_v2', { p_organization_id: organizationId });
  },

  updateUsageControl(input: { organizationId: string; limitsOverride: Record<string, unknown>; featureFlags: Record<string, unknown>; reason: string }): Promise<void> {
    return rpc<void>('platform_update_usage_control_v2', {
      p_organization_id: input.organizationId,
      p_limits_override: input.limitsOverride,
      p_feature_flags: input.featureFlags,
      p_reason: input.reason
    });
  },

  exploreOrganization(input: { organizationId: string; domain: string; search?: string; page?: number; pageSize?: number }): Promise<PlatformExplorerResult> {
    return rpc<PlatformExplorerResult>('platform_explore_organization_v2', {
      p_organization_id: input.organizationId,
      p_domain: input.domain,
      p_search: input.search || null,
      p_page: input.page ?? 1,
      p_page_size: input.pageSize ?? 50
    });
  },

  async runScheduler(): Promise<Record<string, unknown>> {
    const { data, error } = await client().functions.invoke('platform-scheduler', { body: {} });
    if (error) throw new Error(error.message || 'No fue posible ejecutar el scheduler central.');
    return asRecord(data);
  },

  getCommercialDashboard(): Promise<CommercialDashboard> {
    return rpc<CommercialDashboard>('platform_get_commercial_dashboard_v31');
  },

  getCommercialCatalog(includeInactive = true): Promise<CommercialCatalog> {
    return rpc<CommercialCatalog>('platform_list_plans_v31', { p_include_inactive: includeInactive });
  },

  upsertCommercialPlan(payload: Record<string, unknown>, reason: string): Promise<Record<string, unknown>> {
    return rpc<Record<string, unknown>>('platform_upsert_plan_v31', { p_payload: payload, p_reason: reason });
  },

  upsertCommercialAddon(payload: Record<string, unknown>, reason: string): Promise<Record<string, unknown>> {
    return rpc<Record<string, unknown>>('platform_upsert_addon_v31', { p_payload: payload, p_reason: reason });
  },

  upsertCommercialCoupon(payload: Record<string, unknown>, reason: string): Promise<Record<string, unknown>> {
    return rpc<Record<string, unknown>>('platform_upsert_coupon_v31', { p_payload: payload, p_reason: reason });
  },

  async listBilling(params: { organizationId?: string; status?: string; search?: string; page?: number; pageSize?: number } = {}): Promise<BillingSnapshot> {
    const result = await rpc<unknown>('platform_list_billing_v31', {
      p_organization_id: params.organizationId || null,
      p_status: params.status || null,
      p_search: params.search || null,
      p_page: params.page ?? 1,
      p_page_size: params.pageSize ?? 25
    });
    const row = asRecord(result);
    const page = normalizePage<any>(row);
    return {
      ...page,
      payments: asArray(row.payments),
      accounts: asArray(row.accounts)
    } as BillingSnapshot;
  },

  createInvoice(input: { organizationId: string; planId: string; billingInterval: string; addons?: Array<{ addonId: string; quantity: number }>; couponCode?: string; taxPercent?: number; dueDate?: string; notes?: string; issueNow?: boolean }): Promise<Record<string, unknown>> {
    return rpc<Record<string, unknown>>('platform_create_invoice_v31', {
      p_organization_id: input.organizationId,
      p_plan_id: input.planId,
      p_billing_interval: input.billingInterval,
      p_addons: input.addons ?? [],
      p_coupon_code: input.couponCode || null,
      p_tax_percent: input.taxPercent ?? 0,
      p_due_date: input.dueDate || null,
      p_notes: input.notes || null,
      p_issue_now: input.issueNow ?? true
    });
  },

  registerPayment(input: { invoiceId: string; amount: number; method: string; reference?: string; paidAt?: string; notes?: string; confirm?: boolean }): Promise<Record<string, unknown>> {
    return rpc<Record<string, unknown>>('platform_register_payment_v31', {
      p_invoice_id: input.invoiceId,
      p_amount: input.amount,
      p_method: input.method,
      p_reference: input.reference || null,
      p_paid_at: input.paidAt || new Date().toISOString(),
      p_notes: input.notes || null,
      p_confirm: input.confirm ?? true
    });
  },

  voidInvoice(invoiceId: string, reason: string): Promise<Record<string, unknown>> {
    return rpc<Record<string, unknown>>('platform_void_invoice_v31', { p_invoice_id: invoiceId, p_reason: reason });
  },

  updateBillingAccount(organizationId: string, payload: Record<string, unknown>, reason: string): Promise<Record<string, unknown>> {
    return rpc<Record<string, unknown>>('platform_update_billing_account_v31', { p_organization_id: organizationId, p_payload: payload, p_reason: reason });
  },

  scheduleSubscriptionChange(input: { organizationId: string; planId: string; billingInterval: string; effectiveMode: 'immediate' | 'period_end'; reason: string }): Promise<Record<string, unknown>> {
    return rpc<Record<string, unknown>>('platform_schedule_subscription_change_v31', {
      p_organization_id: input.organizationId,
      p_plan_id: input.planId,
      p_billing_interval: input.billingInterval,
      p_effective_mode: input.effectiveMode,
      p_reason: input.reason
    });
  },

  setSubscriptionCancellation(organizationId: string, cancelAtPeriodEnd: boolean, reason: string): Promise<Record<string, unknown>> {
    return rpc<Record<string, unknown>>('platform_set_subscription_cancellation_v31', {
      p_organization_id: organizationId,
      p_cancel_at_period_end: cancelAtPeriodEnd,
      p_reason: reason
    });
  },

  reviewCommercialRequest(requestId: string, decision: 'approved' | 'rejected' | 'in_review', notes: string, apply = false): Promise<Record<string, unknown>> {
    return rpc<Record<string, unknown>>('platform_review_subscription_request_v31', {
      p_request_id: requestId,
      p_decision: decision,
      p_notes: notes,
      p_apply: apply
    });
  },

  listOnboarding(status?: string): Promise<OnboardingRecord[]> {
    return rpc<OnboardingRecord[]>('platform_list_onboarding_v31', { p_status: status || null });
  },

  provisionOrganization(input: { name: string; slug: string; adminEmail: string; planId: string; billingInterval: string; trialDays?: number | null; reason: string }): Promise<Record<string, unknown>> {
    return rpc<Record<string, unknown>>('platform_provision_organization_v31', {
      p_name: input.name,
      p_slug: input.slug,
      p_admin_email: input.adminEmail,
      p_plan_id: input.planId,
      p_billing_interval: input.billingInterval,
      p_trial_days: input.trialDays ?? null,
      p_reason: input.reason
    });
  },

  updateOnboarding(input: { organizationId: string; status: string; currentStep: string; checklist: Record<string, boolean>; notes: string; blockingReason?: string }): Promise<Record<string, unknown>> {
    return rpc<Record<string, unknown>>('platform_update_onboarding_v31', {
      p_organization_id: input.organizationId,
      p_status: input.status,
      p_current_step: input.currentStep,
      p_checklist: input.checklist,
      p_notes: input.notes,
      p_blocking_reason: input.blockingReason || null
    });
  },

  getOrganizationSubscriptionPortal(): Promise<OrganizationSubscriptionPortal> {
    return rpc<OrganizationSubscriptionPortal>('organization_get_subscription_portal_v31');
  },

  requestOrganizationSubscriptionChange(requestType: string, payload: Record<string, unknown>, reason: string): Promise<Record<string, unknown>> {
    return rpc<Record<string, unknown>>('organization_request_subscription_change_v31', {
      p_request_type: requestType,
      p_payload: payload,
      p_reason: reason
    });
  }

};
