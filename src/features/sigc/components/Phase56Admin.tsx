import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  Bot,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Edit3,
  Eye,
  Flag,
  GitBranch,
  Mail,
  Play,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Users,
  Workflow,
  X,
  Zap
} from 'lucide-react';
import type {
  AdminCatalogItem,
  AdminCatalogKind,
  AdminEmailTemplate,
  AdminHoliday,
  AdminReminderRule,
  AdminRole,
  AdminSlaPolicy,
  AdminTransition,
  AutomationAction,
  AutomationCondition,
  AutomationRule,
  SaveAdminCatalogInput,
  SaveAutomationRuleInput,
  SaveEmailTemplateInput,
  SaveHolidayInput,
  SaveReminderRuleInput,
  SaveRoleInput,
  SaveSlaPolicyInput,
  SaveTransitionInput,
  SigcAdminSnapshot
} from '../domain/types';
import { useAutomationRuntimeHealth, useSigcAdminSnapshot, useSigcCases } from '../hooks/useSigcData';
import { useAuthorization } from '../../authz/AuthorizationProvider';
import { PERMISSIONS } from '../../authz/permissions';
import { sigcService } from '../services/sigcService';

type AdminTab = 'catalogs' | 'sla' | 'roles' | 'workflows' | 'templates' | 'automations';
type SigcActions = { showToast: (text: string) => void; openDrawer: (id: string) => void };

const tabItems: Array<{ id: AdminTab; label: string; icon: typeof Settings2 }> = [
  { id: 'catalogs', label: 'Catálogos', icon: SlidersHorizontal },
  { id: 'sla', label: 'SLA y calendario', icon: Clock3 },
  { id: 'roles', label: 'Roles y permisos', icon: ShieldCheck },
  { id: 'workflows', label: 'Flujos', icon: Workflow },
  { id: 'templates', label: 'Plantillas', icon: Mail },
  { id: 'automations', label: 'Automatizaciones', icon: Bot }
];

const catalogLabels: Record<AdminCatalogKind, string> = {
  areas: 'Áreas',
  priorities: 'Prioridades',
  caseTypes: 'Tipos de caso',
  states: 'Estados'
};

const triggerOptions = [
  ['case.created', 'Caso creado'],
  ['case.updated', 'Caso actualizado'],
  ['case.state_changed', 'Estado cambiado'],
  ['case.sla_overridden', 'SLA modificado'],
  ['assignment.created', 'Asignación creada'],
  ['assignment.updated', 'Asignación actualizada'],
  ['subtask.created', 'Subtarea creada'],
  ['subtask.updated', 'Subtarea actualizada'],
  ['document.created', 'Documento cargado'],
  ['document.version_created', 'Nueva versión documental'],
  ['comment.created', 'Comentario agregado'],
  ['case.review_pending', 'Revisión solicitada'],
  ['case.review_approved', 'Revisión aprobada'],
  ['case.review_returned', 'Revisión devuelta'],
  ['case.sent', 'Respuesta enviada'],
  ['case.reminder_sent', 'Recordatorio enviado']
] as const;

const emailEventOptions = [
  ['case.created', 'Caso creado'],
  ['case.assigned', 'Caso asignado'],
  ['case.reassigned', 'Caso reasignado'],
  ['comment.created', 'Comentario agregado'],
  ['document.created', 'Documento cargado'],
  ['case.sla_overridden', 'Fecha límite modificada'],
  ['case.due_soon', 'Caso próximo a vencer'],
  ['case.overdue', 'Caso vencido'],
  ['case.reminder_sent', 'Recordatorio enviado'],
  ['case.review_pending', 'Revisión solicitada'],
  ['case.review_approved', 'Revisión aprobada'],
  ['case.review_returned', 'Revisión devuelta'],
  ['case.sent', 'Respuesta enviada']
] as const;

const conditionFieldLabels: Record<AutomationCondition['field'], string> = {
  case_type_id: 'Tipo de caso',
  priority_id: 'Prioridad',
  state_id: 'Estado',
  primary_area_id: 'Área principal',
  primary_owner_id: 'Responsable principal',
  source: 'Origen',
  risk_level: 'Nivel de riesgo',
  overdue: 'Caso vencido',
  all_subtasks_completed: 'Todas las subtareas completadas'
};

const actionLabels: Record<AutomationAction['type'], string> = {
  assign_area: 'Asignar área',
  assign_user: 'Asignar responsable',
  set_priority: 'Cambiar prioridad',
  create_subtask: 'Crear subtarea',
  notify_user: 'Notificar usuario',
  notify_role: 'Notificar rol',
  change_state: 'Cambiar estado',
  email_requester: 'Enviar correo al solicitante',
  suggest_close: 'Sugerir cierre'
};

