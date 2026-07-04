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
  SaveAutomationRuleInput
} from '../domain/types';

export interface SigcRepository {
  listCases(): Promise<SigcCase[]>;
  searchCases(filters: SigcCaseFilters): Promise<SigcCasePage>;
  getCaseByIdentifier(identifier: string): Promise<SigcCase | null>;
  getCatalogs(): Promise<SigcCatalogs>;
  listMembers(): Promise<SigcMember[]>;
  listCaseAssignments(caseId: string): Promise<SigcAssignment[]>;
  listAllowedStates(caseId: string): Promise<AllowedCaseState[]>;
  createManualCase(input: ManualCaseCreateInput): Promise<CreatedCaseResult>;
  assignCase(input: CaseAssignmentInput): Promise<void>;
  changeCaseState(input: ChangeCaseStateInput): Promise<void>;

  listSubtasks(filters?: SigcSubtaskFilters): Promise<SigcSubtask[]>;
  createSubtask(input: CreateSubtaskInput): Promise<CreatedSubtaskResult>;
  updateSubtask(input: UpdateSubtaskInput): Promise<void>;
  deleteSubtask(subtaskId: string): Promise<void>;

  listCaseComments(caseId: string): Promise<SigcComment[]>;
  addComment(input: AddCommentInput): Promise<CreatedCommentResult>;

  listDocuments(caseId?: string): Promise<SigcDocument[]>;
  uploadDocument(input: UploadCaseDocumentInput): Promise<SigcDocument>;
  addDocumentVersion(input: AddDocumentVersionInput): Promise<void>;
  deleteDocument(documentId: string): Promise<void>;
  getDocumentSignedUrl(storagePath: string): Promise<string>;

  listCaseTimeline(caseId: string): Promise<SigcTimelineEvent[]>;

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
  saveAdminCatalog(input: SaveAdminCatalogInput): Promise<void>;
  setAdminCatalogActive(kind: SaveAdminCatalogInput['kind'], id: string, isActive: boolean): Promise<void>;
  saveSlaPolicy(input: SaveSlaPolicyInput): Promise<void>;
  saveHoliday(input: SaveHolidayInput): Promise<void>;
  deleteHoliday(id: string): Promise<void>;
  saveRole(input: SaveRoleInput): Promise<string>;
  setRolePermissions(roleId: string, permissionIds: string[]): Promise<void>;
  setMemberRole(membershipId: string, roleId: string): Promise<void>;
  saveWorkflowStates(caseTypeId: string, stateIds: string[]): Promise<void>;
  saveTransition(input: SaveTransitionInput): Promise<void>;
  deleteTransition(id: string): Promise<void>;
  saveEmailTemplate(input: SaveEmailTemplateInput): Promise<void>;
  saveReminderRule(input: SaveReminderRuleInput): Promise<void>;
  saveAutomationRule(input: SaveAutomationRuleInput): Promise<void>;
  toggleAutomationRule(id: string, isActive: boolean): Promise<void>;
  runAutomationRule(ruleId: string, caseId: string): Promise<void>;
}

export interface PublicSigcRepository {
  getPublicCaseTypes(): Promise<PublicCaseTypeOption[]>;
  createPublicCase(input: PublicCaseCreateInput): Promise<CreatedCaseResult>;
}
