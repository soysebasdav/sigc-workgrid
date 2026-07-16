# Estructura definitiva del repositorio

```text
SIGC_APP/
├── .env.example
├── .gitignore
├── .node-version
├── README.md
├── index.html
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── docs/
│   ├── PROJECT_STRUCTURE.md
│   ├── DEPLOYMENT.md
│   ├── SECRETS.md
│   ├── DATABASE.md
│   ├── OPERATIONS.md
│   ├── RELEASES.md
│   └── releases/phase-3.3/
├── src/
│   ├── app/
│   ├── assets/
│   ├── components/
│   ├── features/
│   ├── lib/
│   ├── types/
│   ├── utils/
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
└── supabase/
    ├── .env.example
    ├── config.toml
    ├── migrations/
    ├── verification/
    ├── functions/
    │   ├── orkesta-public-api/index.ts
    │   ├── platform-integration-worker/index.ts
    │   ├── platform-scheduler/index.ts
    │   ├── process-organization-backup/index.ts
    │   └── process-organization-restore/index.ts
    ├── cron/
    └── legacy/
```

## Qué se sube a GitHub

Se suben el frontend, las migraciones, las Edge Functions, las plantillas `.env.example`,
la configuración `config.toml` y la documentación.

## Qué no se sube

- `.git/` de otro repositorio.
- `node_modules/`.
- `dist/`.
- `.env.local`.
- `supabase/.env`.
- Service role.
- `PLATFORM_CRON_SECRET` real.
- API keys emitidas para organizaciones.
- ZIP temporales.