export function AdminConfigurationPage() {
  const { showToast } = useOutletContext<SigcActions>();
  const { data, isLoading, error, warning, reload } = useSigcAdminSnapshot();
  const [tab, setTab] = useState<AdminTab>('catalogs');

  return (
    <div className="page phase56-admin-page">
      <header className="page-head">
        <div>
          <span className="eyebrow">Configuración operativa · Fases 13 y 15</span>
          <h1>Administración y automatizaciones</h1>
          <p>Parametriza catálogos y flujos dinámicos, y opera reglas CUANDO → SI → ENTONCES con trazabilidad y reintentos.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-white" onClick={reload}><RefreshCw size={17} /> Recargar</button>
        </div>
      </header>

      {warning ? <div className="alert danger">{warning}</div> : null}
      {error ? <div className="alert danger">{error}</div> : null}

      <section className="admin-live-kpis">
        <AdminKpi icon={<Building2 />} label="Áreas" value={data?.areas.length ?? 0} />
        <AdminKpi icon={<GitBranch />} label="Tipos de caso" value={data?.caseTypes.length ?? 0} />
        <AdminKpi icon={<ShieldCheck />} label="Roles" value={data?.roles.length ?? 0} />
        <AdminKpi icon={<Zap />} label="Reglas activas" value={data?.automationRules.filter((item) => item.isActive).length ?? 0} />
      </section>

      <section className="card phase56-admin-shell">
        <nav className="phase56-admin-tabs">
          {tabItems.map(({ id, label, icon: Icon }) => (
            <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
              <Icon size={17} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="phase56-admin-content">
          {isLoading || !data ? <AdminLoading /> : null}
          {!isLoading && data && tab === 'catalogs' ? <CatalogsPanel data={data} showToast={showToast} /> : null}
          {!isLoading && data && tab === 'sla' ? <SlaPanel data={data} showToast={showToast} /> : null}
          {!isLoading && data && tab === 'roles' ? <RolesPanel data={data} showToast={showToast} /> : null}
          {!isLoading && data && tab === 'workflows' ? <WorkflowsPanel data={data} showToast={showToast} /> : null}
          {!isLoading && data && tab === 'templates' ? <TemplatesPanel data={data} showToast={showToast} /> : null}
          {!isLoading && data && tab === 'automations' ? <AutomationsPanel data={data} showToast={showToast} /> : null}
        </div>
      </section>
    </div>
  );
}

function AdminKpi({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return <article className="card"><div className="kpi-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong></div></article>;
}

function AdminLoading() {
  return <div className="phase56-loading"><RefreshCw className="spin" /><strong>Cargando configuración real...</strong></div>;
}

function SectionHead({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <header className="phase56-section-head"><div><h2>{title}</h2><p>{description}</p></div>{action}</header>;
}

function ConfigModal({ title, description, onClose, children }: { title: string; description?: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <section className="modal-card phase56-modal">
        <header className="modal-header"><div><h2>{title}</h2>{description ? <p>{description}</p> : null}</div><button className="btn btn-ghost" onClick={onClose}><X size={18} /></button></header>
        {children}
      </section>
    </div>
  );
}

function CatalogsPanel({ data, showToast }: { data: SigcAdminSnapshot; showToast: (text: string) => void }) {
  const [kind, setKind] = useState<AdminCatalogKind>('areas');
  const [editing, setEditing] = useState<AdminCatalogItem | null>(null);
  const [creating, setCreating] = useState(false);
  const rows = data[kind];

  async function toggle(item: AdminCatalogItem) {
    try {
      await sigcService.setAdminCatalogActive(kind, item.id, !item.isActive);
      showToast(`${item.name}: ${item.isActive ? 'desactivado' : 'activado'}.`);
    } catch (error) { showToast(errorMessage(error)); }
  }

  return (
    <div>
      <SectionHead title="Catálogos parametrizables" description="Áreas, prioridades, tipos de caso y estados viven en base de datos." action={<button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> Nuevo {catalogLabels[kind].toLowerCase().replace(/s$/, '')}</button>} />
      <div className="phase56-subtabs">
        {(Object.keys(catalogLabels) as AdminCatalogKind[]).map((id) => <button key={id} className={kind === id ? 'active' : ''} onClick={() => setKind(id)}>{catalogLabels[id]} <em>{data[id].length}</em></button>)}
      </div>
      <div className="phase56-table-wrap">
        <table className="phase56-table"><thead><tr><th>Código</th><th>Nombre</th><th>Configuración</th><th>Estado</th><th /></tr></thead>
          <tbody>{rows.map((item) => <tr key={item.id}><td><code>{item.code}</code></td><td><strong>{item.name}</strong><span>{item.description || 'Sin descripción'}</span></td><td><span>Orden {item.sortOrder}</span>{kind === 'states' ? <small>{item.isInitial ? 'Inicial · ' : ''}{item.isTerminal ? 'Terminal' : 'Operativo'}</small> : null}</td><td><StatusPill active={item.isActive} /></td><td><div className="table-actions"><button className="btn btn-white" onClick={() => setEditing(item)}><Edit3 size={15} /></button><button className="btn btn-soft" onClick={() => void toggle(item)}>{item.isActive ? 'Desactivar' : 'Activar'}</button></div></td></tr>)}</tbody>
        </table>
      </div>
      {creating || editing ? <CatalogModal kind={kind} item={editing} onClose={() => { setCreating(false); setEditing(null); }} showToast={showToast} /> : null}
    </div>
  );
}

function CatalogModal({ kind, item, onClose, showToast }: { kind: AdminCatalogKind; item: AdminCatalogItem | null; onClose: () => void; showToast: (text: string) => void }) {
  const [form, setForm] = useState<SaveAdminCatalogInput>({ kind, id: item?.id, code: item?.code ?? '', name: item?.name ?? '', description: item?.description ?? '', color: item?.color ?? '', sortOrder: item?.sortOrder ?? 0, isInitial: item?.isInitial ?? false, isTerminal: item?.isTerminal ?? false, isActive: item?.isActive ?? true });
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true);
    try { await sigcService.saveAdminCatalog(form); showToast(`${catalogLabels[kind]} actualizado.`); onClose(); } catch (error) { showToast(errorMessage(error)); } finally { setSaving(false); }
  }
  return <ConfigModal title={item ? `Editar ${item.name}` : `Nuevo parámetro · ${catalogLabels[kind]}`} onClose={onClose}><form className="stack" onSubmit={submit}><div className="form-grid two"><label className="field-label">Código<input className="input" value={form.code} disabled={Boolean(item)} onChange={(e) => setForm({ ...form, code: e.target.value })} required /></label><label className="field-label">Nombre<input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label></div><label className="field-label">Descripción<textarea className="input textarea compact" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label><div className="form-grid two"><label className="field-label">Color<input className="input" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="blue o #123C69" /></label><label className="field-label">Orden<input className="input" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} /></label></div>{kind === 'states' ? <div className="phase56-check-grid"><CheckField label="Estado inicial" checked={Boolean(form.isInitial)} onChange={(checked) => setForm({ ...form, isInitial: checked })} /><CheckField label="Estado terminal" checked={Boolean(form.isTerminal)} onChange={(checked) => setForm({ ...form, isTerminal: checked })} /></div> : null}<CheckField label="Activo" checked={form.isActive !== false} onChange={(checked) => setForm({ ...form, isActive: checked })} /><button className="btn btn-primary full" disabled={saving}><Save size={16} /> {saving ? 'Guardando...' : 'Guardar parámetro'}</button></form></ConfigModal>;
}

function SlaPanel({ data, showToast }: { data: SigcAdminSnapshot; showToast: (text: string) => void }) {
  const [slaEdit, setSlaEdit] = useState<AdminSlaPolicy | null | 'new'>(null);
  const [holidayEdit, setHolidayEdit] = useState<AdminHoliday | null | 'new'>(null);
  const [reminderEdit, setReminderEdit] = useState<AdminReminderRule | null | 'new'>(null);
  async function removeHoliday(id: string) { if (!window.confirm('¿Eliminar este festivo?')) return; try { await sigcService.deleteHoliday(id); showToast('Festivo eliminado.'); } catch (error) { showToast(errorMessage(error)); } }
  return <div className="phase56-stack-sections">
    <section><SectionHead title="Políticas SLA" description="Configura duración, unidad, pausas y zona horaria por tipo de caso." action={<button className="btn btn-primary" onClick={() => setSlaEdit('new')}><Plus size={16} /> Nueva política</button>} /><div className="phase56-card-grid">{data.slaPolicies.map((item) => <article className="phase56-config-card" key={item.id}><div><strong>{item.name}</strong><span>{item.caseTypeName}</span></div><b>{item.durationValue} {unitLabel(item.durationUnit)}</b><small>{item.timezone} · {item.pauseOnPendingInformation ? 'Pausa por información' : 'Sin pausa'}</small><footer><StatusPill active={item.isActive} /><button className="btn btn-white" onClick={() => setSlaEdit(item)}><Edit3 size={15} /> Editar</button></footer></article>)}</div></section>
    <section><SectionHead title="Calendario de festivos" description="Los SLA en días hábiles excluyen estos días." action={<button className="btn btn-white" onClick={() => setHolidayEdit('new')}><Plus size={16} /> Agregar festivo</button>} /><div className="phase56-inline-list">{data.holidays.map((item) => <div key={item.id}><CalendarDays size={17} /><div><strong>{item.name}</strong><span>{item.holidayDate}</span></div><StatusPill active={item.isActive} /><button className="btn btn-ghost" onClick={() => setHolidayEdit(item)}><Edit3 size={15} /></button><button className="btn btn-ghost danger-icon" onClick={() => void removeHoliday(item.id)}><Trash2 size={15} /></button></div>)}</div></section>
    <section><SectionHead title="Reglas de recordatorio" description="Administra alertas antes del vencimiento y escalamiento de vencidos." action={<button className="btn btn-white" onClick={() => setReminderEdit('new')}><Plus size={16} /> Nueva regla</button>} /><div className="phase56-inline-list">{data.reminderRules.map((item) => <div key={item.id}><Clock3 size={17} /><div><strong>{item.name}</strong><span>{item.triggerKind === 'overdue' ? 'Al vencer' : `${item.offsetMinutes} minutos antes`} · {item.includeManagers ? 'Incluye superiores' : 'Responsables'}</span></div><StatusPill active={item.isActive} /><button className="btn btn-ghost" onClick={() => setReminderEdit(item)}><Edit3 size={15} /></button></div>)}</div></section>
    {slaEdit ? <SlaModal data={data} item={slaEdit === 'new' ? null : slaEdit} onClose={() => setSlaEdit(null)} showToast={showToast} /> : null}
    {holidayEdit ? <HolidayModal item={holidayEdit === 'new' ? null : holidayEdit} onClose={() => setHolidayEdit(null)} showToast={showToast} /> : null}
    {reminderEdit ? <ReminderModal item={reminderEdit === 'new' ? null : reminderEdit} data={data} onClose={() => setReminderEdit(null)} showToast={showToast} /> : null}
  </div>;
}

function SlaModal({ data, item, onClose, showToast }: { data: SigcAdminSnapshot; item: AdminSlaPolicy | null; onClose: () => void; showToast: (text: string) => void }) {
  const [form, setForm] = useState<SaveSlaPolicyInput>({ id: item?.id, caseTypeId: item?.caseTypeId, name: item?.name ?? '', durationValue: item?.durationValue ?? 5, durationUnit: item?.durationUnit ?? 'calendar_days', timezone: item?.timezone ?? 'America/Bogota', pauseOnPendingInformation: item?.pauseOnPendingInformation ?? false, isDefault: item?.isDefault ?? true, isActive: item?.isActive ?? true });
  async function submit(event: FormEvent) { event.preventDefault(); try { await sigcService.saveSlaPolicy(form); showToast('Política SLA guardada.'); onClose(); } catch (error) { showToast(errorMessage(error)); } }
  return <ConfigModal title={item ? 'Editar política SLA' : 'Nueva política SLA'} onClose={onClose}><form className="stack" onSubmit={submit}><label className="field-label">Tipo de caso<select className="input" value={form.caseTypeId ?? ''} onChange={(e) => setForm({ ...form, caseTypeId: e.target.value || undefined })}><option value="">Política general</option>{data.caseTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label><label className="field-label">Nombre<input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label><div className="form-grid two"><label className="field-label">Duración<input className="input" type="number" min="1" value={form.durationValue} onChange={(e) => setForm({ ...form, durationValue: Number(e.target.value) })} /></label><label className="field-label">Unidad<select className="input" value={form.durationUnit} onChange={(e) => setForm({ ...form, durationUnit: e.target.value as SaveSlaPolicyInput['durationUnit'] })}><option value="hours">Horas</option><option value="calendar_days">Días calendario</option><option value="business_days">Días hábiles</option></select></label></div><label className="field-label">Zona horaria<input className="input" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} /></label><div className="phase56-check-grid"><CheckField label="Pausar en Pendiente de Información" checked={form.pauseOnPendingInformation} onChange={(checked) => setForm({ ...form, pauseOnPendingInformation: checked })} /><CheckField label="Política predeterminada" checked={form.isDefault} onChange={(checked) => setForm({ ...form, isDefault: checked })} /><CheckField label="Activa" checked={form.isActive} onChange={(checked) => setForm({ ...form, isActive: checked })} /></div><button className="btn btn-primary full"><Save size={16} /> Guardar SLA</button></form></ConfigModal>;
}

function HolidayModal({ item, onClose, showToast }: { item: AdminHoliday | null; onClose: () => void; showToast: (text: string) => void }) {
  const [form, setForm] = useState<SaveHolidayInput>({ id: item?.id, holidayDate: item?.holidayDate ?? '', name: item?.name ?? '', isActive: item?.isActive ?? true });
  async function submit(event: FormEvent) { event.preventDefault(); try { await sigcService.saveHoliday(form); showToast('Festivo guardado.'); onClose(); } catch (error) { showToast(errorMessage(error)); } }
  return <ConfigModal title={item ? 'Editar festivo' : 'Agregar festivo'} onClose={onClose}><form className="stack" onSubmit={submit}><label className="field-label">Fecha<input className="input" type="date" value={form.holidayDate} onChange={(e) => setForm({ ...form, holidayDate: e.target.value })} required /></label><label className="field-label">Nombre<input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label><CheckField label="Activo" checked={form.isActive} onChange={(checked) => setForm({ ...form, isActive: checked })} /><button className="btn btn-primary full"><Save size={16} /> Guardar festivo</button></form></ConfigModal>;
}

function ReminderModal({ item, data, onClose, showToast }: { item: AdminReminderRule | null; data: SigcAdminSnapshot; onClose: () => void; showToast: (text: string) => void }) {
  const [form, setForm] = useState<SaveReminderRuleInput>({ id: item?.id, code: item?.code ?? '', name: item?.name ?? '', triggerKind: item?.triggerKind ?? 'before_due', offsetMinutes: item?.offsetMinutes ?? 1440, includeManagers: item?.includeManagers ?? false, messageTemplate: item?.messageTemplate ?? 'El caso {{radicado}} requiere atención antes de {{fecha_limite}}.', emailTemplateCode: item?.emailTemplateCode ?? '', isActive: item?.isActive ?? true });
  async function submit(event: FormEvent) { event.preventDefault(); try { await sigcService.saveReminderRule(form); showToast('Regla de recordatorio guardada.'); onClose(); } catch (error) { showToast(errorMessage(error)); } }
  return <ConfigModal title={item ? 'Editar recordatorio' : 'Nueva regla de recordatorio'} onClose={onClose}><form className="stack" onSubmit={submit}><div className="form-grid two"><label className="field-label">Código<input className="input" value={form.code} disabled={Boolean(item)} onChange={(e) => setForm({ ...form, code: e.target.value })} required /></label><label className="field-label">Nombre<input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label></div><div className="form-grid two"><label className="field-label">Tipo<select className="input" value={form.triggerKind} onChange={(e) => setForm({ ...form, triggerKind: e.target.value as SaveReminderRuleInput['triggerKind'] })}><option value="before_due">Antes del vencimiento</option><option value="overdue">Caso vencido</option></select></label><label className="field-label">Minutos de anticipación<input className="input" type="number" min="0" value={form.offsetMinutes} disabled={form.triggerKind === 'overdue'} onChange={(e) => setForm({ ...form, offsetMinutes: Number(e.target.value) })} /></label></div><label className="field-label">Mensaje<textarea className="input textarea compact" value={form.messageTemplate} onChange={(e) => setForm({ ...form, messageTemplate: e.target.value })} required /></label><label className="field-label">Plantilla de correo<select className="input" value={form.emailTemplateCode ?? ''} onChange={(e) => setForm({ ...form, emailTemplateCode: e.target.value || undefined })}><option value="">Solo notificación interna</option>{data.emailTemplates.filter((template) => template.isActive).map((template) => <option value={template.code} key={template.id}>{template.name} · {template.code}</option>)}</select></label><div className="phase56-check-grid"><CheckField label="Incluir superiores" checked={form.includeManagers} onChange={(checked) => setForm({ ...form, includeManagers: checked })} /><CheckField label="Activa" checked={form.isActive} onChange={(checked) => setForm({ ...form, isActive: checked })} /></div><button className="btn btn-primary full"><Save size={16} /> Guardar recordatorio</button></form></ConfigModal>;
}

function RolesPanel({ data, showToast }: { data: SigcAdminSnapshot; showToast: (text: string) => void }) {
  const { authorization, can } = useAuthorization();
  const canManageUsers = can(PERMISSIONS.adminManageUsers);
  const [selectedRoleId, setSelectedRoleId] = useState(data.roles[0]?.id ?? '');
  const role = data.roles.find((item) => item.id === selectedRoleId) ?? data.roles[0];
  const protectedAdminRole = Boolean(role?.isSystem && role.code === 'admin');
  const [permissionIds, setPermissionIds] = useState<string[]>(role?.permissionIds ?? []);
  const [roleEdit, setRoleEdit] = useState<AdminRole | null | 'new'>(null);
  useEffect(() => setPermissionIds(role?.permissionIds ?? []), [role?.id, role?.permissionIds.join('|')]);

  async function savePermissions() {
    if (!role) return;
    try {
      await sigcService.setRolePermissions(role.id, permissionIds);
      showToast(protectedAdminRole ? 'El rol Administrador conserva todos los permisos del sistema.' : `Permisos de ${role.name} actualizados.`);
    } catch (error) { showToast(errorMessage(error)); }
  }

  async function updateMember(membershipId: string, roleId: string) {
    if (!canManageUsers) { showToast('No tienes permiso para administrar usuarios.'); return; }
    try { await sigcService.setMemberRole(membershipId, roleId); showToast('Rol del usuario actualizado.'); } catch (error) { showToast(errorMessage(error)); }
  }

  return <div className="phase56-two-column">
    <section>
      <SectionHead title="Roles y permisos" description="Define capacidades independientes por perfil. La autoridad proviene del rol y los permisos de la organización activa." action={<button className="btn btn-primary" onClick={() => setRoleEdit('new')}><Plus size={16} /> Nuevo rol</button>} />
      <div className="phase56-role-layout">
        <aside>{data.roles.map((item) => <button key={item.id} className={role?.id === item.id ? 'active' : ''} onClick={() => setSelectedRoleId(item.id)}><strong>{item.name}</strong><span>{item.permissionIds.length} permisos</span></button>)}</aside>
        <div>{role ? <>
          <header className="phase56-permission-head"><div><strong>{role.name}</strong><span>{role.description || role.code}</span></div><button className="btn btn-white" onClick={() => setRoleEdit(role)}><Edit3 size={15} /> Editar</button></header>
          {protectedAdminRole ? <div className="phase56-inline-note"><ShieldCheck size={16} /> El rol Administrador es sistémico y siempre conserva todos los permisos.</div> : null}
          <div className="phase56-permissions">{data.permissions.map((permission) => <label key={permission.id}><input type="checkbox" checked={permissionIds.includes(permission.id)} disabled={protectedAdminRole} onChange={(e) => setPermissionIds((current) => e.target.checked ? [...current, permission.id] : current.filter((id) => id !== permission.id))} /><div><strong>{permission.name}</strong><span>{permission.code}</span></div></label>)}</div>
          <button className="btn btn-primary full" onClick={() => void savePermissions()} disabled={protectedAdminRole}><Save size={16} /> {protectedAdminRole ? 'Permisos protegidos' : 'Guardar permisos'}</button>
        </> : null}</div>
      </div>
    </section>
    <section>
      <SectionHead title="Usuarios de la organización" description={canManageUsers ? 'Asigna el rol que determina los permisos efectivos de cada miembro.' : 'Puedes consultar miembros, pero no cambiar sus roles.'} />
      <div className="phase56-member-list">{data.members.map((member) => <div key={member.membershipId}><div className="avatar small-avatar">{initials(member.name)}</div><div><strong>{member.name}</strong><span>{member.email}{member.userId === authorization?.userId ? ' · Tú' : ''}</span></div><select className="input" value={member.roleId ?? ''} disabled={!canManageUsers || member.userId === authorization?.userId || !member.isActive} onChange={(e) => void updateMember(member.membershipId, e.target.value)}>{data.roles.filter((item) => item.isActive).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></div>)}</div>
      {!canManageUsers ? <div className="phase56-inline-note"><ShieldCheck size={16} /> La asignación de roles requiere admin.manage_users.</div> : null}
    </section>
    {roleEdit ? <RoleModal item={roleEdit === 'new' ? null : roleEdit} onClose={() => setRoleEdit(null)} showToast={showToast} /> : null}
  </div>;
}

function RoleModal({ item, onClose, showToast }: { item: AdminRole | null; onClose: () => void; showToast: (text: string) => void }) {
  const [form, setForm] = useState<SaveRoleInput>({ id: item?.id, code: item?.code ?? '', name: item?.name ?? '', description: item?.description ?? '', isActive: item?.isActive ?? true });
  async function submit(event: FormEvent) { event.preventDefault(); try { await sigcService.saveRole(form); showToast('Rol guardado.'); onClose(); } catch (error) { showToast(errorMessage(error)); } }
  return <ConfigModal title={item ? 'Editar rol' : 'Nuevo rol'} onClose={onClose}><form className="stack" onSubmit={submit}><div className="form-grid two"><label className="field-label">Código<input className="input" value={form.code} disabled={item?.isSystem} onChange={(e) => setForm({ ...form, code: e.target.value })} required /></label><label className="field-label">Nombre<input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label></div><label className="field-label">Descripción<textarea className="input textarea compact" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>{item?.isSystem && item.code === 'admin' ? <div className="phase56-inline-note"><ShieldCheck size={16} /> El rol Administrador no puede desactivarse.</div> : <CheckField label="Activo" checked={form.isActive} onChange={(checked) => setForm({ ...form, isActive: checked })} />}<button className="btn btn-primary full"><Save size={16} /> Guardar rol</button></form></ConfigModal>;
}

function WorkflowsPanel({ data, showToast }: { data: SigcAdminSnapshot; showToast: (text: string) => void }) {
  const [caseTypeId, setCaseTypeId] = useState(data.caseTypes[0]?.id ?? '');
  const workflow = data.workflows.find((item) => item.caseTypeId === caseTypeId);
  const [stateIds, setStateIds] = useState<string[]>(workflow?.states.map((item) => item.stateId) ?? []);
  const [transitionEdit, setTransitionEdit] = useState<AdminTransition | null | 'new'>(null);
  useEffect(() => setStateIds(workflow?.states.map((item) => item.stateId) ?? []), [caseTypeId, workflow?.states.map((item) => item.stateId).join('|')]);
  function toggleState(id: string) { setStateIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]); }
  function move(index: number, direction: -1 | 1) { setStateIds((current) => { const next = [...current]; const target = index + direction; if (target < 0 || target >= next.length) return current; [next[index], next[target]] = [next[target], next[index]]; return next; }); }
  const selectedStates = stateIds.map((id) => data.states.find((state) => state.id === id)).filter((state): state is AdminCatalogItem => Boolean(state));
  const localValidation = [stateIds.length ? '' : 'El flujo debe contener al menos un estado.', selectedStates.filter((state) => state.isInitial).length === 1 ? '' : 'Debe existir exactamente un estado inicial.', selectedStates.some((state) => state.isTerminal) ? '' : 'Debe existir al menos un estado terminal.'].filter(Boolean);
  async function saveStates() { if (localValidation.length) { showToast(localValidation[0]); return; } try { await sigcService.saveWorkflowStates(caseTypeId, stateIds); showToast('Estados del flujo actualizados y validados.'); } catch (error) { showToast(errorMessage(error)); } }
  async function removeTransition(id: string) { if (!window.confirm('¿Eliminar esta transición?')) return; try { await sigcService.deleteTransition(id); showToast('Transición eliminada.'); } catch (error) { showToast(errorMessage(error)); } }
  return <div><SectionHead title="Constructor de flujo" description="Selecciona los estados aplicables, define su orden y controla transiciones válidas." /><label className="field-label phase56-workflow-select">Tipo de caso<select className="input" value={caseTypeId} onChange={(e) => setCaseTypeId(e.target.value)}>{data.caseTypes.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><div className="phase56-two-column workflow-columns"><section><h3>Estados del proceso</h3><div className="phase56-state-order">{stateIds.map((id, index) => { const state = data.states.find((item) => item.id === id); if (!state) return null; return <div key={id}><b>{index + 1}</b><strong>{state.name}</strong><button className="btn btn-ghost" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={15} /></button><button className="btn btn-ghost" disabled={index === stateIds.length - 1} onClick={() => move(index, 1)}><ArrowDown size={15} /></button><button className="btn btn-ghost danger-icon" onClick={() => toggleState(id)}><X size={15} /></button></div>; })}</div>{localValidation.length ? <div className="workflow-validation danger">{localValidation.map((message) => <span key={message}>{message}</span>)}</div> : <div className="workflow-validation success"><span>Flujo estructuralmente válido.</span></div>}<div className="phase56-state-pool">{data.states.filter((state) => !stateIds.includes(state.id) && state.isActive).map((state) => <button key={state.id} onClick={() => toggleState(state.id)}><Plus size={14} /> {state.name}</button>)}</div><button className="btn btn-primary full" disabled={Boolean(localValidation.length)} onClick={() => void saveStates()}><Save size={16} /> Guardar orden del flujo</button></section><section><div className="phase56-transition-title"><h3>Transiciones permitidas</h3><button className="btn btn-white" onClick={() => setTransitionEdit('new')}><Plus size={15} /> Agregar</button></div><div className="phase56-transition-list">{workflow?.transitions.map((transition) => <div key={transition.id}><div><strong>{stateName(data, transition.fromStateId)} → {stateName(data, transition.toStateId)}</strong><span>{transition.requiresJustification ? 'Exige justificación' : 'Sin justificación'}{transition.requiredPermissionCode ? ` · ${transition.requiredPermissionCode}` : ''}</span></div><button className="btn btn-ghost" onClick={() => setTransitionEdit(transition)}><Edit3 size={15} /></button><button className="btn btn-ghost danger-icon" onClick={() => void removeTransition(transition.id)}><Trash2 size={15} /></button></div>)}</div></section></div>{transitionEdit ? <TransitionModal data={data} caseTypeId={caseTypeId} item={transitionEdit === 'new' ? null : transitionEdit} onClose={() => setTransitionEdit(null)} showToast={showToast} /> : null}</div>;
}

function TransitionModal({ data, caseTypeId, item, onClose, showToast }: { data: SigcAdminSnapshot; caseTypeId: string; item: AdminTransition | null; onClose: () => void; showToast: (text: string) => void }) {
  const workflowStateIds = data.workflows.find((workflow) => workflow.caseTypeId === caseTypeId)?.states.map((state) => state.stateId) ?? [];
  const workflowStates = workflowStateIds.map((id) => data.states.find((state) => state.id === id)).filter((state): state is AdminCatalogItem => Boolean(state));
  const [form, setForm] = useState<SaveTransitionInput>({ id: item?.id, caseTypeId, fromStateId: item?.fromStateId ?? workflowStates[0]?.id ?? '', toStateId: item?.toStateId ?? workflowStates[1]?.id ?? '', requiredPermissionCode: item?.requiredPermissionCode ?? '', requiresJustification: item?.requiresJustification ?? false, isActive: item?.isActive ?? true });
  async function submit(event: FormEvent) { event.preventDefault(); if (!form.fromStateId || !form.toStateId) { showToast('El flujo debe tener al menos dos estados antes de crear transiciones.'); return; } if (form.fromStateId === form.toStateId) { showToast('Una transición no puede dirigirse al mismo estado.'); return; } try { await sigcService.saveTransition(form); showToast('Transición guardada.'); onClose(); } catch (error) { showToast(errorMessage(error)); } }
  return <ConfigModal title={item ? 'Editar transición' : 'Nueva transición'} onClose={onClose}><form className="stack" onSubmit={submit}><div className="form-grid two"><label className="field-label">Desde<select className="input" value={form.fromStateId} onChange={(e) => setForm({ ...form, fromStateId: e.target.value })}>{workflowStates.map((state) => <option key={state.id} value={state.id}>{state.name}</option>)}</select></label><label className="field-label">Hacia<select className="input" value={form.toStateId} onChange={(e) => setForm({ ...form, toStateId: e.target.value })}>{workflowStates.map((state) => <option key={state.id} value={state.id}>{state.name}</option>)}</select></label></div><label className="field-label">Permiso requerido<select className="input" value={form.requiredPermissionCode ?? ''} onChange={(e) => setForm({ ...form, requiredPermissionCode: e.target.value || undefined })}><option value="">Sin permiso específico</option>{data.permissions.map((permission) => <option key={permission.id} value={permission.code}>{permission.name} · {permission.code}</option>)}</select></label><div className="phase56-check-grid"><CheckField label="Exigir justificación" checked={form.requiresJustification} onChange={(checked) => setForm({ ...form, requiresJustification: checked })} /><CheckField label="Activa" checked={form.isActive} onChange={(checked) => setForm({ ...form, isActive: checked })} /></div><button className="btn btn-primary full" disabled={workflowStates.length < 2}><Save size={16} /> Guardar transición</button></form></ConfigModal>;
}

function TemplatesPanel({ data, showToast }: { data: SigcAdminSnapshot; showToast: (text: string) => void }) {
  const [editing, setEditing] = useState<AdminEmailTemplate | null | 'new'>(null);
  const [running, setRunning] = useState(false);
  async function runRuntime() { setRunning(true); try { const result = await sigcService.runRuntimeNow(); showToast(`Runtime ejecutado: ${result.remindersCreated} recordatorios, ${result.emailsQueued} correos en cola.`); } catch (error) { showToast(errorMessage(error)); } finally { setRunning(false); } }
  return <div><SectionHead title="Plantillas y runtime" description="Personaliza mensajes, prueba su renderizado y ejecuta el procesador de recordatorios/correos bajo demanda." action={<div className="table-actions"><button className="btn btn-white" disabled={running} onClick={() => void runRuntime()}><RefreshCw size={16} /> {running ? 'Procesando...' : 'Ejecutar runtime'}</button><button className="btn btn-primary" onClick={() => setEditing('new')}><Plus size={16} /> Nueva plantilla</button></div>} /><div className="phase56-template-grid">{data.emailTemplates.map((item) => <article key={item.id}><header><div className="kpi-icon"><Mail size={18} /></div><StatusPill active={item.isActive} /></header><strong>{item.name}</strong><code>{item.code}</code><span>{item.subject}</span><p>{item.bodyText.slice(0, 180)}{item.bodyText.length > 180 ? '…' : ''}</p><small>{item.variableCodes.length ? `Variables: ${item.variableCodes.join(', ')}` : 'Sin variables detectadas'}</small><button className="btn btn-white full" onClick={() => setEditing(item)}><Edit3 size={15} /> Editar y probar</button></article>)}</div>{editing ? <TemplateModal item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} showToast={showToast} /> : null}</div>;
}

function TemplateModal({ item, onClose, showToast }: { item: AdminEmailTemplate | null; onClose: () => void; showToast: (text: string) => void }) {
  const [form, setForm] = useState<SaveEmailTemplateInput>({ id: item?.id, code: item?.code ?? '', name: item?.name ?? '', eventType: item?.eventType ?? 'case.created', subject: item?.subject ?? '', bodyText: item?.bodyText ?? '', bodyHtml: item?.bodyHtml ?? '', isActive: item?.isActive ?? true });
  const [preview, setPreview] = useState<{ subject: string; bodyText: string; bodyHtml?: string | null; unresolvedVariables: string[] } | null>(null);
  const [testEmail, setTestEmail] = useState('');
  async function submit(event: FormEvent) { event.preventDefault(); try { await sigcService.saveEmailTemplate(form); showToast('Plantilla guardada.'); onClose(); } catch (error) { showToast(errorMessage(error)); } }
  async function generatePreview() { try { setPreview(await sigcService.previewEmailTemplate({ templateId: item?.id, subject: form.subject, bodyText: form.bodyText, bodyHtml: form.bodyHtml })); } catch (error) { showToast(errorMessage(error)); } }
  async function sendTest() { if (!testEmail.trim()) { showToast('Escribe un correo de prueba.'); return; } try { await sigcService.sendTestEmail({ templateId: item?.id, subject: form.subject, bodyText: form.bodyText, bodyHtml: form.bodyHtml, recipientEmail: testEmail.trim() }); showToast('Correo de prueba encolado.'); } catch (error) { showToast(errorMessage(error)); } }
  return <ConfigModal title={item ? 'Editar y probar plantilla' : 'Nueva plantilla'} onClose={onClose}><form className="stack" onSubmit={submit}><div className="form-grid two"><label className="field-label">Código<input className="input" value={form.code} disabled={Boolean(item)} onChange={(e) => setForm({ ...form, code: e.target.value })} required /></label><label className="field-label">Nombre<input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label></div><label className="field-label">Evento<select className="input" value={form.eventType ?? ''} onChange={(e) => setForm({ ...form, eventType: e.target.value })}>{emailEventOptions.map(([value, label]) => <option value={value} key={value}>{label} · {value}</option>)}</select></label><label className="field-label">Asunto<input className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required /></label><label className="field-label">Cuerpo de texto<textarea className="input textarea" value={form.bodyText} onChange={(e) => setForm({ ...form, bodyText: e.target.value })} required /></label><label className="field-label">HTML opcional<textarea className="input textarea compact" value={form.bodyHtml ?? ''} onChange={(e) => setForm({ ...form, bodyHtml: e.target.value })} /></label><div className="phase56-check-grid"><CheckField label="Activa" checked={form.isActive} onChange={(checked) => setForm({ ...form, isActive: checked })} /></div><div className="template-tool-row"><button className="btn btn-white" type="button" onClick={() => void generatePreview()}><Eye size={15} /> Vista previa</button><input className="input" type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="correo@empresa.com" /><button className="btn btn-soft" type="button" onClick={() => void sendTest()}><Mail size={15} /> Enviar prueba</button></div>{preview ? <div className="template-preview"><strong>{preview.subject}</strong><p>{preview.bodyText}</p>{preview.unresolvedVariables.length ? <div className="alert danger">Variables sin resolver: {preview.unresolvedVariables.join(', ')}</div> : <small>Vista previa sin variables pendientes.</small>}</div> : null}<button className="btn btn-primary full"><Save size={16} /> Guardar plantilla</button></form></ConfigModal>;
}

function AutomationsPanel({ data, showToast }: { data: SigcAdminSnapshot; showToast: (text: string) => void }) {
  const { data: cases } = useSigcCases();
  const { data: runtime, reload: reloadRuntime } = useAutomationRuntimeHealth();
  const [editing, setEditing] = useState<AutomationRule | null | 'new'>(null);
  const [testRule, setTestRule] = useState<AutomationRule | null>(null);
  async function toggle(rule: AutomationRule) { try { await sigcService.toggleAutomationRule(rule.id, !rule.isActive); showToast(`${rule.name}: ${rule.isActive ? 'pausada' : 'activada'}.`); } catch (error) { showToast(errorMessage(error)); } }
  return <div className="phase56-stack-sections"><section><SectionHead title="Salud del runtime" description="Ejecuciones, reintentos, recordatorios y cola de correo de las últimas 24 horas." action={<button className="btn btn-white" onClick={reloadRuntime}><RefreshCw size={15} /> Actualizar</button>} /><div className="document-kpis"><article className="card"><span>Reglas activas</span><strong>{runtime?.activeRules ?? 0}</strong></article><article className="card"><span>Ejecuciones 24 h</span><strong>{runtime?.executions24h ?? 0}</strong></article><article className="card"><span>Fallidas</span><strong>{runtime?.failedExecutions24h ?? 0}</strong></article><article className="card"><span>Reintentos</span><strong>{runtime?.pendingRetries ?? 0}</strong></article><article className="card"><span>Recordatorios</span><strong>{runtime?.reminders24h ?? 0}</strong></article><article className="card"><span>Correos en cola</span><strong>{runtime?.queuedEmails ?? 0}</strong></article><article className="card"><span>Correos fallidos</span><strong>{runtime?.failedEmails ?? 0}</strong></article><article className="card"><span>Cola más antigua</span><strong className="runtime-date-value">{runtime?.oldestQueuedEmailAt ? formatDate(runtime.oldestQueuedEmailAt) : '—'}</strong></article></div></section><section><SectionHead title="Motor CUANDO → SI → ENTONCES" description="Las reglas reaccionan a eventos reales de auditoría y ejecutan acciones parametrizadas." action={<button className="btn btn-primary" onClick={() => setEditing('new')}><Plus size={16} /> Nueva automatización</button>} /><div className="automation-live-list">{data.automationRules.map((rule) => <article key={rule.id} className="automation-live-card"><div className="automation-live-icon"><Sparkles size={19} /></div><div className="automation-live-main"><header><div><strong>{rule.name}</strong><span>{triggerLabel(rule.triggerEvent)} · {rule.conditions.length} condición(es) · {rule.actions.length} acción(es)</span></div><StatusPill active={rule.isActive} /></header><p>{rule.description || 'Sin descripción'}</p><div className="automation-flow-preview"><em>CUANDO</em><b>{triggerLabel(rule.triggerEvent)}</b><span>→</span><em>SI</em><b>{rule.conditions.length ? `${rule.conditions.length} condición(es)` : 'Siempre'}</b><span>→</span><em>ENTONCES</em><b>{rule.actions.map((action) => actionLabels[action.type]).join(', ') || 'Sin acciones'}</b></div><footer><small>{rule.runCount} ejecuciones{rule.lastRunAt ? ` · última ${formatDate(rule.lastRunAt)}` : ''}</small><div><button className="btn btn-white" onClick={() => setTestRule(rule)}><Play size={15} /> Probar</button><button className="btn btn-white" onClick={() => setEditing(rule)}><Edit3 size={15} /> Editar</button><button className="btn btn-soft" onClick={() => void toggle(rule)}>{rule.isActive ? 'Pausar' : 'Activar'}</button></div></footer></div></article>)}</div></section><section><SectionHead title="Historial de ejecuciones" description="Resultado, coincidencia de condiciones y cantidad de acciones completadas." /><div className="phase56-table-wrap"><table className="phase56-table"><thead><tr><th>Regla</th><th>Caso</th><th>Disparador</th><th>Resultado</th><th>Acciones</th><th>Intento</th><th>Fecha</th></tr></thead><tbody>{data.automationExecutions.map((execution) => <tr key={execution.id} title={execution.errorMessage ?? undefined}><td><strong>{execution.ruleName}</strong></td><td>{execution.caseRadicado ?? '—'}</td><td><code>{execution.triggerEvent}</code></td><td><ExecutionPill status={execution.status} /></td><td>{execution.actionsSucceeded}/{execution.actionsTotal}</td><td>{execution.attemptCount}/{execution.maxAttempts}{execution.nextRetryAt ? ' · reintento programado' : ''}</td><td>{formatDate(execution.startedAt)}</td></tr>)}</tbody></table></div></section>{editing ? <AutomationModal data={data} item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} showToast={showToast} /> : null}{testRule ? <AutomationTestModal rule={testRule} cases={cases} onClose={() => setTestRule(null)} showToast={showToast} /> : null}</div>;
}

