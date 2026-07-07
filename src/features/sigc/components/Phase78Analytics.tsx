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
import type { AnalyticsValue, SigcReportFilters, SigcReportResult, SigcReportRow } from '../domain/types';
import { useAuthorization } from '../../authz/AuthorizationProvider';
import { PERMISSIONS } from '../../authz/permissions';
import { useSigcCatalogs, useSigcDashboard, useSigcMembers, useSigcReport } from '../hooks/useSigcData';

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

function downloadBlob(filename: string, content: BlobPart, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value: unknown): string {
  const raw = String(value ?? '');
  const text = /^[=+@-]/.test(raw) ? `'${raw}` : raw;
  return `"${text.replace(/"/g, '""')}"`;
}

const REPORT_COLUMNS: Array<[keyof SigcReportRow, string]> = [
  ['radicado', 'Radicado'], ['caseType', 'Tipo'], ['subject', 'Asunto'], ['requesterCompany', 'Empresa'],
  ['requesterName', 'Solicitante'], ['area', 'Área'], ['owner', 'Responsable'], ['state', 'Estado'],
  ['priority', 'Prioridad'], ['openedAt', 'Creado'], ['dueAt', 'Fecha límite'], ['closedAt', 'Cerrado'],
  ['overdue', 'Vencido'], ['slaMet', 'Cumplió SLA'], ['resolutionHours', 'Horas resolución'], ['progress', 'Avance %']
];

function exportCsv(report: SigcReportResult): void {
  const header = REPORT_COLUMNS.map(([, label]) => csvCell(label)).join(',');
  const rows = report.rows.map((row) => REPORT_COLUMNS.map(([key]) => {
    const value = row[key];
    if (key === 'openedAt' || key === 'dueAt' || key === 'closedAt') return csvCell(value ? formatDate(String(value)) : '');
    if (key === 'overdue') return csvCell(value ? 'Sí' : 'No');
    if (key === 'slaMet') return csvCell(value == null ? '' : value ? 'Sí' : 'No');
    return csvCell(value);
  }).join(','));
  downloadBlob(`SIGC_reporte_${report.from.slice(0, 10)}_${report.to.slice(0, 10)}.csv`, `\uFEFF${[header, ...rows].join('\n')}`, 'text/csv;charset=utf-8');
}

function xmlEscape(value: unknown): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function exportExcel(report: SigcReportResult): void {
  const cells = (values: unknown[]) => `<Row>${values.map((value) => `<Cell><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`).join('')}</Row>`;
  const detailRows = report.rows.map((row) => cells(REPORT_COLUMNS.map(([key]) => {
    const value = row[key];
    if (key === 'openedAt' || key === 'dueAt' || key === 'closedAt') return value ? formatDate(String(value)) : '';
    if (key === 'overdue') return value ? 'Sí' : 'No';
    if (key === 'slaMet') return value == null ? '' : value ? 'Sí' : 'No';
    return value;
  }))).join('');
  const summaryRows = [
    ['Indicador', 'Valor'],
    ['Total de casos', report.summary.totalCases],
    ['Casos abiertos', report.summary.openCases],
    ['Casos cerrados', report.summary.closedCases],
    ['Casos vencidos', report.summary.overdueCases],
    ['Cumplimiento SLA', `${report.summary.slaCompliancePct}%`],
    ['Tiempo promedio de resolución', `${report.summary.avgResolutionHours} h`]
  ].map(cells).join('');
  const distributionRows = [
    ['Dimensión', 'Categoría', 'Valor'],
    ...report.byArea.map((item) => ['Área', item.label, item.value]),
    ...report.byOwner.map((item) => ['Responsable', item.label, item.value]),
    ...report.byState.map((item) => ['Estado', item.label, item.value]),
    ...report.byType.map((item) => ['Tipo', item.label, item.value]),
    ...report.byPriority.map((item) => ['Prioridad', item.label, item.value]),
    ...report.byRisk.map((item) => ['Riesgo', item.label, item.value]),
    ...report.agingBuckets.map((item) => ['Antigüedad', item.label, item.value])
  ].map(cells).join('');
  const slaRows = [
    ['Área', 'Cumplimiento %', 'Cumplidos', 'Total evaluable'],
    ...report.slaByArea.map((item) => [item.label, item.value, item.compliant, item.total])
  ].map(cells).join('');
  const throughputRows = [
    ['Mes', 'Creados', 'Cerrados'],
    ...report.throughput.map((item) => [item.label, item.created, item.closed])
  ].map(cells).join('');
  const xml = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Resumen"><Table>${summaryRows}</Table></Worksheet><Worksheet ss:Name="Distribuciones"><Table>${distributionRows}</Table></Worksheet><Worksheet ss:Name="SLA por area"><Table>${slaRows}</Table></Worksheet><Worksheet ss:Name="Throughput"><Table>${throughputRows}</Table></Worksheet><Worksheet ss:Name="Casos"><Table>${cells(REPORT_COLUMNS.map(([, label]) => label))}${detailRows}</Table></Worksheet></Workbook>`;
  downloadBlob(`SIGC_reporte_${report.from.slice(0, 10)}_${report.to.slice(0, 10)}.xls`, xml, 'application/vnd.ms-excel;charset=utf-8');
}

