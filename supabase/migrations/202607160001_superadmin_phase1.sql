-- ORKESTA / SIGC
-- Fase 1: Super Admin, auditoría global, soporte, backups lógicos y 3 organizaciones demo.
-- Esta migración es ADITIVA y parte del esquema existente suministrado.

begin;

create extension if not exists pgcrypto;

-- =========================================================
-- 1. TABLAS DE PLATAFORMA
-- =========================================================

create table if not exists public.platform_admins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role_code text not null check (role_code in ('owner','admin','support','auditor','backup_operator')),
  permissions text[] not null default '{}',
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete set null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  source text not null default 'organization' check (source in ('organization','platform','system')),
  event_type text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists platform_audit_events_org_created_idx on public.platform_audit_events (organization_id, created_at desc);
create index if not exists platform_audit_events_actor_created_idx on public.platform_audit_events (actor_user_id, created_at desc);
create index if not exists platform_audit_events_entity_idx on public.platform_audit_events (entity_type, entity_id, created_at desc);
create index if not exists platform_audit_events_event_idx on public.platform_audit_events (event_type, created_at desc);

create table if not exists public.organization_subscription_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subscription_id uuid references public.organization_subscriptions(id) on delete set null,
  event_type text not null,
  previous_data jsonb,
  new_data jsonb,
  reason text not null check (length(trim(reason)) >= 5),
  performed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists organization_subscription_events_org_idx on public.organization_subscription_events (organization_id, created_at desc);

create table if not exists public.organization_usage_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  snapshot_date date not null default current_date,
  users_active integer not null default 0,
  users_total integer not null default 0,
  cases_total bigint not null default 0,
  cases_open bigint not null default 0,
  cases_created bigint not null default 0,
  documents_total bigint not null default 0,
  storage_bytes bigint not null default 0,
  emails_sent bigint not null default 0,
  automations_executed bigint not null default 0,
  public_submissions bigint not null default 0,
  exports_created bigint not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, snapshot_date)
);
create index if not exists organization_usage_snapshots_org_date_idx on public.organization_usage_snapshots (organization_id, snapshot_date desc);

create table if not exists public.organization_backup_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid references public.profiles(id) on delete set null,
  scope text not null default 'full' check (scope in ('full','database','documents','configuration')),
  reason text not null check (length(trim(reason)) >= 5),
  status text not null default 'queued' check (status in ('queued','processing','completed','failed','cancelled')),
  storage_path text,
  manifest jsonb not null default '{}'::jsonb,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  checksum text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists organization_backup_jobs_org_idx on public.organization_backup_jobs (organization_id, created_at desc);
create index if not exists organization_backup_jobs_status_idx on public.organization_backup_jobs (status, created_at);

create table if not exists public.support_ticket_counters (
  year integer primary key,
  last_value bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  category text not null,
  subcategory text,
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  status text not null default 'new' check (status in ('new','in_analysis','assigned','waiting_customer','in_solution','resolved','closed','reopened','cancelled')),
  subject text not null check (length(trim(subject)) between 5 and 240),
  description text not null check (length(trim(description)) between 10 and 20000),
  assigned_to uuid references public.profiles(id) on delete set null,
  related_case_id uuid references public.cases(id) on delete set null,
  sla_due_at timestamptz,
  first_response_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  satisfaction_score smallint check (satisfaction_score between 1 and 5),
  satisfaction_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists support_tickets_org_status_idx on public.support_tickets (organization_id, status, updated_at desc);
create index if not exists support_tickets_assigned_idx on public.support_tickets (assigned_to, status, updated_at desc);

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  author_user_id uuid references public.profiles(id) on delete set null,
  author_kind text not null check (author_kind in ('organization','platform','system')),
  body text not null check (length(trim(body)) between 1 and 20000),
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists support_ticket_messages_ticket_idx on public.support_ticket_messages (ticket_id, created_at);

create table if not exists public.platform_support_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  admin_user_id uuid not null references public.profiles(id) on delete cascade,
  ticket_id uuid references public.support_tickets(id) on delete set null,
  mode text not null default 'read_only' check (mode in ('read_only','support','admin')),
  reason text not null check (length(trim(reason)) >= 5),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  ended_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (expires_at > started_at)
);
create index if not exists platform_support_sessions_active_idx on public.platform_support_sessions (admin_user_id, expires_at desc) where ended_at is null;

create table if not exists public.platform_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  type text not null default 'system',
  title text not null,
  message text not null,
  action_url text,
  is_read boolean not null default false,
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists platform_notifications_recipient_idx on public.platform_notifications (recipient_user_id, is_read, created_at desc);

-- =========================================================
-- 2. FUNCIONES DE SEGURIDAD Y AUDITORÍA
-- =========================================================

create or replace function public.platform_request_ip_v1()
returns inet
language plpgsql
stable
as $$
declare
  headers jsonb;
  ip_text text;
begin
  begin
    headers := nullif(current_setting('request.headers', true), '')::jsonb;
    ip_text := split_part(coalesce(headers->>'x-forwarded-for', headers->>'x-real-ip', ''), ',', 1);
    if nullif(trim(ip_text), '') is null then return null; end if;
    return trim(ip_text)::inet;
  exception when others then
    return null;
  end;
end;
$$;

create or replace function public.platform_request_user_agent_v1()
returns text
language plpgsql
stable
as $$
declare headers jsonb;
begin
  begin
    headers := nullif(current_setting('request.headers', true), '')::jsonb;
    return nullif(headers->>'user-agent', '');
  exception when others then
    return null;
  end;
end;
$$;

create or replace function public.platform_is_admin_v1(p_permission text default null)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.platform_admins pa
    where pa.user_id = auth.uid()
      and pa.is_active
      and (
        p_permission is null
        or 'platform.*' = any(pa.permissions)
        or p_permission = any(pa.permissions)
      )
  );
$$;

create or replace function public.platform_assert_admin_v1(p_permission text default null)
returns void
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if not public.platform_is_admin_v1(p_permission) then
    raise exception 'PLATFORM_ACCESS_DENIED' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.platform_current_organization_id_v1()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    (
      select up.active_organization_id
      from public.user_preferences up
      join public.organization_members om
        on om.organization_id = up.active_organization_id
       and om.user_id = auth.uid()
       and om.is_active
      where up.user_id = auth.uid()
      limit 1
    ),
    (
      select om.organization_id
      from public.organization_members om
      where om.user_id = auth.uid() and om.is_active
      order by om.joined_at
      limit 1
    )
  );
$$;

create or replace function public.platform_member_has_permission_v1(p_organization_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.organization_members om
    join public.role_permissions rp on rp.role_id = om.role_id
    join public.permissions p on p.id = rp.permission_id
    where om.organization_id = p_organization_id
      and om.user_id = auth.uid()
      and om.is_active
      and p.code = p_permission
  );
$$;

