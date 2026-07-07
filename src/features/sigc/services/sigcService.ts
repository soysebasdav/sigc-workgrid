import { dataMode } from '../../../lib/supabaseClient';
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
  SigcRepositoryResult,
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
  PublicOrganizationInvitation,
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
import { demoPublicSigcRepository, demoSigcRepository } from '../repositories/demoSigcRepository';
import { supabasePublicSigcRepository, supabaseSigcRepository } from '../repositories/supabaseSigcRepository';

export const SIGC_DATA_CHANGED_EVENT = 'sigc:data-changed';

export function emitSigcDataChanged(): void {
  window.dispatchEvent(new CustomEvent(SIGC_DATA_CHANGED_EVENT));
}

async function withSafeReadFallback<T>(remote: () => Promise<T>, local: () => Promise<T>): Promise<SigcRepositoryResult<T>> {
  // En modo Supabase nunca se sustituyen datos reales por datos demo. Un fallo remoto debe ser visible.
  if (dataMode !== 'supabase') return { data: await local(), source: 'demo' };
  return { data: await remote(), source: 'supabase' };
}

async function withStrictRead<T>(remote: () => Promise<T>, local: () => Promise<T>): Promise<SigcRepositoryResult<T>> {
  if (dataMode !== 'supabase') return { data: await local(), source: 'demo' };
  return { data: await remote(), source: 'supabase' };
}

function mutationRepository() {
  return dataMode === 'supabase' ? supabaseSigcRepository : demoSigcRepository;
}

function publicMutationRepository() {
  return dataMode === 'supabase' ? supabasePublicSigcRepository : demoPublicSigcRepository;
}

