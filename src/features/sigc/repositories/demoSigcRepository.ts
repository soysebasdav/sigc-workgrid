import { demoCases, demoDocuments, demoSubtasks, demoTimeline } from '../demoData';
import type {
  AddCommentInput,
  AddDocumentVersionInput,
  AllowedCaseState,
  CaseAssignmentInput,
  ClassifyCaseInput,
  UpdateCaseAssignmentInput,
  DeactivateCaseAssignmentInput,
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
  SigcAssignment,
  SigcCase,
  SigcCaseFilters,
  SigcCasePage,
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
  SaveCaseTypeConfigurationInput,
  SaveMemberAreaConfigurationInput,
  SaveSlaPolicyInput,
  SaveHolidayInput,
  SaveRoleInput,
  SaveTransitionInput,
  SaveEmailTemplateInput,
  SaveReminderRuleInput,
  SaveAutomationRuleInput,
  AutomationRuleVersion,
  AutomationDryRunResult,
  SigcDashboardAnalytics,
  SigcReportFilters,
  SigcReportResult,
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
  MoveWorkflowCaseInput,
  MoveWorkflowCaseResult,
  AutomationRuntimeHealth,
  QualityDashboard,
  RunQualitySuiteInput,
  QualityRunRecord
} from '../domain/types';
import type { PublicSigcRepository, SigcRepository } from './types';
import { buildCanonicalFilename, inferFileMimeType, validateFileForUpload } from '../utils/filePolicy';

const CASES_KEY = 'sigc_phase2_demo_cases';
const ASSIGNMENTS_KEY = 'sigc_phase2_demo_assignments';
const SUBTASKS_KEY = 'sigc_phase3_demo_subtasks';
const COMMENTS_KEY = 'sigc_phase3_demo_comments';
const DOCUMENTS_KEY = 'sigc_phase3_demo_documents';
const TIMELINE_KEY = 'sigc_phase3_demo_timeline';
const DOCUMENT_VERSIONS_KEY = 'sigc_phase6_demo_document_versions';
const SLA_OVERRIDES_KEY = 'sigc_phase4_demo_sla_overrides';
const REVIEWS_KEY = 'sigc_phase4_demo_reviews';
const DELIVERIES_KEY = 'sigc_phase4_demo_deliveries';
const REMINDERS_KEY = 'sigc_phase4_demo_reminders';
const demoReportExportJobs = new Map<string, { format: SigcReportExportFormat; filters: SigcReportFilters; createdAt: string }>();
const QUALITY_RUNS_KEY = 'sigc_phase12_demo_quality_runs';
const ORGANIZATION_PROFILE_KEY = 'sigc_phase8_demo_organization_profile';
const PUBLIC_INTAKE_SETTINGS_KEY = 'sigc_phase12_demo_public_intake_settings';

const DEFAULT_ORGANIZATION_PROFILE: UpdateOrganizationProfileInput = {
  name: 'Organización SIGC',
  slug: 'organizacion-sigc',
  productName: 'SIGC',
  shortName: 'SIGC',
  logoUrl: null,
  primaryColor: '#7c3aed',
  accentColor: '#f97316',
  sidebarColor: '#111827',
  supportEmail: 'soporte@sigc.demo',
  customDomain: null
};

const DEFAULT_PUBLIC_INTAKE_SETTINGS: UpdatePublicIntakeSettingsInput = {
  enabled: true,
  formTitle: 'Radica tu solicitud',
  formDescription: 'Completa la información para crear tu caso.',
  confirmationMessage: 'Hemos recibido tu solicitud correctamente.',
  allowAttachments: true,
  maxFiles: 5,
  maxFileSizeBytes: 26214400,
  rateLimitPerHour: 20,
  challengeMode: 'adaptive',
  challengeThreshold: 5,
  requirePrivacyConsent: true,
  privacyNoticeText: 'Autorizo el tratamiento de los datos suministrados para gestionar esta solicitud.',
  privacyPolicyUrl: ''
};

const demoAreas = ['Gerencia', 'Nómina', 'Talento Humano', 'Operaciones', 'SDG', 'Comercial', 'Administrativa y Financiera', 'Tecnología', 'Marketing y Telecomunicaciones', 'Jurídica']
  .map((name, index) => ({ id: `demo-area-${index + 1}`, name, code: `AREA_${index + 1}`, color: ['#5b21b6','#db2777','#2563eb','#ea580c','#0891b2','#059669','#d97706','#e11d48','#0f766e','#7c3aed'][index] ?? '#64748b', sortOrder: index * 10, isActive: true }));

const demoPriorities = ['Urgente', 'Alta', 'Media', 'Baja']
  .map((name, index) => ({ id: `demo-priority-${index + 1}`, name, code: ['URGENT','HIGH','MEDIUM','LOW'][index], color: ['#dc2626','#ea580c','#ca8a04','#059669'][index] ?? '#64748b', sortOrder: index * 10, isActive: true }));

const publicCaseTypeNames = new Set(['Derecho de Petición', 'Queja', 'Reclamo', 'Sugerencia', 'Felicitación', 'Requerimiento de Autoridad', 'Solicitud de documentos', 'Otros']);
const demoCaseTypeNames = ['Derecho de Petición', 'Queja', 'Reclamo', 'Sugerencia', 'Felicitación', 'Requerimiento de Autoridad', 'Solicitud de documentos', 'Contrato', 'Acción de Tutela', 'Requerimiento Interno', 'Requerimiento Externo', 'Proceso Judicial', 'Revisión de Procesos', 'Otros'];
const demoCaseTypes = demoCaseTypeNames.map((name, index) => {
  const publicEnabled = publicCaseTypeNames.has(name);
  const juridica = demoAreas.find((area) => area.name === 'Jurídica');
  return {
    id: `demo-type-${index + 1}`,
    name,
    code: `TYPE_${index + 1}`,
    color: '#6366f1',
    sortOrder: index * 10,
    isActive: true,
    isPublicEnabled: publicEnabled,
    isInternalEnabled: true,
    defaultPriorityId: name === 'Acción de Tutela' ? demoPriorities[0].id : demoPriorities[2].id,
    defaultRiskLevel: name === 'Acción de Tutela' ? 'Crítico' : 'Medio',
    slaPolicyId: `demo-sla-${index}`,
    slaLabel: name === 'Acción de Tutela' ? '24 horas' : '5 días calendario',
    defaultAreas: juridica && ['Derecho de Petición', 'Requerimiento de Autoridad', 'Acción de Tutela', 'Proceso Judicial'].includes(name)
      ? [{ areaId: juridica.id, areaName: juridica.name, isPrimary: true, sortOrder: 0 }]
      : []
  };
});

const demoStates = ['Pendiente de Clasificación', 'Clasificado', 'Asignado', 'En Gestión', 'Pendiente de Información', 'Respuesta Elaborada', 'En Revisión / Aprobación', 'Devuelto para Ajustes', 'Aprobado', 'Enviado', 'Cerrado', 'Cancelado']
  .map((name, index) => ({ id: `demo-state-${index + 1}`, name, code: ['PENDING_CLASSIFICATION','CLASSIFIED','ASSIGNED','IN_PROGRESS','PENDING_INFORMATION','RESPONSE_READY','IN_REVIEW','RETURNED_FOR_ADJUSTMENTS','APPROVED','SENT','CLOSED','CANCELLED'][index] ?? `STATE_${index + 1}`, color: ['#64748b','#4f46e5','#2563eb','#0891b2','#ca8a04','#7c3aed','#9333ea','#ea580c','#059669','#0f766e','#16a34a','#dc2626'][index] ?? '#64748b', sortOrder: index * 10, isActive: true }));

const catalogs: SigcCatalogs = {
  organizationId: null,
  areas: demoAreas,
  caseTypes: demoCaseTypes,
  states: demoStates,
  priorities: demoPriorities,
  roles: ['Administrador', 'Director', 'Coordinador', 'Analista', 'Consulta', 'Cliente Externo']
    .map((name, index) => ({ id: `demo-role-${index + 1}`, name, isActive: true })),
  configuration: {
    readyForManual: true,
    readyForPublic: true,
    publicIntakeEnabled: true,
    issues: [],
    counts: { areas: demoAreas.length, priorities: demoPriorities.length, states: demoStates.length, internalCaseTypes: demoCaseTypes.length, publicCaseTypes: demoCaseTypes.filter((item) => item.isPublicEnabled).length, caseTypesWithoutSla: 0, caseTypesWithoutWorkflow: 0 }
  }
};

