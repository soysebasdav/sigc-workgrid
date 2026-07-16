-- Orkesta / SIGC - Fase 3.3
-- Escala, continuidad, observabilidad, privacidad y cumplimiento.
-- Migración incremental. Requiere Fases 1, 2, 3.1 y 3.2.

begin;

-- ---------------------------------------------------------------------------
-- Permisos de plataforma y organización
-- ---------------------------------------------------------------------------
insert into public.platform_permission_catalog(code,name,category,description,is_sensitive)
values
 ('platform.health.view','Ver salud de plataforma','Operación','Consulta salud, disponibilidad y capacidad.',false),
 ('platform.health.manage','Administrar salud de plataforma','Operación','Administra componentes, mantenimientos y estado.',true),
 ('platform.incidents.view','Ver incidentes','Continuidad','Consulta incidentes y comunicaciones.',false),
 ('platform.incidents.manage','Administrar incidentes','Continuidad','Crea, actualiza y resuelve incidentes.',true),
 ('platform.privacy.view','Ver solicitudes de privacidad','Cumplimiento','Consulta solicitudes de titulares.',true),
 ('platform.privacy.manage','Administrar privacidad','Cumplimiento','Gestiona solicitudes y evidencias de privacidad.',true),
 ('platform.retention.view','Ver retención','Cumplimiento','Consulta políticas y simulaciones de retención.',true),
 ('platform.retention.manage','Administrar retención','Cumplimiento','Configura políticas y autoriza ejecuciones.',true),
 ('platform.capacity.view','Ver capacidad','Operación','Consulta capacidad y proyecciones de consumo.',false),
 ('platform.security_posture.view','Ver postura de seguridad','Seguridad','Consulta hallazgos y puntuación.',true),
 ('platform.security_posture.manage','Administrar postura de seguridad','Seguridad','Gestiona y resuelve hallazgos.',true),
 ('platform.regional.manage','Administrar configuración regional','Configuración','Gestiona idioma, zona horaria, país y moneda.',false)
on conflict(code) do update set name=excluded.name,category=excluded.category,description=excluded.description,is_sensitive=excluded.is_sensitive;

insert into public.permissions(code,name,description)
values
 ('privacy.view','Ver privacidad','Consultar solicitudes de privacidad de la organización.'),
 ('privacy.manage','Gestionar privacidad','Crear y actualizar solicitudes de privacidad.'),
 ('regional.view','Ver configuración regional','Consultar idioma, zona horaria, país y moneda.'),
 ('regional.manage','Gestionar configuración regional','Modificar la configuración regional de la organización.')
on conflict(code) do update set name=excluded.name,description=excluded.description;

-- Propietario y administrador reciben todos los permisos nuevos.
insert into public.platform_role_permissions(role_id,permission_id)
select r.id,p.id from public.platform_role_catalog r cross join public.platform_permission_catalog p
where r.code in ('owner','admin') and p.code like 'platform.%'
on conflict do nothing;

-- Operaciones, auditoría y soporte reciben subconjuntos acordes.
insert into public.platform_role_permissions(role_id,permission_id)
select r.id,p.id from public.platform_role_catalog r join public.platform_permission_catalog p on
 (r.code='operations_operator' and p.code in ('platform.health.view','platform.health.manage','platform.incidents.view','platform.incidents.manage','platform.capacity.view','platform.security_posture.view'))
 or (r.code='auditor' and p.code in ('platform.health.view','platform.incidents.view','platform.privacy.view','platform.retention.view','platform.capacity.view','platform.security_posture.view'))
 or (r.code in ('support_manager','support_agent') and p.code in ('platform.health.view','platform.incidents.view'))
on conflict do nothing;

