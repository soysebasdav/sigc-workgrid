export type PlatformAdminRole = 'owner' | 'admin' | 'support' | 'support_manager' | 'support_agent' | 'subscription_manager' | 'backup_operator' | 'auditor' | 'operations_operator';

export interface PlatformAccessContext {
  isPlatformAdmin: boolean;
  userId: string | null;
  roleCode: PlatformAdminRole | '';
  roleName: string;
  permissions: string[];
  aal?: 'aal1' | 'aal2' | string;
  mfaEnrolled?: boolean;
  mfaVerified?: boolean;
  verifiedFactors?: number;
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
  firstResponseAt?: string | null;
  firstResponseDueAt?: string | null;
  resolutionDueAt?: string | null;
  firstResponseBreached?: boolean;
  resolutionBreached?: boolean;
  escalatedAt?: string | null;
  escalationReason?: string | null;
  tags?: string[];
  events?: Array<Record<string, unknown>>;
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


export interface PlatformRoleDefinition {
  id: string;
  code: PlatformAdminRole;
  name: string;
  description: string | null;
  isActive: boolean;
  permissions: string[];
}

export interface PlatformTeamMember {
  userId: string;
  name: string;
  email: string;
  roleCode: PlatformAdminRole;
  roleName: string;
  isActive: boolean;
  lastAccessAt: string | null;
  createdAt: string;
  mfaEnrolled: boolean;
  mfaVerifiedFactors: number;
}

export interface PlatformSecuritySettings {
  enforce_mfa: boolean;
  require_mfa_for_sensitive_actions: boolean;
  support_session_default_minutes: number;
  support_session_max_minutes: number;
  require_ticket_for_write_access: boolean;
  require_two_person_approval_for_admin_access: boolean;
  notify_organization_on_support_access: boolean;
  session_idle_minutes: number;
  updated_at?: string;
}

export interface PlatformSecuritySnapshot {
  settings: PlatformSecuritySettings;
  team: PlatformTeamMember[];
  roles: PlatformRoleDefinition[];
  currentAal: string;
}

export interface PlatformSupportAccessRequest {
  id: string;
  organizationId: string;
  organizationName: string;
  ticketId: string | null;
  ticketNumber: string | null;
  requestedBy: string;
  requestedByName: string | null;
  mode: 'read_only' | 'support' | 'admin';
  scopes: string[];
  reason: string;
  durationMinutes: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired' | 'started' | 'completed';
  requestedAt: string;
  expiresAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
  startedSessionId: string | null;
}

export interface PlatformSupportSessionV2 extends PlatformSupportSession {
  adminName?: string | null;
  ticketId: string | null;
  scopes: string[];
  mfaVerified: boolean;
}

export interface PlatformSupportAccessSnapshot {
  requests: PlatformSupportAccessRequest[];
  sessions: PlatformSupportSessionV2[];
}

export interface OrganizationBackupSchedule {
  id: string;
  organizationId: string;
  organizationName: string;
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  localTime: string;
  timezone: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  scope: OrganizationBackupJob['scope'];
  retentionDays: number;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastStatus: string | null;
}

export interface BackupRestoreRequest {
  id: string;
  organizationId: string;
  organizationName: string;
  backupJobId: string;
  requestedBy: string;
  requestedByName: string;
  reason: string;
  restoreMode: 'merge' | 'replace';
  targetEnvironment: 'validation' | 'production';
  status: 'pending_approval' | 'approved' | 'rejected' | 'validating' | 'ready' | 'applying' | 'completed' | 'failed' | 'cancelled';
  confirmationCode: string;
  approvedBy: string | null;
  approvedAt: string | null;
  decisionReason: string | null;
  validationReport: Record<string, unknown>;
  restoreReport: Record<string, unknown>;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformRecoverySnapshot {
  schedules: OrganizationBackupSchedule[];
  restores: BackupRestoreRequest[];
}

export interface OrganizationUsageControl {
  organizationId: string;
  planLimits: Record<string, unknown>;
  limitsOverride: Record<string, unknown>;
  effectiveLimits: Record<string, unknown>;
  planFeatures: Record<string, unknown>;
  currentUsage: Record<string, unknown>;
  history: Array<Record<string, unknown>>;
  featureFlags: Array<{
    id: string;
    featureCode: string;
    enabled: boolean;
    configuration: Record<string, unknown>;
    source: string;
    updatedAt: string;
  }>;
  alerts: Array<{
    id: string;
    metricCode: string;
    currentValue: number;
    limitValue: number;
    percentage: number;
    severity: string;
    status: string;
    lastDetectedAt: string;
    resolutionNote: string | null;
  }>;
}

export interface PlatformExplorerResult {
  domain: string;
  rows: Array<Record<string, unknown>>;
  total: number;
  page: number;
  pageSize: number;
}

export interface CommercialMetrics {
  activeSubscriptions: number;
  trialingSubscriptions: number;
  pastDueSubscriptions: number;
  scheduledCancellations: number;
  monthlyRecurringRevenue: number;
  invoicedThisMonth: number;
  collectedThisMonth: number;
  outstandingBalance: number;
  overdueInvoices: number;
  pendingRequests: number;
  onboardingInProgress: number;
}

export interface CommercialRenewal {
  organizationId: string;
  organizationName: string;
  planName: string;
  status: string;
  periodEnd: string | null;
  autoRenew: boolean;
  cancelAtPeriodEnd: boolean;
}

export interface BillingInvoice {
  id: string;
  invoiceNumber: string;
  organizationId: string;
  organizationName: string;
  status: 'draft' | 'issued' | 'partially_paid' | 'paid' | 'overdue' | 'void';
  currency: string;
  issueDate: string;
  dueDate: string;
  servicePeriodStart: string | null;
  servicePeriodEnd: string | null;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  notes: string | null;
  createdAt: string;
}

export interface BillingPayment {
  id: string;
  paymentNumber: string;
  organizationId: string;
  organizationName: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'refunded';
  method: string;
  amount: number;
  paidAt: string;
  reference: string | null;
  createdAt: string;
}

export interface BillingAccount {
  id: string;
  organizationId: string;
  organizationName: string;
  legalName: string;
  taxId: string | null;
  billingEmail: string | null;
  contactName: string | null;
  paymentTermsDays: number;
  status: 'active' | 'incomplete' | 'blocked';
}

export interface CommercialRequest {
  id: string;
  organizationId: string;
  organizationName: string;
  requestType: 'plan_change' | 'cancel' | 'reactivate' | 'addon_change' | 'billing_update' | 'renewal';
  requestedPayload?: Record<string, unknown>;
  reason: string;
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'applied' | 'cancelled';
  requestedAt: string;
  requestedByName?: string | null;
  reviewNotes?: string | null;
}

export interface CommercialDashboard {
  metrics: CommercialMetrics;
  renewals: CommercialRenewal[];
  recentInvoices: BillingInvoice[];
  pendingRequests: CommercialRequest[];
}

export interface CommercialPlan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  monthlyPriceCop: number;
  annualPriceCop: number;
  currency: string;
  trialDays: number;
  graceDays: number;
  billingIntervals: string[];
  limits: Record<string, unknown>;
  features: Record<string, unknown>;
  onboardingTemplate: Record<string, unknown>;
  isPublic: boolean;
  isActive: boolean;
  sortOrder: number;
  version: number;
  activeSubscriptions: number;
}

export interface CommercialAddon {
  id: string;
  code: string;
  name: string;
  description: string | null;
  unitName: string;
  monthlyPriceCop: number;
  annualPriceCop: number;
  currency: string;
  limitsDelta: Record<string, unknown>;
  featuresDelta: Record<string, unknown>;
  minQuantity: number;
  maxQuantity: number | null;
  isPublic: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface CommercialCoupon {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  currency: string;
  validFrom: string | null;
  validUntil: string | null;
  maxRedemptions: number | null;
  redemptionCount: number;
  applicablePlanIds: string[];
  firstPurchaseOnly: boolean;
  isActive: boolean;
}

export interface CommercialCatalog {
  plans: CommercialPlan[];
  addons: CommercialAddon[];
  coupons: CommercialCoupon[];
}

export interface BillingSnapshot extends PaginatedResult<BillingInvoice> {
  payments: BillingPayment[];
  accounts: BillingAccount[];
}

export interface OnboardingRecord {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  status: 'not_started' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
  currentStep: string;
  progress: number;
  checklist: Record<string, boolean>;
  adminEmail: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  blockingReason: string | null;
  notes: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  planName: string | null;
  subscriptionStatus: string | null;
  periodEnd: string | null;
}

export interface OrganizationSubscriptionPortal {
  organization: { id: string; name: string; slug: string; isActive: boolean };
  subscription: {
    id: string;
    status: string;
    planId: string;
    planName: string;
    planCode: string;
    billingInterval: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    trialEndsAt: string | null;
    autoRenew: boolean;
    cancelAtPeriodEnd: boolean;
    nextPlanId: string | null;
    nextPlanName: string | null;
    nextBillingInterval: string | null;
    nextChangeAt: string | null;
    limits: Record<string, unknown>;
    features: Record<string, unknown>;
  };
  billingAccount: Record<string, unknown>;
  invoices: BillingInvoice[];
  payments: BillingPayment[];
  requests: CommercialRequest[];
  plans: CommercialPlan[];
  addons: CommercialAddon[];
  canManage: boolean;
}
