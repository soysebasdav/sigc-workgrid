import { useEffect, useState, type FormEvent } from 'react';
import type { Task, TaskFormValues, TaskStatus } from '../../types';
import { useApp } from '../../app/AppProvider';
import { Button } from '../../components/ui/Button';
import { Field, Input, Select, Textarea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  task?: Task | null;
}

const statusOptions: Array<{ value: TaskStatus; label: string }> = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'in_progress', label: 'En progreso' },
  { value: 'completed', label: 'Completada' }
];

export function TaskFormModal({ isOpen, onClose, task }: TaskFormModalProps) {
  const { currentUser, state, createTask, updateTask } = useApp();
  const [values, setValues] = useState<TaskFormValues>({
    title: '',
    description: '',
    status: 'pending',
    dueDate: '',
    userId: currentUser?.id ?? ''
  });

  useEffect(() => {
    if (task) {
      setValues({
        title: task.title,
        description: task.description,
        status: task.status,
        dueDate: task.dueDate ?? '',
        userId: task.userId
      });
      return;
    }

    setValues({
      title: '',
      description: '',
      status: 'pending',
      dueDate: '',
      userId: currentUser?.id ?? ''
    });
  }, [currentUser?.id, task, isOpen]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!values.title.trim()) return;

    try {
      if (task) await updateTask(task.id, values);
      else await createTask(values);
      onClose();
    } catch (error) {
      console.error('No fue posible guardar la tarea:', error);
      window.alert('No fue posible guardar la tarea. Revisa la conexión o los permisos en Supabase.');
    }
  }

  const users = currentUser?.role === 'admin' ? state.users : state.users.filter((user) => user.id === currentUser?.id);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={task ? 'Editar tarea' : 'Nueva tarea'}
      description="Controla responsable, estado, vencimiento y descripción."
    >
      <form className="stack" onSubmit={handleSubmit}>
        <Field label="Título">
          <Input value={values.title} onChange={(event) => setValues({ ...values, title: event.target.value })} required maxLength={150} />
        </Field>

        <Field label="Descripción">
          <Textarea value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} rows={4} />
        </Field>

        <div className="form-grid two">
          <Field label="Estado">
            <Select value={values.status} onChange={(event) => setValues({ ...values, status: event.target.value as TaskStatus })}>
              {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </Select>
          </Field>

          <Field label="Fecha límite">
            <Input type="date" value={values.dueDate ?? ''} onChange={(event) => setValues({ ...values, dueDate: event.target.value || null })} />
          </Field>
        </div>

        <Field label="Responsable" hint={currentUser?.role === 'admin' ? 'Los administradores pueden reasignar tareas.' : 'Los usuarios normales solo gestionan sus tareas.'}>
          <Select value={values.userId} onChange={(event) => setValues({ ...values, userId: event.target.value })} disabled={currentUser?.role !== 'admin'}>
            {users.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.role}</option>)}
          </Select>
        </Field>

        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit">{task ? 'Guardar cambios' : 'Crear tarea'}</Button>
        </div>
      </form>
    </Modal>
  );
}