-- Roles organizacionales administrativos reciben privacidad y región.
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r join public.permissions p on p.code in ('privacy.view','privacy.manage','regional.view','regional.manage')
where upper(r.code) in ('ADMIN','ADMINISTRATOR','OWNER','DIRECTOR','COORDINATOR')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Tablas de observabilidad, continuidad, privacidad y gobierno
-- ---------------------------------------------------------------------------
create table if not exists public.platform_service_components (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  component_type text not null default 'application' check(component_type in ('application','database','auth','storage','email','scheduler','integration','external')),
  status text not null default 'operational' check(status in ('operational','degraded','partial_outage','major_outage','maintenance')),
  is_public boolean not null default true,
  sort_order integer not null default 0,
  last_checked_at timestamptz,
  last_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_health_snapshots (
  id bigint generated always as identity primary key,
  status text not null check(status in ('operational','degraded','partial_outage','major_outage','maintenance')),
  health_score integer not null check(health_score between 0 and 100),
  components jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  generated_by text not null default 'scheduler',
  created_at timestamptz not null default now()
);
create index if not exists platform_health_snapshots_created_idx on public.platform_health_snapshots(created_at desc);

create table if not exists public.platform_incidents (
  id uuid primary key default gen_random_uuid(),
  incident_number text not null unique,
  title text not null check(length(trim(title)) between 5 and 240),
  summary text not null default '',
  severity text not null default 'minor' check(severity in ('minor','major','critical')),
  status text not null default 'investigating' check(status in ('investigating','identified','monitoring','resolved','cancelled')),
  impact text not null default 'degraded' check(impact in ('none','degraded','partial_outage','major_outage')),
  affected_component_codes text[] not null default '{}'::text[],
  affected_organization_ids uuid[] not null default '{}'::uuid[],
  is_public boolean not null default true,
  started_at timestamptz not null default now(),
  identified_at timestamptz,
  resolved_at timestamptz,
  root_cause text,
  resolution_summary text,
  owner_user_id uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists platform_incidents_status_idx on public.platform_incidents(status,severity,started_at desc);

create table if not exists public.platform_incident_updates (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.platform_incidents(id) on delete cascade,
  status text not null check(status in ('investigating','identified','monitoring','resolved','cancelled')),
  message text not null check(length(trim(message)) between 3 and 10000),
  is_public boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists platform_incident_updates_incident_idx on public.platform_incident_updates(incident_id,created_at desc);

create table if not exists public.platform_maintenance_windows (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'scheduled' check(status in ('scheduled','in_progress','completed','cancelled')),
  affected_component_codes text[] not null default '{}'::text[],
  affected_organization_ids uuid[] not null default '{}'::uuid[],
  is_public boolean not null default true,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(ends_at>starts_at)
);

create table if not exists public.organization_continuity_policies (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  rpo_minutes integer not null default 1440 check(rpo_minutes between 15 and 10080),
  rto_minutes integer not null default 480 check(rto_minutes between 15 and 10080),
  backup_verification_frequency_days integer not null default 30 check(backup_verification_frequency_days between 1 and 365),
  require_restore_approval boolean not null default true,
  require_two_person_approval boolean not null default true,
  last_verified_backup_at timestamptz,
  next_verification_at timestamptz,
  continuity_owner_email text,
  notes text,
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.backup_verification_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  backup_job_id uuid not null references public.organization_backup_jobs(id),
  verification_type text not null default 'metadata' check(verification_type in ('metadata','checksum','validation_restore')),
  status text not null default 'running' check(status in ('running','passed','warning','failed','cancelled')),
  checks jsonb not null default '[]'::jsonb,
  error_message text,
  initiated_by uuid references public.profiles(id),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists backup_verification_runs_org_idx on public.backup_verification_runs(organization_id,created_at desc);

create table if not exists public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null unique,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  request_type text not null check(request_type in ('access','correction','portability','deletion','restriction','objection','consent_withdrawal')),
  status text not null default 'received' check(status in ('received','identity_verification','in_review','waiting_requester','approved','partially_approved','rejected','completed','cancelled')),
  priority text not null default 'normal' check(priority in ('normal','high','urgent')),
  requester_name text not null,
  requester_email text not null,
  requester_document text,
  description text not null,
  legal_basis text,
  due_at timestamptz not null default (now()+interval '15 days'),
  identity_verified_at timestamptz,
  assigned_to uuid references public.profiles(id),
  decision text,
  decision_reason text,
  evidence jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists privacy_requests_org_status_idx on public.privacy_requests(organization_id,status,due_at);

create table if not exists public.privacy_request_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.privacy_requests(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references public.profiles(id),
  event_type text not null,
  message text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_retention_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  data_domain text not null check(data_domain in ('cases','documents','audit','emails','technical_logs','backups','tickets','commercial','integration_logs')),
  retention_days integer not null check(retention_days between 30 and 36500),
  action text not null default 'review' check(action in ('review','anonymize','soft_delete','hard_delete')),
  legal_hold_respected boolean not null default true,
  enabled boolean not null default true,
  require_approval boolean not null default true,
  last_preview_at timestamptz,
  last_execution_at timestamptz,
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,data_domain)
);

create table if not exists public.retention_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mode text not null default 'preview' check(mode in ('preview','execute')),
  status text not null default 'running' check(status in ('running','completed','warning','failed','cancelled')),
  results jsonb not null default '{}'::jsonb,
  reason text,
  requested_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_capacity_snapshots (
  id bigint generated always as identity primary key,
  organizations_total integer not null default 0,
  users_total bigint not null default 0,
  cases_total bigint not null default 0,
  storage_bytes bigint not null default 0,
  api_requests_24h bigint not null default 0,
  emails_queued bigint not null default 0,
  jobs_failed_24h bigint not null default 0,
  growth jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists platform_capacity_snapshots_created_idx on public.platform_capacity_snapshots(created_at desc);

create table if not exists public.platform_security_findings (
  id uuid primary key default gen_random_uuid(),
  finding_key text not null unique,
  organization_id uuid references public.organizations(id) on delete cascade,
  category text not null,
  severity text not null check(severity in ('info','low','medium','high','critical')),
  title text not null,
  description text not null,
  recommendation text,
  status text not null default 'open' check(status in ('open','accepted','resolved','false_positive')),
  source text not null default 'automated',
  evidence jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id),
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists platform_security_findings_status_idx on public.platform_security_findings(status,severity,last_seen_at desc);

create table if not exists public.organization_regional_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  locale text not null default 'es-CO',
  language text not null default 'es',
  country_code char(2) not null default 'CO',
  timezone text not null default 'America/Bogota',
  currency char(3) not null default 'COP',
  date_format text not null default 'DD/MM/YYYY',
  time_format text not null default '12h' check(time_format in ('12h','24h')),
  first_day_of_week smallint not null default 1 check(first_day_of_week between 0 and 6),
  business_days smallint[] not null default array[1,2,3,4,5]::smallint[],
  translations jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Datos base y configuración por organizaciones existentes.
insert into public.platform_service_components(code,name,description,component_type,sort_order)
values
 ('web_app','Aplicación web','Interfaz principal desplegada en Render.','application',10),
 ('database','Base de datos','PostgreSQL y funciones RPC de Supabase.','database',20),
 ('authentication','Autenticación','Supabase Auth y sesiones.','auth',30),
 ('storage','Archivos y backups','Supabase Storage.','storage',40),
 ('email','Correo y notificaciones','Colas y entrega de correo.','email',50),
 ('scheduler','Procesos programados','Cron y scheduler central.','scheduler',60),
 ('integrations','API e integraciones','API pública, webhooks y exportaciones.','integration',70)
on conflict(code) do nothing;

insert into public.organization_continuity_policies(organization_id,next_verification_at)
select id,now()+interval '30 days' from public.organizations on conflict(organization_id) do nothing;

insert into public.organization_regional_settings(organization_id)
select id from public.organizations on conflict(organization_id) do nothing;

insert into public.organization_retention_policies(organization_id,data_domain,retention_days,action)
select o.id,v.domain,v.days,'review' from public.organizations o cross join (values
 ('cases',3650),('documents',3650),('audit',3650),('emails',730),('technical_logs',365),('backups',365),('tickets',1825),('commercial',3650),('integration_logs',365)
) as v(domain,days)
on conflict(organization_id,data_domain) do nothing;

-- ---------------------------------------------------------------------------
-- Funciones auxiliares
-- ---------------------------------------------------------------------------
create sequence if not exists public.platform_incident_counter_seq;
create sequence if not exists public.privacy_request_counter_seq;

create or replace function public.phase33_assert_platform_v33(p_permission text)
returns void language plpgsql stable security definer set search_path=public,auth as $$
begin
  if not public.platform_is_service_role_v2() and not public.platform_is_admin_v2(p_permission) then
    raise exception 'PLATFORM_ACCESS_DENIED' using errcode='42501';
  end if;
end; $$;

create or replace function public.platform_get_phase33_dashboard_v33()
returns jsonb language plpgsql stable security definer set search_path=public,auth as $$
declare result jsonb;
begin
  perform public.phase33_assert_platform_v33('platform.health.view');
  select jsonb_build_object(
    'health',coalesce((select jsonb_build_object('status',status,'healthScore',health_score,'components',components,'metrics',metrics,'createdAt',created_at) from public.platform_health_snapshots order by created_at desc limit 1),jsonb_build_object('status','unknown','healthScore',0,'components','[]'::jsonb,'metrics','{}'::jsonb)),
    'incidents',jsonb_build_object(
      'active',(select count(*) from public.platform_incidents where status not in ('resolved','cancelled')),
      'critical',(select count(*) from public.platform_incidents where status not in ('resolved','cancelled') and severity='critical'),
      'recent',coalesce((select jsonb_agg(jsonb_build_object('id',id,'incidentNumber',incident_number,'title',title,'severity',severity,'status',status,'impact',impact,'startedAt',started_at,'isPublic',is_public) order by started_at desc) from (select * from public.platform_incidents order by started_at desc limit 8) x),'[]'::jsonb)
    ),
    'privacy',jsonb_build_object(
      'open',(select count(*) from public.privacy_requests where status not in ('completed','cancelled','rejected')),
      'overdue',(select count(*) from public.privacy_requests where status not in ('completed','cancelled','rejected') and due_at<now())
    ),
    'continuity',jsonb_build_object(
      'organizationsWithoutRecentBackup',(select count(*) from public.organizations o where o.is_active and not exists(select 1 from public.organization_backup_jobs b where b.organization_id=o.id and b.status='completed' and b.completed_at>now()-interval '48 hours')),
      'failedVerifications',(select count(*) from public.backup_verification_runs where status='failed' and created_at>now()-interval '30 days')
    ),
    'security',jsonb_build_object(
      'openFindings',(select count(*) from public.platform_security_findings where status='open'),
      'highFindings',(select count(*) from public.platform_security_findings where status='open' and severity in ('high','critical'))
    ),
    'capacity',coalesce((select jsonb_build_object('organizationsTotal',organizations_total,'usersTotal',users_total,'casesTotal',cases_total,'storageBytes',storage_bytes,'apiRequests24h',api_requests_24h,'emailsQueued',emails_queued,'jobsFailed24h',jobs_failed_24h,'growth',growth,'createdAt',created_at) from public.platform_capacity_snapshots order by created_at desc limit 1),'{}'::jsonb),
    'maintenance',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'status',status,'startsAt',starts_at,'endsAt',ends_at,'isPublic',is_public) order by starts_at) from public.platform_maintenance_windows where status in ('scheduled','in_progress') and ends_at>now()-interval '1 day'),'[]'::jsonb)
  ) into result;
  return result;
end; $$;

create or replace function public.platform_list_incidents_v33(p_include_resolved boolean default true)
returns jsonb language plpgsql stable security definer set search_path=public,auth as $$
begin
  perform public.phase33_assert_platform_v33('platform.incidents.view');
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',i.id,'incidentNumber',i.incident_number,'title',i.title,'summary',i.summary,'severity',i.severity,'status',i.status,'impact',i.impact,
    'affectedComponentCodes',i.affected_component_codes,'affectedOrganizationIds',i.affected_organization_ids,'isPublic',i.is_public,
    'startedAt',i.started_at,'identifiedAt',i.identified_at,'resolvedAt',i.resolved_at,'rootCause',i.root_cause,'resolutionSummary',i.resolution_summary,
    'ownerUserId',i.owner_user_id,'createdAt',i.created_at,'updatedAt',i.updated_at,
    'updates',coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'status',u.status,'message',u.message,'isPublic',u.is_public,'createdAt',u.created_at) order by u.created_at desc) from public.platform_incident_updates u where u.incident_id=i.id),'[]'::jsonb)
  ) order by i.started_at desc) from public.platform_incidents i where p_include_resolved or i.status not in ('resolved','cancelled')),'[]'::jsonb);
