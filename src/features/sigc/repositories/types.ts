import type {
  AddCommentInput,
  AddDocumentVersionInput,
  AllowedCaseState,
  CaseAssignmentInput,
  ClassifyCaseInput,
  UpdateCaseAssignmentInput,
  DeactivateCaseAssignmentInput,
  ChangeCaseStateInput,
  CreateSubtaskInput,
  CreatedCaseResult,
  CreatedCommentResult,
  CreatedSubtaskResult,
  ManualCaseCreateInput,
  PublicCaseCreateInput,
  PublicCaseSubmissionResult,
  PublicIntakeContext,
  PublicIntakeLocator,
  SigcAssignment,
  SigcCase,
  SigcCaseFilters,
  SigcCasePage,
  SigcCatalogs,
  SigcComment,
  SigcDocument,
  SigcDocumentVersion,
  UpdateDocumentRetentionInput,
  SigcAuditFilters,
  SigcAuditPage,
  SigcTimelinePage,
  EmailTemplatePreviewInput,
  EmailTemplatePreview,
  SendTestEmailInput,
  RuntimeExecutionResult,
  SigcMember,
  SigcSubtask,
  SigcSubtaskFilters,
  SigcSubtaskPage,
  SigcDocumentFilters,
  SigcDocumentPage,
  SigcTimelineEvent,
  UpdateSubtaskInput,
  UploadCaseDocumentInput,
  SigcSlaOverride,
  OverrideCaseSlaInput,
  SigcCaseReview,
  SubmitCaseReviewInput,
  DecideCaseReviewInput,
  SigcCaseDelivery,
  RegisterCaseDeliveryInput,
  SigcCaseReminder,
  SendManualReminderInput,
  SigcAdminSnapshot,
  SigcUserManagementSnapshot,
  SigcNotificationPage,
  SigcSidebarSummary,
  SigcSecurityHealth,
  ClientPortalSnapshot,
  SaveAdminCatalogInput,
  SaveSlaPolicyInput,
  SaveHolidayInput,
  SaveRoleInput,
  SaveTransitionInput,
  SaveEmailTemplateInput,
  SaveReminderRuleInput,
  SaveAutomationRuleInput,
  AutomationRuleVersion,
  AutomationDryRunResult,
  SigcDashboardAnalytics,
  SigcReportFilters,
  SigcReportResult,
  SigcReportExportFormat,
  SigcReportExportJob,
  SigcReportExportPage,
  SigcSaasContext,
  SigcAuthorizationContext,
  UpdateOrganizationProfileInput,
  UpdatePublicIntakeSettingsInput,
  CreateSaasOrganizationInput,
  CreateOrganizationInvitationInput,
  CreatedOrganizationInvitation,
  ClientErrorInput,
  SigcAgendaSnapshot,
  WorkflowBoardFilters,
  WorkflowBoardSnapshot,
  MoveWorkflowCaseInput,
  MoveWorkflowCaseResult,
  AutomationRuntimeHealth,
  QualityDashboard,
  RunQualitySuiteInput,
  QualityRunRecord
} from '../domain/types';

export interface SigcRepository {
  searchCases(filters: SigcCaseFilters): Promise<SigcCasePage>;
  getCaseByIdentifier(identifier: string): Promise<SigcCase | null>;
  getCatalogs(): Promise<SigcCatalogs>;
  listMembers(): Promise<SigcMember[]>;
  listCaseAssignments(caseId: string): Promise<SigcAssignment[]>;
  listAllowedStates(caseId: string): Promise<AllowedCaseState[]>;
  createManualCase(input: ManualCaseCreateInput): Promise<CreatedCaseResult>;
  assignCase(input: CaseAssignmentInput): Promise<void>;
  classifyCase(input: ClassifyCaseInput): Promise<void>;
  updateCaseAssignment(input: UpdateCaseAssignmentInput): Promise<void>;
  deactivateCaseAssignment(input: DeactivateCaseAssignmentInput): Promise<void>;
  changeCaseState(input: ChangeCaseStateInput): Promise<void>;
  getWorkflowBoard(filters?: WorkflowBoardFilters): Promise<WorkflowBoardSnapshot>;
  moveCaseInWorkflow(input: MoveWorkflowCaseInput): Promise<MoveWorkflowCaseResult>;

  listSubtasks(filters?: SigcSubtaskFilters): Promise<SigcSubtask[]>;
  searchSubtasks(filters?: SigcSubtaskFilters): Promise<SigcSubtaskPage>;
  createSubtask(input: CreateSubtaskInput): Promise<CreatedSubtaskResult>;
  updateSubtask(input: UpdateSubtaskInput): Promise<void>;
  deleteSubtask(subtaskId: string): Promise<void>;

  listCaseComments(caseId: string): Promise<SigcComment[]>;
  addComment(input: AddCommentInput): Promise<CreatedCommentResult>;

  listDocuments(caseId?: string): Promise<SigcDocument[]>;
  searchDocuments(filters?: SigcDocumentFilters): Promise<SigcDocumentPage>;
  listDocumentVersions(documentId: string): Promise<SigcDocumentVersion[]>;
  updateDocumentRetention(input: UpdateDocumentRetentionInput): Promise<void>;
  setDocumentClientVisibility(documentId: string, isVisible: boolean): Promise<void>;
  uploadDocument(input: UploadCaseDocumentInput): Promise<SigcDocument>;
  addDocumentVersion(input: AddDocumentVersionInput): Promise<void>;
  deleteDocument(documentId: string): Promise<void>;
  getDocumentSignedUrl(storagePath: string): Promise<string>;

