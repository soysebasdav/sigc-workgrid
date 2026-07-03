import { supabase } from '../../../lib/supabaseClient';
import type {
  AddCommentInput,
  AddDocumentVersionInput,
  AllowedCaseState,
  CaseAssignmentInput,
  CasePriorityName,
  ChangeCaseStateInput,
  CreateSubtaskInput,
  CreatedCaseResult,
  CreatedCommentResult,
  CreatedSubtaskResult,
  ManualCaseCreateInput,
  PublicCaseCreateInput,
  PublicCaseTypeOption,
  SemColor,
  SigcAssignment,
  SigcCase,
  SigcCaseFilters,
  SigcCasePage,
  SigcCatalogOption,
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

function requireClient() {
  if (!supabase) throw new Error('Supabase no está configurado.');
  return supabase;
}

type CaseQueryRow = {
  id: string;
  organization_id: string;
  radicado: string;
  subject: string;
  description: string;
  requester_name: string;
  requester_company: string | null;
  requester_document: string | null;
  requester_email: string | null;
  requester_phone: string | null;
  source: string;
  risk_level: string | null;
  opened_at: string;
  due_at: string | null;
  progress: number;
  updated_at: string;
  case_type_id: string | null;
  priority_id: string | null;
  state_id: string | null;
  sla_policy_id: string | null;
  primary_area_id: string | null;
  primary_owner_id: string | null;
  case_type: { name: string } | null;
  priority: { name: string } | null;
  state: { name: string; is_terminal: boolean } | null;
  area: { name: string } | null;
  owner: { name: string } | null;
  sla_policy: { duration_value: number; duration_unit: string } | null;
};

const CASE_SELECT = `
  id, organization_id, radicado, subject, description,
  requester_name, requester_company, requester_document, requester_email, requester_phone,
  source, risk_level, opened_at, due_at, progress, updated_at,
  case_type_id, priority_id, state_id, sla_policy_id, primary_area_id, primary_owner_id,
  case_type:case_types(name),
  priority:priorities(name),
  state:case_states(name,is_terminal),
  area:areas(name),
  owner:profiles(name),
  sla_policy:sla_policies(duration_value,duration_unit)
`;

async function ensureOrganization(): Promise<string> {
  const client = requireClient();
  const { data, error } = await client.rpc('ensure_user_organization');
  if (error) throw error;
  if (!data) throw new Error('No fue posible resolver la organización activa del usuario.');
  return String(data);
}

function durationLabel(policy: CaseQueryRow['sla_policy']): string {
  if (!policy) return 'Sin SLA';
  const unitMap: Record<string, string> = {
    hours: 'horas',
    calendar_days: 'días calendario',
    business_days: 'días hábiles'
  };
  return `${policy.duration_value} ${unitMap[policy.duration_unit] ?? policy.duration_unit}`;
}

function relativeUpdated(iso: string): string {
  const value = new Date(iso).getTime();
  if (!Number.isFinite(value)) return iso;
  const minutes = Math.max(0, Math.round((Date.now() - value) / 60000));
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Ayer' : `Hace ${days} días`;
}

function formatDue(iso: string | null): string {
  if (!iso) return 'Sin fecha';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return iso;
  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function semFromTimeline(openedAt: string, dueAt: string | null): SemColor {
  if (!dueAt) return 'green';
  const opened = new Date(openedAt).getTime();
  const due = new Date(dueAt).getTime();
  const now = Date.now();
  if (!Number.isFinite(due)) return 'green';
  if (now >= due) return 'red';
  if (!Number.isFinite(opened) || due <= opened) return 'orange';

  const remainingRatio = (due - now) / (due - opened);
  if (remainingRatio > 0.5) return 'green';
  if (remainingRatio > 0.2) return 'yellow';
  return 'orange';
}

function riskLabel(risk: string | null, sem: SemColor): string {
  if (risk) return risk;
  if (sem === 'red') return 'Vencido';
  if (sem === 'orange') return 'Próximo a vencer';
  return 'En tiempo';
}

function mapCase(row: CaseQueryRow): SigcCase {
  const priorityName = (row.priority?.name ?? 'Media') as CasePriorityName;
  const isTerminal = row.state?.is_terminal ?? false;
  const sem = isTerminal ? 'green' : semFromTimeline(row.opened_at, row.due_at);
  return {
    id: row.radicado,
    databaseId: row.id,
    radicado: row.radicado,
    organizationId: row.organization_id,
    typeId: row.case_type_id ?? undefined,
    type: row.case_type?.name ?? 'Sin clasificar',
    subject: row.subject,
    description: row.description,
    company: row.requester_company ?? 'Sin empresa',
    requester: row.requester_name,
    requesterDocument: row.requester_document ?? undefined,
    requesterEmail: row.requester_email ?? undefined,
    requesterPhone: row.requester_phone ?? undefined,
    areaId: row.primary_area_id ?? undefined,
    area: row.area?.name ?? 'Sin área',
    ownerId: row.primary_owner_id ?? undefined,
    owner: row.owner?.name ?? 'Sin responsable',
    stateId: row.state_id ?? undefined,
    state: row.state?.name ?? 'Pendiente de Clasificación',
    priorityId: row.priority_id ?? undefined,
    priority: priorityName,
    slaPolicyId: row.sla_policy_id ?? undefined,
    sla: durationLabel(row.sla_policy),
    openedAt: row.opened_at,
    dueAt: row.due_at,
    due: formatDue(row.due_at),
    sem,
    progress: row.progress,
    updatedAt: row.updated_at,
    updated: relativeUpdated(row.updated_at),
    risk: isTerminal ? row.state?.name ?? 'Finalizado' : riskLabel(row.risk_level, sem),
    source: row.source
  };
}

function mapCatalog(rows: Array<{ id: string; name: string; code?: string | null; color?: string | null; is_active?: boolean }>): SigcCatalogOption[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code ?? undefined,
    color: row.color ?? null,
    isActive: row.is_active ?? true
  }));
}

