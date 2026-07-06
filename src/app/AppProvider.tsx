import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AppState, Notification, Task, TaskFormValues, User, UserFormValues } from '../types';
import { isOverdue } from '../utils/task';
import { loadState, makeId, resetState, saveState } from '../lib/storage';
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
  visibleTasks: Task[];
  unreadNotifications: number;
  isLoading: boolean;
  dataMode: RuntimeMode;
  isSupabaseConfigured: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  resetDemoData: () => Promise<void>;
  createTask: (values: TaskFormValues) => Promise<void>;
  updateTask: (taskId: string, values: TaskFormValues) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  createUser: (values: UserFormValues) => Promise<void>;
  updateUser: (userId: string, values: UserFormValues) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  updateProfile: (values: { name: string; email: string; password?: string }) => Promise<void>;
  updateSettings: (values: { inactivityTimeoutMinutes: number }) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);
const EMPTY_REMOTE_STATE: AppState = {
  users: [],
  tasks: [],
  notifications: [],
  settings: { inactivityTimeoutMinutes: 10 },
  currentUserId: null
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function canAccessTask(user: User | null, task: Task): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return task.userId === user.id;
}

function isSigcNotification(notification: Notification): boolean {
  return Boolean(notification.caseId) || notification.type.startsWith('case_');
}

function makeNotification(input: Omit<Notification, 'id' | 'createdAt' | 'isRead'>): Notification {
  return {
    ...input,
    id: makeId('not'),
    createdAt: nowISO(),
    isRead: false
  };
}

