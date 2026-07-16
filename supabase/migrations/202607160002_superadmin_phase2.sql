-- ORKESTA / SIGC
-- Fase 2: operación profesional del Super Admin.
-- Requiere la migración 202607160001_superadmin_phase1.sql.
-- Es aditiva e idempotente.

begin;

create extension if not exists pgcrypto;

-- =========================================================
-- 1. RBAC NORMALIZADO DE PLATAFORMA Y SEGURIDAD
-- =========================================================

create table if not exists public.platform_permission_catalog (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category text not null,
  description text,
  is_sensitive boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_role_catalog (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  is_system boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_role_permissions (
  role_id uuid not null references public.platform_role_catalog(id) on delete cascade,
  permission_id uuid not null references public.platform_permission_catalog(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

alter table public.platform_admins add column if not exists platform_role_id uuid references public.platform_role_catalog(id) on delete restrict;
alter table public.platform_admins add column if not exists last_access_at timestamptz;
alter table public.platform_admins add column if not exists notes text;

alter table public.platform_admins drop constraint if exists platform_admins_role_code_check;
alter table public.platform_admins add constraint platform_admins_role_code_check check (
  role_code in ('owner','admin','support','support_manager','support_agent','subscription_manager','backup_operator','auditor','operations_operator')
);

create table if not exists public.platform_security_settings (
  singleton boolean primary key default true check (singleton),
  enforce_mfa boolean not null default false,
  require_mfa_for_sensitive_actions boolean not null default true,
  support_session_default_minutes integer not null default 30 check (support_session_default_minutes between 5 and 240),
  support_session_max_minutes integer not null default 60 check (support_session_max_minutes between 5 and 480),
  require_ticket_for_write_access boolean not null default true,
  require_two_person_approval_for_admin_access boolean not null default true,
  notify_organization_on_support_access boolean not null default true,
  session_idle_minutes integer not null default 15 check (session_idle_minutes between 5 and 120),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.platform_security_settings(singleton) values (true) on conflict(singleton) do nothing;

insert into public.platform_permission_catalog(code,name,category,description,is_sensitive) values
('platform.dashboard.view','Ver resumen global','General','Consulta indicadores de toda la plataforma.',false),
('platform.organizations.view','Ver organizaciones','Organizaciones','Consulta organizaciones, configuración y consumo.',false),
('platform.organizations.manage','Administrar organizaciones','Organizaciones','Activa, suspende y modifica organizaciones.',true),
('platform.subscriptions.view','Ver suscripciones','Suscripciones','Consulta vigencias, planes y eventos.',false),
('platform.subscriptions.manage','Administrar suscripciones','Suscripciones','Modifica planes, vigencias y límites contratados.',true),
('platform.users.view','Ver catálogo de usuarios','Usuarios','Consulta usuarios y membresías de todas las organizaciones.',false),
('platform.users.manage','Administrar membresías','Usuarios','Activa o suspende membresías organizacionales.',true),
('platform.team.view','Ver equipo de plataforma','Seguridad','Consulta operadores globales y su estado MFA.',false),
('platform.team.manage','Administrar equipo de plataforma','Seguridad','Asigna roles y activa operadores globales.',true),
('platform.security.view','Ver seguridad','Seguridad','Consulta política MFA, sesiones y controles.',false),
('platform.security.manage','Administrar seguridad','Seguridad','Modifica controles MFA y acceso de soporte.',true),
('platform.support.view','Ver tickets','Soporte','Consulta tickets de todas las organizaciones.',false),
('platform.support.manage','Gestionar tickets','Soporte','Clasifica, asigna, responde y escala tickets.',true),
('platform.support.access','Solicitar acceso de soporte','Soporte','Solicita sesiones temporales sobre organizaciones.',true),
('platform.support.approve','Aprobar acceso de soporte','Soporte','Aprueba o rechaza accesos temporales.',true),
('platform.backups.view','Ver backups','Continuidad','Consulta respaldos, programación y restauraciones.',false),
('platform.backups.manage','Administrar backups','Continuidad','Crea, cancela y programa respaldos.',true),
('platform.backups.restore','Restaurar backups','Continuidad','Valida y ejecuta restauraciones controladas.',true),
('platform.audit.view','Ver auditoría global','Auditoría','Consulta todos los eventos auditados.',false),
('platform.audit.export','Exportar auditoría','Auditoría','Genera exportaciones de auditoría.',true),
('platform.operations.view','Ver operación técnica','Operación','Consulta errores, colas y procesos.',false),
('platform.operations.manage','Gestionar operación técnica','Operación','Reintenta y resuelve procesos operativos.',true),
('platform.usage.view','Ver uso y límites','Uso','Consulta consumos, alertas y proyecciones.',false),
('platform.usage.manage','Administrar uso y límites','Uso','Modifica límites y funcionalidades por organización.',true),
('platform.explorer.view','Explorar datos organizacionales','Explorador','Consulta entidades operativas desde una vista controlada.',false)
on conflict(code) do update set name=excluded.name,category=excluded.category,description=excluded.description,is_sensitive=excluded.is_sensitive;

insert into public.platform_role_catalog(code,name,description,is_system) values
('owner','Propietario de plataforma','Control total y capacidad de asignar otros propietarios.',true),
('admin','Administrador de plataforma','Administración global excepto cambios de propietario.',true),
('support_manager','Administrador de soporte','Gestiona tickets y aprueba accesos de soporte.',true),
('support_agent','Agente de soporte','Atiende tickets y solicita acceso temporal.',true),
('subscription_manager','Administrador de suscripciones','Gestiona planes, vigencias y límites.',true),
('backup_operator','Operador de continuidad','Gestiona backups y solicitudes de restauración.',true),
('auditor','Auditor de seguridad','Acceso de consulta a auditoría, seguridad y operación.',true),
('operations_operator','Operador técnico','Gestiona errores, correos, automatizaciones y trabajos.',true)
on conflict(code) do update set name=excluded.name,description=excluded.description,is_active=true,updated_at=now();

-- Propietario: todos los permisos.
insert into public.platform_role_permissions(role_id,permission_id)
select r.id,p.id from public.platform_role_catalog r cross join public.platform_permission_catalog p where r.code='owner'
on conflict do nothing;

-- Administrador: todo excepto gestionar propietarios; la RPC aplica esa restricción.
insert into public.platform_role_permissions(role_id,permission_id)
select r.id,p.id from public.platform_role_catalog r cross join public.platform_permission_catalog p where r.code='admin'
on conflict do nothing;

insert into public.platform_role_permissions(role_id,permission_id)
select r.id,p.id from public.platform_role_catalog r join public.platform_permission_catalog p on p.code = any(array[
  'platform.dashboard.view','platform.organizations.view','platform.users.view','platform.support.view','platform.support.manage',
  'platform.support.access','platform.support.approve','platform.audit.view','platform.operations.view','platform.explorer.view'
]) where r.code='support_manager' on conflict do nothing;

insert into public.platform_role_permissions(role_id,permission_id)
select r.id,p.id from public.platform_role_catalog r join public.platform_permission_catalog p on p.code = any(array[
  'platform.dashboard.view','platform.organizations.view','platform.users.view','platform.support.view','platform.support.manage',
  'platform.support.access','platform.audit.view','platform.explorer.view'
]) where r.code='support_agent' on conflict do nothing;

insert into public.platform_role_permissions(role_id,permission_id)
select r.id,p.id from public.platform_role_catalog r join public.platform_permission_catalog p on p.code = any(array[
  'platform.dashboard.view','platform.organizations.view','platform.subscriptions.view','platform.subscriptions.manage',
  'platform.usage.view','platform.usage.manage','platform.audit.view'
]) where r.code='subscription_manager' on conflict do nothing;

insert into public.platform_role_permissions(role_id,permission_id)
select r.id,p.id from public.platform_role_catalog r join public.platform_permission_catalog p on p.code = any(array[
  'platform.dashboard.view','platform.organizations.view','platform.backups.view','platform.backups.manage',
  'platform.backups.restore','platform.audit.view','platform.operations.view'
]) where r.code='backup_operator' on conflict do nothing;

insert into public.platform_role_permissions(role_id,permission_id)
select r.id,p.id from public.platform_role_catalog r join public.platform_permission_catalog p on p.code = any(array[
  'platform.dashboard.view','platform.organizations.view','platform.users.view','platform.team.view','platform.security.view',
  'platform.support.view','platform.backups.view','platform.audit.view','platform.audit.export','platform.operations.view',
  'platform.usage.view','platform.explorer.view'
]) where r.code='auditor' on conflict do nothing;

insert into public.platform_role_permissions(role_id,permission_id)
select r.id,p.id from public.platform_role_catalog r join public.platform_permission_catalog p on p.code = any(array[
  'platform.dashboard.view','platform.organizations.view','platform.operations.view','platform.operations.manage',
  'platform.audit.view','platform.backups.view','platform.usage.view','platform.explorer.view'
]) where r.code='operations_operator' on conflict do nothing;

update public.platform_admins pa
set platform_role_id = r.id,
    role_code = case when pa.role_code='support' then 'support_manager' else pa.role_code end
from public.platform_role_catalog r
where r.code = case when pa.role_code='support' then 'support_manager' else pa.role_code end
  and pa.platform_role_id is null;

-- =========================================================
-- 2. ACCESO TEMPORAL DE SOPORTE CON APROBACIÓN
-- =========================================================

create table if not exists public.platform_support_access_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ticket_id uuid references public.support_tickets(id) on delete set null,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  mode text not null check (mode in ('read_only','support','admin')),
  scopes text[] not null default array['overview'],
  reason text not null check (length(trim(reason)) >= 10),
  duration_minutes integer not null default 30 check (duration_minutes between 5 and 480),
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled','expired','started','completed')),
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  decision_reason text,
  started_session_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists platform_support_access_requests_status_idx on public.platform_support_access_requests(status,requested_at desc);
create index if not exists platform_support_access_requests_org_idx on public.platform_support_access_requests(organization_id,requested_at desc);

alter table public.platform_support_sessions add column if not exists access_request_id uuid references public.platform_support_access_requests(id) on delete set null;
alter table public.platform_support_sessions add column if not exists scopes text[] not null default array['overview'];
alter table public.platform_support_sessions add column if not exists mfa_verified boolean not null default false;
alter table public.platform_support_sessions add column if not exists client_notified_at timestamptz;
alter table public.platform_support_access_requests drop constraint if exists platform_support_access_requests_started_session_id_fkey;
alter table public.platform_support_access_requests add constraint platform_support_access_requests_started_session_id_fkey foreign key(started_session_id) references public.platform_support_sessions(id) on delete set null;

-- =========================================================
-- 3. SOPORTE PROFESIONAL Y SLA
-- =========================================================

create table if not exists public.support_sla_policies (
  id uuid primary key default gen_random_uuid(),
  priority text not null unique check (priority in ('low','medium','high','critical')),
  name text not null,
  first_response_minutes integer not null check (first_response_minutes > 0),
  resolution_minutes integer not null check (resolution_minutes > 0),
  escalation_minutes integer not null check (escalation_minutes > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.support_sla_policies(priority,name,first_response_minutes,resolution_minutes,escalation_minutes) values
('low','Soporte bajo',1440,7200,5760),
('medium','Soporte medio',480,2880,2160),
('high','Soporte alto',120,960,720),
('critical','Incidente crítico',30,240,120)
on conflict(priority) do update set name=excluded.name,first_response_minutes=excluded.first_response_minutes,resolution_minutes=excluded.resolution_minutes,escalation_minutes=excluded.escalation_minutes,is_active=true,updated_at=now();

alter table public.support_tickets add column if not exists first_response_due_at timestamptz;
alter table public.support_tickets add column if not exists resolution_due_at timestamptz;
alter table public.support_tickets add column if not exists first_response_breached boolean not null default false;
alter table public.support_tickets add column if not exists resolution_breached boolean not null default false;
alter table public.support_tickets add column if not exists escalated_at timestamptz;
alter table public.support_tickets add column if not exists escalation_reason text;
alter table public.support_tickets add column if not exists tags text[] not null default '{}';
alter table public.support_tickets add column if not exists last_customer_reply_at timestamptz;
alter table public.support_tickets add column if not exists last_platform_reply_at timestamptz;

create table if not exists public.support_ticket_events (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists support_ticket_events_ticket_idx on public.support_ticket_events(ticket_id,created_at desc);

-- =========================================================
-- 4. BACKUPS PROGRAMADOS Y RESTAURACIÓN CONTROLADA
-- =========================================================

create table if not exists public.organization_backup_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  enabled boolean not null default false,
  frequency text not null default 'weekly' check (frequency in ('daily','weekly','monthly')),
  local_time time not null default '02:00',
  timezone text not null default 'America/Bogota',
  day_of_week smallint check (day_of_week between 0 and 6),
  day_of_month smallint check (day_of_month between 1 and 28),
  scope text not null default 'full' check (scope in ('full','database','documents','configuration')),
  retention_days integer not null default 90 check (retention_days between 7 and 3650),
  next_run_at timestamptz,
  last_run_at timestamptz,
  last_status text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.backup_restore_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  backup_job_id uuid not null references public.organization_backup_jobs(id) on delete restrict,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  reason text not null check (length(trim(reason)) >= 10),
  restore_mode text not null default 'merge' check (restore_mode in ('merge','replace')),
  target_environment text not null default 'validation' check (target_environment in ('validation','production')),
  status text not null default 'pending_approval' check (status in ('pending_approval','approved','rejected','validating','ready','applying','completed','failed','cancelled')),
  confirmation_code text not null default upper(substr(encode(gen_random_bytes(6),'hex'),1,8)),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  decision_reason text,
  validation_report jsonb not null default '{}'::jsonb,
  restore_report jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists backup_restore_requests_org_idx on public.backup_restore_requests(organization_id,created_at desc);
create index if not exists backup_restore_requests_status_idx on public.backup_restore_requests(status,created_at desc);

create table if not exists public.backup_restore_events (
  id bigint generated always as identity primary key,
  restore_request_id uuid not null references public.backup_restore_requests(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- =========================================================
-- 5. USO, LÍMITES Y FEATURE FLAGS
-- =========================================================

create table if not exists public.organization_feature_flags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  feature_code text not null,
  enabled boolean not null default true,
  configuration jsonb not null default '{}'::jsonb,
  source text not null default 'override' check (source in ('plan','override','trial','system')),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,feature_code)
);

create table if not exists public.organization_limit_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  metric_code text not null,
  current_value numeric not null default 0,
  limit_value numeric not null default 0,
  percentage numeric not null default 0,
  severity text not null check (severity in ('info','warning','critical','blocked')),
  status text not null default 'open' check (status in ('open','acknowledged','resolved','ignored')),
  first_detected_at timestamptz not null default now(),
  last_detected_at timestamptz not null default now(),
  acknowledged_by uuid references public.profiles(id) on delete set null,
  acknowledged_at timestamptz,
  resolution_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,metric_code,status)
);

create table if not exists public.platform_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  organization_id uuid references public.organizations(id) on delete set null,
  status text not null default 'running' check (status in ('queued','running','success','partial','failed','cancelled')),
  initiated_by uuid references public.profiles(id) on delete set null,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists platform_job_runs_type_idx on public.platform_job_runs(job_type,started_at desc);

-- =========================================================
-- 6. UTILIDADES Y SEGURIDAD V2
-- =========================================================

create or replace function public.platform_is_service_role_v2()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('request.jwt.claim.role', true),'') = 'service_role';
$$;

create or replace function public.platform_permissions_for_user_v2(p_user_id uuid)
returns text[]
language sql
stable
security definer
set search_path=public
as $$
  select coalesce(array_agg(distinct x.permission_code order by x.permission_code), '{}'::text[])
  from (
    select unnest(coalesce(pa.permissions,'{}'::text[])) as permission_code
    from public.platform_admins pa where pa.user_id=p_user_id and pa.is_active
    union
    select pc.code
    from public.platform_admins pa
    join public.platform_role_permissions prp on prp.role_id=pa.platform_role_id
    join public.platform_permission_catalog pc on pc.id=prp.permission_id
    where pa.user_id=p_user_id and pa.is_active
  ) x;
$$;

create or replace function public.platform_is_admin_v2(p_permission text default null)
returns boolean
language sql
stable
security definer
set search_path=public,auth
as $$
  select exists(
    select 1 from public.platform_admins pa
    where pa.user_id=auth.uid() and pa.is_active
      and (
        p_permission is null
        or 'platform.*'=any(public.platform_permissions_for_user_v2(auth.uid()))
        or p_permission=any(public.platform_permissions_for_user_v2(auth.uid()))
      )
  );
$$;

create or replace function public.platform_assert_admin_v2(p_permission text default null,p_sensitive boolean default false)
returns void
language plpgsql
stable
security definer
set search_path=public,auth
as $$
declare settings_row public.platform_security_settings%rowtype;
declare aal text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if not public.platform_is_admin_v2(p_permission) then raise exception 'PLATFORM_ACCESS_DENIED' using errcode='42501'; end if;
  select * into settings_row from public.platform_security_settings where singleton=true;
  aal := coalesce(auth.jwt()->>'aal','aal1');
  if settings_row.enforce_mfa and settings_row.require_mfa_for_sensitive_actions and p_sensitive and aal <> 'aal2' then
    raise exception 'MFA_REQUIRED' using errcode='42501';
  end if;
end;
$$;

create or replace function public.platform_get_context_v2()
returns jsonb
language plpgsql
stable
security definer
set search_path=public,auth
as $$
declare result jsonb;
declare factor_count integer:=0;
declare verified_count integer:=0;
declare role_code_value text;
declare role_name_value text;
declare perms text[];
begin
  if auth.uid() is null then
    return jsonb_build_object('isPlatformAdmin',false,'userId',null,'roleCode','','roleName','Sin acceso','permissions','[]'::jsonb,'aal','aal1','mfaEnrolled',false,'mfaVerified',false);
  end if;
  if to_regclass('auth.mfa_factors') is not null then
    execute 'select count(*),count(*) filter(where status=''verified'') from auth.mfa_factors where user_id=$1' into factor_count,verified_count using auth.uid();
  end if;
  select coalesce(r.code,pa.role_code),coalesce(r.name,pa.role_code),public.platform_permissions_for_user_v2(pa.user_id)
  into role_code_value,role_name_value,perms
  from public.platform_admins pa left join public.platform_role_catalog r on r.id=pa.platform_role_id
  where pa.user_id=auth.uid() and pa.is_active;
  if role_code_value is null then
    return jsonb_build_object('isPlatformAdmin',false,'userId',auth.uid(),'roleCode','','roleName','Sin acceso de plataforma','permissions','[]'::jsonb,'aal',coalesce(auth.jwt()->>'aal','aal1'),'mfaEnrolled',factor_count>0,'mfaVerified',false);
  end if;
  return jsonb_build_object(
    'isPlatformAdmin',true,'userId',auth.uid(),'roleCode',role_code_value,'roleName',role_name_value,
    'permissions',to_jsonb(coalesce(perms,'{}'::text[])),'aal',coalesce(auth.jwt()->>'aal','aal1'),
    'mfaEnrolled',factor_count>0,'mfaVerified',coalesce(auth.jwt()->>'aal','aal1')='aal2','verifiedFactors',verified_count
  );
end;
$$;

create or replace function public.platform_get_security_v2()
returns jsonb
language plpgsql
stable
security definer
set search_path=public,auth
as $$
declare settings_json jsonb;
declare team_json jsonb;
declare roles_json jsonb;
begin
  perform public.platform_assert_admin_v2('platform.security.view',false);
  select to_jsonb(s) into settings_json from public.platform_security_settings s where singleton=true;
  select coalesce(jsonb_agg(jsonb_build_object(
    'userId',p.id,'name',p.name,'email',p.email,'roleCode',coalesce(r.code,pa.role_code),'roleName',coalesce(r.name,pa.role_code),
    'isActive',pa.is_active,'lastAccessAt',coalesce(pa.last_access_at,(select max(a.created_at) from public.platform_audit_events a where a.actor_user_id=pa.user_id and a.source='platform')),'createdAt',pa.created_at,
    'mfaEnrolled',coalesce(mfa.enrolled,0)>0,'mfaVerifiedFactors',coalesce(mfa.verified,0)
  ) order by p.name),'[]'::jsonb) into team_json
  from public.platform_admins pa join public.profiles p on p.id=pa.user_id
  left join public.platform_role_catalog r on r.id=pa.platform_role_id
  left join lateral (
    select count(*)::integer enrolled,count(*) filter(where status='verified')::integer verified
    from auth.mfa_factors f where f.user_id=pa.user_id
  ) mfa on to_regclass('auth.mfa_factors') is not null;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'code',r.code,'name',r.name,'description',r.description,'isActive',r.is_active,
    'permissions',coalesce((select jsonb_agg(pc.code order by pc.code) from public.platform_role_permissions rp join public.platform_permission_catalog pc on pc.id=rp.permission_id where rp.role_id=r.id),'[]'::jsonb)
  ) order by r.name),'[]'::jsonb) into roles_json from public.platform_role_catalog r;
  return jsonb_build_object('settings',settings_json,'team',team_json,'roles',roles_json,'currentAal',coalesce(auth.jwt()->>'aal','aal1'));
exception when undefined_table then
  -- Compatibilidad si la instalación de Auth no expone auth.mfa_factors.
  select coalesce(jsonb_agg(jsonb_build_object('userId',p.id,'name',p.name,'email',p.email,'roleCode',coalesce(r.code,pa.role_code),'roleName',coalesce(r.name,pa.role_code),'isActive',pa.is_active,'lastAccessAt',coalesce(pa.last_access_at,(select max(a.created_at) from public.platform_audit_events a where a.actor_user_id=pa.user_id and a.source='platform')),'createdAt',pa.created_at,'mfaEnrolled',false,'mfaVerifiedFactors',0) order by p.name),'[]'::jsonb)
  into team_json from public.platform_admins pa join public.profiles p on p.id=pa.user_id left join public.platform_role_catalog r on r.id=pa.platform_role_id;
  select to_jsonb(s) into settings_json from public.platform_security_settings s where singleton=true;
  select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'code',r.code,'name',r.name,'description',r.description,'isActive',r.is_active,'permissions','[]'::jsonb) order by r.name),'[]'::jsonb) into roles_json from public.platform_role_catalog r;
  return jsonb_build_object('settings',settings_json,'team',team_json,'roles',roles_json,'currentAal',coalesce(auth.jwt()->>'aal','aal1'));
