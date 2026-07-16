import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArchiveRestore,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  DatabaseBackup,
  ExternalLink,
  Eye,
  FileWarning,
  Gauge,
  HardDrive,
  Headphones,
  History,
  LayoutDashboard,
  LifeBuoy,
  LockKeyhole,
  LogOut,
  MailWarning,
  Menu,
  MessageSquareText,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  TicketCheck,
  UserRoundCog,
  UserCog,
  Users,
  X,
  Zap,
  type LucideIcon
} from 'lucide-react';
import { useApp } from '../../app/AppProvider';
import orkestaLogoLight from '../../assets/orkesta-logo-light.png';
import orkestaSymbol from '../../assets/orkesta-symbol.png';
import { usePlatformAccess } from './PlatformAccessProvider';
import { platformService } from './platformService';
import type {
  OrganizationBackupJob,
  PaginatedResult,
  PlatformAuditEvent,
  PlatformDashboard,
  PlatformOperationsSnapshot,
  PlatformOrganizationDetail,
  PlatformOrganizationSummary,
  PlatformUser,
  SupportTicket
} from './types';

const EMPTY_PAGE = <T,>(): PaginatedResult<T> => ({ rows: [], total: 0, page: 1, pageSize: 25 });

function useAsyncData<T>(loader: () => Promise<T>, deps: readonly unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    void loader()
      .then((value) => { if (active) setData(value); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'No fue posible cargar la información.'); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, revision]);

  return { data, isLoading, error, reload };
}

function formatDate(value: string | null | undefined, withTime = true): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    ...(withTime ? { timeStyle: 'short' as const } : {})
  }).format(date);
}

function formatBytes(value: number | null | undefined): string {
  const bytes = Math.max(0, Number(value || 0));
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let current = bytes / 1024;
  let index = 0;
  while (current >= 1024 && index < units.length - 1) {
    current /= 1024;
    index += 1;
  }
  return `${current.toFixed(current >= 10 ? 1 : 2)} ${units[index]}`;
}

function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat('es-CO').format(Number(value || 0));
}

function statusLabel(status: string | null | undefined): string {
  const labels: Record<string, string> = {
    active: 'Activa', trialing: 'En prueba', past_due: 'Pago pendiente', suspended: 'Suspendida', cancelled: 'Cancelada',
    new: 'Nuevo', in_analysis: 'En análisis', assigned: 'Asignado', waiting_customer: 'Esperando cliente', in_solution: 'En solución', resolved: 'Resuelto', closed: 'Cerrado', reopened: 'Reabierto', cancelled_ticket: 'Cancelado',
    queued: 'En cola', processing: 'Procesando', completed: 'Completado', failed: 'Fallido', cancelled_backup: 'Cancelado'
  };
  return labels[String(status)] ?? String(status || 'Sin estado');
}

function toneForStatus(status: string | null | undefined): string {
  if (['active', 'completed', 'resolved', 'closed'].includes(String(status))) return 'platform-chip success';
  if (['trialing', 'queued', 'processing', 'in_analysis', 'assigned', 'in_solution'].includes(String(status))) return 'platform-chip info';
  if (['past_due', 'waiting_customer'].includes(String(status))) return 'platform-chip warning';
  if (['suspended', 'failed', 'critical', 'cancelled'].includes(String(status))) return 'platform-chip danger';
  return 'platform-chip';
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'SA';
}

function LoadingBlock({ text = 'Cargando información...' }: { text?: string }) {
  return <section className="platform-loading card"><RefreshCw className="spin" size={22} /><strong>{text}</strong></section>;
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <section className="platform-error card"><AlertTriangle size={24} /><div><strong>No fue posible completar la consulta</strong><p>{message}</p></div>{onRetry ? <button className="btn btn-white" onClick={onRetry}>Reintentar</button> : null}</section>;
}

