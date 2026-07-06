import { BellRing, CalendarClock, ChevronLeft, ChevronRight, ClipboardCheck, ListChecks, RefreshCw, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthorization } from '../authz/AuthorizationProvider';
import { CASE_READ_PERMISSIONS } from '../authz/permissions';
import { useSigcAgenda } from '../sigc/hooks/useSigcData';
import type { SigcAgendaItem, SigcAgendaItemKind } from '../sigc/domain/types';
import { getMonthMatrix, monthTitle, todayISO, toISODate } from '../../utils/dates';

const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

type AgendaFilter = 'all' | SigcAgendaItemKind;

const FILTERS: Array<{ value: AgendaFilter; label: string }> = [
  { value: 'all', label: 'Todo' },
  { value: 'case_due', label: 'Casos' },
  { value: 'assignment_due', label: 'Asignaciones' },
  { value: 'subtask_due', label: 'Subtareas' },
  { value: 'review_pending', label: 'Revisiones' },
  { value: 'reminder', label: 'Recordatorios' }
];

function monthRange(year: number, month: number): { from: string; to: string } {
  return {
    from: toISODate(new Date(year, month, 1)),
    to: toISODate(new Date(year, month + 1, 0))
  };
}

function itemLabel(kind: SigcAgendaItemKind): string {
  switch (kind) {
    case 'case_due': return 'Caso';
    case 'assignment_due': return 'Asignación';
    case 'subtask_due': return 'Subtarea';
    case 'review_pending': return 'Revisión';
    case 'reminder': return 'Recordatorio';
  }
}

function itemIcon(kind: SigcAgendaItemKind) {
  switch (kind) {
    case 'case_due': return CalendarClock;
    case 'assignment_due': return Users;
    case 'subtask_due': return ListChecks;
    case 'review_pending': return ClipboardCheck;
    case 'reminder': return BellRing;
  }
}

function itemTone(item: SigcAgendaItem): string {
  if (item.completed) return 'tone-slate';
  if (item.overdue) return 'tone-red';
  if (item.kind === 'review_pending') return 'tone-purple';
  if (item.kind === 'reminder') return 'tone-cyan';
  if (item.priority === 'Crítica') return 'tone-red';
  if (item.priority === 'Alta') return 'tone-orange';
  return 'tone-blue';
}

function formatAgendaTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' }).format(date);
}

