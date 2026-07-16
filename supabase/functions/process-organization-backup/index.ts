import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const BACKUP_BUCKET = 'organization-backups';
const PAGE_SIZE = 1000;

const DIRECT_ORGANIZATION_TABLES = [
  'organization_members', 'organization_member_areas', 'organization_branding', 'organization_subscriptions',
  'organization_invitations', 'organization_holidays', 'areas', 'priorities', 'case_types',
  'case_type_default_areas', 'case_type_fields', 'case_states', 'state_transitions', 'sla_policies',
  'case_counters', 'cases', 'case_assignments', 'case_state_history', 'case_sla_overrides',
  'case_subtasks', 'case_comments', 'case_documents', 'document_versions', 'case_reviews', 'case_deliveries',
  'notifications', 'reminder_rules', 'case_reminder_log', 'email_templates', 'email_runtime_settings',
  'email_queue', 'sigc_email_outbox', 'automation_rules', 'automation_rule_versions',
  'automation_executions', 'automation_execution_keys', 'report_export_jobs', 'client_case_access',
  'public_intake_security', 'public_intake_challenges', 'public_submission_events',
  'public_submission_consents', 'public_case_upload_sessions', 'sigc_quality_runs', 'sigc_quality_results',
  'app_error_logs', 'rate_limit_buckets', 'support_tickets', 'support_ticket_messages',
  'organization_subscription_events', 'organization_usage_snapshots',
  'platform_support_access_requests', 'support_ticket_events', 'organization_backup_schedules',
  'backup_restore_requests', 'organization_feature_flags', 'organization_limit_alerts', 'platform_job_runs',
  'organization_billing_accounts', 'organization_subscription_addons',
  'billing_orders', 'billing_invoices', 'billing_payments',
  'subscription_change_requests', 'organization_onboarding', 'commercial_events',
  'integration_api_request_logs', 'integration_webhook_endpoints',
  'integration_webhook_deliveries', 'integration_domains', 'organization_sso_configurations',
  'organization_email_channels', 'integration_connectors',
  'knowledge_categories', 'knowledge_articles',
  'organization_continuity_policies', 'backup_verification_runs', 'privacy_requests', 'privacy_request_events',
  'organization_retention_policies', 'retention_runs', 'organization_regional_settings'
] as const;

type JsonRecord = Record<string, unknown>;

type BackupJob = {
  id: string;
  organization_id: string;
  scope: 'full' | 'database' | 'documents' | 'configuration';
  status: string;
  expires_at?: string | null;
};

function response(status: number, body: JsonRecord): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