end; $$;

create or replace function public.platform_upsert_incident_v33(p_payload jsonb,p_reason text)
returns uuid language plpgsql security definer set search_path=public,auth as $$
declare v_id uuid; v_number text;
begin
  perform public.phase33_assert_platform_v33('platform.incidents.manage');
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'JUSTIFICATION_REQUIRED'; end if;
  v_id:=nullif(p_payload->>'id','')::uuid;
  if v_id is null then
    v_number:='INC-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('public.platform_incident_counter_seq')::text,6,'0');
    insert into public.platform_incidents(incident_number,title,summary,severity,status,impact,affected_component_codes,affected_organization_ids,is_public,started_at,owner_user_id,created_by,updated_by)
    values(v_number,trim(p_payload->>'title'),coalesce(p_payload->>'summary',''),coalesce(p_payload->>'severity','minor'),coalesce(p_payload->>'status','investigating'),coalesce(p_payload->>'impact','degraded'),
      coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'affectedComponentCodes','[]'::jsonb))),'{}'::text[]),
      coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'affectedOrganizationIds','[]'::jsonb))::uuid),'{}'::uuid[]),
      coalesce((p_payload->>'isPublic')::boolean,true),coalesce((p_payload->>'startedAt')::timestamptz,now()),nullif(p_payload->>'ownerUserId','')::uuid,auth.uid(),auth.uid()) returning id into v_id;
  else
    update public.platform_incidents set title=coalesce(nullif(trim(p_payload->>'title'),''),title),summary=coalesce(p_payload->>'summary',summary),severity=coalesce(p_payload->>'severity',severity),status=coalesce(p_payload->>'status',status),impact=coalesce(p_payload->>'impact',impact),
      affected_component_codes=case when p_payload?'affectedComponentCodes' then array(select jsonb_array_elements_text(p_payload->'affectedComponentCodes')) else affected_component_codes end,
      affected_organization_ids=case when p_payload?'affectedOrganizationIds' then array(select jsonb_array_elements_text(p_payload->'affectedOrganizationIds')::uuid) else affected_organization_ids end,
      is_public=coalesce((p_payload->>'isPublic')::boolean,is_public),root_cause=coalesce(p_payload->>'rootCause',root_cause),resolution_summary=coalesce(p_payload->>'resolutionSummary',resolution_summary),owner_user_id=coalesce(nullif(p_payload->>'ownerUserId','')::uuid,owner_user_id),
      identified_at=case when coalesce(p_payload->>'status',status) in ('identified','monitoring','resolved') and identified_at is null then now() else identified_at end,
      resolved_at=case when coalesce(p_payload->>'status',status)='resolved' then coalesce(resolved_at,now()) else null end,updated_by=auth.uid(),updated_at=now() where id=v_id;
  end if;
  perform public.platform_insert_audit_v1(null,'platform','incident.upsert','platform_incident',v_id::text,null,p_payload,jsonb_build_object('reason',p_reason));
  return v_id;
end; $$;

create or replace function public.platform_add_incident_update_v33(p_incident_id uuid,p_status text,p_message text,p_is_public boolean default true)
returns uuid language plpgsql security definer set search_path=public,auth as $$
declare v_id uuid;
begin
  perform public.phase33_assert_platform_v33('platform.incidents.manage');
  insert into public.platform_incident_updates(incident_id,status,message,is_public,created_by) values(p_incident_id,p_status,p_message,p_is_public,auth.uid()) returning id into v_id;
  update public.platform_incidents set status=p_status,identified_at=case when p_status in ('identified','monitoring','resolved') then coalesce(identified_at,now()) else identified_at end,resolved_at=case when p_status='resolved' then now() else resolved_at end,updated_by=auth.uid(),updated_at=now() where id=p_incident_id;
  return v_id;
end; $$;

create or replace function public.public_status_snapshot_v33()
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'overallStatus',coalesce((select status from public.platform_health_snapshots order by created_at desc limit 1),'operational'),
    'updatedAt',coalesce((select created_at from public.platform_health_snapshots order by created_at desc limit 1),now()),
    'components',coalesce((select jsonb_agg(jsonb_build_object('code',code,'name',name,'description',description,'status',status,'lastCheckedAt',last_checked_at,'message',last_message) order by sort_order) from public.platform_service_components where is_public),'[]'::jsonb),
    'incidents',coalesce((select jsonb_agg(jsonb_build_object('incidentNumber',incident_number,'title',title,'summary',summary,'severity',severity,'status',status,'impact',impact,'startedAt',started_at,'resolvedAt',resolved_at,
      'updates',coalesce((select jsonb_agg(jsonb_build_object('status',u.status,'message',u.message,'createdAt',u.created_at) order by u.created_at desc) from public.platform_incident_updates u where u.incident_id=i.id and u.is_public),'[]'::jsonb)) order by started_at desc)
      from (select * from public.platform_incidents where is_public and started_at>now()-interval '90 days' order by started_at desc limit 20) i),'[]'::jsonb),
    'maintenance',coalesce((select jsonb_agg(jsonb_build_object('title',title,'description',description,'status',status,'startsAt',starts_at,'endsAt',ends_at,'components',affected_component_codes) order by starts_at) from public.platform_maintenance_windows where is_public and status in ('scheduled','in_progress') and ends_at>now()-interval '1 day'),'[]'::jsonb)
  );
$$;

create or replace function public.platform_get_continuity_v33(p_organization_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public,auth as $$
begin
  perform public.phase33_assert_platform_v33('platform.retention.view');
  return jsonb_build_object(
    'policies',coalesce((select jsonb_agg(jsonb_build_object('organizationId',c.organization_id,'organizationName',o.name,'rpoMinutes',c.rpo_minutes,'rtoMinutes',c.rto_minutes,'verificationFrequencyDays',c.backup_verification_frequency_days,'lastVerifiedBackupAt',c.last_verified_backup_at,'nextVerificationAt',c.next_verification_at,'continuityOwnerEmail',c.continuity_owner_email,'notes',c.notes) order by o.name) from public.organization_continuity_policies c join public.organizations o on o.id=c.organization_id where p_organization_id is null or c.organization_id=p_organization_id),'[]'::jsonb),
    'verifications',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'organizationId',v.organization_id,'organizationName',o.name,'backupJobId',v.backup_job_id,'verificationType',v.verification_type,'status',v.status,'checks',v.checks,'errorMessage',v.error_message,'startedAt',v.started_at,'completedAt',v.completed_at) order by v.started_at desc) from (select * from public.backup_verification_runs where p_organization_id is null or organization_id=p_organization_id order by started_at desc limit 100) v join public.organizations o on o.id=v.organization_id),'[]'::jsonb)
  );
end; $$;

create or replace function public.platform_upsert_continuity_policy_v33(p_organization_id uuid,p_payload jsonb,p_reason text)
returns void language plpgsql security definer set search_path=public,auth as $$
begin
  perform public.phase33_assert_platform_v33('platform.retention.manage');
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'JUSTIFICATION_REQUIRED'; end if;
  insert into public.organization_continuity_policies(organization_id,rpo_minutes,rto_minutes,backup_verification_frequency_days,require_restore_approval,require_two_person_approval,continuity_owner_email,notes,updated_by,next_verification_at)
  values(p_organization_id,coalesce((p_payload->>'rpoMinutes')::int,1440),coalesce((p_payload->>'rtoMinutes')::int,480),coalesce((p_payload->>'verificationFrequencyDays')::int,30),coalesce((p_payload->>'requireRestoreApproval')::boolean,true),coalesce((p_payload->>'requireTwoPersonApproval')::boolean,true),p_payload->>'continuityOwnerEmail',p_payload->>'notes',auth.uid(),now()+make_interval(days=>coalesce((p_payload->>'verificationFrequencyDays')::int,30)))
  on conflict(organization_id) do update set rpo_minutes=excluded.rpo_minutes,rto_minutes=excluded.rto_minutes,backup_verification_frequency_days=excluded.backup_verification_frequency_days,require_restore_approval=excluded.require_restore_approval,require_two_person_approval=excluded.require_two_person_approval,continuity_owner_email=excluded.continuity_owner_email,notes=excluded.notes,updated_by=auth.uid(),updated_at=now();
  perform public.platform_insert_audit_v1(p_organization_id,'platform','continuity.policy.updated','organization_continuity_policy',p_organization_id::text,null,p_payload,jsonb_build_object('reason',p_reason));
