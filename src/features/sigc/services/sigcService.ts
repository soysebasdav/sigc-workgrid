import { dataMode } from '../../../lib/supabaseClient';
import type {
  AddCommentInput,
  AddDocumentVersionInput,
  AllowedCaseState,
  CaseAssignmentInput,
  ChangeCaseStateInput,
  CreateSubtaskInput,
  CreatedCaseResult,
  CreatedCommentResult,
  CreatedSubtaskResult,
  ManualCaseCreateInput,
  PublicCaseCreateInput,
  PublicCaseTypeOption,
  SigcAssignment,
  SigcCase,
  SigcCaseFilters,
  SigcCasePage,
  SigcCatalogs,
  SigcComment,
  SigcDocument,
  SigcMember,
  SigcSubtask,
  SigcSubtaskFilters,
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
  SaveAdminCatalogInput,
  SaveSlaPolicyInput,
  SaveHolidayInput,
  SaveRoleInput,
  SaveTransitionInput,
  SaveEmailTemplateInput,
  SaveReminderRuleInput,
  SaveAutomationRuleInput,
  SigcDashboardAnalytics,
  SigcReportFilters,
  SigcReportResult,
  SigcSaasContext,
  UpdateOrganizationProfileInput,
  CreateSaasOrganizationInput,
  CreateOrganizationInvitationInput,
  CreatedOrganizationInvitation,
  PublicOrganizationInvitation,
  ClientErrorInput
} from '../domain/types';
import { demoPublicSigcRepository, demoSigcRepository } from '../repositories/demoSigcRepository';
import { supabasePublicSigcRepository, supabaseSigcRepository } from '../repositories/supabaseSigcRepository';

export const SIGC_DATA_CHANGED_EVENT = 'sigc:data-changed';

export function emitSigcDataChanged(): void {
  window.dispatchEvent(new CustomEvent(SIGC_DATA_CHANGED_EVENT));
}

