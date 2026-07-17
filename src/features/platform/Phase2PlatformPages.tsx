import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  DatabaseBackup,
  Eye,
  FileJson,
  Gauge,
  KeyRound,
  LockKeyhole,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  Users,
  XCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { usePlatformAccess } from './PlatformAccessProvider';
import { platformService } from './platformService';
import type {
  BackupRestoreRequest,
  OrganizationBackupJob,
  OrganizationUsageControl,
  PlatformAdminRole,
  PlatformExplorerResult,
  PlatformOrganizationSummary,
  PlatformRecoverySnapshot,
  PlatformSecuritySnapshot,
  PlatformSupportAccessRequest,
  PlatformSupportAccessSnapshot,
  PlatformSupportSessionV2,
  PlatformUser
} from './types';

type AsyncState<T> = { data: T | null; loading: boolean; error: string };

function useLoad<T>(loader: () => Promise<T>, deps: readonly unknown[]) {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: true, error: '' });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setState((previous) => ({ ...previous, loading: true, error: '' }));
    void loader().then((data) => active && setState({ data, loading: false, error: '' }))
      .catch((error: unknown) => active && setState((previous) => ({ ...previous, loading: false, error: error instanceof Error ? error.message : 'No fue posible cargar la información.' })));
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, revision]);
  return { ...state, reload: () => setRevision((value) => value + 1) };
}

function date(value: string | null | undefined): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
}

function number(value: unknown): string {
  return new Intl.NumberFormat('es-CO').format(Number(value || 0));
}

function bytes(value: unknown): string {
  let amount = Number(value || 0);
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) { amount /= 1024; unit += 1; }
  return `${amount.toFixed(unit === 0 ? 0 : amount >= 10 ? 1 : 2)} ${units[unit]}`;
}

