export type PlatformAdminRole = 'owner' | 'admin' | 'support' | 'auditor' | 'backup_operator';

export interface PlatformAccessContext {
  isPlatformAdmin: boolean;
  userId: string | null;
  roleCode: PlatformAdminRole | '';
  roleName: string;
  permissions: string[];
}

export interface PlatformDashboard {
  organizations: {
    total: number;
    active: number;
    trialing: number;
    pastDue: number;
    suspended: number;
    expiringSoon: number;
  };
  users: {
    total: number;
    active30d: number;
    active7d: number;
  };
  activity: {
    casesThisMonth: number;
    storageBytes: number;
    openTickets: number;
    criticalTickets: number;
    queuedBackups: number;
    failedBackups: number;
    unresolvedErrors: number;
    failedEmails: number;
    failedAutomations: number;
  };
  alerts: PlatformAlert[];
  recentAudit: PlatformAuditEvent[];
}

export interface PlatformAlert {
  code: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  detail: string;
  organizationId?: string | null;
  organizationName?: string | null;
  actionUrl?: string | null;
}

export interface PlatformOrganizationSummary {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  planId: string | null;
  planCode: string | null;
  planName: string | null;
  subscriptionStatus: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  usersActive: number;
  usersTotal: number;
  casesThisMonth: number;
  casesOpen: number;
  documents: number;
  storageBytes: number;
  ticketsOpen: number;
  lastActivityAt: string | null;
  lastBackupAt: string | null;
  lastBackupStatus: string | null;
}

export interface PlatformPlan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  monthlyPriceCop: number;
  limits: Record<string, unknown>;
  features: Record<string, unknown>;
  isActive: boolean;
}

export interface PlatformOrganizationDetail {
  organization: PlatformOrganizationSummary & {
    settings: Record<string, unknown>;
    branding: {
      productName: string;
      shortName: string;
      logoUrl: string | null;
      primaryColor: string;
      accentColor: string;
      sidebarColor: string;
      supportEmail: string | null;
      customDomain: string | null;
    } | null;
  };
  subscription: {
    id: string | null;
    planId: string | null;
    status: string | null;
    trialEndsAt: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    limitsOverride: Record<string, unknown>;
  } | null;
  plans: PlatformPlan[];
  usage: {
    usersActive: number;
    usersTotal: number;
    casesTotal: number;
    casesOpen: number;
    casesThisMonth: number;
    documents: number;
    storageBytes: number;
    emailsThisMonth: number;
    automationsThisMonth: number;
    publicSubmissionsThisMonth: number;
    exportsThisMonth: number;
  };
  configuration: {
    areas: Array<Record<string, unknown>>;
    priorities: Array<Record<string, unknown>>;
    caseTypes: Array<Record<string, unknown>>;
    states: Array<Record<string, unknown>>;
    slaPolicies: Array<Record<string, unknown>>;
    roles: Array<Record<string, unknown>>;
    emailTemplates: Array<Record<string, unknown>>;
    automationRules: Array<Record<string, unknown>>;
    publicIntakeSecurity: Record<string, unknown> | null;
  };
  users: PlatformUser[];
  tickets: SupportTicket[];
  backups: OrganizationBackupJob[];
  recentAudit: PlatformAuditEvent[];
  subscriptionHistory: Array<Record<string, unknown>>;
}

export interface PlatformUserMembership {
  membershipId: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  roleId: string;
  roleCode: string;
  roleName: string;
  isActive: boolean;
  areas: Array<{ id: string; name: string; isPrimary: boolean; isCoordinator: boolean }>;
}

export interface PlatformUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
  bannedUntil: string | null;
  lastActivityAt: string | null;
  memberships: PlatformUserMembership[];
  isPlatformAdmin: boolean;
  platformRole: string | null;
}

export interface PlatformAuditEvent {
  id: number;
  organizationId: string | null;
  organizationName: string | null;
  actorUserId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  source: 'organization' | 'platform' | 'system';
  eventType: string;
  entityType: string;
  entityId: string | null;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface SupportTicketMessage {
  id: string;
  ticketId: string;
  authorUserId: string | null;
  authorName: string | null;
  authorEmail: string | null;
  authorKind: 'organization' | 'platform' | 'system';
  body: string;
  isInternal: boolean;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  organizationId: string;
  organizationName: string | null;
  createdBy: string | null;
  requesterName: string | null;
  requesterEmail: string | null;
  category: string;
  subcategory: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'new' | 'in_analysis' | 'assigned' | 'waiting_customer' | 'in_solution' | 'resolved' | 'closed' | 'reopened' | 'cancelled';
  subject: string;
  description: string;
  assignedTo: string | null;
  assignedToName: string | null;
  relatedCaseId: string | null;
  relatedCaseRadicado: string | null;
  slaDueAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  messages?: SupportTicketMessage[];
}

export interface OrganizationBackupJob {
  id: string;
  organizationId: string;
  organizationName: string | null;
  requestedBy: string | null;
  requestedByName: string | null;
  scope: 'full' | 'database' | 'documents' | 'configuration';
  reason: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  storagePath: string | null;
  manifest: Record<string, unknown>;
  sizeBytes: number;
  checksum: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface PlatformOperationsSnapshot {
  errors: Array<Record<string, unknown>>;
  emailQueue: Array<Record<string, unknown>>;
  automations: Array<Record<string, unknown>>;
  exportJobs: Array<Record<string, unknown>>;
  qualityRuns: Array<Record<string, unknown>>;
  counters: {
    unresolvedErrors: number;
    queuedEmails: number;
    failedEmails: number;
    failedAutomations: number;
    pendingExports: number;
    failedQualityRuns: number;
  };
}

export interface PlatformSupportSession {
  id: string;
  organizationId: string;
  organizationName: string;
  adminUserId: string;
  mode: 'read_only' | 'support' | 'admin';
  reason: string;
  ticketId: string | null;
  startedAt: string;
  expiresAt: string;
  endedAt: string | null;
  isActive: boolean;
}

export interface PaginatedResult<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}
