-- ORKESTA / SIGC
-- Fase 3.2: integraciones empresariales, API pública, webhooks, dominios,
-- configuración SSO, canales de correo, conectores, centro de conocimiento y exportaciones.
-- Requiere Fase 1 + Fase 2 + Fase 3.1.
-- Migración aditiva e idempotente.

begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- =========================================================
-- 1. PERMISOS DE PLATAFORMA Y ORGANIZACIÓN
-- =========================================================

insert into public.platform_permission_catalog(code,name,category,description,is_sensitive) values
('platform.integrations.view','Ver integraciones','Integraciones','Consulta API keys, webhooks, dominios, SSO, correo, conectores y exportaciones.',false),
('platform.integrations.manage','Administrar integraciones','Integraciones','Administra la configuración de integraciones de cualquier organización.',true),
('platform.api.view','Ver API pública','Integraciones','Consulta credenciales y actividad de la API pública.',false),
('platform.api.manage','Administrar API pública','Integraciones','Crea, revoca y controla credenciales de API.',true),
('platform.webhooks.view','Ver webhooks','Integraciones','Consulta endpoints, entregas y fallos de webhooks.',false),
('platform.webhooks.manage','Administrar webhooks','Integraciones','Configura endpoints, rota secretos y reintenta entregas.',true),
('platform.domains.view','Ver dominios','Integraciones','Consulta dominios personalizados y su verificación.',false),
('platform.domains.manage','Administrar dominios','Integraciones','Registra, verifica y activa dominios personalizados.',true),
('platform.exports.view','Ver exportaciones','Datos','Consulta exportaciones completas solicitadas por organizaciones.',false),
('platform.exports.manage','Administrar exportaciones','Datos','Genera, cancela y expira exportaciones organizacionales.',true),
('platform.knowledge.view','Ver conocimiento','Soporte','Consulta artículos del centro de conocimiento.',false),
('platform.knowledge.manage','Administrar conocimiento','Soporte','Crea, publica y archiva artículos del centro de conocimiento.',true),
('platform.sso.view','Ver configuración SSO','Seguridad','Consulta la preparación y configuración empresarial de inicio de sesión.',false),
('platform.sso.manage','Administrar configuración SSO','Seguridad','Administra metadatos y políticas SSO por organización.',true)
on conflict(code) do update set
  name=excluded.name,
  category=excluded.category,
  description=excluded.description,
  is_sensitive=excluded.is_sensitive;

-- Owner y admin reciben todos los permisos nuevos.
insert into public.platform_role_permissions(role_id,permission_id)
select r.id,p.id
from public.platform_role_catalog r
cross join public.platform_permission_catalog p
where r.code in ('owner','admin') and p.code like 'platform.%'
on conflict do nothing;

-- Operación técnica controla integraciones y reintentos.
insert into public.platform_role_permissions(role_id,permission_id)
select r.id,p.id
from public.platform_role_catalog r
join public.platform_permission_catalog p on p.code = any(array[
  'platform.integrations.view','platform.integrations.manage','platform.api.view','platform.api.manage',
  'platform.webhooks.view','platform.webhooks.manage','platform.domains.view','platform.domains.manage',
  'platform.exports.view','platform.exports.manage','platform.sso.view','platform.sso.manage'
])
where r.code='operations_operator'
on conflict do nothing;

-- Soporte consulta integraciones y administra conocimiento.
insert into public.platform_role_permissions(role_id,permission_id)
select r.id,p.id
from public.platform_role_catalog r
join public.platform_permission_catalog p on p.code = any(array[
  'platform.integrations.view','platform.api.view','platform.webhooks.view','platform.domains.view',
  'platform.exports.view','platform.knowledge.view','platform.knowledge.manage','platform.sso.view'
])
where r.code in ('support_manager','support_agent')
on conflict do nothing;

-- Auditor solo consulta.
insert into public.platform_role_permissions(role_id,permission_id)
select r.id,p.id
from public.platform_role_catalog r
join public.platform_permission_catalog p on p.code = any(array[
  'platform.integrations.view','platform.api.view','platform.webhooks.view','platform.domains.view',
  'platform.exports.view','platform.knowledge.view','platform.sso.view'
])
where r.code='auditor'
on conflict do nothing;

insert into public.permissions(code,name,description) values
('integrations.view','Ver integraciones','Consulta integraciones, API, webhooks, dominios y conectores de la organización.'),
('integrations.manage','Administrar integraciones','Administra integraciones, API, webhooks, dominios, correo y conectores.'),
('integrations.api.manage','Administrar API','Crea y revoca credenciales API de la organización.'),
('integrations.webhooks.manage','Administrar webhooks','Crea endpoints y reintenta entregas de la organización.'),
('integrations.domains.manage','Administrar dominios','Registra y verifica dominios personalizados.'),
('integrations.exports.manage','Administrar exportaciones','Solicita y descarga exportaciones de datos.'),
('knowledge.view','Ver centro de conocimiento','Consulta artículos de ayuda.'),
('knowledge.manage','Administrar conocimiento organizacional','Administra artículos propios de la organización.')
on conflict(code) do update set name=excluded.name,description=excluded.description;

-- Administradores organizacionales reciben los permisos nuevos.
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id
from public.roles r
join public.permissions p on p.code = any(array[
  'integrations.view','integrations.manage','integrations.api.manage','integrations.webhooks.manage',
  'integrations.domains.manage','integrations.exports.manage','knowledge.view','knowledge.manage'
])
where lower(r.code) in ('admin','administrator','owner','account-admin','account_admin')
   or lower(r.name) in ('administrador','administrator','propietario')
on conflict do nothing;

-- Roles internos activos reciben al menos lectura de conocimiento.
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id
from public.roles r
join public.permissions p on p.code='knowledge.view'
where r.is_active
on conflict do nothing;

-- =========================================================
-- 2. CONFIGURACIÓN GLOBAL DE INTEGRACIONES
-- =========================================================