function PageHead({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return <header className="platform-page-head"><div><span className="eyebrow">Orkesta · Operación de plataforma</span><h1>{title}</h1><p>{description}</p></div>{actions ? <div className="platform-page-actions">{actions}</div> : null}</header>;
}

function Feedback({ error, success }: { error?: string; success?: string }) {
  return <>{error ? <div className="alert danger">{error}</div> : null}{success ? <div className="alert success">{success}</div> : null}</>;
}

function Loading() {
  return <section className="card platform-loading"><RefreshCw className="spin" /><strong>Cargando información...</strong></section>;
}

function Card({ title, description, icon, children }: { title: string; description?: string; icon?: ReactNode; children: ReactNode }) {
  return <section className="card platform-panel phase2-card"><header><div><h2>{title}</h2>{description ? <p>{description}</p> : null}</div>{icon}</header>{children}</section>;
}

function can(context: ReturnType<typeof usePlatformAccess>['context'], permission: string): boolean {
  return Boolean(context?.permissions.includes('platform.*') || context?.permissions.includes(permission));
}

export function PlatformSecurityTeamPage() {
  const { context, reload: reloadAccess } = usePlatformAccess();
  const security = useLoad<PlatformSecuritySnapshot>(() => platformService.getSecurity(), []);
  const users = useLoad(() => platformService.listUsers({ pageSize: 200 }), []);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedRole, setSelectedRole] = useState<PlatformAdminRole>('support_agent');
  const [active, setActive] = useState(true);
  const [teamReason, setTeamReason] = useState('');
  const [securityReason, setSecurityReason] = useState('');
  const [feedback, setFeedback] = useState({ error: '', success: '' });
  const [saving, setSaving] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (!security.data) return;
    const s = security.data.settings;
    setSettingsDraft({
      enforceMfa: s.enforce_mfa,
      requireMfaForSensitiveActions: s.require_mfa_for_sensitive_actions,
      supportSessionDefaultMinutes: s.support_session_default_minutes,
      supportSessionMaxMinutes: s.support_session_max_minutes,
      requireTicketForWriteAccess: s.require_ticket_for_write_access,
      requireTwoPersonApprovalForAdminAccess: s.require_two_person_approval_for_admin_access,
      notifyOrganizationOnSupportAccess: s.notify_organization_on_support_access,
      sessionIdleMinutes: s.session_idle_minutes
    });
  }, [security.data]);

  async function saveTeam(event: FormEvent) {
    event.preventDefault();
    if (!selectedUser || teamReason.trim().length < 10) { setFeedback({ error: 'Selecciona un usuario y registra una justificación de mínimo 10 caracteres.', success: '' }); return; }
    setSaving(true); setFeedback({ error: '', success: '' });
    try {
      await platformService.upsertPlatformAdmin({ userId: selectedUser, roleCode: selectedRole, isActive: active, reason: teamReason.trim() });
      setTeamReason(''); setSelectedUser(''); setFeedback({ error: '', success: 'Operador de plataforma actualizado y auditado.' });
      security.reload(); reloadAccess();
    } catch (error) { setFeedback({ error: error instanceof Error ? error.message : 'No fue posible actualizar el equipo.', success: '' }); }
    finally { setSaving(false); }
  }

  async function saveSecurity(event: FormEvent) {
    event.preventDefault();
    if (securityReason.trim().length < 10) { setFeedback({ error: 'La justificación debe tener mínimo 10 caracteres.', success: '' }); return; }
    setSaving(true); setFeedback({ error: '', success: '' });
    try {
      await platformService.updateSecurity(settingsDraft, securityReason.trim());
      setSecurityReason('');
      setFeedback({ error: '', success: 'Política de seguridad actualizada.' }); security.reload(); reloadAccess();
    } catch (error) { setFeedback({ error: error instanceof Error ? error.message : 'No fue posible guardar la seguridad.', success: '' }); }
    finally { setSaving(false); }
  }

  if (security.loading && !security.data) return <Loading />;
  return <div className="platform-page">
    <PageHead title="Equipo y seguridad" description="Roles globales, permisos, MFA y controles de acceso temporal de la plataforma." actions={<button className="btn btn-white" onClick={security.reload}><RefreshCw size={16} />Actualizar</button>} />
    <Feedback {...feedback} />
    <section className="phase2-summary-strip">
      <div><ShieldCheck /><span><strong>{security.data?.team.filter((member) => member.isActive).length || 0}</strong> operadores activos</span></div>
      <div><KeyRound /><span><strong>{security.data?.team.filter((member) => member.mfaEnrolled).length || 0}</strong> con MFA</span></div>
      <div><LockKeyhole /><span><strong>{security.data?.currentAal === 'aal2' ? 'AAL2' : 'AAL1'}</strong> sesión actual</span></div>
    </section>
    <section className="phase2-two-columns">
      <Card title="Política de seguridad" description="La activación obligatoria de MFA se puede preparar y habilitar cuando todos los operadores estén enrolados." icon={<ShieldAlert />}>
        <form className="phase2-form" onSubmit={saveSecurity}>
          <Toggle label="Exigir MFA a los Super Admin" checked={Boolean(settingsDraft.enforceMfa)} onChange={(value) => setSettingsDraft((old) => ({ ...old, enforceMfa: value }))} />
          <Toggle label="Exigir MFA para acciones sensibles" checked={Boolean(settingsDraft.requireMfaForSensitiveActions)} onChange={(value) => setSettingsDraft((old) => ({ ...old, requireMfaForSensitiveActions: value }))} />
          <Toggle label="Exigir ticket para acceso con edición" checked={Boolean(settingsDraft.requireTicketForWriteAccess)} onChange={(value) => setSettingsDraft((old) => ({ ...old, requireTicketForWriteAccess: value }))} />
          <Toggle label="Doble aprobación para acceso administrador" checked={Boolean(settingsDraft.requireTwoPersonApprovalForAdminAccess)} onChange={(value) => setSettingsDraft((old) => ({ ...old, requireTwoPersonApprovalForAdminAccess: value }))} />
          <Toggle label="Notificar a la organización sobre accesos" checked={Boolean(settingsDraft.notifyOrganizationOnSupportAccess)} onChange={(value) => setSettingsDraft((old) => ({ ...old, notifyOrganizationOnSupportAccess: value }))} />
          <div className="phase2-form-grid">
            <label>Duración predeterminada<input type="number" min={5} max={240} value={Number(settingsDraft.supportSessionDefaultMinutes || 30)} onChange={(e) => setSettingsDraft((old) => ({ ...old, supportSessionDefaultMinutes: Number(e.target.value) }))} /></label>
            <label>Duración máxima<input type="number" min={5} max={480} value={Number(settingsDraft.supportSessionMaxMinutes || 60)} onChange={(e) => setSettingsDraft((old) => ({ ...old, supportSessionMaxMinutes: Number(e.target.value) }))} /></label>
            <label>Inactividad máxima<input type="number" min={5} max={120} value={Number(settingsDraft.sessionIdleMinutes || 15)} onChange={(e) => setSettingsDraft((old) => ({ ...old, sessionIdleMinutes: Number(e.target.value) }))} /></label>
          </div>
          <label>Justificación<textarea rows={3} value={securityReason} onChange={(e) => setSecurityReason(e.target.value)} placeholder="Motivo del cambio de seguridad" /></label>
          <button className="btn btn-primary" disabled={saving || !can(context, 'platform.security.manage')}><Save size={16} />Guardar política</button>
        </form>
      </Card>
      <Card title="MFA de mi cuenta" description="Configura un segundo factor TOTP antes de activar su obligatoriedad global." icon={<KeyRound />}>
        <MfaSetup enrolled={Boolean(context?.mfaEnrolled)} verified={Boolean(context?.mfaVerified)} onChanged={async () => { reloadAccess(); }} />
        <div className="phase2-security-note"><strong>Regla de despliegue</strong><p>Primero enrola todos los operadores; después activa MFA obligatorio. Las acciones sensibles validan AAL2 desde las RPC V2.</p></div>
      </Card>
    </section>
    <Card title="Operadores de plataforma" description="Los roles son globales y no dependen de una organización." icon={<Users />}>
      <div className="platform-table-scroll"><table><thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>MFA</th><th>Último acceso</th></tr></thead><tbody>{security.data?.team.map((member) => <tr key={member.userId}><td><strong>{member.name}</strong><small>{member.email}</small></td><td>{member.roleName}<small>{member.roleCode}</small></td><td><span className={`platform-chip ${member.isActive ? 'success' : 'danger'}`}>{member.isActive ? 'Activo' : 'Suspendido'}</span></td><td><span className={`platform-chip ${member.mfaEnrolled ? 'success' : 'warning'}`}>{member.mfaEnrolled ? `${member.mfaVerifiedFactors} factor(es)` : 'Sin enrolar'}</span></td><td>{date(member.lastAccessAt)}</td></tr>)}</tbody></table></div>
      {can(context, 'platform.team.manage') ? <form className="phase2-inline-admin" onSubmit={saveTeam}>
        <label>Usuario<select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}><option value="">Seleccionar usuario</option>{users.data?.rows.map((user: PlatformUser) => <option key={user.id} value={user.id}>{user.name} · {user.email}</option>)}</select></label>
        <label>Rol<select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value as PlatformAdminRole)}>{security.data?.roles.filter((role) => role.isActive).map((role) => <option key={role.code} value={role.code}>{role.name}</option>)}</select></label>
        <label>Estado<select value={active ? 'active' : 'inactive'} onChange={(e) => setActive(e.target.value === 'active')}><option value="active">Activo</option><option value="inactive">Suspendido</option></select></label>
        <label className="wide">Justificación<input value={teamReason} onChange={(e) => setTeamReason(e.target.value)} placeholder="Asignación o cambio de rol" /></label>
        <button className="btn btn-primary" disabled={saving}><UserCog size={16} />Aplicar rol</button>
      </form> : null}
    </Card>
  </div>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="phase2-toggle"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><span /><strong>{label}</strong></label>;
}

