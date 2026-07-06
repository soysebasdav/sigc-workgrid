import { ShieldX } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import { useAuthorization } from '../features/authz/AuthorizationProvider';
import type { PermissionCode } from '../features/authz/permissions';

type PermissionRouteProps = {
  anyOf?: readonly (PermissionCode | string)[];
  allOf?: readonly (PermissionCode | string)[];
};

export function PermissionRoute({ anyOf = [], allOf = [] }: PermissionRouteProps) {
  const { isLoading, error, canAny, canAll } = useAuthorization();

  if (isLoading) {
    return (
      <section className="card placeholder-card">
        <h2>Validando permisos...</h2>
        <p>Comprobando tu rol en la organización activa.</p>
      </section>
    );
  }

  const allowed = !error && (anyOf.length === 0 || canAny(anyOf)) && (allOf.length === 0 || canAll(allOf));
  if (!allowed) {
    return (
      <section className="card placeholder-card permission-denied-card">
        <div className="kpi-icon"><ShieldX /></div>
        <h2>Acceso restringido</h2>
        <p>{error ?? 'Tu rol actual no tiene el permiso requerido para abrir este módulo.'}</p>
      </section>
    );
  }

  return <Outlet />;
}
