import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AllowedCaseState,
  PublicIntakeContext,
  PublicIntakeLocator,
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
  SigcTimelineEvent,
  SigcSlaOverride,
  SigcCaseReview,
  SigcCaseDelivery,
  SigcCaseReminder,
  SigcAdminSnapshot,
  SigcUserManagementSnapshot,
  SigcDashboardAnalytics,
  SigcReportFilters,
  SigcReportResult,
  SigcSaasContext,
  SigcAuthorizationContext,
  PublicOrganizationInvitation,
  SigcAgendaSnapshot,
  WorkflowBoardFilters,
  WorkflowBoardSnapshot,
  AutomationRuntimeHealth
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
  listenForMutations = true,
  enabled = true
): AsyncState<T> {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<Omit<AsyncState<T>, 'reload'>>({
    data: initialData,
    isLoading: enabled,
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
    if (!enabled) {
      setState({ data: initialData, isLoading: false, source: 'demo', warning: null, error: null });
      return () => { active = false; };
    }
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
  }, [key, revision, enabled]);

  return { ...state, reload };
}

export function useSigcCases(enabled = true): AsyncState<SigcCase[]> {
  return useSigcQuery('all-cases', [], () => sigcService.listCases(), true, enabled);
}

export function useSigcCaseSearch(filters: SigcCaseFilters): AsyncState<SigcCasePage> {
  const key = useMemo(() => JSON.stringify(filters), [filters]);
  return useSigcQuery(key, { items: [], total: 0, page: filters.page ?? 1, pageSize: filters.pageSize ?? 10 }, () => sigcService.searchCases(filters));
}

export function useWorkflowBoard(filters: WorkflowBoardFilters = {}): AsyncState<WorkflowBoardSnapshot | null> {
  const key = useMemo(() => `workflow-board:${JSON.stringify(filters)}`, [filters]);
  return useSigcQuery(key, null, () => sigcService.getWorkflowBoard(filters));
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

export function usePublicIntakeContext(locator: PublicIntakeLocator): AsyncState<PublicIntakeContext | null> {
  const key = useMemo(() => `public-intake:${locator.tenant ?? ''}:${locator.hostname ?? ''}`, [locator.hostname, locator.tenant]);
  return useSigcQuery(key, null, () => sigcService.getPublicIntakeContext(locator), false);
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


export function useCaseSlaOverrides(caseId: string | undefined): AsyncState<SigcSlaOverride[]> {
  return useSigcQuery(
    `sla-overrides:${caseId ?? 'missing'}`,
    [],
    () => caseId ? sigcService.getCaseSlaOverrides(caseId) : Promise.resolve({ data: [], source: 'demo' as const })
  );
}

export function useCaseReviews(caseId: string | undefined): AsyncState<SigcCaseReview[]> {
  return useSigcQuery(
    `reviews:${caseId ?? 'missing'}`,
    [],
    () => caseId ? sigcService.getCaseReviews(caseId) : Promise.resolve({ data: [], source: 'demo' as const })
  );
}

export function useCaseDeliveries(caseId: string | undefined): AsyncState<SigcCaseDelivery[]> {
  return useSigcQuery(
    `deliveries:${caseId ?? 'missing'}`,
    [],
    () => caseId ? sigcService.getCaseDeliveries(caseId) : Promise.resolve({ data: [], source: 'demo' as const })
  );
}

export function useCaseReminders(caseId: string | undefined): AsyncState<SigcCaseReminder[]> {
  return useSigcQuery(
    `reminders:${caseId ?? 'missing'}`,
    [],
    () => caseId ? sigcService.getCaseReminders(caseId) : Promise.resolve({ data: [], source: 'demo' as const })
  );
}

export function useSigcUserManagementSnapshot(): AsyncState<SigcUserManagementSnapshot | null> {
  return useSigcQuery('user-management-snapshot', null, () => sigcService.getUserManagementSnapshot());
}

export function useSigcAdminSnapshot(): AsyncState<SigcAdminSnapshot | null> {
  return useSigcQuery('admin-snapshot', null, () => sigcService.getAdminSnapshot());
}

export function useAutomationRuntimeHealth(enabled = true): AsyncState<AutomationRuntimeHealth | null> {
  return useSigcQuery('automation-runtime-health', null, () => sigcService.getAutomationRuntimeHealth(), true, enabled);
}


export function useSigcDashboard(enabled = true): AsyncState<SigcDashboardAnalytics | null> {
  return useSigcQuery('dashboard-analytics', null, () => sigcService.getDashboardAnalytics(), true, enabled);
}

export function useSigcAgenda(from: string, to: string, enabled = true): AsyncState<SigcAgendaSnapshot | null> {
  return useSigcQuery(
    `agenda:${from}:${to}`,
    null,
    () => sigcService.getAgenda(from, to),
    true,
    enabled
  );
}

export function useSigcReport(filters: SigcReportFilters): AsyncState<SigcReportResult | null> {
  const key = useMemo(() => `report:${JSON.stringify(filters)}`, [filters]);
  return useSigcQuery(key, null, () => sigcService.getReport(filters));
}

export function useSigcSaasContext(): AsyncState<SigcSaasContext | null> {
  return useSigcQuery('saas-context', null, () => sigcService.getSaasContext());
}

export function useSigcAuthorizationContext(): AsyncState<SigcAuthorizationContext | null> {
  return useSigcQuery('authorization-context', null, () => sigcService.getAuthorizationContext());
}

export function useOrganizationInvitation(token: string | undefined): AsyncState<PublicOrganizationInvitation | null> {
  return useSigcQuery(
    `organization-invitation:${token ?? 'missing'}`,
    null,
    () => token ? sigcService.getOrganizationInvitation(token) : Promise.resolve({ data: null, source: 'demo' as const }),
    false
  );
}
