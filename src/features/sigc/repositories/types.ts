import type { SigcCase, SigcCatalogs } from '../domain/types';

export interface SigcRepository {
  listCases(): Promise<SigcCase[]>;
  getCaseByIdentifier(identifier: string): Promise<SigcCase | null>;
  getCatalogs(): Promise<SigcCatalogs>;
}
