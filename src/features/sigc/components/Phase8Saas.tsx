import { Component, useEffect, useMemo, useState, type CSSProperties, type ErrorInfo, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  Clipboard,
  Cloud,
  Copy,
  CreditCard,
  Gauge,
  Globe2,
  HeartPulse,
  Mail,
  Palette,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  XCircle
} from 'lucide-react';
import { useApp } from '../../../app/AppProvider';
import { supabase } from '../../../lib/supabaseClient';
import type { CreateOrganizationInvitationInput, SigcSaasContext, UpdateOrganizationProfileInput } from '../domain/types';
import { useOrganizationInvitation, useSigcAdminSnapshot, useSigcSaasContext } from '../hooks/useSigcData';
import { sigcService } from '../services/sigcService';

function formatNumber(value: number): string { return new Intl.NumberFormat('es-CO').format(value); }
function formatMoney(value: number): string { return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value); }
function formatDate(value?: string | null): string { if (!value) return '—'; const date = new Date(value); return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(date) : value; }
function formatBytes(value: number): string { if (value < 1024) return `${value} B`; const units = ['KB','MB','GB','TB']; let size = value; let index = -1; do { size /= 1024; index += 1; } while (size >= 1024 && index < units.length - 1); return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[index]}`; }
function slugify(value: string): string { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 63); }

export function useSaasTheme(): { context: SigcSaasContext | null; style: CSSProperties } {
  const { data: context } = useSigcSaasContext();
  const branding = context?.branding;
  const style = {
    '--primary': branding?.primaryColor ?? '#7c3aed',
    '--accent': branding?.accentColor ?? '#f97316',
    '--navy': branding?.sidebarColor ?? '#111827'
  } as CSSProperties;
  return { context, style };
}

export function OrganizationSwitcher() {
  const { data: context, isLoading } = useSigcSaasContext();
  const [changing, setChanging] = useState(false);
  if (!context || context.organizations.length <= 1) return null;
  return <label className="phase8-org-switcher" title="Cambiar organización activa"><Building2 size={16} /><select value={context.activeOrganization.id} disabled={changing || isLoading} onChange={async (event) => { setChanging(true); try { await sigcService.setActiveOrganization(event.target.value); window.location.assign('/dashboard'); } finally { setChanging(false); } }}>{context.organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label>;
}

export function WorkspaceBrand({ compact = false }: { compact?: boolean }) {
  const { data: context } = useSigcSaasContext();
  const brand = context?.branding;
  return <>{brand?.logoUrl ? <img className={`phase8-brand-logo ${compact ? 'compact' : ''}`} src={brand.logoUrl} alt={brand.productName} /> : <div className={`brand-mark ${compact ? '' : 'large'}`}>{(brand?.shortName ?? 'S').slice(0, 1).toUpperCase()}</div>}</>;
}

function UsageMeter({ label, value, limit, formatter = formatNumber }: { label: string; value: number; limit: number; formatter?: (value: number) => string }) {
  const unlimited = !limit || limit >= 1000000000;
  const pct = unlimited ? Math.min(100, value > 0 ? 8 : 0) : Math.min(100, value / Math.max(1, limit) * 100);
  return <div className="phase8-usage"><div><strong>{label}</strong><span>{formatter(value)} / {unlimited ? 'Sin límite práctico' : formatter(limit)}</span></div><span className="progress large"><i style={{ width: `${pct}%` }} /></span></div>;
}

function WorkspaceOverview({ context }: { context: SigcSaasContext }) {
  const completed = context.onboarding.filter((step) => step.completed).length;
  const percent = Math.round(completed / Math.max(1, context.onboarding.length) * 100);
  return <div className="phase8-workspace-grid">
    <section className="card block-card phase8-plan-card"><header className="card-title"><div><span className="eyebrow">Plan actual</span><h2>{context.subscription.plan.name}</h2><p>{context.subscription.plan.description}</p></div><CreditCard /></header><div className="phase8-plan-price">{context.subscription.plan.code === 'free' ? 'Gratis' : context.subscription.plan.monthlyPriceCop ? formatMoney(context.subscription.plan.monthlyPriceCop) : 'Cotizar'}<small>{context.subscription.plan.monthlyPriceCop ? ' / mes' : ''}</small></div><div className="chip-row"><span className={`chip ${context.subscription.status === 'active' ? 'tone-green' : 'tone-purple'}`}>{context.subscription.status}</span>{context.subscription.trialEndsAt ? <span className="chip tone-amber">Trial hasta {formatDate(context.subscription.trialEndsAt)}</span> : null}</div></section>
    <section className="card block-card"><header className="card-title"><div><h2>Onboarding</h2><p>Progreso para dejar el espacio listo para operación.</p></div><Sparkles /></header><div className="phase8-onboarding-head"><strong>{percent}%</strong><span>{completed} de {context.onboarding.length} pasos</span></div><span className="progress large"><i style={{ width: `${percent}%` }} /></span><div className="phase8-checklist">{context.onboarding.map((step) => <div key={step.code} className={step.completed ? 'done' : ''}>{step.completed ? <CheckCircle2 size={18} /> : <span className="phase8-empty-check" />}<span>{step.label}</span></div>)}</div></section>
    <section className="card block-card"><header className="card-title"><div><h2>Salud del sistema</h2><p>Señales operativas del espacio activo.</p></div><HeartPulse /></header><div className="phase8-health-grid"><div><AlertTriangle /><strong>{context.health.errorsLast24h}</strong><span>Errores 24 h</span></div><div><Activity /><strong>{formatNumber(context.health.auditEvents30d)}</strong><span>Eventos auditados</span></div><div><Mail /><strong>{context.health.queuedEmails}</strong><span>Correos pendientes</span></div></div></section>
    <section className="card block-card phase8-usage-card"><header className="card-title"><div><h2>Consumo del plan</h2><p>Los límites se validan también en PostgreSQL.</p></div><Gauge /></header><UsageMeters context={context} /></section>
  </div>;
}

function UsageMeters({ context }: { context: SigcSaasContext }) {
  const limits = context.subscription.plan.limits;
  return <div className="phase8-usage-list"><UsageMeter label="Usuarios" value={context.usage.members} limit={Number(limits.max_members ?? 0)} /><UsageMeter label="Casos activos" value={context.usage.activeCases} limit={Number(limits.max_active_cases ?? 0)} /><UsageMeter label="Automatizaciones" value={context.usage.automations} limit={Number(limits.max_automations ?? 0)} /><UsageMeter label="Almacenamiento" value={context.usage.storageBytes} limit={Number(limits.max_storage_bytes ?? 0)} formatter={formatBytes} /></div>;
}

function BrandingForm({ context, onSaved }: { context: SigcSaasContext; onSaved: () => void }) {
  const initial: UpdateOrganizationProfileInput = { name: context.activeOrganization.name, slug: context.activeOrganization.slug, ...context.branding };
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  function update<K extends keyof UpdateOrganizationProfileInput>(key: K, value: UpdateOrganizationProfileInput[K]) { setForm((current) => ({ ...current, [key]: value })); }
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setMessage(''); try { await sigcService.updateOrganizationProfile(form); setMessage('Identidad y organización actualizadas.'); onSaved(); } catch (error) { setMessage(error instanceof Error ? error.message : 'No fue posible guardar.'); } finally { setSaving(false); } }
  return <form className="phase8-branding-layout" onSubmit={submit}><section className="card block-card form-stack"><header className="card-title"><div><h2>Organización</h2><p>Nombre comercial y dirección interna del espacio.</p></div><Building2 /></header><label className="field-label">Nombre<input className="field" value={form.name} onChange={(event) => { update('name', event.target.value); if (form.slug === slugify(form.name)) update('slug', slugify(event.target.value)); }} required /></label><label className="field-label">Slug<input className="field" value={form.slug} onChange={(event) => update('slug', slugify(event.target.value))} required /></label><label className="field-label">Correo de soporte<input className="field" type="email" value={form.supportEmail ?? ''} onChange={(event) => update('supportEmail', event.target.value)} /></label><label className="field-label">Dominio personalizado<input className="field" placeholder="casos.empresa.com" value={form.customDomain ?? ''} onChange={(event) => update('customDomain', event.target.value)} /></label></section><section className="card block-card form-stack"><header className="card-title"><div><h2>Identidad visual</h2><p>Se aplica a la navegación del espacio activo.</p></div><Palette /></header><label className="field-label">Nombre del producto<input className="field" value={form.productName} onChange={(event) => update('productName', event.target.value)} /></label><label className="field-label">Nombre corto<input className="field" maxLength={12} value={form.shortName} onChange={(event) => update('shortName', event.target.value)} /></label><label className="field-label">URL del logotipo<input className="field" type="url" placeholder="https://..." value={form.logoUrl ?? ''} onChange={(event) => update('logoUrl', event.target.value)} /></label><div className="phase8-color-grid"><label>Primario<input type="color" value={form.primaryColor} onChange={(event) => update('primaryColor', event.target.value)} /></label><label>Acento<input type="color" value={form.accentColor} onChange={(event) => update('accentColor', event.target.value)} /></label><label>Barra lateral<input type="color" value={form.sidebarColor} onChange={(event) => update('sidebarColor', event.target.value)} /></label></div><div className="phase8-brand-preview" style={{ '--preview-primary': form.primaryColor, '--preview-accent': form.accentColor, '--preview-sidebar': form.sidebarColor } as CSSProperties}><div>{form.logoUrl ? <img src={form.logoUrl} alt="Vista previa" /> : <b>{form.shortName.slice(0,1) || 'S'}</b>}<span><strong>{form.productName}</strong><small>{form.name}</small></span></div><button type="button">Acción principal</button></div>{message ? <div className="phase78-inline-message">{message}</div> : null}<button className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar identidad'}</button></section></form>;
}

function TeamInvitations({ context, onChanged }: { context: SigcSaasContext; onChanged: () => void }) {
  const { data: admin } = useSigcAdminSnapshot();
  const [form, setForm] = useState<CreateOrganizationInvitationInput>({ email: '', roleId: '', expiresDays: 7 });
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const roles = admin?.roles.filter((role) => role.isActive && role.code !== 'external_client') ?? [];
  useEffect(() => { if (!form.roleId && roles[0]) setForm((current) => ({ ...current, roleId: roles[0].id })); }, [roles.length]);
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setMessage(''); try { const invitation = await sigcService.createOrganizationInvitation(form); const link = `${window.location.origin}/invite/${invitation.token}`; await navigator.clipboard?.writeText(link); setMessage(`Invitación creada. Enlace copiado: ${link}`); setForm((current) => ({ ...current, email: '' })); onChanged(); } catch (error) { setMessage(error instanceof Error ? error.message : 'No fue posible invitar.'); } finally { setSaving(false); } }
  async function copy(token: string) { const link = `${window.location.origin}/invite/${token}`; await navigator.clipboard.writeText(link); setMessage('Enlace de invitación copiado.'); }
  return <div className="grid-2"><section className="card block-card"><header className="card-title"><div><h2>Invitar al equipo</h2><p>La invitación queda vinculada al correo y al rol seleccionado.</p></div><UserPlus /></header><form className="form-stack" onSubmit={submit}><label className="field-label">Correo<input className="field" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required /></label><label className="field-label">Rol<select className="field" value={form.roleId} onChange={(event) => setForm((current) => ({ ...current, roleId: event.target.value }))} required><option value="">Selecciona</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label><label className="field-label">Vigencia<select className="field" value={form.expiresDays} onChange={(event) => setForm((current) => ({ ...current, expiresDays: Number(event.target.value) }))}><option value={3}>3 días</option><option value={7}>7 días</option><option value={14}>14 días</option><option value={30}>30 días</option></select></label>{message ? <div className="phase78-inline-message">{message}</div> : null}<button className="btn btn-primary" disabled={saving || !form.roleId}><Mail /> {saving ? 'Creando...' : 'Crear invitación'}</button></form></section><section className="card block-card"><header className="card-title"><div><h2>Invitaciones</h2><p>Pendientes, aceptadas, revocadas o vencidas.</p></div><Users /></header><div className="phase8-invitations">{context.invitations.length ? context.invitations.map((invite) => <div key={invite.id}><div><strong>{invite.email}</strong><small>{invite.roleName} · vence {formatDate(invite.expiresAt)}</small></div><span className={`chip ${invite.status === 'pending' ? 'tone-blue' : invite.status === 'accepted' ? 'tone-green' : 'tone-slate'}`}>{invite.status}</span>{invite.status === 'pending' ? <><button className="btn btn-white icon-only small" title="Copiar enlace" onClick={() => void copy(invite.token)}><Copy size={14} /></button><button className="btn btn-white icon-only small danger-icon" title="Revocar" onClick={async () => { await sigcService.revokeOrganizationInvitation(invite.id); onChanged(); }}><XCircle size={14} /></button></> : null}</div>) : <div className="empty-inline">No hay invitaciones creadas.</div>}</div></section></div>;
}

function OrganizationsPanel({ context }: { context: SigcSaasContext }) {
  const [name, setName] = useState(''); const [slug, setSlug] = useState(''); const [message, setMessage] = useState(''); const [saving, setSaving] = useState(false);
  async function create(event: FormEvent) { event.preventDefault(); setSaving(true); setMessage(''); try { await sigcService.createSaasOrganization({ name, slug }); window.location.assign('/dashboard'); } catch (error) { setMessage(error instanceof Error ? error.message : 'No fue posible crear la organización.'); setSaving(false); } }
  return <div className="grid-2"><section className="card block-card"><header className="card-title"><div><h2>Mis organizaciones</h2><p>Cambia de empresa sin mezclar información.</p></div><Globe2 /></header><div className="phase8-organizations">{context.organizations.map((organization) => <button key={organization.id} className={organization.isActive ? 'active' : ''} onClick={async () => { if (!organization.isActive) { await sigcService.setActiveOrganization(organization.id); window.location.assign('/dashboard'); } }}><span className="phase8-org-icon">{organization.name.slice(0,1)}</span><div><strong>{organization.name}</strong><small>{organization.roleName} · {organization.planName}</small></div>{organization.isActive ? <Check size={18} /> : null}</button>)}</div></section><section className="card block-card"><header className="card-title"><div><h2>Nueva organización</h2><p>Crea otro espacio completamente aislado.</p></div><Plus /></header><form className="form-stack" onSubmit={create}><label className="field-label">Nombre<input className="field" value={name} onChange={(event) => { setName(event.target.value); setSlug(slugify(event.target.value)); }} required /></label><label className="field-label">Slug<input className="field" value={slug} onChange={(event) => setSlug(slugify(event.target.value))} required /></label>{message ? <div className="alert danger">{message}</div> : null}<button className="btn btn-primary" disabled={saving}>{saving ? 'Creando...' : 'Crear espacio'}</button></form></section></div>;
}

function FirstOrganizationOnboarding({ error }: { error?: string | null }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  async function create(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await sigcService.createSaasOrganization({ name, slug });
      window.location.assign('/dashboard');
    } catch (createError) {
      setMessage(createError instanceof Error ? createError.message : 'No fue posible crear el espacio.');
      setSaving(false);
    }
  }
  return <div className="page page-centered"><section className="card block-card phase8-first-org"><div className="brand-mark large">S</div><span className="eyebrow">Onboarding SaaS</span><h1>Crea tu primer espacio SIGC</h1><p>La organización será un contenedor aislado para usuarios, casos, documentos, automatizaciones y reportes.</p>{error ? <div className="phase78-inline-message">{error}</div> : null}<form className="form-stack" onSubmit={create}><label className="field-label">Nombre de la organización<input className="field" value={name} onChange={(event) => { setName(event.target.value); setSlug(slugify(event.target.value)); }} required /></label><label className="field-label">Identificador del espacio<input className="field" value={slug} onChange={(event) => setSlug(slugify(event.target.value))} required /></label>{message ? <div className="alert danger">{message}</div> : null}<button className="btn btn-primary full" disabled={saving}>{saving ? 'Creando espacio...' : 'Crear organización'}</button></form></section></div>;
}

export function SaasManagementPage() {
  const { data: context, isLoading, error, warning, reload } = useSigcSaasContext();
  const [tab, setTab] = useState<'overview' | 'branding' | 'team' | 'organizations'>('overview');
  if (isLoading && !context) return <div className="page page-centered"><section className="card block-card"><RefreshCw className="spin" /> Cargando espacio SaaS...</section></div>;
  if (!context) return <FirstOrganizationOnboarding error={error ?? warning} />;
  return <div className="page"><header className="page-head"><div><span className="eyebrow">Producto SaaS · Fase 8</span><h1>Espacio de trabajo</h1><p>Gestiona organización, identidad visual, equipo, consumo y aislamiento multiempresa.</p></div><div className="page-actions"><span className="chip tone-purple">{context.subscription.plan.name}</span><button className="btn btn-soft" onClick={reload}><RefreshCw size={17} /> Actualizar</button></div></header>{warning ? <div className="alert danger">{warning}</div> : null}<div className="phase56-admin-tabs phase8-tabs"><button className={tab==='overview'?'active':''} onClick={()=>setTab('overview')}><Gauge /> Resumen</button>{context.canManage ? <button className={tab==='branding'?'active':''} onClick={()=>setTab('branding')}><Palette /> Marca</button> : null}{context.canManage ? <button className={tab==='team'?'active':''} onClick={()=>setTab('team')}><Users /> Equipo</button> : null}<button className={tab==='organizations'?'active':''} onClick={()=>setTab('organizations')}><Building2 /> Organizaciones</button></div>{tab==='overview'?<WorkspaceOverview context={context}/>:null}{tab==='branding'&&context.canManage?<BrandingForm context={context} onSaved={reload}/>:null}{tab==='team'&&context.canManage?<TeamInvitations context={context} onChanged={reload}/>:null}{tab==='organizations'?<OrganizationsPanel context={context}/>:null}</div>;
}

export function InvitationPage() {
  const { token } = useParams();
  const { currentUser } = useApp();
  const navigate = useNavigate();
  const { data: invitation, isLoading, error } = useOrganizationInvitation(token);
  const [accepting, setAccepting] = useState(false);
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');

  async function accept() { if (!token) return; setAccepting(true); setMessage(''); try { await sigcService.acceptOrganizationInvitation(token); navigate('/dashboard'); } catch (acceptError) { setMessage(acceptError instanceof Error ? acceptError.message : 'No fue posible aceptar.'); } finally { setAccepting(false); } }
  async function signUp(event: FormEvent) { event.preventDefault(); if (!supabase || !invitation) return; setAccepting(true); setMessage(''); try { const { data, error: signUpError } = await supabase.auth.signUp({ email: invitation.email, password, options: { data: { name } } }); if (signUpError) throw signUpError; if (data.session) { await sigcService.acceptOrganizationInvitation(token!); navigate('/dashboard'); } else setMessage('Cuenta creada. Confirma tu correo y vuelve a abrir este enlace para aceptar la invitación.'); } catch (signUpError) { setMessage(signUpError instanceof Error ? signUpError.message : 'No fue posible crear la cuenta.'); } finally { setAccepting(false); } }

  return <main className="login-workgrid phase8-invite-page"><section className="login-panel hero-gradient"><div className="chip chip-light">Invitación segura</div><h1>Únete al espacio SIGC</h1><p>La membresía se valida por correo y queda aislada de las demás organizaciones.</p><div className="login-benefits"><span><ShieldCheck size={18}/> RLS multiempresa</span><span><Users size={18}/> Rol controlado</span><span><Cloud size={18}/> Datos centralizados</span></div></section><section className="login-card card">{isLoading?<><RefreshCw className="spin"/><h2>Validando invitación...</h2></>:error||!invitation?<><AlertTriangle/><h2>Invitación no disponible</h2><p className="muted">{error ?? 'El enlace no existe.'}</p></>:<><div className="brand-mark large">{invitation.organizationName.slice(0,1)}</div><h2>{invitation.organizationName}</h2><p className="muted">Invitación para <strong>{invitation.email}</strong> con rol <strong>{invitation.roleName}</strong>.</p><div className="phase8-invite-meta"><span>Estado <b>{invitation.status}</b></span><span>Vence <b>{formatDate(invitation.expiresAt)}</b></span></div>{message?<div className="phase78-inline-message">{message}</div>:null}{invitation.status!=='pending'?<div className="alert danger">Esta invitación ya no está disponible.</div>:currentUser?<button className="btn btn-primary full" onClick={()=>void accept()} disabled={accepting}>{accepting?'Aceptando...':'Aceptar e ingresar'}</button>:<><Link className="btn btn-primary full" to={`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`}>Ya tengo cuenta</Link><div className="phase8-divider"><span>o crea una cuenta</span></div><form className="form-stack" onSubmit={signUp}><label className="field-label">Nombre<input className="field" value={name} onChange={(event)=>setName(event.target.value)} required/></label><label className="field-label">Correo<input className="field" value={invitation.email} disabled/></label><label className="field-label">Contraseña<input className="field" type="password" minLength={8} value={password} onChange={(event)=>setPassword(event.target.value)} required/></label><button className="btn btn-white full" disabled={accepting}>{accepting?'Creando...':'Crear cuenta'}</button></form></>}</>}</section></main>;
}

export class SigcErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean; message: string }> {
  state = { failed: false, message: '' };
  static getDerivedStateFromError(error: Error) { return { failed: true, message: error.message }; }
  componentDidCatch(error: Error, info: ErrorInfo) { void sigcService.logClientError({ message: error.message, stack: `${error.stack ?? ''}\n${info.componentStack}`, route: window.location.pathname, severity: 'fatal' }); }
  render() { if (this.state.failed) return <main className="login-workgrid"><section className="login-card card"><AlertTriangle size={32}/><h2>La vista encontró un error</h2><p className="muted">{this.state.message}</p><button className="btn btn-primary" onClick={()=>window.location.reload()}>Recargar aplicación</button></section></main>; return this.props.children; }
}

export function ClientObservability() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => { void sigcService.logClientError({ message: event.message, stack: event.error?.stack, route: window.location.pathname, severity: 'error', metadata: { filename: event.filename, line: event.lineno, column: event.colno } }); };
    const onRejection = (event: PromiseRejectionEvent) => { const reason = event.reason; void sigcService.logClientError({ message: reason instanceof Error ? reason.message : String(reason), stack: reason instanceof Error ? reason.stack : undefined, route: window.location.pathname, severity: 'error', metadata: { kind: 'unhandledrejection' } }); };
    window.addEventListener('error', onError); window.addEventListener('unhandledrejection', onRejection); return () => { window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRejection); };
  }, []);
  return null;
}