function printPdf(report: SigcReportResult): void {
  const popup = window.open('', '_blank', 'width=1200,height=800');
  if (!popup) throw new Error('El navegador bloqueó la ventana de impresión.');
  popup.opener = null;
  const rows = report.rows.map((row) => `<tr>${REPORT_COLUMNS.slice(0, 12).map(([key]) => `<td>${xmlEscape((key === 'openedAt' || key === 'dueAt' || key === 'closedAt') && row[key] ? formatDate(String(row[key])) : row[key])}</td>`).join('')}</tr>`).join('');
  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Reporte SIGC</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#111827}h1{margin:0}p{color:#64748b}section{display:flex;gap:12px;margin:18px 0}.k{border:1px solid #ddd;border-radius:10px;padding:10px 14px}.k b{display:block;font-size:22px}table{width:100%;border-collapse:collapse;font-size:9px}th,td{border:1px solid #ddd;padding:5px;text-align:left}th{background:#f1f5f9}@media print{body{padding:0}@page{size:landscape;margin:10mm}}</style></head><body><h1>Reporte SIGC</h1><p>${xmlEscape(report.from.slice(0, 10))} a ${xmlEscape(report.to.slice(0, 10))} · Generado ${xmlEscape(formatDate(report.generatedAt))}</p><section><div class="k">Total<b>${report.summary.totalCases}</b></div><div class="k">Abiertos<b>${report.summary.openCases}</b></div><div class="k">Vencidos<b>${report.summary.overdueCases}</b></div><div class="k">Cumplimiento SLA<b>${report.summary.slaCompliancePct}%</b></div></section><table><thead><tr>${REPORT_COLUMNS.slice(0, 12).map(([, label]) => `<th>${xmlEscape(label)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table><script>window.onload=()=>{window.print()}</script></body></html>`);
  popup.document.close();
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
    <header className="page-head"><div><span className="eyebrow">Analítica operativa · datos reales</span><h1>Dashboard principal</h1><p>Control ejecutivo de carga, vencimientos, cumplimiento de SLA y capacidad por área.</p></div><div className="page-actions"><button className="btn btn-soft" onClick={reload} disabled={isLoading}><RefreshCw size={17} /> Actualizar</button><Link className="btn btn-primary" to="/reports"><Download size={17} /> Generar reporte</Link></div></header>
    {warning ? <div className="alert danger">{warning}</div> : null}{error ? <div className="alert danger">{error}</div> : null}
    <section className="hero-card hero-gradient"><div className="hero-content"><div><span className="chip chip-light">Centro de mando · {source === 'supabase' ? 'Supabase' : 'Demo'}</span><h2>Prioriza lo vencido, detecta cuellos de botella y mide el cumplimiento con información actualizada.</h2><p>{data ? `Última consolidación: ${formatDate(data.generatedAt)}.` : 'Calculando indicadores del espacio de trabajo...'}</p></div><div className="hero-stats"><div><span>Creados hoy</span><strong>{data?.summary.createdToday ?? '—'}</strong></div><div><span>Críticos</span><strong>{data?.summary.criticalCases ?? '—'}</strong></div></div></div></section>

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

export function AnalyticsReportsPage() {
  const { can } = useAuthorization();
  const canExport = can(PERMISSIONS.reportsExport);
  const [filters, setFilters] = useState<SigcReportFilters>(() => ({ ...defaultReportRange() }));
  const queryFilters = useMemo(() => ({ ...filters }), [filters]);
  const { data: report, isLoading, error, warning, reload, source } = useSigcReport(queryFilters);
  const { data: catalogs } = useSigcCatalogs();
  const { data: members } = useSigcMembers();
  const [message, setMessage] = useState('');

  function update<K extends keyof SigcReportFilters>(key: K, value: SigcReportFilters[K]) { setFilters((current) => ({ ...current, [key]: value })); }
  function runExport(kind: 'csv' | 'excel' | 'pdf') {
    if (!canExport) {
      setMessage('Tu rol puede consultar reportes, pero no exportarlos.');
      return;
    }
    if (!report) return;
    try {
      if (kind === 'csv') exportCsv(report);
      if (kind === 'excel') exportExcel(report);
      if (kind === 'pdf') printPdf(report);
      setMessage(kind === 'pdf' ? 'Vista de impresión abierta. Selecciona “Guardar como PDF”.' : 'Archivo generado correctamente.');
    } catch (exportError) { setMessage(exportError instanceof Error ? exportError.message : 'No fue posible exportar.'); }
  }

  return <div className="page">
    <header className="page-head"><div><span className="eyebrow">Explotación de datos · Fase 14</span><h1>Reportes reales</h1><p>Filtra el universo de casos, analiza backlog, SLA y throughput, y exporta el mismo universo visible en el SIGC.</p></div>{canExport ? <div className="page-actions"><button className="btn btn-white" onClick={() => runExport('excel')} disabled={!report?.rows.length}><FileSpreadsheet size={17} /> Excel</button><button className="btn btn-white" onClick={() => runExport('pdf')} disabled={!report?.rows.length}><FileText size={17} /> PDF</button><button className="btn btn-primary" onClick={() => runExport('csv')} disabled={!report?.rows.length}><Download size={17} /> CSV</button></div> : <div className="page-actions"><span className="chip tone-slate">Consulta sin permiso de exportación</span></div>}</header>

    <section className="card filter-card"><div className="phase78-report-filters"><label>Desde<input className="field" type="date" value={filters.from} onChange={(event) => update('from', event.target.value)} /></label><label>Hasta<input className="field" type="date" value={filters.to} onChange={(event) => update('to', event.target.value)} /></label><select className="field" value={filters.stateId ?? ''} onChange={(event) => update('stateId', event.target.value || undefined)}><option value="">Todos los estados</option>{catalogs?.states.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select className="field" value={filters.areaId ?? ''} onChange={(event) => update('areaId', event.target.value || undefined)}><option value="">Todas las áreas</option>{catalogs?.areas.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select className="field" value={filters.ownerId ?? ''} onChange={(event) => update('ownerId', event.target.value || undefined)}><option value="">Todos los responsables</option>{members.map((item) => <option key={item.userId} value={item.userId}>{item.name}</option>)}</select><select className="field" value={filters.caseTypeId ?? ''} onChange={(event) => update('caseTypeId', event.target.value || undefined)}><option value="">Todos los tipos</option>{catalogs?.caseTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select className="field" value={filters.priorityId ?? ''} onChange={(event) => update('priorityId', event.target.value || undefined)}><option value="">Todas las prioridades</option>{catalogs?.priorities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button className={`btn ${filters.overdueOnly ? 'btn-primary' : 'btn-white'}`} onClick={() => update('overdueOnly', !filters.overdueOnly)}>Solo vencidos</button><button className="btn btn-soft" onClick={reload} disabled={isLoading}><RefreshCw size={17} /> Consultar</button></div></section>
    {warning ? <div className="alert danger">{warning}</div> : null}{error ? <div className="alert danger">{error}</div> : null}{message ? <div className="phase78-inline-message">{message}</div> : null}

    <section className="kpi-grid phase78-report-kpis">
      <MetricCard label="Total" value={formatNumber(report?.summary.totalCases ?? 0)} helper={source === 'supabase' ? 'Datos reales' : 'Demo'} icon={BarChart3} />
      <MetricCard label="Abiertos" value={formatNumber(report?.summary.openCases ?? 0)} helper="En gestión" icon={Activity} />
      <MetricCard label="Cerrados" value={formatNumber(report?.summary.closedCases ?? 0)} helper="Finalizados" icon={CheckCircle2} />
      <MetricCard label="Vencidos" value={formatNumber(report?.summary.overdueCases ?? 0)} helper="Fuera de SLA" icon={AlertTriangle} danger={(report?.summary.overdueCases ?? 0)>0} />
      <MetricCard label="Cumplimiento SLA" value={`${formatNumber(report?.summary.slaCompliancePct ?? 0)}%`} helper="Cerrados con fecha" icon={ShieldCheck} />
      <MetricCard label="Tiempo promedio" value={`${formatNumber(report?.summary.avgResolutionHours ?? 0)} h`} helper="Resolución" icon={Clock3} />
    </section>

    <section className="grid-3 phase78-report-distributions"><AnalyticsPanel title="Por área" description="Distribución del período." icon={<Users size={20} />}><DistributionBars values={report?.byArea ?? []} /></AnalyticsPanel><AnalyticsPanel title="Por tipo" description="Naturaleza de los casos." icon={<BarChart3 size={20} />}><DistributionBars values={report?.byType ?? []} /></AnalyticsPanel><AnalyticsPanel title="Por estado" description="Etapa actual del flujo." icon={<Gauge size={20} />}><DistributionBars values={report?.byState ?? []} /></AnalyticsPanel></section>

    <section className="grid-3 phase78-report-distributions">
      <AnalyticsPanel title="Riesgo" description="Concentración por nivel declarado." icon={<AlertTriangle size={20} />}><DistributionBars values={report?.byRisk ?? []} /></AnalyticsPanel>
      <AnalyticsPanel title="Antigüedad del backlog" description="Casos abiertos según días transcurridos." icon={<Clock3 size={20} />}><DistributionBars values={report?.agingBuckets ?? []} /></AnalyticsPanel>
      <AnalyticsPanel title="SLA por área" description="Porcentaje de cierres dentro de la fecha límite." icon={<ShieldCheck size={20} />}><DistributionBars values={(report?.slaByArea ?? []).map((item) => ({ label: `${item.label} · ${item.compliant}/${item.total}`, value: item.value }))} /></AnalyticsPanel>
    </section>

    <AnalyticsPanel title="Throughput mensual" description="Casos creados frente a casos cerrados durante el rango consultado." icon={<BarChart3 size={20} />}>
      <div className="phase78-monthly-chart">{(report?.throughput ?? []).map((item) => {
        const max = Math.max(1, ...(report?.throughput ?? []).flatMap((point) => [point.created, point.closed]));
        return <div className="phase78-month" key={item.month}><div className="phase78-month-bars"><i className="created" style={{ height: `${Math.max(4, item.created / max * 180)}px` }} title={`Creados: ${item.created}`} /><i className="closed" style={{ height: `${Math.max(4, item.closed / max * 180)}px` }} title={`Cerrados: ${item.closed}`} /></div><span>{item.label}</span></div>;
      })}</div>
    </AnalyticsPanel>

    <section className="card table-card phase78-report-table"><div className="phase78-table-head"><div><strong>Detalle del reporte</strong><span>{isLoading ? 'Consultando...' : `${report?.rows.length ?? 0} filas${report?.isTruncated ? ' · limitado a 5.000' : ''}`}</span></div></div><div className="table-scroll"><table className="case-table"><thead><tr>{['Radicado','Tipo','Asunto','Empresa','Área','Responsable','Estado','Prioridad','Creado','Fecha límite','SLA','Avance'].map((item)=><th key={item}>{item}</th>)}</tr></thead><tbody>{report?.rows.length ? report.rows.map((row)=><tr key={row.id}><td><Link className="radicado" to={`/cases/${encodeURIComponent(row.radicado)}`}>{row.radicado}</Link></td><td>{row.caseType}</td><td><strong className="truncate">{row.subject}</strong><small>{row.requesterName}</small></td><td>{row.requesterCompany || '—'}</td><td>{row.area}</td><td>{row.owner}</td><td><span className="chip tone-slate">{row.state}</span></td><td>{row.priority}</td><td>{formatDate(row.openedAt)}</td><td>{formatDate(row.dueAt)}</td><td><span className={`chip ${row.overdue ? 'tone-red' : row.slaMet === false ? 'tone-orange' : 'tone-green'}`}>{row.overdue ? 'Vencido' : row.slaMet == null ? 'En curso' : row.slaMet ? 'Cumplido' : 'Incumplido'}</span></td><td>{row.progress}%</td></tr>) : <tr><td colSpan={12}><div className="empty-inline">No hay casos para los filtros seleccionados.</div></td></tr>}</tbody></table></div></section>
  </div>;
}
