import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  BadgeDollarSign,
  Banknote,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  CreditCard,
  FileText,
  Gift,
  Layers3,
  Loader2,
  PackagePlus,
  Pencil,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  TicketCheck,
  TrendingUp,
  Users,
  WalletCards,
  X
} from 'lucide-react';
import { platformService } from './platformService';
import { usePlatformAccess } from './PlatformAccessProvider';
import type {
  BillingInvoice,
  BillingSnapshot,
  CommercialAddon,
  CommercialCatalog,
  CommercialCoupon,
  CommercialDashboard,
  CommercialPlan,
  CommercialRequest,
  OnboardingRecord,
  OrganizationSubscriptionPortal,
  PlatformOrganizationSummary
} from './types';

function currency(value: number | string | null | undefined, code = 'COP'): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(Number(value || 0));
}

function date(value: string | null | undefined, withTime = false): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', ...(withTime ? { timeStyle: 'short' as const } : {}) }).format(parsed);
}

function statusText(value: string): string {
  const labels: Record<string, string> = {
    active: 'Activa', trialing: 'En prueba', past_due: 'Pago pendiente', suspended: 'Suspendida', cancelled: 'Cancelada',
    draft: 'Borrador', issued: 'Emitida', partially_paid: 'Pago parcial', paid: 'Pagada', overdue: 'Vencida', void: 'Anulada',
    pending: 'Pendiente', in_review: 'En revisión', approved: 'Aprobada', rejected: 'Rechazada', applied: 'Aplicada',
    not_started: 'Sin iniciar', in_progress: 'En progreso', blocked: 'Bloqueado', completed: 'Completado'
  };
  return labels[value] || value;
}

function tone(value: string): string {
  if (['active', 'paid', 'completed', 'applied', 'approved'].includes(value)) return 'success';
  if (['trialing', 'issued', 'in_progress', 'in_review'].includes(value)) return 'info';
  if (['past_due', 'partially_paid', 'pending', 'not_started'].includes(value)) return 'warning';
  if (['suspended', 'cancelled', 'overdue', 'void', 'rejected', 'blocked'].includes(value)) return 'danger';
  return '';
}

function useLoad<T>(loader: () => Promise<T>, dependencies: readonly unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    void loader().then((result) => { if (alive) setData(result); }).catch((reason: unknown) => { if (alive) setError(reason instanceof Error ? reason.message : 'No fue posible cargar la información.'); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, revision]);
  return { data, error, loading, reload };
}

