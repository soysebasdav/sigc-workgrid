import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const BACKUP_BUCKET = 'organization-backups';
const DOCUMENT_BUCKET = 'case-documents';

type JsonRecord = Record<string, unknown>;
type RestoreRequest = {
  id: string;
  organization_id: string;
  backup_job_id: string;
  restore_mode: 'merge' | 'replace';
  target_environment: 'validation' | 'production';
  status: string;
  confirmation_code: string;
};

type BackupPayload = {
  format: string;
  version: number;
  organizationId: string;
  backupJobId: string;
  scope: string;
  documentStoragePaths?: string[];
  tables: Record<string, JsonRecord[]>;
};

const ORG_TABLE_ORDER = [
  'organization_branding', 'organization_subscriptions', 'organization_holidays',
  'areas', 'priorities', 'email_templates', 'case_types', 'case_type_fields', 'case_states',
  'sla_policies', 'state_transitions', 'roles', 'organization_members', 'organization_member_areas',
  'case_type_default_areas', 'case_counters', 'cases', 'case_assignments', 'case_state_history',
  'case_sla_overrides', 'case_subtasks', 'case_comments', 'case_documents', 'document_versions',
  'case_reviews', 'case_deliveries', 'notifications', 'reminder_rules', 'case_reminder_log',
  'email_runtime_settings', 'email_queue', 'sigc_email_outbox', 'automation_rules',
  'automation_rule_versions', 'automation_executions', 'automation_execution_keys',
  'report_export_jobs', 'client_case_access', 'public_intake_security', 'public_intake_challenges',
  'public_submission_events', 'public_submission_consents', 'public_case_upload_sessions',
  'sigc_quality_runs', 'sigc_quality_results', 'app_error_logs', 'rate_limit_buckets',
  'support_tickets', 'support_ticket_messages', 'organization_usage_snapshots',
  'organization_backup_schedules', 'organization_feature_flags',
  'organization_billing_accounts', 'organization_subscription_addons', 'billing_orders', 'billing_invoices',
  'billing_payments', 'subscription_change_requests', 'organization_onboarding', 'commercial_events',
  'integration_api_request_logs', 'integration_webhook_endpoints', 'integration_webhook_deliveries',
  'integration_domains', 'organization_sso_configurations', 'organization_email_channels',
  'integration_connectors', 'knowledge_categories', 'knowledge_articles',
  'organization_continuity_policies', 'backup_verification_runs', 'privacy_requests',
  'organization_retention_policies', 'retention_runs', 'organization_regional_settings'
] as const;

const JOIN_TABLES: Record<string, { key: string }> = {
  role_permissions: { key: 'role_id,permission_id' },
  case_type_states: { key: 'case_type_id,state_id' },
  billing_order_lines: { key: 'id' },
  billing_invoice_lines: { key: 'id' },
  billing_payment_allocations: { key: 'id' },
  knowledge_article_feedback: { key: 'article_id,user_id' }
};

const ON_CONFLICT: Record<string, string> = {
  organization_branding: 'organization_id', organization_subscriptions: 'organization_id',
  organization_holidays: 'id', areas: 'id', priorities: 'id', email_templates: 'id', case_types: 'id',
  case_type_fields: 'id', case_states: 'id', sla_policies: 'id', state_transitions: 'id', roles: 'id',
  organization_members: 'id', organization_member_areas: 'id', case_type_default_areas: 'id',
  case_counters: 'organization_id,year', cases: 'id', case_assignments: 'id', case_state_history: 'id',
  case_sla_overrides: 'id', case_subtasks: 'id', case_comments: 'id', case_documents: 'id',
  document_versions: 'id', case_reviews: 'id', case_deliveries: 'id', notifications: 'id',
  reminder_rules: 'id', case_reminder_log: 'id', email_runtime_settings: 'organization_id',
  email_queue: 'id', sigc_email_outbox: 'id', automation_rules: 'id', automation_rule_versions: 'id',
  automation_executions: 'id', automation_execution_keys: 'id', report_export_jobs: 'id',
  client_case_access: 'id', public_intake_security: 'organization_id', public_intake_challenges: 'id',
  public_submission_events: 'id', public_submission_consents: 'id', public_case_upload_sessions: 'id',
  sigc_quality_runs: 'id', sigc_quality_results: 'id', app_error_logs: 'id',
  rate_limit_buckets: 'organization_id,limiter_key,window_started_at', support_tickets: 'id',
  support_ticket_messages: 'id', organization_usage_snapshots: 'organization_id,snapshot_date',
  organization_backup_schedules: 'organization_id', organization_feature_flags: 'organization_id,feature_code',
  organization_billing_accounts: 'organization_id', organization_subscription_addons: 'id', billing_orders: 'id',
  billing_invoices: 'id', billing_payments: 'id', subscription_change_requests: 'id', organization_onboarding: 'organization_id',
  commercial_events: 'id', integration_api_request_logs: 'id', integration_webhook_endpoints: 'id',
  integration_webhook_deliveries: 'id', integration_domains: 'id', organization_sso_configurations: 'organization_id',
  organization_email_channels: 'organization_id', integration_connectors: 'id',
  knowledge_categories: 'id', knowledge_articles: 'id',
  organization_continuity_policies: 'organization_id', backup_verification_runs: 'id', privacy_requests: 'id',
  organization_retention_policies: 'id', retention_runs: 'id', organization_regional_settings: 'organization_id'
};

