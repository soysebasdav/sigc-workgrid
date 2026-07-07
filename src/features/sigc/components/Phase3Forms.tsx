import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { FilePlus2, LoaderCircle, Paperclip, Upload, X } from 'lucide-react';
import type { SigcCase, SigcDocument, SigcSubtask, SubtaskState } from '../domain/types';
import { useCaseAssignments, useSigcCatalogs, useSigcMembers } from '../hooks/useSigcData';
import { sigcService } from '../services/sigcService';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
}

const MAX_INTERNAL_FILE_SIZE_BYTES = 100 * 1024 * 1024;
const ALLOWED_INTERNAL_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'txt', 'md', 'markdown', 'csv', 'json', 'xml', 'yaml', 'yml', 'log',
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif',
  'mp4', 'webm', 'mov', 'mp3', 'wav', 'ogg', 'm4a', 'aac',
  'js', 'ts', 'css', 'html'
]);

function validateSelectedFiles(files: File[]): string | null {
  for (const file of files) {
    if (file.size > MAX_INTERNAL_FILE_SIZE_BYTES) return `${file.name} supera el máximo de 100 MB.`;
    const extension = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() ?? '' : '';
    if (!extension || !ALLOWED_INTERNAL_EXTENSIONS.has(extension)) return `${file.name} usa un formato no permitido.`;
  }
  return null;
}

function failedAttachmentMessage(base: string, failed: string[]): string {
  return failed.length ? `${base} No se pudieron adjuntar: ${failed.join(', ')}.` : base;
}

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const value = new Date(iso);
  if (!Number.isFinite(value.getTime())) return '';
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function caseValue(item: SigcCase): string {
  return item.databaseId ?? item.id;
}

function FilesSummary({ files }: { files: File[] }) {
  if (!files.length) return null;
  return <div className="selected-files">{files.map((file) => <span key={`${file.name}-${file.size}`}><Paperclip size={14} /> {file.name}</span>)}</div>;
}

