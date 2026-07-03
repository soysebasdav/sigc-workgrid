import { dataMode } from '../../../lib/supabaseClient';
import type { SigcCase, SigcCatalogs, SigcRepositoryResult } from '../domain/types';
import { demoSigcRepository } from '../repositories/demoSigcRepository';
import { supabaseSigcRepository } from '../repositories/supabaseSigcRepository';

async function withSafeFallback<T>(remote: () => Promise<T>, local: () => Promise<T>): Promise<SigcRepositoryResult<T>> {
  if (dataMode !== 'supabase') return { data: await local(), source: 'demo' };

  try {
    return { data: await remote(), source: 'supabase' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.warn('SIGC: no fue posible leer el nuevo dominio de Supabase. Se usa el repositorio demo.', error);
    return {
      data: await local(),
      source: 'demo',
      warning: `Supabase todavía no tiene aplicada la migración de Fase 1 o la sesión no tiene acceso. Fallback demo activo: ${message}`
    };
  }
}

export const sigcService = {
  listCases(): Promise<SigcRepositoryResult<SigcCase[]>> {
    return withSafeFallback(() => supabaseSigcRepository.listCases(), () => demoSigcRepository.listCases());
  },

  getCase(identifier: string): Promise<SigcRepositoryResult<SigcCase | null>> {
    return withSafeFallback(() => supabaseSigcRepository.getCaseByIdentifier(identifier), () => demoSigcRepository.getCaseByIdentifier(identifier));
  },

  getCatalogs(): Promise<SigcRepositoryResult<SigcCatalogs>> {
    return withSafeFallback(() => supabaseSigcRepository.getCatalogs(), () => demoSigcRepository.getCatalogs());
  }
};