function response(status: number, body: JsonRecord): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}

async function ungzip(blob: Blob): Promise<string> {
  const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
  return await new Response(stream).text();
}

async function getPlatformAccess(authorization: string): Promise<JsonRecord> {
  const user = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authorization } } });
  const { data, error } = await user.rpc('platform_get_context_v2');
  if (error) throw new Error(error.message);
  return data as JsonRecord;
}

function hasPermission(access: JsonRecord, code: string): boolean {
  const permissions = Array.isArray(access.permissions) ? access.permissions.map(String) : [];
  return permissions.includes('platform.*') || permissions.includes(code);
}

async function updateRestore(service: SupabaseClient, id: string, values: JsonRecord): Promise<void> {
  const { error } = await service.from('backup_restore_requests').update({ ...values, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

async function event(service: SupabaseClient, id: string, eventType: string, detail: JsonRecord): Promise<void> {
  await service.from('backup_restore_events').insert({ restore_request_id: id, event_type: eventType, detail });
}

async function loadPayload(service: SupabaseClient, restore: RestoreRequest): Promise<{ payload: BackupPayload; backup: JsonRecord; rawBytes: number }> {
  const { data: backup, error: backupError } = await service.from('organization_backup_jobs').select('*').eq('id', restore.backup_job_id).single();
  if (backupError || !backup?.storage_path) throw new Error(backupError?.message || 'BACKUP_STORAGE_PATH_MISSING');
  const { data: blob, error: downloadError } = await service.storage.from(BACKUP_BUCKET).download(String(backup.storage_path));
  if (downloadError || !blob) throw new Error(downloadError?.message || 'BACKUP_DOWNLOAD_FAILED');
  const raw = await ungzip(blob);
  const payload = JSON.parse(raw) as BackupPayload;
  if (payload.format !== 'orkesta-organization-logical-backup') throw new Error('INVALID_BACKUP_FORMAT');
  if (payload.organizationId !== restore.organization_id) throw new Error('BACKUP_ORGANIZATION_MISMATCH');
  if (!payload.tables || typeof payload.tables !== 'object') throw new Error('BACKUP_TABLES_MISSING');
  return { payload, backup: backup as JsonRecord, rawBytes: new TextEncoder().encode(raw).byteLength };
}

function validationReport(payload: BackupPayload, rawBytes: number): JsonRecord {
  const tableCounts = Object.fromEntries(Object.entries(payload.tables).map(([table, rows]) => [table, Array.isArray(rows) ? rows.length : 0]));
  const warnings = Object.entries(payload.tables).flatMap(([table, rows]) => (rows || []).filter((row) => row.__backup_warning).map((row) => `${table}: ${String(row.__backup_warning)}`));
  return {
    valid: warnings.length === 0,
    format: payload.format,
    version: payload.version,
    scope: payload.scope,
    tableCounts,
    documentCount: payload.documentStoragePaths?.length ?? 0,
    uncompressedBytes: rawBytes,
    warnings,
    validatedAt: new Date().toISOString()
  };
}

async function deleteOrganizationData(service: SupabaseClient, organizationId: string, payload: BackupPayload): Promise<void> {
  const roleIds = ((payload.tables.roles ?? []) as JsonRecord[]).map((row) => String(row.id ?? '')).filter(Boolean);
  const caseTypeIds = ((payload.tables.case_types ?? []) as JsonRecord[]).map((row) => String(row.id ?? '')).filter(Boolean);
  if (roleIds.length) await service.from('role_permissions').delete().in('role_id', roleIds);
  if (caseTypeIds.length) await service.from('case_type_states').delete().in('case_type_id', caseTypeIds);
  const orderIds = ((payload.tables.billing_orders ?? []) as JsonRecord[]).map((row) => String(row.id ?? '')).filter(Boolean);
  const invoiceIds = ((payload.tables.billing_invoices ?? []) as JsonRecord[]).map((row) => String(row.id ?? '')).filter(Boolean);
  const paymentIds = ((payload.tables.billing_payments ?? []) as JsonRecord[]).map((row) => String(row.id ?? '')).filter(Boolean);
  const articleIds = ((payload.tables.knowledge_articles ?? []) as JsonRecord[]).map((row) => String(row.id ?? '')).filter(Boolean);
  if (orderIds.length) await service.from('billing_order_lines').delete().in('order_id', orderIds);
  if (invoiceIds.length) await service.from('billing_invoice_lines').delete().in('invoice_id', invoiceIds);
  if (paymentIds.length) await service.from('billing_payment_allocations').delete().in('payment_id', paymentIds);
  if (articleIds.length) await service.from('knowledge_article_feedback').delete().in('article_id', articleIds);
  for (const table of [...ORG_TABLE_ORDER].reverse()) {
    if (!payload.tables[table]) continue;
    const { error } = await service.from(table).delete().eq('organization_id', organizationId);
    if (error && !/does not exist|schema cache/i.test(error.message)) throw new Error(`${table} delete: ${error.message}`);
  }
}

async function upsertRows(service: SupabaseClient, table: string, rows: JsonRecord[]): Promise<number> {
  const cleanRows = rows.filter((row) => !row.__backup_warning);
  if (!cleanRows.length) return 0;
  const key = JOIN_TABLES[table]?.key ?? ON_CONFLICT[table];
  if (!key) return 0;
  let applied = 0;
  for (let index = 0; index < cleanRows.length; index += 200) {
    const chunk = cleanRows.slice(index, index + 200);
    const { error } = await service.from(table).upsert(chunk, { onConflict: key, ignoreDuplicates: false });
    if (error) throw new Error(`${table} upsert: ${error.message}`);
    applied += chunk.length;
  }
  return applied;
}

async function restoreFiles(service: SupabaseClient, backup: JsonRecord, paths: string[]): Promise<JsonRecord> {
  const storagePath = String(backup.storage_path ?? '');
  const backupPrefix = storagePath.replace(/\/organization-data\.json\.gz$/, '');
  let copied = 0;
  const warnings: string[] = [];
  for (const sourcePath of paths) {
    try {
      const backupPath = `${backupPrefix}/documents/${sourcePath}`;
      const { data, error } = await service.storage.from(BACKUP_BUCKET).download(backupPath);
      if (error || !data) throw new Error(error?.message || 'NOT_FOUND');
      const { error: uploadError } = await service.storage.from(DOCUMENT_BUCKET).upload(sourcePath, data, { upsert: true, contentType: data.type || 'application/octet-stream' });
      if (uploadError) throw new Error(uploadError.message);
      copied += 1;
    } catch (error) {
      warnings.push(`${sourcePath}: ${error instanceof Error ? error.message : 'UNKNOWN'}`);
    }
  }
  return { copied, failed: warnings.length, warnings: warnings.slice(0, 100) };
}

async function applyRestore(service: SupabaseClient, restore: RestoreRequest, payload: BackupPayload, backup: JsonRecord): Promise<JsonRecord> {
  if (restore.restore_mode === 'replace') await deleteOrganizationData(service, restore.organization_id, payload);
  const applied: Record<string, number> = {};

  // La organización se actualiza sin sustituir su ID ni campos de control de plataforma.
  const orgSource = payload.tables.organizations?.[0];
  if (orgSource) {
    const { id: _id, created_by: _createdBy, ...safeOrg } = orgSource;
    const { error } = await service.from('organizations').update({ ...safeOrg, updated_at: new Date().toISOString() }).eq('id', restore.organization_id);
    if (error) throw new Error(`organizations update: ${error.message}`);
    applied.organizations = 1;
  }

  for (const table of ORG_TABLE_ORDER) {
    const rows = payload.tables[table];
    if (!Array.isArray(rows) || !rows.length) continue;
    if (table === 'organization_members') {
      const existingProfiles = new Set<string>();
      const userIds = rows.map((row) => String(row.user_id ?? '')).filter(Boolean);
      for (let index = 0; index < userIds.length; index += 200) {
        const { data } = await service.from('profiles').select('id').in('id', userIds.slice(index, index + 200));
        for (const row of data ?? []) existingProfiles.add(String(row.id));
      }
      applied[table] = await upsertRows(service, table, rows.filter((row) => existingProfiles.has(String(row.user_id ?? ''))));
      continue;
    }
    applied[table] = await upsertRows(service, table, rows);
  }
  for (const table of Object.keys(JOIN_TABLES)) {
    const rows = payload.tables[table];
    if (Array.isArray(rows)) applied[table] = await upsertRows(service, table, rows);
  }

  // API keys y secretos de webhook nunca se incluyen en backups. Los endpoints restaurados
  // sin secreto se deshabilitan para evitar entregas fallidas o una falsa continuidad.
  const { data: restoredEndpoints } = await service.from('integration_webhook_endpoints')
    .select('id').eq('organization_id', String(restore.organization_id));
  const endpointIds = (restoredEndpoints ?? []).map((row) => String(row.id));
  if (endpointIds.length) {
    const { data: secretRows } = await service.from('integration_webhook_secrets').select('endpoint_id').in('endpoint_id', endpointIds);
    const withSecret = new Set((secretRows ?? []).map((row) => String(row.endpoint_id)));
    const withoutSecret = endpointIds.filter((id) => !withSecret.has(id));
    if (withoutSecret.length) await service.from('integration_webhook_endpoints').update({ status: 'disabled' }).in('id', withoutSecret);
  }

  const files = await restoreFiles(service, backup, payload.documentStoragePaths ?? []);
  return { applied, files, completedAt: new Date().toISOString(), mode: restore.restore_mode };
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return response(405, { error: 'METHOD_NOT_ALLOWED' });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) return response(500, { error: 'RESTORE_FUNCTION_NOT_CONFIGURED' });
  const authorization = request.headers.get('authorization') ?? '';
  if (!authorization.toLowerCase().startsWith('bearer ')) return response(401, { error: 'AUTH_REQUIRED' });

  let restoreRequestId = '';
  const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const access = await getPlatformAccess(authorization);
    if (!access.isPlatformAdmin || !hasPermission(access, 'platform.backups.restore')) return response(403, { error: 'PLATFORM_ACCESS_DENIED' });
    const body = await request.json() as { restoreRequestId?: string; operation?: 'validate' | 'apply'; confirmationCode?: string };
    restoreRequestId = String(body.restoreRequestId ?? '');
    const operation = body.operation ?? 'validate';
    if (!/^[0-9a-f-]{36}$/i.test(restoreRequestId)) return response(400, { error: 'INVALID_RESTORE_REQUEST_ID' });
    const { data, error } = await service.from('backup_restore_requests').select('*').eq('id', restoreRequestId).single();
    if (error || !data) return response(404, { error: 'RESTORE_REQUEST_NOT_FOUND' });
    const restore = data as RestoreRequest;
    if (!['approved', 'ready', 'validating', 'applying'].includes(restore.status)) return response(409, { error: 'RESTORE_NOT_PROCESSABLE', status: restore.status });

    if (operation === 'validate') {
      await updateRestore(service, restore.id, { status: 'validating', started_at: new Date().toISOString(), error_message: null });
      await event(service, restore.id, 'restore.validation_started', {});
      const { payload, rawBytes } = await loadPayload(service, restore);
      const report = validationReport(payload, rawBytes);
      await updateRestore(service, restore.id, { status: 'ready', validation_report: report, error_message: report.valid ? null : 'El backup contiene advertencias; revise el informe.' });
      await event(service, restore.id, 'restore.validation_completed', report);
      return response(200, { ok: true, operation, restoreRequestId, report });
    }

    if (restore.target_environment !== 'production') return response(409, { error: 'VALIDATION_REQUEST_CANNOT_APPLY_TO_PRODUCTION' });
    if (restore.status !== 'ready') return response(409, { error: 'RESTORE_MUST_BE_VALIDATED_FIRST' });
    if (String(body.confirmationCode ?? '').toUpperCase() !== restore.confirmation_code.toUpperCase()) return response(400, { error: 'INVALID_CONFIRMATION_CODE' });

    await updateRestore(service, restore.id, { status: 'applying', started_at: new Date().toISOString(), error_message: null });
    await event(service, restore.id, 'restore.apply_started', { mode: restore.restore_mode });
    const { payload, backup } = await loadPayload(service, restore);
    const report = await applyRestore(service, restore, payload, backup);
    await updateRestore(service, restore.id, { status: 'completed', restore_report: report, completed_at: new Date().toISOString() });
    await event(service, restore.id, 'restore.apply_completed', report);
    return response(200, { ok: true, operation, restoreRequestId, report });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'RESTORE_FAILED';
    if (restoreRequestId) {
      await updateRestore(service, restoreRequestId, { status: 'failed', error_message: message, completed_at: new Date().toISOString() }).catch(() => undefined);
      await event(service, restoreRequestId, 'restore.failed', { error: message }).catch(() => undefined);
    }
    return response(500, { error: message, restoreRequestId });
  }
});
