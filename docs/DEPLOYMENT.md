# Despliegue

## 1. Repositorio GitHub existente

No sustituya la carpeta oculta `.git` de su computador. Copie el contenido de este paquete
sobre la raíz actual del repositorio.

Después revise:

```bash
git status
git add .
git commit -m "Organizar repositorio y versionar Supabase Fase 3.3"
git push
```

Los directorios `node_modules`, `dist`, `.env.local` y `.git` no forman parte del paquete.

## 2. Render

Render continúa desplegando el frontend desde GitHub. Use:

```text
Build command: corepack enable && pnpm install --frozen-lockfile && pnpm build
Publish directory: dist
```

Mantenga en Render las variables descritas en `SECRETS.md`.

## 3. Supabase

El código de las funciones queda versionado en GitHub, pero los secretos continúan en el
panel de Supabase. `supabase/config.toml` conserva la política `verify_jwt` de cada función.

La base productiva ya contiene las migraciones incluidas. No las repita. Para cambios
futuros, cree una migración nueva y despliegue únicamente las funciones modificadas.

## 4. Comprobación

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build
```
