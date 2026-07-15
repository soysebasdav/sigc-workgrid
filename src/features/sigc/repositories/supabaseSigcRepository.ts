import { supabase } from '../../../lib/supabaseClient';
import type { Json } from '../../../types/supabase';
import type {
  AddCommentInput,
  AddDocumentVersionInput,
  AllowedCaseState,
  CaseAssignmentInput,
  ClassifyCaseInput,
  UpdateCaseAssignmentInput,
  DeactivateCaseAssignmentInput,
  CasePriorityName,
  ChangeCaseStateInput,
  CreateSubtaskInput,
  CreatedCaseResult,
  CreatedCommentResult,
  CreatedSubtaskResult,
  ManualCaseCreateInput,
  PublicCaseCreateInput,
  PublicCaseSubmissionResult,
  PublicIntakeContext,
  PublicIntakeLocator,
  SemColor,
  SigcAssignment,
  SigcCase,
  SigcCaseFilters,
  SigcCasePage,
  SigcCatalogOption,
  SigcCatalogs,
  SigcComment,
  SigcDocument,
  SigcDocumentVersion,
  UpdateDocumentRetentionInput,
  SigcAuditFilters,
  SigcAuditPage,
  SigcTimelinePage,
  EmailTemplatePreviewInput,
  EmailTemplatePreview,
  SendTestEmailInput,
  RuntimeExecutionResult,
  SigcMember,
  SigcSubtask,
  SigcSubtaskFilters,
  SigcSubtaskPage,
  SigcDocumentFilters,
  SigcDocumentPage,
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
  SigcNotificationPage,
  SigcSidebarSummary,
  SigcSecurityHealth,
  ClientPortalSnapshot,
  SaveAdminCatalogInput,
  SaveSlaPolicyInput,
  SaveHolidayInput,
  SaveRoleInput,
  SaveTransitionInput,
  SaveEmailTemplateInput,
  SaveReminderRuleInput,
  SaveAutomationRuleInput,
  AutomationRuleVersion,
  AutomationDryRunResult,
  AutomationDiagnostic,
  AutomationCondition,
  AutomationAction,
  SigcDashboardAnalytics,
  SigcReportFilters,
  SigcReportResult,
  SigcReportRow,
  SigcReportExportFormat,
  SigcReportExportJob,
  SigcReportExportPage,
  SigcSaasContext,
  SigcAuthorizationContext,
  UpdateOrganizationProfileInput,
  UpdatePublicIntakeSettingsInput,
  CreateSaasOrganizationInput,
  CreateOrganizationInvitationInput,
  CreatedOrganizationInvitation,
  ClientErrorInput,
  PublicOrganizationInvitation,
  SigcAgendaSnapshot,
  SigcAgendaItem,
  WorkflowBoardFilters,
  WorkflowBoardSnapshot,
  WorkflowBoardColumn,
  WorkflowBoardCard,
  WorkflowBoardTransition,
  MoveWorkflowCaseInput,
  MoveWorkflowCaseResult,
  AutomationRuntimeHealth,
  QualityDashboard,
  RunQualitySuiteInput,
  QualityRunRecord
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
  classification_observations: string | null;
  classified_at: string | null;
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
  case_type: { name: string; color: string | null } | null;
  priority: { name: string; code: string; color: string | null } | null;
  state: { name: string; code: string; color: string | null; is_terminal: boolean } | null;
  area: { name: string; color: string | null } | null;
  owner: { name: string } | null;
  sla_policy: { duration_value: number; duration_unit: string } | null;
};

