-- ORKESTA / SIGC
-- Fase 3.1: núcleo comercial SaaS, facturación manual, onboarding y autoservicio.
-- Requiere Fase 1 + Fase 2 y la corrección 202607160003_fix_service_role_scheduler.sql.
-- Migración aditiva e idempotente. No integra todavía una pasarela de pagos externa.

begin;

create extension if not exists pgcrypto;

-- =========================================================
-- 1. PERMISOS COMERCIALES DE PLATAFORMA
-- =========================================================

insert into public.platform_permission_catalog(code,name,category,description,is_sensitive) values
('platform.commercial.view','Ver resumen comercial','Comercial','Consulta métricas comerciales, renovaciones, cancelaciones y solicitudes.',false),
('platform.commercial.manage','Administrar ciclo comercial','Comercial','Gestiona cambios de plan, renovaciones, cancelaciones, descuentos y solicitudes.',true),
('platform.plans.view','Ver planes y complementos','Comercial','Consulta catálogo de planes, complementos y precios.',false),
('platform.plans.manage','Administrar planes y complementos','Comercial','Crea y modifica planes, complementos, límites y funcionalidades.',true),
('platform.billing.view','Ver facturación','Facturación','Consulta cuentas de cobro, órdenes, facturas y pagos.',false),
('platform.billing.manage','Administrar facturación','Facturación','Emite facturas, registra pagos y anula documentos comerciales.',true),
('platform.onboarding.view','Ver onboarding','Onboarding','Consulta incorporación y configuración inicial de organizaciones.',false),
('platform.onboarding.manage','Administrar onboarding','Onboarding','Aprovisiona organizaciones y administra su incorporación.',true)
on conflict(code) do update set
  name=excluded.name,
  category=excluded.category,
  description=excluded.description,
  is_sensitive=excluded.is_sensitive;

-- Owner y admin reciben los nuevos permisos.
insert into public.platform_role_permissions(role_id,permission_id)
select r.id,p.id
from public.platform_role_catalog r
cross join public.platform_permission_catalog p
where r.code in ('owner','admin')
  and p.code like 'platform.%'
on conflict do nothing;

-- Administrador de suscripciones amplía su alcance comercial y de facturación.
insert into public.platform_role_permissions(role_id,permission_id)
select r.id,p.id
from public.platform_role_catalog r
join public.platform_permission_catalog p on p.code = any(array[
  'platform.commercial.view','platform.commercial.manage','platform.plans.view','platform.plans.manage',
  'platform.billing.view','platform.billing.manage','platform.onboarding.view','platform.onboarding.manage'
])
where r.code='subscription_manager'
on conflict do nothing;

-- Auditor y soporte pueden consultar información pertinente sin modificarla.
insert into public.platform_role_permissions(role_id,permission_id)
select r.id,p.id
from public.platform_role_catalog r
join public.platform_permission_catalog p on p.code = any(array[
  'platform.commercial.view','platform.plans.view','platform.billing.view','platform.onboarding.view'
])
where r.code='auditor'
on conflict do nothing;

insert into public.platform_role_permissions(role_id,permission_id)
select r.id,p.id
from public.platform_role_catalog r
join public.platform_permission_catalog p on p.code = any(array[
  'platform.commercial.view','platform.plans.view','platform.onboarding.view'
])
where r.code in ('support_manager','support_agent')
on conflict do nothing;

-- =========================================================
-- 2. EVOLUCIÓN DE PLANES Y SUSCRIPCIONES
-- =========================================================

alter table public.saas_plans add column if not exists annual_price_cop numeric not null default 0 check (annual_price_cop >= 0);
alter table public.saas_plans add column if not exists currency text not null default 'COP';
alter table public.saas_plans add column if not exists trial_days integer not null default 14 check (trial_days between 0 and 365);
alter table public.saas_plans add column if not exists grace_days integer not null default 5 check (grace_days between 0 and 90);
alter table public.saas_plans add column if not exists billing_intervals text[] not null default array['monthly','yearly'];
alter table public.saas_plans add column if not exists onboarding_template jsonb not null default '{}'::jsonb;
alter table public.saas_plans add column if not exists version integer not null default 1 check (version >= 1);
alter table public.saas_plans add column if not exists archived_at timestamptz;

alter table public.organization_subscriptions add column if not exists billing_interval text not null default 'monthly';
alter table public.organization_subscriptions drop constraint if exists organization_subscriptions_billing_interval_check;
alter table public.organization_subscriptions add constraint organization_subscriptions_billing_interval_check check (billing_interval in ('monthly','yearly','custom'));
alter table public.organization_subscriptions add column if not exists auto_renew boolean not null default true;
alter table public.organization_subscriptions add column if not exists cancel_at_period_end boolean not null default false;
alter table public.organization_subscriptions add column if not exists cancelled_at timestamptz;
alter table public.organization_subscriptions add column if not exists cancellation_reason text;
alter table public.organization_subscriptions add column if not exists next_plan_id uuid references public.saas_plans(id) on delete set null;
alter table public.organization_subscriptions add column if not exists next_billing_interval text;
alter table public.organization_subscriptions add column if not exists next_change_at timestamptz;
alter table public.organization_subscriptions add column if not exists collection_mode text not null default 'manual';
alter table public.organization_subscriptions drop constraint if exists organization_subscriptions_collection_mode_check;
alter table public.organization_subscriptions add constraint organization_subscriptions_collection_mode_check check (collection_mode in ('manual','external','complimentary'));
alter table public.organization_subscriptions add column if not exists commercial_notes text;
alter table public.organization_subscriptions add column if not exists external_customer_id text;
alter table public.organization_subscriptions add column if not exists last_invoice_id uuid;

-- =========================================================
-- 3. CUENTAS DE FACTURACIÓN, COMPLEMENTOS Y CUPONES
-- =========================================================