create table if not exists public.platform_integration_settings (
  singleton boolean primary key default true check(singleton),
  public_api_base_url text,
  app_cname_target text,
  public_form_cname_target text,
  api_cname_target text,
  exports_retention_days integer not null default 30 check(exports_retention_days between 1 and 365),
  webhook_max_attempts integer not null default 8 check(webhook_max_attempts between 1 and 20),
  webhook_timeout_ms integer not null default 15000 check(webhook_timeout_ms between 1000 and 60000),
  webhook_response_body_limit integer not null default 4096 check(webhook_response_body_limit between 256 and 65536),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.platform_integration_settings(singleton) values(true)
on conflict(singleton) do nothing;

create table if not exists public.integration_event_catalog (
  code text primary key,
  name text not null,
  category text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.integration_event_catalog(code,name,category,description) values
('case.created','Caso creado','Casos','Se crea un caso interno, público o mediante API.'),
('case.updated','Caso actualizado','Casos','Cambian datos principales de un caso.'),
('case.classified','Caso clasificado','Casos','Se completa la clasificación inicial.'),
('case.state_changed','Estado de caso modificado','Casos','El caso cambia de estado.'),
('case.sla_overridden','SLA modificado','Casos','Se modifica excepcionalmente la fecha límite.'),
('assignment.created','Asignación creada','Asignaciones','Se crea una asignación de caso.'),
('assignment.updated','Asignación actualizada','Asignaciones','Se actualiza una asignación.'),
('subtask.created','Subtarea creada','Subtareas','Se crea una subtarea.'),
('subtask.updated','Subtarea actualizada','Subtareas','Se actualiza una subtarea.'),
('comment.created','Comentario creado','Comentarios','Se agrega un comentario.'),
('document.created','Documento creado','Documentos','Se agrega un documento.'),
('document.version_created','Versión documental creada','Documentos','Se carga una nueva versión.'),
('ticket.created','Ticket creado','Soporte','Se crea un ticket de soporte.'),
('ticket.updated','Ticket actualizado','Soporte','Se actualiza un ticket.'),
('subscription.updated','Suscripción actualizada','Comercial','Cambia la suscripción.'),
('invoice.issued','Factura emitida','Comercial','Se emite una factura.'),
('payment.confirmed','Pago confirmado','Comercial','Se confirma un pago.'),
('*','Todos los eventos','Sistema','Entrega cualquier evento auditado de la organización.')
on conflict(code) do update set name=excluded.name,category=excluded.category,description=excluded.description,is_active=true;

-- La API y la creación manual comparten idempotencia por organización.
create unique index if not exists cases_organization_idempotency_phase32_idx
  on public.cases(organization_id,idempotency_key)
  where idempotency_key is not null;

-- =========================================================
-- 3. API KEYS Y CONSUMO
-- =========================================================

create table if not exists public.integration_api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check(length(trim(name)) between 2 and 120),
  environment text not null default 'live' check(environment in ('test','live')),
  key_prefix text not null unique,
  key_hash text not null,
  scopes text[] not null default array['cases.read'],
  status text not null default 'active' check(status in ('active','revoked','expired')),
  rate_limit_per_minute integer not null default 120 check(rate_limit_per_minute between 1 and 10000),
  allowed_ips inet[] not null default '{}',
  expires_at timestamptz,
  last_used_at timestamptz,
  last_used_ip inet,
  usage_count bigint not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  revoked_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  revoke_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists integration_api_keys_org_idx on public.integration_api_keys(organization_id,status,created_at desc);

create table if not exists public.integration_api_usage_windows (
  api_key_id uuid not null references public.integration_api_keys(id) on delete cascade,
  window_started_at timestamptz not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key(api_key_id,window_started_at)
);

create table if not exists public.integration_api_request_logs (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  api_key_id uuid references public.integration_api_keys(id) on delete set null,
  method text not null,
  path text not null,
  status_code integer not null,
  duration_ms integer not null default 0,
  request_id text,
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists integration_api_logs_org_created_idx on public.integration_api_request_logs(organization_id,created_at desc);

-- =========================================================
-- 4. WEBHOOKS, ENTREGAS Y SECRETOS
-- =========================================================

create table if not exists public.integration_webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check(length(trim(name)) between 2 and 120),
  endpoint_url text not null,
  events text[] not null default array['case.created'],
  status text not null default 'active' check(status in ('active','paused','disabled')),
  api_version text not null default '2026-07-16',
  max_attempts integer not null default 8 check(max_attempts between 1 and 20),
  timeout_ms integer not null default 15000 check(timeout_ms between 1000 and 60000),
  custom_headers jsonb not null default '{}'::jsonb,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  consecutive_failures integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists integration_webhooks_org_idx on public.integration_webhook_endpoints(organization_id,status,created_at desc);

-- El secreto se separa del endpoint. Solo service_role puede leer esta tabla.
create table if not exists public.integration_webhook_secrets (
  endpoint_id uuid primary key references public.integration_webhook_endpoints(id) on delete cascade,
  secret_value text not null,
  rotated_at timestamptz not null default now(),
  rotated_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.integration_webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  endpoint_id uuid not null references public.integration_webhook_endpoints(id) on delete cascade,
  audit_event_id bigint references public.audit_events(id) on delete set null,
  platform_audit_event_id bigint references public.platform_audit_events(id) on delete set null,
  event_type text not null,
  event_id text not null,
  payload jsonb not null,
  status text not null default 'queued' check(status in ('queued','delivering','succeeded','failed','dead_letter','cancelled')),
  attempts integer not null default 0,
  max_attempts integer not null default 8,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  delivered_at timestamptz,
  response_status integer,
  response_headers jsonb not null default '{}'::jsonb,
  response_body text,
  last_error text,
  duration_ms integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(endpoint_id,event_id)
);
create index if not exists integration_webhook_due_idx on public.integration_webhook_deliveries(status,next_attempt_at,created_at);
create index if not exists integration_webhook_delivery_org_idx on public.integration_webhook_deliveries(organization_id,created_at desc);

-- =========================================================
-- 5. DOMINIOS, SSO, CORREO Y CONECTORES
-- =========================================================

create table if not exists public.integration_domains (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  domain text not null,
  domain_type text not null default 'app' check(domain_type in ('app','public_form','api')),
  status text not null default 'pending' check(status in ('pending','verified','active','failed','disabled')),
  verification_token text not null,
  verification_record_name text not null,
  expected_cname text,
  is_primary boolean not null default false,
  last_checked_at timestamptz,
  verified_at timestamptz,
  activated_at timestamptz,
  error_message text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,domain),
  unique(domain)
);
create index if not exists integration_domains_status_idx on public.integration_domains(status,last_checked_at);

create table if not exists public.organization_sso_configurations (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  mode text not null default 'disabled' check(mode in ('disabled','oidc','saml')),
  status text not null default 'not_configured' check(status in ('not_configured','draft','ready','active','error','disabled')),
  provider_name text,
  email_domains text[] not null default '{}',
  discovery_url text,
  metadata_url text,
  client_id text,
  secret_ref text,
  attribute_mapping jsonb not null default '{}'::jsonb,
  enforce_for_domains boolean not null default false,
  allow_password_fallback boolean not null default true,
  notes text,
  last_tested_at timestamptz,
  last_test_status text,
  last_test_message text,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_email_channels (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  mode text not null default 'platform' check(mode in ('platform','webhook','external_provider')),
  status text not null default 'active' check(status in ('active','draft','error','disabled')),
  from_name text,
  from_email text,
  reply_to_email text,
  webhook_url text,
  secret_ref text,
  provider_name text,
  provider_configuration jsonb not null default '{}'::jsonb,
  last_tested_at timestamptz,
  last_test_status text,
  last_test_message text,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.integration_connectors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check(provider in ('google_drive','sharepoint','onedrive','dropbox','custom')),
  name text not null,
  status text not null default 'draft' check(status in ('draft','connected','error','disabled')),
  capabilities text[] not null default '{}',
  configuration jsonb not null default '{}'::jsonb,
  secret_ref text,
  last_health_at timestamptz,
  last_health_status text,
  last_health_message text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists integration_connectors_org_idx on public.integration_connectors(organization_id,status);

-- =========================================================
-- 6. EXPORTACIONES COMPLETAS
-- =========================================================

create table if not exists public.organization_data_exports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid references public.profiles(id) on delete set null,
  scope text not null default 'full' check(scope in ('full','cases','documents','configuration','audit')),
  format text not null default 'json_gzip' check(format in ('json_gzip')),
  reason text not null check(length(trim(reason)) >= 5),
  status text not null default 'queued' check(status in ('queued','processing','completed','failed','cancelled','expired')),
  storage_path text,
  file_name text,
  size_bytes bigint not null default 0,
  checksum text,
  manifest jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz,
  downloaded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists organization_data_exports_due_idx on public.organization_data_exports(status,created_at);
create index if not exists organization_data_exports_org_idx on public.organization_data_exports(organization_id,created_at desc);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('organization-exports','organization-exports',false,1073741824,array['application/gzip','application/zip','application/json','text/csv'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

-- =========================================================
-- 7. CENTRO DE CONOCIMIENTO
-- =========================================================

create table if not exists public.knowledge_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  icon text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists knowledge_categories_scope_code_idx on public.knowledge_categories(coalesce(organization_id,'00000000-0000-0000-0000-000000000000'::uuid),code);

create table if not exists public.knowledge_articles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  category_id uuid references public.knowledge_categories(id) on delete set null,
  slug text not null,
  title text not null,
  summary text,
  content_markdown text not null default '',
  visibility text not null default 'authenticated' check(visibility in ('public','authenticated','organization','platform_only')),
  status text not null default 'draft' check(status in ('draft','published','archived')),
  tags text[] not null default '{}',
  featured boolean not null default false,
  view_count bigint not null default 0,
  helpful_count bigint not null default 0,
  unhelpful_count bigint not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists knowledge_articles_scope_slug_idx on public.knowledge_articles(coalesce(organization_id,'00000000-0000-0000-0000-000000000000'::uuid),slug);
create index if not exists knowledge_articles_status_idx on public.knowledge_articles(status,visibility,published_at desc);

create table if not exists public.knowledge_article_feedback (
  article_id uuid not null references public.knowledge_articles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  helpful boolean not null,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(article_id,user_id)
);

-- Seed de conocimiento global.
insert into public.knowledge_categories(organization_id,code,name,description,icon,sort_order)
values
(null,'getting-started','Primeros pasos','Configuración inicial y conceptos básicos.','rocket',10),
(null,'cases','Gestión de casos','Radicación, clasificación, asignación y cierre.','briefcase',20),
(null,'administration','Administración','Usuarios, permisos, SLA y configuración.','settings',30),
(null,'integrations','Integraciones','API, webhooks, dominios y exportaciones.','plug',40)
on conflict do nothing;

insert into public.knowledge_articles(organization_id,category_id,slug,title,summary,content_markdown,visibility,status,tags,featured,published_at)
select null,c.id,'bienvenida-orkesta','Bienvenido a Orkesta','Conceptos esenciales para comenzar a utilizar la plataforma.',
'# Bienvenido a Orkesta\n\nOrkesta centraliza casos, responsables, documentos, tiempos y trazabilidad. Inicia configurando áreas, usuarios, tipos de caso y SLA.',
'authenticated','published',array['inicio','configuración'],true,now()
from public.knowledge_categories c where c.organization_id is null and c.code='getting-started'
on conflict do nothing;

insert into public.knowledge_articles(organization_id,category_id,slug,title,summary,content_markdown,visibility,status,tags,featured,published_at)
select null,c.id,'integraciones-api-webhooks','API y webhooks','Cómo habilitar credenciales API y endpoints de eventos.',
'# API y webhooks\n\nCrea credenciales con el alcance mínimo necesario. Los secretos se muestran una sola vez. Los webhooks incluyen firma HMAC SHA-256 en el encabezado `x-orkesta-signature`.',
'authenticated','published',array['api','webhooks','seguridad'],true,now()
from public.knowledge_categories c where c.organization_id is null and c.code='integrations'
on conflict do nothing;

-- =========================================================
-- 8. HELPERS, VALIDACIONES Y TRIGGERS
-- =========================================================

create or replace function public.integration_hash_secret_v32(p_secret text)
returns text
language sql
immutable
as $$ select encode(extensions.digest(coalesce(p_secret,''),'sha256'),'hex'); $$;

create or replace function public.integration_validate_url_v32(p_url text)
returns boolean
language plpgsql
immutable
as $$
declare v text:=lower(trim(coalesce(p_url,'')));
begin
  if v !~ '^https://[^/]+(/.*)?$' then return false; end if;
  if v ~ '^https://(localhost|127\.|0\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|169\.254\.|\[?::1\]?)([:/]|$)' then return false; end if;
  if v ~ '^https://[^/]*\.(local|internal|localhost)([:/]|$)' then return false; end if;
  return true;
end;
$$;

create or replace function public.integration_normalize_domain_v32(p_domain text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(regexp_replace(trim(coalesce(p_domain,'')),'^https?://','','i'),'[/.:]+$','','g'));
$$;

create or replace function public.integration_assert_org_permission_v32(p_organization_id uuid,p_permission text)
returns void
language plpgsql
stable
security definer
set search_path=public,auth
as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if public.platform_is_admin_v2() then return; end if;
  if not public.platform_member_has_permission_v1(p_organization_id,p_permission) then
    raise exception 'ORGANIZATION_PERMISSION_DENIED' using errcode='42501';
  end if;
end;
$$;

create or replace function public.integration_make_api_key_v32(p_environment text default 'live')
returns jsonb
language plpgsql
volatile
security definer
set search_path=public
as $$
declare v_prefix text; v_secret text; v_raw text;
begin
  v_prefix:=lower(encode(extensions.gen_random_bytes(6),'hex'));
  v_secret:=encode(extensions.gen_random_bytes(32),'hex');
  v_raw:='ork_'||case when p_environment='test' then 'test' else 'live' end||'_'||v_prefix||'_'||v_secret;
  return jsonb_build_object('prefix',v_prefix,'raw',v_raw,'hash',public.integration_hash_secret_v32(v_raw));
end;
$$;

create or replace function public.integration_make_webhook_secret_v32()
returns text
language sql
volatile
security definer
set search_path=public
as $$ select 'whsec_'||encode(extensions.gen_random_bytes(32),'hex'); $$;

-- updated_at
DO $$
declare tbl text;
begin
  foreach tbl in array array[
    'platform_integration_settings','integration_api_keys','integration_api_usage_windows','integration_webhook_endpoints',
    'integration_webhook_deliveries','integration_domains','organization_sso_configurations','organization_email_channels',
    'integration_connectors','organization_data_exports','knowledge_categories','knowledge_articles','knowledge_article_feedback'
  ] loop
    execute format('drop trigger if exists trg_%I_touch_updated_at on public.%I',tbl,tbl);
    execute format('create trigger trg_%I_touch_updated_at before update on public.%I for each row execute function public.platform_touch_updated_at_v1()',tbl,tbl);
  end loop;
end $$;

-- Auditoría automática. La tabla de secretos no se audita fila a fila para evitar exposición.
DO $$
declare tbl text;
begin
  foreach tbl in array array[
    'platform_integration_settings','integration_api_keys','integration_webhook_endpoints','integration_webhook_deliveries',
    'integration_domains','organization_sso_configurations','organization_email_channels','integration_connectors',
    'organization_data_exports','knowledge_categories','knowledge_articles','knowledge_article_feedback'
  ] loop
    execute format('drop trigger if exists trg_platform_audit_%I on public.%I',tbl,tbl);
    execute format('create trigger trg_platform_audit_%I after insert or update or delete on public.%I for each row execute function public.platform_capture_row_change_v1(''direct'')',tbl,tbl);
  end loop;
end $$;

-- Convierte eventos operativos existentes en entregas webhook.
create or replace function public.integration_queue_webhooks_from_audit_v32()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare v_event text; v_event_id text; v_payload jsonb;
begin
  if new.organization_id is null then return new; end if;
  v_event:=coalesce(new.event_type,'system.event');
  v_event_id:='audit_'||new.id::text;
  v_payload:=jsonb_build_object(
    'id',v_event_id,
    'type',v_event,
    'createdAt',new.created_at,
    'organizationId',new.organization_id,
    'caseId',new.case_id,
    'actorUserId',new.actor_user_id,
    'entityType',new.entity_type,
    'entityId',new.entity_id,
    'before',new.before_data,
    'after',new.after_data,
    'metadata',new.metadata
  );
  insert into public.integration_webhook_deliveries(
    organization_id,endpoint_id,audit_event_id,event_type,event_id,payload,max_attempts
  )
  select new.organization_id,e.id,new.id,v_event,v_event_id,v_payload,e.max_attempts
  from public.integration_webhook_endpoints e
  where e.organization_id=new.organization_id
    and e.status='active'
    and ('*'=any(e.events) or v_event=any(e.events))
  on conflict(endpoint_id,event_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_integration_queue_webhooks_audit on public.audit_events;
create trigger trg_integration_queue_webhooks_audit
after insert on public.audit_events
for each row execute function public.integration_queue_webhooks_from_audit_v32();

-- =========================================================
-- 9. RPC DE API KEYS
-- =========================================================

create or replace function public.integration_create_api_key_core_v32(
  p_organization_id uuid,
  p_name text,
  p_environment text,
  p_scopes text[],
  p_rate_limit integer,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare v_key jsonb; v_id uuid;
begin
  if trim(coalesce(p_name,''))='' then raise exception 'API_KEY_NAME_REQUIRED'; end if;
  if p_environment not in ('test','live') then raise exception 'INVALID_ENVIRONMENT'; end if;
  if coalesce(array_length(p_scopes,1),0)=0 then raise exception 'API_SCOPES_REQUIRED'; end if;
  if exists(select 1 from unnest(p_scopes) scope where scope not in ('cases.read','cases.write','catalogs.read','*')) then
    raise exception 'INVALID_API_SCOPE';
  end if;
  v_key:=public.integration_make_api_key_v32(p_environment);
  insert into public.integration_api_keys(
    organization_id,name,environment,key_prefix,key_hash,scopes,rate_limit_per_minute,expires_at,created_by
  ) values(
    p_organization_id,trim(p_name),p_environment,v_key->>'prefix',v_key->>'hash',p_scopes,
    greatest(1,least(coalesce(p_rate_limit,120),10000)),p_expires_at,auth.uid()
  ) returning id into v_id;
  perform public.platform_insert_audit_v1(p_organization_id,case when public.platform_is_admin_v2() then 'platform' else 'organization' end,
    'integration.api_key_created','integration_api_keys',v_id::text,null,
    jsonb_build_object('id',v_id,'name',trim(p_name),'environment',p_environment,'prefix',v_key->>'prefix','scopes',p_scopes,'expiresAt',p_expires_at),
    jsonb_build_object('reason','Credential created; secret shown once'));
  return jsonb_build_object(
    'id',v_id,'name',trim(p_name),'environment',p_environment,'prefix',v_key->>'prefix','secret',v_key->>'raw',
    'scopes',p_scopes,'rateLimitPerMinute',greatest(1,least(coalesce(p_rate_limit,120),10000)),'expiresAt',p_expires_at
  );
end;
$$;

create or replace function public.platform_create_api_key_v32(p_organization_id uuid,p_name text,p_environment text,p_scopes text[],p_rate_limit integer default 120,p_expires_at timestamptz default null,p_reason text default '')
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
begin
  perform public.platform_assert_admin_v2('platform.api.manage',true);
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'REASON_REQUIRED'; end if;
  return public.integration_create_api_key_core_v32(p_organization_id,p_name,p_environment,p_scopes,p_rate_limit,p_expires_at);
end;
$$;

create or replace function public.organization_create_api_key_v32(p_name text,p_environment text,p_scopes text[],p_rate_limit integer default 120,p_expires_at timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare v_org uuid:=public.platform_current_organization_id_v1();
begin
  if v_org is null then raise exception 'ORGANIZATION_NOT_FOUND'; end if;
  perform public.integration_assert_org_permission_v32(v_org,'integrations.api.manage');
  if '*'=any(p_scopes) then raise exception 'WILDCARD_SCOPE_PLATFORM_ONLY' using errcode='42501'; end if;
  return public.integration_create_api_key_core_v32(v_org,p_name,p_environment,p_scopes,p_rate_limit,p_expires_at);
end;
$$;

create or replace function public.integration_revoke_api_key_core_v32(p_api_key_id uuid,p_reason text)
returns void
language plpgsql
security definer
set search_path=public,auth
as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.integration_api_keys where id=p_api_key_id;
  if v_org is null then raise exception 'API_KEY_NOT_FOUND'; end if;
  update public.integration_api_keys set status='revoked',revoked_at=now(),revoked_by=auth.uid(),revoke_reason=trim(p_reason) where id=p_api_key_id;
  perform public.platform_insert_audit_v1(v_org,case when public.platform_is_admin_v2() then 'platform' else 'organization' end,
    'integration.api_key_revoked','integration_api_keys',p_api_key_id::text,null,null,jsonb_build_object('reason',trim(p_reason)));
end;
$$;

create or replace function public.platform_revoke_api_key_v32(p_api_key_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=public,auth as $$
begin
  perform public.platform_assert_admin_v2('platform.api.manage',true);
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'REASON_REQUIRED'; end if;
  perform public.integration_revoke_api_key_core_v32(p_api_key_id,p_reason);
end; $$;

create or replace function public.organization_revoke_api_key_v32(p_api_key_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=public,auth as $$
declare v_org uuid:=public.platform_current_organization_id_v1(); v_key_org uuid;
begin
  select organization_id into v_key_org from public.integration_api_keys where id=p_api_key_id;
  if v_key_org is distinct from v_org then raise exception 'API_KEY_NOT_FOUND'; end if;
  perform public.integration_assert_org_permission_v32(v_org,'integrations.api.manage');
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'REASON_REQUIRED'; end if;
  perform public.integration_revoke_api_key_core_v32(p_api_key_id,p_reason);
end; $$;

-- =========================================================
-- 10. RPC DE WEBHOOKS
-- =========================================================

create or replace function public.integration_upsert_webhook_core_v32(p_organization_id uuid,p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare v_id uuid; v_url text; v_secret text; v_events text[]; v_is_new boolean:=false;
begin
  v_id:=nullif(p_payload->>'id','')::uuid;
  v_url:=trim(coalesce(p_payload->>'endpointUrl',p_payload->>'endpoint_url',''));
  if not public.integration_validate_url_v32(v_url) then raise exception 'INVALID_WEBHOOK_URL'; end if;
  select coalesce(array_agg(value::text),'{}'::text[]) into v_events from jsonb_array_elements_text(coalesce(p_payload->'events','[]'::jsonb));
  if coalesce(array_length(v_events,1),0)=0 then v_events:=array['case.created']; end if;
  if exists(select 1 from unnest(v_events) event_code where not exists(select 1 from public.integration_event_catalog c where c.code=event_code and c.is_active)) then
    raise exception 'INVALID_WEBHOOK_EVENT';
  end if;
  if v_id is null then
    v_is_new:=true; v_secret:=public.integration_make_webhook_secret_v32();
    insert into public.integration_webhook_endpoints(
      organization_id,name,endpoint_url,events,status,max_attempts,timeout_ms,custom_headers,created_by,updated_by
    ) values(
      p_organization_id,trim(coalesce(p_payload->>'name','Webhook')),v_url,v_events,
      coalesce(nullif(p_payload->>'status',''),'active'),
      greatest(1,least(coalesce((p_payload->>'maxAttempts')::integer,8),20)),
      greatest(1000,least(coalesce((p_payload->>'timeoutMs')::integer,15000),60000)),
      coalesce(p_payload->'customHeaders','{}'::jsonb),auth.uid(),auth.uid()
    ) returning id into v_id;
    insert into public.integration_webhook_secrets(endpoint_id,secret_value,rotated_by) values(v_id,v_secret,auth.uid());
  else
    update public.integration_webhook_endpoints set
      name=trim(coalesce(p_payload->>'name',name)),
      endpoint_url=v_url,
      events=v_events,
      status=coalesce(nullif(p_payload->>'status',''),status),
      max_attempts=greatest(1,least(coalesce((p_payload->>'maxAttempts')::integer,max_attempts),20)),
      timeout_ms=greatest(1000,least(coalesce((p_payload->>'timeoutMs')::integer,timeout_ms),60000)),
      custom_headers=coalesce(p_payload->'customHeaders',custom_headers),
      updated_by=auth.uid()
    where id=v_id and organization_id=p_organization_id;
    if not found then raise exception 'WEBHOOK_NOT_FOUND'; end if;
  end if;
  return jsonb_build_object('id',v_id,'isNew',v_is_new,'signingSecret',case when v_is_new then v_secret else null end);
end;
$$;

create or replace function public.platform_upsert_webhook_v32(p_organization_id uuid,p_payload jsonb,p_reason text)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
begin
  perform public.platform_assert_admin_v2('platform.webhooks.manage',true);
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'REASON_REQUIRED'; end if;
  return public.integration_upsert_webhook_core_v32(p_organization_id,p_payload);
end; $$;

create or replace function public.organization_upsert_webhook_v32(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare v_org uuid:=public.platform_current_organization_id_v1();
begin
  perform public.integration_assert_org_permission_v32(v_org,'integrations.webhooks.manage');
  return public.integration_upsert_webhook_core_v32(v_org,p_payload);
end; $$;

create or replace function public.integration_rotate_webhook_secret_core_v32(p_endpoint_id uuid)
returns text language plpgsql security definer set search_path=public,auth as $$
declare v_secret text:=public.integration_make_webhook_secret_v32(); v_org uuid;
begin
  select organization_id into v_org from public.integration_webhook_endpoints where id=p_endpoint_id;
  if v_org is null then raise exception 'WEBHOOK_NOT_FOUND'; end if;
  insert into public.integration_webhook_secrets(endpoint_id,secret_value,rotated_by)
  values(p_endpoint_id,v_secret,auth.uid())
  on conflict(endpoint_id) do update set secret_value=excluded.secret_value,rotated_at=now(),rotated_by=auth.uid();
  update public.integration_webhook_endpoints set consecutive_failures=0,updated_by=auth.uid() where id=p_endpoint_id;
  return v_secret;
end; $$;

create or replace function public.platform_rotate_webhook_secret_v32(p_endpoint_id uuid,p_reason text)
returns text language plpgsql security definer set search_path=public,auth as $$
begin
  perform public.platform_assert_admin_v2('platform.webhooks.manage',true);
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'REASON_REQUIRED'; end if;
  return public.integration_rotate_webhook_secret_core_v32(p_endpoint_id);
end; $$;

create or replace function public.organization_rotate_webhook_secret_v32(p_endpoint_id uuid)
returns text language plpgsql security definer set search_path=public,auth as $$
declare v_org uuid:=public.platform_current_organization_id_v1(); v_endpoint_org uuid;
begin
  select organization_id into v_endpoint_org from public.integration_webhook_endpoints where id=p_endpoint_id;
  if v_endpoint_org is distinct from v_org then raise exception 'WEBHOOK_NOT_FOUND'; end if;
  perform public.integration_assert_org_permission_v32(v_org,'integrations.webhooks.manage');
  return public.integration_rotate_webhook_secret_core_v32(p_endpoint_id);
end; $$;

create or replace function public.platform_requeue_webhook_delivery_v32(p_delivery_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=public,auth as $$
declare v_org uuid;
begin
  perform public.platform_assert_admin_v2('platform.webhooks.manage',true);
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'REASON_REQUIRED'; end if;
  update public.integration_webhook_deliveries set status='queued',next_attempt_at=now(),locked_at=null,last_error=null
  where id=p_delivery_id returning organization_id into v_org;
  if v_org is null then raise exception 'DELIVERY_NOT_FOUND'; end if;
end; $$;

-- =========================================================
-- 11. RPC DE DOMINIOS, SSO, CORREO Y CONECTORES
-- =========================================================

create or replace function public.integration_register_domain_core_v32(p_organization_id uuid,p_domain text,p_type text,p_primary boolean)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare v_domain text:=public.integration_normalize_domain_v32(p_domain); v_token text; v_id uuid; v_expected text;
begin
  if v_domain !~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$' then raise exception 'INVALID_DOMAIN'; end if;
  if p_type not in ('app','public_form','api') then raise exception 'INVALID_DOMAIN_TYPE'; end if;
  v_token:='orkesta-verification='||encode(extensions.gen_random_bytes(18),'hex');
  select case p_type when 'app' then app_cname_target when 'public_form' then public_form_cname_target else api_cname_target end
    into v_expected from public.platform_integration_settings where singleton=true;
  if p_primary then update public.integration_domains set is_primary=false where organization_id=p_organization_id and domain_type=p_type; end if;
  insert into public.integration_domains(
    organization_id,domain,domain_type,verification_token,verification_record_name,expected_cname,is_primary,created_by,updated_by
  ) values(
    p_organization_id,v_domain,p_type,v_token,'_orkesta-verification.'||v_domain,v_expected,coalesce(p_primary,false),auth.uid(),auth.uid()
  )
  on conflict(organization_id,domain) do update set domain_type=excluded.domain_type,status='pending',verification_token=excluded.verification_token,
    verification_record_name=excluded.verification_record_name,expected_cname=excluded.expected_cname,is_primary=excluded.is_primary,error_message=null,updated_by=auth.uid()
  returning id into v_id;
  return jsonb_build_object('id',v_id,'domain',v_domain,'recordName','_orkesta-verification.'||v_domain,'recordType','TXT','recordValue',v_token,'expectedCname',v_expected);
end; $$;

create or replace function public.platform_register_domain_v32(p_organization_id uuid,p_domain text,p_type text,p_primary boolean,p_reason text)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
begin
  perform public.platform_assert_admin_v2('platform.domains.manage',true);
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'REASON_REQUIRED'; end if;
  return public.integration_register_domain_core_v32(p_organization_id,p_domain,p_type,p_primary);
end; $$;

create or replace function public.organization_register_domain_v32(p_domain text,p_type text,p_primary boolean default false)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare v_org uuid:=public.platform_current_organization_id_v1();
begin
  perform public.integration_assert_org_permission_v32(v_org,'integrations.domains.manage');
  return public.integration_register_domain_core_v32(v_org,p_domain,p_type,p_primary);
end; $$;

create or replace function public.integration_upsert_sso_core_v32(p_organization_id uuid,p_payload jsonb)
returns void language plpgsql security definer set search_path=public,auth as $$
declare v_domains text[];
begin
  select coalesce(array_agg(lower(value)),'{}'::text[]) into v_domains from jsonb_array_elements_text(coalesce(p_payload->'emailDomains','[]'::jsonb));
  insert into public.organization_sso_configurations(
    organization_id,mode,status,provider_name,email_domains,discovery_url,metadata_url,client_id,secret_ref,
    attribute_mapping,enforce_for_domains,allow_password_fallback,notes,updated_by
  ) values(
    p_organization_id,coalesce(p_payload->>'mode','disabled'),coalesce(p_payload->>'status','draft'),p_payload->>'providerName',v_domains,
    p_payload->>'discoveryUrl',p_payload->>'metadataUrl',p_payload->>'clientId',p_payload->>'secretRef',coalesce(p_payload->'attributeMapping','{}'::jsonb),
    coalesce((p_payload->>'enforceForDomains')::boolean,false),coalesce((p_payload->>'allowPasswordFallback')::boolean,true),p_payload->>'notes',auth.uid()
  ) on conflict(organization_id) do update set
    mode=excluded.mode,status=excluded.status,provider_name=excluded.provider_name,email_domains=excluded.email_domains,
    discovery_url=excluded.discovery_url,metadata_url=excluded.metadata_url,client_id=excluded.client_id,secret_ref=excluded.secret_ref,
    attribute_mapping=excluded.attribute_mapping,enforce_for_domains=excluded.enforce_for_domains,
    allow_password_fallback=excluded.allow_password_fallback,notes=excluded.notes,updated_by=auth.uid();
end; $$;

create or replace function public.platform_upsert_sso_v32(p_organization_id uuid,p_payload jsonb,p_reason text)
returns void language plpgsql security definer set search_path=public,auth as $$
begin perform public.platform_assert_admin_v2('platform.sso.manage',true); if length(trim(coalesce(p_reason,'')))<5 then raise exception 'REASON_REQUIRED'; end if; perform public.integration_upsert_sso_core_v32(p_organization_id,p_payload); end; $$;

create or replace function public.organization_upsert_sso_v32(p_payload jsonb)
returns void language plpgsql security definer set search_path=public,auth as $$
declare v_org uuid:=public.platform_current_organization_id_v1();
begin perform public.integration_assert_org_permission_v32(v_org,'integrations.manage'); perform public.integration_upsert_sso_core_v32(v_org,p_payload); end; $$;

create or replace function public.integration_upsert_email_core_v32(p_organization_id uuid,p_payload jsonb)
returns void language plpgsql security definer set search_path=public,auth as $$
begin
  if coalesce(p_payload->>'mode','platform')='webhook' and not public.integration_validate_url_v32(p_payload->>'webhookUrl') then raise exception 'INVALID_EMAIL_WEBHOOK_URL'; end if;
  insert into public.organization_email_channels(
    organization_id,mode,status,from_name,from_email,reply_to_email,webhook_url,secret_ref,provider_name,provider_configuration,updated_by
  ) values(
    p_organization_id,coalesce(p_payload->>'mode','platform'),coalesce(p_payload->>'status','active'),p_payload->>'fromName',p_payload->>'fromEmail',
    p_payload->>'replyToEmail',p_payload->>'webhookUrl',p_payload->>'secretRef',p_payload->>'providerName',coalesce(p_payload->'providerConfiguration','{}'::jsonb),auth.uid()
  ) on conflict(organization_id) do update set mode=excluded.mode,status=excluded.status,from_name=excluded.from_name,from_email=excluded.from_email,
    reply_to_email=excluded.reply_to_email,webhook_url=excluded.webhook_url,secret_ref=excluded.secret_ref,provider_name=excluded.provider_name,
    provider_configuration=excluded.provider_configuration,updated_by=auth.uid();
end; $$;

create or replace function public.platform_upsert_email_channel_v32(p_organization_id uuid,p_payload jsonb,p_reason text)
returns void language plpgsql security definer set search_path=public,auth as $$
begin perform public.platform_assert_admin_v2('platform.integrations.manage',true); if length(trim(coalesce(p_reason,'')))<5 then raise exception 'REASON_REQUIRED'; end if; perform public.integration_upsert_email_core_v32(p_organization_id,p_payload); end; $$;

create or replace function public.organization_upsert_email_channel_v32(p_payload jsonb)
returns void language plpgsql security definer set search_path=public,auth as $$
declare v_org uuid:=public.platform_current_organization_id_v1();
begin perform public.integration_assert_org_permission_v32(v_org,'integrations.manage'); perform public.integration_upsert_email_core_v32(v_org,p_payload); end; $$;

create or replace function public.integration_upsert_connector_core_v32(p_organization_id uuid,p_payload jsonb)
returns uuid language plpgsql security definer set search_path=public,auth as $$
declare v_id uuid:=nullif(p_payload->>'id','')::uuid; v_caps text[];
begin
  select coalesce(array_agg(value),'{}'::text[]) into v_caps from jsonb_array_elements_text(coalesce(p_payload->'capabilities','[]'::jsonb));
  if v_id is null then
    insert into public.integration_connectors(organization_id,provider,name,status,capabilities,configuration,secret_ref,created_by,updated_by)
    values(p_organization_id,p_payload->>'provider',p_payload->>'name',coalesce(p_payload->>'status','draft'),v_caps,coalesce(p_payload->'configuration','{}'::jsonb),p_payload->>'secretRef',auth.uid(),auth.uid()) returning id into v_id;
  else
    update public.integration_connectors set provider=p_payload->>'provider',name=p_payload->>'name',status=coalesce(p_payload->>'status',status),
      capabilities=v_caps,configuration=coalesce(p_payload->'configuration','{}'::jsonb),secret_ref=p_payload->>'secretRef',updated_by=auth.uid()
    where id=v_id and organization_id=p_organization_id;
    if not found then raise exception 'CONNECTOR_NOT_FOUND'; end if;
  end if;
  return v_id;
end; $$;

create or replace function public.platform_upsert_connector_v32(p_organization_id uuid,p_payload jsonb,p_reason text)
returns uuid language plpgsql security definer set search_path=public,auth as $$
begin perform public.platform_assert_admin_v2('platform.integrations.manage',true); if length(trim(coalesce(p_reason,'')))<5 then raise exception 'REASON_REQUIRED'; end if; return public.integration_upsert_connector_core_v32(p_organization_id,p_payload); end; $$;

create or replace function public.organization_upsert_connector_v32(p_payload jsonb)
returns uuid language plpgsql security definer set search_path=public,auth as $$
declare v_org uuid:=public.platform_current_organization_id_v1();
begin perform public.integration_assert_org_permission_v32(v_org,'integrations.manage'); return public.integration_upsert_connector_core_v32(v_org,p_payload); end; $$;

-- =========================================================
-- 12. RPC DE EXPORTACIONES
-- =========================================================

create or replace function public.integration_request_export_core_v32(p_organization_id uuid,p_scope text,p_format text,p_reason text)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare v_id uuid; v_retention int;
begin
  if p_scope not in ('full','cases','documents','configuration','audit') then raise exception 'INVALID_EXPORT_SCOPE'; end if;
  if p_format not in ('json_gzip') then raise exception 'INVALID_EXPORT_FORMAT'; end if;
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'REASON_REQUIRED'; end if;
  select exports_retention_days into v_retention from public.platform_integration_settings where singleton=true;
  insert into public.organization_data_exports(organization_id,requested_by,scope,format,reason,expires_at)
  values(p_organization_id,auth.uid(),p_scope,p_format,trim(p_reason),now()+make_interval(days=>coalesce(v_retention,30))) returning id into v_id;
  return jsonb_build_object('id',v_id,'status','queued','organizationId',p_organization_id,'scope',p_scope,'format',p_format);
end; $$;

create or replace function public.platform_request_data_export_v32(p_organization_id uuid,p_scope text,p_format text,p_reason text)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
begin perform public.platform_assert_admin_v2('platform.exports.manage',true); return public.integration_request_export_core_v32(p_organization_id,p_scope,p_format,p_reason); end; $$;

create or replace function public.organization_request_data_export_v32(p_scope text,p_format text,p_reason text)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare v_org uuid:=public.platform_current_organization_id_v1();
begin perform public.integration_assert_org_permission_v32(v_org,'integrations.exports.manage'); return public.integration_request_export_core_v32(v_org,p_scope,p_format,p_reason); end; $$;

create or replace function public.integration_get_export_download_v32(p_export_id uuid)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare v_row public.organization_data_exports%rowtype; v_org uuid:=public.platform_current_organization_id_v1();
begin
  select * into v_row from public.organization_data_exports where id=p_export_id;
  if v_row.id is null then raise exception 'EXPORT_NOT_FOUND'; end if;
  if not public.platform_is_admin_v2('platform.exports.view') then
    if v_row.organization_id is distinct from v_org then raise exception 'EXPORT_NOT_FOUND'; end if;
    perform public.integration_assert_org_permission_v32(v_org,'integrations.exports.manage');
  end if;
  if v_row.status<>'completed' or v_row.expires_at<=now() then raise exception 'EXPORT_NOT_AVAILABLE'; end if;
  return jsonb_build_object('id',v_row.id,'storagePath',v_row.storage_path,'fileName',v_row.file_name,'expiresAt',v_row.expires_at);
end; $$;

-- =========================================================
-- 13. CENTRO DE CONOCIMIENTO
-- =========================================================

create or replace function public.platform_list_knowledge_v32(p_status text default null,p_search text default null)
returns jsonb language plpgsql stable security definer set search_path=public,auth as $$
begin
  perform public.platform_assert_admin_v2('platform.knowledge.view',false);
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',a.id,'organizationId',a.organization_id,'organizationName',o.name,'categoryId',a.category_id,'categoryName',c.name,
    'slug',a.slug,'title',a.title,'summary',a.summary,'contentMarkdown',a.content_markdown,'visibility',a.visibility,'status',a.status,
    'tags',a.tags,'featured',a.featured,'viewCount',a.view_count,'helpfulCount',a.helpful_count,'unhelpfulCount',a.unhelpful_count,
    'publishedAt',a.published_at,'updatedAt',a.updated_at
  ) order by a.featured desc,a.updated_at desc)
  from public.knowledge_articles a left join public.knowledge_categories c on c.id=a.category_id left join public.organizations o on o.id=a.organization_id
  where (p_status is null or a.status=p_status) and (p_search is null or a.title ilike '%'||p_search||'%' or coalesce(a.summary,'') ilike '%'||p_search||'%')),'[]'::jsonb);
end; $$;

create or replace function public.platform_upsert_knowledge_article_v32(p_payload jsonb,p_reason text)
returns uuid language plpgsql security definer set search_path=public,auth as $$
declare v_id uuid:=nullif(p_payload->>'id','')::uuid; v_status text:=coalesce(p_payload->>'status','draft');
begin
  perform public.platform_assert_admin_v2('platform.knowledge.manage',true);
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'REASON_REQUIRED'; end if;
  if v_id is null then
    insert into public.knowledge_articles(organization_id,category_id,slug,title,summary,content_markdown,visibility,status,tags,featured,created_by,updated_by,published_at)
    values(nullif(p_payload->>'organizationId','')::uuid,nullif(p_payload->>'categoryId','')::uuid,p_payload->>'slug',p_payload->>'title',p_payload->>'summary',coalesce(p_payload->>'contentMarkdown',''),coalesce(p_payload->>'visibility','authenticated'),v_status,
      coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'tags','[]'::jsonb))),'{}'::text[]),coalesce((p_payload->>'featured')::boolean,false),auth.uid(),auth.uid(),case when v_status='published' then now() else null end)
    returning id into v_id;
  else
    update public.knowledge_articles set organization_id=nullif(p_payload->>'organizationId','')::uuid,category_id=nullif(p_payload->>'categoryId','')::uuid,
      slug=p_payload->>'slug',title=p_payload->>'title',summary=p_payload->>'summary',content_markdown=coalesce(p_payload->>'contentMarkdown',''),
      visibility=coalesce(p_payload->>'visibility','authenticated'),status=v_status,tags=coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'tags','[]'::jsonb))),'{}'::text[]),
      featured=coalesce((p_payload->>'featured')::boolean,false),updated_by=auth.uid(),published_at=case when v_status='published' then coalesce(published_at,now()) else published_at end
    where id=v_id;
    if not found then raise exception 'ARTICLE_NOT_FOUND'; end if;
  end if;
  return v_id;
end; $$;

create or replace function public.knowledge_list_articles_v32(p_search text default null,p_category text default null)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare v_org uuid:=public.platform_current_organization_id_v1();
begin
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',a.id,'slug',a.slug,'title',a.title,'summary',a.summary,'contentMarkdown',a.content_markdown,'category',c.name,
    'categoryCode',c.code,'tags',a.tags,'featured',a.featured,'publishedAt',a.published_at,'viewCount',a.view_count
  ) order by a.featured desc,a.published_at desc)
  from public.knowledge_articles a left join public.knowledge_categories c on c.id=a.category_id
  where a.status='published'
    and (a.organization_id is null or a.organization_id=v_org)
    and a.visibility in ('public','authenticated','organization')
    and (p_search is null or a.title ilike '%'||p_search||'%' or coalesce(a.summary,'') ilike '%'||p_search||'%' or a.content_markdown ilike '%'||p_search||'%')
    and (p_category is null or c.code=p_category)),'[]'::jsonb);
