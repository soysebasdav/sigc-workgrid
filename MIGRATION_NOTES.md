# Notas de migración a Supabase

## Objetivo de esta versión

Se agregó una primera capa real de Supabase sin perder lo que ya funcionaba en la app React:

- `localStorage` sigue disponible como modo demo.
- Supabase se activa solo si `VITE_DATA_MODE=supabase` y existen `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.
- La UI WorkGrid Color se conserva.
- La agenda, tareas, usuarios, perfil, configuración y notificaciones se mantienen.

## Archivos agregados

```txt
src/lib/supabaseClient.ts
src/lib/supabaseRepository.ts
src/types/supabase.ts
supabase/seed.sql
```

## Archivos modificados

```txt
src/app/AppProvider.tsx
src/features/sigc/pages.tsx
src/features/auth/LoginPage.tsx
src/features/tasks/TaskFormModal.tsx
src/features/users/UserFormModal.tsx
src/features/profile/ProfilePage.tsx
src/features/settings/SettingsPage.tsx
supabase/migrations/20260703000000_taskflow_schema.sql
.env.example
package.json
README.md
```

## Modelo elegido

Se eligió Supabase Auth como fuente de identidad. La tabla `profiles` guarda datos de aplicación:

- `id`: igual a `auth.users.id`
- `name`
- `email`
- `role`: `admin` o `user`

Las tareas y notificaciones referencian `profiles`.

## Por qué no se usa password en la tabla users

La versión PHP/demo tenía usuarios con contraseña propia. En Supabase eso se reemplaza por Supabase Auth. La contraseña ya no debe vivir en tablas públicas de aplicación.

## Seguridad

Se activó RLS en:

- `profiles`
- `tasks`
- `notifications`
- `app_settings`

Reglas principales:

- Admin puede ver/gestionar todos los datos funcionales.
- Usuario normal solo ve sus tareas y sus notificaciones.
- Usuario normal no puede escalar su propio rol a admin.
- Configuración global solo la escribe admin.

## Pendiente recomendado

Para que el módulo Usuarios cree/elimine usuarios directamente desde la interfaz, falta una capa segura con `service_role`:

- Edge Function de Supabase, o
- backend Node/Express.

No se debe poner `service_role` en variables Vite porque quedaría expuesta en el navegador.
