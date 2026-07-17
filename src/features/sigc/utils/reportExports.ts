import type { SigcReportResult, SigcReportRow } from '../domain/types';

export const REPORT_COLUMNS: Array<[keyof SigcReportRow, string]> = [
  ['radicado', 'Radicado'], ['caseType', 'Tipo'], ['subject', 'Asunto'], ['requesterCompany', 'Empresa'],
  ['requesterName', 'Solicitante'], ['area', 'Área'], ['owner', 'Responsable'], ['state', 'Estado'],
  ['priority', 'Prioridad'], ['openedAt', 'Creado'], ['dueAt', 'Fecha límite'], ['closedAt', 'Cerrado'],
  ['overdue', 'Vencido'], ['slaMet', 'Cumplió SLA'], ['resolutionHours', 'Horas resolución'], ['progress', 'Avance %']
];

export function reportCellValue(row: SigcReportRow, key: keyof SigcReportRow): string | number {
  const value = row[key];
  if (key === 'openedAt' || key === 'dueAt' || key === 'closedAt') return value ? formatDate(String(value)) : '';
  if (key === 'overdue') return value ? 'Sí' : 'No';
  if (key === 'slaMet') return value == null ? '' : value ? 'Sí' : 'No';
  if (typeof value === 'number') return value;
  return String(value ?? '');
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    : value;
}

function csvCell(value: unknown): string {
  const raw = String(value ?? '');
  const text = /^[=+@-]/.test(raw) ? `'${raw}` : raw;
  return `"${text.replace(/"/g, '""')}"`;
}

export function createCsvBlob(rows: SigcReportRow[]): Blob {
  const header = REPORT_COLUMNS.map(([, label]) => csvCell(label)).join(',');
  const body = rows.map((row) => REPORT_COLUMNS.map(([key]) => csvCell(reportCellValue(row, key))).join(','));
  return new Blob([`\uFEFF${[header, ...body].join('\n')}`], { type: 'text/csv;charset=utf-8' });
}