function PageHeader({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return <header className="platform-page-head"><div><span className="eyebrow">Orkesta · Control de plataforma</span><h1>{title}</h1><p>{description}</p></div>{actions ? <div className="platform-page-actions">{actions}</div> : null}</header>;
}

function MetricCard({ icon, label, value, helper, danger = false }: { icon: ReactNode; label: string; value: ReactNode; helper?: string; danger?: boolean }) {
  return <article className={`platform-metric card ${danger ? 'danger' : ''}`}><div className="platform-metric-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong>{helper ? <small>{helper}</small> : null}</div></article>;
}

const platformNav: Array<{ to: string; label: string; icon: LucideIcon; permission: string; end?: boolean }> = [
  { to: '/superadmin', label: 'Resumen global', icon: LayoutDashboard, permission: 'platform.dashboard.view', end: true },
  { to: '/superadmin/organizations', label: 'Organizaciones', icon: Building2, permission: 'platform.organizations.view' },
  { to: '/superadmin/users', label: 'Catálogo de usuarios', icon: Users, permission: 'platform.users.view' },
  { to: '/superadmin/tickets', label: 'Tickets y soporte', icon: LifeBuoy, permission: 'platform.support.view' },
  { to: '/superadmin/backups', label: 'Backups', icon: DatabaseBackup, permission: 'platform.backups.view' },
  { to: '/superadmin/recovery', label: 'Continuidad', icon: ArchiveRestore, permission: 'platform.backups.view' },
  { to: '/superadmin/access', label: 'Acceso de soporte', icon: LockKeyhole, permission: 'platform.support.view' },
  { to: '/superadmin/usage', label: 'Uso y límites', icon: Gauge, permission: 'platform.usage.view' },
  { to: '/superadmin/explorer', label: 'Explorador', icon: Eye, permission: 'platform.explorer.view' },
  { to: '/superadmin/security', label: 'Equipo y seguridad', icon: UserCog, permission: 'platform.security.view' },
  { to: '/superadmin/audit', label: 'Auditoría global', icon: History, permission: 'platform.audit.view' },
  { to: '/superadmin/operations', label: 'Operación técnica', icon: Activity, permission: 'platform.operations.view' },
  { to: '/superadmin/scheduler', label: 'Scheduler', icon: Clock3, permission: 'platform.operations.manage' }
];

export function PlatformAdminShell() {
  const { currentUser, logout } = useApp();
  const { context, canPlatform } = usePlatformAccess();
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="platform-admin-app">
      <div className={`platform-mobile-overlay ${mobileOpen ? 'open' : ''}`} onClick={() => setMobileOpen(false)} />
      <aside className={`platform-sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="platform-brand"><img src={orkestaLogoLight} alt="Orkesta" /><span>SUPER ADMIN</span></div>
        <nav>
          {platformNav.filter(({ permission }) => canPlatform(permission)).map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setMobileOpen(false)} className={({ isActive }) => isActive ? 'active' : ''}><Icon size={18} /><span>{label}</span></NavLink>)}
        </nav>
        <div className="platform-sidebar-bottom">
          <Link to="/app"><ExternalLink size={17} />Abrir espacio organizacional</Link>
          <div className="platform-user-card"><div>{initials(currentUser?.name || 'Super Admin')}</div><span><strong>{currentUser?.name}</strong><small>{context?.roleName}</small></span></div>
        </div>
      </aside>
      <header className="platform-topbar">
        <button className="platform-menu-button" onClick={() => setMobileOpen(true)} aria-label="Abrir menú"><Menu size={20} /></button>
        <div><img src={orkestaSymbol} alt="" /><span><strong>Centro de control</strong><small>Vista global, soporte, seguridad y operación</small></span></div>
        <div className="platform-top-actions"><Link className="btn btn-white" to="/app"><Building2 size={16} />Organización</Link><button className="btn btn-white" onClick={() => void logout()}><LogOut size={16} />Salir</button></div>
      </header>
      <main className="platform-main"><Outlet /></main>
    </div>
  );
}

export function PlatformDashboardPage() {
  const { data, isLoading, error, reload } = useAsyncData<PlatformDashboard>(() => platformService.getDashboard(), []);
  if (isLoading && !data) return <LoadingBlock text="Consolidando toda la plataforma..." />;
  if (error && !data) return <ErrorBlock message={error} onRetry={reload} />;
  const dashboard = data!;
  return <div className="platform-page">
    <PageHeader title="Resumen global" description="Estado operativo, comercial y técnico de todas las organizaciones." actions={<button className="btn btn-white" onClick={reload}><RefreshCw size={16} />Actualizar</button>} />
    <section className="platform-metric-grid">
      <MetricCard icon={<Building2 />} label="Organizaciones activas" value={dashboard.organizations.active} helper={`${dashboard.organizations.total} registradas`} />
      <MetricCard icon={<Clock3 />} label="Próximas a vencer" value={dashboard.organizations.expiringSoon} helper="Dentro de 30 días" danger={dashboard.organizations.expiringSoon > 0} />
      <MetricCard icon={<Users />} label="Usuarios activos" value={dashboard.users.active30d} helper={`${dashboard.users.total} usuarios totales`} />
      <MetricCard icon={<TicketCheck />} label="Tickets abiertos" value={dashboard.activity.openTickets} helper={`${dashboard.activity.criticalTickets} críticos`} danger={dashboard.activity.criticalTickets > 0} />
      <MetricCard icon={<HardDrive />} label="Almacenamiento" value={formatBytes(dashboard.activity.storageBytes)} helper="Documentos de todas las organizaciones" />
      <MetricCard icon={<FileWarning />} label="Errores sin resolver" value={dashboard.activity.unresolvedErrors} helper="Aplicación y procesos" danger={dashboard.activity.unresolvedErrors > 0} />
      <MetricCard icon={<MailWarning />} label="Correos fallidos" value={dashboard.activity.failedEmails} helper="Cola de notificaciones" danger={dashboard.activity.failedEmails > 0} />
      <MetricCard icon={<Zap />} label="Automatizaciones fallidas" value={dashboard.activity.failedAutomations} helper="Ejecuciones recientes" danger={dashboard.activity.failedAutomations > 0} />
    </section>
    <section className="platform-dashboard-grid">
      <article className="card platform-panel"><header><div><h2>Alertas prioritarias</h2><p>Situaciones que requieren intervención del operador.</p></div><AlertTriangle /></header><div className="platform-alert-list">{dashboard.alerts.length ? dashboard.alerts.map((alert) => <Link key={`${alert.code}-${alert.organizationId || ''}`} to={alert.actionUrl || '/superadmin/operations'} className={`platform-alert ${alert.severity}`}><span>{alert.severity === 'critical' ? '!' : alert.severity === 'warning' ? '⚠' : 'i'}</span><div><strong>{alert.title}</strong><p>{alert.detail}</p>{alert.organizationName ? <small>{alert.organizationName}</small> : null}</div><ChevronRight size={18} /></Link>) : <div className="platform-empty"><CheckCircle2 /><strong>Sin alertas críticas</strong><p>La plataforma no reporta incidentes prioritarios.</p></div>}</div></article>
      <article className="card platform-panel"><header><div><h2>Actividad auditada reciente</h2><p>Acciones globales y organizacionales consolidadas.</p></div><History /></header><AuditCompactList rows={dashboard.recentAudit} /><Link className="platform-panel-link" to="/superadmin/audit">Ver auditoría completa <ChevronRight size={16} /></Link></article>
    </section>
  </div>;
}

export function PlatformOrganizationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('q') || '';
  const status = searchParams.get('status') || '';
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const { data, isLoading, error, reload } = useAsyncData(() => platformService.listOrganizations({ search, status, page, pageSize: 20 }), [search, status, page]);
  const result = data ?? EMPTY_PAGE<PlatformOrganizationSummary>();
  function update(key: string, value: string) { const next = new URLSearchParams(searchParams); value ? next.set(key, value) : next.delete(key); if (key !== 'page') next.set('page', '1'); setSearchParams(next); }
  return <div className="platform-page">
    <PageHeader title="Organizaciones" description="Suscripciones, consumo, usuarios, configuración, soporte y actividad de cada cliente." actions={<button className="btn btn-white" onClick={reload}><RefreshCw size={16} />Actualizar</button>} />
    <section className="card platform-filters"><label><Search size={17} /><input placeholder="Buscar por nombre o slug" value={search} onChange={(event) => update('q', event.target.value)} /></label><select value={status} onChange={(event) => update('status', event.target.value)}><option value="">Todos los estados</option><option value="active">Activa</option><option value="trialing">En prueba</option><option value="past_due">Pago pendiente</option><option value="suspended">Suspendida</option><option value="cancelled">Cancelada</option></select></section>
    {error ? <ErrorBlock message={error} onRetry={reload} /> : null}
    <section className="card platform-table-card"><div className="platform-table-meta"><span>{isLoading ? 'Consultando organizaciones...' : `${formatNumber(result.total)} organizaciones`}</span></div><div className="platform-table-scroll"><table><thead><tr><th>Organización</th><th>Suscripción</th><th>Usuarios</th><th>Casos</th><th>Almacenamiento</th><th>Tickets</th><th>Última actividad</th><th /></tr></thead><tbody>{result.rows.map((organization) => <tr key={organization.id}><td><strong>{organization.name}</strong><small>{organization.slug}</small></td><td><span className={toneForStatus(organization.subscriptionStatus || (organization.isActive ? 'active' : 'suspended'))}>{statusLabel(organization.subscriptionStatus || (organization.isActive ? 'active' : 'suspended'))}</span><small>{organization.planName || 'Sin plan'} · vence {formatDate(organization.currentPeriodEnd, false)}</small></td><td><strong>{organization.usersActive}</strong><small>de {organization.usersTotal} registrados</small></td><td><strong>{organization.casesOpen}</strong><small>abiertos · {organization.casesThisMonth} este mes</small></td><td><strong>{formatBytes(organization.storageBytes)}</strong><small>{organization.documents} documentos</small></td><td><strong>{organization.ticketsOpen}</strong><small>abiertos</small></td><td>{formatDate(organization.lastActivityAt)}</td><td><Link className="btn btn-white compact" to={`/superadmin/organizations/${organization.id}`}>Gestionar <ChevronRight size={15} /></Link></td></tr>)}</tbody></table></div>{!result.rows.length && !isLoading ? <div className="platform-empty"><Building2 /><strong>No se encontraron organizaciones</strong></div> : null}<Pagination current={result.page} total={result.total} pageSize={result.pageSize} onChange={(nextPage) => update('page', String(nextPage))} /></section>
  </div>;
}

export function PlatformOrganizationDetailPage() {
  const { organizationId = '' } = useParams();
  const [tab, setTab] = useState('summary');
  const [action, setAction] = useState<'subscription' | 'backup' | 'support' | 'status' | null>(null);
  const { data, isLoading, error, reload } = useAsyncData<PlatformOrganizationDetail>(() => platformService.getOrganizationDetail(organizationId), [organizationId]);
  if (isLoading && !data) return <LoadingBlock text="Abriendo la organización..." />;
  if (error && !data) return <ErrorBlock message={error} onRetry={reload} />;
  const detail = data!;
  const org = detail.organization;
  return <div className="platform-page">
    <PageHeader title={org.name} description={`Control integral de ${org.slug}. No es necesario consultar directamente la base de datos.`} actions={<><button className="btn btn-white" onClick={() => setAction('support')}><Headphones size={16} />Modo soporte</button><button className="btn btn-white" onClick={() => setAction('backup')}><DatabaseBackup size={16} />Crear backup</button><button className="btn btn-primary" onClick={() => setAction('subscription')}><Clock3 size={16} />Suscripción</button></>} />
    <section className="platform-org-hero card"><div className="platform-org-mark" style={{ background: org.branding?.primaryColor || '#172554' }}>{org.branding?.logoUrl ? <img src={org.branding.logoUrl} alt="" /> : initials(org.name)}</div><div><span className={toneForStatus(org.subscriptionStatus || (org.isActive ? 'active' : 'suspended'))}>{statusLabel(org.subscriptionStatus || (org.isActive ? 'active' : 'suspended'))}</span><h2>{org.branding?.productName || org.name}</h2><p>Plan {org.planName || 'sin asignar'} · periodo hasta {formatDate(org.currentPeriodEnd, false)}</p></div><div className="platform-org-hero-actions"><button className="btn btn-white" onClick={() => setAction('status')}>{org.isActive ? <LockKeyhole size={16} /> : <CheckCircle2 size={16} />}{org.isActive ? 'Suspender' : 'Reactivar'}</button><a className="btn btn-white" href={`/radicar/${encodeURIComponent(org.slug)}`} target="_blank" rel="noreferrer"><ExternalLink size={16} />Formulario público</a></div></section>
    <nav className="platform-tabs">{[
      ['summary', 'Resumen'], ['usage', 'Uso y límites'], ['users', 'Usuarios'], ['config', 'Configuración'], ['tickets', 'Tickets'], ['backups', 'Backups'], ['audit', 'Auditoría']
    ].map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}</nav>
    {tab === 'summary' ? <OrganizationSummary detail={detail} /> : null}
    {tab === 'usage' ? <OrganizationUsage detail={detail} /> : null}
    {tab === 'users' ? <OrganizationUsers rows={detail.users} /> : null}
    {tab === 'config' ? <OrganizationConfiguration detail={detail} /> : null}
    {tab === 'tickets' ? <TicketTable rows={detail.tickets} compact /> : null}
    {tab === 'backups' ? <BackupTable rows={detail.backups} compact /> : null}
    {tab === 'audit' ? <section className="card platform-panel"><AuditCompactList rows={detail.recentAudit} detailed /><Link className="platform-panel-link" to={`/superadmin/audit?organizationId=${organizationId}`}>Abrir explorador completo <ChevronRight size={16} /></Link></section> : null}
    {action ? <OrganizationActionModal kind={action} detail={detail} onClose={() => setAction(null)} onSaved={() => { setAction(null); reload(); }} /> : null}
  </div>;
}

function OrganizationSummary({ detail }: { detail: PlatformOrganizationDetail }) {
  const { organization: org, usage } = detail;
  return <section className="platform-detail-grid">
    <div className="platform-metric-grid compact"><MetricCard icon={<Users />} label="Usuarios activos" value={usage.usersActive} helper={`${usage.usersTotal} registrados`} /><MetricCard icon={<Gauge />} label="Casos abiertos" value={usage.casesOpen} helper={`${usage.casesThisMonth} creados este mes`} /><MetricCard icon={<HardDrive />} label="Almacenamiento" value={formatBytes(usage.storageBytes)} helper={`${usage.documents} documentos`} /><MetricCard icon={<MessageSquareText />} label="Tickets abiertos" value={org.ticketsOpen} helper="Solicitudes de la organización" /></div>
    <article className="card platform-panel"><header><div><h2>Suscripción</h2><p>Vigencia, plan y límites contractuales.</p></div><Clock3 /></header><dl className="platform-definition-list"><div><dt>Plan</dt><dd>{org.planName || 'Sin plan'}</dd></div><div><dt>Estado</dt><dd>{statusLabel(org.subscriptionStatus)}</dd></div><div><dt>Inicio</dt><dd>{formatDate(detail.subscription?.currentPeriodStart, false)}</dd></div><div><dt>Vencimiento</dt><dd>{formatDate(detail.subscription?.currentPeriodEnd, false)}</dd></div><div><dt>Límites especiales</dt><dd><code>{JSON.stringify(detail.subscription?.limitsOverride || {})}</code></dd></div></dl></article>
    <article className="card platform-panel"><header><div><h2>Últimos tickets</h2><p>Solicitudes que llegaron al Super Admin.</p></div><LifeBuoy /></header><TicketCompactList rows={detail.tickets.slice(0, 5)} /></article>
    <article className="card platform-panel"><header><div><h2>Historial de suscripción</h2><p>Cada ajuste queda justificado y auditado.</p></div><History /></header><div className="platform-timeline">{detail.subscriptionHistory.length ? detail.subscriptionHistory.map((event, index) => <div key={String(event.id || index)}><span /><div><strong>{String(event.eventType || event.event_type || 'Cambio de suscripción')}</strong><p>{String(event.reason || 'Sin observación')}</p><small>{formatDate(String(event.createdAt || event.created_at || ''))}</small></div></div>) : <div className="platform-empty"><History /><strong>Sin cambios históricos</strong></div>}</div></article>
  </section>;
}

function OrganizationUsage({ detail }: { detail: PlatformOrganizationDetail }) {
  const usage = detail.usage;
  const plan = detail.plans.find((item) => item.id === detail.subscription?.planId);
  const limits = { ...(plan?.limits || {}), ...(detail.subscription?.limitsOverride || {}) } as Record<string, unknown>;
  const items = [
    ['Usuarios activos', usage.usersActive, Number(limits.users || limits.max_users || 0), 'usuarios'],
    ['Almacenamiento', usage.storageBytes, Number(limits.storage_bytes || 0), 'bytes'],
    ['Casos del mes', usage.casesThisMonth, Number(limits.cases_month || 0), 'casos'],
    ['Correos del mes', usage.emailsThisMonth, Number(limits.emails_month || 0), 'correos'],
    ['Automatizaciones', usage.automationsThisMonth, Number(limits.automations_month || 0), 'ejecuciones']
  ] as const;
  return <section className="card platform-panel"><header><div><h2>Consumo actual</h2><p>Uso medido frente a los límites del plan y sus excepciones.</p></div><Gauge /></header><div className="platform-usage-list">{items.map(([label, current, limit, unit]) => { const pct = limit > 0 ? Math.min(100, Math.round((current / limit) * 100)) : 0; return <div key={label}><div><strong>{label}</strong><span>{unit === 'bytes' ? formatBytes(current) : formatNumber(current)} {limit > 0 ? `de ${unit === 'bytes' ? formatBytes(limit) : formatNumber(limit)}` : '· sin límite definido'}</span></div><div className="platform-progress"><i style={{ width: `${pct}%` }} /></div><small>{limit > 0 ? `${pct}% utilizado` : 'Configure el límite en el plan o en la suscripción'}</small></div>; })}</div><div className="platform-usage-secondary"><span><strong>{usage.publicSubmissionsThisMonth}</strong> radicaciones públicas</span><span><strong>{usage.exportsThisMonth}</strong> exportaciones</span><span><strong>{usage.casesTotal}</strong> casos históricos</span></div></section>;
}

function OrganizationUsers({ rows }: { rows: PlatformUser[] }) {
  return <section className="card platform-table-card"><div className="platform-table-meta"><span>{rows.length} usuarios relacionados</span></div><div className="platform-table-scroll"><table><thead><tr><th>Usuario</th><th>Rol</th><th>Áreas</th><th>Estado</th><th>Último acceso</th></tr></thead><tbody>{rows.map((user) => { const membership = user.memberships[0]; return <tr key={user.id}><td><strong>{user.name}</strong><small>{user.email}</small></td><td>{membership?.roleName || 'Sin rol'}</td><td>{membership?.areas.map((area) => area.name).join(', ') || 'Sin área'}</td><td><span className={membership?.isActive ? 'platform-chip success' : 'platform-chip danger'}>{membership?.isActive ? 'Activo' : 'Inactivo'}</span></td><td>{formatDate(user.lastSignInAt || user.lastActivityAt)}</td></tr>; })}</tbody></table></div></section>;
}

function OrganizationConfiguration({ detail }: { detail: PlatformOrganizationDetail }) {
  const config = detail.configuration;
  const blocks = [
    ['Áreas', config.areas], ['Prioridades', config.priorities], ['Tipos de caso', config.caseTypes], ['Estados', config.states], ['Políticas SLA', config.slaPolicies], ['Roles', config.roles], ['Plantillas de correo', config.emailTemplates], ['Automatizaciones', config.automationRules]
  ] as const;
  return <section className="platform-config-grid">{blocks.map(([title, rows]) => <article className="card platform-panel" key={title}><header><div><h2>{title}</h2><p>{rows.length} registros configurados</p></div><Settings2 /></header><div className="platform-config-list">{rows.slice(0, 12).map((row, index) => <div key={String(row.id || index)}><span><strong>{String(row.name || row.code || row.title || `Registro ${index + 1}`)}</strong><small>{String(row.code || row.description || row.status || '')}</small></span><code>{row.isActive === false || row.is_active === false ? 'Inactivo' : 'Activo'}</code></div>)}{rows.length > 12 ? <small>+ {rows.length - 12} registros adicionales</small> : null}</div></article>)}<article className="card platform-panel"><header><div><h2>Seguridad de radicación</h2><p>Configuración pública vigente.</p></div><ShieldCheck /></header><pre className="platform-json">{JSON.stringify(config.publicIntakeSecurity || {}, null, 2)}</pre></article></section>;
}

function OrganizationActionModal({ kind, detail, onClose, onSaved }: { kind: 'subscription' | 'backup' | 'support' | 'status'; detail: PlatformOrganizationDetail; onClose: () => void; onSaved: () => void }) {
  const org = detail.organization;
  const [reason, setReason] = useState('');
  const [planId, setPlanId] = useState(detail.subscription?.planId || '');
  const [status, setStatus] = useState(detail.subscription?.status || 'active');
  const [periodEnd, setPeriodEnd] = useState(detail.subscription?.currentPeriodEnd?.slice(0, 10) || '');
  const [scope, setScope] = useState<OrganizationBackupJob['scope']>('full');
  const [supportMode, setSupportMode] = useState<'read_only' | 'support' | 'admin'>('read_only');
  const [duration, setDuration] = useState(30);
  const [supportTicketId, setSupportTicketId] = useState('');
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const minimumReason = kind === 'support' ? 10 : 5;
    if (reason.trim().length < minimumReason) { setError(`Registra una justificación de mínimo ${minimumReason} caracteres.`); return; }
    setSaving(true); setError('');
    try {
      if (kind === 'subscription') await platformService.updateSubscription({ organizationId: org.id, planId, status, currentPeriodEnd: periodEnd ? new Date(`${periodEnd}T23:59:59-05:00`).toISOString() : null, reason: reason.trim() });
      if (kind === 'backup') await platformService.requestBackup(org.id, scope, reason.trim());
      if (kind === 'status') await platformService.setOrganizationActive(org.id, !org.isActive, reason.trim());
      if (kind === 'support') {
        const request = await platformService.requestSupportAccess({
          organizationId: org.id,
          mode: supportMode,
          scopes: supportMode === 'read_only' ? ['overview', 'cases', 'configuration'] : ['overview', 'cases', 'users', 'configuration', 'documents'],
          reason: reason.trim(),
          ticketId: supportTicketId || undefined,
          durationMinutes: duration
        });
        if (request.status === 'approved') {
          const session = await platformService.startApprovedSupportSession(request.id);
          window.sessionStorage.setItem('orkesta.platform.support-session', JSON.stringify(session));
          navigate(`/superadmin/explorer?organizationId=${org.id}`);
        } else {
          navigate(`/superadmin/access?organizationId=${org.id}`);
        }
      }
      onSaved();
    } catch (reasonError) { setError(reasonError instanceof Error ? reasonError.message : 'No fue posible completar la acción.'); }
    finally { setSaving(false); }
  }
  const titles = { subscription: 'Modificar suscripción', backup: 'Crear backup manual', support: 'Iniciar modo soporte', status: org.isActive ? 'Suspender organización' : 'Reactivar organización' };
  return <div className="platform-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="platform-modal card" onSubmit={submit}><header><div><span className="eyebrow">{org.name}</span><h2>{titles[kind]}</h2></div><button type="button" onClick={onClose} aria-label="Cerrar"><X /></button></header>{kind === 'subscription' ? <div className="platform-form-grid"><label>Plan<select value={planId} onChange={(event) => setPlanId(event.target.value)}>{detail.plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label><label>Estado<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="trialing">En prueba</option><option value="active">Activa</option><option value="past_due">Pago pendiente</option><option value="suspended">Suspendida</option><option value="cancelled">Cancelada</option></select></label><label>Vencimiento<input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></label></div> : null}{kind === 'backup' ? <label>Alcance<select value={scope} onChange={(event) => setScope(event.target.value as OrganizationBackupJob['scope'])}><option value="full">Completo</option><option value="database">Datos</option><option value="documents">Documentos</option><option value="configuration">Configuración</option></select></label> : null}{kind === 'support' ? <div className="platform-form-grid"><label>Nivel de acceso<select value={supportMode} onChange={(event) => setSupportMode(event.target.value as typeof supportMode)}><option value="read_only">Solo lectura</option><option value="support">Soporte operativo</option><option value="admin">Administración temporal</option></select></label><label>Duración<select value={duration} onChange={(event) => setDuration(Number(event.target.value))}><option value={15}>15 minutos</option><option value={30}>30 minutos</option><option value={60}>60 minutos</option></select></label><label>Ticket relacionado<select value={supportTicketId} onChange={(event) => setSupportTicketId(event.target.value)}><option value="">Sin ticket</option>{detail.tickets.map((ticket) => <option key={ticket.id} value={ticket.id}>{ticket.ticketNumber} · {ticket.subject}</option>)}</select></label></div> : null}<label>Justificación<textarea rows={4} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo, solicitud asociada y resultado esperado" /></label>{error ? <div className="alert danger">{error}</div> : null}<footer><button type="button" className="btn btn-white" onClick={onClose}>Cancelar</button><button type="submit" className="btn btn-primary" disabled={isSaving}>{isSaving ? 'Procesando...' : 'Confirmar y auditar'}</button></footer></form></div>;
}

export function PlatformUsersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [membershipAction, setMembershipAction] = useState<{ user: PlatformUser; membership: PlatformUser['memberships'][number] } | null>(null);
  const search = searchParams.get('q') || '';
  const organizationId = searchParams.get('organizationId') || '';
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const organizations = useAsyncData(() => platformService.listOrganizations({ pageSize: 100 }), []);
  const { data, isLoading, error, reload } = useAsyncData(() => platformService.listUsers({ search, organizationId, page, pageSize: 25 }), [search, organizationId, page]);
  const result = data ?? EMPTY_PAGE<PlatformUser>();
  function update(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    value ? next.set(key, value) : next.delete(key);
    if (key !== 'page') next.set('page', '1');
    setSearchParams(next);
  }
  return <div className="platform-page">
    <PageHeader title="Catálogo global de usuarios" description="Usuarios, accesos, roles, áreas, organizaciones y actividad reciente." actions={<button className="btn btn-white" onClick={reload}><RefreshCw size={16} />Actualizar</button>} />
    <section className="card platform-filters">
      <label><Search size={17} /><input value={search} onChange={(event) => update('q', event.target.value)} placeholder="Nombre o correo" /></label>
      <select value={organizationId} onChange={(event) => update('organizationId', event.target.value)}><option value="">Todas las organizaciones</option>{organizations.data?.rows.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}</select>
    </section>
    {error ? <ErrorBlock message={error} onRetry={reload} /> : null}
    <section className="card platform-table-card">
      <div className="platform-table-meta"><span>{isLoading ? 'Consultando usuarios...' : `${formatNumber(result.total)} usuarios`}</span></div>
      <div className="platform-table-scroll"><table><thead><tr><th>Usuario</th><th>Organizaciones y roles</th><th>Áreas</th><th>Plataforma</th><th>Último ingreso</th><th>Actividad</th><th>Acciones</th></tr></thead><tbody>
        {result.rows.map((user) => <tr key={user.id}>
          <td><strong>{user.name}</strong><small>{user.email}</small><small>Creado {formatDate(user.createdAt, false)}</small></td>
          <td>{user.memberships.map((membership) => <div className="platform-membership" key={membership.membershipId}><Link to={`/superadmin/organizations/${membership.organizationId}`}>{membership.organizationName}</Link><span className={membership.isActive ? 'platform-chip success' : 'platform-chip danger'}>{membership.roleName}</span></div>)}</td>
          <td>{user.memberships.flatMap((membership) => membership.areas.map((area) => area.name)).filter((value, index, all) => all.indexOf(value) === index).join(', ') || '—'}</td>
          <td>{user.isPlatformAdmin ? <span className="platform-chip info">{user.platformRole}</span> : '—'}</td>
          <td>{formatDate(user.lastSignInAt)}</td><td>{formatDate(user.lastActivityAt)}</td>
          <td><div className="platform-user-actions">{user.memberships.map((membership) => <button key={membership.membershipId} className="btn btn-white compact" onClick={() => setMembershipAction({ user, membership })}>{membership.isActive ? 'Suspender' : 'Reactivar'} · {membership.organizationName}</button>)}</div></td>
        </tr>)}
      </tbody></table></div>
      <Pagination current={result.page} total={result.total} pageSize={result.pageSize} onChange={(nextPage) => update('page', String(nextPage))} />
    </section>
    {membershipAction ? <MembershipActionModal action={membershipAction} onClose={() => setMembershipAction(null)} onSaved={() => { setMembershipAction(null); reload(); }} /> : null}
  </div>;
}

function MembershipActionModal({ action, onClose, onSaved }: { action: { user: PlatformUser; membership: PlatformUser['memberships'][number] }; onClose: () => void; onSaved: () => void }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const nextActive = !action.membership.isActive;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (reason.trim().length < 5) { setError('Registra una justificación de mínimo 5 caracteres.'); return; }
    setSaving(true); setError('');
    try { await platformService.setMembershipActive(action.membership.membershipId, nextActive, reason.trim()); onSaved(); }
    catch (actionError) { setError(actionError instanceof Error ? actionError.message : 'No fue posible actualizar el acceso.'); }
    finally { setSaving(false); }
  }
  return <div className="platform-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="platform-modal card" onSubmit={submit}><header><div><span className="eyebrow">{action.membership.organizationName}</span><h2>{nextActive ? 'Reactivar usuario' : 'Suspender usuario'}</h2><p>{action.user.name} · {action.user.email}</p></div><button type="button" onClick={onClose}><X /></button></header><label>Justificación<textarea rows={4} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo de la modificación de acceso" /></label>{error ? <div className="alert danger">{error}</div> : null}<footer><button type="button" className="btn btn-white" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Confirmar y auditar'}</button></footer></form></div>;
}

export function PlatformTicketsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('ticket') || '';
  const search = searchParams.get('q') || '';
  const status = searchParams.get('status') || '';
  const priority = searchParams.get('priority') || '';
  const { data, isLoading, error, reload } = useAsyncData(() => platformService.listTickets({ search, status, priority, pageSize: 100 }), [search, status, priority]);
  const ticketDetail = useAsyncData(() => selectedId ? platformService.getTicket(selectedId) : Promise.resolve(null as SupportTicket | null), [selectedId]);
  function update(key: string, value: string) { const next = new URLSearchParams(searchParams); value ? next.set(key, value) : next.delete(key); setSearchParams(next); }
  return <div className="platform-page"><PageHeader title="Tickets y soporte" description="Solicitudes funcionales, técnicas y administrativas de todas las organizaciones." actions={<button className="btn btn-white" onClick={() => { reload(); ticketDetail.reload(); }}><RefreshCw size={16} />Actualizar</button>} /><section className="card platform-filters"><label><Search size={17} /><input value={search} onChange={(event) => update('q', event.target.value)} placeholder="Ticket, organización o asunto" /></label><select value={status} onChange={(event) => update('status', event.target.value)}><option value="">Todos los estados</option><option value="new">Nuevo</option><option value="in_analysis">En análisis</option><option value="waiting_customer">Esperando cliente</option><option value="in_solution">En solución</option><option value="resolved">Resuelto</option><option value="closed">Cerrado</option></select><select value={priority} onChange={(event) => update('priority', event.target.value)}><option value="">Todas las prioridades</option><option value="critical">Crítica</option><option value="high">Alta</option><option value="medium">Media</option><option value="low">Baja</option></select></section>{error ? <ErrorBlock message={error} onRetry={reload} /> : null}<section className="platform-ticket-layout"><div className="card platform-ticket-list">{isLoading ? <LoadingBlock /> : data?.rows.map((ticket) => <button key={ticket.id} className={selectedId === ticket.id ? 'active' : ''} onClick={() => update('ticket', ticket.id)}><div><strong>{ticket.ticketNumber}</strong><span className={toneForStatus(ticket.status)}>{statusLabel(ticket.status)}</span></div><h3>{ticket.subject}</h3><p>{ticket.organizationName}</p><small>{formatDate(ticket.updatedAt)} · {ticket.priority}</small></button>)}</div><div>{selectedId ? ticketDetail.isLoading && !ticketDetail.data ? <LoadingBlock text="Abriendo ticket..." /> : ticketDetail.error ? <ErrorBlock message={ticketDetail.error} onRetry={ticketDetail.reload} /> : ticketDetail.data ? <TicketDetail ticket={ticketDetail.data} onSaved={() => { ticketDetail.reload(); reload(); }} /> : null : <section className="card platform-empty large"><MessageSquareText /><strong>Selecciona un ticket</strong><p>Revisa la conversación, cambia el estado y responde desde el Super Admin.</p></section>}</div></section></div>;
}

function TicketDetail({ ticket, onSaved }: { ticket: SupportTicket; onSaved: () => void }) {
  const security = useAsyncData(() => platformService.getSecurity(), []);
  const agents = security.data?.team.filter((member) => member.isActive && ['owner', 'admin', 'support_manager', 'support_agent'].includes(member.roleCode)) || [];
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const [status, setStatus] = useState(ticket.status);
  const [priority, setPriority] = useState(ticket.priority);
  const [assignedTo, setAssignedTo] = useState(ticket.assignedTo || '');
  const [tags, setTags] = useState((ticket.tags || []).join(', '));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setStatus(ticket.status);
    setPriority(ticket.priority);
    setAssignedTo(ticket.assignedTo || '');
    setTags((ticket.tags || []).join(', '));
  }, [ticket.id, ticket.status, ticket.priority, ticket.assignedTo, ticket.tags]);

  async function reply(event: FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setSaving(true); setError('');
    try { await platformService.replyTicket(ticket.id, body.trim(), internal); setBody(''); onSaved(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible responder.'); }
    finally { setSaving(false); }
  }

  async function updateTicket(escalate = false) {
    let escalationReason: string | undefined;
    if (escalate) {
      escalationReason = window.prompt('Motivo del escalamiento (mínimo 10 caracteres):') || undefined;
      if (!escalationReason) return;
    }
    setSaving(true); setError('');
    try {
      await platformService.updateTicketV2({
        ticketId: ticket.id,
        status,
        priority,
        assignedTo: assignedTo || null,
        tags: tags.split(',').map((value) => value.trim()).filter(Boolean),
        escalate,
        escalationReason
      });
      onSaved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible actualizar el ticket.'); }
    finally { setSaving(false); }
  }

  return <section className="card platform-ticket-detail">
    <header><div><span className="eyebrow">{ticket.ticketNumber} · {ticket.organizationName}</span><h2>{ticket.subject}</h2><p>{ticket.description}</p></div><span className={toneForStatus(ticket.status)}>{statusLabel(ticket.status)}</span></header>
    <section className="platform-ticket-sla-grid">
      <div className={ticket.firstResponseBreached ? 'danger' : ''}><span>Primera respuesta</span><strong>{ticket.firstResponseAt ? formatDate(ticket.firstResponseAt) : 'Pendiente'}</strong><small>Límite: {formatDate(ticket.firstResponseDueAt)}</small></div>
      <div className={ticket.resolutionBreached ? 'danger' : ''}><span>Resolución</span><strong>{ticket.resolvedAt ? formatDate(ticket.resolvedAt) : 'Pendiente'}</strong><small>Límite: {formatDate(ticket.resolutionDueAt || ticket.slaDueAt)}</small></div>
      <div><span>Escalamiento</span><strong>{ticket.escalatedAt ? 'Escalado' : 'Sin escalar'}</strong><small>{ticket.escalationReason || 'Sin observaciones'}</small></div>
    </section>
    <div className="platform-ticket-controls phase2-ticket-controls">
      <label>Estado<select value={status} onChange={(event) => setStatus(event.target.value as SupportTicket['status'])}><option value="new">Nuevo</option><option value="in_analysis">En análisis</option><option value="assigned">Asignado</option><option value="waiting_customer">Esperando cliente</option><option value="in_solution">En solución</option><option value="resolved">Resuelto</option><option value="closed">Cerrado</option><option value="reopened">Reabierto</option><option value="cancelled">Cancelado</option></select></label>
      <label>Prioridad<select value={priority} onChange={(event) => setPriority(event.target.value as SupportTicket['priority'])}><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="critical">Crítica</option></select></label>
      <label>Agente<select value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}><option value="">Sin asignar</option>{agents.map((agent) => <option key={agent.userId} value={agent.userId}>{agent.name} · {agent.roleName}</option>)}</select></label>
      <label>Etiquetas<input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="acceso, facturación, crítico" /></label>
      <button className="btn btn-white" onClick={() => void updateTicket()} disabled={saving}>Guardar clasificación</button>
      <button className="btn btn-white danger-text" onClick={() => void updateTicket(true)} disabled={saving}>Escalar</button>
    </div>
    <div className="platform-conversation">{ticket.messages?.map((message) => <article key={message.id} className={`${message.authorKind} ${message.isInternal ? 'internal' : ''}`}><header><strong>{message.authorName || message.authorEmail || message.authorKind}</strong><small>{formatDate(message.createdAt)}</small></header><p>{message.body}</p>{message.isInternal ? <span>Nota interna</span> : null}</article>)}</div>
    <form className="platform-ticket-reply" onSubmit={reply}><textarea rows={4} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Escribe una respuesta para la organización..." /><label><input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} /> Guardar como nota interna del equipo de soporte</label>{error ? <div className="alert danger">{error}</div> : null}<button className="btn btn-primary" disabled={saving || !body.trim()}>{saving ? 'Guardando...' : internal ? 'Agregar nota interna' : 'Enviar respuesta'}</button></form>
  </section>;
}

export function PlatformBackupsPage() {
  const [status, setStatus] = useState('');
  const { data, isLoading, error, reload } = useAsyncData(() => platformService.listBackups({ status, pageSize: 100 }), [status]);
  return <div className="platform-page"><PageHeader title="Backups por organización" description="Solicitudes manuales, trazabilidad, integridad, almacenamiento y vencimiento de respaldos." actions={<button className="btn btn-white" onClick={reload}><RefreshCw size={16} />Actualizar</button>} /><section className="card platform-filters"><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos los estados</option><option value="queued">En cola</option><option value="processing">Procesando</option><option value="completed">Completado</option><option value="failed">Fallido</option></select></section>{error ? <ErrorBlock message={error} onRetry={reload} /> : null}{isLoading && !data ? <LoadingBlock /> : <BackupTable rows={data?.rows || []} />}</div>;
}

function BackupTable({ rows, compact = false }: { rows: OrganizationBackupJob[]; compact?: boolean }) {
  return <section className="card platform-table-card"><div className="platform-table-meta"><span>{rows.length} backups</span></div><div className="platform-table-scroll"><table><thead><tr><th>Organización</th><th>Alcance</th><th>Estado</th><th>Solicitado</th><th>Tamaño</th><th>Integridad</th><th>Vencimiento</th>{compact ? null : <th>Detalle</th>}</tr></thead><tbody>{rows.map((backup) => <tr key={backup.id}><td><strong>{backup.organizationName || backup.organizationId}</strong><small>{backup.reason}</small></td><td>{backup.scope}</td><td><span className={toneForStatus(backup.status)}>{statusLabel(backup.status)}</span>{backup.errorMessage ? <small className="danger-text">{backup.errorMessage}</small> : null}</td><td>{formatDate(backup.createdAt)}<small>{backup.requestedByName}</small></td><td>{formatBytes(backup.sizeBytes)}</td><td><code>{backup.checksum?.slice(0, 16) || 'Pendiente'}</code></td><td>{formatDate(backup.expiresAt, false)}</td>{compact ? null : <td>{backup.storagePath ? <code>{backup.storagePath}</code> : '—'}</td>}</tr>)}</tbody></table></div>{!rows.length ? <div className="platform-empty"><ArchiveRestore /><strong>No hay backups para mostrar</strong></div> : null}</section>;
}

export function PlatformAuditPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const organizationId = searchParams.get('organizationId') || '';
  const search = searchParams.get('q') || '';
  const eventType = searchParams.get('event') || '';
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const organizations = useAsyncData(() => platformService.listOrganizations({ pageSize: 100 }), []);
  const { data, isLoading, error, reload } = useAsyncData(() => platformService.listAudit({ organizationId, search, eventType, page, pageSize: 50 }), [organizationId, search, eventType, page]);
  const result = data ?? EMPTY_PAGE<PlatformAuditEvent>();
  function update(key: string, value: string) { const next = new URLSearchParams(searchParams); value ? next.set(key, value) : next.delete(key); if (key !== 'page') next.set('page', '1'); setSearchParams(next); }
  return <div className="platform-page"><PageHeader title="Auditoría global" description="Todo cambio organizacional y toda acción del Super Admin quedan registrados, con datos anteriores y posteriores." actions={<button className="btn btn-white" onClick={reload}><RefreshCw size={16} />Actualizar</button>} /><section className="card platform-filters"><label><Search size={17} /><input value={search} onChange={(event) => update('q', event.target.value)} placeholder="Usuario, entidad, ID o evento" /></label><select value={organizationId} onChange={(event) => update('organizationId', event.target.value)}><option value="">Todas las organizaciones</option>{organizations.data?.rows.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}</select><input value={eventType} onChange={(event) => update('event', event.target.value)} placeholder="Tipo de evento" /></section>{error ? <ErrorBlock message={error} onRetry={reload} /> : null}<section className="card platform-panel"><div className="platform-table-meta"><span>{isLoading ? 'Consultando auditoría...' : `${formatNumber(result.total)} eventos`}</span></div><AuditCompactList rows={result.rows} detailed /><Pagination current={result.page} total={result.total} pageSize={result.pageSize} onChange={(nextPage) => update('page', String(nextPage))} /></section></div>;
}

function AuditCompactList({ rows, detailed = false }: { rows: PlatformAuditEvent[]; detailed?: boolean }) {
  return <div className={`platform-audit-list ${detailed ? 'detailed' : ''}`}>{rows.length ? rows.map((event) => <details key={event.id}><summary><span className={`platform-audit-source ${event.source}`}>{event.source === 'platform' ? 'SA' : event.source === 'system' ? 'SYS' : 'ORG'}</span><div><strong>{event.eventType}</strong><p>{event.entityType}{event.entityId ? ` · ${event.entityId}` : ''}</p><small>{event.organizationName || 'Plataforma'} · {event.actorName || event.actorEmail || 'Sistema'} · {formatDate(event.createdAt)}</small></div>{detailed ? <ChevronRight size={17} /> : null}</summary>{detailed ? <div className="platform-audit-payload"><div><strong>Antes</strong><pre>{JSON.stringify(event.beforeData, null, 2)}</pre></div><div><strong>Después</strong><pre>{JSON.stringify(event.afterData, null, 2)}</pre></div><div><strong>Metadatos</strong><pre>{JSON.stringify(event.metadata, null, 2)}</pre></div></div> : null}</details>) : <div className="platform-empty"><History /><strong>Sin eventos recientes</strong></div>}</div>;
}

export function PlatformOperationsPage() {
  const [organizationId, setOrganizationId] = useState('');
  const organizations = useAsyncData(() => platformService.listOrganizations({ pageSize: 100 }), []);
  const { data, isLoading, error, reload } = useAsyncData<PlatformOperationsSnapshot>(() => platformService.getOperations(organizationId || undefined), [organizationId]);
  if (isLoading && !data) return <LoadingBlock text="Consultando colas, errores y procesos..." />;
  if (error && !data) return <ErrorBlock message={error} onRetry={reload} />;
  const operations = data!;
  return <div className="platform-page"><PageHeader title="Operación técnica" description="Monitoreo funcional sin entrar al despliegue ni consultar tablas manualmente." actions={<button className="btn btn-white" onClick={reload}><RefreshCw size={16} />Actualizar</button>} /><section className="card platform-filters"><select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}><option value="">Toda la plataforma</option>{organizations.data?.rows.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}</select></section><section className="platform-metric-grid compact"><MetricCard icon={<FileWarning />} label="Errores abiertos" value={operations.counters.unresolvedErrors} danger={operations.counters.unresolvedErrors > 0} /><MetricCard icon={<MailWarning />} label="Correos en cola" value={operations.counters.queuedEmails} /><MetricCard icon={<AlertTriangle />} label="Correos fallidos" value={operations.counters.failedEmails} danger={operations.counters.failedEmails > 0} /><MetricCard icon={<Zap />} label="Automatizaciones fallidas" value={operations.counters.failedAutomations} danger={operations.counters.failedAutomations > 0} /><MetricCard icon={<ArchiveRestore />} label="Exportaciones pendientes" value={operations.counters.pendingExports} /><MetricCard icon={<ShieldCheck />} label="Calidad fallida" value={operations.counters.failedQualityRuns} danger={operations.counters.failedQualityRuns > 0} /></section><section className="platform-operations-grid"><OperationsBlock kind="errors" title="Errores de aplicación" rows={operations.errors} icon={<FileWarning />} onChanged={reload} /><OperationsBlock kind="emails" title="Cola de correos" rows={operations.emailQueue} icon={<MailWarning />} onChanged={reload} /><OperationsBlock kind="automations" title="Automatizaciones" rows={operations.automations} icon={<Zap />} onChanged={reload} /><OperationsBlock kind="exports" title="Exportaciones" rows={operations.exportJobs} icon={<ArchiveRestore />} onChanged={reload} /><OperationsBlock kind="quality" title="Ejecuciones de calidad" rows={operations.qualityRuns} icon={<ShieldCheck />} onChanged={reload} /></section></div>;
}

function OperationsBlock({ kind, title, rows, icon, onChanged }: { kind: 'errors' | 'emails' | 'automations' | 'exports' | 'quality'; title: string; rows: Array<Record<string, unknown>>; icon: ReactNode; onChanged: () => void }) {
  const [actionRow, setActionRow] = useState<Record<string, unknown> | null>(null);
  function canAct(row: Record<string, unknown>): boolean {
    if (kind === 'errors') return !row.resolved_at;
    if (kind === 'emails') return ['failed', 'dead_letter'].includes(String(row.status || ''));
    if (kind === 'automations') return String(row.status || '') === 'failed';
    return false;
  }
  return <article className="card platform-panel"><header><div><h2>{title}</h2><p>{rows.length} registros recientes</p></div>{icon}</header><div className="platform-operation-list">{rows.slice(0, 20).map((row, index) => <details key={String(row.id || index)}><summary><span><strong>{String(row.title || row.message || row.event_type || row.status || row.code || `Registro ${index + 1}`)}</strong><small>{String(row.organization_name || row.recipient_email || row.source || '')}</small></span><span className={toneForStatus(String(row.status || row.severity || ''))}>{String(row.status || row.severity || '')}</span></summary><pre>{JSON.stringify(row, null, 2)}</pre>{canAct(row) ? <button className="btn btn-white compact" onClick={() => setActionRow(row)}>{kind === 'errors' ? 'Marcar resuelto' : 'Reintentar proceso'}</button> : null}</details>)}{!rows.length ? <div className="platform-empty"><CheckCircle2 /><strong>Sin registros problemáticos</strong></div> : null}</div>{actionRow ? <OperationActionModal kind={kind} row={actionRow} onClose={() => setActionRow(null)} onSaved={() => { setActionRow(null); onChanged(); }} /> : null}</article>;
}

function OperationActionModal({ kind, row, onClose, onSaved }: { kind: 'errors' | 'emails' | 'automations' | 'exports' | 'quality'; row: Record<string, unknown>; onClose: () => void; onSaved: () => void }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (reason.trim().length < 5) { setError('Registra una justificación de mínimo 5 caracteres.'); return; }
    setSaving(true); setError('');
    try {
      if (kind === 'errors') await platformService.resolveError(Number(row.id), reason.trim());
      if (kind === 'emails') await platformService.retryEmail(String(row.id), reason.trim());
      if (kind === 'automations') await platformService.retryAutomation(String(row.id), reason.trim());
      onSaved();
    } catch (actionError) { setError(actionError instanceof Error ? actionError.message : 'No fue posible ejecutar la acción.'); }
    finally { setSaving(false); }
  }
  return <div className="platform-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="platform-modal card" onSubmit={submit}><header><div><span className="eyebrow">Operación técnica</span><h2>{kind === 'errors' ? 'Resolver error' : 'Reintentar proceso'}</h2></div><button type="button" onClick={onClose}><X /></button></header><pre className="platform-json">{JSON.stringify(row, null, 2)}</pre><label>Justificación<textarea rows={4} value={reason} onChange={(event) => setReason(event.target.value)} /></label>{error ? <div className="alert danger">{error}</div> : null}<footer><button type="button" className="btn btn-white" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Procesando...' : 'Confirmar y auditar'}</button></footer></form></div>;
}

function TicketTable({ rows, compact = false }: { rows: SupportTicket[]; compact?: boolean }) {
  return <section className="card platform-table-card"><div className="platform-table-scroll"><table><thead><tr><th>Ticket</th><th>Asunto</th><th>Prioridad</th><th>Estado</th><th>Actualización</th><th /></tr></thead><tbody>{rows.map((ticket) => <tr key={ticket.id}><td><strong>{ticket.ticketNumber}</strong><small>{ticket.requesterName}</small></td><td>{ticket.subject}</td><td>{ticket.priority}</td><td><span className={toneForStatus(ticket.status)}>{statusLabel(ticket.status)}</span></td><td>{formatDate(ticket.updatedAt)}</td><td><Link className="btn btn-white compact" to={`/superadmin/tickets?ticket=${ticket.id}`}>Abrir</Link></td></tr>)}</tbody></table></div>{!rows.length ? <div className="platform-empty"><LifeBuoy /><strong>Sin tickets</strong></div> : null}</section>;
}

function TicketCompactList({ rows }: { rows: SupportTicket[] }) {
  return <div className="platform-compact-list">{rows.length ? rows.map((ticket) => <Link key={ticket.id} to={`/superadmin/tickets?ticket=${ticket.id}`}><span><strong>{ticket.ticketNumber} · {ticket.subject}</strong><small>{ticket.organizationName} · {formatDate(ticket.updatedAt)}</small></span><span className={toneForStatus(ticket.status)}>{statusLabel(ticket.status)}</span></Link>) : <div className="platform-empty"><CheckCircle2 /><strong>Sin tickets recientes</strong></div>}</div>;
}

function Pagination({ current, total, pageSize, onChange }: { current: number; total: number; pageSize: number; onChange: (page: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  if (totalPages <= 1) return null;
  return <div className="platform-pagination"><button className="btn btn-white" disabled={current <= 1} onClick={() => onChange(current - 1)}>Anterior</button><span>Página <strong>{current}</strong> de <strong>{totalPages}</strong></span><button className="btn btn-white" disabled={current >= totalPages} onClick={() => onChange(current + 1)}>Siguiente</button></div>;
}