function safeSearch(value: string): string {
  return value.trim().replace(/[(),]/g, ' ').replace(/\s+/g, ' ').slice(0, 120);
}

async function resolveCaseDatabaseId(identifier: string): Promise<string> {
  if (/^[0-9a-f-]{36}$/i.test(identifier)) return identifier;
  const row = await supabaseSigcRepository.getCaseByIdentifier(identifier);
  if (!row?.databaseId) throw new Error('No fue posible resolver el caso.');
  return row.databaseId;
}

async function fetchCases(identifier?: string): Promise<SigcCase[]> {
  const client = requireClient();
  const organizationId = await ensureOrganization();

  let query = client
    .from('cases')
    .select(CASE_SELECT)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (identifier) {
    const decoded = decodeURIComponent(identifier);
    query = /^[0-9a-f-]{36}$/i.test(decoded) ? query.eq('id', decoded) : query.eq('radicado', decoded);
  } else {
    query = query.range(0, 199);
  }

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as CaseQueryRow[]).map(mapCase);
}



const SUBTASK_STATE_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  completed: 'Completada',
  cancelled: 'Cancelada'
};

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return 'Sin fecha';
  const value = new Date(iso);
  if (!Number.isFinite(value.getTime())) return iso;
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short' }).format(value);
}

function sanitizeFilename(filename: string): string {
  const normalized = filename.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const cleaned = normalized.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return (cleaned || 'archivo').slice(-180);
}

function eventPresentation(eventType: string, metadata: Record<string, unknown>, afterData: Record<string, unknown> | null): { title: string; description: string } {
  const text = (value: unknown) => typeof value === 'string' ? value : '';
  const titleValue = text(metadata.title) || text(afterData?.title);
  const documentName = text(metadata.name) || text(afterData?.name);
  const preview = text(metadata.preview);
  const filename = text(metadata.filename);
  const version = text(metadata.version);
  const justification = text(metadata.justification);

  switch (eventType) {
    case 'case.created': return { title: 'Caso creado', description: 'Se creó el expediente y quedó disponible para gestión.' };
    case 'case.updated': return { title: 'Caso actualizado', description: 'Se modificaron datos del expediente.' };
    case 'case.state_changed': return { title: 'Estado actualizado', description: justification ? `Cambio de estado. Justificación: ${justification}` : 'El caso avanzó a un nuevo estado del flujo.' };
    case 'assignment.created': return { title: 'Nueva asignación', description: 'Se agregó un área o responsable al caso.' };
    case 'assignment.updated': return { title: 'Asignación actualizada', description: 'Se modificó una asignación del caso.' };
    case 'subtask.created': return { title: 'Subtarea creada', description: titleValue || 'Se creó una nueva actividad de seguimiento.' };
    case 'subtask.updated': return { title: 'Subtarea actualizada', description: titleValue || 'Se actualizó una actividad del caso.' };
    case 'subtask.deleted': return { title: 'Subtarea eliminada lógicamente', description: titleValue || 'La subtarea se ocultó sin borrar su historial.' };
    case 'comment.created': return { title: 'Comentario agregado', description: preview || 'Se agregó un comentario interno.' };
    case 'document.created': return { title: 'Documento cargado', description: documentName || 'Se agregó un documento al expediente.' };
    case 'document.updated': return { title: 'Documento actualizado', description: documentName || 'Se actualizó la ficha documental.' };
    case 'document.deleted': return { title: 'Documento eliminado lógicamente', description: documentName || 'El documento se ocultó sin borrar sus versiones.' };
    case 'document.version_created': return { title: 'Nueva versión documental', description: `${filename || 'Archivo'}${version ? ` · v${version}` : ''}` };
    case 'case.sla_overridden': return { title: 'SLA modificado', description: justification || 'Se modificó excepcionalmente la fecha límite.' };
    default: return { title: 'Actividad registrada', description: eventType };
  }
}

