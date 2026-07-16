import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  BellRing,
  Bot,
  BookOpen,
  Building2,
  CalendarDays,
  Cloud,
  UserCog,
  FilePlus2,
  Flag,
  FolderKanban,
  Globe2,
  HeartPulse,
  Inbox,
  KanbanSquare,
  Layers3,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  Mail,
  Network,
  Languages,
  FileKey2,
  Settings,
  Shield,
  Timer,
  Users,
  Workflow,
  WalletCards
} from 'lucide-react';
import { CASE_READ_PERMISSIONS, PERMISSIONS, type PermissionCode } from '../authz/permissions';

export type SigcNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  externalShell?: boolean;
  anyOf?: readonly PermissionCode[];
  allOf?: readonly PermissionCode[];
};

export const navItems: SigcNavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, allOf: [PERMISSIONS.reportsView] },
  { to: '/portal', label: 'Mis casos', icon: UserCog, allOf: [PERMISSIONS.clientPortal] },
  { to: '/cases', label: 'Bandeja de casos', icon: Inbox, anyOf: CASE_READ_PERMISSIONS },
  { to: '/manual-case', label: 'Creación manual', icon: FilePlus2, allOf: [PERMISSIONS.caseCreate] },
  { to: '/radicar', label: 'Formulario público', icon: Globe2, externalShell: true },
  { to: '/board', label: 'Cronograma / tablero', icon: KanbanSquare, anyOf: CASE_READ_PERMISSIONS },
  { to: '/subtasks', label: 'Subtareas', icon: ListChecks, anyOf: CASE_READ_PERMISSIONS },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays, anyOf: CASE_READ_PERMISSIONS },
  { to: '/documents', label: 'Gestión documental', icon: FolderKanban, anyOf: CASE_READ_PERMISSIONS },
  { to: '/reports', label: 'Reportes', icon: BarChart3, allOf: [PERMISSIONS.reportsView] },
  { to: '/audit', label: 'Auditoría', icon: Shield, allOf: [PERMISSIONS.auditView] },
  { to: '/quality', label: 'Calidad y producción', icon: HeartPulse, allOf: [PERMISSIONS.qualityView] },
  { to: '/workspace', label: 'Espacio SaaS', icon: Cloud, allOf: [PERMISSIONS.saasManageWorkspace] },
  { to: '/subscription', label: 'Suscripción y facturación', icon: WalletCards, allOf: [PERMISSIONS.saasManageWorkspace] },
  { to: '/integrations', label: 'Integraciones', icon: Network, allOf: [PERMISSIONS.integrationsView] },
  { to: '/privacy', label: 'Privacidad', icon: FileKey2, allOf: [PERMISSIONS.privacyView] },
  { to: '/regional', label: 'Región e idioma', icon: Languages, allOf: [PERMISSIONS.regionalView] },
  { to: '/notifications', label: 'Notificaciones', icon: BellRing },
  { to: '/help', label: 'Centro de ayuda', icon: BookOpen },
  { to: '/support', label: 'Enviar ticket', icon: LifeBuoy },
  { to: '/users', label: 'Usuarios', icon: Users, allOf: [PERMISSIONS.adminManageUsers] },
  { to: '/settings', label: 'Configuración', icon: Settings, allOf: [PERMISSIONS.adminManageConfiguration] },
  { to: '/admin', label: 'Administración SIGC', icon: Settings, allOf: [PERMISSIONS.adminManageConfiguration] }
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

export const stateTones: Record<string, string> = {
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

export const priorityTones: Record<string, string> = {
  Crítica: 'tone-red',
  Alta: 'tone-orange',
  Media: 'tone-yellow',
  Baja: 'tone-emerald'
};


const fallbackTonePalette = ['tone-blue', 'tone-purple', 'tone-emerald', 'tone-orange', 'tone-cyan', 'tone-amber', 'tone-rose', 'tone-indigo'];

export function toneFromCatalog(color: string | null | undefined, name: string, fallback = 'tone-slate'): string {
  if (color?.startsWith('tone-')) return color;
  const predefined = stateTones[name] ?? priorityTones[name] ?? areaTones[name];
  if (predefined) return predefined;
  if (!name) return fallback;
  const hash = [...name].reduce((total, char) => ((total * 31) + char.charCodeAt(0)) >>> 0, 0);
  return fallbackTonePalette[hash % fallbackTonePalette.length] ?? fallback;
}

export function isStateCode(code: string | null | undefined, expected: string): boolean {
  return String(code ?? '').trim().toUpperCase() === expected.trim().toUpperCase();
}

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
