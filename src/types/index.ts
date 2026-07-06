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

export type NotificationType =
  | 'task_created' | 'task_updated' | 'task_deleted' | 'system'
  | 'case_created' | 'case_assigned' | 'case_reassigned' | 'case_comment' | 'case_document'
  | 'case_state_changed' | 'case_sla_changed' | 'case_due_soon' | 'case_overdue' | 'case_reminder'
  | 'case_review_requested' | 'case_review_approved' | 'case_review_returned' | 'case_sent';

export interface Notification {
  id: string;
  recipientUserId: string;
  actorUserId: string | null;
  taskId: string | null;
  caseId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface AppSettings {
  inactivityTimeoutMinutes: number;
  organizationId?: string | null;
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