export const supabaseSigcRepository: SigcRepository = {
  async listCases(): Promise<SigcCase[]> {
    return fetchCases();
  },

  async searchCases(filters: SigcCaseFilters): Promise<SigcCasePage> {
    const client = requireClient();
    const organizationId = await ensureOrganization();
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(5, filters.pageSize ?? 10));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let terminalStateIds: string[] = [];
    if (filters.overdueOnly || filters.upcomingOnly) {
      const { data: terminalStates, error: terminalError } = await client
        .from('case_states')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('is_terminal', true);
      if (terminalError) throw terminalError;
      terminalStateIds = (terminalStates ?? []).map((item) => item.id);
    }

    let query = client
      .from('cases')
      .select(CASE_SELECT, { count: 'exact' })
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    const search = safeSearch(filters.query ?? '');
    if (search) {
      const pattern = `%${search}%`;
      query = query.or(`radicado.ilike.${pattern},subject.ilike.${pattern},requester_name.ilike.${pattern},requester_company.ilike.${pattern},requester_email.ilike.${pattern}`);
    }
    if (filters.stateId) query = query.eq('state_id', filters.stateId);
    if (filters.areaId) query = query.eq('primary_area_id', filters.areaId);
    if (filters.ownerId) query = query.eq('primary_owner_id', filters.ownerId);
    if (filters.caseTypeId) query = query.eq('case_type_id', filters.caseTypeId);
    if (filters.priorityId) query = query.eq('priority_id', filters.priorityId);
    if (terminalStateIds.length) query = query.not('state_id', 'in', `(${terminalStateIds.join(',')})`);
    if (filters.overdueOnly) query = query.lt('due_at', new Date().toISOString());
    if (filters.upcomingOnly) {
      const now = new Date();
      const upcoming = new Date(now.getTime() + 72 * 60 * 60 * 1000);
      query = query.gte('due_at', now.toISOString()).lte('due_at', upcoming.toISOString());
    }

    const { data, error, count } = await query.range(from, to);
    if (error) throw error;

    return {
      items: ((data ?? []) as unknown as CaseQueryRow[]).map(mapCase),
      total: count ?? 0,
      page,
      pageSize
    };
  },

  async getCaseByIdentifier(identifier: string): Promise<SigcCase | null> {
    const rows = await fetchCases(identifier);
    return rows[0] ?? null;
  },

  async getCatalogs(): Promise<SigcCatalogs> {
    const client = requireClient();
    const organizationId = await ensureOrganization();
    const [areas, types, states, priorities, roles] = await Promise.all([
      client.from('areas').select('id,name,code,color,is_active').eq('organization_id', organizationId).eq('is_active', true).order('sort_order'),
      client.from('case_types').select('id,name,code,color,is_active').eq('organization_id', organizationId).eq('is_active', true).order('name'),
      client.from('case_states').select('id,name,code,color,is_active').eq('organization_id', organizationId).eq('is_active', true).order('sort_order'),
      client.from('priorities').select('id,name,code,color,is_active').eq('organization_id', organizationId).eq('is_active', true).order('sort_order'),
      client.from('roles').select('id,name,code,is_active').eq('organization_id', organizationId).eq('is_active', true).order('name')
    ]);

    const error = areas.error ?? types.error ?? states.error ?? priorities.error ?? roles.error;
    if (error) throw error;

    return {
      organizationId,
      areas: mapCatalog(areas.data ?? []),
      caseTypes: mapCatalog(types.data ?? []),
      states: mapCatalog(states.data ?? []),
      priorities: mapCatalog(priorities.data ?? []),
      roles: mapCatalog(roles.data ?? [])
    };
  },

  async listMembers(): Promise<SigcMember[]> {
    const client = requireClient();
    const organizationId = await ensureOrganization();
    const { data: memberships, error: membershipsError } = await client
      .from('organization_members')
      .select('user_id,role_id')
      .eq('organization_id', organizationId)
      .eq('is_active', true);
    if (membershipsError) throw membershipsError;

    const userIds = [...new Set((memberships ?? []).map((item) => item.user_id))];
    const roleIds = [...new Set((memberships ?? []).map((item) => item.role_id).filter((id): id is string => Boolean(id)))];
    if (!userIds.length) return [];

    const [profiles, roles] = await Promise.all([
      client.from('profiles').select('id,name,email').in('id', userIds),
      roleIds.length ? client.from('roles').select('id,name').in('id', roleIds) : Promise.resolve({ data: [], error: null })
    ]);
    if (profiles.error) throw profiles.error;
    if (roles.error) throw roles.error;

    const profileMap = new Map((profiles.data ?? []).map((item) => [item.id, item]));
    const roleMap = new Map((roles.data ?? []).map((item) => [item.id, item.name]));

    return (memberships ?? [])
      .map((membership) => {
        const profile = profileMap.get(membership.user_id);
        if (!profile) return null;
        return {
          userId: profile.id,
          name: profile.name,
          email: profile.email,
          roleName: membership.role_id ? roleMap.get(membership.role_id) ?? 'Sin rol' : 'Sin rol'
        } satisfies SigcMember;
      })
      .filter((item): item is SigcMember => Boolean(item))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  },

  async listCaseAssignments(caseId: string): Promise<SigcAssignment[]> {
    const client = requireClient();
    const resolvedCaseId = await resolveCaseDatabaseId(caseId);
    const { data, error } = await client
      .from('case_assignments')
      .select('id,area_id,responsible_user_id,due_at,state,observations,progress,is_primary')
      .eq('case_id', resolvedCaseId)
      .order('is_primary', { ascending: false })
      .order('assigned_at', { ascending: true });
    if (error) throw error;

    const areaIds = [...new Set((data ?? []).map((item) => item.area_id))];
    const userIds = [...new Set((data ?? []).map((item) => item.responsible_user_id).filter((id): id is string => Boolean(id)))];
    const [areas, profiles] = await Promise.all([
      areaIds.length ? client.from('areas').select('id,name').in('id', areaIds) : Promise.resolve({ data: [], error: null }),
      userIds.length ? client.from('profiles').select('id,name').in('id', userIds) : Promise.resolve({ data: [], error: null })
    ]);
    if (areas.error) throw areas.error;
    if (profiles.error) throw profiles.error;

    const areaMap = new Map((areas.data ?? []).map((item) => [item.id, item.name]));
    const profileMap = new Map((profiles.data ?? []).map((item) => [item.id, item.name]));

    return (data ?? []).map((item) => ({
      id: item.id,
      areaId: item.area_id,
      areaName: areaMap.get(item.area_id) ?? 'Área',
      responsibleUserId: item.responsible_user_id ?? undefined,
      responsibleName: item.responsible_user_id ? profileMap.get(item.responsible_user_id) ?? 'Sin responsable' : 'Sin responsable',
      dueAt: item.due_at,
      due: formatDue(item.due_at),
      state: item.state,
      observations: item.observations,
      progress: item.progress,
      isPrimary: item.is_primary
    }));
  },

  async listAllowedStates(caseId: string): Promise<AllowedCaseState[]> {
    const client = requireClient();
    const resolvedCaseId = await resolveCaseDatabaseId(caseId);
    const { data, error } = await client.rpc('get_case_allowed_states', { p_case_id: resolvedCaseId });
    if (error) throw error;
    return (data ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      code: item.code,
      color: item.color,
      requiresJustification: item.requires_justification
    }));
  },

  async createManualCase(input: ManualCaseCreateInput): Promise<CreatedCaseResult> {
    const client = requireClient();
    const assignments = input.assignments.map((assignment) => ({
      areaId: assignment.areaId,
      responsibleUserId: assignment.responsibleUserId ?? '',
      dueAt: assignment.dueAt ? new Date(assignment.dueAt).toISOString() : '',
      observations: assignment.observations ?? ''
    }));
    const { data, error } = await client.rpc('create_internal_case', {
      p_case_type_id: input.caseTypeId,
      p_priority_id: input.priorityId,
      p_requester_name: input.requesterName,
      p_requester_company: input.requesterCompany,
      p_requester_document: input.requesterDocument,
      p_requester_email: input.requesterEmail,
      p_requester_phone: input.requesterPhone,
      p_subject: input.subject,
      p_description: input.description,
      p_risk_level: input.riskLevel ?? null,
      p_assignments: assignments
    });
    if (error) throw error;
    const created = data?.[0];
    if (!created) throw new Error('La base de datos no devolvió el caso creado.');
    return { caseId: created.case_id, radicado: created.radicado, dueAt: created.due_at };
  },

  async assignCase(input: CaseAssignmentInput): Promise<void> {
    const client = requireClient();
    const resolvedCaseId = await resolveCaseDatabaseId(input.caseId);
    const { error } = await client.rpc('assign_case', {
      p_case_id: resolvedCaseId,
      p_area_id: input.areaId,
      p_responsible_user_id: input.responsibleUserId || null,
      p_due_at: input.dueAt ? new Date(input.dueAt).toISOString() : null,
      p_observations: input.observations ?? null,
      p_is_primary: input.isPrimary ?? false
    });
    if (error) throw error;
  },

  async changeCaseState(input: ChangeCaseStateInput): Promise<void> {
    const client = requireClient();
    const resolvedCaseId = await resolveCaseDatabaseId(input.caseId);
    const { error } = await client.rpc('change_case_state', {
      p_case_id: resolvedCaseId,
      p_to_state_id: input.toStateId,
      p_justification: input.justification ?? null
    });
    if (error) throw error;
  },

  async listSubtasks(filters: SigcSubtaskFilters = {}): Promise<SigcSubtask[]> {
    const client = requireClient();
    let query = client
      .from('case_subtasks')
      .select('id,case_id,title,description,responsible_user_id,priority_id,due_at,state,progress,created_at,updated_at')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    if (filters.caseId) query = query.eq('case_id', await resolveCaseDatabaseId(filters.caseId));
    if (filters.state) query = query.eq('state', filters.state);
    if (filters.responsibleUserId) query = query.eq('responsible_user_id', filters.responsibleUserId);
    if (filters.query?.trim()) query = query.ilike('title', `%${safeSearch(filters.query)}%`);

    const { data, error } = await query.range(0, 499);
    if (error) throw error;
    const rows = data ?? [];
    if (!rows.length) return [];

    const caseIds = [...new Set(rows.map((row) => row.case_id))];
    const userIds = [...new Set(rows.map((row) => row.responsible_user_id).filter((id): id is string => Boolean(id)))];
    const priorityIds = [...new Set(rows.map((row) => row.priority_id).filter((id): id is string => Boolean(id)))];
    const subtaskIds = rows.map((row) => row.id);

    const [casesResult, profilesResult, prioritiesResult, commentsResult, documentsResult] = await Promise.all([
      client.from('cases').select('id,radicado,subject').in('id', caseIds),
      userIds.length ? client.from('profiles').select('id,name').in('id', userIds) : Promise.resolve({ data: [], error: null }),
      priorityIds.length ? client.from('priorities').select('id,name').in('id', priorityIds) : Promise.resolve({ data: [], error: null }),
      client.from('case_comments').select('id,subtask_id').in('subtask_id', subtaskIds),
      client.from('case_documents').select('id,subtask_id').in('subtask_id', subtaskIds).is('deleted_at', null)
    ]);
    const relatedError = casesResult.error ?? profilesResult.error ?? prioritiesResult.error ?? commentsResult.error ?? documentsResult.error;
    if (relatedError) throw relatedError;

    const caseMap = new Map((casesResult.data ?? []).map((item) => [item.id, item]));
    const profileMap = new Map((profilesResult.data ?? []).map((item) => [item.id, item.name]));
    const priorityMap = new Map((prioritiesResult.data ?? []).map((item) => [item.id, item.name]));
    const commentCounts = new Map<string, number>();
    const attachmentCounts = new Map<string, number>();
    (commentsResult.data ?? []).forEach((item) => { if (item.subtask_id) commentCounts.set(item.subtask_id, (commentCounts.get(item.subtask_id) ?? 0) + 1); });
    (documentsResult.data ?? []).forEach((item) => { if (item.subtask_id) attachmentCounts.set(item.subtask_id, (attachmentCounts.get(item.subtask_id) ?? 0) + 1); });

    return rows.map((row) => {
      const caseItem = caseMap.get(row.case_id);
      return {
        id: row.id,
        caseId: row.case_id,
        caseRadicado: caseItem?.radicado ?? 'Caso',
        caseSubject: caseItem?.subject ?? '',
        title: row.title,
        description: row.description,
        responsibleUserId: row.responsible_user_id ?? undefined,
        responsibleName: row.responsible_user_id ? profileMap.get(row.responsible_user_id) ?? 'Sin responsable' : 'Sin responsable',
        priorityId: row.priority_id ?? undefined,
        priority: (row.priority_id ? priorityMap.get(row.priority_id) ?? 'Media' : 'Media') as CasePriorityName,
        dueAt: row.due_at,
        due: formatDue(row.due_at),
        state: row.state,
        stateLabel: SUBTASK_STATE_LABELS[row.state] ?? row.state,
        progress: row.progress,
        comments: commentCounts.get(row.id) ?? 0,
        attachments: attachmentCounts.get(row.id) ?? 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    });
  },

  async createSubtask(input: CreateSubtaskInput): Promise<CreatedSubtaskResult> {
    const client = requireClient();
    const caseId = await resolveCaseDatabaseId(input.caseId);
    const { data, error } = await client.rpc('create_case_subtask', {
      p_case_id: caseId,
      p_title: input.title,
      p_description: input.description,
      p_responsible_user_id: input.responsibleUserId || null,
      p_due_at: input.dueAt ? new Date(input.dueAt).toISOString() : null,
      p_priority_id: input.priorityId || null
    });
    if (error) throw error;
    const created = data?.[0];
    if (!created) throw new Error('No fue posible confirmar la subtarea creada.');
    return { subtaskId: created.subtask_id };
  },

  async updateSubtask(input: UpdateSubtaskInput): Promise<void> {
    const client = requireClient();
    const { error } = await client.rpc('update_case_subtask', {
      p_subtask_id: input.subtaskId,
      p_title: input.title,
      p_description: input.description,
      p_responsible_user_id: input.responsibleUserId || null,
      p_due_at: input.dueAt ? new Date(input.dueAt).toISOString() : null,
      p_priority_id: input.priorityId || null,
      p_state: input.state,
      p_progress: input.progress
    });
    if (error) throw error;
  },

  async deleteSubtask(subtaskId: string): Promise<void> {
    const client = requireClient();
    const { error } = await client.rpc('soft_delete_case_subtask', { p_subtask_id: subtaskId });
    if (error) throw error;
  },

  async listCaseComments(caseId: string): Promise<SigcComment[]> {
    const client = requireClient();
    const resolvedCaseId = await resolveCaseDatabaseId(caseId);
    const { data, error } = await client
      .from('case_comments')
      .select('id,case_id,subtask_id,user_id,content,created_at')
      .eq('case_id', resolvedCaseId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const rows = data ?? [];
    if (!rows.length) return [];

    const userIds = [...new Set(rows.map((row) => row.user_id))];
    const commentIds = rows.map((row) => row.id);
    const [profilesResult, attachmentsResult] = await Promise.all([
      client.from('profiles').select('id,name').in('id', userIds),
      client.from('case_documents').select('id,comment_id').in('comment_id', commentIds).is('deleted_at', null)
    ]);
    if (profilesResult.error) throw profilesResult.error;
    if (attachmentsResult.error) throw attachmentsResult.error;
    const profileMap = new Map((profilesResult.data ?? []).map((item) => [item.id, item.name]));
    const attachmentCounts = new Map<string, number>();
    (attachmentsResult.data ?? []).forEach((item) => { if (item.comment_id) attachmentCounts.set(item.comment_id, (attachmentCounts.get(item.comment_id) ?? 0) + 1); });

    return rows.map((row) => ({
      id: row.id,
      caseId: row.case_id,
      subtaskId: row.subtask_id ?? undefined,
      userId: row.user_id,
      userName: profileMap.get(row.user_id) ?? 'Usuario',
      content: row.content,
      createdAt: row.created_at,
      createdLabel: formatDateTime(row.created_at),
      attachmentCount: attachmentCounts.get(row.id) ?? 0
    }));
  },

  async addComment(input: AddCommentInput): Promise<CreatedCommentResult> {
    const client = requireClient();
    const resolvedCaseId = await resolveCaseDatabaseId(input.caseId);
    const { data, error } = await client.rpc('add_case_comment', {
      p_case_id: resolvedCaseId,
      p_content: input.content,
      p_subtask_id: input.subtaskId || null
    });
    if (error) throw error;
    const created = data?.[0];
    if (!created) throw new Error('No fue posible confirmar el comentario.');
    return { commentId: created.comment_id };
  },

  async listDocuments(caseId?: string): Promise<SigcDocument[]> {
    const client = requireClient();
    let query = client
      .from('case_documents')
      .select('id,case_id,subtask_id,comment_id,name,category,state,current_version,created_by,created_at,updated_at')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });
    if (caseId) query = query.eq('case_id', await resolveCaseDatabaseId(caseId));
    const { data, error } = await query.range(0, 499);
    if (error) throw error;
    const rows = data ?? [];
    if (!rows.length) return [];

    const caseIds = [...new Set(rows.map((row) => row.case_id))];
    const ownerIds = [...new Set(rows.map((row) => row.created_by).filter((id): id is string => Boolean(id)))];
    const documentIds = rows.map((row) => row.id);
    const [casesResult, profilesResult, versionsResult] = await Promise.all([
      client.from('cases').select('id,radicado,subject').in('id', caseIds),
      ownerIds.length ? client.from('profiles').select('id,name').in('id', ownerIds) : Promise.resolve({ data: [], error: null }),
      client.from('document_versions').select('document_id,version_number,original_filename,storage_path,mime_type,size_bytes').in('document_id', documentIds).order('version_number', { ascending: false })
    ]);
    const relatedError = casesResult.error ?? profilesResult.error ?? versionsResult.error;
    if (relatedError) throw relatedError;
    const caseMap = new Map((casesResult.data ?? []).map((item) => [item.id, item]));
    const profileMap = new Map((profilesResult.data ?? []).map((item) => [item.id, item.name]));
    type VersionSummary = { document_id: string; version_number: number; original_filename: string; storage_path: string; mime_type: string | null; size_bytes: number };
    const versionMap = new Map<string, VersionSummary>();
    (versionsResult.data ?? []).forEach((version) => { if (!versionMap.has(version.document_id)) versionMap.set(version.document_id, version); });

    return rows.map((row) => {
      const caseItem = caseMap.get(row.case_id);
      const version = versionMap.get(row.id);
      return {
        id: row.id,
        caseId: row.case_id,
        caseRadicado: caseItem?.radicado ?? 'Caso',
        caseSubject: caseItem?.subject ?? '',
        subtaskId: row.subtask_id ?? undefined,
        commentId: row.comment_id ?? undefined,
        name: row.name,
        category: row.category,
        state: row.state,
        currentVersion: row.current_version,
        ownerId: row.created_by ?? undefined,
        ownerName: row.created_by ? profileMap.get(row.created_by) ?? 'Usuario' : 'Usuario',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        date: formatDateTime(row.updated_at),
        currentFilename: version?.original_filename ?? row.name,
        currentStoragePath: version?.storage_path ?? '',
        currentMimeType: version?.mime_type ?? undefined,
        currentSizeBytes: version?.size_bytes ?? 0
      };
    });
  },

  async uploadDocument(input: UploadCaseDocumentInput): Promise<SigcDocument> {
    const client = requireClient();
    const resolvedCaseId = await resolveCaseDatabaseId(input.caseId);
    const organizationId = await ensureOrganization();
    const documentId = crypto.randomUUID();
    const path = `${organizationId}/${resolvedCaseId}/${documentId}/v1/${sanitizeFilename(input.file.name)}`;
    const { error: uploadError } = await client.storage.from('case-documents').upload(path, input.file, { upsert: false, contentType: input.file.type || undefined });
    if (uploadError) throw uploadError;

    const { error: registerError } = await client.rpc('register_case_document', {
      p_document_id: documentId,
      p_case_id: resolvedCaseId,
      p_name: input.name,
      p_category: input.category,
      p_state: input.state ?? 'Cargado',
      p_original_filename: input.file.name,
      p_storage_path: path,
      p_mime_type: input.file.type || '',
      p_size_bytes: input.file.size,
      p_change_notes: input.changeNotes ?? null,
      p_subtask_id: input.subtaskId || null,
      p_comment_id: input.commentId || null
    });
    if (registerError) throw registerError;

    const documents = await this.listDocuments(resolvedCaseId);
    const created = documents.find((document) => document.id === documentId);
    if (!created) throw new Error('El documento se cargó, pero no fue posible refrescar su ficha.');
    return created;
  },

  async addDocumentVersion(input: AddDocumentVersionInput): Promise<void> {
    const client = requireClient();
    const resolvedCaseId = await resolveCaseDatabaseId(input.caseId);
    const organizationId = await ensureOrganization();
    const nextVersion = input.currentVersion + 1;
    const path = `${organizationId}/${resolvedCaseId}/${input.documentId}/v${nextVersion}/${sanitizeFilename(input.file.name)}`;
    const { error: uploadError } = await client.storage.from('case-documents').upload(path, input.file, { upsert: false, contentType: input.file.type || undefined });
    if (uploadError) throw uploadError;

    const { error } = await client.rpc('add_case_document_version', {
      p_document_id: input.documentId,
      p_expected_current_version: input.currentVersion,
      p_original_filename: input.file.name,
      p_storage_path: path,
      p_mime_type: input.file.type || '',
      p_size_bytes: input.file.size,
      p_change_notes: input.changeNotes ?? null
    });
    if (error) throw error;
  },

  async deleteDocument(documentId: string): Promise<void> {
    const client = requireClient();
    const { error } = await client.rpc('soft_delete_case_document', { p_document_id: documentId });
    if (error) throw error;
  },

  async getDocumentSignedUrl(storagePath: string): Promise<string> {
    const client = requireClient();
    if (!storagePath) throw new Error('El documento no tiene una ruta de almacenamiento válida.');
    const { data, error } = await client.storage.from('case-documents').createSignedUrl(storagePath, 120);
    if (error) throw error;
    if (!data?.signedUrl) throw new Error('No fue posible generar el acceso temporal al documento.');
    return data.signedUrl;
  },

  async listCaseTimeline(caseId: string): Promise<SigcTimelineEvent[]> {
    const client = requireClient();
    const resolvedCaseId = await resolveCaseDatabaseId(caseId);
    const { data, error } = await client
      .from('audit_events')
      .select('id,case_id,actor_user_id,event_type,entity_type,after_data,metadata,created_at')
      .eq('case_id', resolvedCaseId)
      .order('created_at', { ascending: false })
      .range(0, 299);
    if (error) throw error;
    const rows = data ?? [];
    const actorIds = [...new Set(rows.map((row) => row.actor_user_id).filter((id): id is string => Boolean(id)))];
    const profilesResult = actorIds.length ? await client.from('profiles').select('id,name').in('id', actorIds) : { data: [], error: null };
    if (profilesResult.error) throw profilesResult.error;
    const profileMap = new Map((profilesResult.data ?? []).map((item) => [item.id, item.name]));

    return rows.map((row) => {
      const metadata = (row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata) ? row.metadata : {}) as Record<string, unknown>;
      const afterData = (row.after_data && typeof row.after_data === 'object' && !Array.isArray(row.after_data) ? row.after_data : null) as Record<string, unknown> | null;
      const presentation = eventPresentation(row.event_type, metadata, afterData);
      return {
        id: String(row.id),
        caseId: row.case_id ?? resolvedCaseId,
        eventType: row.event_type,
        entityType: row.entity_type,
        title: presentation.title,
        description: presentation.description,
        actorId: row.actor_user_id ?? undefined,
        actorName: row.actor_user_id ? profileMap.get(row.actor_user_id) ?? 'Usuario' : 'Sistema',
        createdAt: row.created_at,
        date: formatDateTime(row.created_at)
      };
    });
  }
};

export const supabasePublicSigcRepository: PublicSigcRepository = {
  async getPublicCaseTypes(): Promise<PublicCaseTypeOption[]> {
    const client = requireClient();
    const { data, error } = await client.rpc('get_public_case_types');
    if (error) throw error;
    return (data ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      slaLabel: item.sla_label
    }));
  },

  async createPublicCase(input: PublicCaseCreateInput): Promise<CreatedCaseResult> {
    const client = requireClient();
    const { data, error } = await client.rpc('submit_public_case', {
      p_case_type_id: input.caseTypeId,
      p_requester_name: input.requesterName,
      p_requester_company: input.requesterCompany,
      p_requester_document: input.requesterDocument,
      p_requester_email: input.requesterEmail,
      p_requester_phone: input.requesterPhone,
      p_subject: input.subject,
      p_description: input.description,
      p_website: input.website ?? null
    });
    if (error) throw error;
    const created = data?.[0];
    if (!created) throw new Error('No fue posible confirmar la radicación.');
    return { caseId: created.case_id, radicado: created.radicado, dueAt: created.due_at };
  }
};
