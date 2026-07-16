import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CRON_SECRET = Deno.env.get('PLATFORM_CRON_SECRET') ?? '';
const EXPORT_BUCKET = 'organization-exports';
const PAGE_SIZE = 1000;

type Json = Record<string, unknown>;

type Access = {
  service: boolean;
  platform: boolean;
  permissions: string[];
  userId: string | null;
};

function response(status: number, body: Json): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}

function safeText(value: unknown, max = 4096): string {
  return String(value ?? '').slice(0, max);
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hmacHex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function gzipText(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function isPrivateAddress(value: string): boolean {
  const ip = value.trim().toLowerCase();
  if (/^(10\.|127\.|0\.|169\.254\.|192\.168\.)/.test(ip)) return true;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (v4) {
    const first = Number(v4[1]);
    const second = Number(v4[2]);
    if (first === 172 && second >= 16 && second <= 31) return true;
    if (first === 100 && second >= 64 && second <= 127) return true;
    if (first >= 224) return true;
  }
  return ip === '::1' || ip === '::' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe8') || ip.startsWith('fe9') || ip.startsWith('fea') || ip.startsWith('feb');
}

async function assertPublicWebhookDestination(rawUrl: string): Promise<void> {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:') throw new Error('WEBHOOK_HTTPS_REQUIRED');
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) throw new Error('WEBHOOK_PRIVATE_HOST_BLOCKED');
  if (isPrivateAddress(hostname)) throw new Error('WEBHOOK_PRIVATE_HOST_BLOCKED');
  const answers: string[] = [];
  for (const type of ['A', 'AAAA']) {
    const dns = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`, { headers: { accept: 'application/dns-json' } });
    if (!dns.ok) throw new Error(`WEBHOOK_DNS_HTTP_${dns.status}`);
    const body = await dns.json() as { Answer?: Array<{ data?: string }> };
    answers.push(...(body.Answer ?? []).map((item) => String(item.data ?? '')).filter(Boolean));
  }
  if (!answers.length) throw new Error('WEBHOOK_DNS_NOT_RESOLVED');
  if (answers.some(isPrivateAddress)) throw new Error('WEBHOOK_PRIVATE_DESTINATION_BLOCKED');
}

async function authorize(request: Request): Promise<Access> {
  const authorization = request.headers.get('authorization') ?? '';
  const cronSecret = request.headers.get('x-cron-secret') ?? '';
  if (authorization === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` || (CRON_SECRET && cronSecret === CRON_SECRET)) {
    return { service: true, platform: true, permissions: ['platform.*'], userId: null };
  }
  if (!authorization.toLowerCase().startsWith('bearer ')) return { service: false, platform: false, permissions: [], userId: null };
  const user = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authorization } } });
  const [{ data: context }, { data: authData }] = await Promise.all([
    user.rpc('platform_get_context_v2'),
    user.auth.getUser()
  ]);
  const permissions = Array.isArray(context?.permissions) ? context.permissions.map(String) : [];
  return { service: false, platform: Boolean(context?.isPlatformAdmin), permissions, userId: authData?.user?.id ?? null };
}

function can(access: Access, permission: string): boolean {
  return access.service || (access.platform && (access.permissions.includes('platform.*') || access.permissions.includes(permission)));
}

async function canManageOrganizationResource(request: Request, resource: 'webhook' | 'domain' | 'export', id: string, permission: string): Promise<boolean> {
  const authorization = request.headers.get('authorization') ?? '';
  if (!authorization.toLowerCase().startsWith('bearer ') || !/^[0-9a-f-]{36}$/i.test(id)) return false;
  const user = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authorization } } });
  const { data, error } = await user.rpc('integration_can_access_resource_v32', {
    p_resource: resource,
    p_resource_id: id,
    p_permission: permission
  });
  return !error && data === true;
}

