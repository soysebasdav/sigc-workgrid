import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  BellRing,
  Bot,
  Building2,
  CalendarDays,
  FilePlus2,
  Flag,
  FolderKanban,
  Globe2,
  Inbox,
  KanbanSquare,
  Layers3,
  LayoutDashboard,
  ListChecks,
  Mail,
  Settings,
  Shield,
  Timer,
  Users,
  Workflow
} from 'lucide-react';
import type { CasePriorityName, CaseStateName } from './domain/types';

export const navItems: Array<{ to: string; label: string; icon: LucideIcon; externalShell?: boolean }> = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/cases', label: 'Bandeja de casos', icon: Inbox },
  { to: '/manual-case', label: 'Creación manual', icon: FilePlus2 },
  { to: '/radicar', label: 'Formulario público', icon: Globe2, externalShell: true },
  { to: '/board', label: 'Cronograma / tablero', icon: KanbanSquare },
  { to: '/subtasks', label: 'Subtareas', icon: ListChecks },
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

export const stateTones: Record<CaseStateName | string, string> = {
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

export const priorityTones: Record<CasePriorityName, string> = {
  Crítica: 'tone-red',
  Alta: 'tone-orange',
  Media: 'tone-yellow',
  Baja: 'tone-emerald'
};

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
  { title: 'Áreas', value: 'Parametrizables', icon: Building2 },
  { title: 'Tipos de caso', value: 'Parametrizables', icon: Layers3 },
  { title: 'Estados', value: 'Por flujo', icon: Workflow },
  { title: 'Prioridades', value: 'Configurables', icon: Flag },
  { title: 'Usuarios', value: 'Por organización', icon: Users },
  { title: 'Roles', value: '6 perfiles base', icon: Shield },
  { title: 'SLA', value: 'Por tipo de caso', icon: Timer },
  { title: 'Plantillas de correo', value: 'Preparado', icon: Mail },
  { title: 'Notificaciones', value: 'Preparado', icon: BellRing },
  { title: 'Automatizaciones', value: 'Base de eventos', icon: Bot }
];
