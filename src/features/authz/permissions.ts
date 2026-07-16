export const PERMISSIONS = {
  caseCreate: 'case.create',
  caseReadAll: 'case.read_all',
  caseReadAssigned: 'case.read_assigned',
  caseAssign: 'case.assign',
  caseChangeState: 'case.change_state',
  caseOverrideSla: 'case.override_sla',
  caseApprove: 'case.approve',
  caseClose: 'case.close',
  caseComment: 'case.comment',
  caseManageSubtasks: 'case.manage_subtasks',
  caseSendReminder: 'case.send_reminder',
  caseReview: 'case.review',
  caseRegisterDelivery: 'case.register_delivery',
  documentUpload: 'document.upload',
  documentDelete: 'document.delete',
  adminManageUsers: 'admin.manage_users',
  adminManageConfiguration: 'admin.manage_configuration',
  automationView: 'automation.view',
  automationManage: 'automation.manage',
  auditView: 'audit.view',
  auditExport: 'audit.export',
  reportsView: 'reports.view',
  reportsExport: 'reports.export',
  saasManageWorkspace: 'saas.manage_workspace',
  clientPortal: 'client.portal',
  qualityView: 'quality.view',
  qualityRun: 'quality.run',
  integrationsView: 'integrations.view',
  integrationsManage: 'integrations.manage',
  integrationsApiManage: 'integrations.api.manage',
  integrationsWebhookManage: 'integrations.webhook.manage',
  integrationsDomainManage: 'integrations.domain.manage',
  integrationsIdentityManage: 'integrations.identity.manage',
  integrationsExportsManage: 'integrations.exports.manage',
  knowledgeView: 'knowledge.view',
  privacyView: 'privacy.view',
  privacyManage: 'privacy.manage',
  regionalView: 'regional.view',
  regionalManage: 'regional.manage'
} as const;

export type PermissionCode = typeof PERMISSIONS[keyof typeof PERMISSIONS];

export const ALL_PERMISSION_CODES = Object.freeze(Object.values(PERMISSIONS)) as readonly PermissionCode[];

export const CASE_READ_PERMISSIONS = [PERMISSIONS.caseReadAll, PERMISSIONS.caseReadAssigned] as const;

export const DEMO_ANALYST_PERMISSIONS: readonly PermissionCode[] = [
  PERMISSIONS.caseCreate,
  PERMISSIONS.caseReadAssigned,
  PERMISSIONS.caseChangeState,
  PERMISSIONS.caseComment,
  PERMISSIONS.caseManageSubtasks,
  PERMISSIONS.caseSendReminder,
  PERMISSIONS.caseReview,
  PERMISSIONS.caseRegisterDelivery,
  PERMISSIONS.documentUpload,
  PERMISSIONS.reportsView
];
