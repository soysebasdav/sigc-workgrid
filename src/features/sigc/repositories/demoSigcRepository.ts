import { demoCases } from '../demoData';
import type { SigcCase, SigcCatalogs } from '../domain/types';
import type { SigcRepository } from './types';

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

export const demoSigcRepository: SigcRepository = {
  async listCases(): Promise<SigcCase[]> {
    return demoCases;
  },

  async getCaseByIdentifier(identifier: string): Promise<SigcCase | null> {
    const normalized = decodeURIComponent(identifier).toLowerCase();
    return demoCases.find((item) => item.id.toLowerCase() === normalized || item.radicado.toLowerCase() === normalized) ?? null;
  },

  async getCatalogs(): Promise<SigcCatalogs> {
    return catalogs;
  }
};