async function deliverWebhook(service: SupabaseClient, deliveryId: string): Promise<Json> {
  const { data: delivery, error } = await service.from('integration_webhook_deliveries')
    .select('*, endpoint:integration_webhook_endpoints(*)')
    .eq('id', deliveryId).single();
  if (error || !delivery) return { id: deliveryId, ok: false, error: error?.message ?? 'DELIVERY_NOT_FOUND' };
  if (!['queued', 'failed', 'delivering'].includes(delivery.status)) return { id: deliveryId, ok: false, skipped: true, status: delivery.status };
  const endpoint = delivery.endpoint as Json;
  const { data: secretRow, error: secretError } = await service.from('integration_webhook_secrets')
    .select('secret_value').eq('endpoint_id', String(endpoint.id ?? delivery.endpoint_id)).maybeSingle();
  if (secretError) return { id: deliveryId, ok: false, error: secretError.message };
  const secret = String(secretRow?.secret_value ?? '');
  if (!secret) return { id: deliveryId, ok: false, error: 'WEBHOOK_SECRET_NOT_FOUND' };

  const started = performance.now();
  const attempts = Number(delivery.attempts ?? 0) + 1;
  await service.from('integration_webhook_deliveries').update({ status: 'delivering', attempts, locked_at: new Date().toISOString() }).eq('id', deliveryId);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify(delivery.payload ?? {});
  const signature = await hmacHex(secret, `${timestamp}.${body}`);
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'user-agent': 'Orkesta-Webhooks/3.2',
    'x-orkesta-event': String(delivery.event_type),
    'x-orkesta-delivery': deliveryId,
    'x-orkesta-timestamp': timestamp,
    'x-orkesta-signature': `t=${timestamp},v1=${signature}`
  };
  const customHeaders = endpoint.custom_headers && typeof endpoint.custom_headers === 'object' ? endpoint.custom_headers as Record<string, unknown> : {};
  for (const [key, value] of Object.entries(customHeaders)) {
    if (!['authorization', 'host', 'content-length'].includes(key.toLowerCase())) headers[key] = String(value);
  }

  try {
    await assertPublicWebhookDestination(String(endpoint.endpoint_url));
    const timeout = Math.min(60000, Math.max(1000, Number(endpoint.timeout_ms ?? 15000)));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const webhookResponse = await fetch(String(endpoint.endpoint_url), { method: 'POST', headers, body, signal: controller.signal });
    clearTimeout(timer);
    const responseBody = safeText(await webhookResponse.text().catch(() => ''), 4096);
    const durationMs = Math.round(performance.now() - started);
    if (webhookResponse.ok) {
      await Promise.all([
        service.from('integration_webhook_deliveries').update({
          status: 'succeeded', delivered_at: new Date().toISOString(), locked_at: null, response_status: webhookResponse.status,
          response_body: responseBody, response_headers: Object.fromEntries(webhookResponse.headers.entries()), last_error: null, duration_ms: durationMs
        }).eq('id', deliveryId),
        service.from('integration_webhook_endpoints').update({ last_success_at: new Date().toISOString(), consecutive_failures: 0 }).eq('id', endpoint.id)
      ]);
      return { id: deliveryId, ok: true, status: webhookResponse.status, durationMs };
    }
    throw new Error(`HTTP_${webhookResponse.status}: ${responseBody}`);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'WEBHOOK_DELIVERY_FAILED';
    const maxAttempts = Number(delivery.max_attempts ?? endpoint.max_attempts ?? 8);
    const dead = attempts >= maxAttempts;
    const delayMinutes = Math.min(1440, 2 ** Math.min(attempts, 10));
    const nextAttemptAt = new Date(Date.now() + delayMinutes * 60000).toISOString();
    await Promise.all([
      service.from('integration_webhook_deliveries').update({
        status: dead ? 'dead_letter' : 'failed', locked_at: null, last_error: safeText(message),
        next_attempt_at: nextAttemptAt, duration_ms: Math.round(performance.now() - started)
      }).eq('id', deliveryId),
      service.from('integration_webhook_endpoints').update({
        last_failure_at: new Date().toISOString(), consecutive_failures: Number(endpoint.consecutive_failures ?? 0) + 1
      }).eq('id', endpoint.id)
    ]);
    return { id: deliveryId, ok: false, deadLetter: dead, error: message, nextAttemptAt };
  }
}