export function SubtaskFormModal({
  fixedCaseId,
  cases,
  initial,
  onClose,
  onSaved
}: {
  fixedCaseId?: string;
  cases: SigcCase[];
  initial?: SigcSubtask | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const { data: catalogs } = useSigcCatalogs();
  const { data: members } = useSigcMembers();
  const [caseId, setCaseId] = useState(fixedCaseId ?? initial?.caseId ?? (cases[0] ? caseValue(cases[0]) : ''));
  const { data: caseAssignments } = useCaseAssignments(caseId || undefined);
  const [assignmentId, setAssignmentId] = useState(initial?.assignmentId ?? '');
  const [areaId, setAreaId] = useState(initial?.areaId ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [responsibleUserId, setResponsibleUserId] = useState(initial?.responsibleUserId ?? '');
  const [priorityId, setPriorityId] = useState(initial?.priorityId ?? '');
  const [dueAt, setDueAt] = useState(toLocalInput(initial?.dueAt));
  const [state, setState] = useState<SubtaskState>(initial?.state ?? 'pending');
  const [progress, setProgress] = useState(initial?.progress ?? 0);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedCase = useMemo(() => cases.find((item) => caseValue(item) === caseId || item.id === caseId), [cases, caseId]);
  const activeAssignments = useMemo(() => caseAssignments.filter((item) => item.isActive), [caseAssignments]);

  useEffect(() => {
    if (initial) return;
    setAssignmentId('');
    setAreaId('');
  }, [caseId, initial]);

  function selectAssignment(nextAssignmentId: string) {
    setAssignmentId(nextAssignmentId);
    const selected = activeAssignments.find((item) => item.id === nextAssignmentId);
    if (selected) {
      setAreaId(selected.areaId);
      if (!responsibleUserId && selected.responsibleUserId) setResponsibleUserId(selected.responsibleUserId);
    }
  }

  function selectFiles(incoming: File[]) {
    const validationError = validateSelectedFiles(incoming);
    if (validationError) { setError(validationError); return; }
    setError('');
    setFiles(incoming);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!caseId || title.trim().length < 2) {
      setError('Selecciona un caso y escribe un nombre válido para la subtarea.');
      return;
    }
    if (assignmentId) {
      const assignment = activeAssignments.find((item) => item.id === assignmentId);
      if (!assignment) { setError('La asignación seleccionada ya no está activa.'); return; }
      if (areaId && areaId !== assignment.areaId) { setError('El área debe coincidir con la asignación seleccionada.'); return; }
    }
    setSaving(true);
    setError('');
    try {
      if (initial) {
        const failedAttachments = await sigcService.updateSubtask({
          subtaskId: initial.id, caseId, assignmentId: assignmentId || undefined, areaId: areaId || undefined, title, description,
          responsibleUserId, priorityId, dueAt, state, progress, files
        });
        onSaved(failedAttachmentMessage('Subtarea actualizada correctamente.', failedAttachments));
      } else {
        const result = await sigcService.createSubtask({
          caseId, assignmentId: assignmentId || undefined, areaId: areaId || undefined, title, description, responsibleUserId, priorityId, dueAt, files
        });
        onSaved(failedAttachmentMessage('Subtarea creada correctamente.', result.failedAttachments ?? []));
      }
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="sigc-overlay open" onClick={onClose} />
      <section className="modal open phase3-modal">
        <header><h3>{initial ? 'Editar subtarea' : 'Nueva subtarea'}</h3><button className="btn btn-white icon-only" type="button" onClick={onClose}><X size={17} /></button></header>
        <form className="modal-body form-stack" onSubmit={submit}>
          {!fixedCaseId ? (
            <select className="field" value={caseId} onChange={(event) => setCaseId(event.target.value)} required>
              <option value="">Caso *</option>
              {cases.map((item) => <option value={caseValue(item)} key={item.id}>{item.radicado} · {item.subject}</option>)}
            </select>
          ) : <div className="phase3-context"><span>Caso</span><strong>{selectedCase?.radicado ?? 'Expediente actual'}</strong></div>}
          <div className="phase3-form-grid two">
            <select className="field" value={assignmentId} onChange={(event) => selectAssignment(event.target.value)}>
              <option value="">Sin asignación específica</option>
              {activeAssignments.map((assignment) => <option value={assignment.id} key={assignment.id}>{assignment.areaName} · {assignment.responsibleName}</option>)}
            </select>
            <select className="field" value={areaId} onChange={(event) => { setAreaId(event.target.value); if (assignmentId) setAssignmentId(''); }}>
              <option value="">Sin área específica</option>
              {catalogs?.areas.map((area) => <option value={area.id} key={area.id}>{area.name}</option>)}
            </select>
          </div>
          <input className="field" placeholder="Nombre de la subtarea *" value={title} onChange={(event) => setTitle(event.target.value)} required minLength={2} maxLength={240} />
          <textarea className="field textarea" placeholder="Descripción" value={description} onChange={(event) => setDescription(event.target.value)} />
          <div className="phase3-form-grid">
            <select className="field" value={responsibleUserId} onChange={(event) => setResponsibleUserId(event.target.value)}>
              <option value="">Sin responsable específico</option>
              {members.map((member) => <option value={member.userId} key={member.userId}>{member.name} · {member.roleName}</option>)}
            </select>
            <select className="field" value={priorityId} onChange={(event) => setPriorityId(event.target.value)}>
              <option value="">Prioridad media por defecto</option>
              {catalogs?.priorities.map((priority) => <option value={priority.id} key={priority.id}>{priority.name}</option>)}
            </select>
            <input className="field" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
          </div>
          {initial ? (
            <div className="phase3-form-grid two">
              <select className="field" value={state} onChange={(event) => setState(event.target.value as SubtaskState)}>
                <option value="pending">Pendiente</option><option value="in_progress">En progreso</option><option value="completed">Completada</option><option value="cancelled">Cancelada</option>
              </select>
              <label className="range-field"><span>Avance: <strong>{state === 'completed' ? 100 : progress}%</strong></span><input type="range" min="0" max="100" step="5" value={state === 'completed' ? 100 : progress} disabled={state === 'completed'} onChange={(event) => setProgress(Number(event.target.value))} /></label>
            </div>
          ) : null}
          <label className="upload-zone small clickable-upload"><Upload size={18} /><strong>Adjuntar archivos</strong><span>Formatos permitidos · máximo 100 MB por archivo.</span><input type="file" multiple onChange={(event) => selectFiles(Array.from(event.target.files ?? []))} /></label>
          <FilesSummary files={files} />
          {error ? <div className="alert danger">{error}</div> : null}
          <div className="modal-actions"><button className="btn btn-white" type="button" onClick={onClose}>Cancelar</button><button className="btn btn-primary" type="submit" disabled={saving}>{saving ? <><LoaderCircle size={17} className="spin" /> Guardando...</> : initial ? 'Guardar cambios' : 'Crear subtarea'}</button></div>
        </form>
      </section>
    </>
  );
}

export function CommentModal({
  caseId,
  subtasks,
  onClose,
  onSaved
}: {
  caseId: string;
  subtasks: SigcSubtask[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [content, setContent] = useState('');
  const [subtaskId, setSubtaskId] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!content.trim()) {
      setError('Escribe el comentario.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = await sigcService.addComment({ caseId, content, subtaskId: subtaskId || undefined, files });
      onSaved(failedAttachmentMessage('Comentario agregado al expediente.', result.failedAttachments ?? []));
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="sigc-overlay open" onClick={onClose} />
      <section className="modal open phase3-modal">
        <header><h3>Agregar comentario</h3><button className="btn btn-white icon-only" type="button" onClick={onClose}><X size={17} /></button></header>
        <form className="modal-body form-stack" onSubmit={submit}>
          <select className="field" value={subtaskId} onChange={(event) => setSubtaskId(event.target.value)}>
            <option value="">Comentario general del caso</option>
            {subtasks.map((task) => <option value={task.id} key={task.id}>Subtarea · {task.title}</option>)}
          </select>
          <textarea className="field textarea comment-textarea" placeholder="Escribe un comentario interno..." value={content} onChange={(event) => setContent(event.target.value)} required maxLength={10000} />
          <label className="upload-zone small clickable-upload">
            <Paperclip size={18} /><strong>Adjuntar archivos</strong><span>Los adjuntos se guardan como documentos versionados del expediente.</span>
            <input type="file" multiple onChange={(event) => { const incoming = Array.from(event.target.files ?? []) as File[]; const validationError = validateSelectedFiles(incoming); if (validationError) { setError(validationError); return; } setError(''); setFiles(incoming); }} />
          </label>
          <FilesSummary files={files} />
          {error ? <div className="alert danger">{error}</div> : null}
          <div className="modal-actions"><button className="btn btn-white" type="button" onClick={onClose}>Cancelar</button><button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Publicando...' : 'Publicar comentario'}</button></div>
        </form>
      </section>
    </>
  );
}

export function DocumentUploadModal({
  fixedCaseId,
  cases,
  subtaskId,
  commentId,
  onClose,
  onSaved
}: {
  fixedCaseId?: string;
  cases: SigcCase[];
  subtaskId?: string;
  commentId?: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [caseId, setCaseId] = useState(fixedCaseId ?? (cases[0] ? caseValue(cases[0]) : ''));
  const [name, setName] = useState('');
  const [category, setCategory] = useState('General');
  const [state, setState] = useState('Cargado');
  const [changeNotes, setChangeNotes] = useState('Versión inicial');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!caseId || !file) {
      setError('Selecciona el caso y el archivo.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await sigcService.uploadDocument({ caseId, name: name.trim() || file.name, category, state, file, changeNotes, subtaskId, commentId });
      onSaved('Documento cargado como versión 1.');
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="sigc-overlay open" onClick={onClose} />
      <section className="modal open phase3-modal">
        <header><h3>Cargar documento</h3><button className="btn btn-white icon-only" type="button" onClick={onClose}><X size={17} /></button></header>
        <form className="modal-body form-stack" onSubmit={submit}>
          {!fixedCaseId ? (
            <select className="field" value={caseId} onChange={(event) => setCaseId(event.target.value)} required>
              <option value="">Caso *</option>
              {cases.map((item) => <option value={caseValue(item)} key={item.id}>{item.radicado} · {item.subject}</option>)}
            </select>
          ) : null}
          <input className="field" placeholder="Nombre lógico del documento" value={name} onChange={(event) => setName(event.target.value)} />
          <div className="phase3-form-grid">
            <input className="field" placeholder="Categoría" value={category} onChange={(event) => setCategory(event.target.value)} />
            <select className="field" value={state} onChange={(event) => setState(event.target.value)}><option>Cargado</option><option>En revisión</option><option>Aprobado</option><option>Rechazado</option></select>
          </div>
          <textarea className="field textarea compact" placeholder="Notas de la versión" value={changeNotes} onChange={(event) => setChangeNotes(event.target.value)} />
          <label className="upload-zone clickable-upload">
            <FilePlus2 size={22} /><strong>{file ? file.name : 'Seleccionar archivo'}</strong><span>Máximo 100 MB. Nunca se sobrescribe una versión existente.</span>
            <input type="file" required onChange={(event) => { const selected = event.target.files?.[0] ?? null; if (selected) { const validationError = validateSelectedFiles([selected]); if (validationError) { setError(validationError); setFile(null); return; } } setError(''); setFile(selected); }} />
          </label>
          {error ? <div className="alert danger">{error}</div> : null}
          <div className="modal-actions"><button className="btn btn-white" type="button" onClick={onClose}>Cancelar</button><button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Cargando...' : 'Cargar versión 1'}</button></div>
        </form>
      </section>
    </>
  );
}

export function DocumentVersionModal({ document, onClose, onSaved }: { document: SigcDocument; onClose: () => void; onSaved: (message: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [changeNotes, setChangeNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError('Selecciona el archivo de la nueva versión.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await sigcService.addDocumentVersion({ documentId: document.id, caseId: document.caseId, currentVersion: document.currentVersion, file, changeNotes });
      onSaved(`Versión ${document.currentVersion + 1} creada correctamente.`);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="sigc-overlay open" onClick={onClose} />
      <section className="modal open phase3-modal">
        <header><h3>Nueva versión · {document.name}</h3><button className="btn btn-white icon-only" type="button" onClick={onClose}><X size={17} /></button></header>
        <form className="modal-body form-stack" onSubmit={submit}>
          <div className="phase3-context"><span>Versión actual</span><strong>v{document.currentVersion}</strong></div>
          <label className="upload-zone clickable-upload"><Upload size={22} /><strong>{file ? file.name : `Seleccionar archivo para v${document.currentVersion + 1}`}</strong><span>La versión anterior permanecerá intacta.</span><input type="file" required onChange={(event) => { const selected = event.target.files?.[0] ?? null; if (selected) { const validationError = validateSelectedFiles([selected]); if (validationError) { setError(validationError); setFile(null); return; } } setError(''); setFile(selected); }} /></label>
          <textarea className="field textarea compact" placeholder="Describe qué cambió en esta versión" value={changeNotes} onChange={(event) => setChangeNotes(event.target.value)} />
          {error ? <div className="alert danger">{error}</div> : null}
          <div className="modal-actions"><button className="btn btn-white" type="button" onClick={onClose}>Cancelar</button><button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Versionando...' : `Crear v${document.currentVersion + 1}`}</button></div>
        </form>
      </section>
    </>
  );
}


function inlineEditableDocument(document: SigcDocument): boolean {
  const mime = (document.currentMimeType ?? '').toLowerCase();
  const filename = document.currentFilename.toLowerCase();
  return mime.startsWith('text/') ||
    ['application/json', 'application/xml', 'application/javascript'].includes(mime) ||
    ['.txt', '.md', '.markdown', '.csv', '.json', '.xml', '.yaml', '.yml', '.log', '.js', '.ts', '.css', '.html'].some((extension) => filename.endsWith(extension));
}

export function canEditDocumentInline(document: SigcDocument): boolean {
  return inlineEditableDocument(document);
}

export function TextDocumentEditorModal({ document, onClose, onSaved }: { document: SigcDocument; onClose: () => void; onSaved: (message: string) => void }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [changeNotes, setChangeNotes] = useState(`Edición en línea de v${document.currentVersion}`);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const url = await sigcService.getDocumentSignedUrl(document.currentStoragePath);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`No fue posible cargar el archivo (${response.status}).`);
        const text = await response.text();
        if (active) setContent(text);
      } catch (error) {
        if (active) setError(errorMessage(error));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [document.currentStoragePath]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const mimeType = document.currentMimeType || 'text/plain;charset=utf-8';
      const file = new File([content], document.currentFilename, { type: mimeType });
      await sigcService.addDocumentVersion({
        documentId: document.id,
        caseId: document.caseId,
        currentVersion: document.currentVersion,
        file,
        changeNotes: changeNotes.trim() || `Edición en línea de v${document.currentVersion}`
      });
      onSaved(`Versión ${document.currentVersion + 1} creada desde el editor en línea.`);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="sigc-overlay open" onClick={onClose} />
      <section className="modal open phase3-modal text-document-editor-modal">
        <header>
          <div><h3>Editar en línea · {document.name}</h3><small>{document.currentFilename} · v{document.currentVersion}</small></div>
          <button className="btn btn-white icon-only" type="button" onClick={onClose}><X size={17} /></button>
        </header>
        <form className="modal-body form-stack text-document-editor-body" onSubmit={save}>
          <div className="phase3-context"><span>Formato compatible</span><strong>La edición se guardará como v{document.currentVersion + 1}</strong></div>
          {loading ? <div className="editor-loading"><LoaderCircle className="spin" size={22} /> Cargando contenido...</div> : (
            <textarea
              className="field text-document-editor"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              spellCheck={false}
              aria-label={`Contenido de ${document.currentFilename}`}
            />
          )}
          <input className="field" value={changeNotes} onChange={(event) => setChangeNotes(event.target.value)} placeholder="Notas de la nueva versión" />
          {error ? <div className="alert danger">{error}</div> : null}
          <div className="modal-actions"><button className="btn btn-white" type="button" onClick={onClose}>Cancelar</button><button className="btn btn-primary" type="submit" disabled={loading || saving}>{saving ? 'Guardando...' : `Guardar como v${document.currentVersion + 1}`}</button></div>
        </form>
      </section>
    </>
  );
}
