import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Download,
  FileSpreadsheet,
  FileText,
  Gauge,
  RefreshCw,
  ShieldCheck,
  Users
} from 'lucide-react';
import type { AnalyticsValue, SigcReportExportFormat, SigcReportFilters } from '../domain/types';
import { useAuthorization } from '../../authz/AuthorizationProvider';
import { PERMISSIONS } from '../../authz/permissions';
import { useSigcCatalogs, useSigcDashboard, useSigcMembers, useSigcReport } from '../hooks/useSigcData';
import { sigcService } from '../services/sigcService';
import { createCsvBlob, createPdfBlob, createXlsxBlob, downloadBlob } from '../utils/reportExports';

function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(value);
}

function formatDate(value?: string | null): string {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    : value;
}

function MetricCard({ label, value, helper, icon: Icon, danger = false }: { label: string; value: string; helper: string; icon: typeof Gauge; danger?: boolean }) {
  return <article className={`card kpi-card ${danger ? 'danger' : ''}`}><div className="kpi-top"><Icon size={21} /><span>{helper}</span></div><p>{label}</p><strong>{value}</strong></article>;
}

function DistributionBars({ values, empty = 'Sin datos para el período.' }: { values: AnalyticsValue[]; empty?: string }) {
  const max = Math.max(1, ...values.map((item) => item.value));
  if (!values.length) return <div className="empty-inline">{empty}</div>;
  return <div className="area-bars">{values.slice(0, 10).map((item) => <div key={`${item.label}-${item.value}`}><div className="bar-caption"><strong>{item.label}</strong><span>{formatNumber(item.value)}</span></div><span className="progress"><i style={{ width: `${Math.max(4, item.value / max * 100)}%` }} /></span></div>)}</div>;
}

function AnalyticsPanel({ title, description, children, icon }: { title: string; description: string; children: React.ReactNode; icon: React.ReactNode }) {
  return <section className="card block-card"><header className="card-title"><div><h2>{title}</h2><p>{description}</p></div><div className="kpi-icon">{icon}</div></header>{children}</section>;
}

