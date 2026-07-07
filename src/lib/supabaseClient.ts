import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const rawRequestedMode = (import.meta.env.VITE_DATA_MODE as string | undefined)?.trim().toLowerCase();
const isProduction = Boolean(import.meta.env.PROD);
const allowDemoModeInProduction = (import.meta.env.VITE_ALLOW_DEMO_MODE as string | undefined) === 'true';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

function resolveDataMode(): 'local' | 'supabase' {
  if (rawRequestedMode && rawRequestedMode !== 'local' && rawRequestedMode !== 'supabase') {
    throw new Error(`VITE_DATA_MODE inválido: "${rawRequestedMode}". Usa "local" o "supabase".`);
  }

  const requestedMode: 'local' | 'supabase' = rawRequestedMode === 'local' || rawRequestedMode === 'supabase'
    ? rawRequestedMode
    : (isProduction ? 'supabase' : 'local');

  if (requestedMode === 'supabase' && !isSupabaseConfigured) {
    throw new Error('SIGC requiere VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para iniciar en modo Supabase.');
  }

  if (isProduction && requestedMode === 'local' && !allowDemoModeInProduction) {
    throw new Error('El modo local/demo está bloqueado en producción. Configura Supabase o define VITE_ALLOW_DEMO_MODE=true de forma explícita.');
  }

  return requestedMode;
}

export const dataMode = resolveDataMode();

export const supabase = dataMode === 'supabase'
  ? createClient<Database>(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;