create table if not exists public.organization_billing_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  legal_name text not null,
  tax_id text,
  billing_email text,
  billing_phone text,
  contact_name text,
  address_line text,
  city text,
  country_code text not null default 'CO',
  tax_regime text,
  payment_terms_days integer not null default 15 check (payment_terms_days between 0 and 180),
  purchase_order_required boolean not null default false,
  purchase_order_prefix text,
  status text not null default 'active' check (status in ('active','incomplete','blocked')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saas_addons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  unit_name text not null default 'unidad',
  monthly_price_cop numeric not null default 0 check (monthly_price_cop >= 0),
  annual_price_cop numeric not null default 0 check (annual_price_cop >= 0),
  currency text not null default 'COP',
  limits_delta jsonb not null default '{}'::jsonb,
  features_delta jsonb not null default '{}'::jsonb,
  min_quantity integer not null default 1 check (min_quantity >= 0),
  max_quantity integer check (max_quantity is null or max_quantity >= min_quantity),
  is_public boolean not null default true,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_subscription_addons (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subscription_id uuid not null references public.organization_subscriptions(id) on delete cascade,
  addon_id uuid not null references public.saas_addons(id) on delete restrict,
  quantity integer not null default 1 check (quantity >= 0),
  unit_price_cop numeric not null default 0 check (unit_price_cop >= 0),
  billing_interval text not null default 'monthly' check (billing_interval in ('monthly','yearly','custom')),
  status text not null default 'active' check (status in ('pending','active','cancelled','expired')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,addon_id,status)
);

create table if not exists public.commercial_coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  discount_type text not null check (discount_type in ('percentage','fixed')),
  discount_value numeric not null check (discount_value > 0),
  currency text not null default 'COP',
  valid_from timestamptz,
  valid_until timestamptz,
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  redemption_count integer not null default 0 check (redemption_count >= 0),
  applicable_plan_ids uuid[] not null default '{}'::uuid[],
  first_purchase_only boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commercial_coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.commercial_coupons(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid,
  discount_amount numeric not null default 0 check (discount_amount >= 0),
  redeemed_by uuid references public.profiles(id) on delete set null,
  redeemed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

-- =========================================================
-- 4. ÓRDENES, FACTURAS Y PAGOS MANUALES
-- =========================================================

create table if not exists public.billing_order_counters (
  year integer primary key,
  last_value bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_invoice_counters (
  year integer primary key,
  last_value bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_payment_counters (
  year integer primary key,
  last_value bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  subscription_id uuid references public.organization_subscriptions(id) on delete set null,
  order_type text not null check (order_type in ('new_subscription','renewal','plan_change','addon','adjustment')),
  status text not null default 'draft' check (status in ('draft','pending','approved','invoiced','paid','cancelled')),
  currency text not null default 'COP',
  subtotal numeric not null default 0 check (subtotal >= 0),
  discount_amount numeric not null default 0 check (discount_amount >= 0),
  tax_amount numeric not null default 0 check (tax_amount >= 0),
  total_amount numeric not null default 0 check (total_amount >= 0),
  coupon_id uuid references public.commercial_coupons(id) on delete set null,
  billing_interval text check (billing_interval is null or billing_interval in ('monthly','yearly','custom')),
  effective_at timestamptz,
  expires_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  cancelled_by uuid references public.profiles(id) on delete set null,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.billing_orders(id) on delete cascade,
  line_type text not null check (line_type in ('plan','addon','discount','adjustment','tax')),
  reference_id uuid,
  description text not null,
  quantity numeric not null default 1 check (quantity >= 0),
  unit_price numeric not null default 0,
  subtotal numeric not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  billing_account_id uuid references public.organization_billing_accounts(id) on delete set null,
  order_id uuid references public.billing_orders(id) on delete set null,
  subscription_id uuid references public.organization_subscriptions(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','issued','partially_paid','paid','overdue','void')),
  currency text not null default 'COP',
  issue_date date not null default current_date,
  due_date date not null,
  service_period_start date,
  service_period_end date,
  subtotal numeric not null default 0 check (subtotal >= 0),
  discount_amount numeric not null default 0 check (discount_amount >= 0),
  tax_amount numeric not null default 0 check (tax_amount >= 0),
  total_amount numeric not null default 0 check (total_amount >= 0),
  amount_paid numeric not null default 0 check (amount_paid >= 0),
  balance_due numeric generated always as (greatest(total_amount - amount_paid,0)) stored,
  billing_snapshot jsonb not null default '{}'::jsonb,
  notes text,
  pdf_storage_path text,
  issued_by uuid references public.profiles(id) on delete set null,
  issued_at timestamptz,
  paid_at timestamptz,
  voided_by uuid references public.profiles(id) on delete set null,
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.billing_invoices(id) on delete cascade,
  line_type text not null check (line_type in ('plan','addon','discount','adjustment','tax')),
  reference_id uuid,
  description text not null,
  quantity numeric not null default 1 check (quantity >= 0),
  unit_price numeric not null default 0,
  subtotal numeric not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  payment_number text not null unique,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','confirmed','rejected','refunded')),
  method text not null check (method in ('bank_transfer','cash','card','external','credit_note','other')),
  currency text not null default 'COP',
  amount numeric not null check (amount > 0),
  paid_at timestamptz not null default now(),
  reference text,
  evidence_storage_path text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  registered_by uuid references public.profiles(id) on delete set null,
  confirmed_by uuid references public.profiles(id) on delete set null,
  confirmed_at timestamptz,
  rejected_by uuid references public.profiles(id) on delete set null,
  rejected_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.billing_payments(id) on delete cascade,
  invoice_id uuid not null references public.billing_invoices(id) on delete restrict,
  amount numeric not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique(payment_id,invoice_id)
);

alter table public.organization_subscriptions drop constraint if exists organization_subscriptions_last_invoice_id_fkey;
alter table public.organization_subscriptions add constraint organization_subscriptions_last_invoice_id_fkey foreign key(last_invoice_id) references public.billing_invoices(id) on delete set null;
alter table public.commercial_coupon_redemptions drop constraint if exists commercial_coupon_redemptions_order_id_fkey;
alter table public.commercial_coupon_redemptions add constraint commercial_coupon_redemptions_order_id_fkey foreign key(order_id) references public.billing_orders(id) on delete set null;

-- =========================================================
-- 5. SOLICITUDES DE AUTOSERVICIO Y ONBOARDING
-- =========================================================

create table if not exists public.subscription_change_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subscription_id uuid references public.organization_subscriptions(id) on delete set null,
  request_type text not null check (request_type in ('plan_change','cancel','reactivate','addon_change','billing_update','renewal')),
  requested_payload jsonb not null default '{}'::jsonb,
  reason text not null check (length(trim(reason)) >= 5),
  status text not null default 'pending' check (status in ('pending','in_review','approved','rejected','applied','cancelled')),
  requested_by uuid not null references public.profiles(id) on delete restrict,
  requested_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  applied_at timestamptz,
  related_order_id uuid references public.billing_orders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_onboarding (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started','in_progress','blocked','completed','cancelled')),
  current_step text not null default 'organization',
  progress integer not null default 0 check (progress between 0 and 100),
  checklist jsonb not null default jsonb_build_object(
    'organization',false,
    'billing',false,
    'branding',false,
    'adminInvitation',false,
    'catalogs',false,
    'security',false,
    'goLive',false
  ),
  admin_email text,
  assigned_to uuid references public.profiles(id) on delete set null,
  blocking_reason text,
  notes text,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commercial_events (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete cascade,
  subscription_id uuid references public.organization_subscriptions(id) on delete set null,
  invoice_id uuid references public.billing_invoices(id) on delete set null,
  payment_id uuid references public.billing_payments(id) on delete set null,
  event_type text not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists billing_orders_org_created_idx on public.billing_orders(organization_id,created_at desc);
create index if not exists billing_invoices_org_status_idx on public.billing_invoices(organization_id,status,due_date desc);
create index if not exists billing_payments_org_created_idx on public.billing_payments(organization_id,created_at desc);
create index if not exists subscription_change_requests_org_status_idx on public.subscription_change_requests(organization_id,status,created_at desc);
create index if not exists organization_onboarding_status_idx on public.organization_onboarding(status,updated_at desc);
create index if not exists commercial_events_org_created_idx on public.commercial_events(organization_id,created_at desc);

-- =========================================================
-- 6. FUNCIONES AUXILIARES COMERCIALES
-- =========================================================

create or replace function public.platform_next_commercial_number_v31(p_kind text)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  v_year integer:=extract(year from now())::integer;
  v_value bigint;
  v_prefix text;
begin
  if p_kind='order' then
    insert into public.billing_order_counters(year,last_value) values(v_year,1)
    on conflict(year) do update set last_value=public.billing_order_counters.last_value+1,updated_at=now()
    returning last_value into v_value;
    v_prefix:='ORD';
  elsif p_kind='invoice' then
    insert into public.billing_invoice_counters(year,last_value) values(v_year,1)
    on conflict(year) do update set last_value=public.billing_invoice_counters.last_value+1,updated_at=now()
    returning last_value into v_value;
    v_prefix:='FAC';
  elsif p_kind='payment' then
    insert into public.billing_payment_counters(year,last_value) values(v_year,1)
    on conflict(year) do update set last_value=public.billing_payment_counters.last_value+1,updated_at=now()
    returning last_value into v_value;
    v_prefix:='PAG';
  else
    raise exception 'INVALID_COMMERCIAL_NUMBER_KIND';
  end if;
  return format('%s-%s-%s',v_prefix,v_year,lpad(v_value::text,6,'0'));
end;
$$;

create or replace function public.platform_plan_price_v31(p_plan_id uuid,p_billing_interval text)
returns numeric
language sql
stable
security definer
set search_path=public
as $$
  select case when p_billing_interval='yearly' then annual_price_cop else monthly_price_cop end
  from public.saas_plans where id=p_plan_id;
$$;

create or replace function public.platform_addon_price_v31(p_addon_id uuid,p_billing_interval text)
returns numeric
language sql
stable
security definer
set search_path=public
as $$
  select case when p_billing_interval='yearly' then annual_price_cop else monthly_price_cop end
  from public.saas_addons where id=p_addon_id;
$$;

create or replace function public.platform_calculate_coupon_v31(
  p_coupon_code text,
  p_plan_id uuid,
  p_organization_id uuid,
  p_subtotal numeric
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare c public.commercial_coupons%rowtype; v_discount numeric:=0; v_valid boolean:=false; v_reason text:='';
begin
  if nullif(trim(p_coupon_code),'') is null then
    return jsonb_build_object('valid',false,'discount',0,'reason','Sin cupón');
  end if;
  select * into c from public.commercial_coupons where upper(code)=upper(trim(p_coupon_code));
  if not found then v_reason:='Cupón inexistente';
  elsif not c.is_active then v_reason:='Cupón inactivo';
  elsif c.valid_from is not null and c.valid_from>now() then v_reason:='Cupón aún no vigente';
  elsif c.valid_until is not null and c.valid_until<now() then v_reason:='Cupón vencido';
  elsif c.max_redemptions is not null and c.redemption_count>=c.max_redemptions then v_reason:='Cupo agotado';
  elsif cardinality(c.applicable_plan_ids)>0 and not p_plan_id=any(c.applicable_plan_ids) then v_reason:='No aplica al plan';
  elsif c.first_purchase_only and exists(select 1 from public.billing_invoices bi where bi.organization_id=p_organization_id and bi.status in ('issued','partially_paid','paid','overdue')) then v_reason:='Solo aplica a la primera compra';
  else
    v_valid:=true;
    v_discount:=case when c.discount_type='percentage' then round(p_subtotal*(least(c.discount_value,100)/100),2) else least(c.discount_value,p_subtotal) end;
  end if;
  return jsonb_build_object('valid',v_valid,'couponId',c.id,'discount',greatest(v_discount,0),'reason',v_reason);
end;
$$;

create or replace function public.platform_recalculate_invoice_v31(p_invoice_id uuid)
returns public.billing_invoices
language plpgsql
security definer
set search_path=public
as $$
declare v_paid numeric; v_invoice public.billing_invoices%rowtype;
begin
  select coalesce(sum(bpa.amount),0) into v_paid
  from public.billing_payment_allocations bpa
  join public.billing_payments bp on bp.id=bpa.payment_id and bp.status='confirmed'
  where bpa.invoice_id=p_invoice_id;

  update public.billing_invoices
  set amount_paid=v_paid,
      status=case
        when status='void' then 'void'
        when v_paid>=total_amount and total_amount>0 then 'paid'
        when v_paid>0 then 'partially_paid'
        when due_date<current_date and status<>'draft' then 'overdue'
        when status='draft' then 'draft'
        else 'issued'
      end,
      paid_at=case when v_paid>=total_amount and total_amount>0 then coalesce(paid_at,now()) else null end,
      updated_at=now()
  where id=p_invoice_id
  returning * into v_invoice;

  if v_invoice.status='paid' and v_invoice.subscription_id is not null then
    update public.organization_subscriptions
    set status='active',last_invoice_id=v_invoice.id,updated_at=now()
    where id=v_invoice.subscription_id and status in ('past_due','suspended','active','trialing');
  end if;
  return v_invoice;
end;
$$;

create or replace function public.platform_member_can_manage_subscription_v31(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public,auth
as $$
  select exists(
    select 1
    from public.organization_members om
    join public.role_permissions rp on rp.role_id=om.role_id
    join public.permissions p on p.id=rp.permission_id
    where om.organization_id=p_organization_id
      and om.user_id=auth.uid()
      and om.is_active
      and p.code in ('saas.manage_workspace','admin.manage_configuration')
  );
$$;

-- =========================================================
-- 7. RPC DE PLANES Y CATÁLOGO COMERCIAL
-- =========================================================

create or replace function public.platform_list_plans_v31(p_include_inactive boolean default true)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,auth
as $$
begin
  perform public.platform_assert_admin_v2('platform.plans.view',false);
  return jsonb_build_object(
    'plans',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',sp.id,'code',sp.code,'name',sp.name,'description',sp.description,
        'monthlyPriceCop',sp.monthly_price_cop,'annualPriceCop',sp.annual_price_cop,'currency',sp.currency,
        'trialDays',sp.trial_days,'graceDays',sp.grace_days,'billingIntervals',sp.billing_intervals,
        'limits',sp.limits,'features',sp.features,'onboardingTemplate',sp.onboarding_template,
        'isPublic',sp.is_public,'isActive',sp.is_active,'sortOrder',sp.sort_order,'version',sp.version,
        'activeSubscriptions',(select count(*) from public.organization_subscriptions os where os.plan_id=sp.id and os.status in ('trialing','active','past_due'))
      ) order by sp.sort_order,sp.monthly_price_cop,sp.name)
      from public.saas_plans sp where p_include_inactive or sp.is_active
    ),'[]'::jsonb),
    'addons',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',sa.id,'code',sa.code,'name',sa.name,'description',sa.description,'unitName',sa.unit_name,
        'monthlyPriceCop',sa.monthly_price_cop,'annualPriceCop',sa.annual_price_cop,'currency',sa.currency,
        'limitsDelta',sa.limits_delta,'featuresDelta',sa.features_delta,'minQuantity',sa.min_quantity,
        'maxQuantity',sa.max_quantity,'isPublic',sa.is_public,'isActive',sa.is_active,'sortOrder',sa.sort_order
      ) order by sa.sort_order,sa.name) from public.saas_addons sa where p_include_inactive or sa.is_active
    ),'[]'::jsonb),
    'coupons',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',cc.id,'code',cc.code,'name',cc.name,'description',cc.description,'discountType',cc.discount_type,
        'discountValue',cc.discount_value,'currency',cc.currency,'validFrom',cc.valid_from,'validUntil',cc.valid_until,
        'maxRedemptions',cc.max_redemptions,'redemptionCount',cc.redemption_count,'applicablePlanIds',cc.applicable_plan_ids,
        'firstPurchaseOnly',cc.first_purchase_only,'isActive',cc.is_active
      ) order by cc.created_at desc) from public.commercial_coupons cc where p_include_inactive or cc.is_active
    ),'[]'::jsonb)
  );
end;
$$;

