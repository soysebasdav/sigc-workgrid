import type { Session, User as SupabaseAuthUser } from '@supabase/supabase-js';
import type { AppSettings, AppState, Notification, Task, User } from '../types';
import { supabase } from './supabaseClient';

function requireSupabase() {
  if (!supabase) throw new Error('Supabase no está configurado. Revisa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.');
  return supabase;
}


async function tryEnsureSigcOrganization(): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('ensure_user_organization');
  if (error) {
    // Compatibilidad de Fase 0: la app puede iniciar antes de aplicar la migración de Fase 1.
    console.warn('SIGC: ensure_user_organization aún no está disponible o falló.', error.message);
  }
}

function mapProfile(row: {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  created_at: string;
  updated_at: string;
}): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password: '',
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapTask(row: {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: Task['status'];
  due_date: string | null;
  created_at: string;
  updated_at: string;
}): Task {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description ?? '',
    status: row.status,
    dueDate: row.due_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapNotification(row: {
  id: string;
  recipient_user_id: string;
  actor_user_id: string | null;
  task_id: string | null;
  type: Notification['type'];
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}): Notification {
  return {
    id: row.id,
    recipientUserId: row.recipient_user_id,
    actorUserId: row.actor_user_id,
    taskId: row.task_id,
    type: row.type,
    title: row.title,
    message: row.message,
    isRead: row.is_read,
    createdAt: row.created_at
  };
}

function mapSettings(rows: Array<{ setting_key: string; setting_value: string }>): AppSettings {
  const timeout = rows.find((row) => row.setting_key === 'inactivity_timeout_minutes')?.setting_value;
  return {
    inactivityTimeoutMinutes: Math.max(1, Number(timeout) || 10)
  };
}

export async function getCurrentSession(): Promise<Session | null> {
  const client = requireSupabase();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function ensureProfile(authUser: SupabaseAuthUser): Promise<void> {
  const client = requireSupabase();
  const fallbackName = authUser.user_metadata?.name as string | undefined;
  const email = authUser.email ?? '';

  if (!email) return;

  const { error } = await client
    .from('profiles')
    .upsert({
      id: authUser.id,
      email,
      name: fallbackName || email.split('@')[0] || 'Usuario SIGC'
    }, { onConflict: 'id' });

  if (error) throw error;
}

export async function loadSupabaseState(currentUserId: string | null): Promise<AppState> {
  const client = requireSupabase();

  if (!currentUserId) {
    return {
      currentUserId: null,
      users: [],
      tasks: [],
      notifications: [],
      settings: { inactivityTimeoutMinutes: 10 }
    };
  }

  await tryEnsureSigcOrganization();

  const [profilesResponse, tasksResponse, notificationsResponse, settingsResponse] = await Promise.all([
    client.from('profiles').select('id,name,email,role,created_at,updated_at').order('created_at', { ascending: true }),
    client.from('tasks').select('id,user_id,title,description,status,due_date,created_at,updated_at').order('created_at', { ascending: false }),
    client.from('notifications').select('id,recipient_user_id,actor_user_id,task_id,type,title,message,is_read,created_at').order('created_at', { ascending: false }),
    client.from('app_settings').select('setting_key,setting_value')
  ]);

  if (profilesResponse.error) throw profilesResponse.error;
  if (tasksResponse.error) throw tasksResponse.error;
  if (notificationsResponse.error) throw notificationsResponse.error;
  if (settingsResponse.error) throw settingsResponse.error;

  return {
    currentUserId,
    users: profilesResponse.data.map(mapProfile),
    tasks: tasksResponse.data.map(mapTask),
    notifications: notificationsResponse.data.map(mapNotification),
    settings: mapSettings(settingsResponse.data)
  };
}

export async function signInWithPassword(email: string, password: string): Promise<string | null> {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) return null;
  await ensureProfile(data.user);
  await tryEnsureSigcOrganization();
  return data.user.id;
}

export async function signOut(): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export async function updateAuthUser(values: { email?: string; password?: string }): Promise<void> {
  const client = requireSupabase();
  const payload: { email?: string; password?: string } = {};
  if (values.email) payload.email = values.email;
  if (values.password) payload.password = values.password;
  if (!payload.email && !payload.password) return;
  const { error } = await client.auth.updateUser(payload);
  if (error) throw error;
}