end; $$;

create or replace function public.knowledge_get_article_v32(p_slug text)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare v_org uuid:=public.platform_current_organization_id_v1(); v_row record;
begin
  select a.*,c.name category_name,c.code category_code into v_row
  from public.knowledge_articles a left join public.knowledge_categories c on c.id=a.category_id
  where a.slug=p_slug and a.status='published' and (a.organization_id is null or a.organization_id=v_org)
    and a.visibility in ('public','authenticated','organization')
  order by case when a.organization_id=v_org then 0 else 1 end limit 1;
  if v_row.id is null then raise exception 'ARTICLE_NOT_FOUND'; end if;
  update public.knowledge_articles set view_count=view_count+1 where id=v_row.id;
  return jsonb_build_object('id',v_row.id,'slug',v_row.slug,'title',v_row.title,'summary',v_row.summary,'contentMarkdown',v_row.content_markdown,
    'category',v_row.category_name,'categoryCode',v_row.category_code,'tags',v_row.tags,'featured',v_row.featured,'publishedAt',v_row.published_at,'viewCount',v_row.view_count+1);
end; $$;

create or replace function public.knowledge_feedback_v32(p_article_id uuid,p_helpful boolean,p_comment text default null)
returns void language plpgsql security definer set search_path=public,auth as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  insert into public.knowledge_article_feedback(article_id,user_id,helpful,comment) values(p_article_id,auth.uid(),p_helpful,p_comment)
  on conflict(article_id,user_id) do update set helpful=excluded.helpful,comment=excluded.comment,updated_at=now();
  update public.knowledge_articles a set helpful_count=(select count(*) from public.knowledge_article_feedback f where f.article_id=a.id and f.helpful),
    unhelpful_count=(select count(*) from public.knowledge_article_feedback f where f.article_id=a.id and not f.helpful)
  where a.id=p_article_id;
