import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check, LoaderCircle, Paperclip, Plus, Trash2, Upload, X } from 'lucide-react';
import type { AllowedCaseState, ManualCaseAssignmentInput, PublicIntakeContext, SigcAssignment, SigcCase } from '../domain/types';
import { useAllowedCaseStates, useSigcCatalogs, useSigcMembers } from '../hooks/useSigcData';
import { sigcService } from '../services/sigcService';

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Ocurrió un error inesperado.';
}

function formatDateTime(iso: string | null): string {
  if (!iso) return 'Sin fecha límite';
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PublicCaseForm({
  context,
  tenant,
  hostname,
  onSecurityRefresh
}: {
  context: PublicIntakeContext;
  tenant?: string;
  hostname?: string;
  onSecurityRefresh?: () => void;
}) {
  const caseTypes = context.caseTypes;
  const [values, setValues] = useState({
    requesterName: '',
    requesterCompany: '',
    requesterDocument: '',
    requesterEmail: '',
    requesterPhone: '',
    caseTypeId: '',
    subject: '',
    description: '',
    website: ''
  });
  const [attachments, setAttachments] = useState<File[]>([]);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [challengeAnswer, setChallengeAnswer] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [created, setCreated] = useState<{
    radicado: string;
    dueAt: string | null;
    attachmentCount: number;
    failedAttachments: string[];
    attachmentSessionFinalized: boolean;
    attachmentFinalizeError?: string;
  } | null>(null);

  useEffect(() => {
    setChallengeAnswer('');
  }, [context.security.challenge?.id]);

  function setField(field: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function addAttachments(files: FileList | null) {
    if (!files || !context.intake.allowAttachments) return;
    setSubmitError('');
    const incoming = Array.from(files);
    const tooLarge = incoming.find((file) => file.size > context.intake.maxFileSizeBytes);
    if (tooLarge) {
      setSubmitError(`${tooLarge.name} supera el máximo de ${formatFileSize(context.intake.maxFileSizeBytes)} por archivo.`);
      return;
    }
    setAttachments((current) => {
      const deduped = [...current];
      for (const file of incoming) {
        const exists = deduped.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified);
        if (!exists) deduped.push(file);
      }
      if (deduped.length > context.intake.maxFiles) {
        setSubmitError(`Puedes adjuntar máximo ${context.intake.maxFiles} archivo(s).`);
        return deduped.slice(0, context.intake.maxFiles);
      }
      return deduped;
    });
  }

  function removeAttachment(index: number) {
    setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError('');
    setSubmitting(true);
    try {
      const result = await sigcService.createPublicCase({
        ...values,
        tenant,
        hostname,
        privacyConsent,
        challengeId: context.security.challenge?.id,
        challengeAnswer: challengeAnswer.trim() || undefined,
        attachments
      });
      setCreated({
        radicado: result.radicado,
        dueAt: result.dueAt,
        attachmentCount: result.attachmentCount,
        failedAttachments: result.failedAttachments,
        attachmentSessionFinalized: result.attachmentSessionFinalized,
        attachmentFinalizeError: result.attachmentFinalizeError
      });
      setValues({
        requesterName: '', requesterCompany: '', requesterDocument: '', requesterEmail: '', requesterPhone: '',
        caseTypeId: '', subject: '', description: '', website: ''
      });
      setAttachments([]);
      setPrivacyConsent(false);
      setChallengeAnswer('');
      onSecurityRefresh?.();
    } catch (error) {
      const message = errorMessage(error);
      setSubmitError(message);
      if (/verificaci[oó]n antiabuso|l[ií]mite temporal/i.test(message)) onSecurityRefresh?.();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="form-stack">
      <div className="public-form-grid">
        <input className="field" placeholder="Nombre *" value={values.requesterName} onChange={(event) => setField('requesterName', event.target.value)} required minLength={2} />
        <input className="field" placeholder="Empresa" value={values.requesterCompany} onChange={(event) => setField('requesterCompany', event.target.value)} />
        <input className="field" placeholder="Documento" value={values.requesterDocument} onChange={(event) => setField('requesterDocument', event.target.value)} />
        <input className="field" placeholder="Correo *" type="email" value={values.requesterEmail} onChange={(event) => setField('requesterEmail', event.target.value)} required />
        <input className="field" placeholder="Teléfono" value={values.requesterPhone} onChange={(event) => setField('requesterPhone', event.target.value)} />
        <select className="field" value={values.caseTypeId} onChange={(event) => setField('caseTypeId', event.target.value)} required>
          <option value="">Tipo de caso *</option>
          {caseTypes.map((type) => <option value={type.id} key={type.id}>{type.name} · {type.slaLabel}</option>)}
        </select>
        <input className="field wide" placeholder="Asunto *" value={values.subject} onChange={(event) => setField('subject', event.target.value)} required minLength={4} maxLength={300} />
        <textarea className="field textarea wide" placeholder="Descripción detallada *" value={values.description} onChange={(event) => setField('description', event.target.value)} required minLength={10} maxLength={10000} />
        <input className="sigc-honeypot" tabIndex={-1} autoComplete="off" aria-hidden="true" value={values.website} onChange={(event) => setField('website', event.target.value)} />

        {context.intake.allowAttachments ? (
          <div className="wide public-attachments">
            <label className="upload-zone public-upload-zone">
              <Upload size={22} />
              <strong>Adjuntar archivos</strong>
              <span>Máximo {context.intake.maxFiles} archivo(s) · {formatFileSize(context.intake.maxFileSizeBytes)} por archivo.</span>
              <input
                type="file"
                multiple
                onChange={(event) => { addAttachments(event.target.files); event.currentTarget.value = ''; }}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.mp4,.webm,.mov,.mp3,.wav,.ogg,.m4a,.aac"
              />
            </label>
            {attachments.length ? (
              <div className="public-attachment-list">
                {attachments.map((file, index) => (
                  <div className="public-attachment-item" key={`${file.name}-${file.size}-${file.lastModified}`}>
                    <span><Paperclip size={16} /><b>{file.name}</b><small>{formatFileSize(file.size)}</small></span>
                    <button type="button" className="icon-button" aria-label={`Quitar ${file.name}`} onClick={() => removeAttachment(index)}><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="upload-zone wide phase-note"><strong>Adjuntos no habilitados</strong><span>Esta organización no recibe archivos desde el formulario público.</span></div>
        )}

        {context.security.challengeRequired && context.security.challenge ? (
          <label className="field-label wide public-security-challenge">
            Verificación antiabuso *
            <span className="muted">{context.security.challenge.prompt}</span>
            <input className="field" value={challengeAnswer} onChange={(event) => setChallengeAnswer(event.target.value)} required autoComplete="off" inputMode="numeric" />
          </label>
        ) : null}

        {context.privacy.requireConsent ? (
          <label className="public-privacy-consent wide">
            <input type="checkbox" checked={privacyConsent} onChange={(event) => setPrivacyConsent(event.target.checked)} required />
            <span>{context.privacy.noticeText}{context.privacy.policyUrl ? <> <a href={context.privacy.policyUrl} target="_blank" rel="noreferrer">Consultar política de privacidad</a>.</> : null}</span>
          </label>
        ) : null}
      </div>
      {!caseTypes.length ? <div className="alert danger"><strong>Formulario temporalmente no disponible.</strong><span>La entidad todavía no tiene tipos de caso públicos configurados. Comunícate con {context.branding.supportEmail || 'el administrador de la plataforma'}.</span></div> : null}
      {submitError ? <div className="alert danger">{submitError}</div> : null}
      <button className="btn btn-primary full" type="submit" disabled={isSubmitting || !caseTypes.length || (context.privacy.requireConsent && !privacyConsent)}>
        {isSubmitting ? <><LoaderCircle size={17} className="spin" /> Radicando...</> : 'Enviar solicitud'}
      </button>
      {created ? (
        <div className="confirm-box">
          <strong>Solicitud registrada correctamente</strong>
          <p>{context.intake.confirmationMessage}</p>
          <p>Tu radicado es <b>{created.radicado}</b>.</p>
          <p>Fecha límite calculada: <b>{formatDateTime(created.dueAt)}</b>.</p>
          {created.attachmentCount > 0 ? <p>Adjuntos registrados: <b>{created.attachmentCount}</b>.</p> : null}
          {created.failedAttachments.length ? <p className="public-upload-warning">No se pudieron registrar: {created.failedAttachments.join(', ')}. El caso sí quedó radicado.</p> : null}
          {!created.attachmentSessionFinalized ? <p className="public-upload-warning">El caso quedó radicado, pero no fue posible cerrar la sesión de adjuntos. No vuelvas a radicarlo; informa el radicado al soporte para completar la revisión técnica.</p> : null}
        </div>
      ) : null}
    </form>
  );
}

export function ManualCaseForm({ onCreated }: { onCreated: (radicado: string, failedAttachments: string[]) => void }) {
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const { data: catalogs, isLoading: catalogsLoading, warning: catalogsWarning } = useSigcCatalogs();
  const { data: members, isLoading: membersLoading } = useSigcMembers();
  const [values, setValues] = useState({
    requesterName: '', requesterCompany: '', requesterDocument: '', requesterEmail: '', requesterPhone: '',
    caseTypeId: '', priorityId: '', riskLevel: 'Medio', subject: '', description: ''
  });
  const [assignments, setAssignments] = useState<ManualCaseAssignmentInput[]>([{ areaId: '', responsibleUserId: '', dueAt: '', observations: '', isPrimary: true }]);
  const [isSubmitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [createdDueAt, setCreatedDueAt] = useState<string | null>(null);
  const [initialFiles, setInitialFiles] = useState<File[]>([]);

  const selectedType = catalogs?.caseTypes.find((item) => item.id === values.caseTypeId);
  const validAssignments = useMemo(() => assignments.filter((item) => item.areaId), [assignments]);
  const configurationIssues = catalogs?.configuration.issues ?? [];
  const hasMemberAreaConfiguration = members.some((member) => member.areaIds.length > 0);

  function membersForArea(areaId: string) {
    if (!areaId || !hasMemberAreaConfiguration) return members;
    return members.filter((member) => member.areaIds.includes(areaId));
  }

  function selectCaseType(caseTypeId: string) {
    const type = catalogs?.caseTypes.find((item) => item.id === caseTypeId);
    setValues((current) => ({
      ...current,
      caseTypeId,
      priorityId: type?.defaultPriorityId || current.priorityId,
      riskLevel: type?.defaultRiskLevel || current.riskLevel
    }));
    if (type?.defaultAreas?.length) {
      setAssignments(type.defaultAreas.map((area, index) => ({
        areaId: area.areaId,
        responsibleUserId: area.responsibleUserId ?? '',
        dueAt: '',
        observations: '',
        isPrimary: area.isPrimary || index === 0
      })));
    }
  }

  function setField(field: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function updateAssignment(index: number, patch: Partial<ManualCaseAssignmentInput>) {
    setAssignments((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function addAssignment() {
    setAssignments((current) => [...current, { areaId: '', responsibleUserId: '', dueAt: '', observations: '', isPrimary: false }]);
  }

  function removeAssignment(index: number) {
    setAssignments((current) => current.length === 1 ? [{ areaId: '', responsibleUserId: '', dueAt: '', observations: '', isPrimary: true }] : current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError('');
    setSubmitting(true);
    try {
      const result = await sigcService.createManualCase({ idempotencyKey, ...values, assignments: validAssignments });
      setCreatedDueAt(result.dueAt);
      const uploads = await Promise.allSettled(initialFiles.map((file) => sigcService.uploadDocument({
        caseId: result.caseId, name: file.name, category: 'Documento inicial', file, changeNotes: 'Adjunto de creación manual'
      })));
      const failedAttachments = initialFiles.filter((_, index) => uploads[index]?.status === 'rejected').map((file) => file.name);
      onCreated(result.radicado, failedAttachments);
    } catch (error) {
      setSubmitError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="manual-layout">
      <div className="card form-card">
        <h2>Datos del solicitante y clasificación</h2>
        {catalogsWarning ? <div className="alert danger">{catalogsWarning}</div> : null}
        {catalogs && !catalogs.configuration.readyForManual ? <div className="alert danger configuration-alert"><strong>La entidad aún no está lista para crear casos.</strong><span>{configurationIssues.join(' ') || 'Completa áreas, prioridades, tipos internos y estados desde Administración.'}</span></div> : null}
        <div className="manual-form-grid">
          <input className="field" placeholder="Nombre del solicitante *" value={values.requesterName} onChange={(event) => setField('requesterName', event.target.value)} required minLength={2} />
          <input className="field" placeholder="Empresa / área origen" value={values.requesterCompany} onChange={(event) => setField('requesterCompany', event.target.value)} />
          <input className="field" placeholder="Documento" value={values.requesterDocument} onChange={(event) => setField('requesterDocument', event.target.value)} />
          <input className="field" placeholder="Correo" type="email" value={values.requesterEmail} onChange={(event) => setField('requesterEmail', event.target.value)} />
          <input className="field" placeholder="Teléfono" value={values.requesterPhone} onChange={(event) => setField('requesterPhone', event.target.value)} />
          <select className="field" value={values.caseTypeId} onChange={(event) => selectCaseType(event.target.value)} required disabled={catalogsLoading || !catalogs?.caseTypes.length}>
            <option value="">Tipo de caso *</option>
            {catalogs?.caseTypes.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
          </select>
          <select className="field" value={values.priorityId} onChange={(event) => setField('priorityId', event.target.value)} required disabled={catalogsLoading || !catalogs?.priorities.length}>
            <option value="">Prioridad *</option>
            {catalogs?.priorities.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
          </select>
          <select className="field" value={values.riskLevel} onChange={(event) => setField('riskLevel', event.target.value)}>
            <option>Bajo</option><option>Medio</option><option>Alto</option><option>Crítico</option>
          </select>
          <input className="field wide" placeholder="Asunto *" value={values.subject} onChange={(event) => setField('subject', event.target.value)} required minLength={4} />
          <textarea className="field textarea wide" placeholder="Descripción *" value={values.description} onChange={(event) => setField('description', event.target.value)} required minLength={10} />
        </div>

        <div className="section-title-row">
          <div><h3>Asignaciones iniciales</h3><p className="muted">Puedes asignar el mismo caso a varias áreas y responsables.</p></div>
          <button className="btn btn-soft" type="button" onClick={addAssignment}><Plus size={16} /> Agregar asignación</button>
        </div>
        <div className="assignment-form-list">
          {assignments.map((assignment, index) => (
            <div className="assignment-form-row" key={index}>
              <select className="field" value={assignment.areaId} onChange={(event) => updateAssignment(index, { areaId: event.target.value, responsibleUserId: '' })} disabled={!catalogs?.areas.length}>
                <option value="">Área</option>
                {catalogs?.areas.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
              </select>
              <select className="field" value={assignment.responsibleUserId ?? ''} onChange={(event) => updateAssignment(index, { responsibleUserId: event.target.value })} disabled={membersLoading || !assignment.areaId}>
                <option value="">Sin responsable específico</option>
                {membersForArea(assignment.areaId).map((member) => <option value={member.userId} key={member.userId}>{member.name} · {member.roleName}</option>)}
              </select>
              <input className="field" type="datetime-local" value={assignment.dueAt ?? ''} onChange={(event) => updateAssignment(index, { dueAt: event.target.value })} />
              <input className="field" placeholder="Observaciones" value={assignment.observations ?? ''} onChange={(event) => updateAssignment(index, { observations: event.target.value })} />
              <label className="check-row compact-check"><input type="radio" name="manual-primary-assignment" checked={Boolean(assignment.isPrimary)} onChange={() => setAssignments((current) => current.map((item, itemIndex) => ({ ...item, isPrimary: itemIndex === index })))} /> Principal</label>
              <button className="btn btn-white icon-only" type="button" onClick={() => removeAssignment(index)} aria-label="Eliminar asignación"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
        {submitError ? <div className="alert danger">{submitError}</div> : null}
        <div className="manual-submit-row">
          <button className="btn btn-primary" type="submit" disabled={isSubmitting || catalogsLoading || !catalogs || !catalogs.configuration.readyForManual}>
            {isSubmitting ? <><LoaderCircle size={17} className="spin" /> Creando...</> : <><Check size={17} /> Crear caso</>}
          </button>
        </div>
      </div>

      <aside className="manual-side">
        <section className="card card-block">
          <div className="card-block-head"><div><h3>SLA automático</h3><p>Se toma de la política configurada para el tipo de caso.</p></div></div>
          <div className="sla-box">
            <span>Tipo seleccionado</span>
            <strong>{selectedType?.name ?? 'Selecciona un tipo'}</strong>
            <p>{selectedType ? <>SLA: <b>{selectedType.slaLabel ?? 'Sin SLA configurado'}</b></> : 'El SLA se mostrará al seleccionar un tipo.'}</p>
            {selectedType?.defaultRiskLevel ? <p>Riesgo sugerido: <b>{selectedType.defaultRiskLevel}</b>.</p> : null}
            {selectedType?.defaultAreas?.length ? <p>Área sugerida: <b>{selectedType.defaultAreas.find((area) => area.isPrimary)?.areaName ?? selectedType.defaultAreas[0].areaName}</b>.</p> : null}
            {createdDueAt ? <p>Fecha límite calculada: <b>{formatDateTime(createdDueAt)}</b>.</p> : null}
          </div>
        </section>
        <section className="card card-block">
          <div className="card-block-head"><div><h3>Adjuntos iniciales</h3><p>Se guardarán como documentos versionados del nuevo caso.</p></div></div>
          <label className="upload-zone small clickable-upload"><Upload size={18} /><strong>Seleccionar archivos</strong><span>Máximo 100 MB por archivo.</span><input type="file" multiple onChange={(event) => setInitialFiles(Array.from(event.target.files ?? []))} /></label>
          {initialFiles.length ? <div className="selected-files">{initialFiles.map((file) => <span key={`${file.name}-${file.size}`}><Paperclip size={14} /> {file.name}</span>)}</div> : null}
        </section>
      </aside>
    </form>
  );
}

function toDateTimeLocal(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export function ClassificationModal({
  caseItem,
  currentAssignments,
  onClose,
  onSaved
}: {
  caseItem: SigcCase;
  currentAssignments: SigcAssignment[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data: catalogs, isLoading: catalogsLoading } = useSigcCatalogs();
  const { data: members, isLoading: membersLoading } = useSigcMembers();
  const activeAssignments = currentAssignments.filter((assignment) => assignment.isActive);
  const [values, setValues] = useState({
    caseTypeId: caseItem.typeId ?? '',
    priorityId: caseItem.priorityId ?? '',
    riskLevel: caseItem.risk || 'Medio',
    dueAt: caseItem.classifiedAt ? toDateTimeLocal(caseItem.dueAt) : '',
    observations: caseItem.classificationObservations ?? ''
  });
  const [assignments, setAssignments] = useState<ManualCaseAssignmentInput[]>(() => activeAssignments.length
    ? activeAssignments.map((assignment) => ({
        areaId: assignment.areaId,
        responsibleUserId: assignment.responsibleUserId ?? '',
        dueAt: toDateTimeLocal(assignment.dueAt),
        observations: assignment.observations ?? '',
        isPrimary: assignment.isPrimary
      }))
    : [{ areaId: caseItem.areaId ?? '', responsibleUserId: caseItem.ownerId ?? '', dueAt: caseItem.classifiedAt ? toDateTimeLocal(caseItem.dueAt) : '', observations: '', isPrimary: true }]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function updateAssignment(index: number, patch: Partial<ManualCaseAssignmentInput>) {
    setAssignments((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function addAssignment() {
    setAssignments((current) => [...current, { areaId: '', responsibleUserId: '', dueAt: values.dueAt, observations: '', isPrimary: false }]);
  }

  function removeAssignment(index: number) {
    setAssignments((current) => {
      if (current.length === 1) return current;
      const next = current.filter((_, itemIndex) => itemIndex !== index);
      if (!next.some((item) => item.isPrimary)) next[0] = { ...next[0], isPrimary: true };
      return next;
    });
  }

  async function save() {
    const validAssignments = assignments.filter((assignment) => assignment.areaId);
    if (!values.caseTypeId || !values.priorityId) {
      setError('Selecciona tipo de caso y prioridad.');
      return;
    }
    if (!validAssignments.length) {
      setError('La clasificación requiere al menos un área responsable.');
      return;
    }
    if (!validAssignments.some((assignment) => assignment.isPrimary)) validAssignments[0] = { ...validAssignments[0], isPrimary: true };
    setSaving(true);
    setError('');
    try {
      await sigcService.classifyCase({
        caseId: caseItem.databaseId ?? caseItem.id,
        caseTypeId: values.caseTypeId,
        priorityId: values.priorityId,
        riskLevel: values.riskLevel,
        dueAt: values.dueAt,
        observations: values.observations,
        assignments: validAssignments.map((assignment) => ({ ...assignment, caseId: caseItem.databaseId ?? caseItem.id }))
      });
      onSaved();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="sigc-overlay open" onClick={onClose} />
      <section className="modal open classification-modal">
        <header><div><h3>{caseItem.classifiedAt ? 'Editar clasificación' : 'Clasificar caso'}</h3><small>{caseItem.radicado} · operación atómica y auditable</small></div><button className="btn btn-white icon-only" type="button" onClick={onClose}><X size={17} /></button></header>
        <div className="modal-body form-stack">
          <div className="phase3-form-grid">
            <select className="field" value={values.caseTypeId} onChange={(event) => setValues((current) => ({ ...current, caseTypeId: event.target.value }))} disabled={catalogsLoading}>
              <option value="">Tipo de caso *</option>{catalogs?.caseTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <select className="field" value={values.priorityId} onChange={(event) => setValues((current) => ({ ...current, priorityId: event.target.value }))} disabled={catalogsLoading}>
              <option value="">Prioridad *</option>{catalogs?.priorities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <select className="field" value={values.riskLevel} onChange={(event) => setValues((current) => ({ ...current, riskLevel: event.target.value }))}>
              <option>Bajo</option><option>Medio</option><option>Alto</option><option>Crítico</option>
            </select>
            <label className="field-label">Fecha límite opcional (vacío = SLA automático)<input className="field" type="datetime-local" value={values.dueAt} onChange={(event) => setValues((current) => ({ ...current, dueAt: event.target.value }))} /></label>
          </div>
          <textarea className="field textarea compact" placeholder="Observaciones de clasificación" value={values.observations} onChange={(event) => setValues((current) => ({ ...current, observations: event.target.value }))} />

          <div className="section-title-row"><div><h4>Áreas y responsables</h4><p className="muted">La clasificación reemplaza las asignaciones activas por este conjunto, conservando el historial anterior.</p></div><button className="btn btn-soft small" type="button" onClick={addAssignment}><Plus size={15} /> Área</button></div>
          <div className="assignment-form-list">
            {assignments.map((assignment, index) => (
              <div className="assignment-form-row classification-assignment-row" key={index}>
                <select className="field" value={assignment.areaId} onChange={(event) => updateAssignment(index, { areaId: event.target.value })}>
                  <option value="">Área *</option>{catalogs?.areas.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <select className="field" value={assignment.responsibleUserId ?? ''} onChange={(event) => updateAssignment(index, { responsibleUserId: event.target.value })} disabled={membersLoading}>
                  <option value="">Sin responsable específico</option>{members.map((member) => <option key={member.userId} value={member.userId}>{member.name} · {member.roleName}</option>)}
                </select>
                <input className="field" type="datetime-local" value={assignment.dueAt ?? ''} onChange={(event) => updateAssignment(index, { dueAt: event.target.value })} />
                <input className="field" placeholder="Observaciones" value={assignment.observations ?? ''} onChange={(event) => updateAssignment(index, { observations: event.target.value })} />
                <label className="check-row compact-check"><input type="radio" name="classification-primary" checked={Boolean(assignment.isPrimary)} onChange={() => setAssignments((current) => current.map((item, itemIndex) => ({ ...item, isPrimary: itemIndex === index })))} /> Principal</label>
                <button className="btn btn-white icon-only" type="button" onClick={() => removeAssignment(index)} disabled={assignments.length === 1} aria-label="Quitar área"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
          {error ? <div className="alert danger">{error}</div> : null}
          <div className="modal-actions"><button className="btn btn-white" type="button" onClick={onClose}>Cancelar</button><button className="btn btn-primary" type="button" onClick={() => void save()} disabled={saving || catalogsLoading}>{saving ? 'Clasificando...' : 'Confirmar clasificación'}</button></div>
        </div>
      </section>
    </>
  );
}

export function AssignCaseModal({ caseId, assignment, onClose, onSaved }: { caseId: string; assignment?: SigcAssignment | null; onClose: () => void; onSaved: () => void }) {
  const { data: catalogs } = useSigcCatalogs();
  const { data: members, isLoading } = useSigcMembers();
  const [areaId, setAreaId] = useState(assignment?.areaId ?? '');
  const [responsibleUserId, setResponsibleUserId] = useState(assignment?.responsibleUserId ?? '');
  const [dueAt, setDueAt] = useState(toDateTimeLocal(assignment?.dueAt));
  const [observations, setObservations] = useState(assignment?.observations ?? '');
  const [isPrimary, setIsPrimary] = useState(assignment?.isPrimary ?? false);
  const [state, setState] = useState(assignment?.state ?? 'assigned');
  const [progress, setProgress] = useState(assignment?.progress ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (!areaId) {
      setError('Selecciona un área.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (assignment) {
        await sigcService.updateCaseAssignment({ assignmentId: assignment.id, caseId, areaId, responsibleUserId, dueAt, observations, isPrimary, state, progress });
      } else {
        await sigcService.assignCase({ caseId, areaId, responsibleUserId, dueAt, observations, isPrimary });
      }
      onSaved();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="sigc-overlay open" onClick={onClose} />
      <section className="modal open">
        <header><div><h3>{assignment ? 'Editar asignación' : 'Asignar área y responsable'}</h3>{assignment ? <small>Asignada {assignment.assignedLabel}</small> : null}</div><button className="btn btn-white icon-only" type="button" onClick={onClose}><X size={17} /></button></header>
        <div className="modal-body form-stack">
          <select className="field" value={areaId} onChange={(event) => setAreaId(event.target.value)}>
            <option value="">Área *</option>{catalogs?.areas.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
          </select>
          <select className="field" value={responsibleUserId} onChange={(event) => setResponsibleUserId(event.target.value)} disabled={isLoading}>
            <option value="">Sin responsable específico</option>{members.map((member) => <option value={member.userId} key={member.userId}>{member.name} · {member.roleName}</option>)}
          </select>
          <input className="field" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
          {assignment ? (
            <div className="phase3-form-grid">
              <select className="field" value={state} onChange={(event) => setState(event.target.value)}>
                <option value="assigned">Asignado</option><option value="in_progress">En gestión</option><option value="pending_information">Pendiente de información</option><option value="completed">Completado</option><option value="cancelled">Cancelado</option>
              </select>
              <label className="field-label">Avance: {progress}%<input className="field" type="range" min="0" max="100" step="5" value={progress} onChange={(event) => setProgress(Number(event.target.value))} /></label>
            </div>
          ) : null}
          <textarea className="field textarea" placeholder="Observaciones de asignación" value={observations} onChange={(event) => setObservations(event.target.value)} />
          <label className="check-row"><input type="checkbox" checked={isPrimary} onChange={(event) => setIsPrimary(event.target.checked)} /> Convertir en asignación principal</label>
          {error ? <div className="alert danger">{error}</div> : null}
          <div className="modal-actions"><button className="btn btn-white" type="button" onClick={onClose}>Cancelar</button><button className="btn btn-primary" type="button" onClick={() => void save()} disabled={saving}>{saving ? 'Guardando...' : assignment ? 'Guardar cambios' : 'Asignar'}</button></div>
        </div>
      </section>
    </>
  );
}

export function DeactivateAssignmentModal({ caseId, assignment, onClose, onSaved }: { caseId: string; assignment: SigcAssignment; onClose: () => void; onSaved: () => void }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function save() {
    if (reason.trim().length < 3) { setError('Indica el motivo del retiro.'); return; }
    setSaving(true); setError('');
    try { await sigcService.deactivateCaseAssignment({ assignmentId: assignment.id, caseId, reason }); onSaved(); }
    catch (saveError) { setError(errorMessage(saveError)); }
    finally { setSaving(false); }
  }
  return <><div className="sigc-overlay open" onClick={onClose} /><section className="modal open"><header><h3>Retirar asignación</h3><button className="btn btn-white icon-only" type="button" onClick={onClose}><X size={17} /></button></header><div className="modal-body form-stack"><div className="phase3-context"><span>{assignment.areaName}</span><strong>{assignment.responsibleName}</strong></div><textarea className="field textarea" placeholder="Motivo obligatorio" value={reason} onChange={(event) => setReason(event.target.value)} />{error ? <div className="alert danger">{error}</div> : null}<div className="modal-actions"><button className="btn btn-white" type="button" onClick={onClose}>Cancelar</button><button className="btn btn-primary" type="button" onClick={() => void save()} disabled={saving}>{saving ? 'Retirando...' : 'Retirar asignación'}</button></div></div></section></>;
}

export function ChangeCaseStateModal({ caseId, onClose, onSaved }: { caseId: string; onClose: () => void; onSaved: () => void }) {
  const { data: states, isLoading, error: loadError } = useAllowedCaseStates(caseId);
  const [toStateId, setToStateId] = useState('');
  const [justification, setJustification] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const selected = states.find((state) => state.id === toStateId);

  async function save() {
    if (!toStateId) {
      setError('Selecciona el nuevo estado.');
      return;
    }
    if (selected?.requiresJustification && justification.trim().length < 3) {
      setError('Esta transición exige una justificación.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await sigcService.changeCaseState({ caseId, toStateId, justification });
      onSaved();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="sigc-overlay open" onClick={onClose} />
      <section className="modal open">
        <header><h3>Cambiar estado</h3><button className="btn btn-white icon-only" onClick={onClose}><X size={17} /></button></header>
        <div className="modal-body form-stack">
          {loadError ? <div className="alert danger">{loadError}</div> : null}
          <select className="field" value={toStateId} onChange={(event) => setToStateId(event.target.value)} disabled={isLoading || !states.length}>
            <option value="">{isLoading ? 'Cargando transiciones...' : states.length ? 'Nuevo estado *' : 'No hay transiciones disponibles'}</option>
            {states.map((state: AllowedCaseState) => <option value={state.id} key={state.id}>{state.name}{state.requiresJustification ? ' · requiere justificación' : ''}</option>)}
          </select>
          <textarea className="field textarea" placeholder={selected?.requiresJustification ? 'Justificación obligatoria' : 'Justificación / observación opcional'} value={justification} onChange={(event) => setJustification(event.target.value)} />
          {error ? <div className="alert danger">{error}</div> : null}
          <div className="modal-actions"><button className="btn btn-white" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving || !states.length}>{saving ? 'Guardando...' : 'Cambiar estado'}</button></div>
        </div>
      </section>
    </>
  );
}
