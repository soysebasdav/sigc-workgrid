import { useEffect, useMemo, useState, type CSSProperties, type DragEvent, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, NavLink, Outlet, useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import {
  Archive,
  BarChart3,
  Bookmark,
  CalendarCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  Download,
  Edit3,
  Eye,
  File,
  FileSpreadsheet,
  FileText,
  Filter,
  LogOut,
  MailCheck,
  Menu,
  MessageCircle,
  MessageSquarePlus,
  Move,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  Trash2,
  UserCog,
  UserPlus,
  X,
  Zap
} from 'lucide-react';
import { useApp } from '../../app/AppProvider';
import { useAuthorization } from '../authz/AuthorizationProvider';
import { CASE_READ_PERMISSIONS, PERMISSIONS } from '../authz/permissions';
import type { SigcCase, SigcCaseFilters, SigcDocument, SigcSubtask, SigcCaseReview, WorkflowBoardCard, WorkflowBoardSnapshot } from './domain/types';
import { AssignCaseModal, ChangeCaseStateModal, ManualCaseForm, PublicCaseForm } from './components/Phase2Forms';
import { canEditDocumentInline, CommentModal, DocumentUploadModal, DocumentVersionModal, SubtaskFormModal, TextDocumentEditorModal } from './components/Phase3Forms';
import { DeliveryModal, ManualReminderModal, ReviewDecisionModal, SlaOverrideModal, SubmitReviewModal } from './components/Phase4Forms';
import { OrganizationSwitcher, WorkspaceBrand, useSaasTheme } from './components/Phase8Theme';
import { useCaseAssignments, useCaseComments, useCaseDeliveries, useCaseReminders, useCaseReviews, useCaseSlaOverrides, useCaseTimeline, useSigcCase, useSigcCaseSearch, useSigcCases, useSigcCatalogs, useSigcDocuments, useSigcMembers, useSigcSubtasks, useSigcDashboard, usePublicIntakeContext, useWorkflowBoard } from './hooks/useSigcData';
import { sigcService } from './services/sigcService';
import {
  adminModules,
  areaTones,
  navItems,
  priorityTones,
  stateTones
} from './ui';

type ToastState = {
  visible: boolean;
  text: string;
};

export function SigcShell() {
  const { currentUser, logout, resetDemoData, isLoading, dataMode } = useApp();
  const { can, canAny, roleName } = useAuthorization();
  const canReadCases = canAny(CASE_READ_PERMISSIONS);
  const [drawerCase, setDrawerCase] = useState<SigcCase | null>(null);
  const [toast, setToast] = useState<ToastState>({ visible: false, text: 'Acción registrada correctamente.' });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [topSearch, setTopSearch] = useState('');
  const navigate = useNavigate();
  const { context: saasContext, style: saasStyle } = useSaasTheme();
  const { data: sigcCases, source: sigcSource, warning: sigcWarning } = useSigcCases(canReadCases);

  if (!currentUser) {
    if (isLoading) {
      return (
        <main className="login-workgrid">
          <section className="login-card card">
            <div className="brand-mark large">S</div>
            <h2>Conectando SIGC</h2>
            <p className="muted">{dataMode === 'supabase' ? 'Validando sesión con Supabase...' : 'Cargando datos locales...'}</p>
          </section>
        </main>
      );
    }
    return <Navigate to="/login" replace />;
  }

  function showToast(text: string) {
    setToast({ visible: true, text });
    window.setTimeout(() => setToast((current) => ({ ...current, visible: false })), 2600);
  }

  function closeAll() {
    setDrawerCase(null);
    setMobileOpen(false);
  }

  const context = {
    openDrawer: (id: string) => setDrawerCase(sigcCases.find((item) => item.id === id || item.radicado === id) ?? sigcCases[0] ?? null),
    showToast
  };

  return (
    <div className="sigc-app" style={saasStyle}>
      <div className={`sigc-overlay ${drawerCase || mobileOpen ? 'open' : ''}`} onClick={closeAll} />
      <aside className={`sigc-sidebar ${mobileOpen ? 'open' : ''}`}>
        <SidebarContent closeMobile={() => setMobileOpen(false)} />
      </aside>

      <header className="sigc-topbar glass">
        <button className="btn btn-white mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Abrir menú">
          <Menu size={18} />
        </button>
        <OrganizationSwitcher />
        {canReadCases ? <>
          <div className="search-box">
            <Search size={18} />
            <input
              placeholder="Buscar en casos, comentarios, subtareas y documentos..."
              value={topSearch}
              onChange={(event) => setTopSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') navigate(`/cases${topSearch.trim() ? `?q=${encodeURIComponent(topSearch.trim())}` : ''}`);
              }}
            />
          </div>
          <button className="btn btn-white topbar-secondary" onClick={() => context.openDrawer(sigcCases.find((item) => item.priority === 'Crítica')?.id ?? sigcCases[0]?.id ?? '')}>
            <Zap size={17} /> Vista rápida
          </button>
        </> : <div className="search-box" aria-hidden="true" />}
        {can(PERMISSIONS.caseCreate) ? <Link className="btn btn-primary" to="/manual-case">
          <Plus size={17} /> Nuevo caso
        </Link> : null}
        {dataMode === 'local' ? <button className="btn btn-white topbar-secondary" onClick={resetDemoData} title="Restaurar datos demo">
          <RefreshCw size={17} /> Demo
        </button> : null}
        <button className="btn btn-white topbar-secondary" onClick={logout} title="Cerrar sesión">
          <LogOut size={17} /> Salir
        </button>
        <div className="topbar-user">
          <div>
            <strong>{currentUser.name}</strong>
            <span title={sigcWarning ?? undefined}>{roleName} · {saasContext?.activeOrganization.name ?? (sigcSource === 'supabase' ? 'Datos reales' : 'Demo')}</span>
          </div>
          <div className="avatar">{initials(currentUser.name)}</div>
        </div>
      </header>

      <main className="sigc-main">
        <Outlet context={context} />
      </main>

      {drawerCase ? <CaseDrawer item={drawerCase} onClose={closeAll} /> : null}
      <Toast visible={toast.visible} text={toast.text} />
    </div>
  );
}

export function SigcLoginPage() {
  const { currentUser, login, isLoading, dataMode } = useApp();
  const navigate = useNavigate();
  const [loginParams] = useSearchParams();
  const [email, setEmail] = useState('admin@test.com');
  const [password, setPassword] = useState('Admin123*');
  const [error, setError] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);

  if (currentUser) return <Navigate to={loginParams.get('redirect') || '/dashboard'} replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const ok = await login(email, password);
      if (!ok) {
        setError(dataMode === 'supabase' ? 'Correo o contraseña inválidos en Supabase Auth.' : 'Correo o contraseña inválidos. Usa las credenciales demo.');
        return;
      }
      navigate(loginParams.get('redirect') || '/dashboard');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-workgrid">
      <section className="login-panel hero-gradient">
        <div className="chip chip-light">SIGC · WorkGrid Color</div>
        <h1>Sistema Integral de Gestión de Casos</h1>
        <p>
          Una interfaz SaaS empresarial para convertir solicitudes, contratos, reclamos, tutelas y procesos internos en casos con SLA, responsables,
          documentos y trazabilidad completa.
        </p>
        <div className="login-benefits">
          <span><ShieldCheck size={18} /> Control SLA</span>
          <span><CalendarCheck size={18} /> Cronograma visual</span>
          <span><CheckCircle2 size={18} /> Trazabilidad auditable</span>
        </div>
      </section>
      <section className="login-card card">
        <div className="brand-mark large">S</div>
        <h2>Iniciar sesión</h2>
        <p className="muted">{dataMode === 'supabase' ? 'Conectado a Supabase Auth y tablas PostgreSQL.' : 'Datos demo precargados en localStorage. El objetivo actual es validar la experiencia visual.'}</p>
        <form onSubmit={handleSubmit} className="form-stack">
          <label className="field-label">
            Correo
            <input className="field" value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
          </label>
          <label className="field-label">
            Contraseña
            <input className="field" value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
          </label>
          {error ? <div className="alert danger">{error}</div> : null}
          <button className="btn btn-primary full" type="submit" disabled={isSubmitting || isLoading}>{isSubmitting || isLoading ? 'Validando...' : 'Entrar al SIGC'}</button>
        </form>
        <div className="demo-credentials">
          <strong>{dataMode === 'supabase' ? 'Credenciales Supabase' : 'Credenciales demo'}</strong>
          <span>admin@test.com / Admin123*</span>
          <span>user@test.com / User123*</span>
        </div>
      </section>
    </main>
  );
}

