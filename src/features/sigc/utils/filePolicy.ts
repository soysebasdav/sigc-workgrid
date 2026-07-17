export const MAX_INTERNAL_FILE_SIZE_BYTES = 100 * 1024 * 1024;
export const MAX_INTERNAL_FILES_PER_ACTION = 10;

export const INTERNAL_ALLOWED_EXTENSIONS = Object.freeze([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'txt', 'md', 'markdown', 'csv', 'json', 'xml', 'yaml', 'yml', 'log',
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif',
  'mp4', 'webm', 'mov', 'mp3', 'wav', 'ogg', 'm4a', 'aac'
] as const);

export const PUBLIC_ALLOWED_EXTENSIONS = Object.freeze([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif',
  'mp4', 'webm', 'mov', 'mp3', 'wav', 'ogg', 'm4a', 'aac'
] as const);

export const INTERNAL_FILE_ACCEPT = INTERNAL_ALLOWED_EXTENSIONS.map((extension) => `.${extension}`).join(',');
export const PUBLIC_FILE_ACCEPT = PUBLIC_ALLOWED_EXTENSIONS.map((extension) => `.${extension}`).join(',');

const INTERNAL_ALLOWED_SET = new Set<string>(INTERNAL_ALLOWED_EXTENSIONS);
const PUBLIC_ALLOWED_SET = new Set<string>(PUBLIC_ALLOWED_EXTENSIONS);

