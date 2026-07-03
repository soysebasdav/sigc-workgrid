import { demoCases } from '../demoData';
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
  SigcMember
} from '../domain/types';
import type { PublicSigcRepository, SigcRepository } from './types';

const CASES_KEY = 'sigc_phase2_demo_cases';
const ASSIGNMENTS_KEY = 'sigc_phase2_demo_assignments';

const catalogs: SigcCatalogs = {
  organizationId: null,
  areas: ['Gerencia', 'Nómina', 'Talento Humano', 'Operaciones', 'SDG', 'Comercial', 'Administrativa y Financiera', 'Tecnología', 'Marketing y Telecomunicaciones', 'Jurídica']
    .map((name, index) => ({ id: `demo-area-${index + 1}`, name, isActive: true })),
  caseTypes: ['Petición', 'Contrato', 'Reclamo', 'Acción de Tutela', 'Requerimiento Interno', 'Requerimiento Externo', 'Proceso Judicial', 'Revisión de Procesos', 'Hallazgo de auditoría', 'Otros']
    .map((name, index) => ({ id: `demo-type-${index + 1}`, name, isActive: true })),
  states: ['Pendiente de Clasificación', 'Clasificado', 'Asignado', 'En Gestión', 'Pendiente de Información', 'Respuesta Elaborada', 'En Revisión / Aprobación', 'Devuelto para Ajustes', 'Aprobado', 'Enviado', 'Cerrado', 'Cancelado']
    .map((name, index) => ({ id: `demo-state-${index + 1}`, name, isActive: true })),
  priorities: ['Crítica', 'Alta', 'Media', 'Baja']
    .map((name, index) => ({ id: `demo-priority-${index + 1}`, name, isActive: true })),
  roles: ['Administrador', 'Director', 'Coordinador', 'Analista', 'Consulta', 'Cliente Externo']
    .map((name, index) => ({ id: `demo-role-${index + 1}`, name, isActive: true }))
};

const members: SigcMember[] = [
  { userId: 'demo-user-1', name: 'Laura Méndez', email: 'laura@sigc.demo', roleName: 'Coordinador' },
  { userId: 'demo-user-2', name: 'Felipe Vargas', email: 'felipe@sigc.demo', roleName: 'Analista' },
  { userId: 'demo-user-3', name: 'Mónica Díaz', email: 'monica@sigc.demo', roleName: 'Analista' },
  { userId: 'demo-user-4', name: 'Natalia Bernal', email: 'natalia@sigc.demo', roleName: 'Analista' },
  { userId: 'demo-user-5', name: 'Julián Pérez', email: 'julian@sigc.demo', roleName: 'Analista' }
];

function readCases(): SigcCase[] {
  try {
    const raw = localStorage.getItem(CASES_KEY);
    if (raw) return JSON.parse(raw) as SigcCase[];
  } catch {
    // Fallback to packaged demo data.
  }
  const seeded = demoCases.map((item, index) => enrichDemoCase(item, index));
  writeCases(seeded);
  return seeded;
}

function writeCases(cases: SigcCase[]): void {
  try {
    localStorage.setItem(CASES_KEY, JSON.stringify(cases));
  } catch {
    // Local demo still works in memory through the returned values.
  }
}

function readAssignments(): Record<string, SigcAssignment[]> {
  try {
    return JSON.parse(localStorage.getItem(ASSIGNMENTS_KEY) ?? '{}') as Record<string, SigcAssignment[]>;
  } catch {
    return {};
  }
}

function writeAssignments(value: Record<string, SigcAssignment[]>): void {
  try {
    localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(value));
  } catch {
    // Ignore localStorage failures in demo mode.
  }
}

