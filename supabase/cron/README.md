# Cron de plataforma

El trabajo existente en Supabase debe conservarse así:

- Nombre: `orkesta-platform-scheduler`
- Frecuencia: `0 * * * *`
- Método: `POST`
- Destino: `https://<PROJECT_REF>.supabase.co/functions/v1/platform-scheduler`
- Encabezado privado: `x-cron-secret`
- Valor del encabezado: el secreto remoto `PLATFORM_CRON_SECRET`

El valor real no pertenece al repositorio. Los demás cron funcionales ya creados por las
migraciones se administran desde Supabase y pueden verificarse con los SQL de
`supabase/verification/`.
