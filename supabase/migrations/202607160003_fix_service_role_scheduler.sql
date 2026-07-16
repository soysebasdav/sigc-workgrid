-- SIGC / Orkesta - Corrección de detección del rol service_role
-- Ejecutar una sola vez en Supabase SQL Editor después de la migración Fase 2.

begin;

create or replace function public.platform_is_service_role_v2()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or coalesce(
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
      ''
    ) = 'service_role'
    or coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role';
$$;

grant execute on function public.platform_is_service_role_v2() to authenticated, service_role;

commit;
