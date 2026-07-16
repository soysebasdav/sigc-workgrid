import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const CRON_SECRET = Deno.env.get('PLATFORM_CRON_SECRET') ?? '';

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) return json(500, { error: 'SCHEDULER_NOT_CONFIGURED' });
  const suppliedSecret = request.headers.get('x-cron-secret') ?? '';
  const authorization = request.headers.get('authorization') ?? '';
  const authorizedBySecret = Boolean(CRON_SECRET && suppliedSecret && suppliedSecret === CRON_SECRET);
  const authorizedByServiceKey = authorization === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
  let authorizedByPlatformUser = false;
  if (!authorizedBySecret && !authorizedByServiceKey && authorization.toLowerCase().startsWith('bearer ')) {
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authorization } } });
    const { data: access } = await userClient.rpc('platform_get_context_v2');
    const permissions = Array.isArray(access?.permissions) ? access.permissions.map(String) : [];
    authorizedByPlatformUser = Boolean(access?.isPlatformAdmin && (permissions.includes('platform.*') || permissions.includes('platform.operations.manage')));
  }
  if (!authorizedBySecret && !authorizedByServiceKey && !authorizedByPlatformUser) return json(401, { error: 'SCHEDULER_UNAUTHORIZED' });

  const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  try {
    const [{ data: core, error: coreError }, { data: integrations, error: integrationError }, { data: reliability, error: reliabilityError }] = await Promise.all([
      service.rpc('platform_scheduler_tick_v2'),
      service.rpc('platform_integrations_scheduler_tick_v32'),
      service.rpc('platform_phase33_scheduler_tick_v33')
    ]);
    if (coreError) throw new Error(coreError.message);
    if (integrationError) throw new Error(integrationError.message);
    if (reliabilityError) throw new Error(reliabilityError.message);

    const backupJobIds = Array.isArray(core?.backupJobIds) ? core.backupJobIds as string[] : [];
    const backupResults: Array<Record<string, unknown>> = [];
    for (const jobId of backupJobIds) {
      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/process-organization-backup`, {
          method: 'POST',
          headers: { authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'content-type': 'application/json' },
          body: JSON.stringify({ jobId })
        });
        const body = await response.json().catch(() => ({}));
        backupResults.push({ jobId, ok: response.ok, status: response.status, body });
      } catch (backupError) {
        backupResults.push({ jobId, ok: false, error: backupError instanceof Error ? backupError.message : 'UNKNOWN_BACKUP_ERROR' });
      }
    }

    let integrationResult: Record<string, unknown> = { ok: true, skipped: true };
    const webhookDeliveryIds = Array.isArray(integrations?.webhookDeliveryIds) ? integrations.webhookDeliveryIds : [];
    const exportJobIds = Array.isArray(integrations?.exportJobIds) ? integrations.exportJobIds : [];
    const domainIds = Array.isArray(integrations?.domainIds) ? integrations.domainIds : [];
    if (webhookDeliveryIds.length || exportJobIds.length || domainIds.length) {
      const workerResponse = await fetch(`${SUPABASE_URL}/functions/v1/platform-integration-worker`, {
        method: 'POST',
        headers: { authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ operation: 'batch', webhookDeliveryIds, exportJobIds, domainIds })
      });
      integrationResult = await workerResponse.json().catch(() => ({ ok: false, error: 'INVALID_WORKER_RESPONSE' }));
      integrationResult.httpStatus = workerResponse.status;
    }

    return json(200, { ok: true, scheduler: core, integrations, reliability, backups: backupResults, integrationWorker: integrationResult });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : 'SCHEDULER_FAILED' });
  }
});