function enrichDemoCase(item: SigcCase, index: number): SigcCase {
  const type = catalogs.caseTypes.find((entry) => item.type.toLowerCase().includes(entry.name.toLowerCase().split(' ')[0])) ?? catalogs.caseTypes[index % catalogs.caseTypes.length];
  const priority = catalogs.priorities.find((entry) => entry.name === item.priority) ?? catalogs.priorities[2];
  const state = catalogs.states.find((entry) => entry.name === item.state) ?? catalogs.states[0];
  const area = catalogs.areas.find((entry) => entry.name === item.area) ?? catalogs.areas[0];
  const owner = members.find((entry) => entry.name === item.owner);
  const dueAt = item.dueAt ?? new Date(`${item.due}T17:30:00-05:00`).toISOString();
  const openedAt = item.openedAt ?? new Date(new Date(dueAt).getTime() - 5 * 86400000).toISOString();
  return {
    ...item,
    databaseId: item.databaseId ?? `demo-case-${index + 1}`,
    typeId: type.id,
    priorityId: priority.id,
    stateId: state.id,
    areaId: area.id,
    ownerId: owner?.userId,
    description: item.description ?? item.subject,
    openedAt,
    dueAt,
    updatedAt: item.updatedAt ?? new Date().toISOString()
  };
}

function nextRadicado(cases: SigcCase[]): string {
  const year = new Date().getFullYear();
  const max = cases.reduce((current, item) => {
    const match = item.radicado.match(/-(\d{6})$/);
    return Math.max(current, Number(match?.[1] ?? 0));
  }, 0);
  return `SIG-${year}-${String(max + 1).padStart(6, '0')}`;
}

function dueFromType(typeId: string): string {
  const type = catalogs.caseTypes.find((item) => item.id === typeId)?.name;
  const hours = type === 'Acción de Tutela' ? 24 : 5 * 24;
  return new Date(Date.now() + hours * 3600000).toISOString();
}

function matchesFilters(item: SigcCase, filters: SigcCaseFilters): boolean {
  const query = filters.query?.trim().toLowerCase();
  if (query && ![item.radicado, item.subject, item.requester, item.company, item.requesterEmail ?? ''].some((value) => value.toLowerCase().includes(query))) return false;
  if (filters.stateId && item.stateId !== filters.stateId) return false;
  if (filters.areaId && item.areaId !== filters.areaId) return false;
  if (filters.ownerId && item.ownerId !== filters.ownerId) return false;
  if (filters.caseTypeId && item.typeId !== filters.caseTypeId) return false;
  if (filters.priorityId && item.priorityId !== filters.priorityId) return false;
  if (filters.overdueOnly && (!item.dueAt || new Date(item.dueAt).getTime() >= Date.now())) return false;
  if (filters.upcomingOnly) {
    const due = item.dueAt ? new Date(item.dueAt).getTime() : NaN;
    if (!Number.isFinite(due) || due < Date.now() || due > Date.now() + 72 * 3600000) return false;
  }
  return true;
}

function createCaseBase(input: PublicCaseCreateInput | ManualCaseCreateInput, source: string, stateName: string): CreatedCaseResult {
  const cases = readCases();
  const radicado = nextRadicado(cases);
  const caseType = catalogs.caseTypes.find((item) => item.id === input.caseTypeId)!;
  const priorityId = 'priorityId' in input ? input.priorityId : catalogs.priorities[2].id;
  const priority = catalogs.priorities.find((item) => item.id === priorityId) ?? catalogs.priorities[2];
  const state = catalogs.states.find((item) => item.name === stateName) ?? catalogs.states[0];
  const dueAt = dueFromType(input.caseTypeId);
  const openedAt = new Date().toISOString();
  const firstAssignment = 'assignments' in input ? input.assignments[0] : undefined;
  const area = firstAssignment ? catalogs.areas.find((item) => item.id === firstAssignment.areaId) : undefined;
  const owner = firstAssignment?.responsibleUserId ? members.find((item) => item.userId === firstAssignment.responsibleUserId) : undefined;

  const created: SigcCase = {
    id: radicado,
    databaseId: `demo-${crypto.randomUUID()}`,
    radicado,
    typeId: caseType.id,
    type: caseType.name,
    subject: input.subject.trim(),
    description: input.description.trim(),
    company: input.requesterCompany.trim() || 'Sin empresa',
    requester: input.requesterName.trim(),
    requesterDocument: input.requesterDocument.trim() || undefined,
    requesterEmail: input.requesterEmail.trim() || undefined,
    requesterPhone: input.requesterPhone.trim() || undefined,
    areaId: area?.id,
    area: area?.name ?? 'Sin área',
    ownerId: owner?.userId,
    owner: owner?.name ?? 'Sin responsable',
    stateId: state.id,
    state: state.name,
    priorityId: priority.id,
    priority: priority.name as SigcCase['priority'],
    sla: caseType.name === 'Acción de Tutela' ? '24 horas' : '5 días calendario',
    openedAt,
    dueAt,
    due: new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(dueAt)),
    sem: 'green',
    progress: 0,
    updatedAt: openedAt,
    updated: 'Ahora',
    risk: 'En tiempo',
    source
  };

  writeCases([created, ...cases]);
  return { caseId: created.databaseId!, radicado, dueAt };
}

