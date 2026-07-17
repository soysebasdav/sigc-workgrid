import { useMemo, useState } from 'react';
import { Archive, Download, Eye, LoaderCircle, Save, ShieldCheck, X } from 'lucide-react';
import type { SigcDocument, SigcDocumentVersion } from '../domain/types';
import { useDocumentVersions } from '../hooks/useSigcData';
import { sigcService } from '../services/sigcService';

const TEXT_EXTENSIONS = new Set(['txt','md','markdown','csv','json','xml','yaml','yml','log']);

type DiffLine = { number: number; left: string; right: string; changed: boolean };

export function DocumentHistoryModal({ document, canManageRetention = false, onClose, onSaved }: { document: SigcDocument; canManageRetention?: boolean; onClose: () => void; onSaved: (message: string) => void }) {
  const { data: versions, isLoading, error, reload } = useDocumentVersions(document.id);
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');
  const [diff, setDiff] = useState<DiffLine[] | null>(null);
  const [comparing, setComparing] = useState(false);
  const [retentionUntil, setRetentionUntil] = useState(document.retentionUntil?.slice(0, 10) ?? '');
  const [legalHold, setLegalHold] = useState(document.legalHold);
  const [savingRetention, setSavingRetention] = useState(false);
  const textVersions = useMemo(() => versions.filter(isTextVersion), [versions]);

  async function openVersion(version: SigcDocumentVersion, download = false) {
    try {
      const url = await sigcService.getDocumentSignedUrl(version.storagePath, download ? { downloadFilename: version.storedFilename || version.originalFilename, expiresInSeconds: 180 } : { expiresInSeconds: 180 });
      if (download) {
        const link = window.document.createElement('a');
        link.href = url;
        link.download = version.storedFilename || version.originalFilename;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        window.document.body.appendChild(link);
        link.click();
        link.remove();
      } else window.open(url, '_blank', 'noopener,noreferrer');
    } catch (reason) { onSaved(errorMessage(reason)); }
  }

  async function compare() {
    const left = versions.find((version) => version.id === leftId);
    const right = versions.find((version) => version.id === rightId);
    if (!left || !right || left.id === right.id) return;
    setComparing(true); setDiff(null);
    try {
      const [leftUrl, rightUrl] = await Promise.all([sigcService.getDocumentSignedUrl(left.storagePath), sigcService.getDocumentSignedUrl(right.storagePath)]);
      const [leftResponse, rightResponse] = await Promise.all([fetch(leftUrl), fetch(rightUrl)]);
      if (!leftResponse.ok || !rightResponse.ok) throw new Error('No fue posible descargar una de las versiones para comparar.');
      const [leftText, rightText] = await Promise.all([leftResponse.text(), rightResponse.text()]);
      setDiff(buildLineDiff(leftText, rightText));
    } catch (reason) { onSaved(errorMessage(reason)); } finally { setComparing(false); }
  }

  async function saveRetention() {
    setSavingRetention(true);
    try {
      await sigcService.updateDocumentRetention({ documentId: document.id, retentionUntil: retentionUntil || undefined, legalHold });
      onSaved('Política de conservación documental actualizada.');
      reload();
    } catch (reason) { onSaved(errorMessage(reason)); } finally { setSavingRetention(false); }
  }

  return <div className="modal-backdrop" role="dialog" aria-modal="true"><section className="modal-card document-history-modal"><header className="modal-header"><div><span className="eyebrow">Gestión documental</span><h2>{document.name}</h2><p>{document.caseRadicado} · {versions.length} versión{versions.length === 1 ? '' : 'es'} inmutable{versions.length === 1 ? '' : 's'}</p></div><button className="btn btn-ghost" onClick={onClose}><X size={18} /></button></header>
    <section className="document-retention-panel"><div><ShieldCheck size={18} /><div><strong>Conservación y bloqueo legal</strong><span>Un bloqueo legal impide purgas automáticas, incluso después de la fecha de conservación.</span></div></div><div className="document-retention-controls"><input className="input" type="date" disabled={!canManageRetention} value={retentionUntil} onChange={(event) => setRetentionUntil(event.target.value)} /><label className="check-row"><input type="checkbox" checked={legalHold} disabled={!canManageRetention} onChange={(event) => setLegalHold(event.target.checked)} /><ShieldCheck size={15} /> Bloqueo legal</label><button className="btn btn-primary" disabled={savingRetention || !canManageRetention} onClick={() => void saveRetention()}><Save size={15} /> Guardar</button></div></section>
    {error ? <div className="alert danger">{error}</div> : null}
    <section className="document-version-list"><header><strong>Historial de versiones</strong><button className="btn btn-white small" onClick={reload}>Actualizar</button></header>{isLoading ? <div className="empty-inline"><LoaderCircle className="spin" size={18} /> Cargando versiones...</div> : versions.map((version) => <article key={version.id} className="document-version-card"><div className="document-version-number">v{version.versionNumber}</div><div className="document-version-main"><strong>{version.originalFilename}</strong><span>{version.uploadedByName} · {version.createdLabel}</span><small>Almacenado como: {version.storedFilename || version.originalFilename}</small><small>{formatBytes(version.sizeBytes)}{version.changeNotes ? ` · ${version.changeNotes}` : ''}</small>{version.checksum ? <code title={version.checksum}>SHA-256 {version.checksum.slice(0, 16)}…</code> : null}</div><div className="table-actions"><button className="btn btn-white icon-only small" title="Abrir" onClick={() => void openVersion(version)}><Eye size={15} /></button><button className="btn btn-white icon-only small" title="Descargar" onClick={() => void openVersion(version, true)}><Download size={15} /></button></div></article>)}</section>
    {textVersions.length >= 2 ? <section className="document-compare-panel"><header><div><strong>Comparar versiones de texto</strong><span>Disponible para TXT, Markdown, CSV, JSON, XML, YAML y logs.</span></div><Archive size={18} /></header><div className="form-grid three"><select className="input" value={leftId} onChange={(event) => setLeftId(event.target.value)}><option value="">Versión izquierda</option>{textVersions.map((version) => <option key={version.id} value={version.id}>v{version.versionNumber} · {version.originalFilename}</option>)}</select><select className="input" value={rightId} onChange={(event) => setRightId(event.target.value)}><option value="">Versión derecha</option>{textVersions.map((version) => <option key={version.id} value={version.id}>v{version.versionNumber} · {version.originalFilename}</option>)}</select><button className="btn btn-primary" disabled={!leftId || !rightId || leftId === rightId || comparing} onClick={() => void compare()}>{comparing ? <LoaderCircle className="spin" size={16} /> : <Archive size={16} />} Comparar</button></div>{diff ? <div className="document-diff"><div className="document-diff-summary">{diff.filter((line) => line.changed).length} línea{diff.filter((line) => line.changed).length === 1 ? '' : 's'} diferente{diff.filter((line) => line.changed).length === 1 ? '' : 's'}</div>{diff.map((line) => <div key={line.number} className={line.changed ? 'changed' : ''}><span>{line.number}</span><pre>{line.left}</pre><pre>{line.right}</pre></div>)}</div> : null}</section> : null}
  </section></div>;
}

function isTextVersion(version: SigcDocumentVersion): boolean { const extension = version.originalFilename.split('.').pop()?.toLowerCase() ?? ''; return TEXT_EXTENSIONS.has(extension) || version.mimeType?.startsWith('text/') === true; }
function buildLineDiff(left: string, right: string): DiffLine[] { const leftLines = left.split(/\r?\n/); const rightLines = right.split(/\r?\n/); const length = Math.max(leftLines.length, rightLines.length); return Array.from({ length }, (_, index) => ({ number: index + 1, left: leftLines[index] ?? '', right: rightLines[index] ?? '', changed: (leftLines[index] ?? '') !== (rightLines[index] ?? '') })); }
function formatBytes(value: number): string { if (value < 1024) return `${value} B`; if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`; return `${(value / 1024 ** 2).toFixed(1)} MB`; }
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : 'No fue posible completar la operación.'; }
