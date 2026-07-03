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

export interface SigcRepositoryResult<T> {
  data: T;
  source: SigcDataSource;
  warning?: string;
}