function MfaSetup({ enrolled, verified, onChanged }: { enrolled: boolean; verified: boolean; onChanged: () => Promise<void> }) {
  const [factorId, setFactorId] = useState('');
  const [qr, setQr] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function enroll() {
    setError(''); setMessage('');
    try {
      if (!supabase) throw new Error('Supabase no está configurado.');
      const { data, error: enrollError } = await (supabase.auth.mfa as any).enroll({ factorType: 'totp', friendlyName: 'Orkesta Super Admin' });
      if (enrollError) throw enrollError;
      setFactorId(String(data.id)); setQr(String(data.totp?.qr_code || '')); setSecret(String(data.totp?.secret || ''));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible iniciar MFA.'); }
  }
  async function verify() {
    setError('');
    try {
      if (!supabase || !factorId || code.trim().length < 6) throw new Error('Ingresa el código de seis dígitos.');
      const { data: challenge, error: challengeError } = await (supabase.auth.mfa as any).challenge({ factorId });
      if (challengeError) throw challengeError;
      const { error: verifyError } = await (supabase.auth.mfa as any).verify({ factorId, challengeId: challenge.id, code: code.trim() });
      if (verifyError) throw verifyError;
      setMessage('MFA verificado. Cierra y vuelve a iniciar sesión para usar AAL2.'); setQr(''); setSecret(''); setCode('');
      await onChanged();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible verificar MFA.'); }
  }
  return <div className="phase2-mfa-box">
    <div className={`phase2-mfa-status ${enrolled ? 'ok' : ''}`}><BadgeCheck /><div><strong>{enrolled ? 'Factor enrolado' : 'Factor pendiente'}</strong><p>{verified ? 'La sesión actual está verificada en AAL2.' : enrolled ? 'El factor existe; la sesión actual todavía está en AAL1.' : 'Usa una aplicación autenticadora compatible con TOTP.'}</p></div></div>
    {!enrolled && !qr ? <button className="btn btn-primary" onClick={() => void enroll()} type="button"><KeyRound size={16} />Configurar MFA</button> : null}
    {qr ? <div className="phase2-mfa-enroll"><div className="phase2-qr" dangerouslySetInnerHTML={{ __html: qr }} /><code>{secret}</code><label>Código<input inputMode="numeric" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} /></label><button className="btn btn-primary" onClick={() => void verify()} type="button">Verificar factor</button></div> : null}
    <Feedback error={error} success={message} />
  </div>;
}

export function PlatformSupportAccessPage() {
  const { context } = usePlatformAccess();
  const access = useLoad<PlatformSupportAccessSnapshot>(() => platformService.listSupportAccess(), []);
  const organizations = useLoad(() => platformService.listOrganizations({ pageSize: 100 }), []);
  const tickets = useLoad(() => platformService.listTickets({ pageSize: 100 }), []);
  const [form, setForm] = useState({ organizationId: '', mode: 'read_only' as 'read_only' | 'support' | 'admin', ticketId: '', duration: 30, reason: '', scopes: ['overview', 'cases', 'configuration'] });
  const [feedback, setFeedback] = useState({ error: '', success: '' });
  const [working, setWorking] = useState('');

  const orgTickets = useMemo(() => tickets.data?.rows.filter((ticket) => !form.organizationId || ticket.organizationId === form.organizationId) || [], [tickets.data, form.organizationId]);
  async function request(event: FormEvent) {
    event.preventDefault(); setWorking('request'); setFeedback({ error: '', success: '' });
    try {
      const result = await platformService.requestSupportAccess({ organizationId: form.organizationId, mode: form.mode, scopes: form.scopes, reason: form.reason, ticketId: form.ticketId || undefined, durationMinutes: form.duration });
      setFeedback({ error: '', success: `Solicitud creada en estado ${result.status}.` }); setForm((old) => ({ ...old, reason: '' })); access.reload();
    } catch (error) { setFeedback({ error: error instanceof Error ? error.message : 'No fue posible solicitar el acceso.', success: '' }); }
    finally { setWorking(''); }
  }
  async function decide(item: PlatformSupportAccessRequest, approved: boolean) {
    const reason = window.prompt(approved ? 'Justificación de aprobación (mínimo 10 caracteres):' : 'Motivo del rechazo (mínimo 10 caracteres):');
    if (!reason) return;
    setWorking(item.id); setFeedback({ error: '', success: '' });
    try { await platformService.decideSupportAccess(item.id, approved, reason); setFeedback({ error: '', success: approved ? 'Acceso aprobado.' : 'Acceso rechazado.' }); access.reload(); }
    catch (error) { setFeedback({ error: error instanceof Error ? error.message : 'No fue posible decidir.', success: '' }); }
    finally { setWorking(''); }
  }
  async function start(item: PlatformSupportAccessRequest) {
    setWorking(item.id); setFeedback({ error: '', success: '' });
    try { const session = await platformService.startApprovedSupportSession(item.id); setFeedback({ error: '', success: `Sesión iniciada hasta ${date(session.expiresAt)}.` }); access.reload(); }
    catch (error) { setFeedback({ error: error instanceof Error ? error.message : 'No fue posible iniciar la sesión.', success: '' }); }
    finally { setWorking(''); }
  }
  async function end(session: PlatformSupportSessionV2) {
    const reason = window.prompt('Motivo de finalización:') || 'Finalización manual desde Super Admin';
    setWorking(session.id);
    try { await platformService.endSupportSessionV2(session.id, reason); access.reload(); }
    catch (error) { setFeedback({ error: error instanceof Error ? error.message : 'No fue posible cerrar la sesión.', success: '' }); }
    finally { setWorking(''); }
  }

  return <div className="platform-page">
    <PageHead title="Acceso de soporte" description="Solicitudes, aprobaciones, alcance, MFA, expiración y trazabilidad de las sesiones temporales." actions={<button className="btn btn-white" onClick={access.reload}><RefreshCw size={16} />Actualizar</button>} />
    <Feedback {...feedback} />
    <section className="phase2-two-columns access-layout">
      <Card title="Solicitar acceso" description="El acceso de escritura requiere ticket y puede exigir doble aprobación." icon={<LockKeyhole />}>
        <form className="phase2-form" onSubmit={request}>
          <label>Organización<select required value={form.organizationId} onChange={(e) => setForm((old) => ({ ...old, organizationId: e.target.value, ticketId: '' }))}><option value="">Seleccionar</option>{organizations.data?.rows.map((org: PlatformOrganizationSummary) => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label>
          <div className="phase2-form-grid"><label>Modo<select value={form.mode} onChange={(e) => setForm((old) => ({ ...old, mode: e.target.value as typeof form.mode }))}><option value="read_only">Solo lectura</option><option value="support">Soporte operativo</option><option value="admin">Administración temporal</option></select></label><label>Duración (min)<input type="number" min={5} max={480} value={form.duration} onChange={(e) => setForm((old) => ({ ...old, duration: Number(e.target.value) }))} /></label></div>
          <label>Ticket relacionado<select value={form.ticketId} onChange={(e) => setForm((old) => ({ ...old, ticketId: e.target.value }))}><option value="">Sin ticket</option>{orgTickets.map((ticket) => <option key={ticket.id} value={ticket.id}>{ticket.ticketNumber} · {ticket.subject}</option>)}</select></label>
          <fieldset><legend>Alcance</legend>{['overview', 'cases', 'users', 'configuration', 'documents', 'operations'].map((scope) => <label key={scope}><input type="checkbox" checked={form.scopes.includes(scope)} onChange={(e) => setForm((old) => ({ ...old, scopes: e.target.checked ? [...old.scopes, scope] : old.scopes.filter((item) => item !== scope) }))} /> {scope}</label>)}</fieldset>
          <label>Motivo<textarea required minLength={10} rows={4} value={form.reason} onChange={(e) => setForm((old) => ({ ...old, reason: e.target.value }))} /></label>
          <button className="btn btn-primary" disabled={working === 'request' || !can(context, 'platform.support.access')}><LockKeyhole size={16} />Crear solicitud</button>
        </form>
      </Card>
      <Card title="Sesiones activas" description="Cada sesión vence automáticamente y la organización recibe notificación." icon={<Clock3 />}>
        <div className="phase2-session-list">{access.data?.sessions.filter((session) => session.isActive).map((session) => <article key={session.id}><div><strong>{session.organizationName}</strong><p>{session.mode} · {session.scopes.join(', ')}</p><small>{session.adminName} · Hasta {date(session.expiresAt)}</small></div><div><span className={`platform-chip ${session.mfaVerified ? 'success' : 'warning'}`}>{session.mfaVerified ? 'MFA' : 'AAL1'}</span><Link className="btn btn-white compact" to={`/superadmin/explorer?organizationId=${session.organizationId}`}>Abrir</Link><button className="btn btn-white compact" onClick={() => void end(session)} disabled={working === session.id}>Cerrar</button></div></article>)}{!access.data?.sessions.some((session) => session.isActive) ? <div className="platform-empty"><CheckCircle2 /><strong>Sin sesiones activas</strong></div> : null}</div>
      </Card>
    </section>
    <Card title="Solicitudes de acceso" description="El modo administrador exige aprobación independiente cuando la política está activa." icon={<ShieldCheck />}>
      <div className="platform-table-scroll"><table><thead><tr><th>Organización</th><th>Solicitante</th><th>Modo y alcance</th><th>Ticket</th><th>Estado</th><th>Vence</th><th>Acciones</th></tr></thead><tbody>{access.data?.requests.map((item) => <tr key={item.id}><td><strong>{item.organizationName}</strong><small>{item.reason}</small></td><td>{item.requestedByName || item.requestedBy}<small>{date(item.requestedAt)}</small></td><td>{item.mode}<small>{item.scopes.join(', ')}</small></td><td>{item.ticketNumber || '—'}</td><td><span className={`platform-chip ${item.status === 'approved' ? 'success' : item.status === 'pending' ? 'warning' : item.status === 'started' ? 'info' : ''}`}>{item.status}</span></td><td>{date(item.expiresAt)}</td><td><div className="phase2-actions">{item.status === 'pending' && can(context, 'platform.support.approve') ? <><button className="btn btn-white compact" onClick={() => void decide(item, true)} disabled={working === item.id}>Aprobar</button><button className="btn btn-white compact danger-text" onClick={() => void decide(item, false)} disabled={working === item.id}>Rechazar</button></> : null}{item.status === 'approved' ? <button className="btn btn-primary compact" onClick={() => void start(item)} disabled={working === item.id}><Play size={14} />Iniciar</button> : null}</div></td></tr>)}</tbody></table></div>
    </Card>
  </div>;
}

export function PlatformRecoveryPage() {
  const { context } = usePlatformAccess();
  const recovery = useLoad<PlatformRecoverySnapshot>(() => platformService.listRecovery(), []);
  const organizations = useLoad(() => platformService.listOrganizations({ pageSize: 100 }), []);
  const backups = useLoad(() => platformService.listBackups({ status: 'completed', pageSize: 200 }), []);
  const [schedule, setSchedule] = useState({ organizationId: '', enabled: true, frequency: 'weekly' as 'daily' | 'weekly' | 'monthly', localTime: '02:00', timezone: 'America/Bogota', dayOfWeek: 0, dayOfMonth: 1, scope: 'full' as OrganizationBackupJob['scope'], retentionDays: 90, reason: '' });
  const [restore, setRestore] = useState({ backupJobId: '', reason: '', restoreMode: 'merge' as 'merge' | 'replace', targetEnvironment: 'validation' as 'validation' | 'production' });
  const [feedback, setFeedback] = useState({ error: '', success: '' });
  const [working, setWorking] = useState('');

  async function saveSchedule(event: FormEvent) {
    event.preventDefault(); setWorking('schedule'); setFeedback({ error: '', success: '' });
    try { await platformService.upsertBackupSchedule({ ...schedule }); setFeedback({ error: '', success: 'Programación guardada y auditada.' }); recovery.reload(); }
    catch (error) { setFeedback({ error: error instanceof Error ? error.message : 'No fue posible guardar la programación.', success: '' }); }
    finally { setWorking(''); }
  }
  async function requestRestore(event: FormEvent) {
    event.preventDefault(); setWorking('restore'); setFeedback({ error: '', success: '' });
    try { const item = await platformService.requestRestore(restore); setFeedback({ error: '', success: `Restauración ${item.id} creada. Código de confirmación: ${item.confirmationCode}` }); setRestore((old) => ({ ...old, reason: '' })); recovery.reload(); }
    catch (error) { setFeedback({ error: error instanceof Error ? error.message : 'No fue posible solicitar la restauración.', success: '' }); }
    finally { setWorking(''); }
  }
  async function decide(item: BackupRestoreRequest, approved: boolean) {
    const reason = window.prompt(approved ? 'Justificación de aprobación:' : 'Motivo del rechazo:'); if (!reason) return;
    setWorking(item.id);
    try { await platformService.decideRestore(item.id, approved, reason); recovery.reload(); }
    catch (error) { setFeedback({ error: error instanceof Error ? error.message : 'No fue posible decidir.', success: '' }); }
    finally { setWorking(''); }
  }
  async function process(item: BackupRestoreRequest, operation: 'validate' | 'apply') {
    let code: string | undefined;
    if (operation === 'apply') { code = window.prompt(`Escribe el código ${item.confirmationCode} para confirmar la restauración:`) || undefined; if (!code) return; }
    setWorking(item.id); setFeedback({ error: '', success: '' });
    try { await platformService.processRestore(item.id, operation, code); setFeedback({ error: '', success: operation === 'validate' ? 'Backup validado. Revisa el informe.' : 'Restauración finalizada.' }); recovery.reload(); }
    catch (error) { setFeedback({ error: error instanceof Error ? error.message : 'No fue posible procesar la restauración.', success: '' }); }
    finally { setWorking(''); }
  }

  return <div className="platform-page">
    <PageHead title="Continuidad y recuperación" description="Backups programados, validación de integridad y restauración con aprobación y código de confirmación." actions={<button className="btn btn-white" onClick={() => { recovery.reload(); backups.reload(); }}><RefreshCw size={16} />Actualizar</button>} />
    <Feedback {...feedback} />
    <section className="phase2-two-columns">
      <Card title="Programar backup" description="El scheduler central crea los trabajos y conserva la trazabilidad." icon={<Clock3 />}>
        <form className="phase2-form" onSubmit={saveSchedule}>
          <label>Organización<select required value={schedule.organizationId} onChange={(e) => setSchedule((old) => ({ ...old, organizationId: e.target.value }))}><option value="">Seleccionar</option>{organizations.data?.rows.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label>
          <Toggle label="Programación activa" checked={schedule.enabled} onChange={(value) => setSchedule((old) => ({ ...old, enabled: value }))} />
          <div className="phase2-form-grid"><label>Frecuencia<select value={schedule.frequency} onChange={(e) => setSchedule((old) => ({ ...old, frequency: e.target.value as typeof old.frequency }))}><option value="daily">Diario</option><option value="weekly">Semanal</option><option value="monthly">Mensual</option></select></label><label>Hora<input type="time" value={schedule.localTime} onChange={(e) => setSchedule((old) => ({ ...old, localTime: e.target.value }))} /></label><label>Retención<input type="number" min={7} max={3650} value={schedule.retentionDays} onChange={(e) => setSchedule((old) => ({ ...old, retentionDays: Number(e.target.value) }))} /></label></div>
          {schedule.frequency === 'weekly' ? <label>Día de semana<select value={schedule.dayOfWeek} onChange={(e) => setSchedule((old) => ({ ...old, dayOfWeek: Number(e.target.value) }))}><option value={0}>Domingo</option><option value={1}>Lunes</option><option value={2}>Martes</option><option value={3}>Miércoles</option><option value={4}>Jueves</option><option value={5}>Viernes</option><option value={6}>Sábado</option></select></label> : null}
          {schedule.frequency === 'monthly' ? <label>Día del mes<input type="number" min={1} max={28} value={schedule.dayOfMonth} onChange={(e) => setSchedule((old) => ({ ...old, dayOfMonth: Number(e.target.value) }))} /></label> : null}
          <label>Alcance<select value={schedule.scope} onChange={(e) => setSchedule((old) => ({ ...old, scope: e.target.value as OrganizationBackupJob['scope'] }))}><option value="full">Completo</option><option value="database">Datos</option><option value="documents">Documentos</option><option value="configuration">Configuración</option></select></label>
          <label>Justificación<textarea required minLength={10} rows={3} value={schedule.reason} onChange={(e) => setSchedule((old) => ({ ...old, reason: e.target.value }))} /></label>
          <button className="btn btn-primary" disabled={working === 'schedule' || !can(context, 'platform.backups.manage')}><Save size={16} />Guardar programación</button>
        </form>
      </Card>
      <Card title="Solicitar restauración" description="Primero se valida. La aplicación en producción exige aprobación distinta y código." icon={<RotateCcw />}>
        <form className="phase2-form" onSubmit={requestRestore}>
          <label>Backup completado<select required value={restore.backupJobId} onChange={(e) => setRestore((old) => ({ ...old, backupJobId: e.target.value }))}><option value="">Seleccionar</option>{backups.data?.rows.map((backup) => <option key={backup.id} value={backup.id}>{backup.organizationName} · {date(backup.createdAt)} · {backup.scope}</option>)}</select></label>
          <div className="phase2-form-grid"><label>Modo<select value={restore.restoreMode} onChange={(e) => setRestore((old) => ({ ...old, restoreMode: e.target.value as typeof old.restoreMode }))}><option value="merge">Combinar</option><option value="replace">Reemplazar</option></select></label><label>Destino<select value={restore.targetEnvironment} onChange={(e) => setRestore((old) => ({ ...old, targetEnvironment: e.target.value as typeof old.targetEnvironment }))}><option value="validation">Validación</option><option value="production">Producción</option></select></label></div>
          <label>Motivo<textarea required minLength={10} rows={4} value={restore.reason} onChange={(e) => setRestore((old) => ({ ...old, reason: e.target.value }))} /></label>
          <button className="btn btn-primary" disabled={working === 'restore' || !can(context, 'platform.backups.restore')}><DatabaseBackup size={16} />Crear solicitud</button>
        </form>
      </Card>
    </section>
    <Card title="Programaciones" icon={<Clock3 />}><div className="platform-table-scroll"><table><thead><tr><th>Organización</th><th>Frecuencia</th><th>Alcance</th><th>Retención</th><th>Próxima ejecución</th><th>Última ejecución</th></tr></thead><tbody>{recovery.data?.schedules.map((item) => <tr key={item.id}><td><strong>{item.organizationName}</strong><small>{item.enabled ? 'Activa' : 'Inactiva'}</small></td><td>{item.frequency} · {item.localTime}</td><td>{item.scope}</td><td>{item.retentionDays} días</td><td>{date(item.nextRunAt)}</td><td>{date(item.lastRunAt)}<small>{item.lastStatus}</small></td></tr>)}</tbody></table></div></Card>
    <Card title="Solicitudes de restauración" icon={<RotateCcw />}><div className="platform-table-scroll"><table><thead><tr><th>Organización</th><th>Solicitud</th><th>Modo</th><th>Estado</th><th>Validación</th><th>Acciones</th></tr></thead><tbody>{recovery.data?.restores.map((item) => <tr key={item.id}><td><strong>{item.organizationName}</strong><small>{item.requestedByName}</small></td><td>{date(item.createdAt)}<small>{item.reason}</small></td><td>{item.restoreMode} · {item.targetEnvironment}<small>Código: {item.confirmationCode}</small></td><td><span className={`platform-chip ${item.status === 'completed' || item.status === 'ready' ? 'success' : item.status === 'failed' || item.status === 'rejected' ? 'danger' : 'warning'}`}>{item.status}</span>{item.errorMessage ? <small className="danger-text">{item.errorMessage}</small> : null}</td><td><details><summary>Informe</summary><pre className="phase2-json">{JSON.stringify(item.validationReport, null, 2)}</pre></details></td><td><div className="phase2-actions">{item.status === 'pending_approval' ? <><button className="btn btn-white compact" onClick={() => void decide(item, true)} disabled={working === item.id}>Aprobar</button><button className="btn btn-white compact" onClick={() => void decide(item, false)} disabled={working === item.id}>Rechazar</button></> : null}{item.status === 'approved' ? <button className="btn btn-primary compact" onClick={() => void process(item, 'validate')} disabled={working === item.id}>Validar</button> : null}{item.status === 'ready' && item.targetEnvironment === 'production' ? <button className="btn btn-primary compact" onClick={() => void process(item, 'apply')} disabled={working === item.id}>Restaurar</button> : null}</div></td></tr>)}</tbody></table></div></Card>
  </div>;
}

export function PlatformUsageControlPage() {
  const { context } = usePlatformAccess();
  const organizations = useLoad(() => platformService.listOrganizations({ pageSize: 100 }), []);
  const [organizationId, setOrganizationId] = useState('');
  const usage = useLoad<OrganizationUsageControl>(() => organizationId ? platformService.getUsageControl(organizationId) : Promise.resolve({ organizationId: '', planLimits: {}, limitsOverride: {}, effectiveLimits: {}, planFeatures: {}, currentUsage: {}, history: [], featureFlags: [], alerts: [] }), [organizationId]);
  const [limitsText, setLimitsText] = useState('{}');
  const [featuresText, setFeaturesText] = useState('{}');
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState({ error: '', success: '' });
  const [working, setWorking] = useState(false);
  useEffect(() => {
    if (!usage.data || !organizationId) return;
    setLimitsText(JSON.stringify(usage.data.limitsOverride, null, 2));
    const flags = Object.fromEntries(usage.data.featureFlags.map((flag) => [flag.featureCode, { enabled: flag.enabled, configuration: flag.configuration }]));
    setFeaturesText(JSON.stringify(flags, null, 2));
  }, [usage.data, organizationId]);
  async function refresh() {
    if (!organizationId) return;
    setWorking(true);
    try { await platformService.refreshUsage(organizationId); usage.reload(); setFeedback({ error: '', success: 'Consumo recalculado.' }); }
    catch (error) { setFeedback({ error: error instanceof Error ? error.message : 'No fue posible recalcular.', success: '' }); }
    finally { setWorking(false); }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setWorking(true); setFeedback({ error: '', success: '' });
    try {
      const limits = JSON.parse(limitsText) as Record<string, unknown>;
      const flags = JSON.parse(featuresText) as Record<string, unknown>;
      await platformService.updateUsageControl({ organizationId, limitsOverride: limits, featureFlags: flags, reason });
      setFeedback({ error: '', success: 'Límites y funcionalidades actualizados.' }); usage.reload();
    } catch (error) { setFeedback({ error: error instanceof Error ? error.message : 'JSON inválido o actualización fallida.', success: '' }); }
    finally { setWorking(false); }
  }
  const current = usage.data?.currentUsage || {};
  return <div className="platform-page">
    <PageHead title="Uso, límites y funcionalidades" description="Consumo histórico, cuotas efectivas, alertas y feature flags por organización." actions={<button className="btn btn-white" disabled={!organizationId || working} onClick={() => void refresh()}><RefreshCw size={16} />Recalcular</button>} />
    <section className="card platform-filters"><select value={organizationId} onChange={(e) => setOrganizationId(e.target.value)}><option value="">Seleccionar organización</option>{organizations.data?.rows.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}</select></section>
    <Feedback {...feedback} />
    {!organizationId ? <section className="card platform-empty large"><Gauge /><strong>Selecciona una organización</strong><p>Se mostrará su consumo real, sus límites y las alertas activas.</p></section> : <>
      <section className="platform-metric-grid compact">
        <UsageMetric label="Usuarios activos" value={number(current.usersActive)} icon={<Users />} />
        <UsageMetric label="Casos totales" value={number(current.casesTotal)} icon={<FileJson />} />
        <UsageMetric label="Casos del mes" value={number(current.casesCreated)} icon={<Activity />} />
        <UsageMetric label="Almacenamiento" value={bytes(current.storageBytes)} icon={<DatabaseBackup />} />
        <UsageMetric label="Correos del mes" value={number(current.emailsSent)} icon={<Gauge />} />
        <UsageMetric label="Automatizaciones" value={number(current.automationsExecuted)} icon={<SlidersHorizontal />} />
      </section>
      <section className="phase2-two-columns">
        <Card title="Cuotas efectivas" description="Plan + sobrescrituras específicas." icon={<Gauge />}><div className="phase2-json-pair"><div><strong>Plan</strong><pre>{JSON.stringify(usage.data?.planLimits, null, 2)}</pre></div><div><strong>Efectivas</strong><pre>{JSON.stringify(usage.data?.effectiveLimits, null, 2)}</pre></div></div></Card>
        <Card title="Alertas de consumo" icon={<AlertTriangle />}><div className="phase2-alert-list">{usage.data?.alerts.map((alert) => <article key={alert.id} className={alert.severity}><div><strong>{alert.metricCode}</strong><p>{number(alert.currentValue)} de {number(alert.limitValue)}</p></div><span>{number(alert.percentage)}%</span></article>)}{!usage.data?.alerts.length ? <div className="platform-empty"><CheckCircle2 /><strong>Sin alertas activas</strong></div> : null}</div></Card>
      </section>
      <Card title="Administrar límites y feature flags" description="Las claves deben coincidir con las utilizadas por los planes y el frontend." icon={<SlidersHorizontal />}>
        <form className="phase2-control-editor" onSubmit={save}><label>Límites sobrescritos<textarea rows={12} value={limitsText} onChange={(e) => setLimitsText(e.target.value)} spellCheck={false} /></label><label>Feature flags<textarea rows={12} value={featuresText} onChange={(e) => setFeaturesText(e.target.value)} spellCheck={false} /></label><label className="full">Justificación<input required minLength={10} value={reason} onChange={(e) => setReason(e.target.value)} /></label><button className="btn btn-primary" disabled={working || !can(context, 'platform.usage.manage')}><Save size={16} />Guardar controles</button></form>
      </Card>
      <Card title="Histórico de 90 días" icon={<Activity />}><div className="phase2-history-bars">{usage.data?.history.slice(-30).map((row, index) => { const max = Math.max(...(usage.data?.history.map((item) => Number(item.casesTotal || 0)) || [1]), 1); const height = Math.max(4, Math.round((Number(row.casesTotal || 0) / max) * 100)); return <div key={String(row.date || index)} title={`${row.date}: ${row.casesTotal} casos`}><span style={{ height: `${height}%` }} /><small>{String(row.date || '').slice(5)}</small></div>; })}</div></Card>
    </>}
  </div>;
}

function UsageMetric({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return <article className="platform-metric card"><div className="platform-metric-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong></div></article>;
}

export function PlatformExplorerPage() {
  const organizations = useLoad(() => platformService.listOrganizations({ pageSize: 100 }), []);
  const [organizationId, setOrganizationId] = useState(() => new URLSearchParams(window.location.search).get('organizationId') || '');
  const [domain, setDomain] = useState('cases');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const explorer = useLoad<PlatformExplorerResult>(() => organizationId ? platformService.exploreOrganization({ organizationId, domain, search, page, pageSize: 50 }) : Promise.resolve({ domain, rows: [], total: 0, page: 1, pageSize: 50 }), [organizationId, domain, search, page]);
  const keys = useMemo(() => {
    const first = explorer.data?.rows[0];
    return first ? Object.keys(first).slice(0, 10) : [];
  }, [explorer.data]);
  return <div className="platform-page">
    <PageHead title="Explorador organizacional" description="Consulta controlada de casos, usuarios, documentos, errores, correos, automatizaciones, configuración y auditoría sin abrir la base de datos." actions={<button className="btn btn-white" onClick={explorer.reload}><RefreshCw size={16} />Actualizar</button>} />
    <section className="card platform-filters phase2-explorer-filters"><select value={organizationId} onChange={(e) => { setOrganizationId(e.target.value); setPage(1); }}><option value="">Seleccionar organización</option>{organizations.data?.rows.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}</select><select value={domain} onChange={(e) => { setDomain(e.target.value); setPage(1); }}><option value="cases">Casos</option><option value="assignments">Asignaciones</option><option value="subtasks">Subtareas</option><option value="documents">Documentos</option><option value="users">Usuarios</option><option value="emails">Correos</option><option value="automations">Automatizaciones</option><option value="errors">Errores</option><option value="audit">Auditoría</option><option value="configuration">Configuración</option></select><label><Search size={16} /><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar en el dominio" /></label></section>
    {!organizationId ? <section className="card platform-empty large"><Eye /><strong>Selecciona una organización</strong></section> : explorer.loading && !explorer.data ? <Loading /> : explorer.error ? <Feedback error={explorer.error} /> : <Card title={`${number(explorer.data?.total)} registros · ${domain}`} description="La vista es de solo lectura. Las acciones operativas se realizan mediante funciones auditadas." icon={<Eye />}>
      <div className="platform-table-scroll phase2-explorer-table"><table><thead><tr>{keys.map((key) => <th key={key}>{key}</th>)}<th>Detalle</th></tr></thead><tbody>{explorer.data?.rows.map((row, index) => <tr key={String(row.id || index)}>{keys.map((key) => <td key={key}>{renderCell(row[key])}</td>)}<td><details><summary>JSON</summary><pre className="phase2-json">{JSON.stringify(row, null, 2)}</pre></details></td></tr>)}</tbody></table></div>
      <div className="platform-pagination"><button className="btn btn-white" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Anterior</button><span>Página {page}</span><button className="btn btn-white" disabled={(explorer.data?.rows.length || 0) < 50} onClick={() => setPage((value) => value + 1)}>Siguiente</button></div>
    </Card>}
  </div>;
}

function renderCell(value: unknown): ReactNode {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'object') return <code>{JSON.stringify(value).slice(0, 80)}</code>;
  const text = String(value);
  return text.length > 80 ? `${text.slice(0, 77)}…` : text;
}

export function PlatformSchedulerPage() {
  const { context } = usePlatformAccess();
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  async function run() {
    setWorking(true); setError('');
    try { setResult(await platformService.runScheduler()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible ejecutar el scheduler.'); }
    finally { setWorking(false); }
  }
  return <div className="platform-page"><PageHead title="Scheduler central" description="Ejecución manual de respaldo para agregación de uso, SLA, expiraciones, límites y backups programados." /><Card title="Trabajo de mantenimiento" description="En producción debe programarse por cron; este botón sirve para pruebas y contingencia." icon={<Play />}><div className="phase2-scheduler"><ShieldCheck /><div><strong>Procesos incluidos</strong><p>Expira accesos, cierra sesiones vencidas, marca incumplimientos de soporte, captura uso, evalúa cuotas, actualiza suscripciones y crea backups programados.</p></div><button className="btn btn-primary" onClick={() => void run()} disabled={working || !can(context, 'platform.operations.manage')}><Play size={16} />{working ? 'Ejecutando...' : 'Ejecutar ahora'}</button></div><Feedback error={error} />{result ? <pre className="phase2-json">{JSON.stringify(result, null, 2)}</pre> : null}</Card></div>;
}