function Head({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return <header className="platform-page-head"><div><span className="eyebrow">Orkesta · Fase 3.1 comercial</span><h1>{title}</h1><p>{description}</p></div>{actions ? <div className="platform-page-actions">{actions}</div> : null}</header>;
}

function Loading() { return <section className="card platform-loading"><Loader2 className="spin" /><strong>Cargando módulo comercial...</strong></section>; }
function ErrorCard({ message, retry }: { message: string; retry: () => void }) { return <section className="card platform-error"><AlertTriangle /><div><strong>No fue posible cargar el módulo</strong><p>{message}</p></div><button className="btn btn-white" onClick={retry}>Reintentar</button></section>; }
function Empty({ title, description }: { title: string; description: string }) { return <div className="platform-empty"><Receipt /><strong>{title}</strong><p>{description}</p></div>; }

function Metric({ icon, label, value, helper, danger }: { icon: ReactNode; label: string; value: ReactNode; helper?: string; danger?: boolean }) {
  return <article className={`platform-metric card ${danger ? 'danger' : ''}`}><div className="platform-metric-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong>{helper ? <small>{helper}</small> : null}</div></article>;
}

export function PlatformCommercialDashboardPage() {
  const { data, error, loading, reload } = useLoad<CommercialDashboard>(() => platformService.getCommercialDashboard());
  const { canPlatform } = usePlatformAccess();
  const [selected, setSelected] = useState<CommercialRequest | null>(null);
  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorCard message={error} retry={reload} />;
  const dashboard = data!;
  const metrics = dashboard.metrics;
  return <div className="platform-page">
    <Head title="Gestión comercial" description="Suscripciones, renovaciones, facturación, recaudo, solicitudes y onboarding en un solo centro de control." actions={<><Link className="btn btn-white" to="/superadmin/plans"><Layers3 size={16} />Planes</Link><Link className="btn btn-primary" to="/superadmin/billing"><Receipt size={16} />Facturación</Link><button className="btn btn-white" onClick={reload}><RefreshCw size={16} />Actualizar</button></>} />
    <section className="platform-metric-grid">
      <Metric icon={<CircleDollarSign />} label="MRR estimado" value={currency(metrics.monthlyRecurringRevenue)} helper="Ingreso recurrente mensual normalizado" />
      <Metric icon={<Banknote />} label="Recaudado este mes" value={currency(metrics.collectedThisMonth)} helper={`${currency(metrics.invoicedThisMonth)} facturados`} />
      <Metric icon={<WalletCards />} label="Saldo pendiente" value={currency(metrics.outstandingBalance)} helper={`${metrics.overdueInvoices} facturas vencidas`} danger={metrics.overdueInvoices > 0} />
      <Metric icon={<Building2 />} label="Suscripciones activas" value={metrics.activeSubscriptions} helper={`${metrics.trialingSubscriptions} en prueba`} />
      <Metric icon={<AlertTriangle />} label="Pago pendiente" value={metrics.pastDueSubscriptions} helper="Organizaciones por gestionar" danger={metrics.pastDueSubscriptions > 0} />
      <Metric icon={<TicketCheck />} label="Solicitudes comerciales" value={metrics.pendingRequests} helper="Pendientes o en revisión" danger={metrics.pendingRequests > 0} />
      <Metric icon={<CalendarClock />} label="Cancelación programada" value={metrics.scheduledCancellations} helper="Al cierre del periodo" danger={metrics.scheduledCancellations > 0} />
      <Metric icon={<ClipboardCheck />} label="Onboarding activo" value={metrics.onboardingInProgress} helper="Organizaciones en incorporación" />
    </section>
    <section className="platform-commercial-grid">
      <article className="card platform-panel"><header><div><h2>Renovaciones próximas</h2><p>Vigencias que finalizan durante los próximos 45 días.</p></div><CalendarClock /></header><div className="commercial-list">{dashboard.renewals.length ? dashboard.renewals.map((item) => <Link to={`/superadmin/organizations/${item.organizationId}`} key={item.organizationId}><span><strong>{item.organizationName}</strong><small>{item.planName} · {statusText(item.status)}</small></span><span><b>{date(item.periodEnd)}</b><small>{item.cancelAtPeriodEnd ? 'Cancelación programada' : item.autoRenew ? 'Renovación activa' : 'Renovación manual'}</small></span><ChevronRight /></Link>) : <Empty title="Sin renovaciones próximas" description="No hay vigencias próximas a finalizar." />}</div></article>
      <article className="card platform-panel"><header><div><h2>Facturas recientes</h2><p>Últimos documentos comerciales emitidos.</p></div><FileText /></header><InvoiceMiniList rows={dashboard.recentInvoices} /><Link className="platform-panel-link" to="/superadmin/billing">Abrir facturación <ChevronRight size={16} /></Link></article>
    </section>
    <section className="card platform-panel"><header><div><h2>Solicitudes de las organizaciones</h2><p>Cambios de plan, cancelaciones, renovaciones y actualizaciones de facturación.</p></div><Sparkles /></header>{dashboard.pendingRequests.length ? <div className="platform-table-scroll"><table><thead><tr><th>Organización</th><th>Solicitud</th><th>Razón</th><th>Fecha</th><th>Estado</th><th /></tr></thead><tbody>{dashboard.pendingRequests.map((request) => <tr key={request.id}><td><strong>{request.organizationName}</strong><small>{request.requestedByName || 'Administrador organizacional'}</small></td><td>{requestTypeLabel(request.requestType)}</td><td>{request.reason}</td><td>{date(request.requestedAt, true)}</td><td><span className={`platform-chip ${tone(request.status)}`}>{statusText(request.status)}</span></td><td>{canPlatform('platform.commercial.manage') ? <button className="btn btn-white small" onClick={() => setSelected(request)}>Gestionar</button> : null}</td></tr>)}</tbody></table></div> : <Empty title="Sin solicitudes pendientes" description="Las organizaciones no tienen trámites comerciales abiertos." />}</section>
    {selected ? <ReviewRequestModal request={selected} close={() => setSelected(null)} saved={() => { setSelected(null); reload(); }} /> : null}
  </div>;
}

function requestTypeLabel(type: string): string {
  return ({ plan_change: 'Cambio de plan', cancel: 'Cancelación', reactivate: 'Reactivación', addon_change: 'Complementos', billing_update: 'Datos de facturación', renewal: 'Renovación' } as Record<string, string>)[type] || type;
}

function InvoiceMiniList({ rows }: { rows: BillingInvoice[] }) {
  if (!rows.length) return <Empty title="Sin facturas" description="Aún no se han emitido facturas." />;
  return <div className="commercial-list compact">{rows.map((invoice) => <Link to={`/superadmin/billing?q=${encodeURIComponent(invoice.invoiceNumber)}`} key={invoice.id}><span><strong>{invoice.invoiceNumber}</strong><small>{invoice.organizationName}</small></span><span><b>{currency(invoice.totalAmount, invoice.currency)}</b><small className={`text-${tone(invoice.status)}`}>{statusText(invoice.status)}</small></span><ChevronRight /></Link>)}</div>;
}

function ReviewRequestModal({ request, close, saved }: { request: CommercialRequest; close: () => void; saved: () => void }) {
  const [decision, setDecision] = useState<'approved' | 'rejected' | 'in_review'>('approved');
  const [notes, setNotes] = useState('');
  const [apply, setApply] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (notes.trim().length < 3) return setError('Escribe una observación de mínimo 3 caracteres.');
    setSaving(true); setError('');
    try { await platformService.reviewCommercialRequest(request.id, decision, notes.trim(), decision === 'approved' && apply); saved(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible gestionar la solicitud.'); }
    finally { setSaving(false); }
  }
  return <div className="platform-modal-backdrop"><form className="card platform-modal" onSubmit={submit}><header><div><span className="eyebrow">Solicitud comercial</span><h2>{request.organizationName}</h2><p>{requestTypeLabel(request.requestType)} · {request.reason}</p></div><button type="button" onClick={close}><X /></button></header><pre className="platform-json">{JSON.stringify(request.requestedPayload || {}, null, 2)}</pre><label>Decisión<select value={decision} onChange={(event) => setDecision(event.target.value as typeof decision)}><option value="approved">Aprobar</option><option value="in_review">Dejar en revisión</option><option value="rejected">Rechazar</option></select></label>{decision === 'approved' ? <label className="commercial-check"><input type="checkbox" checked={apply} onChange={(event) => setApply(event.target.checked)} /><span>Aplicar inmediatamente la solicitud cuando sea compatible</span></label> : null}<label>Observaciones<textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Justificación y condiciones de la decisión" /></label>{error ? <div className="alert danger">{error}</div> : null}<footer><button type="button" className="btn btn-white" onClick={close}>Cancelar</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Registrar decisión'}</button></footer></form></div>;
}

export function PlatformPlansPage() {
  const { data, error, loading, reload } = useLoad<CommercialCatalog>(() => platformService.getCommercialCatalog(true));
  const { canPlatform } = usePlatformAccess();
  const [tab, setTab] = useState<'plans' | 'addons' | 'coupons'>('plans');
  const [editor, setEditor] = useState<{ kind: 'plan' | 'addon' | 'coupon'; row?: CommercialPlan | CommercialAddon | CommercialCoupon } | null>(null);
  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorCard message={error} retry={reload} />;
  const catalog = data!;
  const count = tab === 'plans' ? catalog.plans.length : tab === 'addons' ? catalog.addons.length : catalog.coupons.length;
  return <div className="platform-page">
    <Head title="Planes, complementos y descuentos" description="Catálogo comercial parametrizable sin modificar el código fuente." actions={<><button className="btn btn-white" onClick={reload}><RefreshCw size={16} />Actualizar</button>{canPlatform('platform.plans.manage') ? <button className="btn btn-primary" onClick={() => setEditor({ kind: tab === 'plans' ? 'plan' : tab === 'addons' ? 'addon' : 'coupon' })}><Plus size={16} />Nuevo</button> : null}</>} />
    <nav className="platform-tabs commercial-tabs"><button className={tab === 'plans' ? 'active' : ''} onClick={() => setTab('plans')}>Planes ({catalog.plans.length})</button><button className={tab === 'addons' ? 'active' : ''} onClick={() => setTab('addons')}>Complementos ({catalog.addons.length})</button><button className={tab === 'coupons' ? 'active' : ''} onClick={() => setTab('coupons')}>Cupones ({catalog.coupons.length})</button></nav>
    {tab === 'plans' ? <PlanGrid rows={catalog.plans} edit={(row) => setEditor({ kind: 'plan', row })} canEdit={canPlatform('platform.plans.manage')} /> : null}
    {tab === 'addons' ? <AddonTable rows={catalog.addons} edit={(row) => setEditor({ kind: 'addon', row })} canEdit={canPlatform('platform.plans.manage')} /> : null}
    {tab === 'coupons' ? <CouponTable rows={catalog.coupons} edit={(row) => setEditor({ kind: 'coupon', row })} canEdit={canPlatform('platform.commercial.manage')} /> : null}
    {!count ? <section className="card"><Empty title="Catálogo vacío" description="Crea el primer elemento comercial." /></section> : null}
    {editor ? <CatalogEditorModal editor={editor} close={() => setEditor(null)} saved={() => { setEditor(null); reload(); }} /> : null}
  </div>;
}

function PlanGrid({ rows, edit, canEdit }: { rows: CommercialPlan[]; edit: (row: CommercialPlan) => void; canEdit: boolean }) {
  return <section className="commercial-plan-grid">{rows.map((plan) => <article className={`card commercial-plan-card ${plan.isActive ? '' : 'disabled'}`} key={plan.id}><header><div><span className="platform-chip info">{plan.code}</span><h2>{plan.name}</h2><p>{plan.description}</p></div>{canEdit ? <button className="btn btn-white small" onClick={() => edit(plan)}><Pencil size={14} />Editar</button> : null}</header><div className="commercial-price"><strong>{currency(plan.monthlyPriceCop, plan.currency)}</strong><span>/ mes</span><small>{currency(plan.annualPriceCop, plan.currency)} anual</small></div><div className="commercial-stat-row"><span><b>{plan.activeSubscriptions}</b> suscripciones</span><span><b>{plan.trialDays}</b> días prueba</span><span><b>{plan.graceDays}</b> días gracia</span></div><dl className="commercial-definition"><div><dt>Límites</dt><dd><code>{JSON.stringify(plan.limits)}</code></dd></div><div><dt>Funciones</dt><dd><code>{JSON.stringify(plan.features)}</code></dd></div></dl><footer><span className={`platform-chip ${plan.isActive ? 'success' : 'danger'}`}>{plan.isActive ? 'Activo' : 'Inactivo'}</span><span>{plan.isPublic ? 'Visible para clientes' : 'Uso interno'}</span></footer></article>)}</section>;
}

function AddonTable({ rows, edit, canEdit }: { rows: CommercialAddon[]; edit: (row: CommercialAddon) => void; canEdit: boolean }) {
  return <section className="card platform-table-card"><div className="platform-table-scroll"><table><thead><tr><th>Complemento</th><th>Unidad</th><th>Mensual</th><th>Anual</th><th>Impacto</th><th>Estado</th><th /></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.name}</strong><small>{row.code} · {row.description}</small></td><td>{row.unitName}</td><td>{currency(row.monthlyPriceCop, row.currency)}</td><td>{currency(row.annualPriceCop, row.currency)}</td><td><code>{JSON.stringify({ ...row.limitsDelta, ...row.featuresDelta })}</code></td><td><span className={`platform-chip ${row.isActive ? 'success' : 'danger'}`}>{row.isActive ? 'Activo' : 'Inactivo'}</span></td><td>{canEdit ? <button className="btn btn-white small" onClick={() => edit(row)}><Pencil size={14} /></button> : null}</td></tr>)}</tbody></table></div></section>;
}

