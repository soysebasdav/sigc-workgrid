-- ORKESTA / SIGC · Verificación Fase 3.1
-- Ejecutar después de 202607160004_superadmin_phase31_commercial.sql.

-- 1. Tablas comerciales esperadas.
select table_name
from information_schema.tables
where table_schema='public'
  and table_name in (
    'organization_billing_accounts','saas_addons','organization_subscription_addons','commercial_coupons',
    'commercial_coupon_redemptions','billing_orders','billing_order_lines','billing_invoices','billing_invoice_lines',
    'billing_payments','billing_payment_allocations','subscription_change_requests','organization_onboarding','commercial_events'
  )
order by table_name;

-- 2. Nuevas columnas en planes y suscripciones.
select table_name,column_name,data_type
from information_schema.columns
where table_schema='public'
  and (
    (table_name='saas_plans' and column_name in ('annual_price_cop','currency','trial_days','grace_days','billing_intervals','onboarding_template','version'))
    or
    (table_name='organization_subscriptions' and column_name in ('billing_interval','auto_renew','cancel_at_period_end','next_plan_id','next_change_at','collection_mode','last_invoice_id'))
  )
order by table_name,column_name;

-- 3. Permisos comerciales registrados.
select code,name,category,is_sensitive
from public.platform_permission_catalog
where code in (
  'platform.commercial.view','platform.commercial.manage','platform.plans.view','platform.plans.manage',
  'platform.billing.view','platform.billing.manage','platform.onboarding.view','platform.onboarding.manage'
)
order by code;

-- 4. Roles con permisos de Fase 3.1.
select r.code role_code,count(*) permission_count,array_agg(p.code order by p.code) permissions
from public.platform_role_catalog r
join public.platform_role_permissions rp on rp.role_id=r.id
join public.platform_permission_catalog p on p.id=rp.permission_id
where p.code like 'platform.commercial.%'
   or p.code like 'platform.plans.%'
   or p.code like 'platform.billing.%'
   or p.code like 'platform.onboarding.%'
group by r.code
order by r.code;

-- 5. Planes y precios configurados.
select code,name,monthly_price_cop,annual_price_cop,currency,trial_days,grace_days,billing_intervals,is_active
from public.saas_plans
order by sort_order,name;

-- 6. Complementos y cupones.
select code,name,monthly_price_cop,annual_price_cop,is_active from public.saas_addons order by sort_order,name;
select code,name,discount_type,discount_value,valid_from,valid_until,max_redemptions,redemption_count,is_active from public.commercial_coupons order by code;

-- 7. Cobertura de cuentas de facturación y onboarding.
select
  (select count(*) from public.organizations) organizations,
  (select count(*) from public.organization_billing_accounts) billing_accounts,
  (select count(*) from public.organization_onboarding) onboarding_records;

-- 8. RPC instaladas.
select routine_name
from information_schema.routines
where specific_schema='public'
  and routine_name in (
    'platform_get_commercial_dashboard_v31','platform_list_plans_v31','platform_upsert_plan_v31',
    'platform_list_billing_v31','platform_create_invoice_v31','platform_register_payment_v31',
    'platform_schedule_subscription_change_v31','platform_set_subscription_cancellation_v31',
    'organization_get_subscription_portal_v31','organization_request_subscription_change_v31',
    'platform_review_subscription_request_v31','platform_provision_organization_v31',
    'platform_list_onboarding_v31','platform_update_onboarding_v31','platform_commercial_tick_v31'
  )
order by routine_name;

-- 9. Estado comercial de las organizaciones.
select o.name,sp.name plan_name,os.status,os.billing_interval,os.current_period_end,os.auto_renew,os.cancel_at_period_end,oba.status billing_status,oo.status onboarding_status,oo.progress
from public.organizations o
left join public.organization_subscriptions os on os.organization_id=o.id
left join public.saas_plans sp on sp.id=os.plan_id
left join public.organization_billing_accounts oba on oba.organization_id=o.id
left join public.organization_onboarding oo on oo.organization_id=o.id
order by o.name;

-- 10. Auditoría sobre tablas de Fase 3.1.
select event_type,entity_type,count(*) events
from public.platform_audit_events
where entity_type in (
  'organization_billing_accounts','saas_addons','organization_subscription_addons','commercial_coupons',
  'billing_orders','billing_invoices','billing_payments','subscription_change_requests','organization_onboarding','commercial_events'
)
group by event_type,entity_type
order by entity_type,event_type;

-- 11. Prueba segura del scheduler comercial dentro de transacción reversible.
begin;
select public.platform_commercial_tick_v31() as commercial_tick_result;
rollback;
