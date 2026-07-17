import { ALL_PERMISSION_CODES } from '../authz/permissions';
import type { QualityCheckResult, SigcReportResult, SigcReportRow } from '../sigc/domain/types';
import { createCsvBlob, createPdfBlob, createXlsxBlob } from '../sigc/utils/reportExports';
import { addDaysISO, getMonthMatrix, isPastDate, todayISO, toISODate } from '../../utils/dates';
import { dataMode, isSupabaseConfigured } from '../../lib/supabaseClient';
import { normalizeCaseFilters, parseSavedCaseViews, upsertSavedCaseView } from '../sigc/utils/savedCaseViews';
import { assignmentSetError, buildDefaultAssignments } from '../sigc/utils/caseFormDefaults';

function result(
  code: string,
  category: QualityCheckResult['category'],
  title: string,
  status: QualityCheckResult['status'],
  details: string,
  startedAt: number,
  evidence: Record<string, unknown> = {}
): QualityCheckResult {
  return { code, category, title, status, details, durationMs: Math.max(0, performance.now() - startedAt), evidence, source: 'client' };
}

async function runCheck(
  code: string,
  category: QualityCheckResult['category'],
  title: string,
  check: () => Promise<{ passed: boolean; details: string; evidence?: Record<string, unknown>; warning?: boolean }> | { passed: boolean; details: string; evidence?: Record<string, unknown>; warning?: boolean }
): Promise<QualityCheckResult> {
  const startedAt = performance.now();
  try {
    const outcome = await check();
    return result(code, category, title, outcome.passed ? (outcome.warning ? 'warning' : 'passed') : 'failed', outcome.details, startedAt, outcome.evidence);
  } catch (error) {
    return result(code, category, title, 'failed', error instanceof Error ? error.message : String(error), startedAt);
  }
}

function sampleReport(): { report: SigcReportResult; rows: SigcReportRow[] } {
  const row: SigcReportRow = {
    id: 'quality-case',
    radicado: 'SIG-2026-000001',
    subject: '=HYPERLINK("https://example.invalid")',
    requesterName: 'Prueba de calidad con ñ',
    requesterCompany: 'Compañía Ágil',
    source: 'manual',
    riskLevel: 'Bajo',
    openedAt: '2026-07-07T12:00:00.000Z',
    dueAt: '2026-07-10T12:00:00.000Z',
    closedAt: null,
    progress: 25,
    updatedAt: '2026-07-07T12:00:00.000Z',
    caseType: 'Petición',
    state: 'En Gestión',
    priority: 'Media',
    area: 'Tecnología y Operación',
    owner: 'Muñoz Álvarez',
    overdue: false,
    slaMet: null,
    resolutionHours: null
  };
  const report: SigcReportResult = {
    organizationId: 'quality-org',
    generatedAt: '2026-07-07T12:00:00.000Z',
    from: '2026-07-01T00:00:00.000Z',
    to: '2026-07-31T23:59:59.999Z',
    summary: { totalCases: 1, openCases: 1, closedCases: 0, overdueCases: 0, slaCompliancePct: 100, avgResolutionHours: 0 },
    byArea: [], byOwner: [], byType: [], byState: [], byPriority: [], byRisk: [], agingBuckets: [], slaByArea: [], throughput: [],
    rows: [row], totalRows: 1, page: 1, pageSize: 100, hasMore: false, isTruncated: false
  };
  return { report, rows: [row] };
}

