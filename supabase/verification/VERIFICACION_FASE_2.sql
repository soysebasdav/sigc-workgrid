-- ORKESTA / SIGC
-- Verificación no destructiva de la Fase 2 del Super Admin.
-- Ejecútela DESPUÉS de 202607160002_superadmin_phase2.sql.

-- 1. Detener la verificación si falta algún componente crítico.
do $$
declare missing text[] := '{}';
begin
  if to_regclass('public.platform_permission_catalog') is null then missing:=array_append(missing,'platform_permission_catalog'); end if;
  if to_regclass('public.platform_role_catalog') is null then missing:=array_append(missing,'platform_role_catalog'); end if;
  if to_regclass('public.platform_support_access_requests') is null then missing:=array_append(missing,'platform_support_access_requests'); end if;
  if to_regclass('public.organization_backup_schedules') is null then missing:=array_append(missing,'organization_backup_schedules'); end if;
  if to_regclass('public.backup_restore_requests') is null then missing:=array_append(missing,'backup_restore_requests'); end if;
  if to_regclass('public.organization_feature_flags') is null then missing:=array_append(missing,'organization_feature_flags'); end if;
  if to_regclass('public.platform_job_runs') is null then missing:=array_append(missing,'platform_job_runs'); end if;
  if to_regprocedure('public.platform_get_context_v2()') is null then missing:=array_append(missing,'platform_get_context_v2'); end if;
  if to_regprocedure('public.platform_scheduler_tick_v2()') is null then missing:=array_append(missing,'platform_scheduler_tick_v2'); end if;
  if to_regprocedure('public.platform_request_restore_v2(uuid,text,text,text)') is null then missing:=array_append(missing,'platform_request_restore_v2'); end if;
  if to_regprocedure('public.platform_explore_organization_v2(uuid,text,text,integer,integer)') is null then missing:=array_append(missing,'platform_explore_organization_v2'); end if;
  if cardinality(missing)>0 then raise exception 'FASE_2_INCOMPLETA. Faltan: %',array_to_string(missing,', '); end if;
end $$;

-- 2. Resultado ejecutivo.
select
  'FASE_2_ESTRUCTURA' as control,
  8 as roles_esperados,
  (select count(*) from public.platform_role_catalog where is_active) as roles_encontrados,
  25 as permisos_esperados,
  (select count(*) from public.platform_permission_catalog) as permisos_encontrados,
  (select count(*) from public.support_sla_policies where is_active) as politicas_sla,
  (select count(*) from public.organization_backup_schedules where enabled) as backups_programados,
  (select count(*) from public.organization_feature_flags) as feature_flags,
  (select count(*) from public.platform_audit_events) as eventos_auditados;

-- 3. Propietario global existente.
select
  p.email,
  coalesce(pr.code,pa.role_code) as rol_plataforma,
  coalesce(pr.name,pa.role_code) as nombre_rol,
  pa.is_active,
  public.platform_permissions_for_user_v2(pa.user_id) as permisos
from public.platform_admins pa
join public.profiles p on p.id=pa.user_id
left join public.platform_role_catalog pr on pr.id=pa.platform_role_id
where lower(p.email)='admin@test.com';

-- 4. Roles y permisos normalizados.
select
  r.code,
  r.name,
  count(rp.permission_id) as permisos_asignados
from public.platform_role_catalog r
left join public.platform_role_permissions rp on rp.role_id=r.id
where r.is_active
group by r.id,r.code,r.name
order by r.code;

-- 5. Configuración de seguridad.
select
  enforce_mfa,
  require_mfa_for_sensitive_actions,
  support_session_default_minutes,
  support_session_max_minutes,
  require_ticket_for_write_access,
  require_two_person_approval_for_admin_access,
  notify_organization_on_support_access,
  session_idle_minutes,
  updated_at
from public.platform_security_settings
where singleton=true;

-- 6. Organizaciones demo, suscripciones, uso y programación de backup.
select
  o.name,
  o.slug,
  o.is_active,
  sp.name as plan,
  os.status as suscripcion,
  os.current_period_end,
  bs.enabled as backup_activo,
  bs.frequency as frecuencia_backup,
  bs.local_time,
  bs.next_run_at,
  count(distinct ff.id) as funcionalidades_configuradas
from public.organizations o
left join public.organization_subscriptions os on os.organization_id=o.id
left join public.saas_plans sp on sp.id=os.plan_id
left join public.organization_backup_schedules bs on bs.organization_id=o.id
left join public.organization_feature_flags ff on ff.organization_id=o.id
where o.slug in ('seguridad-atlas','grupo-nova','vigia-integral')
group by o.id,o.name,o.slug,o.is_active,sp.name,os.status,os.current_period_end,bs.enabled,bs.frequency,bs.local_time,bs.next_run_at
order by o.slug;

-- 7. SLA de soporte.
select priority,name,first_response_minutes,resolution_minutes,escalation_minutes,is_active
from public.support_sla_policies
order by case priority when 'critical' then 1 when 'high' then 2 when 'medium' then 3 else 4 end;

-- 8. RLS habilitada en las tablas nuevas.
select
  c.relname as tabla,
  c.relrowsecurity as rls_habilitada,
  count(p.polname) as politicas
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
left join pg_policy p on p.polrelid=c.oid
where n.nspname='public'
  and c.relname in (
    'platform_permission_catalog','platform_role_catalog','platform_role_permissions','platform_security_settings',
    'platform_support_access_requests','support_sla_policies','support_ticket_events',
    'organization_backup_schedules','backup_restore_requests','backup_restore_events',
    'organization_feature_flags','organization_limit_alerts','platform_job_runs'
  )
group by c.relname,c.relrowsecurity
order by c.relname;

-- 9. Triggers de auditoría de Fase 2.
select
  event_object_table as tabla,
  trigger_name,
  action_timing,
  event_manipulation
from information_schema.triggers
where trigger_schema='public'
  and trigger_name like 'trg_platform_audit_%'
  and event_object_table in (
    'platform_admins','platform_role_catalog','platform_role_permissions','platform_security_settings',
    'platform_support_access_requests','support_sla_policies','support_ticket_events',
    'organization_backup_schedules','backup_restore_requests','backup_restore_events',
    'organization_feature_flags','organization_limit_alerts','platform_job_runs'
  )
order by event_object_table,event_manipulation;

-- 10. Estado operativo actual.
select
  (select count(*) from public.platform_support_access_requests where status in ('pending','approved','started')) as accesos_soporte_activos,
  (select count(*) from public.support_tickets where status not in ('closed','cancelled')) as tickets_no_cerrados,
  (select count(*) from public.backup_restore_requests where status not in ('completed','rejected','cancelled','failed')) as restauraciones_en_curso,
  (select count(*) from public.organization_limit_alerts where status in ('open','acknowledged')) as alertas_consumo,
  (select count(*) from public.platform_job_runs where status in ('queued','running')) as trabajos_en_curso;

-- 11. Confirmación final. Las Edge Functions se verifican después de desplegarlas desde el panel/CLI.
select
  'SQL_FASE_2_OK' as resultado,
  'Despliegue después: process-organization-backup, process-organization-restore y platform-scheduler.' as siguiente_paso;