create or replace function public.platform_upsert_plan_v31(p_payload jsonb,p_reason text)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare v_id uuid; v_old jsonb; v_new jsonb;
begin
  perform public.platform_assert_admin_v2('platform.plans.manage',true);
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'REASON_REQUIRED'; end if;
  v_id:=nullif(p_payload->>'id','')::uuid;
  if v_id is null then
    insert into public.saas_plans(code,name,description,monthly_price_cop,annual_price_cop,currency,trial_days,grace_days,billing_intervals,limits,features,onboarding_template,is_public,is_active,sort_order)
    values(
      lower(trim(p_payload->>'code')),trim(p_payload->>'name'),nullif(trim(p_payload->>'description'),''),
      coalesce((p_payload->>'monthlyPriceCop')::numeric,0),coalesce((p_payload->>'annualPriceCop')::numeric,0),coalesce(nullif(p_payload->>'currency',''),'COP'),
      coalesce((p_payload->>'trialDays')::integer,14),coalesce((p_payload->>'graceDays')::integer,5),
      coalesce(array(select jsonb_array_elements_text(p_payload->'billingIntervals')),array['monthly','yearly']),
      coalesce(p_payload->'limits','{}'::jsonb),coalesce(p_payload->'features','{}'::jsonb),coalesce(p_payload->'onboardingTemplate','{}'::jsonb),
      coalesce((p_payload->>'isPublic')::boolean,true),coalesce((p_payload->>'isActive')::boolean,true),coalesce((p_payload->>'sortOrder')::integer,0)
    ) returning id into v_id;
    select to_jsonb(sp) into v_new from public.saas_plans sp where sp.id=v_id;
  else
    select to_jsonb(sp) into v_old from public.saas_plans sp where sp.id=v_id for update;
    if v_old is null then raise exception 'PLAN_NOT_FOUND'; end if;
    update public.saas_plans set
      code=lower(trim(coalesce(p_payload->>'code',code))),
      name=trim(coalesce(p_payload->>'name',name)),
      description=case when p_payload ? 'description' then nullif(trim(p_payload->>'description'),'') else description end,
      monthly_price_cop=coalesce((p_payload->>'monthlyPriceCop')::numeric,monthly_price_cop),
      annual_price_cop=coalesce((p_payload->>'annualPriceCop')::numeric,annual_price_cop),
      currency=coalesce(nullif(p_payload->>'currency',''),currency),
      trial_days=coalesce((p_payload->>'trialDays')::integer,trial_days),
      grace_days=coalesce((p_payload->>'graceDays')::integer,grace_days),
      billing_intervals=case when p_payload ? 'billingIntervals' then array(select jsonb_array_elements_text(p_payload->'billingIntervals')) else billing_intervals end,
      limits=coalesce(p_payload->'limits',limits),features=coalesce(p_payload->'features',features),onboarding_template=coalesce(p_payload->'onboardingTemplate',onboarding_template),
      is_public=coalesce((p_payload->>'isPublic')::boolean,is_public),is_active=coalesce((p_payload->>'isActive')::boolean,is_active),
      sort_order=coalesce((p_payload->>'sortOrder')::integer,sort_order),version=version+1,updated_at=now()
    where id=v_id;
    select to_jsonb(sp) into v_new from public.saas_plans sp where sp.id=v_id;
  end if;
  perform public.platform_insert_audit_v1(null,'platform','commercial.plan.upsert','saas_plans',v_id::text,v_old,v_new,jsonb_build_object('reason',p_reason));
  return jsonb_build_object('id',v_id,'plan',v_new);
end;
$$;

create or replace function public.platform_upsert_addon_v31(p_payload jsonb,p_reason text)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare v_id uuid; v_old jsonb; v_new jsonb;
begin
  perform public.platform_assert_admin_v2('platform.plans.manage',true);
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'REASON_REQUIRED'; end if;
  v_id:=nullif(p_payload->>'id','')::uuid;
  if v_id is null then
    insert into public.saas_addons(code,name,description,unit_name,monthly_price_cop,annual_price_cop,currency,limits_delta,features_delta,min_quantity,max_quantity,is_public,is_active,sort_order)
    values(lower(trim(p_payload->>'code')),trim(p_payload->>'name'),nullif(trim(p_payload->>'description'),''),coalesce(nullif(p_payload->>'unitName',''),'unidad'),
      coalesce((p_payload->>'monthlyPriceCop')::numeric,0),coalesce((p_payload->>'annualPriceCop')::numeric,0),coalesce(nullif(p_payload->>'currency',''),'COP'),
      coalesce(p_payload->'limitsDelta','{}'::jsonb),coalesce(p_payload->'featuresDelta','{}'::jsonb),coalesce((p_payload->>'minQuantity')::integer,1),
      nullif(p_payload->>'maxQuantity','')::integer,coalesce((p_payload->>'isPublic')::boolean,true),coalesce((p_payload->>'isActive')::boolean,true),coalesce((p_payload->>'sortOrder')::integer,0))
    returning id into v_id;
  else
    select to_jsonb(sa) into v_old from public.saas_addons sa where sa.id=v_id for update;
    if v_old is null then raise exception 'ADDON_NOT_FOUND'; end if;
    update public.saas_addons set
      code=lower(trim(coalesce(p_payload->>'code',code))),name=trim(coalesce(p_payload->>'name',name)),
      description=case when p_payload ? 'description' then nullif(trim(p_payload->>'description'),'') else description end,
      unit_name=coalesce(nullif(p_payload->>'unitName',''),unit_name),monthly_price_cop=coalesce((p_payload->>'monthlyPriceCop')::numeric,monthly_price_cop),
      annual_price_cop=coalesce((p_payload->>'annualPriceCop')::numeric,annual_price_cop),currency=coalesce(nullif(p_payload->>'currency',''),currency),
      limits_delta=coalesce(p_payload->'limitsDelta',limits_delta),features_delta=coalesce(p_payload->'featuresDelta',features_delta),
      min_quantity=coalesce((p_payload->>'minQuantity')::integer,min_quantity),max_quantity=case when p_payload ? 'maxQuantity' then nullif(p_payload->>'maxQuantity','')::integer else max_quantity end,
      is_public=coalesce((p_payload->>'isPublic')::boolean,is_public),is_active=coalesce((p_payload->>'isActive')::boolean,is_active),sort_order=coalesce((p_payload->>'sortOrder')::integer,sort_order),updated_at=now()
    where id=v_id;
  end if;
  select to_jsonb(sa) into v_new from public.saas_addons sa where sa.id=v_id;
  perform public.platform_insert_audit_v1(null,'platform','commercial.addon.upsert','saas_addons',v_id::text,v_old,v_new,jsonb_build_object('reason',p_reason));
  return jsonb_build_object('id',v_id,'addon',v_new);
end;
$$;

create or replace function public.platform_upsert_coupon_v31(p_payload jsonb,p_reason text)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare v_id uuid; v_old jsonb; v_new jsonb;
begin
  perform public.platform_assert_admin_v2('platform.commercial.manage',true);
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'REASON_REQUIRED'; end if;
  v_id:=nullif(p_payload->>'id','')::uuid;
  if v_id is null then
    insert into public.commercial_coupons(code,name,description,discount_type,discount_value,currency,valid_from,valid_until,max_redemptions,applicable_plan_ids,first_purchase_only,is_active,created_by)
    values(upper(trim(p_payload->>'code')),trim(p_payload->>'name'),nullif(trim(p_payload->>'description'),''),p_payload->>'discountType',(p_payload->>'discountValue')::numeric,
      coalesce(nullif(p_payload->>'currency',''),'COP'),nullif(p_payload->>'validFrom','')::timestamptz,nullif(p_payload->>'validUntil','')::timestamptz,
      nullif(p_payload->>'maxRedemptions','')::integer,coalesce(array(select jsonb_array_elements_text(p_payload->'applicablePlanIds'))::uuid[],'{}'::uuid[]),
      coalesce((p_payload->>'firstPurchaseOnly')::boolean,false),coalesce((p_payload->>'isActive')::boolean,true),auth.uid()) returning id into v_id;
  else
    select to_jsonb(cc) into v_old from public.commercial_coupons cc where cc.id=v_id for update;
    if v_old is null then raise exception 'COUPON_NOT_FOUND'; end if;
    update public.commercial_coupons set
      code=upper(trim(coalesce(p_payload->>'code',code))),name=trim(coalesce(p_payload->>'name',name)),description=case when p_payload ? 'description' then nullif(trim(p_payload->>'description'),'') else description end,
      discount_type=coalesce(p_payload->>'discountType',discount_type),discount_value=coalesce((p_payload->>'discountValue')::numeric,discount_value),currency=coalesce(nullif(p_payload->>'currency',''),currency),
      valid_from=case when p_payload ? 'validFrom' then nullif(p_payload->>'validFrom','')::timestamptz else valid_from end,valid_until=case when p_payload ? 'validUntil' then nullif(p_payload->>'validUntil','')::timestamptz else valid_until end,
      max_redemptions=case when p_payload ? 'maxRedemptions' then nullif(p_payload->>'maxRedemptions','')::integer else max_redemptions end,
      applicable_plan_ids=case when p_payload ? 'applicablePlanIds' then array(select jsonb_array_elements_text(p_payload->'applicablePlanIds'))::uuid[] else applicable_plan_ids end,
      first_purchase_only=coalesce((p_payload->>'firstPurchaseOnly')::boolean,first_purchase_only),is_active=coalesce((p_payload->>'isActive')::boolean,is_active),updated_at=now()
    where id=v_id;
  end if;
  select to_jsonb(cc) into v_new from public.commercial_coupons cc where cc.id=v_id;
  perform public.platform_insert_audit_v1(null,'platform','commercial.coupon.upsert','commercial_coupons',v_id::text,v_old,v_new,jsonb_build_object('reason',p_reason));
  return jsonb_build_object('id',v_id,'coupon',v_new);
end;
$$;

-- =========================================================
-- 8. RPC DE FACTURACIÓN Y PAGOS
-- =========================================================

create or replace function public.platform_get_commercial_dashboard_v31()
returns jsonb
language plpgsql
stable
security definer
set search_path=public,auth
as $$
declare v_month_start date:=date_trunc('month',current_date)::date;
begin
  perform public.platform_assert_admin_v2('platform.commercial.view',false);
  return jsonb_build_object(
    'metrics',jsonb_build_object(
      'activeSubscriptions',(select count(*) from public.organization_subscriptions where status='active'),
      'trialingSubscriptions',(select count(*) from public.organization_subscriptions where status='trialing'),
      'pastDueSubscriptions',(select count(*) from public.organization_subscriptions where status='past_due'),
      'scheduledCancellations',(select count(*) from public.organization_subscriptions where cancel_at_period_end),
      'monthlyRecurringRevenue',coalesce((select sum(case when os.billing_interval='yearly' then sp.annual_price_cop/12 else sp.monthly_price_cop end) from public.organization_subscriptions os join public.saas_plans sp on sp.id=os.plan_id where os.status='active'),0),
      'invoicedThisMonth',coalesce((select sum(total_amount) from public.billing_invoices where issue_date>=v_month_start and status<>'void'),0),
      'collectedThisMonth',coalesce((select sum(amount) from public.billing_payments where status='confirmed' and paid_at::date>=v_month_start),0),
      'outstandingBalance',coalesce((select sum(balance_due) from public.billing_invoices where status in ('issued','partially_paid','overdue')),0),
      'overdueInvoices',(select count(*) from public.billing_invoices where status='overdue'),
      'pendingRequests',(select count(*) from public.subscription_change_requests where status in ('pending','in_review')),
      'onboardingInProgress',(select count(*) from public.organization_onboarding where status in ('not_started','in_progress','blocked'))
    ),
    'renewals',coalesce((select jsonb_agg(jsonb_build_object('organizationId',o.id,'organizationName',o.name,'planName',sp.name,'status',os.status,'periodEnd',os.current_period_end,'autoRenew',os.auto_renew,'cancelAtPeriodEnd',os.cancel_at_period_end) order by os.current_period_end)
      from public.organization_subscriptions os join public.organizations o on o.id=os.organization_id join public.saas_plans sp on sp.id=os.plan_id
      where os.current_period_end between now() and now()+interval '45 days'),'[]'::jsonb),
    'recentInvoices',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'invoiceNumber',x.invoice_number,'organizationId',x.organization_id,'organizationName',x.organization_name,'status',x.status,'issueDate',x.issue_date,'dueDate',x.due_date,'totalAmount',x.total_amount,'amountPaid',x.amount_paid,'balanceDue',x.balance_due) order by x.created_at desc)
      from (select bi.*,o.name organization_name from public.billing_invoices bi join public.organizations o on o.id=bi.organization_id order by bi.created_at desc limit 12) x),'[]'::jsonb),
    'pendingRequests',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'organizationId',x.organization_id,'organizationName',x.organization_name,'requestType',x.request_type,'status',x.status,'reason',x.reason,'requestedAt',x.requested_at,'requestedByName',x.requested_by_name) order by x.requested_at desc)
      from (select scr.*,o.name organization_name,p.name requested_by_name from public.subscription_change_requests scr join public.organizations o on o.id=scr.organization_id left join public.profiles p on p.id=scr.requested_by where scr.status in ('pending','in_review') order by scr.requested_at desc limit 12) x),'[]'::jsonb)
  );