end;
$$;

create or replace function public.platform_update_security_v2(p_settings jsonb,p_reason text)
returns void
language plpgsql
security definer
set search_path=public,auth
as $$
declare old_row jsonb; declare new_row jsonb;
begin
  perform public.platform_assert_admin_v2('platform.security.manage',true);
  if length(trim(coalesce(p_reason,'')))<10 then raise exception 'REASON_REQUIRED'; end if;
  select to_jsonb(s) into old_row from public.platform_security_settings s where singleton=true for update;
  update public.platform_security_settings set
    enforce_mfa=coalesce((p_settings->>'enforceMfa')::boolean,enforce_mfa),
    require_mfa_for_sensitive_actions=coalesce((p_settings->>'requireMfaForSensitiveActions')::boolean,require_mfa_for_sensitive_actions),
    support_session_default_minutes=coalesce((p_settings->>'supportSessionDefaultMinutes')::integer,support_session_default_minutes),
    support_session_max_minutes=coalesce((p_settings->>'supportSessionMaxMinutes')::integer,support_session_max_minutes),
    require_ticket_for_write_access=coalesce((p_settings->>'requireTicketForWriteAccess')::boolean,require_ticket_for_write_access),
    require_two_person_approval_for_admin_access=coalesce((p_settings->>'requireTwoPersonApprovalForAdminAccess')::boolean,require_two_person_approval_for_admin_access),
    notify_organization_on_support_access=coalesce((p_settings->>'notifyOrganizationOnSupportAccess')::boolean,notify_organization_on_support_access),
    session_idle_minutes=coalesce((p_settings->>'sessionIdleMinutes')::integer,session_idle_minutes),
    updated_by=auth.uid(),updated_at=now()
  where singleton=true;
  select to_jsonb(s) into new_row from public.platform_security_settings s where singleton=true;
  perform public.platform_insert_audit_v1(null,'platform','security.settings_updated','platform_security_settings','singleton',old_row,new_row,jsonb_build_object('reason',trim(p_reason)));
