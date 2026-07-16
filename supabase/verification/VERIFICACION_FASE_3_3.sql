-- Verificación no destructiva Fase 3.3
select 'tables' as check_name,count(*) as actual,14 as expected
from information_schema.tables where table_schema='public' and table_name in (
'platform_service_components','platform_health_snapshots','platform_incidents','platform_incident_updates','platform_maintenance_windows','organization_continuity_policies','backup_verification_runs','privacy_requests','privacy_request_events','organization_retention_policies','retention_runs','platform_capacity_snapshots','platform_security_findings','organization_regional_settings');

select 'platform_permissions' as check_name,count(*) as actual,12 as expected
from public.platform_permission_catalog where code in ('platform.health.view','platform.health.manage','platform.incidents.view','platform.incidents.manage','platform.privacy.view','platform.privacy.manage','platform.retention.view','platform.retention.manage','platform.capacity.view','platform.security_posture.view','platform.security_posture.manage','platform.regional.manage');

select 'organization_permissions' as check_name,count(*) as actual,4 as expected
from public.permissions where code in ('privacy.view','privacy.manage','regional.view','regional.manage');

select 'service_components' as check_name,count(*) as actual,7 as expected from public.platform_service_components;
select 'continuity_policies' as check_name,count(*) as actual,(select count(*) from public.organizations) as expected from public.organization_continuity_policies;
select 'regional_settings' as check_name,count(*) as actual,(select count(*) from public.organizations) as expected from public.organization_regional_settings;
select 'retention_policies' as check_name,count(*) as actual,(select count(*)*9 from public.organizations) as expected from public.organization_retention_policies;
select 'health_snapshot' as check_name,count(*) as actual,1 as expected from public.platform_health_snapshots;
select 'capacity_snapshot' as check_name,count(*) as actual,1 as expected from public.platform_capacity_snapshots;
select 'scheduler_function' as check_name,to_regprocedure('public.platform_phase33_scheduler_tick_v33()') is not null as ok;
select 'public_status_function' as check_name,to_regprocedure('public.public_status_snapshot_v33()') is not null as ok;
select public.public_status_snapshot_v33() as public_status_sample;