const CASE_SELECT = `
  id, organization_id, radicado, subject, description,
  requester_name, requester_company, requester_document, requester_email, requester_phone,
  source, risk_level, classification_observations, classified_at, opened_at, due_at, progress, updated_at,
  case_type_id, priority_id, state_id, sla_policy_id, primary_area_id, primary_owner_id,
  case_type:case_types(name,color),
  priority:priorities(name,code,color),
  state:case_states(name,code,color,is_terminal),
  area:areas(name,color),
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
  const priorityName = row.priority?.name ?? 'Sin prioridad';
  const isTerminal = row.state?.is_terminal ?? false;
  const sem = isTerminal ? 'green' : semFromTimeline(row.opened_at, row.due_at);
  return {
    id: row.radicado,
    databaseId: row.id,
    radicado: row.radicado,
    organizationId: row.organization_id,
    typeId: row.case_type_id ?? undefined,
    type: row.case_type?.name ?? 'Sin clasificar',
    typeColor: row.case_type?.color ?? null,
    subject: row.subject,
    description: row.description,
    company: row.requester_company ?? 'Sin empresa',
    requester: row.requester_name,
    requesterDocument: row.requester_document ?? undefined,
    requesterEmail: row.requester_email ?? undefined,
    requesterPhone: row.requester_phone ?? undefined,
    areaId: row.primary_area_id ?? undefined,
    area: row.area?.name ?? 'Sin área',
    areaColor: row.area?.color ?? null,
    ownerId: row.primary_owner_id ?? undefined,
    owner: row.owner?.name ?? 'Sin responsable',
    stateId: row.state_id ?? undefined,
    stateCode: row.state?.code ?? undefined,
    state: row.state?.name ?? 'Pendiente de Clasificación',
    stateColor: row.state?.color ?? null,
    priorityId: row.priority_id ?? undefined,
    priorityCode: row.priority?.code ?? undefined,
    priority: priorityName,
    priorityColor: row.priority?.color ?? null,
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
    source: row.source,
    classificationObservations: row.classification_observations ?? undefined,
    classifiedAt: row.classified_at
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

async function fetchCases(identifier: string): Promise<SigcCase[]> {
  const client = requireClient();
  const organizationId = await ensureOrganization();

  let query = client
    .from('cases')
    .select(CASE_SELECT)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  const decoded = decodeURIComponent(identifier);
  query = /^[0-9a-f-]{36}$/i.test(decoded) ? query.eq('id', decoded) : query.eq('radicado', decoded);

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

const MAX_INTERNAL_FILE_SIZE_BYTES = 100 * 1024 * 1024;
const ALLOWED_INTERNAL_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'markdown', 'csv', 'json', 'xml', 'yaml', 'yml',
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif', 'mp4', 'webm', 'mov', 'mp3', 'wav', 'ogg', 'm4a', 'aac', 'log', 'js', 'ts', 'css', 'html'
]);

function validateInternalFile(file: File): void {
  if (file.size <= 0) throw new Error(`${file.name}: el archivo está vacío.`);
  if (file.size > MAX_INTERNAL_FILE_SIZE_BYTES) throw new Error(`${file.name}: supera el máximo de 100 MB.`);
  const extension = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() ?? '' : '';
  if (!extension || !ALLOWED_INTERNAL_EXTENSIONS.has(extension)) {
    throw new Error(`${file.name}: formato de archivo no permitido.`);
  }
}

async function sha256File(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function removeStoragePathQuietly(path: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.storage.from('case-documents').remove([path]);
  if (error) console.warn(`SIGC: no fue posible limpiar el archivo huérfano ${path}.`, error);
}

function extractTemplateVariables(...values: Array<string | null | undefined>): string[] {
  const found = new Set<string>();
  for (const value of values) {
    for (const match of String(value ?? '').matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)) found.add(match[1].trim());
  }
  return [...found].sort();
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
    case 'case.classified': return { title: 'Caso clasificado', description: justification || 'Se definieron clasificación, responsables y SLA del expediente.' };
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
    case 'assignment.deactivated': return { title: 'Asignación retirada', description: justification || 'La asignación se retiró del caso sin borrar su historial.' };
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

  async searchCases(filters: SigcCaseFilters): Promise<SigcCasePage> {
    const client = requireClient();
    const { data, error } = await client.rpc('search_sigc_cases_v3', {
      p_filters: {
        query: filters.query ?? '',
        stateId: filters.stateId ?? '',
        areaId: filters.areaId ?? '',
        ownerId: filters.ownerId ?? '',
        caseTypeId: filters.caseTypeId ?? '',
        priorityId: filters.priorityId ?? '',
        fromDate: filters.fromDate ?? '',
        toDate: filters.toDate ?? '',
        overdueOnly: Boolean(filters.overdueOnly),
        upcomingOnly: Boolean(filters.upcomingOnly),
        page: Math.max(1, filters.page ?? 1),
        pageSize: Math.min(100, Math.max(5, filters.pageSize ?? 10))
      }
    });
    if (error) throw error;
    if (!data || typeof data !== 'object') throw new Error('La búsqueda de casos no devolvió un resultado válido.');
    const raw = data as Record<string, unknown>;
    return {
      items: Array.isArray(raw.items) ? raw.items as SigcCase[] : [],
      total: Number(raw.total ?? 0),
      page: Number(raw.page ?? filters.page ?? 1),
      pageSize: Number(raw.pageSize ?? filters.pageSize ?? 10)
    };
  },

  async getCaseByIdentifier(identifier: string): Promise<SigcCase | null> {
    const rows = await fetchCases(identifier);
    return rows[0] ?? null;
  },

  async getCatalogs(): Promise<SigcCatalogs> {
    const client = requireClient();
    const { data, error } = await client.rpc('get_operational_catalogs_v1');

    if (!error && data && typeof data === 'object') {
      const raw = data as any;
      const mapOption = (item: any): SigcCatalogOption => ({
        id: String(item.id),
        name: String(item.name),
        code: item.code == null ? undefined : String(item.code),
        description: item.description ?? null,
        color: item.color ?? null,
        sortOrder: Number(item.sortOrder ?? 0),
        isActive: item.isActive !== false,
        parentAreaId: item.parentAreaId ?? null,
        email: item.email ?? null,
        isPublicEnabled: item.isPublicEnabled == null ? undefined : Boolean(item.isPublicEnabled),
        isInternalEnabled: item.isInternalEnabled == null ? undefined : Boolean(item.isInternalEnabled),
        defaultPriorityId: item.defaultPriorityId ?? null,
        defaultRiskLevel: item.defaultRiskLevel ?? null,
        responseTemplateId: item.responseTemplateId ?? null,
        slaPolicyId: item.slaPolicyId ?? null,
        slaLabel: item.slaLabel == null ? undefined : String(item.slaLabel),
        defaultAreas: Array.isArray(item.defaultAreas) ? item.defaultAreas.map((entry: any) => ({
          areaId: String(entry.areaId),
          areaName: String(entry.areaName ?? 'Área'),
          responsibleUserId: entry.responsibleUserId ?? undefined,
          responsibleName: entry.responsibleName ?? undefined,
          isPrimary: Boolean(entry.isPrimary),
          sortOrder: Number(entry.sortOrder ?? 0)
        })) : []
      });
      const configuration = raw.configuration ?? {};
      return {
        organizationId: raw.organizationId ? String(raw.organizationId) : null,
        areas: Array.isArray(raw.areas) ? raw.areas.map(mapOption) : [],
        caseTypes: Array.isArray(raw.caseTypes) ? raw.caseTypes.map(mapOption) : [],
        states: Array.isArray(raw.states) ? raw.states.map(mapOption) : [],
        priorities: Array.isArray(raw.priorities) ? raw.priorities.map(mapOption) : [],
        roles: Array.isArray(raw.roles) ? raw.roles.map(mapOption) : [],
        configuration: {
          readyForManual: Boolean(configuration.readyForManual),
          readyForPublic: Boolean(configuration.readyForPublic),
          publicIntakeEnabled: Boolean(configuration.publicIntakeEnabled),
          issues: Array.isArray(configuration.issues) ? configuration.issues.map(String) : [],
          counts: {
            areas: Number(configuration.counts?.areas ?? 0),
            priorities: Number(configuration.counts?.priorities ?? 0),
            states: Number(configuration.counts?.states ?? 0),
            internalCaseTypes: Number(configuration.counts?.internalCaseTypes ?? 0),
            publicCaseTypes: Number(configuration.counts?.publicCaseTypes ?? 0),
            caseTypesWithoutSla: Number(configuration.counts?.caseTypesWithoutSla ?? 0),
            caseTypesWithoutWorkflow: Number(configuration.counts?.caseTypesWithoutWorkflow ?? 0)
          }
        }
      };
    }

    // Compatibilidad temporal: permite mostrar el estado real antes de ejecutar la migración de Fase 1.
    const organizationId = await ensureOrganization();
    const [areas, types, states, priorities, roles] = await Promise.all([
      client.from('areas').select('id,name,code,color,is_active').eq('organization_id', organizationId).eq('is_active', true).order('sort_order'),
      client.from('case_types').select('id,name,code,color,is_active').eq('organization_id', organizationId).eq('is_active', true).order('name'),
      client.from('case_states').select('id,name,code,color,is_active').eq('organization_id', organizationId).eq('is_active', true).order('sort_order'),
      client.from('priorities').select('id,name,code,color,is_active').eq('organization_id', organizationId).eq('is_active', true).order('sort_order'),
      client.from('roles').select('id,name,code,is_active').eq('organization_id', organizationId).eq('is_active', true).order('name')
    ]);
    const fallbackError = areas.error ?? types.error ?? states.error ?? priorities.error ?? roles.error;
    if (fallbackError) throw error ?? fallbackError;
    const issues: string[] = [];
    if (!(areas.data ?? []).length) issues.push('No existen áreas activas para la organización.');
    if (!(priorities.data ?? []).length) issues.push('No existen prioridades activas para la organización.');
    if (!(types.data ?? []).length) issues.push('No existen tipos de caso activos para la organización.');
    if (!(states.data ?? []).length) issues.push('No existen estados activos para la organización.');
    return {
      organizationId,
      areas: mapCatalog(areas.data ?? []),
      caseTypes: mapCatalog(types.data ?? []).map((item) => ({ ...item, isInternalEnabled: true, isPublicEnabled: true, defaultAreas: [] })),
      states: mapCatalog(states.data ?? []),
      priorities: mapCatalog(priorities.data ?? []),
      roles: mapCatalog(roles.data ?? []),
      configuration: {
        readyForManual: issues.length === 0,
        readyForPublic: Boolean((types.data ?? []).length),
        publicIntakeEnabled: false,
        issues: error ? [`La migración de Fase 1 aún no está aplicada: ${error.message}`, ...issues] : issues,
        counts: { areas: areas.data?.length ?? 0, priorities: priorities.data?.length ?? 0, states: states.data?.length ?? 0, internalCaseTypes: types.data?.length ?? 0, publicCaseTypes: types.data?.length ?? 0, caseTypesWithoutSla: 0, caseTypesWithoutWorkflow: 0 }
      }
    };
  },

  async listMembers(): Promise<SigcMember[]> {
    const client = requireClient();
    const organizationId = await ensureOrganization();
    const { data: memberships, error: membershipsError } = await client
      .from('organization_members')
      .select('id,user_id,role_id')
      .eq('organization_id', organizationId)
      .eq('is_active', true);
    if (membershipsError) throw membershipsError;

    const userIds = [...new Set((memberships ?? []).map((item) => item.user_id))];
    const membershipIds = [...new Set((memberships ?? []).map((item) => item.id))];
    const roleIds = [...new Set((memberships ?? []).map((item) => item.role_id).filter((id): id is string => Boolean(id)))];
    if (!userIds.length) return [];

    const [profiles, roles, rolePermissions, permissions, memberAreas] = await Promise.all([
      client.from('profiles').select('id,name,email').in('id', userIds),
      roleIds.length ? client.from('roles').select('id,name').in('id', roleIds) : Promise.resolve({ data: [], error: null }),
      roleIds.length ? client.from('role_permissions').select('role_id,permission_id').in('role_id', roleIds) : Promise.resolve({ data: [], error: null }),
      client.from('permissions').select('id,code'),
      membershipIds.length ? client.from('organization_member_areas').select('organization_member_id,area_id,is_primary,is_coordinator,is_active').eq('organization_id', organizationId).in('organization_member_id', membershipIds).eq('is_active', true) : Promise.resolve({ data: [], error: null })
    ]);
    const relatedError = profiles.error ?? roles.error ?? rolePermissions.error ?? permissions.error ?? memberAreas.error;
    if (relatedError) throw relatedError;

    const profileMap = new Map<string, { id: string; name: string; email: string }>((profiles.data ?? []).map((item) => [item.id, item as { id: string; name: string; email: string }]));
    const roleMap = new Map<string, string>((roles.data ?? []).map((item) => [String(item.id), String(item.name)]));
    const permissionCodeMap = new Map<string, string>((permissions.data ?? []).map((item) => [String(item.id), String(item.code)]));
    const permissionsByRole = new Map<string, string[]>();
    for (const row of rolePermissions.data ?? []) {
      const code = permissionCodeMap.get(String(row.permission_id));
      if (!code) continue;
      permissionsByRole.set(String(row.role_id), [...(permissionsByRole.get(String(row.role_id)) ?? []), code]);
    }
    const areasByMembership = new Map<string, Array<{ areaId: string; isPrimary: boolean; isCoordinator: boolean }>>();
    for (const row of memberAreas.data ?? []) {
      const key = String(row.organization_member_id);
      areasByMembership.set(key, [...(areasByMembership.get(key) ?? []), { areaId: String(row.area_id), isPrimary: Boolean(row.is_primary), isCoordinator: Boolean(row.is_coordinator) }]);
    }

    return (memberships ?? []).flatMap((membership): SigcMember[] => {
      const profile = profileMap.get(membership.user_id);
      if (!profile) return [];
      const areaLinks = areasByMembership.get(String(membership.id)) ?? [];
      return [{
        membershipId: membership.id,
        userId: profile.id,
        name: profile.name,
        email: profile.email,
        roleName: membership.role_id ? roleMap.get(membership.role_id) ?? 'Sin rol' : 'Sin rol',
        permissionCodes: membership.role_id ? permissionsByRole.get(membership.role_id) ?? [] : [],
        areaIds: areaLinks.map((entry) => entry.areaId),
        primaryAreaId: areaLinks.find((entry) => entry.isPrimary)?.areaId,
        coordinatorAreaIds: areaLinks.filter((entry) => entry.isCoordinator).map((entry) => entry.areaId)
      }];
    });
  },

  async listCaseAssignments(caseId: string): Promise<SigcAssignment[]> {
    const client = requireClient();
    const resolvedCaseId = await resolveCaseDatabaseId(caseId);
    const { data, error } = await client
      .from('case_assignments')
      .select('id,area_id,responsible_user_id,assigned_at,due_at,state,observations,progress,is_primary,is_active,updated_at,completed_at')
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
      assignedAt: item.assigned_at,
      assignedLabel: formatDateTime(item.assigned_at),
      dueAt: item.due_at,
      due: formatDue(item.due_at),
      state: item.state,
      observations: item.observations,
      progress: item.progress,
      isPrimary: item.is_primary,
      isActive: item.is_active,
      updatedAt: item.updated_at,
      completedAt: item.completed_at
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
      observations: assignment.observations ?? '',
      isPrimary: assignment.isPrimary ?? false
    }));
    const { data, error } = await client.rpc('create_internal_case_v2', {
      p_idempotency_key: input.idempotencyKey,
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

  async classifyCase(input: ClassifyCaseInput): Promise<void> {
    const client = requireClient();
    const resolvedCaseId = await resolveCaseDatabaseId(input.caseId);
    const assignments = input.assignments.map((assignment, index) => ({
      areaId: assignment.areaId,
      responsibleUserId: assignment.responsibleUserId || null,
      dueAt: assignment.dueAt ? new Date(assignment.dueAt).toISOString() : null,
      observations: assignment.observations?.trim() || null,
      isPrimary: assignment.isPrimary ?? index === 0
    }));
    const { error } = await client.rpc('classify_case_v2', {
      p_case_id: resolvedCaseId,
      p_case_type_id: input.caseTypeId,
      p_priority_id: input.priorityId,
      p_risk_level: input.riskLevel,
      p_observations: input.observations?.trim() || null,
      p_due_at: input.dueAt ? new Date(input.dueAt).toISOString() : null,
      p_assignments: assignments
    });
    if (error) throw error;
  },

  async updateCaseAssignment(input: UpdateCaseAssignmentInput): Promise<void> {
    const client = requireClient();
    const resolvedCaseId = await resolveCaseDatabaseId(input.caseId);
    const { error } = await client.rpc('update_case_assignment_v2', {
      p_assignment_id: input.assignmentId,
      p_case_id: resolvedCaseId,
      p_area_id: input.areaId,
      p_responsible_user_id: input.responsibleUserId || null,
      p_due_at: input.dueAt ? new Date(input.dueAt).toISOString() : null,
      p_state: input.state,
      p_observations: input.observations?.trim() || null,
      p_progress: Math.max(0, Math.min(100, input.progress)),
      p_is_primary: input.isPrimary
    });
    if (error) throw error;
  },

  async deactivateCaseAssignment(input: DeactivateCaseAssignmentInput): Promise<void> {
    const client = requireClient();
    const resolvedCaseId = await resolveCaseDatabaseId(input.caseId);
    const { error } = await client.rpc('deactivate_case_assignment_v2', {
      p_assignment_id: input.assignmentId,
      p_case_id: resolvedCaseId,
      p_reason: input.reason.trim()
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

  async getWorkflowBoard(filters: WorkflowBoardFilters = {}): Promise<WorkflowBoardSnapshot> {
    const client = requireClient();
    const { data, error } = await client.rpc('get_workflow_board', {
      p_case_type_id: filters.caseTypeId || null,
      p_query: filters.query?.trim() || null,
      p_area_id: filters.areaId || null,
      p_owner_id: filters.ownerId || null,
      p_priority_id: filters.priorityId || null
    });
    if (error) throw error;
    if (!data || typeof data !== 'object') throw new Error('El tablero no devolvió un resultado válido.');
    const raw = data as Record<string, any>;
    const columns: WorkflowBoardColumn[] = Array.isArray(raw.columns) ? raw.columns.map((column: Record<string, any>) => ({
      stateId: String(column.stateId ?? ''),
      code: String(column.code ?? ''),
      name: String(column.name ?? 'Estado'),
      color: column.color ?? null,
      sortOrder: Number(column.sortOrder ?? 0),
      isInitial: Boolean(column.isInitial),
      isTerminal: Boolean(column.isTerminal),
      cards: Array.isArray(column.cards) ? column.cards.map((card: Record<string, any>): WorkflowBoardCard => ({
        id: String(card.id ?? ''),
        radicado: String(card.radicado ?? ''),
        subject: String(card.subject ?? ''),
        company: String(card.company ?? ''),
        requester: String(card.requester ?? ''),
        stateId: String(card.stateId ?? ''),
        stateName: String(card.stateName ?? column.name ?? ''),
        priorityId: card.priorityId ? String(card.priorityId) : undefined,
        priorityName: String(card.priorityName ?? 'Sin prioridad'),
        priorityColor: card.priorityColor ?? null,
        areaId: card.areaId ? String(card.areaId) : undefined,
        areaName: String(card.areaName ?? 'Sin área'),
        ownerId: card.ownerId ? String(card.ownerId) : undefined,
        ownerName: String(card.ownerName ?? 'Sin responsable'),
        dueAt: card.dueAt ?? null,
        progress: Number(card.progress ?? 0),
        riskLevel: card.riskLevel ?? null,
        source: String(card.source ?? ''),
        updatedAt: String(card.updatedAt ?? ''),
        overdue: Boolean(card.overdue)
      })) : []
    })) : [];
    const transitions: WorkflowBoardTransition[] = Array.isArray(raw.transitions) ? raw.transitions.map((item: Record<string, any>) => ({
      id: String(item.id ?? ''),
      fromStateId: String(item.fromStateId ?? ''),
      toStateId: String(item.toStateId ?? ''),
      requiresJustification: Boolean(item.requiresJustification),
      requiredPermissionCode: item.requiredPermissionCode ?? null,
      allowed: Boolean(item.allowed)
    })) : [];
    return {
      organizationId: String(raw.organizationId ?? ''),
      selectedCaseTypeId: raw.selectedCaseTypeId ? String(raw.selectedCaseTypeId) : null,
      caseTypes: Array.isArray(raw.caseTypes) ? raw.caseTypes.map((item: Record<string, any>) => ({
        id: String(item.id ?? ''),
        code: String(item.code ?? ''),
        name: String(item.name ?? ''),
        caseCount: Number(item.caseCount ?? 0)
      })) : [],
      columns,
      transitions,
      generatedAt: raw.generatedAt ? String(raw.generatedAt) : undefined
    };
  },

  async moveCaseInWorkflow(input: MoveWorkflowCaseInput): Promise<MoveWorkflowCaseResult> {
    const client = requireClient();
    const resolvedCaseId = await resolveCaseDatabaseId(input.caseId);
    const { data, error } = await client.rpc('move_case_in_workflow', {
      p_case_id: resolvedCaseId,
      p_to_state_id: input.toStateId,
      p_expected_from_state_id: input.expectedFromStateId,
      p_justification: input.justification?.trim() || null
    });
    if (error) throw error;
    const raw = (data ?? {}) as Record<string, unknown>;
    return {
      caseId: String(raw.caseId ?? resolvedCaseId),
      stateId: String(raw.stateId ?? input.toStateId),
      stateName: String(raw.stateName ?? ''),
      updatedAt: raw.updatedAt ? String(raw.updatedAt) : undefined
    };
  },

  async listSubtasks(filters: SigcSubtaskFilters = {}): Promise<SigcSubtask[]> {
    const page = await this.searchSubtasks({ ...filters, page: 1, pageSize: Math.min(100, Math.max(5, filters.pageSize ?? 100)) });
    return page.items;
  },

  async searchSubtasks(filters: SigcSubtaskFilters = {}): Promise<SigcSubtaskPage> {
    const client = requireClient();
    const { data, error } = await client.rpc('search_sigc_subtasks_v4', {
      p_filters: {
        caseId: filters.caseId ?? '', query: filters.query ?? '', state: filters.state ?? '', responsibleUserId: filters.responsibleUserId ?? '',
        page: Math.max(1, filters.page ?? 1), pageSize: Math.min(100, Math.max(5, filters.pageSize ?? 25))
      }
    });
    if (error) throw error;
    const raw = (data ?? {}) as Record<string, unknown>;
    return { items: Array.isArray(raw.items) ? raw.items as SigcSubtask[] : [], total: Number(raw.total ?? 0), page: Number(raw.page ?? 1), pageSize: Number(raw.pageSize ?? 25) };
  },

  async createSubtask(input: CreateSubtaskInput): Promise<CreatedSubtaskResult> {
    const client = requireClient();
    const caseId = await resolveCaseDatabaseId(input.caseId);
    const { data, error } = await client.rpc('create_case_subtask_v2', {
      p_case_id: caseId,
      p_assignment_id: input.assignmentId || null,
      p_area_id: input.areaId || null,
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
    const { error } = await client.rpc('update_case_subtask_v2', {
      p_subtask_id: input.subtaskId,
      p_assignment_id: input.assignmentId || null,
      p_area_id: input.areaId || null,
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
    const page = await this.searchDocuments({ caseId, page: 1, pageSize: 100 });
    return page.items;
  },

  async searchDocuments(filters: SigcDocumentFilters = {}): Promise<SigcDocumentPage> {
    const client = requireClient();
    const { data, error } = await client.rpc('search_sigc_documents_v4', {
      p_filters: {
        caseId: filters.caseId ?? '', query: filters.query ?? '', category: filters.category ?? '', state: filters.state ?? '', clientVisibleOnly: Boolean(filters.clientVisibleOnly),
        page: Math.max(1, filters.page ?? 1), pageSize: Math.min(100, Math.max(5, filters.pageSize ?? 25))
      }
    });
    if (error) throw error;
    const raw = (data ?? {}) as Record<string, unknown>;
    return { items: Array.isArray(raw.items) ? raw.items as SigcDocument[] : [], total: Number(raw.total ?? 0), page: Number(raw.page ?? 1), pageSize: Number(raw.pageSize ?? 25) };
  },

  async listDocumentVersions(documentId: string): Promise<SigcDocumentVersion[]> {
    const client = requireClient();
    const { data, error } = await client
      .from('document_versions')
      .select('id,document_id,version_number,original_filename,storage_path,mime_type,size_bytes,checksum,change_notes,uploaded_by,created_at')
      .eq('document_id', documentId)
      .order('version_number', { ascending: false });
    if (error) throw error;
    const rows = data ?? [];
    const uploaderIds = [...new Set(rows.map((row) => row.uploaded_by).filter((id): id is string => Boolean(id)))];
    const profiles = uploaderIds.length ? await client.from('profiles').select('id,name').in('id', uploaderIds) : { data: [], error: null };
    if (profiles.error) throw profiles.error;
    const profileMap = new Map((profiles.data ?? []).map((row) => [row.id, row.name]));
    return rows.map((row) => ({
      id: row.id,
      documentId: row.document_id,
      versionNumber: row.version_number,
      originalFilename: row.original_filename,
      storagePath: row.storage_path,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      checksum: row.checksum,
      changeNotes: row.change_notes,
      uploadedBy: row.uploaded_by ?? undefined,
      uploadedByName: row.uploaded_by ? profileMap.get(row.uploaded_by) ?? 'Usuario' : 'Sistema',
      createdAt: row.created_at,
      createdLabel: formatDateTime(row.created_at)
    }));
  },

  async updateDocumentRetention(input: UpdateDocumentRetentionInput): Promise<void> {
    const client = requireClient();
    const { error } = await client.rpc('update_document_retention', {
      p_document_id: input.documentId,
      p_retention_until: input.retentionUntil || null,
      p_legal_hold: input.legalHold
    });
    if (error) throw error;
  },

  async setDocumentClientVisibility(documentId: string, isVisible: boolean): Promise<void> {
    const client = requireClient();
    const { error } = await client.rpc('set_document_client_visibility_v4', { p_document_id: documentId, p_is_visible: isVisible });
    if (error) throw error;
  },

  async uploadDocument(input: UploadCaseDocumentInput): Promise<SigcDocument> {
    validateInternalFile(input.file);
    const client = requireClient();
    const resolvedCaseId = await resolveCaseDatabaseId(input.caseId);
    const organizationId = await ensureOrganization();
    const documentId = crypto.randomUUID();
    const checksum = await sha256File(input.file);
    const path = `${organizationId}/${resolvedCaseId}/${documentId}/v1/${sanitizeFilename(input.file.name)}`;
    const { error: uploadError } = await client.storage.from('case-documents').upload(path, input.file, { upsert: false, contentType: input.file.type || undefined });
    if (uploadError) throw uploadError;

    const { error: registerError } = await client.rpc('register_case_document_v2', {
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
      p_checksum: checksum,
      p_subtask_id: input.subtaskId || null,
      p_comment_id: input.commentId || null
    });
    if (registerError) {
      await removeStoragePathQuietly(path);
      throw registerError;
    }

    const documents = await this.listDocuments(resolvedCaseId);
    const created = documents.find((document) => document.id === documentId);
    if (!created) throw new Error('El documento se registró correctamente, pero no fue posible refrescar su ficha. Recarga la vista.');
    return created;
  },

  async addDocumentVersion(input: AddDocumentVersionInput): Promise<void> {
    validateInternalFile(input.file);
    const client = requireClient();
    const resolvedCaseId = await resolveCaseDatabaseId(input.caseId);
    const organizationId = await ensureOrganization();
    const checksum = await sha256File(input.file);
    const nextVersion = input.currentVersion + 1;
    const path = `${organizationId}/${resolvedCaseId}/${input.documentId}/v${nextVersion}/${sanitizeFilename(input.file.name)}`;
    const { error: uploadError } = await client.storage.from('case-documents').upload(path, input.file, { upsert: false, contentType: input.file.type || undefined });
    if (uploadError) throw uploadError;

    const { error } = await client.rpc('add_case_document_version_v2', {
      p_document_id: input.documentId,
      p_expected_current_version: input.currentVersion,
      p_original_filename: input.file.name,
      p_storage_path: path,
      p_mime_type: input.file.type || '',
      p_size_bytes: input.file.size,
      p_change_notes: input.changeNotes ?? null,
      p_checksum: checksum
    });
    if (error) {
      await removeStoragePathQuietly(path);
      throw error;
    }
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

  async listCaseTimeline(caseId: string, page = 1, pageSize = 100): Promise<SigcTimelinePage> {
    const client = requireClient();
    const resolvedCaseId = await resolveCaseDatabaseId(caseId);
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(200, Math.max(20, pageSize));
    const { data, error } = await client.rpc('get_case_timeline_v2', {
      p_case_id: resolvedCaseId,
      p_page: safePage,
      p_page_size: safePageSize
    });
    if (error) throw error;
    const raw = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
    const rows = Array.isArray(raw.items) ? raw.items as Array<Record<string, unknown>> : [];
    const items = rows.map((row) => {
      const metadata = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata) ? row.metadata as Record<string, unknown> : {};
      const afterData = row.afterData && typeof row.afterData === 'object' && !Array.isArray(row.afterData) ? row.afterData as Record<string, unknown> : null;
      const presentation = eventPresentation(String(row.eventType ?? ''), metadata, afterData);
      return {
        id: String(row.id ?? ''),
        caseId: String(row.caseId ?? resolvedCaseId),
        eventType: String(row.eventType ?? ''),
        entityType: String(row.entityType ?? ''),
        title: presentation.title,
        description: presentation.description,
        actorId: row.actorUserId ? String(row.actorUserId) : undefined,
        actorName: String(row.actorName ?? 'Sistema'),
        createdAt: String(row.createdAt ?? ''),
        date: formatDateTime(String(row.createdAt ?? ''))
      } satisfies SigcTimelineEvent;
    });
    const total = Number(raw.total ?? items.length);
    return {
      items,
      total,
      page: Number(raw.page ?? safePage),
      pageSize: Number(raw.pageSize ?? safePageSize),
      hasMore: Boolean(raw.hasMore ?? (safePage * safePageSize < total))
    };
  },

  async getAuditEvents(filters: SigcAuditFilters): Promise<SigcAuditPage> {
    const client = requireClient();
    const { data, error } = await client.rpc('get_audit_events_v2', {
      p_filters: {
        query: filters.query?.trim() || null,
        eventType: filters.eventType || null,
        entityType: filters.entityType || null,
        actorUserId: filters.actorUserId || null,
        caseId: filters.caseId || null,
        dateFrom: filters.dateFrom || null,
        dateTo: filters.dateTo || null,
        page: Math.max(1, filters.page ?? 1),
        pageSize: Math.min(200, Math.max(20, filters.pageSize ?? 50)),
        sortDirection: filters.sortDirection ?? 'desc'
      }
    });
    if (error) throw error;
    const raw = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
    const rows = Array.isArray(raw.items) ? raw.items as Array<Record<string, unknown>> : [];
    return {
      items: rows.map((row) => ({
        id: Number(row.id ?? 0),
        organizationId: String(row.organizationId ?? ''),
        caseId: row.caseId ? String(row.caseId) : undefined,
        caseRadicado: row.caseRadicado ? String(row.caseRadicado) : undefined,
        actorUserId: row.actorUserId ? String(row.actorUserId) : undefined,
        actorName: String(row.actorName ?? 'Sistema'),
        actorEmail: row.actorEmail ? String(row.actorEmail) : undefined,
        eventType: String(row.eventType ?? ''),
        entityType: String(row.entityType ?? ''),
        entityId: String(row.entityId ?? ''),
        beforeData: row.beforeData && typeof row.beforeData === 'object' && !Array.isArray(row.beforeData) ? row.beforeData as Record<string, unknown> : null,
        afterData: row.afterData && typeof row.afterData === 'object' && !Array.isArray(row.afterData) ? row.afterData as Record<string, unknown> : null,
        metadata: row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata) ? row.metadata as Record<string, unknown> : {},
        ipAddress: row.ipAddress ? String(row.ipAddress) : null,
        userAgent: row.userAgent ? String(row.userAgent) : null,
        createdAt: String(row.createdAt ?? ''),
        createdLabel: formatDateTime(String(row.createdAt ?? ''))
      })),
      total: Number(raw.total ?? rows.length),
      page: Number(raw.page ?? filters.page ?? 1),
      pageSize: Number(raw.pageSize ?? filters.pageSize ?? 50)
    };
  },

  async listCaseSlaOverrides(caseId: string): Promise<SigcSlaOverride[]> {
    const client = requireClient();
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
    const client = requireClient();
    const resolvedCaseId = await resolveCaseDatabaseId(input.caseId);
    const { error } = await client.rpc('override_case_sla', {
      p_case_id: resolvedCaseId,
      p_new_due_at: new Date(input.newDueAt).toISOString(),
      p_justification: input.justification
    });
    if (error) throw error;
  },

  async listCaseReviews(caseId: string): Promise<SigcCaseReview[]> {
    const client = requireClient();
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
    const client = requireClient();
    const resolvedCaseId = await resolveCaseDatabaseId(input.caseId);
    const { error } = await client.rpc('submit_case_for_review_v2', {
      p_case_id: resolvedCaseId,
      p_reviewer_user_id: input.reviewerUserId || null,
      p_note: input.note || null
    });
    if (error) throw error;
  },

  async decideCaseReview(input: DecideCaseReviewInput): Promise<void> {
    const client = requireClient();
    const { error } = await client.rpc('decide_case_review_v2', {
      p_review_id: input.reviewId,
      p_decision: input.decision,
      p_comments: input.comments || null
    });
    if (error) throw error;
  },

  async listCaseDeliveries(caseId: string): Promise<SigcCaseDelivery[]> {
    const client = requireClient();
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
    const client = requireClient();
    const resolvedCaseId = await resolveCaseDatabaseId(input.caseId);
    const { error } = await client.rpc('register_case_delivery_v2', {
      p_case_id: resolvedCaseId,
      p_channel: input.channel,
      p_recipient: input.recipient,
      p_reference: input.reference || null,
      p_notes: input.notes || null
    });
    if (error) throw error;
  },

  async listCaseReminders(caseId: string): Promise<SigcCaseReminder[]> {
    const client = requireClient();
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
    const client = requireClient();
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
    const client = requireClient();
    const { data, error } = await client.rpc('get_user_management_context_v4');
    if (error) throw error;
    if (!data || typeof data !== 'object') throw new Error('No fue posible cargar la gestión de usuarios.');
    const snapshot = data as unknown as SigcUserManagementSnapshot;
    return {
      ...snapshot,
      members: (snapshot.members ?? []).map((member) => ({ ...member, areaIds: member.areaIds ?? [], coordinatorAreaIds: member.coordinatorAreaIds ?? [] }))
    };
  },

  async getAdminSnapshot(): Promise<SigcAdminSnapshot> {
    const client = requireClient();
    const organizationId = await ensureOrganization();
    const operationalCatalogs = await this.getCatalogs();
    const [areas, priorities, caseTypes, states, slaPolicies, holidays, permissions, roles, rolePermissions, memberships, profiles, memberAreas, caseTypeDefaultAreas, caseTypeStates, transitions, templates, reminderRules, automationRules, automationExecutions, automationDiagnostics] = await Promise.all([
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
      client.from('organization_member_areas').select('*').eq('organization_id', organizationId),
      client.from('case_type_default_areas').select('*').eq('organization_id', organizationId).order('sort_order'),
      client.from('case_type_states').select('*'),
      client.from('state_transitions').select('*').eq('organization_id', organizationId).order('created_at'),
      client.from('email_templates').select('*').eq('organization_id', organizationId).order('name'),
      client.from('reminder_rules').select('*').eq('organization_id', organizationId).order('offset_minutes', { ascending: false }),
      client.from('automation_rules').select('*').eq('organization_id', organizationId).order('sort_order'),
      client.from('automation_executions').select('*').eq('organization_id', organizationId).order('started_at', { ascending: false }).limit(100),
      client.rpc('analyze_automation_rules_v3')
    ]);
    const results = [areas, priorities, caseTypes, states, slaPolicies, holidays, permissions, roles, rolePermissions, memberships, profiles, memberAreas, caseTypeDefaultAreas, caseTypeStates, transitions, templates, reminderRules, automationRules, automationExecutions, automationDiagnostics];
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
      isTerminal: row.is_terminal == null ? undefined : Boolean(row.is_terminal),
      parentAreaId: row.parent_area_id ?? undefined,
      email: row.email ?? undefined,
      managerMembershipId: row.manager_membership_id ?? undefined,
      isPublicEnabled: row.is_public_enabled == null ? undefined : Boolean(row.is_public_enabled),
      isInternalEnabled: row.is_internal_enabled == null ? undefined : Boolean(row.is_internal_enabled),
      defaultPriorityId: row.default_priority_id ?? undefined,
      defaultRiskLevel: row.default_risk_level ?? undefined,
      responseTemplateId: row.response_template_id ?? undefined
    });
    const rolePermissionMap = new Map<string, string[]>();
    for (const row of rolePermissions.data ?? []) {
      rolePermissionMap.set(row.role_id, [...(rolePermissionMap.get(row.role_id) ?? []), row.permission_id]);
    }
    const profileMap = new Map<string, { name: string; email: string }>((profiles.data ?? []).map((row: any) => [row.id, { name: row.name, email: row.email }]));
    const roleMap = new Map<string, { name: string }>((roles.data ?? []).map((row: any) => [row.id, { name: row.name }]));
    const memberAreaMap = new Map<string, Array<{ areaId: string; isPrimary: boolean; isCoordinator: boolean }>>();
    for (const row of memberAreas.data ?? []) {
      const key = String(row.organization_member_id);
      memberAreaMap.set(key, [...(memberAreaMap.get(key) ?? []), { areaId: String(row.area_id), isPrimary: Boolean(row.is_primary), isCoordinator: Boolean(row.is_coordinator) }]);
    }
    const areaNameMap = new Map<string, string>((areas.data ?? []).map((row: any) => [String(row.id), String(row.name)]));
    const profileNameMap = new Map<string, string>((profiles.data ?? []).map((row: any) => [String(row.id), String(row.name)]));
    const defaultAreasByType = new Map<string, any[]>();
    for (const row of caseTypeDefaultAreas.data ?? []) {
      const key = String(row.case_type_id);
      const membership = row.default_responsible_membership_id ? (memberships.data ?? []).find((entry: any) => entry.id === row.default_responsible_membership_id) : null;
      defaultAreasByType.set(key, [...(defaultAreasByType.get(key) ?? []), {
        areaId: String(row.area_id),
        areaName: areaNameMap.get(String(row.area_id)) ?? 'Área',
        responsibleUserId: membership?.user_id ?? undefined,
        responsibleName: membership?.user_id ? profileNameMap.get(String(membership.user_id)) : undefined,
        isPrimary: Boolean(row.is_primary),
        sortOrder: Number(row.sort_order ?? 0)
      }]);
    }
    const caseTypeMap = new Map((caseTypes.data ?? []).map((row: any) => [row.id, row.name]));
    const stateMap = new Map((states.data ?? []).map((row: any) => [row.id, row]));
    const ruleMap = new Map((automationRules.data ?? []).map((row: any) => [row.id, row.name]));
    const executionCaseIds = [...new Set((automationExecutions.data ?? []).map((row: any) => row.case_id).filter(Boolean))] as string[];
    const executionCases = executionCaseIds.length
      ? await client.from('cases').select('id,radicado').eq('organization_id', organizationId).in('id', executionCaseIds)
      : { data: [], error: null };
    if (executionCases.error) throw executionCases.error;
    const caseMap = new Map((executionCases.data ?? []).map((row: any) => [row.id, row.radicado]));

    const workflows = (caseTypes.data ?? []).map((caseType: any) => {
      const workflowStates = (caseTypeStates.data ?? [])
        .filter((row: any) => row.case_type_id === caseType.id)
        .sort((a: any, b: any) => a.sort_order - b.sort_order)
        .map((row: any) => {
          const state = stateMap.get(row.state_id) as any;
          return {
            stateId: row.state_id,
            stateName: state?.name ?? 'Estado',
            stateCode: state?.code ?? '',
            stateColor: state?.color ?? null,
            isInitial: Boolean(state?.is_initial),
            isTerminal: Boolean(state?.is_terminal),
            sortOrder: row.sort_order,
            isRequired: Boolean(row.is_required)
          };
        });
      const workflowTransitions = (transitions.data ?? [])
        .filter((row: any) => row.case_type_id === caseType.id)
        .map((row: any) => ({ id: row.id, caseTypeId: row.case_type_id ?? undefined, fromStateId: row.from_state_id, toStateId: row.to_state_id, requiredPermissionCode: row.required_permission_code ?? undefined, requiresJustification: Boolean(row.requires_justification), isActive: Boolean(row.is_active) }));
      const stateIds = new Set(workflowStates.map((row: any) => row.stateId));
      const validationMessages: string[] = [];
      const initialCount = workflowStates.filter((row: any) => row.isInitial).length;
      const terminalCount = workflowStates.filter((row: any) => row.isTerminal).length;
      if (!workflowStates.length) validationMessages.push('El flujo debe contener al menos un estado.');
      if (initialCount !== 1) validationMessages.push('El flujo debe contener exactamente un estado inicial.');
      if (terminalCount < 1) validationMessages.push('El flujo debe contener al menos un estado terminal.');
      if (workflowTransitions.some((row: any) => row.fromStateId === row.toStateId)) validationMessages.push('No se permiten transiciones de un estado hacia sí mismo.');
      if (workflowTransitions.some((row: any) => !stateIds.has(row.fromStateId) || !stateIds.has(row.toStateId))) validationMessages.push('Existen transiciones que apuntan a estados fuera del flujo.');
      return {
        caseTypeId: caseType.id,
        caseTypeName: caseType.name,
        states: workflowStates,
        transitions: workflowTransitions,
        isValid: validationMessages.length === 0,
        validationMessages
      };
    });

    return {
      organizationId,
      configuration: operationalCatalogs.configuration,
      areas: (areas.data ?? []).map(mapCatalogItem),
      priorities: (priorities.data ?? []).map(mapCatalogItem),
      caseTypes: (caseTypes.data ?? []).map((row: any) => ({ ...mapCatalogItem(row), defaultAreas: defaultAreasByType.get(String(row.id)) ?? [] })),
      states: (states.data ?? []).map(mapCatalogItem),
      slaPolicies: (slaPolicies.data ?? []).map((row: any) => ({ id: row.id, caseTypeId: row.case_type_id ?? undefined, caseTypeName: row.case_type_id ? caseTypeMap.get(row.case_type_id) ?? 'Tipo de caso' : 'General', name: row.name, durationValue: row.duration_value, durationUnit: row.duration_unit, timezone: row.timezone ?? 'America/Bogota', pauseOnPendingInformation: Boolean(row.pause_on_pending_information), isDefault: Boolean(row.is_default), isActive: Boolean(row.is_active) })),
      holidays: (holidays.data ?? []).map((row: any) => ({ id: row.id, holidayDate: row.holiday_date, name: row.name, isActive: Boolean(row.is_active) })),
      permissions: (permissions.data ?? []).map((row: any) => ({ id: row.id, code: row.code, name: row.name, description: row.description ?? undefined })),
      roles: (roles.data ?? []).map((row: any) => ({ id: row.id, code: row.code, name: row.name, description: row.description ?? undefined, isSystem: Boolean(row.is_system), isActive: Boolean(row.is_active), permissionIds: rolePermissionMap.get(row.id) ?? [] })),
      members: (memberships.data ?? []).map((row: any) => { const profile = profileMap.get(row.user_id); const role = row.role_id ? roleMap.get(row.role_id) : null; const areaLinks = memberAreaMap.get(String(row.id)) ?? []; return { membershipId: row.id, userId: row.user_id, name: profile?.name ?? 'Usuario', email: profile?.email ?? '', roleId: row.role_id ?? undefined, roleName: role?.name ?? 'Sin rol', isActive: Boolean(row.is_active), areaIds: areaLinks.map((entry) => entry.areaId), primaryAreaId: areaLinks.find((entry) => entry.isPrimary)?.areaId, coordinatorAreaIds: areaLinks.filter((entry) => entry.isCoordinator).map((entry) => entry.areaId) }; }),
      workflows,
      emailTemplates: (templates.data ?? []).map((row: any) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        eventType: row.event_type ?? undefined,
        subject: row.subject,
        bodyText: row.body_text,
        bodyHtml: row.body_html ?? null,
        variableCodes: extractTemplateVariables(row.subject, row.body_text, row.body_html),
        isActive: Boolean(row.is_active)
      })),
      reminderRules: (reminderRules.data ?? []).map((row: any) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        triggerKind: row.trigger_kind,
        offsetMinutes: row.offset_minutes,
        includeManagers: Boolean(row.include_managers),
        messageTemplate: row.message_template ?? 'El caso {{radicado}} requiere seguimiento.',
        emailTemplateCode: row.email_template_code ?? undefined,
        isActive: Boolean(row.is_active)
      })),
      automationRules: (automationRules.data ?? []).map((row: any) => ({
        id: row.id, code: row.code, name: row.name, description: row.description ?? undefined,
        triggerEvent: row.trigger_event, conditions: (row.conditions ?? []) as AutomationCondition[],
        conditionMode: row.condition_mode === 'any' ? 'any' : 'all',
        actions: (row.actions ?? []) as AutomationAction[], stopOnError: Boolean(row.stop_on_error),
        stopProcessing: Boolean(row.stop_processing),
        sortOrder: Number(row.sort_order ?? 0), isActive: Boolean(row.is_active),
        lifecycleStatus: row.lifecycle_status === 'archived' ? 'archived' : row.lifecycle_status === 'draft' ? 'draft' : 'published',
        currentVersion: Number(row.current_version ?? 1), publishedVersion: row.published_version == null ? null : Number(row.published_version),
        publishedAt: row.published_at ?? null, archivedAt: row.archived_at ?? null,
        lastRunAt: row.last_run_at ?? undefined, runCount: Number(row.run_count ?? 0),
        maxAttempts: Number(row.max_attempts ?? 3), retryDelayMinutes: Number(row.retry_delay_minutes ?? 10)
      })),
      automationExecutions: (automationExecutions.data ?? []).map((row: any) => ({
        id: row.id, ruleId: row.rule_id, ruleName: ruleMap.get(row.rule_id) ?? 'Regla',
        caseId: row.case_id ?? undefined, caseRadicado: row.case_id ? caseMap.get(row.case_id) : undefined,
        triggerEvent: row.trigger_event, status: row.status, matched: Boolean(row.matched),
        actionsTotal: Number(row.actions_total ?? 0), actionsSucceeded: Number(row.actions_succeeded ?? 0),
        errorMessage: row.error_message ?? undefined,
        executionLog: Array.isArray(row.execution_log) ? row.execution_log : [],
        attemptCount: Number(row.attempt_count ?? 1), maxAttempts: Number(row.max_attempts ?? 3),
        nextRetryAt: row.next_retry_at ?? undefined, retryOfId: row.retry_of_id ?? undefined,
        startedAt: row.started_at, finishedAt: row.finished_at ?? undefined
      })),
      automationDiagnostics: Array.isArray(automationDiagnostics.data) ? automationDiagnostics.data as unknown as AutomationDiagnostic[] : []
    };
  },

  async saveAdminCatalog(input: SaveAdminCatalogInput): Promise<void> {
    const client = requireClient();
    const { error } = await client.rpc('save_admin_catalog_v3', {
      p_kind: input.kind,
      p_id: input.id || null,
      p_code: input.code,
      p_name: input.name,
      p_description: input.description || null,
      p_color: input.color || null,
      p_sort_order: input.sortOrder ?? 0,
      p_is_initial: Boolean(input.isInitial),
      p_is_terminal: Boolean(input.isTerminal),
      p_is_active: input.isActive ?? true,
      p_parent_area_id: input.parentAreaId || null,
      p_email: input.email?.trim() || null,
      p_manager_membership_id: input.managerMembershipId || null,
      p_is_public_enabled: input.isPublicEnabled ?? null,
      p_is_internal_enabled: input.isInternalEnabled ?? null,
      p_default_priority_id: input.defaultPriorityId || null,
      p_default_risk_level: input.defaultRiskLevel || null,
      p_response_template_id: input.responseTemplateId || null
    });
    if (error) throw error;
  },

  async setAdminCatalogActive(kind: SaveAdminCatalogInput['kind'], id: string, isActive: boolean): Promise<void> {
    const client = requireClient();
    const tableMap = { areas: 'areas', priorities: 'priorities', caseTypes: 'case_types', states: 'case_states' } as const;
    const { error } = await client.from(tableMap[kind]).update({ is_active: isActive }).eq('id', id);
    if (error) throw error;
  },

  async saveSlaPolicy(input: SaveSlaPolicyInput): Promise<void> {
    const client = requireClient();
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
    const client = requireClient();
    const organizationId = await ensureOrganization();
    const payload = { organization_id: organizationId, holiday_date: input.holidayDate, name: input.name.trim(), is_active: input.isActive };
    const result = input.id ? await client.from('organization_holidays').update(payload).eq('id', input.id) : await client.from('organization_holidays').insert(payload);
    if (result.error) throw result.error;
  },

  async deleteHoliday(id: string): Promise<void> {
    const client = requireClient();
    const { error } = await client.from('organization_holidays').delete().eq('id', id);
    if (error) throw error;
  },

  async saveRole(input: SaveRoleInput): Promise<string> {
    const client = requireClient();
    const organizationId = await ensureOrganization();
    const payload = { organization_id: organizationId, code: input.code.trim().toLowerCase(), name: input.name.trim(), description: input.description || null, is_active: input.isActive };
    const query = input.id ? client.from('roles').update(payload).eq('id', input.id).select('id').single() : client.from('roles').insert(payload).select('id').single();
    const { data, error } = await query;
    if (error) throw error;
    return data.id;
  },

  async setRolePermissions(roleId: string, permissionIds: string[]): Promise<void> {
    const client = requireClient();
    const { error } = await client.rpc('set_role_permissions', { p_role_id: roleId, p_permission_ids: permissionIds });
    if (error) throw error;
  },

  async setMemberRole(membershipId: string, roleId: string): Promise<void> {
    const client = requireClient();
    const { error } = await client.rpc('set_organization_member_role', { p_membership_id: membershipId, p_role_id: roleId });
    if (error) throw error;
  },

  async setMemberActive(membershipId: string, isActive: boolean): Promise<void> {
    const client = requireClient();
    const { error } = await client.rpc('set_organization_member_status_v4', { p_membership_id: membershipId, p_action: isActive ? 'activate' : 'deactivate' });
    if (error) throw error;
  },

  async removeMember(membershipId: string): Promise<void> {
    const client = requireClient();
    const { error } = await client.rpc('set_organization_member_status_v4', { p_membership_id: membershipId, p_action: 'remove' });
    if (error) throw error;
  },

  async saveWorkflowStates(caseTypeId: string, stateIds: string[]): Promise<void> {
    const client = requireClient();
    const { error } = await client.rpc('set_case_type_workflow_v2', { p_case_type_id: caseTypeId, p_state_ids: stateIds });
    if (error) throw error;
  },

  async saveTransition(input: SaveTransitionInput): Promise<void> {
    const client = requireClient();
    const { error } = await client.rpc('save_case_state_transition_v2', {
      p_transition_id: input.id || null,
      p_case_type_id: input.caseTypeId,
      p_from_state_id: input.fromStateId,
      p_to_state_id: input.toStateId,
      p_required_permission_code: input.requiredPermissionCode || null,
      p_requires_justification: input.requiresJustification,
      p_is_active: input.isActive
    });
    if (error) throw error;
  },

  async deleteTransition(id: string): Promise<void> {
    const client = requireClient();
    const { error } = await client.rpc('delete_case_state_transition', { p_transition_id: id });
    if (error) throw error;
  },

  async saveEmailTemplate(input: SaveEmailTemplateInput): Promise<void> {
    const client = requireClient();
    const organizationId = await ensureOrganization();
    const payload = {
      organization_id: organizationId,
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      event_type: input.eventType || null,
      subject: input.subject,
      body_text: input.bodyText,
      body_html: input.bodyHtml || null,
      is_active: input.isActive
    };
    const result = input.id ? await client.from('email_templates').update(payload).eq('id', input.id) : await client.from('email_templates').insert(payload);
    if (result.error) throw result.error;
  },

  async saveReminderRule(input: SaveReminderRuleInput): Promise<void> {
    const client = requireClient();
    const { error } = await client.rpc('save_reminder_rule_v2', {
      p_rule_id: input.id || null,
      p_code: input.code,
      p_name: input.name,
      p_trigger_kind: input.triggerKind,
      p_offset_minutes: input.offsetMinutes,
      p_include_managers: input.includeManagers,
      p_message_template: input.messageTemplate,
      p_email_template_code: input.emailTemplateCode || null,
      p_is_active: input.isActive
    });
    if (error) throw error;
  },

  async previewEmailTemplate(input: EmailTemplatePreviewInput): Promise<EmailTemplatePreview> {
    const client = requireClient();
    const resolvedCaseId = input.caseId ? await resolveCaseDatabaseId(input.caseId) : null;
    const { data, error } = await client.rpc('preview_email_template_v2', {
      p_template_id: input.templateId || null,
      p_subject: input.subject,
      p_body_text: input.bodyText,
      p_body_html: input.bodyHtml || null,
      p_case_id: resolvedCaseId
    });
    if (error) throw error;
    const raw = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
    return {
      subject: String(raw.subject ?? input.subject),
      bodyText: String(raw.bodyText ?? input.bodyText),
      bodyHtml: raw.bodyHtml ? String(raw.bodyHtml) : null,
      unresolvedVariables: Array.isArray(raw.unresolvedVariables) ? raw.unresolvedVariables.map(String) : []
    };
  },

  async sendTestEmail(input: SendTestEmailInput): Promise<void> {
    const client = requireClient();
    const resolvedCaseId = input.caseId ? await resolveCaseDatabaseId(input.caseId) : null;
    const { error } = await client.rpc('queue_test_email_v2', {
      p_recipient_email: input.recipientEmail,
      p_template_id: input.templateId || null,
      p_subject: input.subject,
      p_body_text: input.bodyText,
      p_body_html: input.bodyHtml || null,
      p_case_id: resolvedCaseId
    });
    if (error) throw error;
  },

  async runRuntimeNow(): Promise<RuntimeExecutionResult> {
    const client = requireClient();
    const { data, error } = await client.rpc('process_sigc_runtime_v2', { p_batch_size: 100 });
    if (error) throw error;
    const raw = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
    return {
      generatedAt: String(raw.generatedAt ?? new Date().toISOString()),
      remindersCreated: Number(raw.remindersCreated ?? 0),
      overdueNotificationsCreated: Number(raw.overdueNotificationsCreated ?? 0),
      emailsQueued: Number(raw.emailsQueued ?? 0),
      emailsDispatched: Number(raw.emailsDispatched ?? 0),
      emailsFailed: Number(raw.emailsFailed ?? 0)
    };
  },

  async saveAutomationRule(input: SaveAutomationRuleInput): Promise<void> {
    const client = requireClient();
    const { error } = await client.rpc('save_automation_rule_v3', {
      p_rule_id: input.id || null,
      p_code: input.code,
      p_name: input.name,
      p_description: input.description || null,
      p_trigger_event: input.triggerEvent,
      p_conditions: input.conditions as unknown as Json,
      p_condition_mode: input.conditionMode,
      p_actions: input.actions as unknown as Json,
      p_stop_on_error: input.stopOnError,
      p_stop_processing: input.stopProcessing,
      p_sort_order: input.sortOrder,
      p_max_attempts: input.maxAttempts,
      p_retry_delay_minutes: input.retryDelayMinutes
    });
    if (error) throw error;
  },

  async publishAutomationRule(id: string): Promise<void> {
    const client = requireClient();
    const { error } = await client.rpc('publish_automation_rule_v3', { p_rule_id: id });
    if (error) throw error;
  },

  async archiveAutomationRule(id: string): Promise<void> {
    const client = requireClient();
    const { error } = await client.rpc('archive_automation_rule_v3', { p_rule_id: id });
    if (error) throw error;
  },

  async restoreAutomationRuleVersion(id: string, versionNumber: number): Promise<void> {
    const client = requireClient();
    const { error } = await client.rpc('restore_automation_rule_version_v3', { p_rule_id: id, p_version_number: versionNumber });
    if (error) throw error;
  },

  async listAutomationRuleVersions(id: string): Promise<AutomationRuleVersion[]> {
    const client = requireClient();
    const { data, error } = await client.rpc('get_automation_rule_versions_v3', { p_rule_id: id });
    if (error) throw error;
    return Array.isArray(data) ? data as unknown as AutomationRuleVersion[] : [];
  },

  async dryRunAutomationRule(ruleId: string, caseId: string): Promise<AutomationDryRunResult> {
    const client = requireClient();
    const resolvedCaseId = await resolveCaseDatabaseId(caseId);
    const { data, error } = await client.rpc('preview_automation_rule_v3', { p_rule_id: ruleId, p_case_id: resolvedCaseId });
    if (error) throw error;
    if (!data || typeof data !== 'object') throw new Error('La simulación no devolvió un resultado válido.');
    return data as unknown as AutomationDryRunResult;
  },

  async toggleAutomationRule(id: string, isActive: boolean): Promise<void> {
    const client = requireClient();
    const { error } = await client.rpc('set_automation_rule_active_v3', { p_rule_id: id, p_is_active: isActive });
    if (error) throw error;
  },

  async runAutomationRule(ruleId: string, caseId: string): Promise<void> {
    const client = requireClient();
    const resolvedCaseId = await resolveCaseDatabaseId(caseId);
    const { error } = await client.rpc('execute_automation_rule_manual_v3', { p_rule_id: ruleId, p_case_id: resolvedCaseId });
    if (error) throw error;
  },

  async getAutomationRuntimeHealth(): Promise<AutomationRuntimeHealth> {
    const client = requireClient();
    const { data, error } = await client.rpc('get_automation_runtime_health');
    if (error) throw error;
    const raw = (data ?? {}) as Record<string, any>;
    return {
      organizationId: String(raw.organizationId ?? ''),
      generatedAt: String(raw.generatedAt ?? new Date().toISOString()),
      activeRules: Number(raw.activeRules ?? 0),
      executions24h: Number(raw.executions24h ?? 0),
      failedExecutions24h: Number(raw.failedExecutions24h ?? 0),
      pendingRetries: Number(raw.pendingRetries ?? 0),
      reminders24h: Number(raw.reminders24h ?? 0),
      queuedEmails: Number(raw.queuedEmails ?? 0),
      failedEmails: Number(raw.failedEmails ?? 0),
      oldestQueuedEmailAt: raw.oldestQueuedEmailAt ?? null
    };
  },

  async getDashboardAnalytics(): Promise<SigcDashboardAnalytics> {
    const client = requireClient();
    const { data, error } = await client.rpc('get_sigc_dashboard_v3');
    if (error) throw error;
    return data as unknown as SigcDashboardAnalytics;
  },

  async getSidebarSummary(): Promise<SigcSidebarSummary> {
    const client = requireClient();
    const { data, error } = await client.rpc('get_sigc_sidebar_summary_v4');
    if (error) throw error;
    return data as unknown as SigcSidebarSummary;
  },

  async getNotificationPage(page = 1, pageSize = 25): Promise<SigcNotificationPage> {
    const client = requireClient();
    const { data, error } = await client.rpc('get_notification_page_v4', { p_page: Math.max(1, page), p_page_size: Math.min(100, Math.max(5, pageSize)) });
    if (error) throw error;
    return data as unknown as SigcNotificationPage;
  },

  async getAgenda(from: string, to: string): Promise<SigcAgendaSnapshot> {
    const client = requireClient();
    const { data, error } = await client.rpc('get_sigc_agenda', { p_from: from, p_to: to });
    if (error) throw error;
    if (!data || typeof data !== 'object') throw new Error('La agenda SIGC no devolvió un resultado válido.');
    const raw = data as Record<string, any>;
    const items: SigcAgendaItem[] = Array.isArray(raw.items) ? raw.items.map((item: Record<string, any>) => ({
      id: String(item.id ?? ''),
      kind: item.kind as SigcAgendaItem['kind'],
      caseId: String(item.caseId ?? ''),
      caseRadicado: String(item.caseRadicado ?? 'Caso'),
      caseSubject: String(item.caseSubject ?? ''),
      title: String(item.title ?? 'Actividad'),
      description: String(item.description ?? ''),
      scheduledAt: String(item.scheduledAt ?? ''),
      dateKey: String(item.dateKey ?? ''),
      state: String(item.state ?? ''),
      priority: String(item.priority ?? 'Media'),
      owner: String(item.owner ?? 'Sin responsable'),
      area: String(item.area ?? 'Sin área'),
      progress: Number(item.progress ?? 0),
      completed: Boolean(item.completed),
      overdue: Boolean(item.overdue),
      actionUrl: String(item.actionUrl ?? `/cases/${item.caseId ?? ''}`),
      metadata: item.metadata && typeof item.metadata === 'object' ? item.metadata : {}
    })) : [];
    return {
      organizationId: String(raw.organizationId ?? ''),
      timezone: String(raw.timezone ?? 'America/Bogota'),
      from: String(raw.from ?? from),
      to: String(raw.to ?? to),
      summary: {
        total: Number(raw.summary?.total ?? items.length),
        overdue: Number(raw.summary?.overdue ?? items.filter((item) => item.overdue).length),
        dueToday: Number(raw.summary?.dueToday ?? 0),
        next7Days: Number(raw.summary?.next7Days ?? 0),
        pendingReviews: Number(raw.summary?.pendingReviews ?? items.filter((item) => item.kind === 'review_pending').length)
      },
      items
    };
  },

  async getReport(filters: SigcReportFilters, page = filters.page ?? 1, pageSize = filters.pageSize ?? 100): Promise<SigcReportResult> {
    const client = requireClient();
    const from = new Date(`${filters.from}T00:00:00`).toISOString();
    const to = new Date(`${filters.to}T00:00:00`);
    to.setDate(to.getDate() + 1);
    const payload = {
      stateId: filters.stateId ?? '', areaId: filters.areaId ?? '', ownerId: filters.ownerId ?? '',
      caseTypeId: filters.caseTypeId ?? '', priorityId: filters.priorityId ?? '', overdueOnly: Boolean(filters.overdueOnly)
    };
    const { data, error } = await client.rpc('get_sigc_report_v3', {
      p_from: from, p_to: to.toISOString(), p_filters: payload,
      p_page: Math.max(1, page), p_page_size: Math.min(500, Math.max(10, pageSize))
    });
    if (error) throw error;
    const result = (data ?? {}) as Record<string, any>;
    const rows: SigcReportRow[] = (Array.isArray(result.rows) ? result.rows : []).map((row: any) => ({
      id: row.id, radicado: row.radicado, subject: row.subject, requesterName: row.requesterName ?? row.requester_name ?? '',
      requesterCompany: row.requesterCompany ?? row.requester_company ?? '', source: row.source ?? '', riskLevel: row.riskLevel ?? row.risk_level ?? undefined,
      openedAt: row.openedAt ?? row.opened_at, dueAt: row.dueAt ?? row.due_at ?? null, closedAt: row.closedAt ?? row.closed_at ?? null,
      progress: Number(row.progress ?? 0), updatedAt: row.updatedAt ?? row.updated_at,
      caseType: row.caseType ?? row.case_type ?? 'Sin clasificar', state: row.state ?? 'Sin estado', priority: row.priority ?? 'Sin prioridad',
      area: row.area ?? 'Sin área', owner: row.owner ?? 'Sin responsable', overdue: Boolean(row.overdue),
      slaMet: row.slaMet ?? row.sla_met ?? null, resolutionHours: (row.resolutionHours ?? row.resolution_hours) == null ? null : Number(row.resolutionHours ?? row.resolution_hours)
    }));
    return {
      organizationId: String(result.organizationId ?? ''), generatedAt: String(result.generatedAt ?? new Date().toISOString()),
      from: String(result.from ?? filters.from), to: String(result.to ?? filters.to), summary: result.summary,
      byArea: result.byArea ?? [], byOwner: result.byOwner ?? [], byType: result.byType ?? [], byState: result.byState ?? [],
      byPriority: result.byPriority ?? [], byRisk: result.byRisk ?? [], agingBuckets: result.agingBuckets ?? [],
      slaByArea: result.slaByArea ?? [], throughput: result.throughput ?? [], rows,
      totalRows: Number(result.totalRows ?? rows.length), page: Number(result.page ?? page), pageSize: Number(result.pageSize ?? pageSize),
      hasMore: Boolean(result.hasMore), isTruncated: false
    };
  },

  async createReportExportJob(format: SigcReportExportFormat, filters: SigcReportFilters): Promise<SigcReportExportJob> {
    const client = requireClient();
    const { data, error } = await client.rpc('create_report_export_job_v3', {
      p_format: format, p_from: filters.from, p_to: filters.to,
      p_filters: { stateId: filters.stateId ?? '', areaId: filters.areaId ?? '', ownerId: filters.ownerId ?? '', caseTypeId: filters.caseTypeId ?? '', priorityId: filters.priorityId ?? '', overdueOnly: Boolean(filters.overdueOnly) }
    });
    if (error) throw error;
    return data as unknown as SigcReportExportJob;
  },

  async getReportExportPage(jobId: string, page: number, pageSize: number): Promise<SigcReportExportPage> {
    const client = requireClient();
    const { data, error } = await client.rpc('get_report_export_page_v3', { p_job_id: jobId, p_page: page, p_page_size: pageSize });
    if (error) throw error;
    return data as unknown as SigcReportExportPage;
  },

  async completeReportExportJob(jobId: string, status: 'completed' | 'failed' | 'cancelled', errorMessage?: string): Promise<void> {
    const client = requireClient();
    const { error } = await client.rpc('complete_report_export_job_v3', { p_job_id: jobId, p_status: status, p_error_message: errorMessage ?? null });
    if (error) throw error;
  },

  async getSaasContext(): Promise<SigcSaasContext> {
    const client = requireClient();
    const { data, error } = await client.rpc('get_saas_context');
    if (error) throw error;
    return data as unknown as SigcSaasContext;
  },

  async getSecurityHealth(): Promise<SigcSecurityHealth> {
    const client = requireClient();
    const { data, error } = await client.rpc('get_security_health_v4');
    if (error) throw error;
    return data as unknown as SigcSecurityHealth;
  },

  async getClientPortal(page = 1, pageSize = 10, query = ''): Promise<ClientPortalSnapshot> {
    const client = requireClient();
    const { data, error } = await client.rpc('get_client_portal_v4', { p_page: Math.max(1, page), p_page_size: Math.min(50, Math.max(5, pageSize)), p_query: query.trim() });
    if (error) throw error;
    return data as unknown as ClientPortalSnapshot;
  },

  async getAuthorizationContext(): Promise<SigcAuthorizationContext> {
    const client = requireClient();
    const { data, error } = await client.rpc('get_authorization_context');
    if (error) throw error;
    if (!data || typeof data !== 'object') throw new Error('No fue posible resolver el contexto de autorización.');
    return data as unknown as SigcAuthorizationContext;
  },

  async setActiveOrganization(organizationId: string): Promise<void> {
    const client = requireClient();
    const { error } = await client.rpc('set_active_organization', { p_organization_id: organizationId });
    if (error) throw error;
  },

  async updateOrganizationProfile(input: UpdateOrganizationProfileInput): Promise<void> {
    const client = requireClient();
    const { error } = await client.rpc('update_organization_profile', {
      p_name: input.name, p_slug: input.slug, p_product_name: input.productName, p_short_name: input.shortName,
      p_logo_url: input.logoUrl ?? null, p_primary_color: input.primaryColor, p_accent_color: input.accentColor,
      p_sidebar_color: input.sidebarColor, p_support_email: input.supportEmail ?? null, p_custom_domain: input.customDomain ?? null
    });
    if (error) throw error;
  },

  async updatePublicIntakeSettings(input: UpdatePublicIntakeSettingsInput): Promise<void> {
    const client = requireClient();
    const { error } = await client.rpc('update_public_intake_settings_v4', {
      p_enabled: input.enabled,
      p_form_title: input.formTitle,
      p_form_description: input.formDescription,
      p_confirmation_message: input.confirmationMessage,
      p_allow_attachments: input.allowAttachments,
      p_max_files: input.maxFiles,
      p_max_file_size_bytes: input.maxFileSizeBytes,
      p_rate_limit_per_hour: input.rateLimitPerHour ?? 20,
      p_challenge_mode: input.challengeMode ?? 'adaptive',
      p_challenge_threshold: input.challengeThreshold ?? 5,
      p_require_privacy_consent: input.requirePrivacyConsent ?? true,
      p_privacy_notice_text: input.privacyNoticeText ?? 'Autorizo el tratamiento de mis datos para gestionar esta solicitud.',
      p_privacy_policy_url: input.privacyPolicyUrl?.trim() || null
    });
    if (error) throw error;
  },

  async createSaasOrganization(input: CreateSaasOrganizationInput): Promise<string> {
    const client = requireClient();
    const { data, error } = await client.rpc('create_saas_organization', { p_name: input.name, p_slug: input.slug });
    if (error) throw error;
    return String(data);
  },

  async createOrganizationInvitation(input: CreateOrganizationInvitationInput): Promise<CreatedOrganizationInvitation> {
    const client = requireClient();
    const { data, error } = await client.rpc('create_organization_invitation', { p_email: input.email, p_role_id: input.roleId, p_expires_days: input.expiresDays ?? 7 });
    if (error) throw error;
    const row = data?.[0];
    if (!row) throw new Error('No fue posible crear la invitación.');
    return { invitationId: row.invitation_id, token: row.token, expiresAt: row.expires_at };
  },

  async revokeOrganizationInvitation(invitationId: string): Promise<void> {
    const client = requireClient();
    const { error } = await client.rpc('revoke_organization_invitation', { p_invitation_id: invitationId });
    if (error) throw error;
  },

  async logClientError(input: ClientErrorInput): Promise<void> {
    const client = requireClient();
    const { error } = await client.rpc('log_client_error', {
      p_message: input.message, p_stack: input.stack ?? null, p_route: input.route ?? null,
      p_severity: input.severity ?? 'error', p_metadata: (input.metadata ?? {}) as unknown as import('../../../types/supabase').Json
    });
    if (error) console.warn('No fue posible registrar el error de cliente:', error);
  },

  async getQualityDashboard(): Promise<QualityDashboard> {
    const client = requireClient();
    const { data, error } = await client.rpc('get_sigc_quality_dashboard_v5');
    if (error) throw error;
    return data as unknown as QualityDashboard;
  },

  async runQualitySuite(input: RunQualitySuiteInput): Promise<QualityRunRecord> {
    const client = requireClient();
    const { data, error } = await client.rpc('run_sigc_quality_suite_v5', {
      p_client_checks: input.clientChecks as unknown as import('../../../types/supabase').Json,
      p_release_version: input.releaseVersion?.trim() || null
    });
    if (error) throw error;
    return data as unknown as QualityRunRecord;
  }
};

export const supabasePublicSigcRepository: PublicSigcRepository = {
  async getPublicIntakeContext(locator: PublicIntakeLocator): Promise<PublicIntakeContext | null> {
    const client = requireClient();
    const { data, error } = await client.rpc('get_public_intake_context_v5', {
      p_tenant: locator.tenant?.trim() || null,
      p_hostname: locator.hostname?.trim() || null
    });
    if (error) throw error;
    if (!data || typeof data !== 'object') return null;
    const raw = data as any;
    return {
      organizationName: String(raw.organizationName ?? ''),
      organizationSlug: String(raw.organizationSlug ?? ''),
      branding: {
        productName: String(raw.branding?.productName ?? 'SIGC'),
        shortName: String(raw.branding?.shortName ?? 'SIGC'),
        logoUrl: raw.branding?.logoUrl ?? null,
        primaryColor: String(raw.branding?.primaryColor ?? '#7c3aed'),
        accentColor: String(raw.branding?.accentColor ?? '#f97316'),
        supportEmail: raw.branding?.supportEmail ?? null,
        customDomain: raw.branding?.customDomain ?? null
      },
      intake: {
        enabled: Boolean(raw.intake?.enabled),
        formTitle: String(raw.intake?.formTitle ?? 'Radica tu solicitud'),
        formDescription: String(raw.intake?.formDescription ?? 'Completa la información para crear tu caso.'),
        confirmationMessage: String(raw.intake?.confirmationMessage ?? 'Hemos recibido tu solicitud correctamente.'),
        allowAttachments: Boolean(raw.intake?.allowAttachments),
        maxFiles: Number(raw.intake?.maxFiles ?? 5),
        maxFileSizeBytes: Number(raw.intake?.maxFileSizeBytes ?? 26214400)
      },
      security: {
        rateLimitPerHour: Number(raw.security?.rateLimitPerHour ?? 20),
        challengeMode: raw.security?.challengeMode === 'always' ? 'always' : raw.security?.challengeMode === 'off' ? 'off' : 'adaptive',
        challengeRequired: Boolean(raw.security?.challengeRequired),
        challenge: raw.security?.challenge ? { id: String(raw.security.challenge.id), prompt: String(raw.security.challenge.prompt), expiresAt: String(raw.security.challenge.expiresAt) } : null
      },
      privacy: {
        requireConsent: Boolean(raw.privacy?.requireConsent ?? true),
        noticeText: String(raw.privacy?.noticeText ?? 'Autorizo el tratamiento de mis datos para gestionar esta solicitud.'),
        policyUrl: raw.privacy?.policyUrl ?? null
      },
      caseTypes: Array.isArray(raw.caseTypes) ? raw.caseTypes.map((item: any) => ({
        id: String(item.id),
        name: String(item.name),
        description: item.description ?? null,
        slaLabel: String(item.slaLabel ?? 'Sin SLA configurado')
      })) : []
    };
  },

  async createPublicCase(input: PublicCaseCreateInput): Promise<PublicCaseSubmissionResult> {
    const client = requireClient();
    const { data, error } = await client.rpc('submit_public_case_v5', {
      p_tenant: input.tenant?.trim() || null,
      p_hostname: input.hostname?.trim() || null,
      p_case_type_id: input.caseTypeId,
      p_requester_name: input.requesterName,
      p_requester_company: input.requesterCompany,
      p_requester_document: input.requesterDocument,
      p_requester_email: input.requesterEmail,
      p_requester_phone: input.requesterPhone,
      p_subject: input.subject,
      p_description: input.description,
      p_website: input.website ?? null,
      p_attachment_count: input.attachments?.length ?? 0,
      p_privacy_consent: input.privacyConsent,
      p_challenge_id: input.challengeId || null,
      p_challenge_answer: input.challengeAnswer?.trim() || null
    });
    if (error) throw error;
    const created = data?.[0];
    if (!created) throw new Error('No fue posible confirmar la radicación.');

    const failedAttachments: string[] = [];
    let attachmentCount = 0;
    const attachments = input.attachments ?? [];
    const uploadToken = created.upload_token ? String(created.upload_token) : '';
    const uploadPrefix = created.upload_path_prefix ? String(created.upload_path_prefix) : '';

    if (attachments.length && uploadToken && uploadPrefix) {
      for (const file of attachments) {
        const path = `${uploadPrefix}/${crypto.randomUUID()}-${sanitizeFilename(file.name)}`;
        const { error: uploadError } = await client.storage.from('case-documents').upload(path, file, {
          upsert: false,
          contentType: file.type || undefined
        });
        if (uploadError) { failedAttachments.push(file.name); continue; }

        const { error: registerError } = await client.rpc('register_public_case_attachment', {
          p_upload_token: uploadToken,
          p_storage_path: path,
          p_original_filename: file.name,
          p_mime_type: file.type || null,
          p_size_bytes: file.size
        });
        if (registerError) {
          await removeStoragePathQuietly(path);
          failedAttachments.push(file.name);
          continue;
        }
        attachmentCount += 1;
      }
    }

    let attachmentSessionFinalized = !attachments.length;
    let attachmentFinalizeError: string | undefined;
    if (attachments.length && uploadToken) {
      const { error: finalizeError } = await client.rpc('finalize_public_case_upload', { p_upload_token: uploadToken });
      attachmentSessionFinalized = !finalizeError;
      attachmentFinalizeError = finalizeError?.message;
    }

    return {
      caseId: String(created.case_id),
      radicado: String(created.radicado),
      dueAt: created.due_at ?? null,
      attachmentCount,
      failedAttachments,
      attachmentSessionFinalized,
      attachmentFinalizeError
    };
  },

  async getOrganizationInvitation(token: string): Promise<PublicOrganizationInvitation | null> {
    const client = requireClient();
    const { data, error } = await client.rpc('get_organization_invitation', { p_token: token });
    if (error) throw error;
    const row = data?.[0];
    if (!row) return null;
    return { organizationName: row.organization_name, organizationSlug: row.organization_slug, email: row.email, roleName: row.role_name, status: row.status as PublicOrganizationInvitation['status'], expiresAt: row.expires_at };
  },

  async acceptOrganizationInvitation(token: string): Promise<string> {
    const client = requireClient();
    const { data, error } = await client.rpc('accept_organization_invitation', { p_token: token });
    if (error) throw error;
    return String(data);
  }
};