end; $$;

create or replace function public.platform_verify_backup_metadata_v33(p_backup_job_id uuid)
returns jsonb language plpgsql security definer set search_path=public,auth,storage as $$
declare b public.organization_backup_jobs%rowtype; v_id uuid; v_checks jsonb; v_status text; v_exists boolean;
begin
  perform public.phase33_assert_platform_v33('platform.retention.manage');
  select * into b from public.organization_backup_jobs where id=p_backup_job_id;
  if not found then raise exception 'BACKUP_NOT_FOUND'; end if;
  select exists(select 1 from storage.objects where bucket_id='organization-backups' and name=b.storage_path) into v_exists;
  v_checks:=jsonb_build_array(
    jsonb_build_object('code','status_completed','passed',b.status='completed','detail',b.status),
    jsonb_build_object('code','storage_object','passed',v_exists,'detail',b.storage_path),
    jsonb_build_object('code','checksum_present','passed',coalesce(length(b.checksum),0)>=32,'detail',coalesce(b.checksum,'missing')),
    jsonb_build_object('code','manifest_present','passed',b.manifest<>'{}'::jsonb,'detail',jsonb_object_length(coalesce(b.manifest,'{}'::jsonb)))
  );
  v_status:=case when b.status='completed' and v_exists and coalesce(length(b.checksum),0)>=32 and b.manifest<>'{}'::jsonb then 'passed' when b.status='completed' then 'warning' else 'failed' end;
  insert into public.backup_verification_runs(organization_id,backup_job_id,verification_type,status,checks,error_message,initiated_by,completed_at)
  values(b.organization_id,b.id,'metadata',v_status,v_checks,case when v_status='failed' then 'El backup no cumple los controles mínimos.' end,auth.uid(),now()) returning id into v_id;
  update public.organization_continuity_policies set last_verified_backup_at=case when v_status='passed' then now() else last_verified_backup_at end,next_verification_at=now()+make_interval(days=>backup_verification_frequency_days),updated_at=now() where organization_id=b.organization_id;
  return jsonb_build_object('id',v_id,'status',v_status,'checks',v_checks);
end; $$;

create or replace function public.platform_list_privacy_requests_v33(p_organization_id uuid default null,p_status text default null)
returns jsonb language plpgsql stable security definer set search_path=public,auth as $$
begin
  perform public.phase33_assert_platform_v33('platform.privacy.view');
  return coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'requestNumber',r.request_number,'organizationId',r.organization_id,'organizationName',o.name,'requestType',r.request_type,'status',r.status,'priority',r.priority,'requesterName',r.requester_name,'requesterEmail',r.requester_email,'requesterDocument',r.requester_document,'description',r.description,'legalBasis',r.legal_basis,'dueAt',r.due_at,'identityVerifiedAt',r.identity_verified_at,'assignedTo',r.assigned_to,'decision',r.decision,'decisionReason',r.decision_reason,'evidence',r.evidence,'completedAt',r.completed_at,'createdAt',r.created_at,'updatedAt',r.updated_at) order by r.created_at desc) from public.privacy_requests r join public.organizations o on o.id=r.organization_id where (p_organization_id is null or r.organization_id=p_organization_id) and (p_status is null or r.status=p_status)),'[]'::jsonb);
end; $$;

