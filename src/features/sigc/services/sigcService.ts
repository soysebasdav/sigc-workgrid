import { dataMode } from '../../../lib/supabaseClient';
import type {
  AllowedCaseState,
  CaseAssignmentInput,
  ChangeCaseStateInput,
  CreatedCaseResult,
  ManualCaseCreateInput,
  PublicCaseCreateInput,
  PublicCaseTypeOption,
  SigcAssignment,
  SigcCase,
  SigcCaseFilters,
  SigcCasePage,
  SigcCatalogs,
  SigcMember,
  SigcRepositoryResult
} from '../domain/types';
import { demoPublicSigcRepository, demoSigcRepository } from '../repositories/demoSigcRepository';
import { supabasePublicSigcRepository, supabaseSigcRepository } from '../repositories/supabaseSigcRepository';

export const SIGC_DATA_CHANGED_EVENT = 'sigc:data-changed';

export function emitSigcDataChanged(): void {
  window.dispatchEvent(new CustomEvent(SIGC_DATA_CHANGED_EVENT));
}

async function withSafeReadFallback<T>(remote: () => Promise<T>, local: () => Promise<T>): Promise<SigcRepositoryResult<T>> {
  if (dataMode !== 'supabase') return { data: await local(), source: 'demo' };

  try {
    return { data: await remote(), source: 'supabase' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.warn('SIGC: no fue posible leer Supabase. Se usa el repositorio demo.', error);
    return {
      data: await local(),
      source: 'demo',
      warning: `No fue posible leer el dominio SIGC en Supabase. Fallback demo activo: ${message}`
    };
  }
}

function mutationRepository() {
  return dataMode === 'supabase' ? supabaseSigcRepository : demoSigcRepository;
}

function publicMutationRepository() {
  return dataMode === 'supabase' ? supabasePublicSigcRepository : demoPublicSigcRepository;
}

export const sigcService = {
  listCases(): Promise<SigcRepositoryResult<SigcCase[]>> {
    return withSafeReadFallback(() => supabaseSigcRepository.listCases(), () => demoSigcRepository.listCases());
  },

  searchCases(filters: SigcCaseFilters): Promise<SigcRepositoryResult<SigcCasePage>> {
    return withSafeReadFallback(() => supabaseSigcRepository.searchCases(filters), () => demoSigcRepository.searchCases(filters));
  },

  getCase(identifier: string): Promise<SigcRepositoryResult<SigcCase | null>> {
    return withSafeReadFallback(() => supabaseSigcRepository.getCaseByIdentifier(identifier), () => demoSigcRepository.getCaseByIdentifier(identifier));
  },

  getCatalogs(): Promise<SigcRepositoryResult<SigcCatalogs>> {
    return withSafeReadFallback(() => supabaseSigcRepository.getCatalogs(), () => demoSigcRepository.getCatalogs());
  },

  getMembers(): Promise<SigcRepositoryResult<SigcMember[]>> {
    return withSafeReadFallback(() => supabaseSigcRepository.listMembers(), () => demoSigcRepository.listMembers());
  },

  getAssignments(caseId: string): Promise<SigcRepositoryResult<SigcAssignment[]>> {
    return withSafeReadFallback(() => supabaseSigcRepository.listCaseAssignments(caseId), () => demoSigcRepository.listCaseAssignments(caseId));
  },

  getAllowedStates(caseId: string): Promise<SigcRepositoryResult<AllowedCaseState[]>> {
    return withSafeReadFallback(() => supabaseSigcRepository.listAllowedStates(caseId), () => demoSigcRepository.listAllowedStates(caseId));
  },

  getPublicCaseTypes(): Promise<SigcRepositoryResult<PublicCaseTypeOption[]>> {
    return withSafeReadFallback(() => supabasePublicSigcRepository.getPublicCaseTypes(), () => demoPublicSigcRepository.getPublicCaseTypes());
  },

  async createPublicCase(input: PublicCaseCreateInput): Promise<CreatedCaseResult> {
    const result = await publicMutationRepository().createPublicCase(input);
    emitSigcDataChanged();
    return result;
  },

  async createManualCase(input: ManualCaseCreateInput): Promise<CreatedCaseResult> {
    const result = await mutationRepository().createManualCase(input);
    emitSigcDataChanged();
    return result;
  },

  async assignCase(input: CaseAssignmentInput): Promise<void> {
    await mutationRepository().assignCase(input);
    emitSigcDataChanged();
  },

  async changeCaseState(input: ChangeCaseStateInput): Promise<void> {
    await mutationRepository().changeCaseState(input);
    emitSigcDataChanged();
  }
};
