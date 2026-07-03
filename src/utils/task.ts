import type { Task, TaskStatus } from '../types';
import { isPastDate } from './dates';

export function isOverdue(task: Task): boolean {
  return task.status !== 'completed' && isPastDate(task.dueDate);
}

export function getTaskStatusLabel(status: TaskStatus, overdue = false): string {
  if (overdue) return 'Retraso';
  const labels: Record<TaskStatus, string> = {
    pending: 'Pendiente',
    in_progress: 'En progreso',
    completed: 'Completada'
  };
  return labels[status];
}

export function getTaskStatusTone(status: TaskStatus, overdue = false): 'danger' | 'warning' | 'info' | 'success' | 'neutral' {
  if (overdue) return 'danger';
  const tones: Record<TaskStatus, 'warning' | 'info' | 'success'> = {
    pending: 'warning',
    in_progress: 'info',
    completed: 'success'
  };
  return tones[status];
}