end;
$$;

create or replace function public.platform_upsert_admin_v2(p_user_id uuid,p_role_code text,p_is_active boolean,p_reason text)
returns void
language plpgsql
security definer
set search_path=public,auth
as $$
declare role_row public.platform_role_catalog%rowtype; declare old_row jsonb; declare new_row jsonb; declare caller_role text;
begin
  perform public.platform_assert_admin_v2('platform.team.manage',true);
  if length(trim(coalesce(p_reason,'')))<10 then raise exception 'REASON_REQUIRED'; end if;
  select coalesce(r.code,pa.role_code) into caller_role from public.platform_admins pa left join public.platform_role_catalog r on r.id=pa.platform_role_id where pa.user_id=auth.uid();
  select * into role_row from public.platform_role_catalog where code=p_role_code and is_active;
  if role_row.id is null then raise exception 'ROLE_NOT_FOUND'; end if;
  if p_role_code='owner' and caller_role<>'owner' then raise exception 'ONLY_OWNER_CAN_ASSIGN_OWNER'; end if;
  if not exists(select 1 from public.profiles where id=p_user_id) then raise exception 'USER_NOT_FOUND'; end if;
  select to_jsonb(pa) into old_row from public.platform_admins pa where pa.user_id=p_user_id;
  insert into public.platform_admins(user_id,role_code,platform_role_id,permissions,is_active,created_by,notes)
  values(p_user_id,p_role_code,role_row.id,'{}'::text[],p_is_active,auth.uid(),trim(p_reason))
  on conflict(user_id) do update set role_code=excluded.role_code,platform_role_id=excluded.platform_role_id,is_active=excluded.is_active,notes=excluded.notes,updated_at=now();
  if not p_is_active and p_role_code='owner' and (select count(*) from public.platform_admins pa join public.platform_role_catalog r on r.id=pa.platform_role_id where r.code='owner' and pa.is_active)<=1 then
    raise exception 'LAST_OWNER_CANNOT_BE_DISABLED';
  end if;
  select to_jsonb(pa) into new_row from public.platform_admins pa where pa.user_id=p_user_id;
  perform public.platform_insert_audit_v1(null,'platform','platform_admin.updated','platform_admins',p_user_id::text,old_row,new_row,jsonb_build_object('reason',trim(p_reason)));
end;
$$;


-- Compatibilidad completa: las RPC V1 respetan el RBAC normalizado de Fase 2.
create or replace function public.platform_is_admin_v1(p_permission text default null)
returns boolean
language sql
stable
security definer
set search_path=public,auth
as $$ select public.platform_is_admin_v2(p_permission); $$;

create or replace function public.platform_assert_admin_v1(p_permission text default null)
returns void
language plpgsql
stable
security definer
set search_path=public,auth
as $$ begin perform public.platform_assert_admin_v2(p_permission,false); end; $$;

-- =========================================================
-- 7. FUNCIONES DE ACCESO DE SOPORTE
-- =========================================================

create or replace function public.platform_notify_org_admins_v2(p_organization_id uuid,p_title text,p_message text,p_action_url text,p_metadata jsonb default '{}'::jsonb)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare inserted_count integer;
begin
  insert into public.notifications(recipient_user_id,actor_user_id,type,title,message,is_read,created_at,organization_id,action_url,metadata)
  select distinct om.user_id,null,'system',p_title,p_message,false,now(),p_organization_id,p_action_url,coalesce(p_metadata,'{}'::jsonb)
  from public.organization_members om join public.roles r on r.id=om.role_id
  where om.organization_id=p_organization_id and om.is_active and r.code in ('admin','director','coordinator');
  get diagnostics inserted_count=row_count;
  return inserted_count;
end;
$$;

