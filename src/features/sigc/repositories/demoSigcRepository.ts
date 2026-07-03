import { demoCases, demoDocuments, demoSubtasks, demoTimeline } from '../demoData';
import type {
  AddCommentInput,
  AddDocumentVersionInput,
  AllowedCaseState,
  CaseAssignmentInput,
  ChangeCaseStateInput,
  CreateSubtaskInput,
  CreatedCaseResult,
  CreatedCommentResult,
  CreatedSubtaskResult,
  ManualCaseCreateInput,
  PublicCaseCreateInput,
  PublicCaseTypeOption,
  SigcAssignment,
  SigcCase,
  SigcCaseFilters,
  SigcCasePage,
  SigcCatalogs,
  SigcComment,
  SigcDocument,
  SigcMember,
  SigcSubtask,
  SigcSubtaskFilters,
  SigcTimelineEvent,
  UpdateSubtaskInput,
  UploadCaseDocumentInput
} from '../domain/types';
import type { PublicSigcRepository, SigcRepository } from './types';

const CASES_KEY = 'sigc_phase2_demo_cases';
const ASSIGNMENTS_KEY = 'sigc_phase2_demo_assignments';
const SUBTASKS_KEY = 'sigc_phase3_demo_subtasks';
const COMMENTS_KEY = 'sigc_phase3_demo_comments';
const DOCUMENTS_KEY = 'sigc_phase3_demo_documents';
const TIMELINE_KEY = 'sigc_phase3_demo_timeline';

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



function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* demo only */ }
}

