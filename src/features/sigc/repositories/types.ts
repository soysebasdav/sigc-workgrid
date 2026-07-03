import type {
  AllowedCaseState,
  CaseAssignmentInput,
  ChangeCaseStateInput,
  CreatedCaseResult,
  ManualCaseCreateInput,
  PublicCaseCreateInput,
  PublicCaseTypeOption,
  SigcAssignment,
  SigcCase,
  SigcCaseFilters,
  SigcCasePage,
  SigcCatalogs,
  SigcMember
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
}

export interface PublicSigcRepository {
  getPublicCaseTypes(): Promise<PublicCaseTypeOption[]>;
  createPublicCase(input: PublicCaseCreateInput): Promise<CreatedCaseResult>;
}
