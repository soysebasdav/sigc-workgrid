import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useApp } from '../../app/AppProvider';
import type { SigcAuthorizationContext } from '../sigc/domain/types';
import { SIGC_DATA_CHANGED_EVENT, sigcService } from '../sigc/services/sigcService';
import { ALL_PERMISSION_CODES, DEMO_ANALYST_PERMISSIONS, type PermissionCode } from './permissions';

type AuthorizationContextValue = {
  authorization: SigcAuthorizationContext | null;
  permissions: ReadonlySet<string>;
  isLoading: boolean;
  error: string | null;
  roleCode: string;
  roleName: string;
  can: (permission: PermissionCode | string) => boolean;
  canAny: (permissions: readonly (PermissionCode | string)[]) => boolean;
  canAll: (permissions: readonly (PermissionCode | string)[]) => boolean;
  reload: () => void;
};

const AuthorizationContext = createContext<AuthorizationContextValue | null>(null);

function buildDemoAuthorizationContext(userId: string, isLegacyAdmin: boolean): SigcAuthorizationContext {
  const roleCode = isLegacyAdmin ? 'admin' : 'analyst';
  const roleName = isLegacyAdmin ? 'Administrador' : 'Analista';
  return {
    userId,
    organizationId: 'demo-org',
    membershipId: `demo-membership-${userId}`,
    isActive: true,
    role: {
      id: `demo-role-${roleCode}`,
      code: roleCode,
      name: roleName
    },
    permissions: [...(isLegacyAdmin ? ALL_PERMISSION_CODES : DEMO_ANALYST_PERMISSIONS)]
  };
}

export function AuthorizationProvider({ children }: { children: ReactNode }) {
  const { currentUser, dataMode, isLoading: isSessionLoading } = useApp();
  const [authorization, setAuthorization] = useState<SigcAuthorizationContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    const handleDataChanged = () => reload();
    window.addEventListener(SIGC_DATA_CHANGED_EVENT, handleDataChanged);
    return () => window.removeEventListener(SIGC_DATA_CHANGED_EVENT, handleDataChanged);
  }, [reload]);

  useEffect(() => {
    let active = true;

    if (isSessionLoading) return () => { active = false; };

    if (!currentUser) {
      setAuthorization(null);
      setError(null);
      setIsLoading(false);
      return () => { active = false; };
    }

    if (dataMode !== 'supabase') {
      setAuthorization(buildDemoAuthorizationContext(currentUser.id, currentUser.role === 'admin'));
      setError(null);
      setIsLoading(false);
      return () => { active = false; };
    }

    setIsLoading(true);
    setError(null);

    void sigcService.getAuthorizationContext()
      .then((result) => {
        if (!active) return;
        setAuthorization(result.data);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setAuthorization(null);
        setError(reason instanceof Error ? reason.message : 'No fue posible cargar los permisos de la organización activa.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => { active = false; };
  }, [currentUser?.id, currentUser?.role, dataMode, isSessionLoading, revision]);

  const permissions = useMemo(() => new Set(authorization?.permissions ?? []), [authorization?.permissions]);
  const can = useCallback((permission: PermissionCode | string) => permissions.has(permission), [permissions]);
  const canAny = useCallback((required: readonly (PermissionCode | string)[]) => required.some((permission) => permissions.has(permission)), [permissions]);
  const canAll = useCallback((required: readonly (PermissionCode | string)[]) => required.every((permission) => permissions.has(permission)), [permissions]);

  const value = useMemo<AuthorizationContextValue>(() => ({
    authorization,
    permissions,
    isLoading: isSessionLoading || isLoading,
    error,
    roleCode: authorization?.role.code ?? '',
    roleName: authorization?.role.name ?? 'Sin rol activo',
    can,
    canAny,
    canAll,
    reload
  }), [authorization, permissions, isSessionLoading, isLoading, error, can, canAny, canAll, reload]);

  return <AuthorizationContext.Provider value={value}>{children}</AuthorizationContext.Provider>;
}

export function useAuthorization(): AuthorizationContextValue {
  const context = useContext(AuthorizationContext);
  if (!context) throw new Error('useAuthorization debe usarse dentro de AuthorizationProvider');
  return context;
}
