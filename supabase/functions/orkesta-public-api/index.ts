import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const API_PREFIX = '/orkesta-public-api';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, x-api-key, idempotency-key',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'content-type': 'application/json; charset=utf-8'
};

type Json = Record<string, unknown>;

function respond(status: number, body: Json, extra: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, ...extra } });
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function apiKeyFrom(request: Request): string {
  const direct = request.headers.get('x-api-key')?.trim();
  if (direct) return direct;
  const authorization = request.headers.get('authorization') ?? '';
  return authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : '';
}

function clientIp(request: Request): string | null {
  const value = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('cf-connecting-ip')?.trim()
    || request.headers.get('x-real-ip')?.trim();
  return value && /^[0-9a-f:.]+$/i.test(value) ? value : null;
}

function normalizedPath(request: Request): string {
  const path = new URL(request.url).pathname;
  const marker = '/functions/v1/orkesta-public-api';
  const index = path.indexOf(marker);
  const relative = index >= 0 ? path.slice(index + marker.length) : path.replace(API_PREFIX, '');
  return relative || '/';
}

function mapError(message: string): { status: number; code: string } {
  if (/API_KEY_INVALID|API_KEY_EXPIRED|API_IP_NOT_ALLOWED/i.test(message)) return { status: 401, code: message.match(/API_[A-Z_]+/)?.[0] ?? 'API_UNAUTHORIZED' };
  if (/API_RATE_LIMIT/i.test(message)) return { status: 429, code: 'API_RATE_LIMIT' };
  if (/API_SCOPE_DENIED/i.test(message)) return { status: 403, code: 'API_SCOPE_DENIED' };
  if (/CASE_NOT_FOUND/i.test(message)) return { status: 404, code: 'CASE_NOT_FOUND' };
  if (/REQUIRED|NOT_FOUND|INVALID/i.test(message)) return { status: 400, code: message.match(/[A-Z][A-Z_]+/)?.[0] ?? 'INVALID_REQUEST' };
  return { status: 500, code: 'API_INTERNAL_ERROR' };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return respond(500, { error: { code: 'API_NOT_CONFIGURED', message: 'La API pública no está configurada.' } });

  const started = performance.now();
  const requestId = crypto.randomUUID();
  const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  let organizationId = '';
  let apiKeyId = '';
  let statusCode = 500;
  const path = normalizedPath(request);

  try {
    const rawKey = apiKeyFrom(request);
    const match = /^ork_(live|test)_([a-f0-9]{12})_[a-f0-9]{64}$/i.exec(rawKey);
    if (!match) throw new Error('API_KEY_INVALID');
    const hash = await sha256Hex(rawKey);
    const ip = clientIp(request);
    const { data: context, error: authError } = await service.rpc('integration_api_authenticate_v32', {
      p_prefix: match[2].toLowerCase(),
      p_hash: hash,
      p_ip: ip
    });
    if (authError) throw new Error(authError.message);
    organizationId = String(context?.organizationId ?? '');
    apiKeyId = String(context?.apiKeyId ?? '');
    const rateHeaders = {
      'x-request-id': requestId,
      'x-ratelimit-limit': String(context?.rateLimitPerMinute ?? ''),
      'x-ratelimit-remaining': String(context?.remaining ?? '')
    };

    if (request.method === 'GET' && path === '/v1/health') {
      statusCode = 200;
      return respond(200, { ok: true, version: '3.2', requestId, organizationId }, rateHeaders);
    }

    if (request.method === 'GET' && path === '/v1/catalogs') {
      const { data, error } = await service.rpc('integration_api_catalogs_v32', { p_api_key_id: apiKeyId });
      if (error) throw new Error(error.message);
      statusCode = 200;
      return respond(200, { data, requestId }, rateHeaders);
    }

    if (request.method === 'GET' && path === '/v1/cases') {
      const url = new URL(request.url);
      const page = Math.max(1, Number(url.searchParams.get('page') || 1));
      const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') || 50)));
      const { data, error } = await service.rpc('integration_api_list_cases_v32', {
        p_api_key_id: apiKeyId,
        p_query: url.searchParams.get('query') || null,
        p_page: page,
        p_page_size: pageSize
      });
      if (error) throw new Error(error.message);
      statusCode = 200;
      return respond(200, { data, requestId }, rateHeaders);
    }

    const caseMatch = /^\/v1\/cases\/([^/]+)$/.exec(path);
    if (request.method === 'GET' && caseMatch) {
      const { data, error } = await service.rpc('integration_api_get_case_v32', { p_api_key_id: apiKeyId, p_identifier: decodeURIComponent(caseMatch[1]) });
      if (error) throw new Error(error.message);
      statusCode = 200;
      return respond(200, { data, requestId }, rateHeaders);
    }

    if (request.method === 'POST' && path === '/v1/cases') {
      const body = await request.json().catch(() => ({})) as Json;
      const idempotencyKey = request.headers.get('idempotency-key');
      if (idempotencyKey && !body.idempotencyKey) body.idempotencyKey = idempotencyKey;
      const { data, error } = await service.rpc('integration_api_create_case_v32', { p_api_key_id: apiKeyId, p_payload: body });
      if (error) throw new Error(error.message);
      statusCode = Boolean(data?.idempotentReplay) ? 200 : 201;
      return respond(statusCode, { data, requestId }, rateHeaders);
    }

    statusCode = 404;
    return respond(404, { error: { code: 'ROUTE_NOT_FOUND', message: 'Ruta no disponible.' }, requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'API_INTERNAL_ERROR';
    const mapped = mapError(message);
    statusCode = mapped.status;
    return respond(mapped.status, { error: { code: mapped.code, message: mapped.status >= 500 ? 'No fue posible procesar la solicitud.' : message }, requestId });
  } finally {
    if (organizationId) {
      const durationMs = Math.max(0, Math.round(performance.now() - started));
      await service.from('integration_api_request_logs').insert({
        organization_id: organizationId,
        api_key_id: apiKeyId || null,
        method: request.method,
        path,
        status_code: statusCode,
        duration_ms: durationMs,
        request_id: requestId,
        ip_address: clientIp(request),
        user_agent: request.headers.get('user-agent'),
        metadata: {}
      }).then(() => undefined).catch(() => undefined);
    }
  }
});
