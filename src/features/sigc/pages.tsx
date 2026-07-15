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
import type { SigcAssignment, SigcCase, SigcCaseFilters, SigcDocument, SigcSubtask, SigcCaseReview, WorkflowBoardCard, WorkflowBoardSnapshot } from './domain/types';
import { AssignCaseModal, ChangeCaseStateModal, ClassificationModal, DeactivateAssignmentModal, ManualCaseForm, PublicCaseForm } from './components/Phase2Forms';
import { canEditDocumentInline, CommentModal, DocumentUploadModal, DocumentVersionModal, SubtaskFormModal, TextDocumentEditorModal } from './components/Phase3Forms';
import { DeliveryModal, ManualReminderModal, ReviewDecisionModal, SlaOverrideModal, SubmitReviewModal } from './components/Phase4Forms';
import { DocumentHistoryModal } from './components/DocumentHistoryModal';
import { OrganizationSwitcher, useSaasTheme } from './components/Phase8Theme';
import { useCaseAssignments, useCaseComments, useCaseDeliveries, useCaseReminders, useCaseReviews, useCaseSlaOverrides, useCaseTimeline, useDebouncedValue, useSigcCase, useSigcCaseSearch, useSigcCatalogs, useSigcDocumentSearch, useSigcMembers, useSigcSidebarSummary, useSigcSubtaskSearch, usePublicIntakeContext, useWorkflowBoard } from './hooks/useSigcData';
import { sigcService } from './services/sigcService';
import orkestaLogoDark from '../../assets/orkesta-logo-dark.png';
import orkestaLogoLight from '../../assets/orkesta-logo-light.png';
import orkestaSymbol from '../../assets/orkesta-symbol.png';
import {
  adminModules,
  areaTones,
  navItems,
  priorityTones,
  stateTones,
  toneFromCatalog,
  isStateCode
} from './ui';

type ToastState = {
  visible: boolean;
  text: string;
};

type OrkestaLogoProps = {
  inverse?: boolean;
  symbolOnly?: boolean;
  className?: string;
};