export const sigcService = {

  searchCases(filters: SigcCaseFilters): Promise<SigcRepositoryResult<SigcCasePage>> {
    return withStrictRead(() => supabaseSigcRepository.searchCases(filters), () => demoSigcRepository.searchCases(filters));
  },

  getCase(identifier: string): Promise<SigcRepositoryResult<SigcCase | null>> {
    return withSafeReadFallback(() => supabaseSigcRepository.getCaseByIdentifier(identifier), () => demoSigcRepository.getCaseByIdentifier(identifier));
  },

  getCatalogs(): Promise<SigcRepositoryResult<SigcCatalogs>> {
    return withSafeReadFallback(() => supabaseSigcRepository.getCatalogs(), () => demoSigcRepository.getCatalogs());
  },

  getMembers(): Promise<SigcRepositoryResult<SigcMember[]>> {
    return withSafeReadFallback(() => supabaseSigcRepository.listMembers(), () => demoSigcRepository.listMembers());
  },

  getAssignments(caseId: string): Promise<SigcRepositoryResult<SigcAssignment[]>> {
    return withSafeReadFallback(() => supabaseSigcRepository.listCaseAssignments(caseId), () => demoSigcRepository.listCaseAssignments(caseId));
  },

  getAllowedStates(caseId: string): Promise<SigcRepositoryResult<AllowedCaseState[]>> {
    return withSafeReadFallback(() => supabaseSigcRepository.listAllowedStates(caseId), () => demoSigcRepository.listAllowedStates(caseId));
  },

  async getPublicIntakeContext(locator: PublicIntakeLocator): Promise<SigcRepositoryResult<PublicIntakeContext | null>> {
    if (dataMode !== 'supabase') return { data: await demoPublicSigcRepository.getPublicIntakeContext(locator), source: 'demo' };
    return { data: await supabasePublicSigcRepository.getPublicIntakeContext(locator), source: 'supabase' };
  },

  async createPublicCase(input: PublicCaseCreateInput): Promise<PublicCaseSubmissionResult> {
    const result = await publicMutationRepository().createPublicCase(input);
    emitSigcDataChanged();
    return result;
  },

  async createManualCase(input: ManualCaseCreateInput): Promise<CreatedCaseResult> {
    const result = await mutationRepository().createManualCase(input);
    emitSigcDataChanged();
    return result;
  },

  async assignCase(input: CaseAssignmentInput): Promise<void> {
    await mutationRepository().assignCase(input);
    emitSigcDataChanged();
  },

  async classifyCase(input: ClassifyCaseInput): Promise<void> {
    await mutationRepository().classifyCase(input);
    emitSigcDataChanged();
  },

  async updateCaseAssignment(input: UpdateCaseAssignmentInput): Promise<void> {
    await mutationRepository().updateCaseAssignment(input);
    emitSigcDataChanged();
  },

  async deactivateCaseAssignment(input: DeactivateCaseAssignmentInput): Promise<void> {
    await mutationRepository().deactivateCaseAssignment(input);
    emitSigcDataChanged();
  },

  async changeCaseState(input: ChangeCaseStateInput): Promise<void> {
    await mutationRepository().changeCaseState(input);
    emitSigcDataChanged();
  },

  getWorkflowBoard(filters: WorkflowBoardFilters = {}): Promise<SigcRepositoryResult<WorkflowBoardSnapshot>> {
    return withStrictRead(() => supabaseSigcRepository.getWorkflowBoard(filters), () => demoSigcRepository.getWorkflowBoard(filters));
  },

  async moveCaseInWorkflow(input: MoveWorkflowCaseInput): Promise<MoveWorkflowCaseResult> {
    const result = await mutationRepository().moveCaseInWorkflow(input);
    emitSigcDataChanged();
    return result;
  },

  listSubtasks(filters: SigcSubtaskFilters = {}): Promise<SigcRepositoryResult<SigcSubtask[]>> {
    return withSafeReadFallback(() => supabaseSigcRepository.listSubtasks(filters), () => demoSigcRepository.listSubtasks(filters));
  },

  searchSubtasks(filters: SigcSubtaskFilters = {}): Promise<SigcRepositoryResult<SigcSubtaskPage>> {
    return withStrictRead(() => supabaseSigcRepository.searchSubtasks(filters), () => demoSigcRepository.searchSubtasks(filters));
  },

  async createSubtask(input: CreateSubtaskInput): Promise<CreatedSubtaskResult> {
    const repository = mutationRepository();
    const result = await repository.createSubtask(input);
    const uploads = await Promise.allSettled((input.files ?? []).map((file) => repository.uploadDocument({
      caseId: input.caseId,
      name: file.name,
      category: 'Adjunto de subtarea',
      file,
      subtaskId: result.subtaskId
    })));
    const failedAttachments = (input.files ?? []).filter((_, index) => uploads[index]?.status === 'rejected').map((file) => file.name);
    emitSigcDataChanged();
    return { ...result, failedAttachments };
  },

  async updateSubtask(input: UpdateSubtaskInput): Promise<string[]> {
    const repository = mutationRepository();
    await repository.updateSubtask(input);
    const uploads = await Promise.allSettled((input.files ?? []).map((file) => repository.uploadDocument({
      caseId: input.caseId,
      name: file.name,
      category: 'Adjunto de subtarea',
      file,
      subtaskId: input.subtaskId
    })));
    const failedAttachments = (input.files ?? []).filter((_, index) => uploads[index]?.status === 'rejected').map((file) => file.name);
    emitSigcDataChanged();
    return failedAttachments;
  },

  async deleteSubtask(subtaskId: string): Promise<void> {
    await mutationRepository().deleteSubtask(subtaskId);
    emitSigcDataChanged();
  },

  getCaseComments(caseId: string): Promise<SigcRepositoryResult<SigcComment[]>> {
    return withSafeReadFallback(() => supabaseSigcRepository.listCaseComments(caseId), () => demoSigcRepository.listCaseComments(caseId));
  },

  async addComment(input: AddCommentInput): Promise<CreatedCommentResult> {
    const repository = mutationRepository();
    const result = await repository.addComment(input);
    const uploads = await Promise.allSettled((input.files ?? []).map((file) => repository.uploadDocument({
      caseId: input.caseId,
      name: file.name,
      category: 'Adjunto de comentario',
      file,
      commentId: result.commentId,
      subtaskId: input.subtaskId
    })));
    const failedAttachments = (input.files ?? []).filter((_, index) => uploads[index]?.status === 'rejected').map((file) => file.name);
    emitSigcDataChanged();
    return { ...result, failedAttachments };
  },

  getDocuments(caseId?: string): Promise<SigcRepositoryResult<SigcDocument[]>> {
    return withSafeReadFallback(() => supabaseSigcRepository.listDocuments(caseId), () => demoSigcRepository.listDocuments(caseId));
  },

  searchDocuments(filters: SigcDocumentFilters = {}): Promise<SigcRepositoryResult<SigcDocumentPage>> {
    return withStrictRead(() => supabaseSigcRepository.searchDocuments(filters), () => demoSigcRepository.searchDocuments(filters));
  },

  getDocumentVersions(documentId: string): Promise<SigcRepositoryResult<SigcDocumentVersion[]>> {
    return withSafeReadFallback(() => supabaseSigcRepository.listDocumentVersions(documentId), () => demoSigcRepository.listDocumentVersions(documentId));
  },

  async updateDocumentRetention(input: UpdateDocumentRetentionInput): Promise<void> {
    await mutationRepository().updateDocumentRetention(input);
    emitSigcDataChanged();
  },

  async setDocumentClientVisibility(documentId: string, isVisible: boolean): Promise<void> {
    await mutationRepository().setDocumentClientVisibility(documentId, isVisible);
    emitSigcDataChanged();
  },

  async uploadDocument(input: UploadCaseDocumentInput): Promise<SigcDocument> {
    const document = await mutationRepository().uploadDocument(input);
    emitSigcDataChanged();
    return document;
  },

  async addDocumentVersion(input: AddDocumentVersionInput): Promise<void> {
    await mutationRepository().addDocumentVersion(input);
    emitSigcDataChanged();
  },

  async deleteDocument(documentId: string): Promise<void> {
    await mutationRepository().deleteDocument(documentId);
    emitSigcDataChanged();
  },

  getDocumentSignedUrl(storagePath: string): Promise<string> {
    return mutationRepository().getDocumentSignedUrl(storagePath);
  },

  getCaseTimeline(caseId: string, page = 1, pageSize = 100): Promise<SigcRepositoryResult<SigcTimelinePage>> {
    return withSafeReadFallback(() => supabaseSigcRepository.listCaseTimeline(caseId, page, pageSize), () => demoSigcRepository.listCaseTimeline(caseId, page, pageSize));
  },

  getAuditEvents(filters: SigcAuditFilters): Promise<SigcRepositoryResult<SigcAuditPage>> {
    return withStrictRead(() => supabaseSigcRepository.getAuditEvents(filters), () => demoSigcRepository.getAuditEvents(filters));
  },

  getCaseSlaOverrides(caseId: string): Promise<SigcRepositoryResult<SigcSlaOverride[]>> {
    return withSafeReadFallback(() => supabaseSigcRepository.listCaseSlaOverrides(caseId), () => demoSigcRepository.listCaseSlaOverrides(caseId));
  },

  async overrideCaseSla(input: OverrideCaseSlaInput): Promise<void> {
    await mutationRepository().overrideCaseSla(input);
    emitSigcDataChanged();
  },

  getCaseReviews(caseId: string): Promise<SigcRepositoryResult<SigcCaseReview[]>> {
    return withSafeReadFallback(() => supabaseSigcRepository.listCaseReviews(caseId), () => demoSigcRepository.listCaseReviews(caseId));
  },

  async submitCaseForReview(input: SubmitCaseReviewInput): Promise<void> {
    await mutationRepository().submitCaseForReview(input);
    emitSigcDataChanged();
  },

  async decideCaseReview(input: DecideCaseReviewInput): Promise<void> {
    await mutationRepository().decideCaseReview(input);
    emitSigcDataChanged();
  },

  getCaseDeliveries(caseId: string): Promise<SigcRepositoryResult<SigcCaseDelivery[]>> {
    return withSafeReadFallback(() => supabaseSigcRepository.listCaseDeliveries(caseId), () => demoSigcRepository.listCaseDeliveries(caseId));
  },

  async registerCaseDelivery(input: RegisterCaseDeliveryInput): Promise<void> {
    await mutationRepository().registerCaseDelivery(input);
    emitSigcDataChanged();
  },

  getCaseReminders(caseId: string): Promise<SigcRepositoryResult<SigcCaseReminder[]>> {
    return withSafeReadFallback(() => supabaseSigcRepository.listCaseReminders(caseId), () => demoSigcRepository.listCaseReminders(caseId));
  },

  async sendManualReminder(input: SendManualReminderInput): Promise<number> {
    const count = await mutationRepository().sendManualReminder(input);
    emitSigcDataChanged();
    return count;
  },

  async getUserManagementSnapshot(): Promise<SigcRepositoryResult<SigcUserManagementSnapshot>> {
    if (dataMode !== 'supabase') return { data: await demoSigcRepository.getUserManagementSnapshot(), source: 'demo' };
    return { data: await supabaseSigcRepository.getUserManagementSnapshot(), source: 'supabase' };
  },

  async getAdminSnapshot(): Promise<SigcRepositoryResult<SigcAdminSnapshot>> {
    if (dataMode !== 'supabase') return { data: await demoSigcRepository.getAdminSnapshot(), source: 'demo' };
    return { data: await supabaseSigcRepository.getAdminSnapshot(), source: 'supabase' };
  },

  async saveAdminCatalog(input: SaveAdminCatalogInput): Promise<void> { await mutationRepository().saveAdminCatalog(input); emitSigcDataChanged(); },
  async setAdminCatalogActive(kind: SaveAdminCatalogInput['kind'], id: string, isActive: boolean): Promise<void> { await mutationRepository().setAdminCatalogActive(kind, id, isActive); emitSigcDataChanged(); },
  async saveSlaPolicy(input: SaveSlaPolicyInput): Promise<void> { await mutationRepository().saveSlaPolicy(input); emitSigcDataChanged(); },
  async saveHoliday(input: SaveHolidayInput): Promise<void> { await mutationRepository().saveHoliday(input); emitSigcDataChanged(); },
  async deleteHoliday(id: string): Promise<void> { await mutationRepository().deleteHoliday(id); emitSigcDataChanged(); },
  async saveRole(input: SaveRoleInput): Promise<string> { const id = await mutationRepository().saveRole(input); emitSigcDataChanged(); return id; },
  async setRolePermissions(roleId: string, permissionIds: string[]): Promise<void> { await mutationRepository().setRolePermissions(roleId, permissionIds); emitSigcDataChanged(); },
  async setMemberRole(membershipId: string, roleId: string): Promise<void> { await mutationRepository().setMemberRole(membershipId, roleId); emitSigcDataChanged(); },
  async setMemberActive(membershipId: string, isActive: boolean): Promise<void> { await mutationRepository().setMemberActive(membershipId, isActive); emitSigcDataChanged(); },
  async removeMember(membershipId: string): Promise<void> { await mutationRepository().removeMember(membershipId); emitSigcDataChanged(); },
  async saveWorkflowStates(caseTypeId: string, stateIds: string[]): Promise<void> { await mutationRepository().saveWorkflowStates(caseTypeId, stateIds); emitSigcDataChanged(); },
  async saveTransition(input: SaveTransitionInput): Promise<void> { await mutationRepository().saveTransition(input); emitSigcDataChanged(); },
  async deleteTransition(id: string): Promise<void> { await mutationRepository().deleteTransition(id); emitSigcDataChanged(); },
  async saveEmailTemplate(input: SaveEmailTemplateInput): Promise<void> { await mutationRepository().saveEmailTemplate(input); emitSigcDataChanged(); },
  async saveReminderRule(input: SaveReminderRuleInput): Promise<void> { await mutationRepository().saveReminderRule(input); emitSigcDataChanged(); },
  previewEmailTemplate(input: EmailTemplatePreviewInput): Promise<EmailTemplatePreview> { return mutationRepository().previewEmailTemplate(input); },
  async sendTestEmail(input: SendTestEmailInput): Promise<void> { await mutationRepository().sendTestEmail(input); emitSigcDataChanged(); },
  async runRuntimeNow(): Promise<RuntimeExecutionResult> { const result = await mutationRepository().runRuntimeNow(); emitSigcDataChanged(); return result; },
  async saveAutomationRule(input: SaveAutomationRuleInput): Promise<void> { await mutationRepository().saveAutomationRule(input); emitSigcDataChanged(); },
  async publishAutomationRule(id: string): Promise<void> { await mutationRepository().publishAutomationRule(id); emitSigcDataChanged(); },
  async archiveAutomationRule(id: string): Promise<void> { await mutationRepository().archiveAutomationRule(id); emitSigcDataChanged(); },
  async restoreAutomationRuleVersion(id: string, versionNumber: number): Promise<void> { await mutationRepository().restoreAutomationRuleVersion(id, versionNumber); emitSigcDataChanged(); },
  listAutomationRuleVersions(id: string): Promise<AutomationRuleVersion[]> { return mutationRepository().listAutomationRuleVersions(id); },
  dryRunAutomationRule(ruleId: string, caseId: string): Promise<AutomationDryRunResult> { return mutationRepository().dryRunAutomationRule(ruleId, caseId); },
  async toggleAutomationRule(id: string, isActive: boolean): Promise<void> { await mutationRepository().toggleAutomationRule(id, isActive); emitSigcDataChanged(); },
  async runAutomationRule(ruleId: string, caseId: string): Promise<void> { await mutationRepository().runAutomationRule(ruleId, caseId); emitSigcDataChanged(); },

  getAutomationRuntimeHealth(): Promise<SigcRepositoryResult<AutomationRuntimeHealth>> {
    return withStrictRead(() => supabaseSigcRepository.getAutomationRuntimeHealth(), () => demoSigcRepository.getAutomationRuntimeHealth());
  },

  getDashboardAnalytics(): Promise<SigcRepositoryResult<SigcDashboardAnalytics>> {
    return withStrictRead(() => supabaseSigcRepository.getDashboardAnalytics(), () => demoSigcRepository.getDashboardAnalytics());
  },

  getSidebarSummary(): Promise<SigcRepositoryResult<SigcSidebarSummary>> {
    return withStrictRead(() => supabaseSigcRepository.getSidebarSummary(), () => demoSigcRepository.getSidebarSummary());
  },

  getNotificationPage(page = 1, pageSize = 25): Promise<SigcRepositoryResult<SigcNotificationPage>> {
    return withStrictRead(() => supabaseSigcRepository.getNotificationPage(page, pageSize), () => demoSigcRepository.getNotificationPage(page, pageSize));
  },
  async getAgenda(from: string, to: string): Promise<SigcRepositoryResult<SigcAgendaSnapshot>> {
    if (dataMode !== 'supabase') return { data: await demoSigcRepository.getAgenda(from, to), source: 'demo' };
    return { data: await supabaseSigcRepository.getAgenda(from, to), source: 'supabase' };
  },
  getReport(filters: SigcReportFilters): Promise<SigcRepositoryResult<SigcReportResult>> {
    return withStrictRead(() => supabaseSigcRepository.getReport(filters, filters.page, filters.pageSize), () => demoSigcRepository.getReport(filters, filters.page, filters.pageSize));
  },
  createReportExportJob(format: SigcReportExportFormat, filters: SigcReportFilters): Promise<SigcReportExportJob> { return mutationRepository().createReportExportJob(format, filters); },
  getReportExportPage(jobId: string, page: number, pageSize: number): Promise<SigcReportExportPage> { return mutationRepository().getReportExportPage(jobId, page, pageSize); },
  async completeReportExportJob(jobId: string, status: 'completed' | 'failed' | 'cancelled', errorMessage?: string): Promise<void> { await mutationRepository().completeReportExportJob(jobId, status, errorMessage); emitSigcDataChanged(); },
  async getSaasContext(): Promise<SigcRepositoryResult<SigcSaasContext>> {
    if (dataMode !== 'supabase') return { data: await demoSigcRepository.getSaasContext(), source: 'demo' };
    return { data: await supabaseSigcRepository.getSaasContext(), source: 'supabase' };
  },
  getSecurityHealth(): Promise<SigcRepositoryResult<SigcSecurityHealth>> {
    return withStrictRead(() => supabaseSigcRepository.getSecurityHealth(), () => demoSigcRepository.getSecurityHealth());
  },
  getClientPortal(page = 1, pageSize = 10, query = ''): Promise<SigcRepositoryResult<ClientPortalSnapshot>> {
    return withStrictRead(() => supabaseSigcRepository.getClientPortal(page, pageSize, query), () => demoSigcRepository.getClientPortal(page, pageSize, query));
  },
  async getAuthorizationContext(): Promise<SigcRepositoryResult<SigcAuthorizationContext>> {
    if (dataMode !== 'supabase') return { data: await demoSigcRepository.getAuthorizationContext(), source: 'demo' };
    return { data: await supabaseSigcRepository.getAuthorizationContext(), source: 'supabase' };
  },
  async setActiveOrganization(organizationId: string): Promise<void> { await mutationRepository().setActiveOrganization(organizationId); emitSigcDataChanged(); },
  async updateOrganizationProfile(input: UpdateOrganizationProfileInput): Promise<void> { await mutationRepository().updateOrganizationProfile(input); emitSigcDataChanged(); },
  async updatePublicIntakeSettings(input: UpdatePublicIntakeSettingsInput): Promise<void> { await mutationRepository().updatePublicIntakeSettings(input); emitSigcDataChanged(); },
  async createSaasOrganization(input: CreateSaasOrganizationInput): Promise<string> { const id = await mutationRepository().createSaasOrganization(input); emitSigcDataChanged(); return id; },
  async createOrganizationInvitation(input: CreateOrganizationInvitationInput): Promise<CreatedOrganizationInvitation> { const result = await mutationRepository().createOrganizationInvitation(input); emitSigcDataChanged(); return result; },
  async revokeOrganizationInvitation(invitationId: string): Promise<void> { await mutationRepository().revokeOrganizationInvitation(invitationId); emitSigcDataChanged(); },
  getOrganizationInvitation(token: string): Promise<SigcRepositoryResult<PublicOrganizationInvitation | null>> {
    return withSafeReadFallback(() => supabasePublicSigcRepository.getOrganizationInvitation(token), () => demoPublicSigcRepository.getOrganizationInvitation(token));
  },
  async acceptOrganizationInvitation(token: string): Promise<string> { const id = await publicMutationRepository().acceptOrganizationInvitation(token); emitSigcDataChanged(); return id; },
  async logClientError(input: ClientErrorInput): Promise<void> { if (dataMode === 'supabase') await supabaseSigcRepository.logClientError(input); },
  getQualityDashboard(): Promise<SigcRepositoryResult<QualityDashboard>> {
    return withStrictRead(() => supabaseSigcRepository.getQualityDashboard(), () => demoSigcRepository.getQualityDashboard());
  },
  async runQualitySuite(input: RunQualitySuiteInput): Promise<QualityRunRecord> {
    return mutationRepository().runQualitySuite(input);
  }
};
