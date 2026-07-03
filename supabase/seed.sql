-- Seed opcional después de crear los usuarios en Supabase Authentication.
-- 1) Crea admin@test.com / Admin123* desde Authentication > Users.
-- 2) Crea user@test.com / User123* desde Authentication > Users.
-- 3) Ejecuta este archivo en SQL Editor.

update public.profiles
set name = 'Erik González', role = 'admin'
where email = 'admin@test.com';

update public.profiles
set name = 'Usuario Demo', role = 'user'
where email = 'user@test.com';

insert into public.tasks(user_id, title, description, status, due_date)
select id,
  'Revisar entregables',
  'Verificar el avance de la prueba técnica y confirmar que el CRUD de tareas funcione correctamente.',
  'pending',
  current_date + interval '2 days'
from public.profiles
where email = 'user@test.com'
and not exists (select 1 from public.tasks where title = 'Revisar entregables');

insert into public.tasks(user_id, title, description, status, due_date)
select id,
  'Auditar módulo de usuarios',
  'Comprobar permisos, edición de roles y consistencia de usuarios administradores.',
  'in_progress',
  current_date + interval '4 days'
from public.profiles
where email = 'admin@test.com'
and not exists (select 1 from public.tasks where title = 'Auditar módulo de usuarios');

insert into public.tasks(user_id, title, description, status, due_date)
select id,
  'Tarea vencida de ejemplo',
  'Esta tarea sirve para validar visualmente el estado derivado Retraso.',
  'pending',
  current_date - interval '1 day'
from public.profiles
where email = 'user@test.com'
and not exists (select 1 from public.tasks where title = 'Tarea vencida de ejemplo');

insert into public.notifications(recipient_user_id, actor_user_id, task_id, type, title, message)
select recipient.id, actor.id, task.id, 'task_created', 'Nueva tarea asignada', 'Administrador te asignó la tarea Revisar entregables.'
from public.profiles recipient
join public.profiles actor on actor.email = 'admin@test.com'
join public.tasks task on task.title = 'Revisar entregables'
where recipient.email = 'user@test.com'
and not exists (select 1 from public.notifications where title = 'Nueva tarea asignada' and recipient_user_id = recipient.id);
