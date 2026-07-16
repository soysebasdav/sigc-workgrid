import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useApp } from '../../app/AppProvider';
import { platformService } from './platformService';
import type { PlatformAccessContext } from './types';

interface PlatformAccessValue {
  context: PlatformAccessContext | null;
  isLoading: boolean;
  error: string | null;
  isPlatformAdmin: boolean;
  canPlatform: (permission: string) => boolean;
  reload: () => void;
}

const PlatformAccessContextObject = createContext<PlatformAccessValue | null>(null);

export function PlatformAccessProvider({ children }: { children: ReactNode }) {
  const { currentUser, dataMode, isLoading: sessionLoading } = useApp();
  const [context, setContext] = useState<PlatformAccessContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    if (sessionLoading) return () => { active = false; };
    if (!currentUser) {
      setContext(null);
      setError(null);
      setIsLoading(false);
      return () => { active = false; };
    }
    if (dataMode !== 'supabase') {
      setContext(currentUser.demoRole === 'admin' ? {
        isPlatformAdmin: true,
        userId: currentUser.id,
        roleCode: 'owner',
        roleName: 'Propietario de plataforma (demo)',
        permissions: ['platform.*']
      } : null);
      setError(null);
      setIsLoading(false);
      return () => { active = false; };
    }

    setIsLoading(true);
    setError(null);
    void platformService.getAccessContext()
      .then((value) => {
        if (!active) return;
        setContext(value.isPlatformAdmin ? value : null);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setContext(null);
        setError(reason instanceof Error ? reason.message : 'No fue posible validar el acceso de plataforma.');
      })
      .finally(() => { if (active) setIsLoading(false); });

    return () => { active = false; };
  }, [currentUser?.id, currentUser?.demoRole, dataMode, sessionLoading, revision]);

  const canPlatform = useCallback((permission: string) => {
    if (!context?.isPlatformAdmin) return false;
    return context.permissions.includes('platform.*') || context.permissions.includes(permission);
  }, [context]);

  const value = useMemo<PlatformAccessValue>(() => ({
    context,
    isLoading: sessionLoading || isLoading,
    error,
    isPlatformAdmin: Boolean(context?.isPlatformAdmin),
    canPlatform,
    reload
  }), [context, sessionLoading, isLoading, error, canPlatform, reload]);

  return <PlatformAccessContextObject.Provider value={value}>{children}</PlatformAccessContextObject.Provider>;
}

export function usePlatformAccess(): PlatformAccessValue {
  const value = useContext(PlatformAccessContextObject);
  if (!value) throw new Error('usePlatformAccess debe usarse dentro de PlatformAccessProvider.');
  return value;
}
