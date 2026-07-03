import { Navigate, Outlet } from 'react-router-dom';
import { useApp } from './AppProvider';

export function AdminRoute() {
  const { currentUser } = useApp();

  if (!currentUser) return <Navigate to="/login" replace />;
  if (currentUser.role !== 'admin') return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}