create or replace function public.platform_request_support_access_v2(
  p_organization_id uuid,p_mode text,p_scopes text[],p_reason text,p_ticket_id uuid default null,p_duration_minutes integer default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare settings_row public.platform_security_settings%rowtype; declare request_row public.platform_support_access_requests%rowtype; declare caller_role text; declare auto_approve boolean:=false;
begin
  perform public.platform_assert_admin_v2('platform.support.access',true);
  select * into settings_row from public.platform_security_settings where singleton=true;
  if p_mode not in ('read_only','support','admin') then raise exception 'INVALID_MODE'; end if;
  if length(trim(coalesce(p_reason,'')))<10 then raise exception 'REASON_REQUIRED'; end if;
  if not exists(select 1 from public.organizations where id=p_organization_id) then raise exception 'ORGANIZATION_NOT_FOUND'; end if;
  if p_ticket_id is not null and not exists(select 1 from public.support_tickets where id=p_ticket_id and organization_id=p_organization_id) then raise exception 'TICKET_ORGANIZATION_MISMATCH'; end if;
  if settings_row.require_ticket_for_write_access and p_mode in ('support','admin') and p_ticket_id is null then raise exception 'TICKET_REQUIRED_FOR_WRITE_ACCESS'; end if;
  select coalesce(r.code,pa.role_code) into caller_role from public.platform_admins pa left join public.platform_role_catalog r on r.id=pa.platform_role_id where pa.user_id=auth.uid();
  auto_approve := caller_role='owner' and (p_mode<>'admin' or not settings_row.require_two_person_approval_for_admin_access);
  insert into public.platform_support_access_requests(organization_id,ticket_id,requested_by,mode,scopes,reason,duration_minutes,status,decided_by,decided_at,decision_reason)
  values(p_organization_id,p_ticket_id,auth.uid(),p_mode,coalesce(nullif(p_scopes,'{}'::text[]),array['overview']),trim(p_reason),least(coalesce(p_duration_minutes,settings_row.support_session_default_minutes),settings_row.support_session_max_minutes),case when auto_approve then 'approved' else 'pending' end,case when auto_approve then auth.uid() end,case when auto_approve then now() end,case when auto_approve then 'Aprobación automática de propietario' end)
  returning * into request_row;
  perform public.platform_insert_audit_v1(p_organization_id,'platform','support_access.requested','platform_support_access_requests',request_row.id::text,null,to_jsonb(request_row),jsonb_build_object('autoApproved',auto_approve));
  return jsonb_build_object('id',request_row.id,'status',request_row.status,'organizationId',request_row.organization_id,'mode',request_row.mode,'durationMinutes',request_row.duration_minutes,'expiresAt',request_row.expires_at);
end;
$$;

create or replace function public.platform_decide_support_access_v2(p_request_id uuid,p_approved boolean,p_reason text)
returns void
language plpgsql
security definer
set search_path=public,auth
as $$
declare req public.platform_support_access_requests%rowtype; declare caller_role text; declare settings_row public.platform_security_settings%rowtype;
begin
  perform public.platform_assert_admin_v2('platform.support.approve',true);
  if length(trim(coalesce(p_reason,'')))<10 then raise exception 'REASON_REQUIRED'; end if;
  select * into req from public.platform_support_access_requests where id=p_request_id for update;
  if req.id is null then raise exception 'REQUEST_NOT_FOUND'; end if;
  if req.status<>'pending' then raise exception 'REQUEST_NOT_PENDING'; end if;
  select coalesce(r.code,pa.role_code) into caller_role from public.platform_admins pa left join public.platform_role_catalog r on r.id=pa.platform_role_id where pa.user_id=auth.uid();
  select * into settings_row from public.platform_security_settings where singleton=true;
  if req.requested_by=auth.uid() and req.mode='admin' and settings_row.require_two_person_approval_for_admin_access then raise exception 'TWO_PERSON_APPROVAL_REQUIRED'; end if;
  update public.platform_support_access_requests set status=case when p_approved then 'approved' else 'rejected' end,decided_by=auth.uid(),decided_at=now(),decision_reason=trim(p_reason),updated_at=now() where id=p_request_id;
  perform public.platform_insert_audit_v1(req.organization_id,'platform',case when p_approved then 'support_access.approved' else 'support_access.rejected' end,'platform_support_access_requests',p_request_id::text,to_jsonb(req),(select to_jsonb(r) from public.platform_support_access_requests r where r.id=p_request_id),jsonb_build_object('reason',trim(p_reason)));
end;
$$;

create or replace function public.platform_start_support_session_v2(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare req public.platform_support_access_requests%rowtype; declare session_row public.platform_support_sessions%rowtype; declare settings_row public.platform_security_settings%rowtype; declare notified integer:=0;
begin
  perform public.platform_assert_admin_v2('platform.support.access',true);
  select * into req from public.platform_support_access_requests where id=p_request_id for update;
  if req.id is null then raise exception 'REQUEST_NOT_FOUND'; end if;
  if req.status<>'approved' then raise exception 'REQUEST_NOT_APPROVED'; end if;
  if req.expires_at<=now() then update public.platform_support_access_requests set status='expired',updated_at=now() where id=req.id; raise exception 'REQUEST_EXPIRED'; end if;
  if req.requested_by<>auth.uid() and not public.platform_is_admin_v2('platform.support.approve') then raise exception 'REQUEST_OWNER_MISMATCH'; end if;
  insert into public.platform_support_sessions(organization_id,admin_user_id,ticket_id,mode,reason,started_at,expires_at,access_request_id,scopes,mfa_verified)
  values(req.organization_id,auth.uid(),req.ticket_id,req.mode,req.reason,now(),now()+make_interval(mins=>req.duration_minutes),req.id,req.scopes,coalesce(auth.jwt()->>'aal','aal1')='aal2') returning * into session_row;
  update public.platform_support_access_requests set status='started',started_session_id=session_row.id,updated_at=now() where id=req.id;
  select * into settings_row from public.platform_security_settings where singleton=true;
  if settings_row.notify_organization_on_support_access then
    notified:=public.platform_notify_org_admins_v2(req.organization_id,'Acceso temporal de soporte iniciado','Un operador de Orkesta inició una sesión temporal auditada sobre la organización.','/support',jsonb_build_object('sessionId',session_row.id,'mode',session_row.mode,'expiresAt',session_row.expires_at));
    update public.platform_support_sessions set client_notified_at=now() where id=session_row.id;
  end if;
  perform public.platform_insert_audit_v1(req.organization_id,'platform','support_session.started','platform_support_sessions',session_row.id::text,null,to_jsonb(session_row),jsonb_build_object('notifiedUsers',notified));
  return jsonb_build_object('id',session_row.id,'organizationId',session_row.organization_id,'mode',session_row.mode,'scopes',to_jsonb(session_row.scopes),'startedAt',session_row.started_at,'expiresAt',session_row.expires_at,'isActive',true,'requestId',req.id);
end;
$$;

create or replace function public.platform_end_support_session_v2(p_session_id uuid,p_reason text default 'Finalización manual')
returns void
language plpgsql
security definer
set search_path=public,auth
as $$
declare session_row public.platform_support_sessions%rowtype;
begin
  perform public.platform_assert_admin_v2('platform.support.access',true);
  select * into session_row from public.platform_support_sessions where id=p_session_id for update;
  if session_row.id is null then raise exception 'SESSION_NOT_FOUND'; end if;
  if session_row.ended_at is null then
    update public.platform_support_sessions set ended_at=now(),ended_by=auth.uid() where id=p_session_id;
    update public.platform_support_access_requests set status='completed',updated_at=now() where id=session_row.access_request_id;
    perform public.platform_notify_org_admins_v2(session_row.organization_id,'Acceso temporal de soporte finalizado','La sesión temporal del equipo Orkesta fue cerrada.','/support',jsonb_build_object('sessionId',session_row.id,'reason',p_reason));
    perform public.platform_insert_audit_v1(session_row.organization_id,'platform','support_session.ended','platform_support_sessions',p_session_id::text,to_jsonb(session_row),(select to_jsonb(s) from public.platform_support_sessions s where s.id=p_session_id),jsonb_build_object('reason',p_reason));
  end if;
end;
$$;

create or replace function public.platform_list_support_access_v2(p_status text default null,p_organization_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,auth
as $$
begin
  perform public.platform_assert_admin_v2('platform.support.access',false);
  return jsonb_build_object(
    'requests',coalesce((select jsonb_agg(jsonb_build_object(
      'id',r.id,'organizationId',r.organization_id,'organizationName',o.name,'ticketId',r.ticket_id,'ticketNumber',t.ticket_number,
      'requestedBy',r.requested_by,'requestedByName',p.name,'mode',r.mode,'scopes',to_jsonb(r.scopes),'reason',r.reason,
      'durationMinutes',r.duration_minutes,'status',r.status,'requestedAt',r.requested_at,'expiresAt',r.expires_at,
      'decidedBy',r.decided_by,'decidedAt',r.decided_at,'decisionReason',r.decision_reason,'startedSessionId',r.started_session_id
    ) order by r.requested_at desc) from public.platform_support_access_requests r join public.organizations o on o.id=r.organization_id left join public.support_tickets t on t.id=r.ticket_id left join public.profiles p on p.id=r.requested_by where (p_status is null or r.status=p_status) and (p_organization_id is null or r.organization_id=p_organization_id)),'[]'::jsonb),
    'sessions',coalesce((select jsonb_agg(jsonb_build_object(
      'id',s.id,'organizationId',s.organization_id,'organizationName',o.name,'adminUserId',s.admin_user_id,'adminName',p.name,
      'ticketId',s.ticket_id,'mode',s.mode,'scopes',to_jsonb(s.scopes),'reason',s.reason,'startedAt',s.started_at,
      'expiresAt',s.expires_at,'endedAt',s.ended_at,'isActive',s.ended_at is null and s.expires_at>now(),'mfaVerified',s.mfa_verified
    ) order by s.started_at desc) from public.platform_support_sessions s join public.organizations o on o.id=s.organization_id join public.profiles p on p.id=s.admin_user_id where (p_organization_id is null or s.organization_id=p_organization_id)),'[]'::jsonb)
  );
end;
$$;

-- =========================================================
-- 8. FUNCIONES DE TICKETS V2
-- =========================================================

create or replace function public.platform_apply_ticket_sla_v2()
returns trigger
language plpgsql
as $$
declare policy_row public.support_sla_policies%rowtype;
begin
  select * into policy_row from public.support_sla_policies where priority=new.priority and is_active;
  if policy_row.id is not null and (tg_op='INSERT' or old.priority is distinct from new.priority) then
    new.first_response_due_at:=new.created_at+make_interval(mins=>policy_row.first_response_minutes);
    new.resolution_due_at:=new.created_at+make_interval(mins=>policy_row.resolution_minutes);
    new.sla_due_at:=new.resolution_due_at;
    new.first_response_breached:=false;
    new.resolution_breached:=false;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_support_ticket_sla_v2 on public.support_tickets;
create trigger trg_support_ticket_sla_v2 before insert or update of priority on public.support_tickets for each row execute function public.platform_apply_ticket_sla_v2();

update public.support_tickets t set
  first_response_due_at=coalesce(t.first_response_due_at,t.created_at+make_interval(mins=>p.first_response_minutes)),
  resolution_due_at=coalesce(t.resolution_due_at,t.created_at+make_interval(mins=>p.resolution_minutes)),
  sla_due_at=coalesce(t.sla_due_at,t.created_at+make_interval(mins=>p.resolution_minutes))
from public.support_sla_policies p where p.priority=t.priority;

create or replace function public.platform_capture_ticket_event_v2()
returns trigger
language plpgsql
security definer
set search_path=public,auth
as $$
begin
  if tg_op='INSERT' then
    insert into public.support_ticket_events(ticket_id,organization_id,actor_user_id,event_type,after_data) values(new.id,new.organization_id,auth.uid(),'ticket.created',public.platform_redact_jsonb_v1(to_jsonb(new)));
    return new;
  end if;
  if to_jsonb(old) is distinct from to_jsonb(new) then
    insert into public.support_ticket_events(ticket_id,organization_id,actor_user_id,event_type,before_data,after_data) values(new.id,new.organization_id,auth.uid(),'ticket.updated',public.platform_redact_jsonb_v1(to_jsonb(old)),public.platform_redact_jsonb_v1(to_jsonb(new)));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_support_ticket_event_v2 on public.support_tickets;
create trigger trg_support_ticket_event_v2 after insert or update on public.support_tickets for each row execute function public.platform_capture_ticket_event_v2();

create or replace function public.platform_capture_ticket_message_event_v2()
returns trigger
language plpgsql
security definer
set search_path=public,auth
as $$
begin
  insert into public.support_ticket_events(ticket_id,organization_id,actor_user_id,event_type,after_data,metadata)
  values(new.ticket_id,new.organization_id,new.author_user_id,case when new.is_internal then 'ticket.internal_note' else 'ticket.reply' end,public.platform_redact_jsonb_v1(to_jsonb(new)),jsonb_build_object('authorKind',new.author_kind));
  if new.author_kind='platform' then
    update public.support_tickets set first_response_at=coalesce(first_response_at,new.created_at),last_platform_reply_at=new.created_at,updated_at=now() where id=new.ticket_id;
  elsif new.author_kind='organization' then
    update public.support_tickets set last_customer_reply_at=new.created_at,updated_at=now() where id=new.ticket_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_support_ticket_message_event_v2 on public.support_ticket_messages;
create trigger trg_support_ticket_message_event_v2 after insert on public.support_ticket_messages for each row execute function public.platform_capture_ticket_message_event_v2();

create or replace function public.platform_update_support_ticket_v2(
  p_ticket_id uuid,p_status text default null,p_priority text default null,p_assigned_to uuid default null,
  p_tags text[] default null,p_escalate boolean default false,p_escalation_reason text default null
)
returns void
language plpgsql
security definer
set search_path=public,auth
as $$
declare ticket_row public.support_tickets%rowtype;
begin
  perform public.platform_assert_admin_v2('platform.support.manage',true);
  select * into ticket_row from public.support_tickets where id=p_ticket_id for update;
  if ticket_row.id is null then raise exception 'TICKET_NOT_FOUND'; end if;
  if p_assigned_to is not null and not exists(select 1 from public.platform_admins pa where pa.user_id=p_assigned_to and pa.is_active and ('platform.support.manage'=any(public.platform_permissions_for_user_v2(pa.user_id)) or 'platform.*'=any(public.platform_permissions_for_user_v2(pa.user_id)))) then raise exception 'INVALID_SUPPORT_AGENT'; end if;
  update public.support_tickets set
    status=coalesce(p_status,status),priority=coalesce(p_priority,priority),assigned_to=case when p_assigned_to is null then assigned_to else p_assigned_to end,
    tags=coalesce(p_tags,tags),escalated_at=case when p_escalate then now() else escalated_at end,
    escalation_reason=case when p_escalate then trim(p_escalation_reason) else escalation_reason end,
    resolved_at=case when coalesce(p_status,status)='resolved' then coalesce(resolved_at,now()) else resolved_at end,
    closed_at=case when coalesce(p_status,status)='closed' then coalesce(closed_at,now()) else closed_at end,updated_at=now()
  where id=p_ticket_id;
  if p_escalate and length(trim(coalesce(p_escalation_reason,'')))<10 then raise exception 'ESCALATION_REASON_REQUIRED'; end if;
end;
$$;


create or replace function public.platform_support_ticket_json_v1(p_ticket_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,auth
as $$
declare result jsonb; include_internal boolean:=public.platform_is_admin_v2();
begin
  if not public.platform_can_view_ticket_v1(p_ticket_id) then raise exception 'TICKET_ACCESS_DENIED' using errcode='42501'; end if;
  select jsonb_build_object(
    'id',st.id,'ticketNumber',st.ticket_number,'organizationId',st.organization_id,'organizationName',o.name,
    'createdBy',st.created_by,'requesterName',p.name,'requesterEmail',p.email,
    'category',st.category,'subcategory',st.subcategory,'priority',st.priority,'status',st.status,
    'subject',st.subject,'description',st.description,'assignedTo',st.assigned_to,'assignedToName',ap.name,
    'relatedCaseId',st.related_case_id,'relatedCaseRadicado',c.radicado,'slaDueAt',st.sla_due_at,
    'firstResponseAt',st.first_response_at,'firstResponseDueAt',st.first_response_due_at,
    'resolutionDueAt',st.resolution_due_at,'firstResponseBreached',st.first_response_breached,
    'resolutionBreached',st.resolution_breached,'escalatedAt',st.escalated_at,'escalationReason',st.escalation_reason,
    'tags',to_jsonb(st.tags),'resolvedAt',st.resolved_at,'closedAt',st.closed_at,'createdAt',st.created_at,'updatedAt',st.updated_at,
    'messages',coalesce((select jsonb_agg(jsonb_build_object(
      'id',m.id,'ticketId',m.ticket_id,'authorUserId',m.author_user_id,'authorName',mp.name,'authorEmail',mp.email,
      'authorKind',m.author_kind,'body',m.body,'isInternal',m.is_internal,'createdAt',m.created_at
    ) order by m.created_at)
    from public.support_ticket_messages m left join public.profiles mp on mp.id=m.author_user_id
    where m.ticket_id=st.id and (include_internal or not m.is_internal)),'[]'::jsonb),
    'events',case when include_internal then coalesce((select jsonb_agg(jsonb_build_object(
      'id',e.id,'eventType',e.event_type,'actorUserId',e.actor_user_id,'metadata',e.metadata,'createdAt',e.created_at
    ) order by e.created_at) from public.support_ticket_events e where e.ticket_id=st.id),'[]'::jsonb) else '[]'::jsonb end
  ) into result
  from public.support_tickets st join public.organizations o on o.id=st.organization_id
  left join public.profiles p on p.id=st.created_by left join public.profiles ap on ap.id=st.assigned_to left join public.cases c on c.id=st.related_case_id
  where st.id=p_ticket_id;
  if result is null then raise exception 'TICKET_NOT_FOUND'; end if;
  return result;
end;
$$;

create or replace function public.platform_list_support_tickets_v1(
  p_organization_id uuid default null,p_status text default null,p_priority text default null,p_search text default null,p_page integer default 1,p_page_size integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,auth
as $$
declare result jsonb; safe_page int:=greatest(1,coalesce(p_page,1)); safe_size int:=least(100,greatest(1,coalesce(p_page_size,25)));
begin
  perform public.platform_assert_admin_v2('platform.support.view',false);
  with base as(
    select st.*,o.name organization_name,p.name requester_name,p.email requester_email,ap.name assigned_to_name,c.radicado related_case_radicado
    from public.support_tickets st join public.organizations o on o.id=st.organization_id
    left join public.profiles p on p.id=st.created_by left join public.profiles ap on ap.id=st.assigned_to left join public.cases c on c.id=st.related_case_id
    where (p_organization_id is null or st.organization_id=p_organization_id)
      and (nullif(trim(p_status),'') is null or st.status=p_status)
      and (nullif(trim(p_priority),'') is null or st.priority=p_priority)
      and (nullif(trim(p_search),'') is null or st.ticket_number ilike '%'||trim(p_search)||'%' or st.subject ilike '%'||trim(p_search)||'%' or o.name ilike '%'||trim(p_search)||'%')
  ),counted as(select count(*)::int total from base),paged as(select * from base order by resolution_breached desc,first_response_breached desc,updated_at desc offset(safe_page-1)*safe_size limit safe_size)
  select jsonb_build_object('rows',coalesce(jsonb_agg(jsonb_build_object(
    'id',paged.id,'ticketNumber',paged.ticket_number,'organizationId',paged.organization_id,'organizationName',paged.organization_name,
    'createdBy',paged.created_by,'requesterName',paged.requester_name,'requesterEmail',paged.requester_email,'category',paged.category,'subcategory',paged.subcategory,
    'priority',paged.priority,'status',paged.status,'subject',paged.subject,'description',paged.description,'assignedTo',paged.assigned_to,'assignedToName',paged.assigned_to_name,
    'relatedCaseId',paged.related_case_id,'relatedCaseRadicado',paged.related_case_radicado,'slaDueAt',paged.sla_due_at,
    'firstResponseAt',paged.first_response_at,'firstResponseDueAt',paged.first_response_due_at,'resolutionDueAt',paged.resolution_due_at,
    'firstResponseBreached',paged.first_response_breached,'resolutionBreached',paged.resolution_breached,
    'escalatedAt',paged.escalated_at,'escalationReason',paged.escalation_reason,'tags',to_jsonb(paged.tags),
    'resolvedAt',paged.resolved_at,'closedAt',paged.closed_at,'createdAt',paged.created_at,'updatedAt',paged.updated_at
  ) order by paged.resolution_breached desc,paged.first_response_breached desc,paged.updated_at desc) filter(where paged.id is not null),'[]'::jsonb),'total',counted.total,'page',safe_page,'pageSize',safe_size)
  into result from counted left join paged on true group by counted.total;
  return result;
end;
$$;

-- Actualiza destinatarios de soporte con permisos normalizados.
create or replace function public.platform_create_support_ticket_v1(
  p_category text,p_subcategory text default null,p_priority text default 'medium',p_subject text default null,p_description text default null,p_related_case_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare org_id uuid; ticket_id uuid; ticket_no text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  org_id:=public.platform_current_organization_id_v1();
  if org_id is null then raise exception 'ACTIVE_ORGANIZATION_REQUIRED'; end if;
  if not exists(select 1 from public.organization_members where organization_id=org_id and user_id=auth.uid() and is_active) then raise exception 'MEMBERSHIP_REQUIRED' using errcode='42501'; end if;
  if p_priority not in ('low','medium','high','critical') then raise exception 'INVALID_PRIORITY'; end if;
  if length(trim(coalesce(p_subject,'')))<5 or length(trim(coalesce(p_description,'')))<10 then raise exception 'INVALID_TICKET_CONTENT'; end if;
  if p_related_case_id is not null and not exists(select 1 from public.cases where id=p_related_case_id and organization_id=org_id) then raise exception 'INVALID_RELATED_CASE'; end if;
  ticket_no:=public.platform_next_ticket_number_v1();
  insert into public.support_tickets(ticket_number,organization_id,created_by,category,subcategory,priority,subject,description,related_case_id)
  values(ticket_no,org_id,auth.uid(),trim(p_category),nullif(trim(p_subcategory),''),p_priority,trim(p_subject),trim(p_description),p_related_case_id) returning id into ticket_id;
  insert into public.support_ticket_messages(ticket_id,organization_id,author_user_id,author_kind,body,is_internal) values(ticket_id,org_id,auth.uid(),'organization',trim(p_description),false);
  insert into public.platform_notifications(recipient_user_id,organization_id,type,title,message,action_url,metadata)
  select pa.user_id,org_id,'support_ticket_created','Nuevo ticket '||ticket_no,trim(p_subject),'/superadmin/tickets?ticket='||ticket_id,jsonb_build_object('priority',p_priority)
  from public.platform_admins pa where pa.is_active and ('platform.support.view'=any(public.platform_permissions_for_user_v2(pa.user_id)) or 'platform.*'=any(public.platform_permissions_for_user_v2(pa.user_id)));
  perform public.platform_insert_audit_v1(org_id,'organization','support.ticket_created','support_tickets',ticket_id::text,null,jsonb_build_object('ticketNumber',ticket_no,'priority',p_priority,'subject',trim(p_subject)),jsonb_build_object('ticketNumber',ticket_no));
  return public.platform_support_ticket_json_v1(ticket_id);
end;
$$;


-- Respuestas de soporte compatibles con el RBAC normalizado de plataforma.
create or replace function public.platform_reply_support_ticket_v1(p_ticket_id uuid,p_body text,p_is_internal boolean default false)
returns void
language plpgsql
security definer
set search_path=public,auth
as $$
declare ticket public.support_tickets%rowtype; is_platform boolean:=public.platform_is_admin_v2(); author_kind text; next_status text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if not public.platform_can_view_ticket_v1(p_ticket_id) then raise exception 'TICKET_ACCESS_DENIED' using errcode='42501'; end if;
  if length(trim(coalesce(p_body,'')))<1 then raise exception 'EMPTY_MESSAGE'; end if;
  if p_is_internal and not is_platform then raise exception 'INTERNAL_NOTE_DENIED' using errcode='42501'; end if;
  if is_platform and not public.platform_is_admin_v2('platform.support.manage') then raise exception 'PLATFORM_ACCESS_DENIED' using errcode='42501'; end if;
  select * into ticket from public.support_tickets where id=p_ticket_id for update;
  if ticket.id is null then raise exception 'TICKET_NOT_FOUND'; end if;
  author_kind:=case when is_platform then 'platform' else 'organization' end;
  insert into public.support_ticket_messages(ticket_id,organization_id,author_user_id,author_kind,body,is_internal)
  values(ticket.id,ticket.organization_id,auth.uid(),author_kind,trim(p_body),coalesce(p_is_internal,false));
  next_status:=ticket.status;
  if not p_is_internal then
    if is_platform and ticket.status in ('new','reopened') then next_status:='in_analysis'; end if;
    if not is_platform and ticket.status='waiting_customer' then next_status:='in_analysis'; end if;
  end if;
  update public.support_tickets set status=next_status,updated_at=now() where id=ticket.id;
  if is_platform and not p_is_internal and ticket.created_by is not null then
    insert into public.notifications(recipient_user_id,actor_user_id,type,title,message,organization_id,action_url,metadata)
    values(ticket.created_by,auth.uid(),'system','Respuesta de soporte '||ticket.ticket_number,left(trim(p_body),300),ticket.organization_id,'/support',jsonb_build_object('ticketId',ticket.id));
  elsif not is_platform then
    insert into public.platform_notifications(recipient_user_id,organization_id,type,title,message,action_url,metadata)
    select pa.user_id,ticket.organization_id,'support_ticket_reply','Respuesta en '||ticket.ticket_number,left(trim(p_body),300),'/superadmin/tickets?ticket='||ticket.id,jsonb_build_object('ticketId',ticket.id)
    from public.platform_admins pa
    where pa.is_active and (
      'platform.support.view'=any(public.platform_permissions_for_user_v2(pa.user_id))
      or 'platform.*'=any(public.platform_permissions_for_user_v2(pa.user_id))
    );
  end if;
  perform public.platform_insert_audit_v1(ticket.organization_id,case when is_platform then 'platform' else 'organization' end,'support.ticket_replied','support_tickets',ticket.id::text,null,null,jsonb_build_object('internal',p_is_internal,'ticketNumber',ticket.ticket_number));
end;
$$;

-- =========================================================
-- 9. FUNCIONES DE BACKUP, RESTAURACIÓN Y USO
-- =========================================================

create or replace function public.platform_compute_next_backup_run_v2(p_frequency text,p_local_time time,p_timezone text,p_day_of_week integer,p_day_of_month integer,p_from timestamptz default now())
returns timestamptz
language plpgsql
stable
as $$
declare local_now timestamp; declare candidate timestamp; declare days_ahead integer;
begin
  local_now:=p_from at time zone p_timezone;
  if p_frequency='daily' then
    candidate:=date_trunc('day',local_now)+p_local_time;
    if candidate<=local_now then candidate:=candidate+interval '1 day'; end if;
  elsif p_frequency='weekly' then
    days_ahead:=mod(coalesce(p_day_of_week,1)-extract(dow from local_now)::integer+7,7);
    candidate:=date_trunc('day',local_now)+make_interval(days=>days_ahead)+p_local_time;
    if candidate<=local_now then candidate:=candidate+interval '7 days'; end if;
  else
    candidate:=date_trunc('month',local_now)+make_interval(days=>coalesce(p_day_of_month,1)-1)+p_local_time;
    if candidate<=local_now then candidate:=date_trunc('month',local_now+interval '1 month')+make_interval(days=>coalesce(p_day_of_month,1)-1)+p_local_time; end if;
  end if;
  return candidate at time zone p_timezone;
end;
$$;

create or replace function public.platform_upsert_backup_schedule_v2(
  p_organization_id uuid,p_enabled boolean,p_frequency text,p_local_time time,p_timezone text,p_day_of_week integer,p_day_of_month integer,p_scope text,p_retention_days integer,p_reason text
)
returns void
language plpgsql
security definer
set search_path=public,auth
as $$
declare next_run timestamptz; declare old_row jsonb; declare new_row jsonb;
begin
  perform public.platform_assert_admin_v2('platform.backups.manage',true);
  if length(trim(coalesce(p_reason,'')))<10 then raise exception 'REASON_REQUIRED'; end if;
  next_run:=case when p_enabled then public.platform_compute_next_backup_run_v2(p_frequency,p_local_time,p_timezone,p_day_of_week,p_day_of_month,now()) else null end;
  select to_jsonb(s) into old_row from public.organization_backup_schedules s where organization_id=p_organization_id;
  insert into public.organization_backup_schedules(organization_id,enabled,frequency,local_time,timezone,day_of_week,day_of_month,scope,retention_days,next_run_at,created_by,updated_by)
  values(p_organization_id,p_enabled,p_frequency,p_local_time,p_timezone,p_day_of_week,p_day_of_month,p_scope,p_retention_days,next_run,auth.uid(),auth.uid())
  on conflict(organization_id) do update set enabled=excluded.enabled,frequency=excluded.frequency,local_time=excluded.local_time,timezone=excluded.timezone,day_of_week=excluded.day_of_week,day_of_month=excluded.day_of_month,scope=excluded.scope,retention_days=excluded.retention_days,next_run_at=excluded.next_run_at,updated_by=auth.uid(),updated_at=now();
  select to_jsonb(s) into new_row from public.organization_backup_schedules s where organization_id=p_organization_id;
  perform public.platform_insert_audit_v1(p_organization_id,'platform','backup.schedule_updated','organization_backup_schedules',p_organization_id::text,old_row,new_row,jsonb_build_object('reason',trim(p_reason)));
end;
$$;

create or replace function public.platform_request_restore_v2(p_backup_job_id uuid,p_reason text,p_restore_mode text default 'merge',p_target_environment text default 'validation')
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare backup_row public.organization_backup_jobs%rowtype; declare restore_row public.backup_restore_requests%rowtype;
begin
  perform public.platform_assert_admin_v2('platform.backups.restore',true);
  if length(trim(coalesce(p_reason,'')))<10 then raise exception 'REASON_REQUIRED'; end if;
  select * into backup_row from public.organization_backup_jobs where id=p_backup_job_id;
  if backup_row.id is null or backup_row.status<>'completed' or backup_row.storage_path is null then raise exception 'BACKUP_NOT_RESTORABLE'; end if;
  insert into public.backup_restore_requests(organization_id,backup_job_id,requested_by,reason,restore_mode,target_environment)
  values(backup_row.organization_id,backup_row.id,auth.uid(),trim(p_reason),p_restore_mode,p_target_environment) returning * into restore_row;
  insert into public.backup_restore_events(restore_request_id,actor_user_id,event_type,detail) values(restore_row.id,auth.uid(),'restore.requested',jsonb_build_object('mode',p_restore_mode,'target',p_target_environment));
  perform public.platform_insert_audit_v1(backup_row.organization_id,'platform','backup.restore_requested','backup_restore_requests',restore_row.id::text,null,to_jsonb(restore_row),'{}'::jsonb);
  return jsonb_build_object('id',restore_row.id,'status',restore_row.status,'confirmationCode',restore_row.confirmation_code,'organizationId',restore_row.organization_id,'backupJobId',restore_row.backup_job_id);
end;
$$;

create or replace function public.platform_decide_restore_v2(p_restore_request_id uuid,p_approved boolean,p_reason text)
returns void
language plpgsql
security definer
set search_path=public,auth
as $$
declare restore_row public.backup_restore_requests%rowtype;
begin
  perform public.platform_assert_admin_v2('platform.backups.restore',true);
  if length(trim(coalesce(p_reason,'')))<10 then raise exception 'REASON_REQUIRED'; end if;
  select * into restore_row from public.backup_restore_requests where id=p_restore_request_id for update;
  if restore_row.id is null then raise exception 'RESTORE_NOT_FOUND'; end if;
  if restore_row.status<>'pending_approval' then raise exception 'RESTORE_NOT_PENDING'; end if;
  if restore_row.requested_by=auth.uid() and restore_row.target_environment='production' then raise exception 'TWO_PERSON_APPROVAL_REQUIRED'; end if;
  update public.backup_restore_requests set status=case when p_approved then 'approved' else 'rejected' end,approved_by=auth.uid(),approved_at=now(),decision_reason=trim(p_reason),updated_at=now() where id=p_restore_request_id;
  insert into public.backup_restore_events(restore_request_id,actor_user_id,event_type,detail) values(p_restore_request_id,auth.uid(),case when p_approved then 'restore.approved' else 'restore.rejected' end,jsonb_build_object('reason',trim(p_reason)));
end;
$$;

create or replace function public.platform_list_recovery_v2(p_organization_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,auth
as $$
begin
  perform public.platform_assert_admin_v2('platform.backups.view',false);
  return jsonb_build_object(
    'schedules',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'organizationId',s.organization_id,'organizationName',o.name,'enabled',s.enabled,'frequency',s.frequency,'localTime',s.local_time,'timezone',s.timezone,'dayOfWeek',s.day_of_week,'dayOfMonth',s.day_of_month,'scope',s.scope,'retentionDays',s.retention_days,'nextRunAt',s.next_run_at,'lastRunAt',s.last_run_at,'lastStatus',s.last_status) order by o.name) from public.organization_backup_schedules s join public.organizations o on o.id=s.organization_id where p_organization_id is null or s.organization_id=p_organization_id),'[]'::jsonb),
    'restores',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'organizationId',r.organization_id,'organizationName',o.name,'backupJobId',r.backup_job_id,'requestedBy',r.requested_by,'requestedByName',p.name,'reason',r.reason,'restoreMode',r.restore_mode,'targetEnvironment',r.target_environment,'status',r.status,'confirmationCode',r.confirmation_code,'approvedBy',r.approved_by,'approvedAt',r.approved_at,'decisionReason',r.decision_reason,'validationReport',r.validation_report,'restoreReport',r.restore_report,'errorMessage',r.error_message,'createdAt',r.created_at,'updatedAt',r.updated_at) order by r.created_at desc) from public.backup_restore_requests r join public.organizations o on o.id=r.organization_id join public.profiles p on p.id=r.requested_by where p_organization_id is null or r.organization_id=p_organization_id),'[]'::jsonb)
  );
