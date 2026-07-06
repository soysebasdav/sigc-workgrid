import type { Session, User as SupabaseAuthUser } from '@supabase/supabase-js';
import type { AppSettings, AppState, Notification, User } from '../types';
import { supabase } from './supabaseClient';

function requireSupabase() {
  if (!supabase) throw new Error('Supabase no está configurado. Revisa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.');
  return supabase;
}


async function ensureSigcOrganization(): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('ensure_user_organization');
  if (error) throw error;
  if (!data) throw new Error('No fue posible resolver la organización activa del usuario.');
  return String(data);
}

function mapProfile(row: {
  id: string;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
}): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password: '',
    role: 'user',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}


function mapNotification(row: {
  id: string;
  recipient_user_id: string;
  actor_user_id: string | null;
  task_id: string | null;
  case_id?: string | null;
  type: Notification['type'];
  title: string;
  message: string;
  action_url?: string | null;
  is_read: boolean;
  created_at: string;
}): Notification {
  return {
    id: row.id,
    recipientUserId: row.recipient_user_id,
    actorUserId: row.actor_user_id,
    taskId: row.task_id,
    caseId: row.case_id ?? null,
    type: row.type,
    title: row.title,
    message: row.message,
    actionUrl: row.action_url ?? null,
    isRead: row.is_read,
    createdAt: row.created_at
  };
}

function mapSettings(payload: unknown): AppSettings {
  const data = payload && typeof payload === 'object' ? payload as Record<string, any> : {};
  const timeout = Number(data.security?.inactivityTimeoutMinutes ?? 10);
  return { inactivityTimeoutMinutes: Math.max(1, Number.isFinite(timeout) ? timeout : 10), organizationId: typeof data.organizationId === 'string' ? data.organizationId : null };
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

  const organizationId = await ensureSigcOrganization();

  const [profileResponse, notificationsResponse, settingsResponse] = await Promise.all([
    client.from('profiles').select('id,name,email,created_at,updated_at').eq('id', currentUserId).single(),
    (client as any)
      .from('notifications')
      .select('id,recipient_user_id,actor_user_id,task_id,case_id,type,title,message,action_url,is_read,created_at')
      .eq('recipient_user_id', currentUserId)
      .eq('organization_id', organizationId)
      .is('task_id', null)
      .order('created_at', { ascending: false })
      .limit(250),
    (client as any).rpc('get_runtime_settings')
  ]);

  if (profileResponse.error) throw profileResponse.error;
  if (notificationsResponse.error) throw notificationsResponse.error;
  if (settingsResponse.error) throw settingsResponse.error;

  return {
    currentUserId,
    users: [mapProfile(profileResponse.data)],
    tasks: [],
    notifications: (notificationsResponse.data ?? []).map(mapNotification),
    settings: mapSettings(settingsResponse.data)
  };
}

export async function signInWithPassword(email: string, password: string): Promise<string | null> {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) return null;
  await ensureProfile(data.user);
  await ensureSigcOrganization();
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
