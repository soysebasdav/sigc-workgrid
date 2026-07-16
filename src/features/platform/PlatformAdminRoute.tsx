import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useApp } from '../../app/AppProvider';
import { usePlatformAccess } from './PlatformAccessProvider';

export function PlatformAdminRoute() {
  const { currentUser, isLoading: sessionLoading } = useApp();
  const { isPlatformAdmin, isLoading, error } = usePlatformAccess();
  const location = useLocation();

  if (sessionLoading || isLoading) {
    return <main className="platform-gate"><section className="card"><strong>Validando acceso al Super Admin...</strong></section></main>;
  }
  if (!currentUser) return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (!isPlatformAdmin) {
    return (
      <main className="platform-gate">
        <section className="card platform-denied-card">
          <span className="eyebrow">Orkesta · Seguridad de plataforma</span>
          <h1>Acceso restringido</h1>
          <p>{error || 'Tu usuario no está registrado como administrador global de Orkesta.'}</p>
          <a className="btn btn-primary" href="/app">Volver a la organización</a>
        </section>
      </main>
    );
  }
  return <Outlet />;
}
