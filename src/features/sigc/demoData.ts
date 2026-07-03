import {
  CheckCircle2,
  Clock,
  Clock3,
  FileUp,
  Inbox,
  MessageSquare,
  PlusCircle,
  RefreshCw,
  ShieldCheck,
  Tags,
  Timer,
  TimerOff,
  UserCheck
} from 'lucide-react';
import type { DocumentRecord, SigcCase, Subtask, TimelineItem } from './domain/types';

export const demoCases: SigcCase[] = [
  {
    id: 'SIG-2026-000001', radicado: 'SIG-2026-000001', type: 'Reclamo contractual', subject: 'Incumplimiento de cláusula de servicio en contrato de vigilancia',
    company: 'Altavista Seguridad Ltda.', requester: 'Camila Torres', requesterEmail: 'camila@altavista.co', area: 'Jurídica', owner: 'Laura Méndez', state: 'En Gestión',
    priority: 'Alta', sla: '3 días', due: '2026-07-06', sem: 'orange', progress: 68, updated: 'Hace 18 min', risk: 'Próximo a vencer', source: 'Formulario público'
  },
  {
    id: 'SIG-2026-000002', radicado: 'SIG-2026-000002', type: 'Solicitud de nómina', subject: 'Corrección de liquidación y soporte de pago',
    company: 'Cliente interno', requester: 'Andrés Rojas', requesterEmail: 'andres@empresa.co', area: 'Nómina', owner: 'Mónica Díaz', state: 'Pendiente de Información',
    priority: 'Media', sla: '5 días', due: '2026-07-09', sem: 'yellow', progress: 42, updated: 'Hace 1 h', risk: 'Atención media', source: 'Correo institucional'
  },
  {
    id: 'SIG-2026-000003', radicado: 'SIG-2026-000003', type: 'Acción de Tutela', subject: 'Respuesta urgente a juzgado por derecho de petición',
    company: 'Juzgado 18 Civil', requester: 'Secretaría Judicial', requesterEmail: 'secretaria.judicial@rama.gov.co', area: 'Jurídica', owner: 'Felipe Vargas', state: 'En Revisión / Aprobación',
    priority: 'Crítica', sla: '24 horas', due: '2026-07-04', sem: 'red', progress: 84, updated: 'Hace 8 min', risk: 'Crítico', source: 'Ventanilla judicial'
  },
  {
    id: 'SIG-2026-000004', radicado: 'SIG-2026-000004', type: 'Requerimiento interno', subject: 'Habilitación de permisos para aplicativo operativo',
    company: 'Operaciones Norte', requester: 'Paola Medina', area: 'Tecnología', owner: 'Julián Pérez', state: 'Asignado', priority: 'Baja', sla: '7 días', due: '2026-07-12',
    sem: 'green', progress: 15, updated: 'Ayer', risk: 'En tiempo', source: 'Mesa de ayuda'
  },
  {
    id: 'SIG-2026-000005', radicado: 'SIG-2026-000005', type: 'Hallazgo de auditoría', subject: 'Ajuste de evidencias en proceso de control interno',
    company: 'Auditoría Interna', requester: 'Sergio Linares', area: 'Operaciones', owner: 'Natalia Bernal', state: 'Devuelto para Ajustes', priority: 'Alta', sla: '10 días',
    due: '2026-07-08', sem: 'yellow', progress: 57, updated: 'Hace 3 h', risk: 'Seguimiento', source: 'Carga manual'
  },
  {
    id: 'SIG-2026-000006', radicado: 'SIG-2026-000006', type: 'Contrato', subject: 'Revisión de otrosí y matriz de riesgos',
    company: 'Seguridad Global S.A.S.', requester: 'Diana Castillo', area: 'Comercial', owner: 'Mateo Ortiz', state: 'Respuesta Elaborada', priority: 'Media', sla: '6 días',
    due: '2026-07-11', sem: 'green', progress: 73, updated: 'Hoy 08:20', risk: 'En tiempo', source: 'SharePoint'
  },
  {
    id: 'SIG-2026-000007', radicado: 'SIG-2026-000007', type: 'Proceso Judicial', subject: 'Contestación de demanda laboral',
    company: 'Tribunal Superior', requester: 'Despacho 05', area: 'Jurídica', owner: 'Laura Méndez', state: 'Pendiente de Clasificación', priority: 'Crítica', sla: '48 horas',
    due: '2026-07-05', sem: 'orange', progress: 10, updated: 'Hoy 07:40', risk: 'Próximo a vencer', source: 'Correo certificado'
  }
];