function CouponTable({ rows, edit, canEdit }: { rows: CommercialCoupon[]; edit: (row: CommercialCoupon) => void; canEdit: boolean }) {
  return <section className="card platform-table-card"><div className="platform-table-scroll"><table><thead><tr><th>Cupón</th><th>Descuento</th><th>Vigencia</th><th>Uso</th><th>Condición</th><th>Estado</th><th /></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.code}</strong><small>{row.name} · {row.description}</small></td><td>{row.discountType === 'percentage' ? `${row.discountValue}%` : currency(row.discountValue, row.currency)}</td><td>{date(row.validFrom)} – {date(row.validUntil)}</td><td>{row.redemptionCount}{row.maxRedemptions ? ` / ${row.maxRedemptions}` : ''}</td><td>{row.firstPurchaseOnly ? 'Primera compra' : 'General'}</td><td><span className={`platform-chip ${row.isActive ? 'success' : 'danger'}`}>{row.isActive ? 'Activo' : 'Inactivo'}</span></td><td>{canEdit ? <button className="btn btn-white small" onClick={() => edit(row)}><Pencil size={14} /></button> : null}</td></tr>)}</tbody></table></div></section>;
}

function CatalogEditorModal({ editor, close, saved }: { editor: { kind: 'plan' | 'addon' | 'coupon'; row?: CommercialPlan | CommercialAddon | CommercialCoupon }; close: () => void; saved: () => void }) {
  const row = editor.row as unknown as Record<string, unknown> | undefined;
  const [name, setName] = useState(String(row?.name || ''));
  const [code, setCode] = useState(String(row?.code || ''));
  const [description, setDescription] = useState(String(row?.description || ''));
  const [monthly, setMonthly] = useState(Number(row?.monthlyPriceCop || 0));
  const [annual, setAnnual] = useState(Number(row?.annualPriceCop || 0));
  const [discountType, setDiscountType] = useState(String(row?.discountType || 'percentage'));
  const [discountValue, setDiscountValue] = useState(Number(row?.discountValue || 0));
  const [trialDays, setTrialDays] = useState(Number(row?.trialDays || 14));
  const [graceDays, setGraceDays] = useState(Number(row?.graceDays || 5));
  const [limits, setLimits] = useState(JSON.stringify(row?.limits || row?.limitsDelta || {}, null, 2));
  const [features, setFeatures] = useState(JSON.stringify(row?.features || row?.featuresDelta || {}, null, 2));
  const [isActive, setActive] = useState(row?.isActive !== false);
  const [isPublic, setPublic] = useState(row?.isPublic !== false);
  const [reason, setReason] = useState('Actualización del catálogo comercial');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim().length < 2 || code.trim().length < 2) return setError('Nombre y código son obligatorios.');
    setSaving(true); setError('');
    try {
      if (editor.kind === 'plan') await platformService.upsertCommercialPlan({ id: row?.id, name, code, description, monthlyPriceCop: monthly, annualPriceCop: annual, currency: 'COP', trialDays, graceDays, billingIntervals: ['monthly', 'yearly'], limits: JSON.parse(limits || '{}'), features: JSON.parse(features || '{}'), onboardingTemplate: {}, isPublic, isActive, sortOrder: Number(row?.sortOrder || 0) }, reason);
      if (editor.kind === 'addon') await platformService.upsertCommercialAddon({ id: row?.id, name, code, description, unitName: String(row?.unitName || 'unidad'), monthlyPriceCop: monthly, annualPriceCop: annual, currency: 'COP', limitsDelta: JSON.parse(limits || '{}'), featuresDelta: JSON.parse(features || '{}'), minQuantity: 1, maxQuantity: row?.maxQuantity ?? null, isPublic, isActive, sortOrder: Number(row?.sortOrder || 0) }, reason);
      if (editor.kind === 'coupon') await platformService.upsertCommercialCoupon({ id: row?.id, name, code, description, discountType, discountValue, currency: 'COP', validFrom: row?.validFrom || null, validUntil: row?.validUntil || null, maxRedemptions: row?.maxRedemptions ?? null, applicablePlanIds: row?.applicablePlanIds || [], firstPurchaseOnly: Boolean(row?.firstPurchaseOnly), isActive }, reason);
      saved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible guardar el catálogo. Revisa el JSON.'); }
    finally { setSaving(false); }
  }
  return <div className="platform-modal-backdrop"><form className="card platform-modal commercial-modal-wide" onSubmit={submit}><header><div><span className="eyebrow">{editor.row ? 'Editar' : 'Crear'} {editor.kind === 'plan' ? 'plan' : editor.kind === 'addon' ? 'complemento' : 'cupón'}</span><h2>{name || 'Nuevo registro comercial'}</h2></div><button type="button" onClick={close}><X /></button></header><div className="platform-form-grid"><label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label>Código<input value={code} onChange={(event) => setCode(event.target.value)} required /></label>{editor.kind === 'coupon' ? <><label>Tipo<select value={discountType} onChange={(event) => setDiscountType(event.target.value)}><option value="percentage">Porcentaje</option><option value="fixed">Valor fijo</option></select></label><label>Valor<input type="number" min="0" value={discountValue} onChange={(event) => setDiscountValue(Number(event.target.value))} /></label></> : <><label>Precio mensual<input type="number" min="0" value={monthly} onChange={(event) => setMonthly(Number(event.target.value))} /></label><label>Precio anual<input type="number" min="0" value={annual} onChange={(event) => setAnnual(Number(event.target.value))} /></label></>}{editor.kind === 'plan' ? <><label>Días de prueba<input type="number" min="0" value={trialDays} onChange={(event) => setTrialDays(Number(event.target.value))} /></label><label>Días de gracia<input type="number" min="0" value={graceDays} onChange={(event) => setGraceDays(Number(event.target.value))} /></label></> : null}</div><label>Descripción<textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label>{editor.kind !== 'coupon' ? <div className="commercial-json-grid"><label>Límites JSON<textarea rows={8} value={limits} onChange={(event) => setLimits(event.target.value)} spellCheck={false} /></label><label>Funciones JSON<textarea rows={8} value={features} onChange={(event) => setFeatures(event.target.value)} spellCheck={false} /></label></div> : null}<div className="commercial-check-grid"><label className="commercial-check"><input type="checkbox" checked={isActive} onChange={(event) => setActive(event.target.checked)} /><span>Activo</span></label>{editor.kind !== 'coupon' ? <label className="commercial-check"><input type="checkbox" checked={isPublic} onChange={(event) => setPublic(event.target.checked)} /><span>Visible para organizaciones</span></label> : null}</div><label>Justificación<input value={reason} onChange={(event) => setReason(event.target.value)} /></label>{error ? <div className="alert danger">{error}</div> : null}<footer><button type="button" className="btn btn-white" onClick={close}>Cancelar</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button></footer></form></div>;
}