create or replace function public.platform_upsert_privacy_request_v33(p_payload jsonb,p_reason text)
returns uuid language plpgsql security definer set search_path=public,auth as $$
declare v_id uuid; v_org uuid; v_before jsonb;
begin
  perform public.phase33_assert_platform_v33('platform.privacy.manage');
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'JUSTIFICATION_REQUIRED'; end if;
  v_id:=nullif(p_payload->>'id','')::uuid; v_org:=nullif(p_payload->>'organizationId','')::uuid;
  if v_id is null then
    insert into public.privacy_requests(request_number,organization_id,request_type,status,priority,requester_name,requester_email,requester_document,description,legal_basis,due_at,assigned_to,created_by,updated_by)
    values('PRV-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('public.privacy_request_counter_seq')::text,6,'0'),v_org,p_payload->>'requestType',coalesce(p_payload->>'status','received'),coalesce(p_payload->>'priority','normal'),p_payload->>'requesterName',p_payload->>'requesterEmail',p_payload->>'requesterDocument',p_payload->>'description',p_payload->>'legalBasis',coalesce((p_payload->>'dueAt')::timestamptz,now()+interval '15 days'),nullif(p_payload->>'assignedTo','')::uuid,auth.uid(),auth.uid()) returning id into v_id;
  else
    select to_jsonb(r),r.organization_id into v_before,v_org from public.privacy_requests r where id=v_id;
    update public.privacy_requests set status=coalesce(p_payload->>'status',status),priority=coalesce(p_payload->>'priority',priority),assigned_to=coalesce(nullif(p_payload->>'assignedTo','')::uuid,assigned_to),due_at=coalesce((p_payload->>'dueAt')::timestamptz,due_at),identity_verified_at=case when coalesce((p_payload->>'identityVerified')::boolean,false) then coalesce(identity_verified_at,now()) else identity_verified_at end,decision=coalesce(p_payload->>'decision',decision),decision_reason=coalesce(p_payload->>'decisionReason',decision_reason),evidence=case when p_payload?'evidence' then p_payload->'evidence' else evidence end,completed_at=case when coalesce(p_payload->>'status',status)='completed' then coalesce(completed_at,now()) else completed_at end,updated_by=auth.uid(),updated_at=now() where id=v_id;
  end if;
  insert into public.privacy_request_events(request_id,organization_id,actor_user_id,event_type,message,before_data,after_data) select v_id,v_org,auth.uid(),'updated',p_reason,v_before,to_jsonb(r) from public.privacy_requests r where r.id=v_id;
  return v_id;
end; $$;

create or replace function public.organization_create_privacy_request_v33(p_request_type text,p_requester_name text,p_requester_email text,p_requester_document text,p_description text)
returns uuid language plpgsql security definer set search_path=public,auth as $$
declare v_org uuid:=public.platform_current_organization_id_v1(); v_id uuid;
begin
  if v_org is null or not public.platform_member_has_permission_v1(v_org,'privacy.manage') then raise exception 'PERMISSION_DENIED' using errcode='42501'; end if;
  insert into public.privacy_requests(request_number,organization_id,request_type,requester_name,requester_email,requester_document,description,created_by,updated_by)
  values('PRV-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('public.privacy_request_counter_seq')::text,6,'0'),v_org,p_request_type,p_requester_name,p_requester_email,p_requester_document,p_description,auth.uid(),auth.uid()) returning id into v_id;
  return v_id;
end; $$;

create or replace function public.organization_list_privacy_requests_v33()
returns jsonb language plpgsql stable security definer set search_path=public,auth as $$
declare v_org uuid:=public.platform_current_organization_id_v1();
begin
  if v_org is null or not public.platform_member_has_permission_v1(v_org,'privacy.view') then raise exception 'PERMISSION_DENIED' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',id,'requestNumber',request_number,'requestType',request_type,'status',status,'priority',priority,'requesterName',requester_name,'requesterEmail',requester_email,'description',description,'dueAt',due_at,'decision',decision,'decisionReason',decision_reason,'createdAt',created_at,'updatedAt',updated_at) order by created_at desc) from public.privacy_requests where organization_id=v_org),'[]'::jsonb);
end; $$;

create or replace function public.platform_get_retention_v33(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,auth as $$
begin
  perform public.phase33_assert_platform_v33('platform.retention.view');
  return jsonb_build_object(
    'policies',coalesce((select jsonb_agg(jsonb_build_object('id',id,'dataDomain',data_domain,'retentionDays',retention_days,'action',action,'legalHoldRespected',legal_hold_respected,'enabled',enabled,'requireApproval',require_approval,'lastPreviewAt',last_preview_at,'lastExecutionAt',last_execution_at) order by data_domain) from public.organization_retention_policies where organization_id=p_organization_id),'[]'::jsonb),
    'runs',coalesce((select jsonb_agg(jsonb_build_object('id',id,'mode',mode,'status',status,'results',results,'reason',reason,'startedAt',started_at,'completedAt',completed_at) order by started_at desc) from (select * from public.retention_runs where organization_id=p_organization_id order by started_at desc limit 50) x),'[]'::jsonb)
  );
end; $$;

create or replace function public.platform_upsert_retention_policy_v33(p_organization_id uuid,p_payload jsonb,p_reason text)
returns uuid language plpgsql security definer set search_path=public,auth as $$
declare v_id uuid;
begin
  perform public.phase33_assert_platform_v33('platform.retention.manage');
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'JUSTIFICATION_REQUIRED'; end if;
  insert into public.organization_retention_policies(organization_id,data_domain,retention_days,action,legal_hold_respected,enabled,require_approval,updated_by)
  values(p_organization_id,p_payload->>'dataDomain',(p_payload->>'retentionDays')::int,coalesce(p_payload->>'action','review'),coalesce((p_payload->>'legalHoldRespected')::boolean,true),coalesce((p_payload->>'enabled')::boolean,true),coalesce((p_payload->>'requireApproval')::boolean,true),auth.uid())
  on conflict(organization_id,data_domain) do update set retention_days=excluded.retention_days,action=excluded.action,legal_hold_respected=excluded.legal_hold_respected,enabled=excluded.enabled,require_approval=excluded.require_approval,updated_by=auth.uid(),updated_at=now() returning id into v_id;
  perform public.platform_insert_audit_v1(p_organization_id,'platform','retention.policy.updated','organization_retention_policy',v_id::text,null,p_payload,jsonb_build_object('reason',p_reason));
  return v_id;
end; $$;

create or replace function public.platform_preview_retention_v33(p_organization_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare v_results jsonb; v_id uuid;
begin
  perform public.phase33_assert_platform_v33('platform.retention.manage');
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'JUSTIFICATION_REQUIRED'; end if;
  select coalesce(jsonb_object_agg(p.data_domain,case p.data_domain
    when 'cases' then (select count(*) from public.cases c where c.organization_id=p_organization_id and c.created_at<now()-make_interval(days=>p.retention_days) and c.deleted_at is not null)
    when 'documents' then (select count(*) from public.case_documents d where d.organization_id=p_organization_id and d.created_at<now()-make_interval(days=>p.retention_days) and d.deleted_at is not null and not d.legal_hold)
    when 'audit' then (select count(*) from public.platform_audit_events a where a.organization_id=p_organization_id and a.created_at<now()-make_interval(days=>p.retention_days))
    when 'emails' then (select count(*) from public.email_queue e where e.organization_id=p_organization_id and e.created_at<now()-make_interval(days=>p.retention_days) and e.status in ('dispatched','failed','dead_letter'))
    when 'technical_logs' then (select count(*) from public.app_error_logs e where e.organization_id=p_organization_id and e.created_at<now()-make_interval(days=>p.retention_days) and e.resolved_at is not null)
    when 'backups' then (select count(*) from public.organization_backup_jobs b where b.organization_id=p_organization_id and b.created_at<now()-make_interval(days=>p.retention_days) and b.status in ('completed','failed','cancelled'))
    when 'tickets' then (select count(*) from public.support_tickets t where t.organization_id=p_organization_id and t.created_at<now()-make_interval(days=>p.retention_days) and t.status in ('closed','cancelled'))
    when 'commercial' then (select count(*) from public.commercial_events e where e.organization_id=p_organization_id and e.created_at<now()-make_interval(days=>p.retention_days))
    when 'integration_logs' then (select count(*) from public.integration_api_request_logs l where l.organization_id=p_organization_id and l.created_at<now()-make_interval(days=>p.retention_days))
    else 0 end),'{}'::jsonb) into v_results from public.organization_retention_policies p where p.organization_id=p_organization_id and p.enabled;
  insert into public.retention_runs(organization_id,mode,status,results,reason,requested_by,completed_at) values(p_organization_id,'preview','completed',coalesce(v_results,'{}'::jsonb),p_reason,auth.uid(),now()) returning id into v_id;
  update public.organization_retention_policies set last_preview_at=now(),updated_at=now() where organization_id=p_organization_id;
  return jsonb_build_object('id',v_id,'mode','preview','results',coalesce(v_results,'{}'::jsonb),'notice','La Fase 3.3 no elimina datos automáticamente. La ejecución destructiva requiere revisión y aprobación externa.');
end; $$;

create or replace function public.platform_get_capacity_v33()
returns jsonb language plpgsql stable security definer set search_path=public,auth as $$
begin
  perform public.phase33_assert_platform_v33('platform.capacity.view');
  return jsonb_build_object(
    'current',coalesce((select jsonb_build_object('organizationsTotal',organizations_total,'usersTotal',users_total,'casesTotal',cases_total,'storageBytes',storage_bytes,'apiRequests24h',api_requests_24h,'emailsQueued',emails_queued,'jobsFailed24h',jobs_failed_24h,'growth',growth,'metadata',metadata,'createdAt',created_at) from public.platform_capacity_snapshots order by created_at desc limit 1),'{}'::jsonb),
    'history',coalesce((select jsonb_agg(jsonb_build_object('organizationsTotal',organizations_total,'usersTotal',users_total,'casesTotal',cases_total,'storageBytes',storage_bytes,'apiRequests24h',api_requests_24h,'emailsQueued',emails_queued,'jobsFailed24h',jobs_failed_24h,'createdAt',created_at) order by created_at) from (select * from public.platform_capacity_snapshots order by created_at desc limit 90) x),'[]'::jsonb),
    'organizations',coalesce((select jsonb_agg(jsonb_build_object('organizationId',u.organization_id,'organizationName',o.name,'snapshotDate',u.snapshot_date,'usersTotal',u.users_total,'usersActive',u.users_active,'casesTotal',u.cases_total,'storageBytes',u.storage_bytes,'emailsSent',u.emails_sent,'automationsExecuted',u.automations_executed) order by u.storage_bytes desc) from public.organization_usage_snapshots u join public.organizations o on o.id=u.organization_id where u.snapshot_date=(select max(snapshot_date) from public.organization_usage_snapshots)),'[]'::jsonb)
  );
end; $$;

create or replace function public.platform_get_security_posture_v33()
returns jsonb language plpgsql stable security definer set search_path=public,auth as $$
declare v_score integer;
begin
  perform public.phase33_assert_platform_v33('platform.security_posture.view');
  select greatest(0,100-coalesce(sum(case severity when 'critical' then 25 when 'high' then 15 when 'medium' then 8 when 'low' then 3 else 1 end),0)::int) into v_score from public.platform_security_findings where status='open';
  return jsonb_build_object('score',v_score,'open',(select count(*) from public.platform_security_findings where status='open'),'findings',coalesce((select jsonb_agg(jsonb_build_object('id',id,'findingKey',finding_key,'organizationId',organization_id,'category',category,'severity',severity,'title',title,'description',description,'recommendation',recommendation,'status',status,'source',source,'evidence',evidence,'firstSeenAt',first_seen_at,'lastSeenAt',last_seen_at,'resolvedAt',resolved_at,'resolutionNotes',resolution_notes) order by case severity when 'critical' then 1 when 'high' then 2 when 'medium' then 3 when 'low' then 4 else 5 end,last_seen_at desc) from public.platform_security_findings),'[]'::jsonb));
end; $$;

create or replace function public.platform_resolve_security_finding_v33(p_finding_id uuid,p_status text,p_notes text)
returns void language plpgsql security definer set search_path=public,auth as $$
begin
  perform public.phase33_assert_platform_v33('platform.security_posture.manage');
  if p_status not in ('accepted','resolved','false_positive') then raise exception 'INVALID_STATUS'; end if;
  update public.platform_security_findings set status=p_status,resolved_at=now(),resolved_by=auth.uid(),resolution_notes=p_notes,updated_at=now() where id=p_finding_id;
end; $$;

create or replace function public.platform_get_regional_settings_v33(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,auth as $$
begin
  perform public.phase33_assert_platform_v33('platform.regional.manage');
  return coalesce((select jsonb_build_object('organizationId',r.organization_id,'organizationName',o.name,'locale',r.locale,'language',r.language,'countryCode',r.country_code,'timezone',r.timezone,'currency',r.currency,'dateFormat',r.date_format,'timeFormat',r.time_format,'firstDayOfWeek',r.first_day_of_week,'businessDays',r.business_days,'translations',r.translations,'updatedAt',r.updated_at) from public.organization_regional_settings r join public.organizations o on o.id=r.organization_id where r.organization_id=p_organization_id),'{}'::jsonb);
end; $$;

create or replace function public.platform_upsert_regional_settings_v33(p_organization_id uuid,p_payload jsonb,p_reason text)
returns void language plpgsql security definer set search_path=public,auth as $$
begin
  perform public.phase33_assert_platform_v33('platform.regional.manage');
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'JUSTIFICATION_REQUIRED'; end if;
  insert into public.organization_regional_settings(organization_id,locale,language,country_code,timezone,currency,date_format,time_format,first_day_of_week,business_days,translations,updated_by)
  values(p_organization_id,coalesce(p_payload->>'locale','es-CO'),coalesce(p_payload->>'language','es'),coalesce(p_payload->>'countryCode','CO'),coalesce(p_payload->>'timezone','America/Bogota'),coalesce(p_payload->>'currency','COP'),coalesce(p_payload->>'dateFormat','DD/MM/YYYY'),coalesce(p_payload->>'timeFormat','12h'),coalesce((p_payload->>'firstDayOfWeek')::smallint,1),coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'businessDays','[1,2,3,4,5]'::jsonb))::smallint),array[1,2,3,4,5]::smallint[]),coalesce(p_payload->'translations','{}'::jsonb),auth.uid())
  on conflict(organization_id) do update set locale=excluded.locale,language=excluded.language,country_code=excluded.country_code,timezone=excluded.timezone,currency=excluded.currency,date_format=excluded.date_format,time_format=excluded.time_format,first_day_of_week=excluded.first_day_of_week,business_days=excluded.business_days,translations=excluded.translations,updated_by=auth.uid(),updated_at=now();
  perform public.platform_insert_audit_v1(p_organization_id,'platform','regional.updated','organization_regional_settings',p_organization_id::text,null,p_payload,jsonb_build_object('reason',p_reason));
end; $$;

create or replace function public.organization_get_regional_settings_v33()
returns jsonb language plpgsql stable security definer set search_path=public,auth as $$
declare v_org uuid:=public.platform_current_organization_id_v1();
begin
  if v_org is null or not public.platform_member_has_permission_v1(v_org,'regional.view') then raise exception 'PERMISSION_DENIED' using errcode='42501'; end if;
  return coalesce((select jsonb_build_object('organizationId',organization_id,'locale',locale,'language',language,'countryCode',country_code,'timezone',timezone,'currency',currency,'dateFormat',date_format,'timeFormat',time_format,'firstDayOfWeek',first_day_of_week,'businessDays',business_days,'translations',translations,'updatedAt',updated_at) from public.organization_regional_settings where organization_id=v_org),'{}'::jsonb);
end; $$;

create or replace function public.organization_update_regional_settings_v33(p_payload jsonb)
returns void language plpgsql security definer set search_path=public,auth as $$
declare v_org uuid:=public.platform_current_organization_id_v1();
begin
  if v_org is null or not public.platform_member_has_permission_v1(v_org,'regional.manage') then raise exception 'PERMISSION_DENIED' using errcode='42501'; end if;
  insert into public.organization_regional_settings(organization_id,locale,language,country_code,timezone,currency,date_format,time_format,first_day_of_week,business_days,translations,updated_by)
  values(v_org,coalesce(p_payload->>'locale','es-CO'),coalesce(p_payload->>'language','es'),coalesce(p_payload->>'countryCode','CO'),coalesce(p_payload->>'timezone','America/Bogota'),coalesce(p_payload->>'currency','COP'),coalesce(p_payload->>'dateFormat','DD/MM/YYYY'),coalesce(p_payload->>'timeFormat','12h'),coalesce((p_payload->>'firstDayOfWeek')::smallint,1),coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'businessDays','[1,2,3,4,5]'::jsonb))::smallint),array[1,2,3,4,5]::smallint[]),coalesce(p_payload->'translations','{}'::jsonb),auth.uid())
  on conflict(organization_id) do update set locale=excluded.locale,language=excluded.language,country_code=excluded.country_code,timezone=excluded.timezone,currency=excluded.currency,date_format=excluded.date_format,time_format=excluded.time_format,first_day_of_week=excluded.first_day_of_week,business_days=excluded.business_days,translations=excluded.translations,updated_by=auth.uid(),updated_at=now();
