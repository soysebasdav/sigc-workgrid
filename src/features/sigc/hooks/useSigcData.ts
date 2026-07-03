import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AllowedCaseState,
  PublicCaseTypeOption,
  SigcAssignment,
  SigcCase,
  SigcCaseFilters,
  SigcCasePage,
  SigcCatalogs,
  SigcComment,
  SigcDataSource,
  SigcDocument,
  SigcMember,
  SigcSubtask,
  SigcSubtaskFilters,
  SigcTimelineEvent
} from '../domain/types';
import { SIGC_DATA_CHANGED_EVENT, sigcService } from '../services/sigcService';

type AsyncState<T> = {
  data: T;
  isLoading: boolean;
  source: SigcDataSource;
  warning: string | null;
  error: string | null;
  reload: () => void;
};

function useSigcQuery<T>(
  key: string,
  initialData: T,
  loader: () => Promise<{ data: T; source: SigcDataSource; warning?: string }>,
  listenForMutations = true
): AsyncState<T> {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<Omit<AsyncState<T>, 'reload'>>({
    data: initialData,
    isLoading: true,
    source: 'demo',
    warning: null,
    error: null
  });

  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    if (!listenForMutations) return;
    const handler = () => reload();
    window.addEventListener(SIGC_DATA_CHANGED_EVENT, handler);
    return () => window.removeEventListener(SIGC_DATA_CHANGED_EVENT, handler);
  }, [listenForMutations, reload]);

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, isLoading: true, error: null }));
    void loader()
      .then((result) => {
        if (active) setState({ data: result.data, isLoading: false, source: result.source, warning: result.warning ?? null, error: null });
      })
      .catch((error: unknown) => {
        if (active) setState((current) => ({ ...current, isLoading: false, error: error instanceof Error ? error.message : 'No fue posible cargar la información.' }));
      });
    return () => { active = false; };
    // key captures filter/identifier changes; revision captures explicit/global invalidation.
  }, [key, revision]);

  return { ...state, reload };
}

export function useSigcCases(): AsyncState<SigcCase[]> {
  return useSigcQuery('all-cases', [], () => sigcService.listCases());
}

export function useSigcCaseSearch(filters: SigcCaseFilters): AsyncState<SigcCasePage> {
  const key = useMemo(() => JSON.stringify(filters), [filters]);
  return useSigcQuery(key, { items: [], total: 0, page: filters.page ?? 1, pageSize: filters.pageSize ?? 10 }, () => sigcService.searchCases(filters));
}

export function useSigcCase(identifier: string | undefined): AsyncState<SigcCase | null> {
  return useSigcQuery(
    identifier ?? 'missing-case',
    null,
    () => identifier ? sigcService.getCase(identifier) : Promise.reject(new Error('No se recibió un identificador de caso.'))
  );
}

export function useSigcCatalogs(): AsyncState<SigcCatalogs | null> {
  return useSigcQuery('catalogs', null, () => sigcService.getCatalogs(), false);
}

export function useSigcMembers(): AsyncState<SigcMember[]> {
  return useSigcQuery('members', [], () => sigcService.getMembers(), false);
}

export function useCaseAssignments(caseId: string | undefined): AsyncState<SigcAssignment[]> {
  return useSigcQuery(
    `assignments:${caseId ?? 'missing'}`,
    [],
    () => caseId ? sigcService.getAssignments(caseId) : Promise.resolve({ data: [], source: 'demo' as const })
  );
}

export function useAllowedCaseStates(caseId: string | undefined): AsyncState<AllowedCaseState[]> {
  return useSigcQuery(
    `allowed-states:${caseId ?? 'missing'}`,
    [],
    () => caseId ? sigcService.getAllowedStates(caseId) : Promise.resolve({ data: [], source: 'demo' as const })
  );
}

export function usePublicCaseTypes(): AsyncState<PublicCaseTypeOption[]> {
  return useSigcQuery('public-case-types', [], () => sigcService.getPublicCaseTypes(), false);
}


export function useSigcSubtasks(filters: SigcSubtaskFilters = {}): AsyncState<SigcSubtask[]> {
  const key = useMemo(() => `subtasks:${JSON.stringify(filters)}`, [filters]);
  return useSigcQuery(key, [], () => sigcService.listSubtasks(filters));
}

export function useCaseComments(caseId: string | undefined): AsyncState<SigcComment[]> {
  return useSigcQuery(
    `comments:${caseId ?? 'missing'}`,
    [],
    () => caseId ? sigcService.getCaseComments(caseId) : Promise.resolve({ data: [], source: 'demo' as const })
  );
}

export function useSigcDocuments(caseId?: string): AsyncState<SigcDocument[]> {
  return useSigcQuery(`documents:${caseId ?? 'all'}`, [], () => sigcService.getDocuments(caseId));
}

export function useCaseTimeline(caseId: string | undefined): AsyncState<SigcTimelineEvent[]> {
  return useSigcQuery(
    `timeline:${caseId ?? 'missing'}`,
    [],
    () => caseId ? sigcService.getCaseTimeline(caseId) : Promise.resolve({ data: [], source: 'demo' as const })
  );
}