export function PlatformBillingPage() {
  const { canPlatform } = usePlatformAccess();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useLoad<BillingSnapshot>(() => platformService.listBilling({ search, status, page, pageSize: 20 }), [search, status, page]);
  const organizations = useLoad(() => platformService.listOrganizations({ page: 1, pageSize: 100 }));
  const catalog = useLoad(() => platformService.getCommercialCatalog(false));
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<BillingInvoice | null>(null);
  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorCard message={error} retry={reload} />;
  const result = data!;
  return <div className="platform-page">
    <Head title="Facturación y recaudo" description="Facturas, cuentas de cobro, pagos manuales y saldos por organización." actions={<><button className="btn btn-white" onClick={reload}><RefreshCw size={16} />Actualizar</button>{canPlatform('platform.billing.manage') ? <button className="btn btn-primary" onClick={() => setInvoiceOpen(true)}><Plus size={16} />Crear factura</button> : null}</>} />
    <section className="card platform-filters"><label><Search size={17} /><input placeholder="Factura u organización" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">Todos los estados</option><option value="draft">Borrador</option><option value="issued">Emitida</option><option value="partially_paid">Pago parcial</option><option value="paid">Pagada</option><option value="overdue">Vencida</option><option value="void">Anulada</option></select></section>
    <section className="card platform-table-card"><div className="platform-table-meta"><span>{result.total} facturas</span><span>Saldo visible y trazable</span></div><div className="platform-table-scroll"><table><thead><tr><th>Factura</th><th>Organización</th><th>Emisión / vencimiento</th><th>Total</th><th>Pagado</th><th>Saldo</th><th>Estado</th><th /></tr></thead><tbody>{result.rows.map((invoice) => <tr key={invoice.id}><td><strong>{invoice.invoiceNumber}</strong><small>{invoice.notes || 'Sin observación'}</small></td><td>{invoice.organizationName}</td><td>{date(invoice.issueDate)}<small>Vence {date(invoice.dueDate)}</small></td><td>{currency(invoice.totalAmount, invoice.currency)}</td><td>{currency(invoice.amountPaid, invoice.currency)}</td><td><strong>{currency(invoice.balanceDue, invoice.currency)}</strong></td><td><span className={`platform-chip ${tone(invoice.status)}`}>{statusText(invoice.status)}</span></td><td>{canPlatform('platform.billing.manage') && !['paid', 'void'].includes(invoice.status) ? <button className="btn btn-white small" onClick={() => setPaymentInvoice(invoice)}><CreditCard size={14} />Registrar pago</button> : null}</td></tr>)}</tbody></table></div>{!result.rows.length ? <Empty title="Sin facturas" description="No hay registros con los filtros seleccionados." /> : null}<div className="pagination-row"><button className="btn btn-white" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Anterior</button><span>Página {page}</span><button className="btn btn-white" disabled={page * result.pageSize >= result.total} onClick={() => setPage((value) => value + 1)}>Siguiente</button></div></section>
    <section className="platform-commercial-grid"><article className="card platform-panel"><header><div><h2>Pagos recientes</h2><p>Registros manuales y confirmaciones.</p></div><Banknote /></header><div className="commercial-list compact">{result.payments.length ? result.payments.map((payment) => <div className="commercial-static-row" key={payment.id}><span><strong>{payment.paymentNumber}</strong><small>{payment.organizationName} · {payment.method}</small></span><span><b>{currency(payment.amount)}</b><small>{statusText(payment.status)} · {date(payment.paidAt)}</small></span></div>) : <Empty title="Sin pagos" description="Aún no se han registrado recaudos." />}</div></article><article className="card platform-panel"><header><div><h2>Cuentas de facturación</h2><p>Estado de los datos legales y de cobro.</p></div><Building2 /></header><div className="commercial-list compact">{result.accounts.map((account) => <Link to={`/superadmin/organizations/${account.organizationId}`} key={account.id}><span><strong>{account.legalName}</strong><small>{account.taxId || 'NIT pendiente'} · {account.billingEmail || 'Correo pendiente'}</small></span><span className={`platform-chip ${tone(account.status)}`}>{statusText(account.status)}</span><ChevronRight /></Link>)}</div></article></section>
    {invoiceOpen && organizations.data && catalog.data ? <InvoiceModal organizations={organizations.data.rows} plans={catalog.data.plans} addons={catalog.data.addons} close={() => setInvoiceOpen(false)} saved={() => { setInvoiceOpen(false); reload(); }} /> : null}
    {paymentInvoice ? <PaymentModal invoice={paymentInvoice} close={() => setPaymentInvoice(null)} saved={() => { setPaymentInvoice(null); reload(); }} /> : null}
  </div>;
}