end; $$;

-- =========================================================
-- 14. SNAPSHOTS PARA UI
-- =========================================================

create or replace function public.integration_snapshot_for_org_v32(p_organization_id uuid,p_platform boolean default false)
returns jsonb language plpgsql stable security definer set search_path=public,auth as $$
begin
  return jsonb_build_object(
    'organization',(select jsonb_build_object('id',o.id,'name',o.name,'slug',o.slug,'isActive',o.is_active) from public.organizations o where o.id=p_organization_id),
    'settings',(select to_jsonb(s) from public.platform_integration_settings s where singleton=true),
    'eventCatalog',(select coalesce(jsonb_agg(jsonb_build_object('code',code,'name',name,'category',category,'description',description) order by category,name),'[]'::jsonb) from public.integration_event_catalog where is_active),
    'apiKeys',(select coalesce(jsonb_agg(jsonb_build_object('id',k.id,'name',k.name,'environment',k.environment,'prefix',k.key_prefix,'scopes',k.scopes,'status',k.status,'rateLimitPerMinute',k.rate_limit_per_minute,'expiresAt',k.expires_at,'lastUsedAt',k.last_used_at,'usageCount',k.usage_count,'createdAt',k.created_at) order by k.created_at desc),'[]'::jsonb) from public.integration_api_keys k where k.organization_id=p_organization_id),
    'webhooks',(select coalesce(jsonb_agg(jsonb_build_object('id',w.id,'name',w.name,'endpointUrl',w.endpoint_url,'events',w.events,'status',w.status,'apiVersion',w.api_version,'maxAttempts',w.max_attempts,'timeoutMs',w.timeout_ms,'lastSuccessAt',w.last_success_at,'lastFailureAt',w.last_failure_at,'consecutiveFailures',w.consecutive_failures,'createdAt',w.created_at) order by w.created_at desc),'[]'::jsonb) from public.integration_webhook_endpoints w where w.organization_id=p_organization_id),
    'deliveries',(select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'endpointId',d.endpoint_id,'eventType',d.event_type,'eventId',d.event_id,'status',d.status,'attempts',d.attempts,'maxAttempts',d.max_attempts,'responseStatus',d.response_status,'lastError',d.last_error,'createdAt',d.created_at,'deliveredAt',d.delivered_at) order by d.created_at desc),'[]'::jsonb) from (select * from public.integration_webhook_deliveries where organization_id=p_organization_id order by created_at desc limit 100) d),
    'domains',(select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'domain',d.domain,'domainType',d.domain_type,'status',d.status,'verificationToken',d.verification_token,'verificationRecordName',d.verification_record_name,'expectedCname',d.expected_cname,'isPrimary',d.is_primary,'lastCheckedAt',d.last_checked_at,'verifiedAt',d.verified_at,'errorMessage',d.error_message) order by d.created_at desc),'[]'::jsonb) from public.integration_domains d where d.organization_id=p_organization_id),
    'sso',(select to_jsonb(s)-'secret_ref' from public.organization_sso_configurations s where s.organization_id=p_organization_id),
    'emailChannel',(select to_jsonb(e)-'secret_ref' from public.organization_email_channels e where e.organization_id=p_organization_id),
    'connectors',(select coalesce(jsonb_agg((to_jsonb(c)-'secret_ref') order by c.created_at desc),'[]'::jsonb) from public.integration_connectors c where c.organization_id=p_organization_id),
    'exports',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'scope',x.scope,'format',x.format,'reason',x.reason,'status',x.status,'fileName',x.file_name,'sizeBytes',x.size_bytes,'checksum',x.checksum,'errorMessage',x.error_message,'completedAt',x.completed_at,'expiresAt',x.expires_at,'createdAt',x.created_at) order by x.created_at desc),'[]'::jsonb) from public.organization_data_exports x where x.organization_id=p_organization_id)
  );
