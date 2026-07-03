import type { LucideIcon } from 'lucide-react';
import {
  Archive,
  BarChart3,
  BellRing,
  Bot,
  Building2,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  Clock,
  Clock3,
  Download,
  FilePlus2,
  FileSearch,
  FileSpreadsheet,
  FileText,
  FileUp,
  Flag,
  FolderKanban,
  Globe2,
  Inbox,
  KanbanSquare,
  Layers3,
  LayoutDashboard,
  ListChecks,
  Mail,
  MessageSquare,
  PieChart,
  PlusCircle,
  RefreshCw,
  Settings,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Tags,
  Timer,
  TimerOff,
  TimerReset,
  Upload,
  UserCheck,
  Users,
  Workflow,
  Zap
} from 'lucide-react';

export type CaseState =
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

export type CasePriority = 'Crítica' | 'Alta' | 'Media' | 'Baja';
export type SemColor = 'green' | 'yellow' | 'orange' | 'red';

export interface SigcCase {
  id: string;
  type: string;
  subject: string;
  company: string;
  requester: string;
  area: string;
  owner: string;
  state: CaseState;
  priority: CasePriority;
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
  priority: CasePriority;
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

export const navItems: Array<{ to: string; label: string; icon: LucideIcon }> = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/cases', label: 'Bandeja de casos', icon: Inbox },
  { to: '/case-detail', label: 'Detalle del caso', icon: FileSearch },
  { to: '/public-form', label: 'Formulario público', icon: Globe2 },
  { to: '/manual-case', label: 'Creación manual', icon: FilePlus2 },
  { to: '/board', label: 'Cronograma / tablero', icon: KanbanSquare },
  { to: '/subtasks', label: 'Subtareas', icon: ListChecks },
  { to: '/tasks', label: 'Tareas anteriores', icon: CheckSquare },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/documents', label: 'Gestión documental', icon: FolderKanban },
  { to: '/reports', label: 'Reportes', icon: BarChart3 },
  { to: '/notifications', label: 'Notificaciones', icon: BellRing },
  { to: '/users', label: 'Usuarios', icon: Users },
  { to: '/settings', label: 'Configuración', icon: Settings },
  { to: '/admin', label: 'Administración SIGC', icon: Settings }
];

export const areaTones: Record<string, string> = {
  Jurídica: 'tone-purple',
  Nómina: 'tone-pink',
  Tecnología: 'tone-blue',
  Comercial: 'tone-emerald',
  Operaciones: 'tone-orange',
  Gerencia: 'tone-dark',
  'Administrativa y Financiera': 'tone-amber',
  'Talento Humano': 'tone-rose',
  SDG: 'tone-cyan'
};

export const stateTones: Record<CaseState | string, string> = {
  'Pendiente de Clasificación': 'tone-slate',
  Clasificado: 'tone-indigo',
  Asignado: 'tone-blue',
  'En Gestión': 'tone-cyan',
  'Pendiente de Información': 'tone-yellow',
  'Respuesta Elaborada': 'tone-violet',
  'En Revisión / Aprobación': 'tone-purple',
  'Devuelto para Ajustes': 'tone-orange',
  Aprobado: 'tone-emerald',
  Enviado: 'tone-teal',
  Cerrado: 'tone-green',
  Cancelado: 'tone-red',
  Pendiente: 'tone-yellow',
  'En Revisión': 'tone-purple',
  Devuelto: 'tone-orange',
  Vigente: 'tone-blue',
  Cargado: 'tone-cyan'
};

export const priorityTones: Record<CasePriority, string> = {
  Crítica: 'tone-red',
  Alta: 'tone-orange',
  Media: 'tone-yellow',
  Baja: 'tone-emerald'
};

