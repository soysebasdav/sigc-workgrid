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
  UploadCaseDocumentInput,
  SigcSlaOverride,
  OverrideCaseSlaInput,
  SigcCaseReview,
  SubmitCaseReviewInput,
  DecideCaseReviewInput,
  SigcCaseDelivery,
  RegisterCaseDeliveryInput,
  SigcCaseReminder,
  SendManualReminderInput,
  SigcAdminSnapshot,
  SigcUserManagementSnapshot,
  SaveAdminCatalogInput,
  SaveSlaPolicyInput,
  SaveHolidayInput,
  SaveRoleInput,
  SaveTransitionInput,
  SaveEmailTemplateInput,
  SaveReminderRuleInput,
  SaveAutomationRuleInput,
  AutomationCondition,
  AutomationAction,
  SigcDashboardAnalytics,
  SigcReportFilters,
  SigcReportResult,
  SigcReportRow,
  SigcSaasContext,
  SigcAuthorizationContext,
  UpdateOrganizationProfileInput,
  CreateSaasOrganizationInput,
  CreateOrganizationInvitationInput,
  CreatedOrganizationInvitation,
  ClientErrorInput,
  PublicOrganizationInvitation
} from '../domain/types';
import type { PublicSigcRepository, SigcRepository } from './types';

function requireClient() {
  if (!supabase) throw new Error('Supabase no está configurado.');
  return supabase;
}



type SlaOverrideRow = {
  id: string;
  case_id: string;
  previous_due_at: string | null;
  new_due_at: string;
  justification: string;
  changed_by: string | null;
  changed_at: string;
};

type ReviewRow = {
  id: string;
  case_id: string;
  review_round: number;
  status: string;
  requested_by: string | null;
  reviewer_user_id: string | null;
  request_note: string | null;
  requested_at: string;
  decided_by: string | null;
  decision_comments: string | null;
  decided_at: string | null;
};

type DeliveryRow = {
  id: string;
  case_id: string;
  channel: string;
  recipient: string;
  reference: string | null;
  notes: string | null;
  delivered_by: string | null;
  delivered_at: string;
};

type ReminderRow = {
  id: string;
  case_id: string;
  rule_id: string | null;
  recipient_user_id: string | null;
  reminder_type: string;
  message: string;
  sent_by: string | null;
  delivered_at: string;
};

