import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, HeartPulse, Play, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { useAuthorization } from '../authz/AuthorizationProvider';
import { PERMISSIONS } from '../authz/permissions';
import type { QualityCheckResult, QualityDashboard, QualityRunRecord } from '../sigc/domain/types';
import { sigcService } from '../sigc/services/sigcService';
import { runClientQualityChecks } from './qualityChecks';

function statusLabel(status: string): string {
  if (status === 'passed') return 'Aprobado';
  if (status === 'warning') return 'Advertencia';
  if (status === 'failed') return 'Falló';
  if (status === 'skipped') return 'Omitido';
  return 'Sin ejecutar';
}

function statusClass(status: string): string {
  if (status === 'passed') return 'tone-emerald';
  if (status === 'warning') return 'tone-orange';
  if (status === 'failed') return 'tone-red';
  return 'tone-slate';
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'passed') return <CheckCircle2 size={18} />;
  if (status === 'warning') return <AlertTriangle size={18} />;
  if (status === 'failed') return <XCircle size={18} />;
  return <Clock3 size={18} />;
}

function CheckTable({ checks }: { checks: QualityCheckResult[] }) {
  if (!checks.length) return <div className="empty-inline">Todavía no hay resultados para esta ejecución.</div>;
  return (
    <div className="table-scroll">
      <table className="case-table quality-table">
        <thead><tr><th>Estado</th><th>Código</th><th>Categoría</th><th>Control</th><th>Resultado</th><th>Duración</th></tr></thead>
        <tbody>{checks.map((check) => (
          <tr key={`${check.source}-${check.code}`}>
            <td><span className={`chip ${statusClass(check.status)}`}><StatusIcon status={check.status} /> {statusLabel(check.status)}</span></td>
            <td><code>{check.code}</code><small>{check.source === 'client' ? 'Cliente' : 'Servidor'}</small></td>
            <td>{check.category}</td>
            <td><strong>{check.title}</strong></td>
            <td><span>{check.details}</span>{check.evidence && Object.keys(check.evidence).length ? <details className="quality-evidence"><summary>Evidencia</summary><pre>{JSON.stringify(check.evidence, null, 2)}</pre></details> : null}</td>
            <td>{check.durationMs == null ? '—' : `${Math.round(check.durationMs)} ms`}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function LatestRun({ run }: { run: QualityRunRecord | null | undefined }) {
  if (!run) return <section className="card block-card"><header className="card-title"><div><h2>Última ejecución</h2><p>La suite todavía no se ha ejecutado para esta organización.</p></div><div className="kpi-icon"><HeartPulse /></div></header></section>;
  return (
    <section className="card block-card">
      <header className="card-title"><div><h2>Última ejecución</h2><p>{new Date(run.finishedAt).toLocaleString('es-CO')} · {run.durationMs} ms</p></div><span className={`chip ${statusClass(run.status)}`}><StatusIcon status={run.status} /> {statusLabel(run.status)}</span></header>
      <div className="quality-summary-grid">
        <article><span>Total</span><strong>{run.summary.total}</strong></article>
        <article><span>Aprobados</span><strong>{run.summary.passed}</strong></article>
        <article><span>Advertencias</span><strong>{run.summary.warnings}</strong></article>
        <article><span>Fallos</span><strong>{run.summary.failed}</strong></article>
        <article><span>Omitidos</span><strong>{run.summary.skipped}</strong></article>
      </div>
    </section>
  );
}

export function QualityCenterPage() {
  const { can } = useAuthorization();
  const canRun = can(PERMISSIONS.qualityRun);
  const [dashboard, setDashboard] = useState<QualityDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientPreview, setClientPreview] = useState<QualityCheckResult[]>([]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await sigcService.getQualityDashboard();
      setDashboard(result.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No fue posible consultar la calidad del sistema.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function executeSuite() {
    if (!canRun || running) return;
    setRunning(true);
    setError(null);
    try {
      const clientChecks = await runClientQualityChecks();
      setClientPreview(clientChecks);
      await sigcService.runQualitySuite({ clientChecks, releaseVersion: import.meta.env.VITE_APP_VERSION as string | undefined });
      await load();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'La suite de calidad no pudo completarse.');
    } finally {
      setRunning(false);
    }
  }

  const latestChecks = dashboard?.latestRun?.checks ?? clientPreview;
  const grouped = useMemo(() => {
    const groups = new Map<string, QualityCheckResult[]>();
    latestChecks.forEach((check) => groups.set(check.category, [...(groups.get(check.category) ?? []), check]));
    return [...groups.entries()];
  }, [latestChecks]);

  return (
    <div className="page">
      <header className="page-head">
        <div><span className="eyebrow">Control continuo</span><h1>Calidad y producción</h1><p>Suite repetible de regresión, seguridad, integridad, runtime y preparación operativa.</p></div>
        <div className="page-actions"><button className="btn btn-white" disabled={loading || running} onClick={() => void load()}><RefreshCw size={17} /> Actualizar</button>{canRun ? <button className="btn btn-primary" disabled={running} onClick={() => void executeSuite()}>{running ? <RefreshCw className="spin" size={17} /> : <Play size={17} />} {running ? 'Ejecutando controles...' : 'Ejecutar suite completa'}</button> : null}</div>
      </header>

      {error ? <div className="alert danger"><AlertTriangle size={18} /> {error}</div> : null}
      {loading && !dashboard ? <section className="card placeholder-card"><RefreshCw className="spin" /><h2>Consultando controles de producción...</h2></section> : null}

      {dashboard ? <>
        <section className="quality-readiness-grid">
          <article className="card"><span>Preparación</span><strong>{dashboard.readiness.scorePct}%</strong><small>{dashboard.readiness.blockingFailures} bloqueo{dashboard.readiness.blockingFailures === 1 ? '' : 's'} activo{dashboard.readiness.blockingFailures === 1 ? '' : 's'}</small></article>
          <article className="card"><span>Estado</span><strong>{statusLabel(dashboard.readiness.status)}</strong><small>{dashboard.readiness.lastRunAt ? `Último control: ${new Date(dashboard.readiness.lastRunAt).toLocaleString('es-CO')}` : 'Sin ejecución previa'}</small></article>
          <article className="card"><span>Historial</span><strong>{dashboard.history.length}</strong><small>Ejecuciones recientes conservadas</small></article>
        </section>

        <LatestRun run={dashboard.latestRun} />

        <section className="card block-card">
          <header className="card-title"><div><h2>Capacidades de infraestructura</h2><p>Detección no destructiva de componentes necesarios para operar en producción.</p></div><div className="kpi-icon"><ShieldCheck /></div></header>
          <div className="quality-capabilities">{dashboard.capabilities.map((capability) => <article key={capability.code}><StatusIcon status={capability.available ? 'passed' : 'warning'} /><div><strong>{capability.label}</strong><span>{capability.details}</span></div></article>)}</div>
        </section>

        {grouped.map(([category, checks]) => <section className="card block-card" key={category}><header className="card-title"><div><h2>{category}</h2><p>{checks.length} control{checks.length === 1 ? '' : 'es'} en la última ejecución.</p></div></header><CheckTable checks={checks} /></section>)}

        <section className="card block-card">
          <header className="card-title"><div><h2>Historial de suites</h2><p>Conserva evidencia de regresiones y preparación por organización.</p></div></header>
          <div className="table-scroll"><table className="case-table"><thead><tr><th>Fecha</th><th>Estado</th><th>Total</th><th>Aprobados</th><th>Advertencias</th><th>Fallos</th><th>Versión</th></tr></thead><tbody>{dashboard.history.map((run) => <tr key={run.id}><td>{new Date(run.finishedAt).toLocaleString('es-CO')}</td><td><span className={`chip ${statusClass(run.status)}`}>{statusLabel(run.status)}</span></td><td>{run.summary.total}</td><td>{run.summary.passed}</td><td>{run.summary.warnings}</td><td>{run.summary.failed}</td><td>{run.releaseVersion ?? '—'}</td></tr>)}</tbody></table></div>
        </section>
      </> : null}
    </div>
  );
}