function seedSubtasks(): SigcSubtask[] {
  return demoSubtasks.map((task, index) => {
    const caseItem = readCases().find((item) => item.radicado === task.caseId) ?? readCases()[index % readCases().length];
    const owner = members.find((item) => item.name === task.owner);
    const priority = catalogs.priorities.find((item) => item.name === task.priority);
    const stateMap: Record<string, SigcSubtask['state']> = { Completada: 'completed', 'En progreso': 'in_progress', Pendiente: 'pending' };
    return {
      id: `demo-subtask-${index + 1}`, caseId: caseItem?.databaseId ?? caseItem?.id ?? '', caseRadicado: caseItem?.radicado ?? task.caseId, caseSubject: caseItem?.subject ?? '',
      title: task.title, description: task.title, responsibleUserId: owner?.userId, responsibleName: task.owner, priorityId: priority?.id, priority: task.priority,
      dueAt: new Date(Date.now() + (index + 1) * 86400000).toISOString(), due: task.due, state: stateMap[task.state] ?? 'pending', stateLabel: task.state, progress: task.progress,
      comments: task.comments, attachments: task.attachments, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
  });
}

function readSubtasks(): SigcSubtask[] {
  const existing = readJson<SigcSubtask[]>(SUBTASKS_KEY, []);
  if (existing.length) return existing;
  const seeded = seedSubtasks();
  writeJson(SUBTASKS_KEY, seeded);
  return seeded;
}

function readComments(): SigcComment[] {
  return readJson<SigcComment[]>(COMMENTS_KEY, []);
}

function readDocuments(): SigcDocument[] {
  const existing = readJson<SigcDocument[]>(DOCUMENTS_KEY, []);
  if (existing.length) return existing;
  const cases = readCases();
  const seeded = demoDocuments.map((doc, index) => {
    const caseItem = cases.find((item) => item.radicado === doc.caseId) ?? cases[index % cases.length];
    return {
      id: `demo-document-${index + 1}`, caseId: caseItem?.databaseId ?? caseItem?.id ?? '', caseRadicado: caseItem?.radicado ?? doc.caseId, caseSubject: caseItem?.subject ?? '',
      name: doc.name, category: doc.type, state: doc.state, currentVersion: Number(doc.version.replace(/\D/g, '')) || 1, ownerName: doc.owner, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      date: doc.date, currentFilename: doc.name, currentStoragePath: '', currentMimeType: doc.type, currentSizeBytes: 0
    } satisfies SigcDocument;
  });
  writeJson(DOCUMENTS_KEY, seeded);
  return seeded;
}

function readTimeline(): SigcTimelineEvent[] {
  const existing = readJson<SigcTimelineEvent[]>(TIMELINE_KEY, []);
  if (existing.length) return existing;
  const firstCase = readCases()[0];
  const seeded = demoTimeline.map((item, index) => ({
    id: `demo-event-${index + 1}`, caseId: firstCase?.databaseId ?? '', eventType: 'demo.event', entityType: 'demo', title: item.title, description: item.description, actorName: item.actor, createdAt: new Date(Date.now() - index * 3600000).toISOString(), date: item.date
  }));
  writeJson(TIMELINE_KEY, seeded);
  return seeded;
}

function pushTimeline(caseId: string, eventType: string, title: string, description: string): void {
  const current = readTimeline();
  current.unshift({ id: `demo-event-${crypto.randomUUID()}`, caseId, eventType, entityType: 'demo', title, description, actorName: 'Usuario Demo', createdAt: new Date().toISOString(), date: 'Ahora' });
  writeJson(TIMELINE_KEY, current);
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
    pushTimeline(item.databaseId ?? item.id, 'case.state_changed', 'Estado actualizado', `El caso cambió a ${target.name}.`);
  },

  async listSubtasks(filters: SigcSubtaskFilters = {}): Promise<SigcSubtask[]> {
    let rows = readSubtasks();
    if (filters.caseId) {
      const item = await this.getCaseByIdentifier(filters.caseId);
      const caseId = item?.databaseId ?? filters.caseId;
      rows = rows.filter((task) => task.caseId === caseId);
    }
    if (filters.query?.trim()) rows = rows.filter((task) => task.title.toLowerCase().includes(filters.query!.trim().toLowerCase()));
    if (filters.state) rows = rows.filter((task) => task.state === filters.state);
    if (filters.responsibleUserId) rows = rows.filter((task) => task.responsibleUserId === filters.responsibleUserId);
    return rows;
  },

  async createSubtask(input: CreateSubtaskInput): Promise<CreatedSubtaskResult> {
    const item = await this.getCaseByIdentifier(input.caseId);
    if (!item) throw new Error('Caso no encontrado.');
    const owner = members.find((member) => member.userId === input.responsibleUserId);
    const priority = catalogs.priorities.find((entry) => entry.id === input.priorityId);
    const subtaskId = `demo-subtask-${crypto.randomUUID()}`;
    const task: SigcSubtask = {
      id: subtaskId, caseId: item.databaseId ?? item.id, caseRadicado: item.radicado, caseSubject: item.subject, title: input.title, description: input.description,
      responsibleUserId: owner?.userId, responsibleName: owner?.name ?? 'Sin responsable', priorityId: priority?.id, priority: (priority?.name ?? 'Media') as SigcCase['priority'],
      dueAt: input.dueAt ? new Date(input.dueAt).toISOString() : null, due: input.dueAt ? new Date(input.dueAt).toLocaleString('es-CO') : 'Sin fecha', state: 'pending', stateLabel: 'Pendiente', progress: 0, comments: 0, attachments: input.files?.length ?? 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    writeJson(SUBTASKS_KEY, [task, ...readSubtasks()]);
    pushTimeline(task.caseId, 'subtask.created', 'Subtarea creada', task.title);
    return { subtaskId };
  },

  async updateSubtask(input: UpdateSubtaskInput): Promise<void> {
    const rows = readSubtasks();
    const owner = members.find((member) => member.userId === input.responsibleUserId);
    const priority = catalogs.priorities.find((entry) => entry.id === input.priorityId);
    writeJson(SUBTASKS_KEY, rows.map((task) => task.id === input.subtaskId ? { ...task, title: input.title, description: input.description, responsibleUserId: owner?.userId, responsibleName: owner?.name ?? 'Sin responsable', priorityId: priority?.id, priority: (priority?.name ?? 'Media') as SigcCase['priority'], dueAt: input.dueAt ? new Date(input.dueAt).toISOString() : null, due: input.dueAt ? new Date(input.dueAt).toLocaleString('es-CO') : 'Sin fecha', state: input.state, stateLabel: { pending: 'Pendiente', in_progress: 'En progreso', completed: 'Completada', cancelled: 'Cancelada' }[input.state], progress: input.state === 'completed' ? 100 : input.progress, attachments: task.attachments + (input.files?.length ?? 0), updatedAt: new Date().toISOString() } : task));
    const task = rows.find((entry) => entry.id === input.subtaskId);
    if (task) pushTimeline(task.caseId, 'subtask.updated', 'Subtarea actualizada', input.title);
  },

  async deleteSubtask(subtaskId: string): Promise<void> {
    const rows = readSubtasks();
    const task = rows.find((entry) => entry.id === subtaskId);
    writeJson(SUBTASKS_KEY, rows.filter((entry) => entry.id !== subtaskId));
    if (task) pushTimeline(task.caseId, 'subtask.deleted', 'Subtarea eliminada lógicamente', task.title);
  },

  async listCaseComments(caseId: string): Promise<SigcComment[]> {
    const item = await this.getCaseByIdentifier(caseId);
    const resolved = item?.databaseId ?? caseId;
    return readComments().filter((comment) => comment.caseId === resolved);
  },

  async addComment(input: AddCommentInput): Promise<CreatedCommentResult> {
    const item = await this.getCaseByIdentifier(input.caseId);
    if (!item) throw new Error('Caso no encontrado.');
    const commentId = `demo-comment-${crypto.randomUUID()}`;
    const comment: SigcComment = { id: commentId, caseId: item.databaseId ?? item.id, subtaskId: input.subtaskId, userId: 'demo-user-1', userName: 'Laura Méndez', content: input.content, createdAt: new Date().toISOString(), createdLabel: 'Ahora', attachmentCount: input.files?.length ?? 0 };
    writeJson(COMMENTS_KEY, [comment, ...readComments()]);
    pushTimeline(comment.caseId, 'comment.created', 'Comentario agregado', input.content.slice(0, 180));
    return { commentId };
  },

  async listDocuments(caseId?: string): Promise<SigcDocument[]> {
    let rows = readDocuments();
    if (caseId) {
      const item = await this.getCaseByIdentifier(caseId);
      const resolved = item?.databaseId ?? caseId;
      rows = rows.filter((document) => document.caseId === resolved);
    }
    return rows;
  },

  async uploadDocument(input: UploadCaseDocumentInput): Promise<SigcDocument> {
    const item = await this.getCaseByIdentifier(input.caseId);
    if (!item) throw new Error('Caso no encontrado.');
    const document: SigcDocument = { id: `demo-document-${crypto.randomUUID()}`, caseId: item.databaseId ?? item.id, caseRadicado: item.radicado, caseSubject: item.subject, subtaskId: input.subtaskId, commentId: input.commentId, name: input.name, category: input.category, state: input.state ?? 'Cargado', currentVersion: 1, ownerName: 'Usuario Demo', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), date: 'Ahora', currentFilename: input.file.name, currentStoragePath: '', currentMimeType: input.file.type, currentSizeBytes: input.file.size };
    writeJson(DOCUMENTS_KEY, [document, ...readDocuments()]);
    pushTimeline(document.caseId, 'document.created', 'Documento cargado', document.name);
    return document;
  },

  async addDocumentVersion(input: AddDocumentVersionInput): Promise<void> {
    const rows = readDocuments();
    const document = rows.find((entry) => entry.id === input.documentId);
    writeJson(DOCUMENTS_KEY, rows.map((entry) => entry.id === input.documentId ? { ...entry, currentVersion: entry.currentVersion + 1, currentFilename: input.file.name, currentMimeType: input.file.type, currentSizeBytes: input.file.size, updatedAt: new Date().toISOString(), date: 'Ahora' } : entry));
    if (document) pushTimeline(document.caseId, 'document.version_created', 'Nueva versión documental', `${input.file.name} · v${input.currentVersion + 1}`);
  },

  async deleteDocument(documentId: string): Promise<void> {
    const rows = readDocuments();
    const document = rows.find((entry) => entry.id === documentId);
    writeJson(DOCUMENTS_KEY, rows.filter((entry) => entry.id !== documentId));
    if (document) pushTimeline(document.caseId, 'document.deleted', 'Documento eliminado lógicamente', document.name);
  },

  async getDocumentSignedUrl(): Promise<string> {
    throw new Error('La vista de archivos requiere Supabase Storage.');
  },

  async listCaseTimeline(caseId: string): Promise<SigcTimelineEvent[]> {
    const item = await this.getCaseByIdentifier(caseId);
    const resolved = item?.databaseId ?? caseId;
    return readTimeline().filter((event) => event.caseId === resolved || event.caseId === '');
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