  listCaseTimeline(caseId: string, page?: number, pageSize?: number): Promise<SigcTimelinePage>;
  getAuditEvents(filters: SigcAuditFilters): Promise<SigcAuditPage>;

  listCaseSlaOverrides(caseId: string): Promise<SigcSlaOverride[]>;
  overrideCaseSla(input: OverrideCaseSlaInput): Promise<void>;

  listCaseReviews(caseId: string): Promise<SigcCaseReview[]>;
  submitCaseForReview(input: SubmitCaseReviewInput): Promise<void>;
  decideCaseReview(input: DecideCaseReviewInput): Promise<void>;

  listCaseDeliveries(caseId: string): Promise<SigcCaseDelivery[]>;
  registerCaseDelivery(input: RegisterCaseDeliveryInput): Promise<void>;

  listCaseReminders(caseId: string): Promise<SigcCaseReminder[]>;
  sendManualReminder(input: SendManualReminderInput): Promise<number>;

  getAdminSnapshot(): Promise<SigcAdminSnapshot>;
  getUserManagementSnapshot(): Promise<SigcUserManagementSnapshot>;
  saveAdminCatalog(input: SaveAdminCatalogInput): Promise<void>;
  setAdminCatalogActive(kind: SaveAdminCatalogInput['kind'], id: string, isActive: boolean): Promise<void>;
  saveSlaPolicy(input: SaveSlaPolicyInput): Promise<void>;
  saveHoliday(input: SaveHolidayInput): Promise<void>;
  deleteHoliday(id: string): Promise<void>;
  saveRole(input: SaveRoleInput): Promise<string>;
  setRolePermissions(roleId: string, permissionIds: string[]): Promise<void>;
  setMemberRole(membershipId: string, roleId: string): Promise<void>;
  setMemberActive(membershipId: string, isActive: boolean): Promise<void>;
  removeMember(membershipId: string): Promise<void>;
  saveWorkflowStates(caseTypeId: string, stateIds: string[]): Promise<void>;
  saveTransition(input: SaveTransitionInput): Promise<void>;
  deleteTransition(id: string): Promise<void>;
  saveEmailTemplate(input: SaveEmailTemplateInput): Promise<void>;
  saveReminderRule(input: SaveReminderRuleInput): Promise<void>;
  previewEmailTemplate(input: EmailTemplatePreviewInput): Promise<EmailTemplatePreview>;
  sendTestEmail(input: SendTestEmailInput): Promise<void>;
  runRuntimeNow(): Promise<RuntimeExecutionResult>;
  saveAutomationRule(input: SaveAutomationRuleInput): Promise<void>;
  publishAutomationRule(id: string): Promise<void>;
  archiveAutomationRule(id: string): Promise<void>;
  restoreAutomationRuleVersion(id: string, versionNumber: number): Promise<void>;
  listAutomationRuleVersions(id: string): Promise<AutomationRuleVersion[]>;
  dryRunAutomationRule(ruleId: string, caseId: string): Promise<AutomationDryRunResult>;
  toggleAutomationRule(id: string, isActive: boolean): Promise<void>;
  runAutomationRule(ruleId: string, caseId: string): Promise<void>;
  getAutomationRuntimeHealth(): Promise<AutomationRuntimeHealth>;

  getDashboardAnalytics(): Promise<SigcDashboardAnalytics>;
  getSidebarSummary(): Promise<SigcSidebarSummary>;
  getNotificationPage(page?: number, pageSize?: number): Promise<SigcNotificationPage>;
  getAgenda(from: string, to: string): Promise<SigcAgendaSnapshot>;
  getReport(filters: SigcReportFilters, page?: number, pageSize?: number): Promise<SigcReportResult>;
  createReportExportJob(format: SigcReportExportFormat, filters: SigcReportFilters): Promise<SigcReportExportJob>;
  getReportExportPage(jobId: string, page: number, pageSize: number): Promise<SigcReportExportPage>;
  completeReportExportJob(jobId: string, status: 'completed' | 'failed' | 'cancelled', errorMessage?: string): Promise<void>;

  getSaasContext(): Promise<SigcSaasContext>;
  getSecurityHealth(): Promise<SigcSecurityHealth>;
  getClientPortal(page?: number, pageSize?: number, query?: string): Promise<ClientPortalSnapshot>;
  getAuthorizationContext(): Promise<SigcAuthorizationContext>;
  setActiveOrganization(organizationId: string): Promise<void>;
  updateOrganizationProfile(input: UpdateOrganizationProfileInput): Promise<void>;
  updatePublicIntakeSettings(input: UpdatePublicIntakeSettingsInput): Promise<void>;
  createSaasOrganization(input: CreateSaasOrganizationInput): Promise<string>;
  createOrganizationInvitation(input: CreateOrganizationInvitationInput): Promise<CreatedOrganizationInvitation>;
  revokeOrganizationInvitation(invitationId: string): Promise<void>;
  logClientError(input: ClientErrorInput): Promise<void>;
  getQualityDashboard(): Promise<QualityDashboard>;
  runQualitySuite(input: RunQualitySuiteInput): Promise<QualityRunRecord>;
}

export interface PublicSigcRepository {
  getPublicIntakeContext(locator: PublicIntakeLocator): Promise<PublicIntakeContext | null>;
  createPublicCase(input: PublicCaseCreateInput): Promise<PublicCaseSubmissionResult>;
  getOrganizationInvitation(token: string): Promise<import('../domain/types').PublicOrganizationInvitation | null>;
  acceptOrganizationInvitation(token: string): Promise<string>;
}