create or replace function public.platform_redact_jsonb_v1(p_value jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  result jsonb;
begin
  if p_value is null then return null; end if;
  if jsonb_typeof(p_value) = 'object' then
    select coalesce(jsonb_object_agg(key,
      case
        when lower(key) ~ '(password|passwd|secret|token|authorization|api[_-]?key|service[_-]?role|webhook_headers)'
          then to_jsonb('[REDACTED]'::text)
        else public.platform_redact_jsonb_v1(value)
      end
    ), '{}'::jsonb) into result
    from jsonb_each(p_value);
    return result;
  elsif jsonb_typeof(p_value) = 'array' then
    select coalesce(jsonb_agg(public.platform_redact_jsonb_v1(value)), '[]'::jsonb) into result
    from jsonb_array_elements(p_value);
    return result;
  end if;
  return p_value;
end;
$$;

create or replace function public.platform_insert_audit_v1(
  p_organization_id uuid,
  p_source text,
  p_event_type text,
  p_entity_type text,
  p_entity_id text,
  p_before_data jsonb default null,
  p_after_data jsonb default null,
  p_metadata jsonb default '{}'::jsonb,
  p_actor_user_id uuid default auth.uid()
)
returns bigint
language plpgsql
security definer
set search_path = public, auth
as $$
declare created_id bigint;
begin
  insert into public.platform_audit_events (
    organization_id, actor_user_id, source, event_type, entity_type, entity_id,
    before_data, after_data, metadata, ip_address, user_agent
  ) values (
    p_organization_id,
    p_actor_user_id,
    case when p_source in ('organization','platform','system') then p_source else 'system' end,
    p_event_type,
    p_entity_type,
    p_entity_id,
    public.platform_redact_jsonb_v1(p_before_data),
    public.platform_redact_jsonb_v1(p_after_data),
    public.platform_redact_jsonb_v1(coalesce(p_metadata, '{}'::jsonb)),
    public.platform_request_ip_v1(),
    public.platform_request_user_agent_v1()
  ) returning id into created_id;
  return created_id;
end;
$$;

create or replace function public.platform_capture_row_change_v1()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  old_json jsonb;
  new_json jsonb;
  org_id uuid;
  entity_id text;
  actor_id uuid;
  audit_source text;
  lookup_kind text := coalesce(TG_ARGV[0], 'direct');
begin
  old_json := case when TG_OP in ('UPDATE','DELETE') then to_jsonb(old) else null end;
  new_json := case when TG_OP in ('INSERT','UPDATE') then to_jsonb(new) else null end;

  if TG_OP = 'UPDATE' and old_json = new_json then
    return new;
  end if;

  begin
    org_id := coalesce(nullif(new_json->>'organization_id','')::uuid, nullif(old_json->>'organization_id','')::uuid);
  exception when others then
    org_id := null;
  end;

  if lookup_kind = 'role' then
    select r.organization_id into org_id from public.roles r where r.id = coalesce(nullif(new_json->>'role_id','')::uuid, nullif(old_json->>'role_id','')::uuid);
  elsif lookup_kind = 'case_type' then
    select ct.organization_id into org_id from public.case_types ct where ct.id = coalesce(nullif(new_json->>'case_type_id','')::uuid, nullif(old_json->>'case_type_id','')::uuid);
  elsif lookup_kind = 'user_preference' then
    org_id := coalesce(nullif(new_json->>'active_organization_id','')::uuid, nullif(old_json->>'active_organization_id','')::uuid);
  end if;

  entity_id := coalesce(
    new_json->>'id', old_json->>'id',
    new_json->>'user_id', old_json->>'user_id',
    new_json->>'organization_id', old_json->>'organization_id',
    new_json->>'role_id', old_json->>'role_id',
    new_json->>'case_type_id', old_json->>'case_type_id',
    md5(coalesce(new_json::text, old_json::text, ''))
  );

  actor_id := auth.uid();
  audit_source := case when actor_id is null then 'system' when public.platform_is_admin_v1() then 'platform' else 'organization' end;

  perform public.platform_insert_audit_v1(
    org_id,
    audit_source,
    lower(TG_TABLE_NAME || '.' || TG_OP),
    TG_TABLE_NAME,
    entity_id,
    old_json,
    new_json,
    jsonb_build_object('schema', TG_TABLE_SCHEMA, 'operation', TG_OP)
  );

  if TG_OP = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.platform_touch_updated_at_v1()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Updated-at triggers for new mutable tables.
do $$
declare tbl text;
begin
  foreach tbl in array array['platform_admins','organization_backup_jobs','support_tickets'] loop
    execute format('drop trigger if exists trg_%I_touch_updated_at on public.%I', tbl, tbl);
    execute format('create trigger trg_%I_touch_updated_at before update on public.%I for each row execute function public.platform_touch_updated_at_v1()', tbl, tbl);
  end loop;
end $$;

-- Auditoría automática sobre tablas organizacionales y operativas.
do $$
declare tbl text;
begin
  foreach tbl in array array[
    'organizations','organization_members','organization_member_areas','organization_branding','organization_subscriptions','organization_invitations',
    'areas','priorities','case_types','case_type_default_areas','case_type_fields','case_states','state_transitions','sla_policies','organization_holidays',
    'cases','case_assignments','case_state_history','case_sla_overrides','case_subtasks','case_comments','case_documents','document_versions','case_reviews','case_deliveries',
    'notifications','reminder_rules','case_reminder_log','email_templates','email_runtime_settings','email_queue','sigc_email_outbox',
    'automation_rules','automation_rule_versions','automation_executions','report_export_jobs','client_case_access','public_intake_security','public_intake_challenges',
    'public_submission_events','public_submission_consents','public_case_upload_sessions','sigc_quality_runs','sigc_quality_results','app_error_logs',
    'organization_subscription_events','organization_usage_snapshots','organization_backup_jobs','support_tickets','support_ticket_messages','platform_support_sessions'
  ] loop
    if to_regclass('public.' || tbl) is not null then
      execute format('drop trigger if exists trg_platform_audit_%I on public.%I', tbl, tbl);
      execute format('create trigger trg_platform_audit_%I after insert or update or delete on public.%I for each row execute function public.platform_capture_row_change_v1(''direct'')', tbl, tbl);
    end if;
  end loop;

  if to_regclass('public.role_permissions') is not null then
    drop trigger if exists trg_platform_audit_role_permissions on public.role_permissions;
    create trigger trg_platform_audit_role_permissions after insert or update or delete on public.role_permissions for each row execute function public.platform_capture_row_change_v1('role');
  end if;
  if to_regclass('public.case_type_states') is not null then
    drop trigger if exists trg_platform_audit_case_type_states on public.case_type_states;
    create trigger trg_platform_audit_case_type_states after insert or update or delete on public.case_type_states for each row execute function public.platform_capture_row_change_v1('case_type');
  end if;
  if to_regclass('public.user_preferences') is not null then
    drop trigger if exists trg_platform_audit_user_preferences on public.user_preferences;
    create trigger trg_platform_audit_user_preferences after insert or update or delete on public.user_preferences for each row execute function public.platform_capture_row_change_v1('user_preference');
  end if;
  if to_regclass('public.profiles') is not null then
    drop trigger if exists trg_platform_audit_profiles on public.profiles;
    create trigger trg_platform_audit_profiles after insert or update or delete on public.profiles for each row execute function public.platform_capture_row_change_v1('global');
  end if;
end $$;

-- =========================================================
-- 3. RPC DEL SUPER ADMIN
-- =========================================================

create or replace function public.platform_get_context_v1()
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $$
  select case
    when pa.user_id is null then jsonb_build_object(
      'isPlatformAdmin', false,
      'userId', auth.uid(),
      'roleCode', '',
      'roleName', 'Sin acceso de plataforma',
      'permissions', '[]'::jsonb
    )
    else jsonb_build_object(
      'isPlatformAdmin', true,
      'userId', pa.user_id,
      'roleCode', pa.role_code,
      'roleName', case pa.role_code
        when 'owner' then 'Propietario de plataforma'
        when 'admin' then 'Administrador de plataforma'
        when 'support' then 'Administrador de soporte'
        when 'auditor' then 'Auditor de seguridad'
        when 'backup_operator' then 'Operador de backups'
        else pa.role_code
      end,
      'permissions', to_jsonb(pa.permissions)
    )
  end
  from (select auth.uid() as current_user_id) current_actor
  left join public.platform_admins pa
    on pa.user_id = current_actor.current_user_id and pa.is_active;
$$;

create or replace function public.platform_get_dashboard_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare result jsonb;
begin
  perform public.platform_assert_admin_v1('platform.dashboard.view');

  with organization_stats as (
    select
      count(*)::int as total,
      count(*) filter (where o.is_active)::int as active,
      count(*) filter (where os.status = 'trialing')::int as trialing,
      count(*) filter (where os.status = 'past_due')::int as past_due,
      count(*) filter (where os.status = 'suspended' or not o.is_active)::int as suspended,
      count(*) filter (where os.current_period_end between now() and now() + interval '30 days')::int as expiring_soon
    from public.organizations o
    left join public.organization_subscriptions os on os.organization_id = o.id
  ), user_stats as (
    select
      count(*)::int as total,
      count(*) filter (where au.last_sign_in_at >= now() - interval '30 days')::int as active_30d,
      count(*) filter (where au.last_sign_in_at >= now() - interval '7 days')::int as active_7d
    from public.profiles p
    left join auth.users au on au.id = p.id
  ), activity_stats as (
    select
      (select count(*) from public.cases where created_at >= date_trunc('month', now()))::int as cases_this_month,
      (select coalesce(sum(size_bytes),0) from public.document_versions)::bigint as storage_bytes,
      (select count(*) from public.support_tickets where status not in ('resolved','closed','cancelled'))::int as open_tickets,
      (select count(*) from public.support_tickets where priority = 'critical' and status not in ('resolved','closed','cancelled'))::int as critical_tickets,
      (select count(*) from public.organization_backup_jobs where status in ('queued','processing'))::int as queued_backups,
      (select count(*) from public.organization_backup_jobs where status = 'failed' and created_at >= now() - interval '30 days')::int as failed_backups,
      (select count(*) from public.app_error_logs where resolved_at is null)::int as unresolved_errors,
      (select count(*) from public.email_queue where status in ('failed','dead_letter'))::int as failed_emails,
      (select count(*) from public.automation_executions where status = 'failed' and started_at >= now() - interval '30 days')::int as failed_automations
  ), alerts as (
    select jsonb_build_object(
      'code', 'subscription_expiring', 'severity', 'warning',
      'title', 'Suscripción próxima a vencer',
      'detail', o.name || ' vence el ' || to_char(os.current_period_end, 'DD/MM/YYYY'),
      'organizationId', o.id, 'organizationName', o.name,
      'actionUrl', '/superadmin/organizations/' || o.id
    ) as payload, os.current_period_end as order_at
    from public.organizations o
    join public.organization_subscriptions os on os.organization_id = o.id
    where os.current_period_end between now() and now() + interval '30 days'

    union all
    select jsonb_build_object(
      'code', 'critical_ticket', 'severity', 'critical',
      'title', 'Ticket crítico abierto',
      'detail', st.ticket_number || ' · ' || st.subject,
      'organizationId', st.organization_id, 'organizationName', o.name,
      'actionUrl', '/superadmin/tickets?ticket=' || st.id
    ), st.updated_at
    from public.support_tickets st
    join public.organizations o on o.id = st.organization_id
    where st.priority = 'critical' and st.status not in ('resolved','closed','cancelled')

    union all
    select jsonb_build_object(
      'code', 'backup_failed', 'severity', 'critical',
      'title', 'Backup fallido',
      'detail', coalesce(b.error_message, 'El respaldo no finalizó correctamente.'),
      'organizationId', b.organization_id, 'organizationName', o.name,
      'actionUrl', '/superadmin/backups'
    ), b.created_at
    from public.organization_backup_jobs b
    join public.organizations o on o.id = b.organization_id
    where b.status = 'failed' and b.created_at >= now() - interval '30 days'

    union all
    select jsonb_build_object(
      'code', 'unresolved_errors', 'severity', 'warning',
      'title', 'Errores de aplicación sin resolver',
      'detail', count(*)::text || ' eventos requieren revisión técnica.',
      'organizationId', null, 'organizationName', null,
      'actionUrl', '/superadmin/operations'
    ), max(created_at)
    from public.app_error_logs
    where resolved_at is null
    having count(*) > 0
  ), recent_audit as (
    select jsonb_agg(jsonb_build_object(
      'id', pae.id,
      'organizationId', pae.organization_id,
      'organizationName', o.name,
      'actorUserId', pae.actor_user_id,
      'actorName', p.name,
      'actorEmail', p.email,
      'source', pae.source,
      'eventType', pae.event_type,
      'entityType', pae.entity_type,
      'entityId', pae.entity_id,
      'beforeData', pae.before_data,
      'afterData', pae.after_data,
      'metadata', pae.metadata,
      'ipAddress', pae.ip_address::text,
      'userAgent', pae.user_agent,
      'createdAt', pae.created_at
    ) order by pae.created_at desc) as rows
    from (
      select * from public.platform_audit_events order by created_at desc limit 12
    ) pae
    left join public.organizations o on o.id = pae.organization_id
    left join public.profiles p on p.id = pae.actor_user_id
  )
  select jsonb_build_object(
    'organizations', jsonb_build_object(
      'total', organization_stats.total,
      'active', organization_stats.active,
      'trialing', organization_stats.trialing,
      'pastDue', organization_stats.past_due,
      'suspended', organization_stats.suspended,
      'expiringSoon', organization_stats.expiring_soon
    ),
    'users', jsonb_build_object(
      'total', user_stats.total,
      'active30d', user_stats.active_30d,
      'active7d', user_stats.active_7d
    ),
    'activity', jsonb_build_object(
      'casesThisMonth', activity_stats.cases_this_month,
      'storageBytes', activity_stats.storage_bytes,
      'openTickets', activity_stats.open_tickets,
      'criticalTickets', activity_stats.critical_tickets,
      'queuedBackups', activity_stats.queued_backups,
      'failedBackups', activity_stats.failed_backups,
      'unresolvedErrors', activity_stats.unresolved_errors,
      'failedEmails', activity_stats.failed_emails,
      'failedAutomations', activity_stats.failed_automations
    ),
    'alerts', coalesce((select jsonb_agg(payload order by order_at desc) from (select * from alerts order by order_at desc limit 20) a), '[]'::jsonb),
    'recentAudit', coalesce(recent_audit.rows, '[]'::jsonb)
  ) into result
  from organization_stats, user_stats, activity_stats, recent_audit;

  return result;
end;
$$;

create or replace function public.platform_list_organizations_v1(
  p_search text default null,
  p_status text default null,
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare result jsonb; safe_page int := greatest(1, coalesce(p_page,1)); safe_size int := least(100, greatest(1, coalesce(p_page_size,25)));
begin
  perform public.platform_assert_admin_v1('platform.organizations.view');

  with base as (
    select
      o.id, o.name, o.slug, o.is_active, o.created_at, o.updated_at,
      sp.id as plan_id, sp.code as plan_code, sp.name as plan_name,
      os.status as subscription_status, os.current_period_start, os.current_period_end,
      coalesce(users_stats.users_active,0)::int as users_active,
      coalesce(users_stats.users_total,0)::int as users_total,
      coalesce(case_stats.cases_this_month,0)::int as cases_this_month,
      coalesce(case_stats.cases_open,0)::int as cases_open,
      coalesce(doc_stats.documents,0)::int as documents,
      coalesce(doc_stats.storage_bytes,0)::bigint as storage_bytes,
      coalesce(ticket_stats.tickets_open,0)::int as tickets_open,
      audit_stats.last_activity_at,
      backup_stats.last_backup_at,
      backup_stats.last_backup_status
    from public.organizations o
    left join public.organization_subscriptions os on os.organization_id = o.id
    left join public.saas_plans sp on sp.id = os.plan_id
    left join lateral (
      select count(*)::int as users_total, count(*) filter (where om.is_active)::int as users_active
      from public.organization_members om where om.organization_id = o.id
    ) users_stats on true
    left join lateral (
      select
        count(*) filter (where c.created_at >= date_trunc('month', now()))::int as cases_this_month,
        count(*) filter (where c.closed_at is null and c.deleted_at is null)::int as cases_open
      from public.cases c where c.organization_id = o.id and c.deleted_at is null
    ) case_stats on true
    left join lateral (
      select count(distinct dv.document_id)::int as documents, coalesce(sum(dv.size_bytes),0)::bigint as storage_bytes
      from public.document_versions dv where dv.organization_id = o.id
    ) doc_stats on true
    left join lateral (
      select count(*) filter (where st.status not in ('resolved','closed','cancelled'))::int as tickets_open
      from public.support_tickets st where st.organization_id = o.id
    ) ticket_stats on true
    left join lateral (
      select max(pae.created_at) as last_activity_at from public.platform_audit_events pae where pae.organization_id = o.id
    ) audit_stats on true
    left join lateral (
      select b.created_at as last_backup_at, b.status as last_backup_status
      from public.organization_backup_jobs b where b.organization_id = o.id order by b.created_at desc limit 1
    ) backup_stats on true
    where (nullif(trim(p_search),'') is null or o.name ilike '%'||trim(p_search)||'%' or o.slug ilike '%'||trim(p_search)||'%')
      and (nullif(trim(p_status),'') is null or os.status = p_status or (p_status = 'suspended' and not o.is_active))
  ), counted as (select count(*)::int as total from base), paged as (
    select * from base order by name offset (safe_page - 1) * safe_size limit safe_size
  )
  select jsonb_build_object(
    'rows', coalesce(jsonb_agg(jsonb_build_object(
      'id', paged.id, 'name', paged.name, 'slug', paged.slug, 'isActive', paged.is_active,
      'createdAt', paged.created_at, 'updatedAt', paged.updated_at,
      'planId', paged.plan_id, 'planCode', paged.plan_code, 'planName', paged.plan_name,
      'subscriptionStatus', paged.subscription_status,
      'currentPeriodStart', paged.current_period_start, 'currentPeriodEnd', paged.current_period_end,
      'usersActive', paged.users_active, 'usersTotal', paged.users_total,
      'casesThisMonth', paged.cases_this_month, 'casesOpen', paged.cases_open,
      'documents', paged.documents, 'storageBytes', paged.storage_bytes,
      'ticketsOpen', paged.tickets_open, 'lastActivityAt', paged.last_activity_at,
      'lastBackupAt', paged.last_backup_at, 'lastBackupStatus', paged.last_backup_status
    ) order by paged.name) filter (where paged.id is not null), '[]'::jsonb),
    'total', counted.total, 'page', safe_page, 'pageSize', safe_size
  ) into result from counted left join paged on true group by counted.total;

  return result;
end;
$$;

create or replace function public.platform_get_organization_detail_v1(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare result jsonb;
begin
  perform public.platform_assert_admin_v1('platform.organizations.view');
  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'ORGANIZATION_NOT_FOUND';
  end if;

  with org as (
    select
      o.*,
      sp.id as plan_id, sp.code as plan_code, sp.name as plan_name,
      os.status as subscription_status, os.current_period_start, os.current_period_end,
      os.id as subscription_id, os.trial_ends_at, os.limits_override,
      ob.product_name, ob.short_name, ob.logo_url, ob.primary_color, ob.accent_color, ob.sidebar_color, ob.support_email, ob.custom_domain,
      (select count(*) from public.organization_members om where om.organization_id=o.id)::int as users_total,
      (select count(*) from public.organization_members om where om.organization_id=o.id and om.is_active)::int as users_active,
      (select count(*) from public.cases c where c.organization_id=o.id and c.created_at >= date_trunc('month',now()) and c.deleted_at is null)::int as cases_this_month,
      (select count(*) from public.cases c where c.organization_id=o.id and c.closed_at is null and c.deleted_at is null)::int as cases_open,
      (select count(distinct dv.document_id) from public.document_versions dv where dv.organization_id=o.id)::int as documents,
      (select coalesce(sum(dv.size_bytes),0) from public.document_versions dv where dv.organization_id=o.id)::bigint as storage_bytes,
      (select count(*) from public.support_tickets st where st.organization_id=o.id and st.status not in ('resolved','closed','cancelled'))::int as tickets_open,
      (select max(pae.created_at) from public.platform_audit_events pae where pae.organization_id=o.id) as last_activity_at,
      (select b.created_at from public.organization_backup_jobs b where b.organization_id=o.id order by b.created_at desc limit 1) as last_backup_at,
      (select b.status from public.organization_backup_jobs b where b.organization_id=o.id order by b.created_at desc limit 1) as last_backup_status
    from public.organizations o
    left join public.organization_subscriptions os on os.organization_id=o.id
    left join public.saas_plans sp on sp.id=os.plan_id
    left join public.organization_branding ob on ob.organization_id=o.id
    where o.id=p_organization_id
  ), usage as (
    select jsonb_build_object(
      'usersActive', org.users_active,
      'usersTotal', org.users_total,
      'casesTotal', (select count(*) from public.cases c where c.organization_id=p_organization_id and c.deleted_at is null),
      'casesOpen', org.cases_open,
      'casesThisMonth', org.cases_this_month,
      'documents', org.documents,
      'storageBytes', org.storage_bytes,
      'emailsThisMonth', (select count(*) from public.email_queue e where e.organization_id=p_organization_id and e.created_at>=date_trunc('month',now())),
      'automationsThisMonth', (select count(*) from public.automation_executions ae where ae.organization_id=p_organization_id and ae.started_at>=date_trunc('month',now())),
      'publicSubmissionsThisMonth', (select count(*) from public.public_submission_events pse where pse.organization_id=p_organization_id and pse.created_at>=date_trunc('month',now())),
      'exportsThisMonth', (select count(*) from public.report_export_jobs rj where rj.organization_id=p_organization_id and rj.created_at>=date_trunc('month',now()))
    ) as payload from org
  ), users_json as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.name, 'email', p.email,
      'createdAt', p.created_at, 'updatedAt', p.updated_at,
      'lastSignInAt', au.last_sign_in_at, 'emailConfirmedAt', au.email_confirmed_at,
      'bannedUntil', au.banned_until,
      'lastActivityAt', (select max(pae.created_at) from public.platform_audit_events pae where pae.actor_user_id=p.id and pae.organization_id=p_organization_id),
      'isPlatformAdmin', exists(select 1 from public.platform_admins pa where pa.user_id=p.id and pa.is_active),
      'platformRole', (select pa.role_code from public.platform_admins pa where pa.user_id=p.id and pa.is_active limit 1),
      'memberships', jsonb_build_array(jsonb_build_object(
        'membershipId', om.id,
        'organizationId', o.id,
        'organizationName', o.name,
        'organizationSlug', o.slug,
        'roleId', r.id,
        'roleCode', r.code,
        'roleName', r.name,
        'isActive', om.is_active,
        'areas', coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'isPrimary',oma.is_primary,'isCoordinator',oma.is_coordinator) order by oma.is_primary desc,a.name)
          from public.organization_member_areas oma join public.areas a on a.id=oma.area_id
          where oma.organization_member_id=om.id and oma.is_active), '[]'::jsonb)
      ))
    ) order by p.name), '[]'::jsonb) as rows
    from public.organization_members om
    join public.profiles p on p.id=om.user_id
    left join auth.users au on au.id=p.id
    join public.organizations o on o.id=om.organization_id
    join public.roles r on r.id=om.role_id
    where om.organization_id=p_organization_id
  ), tickets_json as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', st.id, 'ticketNumber', st.ticket_number, 'organizationId', st.organization_id, 'organizationName', o.name,
      'createdBy', st.created_by, 'requesterName', p.name, 'requesterEmail', p.email,
      'category', st.category, 'subcategory', st.subcategory, 'priority', st.priority, 'status', st.status,
      'subject', st.subject, 'description', st.description, 'assignedTo', st.assigned_to, 'assignedToName', ap.name,
      'relatedCaseId', st.related_case_id, 'relatedCaseRadicado', c.radicado, 'slaDueAt', st.sla_due_at,
      'resolvedAt', st.resolved_at, 'closedAt', st.closed_at, 'createdAt', st.created_at, 'updatedAt', st.updated_at
    ) order by st.updated_at desc), '[]'::jsonb) as rows
    from (select * from public.support_tickets where organization_id=p_organization_id order by updated_at desc limit 25) st
    join public.organizations o on o.id=st.organization_id
    left join public.profiles p on p.id=st.created_by
    left join public.profiles ap on ap.id=st.assigned_to
    left join public.cases c on c.id=st.related_case_id
  ), backups_json as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', b.id, 'organizationId', b.organization_id, 'organizationName', o.name,
      'requestedBy', b.requested_by, 'requestedByName', p.name,
      'scope', b.scope, 'reason', b.reason, 'status', b.status, 'storagePath', b.storage_path,
      'manifest', b.manifest, 'sizeBytes', b.size_bytes, 'checksum', b.checksum,
      'errorMessage', b.error_message, 'startedAt', b.started_at, 'completedAt', b.completed_at,
      'expiresAt', b.expires_at, 'createdAt', b.created_at
    ) order by b.created_at desc), '[]'::jsonb) as rows
    from (select * from public.organization_backup_jobs where organization_id=p_organization_id order by created_at desc limit 25) b
    join public.organizations o on o.id=b.organization_id
    left join public.profiles p on p.id=b.requested_by
  ), audit_json as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', pae.id, 'organizationId', pae.organization_id, 'organizationName', o.name,
      'actorUserId', pae.actor_user_id, 'actorName', p.name, 'actorEmail', p.email,
      'source', pae.source, 'eventType', pae.event_type, 'entityType', pae.entity_type, 'entityId', pae.entity_id,
      'beforeData', pae.before_data, 'afterData', pae.after_data, 'metadata', pae.metadata,
      'ipAddress', pae.ip_address::text, 'userAgent', pae.user_agent, 'createdAt', pae.created_at
    ) order by pae.created_at desc), '[]'::jsonb) as rows
    from (select * from public.platform_audit_events where organization_id=p_organization_id order by created_at desc limit 50) pae
    left join public.organizations o on o.id=pae.organization_id
    left join public.profiles p on p.id=pae.actor_user_id
  ), subscription_history as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', e.id, 'eventType', e.event_type, 'previousData', e.previous_data, 'newData', e.new_data,
      'reason', e.reason, 'performedBy', e.performed_by, 'performedByName', p.name, 'createdAt', e.created_at
    ) order by e.created_at desc), '[]'::jsonb) as rows
    from public.organization_subscription_events e
    left join public.profiles p on p.id=e.performed_by
    where e.organization_id=p_organization_id
  ), config as (
    select jsonb_build_object(
      'areas', coalesce((select jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name,'description',description,'isActive',is_active,'color',color) order by sort_order,name) from public.areas where organization_id=p_organization_id), '[]'::jsonb),
      'priorities', coalesce((select jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name,'isActive',is_active,'color',color) order by sort_order,name) from public.priorities where organization_id=p_organization_id), '[]'::jsonb),
      'caseTypes', coalesce((select jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name,'description',description,'isActive',is_active,'isPublicEnabled',is_public_enabled,'isInternalEnabled',is_internal_enabled,'defaultRiskLevel',default_risk_level) order by sort_order,name) from public.case_types where organization_id=p_organization_id), '[]'::jsonb),
      'states', coalesce((select jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name,'description',description,'isActive',is_active,'isInitial',is_initial,'isTerminal',is_terminal,'color',color) order by sort_order,name) from public.case_states where organization_id=p_organization_id), '[]'::jsonb),
      'slaPolicies', coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'durationValue',duration_value,'durationUnit',duration_unit,'isDefault',is_default,'isActive',is_active,'timezone',timezone) order by name) from public.sla_policies where organization_id=p_organization_id), '[]'::jsonb),
      'roles', coalesce((select jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name,'description',description,'isSystem',is_system,'isActive',is_active) order by name) from public.roles where organization_id=p_organization_id), '[]'::jsonb),
      'emailTemplates', coalesce((select jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name,'eventType',event_type,'subject',subject,'isActive',is_active) order by name) from public.email_templates where organization_id=p_organization_id), '[]'::jsonb),
      'automationRules', coalesce((select jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name,'triggerEvent',trigger_event,'isActive',is_active,'lifecycleStatus',lifecycle_status,'runCount',run_count,'lastRunAt',last_run_at) order by sort_order,name) from public.automation_rules where organization_id=p_organization_id), '[]'::jsonb),
      'publicIntakeSecurity', (select to_jsonb(pis) - 'updated_by' from public.public_intake_security pis where pis.organization_id=p_organization_id)
    ) as payload
  )
  select jsonb_build_object(
    'organization', jsonb_build_object(
      'id', org.id, 'name', org.name, 'slug', org.slug, 'isActive', org.is_active,
      'settings', org.settings, 'createdAt', org.created_at, 'updatedAt', org.updated_at,
      'planId', org.plan_id, 'planCode', org.plan_code, 'planName', org.plan_name,
      'subscriptionStatus', org.subscription_status, 'currentPeriodStart', org.current_period_start, 'currentPeriodEnd', org.current_period_end,
      'usersActive', org.users_active, 'usersTotal', org.users_total, 'casesThisMonth', org.cases_this_month, 'casesOpen', org.cases_open,
      'documents', org.documents, 'storageBytes', org.storage_bytes, 'ticketsOpen', org.tickets_open,
      'lastActivityAt', org.last_activity_at, 'lastBackupAt', org.last_backup_at, 'lastBackupStatus', org.last_backup_status,
      'branding', case when org.product_name is null then null else jsonb_build_object(
        'productName', org.product_name, 'shortName', org.short_name, 'logoUrl', org.logo_url,
        'primaryColor', org.primary_color, 'accentColor', org.accent_color, 'sidebarColor', org.sidebar_color,
        'supportEmail', org.support_email, 'customDomain', org.custom_domain
      ) end
    ),
    'subscription', case when org.subscription_id is null then null else jsonb_build_object(
      'id', org.subscription_id, 'planId', org.plan_id, 'status', org.subscription_status,
      'trialEndsAt', org.trial_ends_at, 'currentPeriodStart', org.current_period_start,
      'currentPeriodEnd', org.current_period_end, 'limitsOverride', org.limits_override
    ) end,
    'plans', coalesce((select jsonb_agg(jsonb_build_object(
      'id',sp.id,'code',sp.code,'name',sp.name,'description',sp.description,'monthlyPriceCop',sp.monthly_price_cop,
      'limits',sp.limits,'features',sp.features,'isActive',sp.is_active
    ) order by sp.sort_order,sp.name) from public.saas_plans sp where sp.is_active), '[]'::jsonb),
    'usage', usage.payload,
    'configuration', config.payload,
    'users', users_json.rows,
    'tickets', tickets_json.rows,
    'backups', backups_json.rows,
    'recentAudit', audit_json.rows,
    'subscriptionHistory', subscription_history.rows
  ) into result
  from org, usage, config, users_json, tickets_json, backups_json, audit_json, subscription_history;

  return result;
