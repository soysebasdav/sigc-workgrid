import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useApp } from '../../app/AppProvider';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { getMonthMatrix, monthTitle, todayISO, toISODate } from '../../utils/dates';
import { getTaskStatusLabel, getTaskStatusTone, isOverdue } from '../../utils/task';

const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function AgendaPage() {
  const { visibleTasks } = useApp();
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });

  const matrix = useMemo(() => getMonthMatrix(cursor.year, cursor.month), [cursor]);
  const tasksByDay = useMemo(() => {
    return visibleTasks.reduce<Record<string, typeof visibleTasks>>((acc, task) => {
      if (!task.dueDate) return acc;
      acc[task.dueDate] = [...(acc[task.dueDate] ?? []), task];
      return acc;
    }, {});
  }, [visibleTasks]);

  function moveMonth(delta: number): void {
    const date = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: date.getFullYear(), month: date.getMonth() });
  }

  return (
    <Card>
      <CardHeader
        title={monthTitle(cursor.year, cursor.month)}
        description="Calendario mensual de fechas límite."
        action={
          <div className="segmented-actions">
            <Button variant="secondary" onClick={() => moveMonth(-1)}><ChevronLeft size={17} /></Button>
            <Button variant="secondary" onClick={() => setCursor({ year: now.getFullYear(), month: now.getMonth() })}>Hoy</Button>
            <Button variant="secondary" onClick={() => moveMonth(1)}><ChevronRight size={17} /></Button>
          </div>
        }
      />

      <div className="calendar-grid calendar-head">
        {weekDays.map((day) => <strong key={day}>{day}</strong>)}
      </div>

      <div className="calendar-grid">
        {matrix.flat().map((date) => {
          const iso = toISODate(date);
          const tasks = tasksByDay[iso] ?? [];
          const isCurrentMonth = date.getMonth() === cursor.month;
          const isToday = iso === todayISO();

          return (
            <div className={`calendar-cell ${isCurrentMonth ? '' : 'muted-cell'} ${isToday ? 'today-cell' : ''}`} key={iso}>
              <div className="calendar-date">
                <span>{date.getDate()}</span>
                {tasks.length ? <em>{tasks.length}</em> : null}
              </div>
              <div className="calendar-tasks">
                {tasks.slice(0, 3).map((task) => {
                  const overdue = isOverdue(task);
                  return (
                    <div className="calendar-task" key={task.id} title={task.title}>
                      <span>{task.title}</span>
                      <Badge tone={getTaskStatusTone(task.status, overdue)}>{getTaskStatusLabel(task.status, overdue)}</Badge>
                    </div>
                  );
                })}
                {tasks.length > 3 ? <small>+{tasks.length - 3} más</small> : null}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