end; $$;

create or replace function public.platform_get_integrations_dashboard_v32()
returns jsonb language plpgsql stable security definer set search_path=public,auth as $$
begin
  perform public.platform_assert_admin_v2('platform.integrations.view',false);
  return jsonb_build_object(
    'settings',(select jsonb_build_object(
      'publicApiBaseUrl',s.public_api_base_url,
      'appCnameTarget',s.app_cname_target,
      'publicFormCnameTarget',s.public_form_cname_target,
      'apiCnameTarget',s.api_cname_target,
      'exportsRetentionDays',s.exports_retention_days,
      'webhookMaxAttempts',s.webhook_max_attempts,
      'webhookTimeoutMs',s.webhook_timeout_ms
    ) from public.platform_integration_settings s where s.singleton=true),
    'metrics',jsonb_build_object(
      'activeApiKeys',(select count(*) from public.integration_api_keys where status='active' and (expires_at is null or expires_at>now())),
      'activeWebhooks',(select count(*) from public.integration_webhook_endpoints where status='active'),
      'failedDeliveries',(select count(*) from public.integration_webhook_deliveries where status in ('failed','dead_letter')),
      'pendingDomains',(select count(*) from public.integration_domains where status='pending'),
      'verifiedDomains',(select count(*) from public.integration_domains where status in ('verified','active')),
      'ssoReady',(select count(*) from public.organization_sso_configurations where status in ('ready','active')),
      'pendingExports',(select count(*) from public.organization_data_exports where status in ('queued','processing')),
      'connectedConnectors',(select count(*) from public.integration_connectors where status='connected')
    ),
    'organizations',(select coalesce(jsonb_agg(jsonb_build_object(
      'organizationId',o.id,'organizationName',o.name,'slug',o.slug,
      'apiKeys',(select count(*) from public.integration_api_keys k where k.organization_id=o.id and k.status='active'),
      'webhooks',(select count(*) from public.integration_webhook_endpoints w where w.organization_id=o.id and w.status='active'),
      'domains',(select count(*) from public.integration_domains d where d.organization_id=o.id),
      'ssoStatus',(select s.status from public.organization_sso_configurations s where s.organization_id=o.id),
      'connectors',(select count(*) from public.integration_connectors c where c.organization_id=o.id and c.status='connected'),
      'failedDeliveries',(select count(*) from public.integration_webhook_deliveries d where d.organization_id=o.id and d.status in ('failed','dead_letter')),
      'lastApiUse',(select max(k.last_used_at) from public.integration_api_keys k where k.organization_id=o.id)
    ) order by o.name),'[]'::jsonb) from public.organizations o),
    'recentFailures',(select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'organizationId',d.organization_id,'organizationName',o.name,'endpointId',d.endpoint_id,'eventType',d.event_type,'status',d.status,'attempts',d.attempts,'lastError',d.last_error,'createdAt',d.created_at) order by d.created_at desc),'[]'::jsonb)
      from (select * from public.integration_webhook_deliveries where status in ('failed','dead_letter') order by created_at desc limit 30) d join public.organizations o on o.id=d.organization_id)
  );