end; $$;


create or replace function public.platform_upsert_service_component_v33(p_payload jsonb,p_reason text)
returns uuid language plpgsql security definer set search_path=public,auth as $$
declare v_id uuid;
begin
  perform public.phase33_assert_platform_v33('platform.health.manage');
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'JUSTIFICATION_REQUIRED'; end if;
  v_id:=nullif(p_payload->>'id','')::uuid;
  if v_id is null then
    insert into public.platform_service_components(code,name,description,component_type,status,is_public,sort_order,metadata)
    values(lower(regexp_replace(p_payload->>'code','[^a-zA-Z0-9]+','_','g')),p_payload->>'name',p_payload->>'description',coalesce(p_payload->>'componentType','application'),coalesce(p_payload->>'status','operational'),coalesce((p_payload->>'isPublic')::boolean,true),coalesce((p_payload->>'sortOrder')::int,0),coalesce(p_payload->'metadata','{}'::jsonb)) returning id into v_id;
  else
    update public.platform_service_components set name=coalesce(p_payload->>'name',name),description=coalesce(p_payload->>'description',description),component_type=coalesce(p_payload->>'componentType',component_type),status=coalesce(p_payload->>'status',status),is_public=coalesce((p_payload->>'isPublic')::boolean,is_public),sort_order=coalesce((p_payload->>'sortOrder')::int,sort_order),last_message=coalesce(p_payload->>'lastMessage',last_message),metadata=case when p_payload?'metadata' then p_payload->'metadata' else metadata end,updated_at=now() where id=v_id;
  end if;
  perform public.platform_insert_audit_v1(null,'platform','health.component.updated','platform_service_component',v_id::text,null,p_payload,jsonb_build_object('reason',p_reason));
  return v_id;
end; $$;

create or replace function public.platform_upsert_maintenance_v33(p_payload jsonb,p_reason text)
returns uuid language plpgsql security definer set search_path=public,auth as $$
declare v_id uuid;
begin
  perform public.phase33_assert_platform_v33('platform.health.manage');
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'JUSTIFICATION_REQUIRED'; end if;
  v_id:=nullif(p_payload->>'id','')::uuid;
  if v_id is null then
    insert into public.platform_maintenance_windows(title,description,status,affected_component_codes,affected_organization_ids,is_public,starts_at,ends_at,created_by,updated_by)
    values(p_payload->>'title',p_payload->>'description',coalesce(p_payload->>'status','scheduled'),coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'affectedComponentCodes','[]'::jsonb))),'{}'::text[]),coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'affectedOrganizationIds','[]'::jsonb))::uuid),'{}'::uuid[]),coalesce((p_payload->>'isPublic')::boolean,true),(p_payload->>'startsAt')::timestamptz,(p_payload->>'endsAt')::timestamptz,auth.uid(),auth.uid()) returning id into v_id;
  else
    update public.platform_maintenance_windows set title=coalesce(p_payload->>'title',title),description=coalesce(p_payload->>'description',description),status=coalesce(p_payload->>'status',status),affected_component_codes=case when p_payload?'affectedComponentCodes' then array(select jsonb_array_elements_text(p_payload->'affectedComponentCodes')) else affected_component_codes end,affected_organization_ids=case when p_payload?'affectedOrganizationIds' then array(select jsonb_array_elements_text(p_payload->'affectedOrganizationIds')::uuid) else affected_organization_ids end,is_public=coalesce((p_payload->>'isPublic')::boolean,is_public),starts_at=coalesce((p_payload->>'startsAt')::timestamptz,starts_at),ends_at=coalesce((p_payload->>'endsAt')::timestamptz,ends_at),updated_by=auth.uid(),updated_at=now() where id=v_id;
  end if;
  perform public.platform_insert_audit_v1(null,'platform','maintenance.updated','platform_maintenance_window',v_id::text,null,p_payload,jsonb_build_object('reason',p_reason));
  return v_id;
