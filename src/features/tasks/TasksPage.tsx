import { useMemo, useState } from 'react';
import { Eye, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { Task, TaskStatus } from '../../types';
import { useApp } from '../../app/AppProvider';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input, Select } from '../../components/ui/Field';
import { formatDate } from '../../utils/dates';
import { getTaskStatusLabel, getTaskStatusTone, isOverdue } from '../../utils/task';
import { TaskDetailModal } from './TaskDetailModal';
import { TaskFormModal } from './TaskFormModal';

type FilterStatus = 'all' | TaskStatus | 'overdue';

export function TasksPage() {
  const { visibleTasks, state, deleteTask } = useApp();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<FilterStatus>('all');
  const [isFormOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);

  const filteredTasks = useMemo(() => {
    const term = search.trim().toLowerCase();
    return visibleTasks.filter((task) => {
      const owner = state.users.find((user) => user.id === task.userId);
      const matchesTerm = !term || `${task.title} ${task.description} ${owner?.name ?? ''}`.toLowerCase().includes(term);
      const overdue = isOverdue(task);
      const matchesStatus = status === 'all' || (status === 'overdue' ? overdue : task.status === status);
      return matchesTerm && matchesStatus;
    });
  }, [search, state.users, status, visibleTasks]);

  function openCreate(): void {
    setEditingTask(null);
    setFormOpen(true);
  }

  function openEdit(task: Task): void {
    setDetailTask(null);
    setEditingTask(task);
    setFormOpen(true);
  }

  function closeForm(): void {
    setEditingTask(null);
    setFormOpen(false);
  }

  return (
    <>
      <Card>
        <CardHeader
          title="Listado de tareas"
          description="Filtra, consulta, crea, edita o elimina tareas."
          action={<Button onClick={openCreate}><Plus size={18} /> Nueva tarea</Button>}
        />

        <div className="filters-bar">
          <div className="search-box">
            <Search size={18} />
            <Input placeholder="Buscar por tarea, descripción o responsable" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <Select value={status} onChange={(event) => setStatus(event.target.value as FilterStatus)}>
            <option value="all">Todos los estados</option>
            <option value="pending">Pendiente</option>
            <option value="in_progress">En progreso</option>
            <option value="completed">Completada</option>
            <option value="overdue">Retraso</option>
          </Select>
        </div>

        {filteredTasks.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tarea</th>
                  <th>Responsable</th>
                  <th>Vencimiento</th>
                  <th>Estado</th>
                  <th className="align-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task) => {
                  const owner = state.users.find((user) => user.id === task.userId);
                  const overdue = isOverdue(task);
                  return (
                    <tr key={task.id}>
                      <td>
                        <strong>{task.title}</strong>
                        <span>{task.description || 'Sin descripción'}</span>
                      </td>
                      <td>{owner?.name ?? 'Sin responsable'}</td>
                      <td>{formatDate(task.dueDate)}</td>
                      <td><Badge tone={getTaskStatusTone(task.status, overdue)}>{getTaskStatusLabel(task.status, overdue)}</Badge></td>
                      <td>
                        <div className="row-actions">
                          <Button variant="ghost" onClick={() => setDetailTask(task)} title="Ver detalle"><Eye size={17} /></Button>
                          <Button variant="ghost" onClick={() => openEdit(task)} title="Editar"><Pencil size={17} /></Button>
                          <Button variant="ghost" onClick={() => deleteTask(task.id)} title="Eliminar"><Trash2 size={17} /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No hay tareas para mostrar" description="Ajusta los filtros o crea una nueva tarea." action={<Button onClick={openCreate}>Crear tarea</Button>} />
        )}
      </Card>

      <TaskFormModal isOpen={isFormOpen} onClose={closeForm} task={editingTask} />
      <TaskDetailModal task={detailTask} onClose={() => setDetailTask(null)} onEdit={openEdit} />
    </>
  );
}
