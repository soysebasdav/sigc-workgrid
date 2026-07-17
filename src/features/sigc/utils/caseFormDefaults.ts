import type { ManualCaseAssignmentInput } from '../domain/types';

export interface CaseTypeDefaultAreaLike {
  areaId: string;
  responsibleUserId?: string | null;
  isPrimary?: boolean;
}

export function buildDefaultAssignments(
  defaultAreas: CaseTypeDefaultAreaLike[] | null | undefined,
  dueAt = ''
): ManualCaseAssignmentInput[] | null {
  if (!defaultAreas?.length) return null;
  const configuredPrimaryIndex = defaultAreas.findIndex((area) => area.isPrimary);
  const primaryIndex = configuredPrimaryIndex >= 0 ? configuredPrimaryIndex : 0;
  return defaultAreas.map((area, index) => ({
    areaId: area.areaId,
    responsibleUserId: area.responsibleUserId ?? '',
    dueAt,
    observations: '',
    isPrimary: index === primaryIndex
  }));
}

export function ensureSinglePrimaryAssignment(assignments: ManualCaseAssignmentInput[]): ManualCaseAssignmentInput[] {
  if (!assignments.length) return assignments;
  const selectedIndex = assignments.findIndex((assignment) => assignment.isPrimary);
  const primaryIndex = selectedIndex >= 0 ? selectedIndex : 0;
  return assignments.map((assignment, index) => ({ ...assignment, isPrimary: index === primaryIndex }));
}

export function assignmentSetError(assignments: ManualCaseAssignmentInput[]): string | null {
  const valid = assignments.filter((assignment) => assignment.areaId);
  if (!valid.length) return 'Agrega al menos un área responsable.';
  const keys = new Set<string>();
  for (const assignment of valid) {
    const key = `${assignment.areaId}::${assignment.responsibleUserId || 'sin-responsable'}`;
    if (keys.has(key)) return 'No repitas la misma área con el mismo responsable.';
    keys.add(key);
  }
  return null;
}
