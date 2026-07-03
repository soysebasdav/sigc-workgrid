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
  /** Identificador estable usado por la UI. En demo coincide con el radicado. */
  id: string;
  /** UUID real de PostgreSQL cuando el registro proviene de Supabase. */
  databaseId?: string;
  radicado: string;
  organizationId?: string;
  type: string;
  subject: string;
  company: string;
  requester: string;
  requesterEmail?: string;
  area: string;
  owner: string;
  state: CaseStateName | string;
  priority: CasePriorityName;
  sla: string;
  due: string;
  sem: SemColor;
  progress: number;
  updated: string;
  risk: string;
  source: string;
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