type SimpleProfileRow = { id: string; name: string };
type SimpleRuleRow = { id: string; name: string };
type PublicCaseTypeRow = { id: string; name: string; description: string | null; sla_label: string | null };

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
    case 'case.sla_overridden': return { title: 'Fecha límite modificada', description: justification || 'Se registró una modificación excepcional del SLA.' };
    case 'case.review_pending': return { title: 'Revisión solicitada', description: 'La respuesta fue enviada a revisión o aprobación.' };
    case 'case.review_approved': return { title: 'Respuesta aprobada', description: 'La revisión concluyó con aprobación.' };
    case 'case.review_returned': return { title: 'Respuesta devuelta', description: 'La revisión solicitó ajustes antes de aprobar.' };
    case 'case.sent': return { title: 'Respuesta enviada', description: 'Se registró el envío al destinatario.' };
    case 'case.reminder_sent': return { title: 'Recordatorio enviado', description: text(afterData?.message) || 'Se envió un recordatorio de seguimiento.' };
    case 'automation.executed': return { title: 'Automatización ejecutada', description: text(metadata.ruleName) || 'Una regla automática actuó sobre el expediente.' };
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
  },

  async listCaseSlaOverrides(caseId: string): Promise<SigcSlaOverride[]> {
    const client = requireClient() as any;
    const resolvedCaseId = await resolveCaseDatabaseId(caseId);
    const { data, error } = await client
      .from('case_sla_overrides')
      .select('id,case_id,previous_due_at,new_due_at,justification,changed_by,changed_at')
      .eq('case_id', resolvedCaseId)
      .order('changed_at', { ascending: false });
    if (error) throw error;
    const rows = (data ?? []) as SlaOverrideRow[];
    const userIds = [...new Set(rows.map((row) => row.changed_by).filter((id): id is string => Boolean(id)))];
    const profiles = userIds.length ? await client.from('profiles').select('id,name').in('id', userIds) : { data: [], error: null };
    if (profiles.error) throw profiles.error;
    const names = new Map(((profiles.data ?? []) as SimpleProfileRow[]).map((row) => [row.id, row.name]));
    return rows.map((row) => ({
      id: row.id,
      caseId: row.case_id,
      previousDueAt: row.previous_due_at,
      newDueAt: row.new_due_at,
      justification: row.justification,
      changedBy: row.changed_by ?? undefined,
      changedByName: row.changed_by ? names.get(row.changed_by) ?? 'Usuario' : 'Sistema',
      changedAt: row.changed_at,
      changedLabel: formatDateTime(row.changed_at)
    }));
  },

  async overrideCaseSla(input: OverrideCaseSlaInput): Promise<void> {
    const client = requireClient() as any;
    const resolvedCaseId = await resolveCaseDatabaseId(input.caseId);
    const { error } = await client.rpc('override_case_sla', {
      p_case_id: resolvedCaseId,
      p_new_due_at: new Date(input.newDueAt).toISOString(),
      p_justification: input.justification
    });
    if (error) throw error;
  },

  async listCaseReviews(caseId: string): Promise<SigcCaseReview[]> {
    const client = requireClient() as any;
    const resolvedCaseId = await resolveCaseDatabaseId(caseId);
    const { data, error } = await client
      .from('case_reviews')
      .select('id,case_id,review_round,status,requested_by,reviewer_user_id,request_note,requested_at,decided_by,decision_comments,decided_at')
      .eq('case_id', resolvedCaseId)
      .order('requested_at', { ascending: false });
    if (error) throw error;
    const rows = (data ?? []) as ReviewRow[];
    const userIds = [...new Set(rows.flatMap((row) => [row.requested_by, row.reviewer_user_id, row.decided_by]).filter((id): id is string => Boolean(id)))];
    const profiles = userIds.length ? await client.from('profiles').select('id,name').in('id', userIds) : { data: [], error: null };
    if (profiles.error) throw profiles.error;
    const names = new Map(((profiles.data ?? []) as SimpleProfileRow[]).map((row) => [row.id, row.name]));
    return rows.map((row) => ({
      id: row.id,
      caseId: row.case_id,
      reviewRound: row.review_round,
      status: row.status as SigcCaseReview['status'],
      requestedBy: row.requested_by ?? undefined,
      requestedByName: row.requested_by ? names.get(row.requested_by) ?? 'Usuario' : 'Sistema',
      reviewerUserId: row.reviewer_user_id ?? undefined,
      reviewerName: row.reviewer_user_id ? names.get(row.reviewer_user_id) ?? 'Usuario' : 'Sin revisor específico',
      requestNote: row.request_note ?? undefined,
      requestedAt: row.requested_at,
      requestedLabel: formatDateTime(row.requested_at),
      decidedBy: row.decided_by ?? undefined,
      decidedByName: row.decided_by ? names.get(row.decided_by) ?? 'Usuario' : undefined,
      decisionComments: row.decision_comments ?? undefined,
      decidedAt: row.decided_at ?? undefined,
      decidedLabel: row.decided_at ? formatDateTime(row.decided_at) : undefined
    }));
  },

  async submitCaseForReview(input: SubmitCaseReviewInput): Promise<void> {
    const client = requireClient() as any;
    const resolvedCaseId = await resolveCaseDatabaseId(input.caseId);
    const { error } = await client.rpc('submit_case_for_review', {
      p_case_id: resolvedCaseId,
      p_reviewer_user_id: input.reviewerUserId || null,
      p_note: input.note || null
    });
    if (error) throw error;
  },

  async decideCaseReview(input: DecideCaseReviewInput): Promise<void> {
    const client = requireClient() as any;
    const { error } = await client.rpc('decide_case_review', {
      p_review_id: input.reviewId,
      p_decision: input.decision,
      p_comments: input.comments || null
    });
    if (error) throw error;
  },

  async listCaseDeliveries(caseId: string): Promise<SigcCaseDelivery[]> {
    const client = requireClient() as any;
    const resolvedCaseId = await resolveCaseDatabaseId(caseId);
    const { data, error } = await client
      .from('case_deliveries')
      .select('id,case_id,channel,recipient,reference,notes,delivered_by,delivered_at')
      .eq('case_id', resolvedCaseId)
      .order('delivered_at', { ascending: false });
    if (error) throw error;
    const rows = (data ?? []) as DeliveryRow[];
    const userIds = [...new Set(rows.map((row) => row.delivered_by).filter((id): id is string => Boolean(id)))];
    const profiles = userIds.length ? await client.from('profiles').select('id,name').in('id', userIds) : { data: [], error: null };
    if (profiles.error) throw profiles.error;
    const names = new Map(((profiles.data ?? []) as SimpleProfileRow[]).map((row) => [row.id, row.name]));
    return rows.map((row) => ({
      id: row.id,
      caseId: row.case_id,
      channel: row.channel as SigcCaseDelivery['channel'],
      recipient: row.recipient,
      reference: row.reference ?? undefined,
      notes: row.notes ?? undefined,
      deliveredBy: row.delivered_by ?? undefined,
      deliveredByName: row.delivered_by ? names.get(row.delivered_by) ?? 'Usuario' : 'Sistema',
      deliveredAt: row.delivered_at,
      deliveredLabel: formatDateTime(row.delivered_at)
    }));
  },

  async registerCaseDelivery(input: RegisterCaseDeliveryInput): Promise<void> {
    const client = requireClient() as any;
    const resolvedCaseId = await resolveCaseDatabaseId(input.caseId);
    const { error } = await client.rpc('register_case_delivery', {
      p_case_id: resolvedCaseId,
      p_channel: input.channel,
      p_recipient: input.recipient,
      p_reference: input.reference || null,
      p_notes: input.notes || null
    });
    if (error) throw error;
  },

  async listCaseReminders(caseId: string): Promise<SigcCaseReminder[]> {
    const client = requireClient() as any;
    const resolvedCaseId = await resolveCaseDatabaseId(caseId);
    const { data, error } = await client
      .from('case_reminder_log')
      .select('id,case_id,rule_id,recipient_user_id,reminder_type,message,sent_by,delivered_at')
      .eq('case_id', resolvedCaseId)
      .order('delivered_at', { ascending: false });
    if (error) throw error;
    const rows = (data ?? []) as ReminderRow[];
    const userIds = [...new Set(rows.flatMap((row) => [row.recipient_user_id, row.sent_by]).filter((id): id is string => Boolean(id)))];
    const ruleIds = [...new Set(rows.map((row) => row.rule_id).filter((id): id is string => Boolean(id)))];
    const [profiles, rules] = await Promise.all([
      userIds.length ? client.from('profiles').select('id,name').in('id', userIds) : Promise.resolve({ data: [], error: null }),
      ruleIds.length ? client.from('reminder_rules').select('id,name').in('id', ruleIds) : Promise.resolve({ data: [], error: null })
    ]);
    if (profiles.error) throw profiles.error;
    if (rules.error) throw rules.error;
    const names = new Map(((profiles.data ?? []) as SimpleProfileRow[]).map((row) => [row.id, row.name]));
    const ruleNames = new Map(((rules.data ?? []) as SimpleRuleRow[]).map((row) => [row.id, row.name]));
    return rows.map((row) => ({
      id: row.id,
      caseId: row.case_id,
      ruleName: row.rule_id ? ruleNames.get(row.rule_id) : undefined,
      recipientUserId: row.recipient_user_id ?? undefined,
      recipientName: row.recipient_user_id ? names.get(row.recipient_user_id) ?? 'Usuario' : 'Sin destinatario',
      reminderType: row.reminder_type as SigcCaseReminder['reminderType'],
      message: row.message,
      sentBy: row.sent_by ?? undefined,
      sentByName: row.sent_by ? names.get(row.sent_by) ?? 'Usuario' : 'Sistema',
      deliveredAt: row.delivered_at,
      deliveredLabel: formatDateTime(row.delivered_at)
    }));
  },

  async sendManualReminder(input: SendManualReminderInput): Promise<number> {
    const client = requireClient() as any;
    const resolvedCaseId = await resolveCaseDatabaseId(input.caseId);
    const { data, error } = await client.rpc('send_manual_case_reminder', {
      p_case_id: resolvedCaseId,
      p_message: input.message,
      p_recipient_user_ids: input.recipientUserIds?.length ? input.recipientUserIds : null
    });
    if (error) throw error;
    return Number(data ?? 0);
  },

  async getUserManagementSnapshot(): Promise<SigcUserManagementSnapshot> {
    const client = requireClient() as any;
    const { data, error } = await client.rpc('get_user_management_context');
    if (error) throw error;
    if (!data || typeof data !== 'object') throw new Error('No fue posible cargar la gestión de usuarios.');
    return data as SigcUserManagementSnapshot;
  },

  async getAdminSnapshot(): Promise<SigcAdminSnapshot> {
    const client = requireClient() as any;
    const organizationId = await ensureOrganization();
    const [areas, priorities, caseTypes, states, slaPolicies, holidays, permissions, roles, rolePermissions, memberships, profiles, caseTypeStates, transitions, templates, reminderRules, automationRules, automationExecutions, cases] = await Promise.all([
      client.from('areas').select('*').eq('organization_id', organizationId).order('sort_order'),
      client.from('priorities').select('*').eq('organization_id', organizationId).order('sort_order'),
      client.from('case_types').select('*').eq('organization_id', organizationId).order('name'),
      client.from('case_states').select('*').eq('organization_id', organizationId).order('sort_order'),
      client.from('sla_policies').select('*').eq('organization_id', organizationId).order('name'),
      client.from('organization_holidays').select('*').eq('organization_id', organizationId).order('holiday_date'),
      client.from('permissions').select('*').order('code'),
      client.from('roles').select('*').eq('organization_id', organizationId).order('name'),
      client.from('role_permissions').select('role_id,permission_id'),
      client.from('organization_members').select('*').eq('organization_id', organizationId).order('joined_at'),
      client.from('profiles').select('id,name,email'),
      client.from('case_type_states').select('*'),
      client.from('state_transitions').select('*').eq('organization_id', organizationId).order('created_at'),
      client.from('email_templates').select('*').eq('organization_id', organizationId).order('name'),
      client.from('reminder_rules').select('*').eq('organization_id', organizationId).order('offset_minutes', { ascending: false }),
      client.from('automation_rules').select('*').eq('organization_id', organizationId).order('sort_order'),
      client.from('automation_executions').select('*').eq('organization_id', organizationId).order('started_at', { ascending: false }).limit(100),
      client.from('cases').select('id,radicado').eq('organization_id', organizationId).is('deleted_at', null)
    ]);
    const results = [areas, priorities, caseTypes, states, slaPolicies, holidays, permissions, roles, rolePermissions, memberships, profiles, caseTypeStates, transitions, templates, reminderRules, automationRules, automationExecutions, cases];
    const failed = results.find((result) => result.error);
    if (failed?.error) throw failed.error;

    const mapCatalogItem = (row: any) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description ?? undefined,
      color: row.color ?? undefined,
      sortOrder: Number(row.sort_order ?? 0),
      isActive: Boolean(row.is_active),
      isInitial: row.is_initial == null ? undefined : Boolean(row.is_initial),
      isTerminal: row.is_terminal == null ? undefined : Boolean(row.is_terminal)
    });
    const rolePermissionMap = new Map<string, string[]>();
    for (const row of rolePermissions.data ?? []) {
      rolePermissionMap.set(row.role_id, [...(rolePermissionMap.get(row.role_id) ?? []), row.permission_id]);
    }
    const profileMap = new Map<string, { name: string; email: string }>((profiles.data ?? []).map((row: any) => [row.id, { name: row.name, email: row.email }]));
    const roleMap = new Map<string, { name: string }>((roles.data ?? []).map((row: any) => [row.id, { name: row.name }]));
    const caseTypeMap = new Map((caseTypes.data ?? []).map((row: any) => [row.id, row.name]));
    const stateMap = new Map((states.data ?? []).map((row: any) => [row.id, row.name]));
    const ruleMap = new Map((automationRules.data ?? []).map((row: any) => [row.id, row.name]));
    const caseMap = new Map((cases.data ?? []).map((row: any) => [row.id, row.radicado]));

    const workflows = (caseTypes.data ?? []).map((caseType: any) => ({
      caseTypeId: caseType.id,
      caseTypeName: caseType.name,
      states: (caseTypeStates.data ?? [])
        .filter((row: any) => row.case_type_id === caseType.id)
        .sort((a: any, b: any) => a.sort_order - b.sort_order)
        .map((row: any) => ({ stateId: row.state_id, stateName: stateMap.get(row.state_id) ?? 'Estado', sortOrder: row.sort_order, isRequired: Boolean(row.is_required) })),
      transitions: (transitions.data ?? [])
        .filter((row: any) => row.case_type_id === caseType.id)
        .map((row: any) => ({ id: row.id, caseTypeId: row.case_type_id ?? undefined, fromStateId: row.from_state_id, toStateId: row.to_state_id, requiredPermissionCode: row.required_permission_code ?? undefined, requiresJustification: Boolean(row.requires_justification), isActive: Boolean(row.is_active) }))
    }));

    return {
      organizationId,
      areas: (areas.data ?? []).map(mapCatalogItem),
      priorities: (priorities.data ?? []).map(mapCatalogItem),
      caseTypes: (caseTypes.data ?? []).map(mapCatalogItem),
      states: (states.data ?? []).map(mapCatalogItem),
      slaPolicies: (slaPolicies.data ?? []).map((row: any) => ({ id: row.id, caseTypeId: row.case_type_id ?? undefined, caseTypeName: row.case_type_id ? caseTypeMap.get(row.case_type_id) ?? 'Tipo de caso' : 'General', name: row.name, durationValue: row.duration_value, durationUnit: row.duration_unit, timezone: row.timezone ?? 'America/Bogota', pauseOnPendingInformation: Boolean(row.pause_on_pending_information), isDefault: Boolean(row.is_default), isActive: Boolean(row.is_active) })),
      holidays: (holidays.data ?? []).map((row: any) => ({ id: row.id, holidayDate: row.holiday_date, name: row.name, isActive: Boolean(row.is_active) })),
      permissions: (permissions.data ?? []).map((row: any) => ({ id: row.id, code: row.code, name: row.name, description: row.description ?? undefined })),
      roles: (roles.data ?? []).map((row: any) => ({ id: row.id, code: row.code, name: row.name, description: row.description ?? undefined, isSystem: Boolean(row.is_system), isActive: Boolean(row.is_active), permissionIds: rolePermissionMap.get(row.id) ?? [] })),
      members: (memberships.data ?? []).map((row: any) => { const profile = profileMap.get(row.user_id); const role = row.role_id ? roleMap.get(row.role_id) : null; return { membershipId: row.id, userId: row.user_id, name: profile?.name ?? 'Usuario', email: profile?.email ?? '', roleId: row.role_id ?? undefined, roleName: role?.name ?? 'Sin rol', isActive: Boolean(row.is_active) }; }),
      workflows,
      emailTemplates: (templates.data ?? []).map((row: any) => ({ id: row.id, code: row.code, name: row.name, eventType: row.event_type ?? undefined, subject: row.subject, bodyText: row.body_text, isActive: Boolean(row.is_active) })),
      reminderRules: (reminderRules.data ?? []).map((row: any) => ({ id: row.id, code: row.code, name: row.name, triggerKind: row.trigger_kind, offsetMinutes: row.offset_minutes, includeManagers: Boolean(row.include_managers), isActive: Boolean(row.is_active) })),
      automationRules: (automationRules.data ?? []).map((row: any) => ({ id: row.id, code: row.code, name: row.name, description: row.description ?? undefined, triggerEvent: row.trigger_event, conditions: (row.conditions ?? []) as AutomationCondition[], actions: (row.actions ?? []) as AutomationAction[], stopOnError: Boolean(row.stop_on_error), sortOrder: Number(row.sort_order ?? 0), isActive: Boolean(row.is_active), lastRunAt: row.last_run_at ?? undefined, runCount: Number(row.run_count ?? 0) })),
      automationExecutions: (automationExecutions.data ?? []).map((row: any) => ({ id: row.id, ruleId: row.rule_id, ruleName: ruleMap.get(row.rule_id) ?? 'Regla', caseId: row.case_id ?? undefined, caseRadicado: row.case_id ? caseMap.get(row.case_id) : undefined, triggerEvent: row.trigger_event, status: row.status, matched: Boolean(row.matched), actionsTotal: row.actions_total, actionsSucceeded: row.actions_succeeded, errorMessage: row.error_message ?? undefined, startedAt: row.started_at, finishedAt: row.finished_at ?? undefined }))
    };
  },

  async saveAdminCatalog(input: SaveAdminCatalogInput): Promise<void> {
    const client = requireClient() as any;
    const organizationId = await ensureOrganization();
    const tableMap = { areas: 'areas', priorities: 'priorities', caseTypes: 'case_types', states: 'case_states' } as const;
    const payload: Record<string, unknown> = { organization_id: organizationId, code: input.code.trim().toUpperCase(), name: input.name.trim(), is_active: input.isActive ?? true };
    if (input.kind !== 'priorities' && input.description !== undefined) payload.description = input.description || null;
    if (input.color !== undefined) payload.color = input.color || null;
    if (input.kind !== 'caseTypes') payload.sort_order = input.sortOrder ?? 0;
    if (input.kind === 'states') { payload.is_initial = Boolean(input.isInitial); payload.is_terminal = Boolean(input.isTerminal); }
    const table = tableMap[input.kind];
    const result = input.id ? await client.from(table).update(payload).eq('id', input.id) : await client.from(table).insert(payload);
    if (result.error) throw result.error;
  },

  async setAdminCatalogActive(kind: SaveAdminCatalogInput['kind'], id: string, isActive: boolean): Promise<void> {
    const client = requireClient() as any;
    const tableMap = { areas: 'areas', priorities: 'priorities', caseTypes: 'case_types', states: 'case_states' } as const;
    const { error } = await client.from(tableMap[kind]).update({ is_active: isActive }).eq('id', id);
    if (error) throw error;
  },

  async saveSlaPolicy(input: SaveSlaPolicyInput): Promise<void> {
    const client = requireClient() as any;
    const organizationId = await ensureOrganization();
    if (input.isDefault && input.caseTypeId) {
      const reset = await client.from('sla_policies').update({ is_default: false }).eq('organization_id', organizationId).eq('case_type_id', input.caseTypeId);
      if (reset.error) throw reset.error;
    }
    const payload = { organization_id: organizationId, case_type_id: input.caseTypeId || null, name: input.name.trim(), duration_value: input.durationValue, duration_unit: input.durationUnit, timezone: input.timezone || 'America/Bogota', pause_on_pending_information: input.pauseOnPendingInformation, is_default: input.isDefault, is_active: input.isActive };
    const result = input.id ? await client.from('sla_policies').update(payload).eq('id', input.id) : await client.from('sla_policies').insert(payload);
    if (result.error) throw result.error;
  },

  async saveHoliday(input: SaveHolidayInput): Promise<void> {
    const client = requireClient() as any;
    const organizationId = await ensureOrganization();
    const payload = { organization_id: organizationId, holiday_date: input.holidayDate, name: input.name.trim(), is_active: input.isActive };
    const result = input.id ? await client.from('organization_holidays').update(payload).eq('id', input.id) : await client.from('organization_holidays').insert(payload);
    if (result.error) throw result.error;
  },

  async deleteHoliday(id: string): Promise<void> {
    const client = requireClient() as any;
    const { error } = await client.from('organization_holidays').delete().eq('id', id);
    if (error) throw error;
  },

  async saveRole(input: SaveRoleInput): Promise<string> {
    const client = requireClient() as any;
    const organizationId = await ensureOrganization();
    const payload = { organization_id: organizationId, code: input.code.trim().toLowerCase(), name: input.name.trim(), description: input.description || null, is_active: input.isActive };
    const query = input.id ? client.from('roles').update(payload).eq('id', input.id).select('id').single() : client.from('roles').insert(payload).select('id').single();
    const { data, error } = await query;
    if (error) throw error;
    return data.id;
  },

  async setRolePermissions(roleId: string, permissionIds: string[]): Promise<void> {
    const client = requireClient() as any;
    const { error } = await client.rpc('set_role_permissions', { p_role_id: roleId, p_permission_ids: permissionIds });
    if (error) throw error;
  },

  async setMemberRole(membershipId: string, roleId: string): Promise<void> {
    const client = requireClient() as any;
    const { error } = await client.rpc('set_organization_member_role', { p_membership_id: membershipId, p_role_id: roleId });
    if (error) throw error;
  },

  async saveWorkflowStates(caseTypeId: string, stateIds: string[]): Promise<void> {
    const client = requireClient() as any;
    const removed = await client.from('case_type_states').delete().eq('case_type_id', caseTypeId);
    if (removed.error) throw removed.error;
    if (stateIds.length) {
      const inserted = await client.from('case_type_states').insert(stateIds.map((stateId, index) => ({ case_type_id: caseTypeId, state_id: stateId, sort_order: (index + 1) * 10, is_required: true })));
      if (inserted.error) throw inserted.error;
    }
  },

  async saveTransition(input: SaveTransitionInput): Promise<void> {
    const client = requireClient() as any;
    const organizationId = await ensureOrganization();
    const payload = { organization_id: organizationId, case_type_id: input.caseTypeId, from_state_id: input.fromStateId, to_state_id: input.toStateId, required_permission_code: input.requiredPermissionCode || null, requires_justification: input.requiresJustification, is_active: input.isActive };
    const result = input.id ? await client.from('state_transitions').update(payload).eq('id', input.id) : await client.from('state_transitions').insert(payload);
    if (result.error) throw result.error;
  },

  async deleteTransition(id: string): Promise<void> {
    const client = requireClient() as any;
    const { error } = await client.from('state_transitions').delete().eq('id', id);
    if (error) throw error;
  },

  async saveEmailTemplate(input: SaveEmailTemplateInput): Promise<void> {
    const client = requireClient() as any;
    const organizationId = await ensureOrganization();
    const payload = { organization_id: organizationId, code: input.code.trim().toUpperCase(), name: input.name.trim(), event_type: input.eventType || null, subject: input.subject, body_text: input.bodyText, is_active: input.isActive };
    const result = input.id ? await client.from('email_templates').update(payload).eq('id', input.id) : await client.from('email_templates').insert(payload);
    if (result.error) throw result.error;
  },

  async saveReminderRule(input: SaveReminderRuleInput): Promise<void> {
    const client = requireClient() as any;
    const organizationId = await ensureOrganization();
    const payload = { organization_id: organizationId, code: input.code.trim().toUpperCase(), name: input.name.trim(), trigger_kind: input.triggerKind, offset_minutes: input.offsetMinutes, include_managers: input.includeManagers, is_active: input.isActive };
    const result = input.id ? await client.from('reminder_rules').update(payload).eq('id', input.id) : await client.from('reminder_rules').insert(payload);
    if (result.error) throw result.error;
  },

  async saveAutomationRule(input: SaveAutomationRuleInput): Promise<void> {
    const client = requireClient() as any;
    const organizationId = await ensureOrganization();
    const payload: Record<string, unknown> = { organization_id: organizationId, code: input.code.trim().toUpperCase(), name: input.name.trim(), description: input.description || null, trigger_event: input.triggerEvent, conditions: input.conditions, actions: input.actions, stop_on_error: input.stopOnError, sort_order: input.sortOrder, is_active: input.isActive, updated_by: (await client.auth.getUser()).data.user?.id ?? null };
    if (!input.id) payload.created_by = payload.updated_by;
    const result = input.id ? await client.from('automation_rules').update(payload).eq('id', input.id) : await client.from('automation_rules').insert(payload);
    if (result.error) throw result.error;
  },

  async toggleAutomationRule(id: string, isActive: boolean): Promise<void> {
    const client = requireClient() as any;
    const { error } = await client.from('automation_rules').update({ is_active: isActive }).eq('id', id);
    if (error) throw error;
  },

  async runAutomationRule(ruleId: string, caseId: string): Promise<void> {
    const client = requireClient() as any;
    const resolvedCaseId = await resolveCaseDatabaseId(caseId);
    const { error } = await client.rpc('run_automation_rule_test', { p_rule_id: ruleId, p_case_id: resolvedCaseId });
    if (error) throw error;
  },

  async getDashboardAnalytics(): Promise<SigcDashboardAnalytics> {
    const client = requireClient() as any;
    const { data, error } = await client.rpc('get_sigc_dashboard', {});
    if (error) throw error;
    return data as SigcDashboardAnalytics;
  },

  async getReport(filters: SigcReportFilters): Promise<SigcReportResult> {
    const client = requireClient() as any;
    const from = new Date(`${filters.from}T00:00:00`).toISOString();
    const to = new Date(`${filters.to}T00:00:00`);
    to.setDate(to.getDate() + 1);
    const payload = {
      stateId: filters.stateId ?? '',
      areaId: filters.areaId ?? '',
      ownerId: filters.ownerId ?? '',
      caseTypeId: filters.caseTypeId ?? '',
      priorityId: filters.priorityId ?? '',
      overdueOnly: Boolean(filters.overdueOnly)
    };
    const { data, error } = await client.rpc('get_sigc_report', { p_from: from, p_to: to.toISOString(), p_filters: payload });
    if (error) throw error;
    const result = (data ?? {}) as any;
    const rows: SigcReportRow[] = (result.rows ?? []).map((row: any) => ({
      id: row.id, radicado: row.radicado, subject: row.subject, requesterName: row.requester_name ?? '',
      requesterCompany: row.requester_company ?? '', source: row.source ?? '', riskLevel: row.risk_level ?? undefined,
      openedAt: row.opened_at, dueAt: row.due_at ?? null, closedAt: row.closed_at ?? null, progress: Number(row.progress ?? 0),
      updatedAt: row.updated_at, caseType: row.case_type ?? 'Sin clasificar', state: row.state ?? 'Sin estado',
      priority: row.priority ?? 'Sin prioridad', area: row.area ?? 'Sin área', owner: row.owner ?? 'Sin responsable',
      overdue: Boolean(row.overdue), slaMet: row.sla_met ?? null, resolutionHours: row.resolution_hours == null ? null : Number(row.resolution_hours)
    }));
    return { ...result, rows } as SigcReportResult;
  },

  async getSaasContext(): Promise<SigcSaasContext> {
    const client = requireClient() as any;
    const { data, error } = await client.rpc('get_saas_context');
    if (error) throw error;
    return data as SigcSaasContext;
  },

  async getAuthorizationContext(): Promise<SigcAuthorizationContext> {
    const client = requireClient() as any;
    const { data, error } = await client.rpc('get_authorization_context');
    if (error) throw error;
    if (!data || typeof data !== 'object') throw new Error('No fue posible resolver el contexto de autorización.');
    return data as SigcAuthorizationContext;
  },

  async setActiveOrganization(organizationId: string): Promise<void> {
    const client = requireClient() as any;
    const { error } = await client.rpc('set_active_organization', { p_organization_id: organizationId });
    if (error) throw error;
  },

  async updateOrganizationProfile(input: UpdateOrganizationProfileInput): Promise<void> {
    const client = requireClient() as any;
    const { error } = await client.rpc('update_organization_profile', {
      p_name: input.name, p_slug: input.slug, p_product_name: input.productName, p_short_name: input.shortName,
      p_logo_url: input.logoUrl ?? null, p_primary_color: input.primaryColor, p_accent_color: input.accentColor,
      p_sidebar_color: input.sidebarColor, p_support_email: input.supportEmail ?? null, p_custom_domain: input.customDomain ?? null
    });
    if (error) throw error;
  },

  async createSaasOrganization(input: CreateSaasOrganizationInput): Promise<string> {
    const client = requireClient() as any;
    const { data, error } = await client.rpc('create_saas_organization', { p_name: input.name, p_slug: input.slug });
    if (error) throw error;
    return String(data);
  },

  async createOrganizationInvitation(input: CreateOrganizationInvitationInput): Promise<CreatedOrganizationInvitation> {
    const client = requireClient() as any;
    const { data, error } = await client.rpc('create_organization_invitation', { p_email: input.email, p_role_id: input.roleId, p_expires_days: input.expiresDays ?? 7 });
    if (error) throw error;
    const row = data?.[0];
    if (!row) throw new Error('No fue posible crear la invitación.');
    return { invitationId: row.invitation_id, token: row.token, expiresAt: row.expires_at };
  },

  async revokeOrganizationInvitation(invitationId: string): Promise<void> {
    const client = requireClient() as any;
    const { error } = await client.rpc('revoke_organization_invitation', { p_invitation_id: invitationId });
    if (error) throw error;
  },

  async logClientError(input: ClientErrorInput): Promise<void> {
    const client = requireClient() as any;
    const { error } = await client.rpc('log_client_error', {
      p_message: input.message, p_stack: input.stack ?? null, p_route: input.route ?? null,
      p_severity: input.severity ?? 'error', p_metadata: input.metadata ?? {}
    });
    if (error) console.warn('No fue posible registrar el error de cliente:', error);
  }
};

export const supabasePublicSigcRepository: PublicSigcRepository = {
  async getPublicCaseTypes(): Promise<PublicCaseTypeOption[]> {
    const client = requireClient() as any;
    const { data, error } = await client.rpc('get_public_case_types');
    if (error) throw error;
    return ((data ?? []) as PublicCaseTypeRow[]).map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      slaLabel: item.sla_label ?? 'Sin SLA configurado'
    }));
  },

  async createPublicCase(input: PublicCaseCreateInput): Promise<CreatedCaseResult> {
    const client = requireClient() as any;
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
  },

  async getOrganizationInvitation(token: string): Promise<PublicOrganizationInvitation | null> {
    const client = requireClient() as any;
    const { data, error } = await client.rpc('get_organization_invitation', { p_token: token });
    if (error) throw error;
    const row = data?.[0];
    if (!row) return null;
    return { organizationName: row.organization_name, organizationSlug: row.organization_slug, email: row.email, roleName: row.role_name, status: row.status, expiresAt: row.expires_at };
  },

  async acceptOrganizationInvitation(token: string): Promise<string> {
    const client = requireClient() as any;
    const { data, error } = await client.rpc('accept_organization_invitation', { p_token: token });
    if (error) throw error;
    return String(data);
  }
};