end;
$$;

create or replace function public.platform_list_billing_v31(
  p_organization_id uuid default null,
  p_status text default null,
  p_search text default null,
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,auth
as $$
declare v_offset integer:=greatest(p_page-1,0)*greatest(1,least(p_page_size,100));
begin
  perform public.platform_assert_admin_v2('platform.billing.view',false);
  return jsonb_build_object(
    'rows',coalesce((select jsonb_agg(jsonb_build_object(
      'id',q.id,'invoiceNumber',q.invoice_number,'organizationId',q.organization_id,'organizationName',q.organization_name,
      'status',q.status,'currency',q.currency,'issueDate',q.issue_date,'dueDate',q.due_date,'servicePeriodStart',q.service_period_start,'servicePeriodEnd',q.service_period_end,
      'subtotal',q.subtotal,'discountAmount',q.discount_amount,'taxAmount',q.tax_amount,'totalAmount',q.total_amount,'amountPaid',q.amount_paid,'balanceDue',q.balance_due,
      'notes',q.notes,'createdAt',q.created_at
    ) order by q.created_at desc) from (
      select bi.*,o.name organization_name from public.billing_invoices bi join public.organizations o on o.id=bi.organization_id
      where (p_organization_id is null or bi.organization_id=p_organization_id)
        and (p_status is null or p_status='' or bi.status=p_status)
        and (p_search is null or p_search='' or bi.invoice_number ilike '%'||p_search||'%' or o.name ilike '%'||p_search||'%')
      order by bi.created_at desc limit greatest(1,least(p_page_size,100)) offset v_offset
    ) q),'[]'::jsonb),
    'total',(select count(*) from public.billing_invoices bi join public.organizations o on o.id=bi.organization_id
      where (p_organization_id is null or bi.organization_id=p_organization_id)
        and (p_status is null or p_status='' or bi.status=p_status)
        and (p_search is null or p_search='' or bi.invoice_number ilike '%'||p_search||'%' or o.name ilike '%'||p_search||'%')),
    'page',greatest(p_page,1),'pageSize',greatest(1,least(p_page_size,100)),
    'payments',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'paymentNumber',x.payment_number,'organizationId',x.organization_id,'organizationName',x.organization_name,'status',x.status,'method',x.method,'amount',x.amount,'paidAt',x.paid_at,'reference',x.reference,'createdAt',x.created_at) order by x.created_at desc)
      from (select bp.*,o.name organization_name from public.billing_payments bp join public.organizations o on o.id=bp.organization_id where p_organization_id is null or bp.organization_id=p_organization_id order by bp.created_at desc limit 25) x),'[]'::jsonb),
    'accounts',coalesce((select jsonb_agg(jsonb_build_object('id',oba.id,'organizationId',oba.organization_id,'organizationName',o.name,'legalName',oba.legal_name,'taxId',oba.tax_id,'billingEmail',oba.billing_email,'contactName',oba.contact_name,'paymentTermsDays',oba.payment_terms_days,'status',oba.status) order by o.name)
      from public.organization_billing_accounts oba join public.organizations o on o.id=oba.organization_id where p_organization_id is null or oba.organization_id=p_organization_id),'[]'::jsonb)
  );
end;
$$;

