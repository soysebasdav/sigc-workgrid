import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AppState, User } from '../types';
import { loadState, resetState, saveState } from '../lib/storage';
import { nowISO } from '../utils/dates';
import { dataMode, isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import {
  getCurrentSession,
  loadSupabaseState,
  signInWithPassword,
  signOut,
  updateAuthUser
} from '../lib/supabaseRepository';

type Mutator = (state: AppState) => AppState;
type RuntimeMode = 'local' | 'supabase';

interface AppContextValue {
  state: AppState;
  currentUser: User | null;
  unreadNotifications: number;
  isLoading: boolean;
  dataMode: RuntimeMode;
  isSupabaseConfigured: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  resetDemoData: () => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  updateProfile: (values: { name: string; email: string; password?: string }) => Promise<void>;
  updateSettings: (values: { inactivityTimeoutMinutes: number }) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);
const EMPTY_REMOTE_STATE: AppState = {
  users: [],
  notifications: [],
  settings: { inactivityTimeoutMinutes: 10 },
  currentUserId: null
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function AppProvider({ children }: { children: ReactNode }) {
  const runtimeMode = dataMode as RuntimeMode;
  const [state, setState] = useState<AppState>(() => (runtimeMode === 'supabase' ? EMPTY_REMOTE_STATE : loadState()));
  const [isLoading, setIsLoading] = useState(runtimeMode === 'supabase');

  const currentUser = useMemo(
    () => state.users.find((user) => user.id === state.currentUserId) ?? null,
    [state.currentUserId, state.users]
  );

  async function reloadSupabaseState(userId = state.currentUserId): Promise<void> {
    if (runtimeMode !== 'supabase') return;
    setIsLoading(true);
    try {
      setState(await loadSupabaseState(userId));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (runtimeMode !== 'supabase') return;

    let mounted = true;

    async function bootSupabase(): Promise<void> {
      setIsLoading(true);
      try {
        const session = await getCurrentSession();
        if (!mounted) return;
        if (!session?.user) {
          setState(EMPTY_REMOTE_STATE);
          return;
        }
        const next = await loadSupabaseState(session.user.id);
        if (mounted) setState(next);
      } catch (error) {
        console.error('No fue posible cargar estado desde Supabase:', error);
        if (mounted) setState(EMPTY_REMOTE_STATE);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    void bootSupabase();

    const subscription = supabase?.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (!session?.user) {
        setState(EMPTY_REMOTE_STATE);
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription?.data.subscription.unsubscribe();
    };
  }, [runtimeMode]);

  useEffect(() => {
    const realtimeClient = supabase;
    if (runtimeMode !== 'supabase' || !currentUser?.id || !realtimeClient) return;
    const userId = currentUser.id;
    const channel = realtimeClient
      .channel(`sigc-notifications-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_user_id=eq.${userId}` }, () => {
        void reloadSupabaseState(userId);
      })
      .subscribe();
    return () => { void realtimeClient.removeChannel(channel); };
  }, [runtimeMode, currentUser?.id]);

  function commit(mutator: Mutator): void {
    setState((previous) => {
      const next = mutator(previous);
      saveState(next);
      return next;
    });
  }

  const unreadNotifications = useMemo(() => {
    if (!currentUser) return 0;
    return state.notifications.filter(
      (notification) => notification.recipientUserId === currentUser.id && !notification.isRead
    ).length;
  }, [currentUser, state.notifications]);

  async function login(email: string, password: string): Promise<boolean> {
    if (runtimeMode === 'supabase') {
      setIsLoading(true);
      try {
        const userId = await signInWithPassword(normalizeEmail(email), password);
        if (!userId) return false;
        setState(await loadSupabaseState(userId));
        return true;
      } catch (error) {
        console.error('Error de login Supabase:', error);
        return false;
      } finally {
        setIsLoading(false);
      }
    }

    const normalized = normalizeEmail(email);
    const user = state.users.find((item) => normalizeEmail(item.email) === normalized && item.password === password);
    if (!user) return false;
    commit((previous) => ({ ...previous, currentUserId: user.id }));
    return true;
  }

  async function logout(): Promise<void> {
    if (runtimeMode === 'supabase') {
      await signOut();
      setState(EMPTY_REMOTE_STATE);
      return;
    }
    commit((previous) => ({ ...previous, currentUserId: null }));
  }

  async function markNotificationRead(notificationId: string): Promise<void> {
    if (runtimeMode === 'supabase') {
      const { error } = await supabase!
        .from('notifications')
        .update({ is_read: true, read_at: nowISO() })
        .eq('id', notificationId)
        .eq('recipient_user_id', currentUser?.id ?? '');
      if (error) throw error;
      await reloadSupabaseState(currentUser?.id ?? null);
      return;
    }

    commit((previous) => ({
      ...previous,
      notifications: previous.notifications.map((notification) =>
        notification.id === notificationId ? { ...notification, isRead: true } : notification
      )
    }));
  }

  async function markAllNotificationsRead(): Promise<void> {
    if (!currentUser) return;

    if (runtimeMode === 'supabase') {
      let query = supabase!
        .from('notifications')
        .update({ is_read: true, read_at: nowISO() })
        .eq('recipient_user_id', currentUser.id)
        .eq('is_read', false);
      if (state.settings.organizationId) query = query.eq('organization_id', state.settings.organizationId);
      const { error } = await query;
      if (error) throw error;
      await reloadSupabaseState(currentUser.id);
      return;
    }

    commit((previous) => ({
      ...previous,
      notifications: previous.notifications.map((notification) =>
        notification.recipientUserId === currentUser.id ? { ...notification, isRead: true } : notification
      )
    }));
  }

  async function updateProfile(values: { name: string; email: string; password?: string }): Promise<void> {
    if (!currentUser) return;

    if (runtimeMode === 'supabase') {
      const nextEmail = normalizeEmail(values.email);
      await updateAuthUser({
        email: nextEmail !== normalizeEmail(currentUser.email) ? nextEmail : undefined,
        password: values.password?.trim() || undefined
      });
      const { error } = await supabase!
        .from('profiles')
        .update({ name: values.name.trim(), email: nextEmail, updated_at: nowISO() })
        .eq('id', currentUser.id);
      if (error) throw error;
      await reloadSupabaseState(currentUser.id);
      return;
    }

    commit((previous) => ({
      ...previous,
      users: previous.users.map((user) =>
        user.id === currentUser.id
          ? {
              ...user,
              name: values.name.trim(),
              email: normalizeEmail(values.email),
              password: values.password?.trim() ? values.password : user.password,
              updatedAt: nowISO()
            }
          : user
      )
    }));
  }

  async function updateSettings(values: { inactivityTimeoutMinutes: number }): Promise<void> {
    if (!currentUser) return;
    if (runtimeMode !== 'supabase' && currentUser.demoRole !== 'admin') return;
    const sanitized = Math.max(1, Number(values.inactivityTimeoutMinutes) || 10);

    if (runtimeMode === 'supabase') {
      const { error } = await (supabase as any)!.rpc('update_runtime_settings', {
        p_inactivity_timeout_minutes: sanitized
      });
      if (error) throw error;
      await reloadSupabaseState(currentUser.id);
      return;
    }

    commit((previous) => ({
      ...previous,
      settings: { ...previous.settings, inactivityTimeoutMinutes: sanitized }
    }));
  }

  async function resetDemoData(): Promise<void> {
    if (runtimeMode === 'supabase') {
      await reloadSupabaseState(currentUser?.id ?? null);
      return;
    }
    setState(resetState());
  }

  const value: AppContextValue = {
    state,
    currentUser,
    unreadNotifications,
    isLoading,
    dataMode: runtimeMode,
    isSupabaseConfigured,
    login,
    logout,
    resetDemoData,
    markNotificationRead,
    markAllNotificationsRead,
    updateProfile,
    updateSettings
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp debe usarse dentro de AppProvider');
  return context;
}
