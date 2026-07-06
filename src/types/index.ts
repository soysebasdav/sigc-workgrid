export type DemoRole = 'admin' | 'analyst';

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  demoRole?: DemoRole;
  createdAt: string;
  updatedAt: string;
}

export type NotificationType =
  | 'system'
  | 'case_created'
  | 'case_assigned'
  | 'case_reassigned'
  | 'case_comment'
  | 'case_document'
  | 'case_state_changed'
  | 'case_sla_changed'
  | 'case_due_soon'
  | 'case_overdue'
  | 'case_reminder'
  | 'case_review_requested'
  | 'case_review_approved'
  | 'case_review_returned'
  | 'case_sent';

export interface Notification {
  id: string;
  recipientUserId: string;
  actorUserId: string | null;
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
  notifications: Notification[];
  settings: AppSettings;
  currentUserId: string | null;
}