function AutomationModal({ data, item, onClose, showToast }: { data: SigcAdminSnapshot; item: AutomationRule | null; onClose: () => void; showToast: (text: string) => void }) {
  const [form, setForm] = useState<SaveAutomationRuleInput>({ id: item?.id, code: item?.code ?? '', name: item?.name ?? '', description: item?.description ?? '', triggerEvent: item?.triggerEvent ?? 'case.created', conditions: item?.conditions ?? [], actions: item?.actions ?? [], stopOnError: item?.stopOnError ?? true, sortOrder: item?.sortOrder ?? 0, isActive: item?.isActive ?? true, maxAttempts: item?.maxAttempts ?? 3, retryDelayMinutes: item?.retryDelayMinutes ?? 10 });
  async function submit(event: FormEvent) { event.preventDefault(); if (!form.actions.length) { showToast('Agrega al menos una acción.'); return; } try { await sigcService.saveAutomationRule(form); showToast('Automatización guardada.'); onClose(); } catch (error) { showToast(errorMessage(error)); } }
  return <ConfigModal title={item ? 'Editar automatización' : 'Nueva automatización'} description="Construye la regla sin código." onClose={onClose}><form className="stack automation-builder" onSubmit={submit}><div className="form-grid two"><label className="field-label">Código<input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required /></label><label className="field-label">Nombre<input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label></div><label className="field-label">Descripción<textarea className="input textarea compact" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label><BuilderBlock label="CUANDO" tone="when"><select className="input" value={form.triggerEvent} onChange={(e) => setForm({ ...form, triggerEvent: e.target.value })}>{triggerOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></BuilderBlock><BuilderBlock label="SI" tone="if" action={<button type="button" className="btn btn-white" onClick={() => setForm({ ...form, conditions: [...form.conditions, { field: 'case_type_id', operator: 'equals', value: data.caseTypes[0]?.id ?? '' }] })}><Plus size={14} /> Condición</button>}><div className="builder-list">{form.conditions.length ? form.conditions.map((condition, index) => <ConditionRow key={index} data={data} condition={condition} onChange={(next) => setForm({ ...form, conditions: form.conditions.map((item, itemIndex) => itemIndex === index ? next : item) })} onRemove={() => setForm({ ...form, conditions: form.conditions.filter((_, itemIndex) => itemIndex !== index) })} />) : <div className="empty-inline">Sin condiciones: la regla se ejecutará siempre que ocurra el evento.</div>}</div></BuilderBlock><BuilderBlock label="ENTONCES" tone="then" action={<button type="button" className="btn btn-white" onClick={() => setForm({ ...form, actions: [...form.actions, { type: 'assign_area', areaId: data.areas[0]?.id ?? '' }] })}><Plus size={14} /> Acción</button>}><div className="builder-list">{form.actions.map((action, index) => <ActionRow key={index} data={data} action={action} onChange={(next) => setForm({ ...form, actions: form.actions.map((item, itemIndex) => itemIndex === index ? next : item) })} onRemove={() => setForm({ ...form, actions: form.actions.filter((_, itemIndex) => itemIndex !== index) })} />)}</div></BuilderBlock><div className="phase56-check-grid"><CheckField label="Detener si una acción falla" checked={form.stopOnError} onChange={(checked) => setForm({ ...form, stopOnError: checked })} /><CheckField label="Regla activa" checked={form.isActive} onChange={(checked) => setForm({ ...form, isActive: checked })} /></div><div className="form-grid three"><label className="field-label">Orden de ejecución<input className="input" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} /></label><label className="field-label">Intentos máximos<input className="input" type="number" min="1" max="10" value={form.maxAttempts} onChange={(e) => setForm({ ...form, maxAttempts: Number(e.target.value) })} /></label><label className="field-label">Reintentar en minutos<input className="input" type="number" min="1" max="1440" value={form.retryDelayMinutes} onChange={(e) => setForm({ ...form, retryDelayMinutes: Number(e.target.value) })} /></label></div><button className="btn btn-primary full"><Save size={16} /> Guardar automatización</button></form></ConfigModal>;
}

