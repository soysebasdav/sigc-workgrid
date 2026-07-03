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
      'Por seguridad no se debe usar service_role desde React. Por ahora crea/elimina usuarios desde Supabase Authentication y administra nombre/rol desde la tabla profiles.'
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
    return state.notifications.filter((notification) => notification.recipientUserId === currentUser.id && !notification.isRead).length;
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
      const timestamp = nowISO();
      const assigneeId = currentUser.role === 'admin' ? values.userId : currentUser.id;
      const { data, error } = await supabase!
        .from('tasks')
        .insert({
          user_id: assigneeId,
          title: values.title.trim(),
          description: values.description.trim() || null,
          status: values.status,
          due_date: values.dueDate || null,
          created_at: timestamp,
          updated_at: timestamp
        })
        .select('id')
        .single();

      if (error) throw error;

      if (data && assigneeId !== currentUser.id) {
        await supabase!.from('notifications').insert({
          recipient_user_id: assigneeId,
          actor_user_id: currentUser.id,
          task_id: data.id,
          type: 'task_created',
          title: 'Nueva tarea asignada',
          message: `${currentUser.name} te asignó la tarea ${values.title.trim()}.`
        });
      }

      await reloadSupabaseState(currentUser.id);
      return;
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
      const assigneeId = currentUser.role === 'admin' ? values.userId : existingTask.userId;
      const { error } = await supabase!
        .from('tasks')
        .update({
          user_id: assigneeId,
          title: values.title.trim(),
          description: values.description.trim() || null,
          status: values.status,
          due_date: values.dueDate || null,
          updated_at: nowISO()
        })
        .eq('id', taskId);

      if (error) throw error;

      if (assigneeId !== currentUser.id) {
        await supabase!.from('notifications').insert({
          recipient_user_id: assigneeId,
          actor_user_id: currentUser.id,
          task_id: taskId,
          type: 'task_updated',
          title: 'Tarea actualizada',
          message: `${currentUser.name} actualizó la tarea ${values.title.trim()}.`
        });
      }

      await reloadSupabaseState(currentUser.id);
      return;
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
      const { error } = await supabase!.from('tasks').delete().eq('id', taskId);
      if (error) throw error;
      await reloadSupabaseState(currentUser.id);
      return;
    }

    commit((previous) => ({
      ...previous,
      tasks: previous.tasks.filter((task) => task.id !== taskId),
      notifications: previous.notifications.filter((notification) => notification.taskId !== taskId)
    }));
  }

  async function markNotificationRead(notificationId: string): Promise<void> {
    if (runtimeMode === 'supabase') {
      const { error } = await supabase!.from('notifications').update({ is_read: true }).eq('id', notificationId);
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
      const { error } = await supabase!
        .from('notifications')
        .update({ is_read: true })
        .eq('recipient_user_id', currentUser.id)
        .eq('is_read', false);
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
      const { error } = await supabase!
        .from('profiles')
        .update({
          name: values.name.trim(),
          email: normalizeEmail(values.email),
          role: values.role,
          updated_at: nowISO()
        })
        .eq('id', userId);
      if (error) throw error;
      await reloadSupabaseState(currentUser.id);
      return;
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
    if (currentUser?.role !== 'admin') return;
    const sanitized = Math.max(1, Number(values.inactivityTimeoutMinutes) || 10);

    if (runtimeMode === 'supabase') {
      const { error } = await supabase!
        .from('app_settings')
        .upsert({
          setting_key: 'inactivity_timeout_minutes',
          setting_value: String(sanitized),
          updated_at: nowISO()
        }, { onConflict: 'setting_key' });
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