async function fetchAll(client: SupabaseClient, table: string, column: string, value: string): Promise<JsonRecord[]> {
  const rows: JsonRecord[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await client.from(table).select('*').eq(column, value).range(from, from + PAGE_SIZE - 1);
    if (error) {
      // Algunas instalaciones pueden no tener todavía una tabla opcional. Se registra en el manifiesto sin detener todo el backup.
      if (/does not exist|schema cache/i.test(error.message)) return [{ __backup_warning: error.message }];
      throw new Error(`${table}: ${error.message}`);
    }
    const page = (data ?? []) as JsonRecord[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

async function fetchByIds(client: SupabaseClient, table: string, column: string, ids: string[]): Promise<JsonRecord[]> {
  if (!ids.length) return [];
  const rows: JsonRecord[] = [];
  for (let index = 0; index < ids.length; index += 200) {
    const chunk = ids.slice(index, index + 200);
    const { data, error } = await client.from(table).select('*').in(column, chunk);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...((data ?? []) as JsonRecord[]));
  }
  return rows;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function gzipText(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function copyDocumentFiles(service: SupabaseClient, documentPaths: string[], backupPrefix: string): Promise<{ copied: number; failed: number; bytes: number; warnings: string[] }> {
  let copied = 0;
  let failed = 0;
  let bytes = 0;
  const warnings: string[] = [];
  for (let index = 0; index < documentPaths.length; index += 5) {
    const chunk = documentPaths.slice(index, index + 5);
    const results = await Promise.all(chunk.map(async (sourcePath) => {
      try {
        const { data, error } = await service.storage.from('case-documents').download(sourcePath);
        if (error || !data) throw new Error(error?.message || 'Archivo no encontrado');
        const targetPath = `${backupPrefix}/documents/${sourcePath}`;
        const { error: uploadError } = await service.storage.from(BACKUP_BUCKET).upload(targetPath, data, {
          contentType: data.type || 'application/octet-stream',
          upsert: true,
          cacheControl: '3600'
        });
        if (uploadError) throw new Error(uploadError.message);
        return { ok: true, size: data.size };
      } catch (error) {
        return { ok: false, sourcePath, message: error instanceof Error ? error.message : 'Error desconocido' };
      }
    }));
    for (const result of results) {
      if (result.ok) { copied += 1; bytes += Number(result.size || 0); }
      else { failed += 1; warnings.push(`${result.sourcePath}: ${result.message}`); }
    }
  }
  return { copied, failed, bytes, warnings: warnings.slice(0, 100) };
}

async function buildBackup(service: SupabaseClient, job: BackupJob): Promise<{ bytes: Uint8Array; manifest: JsonRecord }> {
  const organizationId = job.organization_id;
  const tables: Record<string, JsonRecord[]> = {};
  const counts: Record<string, number> = {};

  const { data: organization, error: orgError } = await service.from('organizations').select('*').eq('id', organizationId).single();
  if (orgError) throw new Error(`organizations: ${orgError.message}`);
  tables.organizations = [organization as JsonRecord];

  for (const table of DIRECT_ORGANIZATION_TABLES) {
    if (job.scope === 'configuration' && ![
      'organization_members', 'organization_member_areas', 'organization_branding', 'organization_subscriptions',
      'organization_invitations', 'organization_holidays', 'areas', 'priorities', 'case_types',
      'case_type_default_areas', 'case_type_fields', 'case_states', 'state_transitions', 'sla_policies',
      'reminder_rules', 'email_templates', 'email_runtime_settings', 'automation_rules', 'automation_rule_versions',
      'public_intake_security', 'organization_backup_schedules', 'organization_feature_flags',
      'organization_continuity_policies', 'organization_retention_policies', 'organization_regional_settings',
      'organization_billing_accounts', 'organization_subscription_addons',
      'integration_webhook_endpoints', 'integration_domains', 'organization_sso_configurations',
      'organization_email_channels', 'integration_connectors', 'knowledge_categories', 'knowledge_articles'
    ].includes(table)) continue;
    if (job.scope === 'documents' && !['case_documents', 'document_versions'].includes(table)) continue;
    const rows = await fetchAll(service, table, 'organization_id', organizationId);
    tables[table] = rows;
    counts[table] = rows.length;
  }

  if (job.scope !== 'documents') {
    const roleIds = (tables.roles ?? await fetchAll(service, 'roles', 'organization_id', organizationId)).map((row) => String(row.id ?? '')).filter(Boolean);
    tables.roles = tables.roles ?? await fetchAll(service, 'roles', 'organization_id', organizationId);
    tables.role_permissions = await fetchByIds(service, 'role_permissions', 'role_id', roleIds);
    const caseTypeIds = (tables.case_types ?? []).map((row) => String(row.id ?? '')).filter(Boolean);
    tables.case_type_states = await fetchByIds(service, 'case_type_states', 'case_type_id', caseTypeIds);
    const memberUserIds = (tables.organization_members ?? []).map((row) => String(row.user_id ?? '')).filter(Boolean);
    tables.profiles = await fetchByIds(service, 'profiles', 'id', memberUserIds);
    const subscriptionPlanIds = (tables.organization_subscriptions ?? []).map((row) => String(row.plan_id ?? '')).filter(Boolean);
    tables.saas_plans = await fetchByIds(service, 'saas_plans', 'id', subscriptionPlanIds);
    const orderIds = (tables.billing_orders ?? []).map((row) => String(row.id ?? '')).filter(Boolean);
    tables.billing_order_lines = await fetchByIds(service, 'billing_order_lines', 'order_id', orderIds);
    const invoiceIds = (tables.billing_invoices ?? []).map((row) => String(row.id ?? '')).filter(Boolean);
    tables.billing_invoice_lines = await fetchByIds(service, 'billing_invoice_lines', 'invoice_id', invoiceIds);
    const paymentIds = (tables.billing_payments ?? []).map((row) => String(row.id ?? '')).filter(Boolean);
    tables.billing_payment_allocations = await fetchByIds(service, 'billing_payment_allocations', 'payment_id', paymentIds);
    const articleIds = (tables.knowledge_articles ?? []).map((row) => String(row.id ?? '')).filter(Boolean);
    tables.knowledge_article_feedback = await fetchByIds(service, 'knowledge_article_feedback', 'article_id', articleIds);
    for (const name of ['roles', 'role_permissions', 'case_type_states', 'profiles', 'saas_plans', 'billing_order_lines', 'billing_invoice_lines', 'billing_payment_allocations', 'knowledge_article_feedback']) counts[name] = tables[name]?.length ?? 0;
  }

  if (tables.organization_sso_configurations) tables.organization_sso_configurations = tables.organization_sso_configurations.map(({ secret_ref: _secretRef, ...row }) => row);
  if (tables.organization_email_channels) tables.organization_email_channels = tables.organization_email_channels.map(({ secret_ref: _secretRef, ...row }) => row);
  if (tables.integration_connectors) tables.integration_connectors = tables.integration_connectors.map(({ secret_ref: _secretRef, ...row }) => row);
  const documentPaths = (tables.document_versions ?? []).map((row) => String(row.storage_path ?? '')).filter(Boolean);
  const payload = {
    format: 'orkesta-organization-logical-backup',
    version: 1,
    generatedAt: new Date().toISOString(),
    organizationId,
    backupJobId: job.id,
    scope: job.scope,
    notice: 'El backup contiene datos lógicos y metadatos de archivos. No contiene contraseñas ni secretos de autenticación.',
    documentStoragePaths: documentPaths,
    tables
  };
  const raw = JSON.stringify(payload);
  const bytes = await gzipText(raw);
  const manifest = {
    format: 'json.gz',
    schemaVersion: 1,
    tableCounts: counts,
    documentStoragePaths: documentPaths,
    uncompressedBytes: new TextEncoder().encode(raw).byteLength,
    generatedAt: payload.generatedAt
  };
  return { bytes, manifest };
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return response(405, { error: 'METHOD_NOT_ALLOWED' });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) return response(500, { error: 'BACKUP_FUNCTION_NOT_CONFIGURED' });

  const authorization = request.headers.get('authorization') ?? '';
  if (!authorization.toLowerCase().startsWith('bearer ')) return response(401, { error: 'AUTH_REQUIRED' });

  const authorizedByServiceKey = authorization === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
  if (!authorizedByServiceKey) {
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authorization } } });
    const { data: access, error: accessError } = await userClient.rpc('platform_get_context_v2');
    const permissions = Array.isArray(access?.permissions) ? access.permissions.map(String) : [];
    if (accessError || !access?.isPlatformAdmin || (!permissions.includes('platform.*') && !permissions.includes('platform.backups.manage'))) {
      return response(403, { error: 'PLATFORM_ACCESS_DENIED' });
    }
  }

  const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  let jobId = '';
  try {
    const body = await request.json() as { jobId?: string };
    jobId = String(body.jobId ?? '');
    if (!/^[0-9a-f-]{36}$/i.test(jobId)) return response(400, { error: 'INVALID_JOB_ID' });

    const { data: jobData, error: jobError } = await service.from('organization_backup_jobs').select('id,organization_id,scope,status,expires_at').eq('id', jobId).single();
    if (jobError || !jobData) return response(404, { error: 'BACKUP_JOB_NOT_FOUND' });
    const job = jobData as BackupJob;
    if (!['queued', 'processing'].includes(job.status)) return response(409, { error: 'BACKUP_JOB_NOT_PROCESSABLE', status: job.status });

    await service.from('organization_backup_jobs').update({ status: 'processing', started_at: new Date().toISOString(), error_message: null }).eq('id', jobId);
    const { bytes, manifest } = await buildBackup(service, job);
    const checksum = await sha256Hex(bytes);
    const now = new Date();
    const backupPrefix = `${job.organization_id}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${job.id}`;
    const storagePath = `${backupPrefix}/organization-data.json.gz`;

    const { error: uploadError } = await service.storage.from(BACKUP_BUCKET).upload(storagePath, bytes, {
      contentType: 'application/gzip',
      upsert: true,
      cacheControl: '3600'
    });
    if (uploadError) throw new Error(`storage: ${uploadError.message}`);

    const documentPaths = Array.isArray(manifest.documentStoragePaths) ? manifest.documentStoragePaths as string[] : [];
    const documentCopy = ['full', 'documents'].includes(job.scope)
      ? await copyDocumentFiles(service, documentPaths, backupPrefix)
      : { copied: 0, failed: 0, bytes: 0, warnings: [] as string[] };
    const finalManifest = { ...manifest, backupPrefix, documentCopy };

    const completedAt = new Date().toISOString();
    const { error: updateError } = await service.from('organization_backup_jobs').update({
      status: documentCopy.failed > 0 ? 'completed' : 'completed', storage_path: storagePath, manifest: finalManifest,
      size_bytes: bytes.byteLength + documentCopy.bytes, checksum, completed_at: completedAt,
      expires_at: job.expires_at || new Date(Date.now() + 90 * 86400000).toISOString(),
      error_message: documentCopy.failed > 0 ? `${documentCopy.failed} documento(s) no pudieron copiarse. Consulte el manifiesto.` : null
    }).eq('id', jobId);
    if (updateError) throw new Error(`job: ${updateError.message}`);
    await service.from('organization_backup_schedules').update({
      last_status: documentCopy.failed > 0 ? 'completed_with_warnings' : 'completed',
      last_run_at: completedAt,
      updated_at: completedAt
    }).eq('organization_id', job.organization_id);

    return response(200, { ok: true, jobId, storagePath, sizeBytes: bytes.byteLength + documentCopy.bytes, checksum, manifest: finalManifest });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_BACKUP_ERROR';
    if (jobId) {
      const failedAt = new Date().toISOString();
      const { data: failedJob } = await service.from('organization_backup_jobs').select('organization_id').eq('id', jobId).maybeSingle();
      await service.from('organization_backup_jobs').update({ status: 'failed', error_message: message, completed_at: failedAt }).eq('id', jobId);
      if (failedJob?.organization_id) {
        await service.from('organization_backup_schedules').update({ last_status: 'failed', last_run_at: failedAt, updated_at: failedAt }).eq('organization_id', failedJob.organization_id);
      }
    }
    return response(500, { error: message, jobId });
  }
});