end; $$;

create or replace function public.platform_phase33_scheduler_tick_v33()
returns jsonb language plpgsql security definer set search_path=public,auth,storage as $$
declare v_errors bigint; v_email_failed bigint; v_auto_failed bigint; v_jobs_failed bigint; v_backups_failed bigint; v_api_failed bigint; v_score integer; v_status text; v_components jsonb; v_capacity_id bigint; v_health_id bigint; v_verifications integer:=0; rec record;
begin
  if not public.platform_is_service_role_v2() and not public.platform_is_admin_v2('platform.operations.manage') then raise exception 'PLATFORM_ACCESS_DENIED' using errcode='42501'; end if;
  select count(*) into v_errors from public.app_error_logs where resolved_at is null and severity in ('error','fatal') and created_at>now()-interval '24 hours';
  select count(*) into v_email_failed from public.email_queue where status in ('failed','dead_letter') and created_at>now()-interval '24 hours';
  select count(*) into v_auto_failed from public.automation_executions where status='failed' and started_at>now()-interval '24 hours';
  select count(*) into v_jobs_failed from public.platform_job_runs where status='failed' and started_at>now()-interval '24 hours';
  select count(*) into v_backups_failed from public.organization_backup_jobs where status='failed' and created_at>now()-interval '24 hours';
  select count(*) into v_api_failed from public.integration_api_request_logs where status_code>=500 and created_at>now()-interval '24 hours';
  v_score:=greatest(0,100-least(40,v_errors::int*5)-least(20,v_email_failed::int*2)-least(15,v_auto_failed::int*3)-least(15,v_jobs_failed::int*3)-least(10,v_backups_failed::int*5));
  v_status:=case when v_score>=90 then 'operational' when v_score>=70 then 'degraded' when v_score>=40 then 'partial_outage' else 'major_outage' end;
  update public.platform_maintenance_windows set status='in_progress',updated_at=now() where status='scheduled' and starts_at<=now() and ends_at>now();
  update public.platform_maintenance_windows set status='completed',updated_at=now() where status in ('scheduled','in_progress') and ends_at<=now();
  update public.platform_service_components set status=case when code='email' and v_email_failed>0 then 'degraded' when code='scheduler' and v_jobs_failed>0 then 'degraded' when code='integrations' and (v_api_failed>0) then 'degraded' when code='storage' and v_backups_failed>0 then 'degraded' when code in ('web_app','database') and v_errors>3 then 'degraded' else 'operational' end,last_checked_at=now(),last_message=case when code='email' and v_email_failed>0 then v_email_failed||' fallos de correo en 24h' when code='scheduler' and v_jobs_failed>0 then v_jobs_failed||' trabajos fallidos en 24h' when code='integrations' and v_api_failed>0 then v_api_failed||' respuestas 5xx de API en 24h' when code='storage' and v_backups_failed>0 then v_backups_failed||' backups fallidos en 24h' when code in ('web_app','database') and v_errors>3 then v_errors||' errores no resueltos en 24h' else 'Sin alertas automáticas' end,updated_at=now();
  select coalesce(jsonb_agg(jsonb_build_object('code',code,'name',name,'status',status,'message',last_message,'lastCheckedAt',last_checked_at) order by sort_order),'[]'::jsonb) into v_components from public.platform_service_components;
  insert into public.platform_health_snapshots(status,health_score,components,metrics) values(v_status,v_score,v_components,jsonb_build_object('unresolvedErrors24h',v_errors,'failedEmails24h',v_email_failed,'failedAutomations24h',v_auto_failed,'failedJobs24h',v_jobs_failed,'failedBackups24h',v_backups_failed,'api5xx24h',v_api_failed)) returning id into v_health_id;
  insert into public.platform_capacity_snapshots(organizations_total,users_total,cases_total,storage_bytes,api_requests_24h,emails_queued,jobs_failed_24h,growth,metadata)
  select (select count(*) from public.organizations),(select count(*) from public.profiles),(select count(*) from public.cases where deleted_at is null),coalesce((select sum(size_bytes) from public.document_versions),0),
    (select count(*) from public.integration_api_request_logs where created_at>now()-interval '24 hours'),(select count(*) from public.email_queue where status in ('queued','dispatching')),
    v_jobs_failed,jsonb_build_object('cases30d',(select count(*) from public.cases where created_at>now()-interval '30 days'),'users30d',(select count(*) from public.profiles where created_at>now()-interval '30 days')),
    jsonb_build_object('generatedAt',now()) returning id into v_capacity_id;
  update public.privacy_requests set priority='urgent',updated_at=now() where status not in ('completed','cancelled','rejected') and due_at<now() and priority<>'urgent';
  -- Hallazgos automáticos no destructivos.
  if exists(select 1 from public.platform_security_settings where not enforce_mfa) then
    insert into public.platform_security_findings(finding_key,category,severity,title,description,recommendation,evidence)
    values('global:mfa-not-enforced','identity','high','MFA global no obligatorio','La configuración global no obliga MFA para todos los operadores de plataforma.','Active MFA obligatorio después de enrolar las cuentas administrativas.',jsonb_build_object('setting','enforce_mfa'))
    on conflict(finding_key) do update set status=case when platform_security_findings.status='resolved' then 'open' else platform_security_findings.status end,last_seen_at=now(),updated_at=now();
  end if;
  if v_errors>0 then
    insert into public.platform_security_findings(finding_key,category,severity,title,description,recommendation,evidence)
    values('global:unresolved-fatal-errors','monitoring',case when v_errors>10 then 'high' else 'medium' end,'Errores críticos sin resolver','Existen errores técnicos no resueltos durante las últimas 24 horas.','Revise Operación técnica y documente la resolución.',jsonb_build_object('count',v_errors))
    on conflict(finding_key) do update set severity=excluded.severity,description=excluded.description,evidence=excluded.evidence,status=case when platform_security_findings.status='resolved' then 'open' else platform_security_findings.status end,last_seen_at=now(),updated_at=now();
  end if;
  for rec in select c.organization_id,b.id backup_job_id from public.organization_continuity_policies c join lateral (select id from public.organization_backup_jobs b where b.organization_id=c.organization_id and b.status='completed' order by b.completed_at desc limit 1) b on true where c.next_verification_at is null or c.next_verification_at<=now() loop
    perform public.platform_verify_backup_metadata_v33(rec.backup_job_id); v_verifications:=v_verifications+1;
  end loop;
  delete from public.platform_health_snapshots where created_at<now()-interval '400 days';
  delete from public.platform_capacity_snapshots where created_at<now()-interval '400 days';
  return jsonb_build_object('healthSnapshotId',v_health_id,'capacitySnapshotId',v_capacity_id,'healthScore',v_score,'status',v_status,'backupVerifications',v_verifications,'generatedAt',now());
end; $$;

-- ---------------------------------------------------------------------------
-- Triggers, RLS y privilegios
-- ---------------------------------------------------------------------------
do $$ declare tbl text; begin
  foreach tbl in array array['platform_service_components','platform_incidents','platform_maintenance_windows','organization_continuity_policies','privacy_requests','organization_retention_policies','platform_security_findings','organization_regional_settings'] loop
    execute format('drop trigger if exists trg_%I_touch_updated_at on public.%I',tbl,tbl);
    execute format('create trigger trg_%I_touch_updated_at before update on public.%I for each row execute function public.platform_touch_updated_at_v1()',tbl,tbl);
  end loop;
  foreach tbl in array array['platform_service_components','platform_incidents','platform_incident_updates','platform_maintenance_windows','organization_continuity_policies','backup_verification_runs','privacy_requests','privacy_request_events','organization_retention_policies','retention_runs','platform_security_findings','organization_regional_settings'] loop
    execute format('drop trigger if exists trg_platform_audit_%I on public.%I',tbl,tbl);
    execute format('create trigger trg_platform_audit_%I after insert or update or delete on public.%I for each row execute function public.platform_capture_row_change_v1(''direct'')',tbl,tbl);
  end loop;
end $$;

