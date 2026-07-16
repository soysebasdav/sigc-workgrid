# Variables y secretos

## GitHub

GitHub conserva únicamente plantillas sin valores reales:

- `.env.example`
- `supabase/.env.example`

## Render

Configure como variables de entorno del sitio:

- `VITE_APP_NAME=Orkesta`
- `VITE_DATA_MODE=supabase`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Estas variables se incorporan al frontend durante el build. Nunca use la service role como
variable `VITE_*`.

## Supabase Edge Functions

Supabase proporciona automáticamente a las funciones alojadas:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

El secreto personalizado que se administra en **Edge Functions > Secrets** es:

- `PLATFORM_CRON_SECRET`

Para CLI puede configurarse con:

```bash
supabase secrets set PLATFORM_CRON_SECRET="VALOR_GENERADO"
```

## API keys de organizaciones

Las credenciales `ork_test_...` u otras claves generadas desde Orkesta pertenecen al
sistema consumidor. No se guardan en el repositorio, Render ni archivos del frontend.

## Archivos privados ignorados

- `.env`
- `.env.local`
- `.env.production.local`
- `supabase/.env`