export const demoSubtasks: Subtask[] = [
  { title: 'Validar competencia y anexos', owner: 'Felipe Vargas', due: '2026-07-04', state: 'En Gestión', priority: 'Crítica', progress: 78, caseId: 'SIG-2026-000003', comments: 3, attachments: 2 },
  { title: 'Solicitar soporte de pago', owner: 'Mónica Díaz', due: '2026-07-06', state: 'Pendiente', priority: 'Media', progress: 35, caseId: 'SIG-2026-000002', comments: 1, attachments: 0 },
  { title: 'Revisión jurídica final', owner: 'Laura Méndez', due: '2026-07-05', state: 'En Revisión', priority: 'Alta', progress: 86, caseId: 'SIG-2026-000003', comments: 5, attachments: 4 },
  { title: 'Cargar nueva versión de respuesta', owner: 'Natalia Bernal', due: '2026-07-08', state: 'Devuelto', priority: 'Alta', progress: 52, caseId: 'SIG-2026-000005', comments: 2, attachments: 1 },
  { title: 'Parametrizar permisos', owner: 'Julián Pérez', due: '2026-07-12', state: 'Asignado', priority: 'Baja', progress: 12, caseId: 'SIG-2026-000004', comments: 0, attachments: 0 }
];

export const demoDocuments: DocumentRecord[] = [
  { name: 'Respuesta tutela.pdf', type: 'PDF', version: 'v3', owner: 'Felipe Vargas', date: '2026-07-03 09:12', state: 'En revisión', caseId: 'SIG-2026-000003' },
  { name: 'Contrato marco.docx', type: 'Word', version: 'v2', owner: 'Laura Méndez', date: '2026-07-02 16:40', state: 'Aprobado', caseId: 'SIG-2026-000006' },
  { name: 'Evidencias auditoría.xlsx', type: 'Excel', version: 'v1', owner: 'Natalia Bernal', date: '2026-07-01 11:22', state: 'Devuelto', caseId: 'SIG-2026-000005' },
  { name: 'Soporte de nómina.pdf', type: 'PDF', version: 'v4', owner: 'Mónica Díaz', date: '2026-07-03 10:04', state: 'Vigente', caseId: 'SIG-2026-000002' },
  { name: 'Anexos juzgado.zip', type: 'Adjuntos', version: 'v1', owner: 'Felipe Vargas', date: '2026-07-03 08:50', state: 'Cargado', caseId: 'SIG-2026-000003' }
];

export const demoTimeline: TimelineItem[] = [
  { title: 'Caso creado', description: 'El formulario público generó el radicado y envió confirmación automática.', actor: 'Sistema', date: '2026-07-03 08:14', icon: PlusCircle },
  { title: 'Clasificado', description: 'Se definió tipo Acción de Tutela, prioridad Crítica y SLA 24 horas.', actor: 'Coordinador Jurídico', date: '2026-07-03 08:24', icon: Tags },
  { title: 'Asignado', description: 'Asignado a Felipe Vargas y Laura Méndez como revisora.', actor: 'Laura Méndez', date: '2026-07-03 08:31', icon: UserCheck },
  { title: 'Documento cargado', description: 'Se cargó Respuesta tutela.pdf versión v3.', actor: 'Felipe Vargas', date: '2026-07-03 09:12', icon: FileUp },
  { title: 'Estado cambiado', description: 'De En Gestión a En Revisión / Aprobación.', actor: 'Felipe Vargas', date: '2026-07-03 10:05', icon: RefreshCw },
  { title: 'SLA modificado', description: 'Se ajustó la fecha límite con justificación: término judicial prioritario.', actor: 'Administrador', date: '2026-07-03 10:21', icon: Clock3 },
  { title: 'Comentario agregado', description: 'Revisar anexos antes del envío al juzgado.', actor: 'Laura Méndez', date: '2026-07-03 10:38', icon: MessageSquare }
];

export const dashboardKpis = [
  { label: 'Casos abiertos', value: '128', icon: Inbox, helper: '+14 esta semana' },
  { label: 'Vencidos', value: '9', icon: TimerOff, helper: '3 críticos jurídicos', danger: true },
  { label: 'Próximos a vencer', value: '21', icon: Timer, helper: 'menos de 48 horas' },
  { label: 'Cerrados', value: '342', icon: CheckCircle2, helper: 'mes actual' },
  { label: 'Cumplimiento SLA', value: '92.4%', icon: ShieldCheck, helper: 'objetivo 95%' },
  { label: 'Tiempo promedio', value: '18.6 h', icon: Clock, helper: 'respuesta inicial' }
];