export const cases: SigcCase[] = [
  {
    id: 'SIG-2026-000001',
    type: 'Reclamo contractual',
    subject: 'Incumplimiento de cláusula de servicio en contrato de vigilancia',
    company: 'Altavista Seguridad Ltda.',
    requester: 'Camila Torres',
    area: 'Jurídica',
    owner: 'Laura Méndez',
    state: 'En Gestión',
    priority: 'Alta',
    sla: '3 días',
    due: '2026-07-06',
    sem: 'orange',
    progress: 68,
    updated: 'Hace 18 min',
    risk: 'Próximo a vencer',
    source: 'Formulario público'
  },
  {
    id: 'SIG-2026-000002',
    type: 'Solicitud de nómina',
    subject: 'Corrección de liquidación y soporte de pago',
    company: 'Cliente interno',
    requester: 'Andrés Rojas',
    area: 'Nómina',
    owner: 'Mónica Díaz',
    state: 'Pendiente de Información',
    priority: 'Media',
    sla: '5 días',
    due: '2026-07-09',
    sem: 'yellow',
    progress: 42,
    updated: 'Hace 1 h',
    risk: 'Atención media',
    source: 'Correo institucional'
  },
  {
    id: 'SIG-2026-000003',
    type: 'Acción de Tutela',
    subject: 'Respuesta urgente a juzgado por derecho de petición',
    company: 'Juzgado 18 Civil',
    requester: 'Secretaría Judicial',
    area: 'Jurídica',
    owner: 'Felipe Vargas',
    state: 'En Revisión / Aprobación',
    priority: 'Crítica',
    sla: '24 horas',
    due: '2026-07-04',
    sem: 'red',
    progress: 84,
    updated: 'Hace 8 min',
    risk: 'Crítico',
    source: 'Ventanilla judicial'
  },
  {
    id: 'SIG-2026-000004',
    type: 'Requerimiento interno',
    subject: 'Habilitación de permisos para aplicativo operativo',
    company: 'Operaciones Norte',
    requester: 'Paola Medina',
    area: 'Tecnología',
    owner: 'Julián Pérez',
    state: 'Asignado',
    priority: 'Baja',
    sla: '7 días',
    due: '2026-07-12',
    sem: 'green',
    progress: 15,
    updated: 'Ayer',
    risk: 'En tiempo',
    source: 'Mesa de ayuda'
  },
  {
    id: 'SIG-2026-000005',
    type: 'Hallazgo de auditoría',
    subject: 'Ajuste de evidencias en proceso de control interno',
    company: 'Auditoría Interna',
    requester: 'Sergio Linares',
    area: 'Operaciones',
    owner: 'Natalia Bernal',
    state: 'Devuelto para Ajustes',
    priority: 'Alta',
    sla: '10 días',
    due: '2026-07-08',
    sem: 'yellow',
    progress: 57,
    updated: 'Hace 3 h',
    risk: 'Seguimiento',
    source: 'Carga manual'
  },
  {
    id: 'SIG-2026-000006',
    type: 'Contrato',
    subject: 'Revisión de otrosí y matriz de riesgos',
    company: 'Seguridad Global S.A.S.',
    requester: 'Diana Castillo',
    area: 'Comercial',
    owner: 'Mateo Ortiz',
    state: 'Respuesta Elaborada',
    priority: 'Media',
    sla: '6 días',
    due: '2026-07-11',
    sem: 'green',
    progress: 73,
    updated: 'Hoy 08:20',
    risk: 'En tiempo',
    source: 'SharePoint'
  },
  {
    id: 'SIG-2026-000007',
    type: 'Proceso Judicial',
    subject: 'Contestación de demanda laboral',
    company: 'Tribunal Superior',
    requester: 'Despacho 05',
    area: 'Jurídica',
    owner: 'Laura Méndez',
    state: 'Pendiente de Clasificación',
    priority: 'Crítica',
    sla: '48 horas',
    due: '2026-07-05',
    sem: 'orange',
    progress: 10,
    updated: 'Hoy 07:40',
    risk: 'Próximo a vencer',
    source: 'Correo certificado'
  }
];