function BuilderBlock({ label, tone, action, children }: { label: string; tone: 'when' | 'if' | 'then'; action?: ReactNode; children: ReactNode }) {
  return <section className={`builder-block builder-${tone}`}><header><strong>{label}</strong>{action}</header>{children}</section>;
}

function ConditionRow({ data, condition, onChange, onRemove }: { data: SigcAdminSnapshot; condition: AutomationCondition; onChange: (value: AutomationCondition) => void; onRemove: () => void }) {
  const booleanField = condition.field === 'overdue' || condition.field === 'all_subtasks_completed';
  return <div className="builder-row condition-row"><select className="input" value={condition.field} onChange={(e) => { const field = e.target.value as AutomationCondition['field']; onChange({ field, operator: field === 'overdue' || field === 'all_subtasks_completed' ? 'is_true' : 'equals', value: field === 'overdue' || field === 'all_subtasks_completed' ? 'true' : conditionDefaultValue(data, field) }); }}>{Object.entries(conditionFieldLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select className="input" value={condition.operator} onChange={(e) => onChange({ ...condition, operator: e.target.value as AutomationCondition['operator'] })}>{booleanField ? <><option value="is_true">Es verdadero</option><option value="is_false">Es falso</option></> : <><option value="equals">Es igual a</option><option value="not_equals">Es diferente de</option><option value="contains">Contiene</option></>}</select>{booleanField ? <div className="builder-static-value">{condition.operator === 'is_false' ? 'No' : 'Sí'}</div> : <ConditionValue data={data} condition={condition} onChange={onChange} />}<button type="button" className="btn btn-ghost danger-icon" onClick={onRemove}><Trash2 size={15} /></button></div>;
}

function ConditionValue({ data, condition, onChange }: { data: SigcAdminSnapshot; condition: AutomationCondition; onChange: (value: AutomationCondition) => void }) {
  const options = conditionOptions(data, condition.field);
  if (options) return <select className="input" value={condition.value} onChange={(e) => onChange({ ...condition, value: e.target.value })}>{options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>;
  return <input className="input" value={condition.value} onChange={(e) => onChange({ ...condition, value: e.target.value })} placeholder="Valor" />;
}

function ActionRow({ data, action, onChange, onRemove }: { data: SigcAdminSnapshot; action: AutomationAction; onChange: (value: AutomationAction) => void; onRemove: () => void }) {
  return <div className="builder-action-card"><header><select className="input" value={action.type} onChange={(e) => onChange(defaultAction(e.target.value as AutomationAction['type'], data))}>{Object.entries(actionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button type="button" className="btn btn-ghost danger-icon" onClick={onRemove}><Trash2 size={15} /></button></header><ActionFields data={data} action={action} onChange={onChange} /></div>;
}

function ActionFields({ data, action, onChange }: { data: SigcAdminSnapshot; action: AutomationAction; onChange: (value: AutomationAction) => void }) {
  if (action.type === 'assign_area') return <label className="field-label">Área<select className="input" value={action.areaId} onChange={(e) => onChange({ ...action, areaId: e.target.value })}>{data.areas.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>;
  if (action.type === 'set_priority') return <label className="field-label">Prioridad<select className="input" value={action.priorityId} onChange={(e) => onChange({ ...action, priorityId: e.target.value })}>{data.priorities.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>;
  if (action.type === 'assign_user') return <div className="form-grid two"><label className="field-label">Responsable<select className="input" value={action.userId} onChange={(e) => onChange({ ...action, userId: e.target.value })}>{data.members.filter((item) => item.isActive).map((item) => <option key={item.userId} value={item.userId}>{item.name}</option>)}</select></label><label className="field-label">Área opcional<select className="input" value={action.areaId ?? ''} onChange={(e) => onChange({ ...action, areaId: e.target.value || undefined })}><option value="">Usar área principal</option>{data.areas.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>;
  if (action.type === 'create_subtask') return <div className="stack"><label className="field-label">Título<input className="input" value={action.title} onChange={(e) => onChange({ ...action, title: e.target.value })} /></label><div className="form-grid two"><label className="field-label">Responsable<select className="input" value={action.responsibleUserId ?? ''} onChange={(e) => onChange({ ...action, responsibleUserId: e.target.value || undefined })}><option value="">Sin asignar</option>{data.members.map((item) => <option key={item.userId} value={item.userId}>{item.name}</option>)}</select></label><label className="field-label">Vence en horas<input className="input" type="number" min="0" value={action.dueInHours ?? 0} onChange={(e) => onChange({ ...action, dueInHours: Number(e.target.value) })} /></label></div></div>;
  if (action.type === 'notify_user') return <div className="stack"><label className="field-label">Usuario<select className="input" value={action.userId} onChange={(e) => onChange({ ...action, userId: e.target.value })}>{data.members.map((item) => <option key={item.userId} value={item.userId}>{item.name}</option>)}</select></label><NotificationFields action={action} onChange={onChange} /></div>;
  if (action.type === 'notify_role') return <div className="stack"><label className="field-label">Rol<select className="input" value={action.roleCode} onChange={(e) => onChange({ ...action, roleCode: e.target.value })}>{data.roles.map((item) => <option key={item.id} value={item.code}>{item.name}</option>)}</select></label><NotificationFields action={action} onChange={onChange} /></div>;
  if (action.type === 'change_state') return <div className="form-grid two"><label className="field-label">Estado destino<select className="input" value={action.stateId} onChange={(e) => onChange({ ...action, stateId: e.target.value })}>{data.states.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field-label">Justificación<input className="input" value={action.justification ?? ''} onChange={(e) => onChange({ ...action, justification: e.target.value })} /></label></div>;
  if (action.type === 'email_requester') return <label className="field-label">Plantilla<select className="input" value={action.templateCode} onChange={(e) => onChange({ ...action, templateCode: e.target.value })}>{data.emailTemplates.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.code}>{item.name}</option>)}</select></label>;
  return <div className="phase56-action-note"><CheckCircle2 size={17} /> Notifica al responsable cuando el caso puede estar listo para cierre.</div>;
}

function NotificationFields({ action, onChange }: { action: Extract<AutomationAction, { type: 'notify_user' | 'notify_role' }>; onChange: (value: AutomationAction) => void }) {
  return <div className="form-grid two"><label className="field-label">Título<input className="input" value={action.title ?? ''} onChange={(e) => onChange({ ...action, title: e.target.value })} /></label><label className="field-label">Mensaje<input className="input" value={action.message ?? ''} onChange={(e) => onChange({ ...action, message: e.target.value })} /></label></div>;
}

function AutomationTestModal({ rule, cases, onClose, showToast }: { rule: AutomationRule; cases: Array<{ databaseId?: string; id: string; radicado: string; subject: string }>; onClose: () => void; showToast: (text: string) => void }) {
  const [caseId, setCaseId] = useState(cases[0]?.databaseId ?? cases[0]?.id ?? '');
  const [running, setRunning] = useState(false);
  async function run() { setRunning(true); try { await sigcService.runAutomationRule(rule.id, caseId); showToast('Prueba ejecutada. Revisa el historial de ejecuciones.'); onClose(); } catch (error) { showToast(errorMessage(error)); } finally { setRunning(false); } }
  return <ConfigModal title={`Probar · ${rule.name}`} description="La prueba ejecuta acciones reales sobre el caso seleccionado. Las condiciones deben cumplirse." onClose={onClose}><div className="stack"><div className="alert danger">Esta prueba puede asignar responsables, cambiar prioridad, crear subtareas o enviar notificaciones.</div><label className="field-label">Caso<select className="input" value={caseId} onChange={(e) => setCaseId(e.target.value)}>{cases.map((item) => <option key={item.id} value={item.databaseId ?? item.id}>{item.radicado} · {item.subject}</option>)}</select></label><button className="btn btn-primary full" disabled={!caseId || running} onClick={() => void run()}><Play size={16} /> {running ? 'Ejecutando...' : 'Ejecutar prueba real'}</button></div></ConfigModal>;
}

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="check-row"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}</label>;
}

function StatusPill({ active }: { active: boolean }) { return <span className={`phase56-status ${active ? 'active' : 'inactive'}`}>{active ? 'Activo' : 'Inactivo'}</span>; }
function ExecutionPill({ status }: { status: string }) { return <span className={`phase56-execution execution-${status}`}>{status === 'success' ? 'Correcta' : status === 'partial' ? 'Parcial' : status === 'failed' ? 'Fallida' : status === 'skipped' ? 'Omitida' : 'Ejecutando'}</span>; }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : 'No fue posible completar la operación.'; }
function unitLabel(unit: AdminSlaPolicy['durationUnit']) { return unit === 'hours' ? 'horas' : unit === 'business_days' ? 'días hábiles' : 'días calendario'; }
function stateName(data: SigcAdminSnapshot, id: string) { return data.states.find((item) => item.id === id)?.name ?? 'Estado'; }
function initials(name: string) { return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'U'; }
function formatDate(value: string) { const date = new Date(value); return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short' }).format(date) : value; }
function triggerLabel(value: string) { return triggerOptions.find(([id]) => id === value)?.[1] ?? value; }

function conditionDefaultValue(data: SigcAdminSnapshot, field: AutomationCondition['field']) {
  return conditionOptions(data, field)?.[0]?.value ?? '';
}
function conditionOptions(data: SigcAdminSnapshot, field: AutomationCondition['field']): Array<{ value: string; label: string }> | null {
  if (field === 'case_type_id') return data.caseTypes.map((item) => ({ value: item.id, label: item.name }));
  if (field === 'priority_id') return data.priorities.map((item) => ({ value: item.id, label: item.name }));
  if (field === 'state_id') return data.states.map((item) => ({ value: item.id, label: item.name }));
  if (field === 'primary_area_id') return data.areas.map((item) => ({ value: item.id, label: item.name }));
  if (field === 'primary_owner_id') return data.members.map((item) => ({ value: item.userId, label: item.name }));
  if (field === 'source') return [{ value: 'public', label: 'Formulario público' }, { value: 'manual', label: 'Creación manual' }];
  return null;
}

function defaultAction(type: AutomationAction['type'], data: SigcAdminSnapshot): AutomationAction {
  if (type === 'assign_area') return { type, areaId: data.areas[0]?.id ?? '' };
  if (type === 'assign_user') return { type, userId: data.members[0]?.userId ?? '' };
  if (type === 'set_priority') return { type, priorityId: data.priorities[0]?.id ?? '' };
  if (type === 'create_subtask') return { type, title: 'Nueva subtarea automática', dueInHours: 24 };
  if (type === 'notify_user') return { type, userId: data.members[0]?.userId ?? '', title: 'Automatización SIGC', message: '' };
  if (type === 'notify_role') return { type, roleCode: data.roles[0]?.code ?? 'admin', title: 'Automatización SIGC', message: '' };
  if (type === 'change_state') return { type, stateId: data.states[0]?.id ?? '', justification: '' };
  if (type === 'email_requester') return { type, templateCode: data.emailTemplates[0]?.code ?? '' };
  return { type: 'suggest_close' };
}