export function AgendaPage() {
  const now = new Date();
  const { canAny } = useAuthorization();
  const canReadCases = canAny(CASE_READ_PERMISSIONS);
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [filter, setFilter] = useState<AgendaFilter>('all');
  const [selectedDay, setSelectedDay] = useState(todayISO());

  const matrix = useMemo(() => getMonthMatrix(cursor.year, cursor.month), [cursor]);
  const range = useMemo(() => monthRange(cursor.year, cursor.month), [cursor]);
  const { data: agenda, isLoading, error, reload } = useSigcAgenda(range.from, range.to, canReadCases);

  const filteredItems = useMemo(() => {
    const rows = agenda?.items ?? [];
    return filter === 'all' ? rows : rows.filter((item) => item.kind === filter);
  }, [agenda?.items, filter]);

  const itemsByDay = useMemo(() => filteredItems.reduce<Record<string, SigcAgendaItem[]>>((acc, item) => {
    acc[item.dateKey] = [...(acc[item.dateKey] ?? []), item];
    return acc;
  }, {}), [filteredItems]);

  const selectedItems = itemsByDay[selectedDay] ?? [];

  function moveMonth(delta: number): void {
    const date = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: date.getFullYear(), month: date.getMonth() });
    const today = new Date();
    const nextSelected = today.getFullYear() === date.getFullYear() && today.getMonth() === date.getMonth()
      ? todayISO()
      : toISODate(date);
    setSelectedDay(nextSelected);
  }

  function goToday(): void {
    const today = new Date();
    setCursor({ year: today.getFullYear(), month: today.getMonth() });
    setSelectedDay(todayISO());
  }

  return (
    <div className="page agenda-page">
      <header className="page-head">
        <div>
          <span className="eyebrow">Fase 10 · operación centrada en casos</span>
          <h1>Agenda SIGC</h1>
          <p>Fechas límite de casos, asignaciones, subtareas, revisiones pendientes y recordatorios en un único calendario operativo.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-white" onClick={() => reload()} disabled={isLoading}><RefreshCw size={17} /> Actualizar</button>
        </div>
      </header>

      <section className="agenda-summary-grid">
        <AgendaMetric label="Vencidos" value={agenda?.summary.overdue ?? 0} tone="danger" />
        <AgendaMetric label="Para hoy" value={agenda?.summary.dueToday ?? 0} tone="warning" />
        <AgendaMetric label="Próximos 7 días" value={agenda?.summary.next7Days ?? 0} tone="info" />
        <AgendaMetric label="Revisiones pendientes" value={agenda?.summary.pendingReviews ?? 0} tone="purple" />
      </section>

      <section className="card agenda-toolbar-card">
        <div className="agenda-month-controls">
          <button className="btn btn-white icon-only" onClick={() => moveMonth(-1)} aria-label="Mes anterior"><ChevronLeft size={18} /></button>
          <div><strong>{monthTitle(cursor.year, cursor.month)}</strong><span>{agenda?.timezone ?? 'America/Bogota'}</span></div>
          <button className="btn btn-white" onClick={goToday}>Hoy</button>
          <button className="btn btn-white icon-only" onClick={() => moveMonth(1)} aria-label="Mes siguiente"><ChevronRight size={18} /></button>
        </div>
        <div className="agenda-filters" role="tablist" aria-label="Filtrar agenda">
          {FILTERS.map((item) => (
            <button key={item.value} className={`agenda-filter ${filter === item.value ? 'active' : ''}`} onClick={() => setFilter(item.value)}>
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {error ? <div className="alert danger">No fue posible cargar la agenda: {error}</div> : null}

      <div className="agenda-layout">
        <section className="card agenda-calendar-card" aria-busy={isLoading}>
          <div className="agenda-calendar-head">
            {weekDays.map((day) => <strong key={day}>{day}</strong>)}
          </div>
          <div className="agenda-calendar-grid">
            {matrix.flat().map((date) => {
              const iso = toISODate(date);
              const items = itemsByDay[iso] ?? [];
              const currentMonth = date.getMonth() === cursor.month;
              const isToday = iso === todayISO();
              const selected = iso === selectedDay;
              return (
                <button
                  type="button"
                  className={`agenda-day ${currentMonth ? '' : 'outside'} ${isToday ? 'today' : ''} ${selected ? 'selected' : ''}`}
                  key={iso}
                  onClick={() => setSelectedDay(iso)}
                >
                  <div className="agenda-day-number"><span>{date.getDate()}</span>{items.length ? <em>{items.length}</em> : null}</div>
                  <div className="agenda-day-items">
                    {items.slice(0, 3).map((item) => (
                      <span className={`agenda-calendar-item ${itemTone(item)}`} key={item.id} title={`${item.caseRadicado} · ${item.title}`}>
                        {item.caseRadicado} · {item.title}
                      </span>
                    ))}
                    {items.length > 3 ? <small>+{items.length - 3} más</small> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="card agenda-day-panel">
          <header>
            <div>
              <span className="eyebrow">Día seleccionado</span>
              <h2>{new Intl.DateTimeFormat('es-CO', { dateStyle: 'full' }).format(new Date(`${selectedDay}T12:00:00`))}</h2>
            </div>
            <span className="chip tone-slate">{selectedItems.length}</span>
          </header>

          {isLoading ? <div className="agenda-empty">Cargando agenda...</div> : selectedItems.length ? (
            <div className="agenda-day-list">
              {selectedItems.map((item) => <AgendaItemCard key={item.id} item={item} />)}
            </div>
          ) : <div className="agenda-empty">No hay actividades del SIGC para este día con el filtro actual.</div>}
        </aside>
      </div>
    </div>
  );
}

function AgendaMetric({ label, value, tone }: { label: string; value: number; tone: 'danger' | 'warning' | 'info' | 'purple' }) {
  return <article className={`card agenda-metric agenda-metric-${tone}`}><span>{label}</span><strong>{value}</strong></article>;
}

function AgendaItemCard({ item }: { item: SigcAgendaItem }) {
  const Icon = itemIcon(item.kind);
  return (
    <article className={`agenda-detail-item ${item.overdue && !item.completed ? 'overdue' : ''}`}>
      <div className={`agenda-detail-icon ${itemTone(item)}`}><Icon size={17} /></div>
      <div className="agenda-detail-copy">
        <div className="agenda-detail-title">
          <strong>{item.title}</strong>
          <span className={`chip ${itemTone(item)}`}>{itemLabel(item.kind)}</span>
        </div>
        <Link to={item.actionUrl}>{item.caseRadicado} · {item.caseSubject}</Link>
        {item.description ? <p>{item.description}</p> : null}
        <div className="agenda-detail-meta">
          <span>{formatAgendaTime(item.scheduledAt)}</span>
          <span>{item.owner}</span>
          <span>{item.area}</span>
          {item.progress > 0 ? <span>{item.progress}%</span> : null}
        </div>
      </div>
    </article>
  );
}