export const demoSigcRepository: SigcRepository = {
  async listCases(): Promise<SigcCase[]> {
    return readCases();
  },

  async searchCases(filters: SigcCaseFilters): Promise<SigcCasePage> {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.max(5, filters.pageSize ?? 10);
    const filtered = readCases().filter((item) => matchesFilters(item, filters));
    const start = (page - 1) * pageSize;
    return { items: filtered.slice(start, start + pageSize), total: filtered.length, page, pageSize };
  },

  async getCaseByIdentifier(identifier: string): Promise<SigcCase | null> {
    const normalized = decodeURIComponent(identifier).toLowerCase();
    return readCases().find((item) => item.id.toLowerCase() === normalized || item.radicado.toLowerCase() === normalized || item.databaseId?.toLowerCase() === normalized) ?? null;
  },

  async getCatalogs(): Promise<SigcCatalogs> {
    return catalogs;
  },

  async listMembers(): Promise<SigcMember[]> {
    return members;
  },

  async listCaseAssignments(caseId: string): Promise<SigcAssignment[]> {
    const item = await this.getCaseByIdentifier(caseId);
    if (!item) return [];
    const stored = readAssignments()[item.databaseId ?? item.id] ?? [];
    if (stored.length) return stored;
    if (!item.areaId) return [];
    return [{
      id: 'demo-assignment-primary',
      areaId: item.areaId,
      areaName: item.area,
      responsibleUserId: item.ownerId,
      responsibleName: item.owner,
      dueAt: item.dueAt,
      due: item.due,
      state: 'assigned',
      progress: item.progress,
      isPrimary: true
    }];
  },

  async listAllowedStates(caseId: string): Promise<AllowedCaseState[]> {
    const item = await this.getCaseByIdentifier(caseId);
    if (!item) return [];
    const currentIndex = catalogs.states.findIndex((state) => state.id === item.stateId);
    const result: AllowedCaseState[] = [];
    if (currentIndex >= 0 && currentIndex < catalogs.states.length - 2) {
      const next = catalogs.states[currentIndex + 1];
      result.push({ id: next.id, name: next.name, code: next.code ?? next.id, requiresJustification: false });
    }
    const cancelled = catalogs.states.find((state) => state.name === 'Cancelado');
    if (cancelled && item.state !== 'Cancelado' && item.state !== 'Cerrado') {
      result.push({ id: cancelled.id, name: cancelled.name, code: 'CANCELLED', requiresJustification: true });
    }
    return result;
  },

  async createManualCase(input: ManualCaseCreateInput): Promise<CreatedCaseResult> {
    const result = createCaseBase(input, 'Carga manual', input.assignments.length ? 'Asignado' : 'Clasificado');
    if (input.assignments.length) {
      const all = readAssignments();
      all[result.caseId] = input.assignments.map((assignment, index) => {
        const area = catalogs.areas.find((item) => item.id === assignment.areaId)!;
        const owner = members.find((item) => item.userId === assignment.responsibleUserId);
        return {
          id: `demo-assignment-${crypto.randomUUID()}`,
          areaId: assignment.areaId,
          areaName: area.name,
          responsibleUserId: owner?.userId,
          responsibleName: owner?.name ?? 'Sin responsable',
          dueAt: assignment.dueAt || result.dueAt,
          due: assignment.dueAt ? new Date(assignment.dueAt).toLocaleString('es-CO') : new Date(result.dueAt ?? '').toLocaleString('es-CO'),
          state: 'assigned',
          observations: assignment.observations,
          progress: 0,
          isPrimary: index === 0
        };
      });
      writeAssignments(all);
    }
    return result;
  },

  async assignCase(input: CaseAssignmentInput): Promise<void> {
    const item = await this.getCaseByIdentifier(input.caseId);
    if (!item) throw new Error('Caso no encontrado.');
    const area = catalogs.areas.find((entry) => entry.id === input.areaId);
    if (!area) throw new Error('Área no válida.');
    const owner = input.responsibleUserId ? members.find((entry) => entry.userId === input.responsibleUserId) : undefined;
    const all = readAssignments();
    const key = item.databaseId ?? item.id;
    const existing = all[key] ?? [];
    const isPrimary = input.isPrimary || existing.length === 0;
    if (isPrimary) existing.forEach((assignment) => { assignment.isPrimary = false; });
    existing.push({
      id: `demo-assignment-${crypto.randomUUID()}`,
      areaId: area.id,
      areaName: area.name,
      responsibleUserId: owner?.userId,
      responsibleName: owner?.name ?? 'Sin responsable',
      dueAt: input.dueAt ?? item.dueAt,
      due: input.dueAt ? new Date(input.dueAt).toLocaleString('es-CO') : item.due,
      state: 'assigned',
      observations: input.observations,
      progress: 0,
      isPrimary: Boolean(isPrimary)
    });
    all[key] = existing;
    writeAssignments(all);

    const cases = readCases();
    writeCases(cases.map((current) => current.id === item.id ? {
      ...current,
      areaId: isPrimary ? area.id : current.areaId,
      area: isPrimary ? area.name : current.area,
      ownerId: isPrimary ? owner?.userId : current.ownerId,
      owner: isPrimary ? owner?.name ?? 'Sin responsable' : current.owner,
      state: ['Pendiente de Clasificación', 'Clasificado'].includes(current.state) ? 'Asignado' : current.state,
      stateId: ['Pendiente de Clasificación', 'Clasificado'].includes(current.state) ? catalogs.states.find((state) => state.name === 'Asignado')?.id : current.stateId,
      updated: 'Ahora',
      updatedAt: new Date().toISOString()
    } : current));
  },

  async changeCaseState(input: ChangeCaseStateInput): Promise<void> {
    const item = await this.getCaseByIdentifier(input.caseId);
    if (!item) throw new Error('Caso no encontrado.');
    const target = catalogs.states.find((state) => state.id === input.toStateId);
    if (!target) throw new Error('Estado no válido.');
    const cases = readCases();
    writeCases(cases.map((current) => current.id === item.id ? {
      ...current,
      stateId: target.id,
      state: target.name,
      updated: 'Ahora',
      updatedAt: new Date().toISOString()
    } : current));
  }
};

export const demoPublicSigcRepository: PublicSigcRepository = {
  async getPublicCaseTypes(): Promise<PublicCaseTypeOption[]> {
    return catalogs.caseTypes.map((item) => ({
      id: item.id,
      name: item.name,
      slaLabel: item.name === 'Acción de Tutela' ? '24 horas' : '5 días calendario'
    }));
  },

  async createPublicCase(input: PublicCaseCreateInput): Promise<CreatedCaseResult> {
    return createCaseBase(input, 'Formulario público', 'Pendiente de Clasificación');
  }
};
