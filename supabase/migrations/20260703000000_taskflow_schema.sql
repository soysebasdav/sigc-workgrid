-- SIGC WorkGrid React · Supabase Auth + PostgreSQL
-- Ejecutar en Supabase SQL Editor antes de activar VITE_DATA_MODE=supabase.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Usuario SIGC',
  email text not null unique,
  role text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  setting_key text primary key,
  setting_value text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  type text not null check (type in ('task_created', 'task_updated', 'task_deleted', 'system')),
  title text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_tasks_user_due on public.tasks(user_id, due_date);
create index if not exists idx_tasks_status_due on public.tasks(status, due_date);
create index if not exists idx_notifications_recipient_read on public.notifications(recipient_user_id, is_read, created_at desc);

insert into public.app_settings(setting_key, setting_value)
values ('inactivity_timeout_minutes', '10')
on conflict (setting_key) do update set setting_value = excluded.setting_value;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create or replace function public.current_app_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and public.current_app_role() <> 'admin' then
    raise exception 'Solo un administrador puede cambiar roles';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_role_escalation on public.profiles;
create trigger trg_prevent_role_escalation
before update on public.profiles
for each row execute function public.prevent_role_escalation();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'Usuario SIGC'),
    'user'
  )
  on conflict (id) do update set
    email = excluded.email,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.notifications enable row level security;
alter table public.app_settings enable row level security;

-- Recreate RLS policies safely
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own_or_admin" on public.profiles;
drop policy if exists "tasks_select_own_or_admin" on public.tasks;
drop policy if exists "tasks_insert_own_or_admin" on public.tasks;
drop policy if exists "tasks_update_own_or_admin" on public.tasks;
drop policy if exists "tasks_delete_own_or_admin" on public.tasks;
drop policy if exists "notifications_select_related_or_admin" on public.notifications;
drop policy if exists "notifications_insert_actor_or_admin" on public.notifications;
drop policy if exists "notifications_update_recipient_or_admin" on public.notifications;
drop policy if exists "settings_select_authenticated" on public.app_settings;
drop policy if exists "settings_admin_write" on public.app_settings;

-- Profiles
create policy "profiles_select_own_or_admin"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.current_app_role() = 'admin');

create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

create policy "profiles_update_own_or_admin"
on public.profiles for update
to authenticated
using (id = auth.uid() or public.current_app_role() = 'admin')
with check (id = auth.uid() or public.current_app_role() = 'admin');

-- Tasks
create policy "tasks_select_own_or_admin"
on public.tasks for select
to authenticated
using (user_id = auth.uid() or public.current_app_role() = 'admin');

create policy "tasks_insert_own_or_admin"
on public.tasks for insert
to authenticated
with check (user_id = auth.uid() or public.current_app_role() = 'admin');

create policy "tasks_update_own_or_admin"
on public.tasks for update
to authenticated
using (user_id = auth.uid() or public.current_app_role() = 'admin')
with check (user_id = auth.uid() or public.current_app_role() = 'admin');

create policy "tasks_delete_own_or_admin"
on public.tasks for delete
to authenticated
using (user_id = auth.uid() or public.current_app_role() = 'admin');

-- Notifications
create policy "notifications_select_related_or_admin"
on public.notifications for select
to authenticated
using (recipient_user_id = auth.uid() or actor_user_id = auth.uid() or public.current_app_role() = 'admin');

create policy "notifications_insert_actor_or_admin"
on public.notifications for insert
to authenticated
with check (actor_user_id = auth.uid() or public.current_app_role() = 'admin');

create policy "notifications_update_recipient_or_admin"
on public.notifications for update
to authenticated
using (recipient_user_id = auth.uid() or public.current_app_role() = 'admin')
with check (recipient_user_id = auth.uid() or public.current_app_role() = 'admin');

-- Settings
create policy "settings_select_authenticated"
on public.app_settings for select
to authenticated
using (true);

create policy "settings_admin_write"
on public.app_settings for all
to authenticated
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');