export function CasesPage() {
  const { showToast } = useSigcActions();
  const { can } = useAuthorization();
  const [searchParams] = useSearchParams();
  const { data: catalogs } = useSigcCatalogs();
  const { data: members } = useSigcMembers();
  const [filters, setFilters] = useState<SigcCaseFilters>({
    query: searchParams.get('q') ?? '',
    page: 1,
    pageSize: 10
  });

  useEffect(() => {
    const query = searchParams.get('q') ?? '';
    setFilters((current) => current.query === query ? current : { ...current, query, page: 1 });
  }, [searchParams]);

  const activeFilters = useMemo(() => ({ ...filters }), [filters]);
  const { data: result, isLoading, source, warning, error } = useSigcCaseSearch(activeFilters);
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  function setFilter<K extends keyof SigcCaseFilters>(key: K, value: SigcCaseFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value, page: key === 'page' ? Number(value) : 1 }));
  }

  function clearFilters() {
    setFilters({ query: '', page: 1, pageSize: 10 });
  }

  return (
    <Page>
      <PageHead
        title="Bandeja de casos"
        description="Consulta real de casos con búsqueda, filtros, prioridad, SLA y paginación."
        actions={(
          <>
            <button className="btn btn-white" onClick={() => showToast('Las vistas guardadas se habilitarán en una fase posterior.')}><Bookmark size={17} /> Guardar vista</button>
            {can(PERMISSIONS.caseCreate) ? <Link className="btn btn-primary" to="/manual-case"><Plus size={17} /> Nuevo caso</Link> : null}
          </>
        )}
      />
      <section className="card filter-card">
        <div className="filter-grid phase2-filter-grid">
          <div className="filter-search-field"><Search size={17} /><input className="field" placeholder="Caso, solicitante, comentario, subtarea o documento" value={filters.query ?? ''} onChange={(event) => setFilter('query', event.target.value)} /></div>
          <select className="field" value={filters.stateId ?? ''} onChange={(event) => setFilter('stateId', event.target.value || undefined)}><option value="">Todos los estados</option>{catalogs?.states.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>
          <select className="field" value={filters.areaId ?? ''} onChange={(event) => setFilter('areaId', event.target.value || undefined)}><option value="">Todas las áreas</option>{catalogs?.areas.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>
          <select className="field" value={filters.ownerId ?? ''} onChange={(event) => setFilter('ownerId', event.target.value || undefined)}><option value="">Todos los responsables</option>{members.map((item) => <option value={item.userId} key={item.userId}>{item.name}</option>)}</select>
          <select className="field" value={filters.caseTypeId ?? ''} onChange={(event) => setFilter('caseTypeId', event.target.value || undefined)}><option value="">Todos los tipos</option>{catalogs?.caseTypes.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>
          <select className="field" value={filters.priorityId ?? ''} onChange={(event) => setFilter('priorityId', event.target.value || undefined)}><option value="">Todas las prioridades</option>{catalogs?.priorities.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>
          <button className={`btn ${filters.overdueOnly ? 'btn-primary' : 'btn-soft'}`} onClick={() => setFilters((current) => ({ ...current, overdueOnly: !current.overdueOnly, upcomingOnly: false, page: 1 }))}>Vencidos</button>
          <button className={`btn ${filters.upcomingOnly ? 'btn-primary' : 'btn-white'}`} onClick={() => setFilters((current) => ({ ...current, upcomingOnly: !current.upcomingOnly, overdueOnly: false, page: 1 }))}>Próximos 72 h</button>
          <button className="btn btn-white" onClick={clearFilters}>Limpiar</button>
        </div>
      </section>
      {warning ? <div className="alert danger">{warning}</div> : null}
      {error ? <div className="alert danger">{error}</div> : null}
      <div className="case-list-meta"><span>Fuente: {source === 'supabase' ? 'Supabase · dominio SIGC' : 'Repositorio demo'}{isLoading ? ' · Cargando...' : ''}</span><strong>{result.total} caso{result.total === 1 ? '' : 's'}</strong></div>
      <section className="card table-card"><CasesTable rows={result.items} /></section>
      <div className="pagination-row">
        <button className="btn btn-white" disabled={result.page <= 1 || isLoading} onClick={() => setFilter('page', result.page - 1)}>Anterior</button>
        <span>Página <strong>{result.page}</strong> de <strong>{totalPages}</strong></span>
        <button className="btn btn-white" disabled={result.page >= totalPages || isLoading} onClick={() => setFilter('page', result.page + 1)}>Siguiente</button>
      </div>
    </Page>
  );
}

export function CaseDetailPage() {
  const { caseId } = useParams();
  const { showToast } = useSigcActions();
  const { can } = useAuthorization();
  const { data: item, isLoading, source, warning, error } = useSigcCase(caseId);
  const resolvedCaseId = item?.databaseId ?? caseId;
  const { data: assignments } = useCaseAssignments(resolvedCaseId);
  const { data: caseSubtasks } = useSigcSubtasks({ caseId: resolvedCaseId });
  const { data: comments } = useCaseComments(resolvedCaseId);
  const { data: caseDocuments } = useSigcDocuments(resolvedCaseId);
  const { data: timelineEvents } = useCaseTimeline(resolvedCaseId);
  const { data: slaOverrides } = useCaseSlaOverrides(resolvedCaseId);
  const { data: reviews } = useCaseReviews(resolvedCaseId);
  const { data: deliveries } = useCaseDeliveries(resolvedCaseId);
  const { data: reminders } = useCaseReminders(resolvedCaseId);
  const { data: allCases } = useSigcCases();
  const { data: members } = useSigcMembers();
  const [detailModal, setDetailModal] = useState<'assign' | 'state' | 'comment' | 'subtask' | 'document' | 'sla' | 'reminder' | 'review' | 'delivery' | null>(null);
  const [traceTab, setTraceTab] = useState<'timeline' | 'comments'>('timeline');
  const [versionDocument, setVersionDocument] = useState<SigcDocument | null>(null);
  const [reviewDecision, setReviewDecision] = useState<{ review: SigcCaseReview; decision: 'approved' | 'returned' } | null>(null);
  const pendingReview = reviews.find((review) => review.status === 'pending') ?? null;

  async function openDocument(document: SigcDocument) {
    try {
      const url = await sigcService.getDocumentSignedUrl(document.currentStoragePath);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible abrir el documento.');
    }
  }

  if (isLoading) {
    return <Page><section className="card placeholder-card"><h2>Cargando expediente...</h2><p>Consultando {source === 'supabase' ? 'Supabase' : 'el repositorio SIGC'}.</p></section></Page>;
  }

  if (!item) {
    return <Page><section className="card placeholder-card"><h2>Caso no encontrado</h2><p>{error ?? `No existe un caso con el identificador ${caseId ?? ''}.`}</p><Link className="btn btn-primary" to="/cases">Volver a la bandeja</Link></section></Page>;
  }

  return (
    <Page>
      <PageHead
        title="Detalle del caso"
        description="Expediente colaborativo con subtareas, comentarios inmutables, documentos versionados y trazabilidad auditable."
        actions={(
          <>
            {can(PERMISSIONS.caseAssign) ? <button className="btn btn-white" onClick={() => setDetailModal('assign')}><UserPlus size={17} /> Asignar</button> : null}
            {can(PERMISSIONS.caseChangeState) ? <button className="btn btn-white" onClick={() => setDetailModal('state')}><RefreshCw size={17} /> Cambiar estado</button> : null}
            {can(PERMISSIONS.caseComment) ? <button className="btn btn-primary" onClick={() => setDetailModal('comment')}><MessageSquarePlus size={17} /> Agregar comentario</button> : null}
          </>
        )}
      />
      {warning ? <div className="alert danger">{warning}</div> : null}
      <section className="card case-hero">
        <div>
          <div className="chip-row"><Badge tone="tone-dark">{item.radicado}</Badge><Badge tone="tone-purple">{item.type}</Badge><Badge tone={stateTones[item.state]}>{item.state}</Badge><Badge tone={priorityTones[item.priority]}>{item.priority}</Badge><Badge tone="tone-slate"><SemDot color={item.sem} /> {dueStatusLabel(item)}</Badge></div>
          <h2>{item.subject}</h2>
          <p>Solicitante: <strong>{item.requester}</strong> · {item.company}{item.requesterEmail ? <> · Correo: {item.requesterEmail}</> : null}</p>
        </div>
        <div className="progress-panel">
          <div className="bar-caption"><strong>Avance general por subtareas</strong><span>{item.progress}%</span></div>
          <Progress value={item.progress} large />
          <div className="button-grid two">
            {can(PERMISSIONS.documentUpload) ? <button className="btn btn-soft" onClick={() => setDetailModal('document')}><Upload size={17} /> Cargar doc.</button> : null}
            {can(PERMISSIONS.caseOverrideSla) ? <button className="btn btn-white" onClick={() => setDetailModal('sla')}><TimerResetIcon /> Modificar SLA</button> : null}
            {can(PERMISSIONS.caseSendReminder) ? <button className="btn btn-white" onClick={() => setDetailModal('reminder')}><MailCheck size={17} /> Recordatorio</button> : null}
            {item.state === 'Respuesta Elaborada' && can(PERMISSIONS.caseReview) ? <button className="btn btn-primary" onClick={() => setDetailModal('review')}><CheckCircle2 size={17} /> Enviar a revisión</button> : null}
            {item.state === 'Aprobado' && can(PERMISSIONS.caseRegisterDelivery) ? <button className="btn btn-primary" onClick={() => setDetailModal('delivery')}><MailCheck size={17} /> Registrar envío</button> : null}
          </div>
        </div>
      </section>
      <section className="detail-grid">
        <div className="detail-main">
          <CardBlock title="Trazabilidad" description="Línea de tiempo permanente generada por las acciones reales del expediente." icon={<RefreshCw />}>
            <div className="tabs"><button className={traceTab === 'timeline' ? 'active' : ''} onClick={() => setTraceTab('timeline')}>Actividad ({timelineEvents.length})</button><button className={traceTab === 'comments' ? 'active' : ''} onClick={() => setTraceTab('comments')}>Comentarios ({comments.length})</button></div>
            {traceTab === 'timeline' ? (
              <div className="timeline">
                {timelineEvents.length ? timelineEvents.map((event) => (
                  <article className="timeline-item" key={event.id}>
                    <span className="timeline-dot" />
                    <div><div className="timeline-title"><strong>{event.title}</strong><div className="kpi-icon small"><ActivityIcon eventType={event.eventType} /></div></div><p>{event.description}</p><small>{event.actorName} · {event.date}</small></div>
                  </article>
                )) : <div className="empty-inline">Aún no hay eventos registrados en la trazabilidad.</div>}
              </div>
            ) : (
              <div className="comments-list">
                {comments.length ? comments.map((comment) => (
                  <article className="comment-card" key={comment.id}>
                    <div className="avatar small-avatar">{initials(comment.userName)}</div>
                    <div><header><strong>{comment.userName}</strong><span>{comment.createdLabel}</span></header><p>{comment.content}</p>{comment.attachmentCount ? <small><Paperclip size={13} /> {comment.attachmentCount} adjunto{comment.attachmentCount === 1 ? '' : 's'}</small> : null}</div>
                  </article>
                )) : <div className="empty-inline">Todavía no hay comentarios en este caso.</div>}
              </div>
            )}
          </CardBlock>
          <CardBlock title="Asignaciones del caso" description="Un mismo caso puede pertenecer simultáneamente a varias áreas y responsables." icon={<UserCog />}>
            {assignments.length ? assignments.map((assignment) => (
              <div className="assignment-summary" key={assignment.id}>
                <div><strong>{assignment.areaName}</strong><small>{assignment.responsibleName} · límite {assignment.due}</small></div>
                <div className="chip-row">{assignment.isPrimary ? <Badge tone="tone-dark">Principal</Badge> : null}<Badge tone="tone-slate">{assignment.state}</Badge></div>
              </div>
            )) : <div className="empty-inline">Este caso aún no tiene asignaciones.</div>}
          </CardBlock>
          <section className="grid-2 phase4-grid">
            <CardBlock title="SLA y recordatorios" description="Control de vencimiento, excepciones justificadas y alertas automáticas." icon={<TimerResetIcon />}>
              <div className="phase4-sla-summary">
                <div><span>Política</span><strong>{item.sla}</strong></div>
                <div><span>Fecha límite vigente</span><strong>{item.due}</strong></div>
                <div><span>Semáforo</span><strong><SemDot color={item.sem} /> {dueStatusLabel(item)}</strong></div>
              </div>
              <div className="card-inline-actions">{can(PERMISSIONS.caseOverrideSla) ? <button className="btn btn-white small" onClick={() => setDetailModal('sla')}><TimerResetIcon /> Modificar fecha</button> : null}{can(PERMISSIONS.caseSendReminder) ? <button className="btn btn-soft small" onClick={() => setDetailModal('reminder')}><MailCheck size={15} /> Recordar</button> : null}</div>
              <div className="phase4-history-list">
                {slaOverrides.slice(0, 3).map((entry) => <div className="phase4-history-row" key={entry.id}><div><strong>Nueva fecha: {new Date(entry.newDueAt).toLocaleString('es-CO')}</strong><span>{entry.justification}</span></div><small>{entry.changedByName} · {entry.changedLabel}</small></div>)}
                {!slaOverrides.length ? <div className="empty-inline">No hay modificaciones excepcionales del SLA.</div> : null}
              </div>
              <div className="phase4-history-list compact-list">
                {reminders.slice(0, 4).map((entry) => <div className="phase4-history-row" key={entry.id}><div><strong>{entry.reminderType === 'automatic' ? entry.ruleName ?? 'Recordatorio automático' : 'Recordatorio manual'}</strong><span>{entry.message}</span></div><small>{entry.recipientName} · {entry.deliveredLabel}</small></div>)}
                {!reminders.length ? <div className="empty-inline">Aún no hay recordatorios registrados.</div> : null}
              </div>
            </CardBlock>
            <CardBlock title="Revisión, aprobación y envío" description="Flujo formal de revisión antes de remitir la respuesta." icon={<CheckCircle2 />}>
              {item.state === 'Respuesta Elaborada' && can(PERMISSIONS.caseReview) ? <div className="phase4-callout"><strong>Respuesta lista para revisión</strong><span>Selecciona un aprobador o envíala a la cola general de revisión.</span><button className="btn btn-primary small" onClick={() => setDetailModal('review')}>Enviar a revisión</button></div> : null}
              {pendingReview ? <div className="phase4-callout review-pending"><strong>Revisión #{pendingReview.reviewRound} pendiente</strong><span>Revisor: {pendingReview.reviewerName}</span>{pendingReview.requestNote ? <p>{pendingReview.requestNote}</p> : null}{can(PERMISSIONS.caseApprove) ? <div className="button-grid two"><button className="btn btn-primary small" onClick={() => setReviewDecision({ review: pendingReview, decision: 'approved' })}>Aprobar</button><button className="btn btn-white small" onClick={() => setReviewDecision({ review: pendingReview, decision: 'returned' })}>Devolver</button></div> : null}</div> : null}
              {item.state === 'Aprobado' && can(PERMISSIONS.caseRegisterDelivery) ? <div className="phase4-callout"><strong>Respuesta aprobada</strong><span>Registra el canal y destinatario para pasar el caso a Enviado.</span><button className="btn btn-primary small" onClick={() => setDetailModal('delivery')}>Registrar envío</button></div> : null}
              <div className="phase4-history-list">
                {reviews.slice(0, 4).map((review) => <div className="phase4-history-row" key={review.id}><div><strong>Revisión #{review.reviewRound} · {review.status === 'pending' ? 'Pendiente' : review.status === 'approved' ? 'Aprobada' : review.status === 'returned' ? 'Devuelta' : 'Cancelada'}</strong><span>{review.reviewerName}{review.decisionComments ? ` · ${review.decisionComments}` : ''}</span></div><small>{review.requestedLabel}</small></div>)}
                {deliveries.slice(0, 3).map((delivery) => <div className="phase4-history-row" key={delivery.id}><div><strong>Envío · {delivery.channel}</strong><span>{delivery.recipient}{delivery.reference ? ` · Ref. ${delivery.reference}` : ''}</span></div><small>{delivery.deliveredByName} · {delivery.deliveredLabel}</small></div>)}
                {!reviews.length && !deliveries.length ? <div className="empty-inline">El flujo de aprobación aún no registra actuaciones.</div> : null}
              </div>
            </CardBlock>
          </section>
          <section className="grid-2">
            <CardBlock title="Subtareas del caso" description={`${caseSubtasks.length} actividad${caseSubtasks.length === 1 ? '' : 'es'} vinculadas al expediente.`} icon={<CalendarCheck />}>
              {can(PERMISSIONS.caseManageSubtasks) ? <div className="card-inline-actions"><button className="btn btn-soft small" onClick={() => setDetailModal('subtask')}><Plus size={15} /> Nueva subtarea</button></div> : null}
              {caseSubtasks.length ? caseSubtasks.slice(0, 6).map((task) => <SubtaskMini task={task} key={task.id} />) : <div className="empty-inline">No hay subtareas creadas.</div>}
            </CardBlock>
            <CardBlock title="Documentos adjuntos" description={`${caseDocuments.length} documento${caseDocuments.length === 1 ? '' : 's'} con versiones preservadas.`} icon={<Paperclip />}>
              {can(PERMISSIONS.documentUpload) ? <div className="card-inline-actions"><button className="btn btn-soft small" onClick={() => setDetailModal('document')}><Upload size={15} /> Cargar</button></div> : null}
              {caseDocuments.length ? caseDocuments.slice(0, 6).map((doc) => <div className="doc-mini" key={doc.id}><div><strong>{doc.name}</strong><small>{doc.category} · v{doc.currentVersion} · {doc.ownerName}</small></div><div className="doc-mini-actions"><Badge tone={stateTones[doc.state] ?? 'tone-blue'}>{doc.state}</Badge><button className="btn btn-white icon-only small" onClick={() => void openDocument(doc)} title="Ver"><Eye size={14} /></button>{can(PERMISSIONS.documentUpload) ? <button className="btn btn-soft icon-only small" onClick={() => setVersionDocument(doc)} title="Nueva versión"><Upload size={14} /></button> : null}</div></div>) : <div className="empty-inline">No hay documentos cargados.</div>}
            </CardBlock>
          </section>
        </div>
        <aside className="detail-side">
          <CardBlock title="Datos de clasificación" icon={<FileText />}>
            <dl className="definition-list">
              {[
                ['Tipo de caso', item.type], ['Área principal', item.area], ['Responsable principal', item.owner], ['SLA', item.sla], ['Fecha límite', item.due], ['Nivel de riesgo', item.risk], ['Origen', item.source], ['Documento', item.requesterDocument ?? 'No registrado'], ['Teléfono', item.requesterPhone ?? 'No registrado']
              ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
            </dl>
          </CardBlock>
          <CardBlock title="Descripción" icon={<MessageCircle />}><p className="case-description">{item.description || 'Sin descripción registrada.'}</p></CardBlock>
        </aside>
      </section>
      {detailModal === 'assign' && can(PERMISSIONS.caseAssign) ? <AssignCaseModal caseId={resolvedCaseId!} onClose={() => setDetailModal(null)} onSaved={() => { setDetailModal(null); showToast('Asignación registrada correctamente.'); }} /> : null}
      {detailModal === 'state' && can(PERMISSIONS.caseChangeState) ? <ChangeCaseStateModal caseId={resolvedCaseId!} onClose={() => setDetailModal(null)} onSaved={() => { setDetailModal(null); showToast('Estado actualizado correctamente.'); }} /> : null}
      {detailModal === 'comment' && can(PERMISSIONS.caseComment) ? <CommentModal caseId={resolvedCaseId!} subtasks={caseSubtasks} onClose={() => setDetailModal(null)} onSaved={(message) => { setDetailModal(null); showToast(message); }} /> : null}
      {detailModal === 'subtask' && can(PERMISSIONS.caseManageSubtasks) ? <SubtaskFormModal fixedCaseId={resolvedCaseId!} cases={allCases} onClose={() => setDetailModal(null)} onSaved={(message) => { setDetailModal(null); showToast(message); }} /> : null}
      {detailModal === 'document' && can(PERMISSIONS.documentUpload) ? <DocumentUploadModal fixedCaseId={resolvedCaseId!} cases={allCases} onClose={() => setDetailModal(null)} onSaved={(message) => { setDetailModal(null); showToast(message); }} /> : null}
      {detailModal === 'sla' && can(PERMISSIONS.caseOverrideSla) ? <SlaOverrideModal caseId={resolvedCaseId!} currentDueAt={item.dueAt} onClose={() => setDetailModal(null)} onSaved={(message) => { setDetailModal(null); showToast(message); }} /> : null}
      {detailModal === 'reminder' && can(PERMISSIONS.caseSendReminder) ? <ManualReminderModal caseId={resolvedCaseId!} members={members} assignments={assignments} onClose={() => setDetailModal(null)} onSaved={(message) => { setDetailModal(null); showToast(message); }} /> : null}
      {detailModal === 'review' && can(PERMISSIONS.caseReview) ? <SubmitReviewModal caseId={resolvedCaseId!} members={members} onClose={() => setDetailModal(null)} onSaved={(message) => { setDetailModal(null); showToast(message); }} /> : null}
      {detailModal === 'delivery' && can(PERMISSIONS.caseRegisterDelivery) ? <DeliveryModal caseId={resolvedCaseId!} defaultRecipient={item.requesterEmail ?? item.requester} onClose={() => setDetailModal(null)} onSaved={(message) => { setDetailModal(null); showToast(message); }} /> : null}
      {reviewDecision && can(PERMISSIONS.caseApprove) ? <ReviewDecisionModal review={reviewDecision.review} decision={reviewDecision.decision} onClose={() => setReviewDecision(null)} onSaved={(message) => { setReviewDecision(null); showToast(message); }} /> : null}
      {versionDocument && can(PERMISSIONS.documentUpload) ? <DocumentVersionModal document={versionDocument} onClose={() => setVersionDocument(null)} onSaved={(message) => { setVersionDocument(null); showToast(message); }} /> : null}
    </Page>
  );
}

export function PublicFormPage() {
  const { tenant } = useParams<{ tenant?: string }>();
  const hostname = typeof window === 'undefined' ? undefined : window.location.hostname;
  const { data: context, isLoading, error } = usePublicIntakeContext({ tenant, hostname });

  if (isLoading && !context) {
    return (
      <Page centered>
        <section className="card public-state-card">
          <RefreshCw className="spin" size={28} />
          <h2>Preparando el formulario</h2>
          <p className="muted">Validando la organización y su configuración de radicación...</p>
        </section>
      </Page>
    );
  }

  if (error || !context || !context.intake.enabled) {
    return (
      <Page centered>
        <section className="card public-state-card">
          <ShieldCheck size={32} />
          <h2>Formulario no disponible</h2>
          <p className="muted">{error ?? 'No existe una radicación pública activa para esta dirección.'}</p>
          <Link className="btn btn-white" to="/login">Ir al acceso interno</Link>
        </section>
      </Page>
    );
  }

  const style = {
    '--primary': context.branding.primaryColor,
    '--accent': context.branding.accentColor
  } as CSSProperties;

  return (
    <div className="public-tenant-page" style={style}>
      <Page centered>
        <section className="public-layout">
          <div className="public-intro hero-gradient">
            <div className="public-tenant-brand">
              {context.branding.logoUrl
                ? <img className="public-brand-logo" src={context.branding.logoUrl} alt={context.branding.productName} />
                : <div className="brand-mark large">{context.branding.shortName.slice(0, 1).toUpperCase()}</div>}
              <div><strong>{context.branding.productName}</strong><span>{context.organizationName}</span></div>
            </div>
            <Badge tone="chip-light">Radicación pública</Badge>
            <h1>{context.intake.formTitle}</h1>
            <p>{context.intake.formDescription}</p>
            <div className="public-benefits"><span><ShieldCheck /> Radicado automático.</span><span><MailCheck /> Confirmación de recepción.</span><span><CalendarDays /> SLA calculado por configuración.</span></div>
            {context.branding.supportEmail ? <p className="public-support">Soporte: <a href={`mailto:${context.branding.supportEmail}`}>{context.branding.supportEmail}</a></p> : null}
          </div>
          <div className="card public-card">
            <div className="public-card-head"><div><span className="eyebrow">{context.organizationSlug}</span><h2>Crear solicitud</h2><p className="muted">El caso quedará en estado Pendiente de Clasificación.</p></div></div>
            <PublicCaseForm context={context} tenant={tenant} hostname={hostname} />
          </div>
        </section>
      </Page>
    </div>
  );
}

export function ManualCasePage() {
  const navigate = useNavigate();
  const { showToast } = useSigcActions();
  return (
    <Page>
      <PageHead
        title="Creación manual de caso"
        description="Registra un caso interno, calcula su SLA y crea múltiples asignaciones en una sola operación."
      />
      <ManualCaseForm onCreated={(radicado) => { showToast(`Caso ${radicado} creado correctamente.`); navigate(`/cases/${encodeURIComponent(radicado)}`); }} />
    </Page>
  );
}

export function BoardPage() {
  const { showToast } = useSigcActions();
  const { can } = useAuthorization();
  const canMove = can(PERMISSIONS.caseChangeState);
  const { data: catalogs } = useSigcCatalogs();
  const { data: members } = useSigcMembers();
  const [filters, setFilters] = useState({ caseTypeId: '', query: '', areaId: '', ownerId: '', priorityId: '' });
  const { data, isLoading, error, warning, reload } = useWorkflowBoard({
    caseTypeId: filters.caseTypeId || undefined,
    query: filters.query || undefined,
    areaId: filters.areaId || undefined,
    ownerId: filters.ownerId || undefined,
    priorityId: filters.priorityId || undefined
  });
  const [board, setBoard] = useState<WorkflowBoardSnapshot | null>(null);
  const [dragging, setDragging] = useState<{ card: WorkflowBoardCard; fromStateId: string } | null>(null);
  const [movingCaseId, setMovingCaseId] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setBoard(data);
      if (!filters.caseTypeId && data.selectedCaseTypeId) {
        setFilters((current) => ({ ...current, caseTypeId: data.selectedCaseTypeId ?? '' }));
      }
    }
  }, [data, filters.caseTypeId]);

  function updateFilter(key: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function optimisticMove(snapshot: WorkflowBoardSnapshot, cardId: string, fromStateId: string, toStateId: string): WorkflowBoardSnapshot {
    let moved: WorkflowBoardCard | null = null;
    const columns = snapshot.columns.map((column) => {
      if (column.stateId !== fromStateId) return column;
      const card = column.cards.find((item) => item.id === cardId) ?? null;
      moved = card;
      return { ...column, cards: column.cards.filter((item) => item.id !== cardId) };
    });
    if (!moved) return snapshot;
    const targetName = columns.find((column) => column.stateId === toStateId)?.name ?? moved.stateName;
    return {
      ...snapshot,
      columns: columns.map((column) => column.stateId === toStateId
        ? { ...column, cards: [{ ...moved!, stateId: toStateId, stateName: targetName, updatedAt: new Date().toISOString() }, ...column.cards] }
        : column)
    };
  }

  async function dropCard(event: DragEvent<HTMLDivElement>, toStateId: string) {
    event.preventDefault();
    if (!dragging || !board || movingCaseId) return;
    const { card, fromStateId } = dragging;
    setDragging(null);
    if (fromStateId === toStateId) return;

    const transition = board.transitions.find((item) => item.fromStateId === fromStateId && item.toStateId === toStateId);
    if (!transition || !transition.allowed) {
      showToast(transition?.requiredPermissionCode ? `No tienes el permiso ${transition.requiredPermissionCode}.` : 'Esa transición no está permitida para este flujo.');
      return;
    }

    let justification: string | undefined;
    if (transition.requiresJustification) {
      const value = window.prompt('Esta transición exige una justificación:');
      if (value == null) return;
      if (value.trim().length < 3) {
        showToast('La justificación debe contener al menos 3 caracteres.');
        return;
      }
      justification = value.trim();
    }

    const previous = board;
    setBoard(optimisticMove(board, card.id, fromStateId, toStateId));
    setMovingCaseId(card.id);
    try {
      await sigcService.moveCaseInWorkflow({
        caseId: card.id,
        toStateId,
        expectedFromStateId: fromStateId,
        justification
      });
      showToast(`${card.radicado} movido correctamente.`);
      reload();
    } catch (moveError) {
      setBoard(previous);
      showToast(moveError instanceof Error ? moveError.message : 'No fue posible mover el caso. El tablero fue restaurado.');
    } finally {
      setMovingCaseId(null);
    }
  }

  const totalCards = board?.columns.reduce((sum, column) => sum + column.cards.length, 0) ?? 0;

  return (
    <Page>
      <PageHead
        title="Tablero operativo por flujo"
        description="Columnas generadas desde el flujo del tipo de caso. Cada movimiento valida transición, permiso, justificación y concurrencia en la base de datos."
        actions={<button className="btn btn-soft" onClick={reload} disabled={isLoading}><RefreshCw size={17} /> Actualizar</button>}
      />

      <section className="card filter-card workflow-board-filters">
        <div className="filter-grid">
          <label className="field-label">Tipo de caso
            <select className="field" value={filters.caseTypeId} onChange={(event) => updateFilter('caseTypeId', event.target.value)}>
              {(board?.caseTypes ?? []).map((item) => <option key={item.id} value={item.id}>{item.name} ({item.caseCount})</option>)}
            </select>
          </label>
          <label className="field-label">Buscar
            <input className="field" placeholder="Radicado, asunto, empresa..." value={filters.query} onChange={(event) => updateFilter('query', event.target.value)} />
          </label>
          <label className="field-label">Área
            <select className="field" value={filters.areaId} onChange={(event) => updateFilter('areaId', event.target.value)}>
              <option value="">Todas</option>{catalogs?.areas.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="field-label">Responsable
            <select className="field" value={filters.ownerId} onChange={(event) => updateFilter('ownerId', event.target.value)}>
              <option value="">Todos</option>{members.map((item) => <option key={item.userId} value={item.userId}>{item.name}</option>)}
            </select>
          </label>
          <label className="field-label">Prioridad
            <select className="field" value={filters.priorityId} onChange={(event) => updateFilter('priorityId', event.target.value)}>
              <option value="">Todas</option>{catalogs?.priorities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        </div>
      </section>

      {warning ? <div className="alert danger">{warning}</div> : null}
      {error ? <div className="alert danger">{error}</div> : null}
      <div className="case-list-meta">
        <span>{isLoading ? 'Sincronizando flujo...' : `${board?.columns.length ?? 0} estados · ${board?.transitions.length ?? 0} transiciones válidas`}</span>
        <strong>{totalCards} caso{totalCards === 1 ? '' : 's'}</strong>
      </div>

      <section className="kanban-scroll">
        <div className="kanban-grid workflow-kanban-grid" style={{ '--workflow-columns': Math.max(board?.columns.length ?? 1, 1) } as CSSProperties}>
          {board?.columns.map((column) => {
            const sourceStateId = dragging?.fromStateId;
            const transition = sourceStateId ? board.transitions.find((item) => item.fromStateId === sourceStateId && item.toStateId === column.stateId) : null;
            const canDrop = Boolean(dragging && sourceStateId !== column.stateId && transition?.allowed);
            return (
              <div
                className={`kanban-col workflow-kanban-col ${canDrop ? 'can-drop' : ''} ${dragging && sourceStateId !== column.stateId && !canDrop ? 'blocked-drop' : ''}`}
                key={column.stateId}
                onDragOver={(event) => { if (canDrop) event.preventDefault(); }}
                onDrop={(event) => void dropCard(event, column.stateId)}
              >
                <header>
                  <span className="workflow-state-dot" style={{ background: column.color ?? undefined }} />
                  <strong>{column.name}</strong>
                  <Badge tone="tone-white">{column.cards.length}</Badge>
                </header>
                <div className="workflow-column-body">
                  {column.cards.map((card) => (
                    <article
                      className={`workflow-card ${card.overdue ? 'overdue' : ''} ${movingCaseId === card.id ? 'moving' : ''}`}
                      key={card.id}
                      draggable={canMove && !movingCaseId}
                      onDragStart={() => setDragging({ card, fromStateId: column.stateId })}
                      onDragEnd={() => setDragging(null)}
                    >
                      <div className="workflow-card-head">
                        <Link to={`/cases/${encodeURIComponent(card.radicado)}`} className="radicado">{card.radicado}</Link>
                        <span className={`chip ${card.overdue ? 'tone-red' : 'tone-slate'}`}>{card.priorityName}</span>
                      </div>
                      <strong>{card.subject}</strong>
                      <p>{card.company || card.requester}</p>
                      <div className="workflow-card-meta"><span>{card.areaName}</span><span>{card.ownerName}</span></div>
                      <div className="workflow-card-progress"><span><i style={{ width: `${card.progress}%` }} /></span><b>{card.progress}%</b></div>
                      <small>{card.dueAt ? `${card.overdue ? 'Vencido' : 'Límite'} · ${new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(card.dueAt))}` : 'Sin fecha límite'}</small>
                    </article>
                  ))}
                  {!column.cards.length ? <div className="empty-kanban"><Archive /><span>Sin casos</span></div> : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      {!canMove ? <div className="phase56-inline-note"><ShieldCheck size={16} /> Tu rol puede consultar el tablero, pero no cambiar estados.</div> : null}
    </Page>
  );
}

export function SubtasksPage() {
  const { showToast } = useSigcActions();
  const { can } = useAuthorization();
  const canManageSubtasks = can(PERMISSIONS.caseManageSubtasks);
  const { data: cases } = useSigcCases();
  const { data: members } = useSigcMembers();
  const [filters, setFilters] = useState<{ query: string; state: '' | SigcSubtask['state']; responsibleUserId: string }>({ query: '', state: '', responsibleUserId: '' });
  const { data: subtasks, isLoading, warning, error } = useSigcSubtasks(filters);
  const [editing, setEditing] = useState<SigcSubtask | null>(null);
  const [creating, setCreating] = useState(false);

  async function remove(task: SigcSubtask) {
    if (!window.confirm(`¿Eliminar lógicamente la subtarea "${task.title}"? Su historial permanecerá en auditoría.`)) return;
    try {
      await sigcService.deleteSubtask(task.id);
      showToast('Subtarea eliminada lógicamente.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible eliminar la subtarea.');
    }
  }

  return (
    <Page>
      <PageHead title="Módulo de subtareas" description="Control real de actividades por caso, responsable, fecha límite, estado, adjuntos y avance." actions={canManageSubtasks ? <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={17} /> Nueva subtarea</button> : undefined} />
      <section className="card filter-card">
        <div className="filter-grid phase3-filter-grid">
          <div className="filter-search-field"><Search size={17} /><input className="field" placeholder="Buscar subtarea" value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} /></div>
          <select className="field" value={filters.state} onChange={(event) => setFilters((current) => ({ ...current, state: event.target.value as typeof current.state }))}><option value="">Todos los estados</option><option value="pending">Pendiente</option><option value="in_progress">En progreso</option><option value="completed">Completada</option><option value="cancelled">Cancelada</option></select>
          <select className="field" value={filters.responsibleUserId} onChange={(event) => setFilters((current) => ({ ...current, responsibleUserId: event.target.value }))}><option value="">Todos los responsables</option>{members.map((member) => <option value={member.userId} key={member.userId}>{member.name}</option>)}</select>
          <button className="btn btn-white" onClick={() => setFilters({ query: '', state: '', responsibleUserId: '' })}>Limpiar</button>
        </div>
      </section>
      {warning ? <div className="alert danger">{warning}</div> : null}
      {error ? <div className="alert danger">{error}</div> : null}
      <div className="case-list-meta"><span>{isLoading ? 'Cargando actividades...' : 'Subtareas activas y trazables'}</span><strong>{subtasks.length} subtarea{subtasks.length === 1 ? '' : 's'}</strong></div>
      <section className="card table-card"><SubtasksTable rows={subtasks} onEdit={canManageSubtasks ? setEditing : undefined} onDelete={canManageSubtasks ? (task) => void remove(task) : undefined} /></section>
      {creating && canManageSubtasks ? <SubtaskFormModal cases={cases} onClose={() => setCreating(false)} onSaved={(message) => { setCreating(false); showToast(message); }} /> : null}
      {editing && canManageSubtasks ? <SubtaskFormModal cases={cases} initial={editing} onClose={() => setEditing(null)} onSaved={(message) => { setEditing(null); showToast(message); }} /> : null}
    </Page>
  );
}

export function DocumentsPage() {
  const { showToast } = useSigcActions();
  const { can } = useAuthorization();
  const canUploadDocuments = can(PERMISSIONS.documentUpload);
  const canDeleteDocuments = can(PERMISSIONS.documentDelete);
  const { data: cases } = useSigcCases();
  const { data: documents, isLoading, warning, error } = useSigcDocuments();
  const [query, setQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [versioning, setVersioning] = useState<SigcDocument | null>(null);
  const [editingDocument, setEditingDocument] = useState<SigcDocument | null>(null);

  const filtered = documents.filter((document) => {
    const value = query.trim().toLowerCase();
    if (!value) return true;
    return [document.name, document.category, document.caseRadicado, document.caseSubject, document.ownerName].some((item) => item.toLowerCase().includes(value));
  });
  const versions = documents.reduce((sum, document) => sum + document.currentVersion, 0);
  const inReview = documents.filter((document) => document.state === 'En revisión').length;
  const approved = documents.filter((document) => document.state === 'Aprobado').length;

  async function openDocument(document: SigcDocument) {
    try {
      const url = await sigcService.getDocumentSignedUrl(document.currentStoragePath);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible abrir el documento.');
    }
  }

  async function removeDocument(document: SigcDocument) {
    if (!window.confirm(`¿Eliminar lógicamente "${document.name}"? Sus ${document.currentVersion} versión(es) permanecerán intactas en auditoría y almacenamiento.`)) return;
    try {
      await sigcService.deleteDocument(document.id);
      showToast('Documento eliminado lógicamente.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible eliminar el documento.');
    }
  }

  return (
    <Page>
      <PageHead title="Gestión documental" description="Repositorio real por caso con versiones inmutables: cada nueva carga crea una versión y nunca sobrescribe la anterior." actions={canUploadDocuments ? <button className="btn btn-primary" onClick={() => setUploading(true)}><Upload size={17} /> Cargar documento</button> : undefined} />
      <section className="document-kpis">{[['Documentos', String(documents.length)], ['Versiones creadas', String(versions)], ['En revisión', String(inReview)], ['Aprobados', String(approved)]].map(([label, value]) => <article className="card" key={label}><span>{label}</span><strong>{value}</strong></article>)}</section>
      <section className="card filter-card"><div className="filter-search-field document-search"><Search size={17} /><input className="field" placeholder="Buscar por documento, caso, categoría o responsable" value={query} onChange={(event) => setQuery(event.target.value)} /></div></section>
      {warning ? <div className="alert danger">{warning}</div> : null}
      {error ? <div className="alert danger">{error}</div> : null}
      <div className="case-list-meta"><span>{isLoading ? 'Consultando Storage y metadatos...' : 'Versionamiento y eliminación lógica activos'}</span><strong>{filtered.length} documento{filtered.length === 1 ? '' : 's'}</strong></div>
      <section className="card table-card"><DocumentsTable rows={filtered} onOpen={(document) => void openDocument(document)} onEdit={canUploadDocuments ? setEditingDocument : undefined} onVersion={canUploadDocuments ? setVersioning : undefined} onDelete={canDeleteDocuments ? (document) => void removeDocument(document) : undefined} /></section>
      {uploading && canUploadDocuments ? <DocumentUploadModal cases={cases} onClose={() => setUploading(false)} onSaved={(message) => { setUploading(false); showToast(message); }} /> : null}
      {versioning && canUploadDocuments ? <DocumentVersionModal document={versioning} onClose={() => setVersioning(null)} onSaved={(message) => { setVersioning(null); showToast(message); }} /> : null}
      {editingDocument && canUploadDocuments ? <TextDocumentEditorModal document={editingDocument} onClose={() => setEditingDocument(null)} onSaved={(message) => { setEditingDocument(null); showToast(message); }} /> : null}
    </Page>
  );
}

export function SimpleLegacyPage({ title, description }: { title: string; description: string }) {
  return (
    <Page>
      <PageHead title={title} description={description} />
      <section className="card placeholder-card">
        <div className="kpi-icon"><UserCog /></div>
        <h2>Módulo conservado para compatibilidad</h2>
        <p>Esta ruta queda preparada para integrar datos reales de usuarios, perfil o configuración cuando conectemos Supabase/API.</p>
      </section>
    </Page>
  );
}

function SidebarContent({ closeMobile }: { closeMobile: () => void }) {
  const { currentUser, unreadNotifications } = useApp();
  const { can, canAny, canAll, roleName } = useAuthorization();
  const { data: dashboard } = useSigcDashboard(can(PERMISSIONS.reportsView));
  const { context } = useSaasTheme();
  const compliance = Math.round(dashboard?.summary.slaCompliancePct ?? 0);
  const critical = dashboard?.summary.criticalCases ?? 0;
  return (
    <div className="sidebar-inner">
      <div className="brand">
        <WorkspaceBrand compact />
        <div><strong>{context?.branding.shortName ?? 'SIGC'}</strong><span>{context?.branding.productName ?? 'Sistema Integral de Gestión de Casos'}</span></div>
      </div>
      <nav className="side-nav">
        {navItems.filter((item) => {
          const anyAllowed = !item.anyOf?.length || canAny(item.anyOf);
          const allAllowed = !item.allOf?.length || canAll(item.allOf);
          return anyAllowed && allAllowed;
        }).map(({ to, label, icon: Icon, externalShell }) => (
          <NavLink key={to} to={to} target={externalShell ? '_blank' : undefined} rel={externalShell ? 'noreferrer' : undefined} onClick={closeMobile} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Icon size={17} /><span>{label}</span>{to === '/notifications' && unreadNotifications > 0 ? <em>{unreadNotifications}</em> : null}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-compliance card">
        <strong>Cumplimiento del SLA</strong>
        <b>{compliance}%</b>
        <Progress value={compliance} />
        <p>{critical} caso{critical === 1 ? '' : 's'} crítico{critical === 1 ? '' : 's'} requiere{critical === 1 ? '' : 'n'} seguimiento.</p>
      </div>
      <NavLink to="/profile" className="sidebar-profile" onClick={closeMobile}>
        <UserCog size={18} />
        <div><strong>{currentUser?.name}</strong><span>{roleName}</span></div>
      </NavLink>
    </div>
  );
}

function Page({ children, centered = false }: { children: ReactNode; centered?: boolean }) {
  return <div className={`page ${centered ? 'page-centered' : ''}`}>{children}</div>;
}

function PageHead({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return (
    <header className="page-head">
      <div><span className="eyebrow">Opción 2 · WorkGrid Color</span><h1>{title}</h1><p>{description}</p></div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

function CardBlock({ title, description, icon, children, className = '' }: { title: string; description?: string; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card block-card ${className}`}>
      <header className="card-title">
        <div><h2>{title}</h2>{description ? <p>{description}</p> : null}</div>
        {icon ? <div className="kpi-icon">{icon}</div> : null}
      </header>
      {children}
    </section>
  );
}

function Badge({ children, tone = 'tone-slate' }: { children: ReactNode; tone?: string }) {
  return <span className={`chip ${tone}`}>{children}</span>;
}

function SemDot({ color }: { color: string }) {
  return <span className={`sem-dot sem-${color}`} />;
}

function Progress({ value, large = false }: { value: number; large?: boolean }) {
  return <span className={`progress ${large ? 'large' : ''}`}><i style={{ width: `${Math.max(0, Math.min(value, 100))}%` }} /></span>;
}

function CasesTable({ rows, compact = false }: { rows: SigcCase[]; compact?: boolean }) {
  const { openDrawer } = useSigcActions();
  return (
    <div className="table-scroll">
      <table className={`case-table ${compact ? 'compact' : ''}`}>
        <thead><tr>{['Radicado', 'Tipo', 'Asunto', 'Empresa / solicitante', 'Área', 'Responsable', 'Estado', 'Prioridad', 'SLA / límite', 'Semáforo', 'Avance', 'Última actualización'].map((header) => <th key={header}>{header}</th>)}</tr></thead>
        <tbody>
          {rows.map((item, index) => (
            <tr key={item.id} className={index === 2 ? 'selected-row' : ''}>
              <td><Link to={`/cases/${encodeURIComponent(item.id)}`} className="radicado">{item.radicado}</Link></td>
              <td>{item.type}</td>
              <td><strong className="truncate">{item.subject}</strong><small>{item.risk}</small></td>
              <td><strong>{item.company}</strong><small>{item.requester}</small></td>
              <td><Badge tone={areaTones[item.area]}>{item.area}</Badge></td>
              <td>{item.owner}</td>
              <td><Badge tone={stateTones[item.state]}>{item.state}</Badge></td>
              <td><Badge tone={priorityTones[item.priority]}>{item.priority}</Badge></td>
              <td><strong>{item.sla}</strong><small>{item.due}</small></td>
              <td><span className="sem-cell"><SemDot color={item.sem} /> {item.sem}</span></td>
              <td><div className="progress-cell"><Progress value={item.progress} /><b>{item.progress}%</b></div></td>
              <td><span>{item.updated}</span><button onClick={() => openDrawer(item.id)}>Ver</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SubtasksTable({ rows, onEdit, onDelete }: { rows: SigcSubtask[]; onEdit?: (task: SigcSubtask) => void; onDelete?: (task: SigcSubtask) => void }) {
  return (
    <div className="table-scroll">
      <table className="case-table subtasks-table">
        <thead><tr>{['Subtarea', 'Caso', 'Responsable', 'Fecha límite', 'Estado', 'Prioridad', 'Comentarios', 'Adjuntos', 'Avance', 'Acciones'].map((header) => <th key={header}>{header}</th>)}</tr></thead>
        <tbody>{rows.length ? rows.map((task) => <tr key={task.id}><td><strong>{task.title}</strong><small>{task.description || 'Sin descripción'}</small></td><td><Link className="radicado" to={`/cases/${encodeURIComponent(task.caseRadicado)}`}>{task.caseRadicado}</Link><small>{task.caseSubject}</small></td><td>{task.responsibleName}</td><td>{task.due}</td><td><Badge tone={stateTones[task.stateLabel] ?? 'tone-slate'}>{task.stateLabel}</Badge></td><td><Badge tone={priorityTones[task.priority]}>{task.priority}</Badge></td><td>{task.comments}</td><td>{task.attachments}</td><td><div className="progress-cell"><Progress value={task.progress} /><b>{task.progress}%</b></div></td><td>{onEdit || onDelete ? <div className="table-actions">{onEdit ? <button className="btn btn-white icon-only small" title="Editar" onClick={() => onEdit(task)}><Edit3 size={14} /></button> : null}{onDelete ? <button className="btn btn-white icon-only small danger-icon" title="Eliminar lógicamente" onClick={() => onDelete(task)}><Trash2 size={14} /></button> : null}</div> : <span className="muted">Solo lectura</span>}</td></tr>) : <tr><td colSpan={10}><div className="empty-inline">No hay subtareas para los filtros seleccionados.</div></td></tr>}</tbody>
      </table>
    </div>
  );
}

function DocumentsTable({ rows, onOpen, onEdit, onVersion, onDelete }: { rows: SigcDocument[]; onOpen: (document: SigcDocument) => void; onEdit?: (document: SigcDocument) => void; onVersion?: (document: SigcDocument) => void; onDelete?: (document: SigcDocument) => void }) {
  return (
    <div className="table-scroll">
      <table className="case-table docs-table">
        <thead><tr>{['Archivo', 'Caso', 'Categoría', 'Versión', 'Cargado por', 'Fecha', 'Estado', 'Acciones'].map((header) => <th key={header}>{header}</th>)}</tr></thead>
        <tbody>{rows.length ? rows.map((doc) => <tr key={doc.id}><td><strong className="file-name"><File size={16} />{doc.name}</strong><small>{doc.currentFilename}</small></td><td><Link className="radicado" to={`/cases/${encodeURIComponent(doc.caseRadicado)}`}>{doc.caseRadicado}</Link><small>{doc.caseSubject}</small></td><td>{doc.category}</td><td><Badge tone="tone-slate">v{doc.currentVersion}</Badge></td><td>{doc.ownerName}</td><td>{doc.date}</td><td><Badge tone={stateTones[doc.state] ?? 'tone-blue'}>{doc.state}</Badge></td><td><div className="table-actions"><button className="btn btn-white small" onClick={() => onOpen(doc)}><Eye size={14} /> Ver</button>{onEdit && canEditDocumentInline(doc) ? <button className="btn btn-white small" onClick={() => onEdit(doc)}><Edit3 size={14} /> Editar</button> : null}{onVersion ? <button className="btn btn-soft small" onClick={() => onVersion(doc)}><Upload size={14} /> Nueva versión</button> : null}{onDelete ? <button className="btn btn-white icon-only small danger-icon" title="Eliminar lógicamente" onClick={() => onDelete(doc)}><Trash2 size={14} /></button> : null}</div></td></tr>) : <tr><td colSpan={8}><div className="empty-inline">No hay documentos para mostrar.</div></td></tr>}</tbody>
      </table>
    </div>
  );
}

function SubtaskMini({ task }: { task: SigcSubtask }) {
  return <div className="subtask-mini"><div><strong>{task.title}</strong><Badge tone={stateTones[task.stateLabel] ?? 'tone-slate'}>{task.stateLabel}</Badge></div><small>{task.responsibleName} · {task.due} · {task.comments} comentarios · {task.attachments} adjuntos</small><Progress value={task.progress} /></div>;
}

function ActivityIcon({ eventType }: { eventType: string }) {
  if (eventType.startsWith('comment.')) return <MessageCircle size={15} />;
  if (eventType.startsWith('document.')) return <File size={15} />;
  if (eventType.startsWith('subtask.')) return <CalendarCheck size={15} />;
  if (eventType.startsWith('assignment.')) return <UserPlus size={15} />;
  if (eventType.includes('state')) return <RefreshCw size={15} />;
  return <CheckCircle2 size={15} />;
}

function CaseCard({ item }: { item: SigcCase }) {
  return (
    <article className="case-card" draggable>
      <div><strong>{item.radicado}</strong><SemDot color={item.sem} /></div>
      <p>{item.subject}</p>
      <div className="chip-row"><Badge tone={areaTones[item.area]}>{item.area}</Badge><Badge tone={priorityTones[item.priority]}>{item.priority}</Badge></div>
      <small>{item.owner}<span>{item.due}</span></small>
      <Progress value={item.progress} />
    </article>
  );
}

function CaseDrawer({ item, onClose }: { item: SigcCase; onClose: () => void }) {
  return (
    <aside className="drawer open">
      <header><div><Badge tone="tone-dark">{item.radicado}</Badge><h2>{item.subject}</h2><p>{item.company} · {item.requester}</p></div><button className="btn btn-white icon-only" onClick={onClose}><X size={17} /></button></header>
      <div className="drawer-body">
        <div className="chip-row"><Badge tone={areaTones[item.area]}>{item.area}</Badge><Badge tone={stateTones[item.state]}>{item.state}</Badge><Badge tone={priorityTones[item.priority]}>{item.priority}</Badge><Badge tone="tone-slate"><SemDot color={item.sem} /> {item.risk}</Badge></div>
        <section className="card drawer-progress"><div className="bar-caption"><strong>Avance</strong><span>{item.progress}%</span></div><Progress value={item.progress} /></section>
        <dl className="definition-list drawer-defs">{[['Responsable', item.owner], ['SLA', item.sla], ['Fecha límite', item.due], ['Última actualización', item.updated], ['Tipo', item.type]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <Link className="btn btn-primary full" onClick={onClose} to={`/cases/${encodeURIComponent(item.id)}`}>Abrir expediente completo</Link>
      </div>
    </aside>
  );
}

function Toast({ visible, text }: { visible: boolean; text: string }) {
  return <div className={`toast card ${visible ? 'show' : ''}`}><div className="kpi-icon small"><Check size={16} /></div><div><strong>Acción registrada</strong><p>{text}</p></div></div>;
}


function dueStatusLabel(item: SigcCase): string {
  if (item.state === 'Cerrado' || item.state === 'Cancelado') return item.state;
  if (!item.dueAt) return 'Sin fecha límite';
  const due = new Date(item.dueAt).getTime();
  if (!Number.isFinite(due)) return item.due;
  const diff = due - Date.now();
  if (diff <= 0) {
    const hours = Math.max(1, Math.round(Math.abs(diff) / 3600000));
    return `Vencido hace ${hours} h`;
  }
  const hours = Math.ceil(diff / 3600000);
  if (hours < 24) return `Vence en ${hours} h`;
  const days = Math.ceil(hours / 24);
  return `Vence en ${days} día${days === 1 ? '' : 's'}`;
}
function TimerResetIcon() {
  return <CalendarCheck size={17} />;
}

function useSigcActions(): SigcActions {
  return useOutletContext<SigcActions>();
}

function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'EG';
}

// Type augmentation helper for outlet context without leaking implementation details to every page.
type SigcActions = {
  openDrawer: (id: string) => void;
  showToast: (text: string) => void;
};