function OrkestaLogo({ inverse = false, symbolOnly = false, className = '' }: OrkestaLogoProps) {
  const source = symbolOnly ? orkestaSymbol : inverse ? orkestaLogoLight : orkestaLogoDark;
  return <img className={`orkesta-logo ${symbolOnly ? 'orkesta-logo-symbol' : 'orkesta-logo-full'} ${className}`.trim()} src={source} alt={symbolOnly ? '' : 'Orkesta'} aria-hidden={symbolOnly || undefined} />;
}

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

  if (!currentUser) {
    if (isLoading) {
      return (
        <main className="login-workgrid login-loading-page">
          <section className="login-card card login-loading-card">
            <OrkestaLogo symbolOnly className="login-loading-symbol" />
            <h2>Conectando con Orkesta</h2>
            <p className="muted">{dataMode === 'supabase' ? 'Validando tu sesión segura...' : 'Preparando el espacio de trabajo...'}</p>
          </section>
        </main>
      );
    }
    return <Navigate to="/" replace />;
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
    openDrawer: async (id: string) => {
      if (!id) return;
      try {
        const result = await sigcService.getCase(id);
        setDrawerCase(result.data);
      } catch (drawerError) {
        showToast(drawerError instanceof Error ? drawerError.message : 'No fue posible abrir la vista rápida.');
      }
    },
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
        <OrkestaLogo symbolOnly className="topbar-orkesta-symbol" />
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
          <button className="btn btn-white topbar-secondary" onClick={() => navigate('/cases?overdue=1')}>
            <Zap size={17} /> Vencidos
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
            <span>{roleName} · {saasContext?.activeOrganization.name ?? (dataMode === 'supabase' ? 'Datos reales' : 'Demo')}</span>
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
  const [email, setEmail] = useState(dataMode === 'local' ? 'admin@test.com' : '');
  const [password, setPassword] = useState(dataMode === 'local' ? 'Admin123*' : '');
  const [error, setError] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);

  if (currentUser) return <Navigate to={loginParams.get('redirect') || '/app'} replace />;

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
      navigate(loginParams.get('redirect') || '/app');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-workgrid orkesta-login">
      <section className="login-panel hero-gradient orkesta-login-panel">
        <OrkestaLogo symbolOnly className="login-watermark" />
        <div className="login-panel-content">
          <OrkestaLogo inverse className="login-logo-hero" />
          <div className="chip chip-light">Plataforma empresarial de gestión</div>
          <h1>Coordina procesos, casos y equipos.</h1>
          <p>
            Orkesta centraliza solicitudes, contratos, reclamos y procesos internos con SLA, responsables, documentos y trazabilidad completa.
          </p>
          <div className="login-benefits">
            <span><ShieldCheck size={18} /> Control SLA</span>
            <span><CalendarCheck size={18} /> Cronograma visual</span>
            <span><CheckCircle2 size={18} /> Trazabilidad auditable</span>
          </div>
        </div>
      </section>
      <section className="login-card card orkesta-login-card">
        <div className="login-card-heading">
          <OrkestaLogo symbolOnly className="login-card-symbol" />
          <div>
            <span className="eyebrow">Acceso seguro</span>
            <h2>Iniciar sesión</h2>
          </div>
        </div>
        <p className="muted">Ingresa a tu espacio de trabajo en Orkesta. {dataMode === 'supabase' ? 'La autenticación está protegida por Supabase Auth.' : 'El entorno demo utiliza datos locales para validar la experiencia.'}</p>
        <form onSubmit={handleSubmit} className="form-stack">
          <label className="field-label">
            Correo
            <input className="field" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required />
          </label>
          <label className="field-label">
            Contraseña
            <input className="field" value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" required />
          </label>
          {error ? <div className="alert danger">{error}</div> : null}
          <button className="btn btn-primary full" type="submit" disabled={isSubmitting || isLoading}>{isSubmitting || isLoading ? 'Validando...' : 'Entrar a Orkesta'}</button>
          {dataMode === 'supabase' ? <Link className="login-forgot-link" to="/forgot-password">Olvidé mi contraseña</Link> : null}
          <Link className="login-home-link" to="/">Volver al inicio de Orkesta</Link>
        </form>
        {dataMode === 'local' ? (
          <div className="demo-credentials">
            <strong>Credenciales demo</strong>
            <span>admin@test.com / Admin123*</span>
            <span>user@test.com / User123*</span>
          </div>
        ) : null}
        <div className="login-powered"><OrkestaLogo className="login-powered-logo" /></div>
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
    fromDate: '',
    toDate: '',
    page: 1,
    pageSize: 10
  });
  const debouncedQuery = useDebouncedValue(filters.query ?? '', 400);

  useEffect(() => {
    const query = searchParams.get('q') ?? '';
    setFilters((current) => current.query === query ? current : { ...current, query, page: 1 });
  }, [searchParams]);

  const activeFilters = useMemo(() => ({ ...filters, query: debouncedQuery }), [filters, debouncedQuery]);
  const { data: result, isLoading, source, warning, error } = useSigcCaseSearch(activeFilters);
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  function setFilter<K extends keyof SigcCaseFilters>(key: K, value: SigcCaseFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value, page: key === 'page' ? Number(value) : 1 }));
  }

  function clearFilters() {
    setFilters({ query: '', fromDate: '', toDate: '', page: 1, pageSize: 10 });
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
          <label className="compact-date-filter"><span>Desde</span><input className="field" type="date" value={filters.fromDate ?? ''} max={filters.toDate || undefined} onChange={(event) => setFilter('fromDate', event.target.value || undefined)} /></label>
          <label className="compact-date-filter"><span>Hasta</span><input className="field" type="date" value={filters.toDate ?? ''} min={filters.fromDate || undefined} onChange={(event) => setFilter('toDate', event.target.value || undefined)} /></label>
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
  const resolvedCaseId = item?.databaseId;
  const { data: assignments } = useCaseAssignments(resolvedCaseId);
  const { data: caseSubtaskPage } = useSigcSubtaskSearch({ caseId: resolvedCaseId, page: 1, pageSize: 50 });
  const caseSubtasks = caseSubtaskPage.items;
  const { data: comments } = useCaseComments(resolvedCaseId);
  const { data: caseDocumentPage } = useSigcDocumentSearch({ caseId: resolvedCaseId, page: 1, pageSize: 6 });
  const caseDocuments = caseDocumentPage.items;
  const [timelinePageNumber, setTimelinePageNumber] = useState(1);
  const { data: timelinePage } = useCaseTimeline(resolvedCaseId, timelinePageNumber, 100);
  const timelineEvents = timelinePage.items;
  const { data: slaOverrides } = useCaseSlaOverrides(resolvedCaseId);
  const { data: reviews } = useCaseReviews(resolvedCaseId);
  const { data: deliveries } = useCaseDeliveries(resolvedCaseId);
  const { data: reminders } = useCaseReminders(resolvedCaseId);
  const { data: members } = useSigcMembers();
  const [detailModal, setDetailModal] = useState<'classify' | 'assign' | 'state' | 'comment' | 'subtask' | 'document' | 'sla' | 'reminder' | 'review' | 'delivery' | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<SigcAssignment | null>(null);
  const [deactivatingAssignment, setDeactivatingAssignment] = useState<SigcAssignment | null>(null);
  const [traceTab, setTraceTab] = useState<'timeline' | 'comments'>('timeline');
  const [versionDocument, setVersionDocument] = useState<SigcDocument | null>(null);
  const [historyDocument, setHistoryDocument] = useState<SigcDocument | null>(null);
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
            {can(PERMISSIONS.caseAssign) ? <button className="btn btn-white" onClick={() => setDetailModal('classify')}><SlidersHorizontal size={17} /> {item.classifiedAt ? 'Editar clasificación' : 'Clasificar caso'}</button> : null}
            {can(PERMISSIONS.caseAssign) ? <button className="btn btn-white" onClick={() => setDetailModal('assign')}><UserPlus size={17} /> Asignar</button> : null}
            {can(PERMISSIONS.caseChangeState) ? <button className="btn btn-white" onClick={() => setDetailModal('state')}><RefreshCw size={17} /> Cambiar estado</button> : null}
            {can(PERMISSIONS.caseComment) ? <button className="btn btn-primary" onClick={() => setDetailModal('comment')}><MessageSquarePlus size={17} /> Agregar comentario</button> : null}
          </>
        )}
      />
      {warning ? <div className="alert danger">{warning}</div> : null}
      <section className="card case-hero">
        <div>
          <div className="chip-row"><Badge tone="tone-dark">{item.radicado}</Badge><Badge tone={toneFromCatalog(item.typeColor, item.type, 'tone-purple')} color={item.typeColor}>{item.type}</Badge><Badge tone={toneFromCatalog(item.stateColor, item.state, stateTones[item.state] ?? 'tone-slate')} color={item.stateColor}>{item.state}</Badge><Badge tone={toneFromCatalog(item.priorityColor, item.priority, priorityTones[item.priority] ?? 'tone-slate')} color={item.priorityColor}>{item.priority}</Badge><Badge tone="tone-slate"><SemDot color={item.sem} /> {dueStatusLabel(item)}</Badge></div>
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
            {isStateCode(item.stateCode, 'RESPONSE_READY') && can(PERMISSIONS.caseReview) ? <button className="btn btn-primary" onClick={() => setDetailModal('review')}><CheckCircle2 size={17} /> Enviar a revisión</button> : null}
            {isStateCode(item.stateCode, 'APPROVED') && can(PERMISSIONS.caseRegisterDelivery) ? <button className="btn btn-primary" onClick={() => setDetailModal('delivery')}><MailCheck size={17} /> Registrar envío</button> : null}
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
                {timelinePage.total > timelinePage.pageSize ? <div className="timeline-pagination"><button className="btn btn-white small" disabled={timelinePage.page <= 1} onClick={() => setTimelinePageNumber((page) => Math.max(1, page - 1))}>Anterior</button><span>Página {timelinePage.page} de {Math.max(1, Math.ceil(timelinePage.total / timelinePage.pageSize))} · {timelinePage.total} eventos</span><button className="btn btn-white small" disabled={timelinePage.page * timelinePage.pageSize >= timelinePage.total} onClick={() => setTimelinePageNumber((page) => page + 1)}>Siguiente</button></div> : null}
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
          <CardBlock title="Asignaciones del caso" description="Ciclo completo por área: responsable, estado, avance, vencimiento y trazabilidad de reasignaciones." icon={<UserCog />}>
            {assignments.length ? assignments.map((assignment) => (
              <div className={`assignment-summary ${assignment.isActive ? '' : 'is-inactive'}`} key={assignment.id}>
                <div>
                  <strong>{assignment.areaName}</strong>
                  <small>{assignment.responsibleName} · asignada {assignment.assignedLabel} · límite {assignment.due}</small>
                  <div className="bar-caption"><span>Avance</span><strong>{assignment.progress}%</strong></div>
                  <Progress value={assignment.progress} />
                  {assignment.observations ? <small>{assignment.observations}</small> : null}
                </div>
                <div className="assignment-actions">
                  <div className="chip-row">{assignment.isPrimary ? <Badge tone="tone-dark">Principal</Badge> : null}<Badge tone={assignment.isActive ? 'tone-slate' : 'tone-red'}>{assignment.isActive ? assignment.state : 'Retirada'}</Badge></div>
                  {assignment.isActive && can(PERMISSIONS.caseAssign) ? <div className="chip-row"><button className="btn btn-white small" type="button" onClick={() => setEditingAssignment(assignment)}><Edit3 size={14} /> Editar</button><button className="btn btn-white small" type="button" onClick={() => setDeactivatingAssignment(assignment)}><Trash2 size={14} /> Retirar</button></div> : null}
                </div>
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
              {isStateCode(item.stateCode, 'RESPONSE_READY') && can(PERMISSIONS.caseReview) ? <div className="phase4-callout"><strong>Respuesta lista para revisión</strong><span>Selecciona un aprobador o envíala a la cola general de revisión.</span><button className="btn btn-primary small" onClick={() => setDetailModal('review')}>Enviar a revisión</button></div> : null}
              {pendingReview ? <div className="phase4-callout review-pending"><strong>Revisión #{pendingReview.reviewRound} pendiente</strong><span>Revisor: {pendingReview.reviewerName}</span>{pendingReview.requestNote ? <p>{pendingReview.requestNote}</p> : null}{can(PERMISSIONS.caseApprove) ? <div className="button-grid two"><button className="btn btn-primary small" onClick={() => setReviewDecision({ review: pendingReview, decision: 'approved' })}>Aprobar</button><button className="btn btn-white small" onClick={() => setReviewDecision({ review: pendingReview, decision: 'returned' })}>Devolver</button></div> : null}</div> : null}
              {isStateCode(item.stateCode, 'APPROVED') && can(PERMISSIONS.caseRegisterDelivery) ? <div className="phase4-callout"><strong>Respuesta aprobada</strong><span>Registra el canal y destinatario para pasar el caso a Enviado.</span><button className="btn btn-primary small" onClick={() => setDetailModal('delivery')}>Registrar envío</button></div> : null}
              <div className="phase4-history-list">
                {reviews.slice(0, 4).map((review) => <div className="phase4-history-row" key={review.id}><div><strong>Revisión #{review.reviewRound} · {review.status === 'pending' ? 'Pendiente' : review.status === 'approved' ? 'Aprobada' : review.status === 'returned' ? 'Devuelta' : 'Cancelada'}</strong><span>{review.reviewerName}{review.decisionComments ? ` · ${review.decisionComments}` : ''}</span></div><small>{review.requestedLabel}</small></div>)}
                {deliveries.slice(0, 3).map((delivery) => <div className="phase4-history-row" key={delivery.id}><div><strong>Envío · {delivery.channel}</strong><span>{delivery.recipient}{delivery.reference ? ` · Ref. ${delivery.reference}` : ''}</span></div><small>{delivery.deliveredByName} · {delivery.deliveredLabel}</small></div>)}
                {!reviews.length && !deliveries.length ? <div className="empty-inline">El flujo de aprobación aún no registra actuaciones.</div> : null}
              </div>
            </CardBlock>
          </section>
          <section className="grid-2">
            <CardBlock title="Subtareas del caso" description={`${caseSubtaskPage.total} actividad${caseSubtaskPage.total === 1 ? '' : 'es'} vinculadas al expediente.`} icon={<CalendarCheck />}>
              {can(PERMISSIONS.caseManageSubtasks) ? <div className="card-inline-actions"><button className="btn btn-soft small" onClick={() => setDetailModal('subtask')}><Plus size={15} /> Nueva subtarea</button></div> : null}
              {caseSubtasks.length ? caseSubtasks.slice(0, 6).map((task) => <SubtaskMini task={task} key={task.id} />) : <div className="empty-inline">No hay subtareas creadas.</div>}
              {caseSubtaskPage.total > 6 ? <div className="card-inline-actions"><Link className="btn btn-white small" to={`/subtasks?caseId=${encodeURIComponent(resolvedCaseId!)}`}>Ver todas ({caseSubtaskPage.total})</Link></div> : null}
            </CardBlock>
            <CardBlock title="Documentos adjuntos" description={`${caseDocumentPage.total} documento${caseDocumentPage.total === 1 ? '' : 's'} con versiones preservadas.`} icon={<Paperclip />}>
              {can(PERMISSIONS.documentUpload) ? <div className="card-inline-actions"><button className="btn btn-soft small" onClick={() => setDetailModal('document')}><Upload size={15} /> Cargar</button></div> : null}
              {caseDocuments.length ? caseDocuments.slice(0, 6).map((doc) => <div className="doc-mini" key={doc.id}><div><strong>{doc.name}</strong><small>{doc.category} · v{doc.currentVersion} · {doc.ownerName}</small></div><div className="doc-mini-actions"><Badge tone={stateTones[doc.state] ?? 'tone-blue'}>{doc.state}</Badge><button className="btn btn-white icon-only small" onClick={() => void openDocument(doc)} title="Ver"><Eye size={14} /></button><button className="btn btn-white icon-only small" onClick={() => setHistoryDocument(doc)} title="Historial de versiones"><Archive size={14} /></button>{can(PERMISSIONS.documentUpload) ? <button className="btn btn-soft icon-only small" onClick={() => setVersionDocument(doc)} title="Nueva versión"><Upload size={14} /></button> : null}</div></div>) : <div className="empty-inline">No hay documentos cargados.</div>}
              {caseDocumentPage.total > 6 ? <div className="card-inline-actions"><Link className="btn btn-white small" to={`/documents?caseId=${encodeURIComponent(resolvedCaseId!)}`}>Ver todos ({caseDocumentPage.total})</Link></div> : null}
            </CardBlock>
          </section>
        </div>
        <aside className="detail-side">
          <CardBlock title="Datos de clasificación" icon={<FileText />}>
            <dl className="definition-list">
              {[
                ['Tipo de caso', item.type], ['Área principal', item.area], ['Responsable principal', item.owner], ['SLA', item.sla], ['Fecha límite', item.due], ['Nivel de riesgo', item.risk], ['Origen', item.source], ['Clasificado', item.classifiedAt ? new Date(item.classifiedAt).toLocaleString('es-CO') : 'Pendiente'], ['Documento', item.requesterDocument ?? 'No registrado'], ['Teléfono', item.requesterPhone ?? 'No registrado']
              ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
              {item.classificationObservations ? <div><dt>Observaciones de clasificación</dt><dd>{item.classificationObservations}</dd></div> : null}
            </dl>
          </CardBlock>
          <CardBlock title="Descripción" icon={<MessageCircle />}><p className="case-description">{item.description || 'Sin descripción registrada.'}</p></CardBlock>
        </aside>
      </section>
      {detailModal === 'classify' && can(PERMISSIONS.caseAssign) ? <ClassificationModal caseItem={item} currentAssignments={assignments} onClose={() => setDetailModal(null)} onSaved={() => { setDetailModal(null); showToast('Clasificación guardada y auditada correctamente.'); }} /> : null}
      {detailModal === 'assign' && can(PERMISSIONS.caseAssign) ? <AssignCaseModal caseId={resolvedCaseId!} onClose={() => setDetailModal(null)} onSaved={() => { setDetailModal(null); showToast('Asignación registrada correctamente.'); }} /> : null}
      {editingAssignment && can(PERMISSIONS.caseAssign) ? <AssignCaseModal caseId={resolvedCaseId!} assignment={editingAssignment} onClose={() => setEditingAssignment(null)} onSaved={() => { setEditingAssignment(null); showToast('Asignación actualizada correctamente.'); }} /> : null}
      {deactivatingAssignment && can(PERMISSIONS.caseAssign) ? <DeactivateAssignmentModal caseId={resolvedCaseId!} assignment={deactivatingAssignment} onClose={() => setDeactivatingAssignment(null)} onSaved={() => { setDeactivatingAssignment(null); showToast('Asignación retirada y trazabilidad registrada.'); }} /> : null}
      {detailModal === 'state' && can(PERMISSIONS.caseChangeState) ? <ChangeCaseStateModal caseId={resolvedCaseId!} onClose={() => setDetailModal(null)} onSaved={() => { setDetailModal(null); showToast('Estado actualizado correctamente.'); }} /> : null}
      {detailModal === 'comment' && can(PERMISSIONS.caseComment) ? <CommentModal caseId={resolvedCaseId!} subtasks={caseSubtasks} onClose={() => setDetailModal(null)} onSaved={(message) => { setDetailModal(null); showToast(message); }} /> : null}
      {detailModal === 'subtask' && can(PERMISSIONS.caseManageSubtasks) ? <SubtaskFormModal fixedCaseId={resolvedCaseId!} fixedCaseLabel={`${item?.radicado ?? ''} · ${item?.subject ?? ''}`} onClose={() => setDetailModal(null)} onSaved={(message) => { setDetailModal(null); showToast(message); }} /> : null}
      {detailModal === 'document' && can(PERMISSIONS.documentUpload) ? <DocumentUploadModal fixedCaseId={resolvedCaseId!} fixedCaseLabel={`${item?.radicado ?? ''} · ${item?.subject ?? ''}`} onClose={() => setDetailModal(null)} onSaved={(message) => { setDetailModal(null); showToast(message); }} /> : null}
      {detailModal === 'sla' && can(PERMISSIONS.caseOverrideSla) ? <SlaOverrideModal caseId={resolvedCaseId!} currentDueAt={item.dueAt} onClose={() => setDetailModal(null)} onSaved={(message) => { setDetailModal(null); showToast(message); }} /> : null}
      {detailModal === 'reminder' && can(PERMISSIONS.caseSendReminder) ? <ManualReminderModal caseId={resolvedCaseId!} members={members} assignments={assignments} onClose={() => setDetailModal(null)} onSaved={(message) => { setDetailModal(null); showToast(message); }} /> : null}
      {detailModal === 'review' && can(PERMISSIONS.caseReview) ? <SubmitReviewModal caseId={resolvedCaseId!} members={members} onClose={() => setDetailModal(null)} onSaved={(message) => { setDetailModal(null); showToast(message); }} /> : null}
      {detailModal === 'delivery' && can(PERMISSIONS.caseRegisterDelivery) ? <DeliveryModal caseId={resolvedCaseId!} defaultRecipient={item.requesterEmail ?? item.requester} onClose={() => setDetailModal(null)} onSaved={(message) => { setDetailModal(null); showToast(message); }} /> : null}
      {reviewDecision && can(PERMISSIONS.caseApprove) ? <ReviewDecisionModal review={reviewDecision.review} decision={reviewDecision.decision} onClose={() => setReviewDecision(null)} onSaved={(message) => { setReviewDecision(null); showToast(message); }} /> : null}
      {historyDocument ? <DocumentHistoryModal document={historyDocument} canManageRetention={can(PERMISSIONS.documentUpload)} onClose={() => setHistoryDocument(null)} onSaved={(message) => showToast(message)} /> : null}
      {versionDocument && can(PERMISSIONS.documentUpload) ? <DocumentVersionModal document={versionDocument} onClose={() => setVersionDocument(null)} onSaved={(message) => { setVersionDocument(null); showToast(message); }} /> : null}
    </Page>
  );
}

export function PublicFormPage() {
  const { tenant } = useParams<{ tenant?: string }>();
  const hostname = typeof window === 'undefined' ? undefined : window.location.hostname;
  const { data: context, isLoading, error, reload } = usePublicIntakeContext({ tenant, hostname });

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
            <PublicCaseForm context={context} tenant={tenant} hostname={hostname} onSecurityRefresh={reload} />
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
      <ManualCaseForm onCreated={(radicado, failedAttachments) => { showToast(failedAttachments.length ? `Caso ${radicado} creado. Adjuntos pendientes: ${failedAttachments.join(', ')}.` : `Caso ${radicado} creado correctamente.`); navigate(`/cases/${encodeURIComponent(radicado)}`); }} />
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
    const sourceColumn = snapshot.columns.find((column) => column.stateId === fromStateId);
    const moved = sourceColumn?.cards.find((card) => card.id === cardId) ?? null;
    if (!moved) return snapshot;
    const targetName = snapshot.columns.find((column) => column.stateId === toStateId)?.name ?? moved.stateName;
    return {
      ...snapshot,
      columns: snapshot.columns.map((column) => {
        if (column.stateId === fromStateId) return { ...column, cards: column.cards.filter((card) => card.id !== cardId) };
        if (column.stateId === toStateId) return { ...column, cards: [{ ...moved, stateId: toStateId, stateName: targetName, updatedAt: new Date().toISOString() }, ...column.cards] };
        return column;
      })
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
  const [searchParams, setSearchParams] = useSearchParams();
  const caseIdFilter = searchParams.get('caseId') || undefined;
  const { showToast } = useSigcActions();
  const { can } = useAuthorization();
  const canManageSubtasks = can(PERMISSIONS.caseManageSubtasks);
  const { data: members } = useSigcMembers();
  const [filters, setFilters] = useState<{ query: string; state: '' | SigcSubtask['state']; responsibleUserId: string }>({ query: '', state: '', responsibleUserId: '' });
  const debouncedQuery = useDebouncedValue(filters.query, 400);
  const [pageNumber, setPageNumber] = useState(1);
  const pageSize = 25;
  const { data: subtaskPage, isLoading, warning, error } = useSigcSubtaskSearch({ ...filters, query: debouncedQuery, caseId: caseIdFilter, page: pageNumber, pageSize });
  const subtasks = subtaskPage.items;
  const totalPages = Math.max(1, Math.ceil(subtaskPage.total / pageSize));
  const [editing, setEditing] = useState<SigcSubtask | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => { setPageNumber(1); }, [debouncedQuery, filters.state, filters.responsibleUserId]);

  async function remove(task: SigcSubtask) {
    if (!window.confirm(`¿Eliminar lógicamente la subtarea "${task.title}"? Su historial permanecerá en auditoría.`)) return;
    try {
      await sigcService.deleteSubtask(task.id);
      showToast('Subtarea eliminada lógicamente.');
    } catch (removeError) {
      showToast(removeError instanceof Error ? removeError.message : 'No fue posible eliminar la subtarea.');
    }
  }

  return (
    <Page>
      <PageHead title="Módulo de subtareas" description="Control paginado de actividades por caso, responsable, fecha límite, estado, adjuntos y avance." actions={canManageSubtasks ? <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={17} /> Nueva subtarea</button> : undefined} />
      {caseIdFilter ? <div className="alert info case-scope-filter"><span>Mostrando solo las subtareas del expediente seleccionado.</span><button className="btn btn-white small" onClick={() => setSearchParams({})}>Ver todas</button></div> : null}
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
      <div className="case-list-meta"><span>{isLoading ? 'Cargando actividades...' : 'Consulta paginada desde servidor'}</span><strong>{subtaskPage.total} subtarea{subtaskPage.total === 1 ? '' : 's'}</strong></div>
      <section className="card table-card"><SubtasksTable rows={subtasks} onEdit={canManageSubtasks ? setEditing : undefined} onDelete={canManageSubtasks ? (task) => void remove(task) : undefined} /></section>
      <Pagination page={pageNumber} totalPages={totalPages} onChange={setPageNumber} />
      {creating && canManageSubtasks ? <SubtaskFormModal onClose={() => setCreating(false)} onSaved={(message) => { setCreating(false); showToast(message); }} /> : null}
      {editing && canManageSubtasks ? <SubtaskFormModal initial={editing} onClose={() => setEditing(null)} onSaved={(message) => { setEditing(null); showToast(message); }} /> : null}
    </Page>
  );
}

export function DocumentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const caseIdFilter = searchParams.get('caseId') || undefined;
  const { showToast } = useSigcActions();
  const { can } = useAuthorization();
  const canUploadDocuments = can(PERMISSIONS.documentUpload);
  const canDeleteDocuments = can(PERMISSIONS.documentDelete);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 400);
  const [pageNumber, setPageNumber] = useState(1);
  const pageSize = 25;
  const { data: documentPage, isLoading, warning, error } = useSigcDocumentSearch({ query: debouncedQuery, caseId: caseIdFilter, page: pageNumber, pageSize });
  const documents = documentPage.items;
  const totalPages = Math.max(1, Math.ceil(documentPage.total / pageSize));
  const [uploading, setUploading] = useState(false);
  const [versioning, setVersioning] = useState<SigcDocument | null>(null);
  const [editingDocument, setEditingDocument] = useState<SigcDocument | null>(null);
  const [historyDocument, setHistoryDocument] = useState<SigcDocument | null>(null);

  useEffect(() => { setPageNumber(1); }, [debouncedQuery]);

  const versions = documents.reduce((sum, document) => sum + document.currentVersion, 0);
  const inReview = documents.filter((document) => document.state === 'En revisión').length;
  const approved = documents.filter((document) => document.state === 'Aprobado').length;

  async function openDocument(document: SigcDocument) {
    try {
      const url = await sigcService.getDocumentSignedUrl(document.currentStoragePath);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (openError) {
      showToast(openError instanceof Error ? openError.message : 'No fue posible abrir el documento.');
    }
  }

  async function removeDocument(document: SigcDocument) {
    if (!window.confirm(`¿Eliminar lógicamente "${document.name}"? Sus ${document.currentVersion} versión(es) permanecerán intactas en auditoría y almacenamiento.`)) return;
    try {
      await sigcService.deleteDocument(document.id);
      showToast('Documento eliminado lógicamente.');
    } catch (removeError) {
      showToast(removeError instanceof Error ? removeError.message : 'No fue posible eliminar el documento.');
    }
  }

  async function togglePortalVisibility(document: SigcDocument) {
    try {
      await sigcService.setDocumentClientVisibility(document.id, !document.clientVisible);
      showToast(document.clientVisible ? 'Documento ocultado del portal externo.' : 'Documento compartido en el portal externo.');
    } catch (visibilityError) {
      showToast(visibilityError instanceof Error ? visibilityError.message : 'No fue posible actualizar la visibilidad del documento.');
    }
  }

  return (
    <Page>
      <PageHead title="Gestión documental" description="Repositorio paginado por caso con versiones inmutables y control de visibilidad para el portal externo." actions={canUploadDocuments ? <button className="btn btn-primary" onClick={() => setUploading(true)}><Upload size={17} /> Cargar documento</button> : undefined} />
      {caseIdFilter ? <div className="alert info case-scope-filter"><span>Mostrando solo los documentos del expediente seleccionado.</span><button className="btn btn-white small" onClick={() => setSearchParams({})}>Ver todos</button></div> : null}
      <section className="document-kpis">{[['Documentos encontrados', String(documentPage.total)], ['Versiones en esta página', String(versions)], ['En revisión', String(inReview)], ['Aprobados', String(approved)]].map(([label, value]) => <article className="card" key={label}><span>{label}</span><strong>{value}</strong></article>)}</section>
      <section className="card filter-card"><div className="filter-search-field document-search"><Search size={17} /><input className="field" placeholder="Buscar por documento, caso, categoría o responsable" value={query} onChange={(event) => setQuery(event.target.value)} /></div></section>
      {warning ? <div className="alert danger">{warning}</div> : null}
      {error ? <div className="alert danger">{error}</div> : null}
      <div className="case-list-meta"><span>{isLoading ? 'Consultando documentos...' : 'Consulta paginada desde servidor'}</span><strong>{documentPage.total} documento{documentPage.total === 1 ? '' : 's'}</strong></div>
      <section className="card table-card"><DocumentsTable rows={documents} onOpen={(document) => void openDocument(document)} onHistory={setHistoryDocument} onEdit={canUploadDocuments ? setEditingDocument : undefined} onVersion={canUploadDocuments ? setVersioning : undefined} onToggleClientVisibility={canUploadDocuments ? (document) => void togglePortalVisibility(document) : undefined} onDelete={canDeleteDocuments ? (document) => void removeDocument(document) : undefined} /></section>
      <Pagination page={pageNumber} totalPages={totalPages} onChange={setPageNumber} />
      {uploading && canUploadDocuments ? <DocumentUploadModal onClose={() => setUploading(false)} onSaved={(message) => { setUploading(false); showToast(message); }} /> : null}
      {versioning && canUploadDocuments ? <DocumentVersionModal document={versioning} onClose={() => setVersioning(null)} onSaved={(message) => { setVersioning(null); showToast(message); }} /> : null}
      {historyDocument ? <DocumentHistoryModal document={historyDocument} canManageRetention={canUploadDocuments} onClose={() => setHistoryDocument(null)} onSaved={(message) => showToast(message)} /> : null}
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
  const canViewReports = can(PERMISSIONS.reportsView);
  const { data: sidebarSummary } = useSigcSidebarSummary(canViewReports);
  const { context } = useSaasTheme();
  const compliance = Math.round(sidebarSummary?.slaCompliancePct ?? 0);
  const critical = sidebarSummary?.criticalCases ?? 0;
  return (
    <div className="sidebar-inner">
      <div className="brand orkesta-sidebar-brand">
        <OrkestaLogo inverse className="sidebar-orkesta-logo" />
        <span>{context?.activeOrganization.name ?? 'Gestión integral de casos'}</span>
      </div>
      <nav className="side-nav">
        {navItems.filter((item) => {
          const anyAllowed = !item.anyOf?.length || canAny(item.anyOf);
          const allAllowed = !item.allOf?.length || canAll(item.allOf);
          return anyAllowed && allAllowed;
        }).map(({ to, label, icon: Icon, externalShell }) => {
          const effectiveTo = to === '/radicar' && context?.activeOrganization.slug
            ? `/radicar/${encodeURIComponent(context.activeOrganization.slug)}`
            : to;
          return (
            <NavLink key={to} to={effectiveTo} target={externalShell ? '_blank' : undefined} rel={externalShell ? 'noreferrer' : undefined} onClick={closeMobile} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Icon size={17} /><span>{label}</span>{to === '/notifications' && unreadNotifications > 0 ? <em>{unreadNotifications}</em> : null}
            </NavLink>
          );
        })}
      </nav>
      {canViewReports ? <div className="sidebar-compliance card">
        <strong>Cumplimiento del SLA</strong>
        <b>{compliance}%</b>
        <Progress value={compliance} />
        <p>{critical} caso{critical === 1 ? '' : 's'} crítico{critical === 1 ? '' : 's'} requiere{critical === 1 ? '' : 'n'} seguimiento.</p>
      </div> : null}
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
      <div><span className="eyebrow">Orkesta · Gestión integral</span><h1>{title}</h1><p>{description}</p></div>
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

function Badge({ children, tone = 'tone-slate', color }: { children: ReactNode; tone?: string; color?: string | null }) {
  const normalized = color?.trim();
  const style: CSSProperties | undefined = normalized && /^#[0-9a-f]{6}$/i.test(normalized) ? { color: normalized, backgroundColor: `${normalized}18`, borderColor: `${normalized}55` } : undefined;
  return <span className={`chip ${tone}`} style={style}>{children}</span>;
}

function SemDot({ color }: { color: string }) {
  return <span className={`sem-dot sem-${color}`} />;
}

function Progress({ value, large = false }: { value: number; large?: boolean }) {
  return <span className={`progress ${large ? 'large' : ''}`}><i style={{ width: `${Math.max(0, Math.min(value, 100))}%` }} /></span>;
}

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  if (totalPages <= 1) return null;
  return <div className="pagination-row"><button className="btn btn-white" disabled={page <= 1} onClick={() => onChange(page - 1)}>Anterior</button><span>Página <strong>{page}</strong> de <strong>{totalPages}</strong></span><button className="btn btn-white" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Siguiente</button></div>;
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
              <td><Badge tone={toneFromCatalog(item.areaColor, item.area, areaTones[item.area] ?? 'tone-blue')} color={item.areaColor}>{item.area}</Badge></td>
              <td>{item.owner}</td>
              <td><Badge tone={toneFromCatalog(item.stateColor, item.state, stateTones[item.state] ?? 'tone-slate')} color={item.stateColor}>{item.state}</Badge></td>
              <td><Badge tone={toneFromCatalog(item.priorityColor, item.priority, priorityTones[item.priority] ?? 'tone-slate')} color={item.priorityColor}>{item.priority}</Badge></td>
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

function DocumentsTable({ rows, onOpen, onHistory, onEdit, onVersion, onToggleClientVisibility, onDelete }: { rows: SigcDocument[]; onOpen: (document: SigcDocument) => void; onHistory: (document: SigcDocument) => void; onEdit?: (document: SigcDocument) => void; onVersion?: (document: SigcDocument) => void; onToggleClientVisibility?: (document: SigcDocument) => void; onDelete?: (document: SigcDocument) => void }) {
  return (
    <div className="table-scroll">
      <table className="case-table docs-table">
        <thead><tr>{['Archivo', 'Caso', 'Categoría', 'Versión', 'Cargado por', 'Fecha', 'Estado', 'Portal', 'Acciones'].map((header) => <th key={header}>{header}</th>)}</tr></thead>
        <tbody>{rows.length ? rows.map((doc) => <tr key={doc.id}><td><strong className="file-name"><File size={16} />{doc.name}</strong><small>{doc.currentFilename}</small></td><td><Link className="radicado" to={`/cases/${encodeURIComponent(doc.caseRadicado)}`}>{doc.caseRadicado}</Link><small>{doc.caseSubject}</small></td><td>{doc.category}</td><td><Badge tone="tone-slate">v{doc.currentVersion}</Badge></td><td>{doc.ownerName}</td><td>{doc.date}</td><td><Badge tone={stateTones[doc.state] ?? 'tone-blue'}>{doc.state}</Badge></td><td><Badge tone={doc.clientVisible ? 'tone-green' : 'tone-slate'}>{doc.clientVisible ? 'Compartido' : 'Interno'}</Badge></td><td><div className="table-actions"><button className="btn btn-white small" onClick={() => onOpen(doc)}><Eye size={14} /> Ver</button><button className="btn btn-white small" onClick={() => onHistory(doc)}><Archive size={14} /> Historial</button>{onEdit && canEditDocumentInline(doc) ? <button className="btn btn-white small" onClick={() => onEdit(doc)}><Edit3 size={14} /> Editar</button> : null}{onVersion ? <button className="btn btn-soft small" onClick={() => onVersion(doc)}><Upload size={14} /> Nueva versión</button> : null}{onToggleClientVisibility ? <button className="btn btn-white small" onClick={() => onToggleClientVisibility(doc)}>{doc.clientVisible ? 'Ocultar portal' : 'Compartir'}</button> : null}{onDelete ? <button className="btn btn-white icon-only small danger-icon" title="Eliminar lógicamente" onClick={() => onDelete(doc)}><Trash2 size={14} /></button> : null}</div></td></tr>) : <tr><td colSpan={9}><div className="empty-inline">No hay documentos para mostrar.</div></td></tr>}</tbody>
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
      <div className="chip-row"><Badge tone={toneFromCatalog(item.areaColor, item.area, areaTones[item.area] ?? 'tone-blue')} color={item.areaColor}>{item.area}</Badge><Badge tone={toneFromCatalog(item.priorityColor, item.priority, priorityTones[item.priority] ?? 'tone-slate')} color={item.priorityColor}>{item.priority}</Badge></div>
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
        <div className="chip-row"><Badge tone={toneFromCatalog(item.areaColor, item.area, areaTones[item.area] ?? 'tone-blue')} color={item.areaColor}>{item.area}</Badge><Badge tone={toneFromCatalog(item.stateColor, item.state, stateTones[item.state] ?? 'tone-slate')} color={item.stateColor}>{item.state}</Badge><Badge tone={toneFromCatalog(item.priorityColor, item.priority, priorityTones[item.priority] ?? 'tone-slate')} color={item.priorityColor}>{item.priority}</Badge><Badge tone="tone-slate"><SemDot color={item.sem} /> {item.risk}</Badge></div>
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

const fallbackSigcActions: SigcActions = {
  openDrawer: () => undefined,
  showToast: (text) => {
    console.warn('[SIGC toast fallback]', text);
  }
};

function useSigcActions(): SigcActions {
  return useOutletContext<SigcActions | undefined>() ?? fallbackSigcActions;
}

function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'EG';
}

// Type augmentation helper for outlet context without leaking implementation details to every page.
type SigcActions = {
  openDrawer: (id: string) => void;
  showToast: (text: string) => void;
};

