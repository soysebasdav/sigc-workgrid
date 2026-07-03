import { Navigate, Outlet } from 'react-router-dom';
import { useApp } from './AppProvider';
import { Sidebar } from '../components/layout/Sidebar';
import { Topbar } from '../components/layout/Topbar';

export function AppShell() {
  const { currentUser } = useApp();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-panel">
        <Topbar />
        <div className="page-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
