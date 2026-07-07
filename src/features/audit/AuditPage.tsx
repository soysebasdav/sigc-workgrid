import { useMemo, useState } from 'react';
import { Download, Eye, Filter, RefreshCw, Search, ShieldCheck, X } from 'lucide-react';
import { useAuthorization } from '../authz/AuthorizationProvider';
import { PERMISSIONS } from '../authz/permissions';
import type { SigcAuditEvent, SigcAuditFilters } from '../sigc/domain/types';
import { useSigcAudit, useSigcMembers } from '../sigc/hooks/useSigcData';
import { sigcService } from '../sigc/services/sigcService';

const PAGE_SIZE = 50;

export function AuditPage() {
  const { can } = useAuthorization();
  const { data: members } = useSigcMembers();
  const [filters, setFilters] = useState<SigcAuditFilters>({ page: 1, pageSize: PAGE_SIZE, sortDirection: 'desc' });
  const { data, isLoading, error, reload } = useSigcAudit(filters);
  const [selected, setSelected] = useState<SigcAuditEvent | null>(null);
  const [exporting, setExporting] = useState(false);
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const eventTypes = useMemo(() => [...new Set(data.items.map((item) => item.eventType))].sort(), [data.items]);
  const entityTypes = useMemo(() => [...new Set(data.items.map((item) => item.entityType))].sort(), [data.items]);

  function update<K extends keyof SigcAuditFilters>(key: K, value: SigcAuditFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value, page: key === 'page' ? Number(value) : 1 }));
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const rows: SigcAuditEvent[] = [];
      let page = 1;
      let total = 0;
      do {
        const result = await sigcService.getAuditEvents({ ...filters, page, pageSize: 200 });
        rows.push(...result.data.items);
        total = result.data.total;
        page += 1;
      } while (rows.length < total);
      const header = ['ID','Fecha','Usuario','Correo','Evento','Entidad','ID entidad','Radicado','IP','User agent','Antes','Después','Metadatos'];
      const escape = (value: unknown) => {
        const text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
        const safe = /^[=+@-]/.test(text) ? `'${text}` : text;
        return `"${safe.replace(/"/g, '""')}"`;
      };
      const csv = [header.map(escape).join(','), ...rows.map((row) => [
        row.id, row.createdAt, row.actorName, row.actorEmail ?? '', row.eventType, row.entityType, row.entityId,
        row.caseRadicado ?? '', row.ipAddress ?? '', row.userAgent ?? '', row.beforeData ?? '', row.afterData ?? '', row.metadata
      ].map(escape).join(','))].join('\n');
      const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `auditoria-sigc-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="page audit-page">
      <header className="page-head">
        <div><span className="eyebrow">Cumplimiento y trazabilidad</span><h1>Auditoría global</h1><p>Consulta inmutable de acciones, cambios, actores, IP y contexto técnico de toda la organización.</p></div>
        <div className="page-actions"><button className="btn btn-white" onClick={reload}><RefreshCw size={16} /> Actualizar</button>{can(PERMISSIONS.auditExport) ? <button className="btn btn-primary" disabled={exporting} onClick={() => void exportCsv()}><Download size={16} /> {exporting ? 'Exportando...' : 'Exportar CSV'}</button> : null}</div>
      </header>

      <section className="card audit-filter-card">
        <div className="audit-filter-grid">
          <label className="filter-search-field"><Search size={16} /><input className="field" placeholder="Buscar evento, usuario, radicado o entidad" value={filters.query ?? ''} onChange={(event) => update('query', event.target.value)} /></label>
          <select className="field" value={filters.actorUserId ?? ''} onChange={(event) => update('actorUserId', event.target.value || undefined)}><option value="">Todos los usuarios</option>{members.map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}</select>
          <select className="field" value={filters.eventType ?? ''} onChange={(event) => update('eventType', event.target.value || undefined)}><option value="">Todos los eventos</option>{eventTypes.map((value) => <option key={value}>{value}</option>)}</select>
          <select className="field" value={filters.entityType ?? ''} onChange={(event) => update('entityType', event.target.value || undefined)}><option value="">Todas las entidades</option>{entityTypes.map((value) => <option key={value}>{value}</option>)}</select>
          <label className="field-label compact-label">Desde<input className="field" type="date" value={filters.dateFrom ?? ''} onChange={(event) => update('dateFrom', event.target.value || undefined)} /></label>
          <label className="field-label compact-label">Hasta<input className="field" type="date" value={filters.dateTo ?? ''} onChange={(event) => update('dateTo', event.target.value || undefined)} /></label>
          <button className="btn btn-white" onClick={() => setFilters({ page: 1, pageSize: PAGE_SIZE, sortDirection: 'desc' })}><Filter size={16} /> Limpiar</button>
        </div>
      </section>

      {error ? <div className="alert danger">{error}</div> : null}
      <div className="case-list-meta"><span>{isLoading ? 'Consultando registro inmutable...' : 'Registro global de la organización'}</span><strong>{data.total} evento{data.total === 1 ? '' : 's'}</strong></div>
      <section className="card table-card audit-table-wrap">
        <table className="audit-table"><thead><tr><th>Fecha</th><th>Usuario</th><th>Evento</th><th>Entidad</th><th>Caso</th><th>IP</th><th /></tr></thead><tbody>
          {data.items.length ? data.items.map((item) => <tr key={item.id}><td><strong>{item.createdLabel}</strong></td><td><strong>{item.actorName}</strong><small>{item.actorEmail ?? 'Sistema'}</small></td><td><code>{item.eventType}</code></td><td>{item.entityType}<small>{item.entityId}</small></td><td>{item.caseRadicado ?? '—'}</td><td>{item.ipAddress ?? '—'}</td><td><button className="btn btn-white icon-only small" title="Ver detalle" onClick={() => setSelected(item)}><Eye size={15} /></button></td></tr>) : <tr><td colSpan={7}><div className="empty-inline">No hay eventos para los filtros seleccionados.</div></td></tr>}
        </tbody></table>
      </section>
      <div className="pagination-row"><button className="btn btn-white" disabled={data.page <= 1 || isLoading} onClick={() => update('page', data.page - 1)}>Anterior</button><span>Página <strong>{data.page}</strong> de <strong>{totalPages}</strong></span><button className="btn btn-white" disabled={data.page >= totalPages || isLoading} onClick={() => update('page', data.page + 1)}>Siguiente</button></div>
      {selected ? <AuditDetail event={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function AuditDetail({ event, onClose }: { event: SigcAuditEvent; onClose: () => void }) {
  return <div className="modal-backdrop" role="dialog" aria-modal="true"><section className="modal-card audit-detail-modal"><header className="modal-header"><div><span className="eyebrow"><ShieldCheck size={15} /> Evento #{event.id}</span><h2>{event.eventType}</h2><p>{event.createdLabel} · {event.actorName}</p></div><button className="btn btn-ghost" onClick={onClose}><X size={18} /></button></header><div className="audit-detail-grid"><AuditField label="Entidad" value={`${event.entityType} · ${event.entityId}`} /><AuditField label="Caso" value={event.caseRadicado ?? 'Sin caso asociado'} /><AuditField label="IP" value={event.ipAddress ?? 'No disponible'} /><AuditField label="User agent" value={event.userAgent ?? 'No disponible'} /></div><JsonBlock title="Valores anteriores" value={event.beforeData} /><JsonBlock title="Valores nuevos" value={event.afterData} /><JsonBlock title="Metadatos" value={event.metadata} /></section></div>;
}

function AuditField({ label, value }: { label: string; value: string }) { return <div className="audit-detail-field"><span>{label}</span><strong>{value}</strong></div>; }
function JsonBlock({ title, value }: { title: string; value: unknown }) { return <section className="audit-json-block"><strong>{title}</strong><pre>{JSON.stringify(value ?? null, null, 2)}</pre></section>; }
