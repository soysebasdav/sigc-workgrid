import { CalendarClock, CheckCircle2, Clock3, ListTodo, TimerOff } from 'lucide-react';
import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../app/AppProvider';
import { Badge } from '../../components/ui/Badge';
import { Card, CardHeader } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDate } from '../../utils/dates';
import { getTaskStatusLabel, getTaskStatusTone, isOverdue } from '../../utils/task';

export function DashboardPage() {
  const { visibleTasks, state } = useApp();

  const metrics = useMemo(() => ({
    total: visibleTasks.length,
    pending: visibleTasks.filter((task) => task.status === 'pending').length,
    inProgress: visibleTasks.filter((task) => task.status === 'in_progress').length,
    completed: visibleTasks.filter((task) => task.status === 'completed').length,
    overdue: visibleTasks.filter(isOverdue).length
  }), [visibleTasks]);

  const nextTasks = visibleTasks
    .filter((task) => task.status !== 'completed')
    .slice(0, 5);

  const completion = metrics.total ? Math.round((metrics.completed / metrics.total) * 100) : 0;

  return (
    <div className="dashboard-grid">
      <section className="metric-grid">
        <MetricCard icon={<ListTodo />} label="Total tareas" value={metrics.total} />
        <MetricCard icon={<Clock3 />} label="Pendientes" value={metrics.pending} />
        <MetricCard icon={<CalendarClock />} label="En progreso" value={metrics.inProgress} />
        <MetricCard icon={<CheckCircle2 />} label="Completadas" value={metrics.completed} />
        <MetricCard icon={<TimerOff />} label="En retraso" value={metrics.overdue} danger />
      </section>

      <Card className="span-8">
        <CardHeader title="Próximas tareas" description="Ordenadas por criticidad y fecha límite." action={<Link className="link" to="/subtasks">Ver todas</Link>} />
        {nextTasks.length ? (
          <div className="task-list compact">
            {nextTasks.map((task) => {
              const overdue = isOverdue(task);
              const owner = state.users.find((user) => user.id === task.userId);
              return (
                <article className="task-row" key={task.id}>
                  <div>
                    <strong>{task.title}</strong>
                    <span>{owner?.name ?? 'Sin responsable'} · vence {formatDate(task.dueDate)}</span>
                  </div>
                  <Badge tone={getTaskStatusTone(task.status, overdue)}>{getTaskStatusLabel(task.status, overdue)}</Badge>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState title="Sin tareas abiertas" description="No hay tareas pendientes ni en progreso." />
        )}
      </Card>

      <Card className="span-4 accent-card">
        <CardHeader title="Avance general" description="Indicador de cierre del backlog visible." />
        <div className="progress-ring" style={{ '--progress': `${completion}%` } as CSSProperties}>
          <strong>{completion}%</strong>
          <span>completado</span>
        </div>
        <p className="muted">El estado Retraso se calcula automáticamente cuando la fecha límite ya pasó y la tarea no está completada.</p>
      </Card>
    </div>
  );
}

function MetricCard({ icon, label, value, danger = false }: { icon: ReactNode; label: string; value: number; danger?: boolean }) {
  return (
    <Card className={`metric-card ${danger ? 'metric-danger' : ''}`}>
      <div className="metric-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </Card>
  );
}
