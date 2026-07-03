import type { LucideIcon } from 'lucide-react';

export type CaseStateName =
  | 'Pendiente de Clasificación'
  | 'Clasificado'
  | 'Asignado'
  | 'En Gestión'
  | 'Pendiente de Información'
  | 'Respuesta Elaborada'
  | 'En Revisión / Aprobación'
  | 'Devuelto para Ajustes'
  | 'Aprobado'
  | 'Enviado'
  | 'Cerrado'
  | 'Cancelado';

export type CasePriorityName = 'Crítica' | 'Alta' | 'Media' | 'Baja';
export type SemColor = 'green' | 'yellow' | 'orange' | 'red';
export type SigcDataSource = 'demo' | 'supabase';

export interface SigcCase {
  id: string;
  databaseId?: string;
  radicado: string;
  organizationId?: string;
  typeId?: string;
  type: string;
  subject: string;
  description?: string;
  company: string;
  requester: string;
  requesterDocument?: string;
  requesterEmail?: string;
  requesterPhone?: string;
  areaId?: string;
  area: string;
  ownerId?: string;
  owner: string;
  stateId?: string;
  state: CaseStateName | string;
  priorityId?: string;
  priority: CasePriorityName;
  slaPolicyId?: string;
  sla: string;
  openedAt?: string;
  dueAt?: string | null;
  due: string;
  sem: SemColor;
  progress: number;
  updatedAt?: string;
  updated: string;
  risk: string;
  source: string;
}

