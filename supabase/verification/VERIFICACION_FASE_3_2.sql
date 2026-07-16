-- Verificación Fase 3.2. Ejecutar después de 202607160005_phase32_integrations.sql.

select 'tables' as check_group, count(*) as found, 16 as expected
from information_schema.tables
where table_schema='public' and table_name in (
  'platform_integration_settings','integration_event_catalog','integration_api_keys','integration_api_usage_windows','integration_api_request_logs',
  'integration_webhook_endpoints','integration_webhook_secrets','integration_webhook_deliveries','integration_domains',
  'organization_sso_configurations','organization_email_channels','integration_connectors','organization_data_exports',
  'knowledge_categories','knowledge_articles','knowledge_article_feedback'
);

select 'platform_permissions' as check_group, count(*) as found, 14 as expected
from public.platform_permission_catalog
where code in (
  'platform.integrations.view','platform.integrations.manage','platform.api.view','platform.api.manage',
  'platform.webhooks.view','platform.webhooks.manage','platform.domains.view','platform.domains.manage',
  'platform.exports.view','platform.exports.manage','platform.knowledge.view','platform.knowledge.manage',
  'platform.sso.view','platform.sso.manage'
);

select 'organization_permissions' as check_group, count(*) as found, 8 as expected
from public.permissions
where code in (
  'integrations.view','integrations.manage','integrations.api.manage','integrations.webhooks.manage',
  'integrations.domains.manage','integrations.exports.manage','knowledge.view','knowledge.manage'
);

select 'rpc' as check_group, count(*) as found
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
  'platform_get_integrations_dashboard_v32','platform_get_organization_integrations_v32','organization_get_integrations_portal_v32',
  'platform_create_api_key_v32','organization_create_api_key_v32','platform_upsert_webhook_v32','organization_upsert_webhook_v32',
  'platform_register_domain_v32','organization_register_domain_v32','platform_request_data_export_v32','organization_request_data_export_v32',
  'platform_integrations_scheduler_tick_v32','platform_list_knowledge_v32','knowledge_list_articles_v32'
);

select 'event_catalog' as check_group,count(*) as found from public.integration_event_catalog where is_active;
select 'knowledge_seed' as check_group,count(*) as found from public.knowledge_articles where organization_id is null and status='published';

select 'storage_bucket' as check_group,id,name,public,file_size_limit
from storage.buckets where id='organization-exports';

select 'audit_trigger' as check_group,tgname
from pg_trigger where tgname='trg_integration_queue_webhooks_audit' and not tgisinternal;

select 'settings' as check_group,to_jsonb(s) as value
from public.platform_integration_settings s where singleton=true;

select 'scheduler_function' as check_group,
  to_regprocedure('public.platform_integrations_scheduler_tick_v32()') is not null as installed;

select 'api_contract_functions' as check_group,count(*) as found,5 as expected
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
  'integration_api_authenticate_v32','integration_api_catalogs_v32','integration_api_list_cases_v32',
  'integration_api_get_case_v32','integration_api_create_case_v32'
);

-- Debe funcionar con admin@test.com autenticado desde la app; desde SQL Editor puede depender del contexto auth.
select count(*) as integration_audit_events
from public.platform_audit_events
where entity_type in ('integration_api_keys','integration_webhook_endpoints','integration_domains','organization_data_exports','knowledge_articles');