async function withSafeReadFallback<T>(remote: () => Promise<T>, local: () => Promise<T>): Promise<SigcRepositoryResult<T>> {
  if (dataMode !== 'supabase') return { data: await local(), source: 'demo' };

  try {
    return { data: await remote(), source: 'supabase' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.warn('SIGC: no fue posible leer Supabase. Se usa el repositorio demo.', error);
    return {
      data: await local(),
      source: 'demo',
      warning: `No fue posible leer el dominio SIGC en Supabase. Fallback demo activo: ${message}`
    };
  }
}

function mutationRepository() {
  return dataMode === 'supabase' ? supabaseSigcRepository : demoSigcRepository;
}

function publicMutationRepository() {
  return dataMode === 'supabase' ? supabasePublicSigcRepository : demoPublicSigcRepository;
}

export const sigcService = {
  listCases(): Promise<SigcRepositoryResult<SigcCase[]>> {
    return withSafeReadFallback(() => supabaseSigcRepository.listCases(), () => demoSigcRepository.listCases());
  },

  searchCases(filters: SigcCaseFilters): Promise<SigcRepositoryResult<SigcCasePage>> {
    return withSafeReadFallback(() => supabaseSigcRepository.searchCases(filters), () => demoSigcRepository.searchCases(filters));
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

  getPublicCaseTypes(): Promise<SigcRepositoryResult<PublicCaseTypeOption[]>> {
    return withSafeReadFallback(() => supabasePublicSigcRepository.getPublicCaseTypes(), () => demoPublicSigcRepository.getPublicCaseTypes());
  },

  async createPublicCase(input: PublicCaseCreateInput): Promise<CreatedCaseResult> {
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

  async changeCaseState(input: ChangeCaseStateInput): Promise<void> {
    await mutationRepository().changeCaseState(input);
    emitSigcDataChanged();
  },

  listSubtasks(filters: SigcSubtaskFilters = {}): Promise<SigcRepositoryResult<SigcSubtask[]>> {
    return withSafeReadFallback(() => supabaseSigcRepository.listSubtasks(filters), () => demoSigcRepository.listSubtasks(filters));
  },

  async createSubtask(input: CreateSubtaskInput): Promise<CreatedSubtaskResult> {
    const repository = mutationRepository();
    const result = await repository.createSubtask(input);
    for (const file of input.files ?? []) {
      await repository.uploadDocument({
        caseId: input.caseId,
        name: file.name,
        category: 'Adjunto de subtarea',
        file,
        subtaskId: result.subtaskId
      });
    }
    emitSigcDataChanged();
    return result;
  },

  async updateSubtask(input: UpdateSubtaskInput): Promise<void> {
    const repository = mutationRepository();
    await repository.updateSubtask(input);
    for (const file of input.files ?? []) {
      await repository.uploadDocument({
        caseId: input.caseId,
        name: file.name,
        category: 'Adjunto de subtarea',
        file,
        subtaskId: input.subtaskId
      });
    }
    emitSigcDataChanged();
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
    for (const file of input.files ?? []) {
      await repository.uploadDocument({
        caseId: input.caseId,
        name: file.name,
        category: 'Adjunto de comentario',
        file,
        commentId: result.commentId,
        subtaskId: input.subtaskId
      });
    }
    emitSigcDataChanged();
    return result;
  },

  getDocuments(caseId?: string): Promise<SigcRepositoryResult<SigcDocument[]>> {
    return withSafeReadFallback(() => supabaseSigcRepository.listDocuments(caseId), () => demoSigcRepository.listDocuments(caseId));
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

  getCaseTimeline(caseId: string): Promise<SigcRepositoryResult<SigcTimelineEvent[]>> {
    return withSafeReadFallback(() => supabaseSigcRepository.listCaseTimeline(caseId), () => demoSigcRepository.listCaseTimeline(caseId));
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

  getAdminSnapshot(): Promise<SigcRepositoryResult<SigcAdminSnapshot>> {
    return withSafeReadFallback(() => supabaseSigcRepository.getAdminSnapshot(), () => demoSigcRepository.getAdminSnapshot());
  },

  async saveAdminCatalog(input: SaveAdminCatalogInput): Promise<void> { await mutationRepository().saveAdminCatalog(input); emitSigcDataChanged(); },
  async setAdminCatalogActive(kind: SaveAdminCatalogInput['kind'], id: string, isActive: boolean): Promise<void> { await mutationRepository().setAdminCatalogActive(kind, id, isActive); emitSigcDataChanged(); },
  async saveSlaPolicy(input: SaveSlaPolicyInput): Promise<void> { await mutationRepository().saveSlaPolicy(input); emitSigcDataChanged(); },
  async saveHoliday(input: SaveHolidayInput): Promise<void> { await mutationRepository().saveHoliday(input); emitSigcDataChanged(); },
  async deleteHoliday(id: string): Promise<void> { await mutationRepository().deleteHoliday(id); emitSigcDataChanged(); },
  async saveRole(input: SaveRoleInput): Promise<string> { const id = await mutationRepository().saveRole(input); emitSigcDataChanged(); return id; },
  async setRolePermissions(roleId: string, permissionIds: string[]): Promise<void> { await mutationRepository().setRolePermissions(roleId, permissionIds); emitSigcDataChanged(); },
  async setMemberRole(membershipId: string, roleId: string): Promise<void> { await mutationRepository().setMemberRole(membershipId, roleId); emitSigcDataChanged(); },
  async saveWorkflowStates(caseTypeId: string, stateIds: string[]): Promise<void> { await mutationRepository().saveWorkflowStates(caseTypeId, stateIds); emitSigcDataChanged(); },
  async saveTransition(input: SaveTransitionInput): Promise<void> { await mutationRepository().saveTransition(input); emitSigcDataChanged(); },
  async deleteTransition(id: string): Promise<void> { await mutationRepository().deleteTransition(id); emitSigcDataChanged(); },
  async saveEmailTemplate(input: SaveEmailTemplateInput): Promise<void> { await mutationRepository().saveEmailTemplate(input); emitSigcDataChanged(); },
  async saveReminderRule(input: SaveReminderRuleInput): Promise<void> { await mutationRepository().saveReminderRule(input); emitSigcDataChanged(); },
  async saveAutomationRule(input: SaveAutomationRuleInput): Promise<void> { await mutationRepository().saveAutomationRule(input); emitSigcDataChanged(); },
  async toggleAutomationRule(id: string, isActive: boolean): Promise<void> { await mutationRepository().toggleAutomationRule(id, isActive); emitSigcDataChanged(); },
  async runAutomationRule(ruleId: string, caseId: string): Promise<void> { await mutationRepository().runAutomationRule(ruleId, caseId); emitSigcDataChanged(); },

  getDashboardAnalytics(): Promise<SigcRepositoryResult<SigcDashboardAnalytics>> {
    return withSafeReadFallback(() => supabaseSigcRepository.getDashboardAnalytics(), () => demoSigcRepository.getDashboardAnalytics());
  },
  getReport(filters: SigcReportFilters): Promise<SigcRepositoryResult<SigcReportResult>> {
    return withSafeReadFallback(() => supabaseSigcRepository.getReport(filters), () => demoSigcRepository.getReport(filters));
  },
  async getSaasContext(): Promise<SigcRepositoryResult<SigcSaasContext>> {
    if (dataMode !== 'supabase') return { data: await demoSigcRepository.getSaasContext(), source: 'demo' };
    return { data: await supabaseSigcRepository.getSaasContext(), source: 'supabase' };
  },
  async setActiveOrganization(organizationId: string): Promise<void> { await mutationRepository().setActiveOrganization(organizationId); emitSigcDataChanged(); },
  async updateOrganizationProfile(input: UpdateOrganizationProfileInput): Promise<void> { await mutationRepository().updateOrganizationProfile(input); emitSigcDataChanged(); },
  async createSaasOrganization(input: CreateSaasOrganizationInput): Promise<string> { const id = await mutationRepository().createSaasOrganization(input); emitSigcDataChanged(); return id; },
  async createOrganizationInvitation(input: CreateOrganizationInvitationInput): Promise<CreatedOrganizationInvitation> { const result = await mutationRepository().createOrganizationInvitation(input); emitSigcDataChanged(); return result; },
  async revokeOrganizationInvitation(invitationId: string): Promise<void> { await mutationRepository().revokeOrganizationInvitation(invitationId); emitSigcDataChanged(); },
  getOrganizationInvitation(token: string): Promise<SigcRepositoryResult<PublicOrganizationInvitation | null>> {
    return withSafeReadFallback(() => supabasePublicSigcRepository.getOrganizationInvitation(token), () => demoPublicSigcRepository.getOrganizationInvitation(token));
  },
  async acceptOrganizationInvitation(token: string): Promise<string> { const id = await publicMutationRepository().acceptOrganizationInvitation(token); emitSigcDataChanged(); return id; },
  async logClientError(input: ClientErrorInput): Promise<void> { if (dataMode === 'supabase') await supabaseSigcRepository.logClientError(input); }
};