function xmlEscape(value: unknown): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function xlsxCell(value: unknown, style = 0): string {
  if (typeof value === 'number' && Number.isFinite(value)) return `<c s="${style}" t="n"><v>${value}</v></c>`;
  return `<c s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
}

function xlsxRow(values: unknown[], style = 0): string {
  return `<row>${values.map((value) => xlsxCell(value, style)).join('')}</row>`;
}

function worksheetXml(rows: unknown[][]): string {
  const body = rows.map((row, index) => xlsxRow(row, index === 0 ? 1 : 0)).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff]);
}

function u32(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]);
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

function zipStore(files: Array<{ name: string; content: string }>): Uint8Array {
  const encoder = new TextEncoder();
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const crc = crc32(data);
    const local = concatBytes([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name, data
    ]);
    localChunks.push(local);
    const central = concatBytes([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name
    ]);
    centralChunks.push(central);
    offset += local.length;
  }

  const central = concatBytes(centralChunks);
  const end = concatBytes([
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(central.length), u32(offset), u16(0)
  ]);
  return concatBytes([...localChunks, central, end]);
}

export function createXlsxBlob(report: SigcReportResult, rows: SigcReportRow[]): Blob {
  const summaryRows: unknown[][] = [
    ['Indicador', 'Valor'],
    ['Total de casos', report.summary.totalCases],
    ['Casos abiertos', report.summary.openCases],
    ['Casos cerrados', report.summary.closedCases],
    ['Casos vencidos', report.summary.overdueCases],
    ['Cumplimiento SLA %', report.summary.slaCompliancePct],
    ['Tiempo promedio de resolución (h)', report.summary.avgResolutionHours]
  ];
  const distributionRows: unknown[][] = [
    ['Dimensión', 'Categoría', 'Valor'],
    ...report.byArea.map((item) => ['Área', item.label, item.value]),
    ...report.byOwner.map((item) => ['Responsable', item.label, item.value]),
    ...report.byState.map((item) => ['Estado', item.label, item.value]),
    ...report.byType.map((item) => ['Tipo', item.label, item.value]),
    ...report.byPriority.map((item) => ['Prioridad', item.label, item.value]),
    ...report.byRisk.map((item) => ['Riesgo', item.label, item.value])
  ];
  const caseRows: unknown[][] = [
    REPORT_COLUMNS.map(([, label]) => label),
    ...rows.map((row) => REPORT_COLUMNS.map(([key]) => reportCellValue(row, key)))
  ];
  const files = [
    { name: '[Content_Types].xml', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>' },
    { name: '_rels/.rels', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: 'xl/workbook.xml', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Resumen" sheetId="1" r:id="rId1"/><sheet name="Distribuciones" sheetId="2" r:id="rId2"/><sheet name="Casos" sheetId="3" r:id="rId3"/></sheets></workbook>' },
    { name: 'xl/_rels/workbook.xml.rels', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
    { name: 'xl/styles.xml', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>' },
    { name: 'xl/worksheets/sheet1.xml', content: worksheetXml(summaryRows) },
    { name: 'xl/worksheets/sheet2.xml', content: worksheetXml(distributionRows) },
    { name: 'xl/worksheets/sheet3.xml', content: worksheetXml(caseRows) }
  ];
  const bytes = zipStore(files);
  const payload = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Blob([payload], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

const WIN_ANSI_SPECIAL = new Map<number, number>([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84], [0x2026, 0x85],
  [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88], [0x2030, 0x89], [0x0160, 0x8a],
  [0x2039, 0x8b], [0x0152, 0x8c], [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92],
  [0x201c, 0x93], [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b], [0x0153, 0x9c],
  [0x017e, 0x9e], [0x0178, 0x9f]
]);

function encodeWinAnsi(value: string): Uint8Array {
  const bytes: number[] = [];
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0x3f;
    if (codePoint <= 0x7f || (codePoint >= 0xa0 && codePoint <= 0xff)) bytes.push(codePoint);
    else bytes.push(WIN_ANSI_SPECIAL.get(codePoint) ?? 0x3f);
  }
  return new Uint8Array(bytes);
}

function pdfEscape(value: unknown): string {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r?\n/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ');
}

function truncate(value: unknown, length: number): string {
  const text = String(value ?? '');
  return text.length <= length ? text : `${text.slice(0, Math.max(0, length - 1))}…`;
}

function asciiBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export function createPdfBlob(report: SigcReportResult, rows: SigcReportRow[]): Blob {
  const pageRows = 28;
  const chunks: SigcReportRow[][] = [];
  for (let index = 0; index < rows.length; index += pageRows) chunks.push(rows.slice(index, index + pageRows));
  if (!chunks.length) chunks.push([]);

  const objects: Uint8Array[] = [];
  const addObject = (value: string | Uint8Array): number => {
    objects.push(typeof value === 'string' ? encodeWinAnsi(value) : value);
    return objects.length;
  };
  const fontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const boldFontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const pagesId = addObject('PAGES_PLACEHOLDER');
  const pageIds: number[] = [];

  chunks.forEach((pageRowsData) => {
    const commands: string[] = [
      'BT', '/F2 16 Tf', '36 560 Td', '(Reporte SIGC) Tj', '/F1 8 Tf', '0 -16 Td',
      `(${pdfEscape(`${report.from.slice(0, 10)} a ${report.to.slice(0, 10)} | ${rows.length} filas`)}) Tj`,
      '0 -24 Td', '/F2 7 Tf',
      `(${pdfEscape('Radicado        Tipo             Asunto                         Área            Responsable       Estado       Prioridad')}) Tj`,
      '/F1 7 Tf'
    ];
    for (const row of pageRowsData) {
      const line = [
        truncate(row.radicado, 14).padEnd(15), truncate(row.caseType, 16).padEnd(17),
        truncate(row.subject, 28).padEnd(29), truncate(row.area, 14).padEnd(15),
        truncate(row.owner, 16).padEnd(17), truncate(row.state, 11).padEnd(12), truncate(row.priority, 9)
      ].join(' ');
      commands.push('0 -16 Td', `(${pdfEscape(line)}) Tj`);
    }
    commands.push('ET');
    const streamBytes = encodeWinAnsi(commands.join('\n'));
    const contentId = addObject(concatBytes([
      asciiBytes(`<< /Length ${streamBytes.length} >>\nstream\n`), streamBytes, asciiBytes('\nendstream')
    ]));
    const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  });

  objects[pagesId - 1] = asciiBytes(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
  const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  const chunksOut: Uint8Array[] = [asciiBytes('%PDF-1.4\n')];
  const offsets: number[] = [0];
  let byteOffset = chunksOut[0].length;
  objects.forEach((object, index) => {
    offsets.push(byteOffset);
    const objectBytes = concatBytes([asciiBytes(`${index + 1} 0 obj\n`), object, asciiBytes('\nendobj\n')]);
    chunksOut.push(objectBytes);
    byteOffset += objectBytes.length;
  });

  const xrefOffset = byteOffset;
  let trailer = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) trailer += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  trailer += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  chunksOut.push(asciiBytes(trailer));

  const bytes = concatBytes(chunksOut);
  const payload = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Blob([payload], { type: 'application/pdf' });
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