export async function runClientQualityChecks(): Promise<QualityCheckResult[]> {
  const checks: Array<Promise<QualityCheckResult>> = [];

  checks.push(runCheck('UNIT-DATE-BOGOTA', 'unit', 'Fecha local de Bogotá no salta a UTC', () => {
    const now = new Date('2026-07-08T00:30:00.000Z');
    const actual = todayISO('America/Bogota', now);
    return { passed: actual === '2026-07-07', details: actual === '2026-07-07' ? 'La fecha local permanece en el 7 de julio.' : `Se obtuvo ${actual}.`, evidence: { actual } };
  }));

  checks.push(runCheck('UNIT-DATE-PAST', 'unit', 'Hoy no se marca como fecha pasada', () => {
    const now = new Date('2026-07-08T00:30:00.000Z');
    const actual = isPastDate('2026-07-07', 'America/Bogota', now);
    return { passed: actual === false, details: actual ? 'La fecha de hoy fue marcada como pasada.' : 'La comparación respeta la zona horaria.', evidence: { actual } };
  }));

  checks.push(runCheck('UNIT-DATE-ADD', 'unit', 'Suma de días mantiene formato ISO', () => {
    const now = new Date('2026-12-31T15:00:00.000Z');
    const actual = addDaysISO(1, 'America/Bogota', now);
    return { passed: actual === '2027-01-01', details: `Resultado: ${actual}.`, evidence: { actual } };
  }));

  checks.push(runCheck('UNIT-CALENDAR-MATRIX', 'unit', 'Calendario mensual conserva matriz 6×7', () => {
    const matrix = getMonthMatrix(2026, 6);
    const correctShape = matrix.length === 6 && matrix.every((week) => week.length === 7);
    const firstIsMonday = matrix[0]?.[0]?.getDay() === 1;
    return { passed: correctShape && firstIsMonday, details: correctShape && firstIsMonday ? 'Matriz válida con inicio en lunes.' : 'La matriz mensual perdió su estructura.', evidence: { weeks: matrix.length, firstDay: matrix[0]?.[0] ? toISODate(matrix[0][0]) : null } };
  }));

  checks.push(runCheck('UNIT-PERMISSIONS-UNIQUE', 'unit', 'Códigos de permiso sin duplicados', () => {
    const duplicates = ALL_PERMISSION_CODES.filter((code, index, all) => all.indexOf(code) !== index);
    return { passed: duplicates.length === 0, details: duplicates.length ? `Duplicados: ${duplicates.join(', ')}.` : `${ALL_PERMISSION_CODES.length} códigos únicos.`, evidence: { total: ALL_PERMISSION_CODES.length, duplicates } };
  }));

  checks.push(runCheck('UNIT-PERMISSIONS-INTEGRATIONS', 'unit', 'Permisos de integraciones coinciden con el catálogo', () => {
    const required = ['integrations.webhooks.manage', 'integrations.domains.manage'];
    const missing = required.filter((code) => !ALL_PERMISSION_CODES.includes(code as never));
    const obsolete = ALL_PERMISSION_CODES.filter((code) => ['integrations.webhook.manage', 'integrations.domain.manage'].includes(code));
    const passed = missing.length === 0 && obsolete.length === 0;
    return { passed, details: passed ? 'Webhooks y dominios usan los códigos plurales del backend.' : 'Persisten permisos de integración inconsistentes.', evidence: { required, missing, obsolete } };
  }));

  checks.push(runCheck('UNIT-SAVED-VIEWS', 'unit', 'Vistas guardadas normalizan y restauran filtros', () => {
    const views = upsertSavedCaseView([], { name: ' Jurídica vencidos ', filters: { query: ' tutela ', overdueOnly: true, upcomingOnly: true, page: 8, pageSize: 1000 } }, '2026-07-17T00:00:00.000Z');
    const restored = parseSavedCaseViews(JSON.stringify(views));
    const filters = normalizeCaseFilters(restored[0]?.filters);
    const passed = restored.length === 1 && restored[0]?.name === 'Jurídica vencidos' && filters.page === 1 && filters.pageSize === 100 && filters.overdueOnly === true && filters.upcomingOnly !== true;
    return { passed, details: passed ? 'La vista se conserva sin paginación obsoleta ni filtros contradictorios.' : 'La serialización de vistas perdió consistencia.', evidence: { restored } };
  }));

  checks.push(runCheck('UNIT-CASE-ASSIGNMENTS', 'unit', 'Asignaciones iniciales conservan un único responsable principal', () => {
    const assignments = buildDefaultAssignments([
      { areaId: 'area-a', isPrimary: false },
      { areaId: 'area-b', responsibleUserId: 'user-b', isPrimary: true }
    ], '2026-07-20T12:00');
    const primaryCount = assignments?.filter((assignment) => assignment.isPrimary).length ?? 0;
    const duplicateError = assignmentSetError([...(assignments ?? []), { areaId: 'area-b', responsibleUserId: 'user-b', isPrimary: false }]);
    const passed = primaryCount === 1 && assignments?.[1]?.isPrimary === true && Boolean(duplicateError);
    return { passed, details: passed ? 'Defaults, principal y duplicados se validan de forma compartida.' : 'La lógica común de asignaciones no es consistente.', evidence: { assignments, duplicateError } };
  }));

  checks.push(runCheck('RUNTIME-DATA-MODE', 'runtime', 'Modo de datos coherente con Supabase', () => {
    const passed = dataMode === 'local' || isSupabaseConfigured;
    return { passed, warning: dataMode === 'local', details: dataMode === 'local' ? 'La sesión actual está en modo local/demo; no debe utilizarse para producción.' : 'Supabase está configurado y activo.', evidence: { dataMode, isSupabaseConfigured } };
  }));

  checks.push(runCheck('EXPORT-CSV-INJECTION', 'integration', 'CSV neutraliza fórmulas maliciosas', async () => {
    const { rows } = sampleReport();
    const blob = createCsvBlob(rows);
    const text = await blob.text();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const hasBom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
    const formulaNeutralized = text.includes("'=HYPERLINK");
    const passed = formulaNeutralized && hasBom;
    return { passed, details: passed ? 'CSV UTF-8 con BOM y fórmula neutralizada.' : 'La protección de CSV no se detectó.', evidence: { bom: hasBom, formulaNeutralized } };
  }));

  checks.push(runCheck('EXPORT-XLSX-SIGNATURE', 'integration', 'XLSX generado usa contenedor OOXML', async () => {
    const { report, rows } = sampleReport();
    const bytes = new Uint8Array(await createXlsxBlob(report, rows).arrayBuffer());
    const passed = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes.length > 1000;
    return { passed, details: passed ? 'Firma ZIP/OOXML válida.' : 'El XLSX no presenta firma ZIP válida.', evidence: { byteLength: bytes.length, signature: Array.from(bytes.slice(0, 4)) } };
  }));

  checks.push(runCheck('EXPORT-PDF-SIGNATURE', 'integration', 'PDF generado tiene estructura y caracteres españoles', async () => {
    const { report, rows } = sampleReport();
    const bytes = new Uint8Array(await createPdfBlob(report, rows).arrayBuffer());
    const ascii = new TextDecoder('windows-1252').decode(bytes);
    const validStructure = ascii.startsWith('%PDF-1.4') && ascii.includes('%%EOF') && ascii.includes('xref');
    const preservesSpanish = ascii.includes('Petición') && ascii.includes('Tecnología') && ascii.includes('Muñoz');
    const passed = validStructure && preservesSpanish;
    return { passed, details: passed ? 'PDF 1.4 válido con tildes y ñ en codificación WinAnsi.' : 'El PDF perdió estructura o caracteres españoles.', evidence: { size: bytes.length, validStructure, preservesSpanish } };
  }));

  return Promise.all(checks);
}
