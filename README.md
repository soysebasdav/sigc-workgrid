# SIGC WorkGrid React

Aplicación React + Vite + TypeScript para el **Sistema Integral de Gestión de Casos — SIGC**.

Esta versión conserva el diseño **WorkGrid Color** y las pantallas funcionales anteriores, pero agrega una primera integración real con **Supabase Auth + PostgreSQL** sin eliminar el modo demo con `localStorage`.

## Modos de datos

La app puede correr de dos formas:

| Modo | Uso | Backend |
|---|---|---|
| `local` | Demo rápida, sin configurar nada | `localStorage` |
| `supabase` | Persistencia real, login con Supabase Auth y tablas PostgreSQL | Supabase |

Por defecto corre en `local` para no romper lo que ya funcionaba.

## Instalación local

```bash
npm install
npm run dev
```

Abre la URL de Vite, normalmente:

```txt
http://localhost:5173
```

Credenciales en modo local:

```txt
admin@test.com / Admin123*
user@test.com / User123*
```

## Activar Supabase

### 1. Crear proyecto en Supabase

Crea un proyecto en Supabase y copia:

- Project URL
- anon public key

Están en **Project Settings > API**.

### 2. Ejecutar migración SQL

En Supabase entra a **SQL Editor** y ejecuta:

```txt
supabase/migrations/20260703000000_taskflow_schema.sql
```

Esto crea:

- `profiles`
- `tasks`
- `notifications`
- `app_settings`
- triggers
- políticas RLS
- trigger para crear perfil automáticamente cuando se crea un usuario en Auth

### 3. Crear usuarios demo en Supabase Authentication

En **Authentication > Users**, crea manualmente:

```txt
admin@test.com / Admin123*
user@test.com / User123*
```

Luego ejecuta en **SQL Editor**:

```txt
supabase/seed.sql
```

Ese seed asigna el rol admin a `admin@test.com`, nombra los perfiles y crea tareas/notificaciones demo.

### 4. Configurar `.env.local`

Copia `.env.example` a `.env.local`:

```bash
cp .env.example .env.local
```

En Windows CMD puedes hacerlo así:

```bat
copy .env.example .env.local
```

Edita `.env.local`:

```env
VITE_APP_NAME="SIGC WorkGrid React"
VITE_DATA_MODE=supabase
VITE_SUPABASE_URL="https://TU-PROYECTO.supabase.co"
VITE_SUPABASE_ANON_KEY="TU_ANON_KEY"
```

Reinicia Vite:

```bash
npm run dev
```

## Qué ya queda conectado a Supabase

- Login con Supabase Auth.
- Sesión persistente.
- Lectura de perfiles desde `profiles`.
- CRUD de tareas en `tasks`.
- Notificaciones en `notifications`.
- Marcar notificaciones como leídas.
- Perfil de usuario.
- Configuración general en `app_settings`.
- Reglas RLS para separar usuario normal y administrador.

## Limitación importante de esta fase

El alta y eliminación de usuarios desde la SPA quedan limitadas en modo Supabase. La razón es de seguridad: crear o eliminar usuarios de Supabase Auth requiere **service_role**, y esa llave nunca debe ir en React.

Opciones correctas para la siguiente fase:

1. Crear usuarios desde **Supabase Dashboard > Authentication**.
2. Crear una **Edge Function** `admin-create-user` protegida para administradores.
3. Crear un backend Node/Express con `service_role` guardada en servidor.

Mientras tanto, el módulo Usuarios sí permite visualizar perfiles y editar nombre/rol cuando el usuario actual es admin.

## Estructura relevante

```txt
src/
  app/AppProvider.tsx              # Estado global local/Supabase
  lib/supabaseClient.ts            # Cliente Supabase
  lib/supabaseRepository.ts        # Adaptador Auth + PostgreSQL
  types/supabase.ts                # Tipos de tablas Supabase
  features/sigc/                   # Interfaz WorkGrid Color
  features/tasks/                  # CRUD tareas funcional
  features/agenda/                 # Agenda mensual conservada
  features/users/                  # Usuarios/roles
supabase/
  migrations/20260703000000_taskflow_schema.sql
  seed.sql
```

## Build

```bash
npm run build
```
