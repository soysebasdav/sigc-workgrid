import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const requestedMode = (import.meta.env.VITE_DATA_MODE as string | undefined)?.toLowerCase();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const dataMode = requestedMode === 'supabase' && isSupabaseConfigured ? 'supabase' : 'local';

export const supabase = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;