end;
$$;

create or replace function public.platform_refresh_usage_snapshot_v2(p_organization_id uuid default null)
returns integer
language plpgsql
security definer
set search_path=public,auth
as $$
declare org_row record; declare affected integer:=0;
begin
  if not public.platform_is_service_role_v2() then perform public.platform_assert_admin_v2('platform.operations.manage',true); end if;
  for org_row in select id from public.organizations where p_organization_id is null or id=p_organization_id loop
    insert into public.organization_usage_snapshots(organization_id,snapshot_date,users_active,users_total,cases_total,cases_open,cases_created,documents_total,storage_bytes,emails_sent,automations_executed,public_submissions,exports_created,metadata)
    select org_row.id,current_date,
      (select count(*) from public.organization_members where organization_id=org_row.id and is_active),
      (select count(*) from public.organization_members where organization_id=org_row.id),
      (select count(*) from public.cases where organization_id=org_row.id and deleted_at is null),
      (select count(*) from public.cases c left join public.case_states cs on cs.id=c.state_id where c.organization_id=org_row.id and c.deleted_at is null and coalesce(cs.is_terminal,false)=false),
      (select count(*) from public.cases where organization_id=org_row.id and created_at>=date_trunc('month',now())),
      (select count(*) from public.case_documents where organization_id=org_row.id and deleted_at is null),
      (select coalesce(sum(size_bytes),0) from public.document_versions where organization_id=org_row.id),
      (select count(*) from public.email_queue where organization_id=org_row.id and status='dispatched' and created_at>=date_trunc('month',now())),
      (select count(*) from public.automation_executions where organization_id=org_row.id and started_at>=date_trunc('month',now())),
      (select count(*) from public.public_submission_events where organization_id=org_row.id and created_at>=date_trunc('month',now())),
      (select count(*) from public.report_export_jobs where organization_id=org_row.id and created_at>=date_trunc('month',now())),
      jsonb_build_object('source','phase2-refresh','capturedAt',now())
    on conflict(organization_id,snapshot_date) do update set users_active=excluded.users_active,users_total=excluded.users_total,cases_total=excluded.cases_total,cases_open=excluded.cases_open,cases_created=excluded.cases_created,documents_total=excluded.documents_total,storage_bytes=excluded.storage_bytes,emails_sent=excluded.emails_sent,automations_executed=excluded.automations_executed,public_submissions=excluded.public_submissions,exports_created=excluded.exports_created,metadata=excluded.metadata,created_at=now();
    affected:=affected+1;
  end loop;
  return affected;
