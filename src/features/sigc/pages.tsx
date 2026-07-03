import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
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
  UserCog,
  UserPlus,
  X,
  Zap
} from 'lucide-react';
import { useApp } from '../../app/AppProvider';
import { dashboardKpis, demoDocuments as documents, demoSubtasks as subtasks, demoTimeline as timeline } from './demoData';
import type { SigcCase, SigcCaseFilters } from './domain/types';
import { AssignCaseModal, ChangeCaseStateModal, ManualCaseForm, PublicCaseForm } from './components/Phase2Forms';
import { useCaseAssignments, useSigcCase, useSigcCaseSearch, useSigcCases, useSigcCatalogs, useSigcMembers } from './hooks/useSigcData';
import {
  adminModules,
  areaDistribution,
  areaTones,
  navItems,
  priorityTones,
  reportMonths,
  reportValues,
  stateTones
} from './ui';

type ModalKind = 'assign' | 'state' | 'sla' | 'comment' | 'document' | 'task' | null;

type ToastState = {
  visible: boolean;
  text: string;
};

export function SigcShell() {
  const { currentUser, logout, resetDemoData, isLoading, dataMode } = useApp();
  const [drawerCase, setDrawerCase] = useState<SigcCase | null>(null);
  const [modalKind, setModalKind] = useState<ModalKind>(null);
  const [toast, setToast] = useState<ToastState>({ visible: false, text: 'Acción registrada correctamente.' });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [topSearch, setTopSearch] = useState('');
  const navigate = useNavigate();
  const { data: sigcCases, source: sigcSource, warning: sigcWarning } = useSigcCases();

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
    setModalKind(null);
    setMobileOpen(false);
  }

  const context = {
    openDrawer: (id: string) => setDrawerCase(sigcCases.find((item) => item.id === id || item.radicado === id) ?? sigcCases[0] ?? null),
    openModal: setModalKind,
    showToast
  };

  return (
    <div className="sigc-app">
      <div className={`sigc-overlay ${drawerCase || modalKind || mobileOpen ? 'open' : ''}`} onClick={closeAll} />
      <aside className={`sigc-sidebar ${mobileOpen ? 'open' : ''}`}>
        <SidebarContent closeMobile={() => setMobileOpen(false)} />
      </aside>

      <header className="sigc-topbar glass">
        <button className="btn btn-white mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Abrir menú">
          <Menu size={18} />
        </button>
        <div className="search-box">
          <Search size={18} />
          <input
            placeholder="Buscar por radicado, solicitante, empresa o palabra clave..."
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
        <Link className="btn btn-primary" to="/manual-case">
          <Plus size={17} /> Nuevo caso
        </Link>
        <button className="btn btn-white topbar-secondary" onClick={resetDemoData} title="Restaurar datos demo">
          <RefreshCw size={17} /> Demo
        </button>
        <button className="btn btn-white topbar-secondary" onClick={logout} title="Cerrar sesión">
          <LogOut size={17} /> Salir
        </button>
        <div className="topbar-user">
          <div>
            <strong>{currentUser.name}</strong>
            <span title={sigcWarning ?? undefined}>{currentUser.role === 'admin' ? 'Administrador SIGC' : 'Usuario SIGC'} · {sigcSource === 'supabase' ? 'Datos reales' : 'Demo'}</span>
          </div>
          <div className="avatar">{initials(currentUser.name)}</div>
        </div>
      </header>

      <main className="sigc-main">
        <Outlet context={context} />
      </main>

      {drawerCase ? <CaseDrawer item={drawerCase} onClose={closeAll} /> : null}
      {modalKind ? <ActionModal kind={modalKind} onClose={closeAll} onSave={() => { closeAll(); showToast('La acción quedó registrada en trazabilidad y auditoría.'); }} /> : null}
      <Toast visible={toast.visible} text={toast.text} />
    </div>
  );
}

export function SigcLoginPage() {
  const { currentUser, login, isLoading, dataMode } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@test.com');
  const [password, setPassword] = useState('Admin123*');
  const [error, setError] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);

  if (currentUser) return <Navigate to="/dashboard" replace />;

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
      navigate('/dashboard');
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

