import type { Task } from '../../types';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useApp } from '../../app/AppProvider';
import { formatDate, formatDateTime } from '../../utils/dates';
import { getTaskStatusLabel, getTaskStatusTone, isOverdue } from '../../utils/task';

interface TaskDetailModalProps {
  task: Task | null;
  onClose: () => void;
  onEdit: (task: Task) => void;
}

export function TaskDetailModal({ task, onClose, onEdit }: TaskDetailModalProps) {
  const { state } = useApp();
  const owner = task ? state.users.find((user) => user.id === task.userId) : null;
  const overdue = task ? isOverdue(task) : false;

  return (
    <Modal isOpen={Boolean(task)} onClose={onClose} title="Detalle de tarea" description="Vista rápida de trazabilidad y estado actual.">
      {task ? (
        <div className="detail-panel">
          <div className="detail-title-row">
            <div>
              <h3>{task.title}</h3>
              <p>{task.description || 'Sin descripción registrada.'}</p>
            </div>
            <Badge tone={getTaskStatusTone(task.status, overdue)}>{getTaskStatusLabel(task.status, overdue)}</Badge>
          </div>

          <dl className="detail-grid">
            <div><dt>Responsable</dt><dd>{owner?.name ?? 'Sin responsable'}</dd></div>
            <div><dt>Fecha límite</dt><dd>{formatDate(task.dueDate)}</dd></div>
            <div><dt>Creada</dt><dd>{formatDateTime(task.createdAt)}</dd></div>
            <div><dt>Actualizada</dt><dd>{formatDateTime(task.updatedAt)}</dd></div>
          </dl>

          <div className="modal-actions">
            <Button variant="secondary" onClick={onClose}>Cerrar</Button>
            <Button onClick={() => onEdit(task)}>Editar</Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