end; $$;

create or replace function public.platform_get_organization_integrations_v32(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,auth as $$
begin perform public.platform_assert_admin_v2('platform.integrations.view',false); return public.integration_snapshot_for_org_v32(p_organization_id,true); end; $$;

create or replace function public.organization_get_integrations_portal_v32()
returns jsonb language plpgsql stable security definer set search_path=public,auth as $$
declare v_org uuid:=public.platform_current_organization_id_v1();
begin perform public.integration_assert_org_permission_v32(v_org,'integrations.view'); return public.integration_snapshot_for_org_v32(v_org,false); end; $$;

create or replace function public.platform_update_integration_settings_v32(p_payload jsonb,p_reason text)
returns void language plpgsql security definer set search_path=public,auth as $$
begin
  perform public.platform_assert_admin_v2('platform.integrations.manage',true);
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'REASON_REQUIRED'; end if;
  update public.platform_integration_settings set
    public_api_base_url=p_payload->>'publicApiBaseUrl',app_cname_target=p_payload->>'appCnameTarget',
    public_form_cname_target=p_payload->>'publicFormCnameTarget',api_cname_target=p_payload->>'apiCnameTarget',
    exports_retention_days=greatest(1,least(coalesce((p_payload->>'exportsRetentionDays')::int,exports_retention_days),365)),
    webhook_max_attempts=greatest(1,least(coalesce((p_payload->>'webhookMaxAttempts')::int,webhook_max_attempts),20)),
    webhook_timeout_ms=greatest(1000,least(coalesce((p_payload->>'webhookTimeoutMs')::int,webhook_timeout_ms),60000)),
    updated_by=auth.uid()
  where singleton=true;
end; $$;

-- =========================================================
-- 15. SCHEDULER DE INTEGRACIONES
-- =========================================================

create or replace function public.platform_integrations_scheduler_tick_v32()
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare v_delivery_ids uuid[]; v_export_ids uuid[]; v_domain_ids uuid[];
begin
  if not public.platform_is_service_role_v2() and not public.platform_is_admin_v2('platform.operations.manage') then raise exception 'PLATFORM_ACCESS_DENIED' using errcode='42501'; end if;

  update public.integration_api_keys set status='expired' where status='active' and expires_at is not null and expires_at<=now();
  update public.organization_data_exports set status='expired' where status='completed' and expires_at<=now();

  select coalesce(array_agg(id),'{}'::uuid[]) into v_delivery_ids from (
    select id from public.integration_webhook_deliveries
    where status in ('queued','failed') and next_attempt_at<=now() and attempts<max_attempts
    order by created_at limit 100
  ) x;

  select coalesce(array_agg(id),'{}'::uuid[]) into v_export_ids from (
    select id from public.organization_data_exports where status='queued' order by created_at limit 10
  ) x;

  select coalesce(array_agg(id),'{}'::uuid[]) into v_domain_ids from (
    select id from public.integration_domains where status='pending' and (last_checked_at is null or last_checked_at<now()-interval '30 minutes') order by created_at limit 50
  ) x;

  delete from public.integration_api_usage_windows where window_started_at<now()-interval '2 days';
  delete from public.integration_api_request_logs where created_at<now()-interval '180 days';

  return jsonb_build_object('webhookDeliveryIds',v_delivery_ids,'exportJobIds',v_export_ids,'domainIds',v_domain_ids,'generatedAt',now());
end;
$$;

-- =========================================================
-- 16. RLS, POLÍTICAS Y GRANTS
-- =========================================================

DO $$
declare tbl text;
begin
  foreach tbl in array array[
    'platform_integration_settings','integration_event_catalog','integration_api_keys','integration_api_usage_windows','integration_api_request_logs',
    'integration_webhook_endpoints','integration_webhook_secrets','integration_webhook_deliveries','integration_domains',
    'organization_sso_configurations','organization_email_channels','integration_connectors','organization_data_exports',
    'knowledge_categories','knowledge_articles','knowledge_article_feedback'
  ] loop
    execute format('alter table public.%I enable row level security',tbl);
  end loop;
end $$;

-- Limpieza de políticas previas si la migración se vuelve a ejecutar.
DO $$
declare r record;
begin
  for r in select schemaname,tablename,policyname from pg_policies where schemaname='public' and policyname like 'phase32_%' loop
    execute format('drop policy if exists %I on %I.%I',r.policyname,r.schemaname,r.tablename);
  end loop;
end $$;

create policy phase32_platform_settings_select on public.platform_integration_settings for select to authenticated using(public.platform_is_admin_v2('platform.integrations.view'));
create policy phase32_event_catalog_select on public.integration_event_catalog for select to authenticated using(auth.uid() is not null);

create policy phase32_api_keys_select on public.integration_api_keys for select to authenticated using(
  public.platform_is_admin_v2('platform.api.view') or (organization_id=public.platform_current_organization_id_v1() and public.platform_member_has_permission_v1(organization_id,'integrations.view'))
);
create policy phase32_api_logs_select on public.integration_api_request_logs for select to authenticated using(
  public.platform_is_admin_v2('platform.api.view') or (organization_id=public.platform_current_organization_id_v1() and public.platform_member_has_permission_v1(organization_id,'integrations.view'))
);
create policy phase32_webhooks_select on public.integration_webhook_endpoints for select to authenticated using(
  public.platform_is_admin_v2('platform.webhooks.view') or (organization_id=public.platform_current_organization_id_v1() and public.platform_member_has_permission_v1(organization_id,'integrations.view'))
);
create policy phase32_deliveries_select on public.integration_webhook_deliveries for select to authenticated using(
  public.platform_is_admin_v2('platform.webhooks.view') or (organization_id=public.platform_current_organization_id_v1() and public.platform_member_has_permission_v1(organization_id,'integrations.view'))
);
create policy phase32_domains_select on public.integration_domains for select to authenticated using(
  public.platform_is_admin_v2('platform.domains.view') or (organization_id=public.platform_current_organization_id_v1() and public.platform_member_has_permission_v1(organization_id,'integrations.view'))
);
create policy phase32_sso_select on public.organization_sso_configurations for select to authenticated using(
  public.platform_is_admin_v2('platform.sso.view') or (organization_id=public.platform_current_organization_id_v1() and public.platform_member_has_permission_v1(organization_id,'integrations.view'))
);
create policy phase32_email_select on public.organization_email_channels for select to authenticated using(
  public.platform_is_admin_v2('platform.integrations.view') or (organization_id=public.platform_current_organization_id_v1() and public.platform_member_has_permission_v1(organization_id,'integrations.view'))
);
create policy phase32_connectors_select on public.integration_connectors for select to authenticated using(
  public.platform_is_admin_v2('platform.integrations.view') or (organization_id=public.platform_current_organization_id_v1() and public.platform_member_has_permission_v1(organization_id,'integrations.view'))
);
create policy phase32_exports_select on public.organization_data_exports for select to authenticated using(
  public.platform_is_admin_v2('platform.exports.view') or (organization_id=public.platform_current_organization_id_v1() and public.platform_member_has_permission_v1(organization_id,'integrations.view'))
);
create policy phase32_categories_select on public.knowledge_categories for select to authenticated using(organization_id is null or organization_id=public.platform_current_organization_id_v1() or public.platform_is_admin_v2('platform.knowledge.view'));
create policy phase32_articles_select on public.knowledge_articles for select to authenticated using(
  public.platform_is_admin_v2('platform.knowledge.view') or (status='published' and (organization_id is null or organization_id=public.platform_current_organization_id_v1()) and visibility in ('public','authenticated','organization'))
);
create policy phase32_feedback_select on public.knowledge_article_feedback for select to authenticated using(user_id=auth.uid() or public.platform_is_admin_v2('platform.knowledge.view'));

-- Storage: los archivos solo se entregan mediante URL firmada por función/cliente autorizado.
drop policy if exists phase32_exports_storage_select on storage.objects;
create policy phase32_exports_storage_select on storage.objects for select to authenticated using(
  bucket_id='organization-exports' and (
    public.platform_is_admin_v2('platform.exports.view') or exists(
      select 1 from public.organization_data_exports e where e.storage_path=name and e.organization_id=public.platform_current_organization_id_v1()
    )
  )
);

-- Tabla de secretos: sin políticas authenticated. Exclusiva service_role.
revoke all on public.integration_webhook_secrets from authenticated,anon;

-- Grants de tablas.
grant select on public.platform_integration_settings,public.integration_event_catalog,public.integration_api_keys,public.integration_api_request_logs,
  public.integration_webhook_endpoints,public.integration_webhook_deliveries,public.integration_domains,public.organization_sso_configurations,
  public.organization_email_channels,public.integration_connectors,public.organization_data_exports,public.knowledge_categories,public.knowledge_articles,
  public.knowledge_article_feedback to authenticated;

grant all on public.platform_integration_settings,public.integration_event_catalog,public.integration_api_keys,public.integration_api_usage_windows,
  public.integration_api_request_logs,public.integration_webhook_endpoints,public.integration_webhook_secrets,public.integration_webhook_deliveries,
  public.integration_domains,public.organization_sso_configurations,public.organization_email_channels,public.integration_connectors,
  public.organization_data_exports,public.knowledge_categories,public.knowledge_articles,public.knowledge_article_feedback to service_role;

grant usage,select on sequence public.integration_api_request_logs_id_seq to service_role;

-- Ejecución de RPC.
grant execute on function public.platform_get_integrations_dashboard_v32() to authenticated;
grant execute on function public.platform_get_organization_integrations_v32(uuid) to authenticated;
grant execute on function public.organization_get_integrations_portal_v32() to authenticated;
grant execute on function public.platform_create_api_key_v32(uuid,text,text,text[],integer,timestamptz,text) to authenticated;
grant execute on function public.organization_create_api_key_v32(text,text,text[],integer,timestamptz) to authenticated;
grant execute on function public.platform_revoke_api_key_v32(uuid,text) to authenticated;
grant execute on function public.organization_revoke_api_key_v32(uuid,text) to authenticated;
grant execute on function public.platform_upsert_webhook_v32(uuid,jsonb,text) to authenticated;
grant execute on function public.organization_upsert_webhook_v32(jsonb) to authenticated;
grant execute on function public.platform_rotate_webhook_secret_v32(uuid,text) to authenticated;
grant execute on function public.organization_rotate_webhook_secret_v32(uuid) to authenticated;
grant execute on function public.platform_requeue_webhook_delivery_v32(uuid,text) to authenticated;
grant execute on function public.platform_register_domain_v32(uuid,text,text,boolean,text) to authenticated;
grant execute on function public.organization_register_domain_v32(text,text,boolean) to authenticated;
grant execute on function public.platform_upsert_sso_v32(uuid,jsonb,text) to authenticated;
grant execute on function public.organization_upsert_sso_v32(jsonb) to authenticated;
grant execute on function public.platform_upsert_email_channel_v32(uuid,jsonb,text) to authenticated;
grant execute on function public.organization_upsert_email_channel_v32(jsonb) to authenticated;
grant execute on function public.platform_upsert_connector_v32(uuid,jsonb,text) to authenticated;
grant execute on function public.organization_upsert_connector_v32(jsonb) to authenticated;
grant execute on function public.platform_request_data_export_v32(uuid,text,text,text) to authenticated;
grant execute on function public.organization_request_data_export_v32(text,text,text) to authenticated;
grant execute on function public.integration_get_export_download_v32(uuid) to authenticated;
grant execute on function public.platform_list_knowledge_v32(text,text) to authenticated;
grant execute on function public.platform_upsert_knowledge_article_v32(jsonb,text) to authenticated;
grant execute on function public.knowledge_list_articles_v32(text,text) to authenticated;
grant execute on function public.knowledge_get_article_v32(text) to authenticated;
grant execute on function public.knowledge_feedback_v32(uuid,boolean,text) to authenticated;
grant execute on function public.platform_update_integration_settings_v32(jsonb,text) to authenticated;
grant execute on function public.platform_integrations_scheduler_tick_v32() to authenticated,service_role;

-- Service role helpers para Edge Functions.
grant execute on function public.integration_hash_secret_v32(text) to service_role;
grant execute on function public.platform_integrations_scheduler_tick_v32() to service_role;

-- El explorador general mantiene sus dominios existentes; las integraciones tienen un explorador dedicado en la nueva interfaz.

-- Autorización puntual para operaciones de Edge Functions iniciadas por usuarios organizacionales.
create or replace function public.integration_can_access_resource_v32(p_resource text,p_resource_id uuid,p_permission text)
returns boolean
language plpgsql
stable
security definer
set search_path=public,auth
as $$
declare v_org uuid;
begin
  if auth.uid() is null then return false; end if;
  if public.platform_is_admin_v2() then return true; end if;
  case p_resource
    when 'webhook' then select organization_id into v_org from public.integration_webhook_endpoints where id=p_resource_id;
    when 'domain' then select organization_id into v_org from public.integration_domains where id=p_resource_id;
    when 'export' then select organization_id into v_org from public.organization_data_exports where id=p_resource_id;
    else return false;
  end case;
  if v_org is null or v_org is distinct from public.platform_current_organization_id_v1() then return false; end if;
  return public.platform_member_has_permission_v1(v_org,p_permission);
end;
$$;

grant execute on function public.integration_can_access_resource_v32(text,uuid,text) to authenticated;

-- =========================================================
-- 17. CONTRATO INTERNO PARA LA EDGE FUNCTION DE API PÚBLICA
-- =========================================================

create or replace function public.integration_api_authenticate_v32(p_prefix text,p_hash text,p_ip inet default null)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_key public.integration_api_keys%rowtype; v_window timestamptz:=date_trunc('minute',now()); v_count integer;
begin
  select * into v_key from public.integration_api_keys where key_prefix=p_prefix and key_hash=p_hash;
  if v_key.id is null or v_key.status<>'active' then raise exception 'API_KEY_INVALID' using errcode='28000'; end if;
  if v_key.expires_at is not null and v_key.expires_at<=now() then
    update public.integration_api_keys set status='expired' where id=v_key.id;
    raise exception 'API_KEY_EXPIRED' using errcode='28000';
  end if;
  if coalesce(array_length(v_key.allowed_ips,1),0)>0 and (p_ip is null or not p_ip=any(v_key.allowed_ips)) then raise exception 'API_IP_NOT_ALLOWED' using errcode='28000'; end if;
  insert into public.integration_api_usage_windows(api_key_id,window_started_at,request_count)
  values(v_key.id,v_window,1)
  on conflict(api_key_id,window_started_at) do update set request_count=public.integration_api_usage_windows.request_count+1,updated_at=now()
  returning request_count into v_count;
  if v_count>v_key.rate_limit_per_minute then raise exception 'API_RATE_LIMIT' using errcode='P0001'; end if;
  update public.integration_api_keys set last_used_at=now(),last_used_ip=p_ip,usage_count=usage_count+1 where id=v_key.id;
  return jsonb_build_object('apiKeyId',v_key.id,'organizationId',v_key.organization_id,'name',v_key.name,'environment',v_key.environment,
    'scopes',v_key.scopes,'rateLimitPerMinute',v_key.rate_limit_per_minute,'remaining',greatest(0,v_key.rate_limit_per_minute-v_count));
end;
$$;

create or replace function public.integration_api_assert_scope_v32(p_api_key_id uuid,p_scope text)
returns public.integration_api_keys
language plpgsql
stable
security definer
set search_path=public
as $$
declare v_key public.integration_api_keys%rowtype;
begin
  select * into v_key from public.integration_api_keys where id=p_api_key_id and status='active';
  if v_key.id is null then raise exception 'API_KEY_INVALID'; end if;
  if not (p_scope=any(v_key.scopes) or '*'=any(v_key.scopes)) then raise exception 'API_SCOPE_DENIED' using errcode='42501'; end if;
  return v_key;
end;
$$;

create or replace function public.integration_api_catalogs_v32(p_api_key_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_key public.integration_api_keys%rowtype;
begin
  v_key:=public.integration_api_assert_scope_v32(p_api_key_id,'catalogs.read');
  return jsonb_build_object(
    'caseTypes',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name,'description',description,'isPublic',is_public_enabled) order by sort_order,name),'[]'::jsonb) from public.case_types where organization_id=v_key.organization_id and is_active),
    'priorities',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name,'color',color) order by sort_order,name),'[]'::jsonb) from public.priorities where organization_id=v_key.organization_id and is_active),
    'states',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name,'isInitial',is_initial,'isTerminal',is_terminal) order by sort_order,name),'[]'::jsonb) from public.case_states where organization_id=v_key.organization_id and is_active),
    'areas',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name) order by sort_order,name),'[]'::jsonb) from public.areas where organization_id=v_key.organization_id and is_active)
  );
