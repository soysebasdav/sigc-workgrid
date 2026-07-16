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
  SupportTicket
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
    const result = await rpc<unknown>('platform_get_context_v1');
    const row = asRecord(result);
    return {
      isPlatformAdmin: Boolean(row.isPlatformAdmin ?? row.is_platform_admin),
      userId: row.userId ? String(row.userId) : row.user_id ? String(row.user_id) : null,
      roleCode: String(row.roleCode ?? row.role_code ?? '') as PlatformAccessContext['roleCode'],
      roleName: String(row.roleName ?? row.role_name ?? 'Sin acceso de plataforma'),
      permissions: asArray<string>(row.permissions).map(String)
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
  }
};
