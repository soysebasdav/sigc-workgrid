export type Role = 'admin' | 'user';

export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  description: string;
  status: TaskStatus;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  recipientUserId: string;
  actorUserId: string | null;
  taskId: string | null;
  type: 'task_created' | 'task_updated' | 'task_deleted' | 'system';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface AppSettings {
  inactivityTimeoutMinutes: number;
}

export interface AppState {
  users: User[];
  tasks: Task[];
  notifications: Notification[];
  settings: AppSettings;
  currentUserId: string | null;
}

export interface TaskFormValues {
  title: string;
  description: string;
  status: TaskStatus;
  dueDate: string | null;
  userId: string;
}

export interface UserFormValues {
  name: string;
  email: string;
  password?: string;
  role: Role;
}

export interface DashboardMetrics {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
}