export const subtasks: Subtask[] = [
  { title: 'Validar competencia y anexos', owner: 'Felipe Vargas', due: '2026-07-04', state: 'En Gestión', priority: 'Crítica', progress: 78, caseId: 'SIG-2026-000003', comments: 3, attachments: 2 },
  { title: 'Solicitar soporte de pago', owner: 'Mónica Díaz', due: '2026-07-06', state: 'Pendiente', priority: 'Media', progress: 35, caseId: 'SIG-2026-000002', comments: 1, attachments: 0 },
  { title: 'Revisión jurídica final', owner: 'Laura Méndez', due: '2026-07-05', state: 'En Revisión', priority: 'Alta', progress: 86, caseId: 'SIG-2026-000003', comments: 5, attachments: 4 },
  { title: 'Cargar nueva versión de respuesta', owner: 'Natalia Bernal', due: '2026-07-08', state: 'Devuelto', priority: 'Alta', progress: 52, caseId: 'SIG-2026-000005', comments: 2, attachments: 1 },
  { title: 'Parametrizar permisos', owner: 'Julián Pérez', due: '2026-07-12', state: 'Asignado', priority: 'Baja', progress: 12, caseId: 'SIG-2026-000004', comments: 0, attachments: 0 }
];

export const documents: DocumentRecord[] = [
  { name: 'Respuesta tutela.pdf', type: 'PDF', version: 'v3', owner: 'Felipe Vargas', date: '2026-07-03 09:12', state: 'En revisión', caseId: 'SIG-2026-000003' },
  { name: 'Contrato marco.docx', type: 'Word', version: 'v2', owner: 'Laura Méndez', date: '2026-07-02 16:40', state: 'Aprobado', caseId: 'SIG-2026-000006' },
  { name: 'Evidencias auditoría.xlsx', type: 'Excel', version: 'v1', owner: 'Natalia Bernal', date: '2026-07-01 11:22', state: 'Devuelto', caseId: 'SIG-2026-000005' },
  { name: 'Soporte de nómina.pdf', type: 'PDF', version: 'v4', owner: 'Mónica Díaz', date: '2026-07-03 10:04', state: 'Vigente', caseId: 'SIG-2026-000002' },
  { name: 'Anexos juzgado.zip', type: 'Adjuntos', version: 'v1', owner: 'Felipe Vargas', date: '2026-07-03 08:50', state: 'Cargado', caseId: 'SIG-2026-000003' }
];

export const timeline: TimelineItem[] = [
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

export const reportMonths = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const reportValues = [46, 52, 38, 60, 72, 66, 81, 75, 96, 88, 104, 93];

export const areaDistribution = [
  ['Jurídica', 34],
  ['Operaciones', 22],
  ['Nómina', 15],
  ['Tecnología', 14],
  ['Comercial', 9],
  ['Otros', 6]
] as const;

export const adminModules: Array<{ title: string; value: string; icon: LucideIcon }> = [
  { title: 'Áreas', value: '10 activas', icon: Building2 },
  { title: 'Tipos de caso', value: '12 configurados', icon: Layers3 },
  { title: 'Estados', value: '12 parametrizados', icon: Workflow },
  { title: 'Prioridades', value: '4 niveles', icon: Flag },
  { title: 'Usuarios', value: '86 usuarios', icon: Users },
  { title: 'Roles', value: '6 perfiles', icon: Shield },
  { title: 'SLA', value: '18 reglas', icon: Timer },
  { title: 'Plantillas de correo', value: '14 plantillas', icon: Mail },
  { title: 'Notificaciones', value: '9 eventos', icon: BellRing },
  { title: 'Automatizaciones', value: '7 reglas', icon: Bot }
];

export const exportActions = [Download, FileSpreadsheet, FileText, SlidersHorizontal, Upload, CalendarCheck, PieChart, Zap, Archive];