end;
$$;

create or replace function public.platform_get_usage_control_v2(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,auth
as $$
declare current_usage jsonb; declare plan_limits jsonb; declare override_limits jsonb; declare effective_limits jsonb; declare plan_features jsonb;
begin
  perform public.platform_assert_admin_v2('platform.usage.view',false);
  select coalesce(sp.limits,'{}'::jsonb),coalesce(os.limits_override,'{}'::jsonb),coalesce(sp.features,'{}'::jsonb)
  into plan_limits,override_limits,plan_features from public.organization_subscriptions os join public.saas_plans sp on sp.id=os.plan_id where os.organization_id=p_organization_id;
  effective_limits:=coalesce(plan_limits,'{}'::jsonb)||coalesce(override_limits,'{}'::jsonb);
  select jsonb_build_object('usersActive',users_active,'usersTotal',users_total,'casesTotal',cases_total,'casesOpen',cases_open,'casesCreated',cases_created,'documentsTotal',documents_total,'storageBytes',storage_bytes,'emailsSent',emails_sent,'automationsExecuted',automations_executed,'publicSubmissions',public_submissions,'exportsCreated',exports_created,'snapshotDate',snapshot_date)
  into current_usage from public.organization_usage_snapshots where organization_id=p_organization_id order by snapshot_date desc limit 1;
  return jsonb_build_object(
    'organizationId',p_organization_id,'planLimits',coalesce(plan_limits,'{}'::jsonb),'limitsOverride',coalesce(override_limits,'{}'::jsonb),'effectiveLimits',coalesce(effective_limits,'{}'::jsonb),'planFeatures',coalesce(plan_features,'{}'::jsonb),'currentUsage',coalesce(current_usage,'{}'::jsonb),
    'history',coalesce((select jsonb_agg(jsonb_build_object('date',snapshot_date,'usersActive',users_active,'casesTotal',cases_total,'casesCreated',cases_created,'storageBytes',storage_bytes,'emailsSent',emails_sent,'automationsExecuted',automations_executed) order by snapshot_date) from (select * from public.organization_usage_snapshots where organization_id=p_organization_id order by snapshot_date desc limit 90) x),'[]'::jsonb),
    'featureFlags',coalesce((select jsonb_agg(jsonb_build_object('id',id,'featureCode',feature_code,'enabled',enabled,'configuration',configuration,'source',source,'updatedAt',updated_at) order by feature_code) from public.organization_feature_flags where organization_id=p_organization_id),'[]'::jsonb),
    'alerts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'metricCode',metric_code,'currentValue',current_value,'limitValue',limit_value,'percentage',percentage,'severity',severity,'status',status,'lastDetectedAt',last_detected_at,'resolutionNote',resolution_note) order by last_detected_at desc) from public.organization_limit_alerts where organization_id=p_organization_id and status in ('open','acknowledged')),'[]'::jsonb)
  );
end;
$$;

create or replace function public.platform_update_usage_control_v2(p_organization_id uuid,p_limits_override jsonb,p_feature_flags jsonb,p_reason text)
returns void
language plpgsql
security definer
set search_path=public,auth
as $$
declare item record; declare old_limits jsonb;
begin
  perform public.platform_assert_admin_v2('platform.usage.manage',true);
  if length(trim(coalesce(p_reason,'')))<10 then raise exception 'REASON_REQUIRED'; end if;
  select limits_override into old_limits from public.organization_subscriptions where organization_id=p_organization_id for update;
  if p_limits_override is not null then update public.organization_subscriptions set limits_override=p_limits_override,updated_at=now() where organization_id=p_organization_id; end if;
  if p_feature_flags is not null and jsonb_typeof(p_feature_flags)='object' then
    for item in select key,value from jsonb_each(p_feature_flags) loop
      insert into public.organization_feature_flags(organization_id,feature_code,enabled,configuration,source,updated_by)
      values(p_organization_id,item.key,coalesce((item.value->>'enabled')::boolean,true),coalesce(item.value->'configuration','{}'::jsonb),'override',auth.uid())
      on conflict(organization_id,feature_code) do update set enabled=excluded.enabled,configuration=excluded.configuration,source='override',updated_by=auth.uid(),updated_at=now();
    end loop;
  end if;
  perform public.platform_insert_audit_v1(p_organization_id,'platform','usage.controls_updated','organization_subscriptions',p_organization_id::text,jsonb_build_object('limitsOverride',old_limits),jsonb_build_object('limitsOverride',p_limits_override,'featureFlags',p_feature_flags),jsonb_build_object('reason',trim(p_reason)));
end;
$$;

-- =========================================================
-- 10. EXPLORADOR ORGANIZACIONAL CONTROLADO
-- =========================================================

create or replace function public.platform_explore_organization_v2(p_organization_id uuid,p_domain text,p_search text default null,p_page integer default 1,p_page_size integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,auth
as $$
declare safe_page integer:=greatest(1,coalesce(p_page,1)); declare safe_size integer:=least(200,greatest(1,coalesce(p_page_size,50))); declare off integer; declare rows_json jsonb:='[]'::jsonb; declare total_count bigint:=0;
begin
  perform public.platform_assert_admin_v2('platform.explorer.view',false);
  off:=(safe_page-1)*safe_size;
  if p_domain='cases' then
    select count(*) into total_count from public.cases c where c.organization_id=p_organization_id and (p_search is null or c.radicado ilike '%'||p_search||'%' or c.subject ilike '%'||p_search||'%' or c.requester_name ilike '%'||p_search||'%');
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into rows_json from (select c.id,c.radicado,c.subject,c.requester_name,c.requester_email,c.source,c.risk_level,c.progress,c.opened_at,c.due_at,c.closed_at,ct.name case_type,pr.name priority,cs.name state,a.name primary_area,p.name primary_owner from public.cases c left join public.case_types ct on ct.id=c.case_type_id left join public.priorities pr on pr.id=c.priority_id left join public.case_states cs on cs.id=c.state_id left join public.areas a on a.id=c.primary_area_id left join public.profiles p on p.id=c.primary_owner_id where c.organization_id=p_organization_id and (p_search is null or c.radicado ilike '%'||p_search||'%' or c.subject ilike '%'||p_search||'%' or c.requester_name ilike '%'||p_search||'%') order by c.created_at desc limit safe_size offset off) x;
  elsif p_domain='assignments' then
    select count(*) into total_count from public.case_assignments where organization_id=p_organization_id;
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into rows_json from (select ca.*,c.radicado,a.name area,p.name responsible from public.case_assignments ca join public.cases c on c.id=ca.case_id join public.areas a on a.id=ca.area_id left join public.profiles p on p.id=ca.responsible_user_id where ca.organization_id=p_organization_id order by ca.created_at desc limit safe_size offset off) x;
  elsif p_domain='subtasks' then
    select count(*) into total_count from public.case_subtasks where organization_id=p_organization_id and deleted_at is null;
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into rows_json from (select st.*,c.radicado,p.name responsible,a.name area from public.case_subtasks st join public.cases c on c.id=st.case_id left join public.profiles p on p.id=st.responsible_user_id left join public.areas a on a.id=st.area_id where st.organization_id=p_organization_id and st.deleted_at is null order by st.created_at desc limit safe_size offset off) x;
  elsif p_domain='documents' then
    select count(*) into total_count from public.case_documents where organization_id=p_organization_id and deleted_at is null;
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into rows_json from (select d.id,d.case_id,c.radicado,d.name,d.category,d.state,d.current_version,d.client_visible,d.legal_hold,d.retention_until,d.created_at,d.updated_at from public.case_documents d join public.cases c on c.id=d.case_id where d.organization_id=p_organization_id and d.deleted_at is null order by d.updated_at desc limit safe_size offset off) x;
  elsif p_domain='users' then
    select count(*) into total_count from public.organization_members where organization_id=p_organization_id;
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into rows_json from (select om.id membership_id,p.id user_id,p.name,p.email,r.code role_code,r.name role_name,om.is_active,om.joined_at,om.updated_at from public.organization_members om join public.profiles p on p.id=om.user_id join public.roles r on r.id=om.role_id where om.organization_id=p_organization_id order by p.name limit safe_size offset off) x;
  elsif p_domain='emails' then
    select count(*) into total_count from public.email_queue where organization_id=p_organization_id;
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into rows_json from (select id,case_id,recipient_email,event_type,subject,status,attempts,max_attempts,available_at,dispatched_at,last_error,created_at from public.email_queue where organization_id=p_organization_id order by created_at desc limit safe_size offset off) x;
  elsif p_domain='automations' then
    select count(*) into total_count from public.automation_executions where organization_id=p_organization_id;
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into rows_json from (select ae.id,ae.rule_id,ar.name rule_name,ae.case_id,c.radicado,ae.trigger_event,ae.status,ae.matched,ae.actions_total,ae.actions_succeeded,ae.error_message,ae.started_at,ae.finished_at from public.automation_executions ae join public.automation_rules ar on ar.id=ae.rule_id left join public.cases c on c.id=ae.case_id where ae.organization_id=p_organization_id order by ae.started_at desc limit safe_size offset off) x;
  elsif p_domain='errors' then
    select count(*) into total_count from public.app_error_logs where organization_id=p_organization_id;
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into rows_json from (select id,user_id,severity,source,route,message,metadata,resolved_at,resolved_by,created_at from public.app_error_logs where organization_id=p_organization_id order by created_at desc limit safe_size offset off) x;
  elsif p_domain='audit' then
    select count(*) into total_count from public.platform_audit_events where organization_id=p_organization_id;
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into rows_json from (select id,actor_user_id,source,event_type,entity_type,entity_id,metadata,ip_address,user_agent,created_at from public.platform_audit_events where organization_id=p_organization_id order by created_at desc limit safe_size offset off) x;
  elsif p_domain='configuration' then
    total_count:=1;
    rows_json:=jsonb_build_array(jsonb_build_object(
      'organization',(select to_jsonb(o) from public.organizations o where o.id=p_organization_id),
      'branding',(select to_jsonb(b) from public.organization_branding b where b.organization_id=p_organization_id),
      'subscription',(select to_jsonb(s) from public.organization_subscriptions s where s.organization_id=p_organization_id),
      'areas',coalesce((select jsonb_agg(to_jsonb(a) order by a.sort_order,a.name) from public.areas a where a.organization_id=p_organization_id),'[]'::jsonb),
      'caseTypes',coalesce((select jsonb_agg(to_jsonb(c) order by c.sort_order,c.name) from public.case_types c where c.organization_id=p_organization_id),'[]'::jsonb),
      'states',coalesce((select jsonb_agg(to_jsonb(s) order by s.sort_order,s.name) from public.case_states s where s.organization_id=p_organization_id),'[]'::jsonb),
      'slaPolicies',coalesce((select jsonb_agg(to_jsonb(s) order by s.name) from public.sla_policies s where s.organization_id=p_organization_id),'[]'::jsonb)
    ));
  else
    raise exception 'DOMAIN_NOT_ALLOWED';
  end if;
  return jsonb_build_object('domain',p_domain,'rows',rows_json,'total',total_count,'page',safe_page,'pageSize',safe_size);
end;
$$;

-- =========================================================
-- 11. SCHEDULER CENTRAL
-- =========================================================

create or replace function public.platform_scheduler_tick_v2()
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare scheduler_run_id uuid; declare backup_job_id uuid; declare schedule_row record; declare backup_ids uuid[]:='{}'::uuid[]; declare expired_sessions integer:=0; declare expired_requests integer:=0; declare breached_tickets integer:=0; declare snap_count integer:=0; declare metric record; declare org_row record; declare effective jsonb; declare current_row public.organization_usage_snapshots%rowtype; declare limit_value numeric; declare current_value numeric; declare pct numeric; declare sev text;
begin
  if not public.platform_is_service_role_v2() and not public.platform_is_admin_v2('platform.operations.manage') then raise exception 'PLATFORM_ACCESS_DENIED' using errcode='42501'; end if;
  insert into public.platform_job_runs(job_type,status,initiated_by,input) values('platform_scheduler','running',auth.uid(),jsonb_build_object('startedAt',now())) returning id into scheduler_run_id;
  update public.platform_support_access_requests set status='expired',updated_at=now() where status in ('pending','approved') and expires_at<=now(); get diagnostics expired_requests=row_count;
  update public.platform_support_sessions set ended_at=now() where ended_at is null and expires_at<=now(); get diagnostics expired_sessions=row_count;
  update public.support_tickets set
    first_response_breached=(first_response_at is null and first_response_due_at<now()),
    resolution_breached=(status not in ('resolved','closed','cancelled') and resolution_due_at<now()),
    escalated_at=case when status not in ('resolved','closed','cancelled') and resolution_due_at<now() then coalesce(escalated_at,now()) else escalated_at end,
    escalation_reason=case when status not in ('resolved','closed','cancelled') and resolution_due_at<now() then coalesce(escalation_reason,'Escalamiento automático por incumplimiento de SLA') else escalation_reason end
  where (first_response_at is null and first_response_due_at<now()) or (status not in ('resolved','closed','cancelled') and resolution_due_at<now()); get diagnostics breached_tickets=row_count;
  snap_count:=public.platform_refresh_usage_snapshot_v2(null);

  for schedule_row in select * from public.organization_backup_schedules where enabled and next_run_at<=now() for update skip locked loop
    insert into public.organization_backup_jobs(organization_id,requested_by,scope,reason,status,expires_at)
    values(schedule_row.organization_id,null,schedule_row.scope,'Backup automático programado','queued',now()+make_interval(days=>schedule_row.retention_days)) returning id into backup_job_id;
    backup_ids:=array_append(backup_ids,backup_job_id);
    update public.organization_backup_schedules set last_run_at=now(),last_status='queued',next_run_at=public.platform_compute_next_backup_run_v2(frequency,local_time,timezone,day_of_week,day_of_month,now()),updated_at=now() where id=schedule_row.id;
  end loop;

  for org_row in select o.id from public.organizations o where o.is_active loop
    select * into current_row from public.organization_usage_snapshots where organization_id=org_row.id order by snapshot_date desc limit 1;
    select coalesce(sp.limits,'{}'::jsonb)||coalesce(os.limits_override,'{}'::jsonb) into effective from public.organization_subscriptions os join public.saas_plans sp on sp.id=os.plan_id where os.organization_id=org_row.id;
    for metric in select * from (values
      ('users',current_row.users_active::numeric,nullif(effective->>'users','')::numeric),
      ('storageBytes',current_row.storage_bytes::numeric,nullif(effective->>'storage_bytes','')::numeric),
      ('casesMonthly',current_row.cases_created::numeric,nullif(effective->>'cases_month','')::numeric),
      ('emailsMonthly',current_row.emails_sent::numeric,nullif(effective->>'emails_month','')::numeric),
      ('automationsMonthly',current_row.automations_executed::numeric,nullif(effective->>'automations_month','')::numeric)
    ) as m(metric_code,current_val,limit_val) loop
      current_value:=coalesce(metric.current_val,0); limit_value:=metric.limit_val;
      if limit_value is null or limit_value<=0 then continue; end if;
      pct:=round((current_value/limit_value)*100,2);
      sev:=case when pct>=100 then 'blocked' when pct>=90 then 'critical' when pct>=75 then 'warning' else 'info' end;
      if pct>=75 then
        insert into public.organization_limit_alerts(organization_id,metric_code,current_value,limit_value,percentage,severity,status,last_detected_at)
        values(org_row.id,metric.metric_code,current_value,limit_value,pct,sev,'open',now())
        on conflict(organization_id,metric_code,status) do update set current_value=excluded.current_value,limit_value=excluded.limit_value,percentage=excluded.percentage,severity=excluded.severity,last_detected_at=now(),updated_at=now();
      else
        update public.organization_limit_alerts set status='resolved',resolution_note='Consumo por debajo del umbral',updated_at=now() where organization_id=org_row.id and metric_code=metric.metric_code and status in ('open','acknowledged');
      end if;
    end loop;
  end loop;

  update public.organization_subscriptions set status='past_due',updated_at=now() where status in ('active','trialing') and current_period_end is not null and current_period_end<now();
  update public.platform_job_runs set status='success',output=jsonb_build_object('expiredRequests',expired_requests,'expiredSessions',expired_sessions,'breachedTickets',breached_tickets,'snapshots',snap_count,'backupJobIds',to_jsonb(backup_ids)),finished_at=now() where id=scheduler_run_id;
  return jsonb_build_object('jobRunId',scheduler_run_id,'expiredRequests',expired_requests,'expiredSessions',expired_sessions,'breachedTickets',breached_tickets,'snapshots',snap_count,'backupJobIds',to_jsonb(backup_ids));
exception when others then
  if scheduler_run_id is not null then update public.platform_job_runs set status='failed',error_message=sqlerrm,finished_at=now() where id=scheduler_run_id; end if;
  raise;
end;
$$;


-- =========================================================
-- 11.1 CONFIGURACIÓN INICIAL DE LAS ORGANIZACIONES DEMO
-- =========================================================

insert into public.organization_backup_schedules(
  organization_id,enabled,frequency,local_time,timezone,day_of_week,day_of_month,scope,retention_days,next_run_at
)
select o.id,true,
  case o.slug when 'grupo-nova' then 'weekly' else 'daily' end,
  case o.slug when 'vigia-integral' then '01:30'::time when 'grupo-nova' then '03:00'::time else '02:00'::time end,
  'America/Bogota',
  case when o.slug='grupo-nova' then 0 else null end,
  null,
  'full',
  case o.slug when 'vigia-integral' then 180 when 'grupo-nova' then 60 else 90 end,
  public.platform_compute_next_backup_run_v2(
    case o.slug when 'grupo-nova' then 'weekly' else 'daily' end,
    case o.slug when 'vigia-integral' then '01:30'::time when 'grupo-nova' then '03:00'::time else '02:00'::time end,
    'America/Bogota',case when o.slug='grupo-nova' then 0 else null end,null,now()
  )
from public.organizations o
where o.slug in ('seguridad-atlas','grupo-nova','vigia-integral')
on conflict(organization_id) do update set
  enabled=excluded.enabled,frequency=excluded.frequency,local_time=excluded.local_time,timezone=excluded.timezone,
  day_of_week=excluded.day_of_week,day_of_month=excluded.day_of_month,scope=excluded.scope,
  retention_days=excluded.retention_days,next_run_at=excluded.next_run_at,updated_at=now();

insert into public.organization_feature_flags(organization_id,feature_code,enabled,configuration,source)
select o.id,f.code,f.enabled,f.configuration,'plan'
from public.organizations o
cross join lateral (
  values
    ('support_center',true,'{}'::jsonb),
    ('scheduled_backups',true,'{}'::jsonb),
    ('advanced_reports',case when o.slug<>'grupo-nova' then true else false end,'{}'::jsonb),
    ('automation_engine',true,'{}'::jsonb),
    ('custom_branding',true,'{}'::jsonb),
    ('organization_audit',true,'{}'::jsonb)
) as f(code,enabled,configuration)
where o.slug in ('seguridad-atlas','grupo-nova','vigia-integral')
on conflict(organization_id,feature_code) do nothing;

-- =========================================================
-- 12. TRIGGERS, AUDITORÍA Y RLS
-- =========================================================

do $$ declare tbl text; begin
  foreach tbl in array array['platform_role_catalog','platform_security_settings','platform_support_access_requests','support_sla_policies','organization_backup_schedules','backup_restore_requests','organization_feature_flags','organization_limit_alerts'] loop
    execute format('drop trigger if exists trg_%I_touch_updated_at on public.%I',tbl,tbl);
    execute format('create trigger trg_%I_touch_updated_at before update on public.%I for each row execute function public.platform_touch_updated_at_v1()',tbl,tbl);
  end loop;
end $$;

do $$ declare tbl text; begin
  foreach tbl in array array['platform_admins','platform_role_catalog','platform_role_permissions','platform_security_settings','platform_support_access_requests','support_sla_policies','support_ticket_events','organization_backup_schedules','backup_restore_requests','backup_restore_events','organization_feature_flags','organization_limit_alerts','platform_job_runs'] loop
    if to_regclass('public.'||tbl) is not null then
      execute format('drop trigger if exists trg_platform_audit_%I on public.%I',tbl,tbl);
      execute format('create trigger trg_platform_audit_%I after insert or update or delete on public.%I for each row execute function public.platform_capture_row_change_v1(''direct'')',tbl,tbl);
    end if;
  end loop;
end $$;

alter table public.platform_permission_catalog enable row level security;
alter table public.platform_role_catalog enable row level security;
alter table public.platform_role_permissions enable row level security;
alter table public.platform_security_settings enable row level security;
alter table public.platform_support_access_requests enable row level security;
alter table public.support_sla_policies enable row level security;
alter table public.support_ticket_events enable row level security;
alter table public.organization_backup_schedules enable row level security;
alter table public.backup_restore_requests enable row level security;
alter table public.backup_restore_events enable row level security;
alter table public.organization_feature_flags enable row level security;
alter table public.organization_limit_alerts enable row level security;
alter table public.platform_job_runs enable row level security;

do $$
declare policy_row record;
begin
  for policy_row in
    select * from (values
      ('platform_permission_catalog','platform.team.view'),
      ('platform_role_catalog','platform.team.view'),
      ('platform_role_permissions','platform.team.view'),
      ('platform_security_settings','platform.security.view'),
      ('platform_support_access_requests','platform.support.view'),
      ('support_sla_policies','platform.support.view'),
      ('support_ticket_events','platform.support.view'),
      ('organization_backup_schedules','platform.backups.view'),
      ('backup_restore_requests','platform.backups.view'),
      ('backup_restore_events','platform.backups.view'),
      ('organization_feature_flags','platform.usage.view'),
      ('organization_limit_alerts','platform.usage.view'),
      ('platform_job_runs','platform.operations.view')
    ) as x(table_name,permission_code)
  loop
    execute format('drop policy if exists %I on public.%I','phase2_platform_select_'||policy_row.table_name,policy_row.table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.platform_is_admin_v2(%L))',
      'phase2_platform_select_'||policy_row.table_name,policy_row.table_name,policy_row.permission_code
    );
  end loop;
end $$;

-- Endurece políticas heredadas de la Fase 1 según los permisos normalizados.
drop policy if exists platform_admins_select on public.platform_admins;
create policy platform_admins_select on public.platform_admins for select to authenticated using (
  user_id=auth.uid() or public.platform_is_admin_v2('platform.team.view')
);

drop policy if exists usage_snapshots_select on public.organization_usage_snapshots;
create policy usage_snapshots_select on public.organization_usage_snapshots for select to authenticated using (
  public.platform_is_admin_v2('platform.usage.view')
);

drop policy if exists support_sessions_select on public.platform_support_sessions;
create policy support_sessions_select on public.platform_support_sessions for select to authenticated using (
  public.platform_is_admin_v2('platform.support.view')
);

grant select on public.platform_permission_catalog,public.platform_role_catalog,public.platform_role_permissions,public.platform_security_settings,public.platform_support_access_requests,public.support_sla_policies,public.support_ticket_events,public.organization_backup_schedules,public.backup_restore_requests,public.backup_restore_events,public.organization_feature_flags,public.organization_limit_alerts,public.platform_job_runs to authenticated;
grant all on public.platform_permission_catalog,public.platform_role_catalog,public.platform_role_permissions,public.platform_security_settings,public.platform_support_access_requests,public.support_sla_policies,public.support_ticket_events,public.organization_backup_schedules,public.backup_restore_requests,public.backup_restore_events,public.organization_feature_flags,public.organization_limit_alerts,public.platform_job_runs to service_role;
grant usage,select on all sequences in schema public to service_role;

revoke all on function public.platform_assert_admin_v2(text,boolean) from public,anon,authenticated;
revoke all on function public.platform_permissions_for_user_v2(uuid) from public,anon,authenticated;
revoke all on function public.platform_notify_org_admins_v2(uuid,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.platform_apply_ticket_sla_v2() from public,anon,authenticated;
revoke all on function public.platform_capture_ticket_event_v2() from public,anon,authenticated;
revoke all on function public.platform_capture_ticket_message_event_v2() from public,anon,authenticated;

-- RPC de cliente autenticado.
grant execute on function public.platform_get_context_v2() to authenticated;
grant execute on function public.platform_get_security_v2() to authenticated;
grant execute on function public.platform_update_security_v2(jsonb,text) to authenticated;
grant execute on function public.platform_upsert_admin_v2(uuid,text,boolean,text) to authenticated;
grant execute on function public.platform_request_support_access_v2(uuid,text,text[],text,uuid,integer) to authenticated;
grant execute on function public.platform_decide_support_access_v2(uuid,boolean,text) to authenticated;
grant execute on function public.platform_start_support_session_v2(uuid) to authenticated;
grant execute on function public.platform_end_support_session_v2(uuid,text) to authenticated;
grant execute on function public.platform_list_support_access_v2(text,uuid) to authenticated;
grant execute on function public.platform_update_support_ticket_v2(uuid,text,text,uuid,text[],boolean,text) to authenticated;
grant execute on function public.platform_upsert_backup_schedule_v2(uuid,boolean,text,time,text,integer,integer,text,integer,text) to authenticated;
grant execute on function public.platform_request_restore_v2(uuid,text,text,text) to authenticated;
grant execute on function public.platform_decide_restore_v2(uuid,boolean,text) to authenticated;
grant execute on function public.platform_list_recovery_v2(uuid) to authenticated;
grant execute on function public.platform_refresh_usage_snapshot_v2(uuid) to authenticated;
grant execute on function public.platform_get_usage_control_v2(uuid) to authenticated;
grant execute on function public.platform_update_usage_control_v2(uuid,jsonb,jsonb,text) to authenticated;
grant execute on function public.platform_explore_organization_v2(uuid,text,text,integer,integer) to authenticated;
grant execute on function public.platform_scheduler_tick_v2() to authenticated,service_role;

-- Actualiza la función de contexto V1 para compatibilidad con pantallas antiguas.
create or replace function public.platform_get_context_v1()
returns jsonb
language sql
stable
security definer
set search_path=public,auth
as $$ select public.platform_get_context_v2(); $$;

commit;