end;
$$;

create or replace function public.platform_list_users_v1(
  p_search text default null,
  p_organization_id uuid default null,
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare result jsonb; safe_page int:=greatest(1,coalesce(p_page,1)); safe_size int:=least(100,greatest(1,coalesce(p_page_size,25)));
begin
  perform public.platform_assert_admin_v1('platform.users.view');
  with base as (
    select p.id,p.name,p.email,p.created_at,p.updated_at,au.last_sign_in_at,au.email_confirmed_at,au.banned_until,
      (select max(pae.created_at) from public.platform_audit_events pae where pae.actor_user_id=p.id) as last_activity_at,
      exists(select 1 from public.platform_admins pa where pa.user_id=p.id and pa.is_active) as is_platform_admin,
      (select pa.role_code from public.platform_admins pa where pa.user_id=p.id and pa.is_active limit 1) as platform_role,
      coalesce((select jsonb_agg(jsonb_build_object(
        'membershipId',om.id,'organizationId',o.id,'organizationName',o.name,'organizationSlug',o.slug,
        'roleId',r.id,'roleCode',r.code,'roleName',r.name,'isActive',om.is_active,
        'areas',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'isPrimary',oma.is_primary,'isCoordinator',oma.is_coordinator) order by oma.is_primary desc,a.name)
          from public.organization_member_areas oma join public.areas a on a.id=oma.area_id
          where oma.organization_member_id=om.id and oma.is_active),'[]'::jsonb)
      ) order by o.name)
      from public.organization_members om join public.organizations o on o.id=om.organization_id join public.roles r on r.id=om.role_id
      where om.user_id=p.id and (p_organization_id is null or om.organization_id=p_organization_id)), '[]'::jsonb) as memberships
    from public.profiles p
    left join auth.users au on au.id=p.id
    where (nullif(trim(p_search),'') is null or p.name ilike '%'||trim(p_search)||'%' or p.email ilike '%'||trim(p_search)||'%')
      and (p_organization_id is null or exists(select 1 from public.organization_members om where om.user_id=p.id and om.organization_id=p_organization_id))
  ), counted as (select count(*)::int total from base), paged as (
    select * from base order by name,email offset (safe_page-1)*safe_size limit safe_size
  )
  select jsonb_build_object(
    'rows',coalesce(jsonb_agg(jsonb_build_object(
      'id',paged.id,'name',paged.name,'email',paged.email,'createdAt',paged.created_at,'updatedAt',paged.updated_at,
      'lastSignInAt',paged.last_sign_in_at,'emailConfirmedAt',paged.email_confirmed_at,'bannedUntil',paged.banned_until,
      'lastActivityAt',paged.last_activity_at,'memberships',paged.memberships,'isPlatformAdmin',paged.is_platform_admin,'platformRole',paged.platform_role
    ) order by paged.name) filter (where paged.id is not null),'[]'::jsonb),
    'total',counted.total,'page',safe_page,'pageSize',safe_size
  ) into result from counted left join paged on true group by counted.total;
  return result;