function showSupabaseAdminNotice(action: string): void {
  window.alert(
    `${action}\n\nEn modo Supabase esta acción necesita Supabase Auth Admin, Edge Function o backend con service_role. ` +
      'Por seguridad no se debe usar service_role desde React. La gestión de membresías y roles se realiza mediante el módulo RBAC del SIGC.'
  );
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
      const next = await loadSupabaseState(userId);
      setState(next);
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

  const visibleTasks = useMemo(
    () => state.tasks.filter((task) => canAccessTask(currentUser, task)),
    [currentUser, state.tasks]
  );

  const unreadNotifications = useMemo(() => {
    if (!currentUser) return 0;
    return state.notifications.filter((notification) => notification.recipientUserId === currentUser.id && isSigcNotification(notification) && !notification.isRead).length;
  }, [currentUser, state.notifications]);

  async function login(email: string, password: string): Promise<boolean> {
    if (runtimeMode === 'supabase') {
      setIsLoading(true);
      try {
        const userId = await signInWithPassword(normalizeEmail(email), password);
        if (!userId) return false;
        const next = await loadSupabaseState(userId);
        setState(next);
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

  async function createTask(values: TaskFormValues): Promise<void> {
    if (!currentUser) return;

    if (runtimeMode === 'supabase') {
      throw new Error('El módulo legacy de tareas fue sustituido por casos y subtareas en la Fase 10.');
    }

    const timestamp = nowISO();
    const task: Task = {
      id: makeId('tsk'),
      userId: values.userId,
      title: values.title.trim(),
      description: values.description.trim(),
      status: values.status,
      dueDate: values.dueDate || null,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    commit((previous) => {
      const notifications = [...previous.notifications];
      if (values.userId !== currentUser.id) {
        notifications.unshift(
          makeNotification({
            recipientUserId: values.userId,
            actorUserId: currentUser.id,
            taskId: task.id,
            type: 'task_created',
            title: 'Nueva tarea asignada',
            message: `${currentUser.name} te asignó la tarea ${task.title}.`
          })
        );
      }
      return { ...previous, tasks: [task, ...previous.tasks], notifications };
    });
  }

  async function updateTask(taskId: string, values: TaskFormValues): Promise<void> {
    if (!currentUser) return;
    const existingTask = state.tasks.find((task) => task.id === taskId);
    if (!existingTask || !canAccessTask(currentUser, existingTask)) return;

    if (runtimeMode === 'supabase') {
      throw new Error('El módulo legacy de tareas fue sustituido por casos y subtareas en la Fase 10.');
    }

    commit((previous) => {
      const current = previous.tasks.find((task) => task.id === taskId);
      if (!current || !canAccessTask(currentUser, current)) return previous;

      const updatedTask: Task = {
        ...current,
        userId: currentUser.role === 'admin' ? values.userId : current.userId,
        title: values.title.trim(),
        description: values.description.trim(),
        status: values.status,
        dueDate: values.dueDate || null,
        updatedAt: nowISO()
      };

      const notifications = [...previous.notifications];
      if (updatedTask.userId !== currentUser.id) {
        notifications.unshift(
          makeNotification({
            recipientUserId: updatedTask.userId,
            actorUserId: currentUser.id,
            taskId: updatedTask.id,
            type: 'task_updated',
            title: 'Tarea actualizada',
            message: `${currentUser.name} actualizó la tarea ${updatedTask.title}.`
          })
        );
      }

      return {
        ...previous,
        tasks: previous.tasks.map((task) => (task.id === taskId ? updatedTask : task)),
        notifications
      };
    });
  }

  async function deleteTask(taskId: string): Promise<void> {
    if (!currentUser) return;
    const existingTask = state.tasks.find((task) => task.id === taskId);
    if (!existingTask || !canAccessTask(currentUser, existingTask)) return;

    if (runtimeMode === 'supabase') {
      throw new Error('El módulo legacy de tareas fue sustituido por casos y subtareas en la Fase 10.');
    }

    commit((previous) => ({
      ...previous,
      tasks: previous.tasks.filter((task) => task.id !== taskId),
      notifications: previous.notifications.filter((notification) => notification.taskId !== taskId)
    }));
  }

  async function markNotificationRead(notificationId: string): Promise<void> {
    if (runtimeMode === 'supabase') {
      const { error } = await supabase!.from('notifications').update({ is_read: true, read_at: nowISO() }).eq('id', notificationId).eq('recipient_user_id', currentUser?.id ?? '');
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
        .eq('is_read', false)
        .is('task_id', null);
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

  async function createUser(values: UserFormValues): Promise<void> {
    if (currentUser?.role !== 'admin') return;

    if (runtimeMode === 'supabase') {
      showSupabaseAdminNotice('Crear usuarios desde la SPA no está habilitado en modo Supabase.');
      return;
    }

    const timestamp = nowISO();
    const user: User = {
      id: makeId('usr'),
      name: values.name.trim(),
      email: normalizeEmail(values.email),
      password: values.password || 'User123*',
      role: values.role,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    commit((previous) => ({ ...previous, users: [user, ...previous.users] }));
  }

  async function updateUser(userId: string, values: UserFormValues): Promise<void> {
    if (currentUser?.role !== 'admin') return;

    if (runtimeMode === 'supabase') {
      throw new Error('La gestión legacy de usuarios fue sustituida por membresías y roles RBAC en la Fase 9.');
    }

    commit((previous) => {
      const current = previous.users.find((user) => user.id === userId);
      if (!current) return previous;

      const adminCount = previous.users.filter((user) => user.role === 'admin').length;
      const requestedRole = current.role === 'admin' && values.role === 'user' && adminCount <= 1 ? 'admin' : values.role;

      return {
        ...previous,
        users: previous.users.map((user) =>
          user.id === userId
            ? {
                ...user,
                name: values.name.trim(),
                email: normalizeEmail(values.email),
                role: requestedRole,
                password: values.password?.trim() ? values.password : user.password,
                updatedAt: nowISO()
              }
            : user
        )
      };
    });
  }

  async function deleteUser(userId: string): Promise<void> {
    if (currentUser?.role !== 'admin' || userId === currentUser.id) return;

    if (runtimeMode === 'supabase') {
      showSupabaseAdminNotice('Eliminar usuarios desde la SPA no está habilitado en modo Supabase.');
      return;
    }

    commit((previous) => {
      const target = previous.users.find((user) => user.id === userId);
      if (!target) return previous;
      const adminCount = previous.users.filter((user) => user.role === 'admin').length;
      if (target.role === 'admin' && adminCount <= 1) return previous;

      return {
        ...previous,
        users: previous.users.filter((user) => user.id !== userId),
        tasks: previous.tasks.filter((task) => task.userId !== userId),
        notifications: previous.notifications.filter(
          (notification) => notification.recipientUserId !== userId && notification.actorUserId !== userId
        )
      };
    });
  }

  async function updateProfile(values: { name: string; email: string; password?: string }): Promise<void> {
    if (!currentUser) return;

    if (runtimeMode === 'supabase') {
      const nextEmail = normalizeEmail(values.email);
      await updateAuthUser({ email: nextEmail !== normalizeEmail(currentUser.email) ? nextEmail : undefined, password: values.password?.trim() || undefined });
      const { error } = await supabase!
        .from('profiles')
        .update({
          name: values.name.trim(),
          email: nextEmail,
          updated_at: nowISO()
        })
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
    if (runtimeMode !== 'supabase' && currentUser.role !== 'admin') return;
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
      settings: {
        inactivityTimeoutMinutes: sanitized
      }
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
    visibleTasks: visibleTasks.sort((a, b) => {
      const overdueDiff = Number(isOverdue(b)) - Number(isOverdue(a));
      if (overdueDiff !== 0) return overdueDiff;
      return (a.dueDate ?? '9999-12-31').localeCompare(b.dueDate ?? '9999-12-31');
    }),
    unreadNotifications,
    isLoading,
    dataMode: runtimeMode,
    isSupabaseConfigured,
    login,
    logout,
    resetDemoData,
    createTask,
    updateTask,
    deleteTask,
    markNotificationRead,
    markAllNotificationsRead,
    createUser,
    updateUser,
    deleteUser,
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