alter table public.platform_service_components enable row level security;
alter table public.platform_health_snapshots enable row level security;
alter table public.platform_incidents enable row level security;
alter table public.platform_incident_updates enable row level security;
alter table public.platform_maintenance_windows enable row level security;
alter table public.organization_continuity_policies enable row level security;
alter table public.backup_verification_runs enable row level security;
alter table public.privacy_requests enable row level security;
alter table public.privacy_request_events enable row level security;
alter table public.organization_retention_policies enable row level security;
alter table public.retention_runs enable row level security;
alter table public.platform_capacity_snapshots enable row level security;
alter table public.platform_security_findings enable row level security;
alter table public.organization_regional_settings enable row level security;

drop policy if exists phase33_health_components_select on public.platform_service_components;
create policy phase33_health_components_select on public.platform_service_components for select to authenticated using(public.platform_is_admin_v2('platform.health.view'));
drop policy if exists phase33_health_snapshots_select on public.platform_health_snapshots;
create policy phase33_health_snapshots_select on public.platform_health_snapshots for select to authenticated using(public.platform_is_admin_v2('platform.health.view'));
drop policy if exists phase33_incidents_select on public.platform_incidents;
create policy phase33_incidents_select on public.platform_incidents for select to authenticated using(public.platform_is_admin_v2('platform.incidents.view'));
drop policy if exists phase33_incident_updates_select on public.platform_incident_updates;
create policy phase33_incident_updates_select on public.platform_incident_updates for select to authenticated using(public.platform_is_admin_v2('platform.incidents.view'));
drop policy if exists phase33_maintenance_select on public.platform_maintenance_windows;
create policy phase33_maintenance_select on public.platform_maintenance_windows for select to authenticated using(public.platform_is_admin_v2('platform.health.view'));
drop policy if exists phase33_continuity_select on public.organization_continuity_policies;
create policy phase33_continuity_select on public.organization_continuity_policies for select to authenticated using(public.platform_is_admin_v2('platform.retention.view'));
drop policy if exists phase33_verifications_select on public.backup_verification_runs;
create policy phase33_verifications_select on public.backup_verification_runs for select to authenticated using(public.platform_is_admin_v2('platform.retention.view'));
drop policy if exists phase33_privacy_select on public.privacy_requests;
create policy phase33_privacy_select on public.privacy_requests for select to authenticated using(public.platform_is_admin_v2('platform.privacy.view') or (organization_id=public.platform_current_organization_id_v1() and public.platform_member_has_permission_v1(organization_id,'privacy.view')));
drop policy if exists phase33_privacy_events_select on public.privacy_request_events;
create policy phase33_privacy_events_select on public.privacy_request_events for select to authenticated using(public.platform_is_admin_v2('platform.privacy.view') or (organization_id=public.platform_current_organization_id_v1() and public.platform_member_has_permission_v1(organization_id,'privacy.view')));
drop policy if exists phase33_retention_select on public.organization_retention_policies;
create policy phase33_retention_select on public.organization_retention_policies for select to authenticated using(public.platform_is_admin_v2('platform.retention.view'));
drop policy if exists phase33_retention_runs_select on public.retention_runs;
create policy phase33_retention_runs_select on public.retention_runs for select to authenticated using(public.platform_is_admin_v2('platform.retention.view'));
drop policy if exists phase33_capacity_select on public.platform_capacity_snapshots;
create policy phase33_capacity_select on public.platform_capacity_snapshots for select to authenticated using(public.platform_is_admin_v2('platform.capacity.view'));
drop policy if exists phase33_security_findings_select on public.platform_security_findings;
create policy phase33_security_findings_select on public.platform_security_findings for select to authenticated using(public.platform_is_admin_v2('platform.security_posture.view'));
drop policy if exists phase33_regional_select on public.organization_regional_settings;
create policy phase33_regional_select on public.organization_regional_settings for select to authenticated using(public.platform_is_admin_v2('platform.regional.manage') or (organization_id=public.platform_current_organization_id_v1() and public.platform_member_has_permission_v1(organization_id,'regional.view')));

grant select on public.platform_service_components,public.platform_health_snapshots,public.platform_incidents,public.platform_incident_updates,public.platform_maintenance_windows,public.organization_continuity_policies,public.backup_verification_runs,public.privacy_requests,public.privacy_request_events,public.organization_retention_policies,public.retention_runs,public.platform_capacity_snapshots,public.platform_security_findings,public.organization_regional_settings to authenticated;
grant all on public.platform_service_components,public.platform_health_snapshots,public.platform_incidents,public.platform_incident_updates,public.platform_maintenance_windows,public.organization_continuity_policies,public.backup_verification_runs,public.privacy_requests,public.privacy_request_events,public.organization_retention_policies,public.retention_runs,public.platform_capacity_snapshots,public.platform_security_findings,public.organization_regional_settings to service_role;
grant usage,select on sequence public.platform_incident_counter_seq,public.privacy_request_counter_seq to authenticated,service_role;
grant usage,select on all sequences in schema public to service_role;

grant execute on function public.platform_get_phase33_dashboard_v33() to authenticated,service_role;
grant execute on function public.platform_list_incidents_v33(boolean) to authenticated,service_role;
grant execute on function public.platform_upsert_incident_v33(jsonb,text) to authenticated,service_role;
grant execute on function public.platform_add_incident_update_v33(uuid,text,text,boolean) to authenticated,service_role;
grant execute on function public.public_status_snapshot_v33() to anon,authenticated,service_role;
grant execute on function public.platform_get_continuity_v33(uuid) to authenticated,service_role;
grant execute on function public.platform_upsert_continuity_policy_v33(uuid,jsonb,text) to authenticated,service_role;
grant execute on function public.platform_verify_backup_metadata_v33(uuid) to authenticated,service_role;
grant execute on function public.platform_list_privacy_requests_v33(uuid,text) to authenticated,service_role;
grant execute on function public.platform_upsert_privacy_request_v33(jsonb,text) to authenticated,service_role;
grant execute on function public.organization_create_privacy_request_v33(text,text,text,text,text) to authenticated,service_role;
grant execute on function public.organization_list_privacy_requests_v33() to authenticated,service_role;
grant execute on function public.platform_get_retention_v33(uuid) to authenticated,service_role;
grant execute on function public.platform_upsert_retention_policy_v33(uuid,jsonb,text) to authenticated,service_role;
grant execute on function public.platform_preview_retention_v33(uuid,text) to authenticated,service_role;
grant execute on function public.platform_get_capacity_v33() to authenticated,service_role;
grant execute on function public.platform_get_security_posture_v33() to authenticated,service_role;
grant execute on function public.platform_resolve_security_finding_v33(uuid,text,text) to authenticated,service_role;
grant execute on function public.platform_get_regional_settings_v33(uuid) to authenticated,service_role;
grant execute on function public.platform_upsert_regional_settings_v33(uuid,jsonb,text) to authenticated,service_role;
grant execute on function public.organization_get_regional_settings_v33() to authenticated,service_role;
grant execute on function public.organization_update_regional_settings_v33(jsonb) to authenticated,service_role;
grant execute on function public.platform_upsert_service_component_v33(jsonb,text) to authenticated,service_role;
grant execute on function public.platform_upsert_maintenance_v33(jsonb,text) to authenticated,service_role;
grant execute on function public.platform_phase33_scheduler_tick_v33() to authenticated,service_role;

-- Capturas iniciales no destructivas; el Cron completará métricas detalladas.
insert into public.platform_health_snapshots(status,health_score,components,metrics,generated_by)
select 'operational',100,coalesce(jsonb_agg(jsonb_build_object('code',code,'name',name,'status',status,'message',last_message,'lastCheckedAt',last_checked_at) order by sort_order),'[]'::jsonb),'{}'::jsonb,'migration'
from public.platform_service_components;
insert into public.platform_capacity_snapshots(organizations_total,users_total,cases_total,storage_bytes,api_requests_24h,emails_queued,jobs_failed_24h,growth,metadata)
select (select count(*) from public.organizations),(select count(*) from public.profiles),(select count(*) from public.cases where deleted_at is null),coalesce((select sum(size_bytes) from public.document_versions),0),0,(select count(*) from public.email_queue where status in ('queued','dispatching')),0,'{}'::jsonb,jsonb_build_object('source','migration');

commit;