const MIME_BY_EXTENSION: Record<string, readonly string[]> = {
  pdf: ['application/pdf'],
  doc: ['application/msword', 'application/octet-stream', 'application/x-ole-storage'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip', 'application/octet-stream'],
  xls: ['application/vnd.ms-excel', 'application/octet-stream', 'application/x-ole-storage'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip', 'application/octet-stream'],
  ppt: ['application/vnd.ms-powerpoint', 'application/octet-stream', 'application/x-ole-storage'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip', 'application/octet-stream'],
  txt: ['text/plain', 'application/octet-stream'],
  md: ['text/markdown', 'text/x-markdown', 'text/plain', 'application/octet-stream'],
  markdown: ['text/markdown', 'text/x-markdown', 'text/plain', 'application/octet-stream'],
  csv: ['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain', 'application/octet-stream'],
  json: ['application/json', 'text/json', 'text/plain', 'application/octet-stream'],
  xml: ['application/xml', 'text/xml', 'text/plain', 'application/octet-stream'],
  yaml: ['application/yaml', 'application/x-yaml', 'text/yaml', 'text/x-yaml', 'text/plain', 'application/octet-stream'],
  yml: ['application/yaml', 'application/x-yaml', 'text/yaml', 'text/x-yaml', 'text/plain', 'application/octet-stream'],
  log: ['text/plain', 'application/octet-stream'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
  webp: ['image/webp'],
  gif: ['image/gif'],
  heic: ['image/heic', 'image/heif', 'application/octet-stream'],
  heif: ['image/heif', 'image/heic', 'application/octet-stream'],
  mp4: ['video/mp4', 'application/mp4', 'application/octet-stream'],
  webm: ['video/webm', 'audio/webm', 'application/octet-stream'],
  mov: ['video/quicktime', 'application/octet-stream'],
  mp3: ['audio/mpeg', 'audio/mp3', 'application/octet-stream'],
  wav: ['audio/wav', 'audio/x-wav', 'audio/wave', 'application/octet-stream'],
  ogg: ['audio/ogg', 'video/ogg', 'application/ogg', 'application/octet-stream'],
  m4a: ['audio/mp4', 'audio/x-m4a', 'application/octet-stream'],
  aac: ['audio/aac', 'audio/x-aac', 'application/octet-stream']
};

const PREFERRED_MIME_BY_EXTENSION: Record<string, string> = Object.fromEntries(
  Object.entries(MIME_BY_EXTENSION).map(([extension, values]) => [extension, values[0]])
);

export type FileScope = 'internal' | 'public';

export interface FileValidationOptions {
  scope?: FileScope;
  maxFileSizeBytes?: number;
}

export interface CanonicalFilenameInput {
  organization: string;
  area?: string | null;
  radicado: string;
  category?: string | null;
  version: number;
  originalFilename: string;
  documentId?: string | null;
}

export function getFileExtension(filename: string): string {
  const basename = filename.trim().split(/[\\/]/).pop() ?? '';
  const dot = basename.lastIndexOf('.');
  return dot > 0 && dot < basename.length - 1 ? basename.slice(dot + 1).toLowerCase() : '';
}

export function inferFileMimeType(file: Pick<File, 'name' | 'type'>): string {
  const normalizedType = file.type.trim().toLowerCase().split(';', 1)[0];
  if (normalizedType) return normalizedType;
  return PREFERRED_MIME_BY_EXTENSION[getFileExtension(file.name)] ?? 'application/octet-stream';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateFileMetadata(file: Pick<File, 'name' | 'size' | 'type'>, options: FileValidationOptions = {}): string | null {
  const scope = options.scope ?? 'internal';
  const maxFileSizeBytes = options.maxFileSizeBytes ?? MAX_INTERNAL_FILE_SIZE_BYTES;
  const extension = getFileExtension(file.name);
  const allowed = scope === 'public' ? PUBLIC_ALLOWED_SET : INTERNAL_ALLOWED_SET;

  if (!file.name.trim()) return 'El archivo no tiene un nombre válido.';
  if (file.size <= 0) return `${file.name}: el archivo está vacío.`;
  if (file.size > maxFileSizeBytes) return `${file.name}: supera el máximo de ${formatFileSize(maxFileSizeBytes)}.`;
  if (!extension || !allowed.has(extension)) return `${file.name}: formato de archivo no permitido.`;

  const mime = file.type.trim().toLowerCase().split(';', 1)[0];
  const expectedMimes = MIME_BY_EXTENSION[extension] ?? [];
  if (mime && expectedMimes.length && !expectedMimes.includes(mime)) {
    return `${file.name}: el tipo detectado (${mime}) no corresponde con la extensión .${extension}.`;
  }

  return null;
}

export async function validateFileForUpload(file: File, options: FileValidationOptions = {}): Promise<void> {
  const metadataError = validateFileMetadata(file, options);
  if (metadataError) throw new Error(metadataError);

  const extension = getFileExtension(file.name);
  const header = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  const ascii = new TextDecoder('latin1').decode(header);
  const starts = (...bytes: number[]) => bytes.every((value, index) => header[index] === value);
  const hasFtyp = header.length >= 12 && ascii.slice(4, 8) === 'ftyp';
  const readTextWindow = async (start: number, end: number) => new TextDecoder('latin1').decode(await file.slice(start, end).arrayBuffer());

  let valid = true;
  switch (extension) {
    case 'pdf': {
      const tail = await readTextWindow(Math.max(0, file.size - 2048), file.size);
      valid = ascii.startsWith('%PDF-') && tail.includes('%%EOF');
      break;
    }
    case 'png': valid = starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a); break;
    case 'jpg':
    case 'jpeg': valid = starts(0xff, 0xd8, 0xff); break;
    case 'gif': valid = ascii.startsWith('GIF87a') || ascii.startsWith('GIF89a'); break;
    case 'webp': valid = ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP'; break;
    case 'heic':
    case 'heif': valid = hasFtyp && ['heic', 'heix', 'hevc', 'hevx', 'heif', 'mif1', 'msf1'].includes(ascii.slice(8, 12)); break;
    case 'docx':
    case 'xlsx':
    case 'pptx': {
      const zipHeader = starts(0x50, 0x4b, 0x03, 0x04) || starts(0x50, 0x4b, 0x05, 0x06) || starts(0x50, 0x4b, 0x07, 0x08);
      const firstWindow = await readTextWindow(0, Math.min(file.size, 1024 * 1024));
      const tailWindow = await readTextWindow(Math.max(0, file.size - 1024 * 1024), file.size);
      const packageIndex = `${firstWindow}${tailWindow}`;
      const expectedFolder = extension === 'docx' ? 'word/' : extension === 'xlsx' ? 'xl/' : 'ppt/';
      valid = zipHeader && packageIndex.includes('[Content_Types].xml') && packageIndex.includes(expectedFolder);
      break;
    }
    case 'doc':
    case 'xls':
    case 'ppt': valid = starts(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1); break;
    case 'wav': valid = ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WAVE'; break;
    case 'ogg': valid = ascii.startsWith('OggS'); break;
    case 'webm': valid = starts(0x1a, 0x45, 0xdf, 0xa3); break;
    case 'mp4':
    case 'mov':
    case 'm4a': valid = hasFtyp; break;
    case 'mp3': valid = ascii.startsWith('ID3') || (header[0] === 0xff && (header[1] & 0xe0) === 0xe0); break;
    case 'aac': valid = (header[0] === 0xff && (header[1] & 0xf0) === 0xf0) || hasFtyp; break;
    case 'json': {
      if (header.includes(0)) { valid = false; break; }
      if (file.size <= 10 * 1024 * 1024) {
        try { JSON.parse(await file.text()); } catch { valid = false; }
      }
      break;
    }
    case 'xml': {
      if (header.includes(0)) { valid = false; break; }
      const prefix = (await file.slice(0, Math.min(file.size, 8192)).text()).replace(/^\uFEFF/, '').trimStart();
      valid = prefix.startsWith('<');
      break;
    }
    case 'txt':
    case 'md':
    case 'markdown':
    case 'csv':
    case 'yaml':
    case 'yml':
    case 'log': valid = !header.includes(0); break;
    default: valid = true;
  }

  if (!valid) throw new Error(`${file.name}: el contenido del archivo no coincide con su extensión.`);
}

export function normalizeFilenameToken(value: string | null | undefined, fallback: string, maxLength = 48): string {
  const normalized = String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_-]+|[_-]+$/g, '')
    .slice(0, maxLength);
  return normalized || fallback;
}

export function normalizeStorageSegment(value: string | null | undefined, fallback: string, maxLength = 80): string {
  return normalizeFilenameToken(value, fallback, maxLength).toLowerCase();
}

export function buildCanonicalFilename(input: CanonicalFilenameInput): string {
  const extension = getFileExtension(input.originalFilename) || 'bin';
  const organization = normalizeFilenameToken(input.organization, 'ORGANIZACION');
  const area = normalizeFilenameToken(input.area, 'GENERAL');
  const radicado = normalizeFilenameToken(input.radicado, 'CASO', 64);
  const category = normalizeFilenameToken(input.category, 'DOCUMENTO', 40);
  const documentToken = input.documentId ? normalizeFilenameToken(input.documentId, 'DOC', 8) : '';
  const version = `v${Math.max(1, Math.trunc(input.version)).toString().padStart(3, '0')}`;
  const parts = [organization, area, radicado, category, documentToken, version].filter(Boolean);
  return `${parts.join('_')}.${extension}`;
}

export function storedFilenameFromPath(storagePath: string): string {
  const value = storagePath.split('/').pop();
  return value ? decodeURIComponent(value) : '';
}