function InvoiceModal({ organizations, plans, addons, close, saved }: { organizations: PlatformOrganizationSummary[]; plans: CommercialPlan[]; addons: CommercialAddon[]; close: () => void; saved: () => void }) {
  const [organizationId, setOrganization] = useState(organizations[0]?.id || '');
  const [planId, setPlan] = useState(plans[0]?.id || '');
  const [interval, setInterval] = useState('monthly');
  const [coupon, setCoupon] = useState('');
  const [tax, setTax] = useState(0);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedAddons, setSelectedAddons] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError('');
    try { await platformService.createInvoice({ organizationId, planId, billingInterval: interval, addons: Object.entries(selectedAddons).filter(([, quantity]) => quantity > 0).map(([addonId, quantity]) => ({ addonId, quantity })), couponCode: coupon, taxPercent: tax, dueDate, notes, issueNow: true }); saved(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible crear la factura.'); }
    finally { setSaving(false); }
  }
  return <div className="platform-modal-backdrop"><form className="card platform-modal commercial-modal-wide" onSubmit={submit}><header><div><span className="eyebrow">Nueva factura manual</span><h2>Emitir factura</h2><p>La factura y sus líneas quedarán auditadas.</p></div><button type="button" onClick={close}><X /></button></header><div className="platform-form-grid"><label>Organización<select value={organizationId} onChange={(event) => setOrganization(event.target.value)}>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label><label>Plan<select value={planId} onChange={(event) => setPlan(event.target.value)}>{plans.filter((plan) => plan.isActive).map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label><label>Ciclo<select value={interval} onChange={(event) => setInterval(event.target.value)}><option value="monthly">Mensual</option><option value="yearly">Anual</option></select></label><label>Cupón<input value={coupon} onChange={(event) => setCoupon(event.target.value.toUpperCase())} placeholder="Opcional" /></label><label>Impuesto %<input type="number" min="0" max="100" step="0.01" value={tax} onChange={(event) => setTax(Number(event.target.value))} /></label><label>Vencimiento<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label></div><section className="commercial-addon-selector"><strong>Complementos</strong>{addons.filter((addon) => addon.isActive).map((addon) => <label key={addon.id}><span><b>{addon.name}</b><small>{currency(interval === 'yearly' ? addon.annualPriceCop : addon.monthlyPriceCop)} / {addon.unitName}</small></span><input type="number" min="0" max={addon.maxQuantity || undefined} value={selectedAddons[addon.id] || 0} onChange={(event) => setSelectedAddons((current) => ({ ...current, [addon.id]: Number(event.target.value) }))} /></label>)}</section><label>Notas<textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>{error ? <div className="alert danger">{error}</div> : null}<footer><button type="button" className="btn btn-white" onClick={close}>Cancelar</button><button className="btn btn-primary" disabled={saving || !organizationId || !planId}>{saving ? 'Emitiendo...' : 'Emitir factura'}</button></footer></form></div>;
}

function PaymentModal({ invoice, close, saved }: { invoice: BillingInvoice; close: () => void; saved: () => void }) {
  const [amount, setAmount] = useState(invoice.balanceDue);
  const [method, setMethod] = useState('bank_transfer');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setError(''); try { await platformService.registerPayment({ invoiceId: invoice.id, amount, method, reference, notes, confirm: true }); saved(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible registrar el pago.'); } finally { setSaving(false); } }
  return <div className="platform-modal-backdrop"><form className="card platform-modal" onSubmit={submit}><header><div><span className="eyebrow">Registrar pago</span><h2>{invoice.invoiceNumber}</h2><p>{invoice.organizationName} · Saldo {currency(invoice.balanceDue, invoice.currency)}</p></div><button type="button" onClick={close}><X /></button></header><div className="platform-form-grid"><label>Valor<input type="number" min="1" max={invoice.balanceDue} value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></label><label>Método<select value={method} onChange={(event) => setMethod(event.target.value)}><option value="bank_transfer">Transferencia</option><option value="cash">Efectivo</option><option value="card">Tarjeta</option><option value="external">Proveedor externo</option><option value="other">Otro</option></select></label><label>Referencia<input value={reference} onChange={(event) => setReference(event.target.value)} /></label></div><label>Notas<textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>{error ? <div className="alert danger">{error}</div> : null}<footer><button type="button" className="btn btn-white" onClick={close}>Cancelar</button><button className="btn btn-primary" disabled={saving || amount <= 0}>{saving ? 'Registrando...' : 'Confirmar pago'}</button></footer></form></div>;
}

export function PlatformOnboardingPage() {
  const { canPlatform } = usePlatformAccess();
  const [status, setStatus] = useState('');
  const { data, error, loading, reload } = useLoad<OnboardingRecord[]>(() => platformService.listOnboarding(status), [status]);
  const catalog = useLoad(() => platformService.getCommercialCatalog(false));
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [editing, setEditing] = useState<OnboardingRecord | null>(null);
  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorCard message={error} retry={reload} />;
  const rows = data || [];
  return <div className="platform-page"><Head title="Onboarding y aprovisionamiento" description="Creación de organizaciones, invitación del administrador y lista de preparación para salida a producción." actions={<><select className="field" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos</option><option value="not_started">Sin iniciar</option><option value="in_progress">En progreso</option><option value="blocked">Bloqueado</option><option value="completed">Completado</option></select><button className="btn btn-white" onClick={reload}><RefreshCw size={16} /></button>{canPlatform('platform.onboarding.manage') ? <button className="btn btn-primary" onClick={() => setProvisionOpen(true)}><PackagePlus size={16} />Nueva organización</button> : null}</>} /><section className="commercial-onboarding-grid">{rows.map((row) => <article className="card onboarding-card" key={row.id}><header><div><span className={`platform-chip ${tone(row.status)}`}>{statusText(row.status)}</span><h2>{row.organizationName}</h2><p>{row.planName || 'Sin plan'} · {row.adminEmail || 'Administrador pendiente'}</p></div><strong>{row.progress}%</strong></header><div className="platform-progress"><i style={{ width: `${row.progress}%` }} /></div><div className="onboarding-checks">{Object.entries(row.checklist).map(([key, checked]) => <span className={checked ? 'done' : ''} key={key}>{checked ? <Check size={13} /> : <span />} {onboardingLabel(key)}</span>)}</div>{row.blockingReason ? <div className="alert danger">{row.blockingReason}</div> : null}<footer><span>Actualizado {date(row.updatedAt, true)}</span>{canPlatform('platform.onboarding.manage') ? <button className="btn btn-white small" onClick={() => setEditing(row)}><Pencil size={14} />Actualizar</button> : null}</footer></article>)}</section>{!rows.length ? <section className="card"><Empty title="Sin registros" description="No hay organizaciones en el estado seleccionado." /></section> : null}{provisionOpen && catalog.data ? <ProvisionModal plans={catalog.data.plans} close={() => setProvisionOpen(false)} saved={() => { setProvisionOpen(false); reload(); }} /> : null}{editing ? <OnboardingModal record={editing} close={() => setEditing(null)} saved={() => { setEditing(null); reload(); }} /> : null}</div>;
}

function onboardingLabel(key: string): string { return ({ organization: 'Organización', billing: 'Facturación', branding: 'Marca', adminInvitation: 'Administrador', catalogs: 'Catálogos', security: 'Seguridad', goLive: 'Salida a producción' } as Record<string, string>)[key] || key; }

function ProvisionModal({ plans, close, saved }: { plans: CommercialPlan[]; close: () => void; saved: () => void }) {
  const [name, setName] = useState(''); const [slug, setSlug] = useState(''); const [email, setEmail] = useState(''); const [planId, setPlan] = useState(plans[0]?.id || ''); const [interval, setInterval] = useState('monthly'); const [trialDays, setTrialDays] = useState<number | ''>(''); const [reason, setReason] = useState('Nueva organización comercial'); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  function updateName(value: string) { setName(value); if (!slug) setSlug(value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')); }
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setError(''); try { await platformService.provisionOrganization({ name, slug, adminEmail: email, planId, billingInterval: interval, trialDays: trialDays === '' ? null : trialDays, reason }); saved(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible crear la organización.'); } finally { setSaving(false); } }
  return <div className="platform-modal-backdrop"><form className="card platform-modal" onSubmit={submit}><header><div><span className="eyebrow">Aprovisionamiento SaaS</span><h2>Nueva organización</h2><p>Se crearán suscripción, branding, catálogos base, cuenta de facturación e invitación.</p></div><button type="button" onClick={close}><X /></button></header><div className="platform-form-grid"><label>Nombre<input value={name} onChange={(event) => updateName(event.target.value)} required /></label><label>Slug<input value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase())} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></label><label>Correo administrador<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Plan<select value={planId} onChange={(event) => setPlan(event.target.value)}>{plans.filter((plan) => plan.isActive).map((plan) => <option value={plan.id} key={plan.id}>{plan.name}</option>)}</select></label><label>Ciclo<select value={interval} onChange={(event) => setInterval(event.target.value)}><option value="monthly">Mensual</option><option value="yearly">Anual</option></select></label><label>Prueba personalizada<input type="number" min="0" max="365" value={trialDays} placeholder="Usar la del plan" onChange={(event) => setTrialDays(event.target.value === '' ? '' : Number(event.target.value))} /></label></div><label>Justificación<input value={reason} onChange={(event) => setReason(event.target.value)} /></label>{error ? <div className="alert danger">{error}</div> : null}<footer><button className="btn btn-white" type="button" onClick={close}>Cancelar</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Creando...' : 'Crear organización'}</button></footer></form></div>;
}

function OnboardingModal({ record, close, saved }: { record: OnboardingRecord; close: () => void; saved: () => void }) {
  const [status, setStatus] = useState(record.status); const [step, setStep] = useState(record.currentStep); const [checklist, setChecklist] = useState(record.checklist); const [notes, setNotes] = useState(record.notes || ''); const [blocking, setBlocking] = useState(record.blockingReason || ''); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setError(''); try { await platformService.updateOnboarding({ organizationId: record.organizationId, status, currentStep: step, checklist, notes, blockingReason: blocking }); saved(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible actualizar el onboarding.'); } finally { setSaving(false); } }
  return <div className="platform-modal-backdrop"><form className="card platform-modal" onSubmit={submit}><header><div><span className="eyebrow">Onboarding</span><h2>{record.organizationName}</h2></div><button type="button" onClick={close}><X /></button></header><div className="platform-form-grid"><label>Estado<select value={status} onChange={(event) => setStatus(event.target.value as OnboardingRecord['status'])}><option value="not_started">Sin iniciar</option><option value="in_progress">En progreso</option><option value="blocked">Bloqueado</option><option value="completed">Completado</option><option value="cancelled">Cancelado</option></select></label><label>Paso actual<select value={step} onChange={(event) => setStep(event.target.value)}>{Object.keys(checklist).map((key) => <option key={key} value={key}>{onboardingLabel(key)}</option>)}</select></label></div><div className="onboarding-editor">{Object.entries(checklist).map(([key, checked]) => <label className="commercial-check" key={key}><input type="checkbox" checked={checked} onChange={(event) => setChecklist((current) => ({ ...current, [key]: event.target.checked }))} /><span>{onboardingLabel(key)}</span></label>)}</div>{status === 'blocked' ? <label>Bloqueo<textarea rows={2} value={blocking} onChange={(event) => setBlocking(event.target.value)} /></label> : null}<label>Notas<textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>{error ? <div className="alert danger">{error}</div> : null}<footer><button type="button" className="btn btn-white" onClick={close}>Cancelar</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Actualizar'}</button></footer></form></div>;
}

export function OrganizationBillingPortalPage() {
  const { data, error, loading, reload } = useLoad<OrganizationSubscriptionPortal>(() => platformService.getOrganizationSubscriptionPortal());
  const [request, setRequest] = useState<'plan_change' | 'cancel' | 'reactivate' | 'billing_update' | null>(null);
  if (loading && !data) return <main className="page"><Loading /></main>;
  if (error && !data) return <main className="page"><ErrorCard message={error} retry={reload} /></main>;
  const portal = data!;
  const subscription = portal.subscription;
  return <div className="page"><header className="page-head"><div><span className="eyebrow">Orkesta · Autoservicio SaaS</span><h1>Suscripción y facturación</h1><p>Consulta la vigencia, el consumo contratado, facturas y solicitudes de tu organización.</p></div>{portal.canManage ? <div className="page-actions"><button className="btn btn-white" onClick={() => setRequest('billing_update')}><Settings2 size={16} />Datos de cobro</button><button className="btn btn-primary" onClick={() => setRequest('plan_change')}><TrendingUp size={16} />Cambiar plan</button></div> : null}</header><section className="subscription-hero card"><div><span className={`platform-chip ${tone(subscription.status)}`}>{statusText(subscription.status)}</span><h2>{subscription.planName}</h2><p>{portal.organization.name} · Ciclo {subscription.billingInterval === 'yearly' ? 'anual' : 'mensual'}</p></div><div><span>Vigencia actual</span><strong>{date(subscription.currentPeriodEnd)}</strong><small>{subscription.cancelAtPeriodEnd ? 'Cancelación programada' : subscription.autoRenew ? 'Renovación habilitada' : 'Renovación manual'}</small></div></section>{subscription.nextPlanName ? <div className="alert info"><CalendarClock size={18} /> Cambio programado a <strong>{subscription.nextPlanName}</strong> el {date(subscription.nextChangeAt)}.</div> : null}<section className="grid-2 subscription-grid"><article className="card block-card"><header className="card-title"><div><h2>Plan contratado</h2><p>Límites y funcionalidades vigentes.</p></div><ShieldCheck /></header><div className="commercial-json-grid"><div><strong>Límites</strong><pre className="platform-json">{JSON.stringify(subscription.limits, null, 2)}</pre></div><div><strong>Funciones</strong><pre className="platform-json">{JSON.stringify(subscription.features, null, 2)}</pre></div></div>{portal.canManage ? <div className="card-inline-actions">{subscription.cancelAtPeriodEnd ? <button className="btn btn-primary" onClick={() => setRequest('reactivate')}>Conservar suscripción</button> : <button className="btn btn-white" onClick={() => setRequest('cancel')}>Solicitar cancelación</button>}</div> : null}</article><article className="card block-card"><header className="card-title"><div><h2>Datos de facturación</h2><p>Información usada para emitir documentos de cobro.</p></div><Building2 /></header><dl className="commercial-definition">{Object.entries(portal.billingAccount).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value || '—')}</dd></div>)}</dl></article></section><section className="card table-card"><header className="card-title"><div><h2>Facturas</h2><p>Historial comercial de la organización.</p></div><Receipt /></header><div className="platform-table-scroll"><table><thead><tr><th>Factura</th><th>Emisión</th><th>Vencimiento</th><th>Total</th><th>Saldo</th><th>Estado</th></tr></thead><tbody>{portal.invoices.map((invoice) => <tr key={invoice.id}><td><strong>{invoice.invoiceNumber}</strong></td><td>{date(invoice.issueDate)}</td><td>{date(invoice.dueDate)}</td><td>{currency(invoice.totalAmount, invoice.currency)}</td><td>{currency(invoice.balanceDue, invoice.currency)}</td><td><span className={`platform-chip ${tone(invoice.status)}`}>{statusText(invoice.status)}</span></td></tr>)}</tbody></table></div>{!portal.invoices.length ? <Empty title="Sin facturas" description="No hay facturas emitidas para la organización." /> : null}</section><section className="card table-card"><header className="card-title"><div><h2>Solicitudes comerciales</h2><p>Seguimiento a solicitudes enviadas al Super Admin.</p></div><TicketCheck /></header><div className="platform-table-scroll"><table><thead><tr><th>Tipo</th><th>Razón</th><th>Fecha</th><th>Estado</th><th>Respuesta</th></tr></thead><tbody>{portal.requests.map((item) => <tr key={item.id}><td>{requestTypeLabel(item.requestType)}</td><td>{item.reason}</td><td>{date(item.requestedAt, true)}</td><td><span className={`platform-chip ${tone(item.status)}`}>{statusText(item.status)}</span></td><td>{item.reviewNotes || '—'}</td></tr>)}</tbody></table></div></section>{request ? <OrganizationRequestModal kind={request} portal={portal} close={() => setRequest(null)} saved={() => { setRequest(null); reload(); }} /> : null}</div>;
}

function OrganizationRequestModal({ kind, portal, close, saved }: { kind: 'plan_change' | 'cancel' | 'reactivate' | 'billing_update'; portal: OrganizationSubscriptionPortal; close: () => void; saved: () => void }) {
  const [planId, setPlan] = useState(portal.subscription.planId); const [interval, setInterval] = useState(portal.subscription.billingInterval); const [reason, setReason] = useState(''); const [legalName, setLegalName] = useState(String(portal.billingAccount.legalName || portal.organization.name)); const [taxId, setTaxId] = useState(String(portal.billingAccount.taxId || '')); const [billingEmail, setBillingEmail] = useState(String(portal.billingAccount.billingEmail || '')); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const title = kind === 'plan_change' ? 'Solicitar cambio de plan' : kind === 'cancel' ? 'Solicitar cancelación' : kind === 'reactivate' ? 'Conservar suscripción' : 'Actualizar datos de facturación';
  async function submit(event: FormEvent) { event.preventDefault(); if (reason.trim().length < 5) return setError('Escribe una razón de mínimo 5 caracteres.'); const payload = kind === 'plan_change' ? { planId, billingInterval: interval, effectiveMode: 'period_end' } : kind === 'billing_update' ? { legalName, taxId, billingEmail } : {}; setSaving(true); setError(''); try { await platformService.requestOrganizationSubscriptionChange(kind, payload, reason.trim()); saved(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible enviar la solicitud.'); } finally { setSaving(false); } }
  return <div className="platform-modal-backdrop"><form className="card platform-modal" onSubmit={submit}><header><div><span className="eyebrow">Autoservicio</span><h2>{title}</h2><p>La solicitud será enviada al equipo de plataforma y quedará auditada.</p></div><button type="button" onClick={close}><X /></button></header>{kind === 'plan_change' ? <div className="platform-form-grid"><label>Plan<select value={planId} onChange={(event) => setPlan(event.target.value)}>{portal.plans.map((plan) => <option value={plan.id} key={plan.id}>{plan.name} · {currency(interval === 'yearly' ? plan.annualPriceCop : plan.monthlyPriceCop)}</option>)}</select></label><label>Ciclo<select value={interval} onChange={(event) => setInterval(event.target.value)}><option value="monthly">Mensual</option><option value="yearly">Anual</option></select></label></div> : null}{kind === 'billing_update' ? <div className="platform-form-grid"><label>Razón social<input value={legalName} onChange={(event) => setLegalName(event.target.value)} /></label><label>NIT<input value={taxId} onChange={(event) => setTaxId(event.target.value)} /></label><label>Correo de facturación<input type="email" value={billingEmail} onChange={(event) => setBillingEmail(event.target.value)} /></label></div> : null}<label>Razón y observaciones<textarea rows={4} value={reason} onChange={(event) => setReason(event.target.value)} /></label>{error ? <div className="alert danger">{error}</div> : null}<footer><button type="button" className="btn btn-white" onClick={close}>Cancelar</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Enviando...' : 'Enviar solicitud'}</button></footer></form></div>;
}
