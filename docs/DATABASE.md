# Base de datos y migraciones

## Orden histórico

```text
20260703000000_taskflow_schema.sql
202607160001_superadmin_phase1.sql
202607160002_superadmin_phase2.sql
202607160003_fix_service_role_scheduler.sql
202607160004_superadmin_phase31_commercial.sql
202607160005_phase32_integrations.sql
202607160006_phase33_reliability_compliance.sql
```

Los archivos de las fases 1 y 3.2 corresponden a sus versiones corregidas definitivas.

## Proyecto productivo actual

Estas migraciones ya fueron instaladas. No vuelva a ejecutarlas. La carpeta sirve como
historial reproducible y punto de partida para cambios posteriores.

## Próximos cambios

Cada modificación debe crearse como archivo nuevo, por ejemplo:

```text
supabase/migrations/202607170001_descripcion_del_cambio.sql
```

No edite migraciones que ya hayan sido aplicadas en producción.

## Verificaciones

Después de un cambio, ejecute el SQL correspondiente de `supabase/verification/`.

## Seed heredado

El seed de la primera maqueta TaskFlow fue trasladado a
`supabase/legacy/seed_taskflow.sql`. No debe ejecutarse sobre el esquema actual.