async function verifyDomain(service: SupabaseClient, domainId: string): Promise<Json> {
  const { data: row, error } = await service.from('integration_domains').select('*').eq('id', domainId).single();
  if (error || !row) return { id: domainId, ok: false, error: error?.message ?? 'DOMAIN_NOT_FOUND' };
  const recordName = String(row.verification_record_name);
  try {
    const dnsResponse = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(recordName)}&type=TXT`, {
      headers: { accept: 'application/dns-json' }
    });
    if (!dnsResponse.ok) throw new Error(`DNS_HTTP_${dnsResponse.status}`);
    const result = await dnsResponse.json() as { Answer?: Array<{ data?: string }> };
    const answers = (result.Answer ?? []).map((item) => String(item.data ?? '').replace(/^"|"$/g, '').replace(/"\s+"/g, ''));
    const verified = answers.includes(String(row.verification_token));
    await service.from('integration_domains').update({
      status: verified ? 'verified' : 'pending',
      last_checked_at: new Date().toISOString(),
      verified_at: verified ? new Date().toISOString() : row.verified_at,
      error_message: verified ? null : `No se encontró el TXT ${recordName}`
    }).eq('id', domainId);
    return { id: domainId, ok: verified, recordName, answers };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'DOMAIN_VERIFICATION_FAILED';
    await service.from('integration_domains').update({ last_checked_at: new Date().toISOString(), error_message: message }).eq('id', domainId);
    return { id: domainId, ok: false, error: message };
  }
}

const EXPORT_TABLES = [
  'organizations', 'organization_members', 'organization_member_areas', 'organization_branding', 'organization_subscriptions',
  'areas', 'priorities', 'case_types', 'case_type_default_areas', 'case_type_fields', 'case_states', 'state_transitions',
  'sla_policies', 'organization_holidays', 'cases', 'case_assignments', 'case_state_history', 'case_sla_overrides',
  'case_subtasks', 'case_comments', 'case_documents', 'document_versions', 'case_reviews', 'case_deliveries', 'audit_events',
  'notifications', 'automation_rules', 'automation_executions', 'support_tickets', 'support_ticket_messages',
  'organization_billing_accounts', 'billing_invoices', 'billing_invoice_lines', 'billing_payments',
  'integration_api_keys', 'integration_webhook_endpoints', 'integration_webhook_deliveries', 'integration_domains',
  'organization_sso_configurations', 'organization_email_channels', 'integration_connectors'
] as const;

async function fetchAll(service: SupabaseClient, table: string, organizationId: string): Promise<Json[]> {
  const rows: Json[] = [];
  let from = 0;
  while (true) {
    let query = service.from(table).select('*').range(from, from + PAGE_SIZE - 1);
    if (table === 'organizations') query = query.eq('id', organizationId);
    else query = query.eq('organization_id', organizationId);
    const { data, error } = await query;
    if (error) {
      if (/does not exist|column .* does not exist|schema cache/i.test(error.message)) return [{ __export_warning: error.message }];
      throw new Error(`${table}: ${error.message}`);
    }
    const page = (data ?? []) as Json[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

function exportIncludes(scope: string, table: string): boolean {
  if (scope === 'full') return true;
  if (scope === 'cases') return ['cases','case_assignments','case_state_history','case_sla_overrides','case_subtasks','case_comments','case_reviews','case_deliveries'].includes(table);
  if (scope === 'documents') return ['cases','case_documents','document_versions'].includes(table);
  if (scope === 'audit') return ['audit_events'].includes(table);
  if (scope === 'configuration') return ['organizations','organization_members','organization_member_areas','organization_branding','organization_subscriptions','areas','priorities','case_types','case_type_default_areas','case_type_fields','case_states','state_transitions','sla_policies','organization_holidays','automation_rules','integration_api_keys','integration_webhook_endpoints','integration_domains','organization_sso_configurations','organization_email_channels','integration_connectors'].includes(table);
  return false;
}

async function copyExportDocuments(service: SupabaseClient, paths: string[], prefix: string): Promise<Json> {
  let copied = 0;
  let failed = 0;
  let bytes = 0;
  const warnings: string[] = [];
  for (let index = 0; index < paths.length; index += 5) {
    const chunk = paths.slice(index, index + 5);
    const results = await Promise.all(chunk.map(async (sourcePath) => {
      try {
        const { data, error } = await service.storage.from('case-documents').download(sourcePath);
        if (error || !data) throw new Error(error?.message ?? 'FILE_NOT_FOUND');
        const target = `${prefix}/documents/${sourcePath}`;
        const { error: uploadError } = await service.storage.from(EXPORT_BUCKET).upload(target, data, { upsert: true, contentType: data.type || 'application/octet-stream' });
        if (uploadError) throw new Error(uploadError.message);
        return { ok: true, size: data.size };
      } catch (cause) {
        return { ok: false, error: cause instanceof Error ? cause.message : 'COPY_FAILED', sourcePath };
      }
    }));
    for (const item of results) {
      if (item.ok) { copied += 1; bytes += Number(item.size ?? 0); }
      else { failed += 1; warnings.push(`${item.sourcePath}: ${item.error}`); }
    }
  }
  return { copied, failed, bytes, warnings: warnings.slice(0, 100) };
}

async function processExport(service: SupabaseClient, exportId: string): Promise<Json> {
  const { data: job, error } = await service.from('organization_data_exports').select('*').eq('id', exportId).single();
  if (error || !job) return { id: exportId, ok: false, error: error?.message ?? 'EXPORT_NOT_FOUND' };
  if (!['queued', 'processing'].includes(job.status)) return { id: exportId, ok: false, skipped: true, status: job.status };
  await service.from('organization_data_exports').update({ status: 'processing', started_at: new Date().toISOString(), error_message: null }).eq('id', exportId);
  try {
    const tables: Record<string, Json[]> = {};
    const counts: Record<string, number> = {};
    for (const table of EXPORT_TABLES) {
      if (!exportIncludes(String(job.scope), table)) continue;
      const rows = await fetchAll(service, table, String(job.organization_id));
      tables[table] = rows;
      counts[table] = rows.length;
    }
    // Nunca exportar hashes de API ni referencias de secretos.
    if (tables.integration_api_keys) tables.integration_api_keys = tables.integration_api_keys.map(({ key_hash: _hash, ...row }) => row);
    if (tables.organization_sso_configurations) tables.organization_sso_configurations = tables.organization_sso_configurations.map(({ secret_ref: _secret, ...row }) => row);
    if (tables.organization_email_channels) tables.organization_email_channels = tables.organization_email_channels.map(({ secret_ref: _secret, ...row }) => row);
    if (tables.integration_connectors) tables.integration_connectors = tables.integration_connectors.map(({ secret_ref: _secret, ...row }) => row);

    const documentPaths = (tables.document_versions ?? []).map((row) => String(row.storage_path ?? '')).filter(Boolean);
    const generatedAt = new Date().toISOString();
    const payload = {
      format: 'orkesta-organization-export', version: 1, generatedAt, organizationId: job.organization_id,
      exportId, scope: job.scope, notice: 'No incluye contraseñas, tokens, hashes de API ni secretos de proveedores.', tables
    };
    const raw = JSON.stringify(payload);
    const bytes = await gzipText(raw);
    const checksum = await sha256Hex(bytes);
    const prefix = `${job.organization_id}/${generatedAt.slice(0, 10)}/${exportId}`;
    const fileName = `orkesta-${job.organization_id}-${job.scope}-${generatedAt.slice(0, 10)}.json.gz`;
    const storagePath = `${prefix}/${fileName}`;
    const { error: uploadError } = await service.storage.from(EXPORT_BUCKET).upload(storagePath, bytes, { upsert: true, contentType: 'application/gzip' });
    if (uploadError) throw new Error(uploadError.message);
    const copied = ['full','documents'].includes(String(job.scope)) ? await copyExportDocuments(service, documentPaths, prefix) : { copied: 0, failed: 0, bytes: 0, warnings: [] };
    const manifest = { tableCounts: counts, documentPaths, documentCopy: copied, generatedAt };
    await service.from('organization_data_exports').update({
      status: 'completed', storage_path: storagePath, file_name: fileName, size_bytes: bytes.byteLength + Number(copied.bytes ?? 0),
      checksum, manifest, completed_at: new Date().toISOString(), error_message: Number(copied.failed ?? 0) ? `${copied.failed} archivo(s) no pudieron copiarse.` : null
    }).eq('id', exportId);
    return { id: exportId, ok: true, storagePath, fileName, checksum, sizeBytes: bytes.byteLength + Number(copied.bytes ?? 0), manifest };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'EXPORT_FAILED';
    await service.from('organization_data_exports').update({ status: 'failed', error_message: safeText(message), completed_at: new Date().toISOString() }).eq('id', exportId);
    return { id: exportId, ok: false, error: message };
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return response(405, { error: 'METHOD_NOT_ALLOWED' });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) return response(500, { error: 'INTEGRATION_WORKER_NOT_CONFIGURED' });
  const access = await authorize(request);
  if (!access.service && !access.platform && !access.userId) return response(401, { error: 'AUTH_REQUIRED' });
  const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const body = await request.json().catch(() => ({})) as Json;
  const operation = String(body.operation ?? 'batch');

  try {
    if (operation === 'batch') {
      if (!can(access, 'platform.operations.manage')) return response(403, { error: 'PLATFORM_ACCESS_DENIED' });
      const webhookIds = Array.isArray(body.webhookDeliveryIds) ? body.webhookDeliveryIds.map(String).slice(0, 100) : [];
      const exportIds = Array.isArray(body.exportJobIds) ? body.exportJobIds.map(String).slice(0, 10) : [];
      const domainIds = Array.isArray(body.domainIds) ? body.domainIds.map(String).slice(0, 50) : [];
      const webhooks: Json[] = [];
      for (const id of webhookIds) webhooks.push(await deliverWebhook(service, id));
      const exports: Json[] = [];
      for (const id of exportIds) exports.push(await processExport(service, id));
      const domains: Json[] = [];
      for (const id of domainIds) domains.push(await verifyDomain(service, id));
      return response(200, { ok: true, webhooks, exports, domains });
    }

    if (operation === 'deliver-webhook') {
      if (!can(access, 'platform.webhooks.manage')) return response(403, { error: 'PLATFORM_ACCESS_DENIED' });
      return response(200, await deliverWebhook(service, String(body.deliveryId ?? '')));
    }

    if (operation === 'verify-domain') {
      const id = String(body.domainId ?? '');
      const authorized = can(access, 'platform.domains.manage') || await canManageOrganizationResource(request, 'domain', id, 'integrations.domains.manage');
      if (!authorized) return response(403, { error: 'ACCESS_DENIED' });
      return response(200, await verifyDomain(service, id));
    }

    if (operation === 'process-export') {
      const id = String(body.exportId ?? '');
      const authorized = can(access, 'platform.exports.manage') || await canManageOrganizationResource(request, 'export', id, 'integrations.exports.manage');
      if (!authorized) return response(403, { error: 'ACCESS_DENIED' });
      return response(200, await processExport(service, id));
    }

    if (operation === 'test-webhook') {
      const endpointId = String(body.endpointId ?? '');
      if (!can(access, 'platform.webhooks.manage') && !(await canManageOrganizationResource(request, 'webhook', endpointId, 'integrations.webhooks.manage'))) return response(403, { error: 'ACCESS_DENIED' });
      const eventId = `test_${crypto.randomUUID()}`;
      const { data: endpoint } = await service.from('integration_webhook_endpoints').select('organization_id,max_attempts').eq('id', endpointId).single();
      if (!endpoint) return response(404, { error: 'WEBHOOK_NOT_FOUND' });
      const { data: delivery, error } = await service.from('integration_webhook_deliveries').insert({
        organization_id: endpoint.organization_id, endpoint_id: endpointId, event_type: 'integration.test', event_id: eventId,
        payload: { id: eventId, type: 'integration.test', createdAt: new Date().toISOString(), data: { message: 'Prueba de webhook Orkesta 3.2' } },
        max_attempts: endpoint.max_attempts
      }).select('id').single();
      if (error || !delivery) throw new Error(error?.message ?? 'TEST_DELIVERY_FAILED');
      return response(200, await deliverWebhook(service, delivery.id));
    }

    return response(400, { error: 'UNKNOWN_OPERATION' });
  } catch (cause) {
    return response(500, { error: cause instanceof Error ? cause.message : 'INTEGRATION_WORKER_FAILED' });
  }
});