export function AnalyticsDashboardPage() {
  const { data, isLoading, error, warning, reload, source } = useSigcDashboard();
  const maxMonthly = Math.max(1, ...(data?.monthly.flatMap((item) => [item.created, item.closed]) ?? [1]));

  return <div className="page">
    <header className="page-head"><div><span className="eyebrow">Analítica operativa · tiempo real</span><h1>Dashboard principal</h1><p>Control ejecutivo de carga, vencimientos, cumplimiento de SLA, prioridades y productividad.</p></div><div className="page-actions"><button className="btn btn-soft" onClick={reload} disabled={isLoading}><RefreshCw size={17} /> Actualizar</button><Link className="btn btn-primary" to="/reports"><Download size={17} /> Generar reporte</Link></div></header>
    {warning ? <div className="alert danger">{warning}</div> : null}{error ? <div className="alert danger">{error}</div> : null}
    <section className="hero-card hero-gradient"><div className="hero-content"><div><span className="chip chip-light">Centro de mando · {source === 'supabase' ? 'Supabase' : 'Demo'}</span><h2>Prioriza lo vencido, detecta cuellos de botella y mide el desempeño con información actualizada.</h2><p>{data ? `Última consolidación: ${formatDate(data.generatedAt)}.` : 'Calculando indicadores del espacio de trabajo...'}</p></div><div className="hero-stats"><div><span>Creados hoy</span><strong>{data?.summary.createdToday ?? '—'}</strong></div><div><span>Críticos</span><strong>{data?.summary.criticalCases ?? '—'}</strong></div></div></div></section>

    <section className="kpi-grid">
      <MetricCard label="Casos abiertos" value={formatNumber(data?.summary.openCases ?? 0)} helper="Carga activa" icon={Activity} />
      <MetricCard label="Casos cerrados" value={formatNumber(data?.summary.closedCases ?? 0)} helper="Acumulado" icon={CheckCircle2} />
      <MetricCard label="Casos vencidos" value={formatNumber(data?.summary.overdueCases ?? 0)} helper="Requieren acción" icon={AlertTriangle} danger={(data?.summary.overdueCases ?? 0) > 0} />
      <MetricCard label="Cumplimiento SLA" value={`${formatNumber(data?.summary.slaCompliancePct ?? 0)}%`} helper="Casos resueltos" icon={ShieldCheck} />
      <MetricCard label="Próximos 72 h" value={formatNumber(data?.summary.dueSoonCases ?? 0)} helper="Prevención" icon={CalendarClock} />
      <MetricCard label="Tiempo medio" value={`${formatNumber(data?.summary.avgResolutionHours ?? 0)} h`} helper="Resolución" icon={Clock3} />
    </section>

    <section className="grid-2-1">
      <AnalyticsPanel title="Casos creados vs cerrados" description="Tendencia de los últimos 12 meses." icon={<BarChart3 size={20} />}>
        <div className="phase78-monthly-chart">{(data?.monthly ?? []).map((item) => <div className="phase78-month" key={item.month}><div className="phase78-month-bars"><i className="created" style={{ height: `${Math.max(4, item.created / maxMonthly * 180)}px` }} title={`Creados: ${item.created}`} /><i className="closed" style={{ height: `${Math.max(4, item.closed / maxMonthly * 180)}px` }} title={`Cerrados: ${item.closed}`} /></div><small>{item.label}</small><b>{item.created}/{item.closed}</b></div>)}</div><div className="phase78-legend"><span><i className="created" /> Creados</span><span><i className="closed" /> Cerrados</span></div>
      </AnalyticsPanel>
      <AnalyticsPanel title="Carga por área" description="Casos abiertos actualmente." icon={<Users size={20} />}><DistributionBars values={data?.byArea ?? []} /></AnalyticsPanel>
    </section>

    <section className="grid-3">
      <AnalyticsPanel title="Carga por prioridad" description="Backlog abierto por prioridad parametrizada." icon={<AlertTriangle size={20} />}><DistributionBars values={data?.byPriority ?? []} /></AnalyticsPanel>
      <AnalyticsPanel title="Tiempo promedio por área" description="Horas promedio de resolución de casos cerrados." icon={<Clock3 size={20} />}><DistributionBars values={data?.avgResolutionByArea ?? []} /></AnalyticsPanel>
      <AnalyticsPanel title="Productividad por área" description="Casos cerrados en los últimos 90 días." icon={<Gauge size={20} />}><div className="phase78-productivity">{data?.productivityByArea.length ? data.productivityByArea.slice(0, 10).map((item) => <div key={item.label} className="phase78-productivity-row"><div><strong>{item.label}</strong><small>{item.closed} cerrados de {item.created} creados</small></div><span>{formatNumber(item.closureRatePct)}%</span></div>) : <div className="empty-inline">Sin datos de productividad.</div>}</div></AnalyticsPanel>
    </section>

    <section className="grid-3">
      <AnalyticsPanel title="Casos críticos" description="Vencidos o con prioridad crítica." icon={<AlertTriangle size={20} />}><div className="stack-list">{data?.criticalCases.length ? data.criticalCases.map((item) => <Link className="compact-card" to={`/cases/${encodeURIComponent(item.radicado)}`} key={item.id}><div><strong>{item.radicado}</strong><span className={`chip ${item.overdue ? 'tone-red' : 'tone-orange'}`}>{item.priority}</span></div><p>{item.subject}</p><small>{item.overdue ? 'Vencido' : `Límite ${formatDate(item.dueAt)}`} · {item.owner}</small></Link>) : <div className="empty-inline">No hay casos críticos.</div>}</div></AnalyticsPanel>
      <AnalyticsPanel title="Mi trabajo" description="Subtareas pendientes asignadas a ti." icon={<CheckCircle2 size={20} />}><div className="check-list">{data?.myWork.length ? data.myWork.map((item) => <Link className="phase78-work-row" to={`/cases/${encodeURIComponent(item.radicado)}`} key={item.id}><span><strong>{item.title}</strong><small>{item.radicado} · {formatDate(item.dueAt)}</small></span><b>{item.progress}%</b></Link>) : <div className="empty-inline">No tienes subtareas pendientes.</div>}</div></AnalyticsPanel>
      <AnalyticsPanel title="Carga por responsable" description="Distribución de casos abiertos." icon={<Gauge size={20} />}><DistributionBars values={data?.byOwner ?? []} /></AnalyticsPanel>
    </section>

    <section className="grid-2 phase78-lower-grid">
      <AnalyticsPanel title="Distribución por tipo" description="Volumen acumulado de casos." icon={<BarChart3 size={20} />}><DistributionBars values={data?.byType ?? []} /></AnalyticsPanel>
      <AnalyticsPanel title="Actividad reciente" description="Últimos eventos auditados de la organización." icon={<Activity size={20} />}><div className="phase78-activity">{data?.recentActivity.length ? data.recentActivity.map((item) => <div key={item.id}><span className="phase78-activity-dot" /><div><strong>{item.eventType}</strong><small>{item.actor} · {formatDate(item.createdAt)}{item.radicado ? ` · ${item.radicado}` : ''}</small></div></div>) : <div className="empty-inline">Aún no hay eventos de auditoría.</div>}</div></AnalyticsPanel>
    </section>
  </div>;
}

function localDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function defaultReportRange(): Pick<SigcReportFilters, 'from' | 'to'> {
  const now = new Date();
  return { from: `${now.getFullYear()}-01-01`, to: localDateInputValue(now) };
}

function exportFilename(kind: SigcReportExportFormat, filters: SigcReportFilters): string {
  return `SIGC_reporte_${filters.from}_${filters.to}.${kind}`;
}

export function AnalyticsReportsPage() {
  const { can } = useAuthorization();
  const canExport = can(PERMISSIONS.reportsExport);
  const [filters, setFilters] = useState<SigcReportFilters>(() => ({ ...defaultReportRange(), page: 1, pageSize: 100 }));
  const validRange = Boolean(filters.from && filters.to && filters.from <= filters.to);
  const queryFilters = useMemo(() => ({ ...filters }), [filters]);
  const { data: report, isLoading, error, warning, reload, source } = useSigcReport(queryFilters, validRange);
  const { data: catalogs } = useSigcCatalogs();
  const { data: members } = useSigcMembers();
  const [message, setMessage] = useState('');
  const [exporting, setExporting] = useState<SigcReportExportFormat | null>(null);
  const [exportProgress, setExportProgress] = useState(0);

  function update<K extends keyof SigcReportFilters>(key: K, value: SigcReportFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value, ...(key === 'page' ? {} : { page: 1 }) }));
  }

  async function runExport(kind: SigcReportExportFormat) {
    if (!canExport) { setMessage('Tu rol puede consultar reportes, pero no exportarlos.'); return; }
    if (!report || !validRange || exporting) return;
    let jobId: string | null = null;
    try {
      setMessage('');
      setExporting(kind);
      setExportProgress(0);
      const exportFilters: SigcReportFilters = { ...filters, page: undefined, pageSize: undefined };
      const job = await sigcService.createReportExportJob(kind, exportFilters);
      jobId = job.id;
      const rows = [] as typeof report.rows;
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const batch = await sigcService.getReportExportPage(job.id, page, 1000);
        rows.push(...batch.rows);
        hasMore = batch.hasMore;
        setExportProgress(batch.job.progressPct);
        page += 1;
      }
      const blob = kind === 'csv' ? createCsvBlob(rows) : kind === 'xlsx' ? createXlsxBlob(report, rows) : createPdfBlob(report, rows);
      downloadBlob(exportFilename(kind, filters), blob);
      await sigcService.completeReportExportJob(job.id, 'completed');
      setExportProgress(100);
      setMessage(`${kind.toUpperCase()} generado con ${formatNumber(rows.length)} filas.`);
    } catch (exportError) {
      if (jobId) await sigcService.completeReportExportJob(jobId, 'failed', exportError instanceof Error ? exportError.message : 'Error de exportación').catch(() => undefined);
      setMessage(exportError instanceof Error ? exportError.message : 'No fue posible exportar.');
    } finally {
      setExporting(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil((report?.totalRows ?? 0) / Math.max(1, report?.pageSize ?? 100)));

  return <div className="page">
    <header className="page-head"><div><span className="eyebrow">Explotación de datos · exportación completa</span><h1>Reportes</h1><p>Consulta con paginación de servidor y exporta el universo completo a CSV, XLSX o PDF real.</p></div>{canExport ? <div className="page-actions"><button className="btn btn-white" onClick={() => runExport('xlsx')} disabled={!report?.totalRows || Boolean(exporting) || !validRange}><FileSpreadsheet size={17} /> XLSX</button><button className="btn btn-white" onClick={() => runExport('pdf')} disabled={!report?.totalRows || Boolean(exporting) || !validRange}><FileText size={17} /> PDF</button><button className="btn btn-primary" onClick={() => runExport('csv')} disabled={!report?.totalRows || Boolean(exporting) || !validRange}><Download size={17} /> CSV</button></div> : <div className="page-actions"><span className="chip tone-slate">Consulta sin permiso de exportación</span></div>}</header>

    <section className="card filter-card"><div className="phase78-report-filters"><label>Desde<input className="field" type="date" max={filters.to} value={filters.from} onChange={(event) => update('from', event.target.value)} /></label><label>Hasta<input className="field" type="date" min={filters.from} value={filters.to} onChange={(event) => update('to', event.target.value)} /></label><select className="field" value={filters.stateId ?? ''} onChange={(event) => update('stateId', event.target.value || undefined)}><option value="">Todos los estados</option>{catalogs?.states.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select className="field" value={filters.areaId ?? ''} onChange={(event) => update('areaId', event.target.value || undefined)}><option value="">Todas las áreas</option>{catalogs?.areas.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select className="field" value={filters.ownerId ?? ''} onChange={(event) => update('ownerId', event.target.value || undefined)}><option value="">Todos los responsables</option>{members.map((item) => <option key={item.userId} value={item.userId}>{item.name}</option>)}</select><select className="field" value={filters.caseTypeId ?? ''} onChange={(event) => update('caseTypeId', event.target.value || undefined)}><option value="">Todos los tipos</option>{catalogs?.caseTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select className="field" value={filters.priorityId ?? ''} onChange={(event) => update('priorityId', event.target.value || undefined)}><option value="">Todas las prioridades</option>{catalogs?.priorities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button className={`btn ${filters.overdueOnly ? 'btn-primary' : 'btn-white'}`} onClick={() => update('overdueOnly', !filters.overdueOnly)}>Solo vencidos</button><button className="btn btn-soft" onClick={reload} disabled={isLoading || !validRange}><RefreshCw size={17} /> Consultar</button></div></section>
    {!validRange ? <div className="alert danger">La fecha inicial no puede ser posterior a la fecha final.</div> : null}
    {warning ? <div className="alert danger">{warning}</div> : null}{error ? <div className="alert danger">{error}</div> : null}{message ? <div className="phase78-inline-message">{message}</div> : null}
    {exporting ? <div className="card phase78-export-progress"><div><strong>Generando {exporting.toUpperCase()}</strong><span>{formatNumber(exportProgress)}%</span></div><span className="progress"><i style={{ width: `${Math.max(2, exportProgress)}%` }} /></span><small>La exportación recupera todas las páginas del reporte; no está limitada por la página visible.</small></div> : null}

    <section className="kpi-grid phase78-report-kpis">
      <MetricCard label="Total" value={formatNumber(report?.summary.totalCases ?? 0)} helper={source === 'supabase' ? 'Datos reales' : 'Demo'} icon={BarChart3} />
      <MetricCard label="Abiertos" value={formatNumber(report?.summary.openCases ?? 0)} helper="En gestión" icon={Activity} />
      <MetricCard label="Cerrados" value={formatNumber(report?.summary.closedCases ?? 0)} helper="Finalizados" icon={CheckCircle2} />
      <MetricCard label="Vencidos" value={formatNumber(report?.summary.overdueCases ?? 0)} helper="Fuera de SLA" icon={AlertTriangle} danger={(report?.summary.overdueCases ?? 0)>0} />
      <MetricCard label="Cumplimiento SLA" value={`${formatNumber(report?.summary.slaCompliancePct ?? 0)}%`} helper="Cerrados con fecha" icon={ShieldCheck} />
      <MetricCard label="Tiempo promedio" value={`${formatNumber(report?.summary.avgResolutionHours ?? 0)} h`} helper="Resolución" icon={Clock3} />
    </section>

    <section className="grid-3 phase78-report-distributions"><AnalyticsPanel title="Por área" description="Distribución del período." icon={<Users size={20} />}><DistributionBars values={report?.byArea ?? []} /></AnalyticsPanel><AnalyticsPanel title="Por tipo" description="Naturaleza de los casos." icon={<BarChart3 size={20} />}><DistributionBars values={report?.byType ?? []} /></AnalyticsPanel><AnalyticsPanel title="Por estado" description="Etapa actual del flujo." icon={<Gauge size={20} />}><DistributionBars values={report?.byState ?? []} /></AnalyticsPanel></section>
    <section className="grid-3 phase78-report-distributions"><AnalyticsPanel title="Prioridad" description="Distribución por prioridad." icon={<AlertTriangle size={20} />}><DistributionBars values={report?.byPriority ?? []} /></AnalyticsPanel><AnalyticsPanel title="Riesgo" description="Concentración por nivel declarado." icon={<AlertTriangle size={20} />}><DistributionBars values={report?.byRisk ?? []} /></AnalyticsPanel><AnalyticsPanel title="SLA por área" description="Porcentaje de cierres dentro de fecha." icon={<ShieldCheck size={20} />}><DistributionBars values={(report?.slaByArea ?? []).map((item) => ({ label: `${item.label} · ${item.compliant}/${item.total}`, value: item.value }))} /></AnalyticsPanel></section>

    <AnalyticsPanel title="Throughput mensual" description="Casos creados frente a casos cerrados durante el rango consultado." icon={<BarChart3 size={20} />}>
      <div className="phase78-monthly-chart">{(report?.throughput ?? []).map((item) => { const max = Math.max(1, ...(report?.throughput ?? []).flatMap((point) => [point.created, point.closed])); return <div className="phase78-month" key={item.month}><div className="phase78-month-bars"><i className="created" style={{ height: `${Math.max(4, item.created / max * 180)}px` }} title={`Creados: ${item.created}`} /><i className="closed" style={{ height: `${Math.max(4, item.closed / max * 180)}px` }} title={`Cerrados: ${item.closed}`} /></div><span>{item.label}</span></div>; })}</div>
    </AnalyticsPanel>

    <section className="card table-card phase78-report-table"><div className="phase78-table-head"><div><strong>Detalle del reporte</strong><span>{isLoading ? 'Consultando...' : `${formatNumber(report?.totalRows ?? 0)} filas totales · página ${report?.page ?? 1} de ${totalPages}`}</span></div></div><div className="table-scroll"><table className="case-table"><thead><tr>{['Radicado','Tipo','Asunto','Empresa','Área','Responsable','Estado','Prioridad','Creado','Fecha límite','SLA','Avance'].map((item)=><th key={item}>{item}</th>)}</tr></thead><tbody>{report?.rows.length ? report.rows.map((row)=><tr key={row.id}><td><Link className="radicado" to={`/cases/${encodeURIComponent(row.radicado)}`}>{row.radicado}</Link></td><td>{row.caseType}</td><td><strong className="truncate">{row.subject}</strong><small>{row.requesterName}</small></td><td>{row.requesterCompany || '—'}</td><td>{row.area}</td><td>{row.owner}</td><td><span className="chip tone-slate">{row.state}</span></td><td>{row.priority}</td><td>{formatDate(row.openedAt)}</td><td>{formatDate(row.dueAt)}</td><td><span className={`chip ${row.overdue ? 'tone-red' : row.slaMet === false ? 'tone-orange' : 'tone-green'}`}>{row.overdue ? 'Vencido' : row.slaMet == null ? 'En curso' : row.slaMet ? 'Cumplido' : 'Incumplido'}</span></td><td>{row.progress}%</td></tr>) : <tr><td colSpan={12}><div className="empty-inline">No hay casos para los filtros seleccionados.</div></td></tr>}</tbody></table></div>{totalPages > 1 ? <div className="phase78-pagination"><button className="btn btn-white" disabled={(filters.page ?? 1) <= 1 || isLoading} onClick={() => update('page', Math.max(1, (filters.page ?? 1) - 1))}>Anterior</button><span>Página {filters.page ?? 1} de {totalPages}</span><button className="btn btn-white" disabled={(filters.page ?? 1) >= totalPages || isLoading} onClick={() => update('page', Math.min(totalPages, (filters.page ?? 1) + 1))}>Siguiente</button></div> : null}</section>
  </div>;
}