end;
$$;

create or replace function public.platform_list_audit_v1(
  p_organization_id uuid default null,
  p_search text default null,
  p_event_type text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_page integer default 1,
  p_page_size integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare result jsonb; safe_page int:=greatest(1,coalesce(p_page,1)); safe_size int:=least(200,greatest(1,coalesce(p_page_size,50)));
begin
  perform public.platform_assert_admin_v1('platform.audit.view');
  with base as (
    select pae.*,o.name organization_name,p.name actor_name,p.email actor_email
    from public.platform_audit_events pae
    left join public.organizations o on o.id=pae.organization_id
    left join public.profiles p on p.id=pae.actor_user_id
    where (p_organization_id is null or pae.organization_id=p_organization_id)
      and (nullif(trim(p_event_type),'') is null or pae.event_type ilike '%'||trim(p_event_type)||'%')
      and (p_from is null or pae.created_at>=p_from)
      and (p_to is null or pae.created_at<=p_to)
      and (nullif(trim(p_search),'') is null
        or pae.event_type ilike '%'||trim(p_search)||'%'
        or pae.entity_type ilike '%'||trim(p_search)||'%'
        or coalesce(pae.entity_id,'') ilike '%'||trim(p_search)||'%'
        or coalesce(o.name,'') ilike '%'||trim(p_search)||'%'
        or coalesce(p.name,'') ilike '%'||trim(p_search)||'%'
        or coalesce(p.email,'') ilike '%'||trim(p_search)||'%')
  ), counted as (select count(*)::int total from base), paged as (
    select * from base order by created_at desc offset (safe_page-1)*safe_size limit safe_size
  )
  select jsonb_build_object(
    'rows',coalesce(jsonb_agg(jsonb_build_object(
      'id',paged.id,'organizationId',paged.organization_id,'organizationName',paged.organization_name,
      'actorUserId',paged.actor_user_id,'actorName',paged.actor_name,'actorEmail',paged.actor_email,
      'source',paged.source,'eventType',paged.event_type,'entityType',paged.entity_type,'entityId',paged.entity_id,
      'beforeData',paged.before_data,'afterData',paged.after_data,'metadata',paged.metadata,
      'ipAddress',paged.ip_address::text,'userAgent',paged.user_agent,'createdAt',paged.created_at
    ) order by paged.created_at desc) filter (where paged.id is not null),'[]'::jsonb),
    'total',counted.total,'page',safe_page,'pageSize',safe_size
  ) into result from counted left join paged on true group by counted.total;
  return result;
end;
$$;

-- =========================================================
-- 4. SOPORTE Y TICKETS
-- =========================================================

create or replace function public.platform_next_ticket_number_v1()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare y int:=extract(year from now())::int; n bigint;
begin
  insert into public.support_ticket_counters(year,last_value,updated_at)
  values(y,1,now())
  on conflict(year) do update set last_value=public.support_ticket_counters.last_value+1,updated_at=now()
  returning last_value into n;
  return 'SUP-'||y||'-'||lpad(n::text,6,'0');
end;
$$;

create or replace function public.platform_can_view_ticket_v1(p_ticket_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.platform_is_admin_v1()
    or exists(
      select 1
      from public.support_tickets st
      join public.organization_members om on om.organization_id=st.organization_id and om.user_id=auth.uid() and om.is_active
      where st.id=p_ticket_id
        and (
          st.created_by=auth.uid()
          or public.platform_member_has_permission_v1(st.organization_id,'admin.manage_configuration')
          or public.platform_member_has_permission_v1(st.organization_id,'admin.manage_users')
        )
    );
$$;

create or replace function public.platform_support_ticket_json_v1(p_ticket_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare result jsonb; include_internal boolean:=public.platform_is_admin_v1();
begin
  if not public.platform_can_view_ticket_v1(p_ticket_id) then raise exception 'TICKET_ACCESS_DENIED' using errcode='42501'; end if;
  select jsonb_build_object(
    'id',st.id,'ticketNumber',st.ticket_number,'organizationId',st.organization_id,'organizationName',o.name,
    'createdBy',st.created_by,'requesterName',p.name,'requesterEmail',p.email,
    'category',st.category,'subcategory',st.subcategory,'priority',st.priority,'status',st.status,
    'subject',st.subject,'description',st.description,'assignedTo',st.assigned_to,'assignedToName',ap.name,
    'relatedCaseId',st.related_case_id,'relatedCaseRadicado',c.radicado,'slaDueAt',st.sla_due_at,
    'resolvedAt',st.resolved_at,'closedAt',st.closed_at,'createdAt',st.created_at,'updatedAt',st.updated_at,
    'messages',coalesce((select jsonb_agg(jsonb_build_object(
      'id',m.id,'ticketId',m.ticket_id,'authorUserId',m.author_user_id,'authorName',mp.name,'authorEmail',mp.email,
      'authorKind',m.author_kind,'body',m.body,'isInternal',m.is_internal,'createdAt',m.created_at
    ) order by m.created_at)
    from public.support_ticket_messages m left join public.profiles mp on mp.id=m.author_user_id
    where m.ticket_id=st.id and (include_internal or not m.is_internal)),'[]'::jsonb)
  ) into result
  from public.support_tickets st
  join public.organizations o on o.id=st.organization_id
  left join public.profiles p on p.id=st.created_by
  left join public.profiles ap on ap.id=st.assigned_to
  left join public.cases c on c.id=st.related_case_id
  where st.id=p_ticket_id;
  if result is null then raise exception 'TICKET_NOT_FOUND'; end if;
  return result;
end;
$$;

create or replace function public.platform_create_support_ticket_v1(
  p_category text,
  p_subcategory text default null,
  p_priority text default 'medium',
  p_subject text default null,
  p_description text default null,
  p_related_case_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare org_id uuid; ticket_id uuid; ticket_no text; due_at timestamptz;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  org_id:=public.platform_current_organization_id_v1();
  if org_id is null then raise exception 'ACTIVE_ORGANIZATION_REQUIRED'; end if;
  if not exists(select 1 from public.organization_members where organization_id=org_id and user_id=auth.uid() and is_active) then raise exception 'MEMBERSHIP_REQUIRED' using errcode='42501'; end if;
  if p_priority not in ('low','medium','high','critical') then raise exception 'INVALID_PRIORITY'; end if;
  if length(trim(coalesce(p_subject,'')))<5 or length(trim(coalesce(p_description,'')))<10 then raise exception 'INVALID_TICKET_CONTENT'; end if;
  if p_related_case_id is not null and not exists(select 1 from public.cases where id=p_related_case_id and organization_id=org_id) then raise exception 'INVALID_RELATED_CASE'; end if;

  ticket_no:=public.platform_next_ticket_number_v1();
  due_at:=now()+case p_priority when 'critical' then interval '4 hours' when 'high' then interval '8 hours' when 'medium' then interval '2 days' else interval '5 days' end;
  insert into public.support_tickets(ticket_number,organization_id,created_by,category,subcategory,priority,subject,description,related_case_id,sla_due_at)
  values(ticket_no,org_id,auth.uid(),trim(p_category),nullif(trim(p_subcategory),''),p_priority,trim(p_subject),trim(p_description),p_related_case_id,due_at)
  returning id into ticket_id;
  insert into public.support_ticket_messages(ticket_id,organization_id,author_user_id,author_kind,body,is_internal)
  values(ticket_id,org_id,auth.uid(),'organization',trim(p_description),false);
  insert into public.platform_notifications(recipient_user_id,organization_id,type,title,message,action_url,metadata)
  select pa.user_id,org_id,'support_ticket_created','Nuevo ticket '||ticket_no,trim(p_subject),'/superadmin/tickets?ticket='||ticket_id,jsonb_build_object('priority',p_priority)
  from public.platform_admins pa where pa.is_active and (pa.role_code in ('owner','admin','support'));
  perform public.platform_insert_audit_v1(org_id,'organization','support.ticket_created','support_tickets',ticket_id::text,null,
    jsonb_build_object('ticketNumber',ticket_no,'priority',p_priority,'subject',trim(p_subject)),jsonb_build_object('ticketNumber',ticket_no));
  return public.platform_support_ticket_json_v1(ticket_id);
end;
$$;

create or replace function public.platform_list_my_support_tickets_v1(p_page integer default 1,p_page_size integer default 25)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare result jsonb; org_id uuid:=public.platform_current_organization_id_v1(); safe_page int:=greatest(1,coalesce(p_page,1)); safe_size int:=least(100,greatest(1,coalesce(p_page_size,25))); can_manage boolean;
begin
  if auth.uid() is null or org_id is null then raise exception 'ACTIVE_ORGANIZATION_REQUIRED' using errcode='42501'; end if;
  can_manage:=public.platform_member_has_permission_v1(org_id,'admin.manage_configuration') or public.platform_member_has_permission_v1(org_id,'admin.manage_users');
  with base as (
    select st.*,o.name organization_name,p.name requester_name,p.email requester_email,ap.name assigned_to_name,c.radicado related_case_radicado
    from public.support_tickets st join public.organizations o on o.id=st.organization_id
    left join public.profiles p on p.id=st.created_by left join public.profiles ap on ap.id=st.assigned_to left join public.cases c on c.id=st.related_case_id
    where st.organization_id=org_id and (can_manage or st.created_by=auth.uid())
  ), counted as(select count(*)::int total from base), paged as(select * from base order by updated_at desc offset(safe_page-1)*safe_size limit safe_size)
  select jsonb_build_object('rows',coalesce(jsonb_agg(jsonb_build_object(
    'id',paged.id,'ticketNumber',paged.ticket_number,'organizationId',paged.organization_id,'organizationName',paged.organization_name,
    'createdBy',paged.created_by,'requesterName',paged.requester_name,'requesterEmail',paged.requester_email,
    'category',paged.category,'subcategory',paged.subcategory,'priority',paged.priority,'status',paged.status,
    'subject',paged.subject,'description',paged.description,'assignedTo',paged.assigned_to,'assignedToName',paged.assigned_to_name,
    'relatedCaseId',paged.related_case_id,'relatedCaseRadicado',paged.related_case_radicado,'slaDueAt',paged.sla_due_at,
    'resolvedAt',paged.resolved_at,'closedAt',paged.closed_at,'createdAt',paged.created_at,'updatedAt',paged.updated_at
  ) order by paged.updated_at desc) filter(where paged.id is not null),'[]'::jsonb),'total',counted.total,'page',safe_page,'pageSize',safe_size)
  into result from counted left join paged on true group by counted.total;
  return result;
end;
$$;

create or replace function public.platform_get_support_ticket_v1(p_ticket_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $$ select public.platform_support_ticket_json_v1(p_ticket_id); $$;

create or replace function public.platform_reply_support_ticket_v1(p_ticket_id uuid,p_body text,p_is_internal boolean default false)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare ticket public.support_tickets%rowtype; is_platform boolean:=public.platform_is_admin_v1(); author_kind text; next_status text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if not public.platform_can_view_ticket_v1(p_ticket_id) then raise exception 'TICKET_ACCESS_DENIED' using errcode='42501'; end if;
  if length(trim(coalesce(p_body,'')))<1 then raise exception 'EMPTY_MESSAGE'; end if;
  if p_is_internal and not is_platform then raise exception 'INTERNAL_NOTE_DENIED' using errcode='42501'; end if;
  select * into ticket from public.support_tickets where id=p_ticket_id for update;
  author_kind:=case when is_platform then 'platform' else 'organization' end;
  insert into public.support_ticket_messages(ticket_id,organization_id,author_user_id,author_kind,body,is_internal)
  values(ticket.id,ticket.organization_id,auth.uid(),author_kind,trim(p_body),coalesce(p_is_internal,false));
  next_status:=ticket.status;
  if not p_is_internal then
    if is_platform and ticket.status in ('new','reopened') then next_status:='in_analysis'; end if;
    if not is_platform and ticket.status='waiting_customer' then next_status:='in_analysis'; end if;
  end if;
  update public.support_tickets set
    status=next_status,
    first_response_at=case when is_platform and first_response_at is null and not p_is_internal then now() else first_response_at end,
    updated_at=now()
  where id=ticket.id;
  if is_platform and not p_is_internal and ticket.created_by is not null then
    insert into public.notifications(recipient_user_id,actor_user_id,type,title,message,organization_id,action_url,metadata)
    values(ticket.created_by,auth.uid(),'system','Respuesta de soporte '||ticket.ticket_number,left(trim(p_body),300),ticket.organization_id,'/support',jsonb_build_object('ticketId',ticket.id));
  elsif not is_platform then
    insert into public.platform_notifications(recipient_user_id,organization_id,type,title,message,action_url,metadata)
    select pa.user_id,ticket.organization_id,'support_ticket_reply','Respuesta en '||ticket.ticket_number,left(trim(p_body),300),'/superadmin/tickets?ticket='||ticket.id,jsonb_build_object('ticketId',ticket.id)
    from public.platform_admins pa where pa.is_active and pa.role_code in ('owner','admin','support');
  end if;
  perform public.platform_insert_audit_v1(ticket.organization_id,case when is_platform then 'platform' else 'organization' end,'support.ticket_replied','support_tickets',ticket.id::text,null,null,jsonb_build_object('internal',p_is_internal,'ticketNumber',ticket.ticket_number));
end;
$$;

create or replace function public.platform_update_support_ticket_v1(
  p_ticket_id uuid,p_status text default null,p_priority text default null,p_assigned_to uuid default null,p_sla_due_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare old_row public.support_tickets%rowtype; new_row public.support_tickets%rowtype;
begin
  perform public.platform_assert_admin_v1('platform.support.manage');
  select * into old_row from public.support_tickets where id=p_ticket_id for update;
  if old_row.id is null then raise exception 'TICKET_NOT_FOUND'; end if;
  if p_status is not null and p_status not in ('new','in_analysis','assigned','waiting_customer','in_solution','resolved','closed','reopened','cancelled') then raise exception 'INVALID_STATUS'; end if;
  if p_priority is not null and p_priority not in ('low','medium','high','critical') then raise exception 'INVALID_PRIORITY'; end if;
  update public.support_tickets set
    status=coalesce(p_status,status),priority=coalesce(p_priority,priority),assigned_to=coalesce(p_assigned_to,assigned_to),sla_due_at=coalesce(p_sla_due_at,sla_due_at),
    resolved_at=case when p_status='resolved' then now() when p_status is not null and p_status<>'resolved' then null else resolved_at end,
    closed_at=case when p_status='closed' then now() when p_status is not null and p_status<>'closed' then null else closed_at end,
    updated_at=now()
  where id=p_ticket_id returning * into new_row;
  perform public.platform_insert_audit_v1(old_row.organization_id,'platform','support.ticket_updated','support_tickets',p_ticket_id::text,to_jsonb(old_row),to_jsonb(new_row),'{}'::jsonb);
end;
$$;

create or replace function public.platform_list_support_tickets_v1(
  p_organization_id uuid default null,p_status text default null,p_priority text default null,p_search text default null,p_page integer default 1,p_page_size integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare result jsonb; safe_page int:=greatest(1,coalesce(p_page,1)); safe_size int:=least(100,greatest(1,coalesce(p_page_size,25)));
begin
  perform public.platform_assert_admin_v1('platform.support.view');
  with base as(
    select st.*,o.name organization_name,p.name requester_name,p.email requester_email,ap.name assigned_to_name,c.radicado related_case_radicado
    from public.support_tickets st join public.organizations o on o.id=st.organization_id
    left join public.profiles p on p.id=st.created_by left join public.profiles ap on ap.id=st.assigned_to left join public.cases c on c.id=st.related_case_id
    where (p_organization_id is null or st.organization_id=p_organization_id)
      and (nullif(trim(p_status),'') is null or st.status=p_status)
      and (nullif(trim(p_priority),'') is null or st.priority=p_priority)
      and (nullif(trim(p_search),'') is null or st.ticket_number ilike '%'||trim(p_search)||'%' or st.subject ilike '%'||trim(p_search)||'%' or o.name ilike '%'||trim(p_search)||'%')
  ),counted as(select count(*)::int total from base),paged as(select * from base order by updated_at desc offset(safe_page-1)*safe_size limit safe_size)
  select jsonb_build_object('rows',coalesce(jsonb_agg(jsonb_build_object(
    'id',paged.id,'ticketNumber',paged.ticket_number,'organizationId',paged.organization_id,'organizationName',paged.organization_name,
    'createdBy',paged.created_by,'requesterName',paged.requester_name,'requesterEmail',paged.requester_email,'category',paged.category,'subcategory',paged.subcategory,
    'priority',paged.priority,'status',paged.status,'subject',paged.subject,'description',paged.description,'assignedTo',paged.assigned_to,'assignedToName',paged.assigned_to_name,
    'relatedCaseId',paged.related_case_id,'relatedCaseRadicado',paged.related_case_radicado,'slaDueAt',paged.sla_due_at,'resolvedAt',paged.resolved_at,'closedAt',paged.closed_at,
    'createdAt',paged.created_at,'updatedAt',paged.updated_at
  ) order by paged.updated_at desc) filter(where paged.id is not null),'[]'::jsonb),'total',counted.total,'page',safe_page,'pageSize',safe_size)
  into result from counted left join paged on true group by counted.total;
  return result;
end;
$$;

-- =========================================================
-- 5. BACKUPS, SUSCRIPCIONES Y SESIONES DE SOPORTE
-- =========================================================

create or replace function public.platform_request_backup_v1(p_organization_id uuid,p_scope text default 'full',p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare row_data public.organization_backup_jobs%rowtype; org_name text; requester_name text;
begin
  perform public.platform_assert_admin_v1('platform.backups.manage');
  if p_scope not in ('full','database','documents','configuration') then raise exception 'INVALID_BACKUP_SCOPE'; end if;
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'BACKUP_REASON_REQUIRED'; end if;
  select name into org_name from public.organizations where id=p_organization_id;
  if org_name is null then raise exception 'ORGANIZATION_NOT_FOUND'; end if;
  insert into public.organization_backup_jobs(organization_id,requested_by,scope,reason,status,expires_at)
  values(p_organization_id,auth.uid(),p_scope,trim(p_reason),'queued',now()+interval '90 days') returning * into row_data;
  select name into requester_name from public.profiles where id=auth.uid();
  perform public.platform_insert_audit_v1(p_organization_id,'platform','backup.requested','organization_backup_jobs',row_data.id::text,null,to_jsonb(row_data),jsonb_build_object('reason',trim(p_reason)));
  return jsonb_build_object(
    'id',row_data.id,'organizationId',row_data.organization_id,'organizationName',org_name,'requestedBy',row_data.requested_by,'requestedByName',requester_name,
    'scope',row_data.scope,'reason',row_data.reason,'status',row_data.status,'storagePath',row_data.storage_path,'manifest',row_data.manifest,
    'sizeBytes',row_data.size_bytes,'checksum',row_data.checksum,'errorMessage',row_data.error_message,'startedAt',row_data.started_at,
    'completedAt',row_data.completed_at,'expiresAt',row_data.expires_at,'createdAt',row_data.created_at
  );
end;
$$;

create or replace function public.platform_list_backups_v1(
  p_organization_id uuid default null,p_status text default null,p_page integer default 1,p_page_size integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare result jsonb; safe_page int:=greatest(1,coalesce(p_page,1)); safe_size int:=least(100,greatest(1,coalesce(p_page_size,25)));
begin
  perform public.platform_assert_admin_v1('platform.backups.view');
  with base as(
    select b.*,o.name organization_name,p.name requested_by_name
    from public.organization_backup_jobs b join public.organizations o on o.id=b.organization_id left join public.profiles p on p.id=b.requested_by
    where (p_organization_id is null or b.organization_id=p_organization_id) and (nullif(trim(p_status),'') is null or b.status=p_status)
  ),counted as(select count(*)::int total from base),paged as(select * from base order by created_at desc offset(safe_page-1)*safe_size limit safe_size)
  select jsonb_build_object('rows',coalesce(jsonb_agg(jsonb_build_object(
    'id',paged.id,'organizationId',paged.organization_id,'organizationName',paged.organization_name,'requestedBy',paged.requested_by,'requestedByName',paged.requested_by_name,
    'scope',paged.scope,'reason',paged.reason,'status',paged.status,'storagePath',paged.storage_path,'manifest',paged.manifest,'sizeBytes',paged.size_bytes,'checksum',paged.checksum,
    'errorMessage',paged.error_message,'startedAt',paged.started_at,'completedAt',paged.completed_at,'expiresAt',paged.expires_at,'createdAt',paged.created_at
  ) order by paged.created_at desc) filter(where paged.id is not null),'[]'::jsonb),'total',counted.total,'page',safe_page,'pageSize',safe_size)
  into result from counted left join paged on true group by counted.total;
  return result;
end;
$$;

create or replace function public.platform_update_subscription_v1(
  p_organization_id uuid,
  p_plan_id uuid default null,
  p_status text default null,
  p_current_period_end timestamptz default null,
  p_limits_override jsonb default null,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare old_data jsonb; new_data jsonb; subscription_id uuid; selected_plan uuid;
begin
  perform public.platform_assert_admin_v1('platform.subscriptions.manage');
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'SUBSCRIPTION_REASON_REQUIRED'; end if;
  if p_status is not null and p_status not in ('trialing','active','past_due','suspended','cancelled') then raise exception 'INVALID_SUBSCRIPTION_STATUS'; end if;
  if not exists(select 1 from public.organizations where id=p_organization_id) then raise exception 'ORGANIZATION_NOT_FOUND'; end if;
  select to_jsonb(os),os.id,os.plan_id into old_data,subscription_id,selected_plan from public.organization_subscriptions os where os.organization_id=p_organization_id for update;
  selected_plan:=coalesce(p_plan_id,selected_plan,(select id from public.saas_plans where is_active order by sort_order limit 1));
  if selected_plan is null then raise exception 'PLAN_REQUIRED'; end if;
  if p_plan_id is not null and not exists(select 1 from public.saas_plans where id=p_plan_id and is_active) then raise exception 'PLAN_NOT_FOUND'; end if;

  insert into public.organization_subscriptions(organization_id,plan_id,status,current_period_start,current_period_end,limits_override)
  values(p_organization_id,selected_plan,coalesce(p_status,'active'),now(),coalesce(p_current_period_end,now()+interval '1 year'),coalesce(p_limits_override,'{}'::jsonb))
  on conflict(organization_id) do update set
    plan_id=coalesce(p_plan_id,public.organization_subscriptions.plan_id),
    status=coalesce(p_status,public.organization_subscriptions.status),
    current_period_end=coalesce(p_current_period_end,public.organization_subscriptions.current_period_end),
    limits_override=coalesce(p_limits_override,public.organization_subscriptions.limits_override),
    updated_at=now()
  returning id into subscription_id;
  select to_jsonb(os) into new_data from public.organization_subscriptions os where os.id=subscription_id;

  insert into public.organization_subscription_events(organization_id,subscription_id,event_type,previous_data,new_data,reason,performed_by)
  values(p_organization_id,subscription_id,'subscription_updated',old_data,new_data,trim(p_reason),auth.uid());
  perform public.platform_insert_audit_v1(p_organization_id,'platform','subscription.updated','organization_subscriptions',subscription_id::text,old_data,new_data,jsonb_build_object('reason',trim(p_reason)));
end;
$$;

create or replace function public.platform_set_organization_active_v1(p_organization_id uuid,p_is_active boolean,p_reason text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare old_data jsonb; new_data jsonb;
begin
  perform public.platform_assert_admin_v1('platform.organizations.manage');
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'ORGANIZATION_REASON_REQUIRED'; end if;
  select to_jsonb(o) into old_data from public.organizations o where o.id=p_organization_id for update;
  if old_data is null then raise exception 'ORGANIZATION_NOT_FOUND'; end if;
  update public.organizations set is_active=p_is_active,updated_at=now(),settings=jsonb_set(settings,'{platformStatusReason}',to_jsonb(trim(p_reason)),true) where id=p_organization_id;
  select to_jsonb(o) into new_data from public.organizations o where o.id=p_organization_id;
  update public.organization_subscriptions set status=case when p_is_active then case when status='suspended' then 'active' else status end else 'suspended' end,updated_at=now() where organization_id=p_organization_id;
  perform public.platform_insert_audit_v1(p_organization_id,'platform',case when p_is_active then 'organization.reactivated' else 'organization.suspended' end,'organizations',p_organization_id::text,old_data,new_data,jsonb_build_object('reason',trim(p_reason)));
end;
$$;

create or replace function public.platform_start_support_session_v1(
  p_organization_id uuid,p_mode text default 'read_only',p_reason text default null,p_ticket_id uuid default null,p_duration_minutes integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare row_data public.platform_support_sessions%rowtype; org_name text; safe_minutes int;
begin
  perform public.platform_assert_admin_v1('platform.support.access');
  if p_mode not in ('read_only','support','admin') then raise exception 'INVALID_SUPPORT_MODE'; end if;
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'SUPPORT_REASON_REQUIRED'; end if;
  safe_minutes:=least(60,greatest(5,coalesce(p_duration_minutes,30)));
  select name into org_name from public.organizations where id=p_organization_id;
  if org_name is null then raise exception 'ORGANIZATION_NOT_FOUND'; end if;
  if p_ticket_id is not null and not exists(select 1 from public.support_tickets where id=p_ticket_id and organization_id=p_organization_id) then raise exception 'INVALID_SUPPORT_TICKET'; end if;
  update public.platform_support_sessions set ended_at=now(),ended_by=auth.uid() where admin_user_id=auth.uid() and ended_at is null and expires_at>now();
  insert into public.platform_support_sessions(organization_id,admin_user_id,ticket_id,mode,reason,expires_at)
  values(p_organization_id,auth.uid(),p_ticket_id,p_mode,trim(p_reason),now()+make_interval(mins=>safe_minutes)) returning * into row_data;
  perform public.platform_insert_audit_v1(p_organization_id,'platform','support.session_started','platform_support_sessions',row_data.id::text,null,to_jsonb(row_data),jsonb_build_object('reason',trim(p_reason),'mode',p_mode));
  return jsonb_build_object('id',row_data.id,'organizationId',row_data.organization_id,'organizationName',org_name,'adminUserId',row_data.admin_user_id,
    'mode',row_data.mode,'reason',row_data.reason,'ticketId',row_data.ticket_id,'startedAt',row_data.started_at,'expiresAt',row_data.expires_at,'endedAt',row_data.ended_at,'isActive',true);
end;
$$;

create or replace function public.platform_end_support_session_v1(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare row_data public.platform_support_sessions%rowtype;
begin
  perform public.platform_assert_admin_v1('platform.support.access');
  update public.platform_support_sessions set ended_at=now(),ended_by=auth.uid() where id=p_session_id and ended_at is null returning * into row_data;
  if row_data.id is null then raise exception 'SUPPORT_SESSION_NOT_FOUND'; end if;
  perform public.platform_insert_audit_v1(row_data.organization_id,'platform','support.session_ended','platform_support_sessions',row_data.id::text,null,to_jsonb(row_data),'{}'::jsonb);
end;
$$;

-- =========================================================
-- 6. CENTRO DE OPERACIÓN
-- =========================================================

create or replace function public.platform_get_operations_v1(p_organization_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare result jsonb;
begin
  perform public.platform_assert_admin_v1('platform.operations.view');
  select jsonb_build_object(
    'errors',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select e.id,e.organization_id,o.name organization_name,e.user_id,e.severity,e.source,e.route,e.message,e.stack,e.metadata,e.resolved_at,e.resolved_by,e.created_at
      from public.app_error_logs e left join public.organizations o on o.id=e.organization_id
      where (p_organization_id is null or e.organization_id=p_organization_id) order by e.created_at desc limit 100
    ) x),'[]'::jsonb),
    'emailQueue',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select q.id,q.organization_id,o.name organization_name,q.case_id,q.recipient_email,q.event_type,q.subject,q.status,q.attempts,q.max_attempts,q.available_at,q.last_error,q.provider_message_id,q.created_at,q.updated_at
      from public.email_queue q left join public.organizations o on o.id=q.organization_id
      where (p_organization_id is null or q.organization_id=p_organization_id) order by q.created_at desc limit 100
    ) x),'[]'::jsonb),
    'automations',coalesce((select jsonb_agg(to_jsonb(x) order by x.started_at desc) from (
      select ae.id,ae.organization_id,o.name organization_name,ae.rule_id,ar.name rule_name,ae.case_id,ae.trigger_event,ae.status,ae.matched,ae.actions_total,ae.actions_succeeded,ae.error_message,ae.attempt_count,ae.next_retry_at,ae.started_at,ae.finished_at
      from public.automation_executions ae left join public.organizations o on o.id=ae.organization_id left join public.automation_rules ar on ar.id=ae.rule_id
      where (p_organization_id is null or ae.organization_id=p_organization_id) order by ae.started_at desc limit 100
    ) x),'[]'::jsonb),
    'exportJobs',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select r.id,r.organization_id,o.name organization_name,r.requested_by,r.format,r.from_date,r.to_date,r.status,r.total_rows,r.processed_rows,r.error_message,r.created_at,r.updated_at,r.completed_at
      from public.report_export_jobs r left join public.organizations o on o.id=r.organization_id
      where (p_organization_id is null or r.organization_id=p_organization_id) order by r.created_at desc limit 100
    ) x),'[]'::jsonb),
    'qualityRuns',coalesce((select jsonb_agg(to_jsonb(x) order by x.started_at desc) from (
      select q.id,q.organization_id,o.name organization_name,q.initiated_by,q.status,q.release_version,q.started_at,q.finished_at,q.duration_ms,q.total_checks,q.passed_checks,q.warning_checks,q.failed_checks,q.skipped_checks
      from public.sigc_quality_runs q left join public.organizations o on o.id=q.organization_id
      where (p_organization_id is null or q.organization_id=p_organization_id) order by q.started_at desc limit 100
    ) x),'[]'::jsonb),
    'counters',jsonb_build_object(
      'unresolvedErrors',(select count(*) from public.app_error_logs e where e.resolved_at is null and (p_organization_id is null or e.organization_id=p_organization_id)),
      'queuedEmails',(select count(*) from public.email_queue q where q.status in ('queued','dispatching') and (p_organization_id is null or q.organization_id=p_organization_id)),
      'failedEmails',(select count(*) from public.email_queue q where q.status in ('failed','dead_letter') and (p_organization_id is null or q.organization_id=p_organization_id)),
      'failedAutomations',(select count(*) from public.automation_executions a where a.status='failed' and (p_organization_id is null or a.organization_id=p_organization_id)),
      'pendingExports',(select count(*) from public.report_export_jobs r where r.status in ('pending','processing') and (p_organization_id is null or r.organization_id=p_organization_id)),
      'failedQualityRuns',(select count(*) from public.sigc_quality_runs q where q.status='failed' and (p_organization_id is null or q.organization_id=p_organization_id))
    )
  ) into result;
  return result;
end;
$$;

-- =========================================================
-- 7. CATÁLOGOS BASE Y TRES ORGANIZACIONES
-- =========================================================

insert into public.permissions(code,name,description) values
('case.create','Crear casos','Permite crear casos manuales.'),
('case.read_all','Consultar todos los casos','Consulta global de casos de la organización.'),
('case.read_assigned','Consultar casos asignados','Consulta de casos relacionados con el usuario.'),
('case.assign','Clasificar y asignar','Permite clasificar y asignar casos.'),
('case.change_state','Cambiar estado','Permite ejecutar transiciones.'),
('case.override_sla','Modificar SLA','Permite modificar excepcionalmente el vencimiento.'),
('case.approve','Aprobar respuestas','Permite aprobar o devolver respuestas.'),
('case.close','Cerrar casos','Permite cerrar casos.'),
('case.comment','Agregar comentarios','Permite comentar casos.'),
('case.manage_subtasks','Gestionar subtareas','Permite crear y actualizar subtareas.'),
('case.send_reminder','Enviar recordatorios','Permite enviar recordatorios manuales.'),
('case.review','Solicitar revisión','Permite enviar respuestas a revisión.'),
('case.register_delivery','Registrar entrega','Permite registrar envíos y entregas.'),
('document.upload','Cargar documentos','Permite cargar documentos y versiones.'),
('document.delete','Eliminar documentos','Permite eliminación lógica de documentos.'),
('admin.manage_users','Administrar usuarios','Gestiona usuarios, roles y áreas.'),
('admin.manage_configuration','Administrar configuración','Gestiona catálogos y parámetros.'),
('automation.view','Consultar automatizaciones','Consulta reglas y ejecuciones.'),
('automation.manage','Administrar automatizaciones','Crea y publica reglas.'),
('audit.view','Consultar auditoría','Consulta la auditoría de la organización.'),
('audit.export','Exportar auditoría','Exporta eventos de auditoría.'),
('reports.view','Consultar reportes','Consulta indicadores y reportes.'),
('reports.export','Exportar reportes','Genera exportaciones.'),
('saas.manage_workspace','Administrar espacio SaaS','Gestiona información del espacio organizacional.'),
('client.portal','Portal de cliente','Acceso al portal externo autenticado.'),
('quality.view','Consultar calidad','Consulta el centro de calidad.'),
('quality.run','Ejecutar calidad','Ejecuta validaciones de calidad.')
on conflict(code) do update set name=excluded.name,description=excluded.description;

insert into public.saas_plans(code,name,description,monthly_price_cop,limits,features,is_public,is_active,sort_order) values
('essential','Esencial','Operación inicial para equipos pequeños.',690000,jsonb_build_object('users',15,'storage_bytes',10737418240,'cases_month',1000,'emails_month',5000,'automations_month',2000),jsonb_build_object('support','standard','backups','weekly','custom_branding',true),true,true,10),
('professional','Profesional','Gestión completa para organizaciones en crecimiento.',1290000,jsonb_build_object('users',50,'storage_bytes',53687091200,'cases_month',5000,'emails_month',25000,'automations_month',15000),jsonb_build_object('support','priority','backups','daily','custom_branding',true,'advanced_reports',true),true,true,20),
('enterprise','Empresarial','Capacidad ampliada y soporte especializado.',2490000,jsonb_build_object('users',200,'storage_bytes',214748364800,'cases_month',25000,'emails_month',100000,'automations_month',100000),jsonb_build_object('support','dedicated','backups','daily','custom_branding',true,'advanced_reports',true,'sso',true),true,true,30)
on conflict(code) do update set name=excluded.name,description=excluded.description,monthly_price_cop=excluded.monthly_price_cop,limits=excluded.limits,features=excluded.features,is_active=true,updated_at=now();

insert into public.organizations(id,name,slug,is_active,settings) values
('10000000-0000-4000-8000-000000000001','Seguridad Atlas S.A.S.','seguridad-atlas',true,jsonb_build_object('industry','Seguridad privada','country','CO','demo',true)),
('10000000-0000-4000-8000-000000000002','Grupo Nova Servicios S.A.S.','grupo-nova',true,jsonb_build_object('industry','Servicios empresariales','country','CO','demo',true)),
('10000000-0000-4000-8000-000000000003','Vigía Integral Ltda.','vigia-integral',true,jsonb_build_object('industry','Vigilancia y facility management','country','CO','demo',true))
on conflict(slug) do update set name=excluded.name,is_active=true,settings=public.organizations.settings||excluded.settings,updated_at=now();

insert into public.organization_branding(organization_id,product_name,short_name,primary_color,accent_color,sidebar_color,support_email)
select o.id,'Atlas Casos','ATLAS','#173B57','#2CB67D','#0C2538','soporte@seguridad-atlas.demo' from public.organizations o where o.slug='seguridad-atlas'
on conflict(organization_id) do update set product_name=excluded.product_name,short_name=excluded.short_name,primary_color=excluded.primary_color,accent_color=excluded.accent_color,sidebar_color=excluded.sidebar_color,support_email=excluded.support_email,updated_at=now();
insert into public.organization_branding(organization_id,product_name,short_name,primary_color,accent_color,sidebar_color,support_email)
select o.id,'Nova Gestión','NOVA','#6D28D9','#F59E0B','#24123F','soporte@grupo-nova.demo' from public.organizations o where o.slug='grupo-nova'
on conflict(organization_id) do update set product_name=excluded.product_name,short_name=excluded.short_name,primary_color=excluded.primary_color,accent_color=excluded.accent_color,sidebar_color=excluded.sidebar_color,support_email=excluded.support_email,updated_at=now();
insert into public.organization_branding(organization_id,product_name,short_name,primary_color,accent_color,sidebar_color,support_email)
select o.id,'Vigía Control','VIGÍA','#0F4C5C','#E36414','#072E38','soporte@vigia-integral.demo' from public.organizations o where o.slug='vigia-integral'
on conflict(organization_id) do update set product_name=excluded.product_name,short_name=excluded.short_name,primary_color=excluded.primary_color,accent_color=excluded.accent_color,sidebar_color=excluded.sidebar_color,support_email=excluded.support_email,updated_at=now();

insert into public.organization_subscriptions(organization_id,plan_id,status,current_period_start,current_period_end,limits_override)
select o.id,p.id,'active',now(),now()+interval '1 year','{}'::jsonb from public.organizations o join public.saas_plans p on p.code='professional' where o.slug='seguridad-atlas'
on conflict(organization_id) do update set plan_id=excluded.plan_id,status='active',current_period_start=excluded.current_period_start,current_period_end=excluded.current_period_end,updated_at=now();
insert into public.organization_subscriptions(organization_id,plan_id,status,trial_ends_at,current_period_start,current_period_end,limits_override)
select o.id,p.id,'trialing',now()+interval '45 days',now(),now()+interval '45 days',jsonb_build_object('users',25) from public.organizations o join public.saas_plans p on p.code='essential' where o.slug='grupo-nova'
on conflict(organization_id) do update set plan_id=excluded.plan_id,status='trialing',trial_ends_at=excluded.trial_ends_at,current_period_start=excluded.current_period_start,current_period_end=excluded.current_period_end,limits_override=excluded.limits_override,updated_at=now();
insert into public.organization_subscriptions(organization_id,plan_id,status,current_period_start,current_period_end,limits_override)
select o.id,p.id,'active',now(),now()+interval '18 months',jsonb_build_object('storage_bytes',322122547200) from public.organizations o join public.saas_plans p on p.code='enterprise' where o.slug='vigia-integral'
on conflict(organization_id) do update set plan_id=excluded.plan_id,status='active',current_period_start=excluded.current_period_start,current_period_end=excluded.current_period_end,limits_override=excluded.limits_override,updated_at=now();

-- Roles base por organización.
do $$
declare org record; role_row record; permission_code text;
begin
  for org in select id from public.organizations where slug in ('seguridad-atlas','grupo-nova','vigia-integral') loop
    insert into public.roles(organization_id,code,name,description,is_system,is_active)
    select org.id,x.code,x.name,x.description,true,true from (values
      ('admin','Administrador','Control completo de la organización.'),
      ('director','Director','Dirección, aprobación, auditoría e indicadores.'),
      ('coordinator','Coordinador','Clasificación, asignación y supervisión operativa.'),
      ('analyst','Analista','Gestión de casos, subtareas y documentos.'),
      ('consultation','Consulta','Acceso de lectura y reportes.'),
      ('external_client','Cliente externo','Acceso al portal de casos propios.')
    ) as x(code,name,description)
    where not exists(select 1 from public.roles r where r.organization_id=org.id and r.code=x.code);

    for role_row in select id,code from public.roles where organization_id=org.id loop
      if role_row.code='admin' then
        insert into public.role_permissions(role_id,permission_id) select role_row.id,p.id from public.permissions p on conflict do nothing;
      elsif role_row.code='director' then
        insert into public.role_permissions(role_id,permission_id)
        select role_row.id,p.id from public.permissions p where p.code=any(array['case.create','case.read_all','case.assign','case.change_state','case.override_sla','case.approve','case.close','case.comment','case.manage_subtasks','case.send_reminder','case.review','case.register_delivery','document.upload','document.delete','audit.view','audit.export','reports.view','reports.export','quality.view']) on conflict do nothing;
      elsif role_row.code='coordinator' then
        insert into public.role_permissions(role_id,permission_id)
        select role_row.id,p.id from public.permissions p where p.code=any(array['case.create','case.read_all','case.assign','case.change_state','case.override_sla','case.approve','case.comment','case.manage_subtasks','case.send_reminder','case.review','case.register_delivery','document.upload','reports.view','reports.export','automation.view']) on conflict do nothing;
      elsif role_row.code='analyst' then
        insert into public.role_permissions(role_id,permission_id)
        select role_row.id,p.id from public.permissions p where p.code=any(array['case.create','case.read_assigned','case.change_state','case.comment','case.manage_subtasks','case.send_reminder','case.review','case.register_delivery','document.upload','reports.view']) on conflict do nothing;
      elsif role_row.code='consultation' then
        insert into public.role_permissions(role_id,permission_id)
        select role_row.id,p.id from public.permissions p where p.code=any(array['case.read_all','audit.view','reports.view']) on conflict do nothing;
      elsif role_row.code='external_client' then
        insert into public.role_permissions(role_id,permission_id)
        select role_row.id,p.id from public.permissions p where p.code='client.portal' on conflict do nothing;
      end if;
    end loop;
  end loop;
end $$;

-- Catálogos diferenciados.
do $$
declare org record; item record; priority_medium uuid; initial_state uuid; type_id uuid;
begin
  for org in select id,slug from public.organizations where slug in ('seguridad-atlas','grupo-nova','vigia-integral') loop
    -- Prioridades comunes.
    for item in select * from (values ('LOW','Baja','#10B981',10),('MEDIUM','Media','#F59E0B',20),('HIGH','Alta','#F97316',30),('CRITICAL','Crítica','#DC2626',40)) v(code,name,color,sort_order) loop
      insert into public.priorities(organization_id,code,name,color,sort_order,is_active)
      select org.id,item.code,item.name,item.color,item.sort_order,true where not exists(select 1 from public.priorities p where p.organization_id=org.id and p.code=item.code);
    end loop;

    -- Estados comunes.
    for item in select * from (values
      ('PENDING_CLASSIFICATION','Pendiente de Clasificación','#64748B',10,true,false),('CLASSIFIED','Clasificado','#4F46E5',20,false,false),('ASSIGNED','Asignado','#2563EB',30,false,false),
      ('IN_PROGRESS','En Gestión','#0891B2',40,false,false),('PENDING_INFORMATION','Pendiente de Información','#CA8A04',50,false,false),('RESPONSE_DRAFTED','Respuesta Elaborada','#7C3AED',60,false,false),
      ('IN_REVIEW','En Revisión / Aprobación','#9333EA',70,false,false),('RETURNED','Devuelto para Ajustes','#EA580C',80,false,false),('APPROVED','Aprobado','#059669',90,false,false),
      ('SENT','Enviado','#0D9488',100,false,false),('CLOSED','Cerrado','#16A34A',110,false,true),('CANCELLED','Cancelado','#DC2626',120,false,true)
    ) v(code,name,color,sort_order,is_initial,is_terminal) loop
      insert into public.case_states(organization_id,code,name,color,sort_order,is_initial,is_terminal,is_active)
      select org.id,item.code,item.name,item.color,item.sort_order,item.is_initial,item.is_terminal,true where not exists(select 1 from public.case_states s where s.organization_id=org.id and s.code=item.code);
    end loop;

    -- Áreas específicas.
    if org.slug='seguridad-atlas' then
      for item in select * from (values ('GER','Gerencia'),('OPE','Operaciones'),('JUR','Jurídica'),('TH','Talento Humano'),('TEC','Tecnología'),('COM','Comercial'),('FIN','Administrativa y Financiera')) v(code,name) loop
        insert into public.areas(organization_id,code,name,color,is_active) select org.id,item.code,item.name,'#173B57',true where not exists(select 1 from public.areas a where a.organization_id=org.id and a.code=item.code);
      end loop;
    elsif org.slug='grupo-nova' then
      for item in select * from (values ('GER','Gerencia'),('PRO','Proyectos'),('SAC','Servicio al Cliente'),('FIN','Finanzas'),('TEC','Tecnología'),('COM','Comercial'),('CAL','Calidad')) v(code,name) loop
        insert into public.areas(organization_id,code,name,color,is_active) select org.id,item.code,item.name,'#6D28D9',true where not exists(select 1 from public.areas a where a.organization_id=org.id and a.code=item.code);
      end loop;
    else
      for item in select * from (values ('GER','Gerencia'),('OPE','Operaciones'),('MON','Centro de Monitoreo'),('SEG','Seguridad Electrónica'),('JUR','Jurídica'),('GH','Gestión Humana'),('MTO','Mantenimiento')) v(code,name) loop
        insert into public.areas(organization_id,code,name,color,is_active) select org.id,item.code,item.name,'#0F4C5C',true where not exists(select 1 from public.areas a where a.organization_id=org.id and a.code=item.code);
      end loop;
    end if;

    select id into priority_medium from public.priorities where organization_id=org.id and code='MEDIUM';
    if org.slug='seguridad-atlas' then
      for item in select * from (values
        ('PETITION','Derecho de Petición',true,true,15),('COMPLAINT','Queja',true,true,10),('CLAIM','Reclamo',true,true,8),('AUTHORITY','Requerimiento de Autoridad',true,true,5),('OP_INCIDENT','Incidente Operativo',false,true,2)
      ) v(code,name,is_public,is_internal,days) loop
        insert into public.case_types(organization_id,code,name,is_public_enabled,is_internal_enabled,default_priority_id,default_risk_level,is_active)
        select org.id,item.code,item.name,item.is_public,item.is_internal,priority_medium,case when item.days<=5 then 'Alto' else 'Medio' end,true where not exists(select 1 from public.case_types ct where ct.organization_id=org.id and ct.code=item.code);
        select id into type_id from public.case_types where organization_id=org.id and code=item.code;
        insert into public.sla_policies(organization_id,case_type_id,name,duration_value,duration_unit,is_default,is_active)
        select org.id,type_id,'SLA '||item.name,item.days,'business_days',false,true where not exists(select 1 from public.sla_policies s where s.organization_id=org.id and s.case_type_id=type_id);
      end loop;
    elsif org.slug='grupo-nova' then
      for item in select * from (values
        ('SERVICE_REQUEST','Solicitud de Servicio',true,true,5),('CUSTOMER_CLAIM','Reclamación',true,true,8),('INTERNAL_PROJECT','Proyecto Interno',false,true,20),('CONTRACT','Contrato',false,true,15),('AUDIT','Hallazgo de Auditoría',false,true,12)
      ) v(code,name,is_public,is_internal,days) loop
        insert into public.case_types(organization_id,code,name,is_public_enabled,is_internal_enabled,default_priority_id,default_risk_level,is_active)
        select org.id,item.code,item.name,item.is_public,item.is_internal,priority_medium,'Medio',true where not exists(select 1 from public.case_types ct where ct.organization_id=org.id and ct.code=item.code);
        select id into type_id from public.case_types where organization_id=org.id and code=item.code;
        insert into public.sla_policies(organization_id,case_type_id,name,duration_value,duration_unit,is_default,is_active)
        select org.id,type_id,'SLA '||item.name,item.days,'business_days',false,true where not exists(select 1 from public.sla_policies s where s.organization_id=org.id and s.case_type_id=type_id);
      end loop;
    else
      for item in select * from (values
        ('SECURITY_EVENT','Novedad de Seguridad',true,true,1),('INCIDENT','Incidente',true,true,2),('CLIENT_REQUEST','Requerimiento de Cliente',true,true,5),('TUTELA','Acción de Tutela',false,true,1),('MAINTENANCE','Mantenimiento',false,true,3)
      ) v(code,name,is_public,is_internal,days) loop
        insert into public.case_types(organization_id,code,name,is_public_enabled,is_internal_enabled,default_priority_id,default_risk_level,is_active)
        select org.id,item.code,item.name,item.is_public,item.is_internal,priority_medium,case when item.days<=2 then 'Alto' else 'Medio' end,true where not exists(select 1 from public.case_types ct where ct.organization_id=org.id and ct.code=item.code);
        select id into type_id from public.case_types where organization_id=org.id and code=item.code;
        insert into public.sla_policies(organization_id,case_type_id,name,duration_value,duration_unit,is_default,is_active)
        select org.id,type_id,'SLA '||item.name,item.days,'business_days',false,true where not exists(select 1 from public.sla_policies s where s.organization_id=org.id and s.case_type_id=type_id);
      end loop;
    end if;

    insert into public.public_intake_security(organization_id,rate_limit_per_hour,challenge_mode,challenge_threshold,require_privacy_consent,privacy_notice_text)
    values(org.id,20,'adaptive',5,true,'Declaro que la información suministrada es veraz y autorizo su tratamiento para gestionar esta solicitud.')
    on conflict(organization_id) do update set rate_limit_per_hour=excluded.rate_limit_per_hour,challenge_mode=excluded.challenge_mode,require_privacy_consent=true,updated_at=now();
  end loop;
end $$;

-- admin@test.com: se conserva, se convierte en propietario global y se vincula como administrador de las tres organizaciones.
do $$
declare admin_id uuid; org record; admin_role_id uuid; member_id uuid; gerencia_id uuid;
begin
  select id into admin_id from public.profiles where lower(email)='admin@test.com' limit 1;
  if admin_id is null then
    insert into public.profiles(id,name,email)
    select au.id,coalesce(nullif(au.raw_user_meta_data->>'name',''),'Administrador Orkesta'),lower(au.email)
    from auth.users au where lower(au.email)='admin@test.com'
    on conflict(id) do update set email=excluded.email
    returning id into admin_id;
  end if;
  if admin_id is not null then
    insert into public.platform_admins(user_id,role_code,permissions,is_active,created_by)
    values(admin_id,'owner',array['platform.*'],true,admin_id)
    on conflict(user_id) do update set role_code='owner',permissions=array['platform.*'],is_active=true,updated_at=now();
    for org in select id,slug from public.organizations where slug in ('seguridad-atlas','grupo-nova','vigia-integral') order by slug loop
      select id into admin_role_id from public.roles where organization_id=org.id and code='admin' limit 1;
      select id into member_id from public.organization_members where organization_id=org.id and user_id=admin_id and removed_at is null limit 1;
      if member_id is null then
        insert into public.organization_members(organization_id,user_id,role_id,is_active) values(org.id,admin_id,admin_role_id,true) returning id into member_id;
      else
        update public.organization_members set role_id=admin_role_id,is_active=true,removed_at=null,updated_at=now() where id=member_id;
      end if;
      select id into gerencia_id from public.areas where organization_id=org.id and code='GER' limit 1;
      if gerencia_id is not null and not exists(select 1 from public.organization_member_areas where organization_member_id=member_id and area_id=gerencia_id) then
        insert into public.organization_member_areas(organization_id,organization_member_id,area_id,is_primary,is_coordinator,is_active) values(org.id,member_id,gerencia_id,true,true,true);
      end if;
    end loop;
    insert into public.user_preferences(user_id,active_organization_id)
    select admin_id,o.id from public.organizations o where o.slug='seguridad-atlas'
    on conflict(user_id) do update set active_organization_id=excluded.active_organization_id,updated_at=now();
  end if;
end $$;

-- =========================================================
-- 8. ACCIONES OPERATIVAS DEL SUPER ADMIN
-- =========================================================

create or replace function public.platform_resolve_error_v1(p_error_id bigint,p_resolution text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare old_data jsonb; new_data jsonb; org_id uuid;
begin
  perform public.platform_assert_admin_v1('platform.operations.manage');
  if length(trim(coalesce(p_resolution,'')))<5 then raise exception 'RESOLUTION_REQUIRED'; end if;
  select to_jsonb(e),e.organization_id into old_data,org_id from public.app_error_logs e where e.id=p_error_id for update;
  if old_data is null then raise exception 'ERROR_LOG_NOT_FOUND'; end if;
  update public.app_error_logs set resolved_at=now(),resolved_by=auth.uid(),metadata=metadata||jsonb_build_object('resolution',trim(p_resolution)) where id=p_error_id;
  select to_jsonb(e) into new_data from public.app_error_logs e where e.id=p_error_id;
  perform public.platform_insert_audit_v1(org_id,'platform','operations.error_resolved','app_error_logs',p_error_id::text,old_data,new_data,jsonb_build_object('resolution',trim(p_resolution)));
end;
$$;

create or replace function public.platform_retry_email_v1(p_email_queue_id uuid,p_reason text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare old_data jsonb; new_data jsonb; org_id uuid;
begin
  perform public.platform_assert_admin_v1('platform.operations.manage');
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'RETRY_REASON_REQUIRED'; end if;
  select to_jsonb(q),q.organization_id into old_data,org_id from public.email_queue q where q.id=p_email_queue_id for update;
  if old_data is null then raise exception 'EMAIL_QUEUE_NOT_FOUND'; end if;
  update public.email_queue set status='queued',available_at=now(),locked_at=null,last_error=null,updated_at=now() where id=p_email_queue_id;
  select to_jsonb(q) into new_data from public.email_queue q where q.id=p_email_queue_id;
  perform public.platform_insert_audit_v1(org_id,'platform','operations.email_requeued','email_queue',p_email_queue_id::text,old_data,new_data,jsonb_build_object('reason',trim(p_reason)));
end;
$$;

create or replace function public.platform_retry_automation_v1(p_execution_id uuid,p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare old_row public.automation_executions%rowtype; new_id uuid;
begin
  perform public.platform_assert_admin_v1('platform.operations.manage');
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'RETRY_REASON_REQUIRED'; end if;
  select * into old_row from public.automation_executions where id=p_execution_id;
  if old_row.id is null then raise exception 'AUTOMATION_EXECUTION_NOT_FOUND'; end if;
  insert into public.automation_executions(organization_id,rule_id,case_id,audit_event_id,trigger_event,status,matched,attempt_count,max_attempts,next_retry_at,retry_of_id,execution_log)
  values(old_row.organization_id,old_row.rule_id,old_row.case_id,old_row.audit_event_id,old_row.trigger_event,'running',old_row.matched,old_row.attempt_count+1,old_row.max_attempts,now(),old_row.id,jsonb_build_array(jsonb_build_object('requestedBy',auth.uid(),'reason',trim(p_reason),'requestedAt',now())))
  returning id into new_id;
  perform public.platform_insert_audit_v1(old_row.organization_id,'platform','operations.automation_retried','automation_executions',new_id::text,to_jsonb(old_row),jsonb_build_object('retryId',new_id),jsonb_build_object('reason',trim(p_reason)));
  return new_id;
end;
$$;

create or replace function public.platform_cancel_backup_v1(p_backup_id uuid,p_reason text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare old_data jsonb; new_data jsonb; org_id uuid;
begin
  perform public.platform_assert_admin_v1('platform.backups.manage');
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'CANCEL_REASON_REQUIRED'; end if;
  select to_jsonb(b),b.organization_id into old_data,org_id from public.organization_backup_jobs b where b.id=p_backup_id and b.status in ('queued','processing') for update;
  if old_data is null then raise exception 'BACKUP_NOT_CANCELLABLE'; end if;
  update public.organization_backup_jobs set status='cancelled',error_message=trim(p_reason),completed_at=now(),updated_at=now() where id=p_backup_id;
  select to_jsonb(b) into new_data from public.organization_backup_jobs b where b.id=p_backup_id;
  perform public.platform_insert_audit_v1(org_id,'platform','backup.cancelled','organization_backup_jobs',p_backup_id::text,old_data,new_data,jsonb_build_object('reason',trim(p_reason)));
end;
$$;

create or replace function public.platform_set_membership_active_v1(p_membership_id uuid,p_is_active boolean,p_reason text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare old_data jsonb; new_data jsonb; org_id uuid;
begin
  perform public.platform_assert_admin_v1('platform.users.manage');
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'MEMBERSHIP_REASON_REQUIRED'; end if;
  select to_jsonb(om),om.organization_id into old_data,org_id from public.organization_members om where om.id=p_membership_id for update;
  if old_data is null then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  update public.organization_members set is_active=p_is_active,removed_at=case when p_is_active then null else now() end,removed_by=case when p_is_active then null else auth.uid() end,updated_at=now() where id=p_membership_id;
  select to_jsonb(om) into new_data from public.organization_members om where om.id=p_membership_id;
  perform public.platform_insert_audit_v1(org_id,'platform',case when p_is_active then 'user.membership_reactivated' else 'user.membership_suspended' end,'organization_members',p_membership_id::text,old_data,new_data,jsonb_build_object('reason',trim(p_reason)));
end;
$$;

-- =========================================================
-- 9. RLS, PERMISOS Y STORAGE
-- =========================================================

alter table public.platform_admins enable row level security;
alter table public.platform_audit_events enable row level security;
alter table public.organization_subscription_events enable row level security;
alter table public.organization_usage_snapshots enable row level security;
alter table public.organization_backup_jobs enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;
alter table public.platform_support_sessions enable row level security;
alter table public.platform_notifications enable row level security;

drop policy if exists platform_admins_select on public.platform_admins;
create policy platform_admins_select on public.platform_admins for select to authenticated using (public.platform_is_admin_v1());

drop policy if exists platform_audit_select on public.platform_audit_events;
create policy platform_audit_select on public.platform_audit_events for select to authenticated using (public.platform_is_admin_v1('platform.audit.view'));

drop policy if exists subscription_events_select on public.organization_subscription_events;
create policy subscription_events_select on public.organization_subscription_events for select to authenticated using (public.platform_is_admin_v1('platform.subscriptions.view'));

drop policy if exists usage_snapshots_select on public.organization_usage_snapshots;
create policy usage_snapshots_select on public.organization_usage_snapshots for select to authenticated using (public.platform_is_admin_v1('platform.organizations.view'));

drop policy if exists backup_jobs_select on public.organization_backup_jobs;
create policy backup_jobs_select on public.organization_backup_jobs for select to authenticated using (public.platform_is_admin_v1('platform.backups.view'));

drop policy if exists support_tickets_select on public.support_tickets;
create policy support_tickets_select on public.support_tickets for select to authenticated using (
  public.platform_is_admin_v1('platform.support.view')
  or (
    exists(select 1 from public.organization_members om where om.organization_id=support_tickets.organization_id and om.user_id=auth.uid() and om.is_active)
    and (support_tickets.created_by=auth.uid() or public.platform_member_has_permission_v1(support_tickets.organization_id,'admin.manage_configuration') or public.platform_member_has_permission_v1(support_tickets.organization_id,'admin.manage_users'))
  )
);

drop policy if exists support_messages_select on public.support_ticket_messages;
create policy support_messages_select on public.support_ticket_messages for select to authenticated using (
  public.platform_can_view_ticket_v1(ticket_id) and (not is_internal or public.platform_is_admin_v1('platform.support.view'))
);

drop policy if exists support_sessions_select on public.platform_support_sessions;
create policy support_sessions_select on public.platform_support_sessions for select to authenticated using (public.platform_is_admin_v1('platform.support.access'));

drop policy if exists platform_notifications_select on public.platform_notifications;
create policy platform_notifications_select on public.platform_notifications for select to authenticated using (recipient_user_id=auth.uid());

grant select on public.platform_admins,public.platform_audit_events,public.organization_subscription_events,public.organization_usage_snapshots,public.organization_backup_jobs,public.support_tickets,public.support_ticket_messages,public.platform_support_sessions,public.platform_notifications to authenticated;
grant all on public.platform_admins,public.platform_audit_events,public.organization_subscription_events,public.organization_usage_snapshots,public.organization_backup_jobs,public.support_ticket_counters,public.support_tickets,public.support_ticket_messages,public.platform_support_sessions,public.platform_notifications to service_role;
grant usage,select on all sequences in schema public to service_role;

-- Revocar funciones internas que no deben ejecutarse directamente desde el cliente.
revoke all on function public.platform_assert_admin_v1(text) from public,anon,authenticated;
revoke all on function public.platform_insert_audit_v1(uuid,text,text,text,text,jsonb,jsonb,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.platform_next_ticket_number_v1() from public,anon,authenticated;
revoke all on function public.platform_redact_jsonb_v1(jsonb) from public,anon,authenticated;
revoke all on function public.platform_capture_row_change_v1() from public,anon,authenticated;

-- RPC disponibles para usuarios autenticados; cada función valida internamente su alcance.
grant execute on function public.platform_get_context_v1() to authenticated;
grant execute on function public.platform_get_dashboard_v1() to authenticated;
grant execute on function public.platform_list_organizations_v1(text,text,integer,integer) to authenticated;
grant execute on function public.platform_get_organization_detail_v1(uuid) to authenticated;
grant execute on function public.platform_list_users_v1(text,uuid,integer,integer) to authenticated;
grant execute on function public.platform_list_audit_v1(uuid,text,text,timestamptz,timestamptz,integer,integer) to authenticated;
grant execute on function public.platform_create_support_ticket_v1(text,text,text,text,text,uuid) to authenticated;
grant execute on function public.platform_list_my_support_tickets_v1(integer,integer) to authenticated;
grant execute on function public.platform_get_support_ticket_v1(uuid) to authenticated;
grant execute on function public.platform_reply_support_ticket_v1(uuid,text,boolean) to authenticated;
grant execute on function public.platform_update_support_ticket_v1(uuid,text,text,uuid,timestamptz) to authenticated;
grant execute on function public.platform_list_support_tickets_v1(uuid,text,text,text,integer,integer) to authenticated;
grant execute on function public.platform_request_backup_v1(uuid,text,text) to authenticated;
grant execute on function public.platform_list_backups_v1(uuid,text,integer,integer) to authenticated;
grant execute on function public.platform_update_subscription_v1(uuid,uuid,text,timestamptz,jsonb,text) to authenticated;
grant execute on function public.platform_set_organization_active_v1(uuid,boolean,text) to authenticated;
grant execute on function public.platform_start_support_session_v1(uuid,text,text,uuid,integer) to authenticated;
grant execute on function public.platform_end_support_session_v1(uuid) to authenticated;
grant execute on function public.platform_get_operations_v1(uuid) to authenticated;
grant execute on function public.platform_resolve_error_v1(bigint,text) to authenticated;
grant execute on function public.platform_retry_email_v1(uuid,text) to authenticated;
grant execute on function public.platform_retry_automation_v1(uuid,text) to authenticated;
grant execute on function public.platform_cancel_backup_v1(uuid,text) to authenticated;
grant execute on function public.platform_set_membership_active_v1(uuid,boolean,text) to authenticated;

-- Bucket privado para respaldos lógicos. El Edge Function utiliza service_role.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
    values('organization-backups','organization-backups',false,1073741824,array['application/gzip','application/json'])
    on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
  end if;
end $$;

commit;
