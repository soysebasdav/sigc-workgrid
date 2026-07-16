# Operación de Supabase

## Edge Functions versionadas

| Función | Uso | Verify JWT |
|---|---|---:|
| `orkesta-public-api` | API externa con API keys propias | No |
| `platform-scheduler` | Orquestador horario protegido por secreto | No |
| `platform-integration-worker` | Webhooks y exportaciones | Sí |
| `process-organization-backup` | Backups por organización | Sí |
| `process-organization-restore` | Restauraciones controladas | Sí |

La configuración está en `supabase/config.toml`.

## Despliegue con CLI

```bash
supabase login
supabase link --project-ref TU_PROJECT_REF
supabase functions deploy orkesta-public-api
supabase functions deploy platform-integration-worker
supabase functions deploy platform-scheduler
supabase functions deploy process-organization-backup
supabase functions deploy process-organization-restore
```

## Scheduler

Debe conservarse el cron `orkesta-platform-scheduler` con frecuencia `0 * * * *`.
Consulte `supabase/cron/README.md`.

## Estado comprobado antes de esta organización

- API pública versión 3.2: operativa.
- Lectura de catálogos: operativa.
- Lectura de casos: operativa.
- Scheduler: operativo.
- Funciones de backup y restauración: desplegadas.