const members: SigcMember[] = [
  { membershipId: 'demo-membership-1', userId: 'demo-user-1', name: 'Laura Méndez', email: 'laura@sigc.demo', roleName: 'Coordinador', permissionCodes: ['case.approve','case.review'], areaIds: [demoAreas[9].id], primaryAreaId: demoAreas[9].id, coordinatorAreaIds: [demoAreas[9].id] },
  { membershipId: 'demo-membership-2', userId: 'demo-user-2', name: 'Felipe Vargas', email: 'felipe@sigc.demo', roleName: 'Analista', permissionCodes: ['case.review'], areaIds: [demoAreas[3].id], primaryAreaId: demoAreas[3].id, coordinatorAreaIds: [] },
  { membershipId: 'demo-membership-3', userId: 'demo-user-3', name: 'Mónica Díaz', email: 'monica@sigc.demo', roleName: 'Analista', permissionCodes: ['case.review'], areaIds: [demoAreas[2].id], primaryAreaId: demoAreas[2].id, coordinatorAreaIds: [] },
  { membershipId: 'demo-membership-4', userId: 'demo-user-4', name: 'Natalia Bernal', email: 'natalia@sigc.demo', roleName: 'Analista', permissionCodes: ['case.review'], areaIds: [demoAreas[6].id], primaryAreaId: demoAreas[6].id, coordinatorAreaIds: [] },
  { membershipId: 'demo-membership-5', userId: 'demo-user-5', name: 'Julián Pérez', email: 'julian@sigc.demo', roleName: 'Analista', permissionCodes: ['case.review'], areaIds: [demoAreas[7].id], primaryAreaId: demoAreas[7].id, coordinatorAreaIds: [] }
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

function readDemoOrganizationProfile(): UpdateOrganizationProfileInput {
  const saved = readJson<Partial<UpdateOrganizationProfileInput>>(ORGANIZATION_PROFILE_KEY, {});
  return {
    ...DEFAULT_ORGANIZATION_PROFILE,
    ...saved,
    name: String(saved.name ?? DEFAULT_ORGANIZATION_PROFILE.name).trim() || DEFAULT_ORGANIZATION_PROFILE.name,
    slug: String(saved.slug ?? DEFAULT_ORGANIZATION_PROFILE.slug).trim() || DEFAULT_ORGANIZATION_PROFILE.slug,
    productName: String(saved.productName ?? DEFAULT_ORGANIZATION_PROFILE.productName).trim() || DEFAULT_ORGANIZATION_PROFILE.productName,
    shortName: String(saved.shortName ?? DEFAULT_ORGANIZATION_PROFILE.shortName).trim().slice(0, 12) || DEFAULT_ORGANIZATION_PROFILE.shortName,
    logoUrl: String(saved.logoUrl ?? '').trim() || null,
    primaryColor: /^#[0-9a-f]{6}$/i.test(String(saved.primaryColor ?? '')) ? String(saved.primaryColor) : DEFAULT_ORGANIZATION_PROFILE.primaryColor,
    accentColor: /^#[0-9a-f]{6}$/i.test(String(saved.accentColor ?? '')) ? String(saved.accentColor) : DEFAULT_ORGANIZATION_PROFILE.accentColor,
    sidebarColor: /^#[0-9a-f]{6}$/i.test(String(saved.sidebarColor ?? '')) ? String(saved.sidebarColor) : DEFAULT_ORGANIZATION_PROFILE.sidebarColor,
    supportEmail: String(saved.supportEmail ?? '').trim() || null,
    customDomain: String(saved.customDomain ?? '').trim() || null
  };
}

function readDemoPublicIntakeSettings(): UpdatePublicIntakeSettingsInput {
  const saved = readJson<Partial<UpdatePublicIntakeSettingsInput>>(PUBLIC_INTAKE_SETTINGS_KEY, {});
  return {
    ...DEFAULT_PUBLIC_INTAKE_SETTINGS,
    ...saved,
    enabled: saved.enabled ?? DEFAULT_PUBLIC_INTAKE_SETTINGS.enabled,
    formTitle: String(saved.formTitle ?? DEFAULT_PUBLIC_INTAKE_SETTINGS.formTitle).trim() || DEFAULT_PUBLIC_INTAKE_SETTINGS.formTitle,
    formDescription: String(saved.formDescription ?? DEFAULT_PUBLIC_INTAKE_SETTINGS.formDescription).trim() || DEFAULT_PUBLIC_INTAKE_SETTINGS.formDescription,
    confirmationMessage: String(saved.confirmationMessage ?? DEFAULT_PUBLIC_INTAKE_SETTINGS.confirmationMessage).trim() || DEFAULT_PUBLIC_INTAKE_SETTINGS.confirmationMessage,
    allowAttachments: saved.allowAttachments ?? DEFAULT_PUBLIC_INTAKE_SETTINGS.allowAttachments,
    maxFiles: Math.max(0, Math.min(10, Number(saved.maxFiles ?? DEFAULT_PUBLIC_INTAKE_SETTINGS.maxFiles))),
    maxFileSizeBytes: Math.max(1048576, Math.min(104857600, Number(saved.maxFileSizeBytes ?? DEFAULT_PUBLIC_INTAKE_SETTINGS.maxFileSizeBytes))),
    rateLimitPerHour: Math.max(1, Math.min(500, Number(saved.rateLimitPerHour ?? DEFAULT_PUBLIC_INTAKE_SETTINGS.rateLimitPerHour))),
    challengeMode: saved.challengeMode === 'off' || saved.challengeMode === 'always' ? saved.challengeMode : 'adaptive',
    challengeThreshold: Math.max(1, Math.min(100, Number(saved.challengeThreshold ?? DEFAULT_PUBLIC_INTAKE_SETTINGS.challengeThreshold))),
    requirePrivacyConsent: saved.requirePrivacyConsent ?? DEFAULT_PUBLIC_INTAKE_SETTINGS.requirePrivacyConsent,
    privacyNoticeText: String(saved.privacyNoticeText ?? DEFAULT_PUBLIC_INTAKE_SETTINGS.privacyNoticeText),
    privacyPolicyUrl: String(saved.privacyPolicyUrl ?? '')
  };
}

function seedSubtasks(): SigcSubtask[] {
  return demoSubtasks.map((task, index) => {
    const caseItem = readCases().find((item) => item.radicado === task.caseId) ?? readCases()[index % readCases().length];
    const owner = members.find((item) => item.name === task.owner);
    const priority = catalogs.priorities.find((item) => item.name === task.priority);
    const stateMap: Record<string, SigcSubtask['state']> = { Completada: 'completed', 'En progreso': 'in_progress', Pendiente: 'pending' };
    return {
      id: `demo-subtask-${index + 1}`, caseId: caseItem?.databaseId ?? caseItem?.id ?? '', areaId: caseItem?.areaId, areaName: caseItem?.area ?? 'Sin área', caseRadicado: caseItem?.radicado ?? task.caseId, caseSubject: caseItem?.subject ?? '',
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
      date: doc.date, currentFilename: doc.name, currentStoredFilename: buildCanonicalFilename({ organization: 'DEMO', area: caseItem?.area ?? 'GENERAL', radicado: caseItem?.radicado ?? doc.caseId, category: doc.type, version: Number(doc.version.replace(/\D/g, '')) || 1, originalFilename: doc.name }), currentStoragePath: '', currentMimeType: doc.type, currentSizeBytes: 0, retentionUntil: null, legalHold: false, clientVisible: index % 2 === 0
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
    typeColor: type.color ?? null,
    priorityId: priority.id,
    priorityCode: priority.code,
    priorityColor: priority.color ?? null,
    stateId: state.id,
    stateCode: state.code,
    stateColor: state.color ?? null,
    areaId: area.id,
    areaColor: area.color ?? null,
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
    responseEmail: input.usesAlternateResponseEmail ? input.responseEmail?.trim() || undefined : input.requesterEmail.trim() || undefined,
    usesAlternateResponseEmail: Boolean(input.usesAlternateResponseEmail),
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
    risk: 'riskLevel' in input && input.riskLevel ? input.riskLevel : 'En tiempo',
    source,
    submittedCaseTypeId: source === 'Formulario público' ? caseType.id : undefined,
    submittedCaseTypeName: source === 'Formulario público' ? caseType.name : undefined,
    customFields: input.customFields ?? {}
  };

  writeCases([created, ...cases]);
  return { caseId: created.databaseId!, radicado, dueAt };
}

export const demoSigcRepository: SigcRepository = {

  async searchCases(filters: SigcCaseFilters): Promise<SigcCasePage> {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.max(5, filters.pageSize ?? 10);
    const query = filters.query?.trim().toLowerCase() ?? '';
    const relatedCaseIds = new Set<string>();
    if (query) {
      readComments().filter((item) => item.content.toLowerCase().includes(query)).forEach((item) => relatedCaseIds.add(item.caseId));
      readSubtasks().filter((item) => `${item.title} ${item.description}`.toLowerCase().includes(query)).forEach((item) => relatedCaseIds.add(item.caseId));
      readDocuments().filter((item) => `${item.name} ${item.category}`.toLowerCase().includes(query)).forEach((item) => relatedCaseIds.add(item.caseId));
    }
    const filtered = readCases().filter((item) => {
      if (!matchesFilters(item, { ...filters, query: undefined })) return false;
      if (!query) return true;
      const directMatch = [item.radicado, item.subject, item.description, item.requester, item.company, item.requesterDocument ?? '', item.requesterEmail ?? '', item.requesterPhone ?? '']
        .some((value) => String(value ?? '').toLowerCase().includes(query));
      return directMatch || relatedCaseIds.has(item.databaseId ?? item.id) || relatedCaseIds.has(item.id);
    });
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
    if (stored.length) return stored.map((assignment) => ({
      ...assignment,
      assignedAt: assignment.assignedAt ?? item.openedAt ?? new Date().toISOString(),
      assignedLabel: assignment.assignedLabel ?? new Date(assignment.assignedAt ?? item.openedAt ?? Date.now()).toLocaleString('es-CO'),
      isActive: assignment.isActive ?? true
    }));
    if (!item.areaId) return [];
    return [{
      id: 'demo-assignment-primary',
      areaId: item.areaId,
      areaName: item.area,
      responsibleUserId: item.ownerId,
      responsibleName: item.owner,
      assignedAt: item.openedAt ?? new Date().toISOString(),
      assignedLabel: new Date(item.openedAt ?? Date.now()).toLocaleString('es-CO'),
      dueAt: item.dueAt,
      due: item.due,
      state: 'assigned',
      progress: item.progress,
      isPrimary: true,
      isActive: true
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
          assignedAt: new Date().toISOString(),
          assignedLabel: 'Ahora',
          dueAt: assignment.dueAt || result.dueAt,
          due: assignment.dueAt ? new Date(assignment.dueAt).toLocaleString('es-CO') : new Date(result.dueAt ?? '').toLocaleString('es-CO'),
          state: 'assigned',
          observations: assignment.observations,
          progress: 0,
          isPrimary: assignment.isPrimary ?? index === 0,
          isActive: true
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
      assignedAt: new Date().toISOString(),
      assignedLabel: 'Ahora',
      dueAt: input.dueAt ?? item.dueAt,
      due: input.dueAt ? new Date(input.dueAt).toLocaleString('es-CO') : item.due,
      state: 'assigned',
      observations: input.observations,
      progress: 0,
      isPrimary: Boolean(isPrimary),
      isActive: true
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

  async classifyCase(input: ClassifyCaseInput): Promise<void> {
    const item = await this.getCaseByIdentifier(input.caseId);
    if (!item) throw new Error('Caso no encontrado.');
    const type = catalogs.caseTypes.find((entry) => entry.id === input.caseTypeId);
    const priority = catalogs.priorities.find((entry) => entry.id === input.priorityId);
    const classifiedState = catalogs.states.find((entry) => entry.name === 'Clasificado');
    if (!type || !priority || !classifiedState) throw new Error('La clasificación contiene catálogos no válidos.');
    if (!input.assignments.length) throw new Error('La clasificación requiere al menos una asignación.');

    const caseKey = item.databaseId ?? item.id;
    const normalizedAssignments: SigcAssignment[] = input.assignments.map((assignment, index) => {
      const area = catalogs.areas.find((entry) => entry.id === assignment.areaId);
      if (!area) throw new Error('Área no válida.');
      const owner = assignment.responsibleUserId ? members.find((entry) => entry.userId === assignment.responsibleUserId) : undefined;
      return {
        id: `demo-assignment-${crypto.randomUUID()}`, areaId: area.id, areaName: area.name,
        responsibleUserId: owner?.userId, responsibleName: owner?.name ?? 'Sin responsable',
        assignedAt: new Date().toISOString(), assignedLabel: 'Ahora', dueAt: assignment.dueAt || input.dueAt || item.dueAt,
        due: assignment.dueAt ? new Date(assignment.dueAt).toLocaleString('es-CO') : item.due, state: 'assigned',
        observations: assignment.observations, progress: 0, isPrimary: assignment.isPrimary ?? index === 0, isActive: true
      };
    });
    if (!normalizedAssignments.some((assignment) => assignment.isPrimary)) normalizedAssignments[0].isPrimary = true;
    let primarySeen = false;
    normalizedAssignments.forEach((assignment) => { if (assignment.isPrimary && !primarySeen) primarySeen = true; else if (assignment.isPrimary) assignment.isPrimary = false; });
    const primary = normalizedAssignments.find((assignment) => assignment.isPrimary)!;
    const allAssignments = readAssignments();
    allAssignments[caseKey] = normalizedAssignments;
    writeAssignments(allAssignments);

    writeCases(readCases().map((current) => current.id === item.id ? {
      ...current, typeId: type.id, type: type.name, priorityId: priority.id, priority: priority.name as SigcCase['priority'],
      risk: input.riskLevel, areaId: primary.areaId, area: primary.areaName, ownerId: primary.responsibleUserId, owner: primary.responsibleName,
      stateId: classifiedState.id, state: classifiedState.name, dueAt: input.dueAt ? new Date(input.dueAt).toISOString() : current.dueAt,
      due: input.dueAt ? new Date(input.dueAt).toLocaleString('es-CO') : current.due, classificationObservations: input.observations,
      classifiedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), updated: 'Ahora'
    } : current));
    pushTimeline(caseKey, 'case.classified', 'Caso clasificado', input.observations || 'Clasificación y asignaciones actualizadas.');
  },

  async updateCaseAssignment(input: UpdateCaseAssignmentInput): Promise<void> {
    const item = await this.getCaseByIdentifier(input.caseId);
    if (!item) throw new Error('Caso no encontrado.');
    const area = catalogs.areas.find((entry) => entry.id === input.areaId);
    if (!area) throw new Error('Área no válida.');
    const owner = input.responsibleUserId ? members.find((entry) => entry.userId === input.responsibleUserId) : undefined;
    const key = item.databaseId ?? item.id;
    const all = readAssignments();
    const current = all[key] ?? [];
    if (!current.some((assignment) => assignment.id === input.assignmentId)) throw new Error('Asignación no encontrada.');
    if (input.isPrimary) current.forEach((assignment) => { assignment.isPrimary = false; });
    const now = new Date().toISOString();
    const updated = current.map((assignment) => assignment.id === input.assignmentId ? {
      ...assignment, areaId: area.id, areaName: area.name, responsibleUserId: owner?.userId, responsibleName: owner?.name ?? 'Sin responsable',
      dueAt: input.dueAt ? new Date(input.dueAt).toISOString() : null, due: input.dueAt ? new Date(input.dueAt).toLocaleString('es-CO') : 'Sin fecha',
      state: input.state, observations: input.observations, progress: Math.max(0, Math.min(100, input.progress)), isPrimary: input.isPrimary,
      isActive: true, updatedAt: now, completedAt: input.progress >= 100 || input.state === 'completed' ? now : null
    } : assignment);
    all[key] = updated; writeAssignments(all);
    const primary = updated.find((assignment) => assignment.isPrimary && assignment.isActive);
    if (primary) writeCases(readCases().map((currentCase) => currentCase.id === item.id ? { ...currentCase, areaId: primary.areaId, area: primary.areaName, ownerId: primary.responsibleUserId, owner: primary.responsibleName, updatedAt: now, updated: 'Ahora' } : currentCase));
    pushTimeline(key, 'assignment.updated', 'Asignación actualizada', `${area.name} · ${owner?.name ?? 'Sin responsable'}`);
  },

  async deactivateCaseAssignment(input: DeactivateCaseAssignmentInput): Promise<void> {
    if (input.reason.trim().length < 3) throw new Error('Indica el motivo de retiro de la asignación.');
    const item = await this.getCaseByIdentifier(input.caseId);
    if (!item) throw new Error('Caso no encontrado.');
    const key = item.databaseId ?? item.id;
    const all = readAssignments();
    const current = all[key] ?? [];
    const target = current.find((assignment) => assignment.id === input.assignmentId);
    if (!target) throw new Error('Asignación no encontrada.');
    const now = new Date().toISOString();
    target.isActive = false; target.isPrimary = false; target.state = 'cancelled'; target.updatedAt = now; target.completedAt = now; target.observations = [target.observations, `Retirada: ${input.reason.trim()}`].filter(Boolean).join(' · ');
    const nextPrimary = current.find((assignment) => assignment.isActive);
    if (nextPrimary && !current.some((assignment) => assignment.isActive && assignment.isPrimary)) nextPrimary.isPrimary = true;
    all[key] = current; writeAssignments(all);
    const primary = current.find((assignment) => assignment.isActive && assignment.isPrimary);
    writeCases(readCases().map((currentCase) => currentCase.id === item.id ? { ...currentCase, areaId: primary?.areaId, area: primary?.areaName ?? 'Sin área', ownerId: primary?.responsibleUserId, owner: primary?.responsibleName ?? 'Sin responsable', updatedAt: now, updated: 'Ahora' } : currentCase));
    pushTimeline(key, 'assignment.deactivated', 'Asignación retirada', input.reason.trim());
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

  async getWorkflowBoard(filters: WorkflowBoardFilters = {}): Promise<WorkflowBoardSnapshot> {
    const selectedCaseTypeId = filters.caseTypeId ?? catalogs.caseTypes[0]?.id ?? null;
    const normalized = (filters.query ?? '').trim().toLowerCase();
    const cases = readCases().filter((item) => {
      if (selectedCaseTypeId && item.typeId !== selectedCaseTypeId) return false;
      if (filters.areaId && item.areaId !== filters.areaId) return false;
      if (filters.ownerId && item.ownerId !== filters.ownerId) return false;
      if (filters.priorityId && item.priorityId !== filters.priorityId) return false;
      if (normalized && ![item.radicado, item.subject, item.company, item.requester].some((value) => String(value ?? '').toLowerCase().includes(normalized))) return false;
      return true;
    });
    const workflowStates = catalogs.states.slice(0, 8);
    return {
      organizationId: 'demo-org',
      selectedCaseTypeId,
      caseTypes: catalogs.caseTypes.filter((item) => item.isPublicEnabled).map((item) => ({ id: item.id, code: item.id, name: item.name, caseCount: readCases().filter((c) => c.typeId === item.id).length })),
      columns: workflowStates.map((state, index) => ({
        stateId: state.id,
        code: state.id,
        name: state.name,
        sortOrder: index * 10,
        isInitial: index === 0,
        isTerminal: ['Cerrado', 'Cancelado'].includes(state.name),
        cards: cases.filter((item) => item.stateId === state.id || item.state === state.name).map((item) => ({
          id: item.databaseId ?? item.id,
          radicado: item.radicado,
          subject: item.subject,
          company: item.company,
          requester: item.requester,
          stateId: state.id,
          stateName: state.name,
          priorityId: item.priorityId,
          priorityName: item.priority,
          areaId: item.areaId,
          areaName: item.area,
          ownerId: item.ownerId,
          ownerName: item.owner,
          dueAt: item.dueAt,
          progress: item.progress,
          riskLevel: item.risk,
          source: item.source,
          updatedAt: item.updatedAt ?? new Date().toISOString(),
          overdue: item.sem === 'red'
        }))
      })),
      transitions: workflowStates.slice(0, -1).map((state, index) => ({
        id: `demo-transition-${index}`,
        fromStateId: state.id,
        toStateId: workflowStates[index + 1]!.id,
        requiresJustification: index === 3,
        allowed: true
      })),
      generatedAt: new Date().toISOString()
    };
  },

  async moveCaseInWorkflow(input: MoveWorkflowCaseInput): Promise<MoveWorkflowCaseResult> {
    await this.changeCaseState({ caseId: input.caseId, toStateId: input.toStateId, justification: input.justification });
    const state = catalogs.states.find((item) => item.id === input.toStateId);
    return { caseId: input.caseId, stateId: input.toStateId, stateName: state?.name ?? 'Estado', updatedAt: new Date().toISOString() };
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

  async searchSubtasks(filters: SigcSubtaskFilters = {}): Promise<SigcSubtaskPage> {
    const all = await this.listSubtasks(filters);
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(5, filters.pageSize ?? 25));
    return { items: all.slice((page - 1) * pageSize, page * pageSize), total: all.length, page, pageSize };
  },

  async createSubtask(input: CreateSubtaskInput): Promise<CreatedSubtaskResult> {
    const item = await this.getCaseByIdentifier(input.caseId);
    if (!item) throw new Error('Caso no encontrado.');
    const owner = members.find((member) => member.userId === input.responsibleUserId);
    const priority = catalogs.priorities.find((entry) => entry.id === input.priorityId);
    const subtaskId = `demo-subtask-${crypto.randomUUID()}`;
    const task: SigcSubtask = {
      id: subtaskId, caseId: item.databaseId ?? item.id, assignmentId: input.assignmentId, areaId: input.areaId, areaName: catalogs.areas.find((area) => area.id === input.areaId)?.name ?? 'Sin área', caseRadicado: item.radicado, caseSubject: item.subject, title: input.title, description: input.description,
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
    writeJson(SUBTASKS_KEY, rows.map((task) => task.id === input.subtaskId ? { ...task, assignmentId: input.assignmentId, areaId: input.areaId, areaName: catalogs.areas.find((area) => area.id === input.areaId)?.name ?? 'Sin área', title: input.title, description: input.description, responsibleUserId: owner?.userId, responsibleName: owner?.name ?? 'Sin responsable', priorityId: priority?.id, priority: (priority?.name ?? 'Media') as SigcCase['priority'], dueAt: input.dueAt ? new Date(input.dueAt).toISOString() : null, due: input.dueAt ? new Date(input.dueAt).toLocaleString('es-CO') : 'Sin fecha', state: input.state, stateLabel: { pending: 'Pendiente', in_progress: 'En progreso', completed: 'Completada', cancelled: 'Cancelada' }[input.state], progress: input.state === 'completed' ? 100 : input.progress, attachments: task.attachments + (input.files?.length ?? 0), updatedAt: new Date().toISOString() } : task));
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

  async searchDocuments(filters: SigcDocumentFilters = {}): Promise<SigcDocumentPage> {
    let rows = await this.listDocuments(filters.caseId);
    const query = filters.query?.trim().toLowerCase() ?? '';
    if (query) rows = rows.filter((document) => [document.name, document.category, document.caseRadicado, document.caseSubject, document.ownerName].some((value) => value.toLowerCase().includes(query)));
    if (filters.category) rows = rows.filter((document) => document.category === filters.category);
    if (filters.state) rows = rows.filter((document) => document.state === filters.state);
    if (filters.clientVisibleOnly) rows = rows.filter((document) => document.clientVisible);
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(5, filters.pageSize ?? 25));
    return { items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize };
  },

  async listDocumentVersions(documentId: string): Promise<SigcDocumentVersion[]> {
    return readJson<SigcDocumentVersion[]>(DOCUMENT_VERSIONS_KEY, [])
      .filter((version) => version.documentId === documentId)
      .sort((a, b) => b.versionNumber - a.versionNumber);
  },

  async updateDocumentRetention(input: UpdateDocumentRetentionInput): Promise<void> {
    writeJson(DOCUMENTS_KEY, readDocuments().map((document) => document.id === input.documentId
      ? { ...document, retentionUntil: input.retentionUntil || null, legalHold: input.legalHold, updatedAt: new Date().toISOString(), date: 'Ahora' }
      : document));
  },

  async setDocumentClientVisibility(documentId: string, isVisible: boolean): Promise<void> {
    writeJson(DOCUMENTS_KEY, readDocuments().map((document) => document.id === documentId ? { ...document, clientVisible: isVisible, updatedAt: new Date().toISOString() } : document));
  },

  async uploadDocument(input: UploadCaseDocumentInput): Promise<SigcDocument> {
    await validateFileForUpload(input.file, { scope: 'internal' });
    const item = await this.getCaseByIdentifier(input.caseId);
    if (!item) throw new Error('Caso no encontrado.');
    const documentId = `demo-document-${crypto.randomUUID()}`;
    const storedFilename = buildCanonicalFilename({ organization: 'DEMO', area: input.areaId || item.area || 'GENERAL', radicado: item.radicado, category: input.category, version: 1, originalFilename: input.file.name, documentId });
    const document: SigcDocument = { id: documentId, caseId: item.databaseId ?? item.id, caseRadicado: item.radicado, caseSubject: item.subject, subtaskId: input.subtaskId, commentId: input.commentId, assignmentId: input.assignmentId, areaId: input.areaId, areaName: item.area, name: input.name, category: input.category, state: input.state ?? 'Cargado', clientVisible: false,
      currentVersion: 1, ownerName: 'Usuario Demo', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), date: 'Ahora', currentFilename: input.file.name, currentStoredFilename: storedFilename, currentStoragePath: '', currentMimeType: inferFileMimeType(input.file), currentSizeBytes: input.file.size, retentionUntil: null, legalHold: false };
    writeJson(DOCUMENTS_KEY, [document, ...readDocuments()]);
    const version: SigcDocumentVersion = {
      id: `demo-version-${crypto.randomUUID()}`,
      documentId: document.id,
      versionNumber: 1,
      originalFilename: input.file.name,
      storedFilename,
      storagePath: '',
      mimeType: inferFileMimeType(input.file),
      sizeBytes: input.file.size,
      checksum: null,
      changeNotes: input.changeNotes,
      uploadedBy: 'demo-user-1',
      uploadedByName: 'Usuario Demo',
      createdAt: new Date().toISOString(),
      createdLabel: 'Ahora'
    };
    writeJson(DOCUMENT_VERSIONS_KEY, [version, ...readJson<SigcDocumentVersion[]>(DOCUMENT_VERSIONS_KEY, [])]);
    pushTimeline(document.caseId, 'document.created', 'Documento cargado', document.name);
    return document;
  },

  async addDocumentVersion(input: AddDocumentVersionInput): Promise<void> {
    await validateFileForUpload(input.file, { scope: 'internal' });
    const rows = readDocuments();
    const document = rows.find((entry) => entry.id === input.documentId);
    writeJson(DOCUMENTS_KEY, rows.map((entry) => entry.id === input.documentId ? { ...entry, currentVersion: entry.currentVersion + 1, currentFilename: input.file.name, currentStoredFilename: buildCanonicalFilename({ organization: 'DEMO', area: document?.areaName || document?.areaId || 'GENERAL', radicado: document?.caseRadicado || 'CASO', category: document?.category || 'DOCUMENTO', version: input.currentVersion + 1, originalFilename: input.file.name, documentId: input.documentId }), currentMimeType: inferFileMimeType(input.file), currentSizeBytes: input.file.size, updatedAt: new Date().toISOString(), date: 'Ahora' } : entry));
    const storedFilename = buildCanonicalFilename({ organization: 'DEMO', area: document?.areaName || document?.areaId || 'GENERAL', radicado: document?.caseRadicado || 'CASO', category: document?.category || 'DOCUMENTO', version: input.currentVersion + 1, originalFilename: input.file.name, documentId: input.documentId });
    const version: SigcDocumentVersion = {
      id: `demo-version-${crypto.randomUUID()}`,
      documentId: input.documentId,
      versionNumber: input.currentVersion + 1,
      originalFilename: input.file.name,
      storedFilename,
      storagePath: '',
      mimeType: inferFileMimeType(input.file),
      sizeBytes: input.file.size,
      checksum: null,
      changeNotes: input.changeNotes,
      uploadedBy: 'demo-user-1',
      uploadedByName: 'Usuario Demo',
      createdAt: new Date().toISOString(),
      createdLabel: 'Ahora'
    };
    writeJson(DOCUMENT_VERSIONS_KEY, [version, ...readJson<SigcDocumentVersion[]>(DOCUMENT_VERSIONS_KEY, [])]);
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

  async listCaseTimeline(caseId: string, page = 1, pageSize = 100): Promise<SigcTimelinePage> {
    const item = await this.getCaseByIdentifier(caseId);
    const resolved = item?.databaseId ?? caseId;
    const all = readTimeline().filter((event) => event.caseId === resolved || event.caseId === '');
    const start = (Math.max(1, page) - 1) * pageSize;
    return { items: all.slice(start, start + pageSize), total: all.length, page, pageSize, hasMore: start + pageSize < all.length };
  },

  async getAuditEvents(filters: SigcAuditFilters): Promise<SigcAuditPage> {
    const query = filters.query?.trim().toLowerCase() ?? '';
    const all = readTimeline().filter((event) => !query || `${event.title} ${event.description} ${event.actorName} ${event.eventType}`.toLowerCase().includes(query));
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.max(20, filters.pageSize ?? 50);
    const start = (page - 1) * pageSize;
    return {
      items: all.slice(start, start + pageSize).map((event, index) => ({
        id: Number(String(event.id).replace(/\D/g, '')) || start + index + 1,
        organizationId: 'demo-org',
        caseId: event.caseId || undefined,
        caseRadicado: readCases().find((item) => (item.databaseId ?? item.id) === event.caseId)?.radicado,
        actorUserId: event.actorId,
        actorName: event.actorName,
        eventType: event.eventType,
        entityType: event.entityType,
        entityId: event.id,
        beforeData: null,
        afterData: null,
        metadata: {},
        ipAddress: '127.0.0.1',
        userAgent: 'Demo SIGC',
        createdAt: event.createdAt,
        createdLabel: event.date
      })),
      total: all.length,
      page,
      pageSize
    };
  },

  async listCaseSlaOverrides(caseId: string): Promise<SigcSlaOverride[]> {
    const item = await this.getCaseByIdentifier(caseId);
    const resolved = item?.databaseId ?? caseId;
    return readJson<SigcSlaOverride[]>(SLA_OVERRIDES_KEY, []).filter((entry) => entry.caseId === resolved);
  },

  async overrideCaseSla(input: OverrideCaseSlaInput): Promise<void> {
    const item = await this.getCaseByIdentifier(input.caseId);
    if (!item) throw new Error('Caso no encontrado.');
    const resolved = item.databaseId ?? item.id;
    const rows = readJson<SigcSlaOverride[]>(SLA_OVERRIDES_KEY, []);
    const created: SigcSlaOverride = { id: `demo-sla-${crypto.randomUUID()}`, caseId: resolved, previousDueAt: item.dueAt, newDueAt: new Date(input.newDueAt).toISOString(), justification: input.justification, changedBy: 'demo-user-1', changedByName: 'Laura Méndez', changedAt: new Date().toISOString(), changedLabel: 'Ahora' };
    writeJson(SLA_OVERRIDES_KEY, [created, ...rows]);
    writeCases(readCases().map((current) => current.id === item.id ? { ...current, dueAt: created.newDueAt, due: new Date(created.newDueAt).toLocaleString('es-CO'), updated: 'Ahora', updatedAt: new Date().toISOString() } : current));
    pushTimeline(resolved, 'case.sla_overridden', 'Fecha límite modificada', input.justification);
  },

  async listCaseReviews(caseId: string): Promise<SigcCaseReview[]> {
    const item = await this.getCaseByIdentifier(caseId);
    const resolved = item?.databaseId ?? caseId;
    return readJson<SigcCaseReview[]>(REVIEWS_KEY, []).filter((entry) => entry.caseId === resolved);
  },

  async submitCaseForReview(input: SubmitCaseReviewInput): Promise<void> {
    const item = await this.getCaseByIdentifier(input.caseId);
    if (!item) throw new Error('Caso no encontrado.');
    const resolved = item.databaseId ?? item.id;
    const rows = readJson<SigcCaseReview[]>(REVIEWS_KEY, []);
    const reviewer = members.find((member) => member.userId === input.reviewerUserId);
    const review: SigcCaseReview = { id: `demo-review-${crypto.randomUUID()}`, caseId: resolved, reviewRound: rows.filter((entry) => entry.caseId === resolved).length + 1, status: 'pending', requestedBy: 'demo-user-1', requestedByName: 'Laura Méndez', reviewerUserId: reviewer?.userId, reviewerName: reviewer?.name ?? 'Sin revisor específico', requestNote: input.note, requestedAt: new Date().toISOString(), requestedLabel: 'Ahora' };
    writeJson(REVIEWS_KEY, [review, ...rows]);
    const target = catalogs.states.find((state) => state.name === 'En Revisión / Aprobación');
    if (target) await this.changeCaseState({ caseId: input.caseId, toStateId: target.id });
  },

  async decideCaseReview(input: DecideCaseReviewInput): Promise<void> {
    const rows = readJson<SigcCaseReview[]>(REVIEWS_KEY, []);
    const review = rows.find((entry) => entry.id === input.reviewId);
    if (!review) throw new Error('Revisión no encontrada.');
    writeJson(REVIEWS_KEY, rows.map((entry) => entry.id === input.reviewId ? { ...entry, status: input.decision, decisionComments: input.comments, decidedBy: 'demo-user-1', decidedByName: 'Laura Méndez', decidedAt: new Date().toISOString(), decidedLabel: 'Ahora' } : entry));
    const targetName = input.decision === 'approved' ? 'Aprobado' : 'Devuelto para Ajustes';
    const target = catalogs.states.find((state) => state.name === targetName);
    if (target) await this.changeCaseState({ caseId: review.caseId, toStateId: target.id, justification: input.comments });
  },

  async listCaseDeliveries(caseId: string): Promise<SigcCaseDelivery[]> {
    const item = await this.getCaseByIdentifier(caseId);
    const resolved = item?.databaseId ?? caseId;
    return readJson<SigcCaseDelivery[]>(DELIVERIES_KEY, []).filter((entry) => entry.caseId === resolved);
  },

  async registerCaseDelivery(input: RegisterCaseDeliveryInput): Promise<void> {
    const item = await this.getCaseByIdentifier(input.caseId);
    if (!item) throw new Error('Caso no encontrado.');
    const resolved = item.databaseId ?? item.id;
    const rows = readJson<SigcCaseDelivery[]>(DELIVERIES_KEY, []);
    writeJson(DELIVERIES_KEY, [{ id: `demo-delivery-${crypto.randomUUID()}`, caseId: resolved, channel: input.channel, recipient: input.recipient, reference: input.reference, notes: input.notes, deliveredBy: 'demo-user-1', deliveredByName: 'Laura Méndez', deliveredAt: new Date().toISOString(), deliveredLabel: 'Ahora' }, ...rows]);
    const target = catalogs.states.find((state) => state.name === 'Enviado');
    if (target) await this.changeCaseState({ caseId: input.caseId, toStateId: target.id });
  },

  async listCaseReminders(caseId: string): Promise<SigcCaseReminder[]> {
    const item = await this.getCaseByIdentifier(caseId);
    const resolved = item?.databaseId ?? caseId;
    return readJson<SigcCaseReminder[]>(REMINDERS_KEY, []).filter((entry) => entry.caseId === resolved);
  },

  async sendManualReminder(input: SendManualReminderInput): Promise<number> {
    const item = await this.getCaseByIdentifier(input.caseId);
    if (!item) throw new Error('Caso no encontrado.');
    const resolved = item.databaseId ?? item.id;
    const recipients = input.recipientUserIds?.length ? members.filter((member) => input.recipientUserIds!.includes(member.userId)) : members.slice(0, 1);
    const rows = readJson<SigcCaseReminder[]>(REMINDERS_KEY, []);
    const created = recipients.map((member) => ({ id: `demo-reminder-${crypto.randomUUID()}`, caseId: resolved, recipientUserId: member.userId, recipientName: member.name, reminderType: 'manual' as const, message: input.message, sentBy: 'demo-user-1', sentByName: 'Laura Méndez', deliveredAt: new Date().toISOString(), deliveredLabel: 'Ahora' }));
    writeJson(REMINDERS_KEY, [...created, ...rows]);
    created.forEach(() => pushTimeline(resolved, 'case.reminder_sent', 'Recordatorio enviado', input.message));
    return created.length;
  },

  async getUserManagementSnapshot(): Promise<SigcUserManagementSnapshot> {
    const snapshot = await this.getAdminSnapshot();
    return { organizationId: snapshot.organizationId, roles: snapshot.roles, members: snapshot.members };
  },

  async getAdminSnapshot(): Promise<SigcAdminSnapshot> {
    const states = catalogs.states.map((item, index) => ({ id: item.id, code: item.code ?? `STATE_${index + 1}`, name: item.name, color: item.color ?? undefined, sortOrder: index * 10, isActive: true, isInitial: index === 0, isTerminal: ['CLOSED', 'CANCELLED'].includes(item.code ?? '') }));
    return {
      organizationId: 'demo-org',
      configuration: catalogs.configuration,
      areas: catalogs.areas.map((item, index) => ({ id: item.id, code: item.code ?? `AREA_${index + 1}`, name: item.name, description: item.description ?? undefined, color: item.color ?? undefined, sortOrder: item.sortOrder ?? index * 10, isActive: item.isActive ?? true, parentAreaId: item.parentAreaId ?? undefined, email: item.email ?? undefined })),
      priorities: catalogs.priorities.map((item, index) => ({ id: item.id, code: item.code ?? `PRIORITY_${index + 1}`, name: item.name, color: item.color ?? undefined, sortOrder: item.sortOrder ?? index * 10, isActive: item.isActive ?? true })),
      caseTypes: catalogs.caseTypes.map((item, index) => ({ id: item.id, code: item.code ?? `TYPE_${index + 1}`, name: item.name, color: item.color ?? undefined, sortOrder: item.sortOrder ?? index * 10, isActive: item.isActive ?? true, isPublicEnabled: item.isPublicEnabled, isInternalEnabled: item.isInternalEnabled, defaultPriorityId: item.defaultPriorityId ?? undefined, defaultRiskLevel: item.defaultRiskLevel ?? undefined, responseTemplateId: item.responseTemplateId ?? undefined, defaultAreas: item.defaultAreas ?? [], fields: item.fields ?? [] })),
      states,
      slaPolicies: catalogs.caseTypes.map((item, index) => ({ id: `demo-sla-${index}`, caseTypeId: item.id, caseTypeName: item.name, name: `SLA ${item.name}`, durationValue: item.name === 'Acción de Tutela' ? 24 : 5, durationUnit: item.name === 'Acción de Tutela' ? 'hours' : 'calendar_days', timezone: 'America/Bogota', pauseOnPendingInformation: true, isDefault: true, isActive: true })),
      holidays: [],
      permissions: [
        { id: 'p1', code: 'admin.manage_configuration', name: 'Administrar configuración' },
        { id: 'p2', code: 'automation.manage', name: 'Administrar automatizaciones' },
        { id: 'p3', code: 'audit.view', name: 'Ver auditoría' },
        { id: 'p4', code: 'audit.export', name: 'Exportar auditoría' }
      ],
      roles: catalogs.roles.map((item, index) => ({ id: item.id, code: `role_${index}`, name: item.name, isSystem: true, isActive: true, permissionIds: index === 0 ? ['p1', 'p2'] : [] })),
      members: members.map((member, index) => ({ membershipId: member.membershipId ?? `demo-membership-${index}`, userId: member.userId, name: member.name, email: member.email, roleId: catalogs.roles[index % catalogs.roles.length]?.id, roleName: member.roleName, isActive: true, areaIds: member.areaIds, primaryAreaId: member.primaryAreaId, coordinatorAreaIds: member.coordinatorAreaIds })),
      workflows: catalogs.caseTypes.map((item) => ({
        caseTypeId: item.id,
        caseTypeName: item.name,
        states: states.map((state, index) => ({ stateId: state.id, stateName: state.name, stateCode: state.code, stateColor: state.color ?? null, isInitial: state.isInitial, isTerminal: state.isTerminal, sortOrder: index * 10, isRequired: true })),
        transitions: [],
        isValid: true,
        validationMessages: []
      })),
      emailTemplates: [{ id: 'template-1', code: 'CASE_CREATED', name: 'Confirmación de radicación', eventType: 'case.created', subject: 'Confirmación {{radicado}}', bodyText: 'Tu solicitud {{radicado}} fue registrada.', bodyHtml: null, variableCodes: ['radicado'], isActive: true }],
      reminderRules: [{ id: 'reminder-1', code: 'BEFORE_24H', name: '24 horas antes', triggerKind: 'before_due', offsetMinutes: 1440, includeManagers: false, messageTemplate: 'El caso {{radicado}} vence el {{fecha_limite}}.', emailTemplateCode: 'CASE_DUE_SOON', isActive: true }],
      automationRules: [{ id: 'automation-1', code: 'AUTO_TUTELA_JURIDICA', name: 'Asignar tutelas a Jurídica', triggerEvent: 'case.created', conditions: [], conditionMode: 'all', actions: [{ type: 'assign_area', areaId: catalogs.areas[0]?.id ?? '' }], stopOnError: true, stopProcessing: false, sortOrder: 10, isActive: true, lifecycleStatus: 'published', currentVersion: 1, publishedVersion: 1, publishedAt: new Date().toISOString(), runCount: 0, maxAttempts: 3, retryDelayMinutes: 10 }],
      automationExecutions: [],
      automationDiagnostics: []
    };
  },

  async saveAdminCatalog(_input: SaveAdminCatalogInput): Promise<void> {},
  async saveCaseTypeConfiguration(input: SaveCaseTypeConfigurationInput): Promise<string> { return input.id ?? `demo-case-type-${crypto.randomUUID()}`; },
  async saveMemberAreaConfiguration(_input: SaveMemberAreaConfigurationInput): Promise<void> {},
  async setAdminCatalogActive(_kind: SaveAdminCatalogInput['kind'], _id: string, _isActive: boolean): Promise<void> {},
  async saveSlaPolicy(_input: SaveSlaPolicyInput): Promise<void> {},
  async saveHoliday(_input: SaveHolidayInput): Promise<void> {},
  async deleteHoliday(_id: string): Promise<void> {},
  async saveRole(input: SaveRoleInput): Promise<string> { return input.id ?? `demo-role-${crypto.randomUUID()}`; },
  async setRolePermissions(_roleId: string, _permissionIds: string[]): Promise<void> {},
  async setMemberRole(_membershipId: string, _roleId: string): Promise<void> {},
  async setMemberActive(_membershipId: string, _isActive: boolean): Promise<void> {},
  async removeMember(_membershipId: string): Promise<void> {},
  async saveWorkflowStates(_caseTypeId: string, _stateIds: string[]): Promise<void> {},
  async saveTransition(_input: SaveTransitionInput): Promise<void> {},
  async deleteTransition(_id: string): Promise<void> {},
  async saveEmailTemplate(_input: SaveEmailTemplateInput): Promise<void> {},
  async saveReminderRule(_input: SaveReminderRuleInput): Promise<void> {},
  async previewEmailTemplate(input: EmailTemplatePreviewInput): Promise<EmailTemplatePreview> {
    const replacements: Record<string, string> = { radicado: 'SIG-2026-000001', asunto: 'Caso de prueba', fecha_limite: '31/12/2026 17:00', solicitante: 'Solicitante Demo' };
    const render = (value: string) => value.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key: string) => replacements[key] ?? `{{${key}}}`);
    const subject = render(input.subject);
    const bodyText = render(input.bodyText);
    const bodyHtml = input.bodyHtml ? render(input.bodyHtml) : null;
    const unresolvedVariables = [...`${subject} ${bodyText} ${bodyHtml ?? ''}`.matchAll(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g)].map((match) => match[1]).filter(Boolean);
    return { subject, bodyText, bodyHtml, unresolvedVariables: [...new Set(unresolvedVariables)] };
  },
  async sendTestEmail(_input: SendTestEmailInput): Promise<void> {},
  async runRuntimeNow(): Promise<RuntimeExecutionResult> {
    return { generatedAt: new Date().toISOString(), remindersCreated: 1, overdueNotificationsCreated: 0, emailsQueued: 1, emailsDispatched: 1, emailsFailed: 0 };
  },

  async saveAutomationRule(_input: SaveAutomationRuleInput): Promise<void> {},
  async publishAutomationRule(_id: string): Promise<void> {},
  async archiveAutomationRule(_id: string): Promise<void> {},
  async restoreAutomationRuleVersion(_id: string, _versionNumber: number): Promise<void> {},
  async listAutomationRuleVersions(id: string): Promise<AutomationRuleVersion[]> {
    const rule = (await this.getAdminSnapshot()).automationRules.find((item) => item.id === id);
    if (!rule) return [];
    return [{ id: `demo-version-${id}-1`, ruleId: id, versionNumber: 1, lifecycleStatus: 'published', name: rule.name, description: rule.description, triggerEvent: rule.triggerEvent, conditions: rule.conditions, conditionMode: rule.conditionMode, actions: rule.actions, stopOnError: rule.stopOnError, stopProcessing: rule.stopProcessing, sortOrder: rule.sortOrder, maxAttempts: rule.maxAttempts, retryDelayMinutes: rule.retryDelayMinutes, createdByName: 'Administrador Demo', createdAt: new Date().toISOString(), publishedAt: new Date().toISOString() }];
  },
  async dryRunAutomationRule(ruleId: string, caseId: string): Promise<AutomationDryRunResult> {
    const snapshot = await this.getAdminSnapshot();
    const rule = snapshot.automationRules.find((item) => item.id === ruleId);
    const caseItem = await this.getCaseByIdentifier(caseId);
    if (!rule || !caseItem) throw new Error('Regla o caso no encontrado.');
    return { ruleId, ruleVersion: rule.currentVersion, caseId: caseItem.databaseId ?? caseItem.id, caseRadicado: caseItem.radicado, matched: true, conditionMode: rule.conditionMode, conditionResults: rule.conditions.map((condition, index) => ({ index, field: condition.field, operator: condition.operator, expected: condition.value, actual: condition.value, matched: true })), actions: rule.actions.map((action, index) => ({ index, type: action.type, status: 'would_execute', description: `Se ejecutaría ${action.type}` })), diagnostics: snapshot.automationDiagnostics, generatedAt: new Date().toISOString() };
  },
  async toggleAutomationRule(_id: string, _isActive: boolean): Promise<void> {},
  async runAutomationRule(_ruleId: string, _caseId: string): Promise<void> {},
  async getAutomationRuntimeHealth(): Promise<AutomationRuntimeHealth> {
    return { organizationId: 'demo-org', generatedAt: new Date().toISOString(), activeRules: 1, executions24h: 4, failedExecutions24h: 0, pendingRetries: 0, reminders24h: 3, queuedEmails: 0, failedEmails: 0, oldestQueuedEmailAt: null };
  },

  async getAgenda(from: string, to: string): Promise<SigcAgendaSnapshot> {
    const start = new Date(`${from}T00:00:00`).getTime();
    const end = new Date(`${to}T23:59:59.999`).getTime();
    const todayKey = new Date().toISOString().slice(0, 10);
    const cases = readCases();
    const caseById = new Map(cases.map((item) => [item.databaseId ?? item.id, item]));
    const items: SigcAgendaItem[] = [];
    const push = (item: SigcAgendaItem) => {
      const time = new Date(item.scheduledAt).getTime();
      if (Number.isFinite(time) && time >= start && time <= end) items.push(item);
    };

    for (const item of cases) {
      if (!item.dueAt || ['Cerrado', 'Cancelado'].includes(item.state)) continue;
      push({ id:`case:${item.databaseId ?? item.id}`, kind:'case_due', caseId:item.databaseId ?? item.id, caseRadicado:item.radicado, caseSubject:item.subject, title:`Vence ${item.radicado}`, description:item.subject, scheduledAt:item.dueAt, dateKey:item.dueAt.slice(0,10), state:item.state, priority:item.priority, owner:item.owner, area:item.area, progress:item.progress, completed:false, overdue:new Date(item.dueAt).getTime()<Date.now(), actionUrl:`/cases/${item.radicado}`, metadata:{} });
    }
    for (const [caseId, group] of Object.entries(readAssignments())) for (const assignment of group) {
      if (!assignment.dueAt || ['completed','cancelled'].includes(assignment.state)) continue;
      const caseItem = caseById.get(caseId) ?? cases.find((item) => item.id === caseId || item.radicado === caseId);
      if (!caseItem) continue;
      push({ id:`assignment:${assignment.id}`, kind:'assignment_due', caseId:caseItem.databaseId ?? caseItem.id, caseRadicado:caseItem.radicado, caseSubject:caseItem.subject, title:`Entrega de ${assignment.areaName}`, description:assignment.observations ?? 'Asignación del caso', scheduledAt:assignment.dueAt, dateKey:assignment.dueAt.slice(0,10), state:assignment.state, priority:caseItem.priority, owner:assignment.responsibleName, area:assignment.areaName, progress:assignment.progress, completed:false, overdue:new Date(assignment.dueAt).getTime()<Date.now(), actionUrl:`/cases/${caseItem.radicado}`, metadata:{} });
    }
    for (const subtask of readSubtasks()) {
      if (!subtask.dueAt || ['completed','cancelled'].includes(subtask.state)) continue;
      push({ id:`subtask:${subtask.id}`, kind:'subtask_due', caseId:subtask.caseId, caseRadicado:subtask.caseRadicado, caseSubject:subtask.caseSubject, title:subtask.title, description:subtask.description, scheduledAt:subtask.dueAt, dateKey:subtask.dueAt.slice(0,10), state:subtask.stateLabel, priority:subtask.priority, owner:subtask.responsibleName, area:caseById.get(subtask.caseId)?.area ?? 'Sin área', progress:subtask.progress, completed:false, overdue:new Date(subtask.dueAt).getTime()<Date.now(), actionUrl:`/cases/${subtask.caseRadicado}`, metadata:{} });
    }
    for (const review of readJson<SigcCaseReview[]>(REVIEWS_KEY, [])) {
      if (review.status !== 'pending') continue;
      const caseItem = caseById.get(review.caseId);
      if (!caseItem) continue;
      const scheduledAt = caseItem.dueAt ?? review.requestedAt;
      push({ id:`review:${review.id}`, kind:'review_pending', caseId:review.caseId, caseRadicado:caseItem.radicado, caseSubject:caseItem.subject, title:`Revisión pendiente · ronda ${review.reviewRound}`, description:review.requestNote ?? 'Respuesta pendiente de revisión o aprobación.', scheduledAt, dateKey:scheduledAt.slice(0,10), state:'Pendiente', priority:caseItem.priority, owner:review.reviewerName || 'Sin revisor', area:caseItem.area, progress:caseItem.progress, completed:false, overdue:new Date(scheduledAt).getTime()<Date.now(), actionUrl:`/cases/${caseItem.radicado}`, metadata:{ reviewRound: review.reviewRound } });
    }
    for (const reminder of readJson<SigcCaseReminder[]>(REMINDERS_KEY, [])) {
      const caseItem = caseById.get(reminder.caseId);
      if (!caseItem) continue;
      push({ id:`reminder:${reminder.id}`, kind:'reminder', caseId:reminder.caseId, caseRadicado:caseItem.radicado, caseSubject:caseItem.subject, title:reminder.reminderType === 'manual' ? 'Recordatorio manual' : 'Recordatorio automático', description:reminder.message, scheduledAt:reminder.deliveredAt, dateKey:reminder.deliveredAt.slice(0,10), state:'Enviado', priority:caseItem.priority, owner:reminder.recipientName, area:caseItem.area, progress:caseItem.progress, completed:true, overdue:false, actionUrl:`/cases/${caseItem.radicado}`, metadata:{ reminderType: reminder.reminderType } });
    }

    items.sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt));
    const next7 = Date.now() + 7*86400000;
    return {
      organizationId:'demo-org', timezone:'America/Bogota', from, to,
      summary:{ total:items.length, overdue:items.filter((item)=>item.overdue&&!item.completed).length, dueToday:items.filter((item)=>item.dateKey===todayKey).length, next7Days:items.filter((item)=>{const t=new Date(item.scheduledAt).getTime(); return t>=Date.now()&&t<=next7&&!item.completed;}).length, pendingReviews:items.filter((item)=>item.kind==='review_pending').length },
      items
    };
  },

  async getDashboardAnalytics(): Promise<SigcDashboardAnalytics> {
    const rows = readCases();
    const terminal = new Set(['Cerrado','Cancelado']);
    const open = rows.filter((item) => !terminal.has(item.state));
    const overdue = open.filter((item) => item.sem === 'red');
    const group = (values: SigcCase[], key: (item: SigcCase) => string) => Array.from(values.reduce((map, item) => map.set(key(item), (map.get(key(item)) ?? 0) + 1), new Map<string, number>())).map(([label, value]) => ({ label, value })).sort((a,b) => b.value-a.value);
    const now = new Date();
    const monthly = Array.from({ length: 12 }, (_, offset) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 11 + offset, 1);
      return { month: `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`, label: new Intl.DateTimeFormat('es-CO',{month:'short'}).format(date), created: offset < 9 ? Math.max(0, Math.round(rows.length * (offset + 3) / 20)) : rows.length, closed: offset < 9 ? Math.max(0, Math.round(rows.length * (offset + 1) / 24)) : rows.filter((item) => terminal.has(item.state)).length };
    });
    return {
      organizationId: 'demo-org', generatedAt: new Date().toISOString(),
      summary: { openCases: open.length, closedCases: rows.length-open.length, overdueCases: overdue.length, dueSoonCases: open.filter((item) => item.sem === 'orange').length, createdToday: 0, criticalCases: open.filter((item) => item.priority === 'Crítica').length, slaCompliancePct: 92.4, avgResolutionHours: 34.2 },
      monthly, byArea: group(open,(item)=>item.area), byOwner: group(open,(item)=>item.owner), byType: group(rows,(item)=>item.type), byPriority: group(open,(item)=>item.priority),
      avgResolutionByArea: group(rows.filter((item)=>terminal.has(item.state)), (item)=>item.area).map((item)=>({ ...item, value: 24 + item.value * 2 })),
      productivityByArea: group(rows,(item)=>item.area).map((item)=>{ const created=item.value; const closed=rows.filter((row)=>row.area===item.label&&terminal.has(row.state)).length; return { label:item.label, value:closed, created, closed, closureRatePct:created?Math.round(closed/created*1000)/10:0 }; }),
      criticalCases: open.filter((item)=>item.priority==='Crítica'||item.sem==='red').slice(0,8).map((item)=>({ id:item.databaseId??item.id, radicado:item.radicado, subject:item.subject, priority:item.priority, owner:item.owner, dueAt:item.dueAt, overdue:item.sem==='red' })),
      myWork: readSubtasks().filter((item)=>item.state!=='completed'&&item.state!=='cancelled').slice(0,8).map((item)=>({ id:item.id,title:item.title,caseId:item.caseId,radicado:item.caseRadicado,dueAt:item.dueAt,state:item.state,progress:item.progress })),
      recentActivity: readJson<SigcTimelineEvent[]>(TIMELINE_KEY, []).slice(0,10).map((item,index)=>({ id:item.id??index,eventType:item.eventType,entityType:item.entityType,actor:item.actorName,createdAt:item.createdAt,caseId:item.caseId,radicado:rows.find((row)=>row.databaseId===item.caseId||row.id===item.caseId)?.radicado }))
    };
  },

  async getSidebarSummary(): Promise<SigcSidebarSummary> {
    const dashboard = await this.getDashboardAnalytics();
    return { slaCompliancePct: dashboard.summary.slaCompliancePct, criticalCases: dashboard.summary.criticalCases, overdueCases: dashboard.summary.overdueCases };
  },

  async getNotificationPage(page = 1, pageSize = 25): Promise<SigcNotificationPage> {
    const currentPage = Math.max(1, page);
    const size = Math.min(100, Math.max(5, pageSize));
    const items = [
      { id: 'demo-notification-1', recipientUserId: 'demo-user-admin', actorUserId: null, caseId: readCases()[0]?.databaseId ?? null, type: 'case_due_soon', title: 'Caso próximo a vencer', message: 'Un caso demo requiere seguimiento.', actionUrl: readCases()[0] ? `/cases/${readCases()[0]!.radicado}` : null, isRead: false, createdAt: new Date().toISOString() }
    ];
    return { items: items.slice((currentPage - 1) * size, currentPage * size), total: items.length, unreadTotal: items.filter((item) => !item.isRead).length, page: currentPage, pageSize: size };
  },

  async getReport(filters: SigcReportFilters, page = filters.page ?? 1, pageSize = filters.pageSize ?? 100): Promise<SigcReportResult> {
    const from = new Date(`${filters.from}T00:00:00`).getTime();
    const to = new Date(`${filters.to}T23:59:59`).getTime();
    const terminal = new Set(['Cerrado','Cancelado']);
    let cases = readCases().filter((item) => { const value = new Date(item.openedAt ?? item.updatedAt ?? Date.now()).getTime(); return value >= from && value <= to; });
    if (filters.stateId) cases = cases.filter((item)=>item.stateId===filters.stateId);
    if (filters.areaId) cases = cases.filter((item)=>item.areaId===filters.areaId);
    if (filters.ownerId) cases = cases.filter((item)=>item.ownerId===filters.ownerId);
    if (filters.caseTypeId) cases = cases.filter((item)=>item.typeId===filters.caseTypeId);
    if (filters.priorityId) cases = cases.filter((item)=>item.priorityId===filters.priorityId);
    if (filters.overdueOnly) cases = cases.filter((item)=>item.sem==='red'&&!terminal.has(item.state));
    const group = (key: (item: SigcCase) => string) => Array.from(cases.reduce((map,item)=>map.set(key(item),(map.get(key(item))??0)+1),new Map<string,number>())).map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value);
    const rows = cases.map((item)=>({ id:item.databaseId??item.id,radicado:item.radicado,subject:item.subject,requesterName:item.requester,requesterCompany:item.company,source:item.source,riskLevel:item.risk,openedAt:item.openedAt??item.updatedAt??new Date().toISOString(),dueAt:item.dueAt,closedAt:terminal.has(item.state)?item.updatedAt:null,progress:item.progress,updatedAt:item.updatedAt??new Date().toISOString(),caseType:item.type,state:item.state,priority:item.priority,area:item.area,owner:item.owner,overdue:item.sem==='red'&&!terminal.has(item.state),slaMet:terminal.has(item.state)?item.sem!=='red':null,resolutionHours:null }));
    return {
      organizationId:'demo-org',generatedAt:new Date().toISOString(),from:filters.from,to:filters.to,
      summary:{ totalCases:cases.length,openCases:cases.filter((item)=>!terminal.has(item.state)).length,closedCases:cases.filter((item)=>terminal.has(item.state)).length,overdueCases:cases.filter((item)=>item.sem==='red'&&!terminal.has(item.state)).length,slaCompliancePct:92.4,avgResolutionHours:34.2 },
      byArea:group((item)=>item.area),byOwner:group((item)=>item.owner),byType:group((item)=>item.type),byState:group((item)=>item.state),byPriority:group((item)=>item.priority),
      byRisk:group((item)=>item.risk || 'Sin riesgo'),
      agingBuckets:[{label:'0–7 días',value:3},{label:'8–30 días',value:4},{label:'31–90 días',value:2},{label:'90+ días',value:1}],
      slaByArea:group((item)=>item.area).map((item)=>({...item,total:item.value,compliant:Math.max(0,item.value-1),value:item.value ? Math.round(Math.max(0,item.value-1)/item.value*1000)/10 : 0})),
      throughput:[{month:'2026-05',label:'May 26',created:6,closed:4},{month:'2026-06',label:'Jun 26',created:9,closed:7},{month:'2026-07',label:'Jul 26',created:5,closed:3}],
      rows: rows.slice((Math.max(1,page)-1)*Math.max(1,pageSize), Math.max(1,page)*Math.max(1,pageSize)), totalRows: rows.length, page: Math.max(1,page), pageSize: Math.max(1,pageSize), hasMore: Math.max(1,page)*Math.max(1,pageSize) < rows.length, isTruncated:false
    };
  },

  async createReportExportJob(format: SigcReportExportFormat, filters: SigcReportFilters): Promise<SigcReportExportJob> {
    const report = await this.getReport(filters, 1, 1);
    const id = `demo-export-${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();
    demoReportExportJobs.set(id, { format, filters: { ...filters, page: undefined, pageSize: undefined }, createdAt });
    return { id, format, status: 'processing', totalRows: report.totalRows, processedRows: 0, progressPct: 0, createdAt, updatedAt: createdAt };
  },
  async getReportExportPage(jobId: string, page: number, pageSize: number): Promise<SigcReportExportPage> {
    const saved = demoReportExportJobs.get(jobId);
    if (!saved) throw new Error('El job de exportación demo no existe.');
    const report = await this.getReport(saved.filters, page, pageSize);
    const processed = Math.min(report.totalRows, page * pageSize);
    return { job: { id: jobId, format: saved.format, status: report.hasMore ? 'processing' : 'completed', totalRows: report.totalRows, processedRows: processed, progressPct: report.totalRows ? Math.round(processed/report.totalRows*1000)/10 : 100, createdAt: saved.createdAt, updatedAt: new Date().toISOString() }, rows: report.rows, page, pageSize, hasMore: report.hasMore };
  },
  async completeReportExportJob(jobId: string, _status: 'completed' | 'failed' | 'cancelled', _errorMessage?: string): Promise<void> { demoReportExportJobs.delete(jobId); },

  async getSaasContext(): Promise<SigcSaasContext> {
    const profile = readDemoOrganizationProfile();
    const publicIntake = readDemoPublicIntakeSettings();
    const { name, slug, ...branding } = profile;
    const brandingCompleted = Boolean(
      branding.logoUrl
      || branding.productName !== DEFAULT_ORGANIZATION_PROFILE.productName
      || branding.primaryColor !== DEFAULT_ORGANIZATION_PROFILE.primaryColor
      || branding.accentColor !== DEFAULT_ORGANIZATION_PROFILE.accentColor
      || branding.sidebarColor !== DEFAULT_ORGANIZATION_PROFILE.sidebarColor
    );
    return {
      activeOrganization: {
        id: 'demo-org', name, slug, isActive: true, createdAt: new Date().toISOString(),
        settings: { publicIntake }
      },
      branding,
      subscription: {
        status: 'trialing', trialEndsAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        plan: {
          id: 'business', code: 'business', name: 'Business', description: 'Plan empresarial', monthlyPriceCop: 299000,
          limits: { max_members: 50, max_active_cases: 50000, max_automations: 100, max_storage_bytes: 53687091200, max_owned_organizations: 3 },
          features: { advanced_reports: true, custom_branding: true, email_delivery: true }
        }
      },
      usage: {
        members: members.length,
        cases: readCases().length,
        activeCases: readCases().filter((item) => !['Cerrado', 'Cancelado'].includes(item.state)).length,
        automations: 2,
        storageBytes: readDocuments().reduce((total, item) => total + item.currentSizeBytes, 0)
      },
      organizations: [{ id: 'demo-org', name, slug, roleName: 'Administrador', roleCode: 'admin', planCode: 'business', planName: 'Business', isActive: true }],
      invitations: [],
      onboarding: [
        { code: 'organization', label: 'Configurar organización', completed: true },
        { code: 'branding', label: 'Personalizar identidad visual', completed: brandingCompleted },
        { code: 'members', label: 'Invitar al equipo', completed: true },
        { code: 'workflow', label: 'Configurar flujos', completed: true },
        { code: 'automation', label: 'Activar automatización', completed: true },
        { code: 'first_case', label: 'Gestionar primer caso', completed: readCases().length > 0 }
      ],
      health: { errorsLast24h: 0, auditEvents30d: readJson<SigcTimelineEvent[]>(TIMELINE_KEY, []).length, queuedEmails: 0 },
      canManage: true
    };
  },

  async getSecurityHealth(): Promise<SigcSecurityHealth> {
    return { organizationId: 'demo-org', rlsEnabledTables: 18, auditedTenantTables: 18, tablesWithoutRls: [], policyCount: 42, activeWorkspaceManagers: 1, rateLimitPerHour: 20, challengeMode: 'adaptive', requirePrivacyConsent: true, generatedAt: new Date().toISOString() };
  },

  async getClientPortal(page = 1, pageSize = 10, query = ''): Promise<ClientPortalSnapshot> {
    const normalized = query.trim().toLowerCase();
    const rows = readCases().filter((item) => !normalized || item.radicado.toLowerCase().includes(normalized) || item.subject.toLowerCase().includes(normalized));
    const currentPage = Math.max(1, page);
    const size = Math.min(50, Math.max(5, pageSize));
    const visible = rows.slice((currentPage - 1) * size, currentPage * size).map((item) => ({
      id: item.databaseId ?? item.id, radicado: item.radicado, subject: item.subject, type: item.type, state: item.state, stateColor: item.stateColor, priority: item.priority, priorityColor: item.priorityColor,
      openedAt: item.openedAt ?? new Date().toISOString(), dueAt: item.dueAt, updatedAt: item.updatedAt ?? new Date().toISOString(), progress: item.progress,
      documents: readDocuments().filter((document) => document.caseId === (item.databaseId ?? item.id) && document.clientVisible).map((document) => ({ id: document.id, caseId: document.caseId, name: document.name, currentVersion: document.currentVersion, currentFilename: document.currentFilename, currentStoragePath: document.currentStoragePath, currentMimeType: document.currentMimeType, currentSizeBytes: document.currentSizeBytes, updatedAt: document.updatedAt })),
      deliveries: []
    }));
    const terminal = new Set(['Cerrado', 'Cancelado']);
    return { organizationId: 'demo-org', organizationName: readDemoOrganizationProfile().name, email: 'cliente@sigc.demo', summary: { total: rows.length, open: rows.filter((item) => !terminal.has(item.state)).length, closed: rows.filter((item) => terminal.has(item.state)).length, overdue: rows.filter((item) => item.sem === 'red' && !terminal.has(item.state)).length }, items: visible, total: rows.length, page: currentPage, pageSize: size };
  },

  async getAuthorizationContext(): Promise<SigcAuthorizationContext> {
    return {
      userId: 'demo-user-admin',
      organizationId: 'demo-org',
      membershipId: 'demo-membership-admin',
      isActive: true,
      role: { id: 'demo-role-admin', code: 'admin', name: 'Administrador' },
      permissions: [
        'case.create','case.read_all','case.read_assigned','case.assign','case.change_state','case.override_sla','case.approve','case.close',
        'case.comment','case.manage_subtasks','case.send_reminder','case.review','case.register_delivery',
        'document.upload','document.delete','admin.manage_users','admin.manage_configuration','automation.view','automation.manage',
        'reports.view','reports.export','saas.manage_workspace','quality.view','quality.run'
      ]
    };
  },
  async setActiveOrganization(_organizationId: string): Promise<void> {},
  async updateOrganizationProfile(input: UpdateOrganizationProfileInput): Promise<void> {
    writeJson(ORGANIZATION_PROFILE_KEY, {
      ...input,
      name: input.name.trim(),
      slug: input.slug.trim(),
      productName: input.productName.trim(),
      shortName: input.shortName.trim().slice(0, 12),
      logoUrl: input.logoUrl?.trim() || null,
      supportEmail: input.supportEmail?.trim() || null,
      customDomain: input.customDomain?.trim() || null
    });
  },
  async updatePublicIntakeSettings(input: UpdatePublicIntakeSettingsInput): Promise<void> {
    writeJson(PUBLIC_INTAKE_SETTINGS_KEY, input);
  },
  async createSaasOrganization(_input: CreateSaasOrganizationInput): Promise<string> { return `demo-org-${crypto.randomUUID()}`; },
  async createOrganizationInvitation(input: CreateOrganizationInvitationInput): Promise<CreatedOrganizationInvitation> { return { invitationId:`demo-invite-${crypto.randomUUID()}`,token:crypto.randomUUID(),expiresAt:new Date(Date.now()+(input.expiresDays??7)*86400000).toISOString() }; },
  async revokeOrganizationInvitation(_invitationId: string): Promise<void> {},
  async logClientError(_input: ClientErrorInput): Promise<void> {},
  async getQualityDashboard(): Promise<QualityDashboard> {
    const history = readJson<QualityRunRecord[]>(QUALITY_RUNS_KEY, []);
    const latestRun = history[0] ?? null;
    const summary = latestRun?.summary;
    const scorePct = summary?.total ? Math.round((summary.passed / summary.total) * 1000) / 10 : 0;
    return {
      organizationId: 'demo-org', generatedAt: new Date().toISOString(), latestRun,
      history: history.slice(0, 20).map(({ checks: _checks, ...run }) => run),
      capabilities: [
        { code:'database',label:'Base de datos',available:true,details:'Repositorio demo disponible.' },
        { code:'realtime',label:'Realtime',available:false,details:'No aplica al modo demo.' },
        { code:'scheduler',label:'Scheduler',available:false,details:'No aplica al modo demo.' },
        { code:'email',label:'Transporte de correo',available:false,details:'No aplica al modo demo.' }
      ],
      readiness: { status: latestRun?.status ?? 'not_run', scorePct, blockingFailures: summary?.failed ?? 0, lastRunAt: latestRun?.finishedAt ?? null }
    };
  },
  async runQualitySuite(input: RunQualitySuiteInput): Promise<QualityRunRecord> {
    const startedAt = new Date();
    const checks = input.clientChecks;
    const summary = {
      total: checks.length,
      passed: checks.filter((item)=>item.status==='passed').length,
      warnings: checks.filter((item)=>item.status==='warning').length,
      failed: checks.filter((item)=>item.status==='failed').length,
      skipped: checks.filter((item)=>item.status==='skipped').length
    };
    const status = summary.failed ? 'failed' : summary.warnings ? 'warning' : 'passed';
    const finishedAt = new Date();
    const run: QualityRunRecord = { id:`demo-quality-${crypto.randomUUID()}`,organizationId:'demo-org',status,summary,startedAt:startedAt.toISOString(),finishedAt:finishedAt.toISOString(),durationMs:Math.max(0,finishedAt.getTime()-startedAt.getTime()),initiatedBy:'demo-user-admin',releaseVersion:input.releaseVersion ?? null,checks };
    const history = readJson<QualityRunRecord[]>(QUALITY_RUNS_KEY, []);
    localStorage.setItem(QUALITY_RUNS_KEY, JSON.stringify([run, ...history].slice(0, 20)));
    return run;
  }
};

export const demoPublicSigcRepository: PublicSigcRepository = {
  async getPublicIntakeContext(locator: PublicIntakeLocator): Promise<PublicIntakeContext | null> {
    const profile = readDemoOrganizationProfile();
    const intake = readDemoPublicIntakeSettings();
    if (locator.tenant && locator.tenant !== profile.slug) return null;
    return {
      organizationName: profile.name,
      organizationSlug: profile.slug,
      branding: {
        productName: profile.productName,
        shortName: profile.shortName,
        logoUrl: profile.logoUrl,
        primaryColor: profile.primaryColor,
        accentColor: profile.accentColor,
        supportEmail: profile.supportEmail,
        customDomain: profile.customDomain
      },
      intake: {
        enabled: intake.enabled,
        formTitle: intake.formTitle,
        formDescription: intake.formDescription,
        confirmationMessage: intake.confirmationMessage,
        allowAttachments: intake.allowAttachments,
        maxFiles: intake.maxFiles,
        maxFileSizeBytes: intake.maxFileSizeBytes
      },
      security: {
        rateLimitPerHour: intake.rateLimitPerHour ?? 20,
        challengeMode: intake.challengeMode ?? 'adaptive',
        challengeRequired: intake.challengeMode === 'always',
        challenge: null
      },
      privacy: {
        requireConsent: intake.requirePrivacyConsent ?? true,
        noticeText: intake.privacyNoticeText ?? DEFAULT_PUBLIC_INTAKE_SETTINGS.privacyNoticeText ?? '',
        policyUrl: intake.privacyPolicyUrl?.trim() || null
      },
      caseTypes: catalogs.caseTypes.filter((item) => item.isPublicEnabled).map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description ?? null,
        slaLabel: item.slaLabel ?? 'Sin SLA configurado',
        defaultPriorityName: catalogs.priorities.find((priority) => priority.id === item.defaultPriorityId)?.name ?? null,
        defaultRiskLevel: item.defaultRiskLevel ?? null,
        defaultAreaName: item.defaultAreas?.find((area) => area.isPrimary)?.areaName ?? item.defaultAreas?.[0]?.areaName ?? null,
        fields: item.fields ?? [],
        sla: item.sla ?? null
      }))
    };
  },

  async createPublicCase(input: PublicCaseCreateInput): Promise<PublicCaseSubmissionResult> {
    const result = createCaseBase(input, 'Formulario público', 'Pendiente de Clasificación');
    return { ...result, attachmentCount: input.attachments?.length ?? 0, failedAttachments: [], attachmentSessionFinalized: true };
  },
  async getOrganizationInvitation(_token: string): Promise<PublicOrganizationInvitation | null> { return null; },
  async acceptOrganizationInvitation(_token: string): Promise<string> { return 'demo-org'; }
};
