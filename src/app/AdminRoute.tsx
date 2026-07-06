import { PermissionRoute } from './PermissionRoute';
import { PERMISSIONS } from '../features/authz/permissions';

// Compatibilidad temporal: el nombre histórico se conserva hasta la limpieza legacy.
// La autoridad ya no proviene de profiles.role sino del permiso organizacional real.
export function AdminRoute() {
  return <PermissionRoute allOf={[PERMISSIONS.adminManageUsers]} />;
}