export interface SigcCaseFilters {
  query?: string;
  stateId?: string;
  areaId?: string;
  ownerId?: string;
  caseTypeId?: string;
  priorityId?: string;
  overdueOnly?: boolean;
  upcomingOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export interface SigcCasePage {
  items: SigcCase[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PublicCaseTypeOption {
  id: string;
  name: string;
  description?: string | null;
  slaLabel: string;
}

export interface PublicCaseCreateInput {
  caseTypeId: string;
  requesterName: string;
  requesterCompany: string;
  requesterDocument: string;
  requesterEmail: string;
  requesterPhone: string;
  subject: string;
  description: string;
  website?: string;
}

export interface ManualCaseAssignmentInput {
  areaId: string;
  responsibleUserId?: string;
  dueAt?: string;
  observations?: string;
}

export interface ManualCaseCreateInput {
  caseTypeId: string;
  priorityId: string;
  requesterName: string;
  requesterCompany: string;
  requesterDocument: string;
  requesterEmail: string;
  requesterPhone: string;
  subject: string;
  description: string;
  riskLevel?: string;
  assignments: ManualCaseAssignmentInput[];
}

export interface CreatedCaseResult {
  caseId: string;
  radicado: string;
  dueAt: string | null;
}

export interface SigcMember {
  userId: string;
  name: string;
  email: string;
  roleName: string;
}

export interface SigcAssignment {
  id: string;
  areaId: string;
  areaName: string;
  responsibleUserId?: string;
  responsibleName: string;
  dueAt?: string | null;
  due: string;
  state: string;
  observations?: string | null;
  progress: number;
  isPrimary: boolean;
}

export interface AllowedCaseState {
  id: string;
  name: string;
  code: string;
  color?: string | null;
  requiresJustification: boolean;
}

export interface CaseAssignmentInput {
  caseId: string;
  areaId: string;
  responsibleUserId?: string;
  dueAt?: string;
  observations?: string;
  isPrimary?: boolean;
}

export interface ChangeCaseStateInput {
  caseId: string;
  toStateId: string;
  justification?: string;
}

export interface Subtask {
  title: string;
  owner: string;
  due: string;
  state: string;
  priority: CasePriorityName;
  progress: number;
  caseId: string;
  comments: number;
  attachments: number;
}

export interface DocumentRecord {
  name: string;
  type: string;
  version: string;
  owner: string;
  date: string;
  state: string;
  caseId: string;
}

export interface TimelineItem {
  title: string;
  description: string;
  actor: string;
  date: string;
  icon: LucideIcon;
}

export interface SigcCatalogOption {
  id: string;
  name: string;
  code?: string;
  color?: string | null;
  isActive?: boolean;
}

export interface SigcCatalogs {
  organizationId: string | null;
  areas: SigcCatalogOption[];
  caseTypes: SigcCatalogOption[];
  states: SigcCatalogOption[];
  priorities: SigcCatalogOption[];
  roles: SigcCatalogOption[];
}


export type SubtaskState = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface SigcSubtask {
  id: string;
  caseId: string;
  caseRadicado: string;
  caseSubject: string;
  title: string;
  description: string;
  responsibleUserId?: string;
  responsibleName: string;
  priorityId?: string;
  priority: CasePriorityName;
  dueAt?: string | null;
  due: string;
  state: SubtaskState;
  stateLabel: string;
  progress: number;
  comments: number;
  attachments: number;
  createdAt: string;
  updatedAt: string;
}

export interface SigcSubtaskFilters {
  caseId?: string;
  query?: string;
  state?: SubtaskState | '';
  responsibleUserId?: string;
}

export interface CreateSubtaskInput {
  caseId: string;
  title: string;
  description: string;
  responsibleUserId?: string;
  dueAt?: string;
  priorityId?: string;
  files?: File[];
}

export interface UpdateSubtaskInput {
  subtaskId: string;
  caseId: string;
  title: string;
  description: string;
  responsibleUserId?: string;
  dueAt?: string;
  priorityId?: string;
  state: SubtaskState;
  progress: number;
  files?: File[];
}

export interface CreatedSubtaskResult {
  subtaskId: string;
}

export interface SigcComment {
  id: string;
  caseId: string;
  subtaskId?: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
  createdLabel: string;
  attachmentCount: number;
}

export interface AddCommentInput {
  caseId: string;
  content: string;
  subtaskId?: string;
  files?: File[];
}

export interface CreatedCommentResult {
  commentId: string;
}

export interface SigcDocument {
  id: string;
  caseId: string;
  caseRadicado: string;
  caseSubject: string;
  subtaskId?: string;
  commentId?: string;
  name: string;
  category: string;
  state: string;
  currentVersion: number;
  ownerId?: string;
  ownerName: string;
  createdAt: string;
  updatedAt: string;
  date: string;
  currentFilename: string;
  currentStoragePath: string;
  currentMimeType?: string;
  currentSizeBytes: number;
}

export interface UploadCaseDocumentInput {
  caseId: string;
  name: string;
  category: string;
  state?: string;
  file: File;
  changeNotes?: string;
  subtaskId?: string;
  commentId?: string;
}

export interface AddDocumentVersionInput {
  documentId: string;
  caseId: string;
  currentVersion: number;
  file: File;
  changeNotes?: string;
}

export interface SigcTimelineEvent {
  id: string;
  caseId: string;
  eventType: string;
  entityType: string;
  title: string;
  description: string;
  actorId?: string;
  actorName: string;
  createdAt: string;
  date: string;
}

export interface SigcRepositoryResult<T> {
  data: T;
  source: SigcDataSource;
  warning?: string;
}

export interface SigcSlaOverride {
  id: string;
  caseId: string;
  previousDueAt?: string | null;
  newDueAt: string;
  justification: string;
  changedBy?: string;
  changedByName: string;
  changedAt: string;
  changedLabel: string;
}

export interface OverrideCaseSlaInput {
  caseId: string;
  newDueAt: string;
  justification: string;
}

export interface SigcCaseReview {
  id: string;
  caseId: string;
  reviewRound: number;
  status: 'pending' | 'approved' | 'returned' | 'cancelled';
  requestedBy?: string;
  requestedByName: string;
  reviewerUserId?: string;
  reviewerName: string;
  requestNote?: string;
  requestedAt: string;
  requestedLabel: string;
  decidedBy?: string;
  decidedByName?: string;
  decisionComments?: string;
  decidedAt?: string;
  decidedLabel?: string;
}

export interface SubmitCaseReviewInput {
  caseId: string;
  reviewerUserId?: string;
  note?: string;
}

export interface DecideCaseReviewInput {
  reviewId: string;
  decision: 'approved' | 'returned';
  comments?: string;
}

export interface SigcCaseDelivery {
  id: string;
  caseId: string;
  channel: 'email' | 'physical' | 'portal' | 'courier' | 'other';
  recipient: string;
  reference?: string;
  notes?: string;
  deliveredBy?: string;
  deliveredByName: string;
  deliveredAt: string;
  deliveredLabel: string;
}

export interface RegisterCaseDeliveryInput {
  caseId: string;
  channel: SigcCaseDelivery['channel'];
  recipient: string;
  reference?: string;
  notes?: string;
}

export interface SigcCaseReminder {
  id: string;
  caseId: string;
  ruleName?: string;
  recipientUserId?: string;
  recipientName: string;
  reminderType: 'automatic' | 'manual';
  message: string;
  sentBy?: string;
  sentByName: string;
  deliveredAt: string;
  deliveredLabel: string;
}

export interface SendManualReminderInput {
  caseId: string;
  message: string;
  recipientUserIds?: string[];
}