create or replace function public.platform_create_invoice_v31(
  p_organization_id uuid,
  p_plan_id uuid,
  p_billing_interval text,
  p_addons jsonb default '[]'::jsonb,
  p_coupon_code text default null,
  p_tax_percent numeric default 0,
  p_due_date date default null,
  p_notes text default null,
  p_issue_now boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_subscription public.organization_subscriptions%rowtype;
  v_account public.organization_billing_accounts%rowtype;
  v_plan public.saas_plans%rowtype;
  v_order_id uuid; v_invoice_id uuid; v_order_number text; v_invoice_number text;
  v_subtotal numeric:=0; v_discount numeric:=0; v_tax numeric:=0; v_total numeric:=0; v_coupon jsonb; v_addon record; v_addon_data jsonb;
  v_due date; v_status text; v_period_start date; v_period_end date;
begin
  perform public.platform_assert_admin_v2('platform.billing.manage',true);
  if p_billing_interval not in ('monthly','yearly','custom') then raise exception 'INVALID_BILLING_INTERVAL'; end if;
  select * into v_plan from public.saas_plans where id=p_plan_id and is_active;
  if not found then raise exception 'PLAN_NOT_FOUND'; end if;
  select * into v_subscription from public.organization_subscriptions where organization_id=p_organization_id;
  if not found then raise exception 'SUBSCRIPTION_NOT_FOUND'; end if;
  select * into v_account from public.organization_billing_accounts where organization_id=p_organization_id;
  if not found then
    insert into public.organization_billing_accounts(organization_id,legal_name,billing_email,created_by)
    select o.id,o.name,ob.support_email,auth.uid() from public.organizations o left join public.organization_branding ob on ob.organization_id=o.id where o.id=p_organization_id
    returning * into v_account;
  end if;

  v_subtotal:=coalesce(public.platform_plan_price_v31(p_plan_id,p_billing_interval),0);
  v_order_number:=public.platform_next_commercial_number_v31('order');
  insert into public.billing_orders(order_number,organization_id,subscription_id,order_type,status,currency,subtotal,billing_interval,effective_at,expires_at,notes,created_by)
  values(v_order_number,p_organization_id,v_subscription.id,case when v_subscription.plan_id=p_plan_id then 'renewal' else 'plan_change' end,'approved',v_plan.currency,v_subtotal,p_billing_interval,now(),now()+interval '30 days',p_notes,auth.uid())
  returning id into v_order_id;
  insert into public.billing_order_lines(order_id,line_type,reference_id,description,quantity,unit_price,subtotal,sort_order)
  values(v_order_id,'plan',v_plan.id,v_plan.name||' · '||case when p_billing_interval='yearly' then 'Anual' else 'Mensual' end,1,v_subtotal,v_subtotal,10);

  for v_addon_data in select value from jsonb_array_elements(coalesce(p_addons,'[]'::jsonb)) loop
    select sa.*,greatest(coalesce((v_addon_data->>'quantity')::integer,1),0) quantity
    into v_addon from public.saas_addons sa where sa.id=(v_addon_data->>'addonId')::uuid and sa.is_active;
    if found and v_addon.quantity>0 then
      insert into public.billing_order_lines(order_id,line_type,reference_id,description,quantity,unit_price,subtotal,sort_order)
      values(v_order_id,'addon',v_addon.id,v_addon.name,v_addon.quantity,public.platform_addon_price_v31(v_addon.id,p_billing_interval),public.platform_addon_price_v31(v_addon.id,p_billing_interval)*v_addon.quantity,20);
      v_subtotal:=v_subtotal+(public.platform_addon_price_v31(v_addon.id,p_billing_interval)*v_addon.quantity);
    end if;
  end loop;

  v_coupon:=public.platform_calculate_coupon_v31(p_coupon_code,p_plan_id,p_organization_id,v_subtotal);
  if coalesce((v_coupon->>'valid')::boolean,false) then v_discount:=coalesce((v_coupon->>'discount')::numeric,0); end if;
  v_tax:=round(greatest(v_subtotal-v_discount,0)*(greatest(coalesce(p_tax_percent,0),0)/100),2);
  v_total:=greatest(v_subtotal-v_discount+v_tax,0);
  update public.billing_orders set subtotal=v_subtotal,discount_amount=v_discount,tax_amount=v_tax,total_amount=v_total,coupon_id=nullif(v_coupon->>'couponId','')::uuid,updated_at=now() where id=v_order_id;

  v_invoice_number:=public.platform_next_commercial_number_v31('invoice');
  v_due:=coalesce(p_due_date,current_date+v_account.payment_terms_days);
  v_status:=case when p_issue_now then 'issued' else 'draft' end;
  v_period_start:=current_date;
  v_period_end:=case when p_billing_interval='yearly' then (current_date+interval '1 year')::date-1 else (current_date+interval '1 month')::date-1 end;
  insert into public.billing_invoices(invoice_number,organization_id,billing_account_id,order_id,subscription_id,status,currency,issue_date,due_date,service_period_start,service_period_end,subtotal,discount_amount,tax_amount,total_amount,billing_snapshot,notes,issued_by,issued_at)
  values(v_invoice_number,p_organization_id,v_account.id,v_order_id,v_subscription.id,v_status,v_plan.currency,current_date,v_due,v_period_start,v_period_end,v_subtotal,v_discount,v_tax,v_total,to_jsonb(v_account),p_notes,auth.uid(),case when p_issue_now then now() else null end)
  returning id into v_invoice_id;

  insert into public.billing_invoice_lines(invoice_id,line_type,reference_id,description,quantity,unit_price,subtotal,metadata,sort_order)
  select v_invoice_id,line_type,reference_id,description,quantity,unit_price,subtotal,metadata,sort_order from public.billing_order_lines where order_id=v_order_id;
  if v_discount>0 then insert into public.billing_invoice_lines(invoice_id,line_type,reference_id,description,quantity,unit_price,subtotal,sort_order) values(v_invoice_id,'discount',null,'Descuento '||coalesce(p_coupon_code,''),1,-v_discount,-v_discount,90); end if;
  if v_tax>0 then insert into public.billing_invoice_lines(invoice_id,line_type,reference_id,description,quantity,unit_price,subtotal,sort_order) values(v_invoice_id,'tax',null,'Impuestos',1,v_tax,v_tax,100); end if;
  update public.billing_orders set status='invoiced',updated_at=now() where id=v_order_id;
  update public.organization_subscriptions set last_invoice_id=v_invoice_id,updated_at=now() where id=v_subscription.id;

  if coalesce((v_coupon->>'valid')::boolean,false) then
    insert into public.commercial_coupon_redemptions(coupon_id,organization_id,order_id,discount_amount,redeemed_by) values((v_coupon->>'couponId')::uuid,p_organization_id,v_order_id,v_discount,auth.uid());
    update public.commercial_coupons set redemption_count=redemption_count+1,updated_at=now() where id=(v_coupon->>'couponId')::uuid;
  end if;
  insert into public.commercial_events(organization_id,subscription_id,invoice_id,event_type,actor_user_id,description,metadata)
  values(p_organization_id,v_subscription.id,v_invoice_id,'invoice.created',auth.uid(),'Factura creada desde el Super Admin',jsonb_build_object('orderId',v_order_id,'invoiceNumber',v_invoice_number));
  return jsonb_build_object('orderId',v_order_id,'orderNumber',v_order_number,'invoiceId',v_invoice_id,'invoiceNumber',v_invoice_number,'totalAmount',v_total,'coupon',v_coupon);
end;
$$;

create or replace function public.platform_register_payment_v31(
  p_invoice_id uuid,
  p_amount numeric,
  p_method text,
  p_reference text default null,
  p_paid_at timestamptz default now(),
  p_notes text default null,
  p_confirm boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare v_invoice public.billing_invoices%rowtype; v_payment_id uuid; v_number text; v_allocate numeric; v_result public.billing_invoices%rowtype;
begin
  perform public.platform_assert_admin_v2('platform.billing.manage',true);
  select * into v_invoice from public.billing_invoices where id=p_invoice_id for update;
  if not found then raise exception 'INVOICE_NOT_FOUND'; end if;
  if v_invoice.status in ('void','paid') then raise exception 'INVOICE_NOT_PAYABLE'; end if;
  if p_amount<=0 then raise exception 'INVALID_PAYMENT_AMOUNT'; end if;
  v_number:=public.platform_next_commercial_number_v31('payment');
  insert into public.billing_payments(payment_number,organization_id,status,method,currency,amount,paid_at,reference,notes,registered_by,confirmed_by,confirmed_at)
  values(v_number,v_invoice.organization_id,case when p_confirm then 'confirmed' else 'pending' end,p_method,v_invoice.currency,p_amount,coalesce(p_paid_at,now()),p_reference,p_notes,auth.uid(),case when p_confirm then auth.uid() else null end,case when p_confirm then now() else null end)
  returning id into v_payment_id;
  v_allocate:=least(p_amount,v_invoice.balance_due);
  insert into public.billing_payment_allocations(payment_id,invoice_id,amount) values(v_payment_id,p_invoice_id,v_allocate);
  if p_confirm then v_result:=public.platform_recalculate_invoice_v31(p_invoice_id); else v_result:=v_invoice; end if;
  insert into public.commercial_events(organization_id,subscription_id,invoice_id,payment_id,event_type,actor_user_id,description,metadata)
  values(v_invoice.organization_id,v_invoice.subscription_id,p_invoice_id,v_payment_id,case when p_confirm then 'payment.confirmed' else 'payment.registered' end,auth.uid(),'Pago registrado desde el Super Admin',jsonb_build_object('paymentNumber',v_number,'amount',p_amount,'allocated',v_allocate));
  return jsonb_build_object('paymentId',v_payment_id,'paymentNumber',v_number,'invoiceStatus',v_result.status,'balanceDue',v_result.balance_due);
end;
$$;

create or replace function public.platform_void_invoice_v31(p_invoice_id uuid,p_reason text)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare v_invoice public.billing_invoices%rowtype;
begin
  perform public.platform_assert_admin_v2('platform.billing.manage',true);
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'REASON_REQUIRED'; end if;
  select * into v_invoice from public.billing_invoices where id=p_invoice_id for update;
  if not found then raise exception 'INVOICE_NOT_FOUND'; end if;
  if v_invoice.amount_paid>0 then raise exception 'PAID_INVOICE_CANNOT_BE_VOIDED'; end if;
  update public.billing_invoices set status='void',voided_by=auth.uid(),voided_at=now(),void_reason=p_reason,updated_at=now() where id=p_invoice_id;
  insert into public.commercial_events(organization_id,subscription_id,invoice_id,event_type,actor_user_id,description)
  values(v_invoice.organization_id,v_invoice.subscription_id,p_invoice_id,'invoice.voided',auth.uid(),p_reason);
  return jsonb_build_object('id',p_invoice_id,'status','void');
end;
$$;

create or replace function public.platform_update_billing_account_v31(p_organization_id uuid,p_payload jsonb,p_reason text)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare v_id uuid; v_old jsonb; v_new jsonb;
begin
  perform public.platform_assert_admin_v2('platform.billing.manage',true);
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'REASON_REQUIRED'; end if;
  select to_jsonb(oba) into v_old from public.organization_billing_accounts oba where oba.organization_id=p_organization_id;
  insert into public.organization_billing_accounts(organization_id,legal_name,tax_id,billing_email,billing_phone,contact_name,address_line,city,country_code,tax_regime,payment_terms_days,purchase_order_required,purchase_order_prefix,status,metadata,created_by,updated_by)
  select p_organization_id,coalesce(nullif(trim(p_payload->>'legalName'),''),o.name),nullif(trim(p_payload->>'taxId'),''),nullif(trim(p_payload->>'billingEmail'),''),nullif(trim(p_payload->>'billingPhone'),''),nullif(trim(p_payload->>'contactName'),''),
    nullif(trim(p_payload->>'addressLine'),''),nullif(trim(p_payload->>'city'),''),coalesce(nullif(trim(p_payload->>'countryCode'),''),'CO'),nullif(trim(p_payload->>'taxRegime'),''),coalesce((p_payload->>'paymentTermsDays')::integer,15),
    coalesce((p_payload->>'purchaseOrderRequired')::boolean,false),nullif(trim(p_payload->>'purchaseOrderPrefix'),''),coalesce(nullif(p_payload->>'status',''),'active'),coalesce(p_payload->'metadata','{}'::jsonb),auth.uid(),auth.uid()
  from public.organizations o where o.id=p_organization_id
  on conflict(organization_id) do update set
    legal_name=excluded.legal_name,tax_id=excluded.tax_id,billing_email=excluded.billing_email,billing_phone=excluded.billing_phone,contact_name=excluded.contact_name,address_line=excluded.address_line,city=excluded.city,country_code=excluded.country_code,tax_regime=excluded.tax_regime,payment_terms_days=excluded.payment_terms_days,purchase_order_required=excluded.purchase_order_required,purchase_order_prefix=excluded.purchase_order_prefix,status=excluded.status,metadata=excluded.metadata,updated_by=auth.uid(),updated_at=now()
  returning id into v_id;
  select to_jsonb(oba) into v_new from public.organization_billing_accounts oba where oba.id=v_id;
  perform public.platform_insert_audit_v1(p_organization_id,'platform','billing.account.updated','organization_billing_accounts',v_id::text,v_old,v_new,jsonb_build_object('reason',p_reason));
  return v_new;
end;
$$;

-- =========================================================
-- 9. CICLO DE SUSCRIPCIÓN, SOLICITUDES Y AUTOSERVICIO
-- =========================================================

create or replace function public.platform_schedule_subscription_change_v31(
  p_organization_id uuid,
  p_plan_id uuid,
  p_billing_interval text,
  p_effective_mode text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare v_sub public.organization_subscriptions%rowtype; v_effective timestamptz;
begin
  perform public.platform_assert_admin_v2('platform.commercial.manage',true);
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'REASON_REQUIRED'; end if;
  if not exists(select 1 from public.saas_plans where id=p_plan_id and is_active) then raise exception 'PLAN_NOT_FOUND'; end if;
  select * into v_sub from public.organization_subscriptions where organization_id=p_organization_id for update;
  if not found then raise exception 'SUBSCRIPTION_NOT_FOUND'; end if;
  if p_effective_mode='immediate' then
    update public.organization_subscriptions set plan_id=p_plan_id,billing_interval=p_billing_interval,next_plan_id=null,next_billing_interval=null,next_change_at=null,updated_at=now() where id=v_sub.id;
    v_effective:=now();
  else
    v_effective:=coalesce(v_sub.current_period_end,now());
    update public.organization_subscriptions set next_plan_id=p_plan_id,next_billing_interval=p_billing_interval,next_change_at=v_effective,updated_at=now() where id=v_sub.id;
  end if;
  insert into public.organization_subscription_events(organization_id,subscription_id,event_type,reason,previous_data,new_data,performed_by)
  values(p_organization_id,v_sub.id,'plan_change_scheduled',p_reason,to_jsonb(v_sub),jsonb_build_object('planId',p_plan_id,'billingInterval',p_billing_interval,'effectiveAt',v_effective,'mode',p_effective_mode),auth.uid());
  insert into public.commercial_events(organization_id,subscription_id,event_type,actor_user_id,description,metadata)
  values(p_organization_id,v_sub.id,'subscription.plan_change',auth.uid(),p_reason,jsonb_build_object('planId',p_plan_id,'billingInterval',p_billing_interval,'effectiveAt',v_effective,'mode',p_effective_mode));
  return jsonb_build_object('subscriptionId',v_sub.id,'effectiveAt',v_effective,'mode',p_effective_mode);
end;
$$;

create or replace function public.platform_set_subscription_cancellation_v31(p_organization_id uuid,p_cancel_at_period_end boolean,p_reason text)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare v_sub public.organization_subscriptions%rowtype;
begin
  perform public.platform_assert_admin_v2('platform.commercial.manage',true);
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'REASON_REQUIRED'; end if;
  select * into v_sub from public.organization_subscriptions where organization_id=p_organization_id for update;
  if not found then raise exception 'SUBSCRIPTION_NOT_FOUND'; end if;
  update public.organization_subscriptions set cancel_at_period_end=p_cancel_at_period_end,cancellation_reason=case when p_cancel_at_period_end then p_reason else null end,cancelled_at=case when p_cancel_at_period_end then now() else null end,updated_at=now() where id=v_sub.id;
  insert into public.commercial_events(organization_id,subscription_id,event_type,actor_user_id,description,metadata)
  values(p_organization_id,v_sub.id,case when p_cancel_at_period_end then 'subscription.cancellation_scheduled' else 'subscription.cancellation_revoked' end,auth.uid(),p_reason,jsonb_build_object('periodEnd',v_sub.current_period_end));
  return jsonb_build_object('subscriptionId',v_sub.id,'cancelAtPeriodEnd',p_cancel_at_period_end,'periodEnd',v_sub.current_period_end);
end;
$$;

create or replace function public.organization_get_subscription_portal_v31()
returns jsonb
language plpgsql
stable
security definer
set search_path=public,auth
as $$
declare v_org uuid:=public.platform_current_organization_id_v1();
begin
  if auth.uid() is null or v_org is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if not exists(select 1 from public.organization_members where organization_id=v_org and user_id=auth.uid() and is_active) then raise exception 'ORGANIZATION_ACCESS_DENIED' using errcode='42501'; end if;
  return jsonb_build_object(
    'organization',coalesce((select jsonb_build_object('id',o.id,'name',o.name,'slug',o.slug,'isActive',o.is_active) from public.organizations o where o.id=v_org),'{}'::jsonb),
    'subscription',coalesce((select jsonb_build_object('id',os.id,'status',os.status,'planId',os.plan_id,'planName',sp.name,'planCode',sp.code,'billingInterval',os.billing_interval,'currentPeriodStart',os.current_period_start,'currentPeriodEnd',os.current_period_end,'trialEndsAt',os.trial_ends_at,'autoRenew',os.auto_renew,'cancelAtPeriodEnd',os.cancel_at_period_end,'nextPlanId',os.next_plan_id,'nextPlanName',nsp.name,'nextBillingInterval',os.next_billing_interval,'nextChangeAt',os.next_change_at,'limits',sp.limits||os.limits_override,'features',sp.features)
      from public.organization_subscriptions os join public.saas_plans sp on sp.id=os.plan_id left join public.saas_plans nsp on nsp.id=os.next_plan_id where os.organization_id=v_org),'{}'::jsonb),
    'billingAccount',coalesce((select jsonb_build_object('legalName',oba.legal_name,'taxId',oba.tax_id,'billingEmail',oba.billing_email,'billingPhone',oba.billing_phone,'contactName',oba.contact_name,'addressLine',oba.address_line,'city',oba.city,'countryCode',oba.country_code,'taxRegime',oba.tax_regime,'paymentTermsDays',oba.payment_terms_days,'status',oba.status) from public.organization_billing_accounts oba where oba.organization_id=v_org),'{}'::jsonb),
    'invoices',coalesce((select jsonb_agg(jsonb_build_object('id',bi.id,'invoiceNumber',bi.invoice_number,'status',bi.status,'issueDate',bi.issue_date,'dueDate',bi.due_date,'totalAmount',bi.total_amount,'amountPaid',bi.amount_paid,'balanceDue',bi.balance_due,'currency',bi.currency) order by bi.issue_date desc) from public.billing_invoices bi where bi.organization_id=v_org),'[]'::jsonb),
    'payments',coalesce((select jsonb_agg(jsonb_build_object('id',bp.id,'paymentNumber',bp.payment_number,'status',bp.status,'method',bp.method,'amount',bp.amount,'paidAt',bp.paid_at,'reference',bp.reference) order by bp.paid_at desc) from public.billing_payments bp where bp.organization_id=v_org),'[]'::jsonb),
    'requests',coalesce((select jsonb_agg(jsonb_build_object('id',scr.id,'requestType',scr.request_type,'requestedPayload',scr.requested_payload,'reason',scr.reason,'status',scr.status,'requestedAt',scr.requested_at,'reviewNotes',scr.review_notes) order by scr.requested_at desc) from public.subscription_change_requests scr where scr.organization_id=v_org),'[]'::jsonb),
    'plans',coalesce((select jsonb_agg(jsonb_build_object('id',sp.id,'code',sp.code,'name',sp.name,'description',sp.description,'monthlyPriceCop',sp.monthly_price_cop,'annualPriceCop',sp.annual_price_cop,'currency',sp.currency,'limits',sp.limits,'features',sp.features) order by sp.sort_order,sp.monthly_price_cop) from public.saas_plans sp where sp.is_public and sp.is_active),'[]'::jsonb),
    'addons',coalesce((select jsonb_agg(jsonb_build_object('id',sa.id,'code',sa.code,'name',sa.name,'description',sa.description,'unitName',sa.unit_name,'monthlyPriceCop',sa.monthly_price_cop,'annualPriceCop',sa.annual_price_cop,'currency',sa.currency) order by sa.sort_order,sa.name) from public.saas_addons sa where sa.is_public and sa.is_active),'[]'::jsonb),
    'canManage',public.platform_member_can_manage_subscription_v31(v_org)
  );
end;
$$;

create or replace function public.organization_request_subscription_change_v31(p_request_type text,p_payload jsonb,p_reason text)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare v_org uuid:=public.platform_current_organization_id_v1(); v_sub uuid; v_id uuid;
begin
  if auth.uid() is null or v_org is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if not public.platform_member_can_manage_subscription_v31(v_org) then raise exception 'SUBSCRIPTION_ACCESS_DENIED' using errcode='42501'; end if;
  if p_request_type not in ('plan_change','cancel','reactivate','addon_change','billing_update','renewal') then raise exception 'INVALID_REQUEST_TYPE'; end if;
  if length(trim(coalesce(p_reason,'')))<5 then raise exception 'REASON_REQUIRED'; end if;
  select id into v_sub from public.organization_subscriptions where organization_id=v_org;
  insert into public.subscription_change_requests(organization_id,subscription_id,request_type,requested_payload,reason,requested_by)
  values(v_org,v_sub,p_request_type,coalesce(p_payload,'{}'::jsonb),trim(p_reason),auth.uid()) returning id into v_id;
  insert into public.platform_notifications(recipient_user_id,type,title,message,action_url,organization_id,metadata)
  select pa.user_id,'commercial_request','Nueva solicitud comercial','La organización solicitó '||p_request_type,'/superadmin/commercial',v_org,jsonb_build_object('requestId',v_id)
  from public.platform_admins pa where pa.is_active and ('platform.commercial.view'=any(public.platform_permissions_for_user_v2(pa.user_id)) or 'platform.*'=any(public.platform_permissions_for_user_v2(pa.user_id)));
  return jsonb_build_object('id',v_id,'status','pending');
end;
$$;

create or replace function public.platform_review_subscription_request_v31(p_request_id uuid,p_decision text,p_notes text,p_apply boolean default false)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare v_req public.subscription_change_requests%rowtype; v_result jsonb:='{}'::jsonb;
begin
  perform public.platform_assert_admin_v2('platform.commercial.manage',true);
  if p_decision not in ('approved','rejected','in_review') then raise exception 'INVALID_DECISION'; end if;
  if length(trim(coalesce(p_notes,'')))<3 then raise exception 'NOTES_REQUIRED'; end if;
  select * into v_req from public.subscription_change_requests where id=p_request_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if v_req.status not in ('pending','in_review','approved') then raise exception 'REQUEST_ALREADY_CLOSED'; end if;
  update public.subscription_change_requests set status=p_decision,reviewed_by=auth.uid(),reviewed_at=now(),review_notes=p_notes,updated_at=now() where id=p_request_id;
  if p_decision='approved' and p_apply then
    if v_req.request_type='plan_change' then
      v_result:=public.platform_schedule_subscription_change_v31(v_req.organization_id,(v_req.requested_payload->>'planId')::uuid,coalesce(v_req.requested_payload->>'billingInterval','monthly'),coalesce(v_req.requested_payload->>'effectiveMode','period_end'),p_notes);
    elsif v_req.request_type='cancel' then
      v_result:=public.platform_set_subscription_cancellation_v31(v_req.organization_id,true,p_notes);
    elsif v_req.request_type='reactivate' then
      v_result:=public.platform_set_subscription_cancellation_v31(v_req.organization_id,false,p_notes);
      update public.organization_subscriptions set status='active',updated_at=now() where organization_id=v_req.organization_id and status in ('cancelled','suspended','past_due');
    elsif v_req.request_type='billing_update' then
      v_result:=public.platform_update_billing_account_v31(v_req.organization_id,v_req.requested_payload,p_notes);
    end if;
    update public.subscription_change_requests set status='applied',applied_at=now(),updated_at=now() where id=p_request_id;
  end if;
  perform public.platform_notify_org_admins_v2(v_req.organization_id,'Actualización de solicitud comercial','La solicitud '||v_req.request_type||' fue marcada como '||case when p_apply and p_decision='approved' then 'aplicada' else p_decision end,'/subscription',jsonb_build_object('requestId',p_request_id));
  return jsonb_build_object('id',p_request_id,'status',case when p_apply and p_decision='approved' then 'applied' else p_decision end,'result',v_result);
end;
$$;

-- =========================================================
-- 10. ONBOARDING Y APROVISIONAMIENTO
-- =========================================================

create or replace function public.platform_seed_organization_catalogs_v31(p_organization_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_admin_role uuid; v_view_role uuid;
begin
  insert into public.roles(organization_id,code,name,description,is_system,is_active)
  values(p_organization_id,'ADMIN','Administrador','Control completo de la organización.',true,true)
  on conflict do nothing;
  select id into v_admin_role from public.roles where organization_id=p_organization_id and code='ADMIN' limit 1;
  insert into public.roles(organization_id,code,name,description,is_system,is_active)
  values(p_organization_id,'CONSULTA','Consulta','Acceso de solo consulta.',true,true)
  on conflict do nothing;
  select id into v_view_role from public.roles where organization_id=p_organization_id and code='CONSULTA' limit 1;
  insert into public.role_permissions(role_id,permission_id) select v_admin_role,p.id from public.permissions p on conflict do nothing;
  insert into public.role_permissions(role_id,permission_id)
  select v_view_role,p.id from public.permissions p where p.code in ('case.read_all','reports.view','audit.view') on conflict do nothing;

  insert into public.areas(organization_id,code,name,sort_order,is_active) values
    (p_organization_id,'GERENCIA','Gerencia',10,true),(p_organization_id,'ADMIN','Administrativa',20,true),(p_organization_id,'TEC','Tecnología',30,true)
  on conflict do nothing;
  insert into public.priorities(organization_id,code,name,color,sort_order,is_active) values
    (p_organization_id,'LOW','Baja','#10b981',10,true),(p_organization_id,'MEDIUM','Media','#f59e0b',20,true),(p_organization_id,'HIGH','Alta','#f97316',30,true),(p_organization_id,'CRITICAL','Crítica','#ef4444',40,true)
  on conflict do nothing;
  insert into public.case_states(organization_id,code,name,sort_order,is_initial,is_terminal,is_active) values
    (p_organization_id,'PENDING_CLASSIFICATION','Pendiente de Clasificación',10,true,false,true),
    (p_organization_id,'IN_PROGRESS','En Gestión',20,false,false,true),
    (p_organization_id,'CLOSED','Cerrado',30,false,true,true),
    (p_organization_id,'CANCELLED','Cancelado',40,false,true,true)
  on conflict do nothing;
  insert into public.case_types(organization_id,code,name,description,is_active,is_public_enabled,is_internal_enabled,sort_order) values
    (p_organization_id,'REQUEST','Solicitud','Solicitud general de la organización.',true,true,true,10),
    (p_organization_id,'INTERNAL','Requerimiento interno','Seguimiento de requerimientos internos.',true,false,true,20)
  on conflict do nothing;
  return jsonb_build_object('adminRoleId',v_admin_role,'viewRoleId',v_view_role);
end;
$$;

create or replace function public.platform_provision_organization_v31(
  p_name text,
  p_slug text,
  p_admin_email text,
  p_plan_id uuid,
  p_billing_interval text default 'monthly',
  p_trial_days integer default null,
  p_reason text default 'Aprovisionamiento desde Super Admin'
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare v_org uuid; v_sub uuid; v_admin_role uuid; v_invitation uuid; v_trial integer; v_period_end timestamptz; v_catalog jsonb;
begin
  perform public.platform_assert_admin_v2('platform.onboarding.manage',true);
  if length(trim(coalesce(p_name,'')))<3 then raise exception 'ORGANIZATION_NAME_REQUIRED'; end if;
  if trim(coalesce(p_slug,'')) !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then raise exception 'INVALID_SLUG'; end if;
  if p_admin_email !~* '^[^@]+@[^@]+\.[^@]+$' then raise exception 'INVALID_ADMIN_EMAIL'; end if;
  if not exists(select 1 from public.saas_plans where id=p_plan_id and is_active) then raise exception 'PLAN_NOT_FOUND'; end if;
  if exists(select 1 from public.organizations where slug=lower(trim(p_slug))) then raise exception 'ORGANIZATION_SLUG_EXISTS'; end if;
  select coalesce(p_trial_days,trial_days) into v_trial from public.saas_plans where id=p_plan_id;
  v_period_end:=case when v_trial>0 then now()+make_interval(days=>v_trial) when p_billing_interval='yearly' then now()+interval '1 year' else now()+interval '1 month' end;
  insert into public.organizations(name,slug,is_active,settings,created_by) values(trim(p_name),lower(trim(p_slug)),true,jsonb_build_object('provisionedBy','phase3.1','provisionedAt',now()),auth.uid()) returning id into v_org;
  insert into public.organization_branding(organization_id,product_name,short_name,primary_color,accent_color,sidebar_color,support_email)
  values(v_org,trim(p_name),left(trim(p_name),30),'#7c3aed','#f97316','#111827',lower(trim(p_admin_email)));
  insert into public.organization_subscriptions(organization_id,plan_id,status,trial_ends_at,current_period_start,current_period_end,billing_interval,auto_renew,collection_mode)
  values(v_org,p_plan_id,case when v_trial>0 then 'trialing' else 'active' end,case when v_trial>0 then v_period_end else null end,now(),v_period_end,p_billing_interval,true,'manual') returning id into v_sub;
  insert into public.organization_billing_accounts(organization_id,legal_name,billing_email,status,created_by) values(v_org,trim(p_name),lower(trim(p_admin_email)),'incomplete',auth.uid());
  v_catalog:=public.platform_seed_organization_catalogs_v31(v_org);
  v_admin_role:=(v_catalog->>'adminRoleId')::uuid;
  insert into public.organization_invitations(organization_id,email,role_id,status,invited_by,expires_at)
  values(v_org,lower(trim(p_admin_email)),v_admin_role,'pending',auth.uid(),now()+interval '14 days') returning id into v_invitation;
  insert into public.organization_onboarding(organization_id,status,current_step,progress,admin_email,assigned_to,started_at,created_by,updated_by,checklist)
  values(v_org,'in_progress','billing',20,lower(trim(p_admin_email)),auth.uid(),now(),auth.uid(),auth.uid(),jsonb_build_object('organization',true,'billing',false,'branding',true,'adminInvitation',true,'catalogs',true,'security',false,'goLive',false));
  insert into public.organization_feature_flags(organization_id,feature_code,enabled,configuration,source)
  select v_org,key,case when jsonb_typeof(value)='boolean' then (value::text)::boolean else true end,'{}'::jsonb,'plan'
  from public.saas_plans sp cross join lateral jsonb_each(sp.features) where sp.id=p_plan_id
  on conflict(organization_id,feature_code) do update set enabled=excluded.enabled,source='plan',updated_at=now();
  insert into public.commercial_events(organization_id,subscription_id,event_type,actor_user_id,description,metadata)
  values(v_org,v_sub,'organization.provisioned',auth.uid(),p_reason,jsonb_build_object('adminEmail',p_admin_email,'invitationId',v_invitation,'trialDays',v_trial));
  return jsonb_build_object('organizationId',v_org,'subscriptionId',v_sub,'invitationId',v_invitation,'trialEndsAt',case when v_trial>0 then v_period_end else null end,'status',case when v_trial>0 then 'trialing' else 'active' end);
end;
$$;

create or replace function public.platform_list_onboarding_v31(p_status text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,auth
as $$
begin
  perform public.platform_assert_admin_v2('platform.onboarding.view',false);
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',oo.id,'organizationId',oo.organization_id,'organizationName',o.name,'organizationSlug',o.slug,'status',oo.status,'currentStep',oo.current_step,'progress',oo.progress,
    'checklist',oo.checklist,'adminEmail',oo.admin_email,'assignedTo',oo.assigned_to,'assignedToName',p.name,'blockingReason',oo.blocking_reason,'notes',oo.notes,
    'startedAt',oo.started_at,'completedAt',oo.completed_at,'createdAt',oo.created_at,'updatedAt',oo.updated_at,
    'planName',sp.name,'subscriptionStatus',os.status,'periodEnd',os.current_period_end
  ) order by oo.updated_at desc) from public.organization_onboarding oo join public.organizations o on o.id=oo.organization_id left join public.profiles p on p.id=oo.assigned_to left join public.organization_subscriptions os on os.organization_id=o.id left join public.saas_plans sp on sp.id=os.plan_id where p_status is null or p_status='' or oo.status=p_status),'[]'::jsonb);
end;
$$;

create or replace function public.platform_update_onboarding_v31(p_organization_id uuid,p_status text,p_current_step text,p_checklist jsonb,p_notes text,p_blocking_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare v_progress integer; v_result public.organization_onboarding%rowtype;
begin
  perform public.platform_assert_admin_v2('platform.onboarding.manage',true);
  if p_status not in ('not_started','in_progress','blocked','completed','cancelled') then raise exception 'INVALID_ONBOARDING_STATUS'; end if;
  select round(100.0*count(*) filter(where value='true'::jsonb)/greatest(count(*),1))::integer into v_progress from jsonb_each(coalesce(p_checklist,'{}'::jsonb));
  insert into public.organization_onboarding(organization_id,status,current_step,progress,checklist,assigned_to,blocking_reason,notes,started_at,completed_at,created_by,updated_by)
  values(p_organization_id,p_status,coalesce(nullif(p_current_step,''),'organization'),v_progress,coalesce(p_checklist,'{}'::jsonb),auth.uid(),p_blocking_reason,p_notes,case when p_status<>'not_started' then now() else null end,case when p_status='completed' then now() else null end,auth.uid(),auth.uid())
  on conflict(organization_id) do update set status=excluded.status,current_step=excluded.current_step,progress=excluded.progress,checklist=excluded.checklist,assigned_to=coalesce(public.organization_onboarding.assigned_to,auth.uid()),blocking_reason=excluded.blocking_reason,notes=excluded.notes,started_at=coalesce(public.organization_onboarding.started_at,excluded.started_at),completed_at=excluded.completed_at,updated_by=auth.uid(),updated_at=now()
  returning * into v_result;
  if p_status='completed' then update public.organizations set is_active=true,updated_at=now() where id=p_organization_id; end if;
  return jsonb_build_object('id',v_result.id,'organizationId',v_result.organization_id,'status',v_result.status,'progress',v_result.progress,'currentStep',v_result.current_step,'checklist',v_result.checklist);
end;
$$;

-- =========================================================
-- 11. SCHEDULER COMERCIAL Y RENOVACIONES
-- =========================================================

create or replace function public.platform_commercial_tick_v31()
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare v_overdue integer:=0; v_changes integer:=0; v_cancelled integer:=0; v_suspended integer:=0; v_notified integer:=0; r record;
begin
  if not public.platform_is_service_role_v2() and not public.platform_is_admin_v2('platform.operations.manage') then raise exception 'PLATFORM_ACCESS_DENIED' using errcode='42501'; end if;

  update public.billing_invoices set status='overdue',updated_at=now()
  where status in ('issued','partially_paid') and due_date<current_date and balance_due>0;
  get diagnostics v_overdue=row_count;

  for r in select os.*,sp.grace_days from public.organization_subscriptions os join public.saas_plans sp on sp.id=os.plan_id where os.next_plan_id is not null and os.next_change_at<=now() for update skip locked loop
    update public.organization_subscriptions set plan_id=r.next_plan_id,billing_interval=coalesce(r.next_billing_interval,billing_interval),next_plan_id=null,next_billing_interval=null,next_change_at=null,updated_at=now() where id=r.id;
    insert into public.commercial_events(organization_id,subscription_id,event_type,description,metadata) values(r.organization_id,r.id,'subscription.scheduled_change_applied','Cambio programado aplicado por scheduler',jsonb_build_object('previousPlanId',r.plan_id,'newPlanId',r.next_plan_id));
    v_changes:=v_changes+1;
  end loop;

  update public.organization_subscriptions set status='cancelled',cancelled_at=coalesce(cancelled_at,now()),updated_at=now()
  where cancel_at_period_end and current_period_end<=now() and status<>'cancelled';
  get diagnostics v_cancelled=row_count;

  update public.organization_subscriptions os set status='past_due',updated_at=now()
  from public.saas_plans sp
  where sp.id=os.plan_id and os.status in ('active','trialing') and os.current_period_end<now() and not os.cancel_at_period_end;

  update public.organization_subscriptions os set status='suspended',updated_at=now()
  from public.saas_plans sp
  where sp.id=os.plan_id and os.status='past_due' and os.current_period_end+make_interval(days=>sp.grace_days)<now()
    and exists(select 1 from public.billing_invoices bi where bi.subscription_id=os.id and bi.status='overdue' and bi.balance_due>0);
  get diagnostics v_suspended=row_count;

  -- Alertas a 15, 7 y 2 días, deduplicadas por metadata.
  for r in
    select os.id subscription_id,os.organization_id,os.current_period_end,o.name,extract(day from os.current_period_end-now())::integer days_left
    from public.organization_subscriptions os join public.organizations o on o.id=os.organization_id
    where os.status in ('active','trialing') and os.current_period_end>now() and os.current_period_end<=now()+interval '15 days'
  loop
    if r.days_left in (15,7,2,1,0) and not exists(select 1 from public.commercial_events ce where ce.subscription_id=r.subscription_id and ce.event_type='subscription.expiry_notice' and ce.metadata->>'daysLeft'=r.days_left::text and ce.created_at>now()-interval '20 days') then
      perform public.platform_notify_org_admins_v2(r.organization_id,'Vigencia de suscripción próxima a finalizar','La suscripción finaliza en '||r.days_left||' día(s).','/subscription',jsonb_build_object('daysLeft',r.days_left,'periodEnd',r.current_period_end));
      insert into public.commercial_events(organization_id,subscription_id,event_type,description,metadata) values(r.organization_id,r.subscription_id,'subscription.expiry_notice','Aviso automático de vencimiento',jsonb_build_object('daysLeft',r.days_left,'periodEnd',r.current_period_end));
      v_notified:=v_notified+1;
    end if;
  end loop;

  return jsonb_build_object('overdueInvoices',v_overdue,'scheduledChangesApplied',v_changes,'subscriptionsCancelled',v_cancelled,'subscriptionsSuspended',v_suspended,'notificationsSent',v_notified,'generatedAt',now());
end;
$$;

-- Reemplaza el scheduler central conservando la lógica de Fase 2 y añadiendo comercial.
create or replace function public.platform_scheduler_tick_v2()
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare scheduler_run_id uuid; declare backup_job_id uuid; declare schedule_row record; declare backup_ids uuid[]:='{}'::uuid[]; declare expired_sessions integer:=0; declare expired_requests integer:=0; declare breached_tickets integer:=0; declare snap_count integer:=0; declare metric record; declare org_row record; declare effective jsonb; declare current_row public.organization_usage_snapshots%rowtype; declare limit_value numeric; declare current_value numeric; declare pct numeric; declare sev text; declare commercial_result jsonb;
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
    if current_row.organization_id is null then continue; end if;
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

  commercial_result:=public.platform_commercial_tick_v31();
  update public.platform_job_runs set status='success',output=jsonb_build_object('expiredRequests',expired_requests,'expiredSessions',expired_sessions,'breachedTickets',breached_tickets,'snapshots',snap_count,'backupJobIds',to_jsonb(backup_ids),'commercial',commercial_result),finished_at=now() where id=scheduler_run_id;
  return jsonb_build_object('jobRunId',scheduler_run_id,'expiredRequests',expired_requests,'expiredSessions',expired_sessions,'breachedTickets',breached_tickets,'snapshots',snap_count,'backupJobIds',to_jsonb(backup_ids),'commercial',commercial_result);
exception when others then
  if scheduler_run_id is not null then update public.platform_job_runs set status='failed',error_message=sqlerrm,finished_at=now() where id=scheduler_run_id; end if;
  raise;
end;
$$;

-- =========================================================
-- 12. DATOS INICIALES DE FASE 3.1
-- =========================================================

update public.saas_plans set
  annual_price_cop=case code when 'essential' then 1290000 when 'professional' then 2990000 when 'enterprise' then 6990000 else case when monthly_price_cop>0 then monthly_price_cop*10 else annual_price_cop end end,
  trial_days=case code when 'enterprise' then 30 else 14 end,
  grace_days=case code when 'enterprise' then 15 else 5 end,
  billing_intervals=array['monthly','yearly'],
  currency='COP',
  version=greatest(version,1),
  updated_at=now()
where is_active;

insert into public.saas_addons(code,name,description,unit_name,monthly_price_cop,annual_price_cop,limits_delta,features_delta,min_quantity,max_quantity,is_public,is_active,sort_order) values
('extra_user','Usuario adicional','Cupo adicional de usuario activo.','usuario',45000,450000,'{"users":1}'::jsonb,'{}'::jsonb,1,500,true,true,10),
('storage_10gb','Almacenamiento adicional 10 GB','Bloque adicional de almacenamiento documental.','bloque',65000,650000,'{"storage_bytes":10737418240}'::jsonb,'{}'::jsonb,1,100,true,true,20),
('priority_support','Soporte prioritario','Atención prioritaria y SLA comercial ampliado.','servicio',280000,2800000,'{}'::jsonb,'{"priority_support":true}'::jsonb,1,1,true,true,30)
on conflict(code) do update set name=excluded.name,description=excluded.description,unit_name=excluded.unit_name,monthly_price_cop=excluded.monthly_price_cop,annual_price_cop=excluded.annual_price_cop,limits_delta=excluded.limits_delta,features_delta=excluded.features_delta,is_active=true,updated_at=now();

insert into public.commercial_coupons(code,name,description,discount_type,discount_value,valid_from,valid_until,max_redemptions,first_purchase_only,is_active) values
('BIENVENIDA20','Bienvenida 20 %','Descuento de lanzamiento para la primera compra.','percentage',20,now()-interval '1 day',now()+interval '1 year',100,true,true),
('ANUAL10','Plan anual 10 %','Descuento comercial para contratación anual.','percentage',10,now()-interval '1 day',now()+interval '2 years',null,false,true)
on conflict(code) do update set name=excluded.name,description=excluded.description,discount_type=excluded.discount_type,discount_value=excluded.discount_value,valid_from=excluded.valid_from,valid_until=excluded.valid_until,is_active=true,updated_at=now();

insert into public.organization_billing_accounts(organization_id,legal_name,billing_email,contact_name,status,created_by)
select o.id,o.name,coalesce(ob.support_email,'facturacion@'||replace(o.slug,'-','')||'.example'),null,'incomplete',o.created_by
from public.organizations o left join public.organization_branding ob on ob.organization_id=o.id
on conflict(organization_id) do nothing;

insert into public.organization_onboarding(organization_id,status,current_step,progress,checklist,admin_email,started_at,completed_at,created_by,updated_by)
select o.id,
  case when o.slug in ('seguridad-atlas','grupo-nova','vigia-integral') then 'completed' else 'in_progress' end,
  case when o.slug in ('seguridad-atlas','grupo-nova','vigia-integral') then 'goLive' else 'billing' end,
  case when o.slug in ('seguridad-atlas','grupo-nova','vigia-integral') then 100 else 35 end,
  case when o.slug in ('seguridad-atlas','grupo-nova','vigia-integral') then jsonb_build_object('organization',true,'billing',true,'branding',true,'adminInvitation',true,'catalogs',true,'security',true,'goLive',true) else jsonb_build_object('organization',true,'billing',false,'branding',true,'adminInvitation',true,'catalogs',true,'security',false,'goLive',false) end,
  ob.support_email,coalesce(o.created_at,now()),case when o.slug in ('seguridad-atlas','grupo-nova','vigia-integral') then now() else null end,o.created_by,o.created_by
from public.organizations o left join public.organization_branding ob on ob.organization_id=o.id
on conflict(organization_id) do nothing;

-- =========================================================
-- 13. TRIGGERS, AUDITORÍA, RLS Y GRANTS
-- =========================================================

do $$ declare tbl text; begin
  foreach tbl in array array[
    'organization_billing_accounts','saas_addons','organization_subscription_addons','commercial_coupons',
    'billing_orders','billing_invoices','billing_payments','subscription_change_requests','organization_onboarding'
  ] loop
    execute format('drop trigger if exists trg_%I_touch_updated_at on public.%I',tbl,tbl);
    execute format('create trigger trg_%I_touch_updated_at before update on public.%I for each row execute function public.platform_touch_updated_at_v1()',tbl,tbl);
  end loop;
end $$;

do $$ declare tbl text; begin
  foreach tbl in array array[
    'organization_billing_accounts','saas_addons','organization_subscription_addons','commercial_coupons','commercial_coupon_redemptions',
    'billing_orders','billing_order_lines','billing_invoices','billing_invoice_lines','billing_payments','billing_payment_allocations',
    'subscription_change_requests','organization_onboarding','commercial_events','saas_plans','organization_subscriptions'
  ] loop
    if to_regclass('public.'||tbl) is not null then
      execute format('drop trigger if exists trg_platform_audit_%I on public.%I',tbl,tbl);
      execute format('create trigger trg_platform_audit_%I after insert or update or delete on public.%I for each row execute function public.platform_capture_row_change_v1(''direct'')',tbl,tbl);
    end if;
  end loop;
end $$;

alter table public.organization_billing_accounts enable row level security;
alter table public.saas_addons enable row level security;
alter table public.organization_subscription_addons enable row level security;
alter table public.commercial_coupons enable row level security;
alter table public.commercial_coupon_redemptions enable row level security;
alter table public.billing_order_counters enable row level security;
alter table public.billing_invoice_counters enable row level security;
alter table public.billing_payment_counters enable row level security;
alter table public.billing_orders enable row level security;
alter table public.billing_order_lines enable row level security;
alter table public.billing_invoices enable row level security;
alter table public.billing_invoice_lines enable row level security;
alter table public.billing_payments enable row level security;
alter table public.billing_payment_allocations enable row level security;
alter table public.subscription_change_requests enable row level security;
alter table public.organization_onboarding enable row level security;
alter table public.commercial_events enable row level security;

do $$
declare r record;
begin
  for r in select * from (values
    ('organization_billing_accounts','platform.billing.view'),('saas_addons','platform.plans.view'),('organization_subscription_addons','platform.commercial.view'),
    ('commercial_coupons','platform.plans.view'),('commercial_coupon_redemptions','platform.commercial.view'),('billing_orders','platform.billing.view'),
    ('billing_order_lines','platform.billing.view'),('billing_invoices','platform.billing.view'),('billing_invoice_lines','platform.billing.view'),
    ('billing_payments','platform.billing.view'),('billing_payment_allocations','platform.billing.view'),('subscription_change_requests','platform.commercial.view'),
    ('organization_onboarding','platform.onboarding.view'),('commercial_events','platform.commercial.view')
  ) x(table_name,permission_code)
  loop
    execute format('drop policy if exists %I on public.%I','phase31_platform_select_'||r.table_name,r.table_name);
    execute format('create policy %I on public.%I for select to authenticated using (public.platform_is_admin_v2(%L))','phase31_platform_select_'||r.table_name,r.table_name,r.permission_code);
  end loop;
end $$;

-- Catálogo público autenticado para el portal organizacional, limitado mediante RPC; tabla directa solo Super Admin.
drop policy if exists phase31_platform_select_billing_order_counters on public.billing_order_counters;
create policy phase31_platform_select_billing_order_counters on public.billing_order_counters for select to authenticated using (public.platform_is_admin_v2('platform.billing.view'));
drop policy if exists phase31_platform_select_billing_invoice_counters on public.billing_invoice_counters;
create policy phase31_platform_select_billing_invoice_counters on public.billing_invoice_counters for select to authenticated using (public.platform_is_admin_v2('platform.billing.view'));
drop policy if exists phase31_platform_select_billing_payment_counters on public.billing_payment_counters;
create policy phase31_platform_select_billing_payment_counters on public.billing_payment_counters for select to authenticated using (public.platform_is_admin_v2('platform.billing.view'));

grant select on public.organization_billing_accounts,public.saas_addons,public.organization_subscription_addons,public.commercial_coupons,public.commercial_coupon_redemptions,public.billing_orders,public.billing_order_lines,public.billing_invoices,public.billing_invoice_lines,public.billing_payments,public.billing_payment_allocations,public.subscription_change_requests,public.organization_onboarding,public.commercial_events to authenticated;
grant all on public.organization_billing_accounts,public.saas_addons,public.organization_subscription_addons,public.commercial_coupons,public.commercial_coupon_redemptions,public.billing_order_counters,public.billing_invoice_counters,public.billing_payment_counters,public.billing_orders,public.billing_order_lines,public.billing_invoices,public.billing_invoice_lines,public.billing_payments,public.billing_payment_allocations,public.subscription_change_requests,public.organization_onboarding,public.commercial_events to service_role;
grant usage,select on all sequences in schema public to service_role;

revoke all on function public.platform_next_commercial_number_v31(text) from public,anon,authenticated;
revoke all on function public.platform_plan_price_v31(uuid,text) from public,anon,authenticated;
revoke all on function public.platform_addon_price_v31(uuid,text) from public,anon,authenticated;
revoke all on function public.platform_calculate_coupon_v31(text,uuid,uuid,numeric) from public,anon,authenticated;
revoke all on function public.platform_recalculate_invoice_v31(uuid) from public,anon,authenticated;
revoke all on function public.platform_member_can_manage_subscription_v31(uuid) from public,anon,authenticated;
revoke all on function public.platform_seed_organization_catalogs_v31(uuid) from public,anon,authenticated;

-- RPC Super Admin.
grant execute on function public.platform_list_plans_v31(boolean) to authenticated;
grant execute on function public.platform_upsert_plan_v31(jsonb,text) to authenticated;
grant execute on function public.platform_upsert_addon_v31(jsonb,text) to authenticated;
grant execute on function public.platform_upsert_coupon_v31(jsonb,text) to authenticated;
grant execute on function public.platform_get_commercial_dashboard_v31() to authenticated;
grant execute on function public.platform_list_billing_v31(uuid,text,text,integer,integer) to authenticated;
grant execute on function public.platform_create_invoice_v31(uuid,uuid,text,jsonb,text,numeric,date,text,boolean) to authenticated;
grant execute on function public.platform_register_payment_v31(uuid,numeric,text,text,timestamptz,text,boolean) to authenticated;
grant execute on function public.platform_void_invoice_v31(uuid,text) to authenticated;
grant execute on function public.platform_update_billing_account_v31(uuid,jsonb,text) to authenticated;
grant execute on function public.platform_schedule_subscription_change_v31(uuid,uuid,text,text,text) to authenticated;
grant execute on function public.platform_set_subscription_cancellation_v31(uuid,boolean,text) to authenticated;
grant execute on function public.platform_review_subscription_request_v31(uuid,text,text,boolean) to authenticated;
grant execute on function public.platform_provision_organization_v31(text,text,text,uuid,text,integer,text) to authenticated;
grant execute on function public.platform_list_onboarding_v31(text) to authenticated;
grant execute on function public.platform_update_onboarding_v31(uuid,text,text,jsonb,text,text) to authenticated;
grant execute on function public.platform_commercial_tick_v31() to authenticated,service_role;
grant execute on function public.platform_scheduler_tick_v2() to authenticated,service_role;

-- RPC del portal de cada organización.
grant execute on function public.organization_get_subscription_portal_v31() to authenticated;
grant execute on function public.organization_request_subscription_change_v31(text,jsonb,text) to authenticated;

commit;