end; $$;

create or replace function public.integration_api_list_cases_v32(p_api_key_id uuid,p_query text default null,p_page integer default 1,p_page_size integer default 50)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_key public.integration_api_keys%rowtype; v_page int:=greatest(1,coalesce(p_page,1)); v_size int:=least(100,greatest(1,coalesce(p_page_size,50))); v_total bigint;
begin
  v_key:=public.integration_api_assert_scope_v32(p_api_key_id,'cases.read');
  select count(*) into v_total from public.cases c where c.organization_id=v_key.organization_id and c.deleted_at is null
    and (p_query is null or c.radicado ilike '%'||p_query||'%' or c.subject ilike '%'||p_query||'%' or c.requester_name ilike '%'||p_query||'%');
  return jsonb_build_object('rows',coalesce((select jsonb_agg(jsonb_build_object(
    'id',x.id,'radicado',x.radicado,'subject',x.subject,'description',x.description,'source',x.source,'requesterName',x.requester_name,
    'requesterCompany',x.requester_company,'requesterEmail',x.requester_email,'requesterPhone',x.requester_phone,'riskLevel',x.risk_level,
    'progress',x.progress,'openedAt',x.opened_at,'dueAt',x.due_at,'closedAt',x.closed_at,'createdAt',x.created_at,'updatedAt',x.updated_at,
    'caseType',jsonb_build_object('id',x.case_type_id,'name',x.case_type_name),'priority',jsonb_build_object('id',x.priority_id,'name',x.priority_name),
    'state',jsonb_build_object('id',x.state_id,'name',x.state_name),'area',jsonb_build_object('id',x.primary_area_id,'name',x.area_name)
  ) order by x.created_at desc) from (
    select c.*,ct.name case_type_name,p.name priority_name,s.name state_name,a.name area_name
    from public.cases c left join public.case_types ct on ct.id=c.case_type_id left join public.priorities p on p.id=c.priority_id
    left join public.case_states s on s.id=c.state_id left join public.areas a on a.id=c.primary_area_id
    where c.organization_id=v_key.organization_id and c.deleted_at is null
      and (p_query is null or c.radicado ilike '%'||p_query||'%' or c.subject ilike '%'||p_query||'%' or c.requester_name ilike '%'||p_query||'%')
    order by c.created_at desc limit v_size offset ((v_page-1)*v_size)
  ) x),'[]'::jsonb),'total',v_total,'page',v_page,'pageSize',v_size);
