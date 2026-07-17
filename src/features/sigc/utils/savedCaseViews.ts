import type { SigcCaseFilters } from '../domain/types';

export interface SavedCaseView {
  id: string;
  name: string;
  filters: SigcCaseFilters;
  createdAt: string;
  updatedAt: string;
}

const MAX_SAVED_VIEWS = 20;
const ALLOWED_FILTER_KEYS: ReadonlyArray<keyof SigcCaseFilters> = [
  'query', 'fromDate', 'toDate', 'stateId', 'areaId', 'ownerId', 'caseTypeId',
  'priorityId', 'overdueOnly', 'upcomingOnly', 'pageSize'
];

function cleanString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

export function normalizeCaseFilters(value: Partial<SigcCaseFilters> | null | undefined): SigcCaseFilters {
  const source = value ?? {};
  const result: SigcCaseFilters = { page: 1, pageSize: 10 };

  for (const key of ALLOWED_FILTER_KEYS) {
    const current = source[key];
    if (key === 'overdueOnly' || key === 'upcomingOnly') {
      if (current === true) result[key] = true;
      continue;
    }
    if (key === 'pageSize') {
      const numeric = Number(current);
      if (Number.isFinite(numeric)) result.pageSize = Math.min(100, Math.max(5, Math.trunc(numeric)));
      continue;
    }
    const cleaned = cleanString(current);
    if (cleaned) (result as Record<string, unknown>)[key] = cleaned;
  }

  if (result.overdueOnly) result.upcomingOnly = false;
  if (result.upcomingOnly) result.overdueOnly = false;
  return result;
}

export function savedCaseViewsStorageKey(userId: string | undefined, organizationId: string | undefined): string {
  const safeUser = cleanString(userId) ?? 'anonymous';
  const safeOrganization = cleanString(organizationId) ?? 'default';
  return `orkesta:saved-case-views:${safeOrganization}:${safeUser}`;
}

function isSavedCaseView(value: unknown): value is SavedCaseView {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SavedCaseView>;
  return Boolean(cleanString(candidate.id) && cleanString(candidate.name) && cleanString(candidate.createdAt) && cleanString(candidate.updatedAt));
}

export function parseSavedCaseViews(raw: string | null): SavedCaseView[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isSavedCaseView)
      .map((view) => ({ ...view, name: view.name.trim().slice(0, 80), filters: normalizeCaseFilters(view.filters) }))
      .slice(0, MAX_SAVED_VIEWS);
  } catch {
    return [];
  }
}

export function loadSavedCaseViews(storageKey: string): SavedCaseView[] {
  if (typeof window === 'undefined') return [];
  return parseSavedCaseViews(window.localStorage.getItem(storageKey));
}

export function persistSavedCaseViews(storageKey: string, views: SavedCaseView[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey, JSON.stringify(views.slice(0, MAX_SAVED_VIEWS)));
}

export function upsertSavedCaseView(
  current: SavedCaseView[],
  input: { name: string; filters: SigcCaseFilters; id?: string },
  now = new Date().toISOString()
): SavedCaseView[] {
  const name = input.name.trim().replace(/\s+/g, ' ').slice(0, 80);
  if (name.length < 2) throw new Error('Escribe un nombre de mínimo 2 caracteres para la vista.');
  const existingById = input.id ? current.find((view) => view.id === input.id) : undefined;
  const duplicateByName = current.find((view) => view.name.localeCompare(name, 'es', { sensitivity: 'base' }) === 0 && view.id !== input.id);
  if (duplicateByName) throw new Error('Ya existe una vista guardada con ese nombre.');

  const nextView: SavedCaseView = {
    id: existingById?.id ?? crypto.randomUUID(),
    name,
    filters: normalizeCaseFilters(input.filters),
    createdAt: existingById?.createdAt ?? now,
    updatedAt: now
  };
  const withoutCurrent = current.filter((view) => view.id !== nextView.id);
  return [nextView, ...withoutCurrent].slice(0, MAX_SAVED_VIEWS);
}

export function removeSavedCaseView(current: SavedCaseView[], id: string): SavedCaseView[] {
  return current.filter((view) => view.id !== id);
}

export function describeCaseViewFilters(filters: SigcCaseFilters): string {
  const labels: string[] = [];
  if (filters.query) labels.push(`Búsqueda: ${filters.query}`);
  if (filters.stateId) labels.push('Estado');
  if (filters.areaId) labels.push('Área');
  if (filters.ownerId) labels.push('Responsable');
  if (filters.caseTypeId) labels.push('Tipo');
  if (filters.priorityId) labels.push('Prioridad');
  if (filters.fromDate || filters.toDate) labels.push('Rango de fechas');
  if (filters.overdueOnly) labels.push('Vencidos');
  if (filters.upcomingOnly) labels.push('Próximos 72 h');
  return labels.length ? labels.join(' · ') : 'Sin filtros';
}