export function DashboardPage() {
  const { openDrawer, showToast } = useSigcActions();
  const { data: cases } = useSigcCases();
  const criticalCases = cases.filter((item) => item.priority === 'Crítica' || item.sem === 'red');

  return (
    <Page>
      <PageHead
        title="Dashboard principal"
        description="Control ejecutivo de vencimientos, carga operativa, cumplimiento de SLA y productividad por área."
        actions={(
          <>
            <button className="btn btn-soft" onClick={() => showToast('Indicadores actualizados en tiempo real.')}><RefreshCw size={17} /> Actualizar</button>
            <Link className="btn btn-primary" to="/reports"><Download size={17} /> Generar reporte</Link>
          </>
        )}
      />

      <section className="hero-card hero-gradient">
        <div className="hero-content">
          <div>
            <span className="chip chip-light">Centro de mando de casos corporativos</span>
            <h2>Prioriza lo vencido, escala lo crítico y mantiene trazabilidad auditable de cada actuación.</h2>
            <p>El SIGC transforma solicitudes, contratos, reclamos, tutelas y procesos internos en expedientes operables con SLA, responsables, documentos y auditoría.</p>
          </div>
          <div className="hero-stats">
            <div><span>Carga de hoy</span><strong>34</strong></div>
            <div><span>Escalados</span><strong>7</strong></div>
          </div>
        </div>
      </section>

      <section className="kpi-grid">
        {dashboardKpis.map(({ label, value, icon: Icon, helper, danger }) => (
          <article className={`card kpi-card ${danger ? 'danger' : ''}`} key={label}>
            <div className="kpi-top"><Icon size={21} /><span>{helper}</span></div>
            <p>{label}</p>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="grid-2-1">
        <CardBlock icon={<BarChart3 />} title="Casos creados vs cerrados por mes" description="Tendencia operativa con lectura rápida de capacidad.">
          <div className="mini-chart">
            {reportValues.map((height, index) => (
              <div className="chart-bar-wrap" key={reportMonths[index]}>
                <span className="chart-bar" style={{ height: `${height * 1.9}px` }} />
                <small>{reportMonths[index]}</small>
              </div>
            ))}
          </div>
        </CardBlock>
        <CardBlock icon={<BarChart3 />} title="Casos por área" description="Distribución de carga actual.">
          <div className="area-bars">
            {areaDistribution.map(([name, value]) => (
              <div key={name}>
                <div className="bar-caption"><strong>{name}</strong><span>{value}%</span></div>
                <Progress value={value * 2.5} />
              </div>
            ))}
          </div>
        </CardBlock>
      </section>

      <section className="grid-3">
        <CardBlock icon={<Zap />} title="Casos críticos" description="Atención inmediata sugerida.">
          <div className="stack-list">
            {criticalCases.map((item) => (
              <button className="compact-card" key={item.id} onClick={() => openDrawer(item.id)}>
                <div><strong>{item.id}</strong><Badge tone={priorityTones[item.priority]}>{item.priority}</Badge></div>
                <p>{item.subject}</p>
                <small><SemDot color={item.sem} /> vence {item.due} · {item.owner}</small>
              </button>
            ))}
          </div>
        </CardBlock>
        <CardBlock icon={<CalendarCheck />} title="Mi trabajo de hoy" description="Subtareas y casos asignados.">
          <div className="check-list">
            {subtasks.slice(0, 4).map((task) => (
              <label key={task.title}>
                <input type="checkbox" />
                <span><strong>{task.title}</strong><small>{task.owner} · {task.due}</small></span>
                <Badge tone={stateTones[task.state] ?? 'tone-slate'}>{task.state}</Badge>
              </label>
            ))}
          </div>
        </CardBlock>
        <CardBlock icon={<UserCog />} title="Casos por responsable" description="Carga relativa de trabajo.">
          {['Laura Méndez', 'Felipe Vargas', 'Mónica Díaz', 'Natalia Bernal', 'Julián Pérez'].map((name, index) => (
            <div className="owner-row" key={name}>
              <div className="owner-avatar">{initials(name)}</div>
              <div>
                <div><strong>{name}</strong><span>{[29, 21, 17, 14, 11][index]}</span></div>
                <Progress value={[88, 72, 53, 44, 32][index]} />
              </div>
            </div>
          ))}
        </CardBlock>
      </section>
    </Page>
  );
}

export function CasesPage() {
  const { showToast } = useSigcActions();
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
            <Link className="btn btn-primary" to="/manual-case"><Plus size={17} /> Nuevo caso</Link>
          </>
        )}
      />
      <section className="card filter-card">
        <div className="filter-grid phase2-filter-grid">
          <div className="filter-search-field"><Search size={17} /><input className="field" placeholder="Radicado, asunto, solicitante, empresa o correo" value={filters.query ?? ''} onChange={(event) => setFilter('query', event.target.value)} /></div>
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
  const { data: item, isLoading, source, warning, error } = useSigcCase(caseId);
  const { data: assignments } = useCaseAssignments(item?.databaseId ?? caseId);
  const [detailModal, setDetailModal] = useState<'assign' | 'state' | null>(null);

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
        description="Expediente dinámico conectado al caso real, con estado, SLA y asignaciones múltiples."
        actions={(
          <>
            <button className="btn btn-white" onClick={() => setDetailModal('assign')}><UserPlus size={17} /> Asignar</button>
            <button className="btn btn-white" onClick={() => setDetailModal('state')}><RefreshCw size={17} /> Cambiar estado</button>
            <button className="btn btn-primary" onClick={() => showToast('Los comentarios persistentes se habilitan en la Fase 3.')}><MessageSquarePlus size={17} /> Agregar comentario</button>
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
          <div className="bar-caption"><strong>Avance general</strong><span>{item.progress}%</span></div>
          <Progress value={item.progress} large />
          <div className="button-grid two">
            <button className="btn btn-soft" onClick={() => showToast('La gestión documental y versiones se habilita en la Fase 3.')}><Upload size={17} /> Cargar doc.</button>
            <button className="btn btn-white" onClick={() => showToast('Las modificaciones excepcionales de SLA se habilitan en la Fase 4.')}><TimerResetIcon /> Modificar SLA</button>
          </div>
        </div>
      </section>
      <section className="detail-grid">
        <div className="detail-main">
          <CardBlock title="Trazabilidad" description="Los cambios de estado ya se registran en base de datos; la línea de tiempo completa se conecta en Fase 3." icon={<RefreshCw />}>
            <div className="tabs"><button className="active">Vista previa</button><button disabled>Comentarios</button><button disabled>Cambios</button></div>
            <div className="timeline">
              {timeline.slice(0, 3).map(({ title, description, actor, date, icon: Icon }) => (
                <article className="timeline-item" key={title + date}>
                  <span className="timeline-dot" />
                  <div><div className="timeline-title"><strong>{title}</strong><div className="kpi-icon small"><Icon size={15} /></div></div><p>{description}</p><small>{actor} · {date}</small></div>
                </article>
              ))}
            </div>
          </CardBlock>
          <CardBlock title="Asignaciones del caso" description="Un mismo caso puede pertenecer simultáneamente a varias áreas y responsables." icon={<UserCog />}>
            {assignments.length ? assignments.map((assignment) => (
              <div className="assignment-summary" key={assignment.id}>
                <div><strong>{assignment.areaName}</strong><small>{assignment.responsibleName} · límite {assignment.due}</small></div>
                <div className="chip-row">{assignment.isPrimary ? <Badge tone="tone-dark">Principal</Badge> : null}<Badge tone="tone-slate">{assignment.state}</Badge></div>
              </div>
            )) : <div className="empty-inline">Este caso aún no tiene asignaciones.</div>}
          </CardBlock>
          <section className="grid-2">
            <CardBlock title="Subtareas del caso" description="Se conectarán al expediente en la Fase 3." icon={<CalendarCheck />}>{subtasks.slice(0, 3).map((task) => <SubtaskMini task={task} key={task.title} />)}</CardBlock>
            <CardBlock title="Documentos adjuntos" description="Versionamiento y Storage se conectarán en la Fase 3." icon={<Paperclip />}>{documents.slice(0, 3).map((doc) => <div className="doc-mini" key={doc.name}><div><strong>{doc.name}</strong><small>{doc.type} · {doc.version} · {doc.owner}</small></div><Badge tone={stateTones[doc.state] ?? 'tone-blue'}>{doc.state}</Badge></div>)}</CardBlock>
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
      {detailModal === 'assign' ? <AssignCaseModal caseId={item.databaseId ?? item.id} onClose={() => setDetailModal(null)} onSaved={() => { setDetailModal(null); showToast('Asignación registrada correctamente.'); }} /> : null}
      {detailModal === 'state' ? <ChangeCaseStateModal caseId={item.databaseId ?? item.id} onClose={() => setDetailModal(null)} onSaved={() => { setDetailModal(null); showToast('Estado actualizado correctamente.'); }} /> : null}
    </Page>
  );
}

export function PublicFormPage() {
  return (
    <Page centered>
      <section className="public-layout">
        <div className="public-intro hero-gradient">
          <Badge tone="chip-light">Formulario externo</Badge>
          <h1>Radica tu solicitud de forma segura.</h1>
          <p>El SIGC generará un número único e irrepetible y calculará la fecha límite según el tipo de caso.</p>
          <div className="public-benefits"><span><ShieldCheck /> Radicado automático.</span><span><MailCheck /> Datos listos para notificación.</span><span><CalendarDays /> SLA calculado por configuración.</span></div>
        </div>
        <div className="card public-card">
          <h2>Crear solicitud</h2>
          <p className="muted">El caso quedará en estado Pendiente de Clasificación.</p>
          <PublicCaseForm />
        </div>
      </section>
    </Page>
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
  const { data: cases } = useSigcCases();
  const states = ['Pendiente de Clasificación', 'Asignado', 'En Gestión', 'En Revisión / Aprobación', 'Cerrado'];
  const { showToast } = useSigcActions();
  return (
    <Page>
      <PageHead
        title="Cronograma / tablero operativo"
        description="Visualiza los casos como tarjetas de trabajo por estado, con vencimiento, semáforo, responsable y progreso."
        actions={<><button className="btn btn-white"><CalendarDays size={17} /> Vista timeline</button><button className="btn btn-soft" onClick={() => showToast('Movimiento visual registrado en el prototipo.')}><Move size={17} /> Modo arrastrar</button></>}
      />
      <section className="kanban-scroll">
        <div className="kanban-grid">
          {states.map((state) => {
            const columnItems = cases.filter((item) => item.state === state).concat(cases.filter((item) => item.state !== state).slice(0, state === 'Cerrado' ? 0 : 1)).slice(0, 3);
            return (
              <div className="kanban-col" key={state}>
                <header><strong>{state}</strong><Badge tone="tone-white">{cases.filter((item) => item.state === state).length || 1}</Badge></header>
                {columnItems.map((item) => <CaseCard item={item} key={`${state}-${item.id}`} />)}
                {state === 'Cerrado' ? <div className="empty-kanban"><Archive /><span>Sin cierres hoy</span></div> : null}
              </div>
            );
          })}
        </div>
      </section>
    </Page>
  );
}

export function SubtasksPage() {
  const { openModal } = useSigcActions();
  return (
    <Page>
      <PageHead title="Módulo de subtareas" description="Control granular de actividades por caso, responsable, fecha límite, estado y avance." actions={<button className="btn btn-primary" onClick={() => openModal('task')}><Plus size={17} /> Nueva subtarea</button>} />
      <section className="card table-card"><SubtasksTable /></section>
    </Page>
  );
}

export function DocumentsPage() {
  const { openModal } = useSigcActions();
  return (
    <Page>
      <PageHead title="Gestión documental" description="Repositorio por caso con control de versiones: ningún archivo se sobrescribe, cada cambio crea una nueva versión." actions={<><button className="btn btn-white"><Filter size={17} /> Filtrar</button><button className="btn btn-primary" onClick={() => openModal('document')}><Upload size={17} /> Cargar documento</button></>} />
      <section className="document-kpis">{[['Documentos', '186'], ['Versiones creadas', '412'], ['En revisión', '24'], ['Aprobados', '129']].map(([label, value]) => <article className="card" key={label}><span>{label}</span><strong>{value}</strong></article>)}</section>
      <section className="card table-card"><DocumentsTable /></section>
    </Page>
  );
}

export function ReportsPage() {
  const { data: cases } = useSigcCases();
  return (
    <Page>
      <PageHead title="Reportes" description="Generación de reportes filtrables por fecha, estado, área, responsable, tipo de caso y prioridad." actions={<><button className="btn btn-white"><FileSpreadsheet size={17} /> Excel</button><button className="btn btn-white"><FileText size={17} /> PDF</button><button className="btn btn-primary"><Download size={17} /> CSV</button></>} />
      <section className="reports-layout">
        <CardBlock title="Filtros de reporte" icon={<SlidersHorizontal />}>
          <div className="form-stack"><input className="field" type="date" /><input className="field" type="date" />{['Estado', 'Área', 'Responsable', 'Tipo de caso', 'Prioridad'].map((label) => <select className="field" key={label}><option>{label}</option></select>)}<button className="btn btn-primary full">Generar reporte</button></div>
        </CardBlock>
        <CardBlock title="Vista previa del reporte" description="Resumen antes de exportar." icon={<BarChart3 />} className="report-preview">
          <CasesTable rows={cases.slice(0, 5)} compact />
        </CardBlock>
      </section>
    </Page>
  );
}

export function AdminPage() {
  return (
    <Page>
      <PageHead title="Administración / configuración" description="Panel SaaS para parametrizar áreas, flujos, SLA, permisos, plantillas, notificaciones y automatizaciones sin tocar código." actions={<><button className="btn btn-white"><RefreshCw size={17} /> Auditoría</button><button className="btn btn-primary"><Plus size={17} /> Nuevo parámetro</button></>} />
      <section className="admin-grid">{adminModules.map(({ title, value, icon: Icon }) => <article className="card admin-card" key={title}><div className="kpi-icon"><Icon size={20} /></div><strong>{title}</strong><span>{value}</span></article>)}</section>
      <section className="grid-2 admin-detail">
        <CardBlock title="Flujo por tipo de caso" description="Estados aplicables según proceso." icon={<BarChart3 />}>
          {['Acción de Tutela', 'Contrato', 'Reclamo', 'Requerimiento Interno'].map((name, index) => <div className="flow-card" key={name}><div><strong>{name}</strong><span>{[8, 9, 7, 6][index]} estados</span></div><div className="chip-row">{['Clasificado', 'Asignado', 'En Gestión', 'Aprobado'].map((state) => <Badge key={state} tone={stateTones[state]}>{state}</Badge>)}</div></div>)}
        </CardBlock>
        <CardBlock title="Automatizaciones activas" description="Reglas parametrizables para escalar y notificar." icon={<Zap />}>
          {['Asignar tutelas a Jurídica automáticamente', 'Escalar casos críticos vencidos al Director', 'Crear subtarea al cargar documento de respuesta', 'Sugerir cierre cuando subtareas estén al 100%', 'Recordar 24 horas antes del vencimiento'].map((rule, index) => <div className="automation-row" key={rule}><div><strong>{rule}</strong><span>Regla {String(index + 1).padStart(2, '0')} · Activa</span></div><button className="btn btn-soft">Editar</button></div>)}
        </CardBlock>
      </section>
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
  return (
    <div className="sidebar-inner">
      <div className="brand">
        <div className="brand-mark">S</div>
        <div><strong>SIGC</strong><span>Sistema Integral de Gestión de Casos</span></div>
      </div>
      <nav className="side-nav">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} onClick={closeMobile} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Icon size={17} /><span>{label}</span>{to === '/admin' && unreadNotifications > 0 ? <em>{unreadNotifications}</em> : null}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-compliance card">
        <strong>Cumplimiento del mes</strong>
        <b>92.4%</b>
        <Progress value={92} />
        <p>3 casos críticos requieren revisión hoy.</p>
      </div>
      <NavLink to="/profile" className="sidebar-profile" onClick={closeMobile}>
        <UserCog size={18} />
        <div><strong>{currentUser?.name}</strong><span>{currentUser?.role === 'admin' ? 'Administrador' : 'Usuario'}</span></div>
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

function SubtasksTable() {
  return (
    <div className="table-scroll">
      <table className="case-table subtasks-table">
        <thead><tr>{['Subtarea', 'Caso', 'Responsable', 'Fecha límite', 'Estado', 'Prioridad', 'Comentarios', 'Adjuntos', 'Avance'].map((header) => <th key={header}>{header}</th>)}</tr></thead>
        <tbody>{subtasks.map((task) => <tr key={task.title}><td><strong>{task.title}</strong></td><td>{task.caseId}</td><td>{task.owner}</td><td>{task.due}</td><td><Badge tone={stateTones[task.state] ?? 'tone-slate'}>{task.state}</Badge></td><td><Badge tone={priorityTones[task.priority]}>{task.priority}</Badge></td><td>{task.comments}</td><td>{task.attachments}</td><td><div className="progress-cell"><Progress value={task.progress} /><b>{task.progress}%</b></div></td></tr>)}</tbody>
      </table>
    </div>
  );
}

function DocumentsTable() {
  return (
    <div className="table-scroll">
      <table className="case-table docs-table">
        <thead><tr>{['Archivo', 'Caso', 'Tipo', 'Versión', 'Cargado por', 'Fecha', 'Estado', 'Acciones'].map((header) => <th key={header}>{header}</th>)}</tr></thead>
        <tbody>{documents.map((doc) => <tr key={doc.name}><td><strong className="file-name"><File size={16} />{doc.name}</strong></td><td>{doc.caseId}</td><td>{doc.type}</td><td><Badge tone="tone-slate">{doc.version}</Badge></td><td>{doc.owner}</td><td>{doc.date}</td><td><Badge tone={stateTones[doc.state] ?? 'tone-blue'}>{doc.state}</Badge></td><td><button className="btn btn-white small">Ver</button><button className="btn btn-soft small">Nueva versión</button></td></tr>)}</tbody>
      </table>
    </div>
  );
}

function SubtaskMini({ task }: { task: { title: string; state: string; owner: string; due: string; progress: number } }) {
  return <div className="subtask-mini"><div><strong>{task.title}</strong><Badge tone={stateTones[task.state] ?? 'tone-slate'}>{task.state}</Badge></div><small>{task.owner} · {task.due}</small><Progress value={task.progress} /></div>;
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

function ActionModal({ kind, onClose, onSave }: { kind: Exclude<ModalKind, null>; onClose: () => void; onSave: () => void }) {
  const content = getModalContent(kind);
  return (
    <section className="modal open">
      <header><h3>{content.title}</h3><button className="btn btn-white icon-only" onClick={onClose}><X size={17} /></button></header>
      <div className="modal-body">{content.body}<div className="modal-actions"><button className="btn btn-white" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={onSave}>Guardar</button></div></div>
    </section>
  );
}

function getModalContent(kind: Exclude<ModalKind, null>): { title: string; body: ReactNode } {
  const selectUsers = <select className="field"><option>Laura Méndez</option><option>Felipe Vargas</option><option>Mónica Díaz</option></select>;
  if (kind === 'assign') return { title: 'Asignar responsable', body: <><>{selectUsers}</><textarea className="field textarea" placeholder="Observaciones de asignación" /></> };
  if (kind === 'state') return { title: 'Cambiar estado', body: <><select className="field"><option>En Gestión</option><option>En Revisión / Aprobación</option><option>Aprobado</option><option>Cerrado</option></select><textarea className="field textarea" placeholder="Justificación del cambio" /></> };
  if (kind === 'sla') return { title: 'Modificar SLA excepcionalmente', body: <><input className="field" type="datetime-local" /><textarea className="field textarea" placeholder="Justificación obligatoria para auditoría" /></> };
  if (kind === 'comment') return { title: 'Agregar comentario interno', body: <><textarea className="field textarea tall" placeholder="Comentario interno no eliminable" /><div className="upload-zone small">Adjuntar archivos opcionalmente</div></> };
  if (kind === 'document') return { title: 'Cargar documento / nueva versión', body: <><input className="field" type="file" /><select className="field"><option>Documento nuevo</option><option>Nueva versión de documento existente</option></select><textarea className="field textarea" placeholder="Descripción de la versión" /></> };
  return { title: 'Crear subtarea', body: <><input className="field" placeholder="Nombre de la subtarea" />{selectUsers}<input className="field" type="date" /><select className="field"><option>Prioridad</option><option>Crítica</option><option>Alta</option><option>Media</option><option>Baja</option></select></> };
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
  openModal: (kind: Exclude<ModalKind, null>) => void;
  showToast: (text: string) => void;
};