end; $$;

create or replace function public.integration_api_get_case_v32(p_api_key_id uuid,p_identifier text)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_key public.integration_api_keys%rowtype; v_result jsonb;
begin
  v_key:=public.integration_api_assert_scope_v32(p_api_key_id,'cases.read');
  select jsonb_build_object(
    'id',c.id,'radicado',c.radicado,'subject',c.subject,'description',c.description,'source',c.source,'requesterName',c.requester_name,
    'requesterCompany',c.requester_company,'requesterDocument',c.requester_document,'requesterEmail',c.requester_email,'responseEmail',c.response_email,
    'requesterPhone',c.requester_phone,'riskLevel',c.risk_level,'progress',c.progress,'openedAt',c.opened_at,'dueAt',c.due_at,'closedAt',c.closed_at,
    'createdAt',c.created_at,'updatedAt',c.updated_at,'customFields',c.custom_fields,
    'caseType',jsonb_build_object('id',ct.id,'code',ct.code,'name',ct.name),'priority',jsonb_build_object('id',p.id,'code',p.code,'name',p.name),
    'state',jsonb_build_object('id',s.id,'code',s.code,'name',s.name),'area',jsonb_build_object('id',a.id,'code',a.code,'name',a.name)
  ) into v_result
  from public.cases c left join public.case_types ct on ct.id=c.case_type_id left join public.priorities p on p.id=c.priority_id
  left join public.case_states s on s.id=c.state_id left join public.areas a on a.id=c.primary_area_id
  where c.organization_id=v_key.organization_id and c.deleted_at is null and (c.id::text=p_identifier or c.radicado=p_identifier) limit 1;
  if v_result is null then raise exception 'CASE_NOT_FOUND' using errcode='P0002'; end if;
  return v_result;
end; $$;

create or replace function public.integration_api_create_case_v32(p_api_key_id uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_key public.integration_api_keys%rowtype; v_year int:=extract(year from now())::int; v_seq bigint; v_radicado text; v_state uuid; v_case uuid; v_type uuid; v_idempotency text;
begin
  v_key:=public.integration_api_assert_scope_v32(p_api_key_id,'cases.write');
  if length(trim(coalesce(p_payload->>'requesterName','')))<2 then raise exception 'REQUESTER_NAME_REQUIRED'; end if;
  if length(trim(coalesce(p_payload->>'subject','')))<3 then raise exception 'SUBJECT_REQUIRED'; end if;
  v_idempotency:=nullif(trim(p_payload->>'idempotencyKey'),'');
  if v_idempotency is not null then
    perform pg_advisory_xact_lock(hashtextextended(v_key.organization_id::text||':'||v_idempotency,0));
    select id,radicado into v_case,v_radicado from public.cases where organization_id=v_key.organization_id and idempotency_key=v_idempotency limit 1;
    if v_case is not null then return jsonb_build_object('id',v_case,'radicado',v_radicado,'idempotentReplay',true); end if;
  end if;
  if nullif(p_payload->>'caseTypeId','') is not null then
    select id into v_type from public.case_types where id=(p_payload->>'caseTypeId')::uuid and organization_id=v_key.organization_id and is_active;
    if v_type is null then raise exception 'CASE_TYPE_NOT_FOUND'; end if;
  end if;
  select id into v_state from public.case_states where organization_id=v_key.organization_id and is_active and is_initial order by sort_order limit 1;
  if v_state is null then select id into v_state from public.case_states where organization_id=v_key.organization_id and is_active order by sort_order limit 1; end if;
  insert into public.case_counters(organization_id,year,last_value) values(v_key.organization_id,v_year,1)
  on conflict(organization_id,year) do update set last_value=public.case_counters.last_value+1,updated_at=now()
  returning last_value into v_seq;
  v_radicado:='SIG-'||v_year::text||'-'||lpad(v_seq::text,6,'0');
  insert into public.cases(
    organization_id,radicado,sequence_year,sequence_number,submitted_case_type_id,state_id,requester_name,requester_company,
    requester_document,requester_email,response_email,requester_phone,subject,description,source,custom_fields,idempotency_key
  ) values(
    v_key.organization_id,v_radicado,v_year,v_seq,v_type,v_state,trim(p_payload->>'requesterName'),nullif(trim(p_payload->>'requesterCompany'),''),
    nullif(trim(p_payload->>'requesterDocument'),''),nullif(trim(p_payload->>'requesterEmail'),''),coalesce(nullif(trim(p_payload->>'responseEmail'),''),nullif(trim(p_payload->>'requesterEmail'),'')),
    nullif(trim(p_payload->>'requesterPhone'),''),trim(p_payload->>'subject'),coalesce(p_payload->>'description',''),'api',coalesce(p_payload->'customFields','{}'::jsonb),v_idempotency
  ) returning id into v_case;
  insert into public.audit_events(organization_id,case_id,event_type,entity_type,entity_id,after_data,metadata)
  values(v_key.organization_id,v_case,'case.created','case',v_case::text,jsonb_build_object('radicado',v_radicado,'source','api'),jsonb_build_object('apiKeyId',p_api_key_id));
  return jsonb_build_object('id',v_case,'radicado',v_radicado,'idempotentReplay',false);
end; $$;

grant execute on function public.integration_api_authenticate_v32(text,text,inet) to service_role;
grant execute on function public.integration_api_catalogs_v32(uuid) to service_role;
grant execute on function public.integration_api_list_cases_v32(uuid,text,integer,integer) to service_role;
grant execute on function public.integration_api_get_case_v32(uuid,text) to service_role;
grant execute on function public.integration_api_create_case_v32(uuid,jsonb) to service_role;

commit;
