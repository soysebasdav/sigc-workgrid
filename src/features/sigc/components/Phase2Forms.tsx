import { useMemo, useState, type FormEvent } from 'react';
import { Check, LoaderCircle, Plus, Trash2, X } from 'lucide-react';
import type { AllowedCaseState, ManualCaseAssignmentInput } from '../domain/types';
import { useAllowedCaseStates, usePublicCaseTypes, useSigcCatalogs, useSigcMembers } from '../hooks/useSigcData';
import { sigcService } from '../services/sigcService';

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Ocurrió un error inesperado.';
}

function formatDateTime(iso: string | null): string {
  if (!iso) return 'Sin fecha límite';
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

export function PublicCaseForm() {
  const { data: caseTypes, isLoading, warning, error: loadError } = usePublicCaseTypes();
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
  const [isSubmitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [created, setCreated] = useState<{ radicado: string; dueAt: string | null } | null>(null);

  function setField(field: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError('');
    setSubmitting(true);
    try {
      const result = await sigcService.createPublicCase(values);
      setCreated({ radicado: result.radicado, dueAt: result.dueAt });
      setValues((current) => ({
        ...current,
        requesterName: '', requesterCompany: '', requesterDocument: '', requesterPhone: '', caseTypeId: '', subject: '', description: '', website: ''
      }));
    } catch (error) {
      setSubmitError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="form-stack">
      {warning ? <div className="alert danger">{warning}</div> : null}
      {loadError ? <div className="alert danger">{loadError}</div> : null}
      <div className="public-form-grid">
        <input className="field" placeholder="Nombre *" value={values.requesterName} onChange={(event) => setField('requesterName', event.target.value)} required minLength={2} />
        <input className="field" placeholder="Empresa" value={values.requesterCompany} onChange={(event) => setField('requesterCompany', event.target.value)} />
        <input className="field" placeholder="Documento" value={values.requesterDocument} onChange={(event) => setField('requesterDocument', event.target.value)} />
        <input className="field" placeholder="Correo *" type="email" value={values.requesterEmail} onChange={(event) => setField('requesterEmail', event.target.value)} required />
        <input className="field" placeholder="Teléfono" value={values.requesterPhone} onChange={(event) => setField('requesterPhone', event.target.value)} />
        <select className="field" value={values.caseTypeId} onChange={(event) => setField('caseTypeId', event.target.value)} required disabled={isLoading}>
          <option value="">{isLoading ? 'Cargando tipos...' : 'Tipo de caso *'}</option>
          {caseTypes.map((type) => <option value={type.id} key={type.id}>{type.name} · {type.slaLabel}</option>)}
        </select>
        <input className="field wide" placeholder="Asunto *" value={values.subject} onChange={(event) => setField('subject', event.target.value)} required minLength={4} maxLength={300} />
        <textarea className="field textarea wide" placeholder="Descripción detallada *" value={values.description} onChange={(event) => setField('description', event.target.value)} required minLength={10} maxLength={10000} />
        <input className="sigc-honeypot" tabIndex={-1} autoComplete="off" aria-hidden="true" value={values.website} onChange={(event) => setField('website', event.target.value)} />
        <div className="upload-zone wide phase-note"><strong>Adjuntos</strong><span>La carga y versionamiento de archivos se habilita en la Fase 3.</span></div>
      </div>
      {submitError ? <div className="alert danger">{submitError}</div> : null}
      <button className="btn btn-primary full" type="submit" disabled={isSubmitting || isLoading || !caseTypes.length}>
        {isSubmitting ? <><LoaderCircle size={17} className="spin" /> Radicando...</> : 'Enviar solicitud'}
      </button>
      {created ? (
        <div className="confirm-box">
          <strong>Solicitud registrada correctamente</strong>
          <p>Tu radicado es <b>{created.radicado}</b>.</p>
          <p>Fecha límite calculada: <b>{formatDateTime(created.dueAt)}</b>.</p>
        </div>
      ) : null}
    </form>
  );
}

export function ManualCaseForm({ onCreated }: { onCreated: (radicado: string) => void }) {
  const { data: catalogs, isLoading: catalogsLoading, warning: catalogsWarning } = useSigcCatalogs();
  const { data: members, isLoading: membersLoading } = useSigcMembers();
  const [values, setValues] = useState({
    requesterName: '', requesterCompany: '', requesterDocument: '', requesterEmail: '', requesterPhone: '',
    caseTypeId: '', priorityId: '', riskLevel: 'Medio', subject: '', description: ''
  });
  const [assignments, setAssignments] = useState<ManualCaseAssignmentInput[]>([{ areaId: '', responsibleUserId: '', dueAt: '', observations: '' }]);
  const [isSubmitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [createdDueAt, setCreatedDueAt] = useState<string | null>(null);

  const selectedType = catalogs?.caseTypes.find((item) => item.id === values.caseTypeId);
  const validAssignments = useMemo(() => assignments.filter((item) => item.areaId), [assignments]);

  function setField(field: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function updateAssignment(index: number, patch: Partial<ManualCaseAssignmentInput>) {
    setAssignments((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function addAssignment() {
    setAssignments((current) => [...current, { areaId: '', responsibleUserId: '', dueAt: '', observations: '' }]);
  }

  function removeAssignment(index: number) {
    setAssignments((current) => current.length === 1 ? [{ areaId: '', responsibleUserId: '', dueAt: '', observations: '' }] : current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError('');
    setSubmitting(true);
    try {
      const result = await sigcService.createManualCase({ ...values, assignments: validAssignments });
      setCreatedDueAt(result.dueAt);
      onCreated(result.radicado);
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
        <div className="manual-form-grid">
          <input className="field" placeholder="Nombre del solicitante *" value={values.requesterName} onChange={(event) => setField('requesterName', event.target.value)} required minLength={2} />
          <input className="field" placeholder="Empresa / área origen" value={values.requesterCompany} onChange={(event) => setField('requesterCompany', event.target.value)} />
          <input className="field" placeholder="Documento" value={values.requesterDocument} onChange={(event) => setField('requesterDocument', event.target.value)} />
          <input className="field" placeholder="Correo" type="email" value={values.requesterEmail} onChange={(event) => setField('requesterEmail', event.target.value)} />
          <input className="field" placeholder="Teléfono" value={values.requesterPhone} onChange={(event) => setField('requesterPhone', event.target.value)} />
          <select className="field" value={values.caseTypeId} onChange={(event) => setField('caseTypeId', event.target.value)} required disabled={catalogsLoading}>
            <option value="">Tipo de caso *</option>
            {catalogs?.caseTypes.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
          </select>
          <select className="field" value={values.priorityId} onChange={(event) => setField('priorityId', event.target.value)} required disabled={catalogsLoading}>
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
              <select className="field" value={assignment.areaId} onChange={(event) => updateAssignment(index, { areaId: event.target.value })}>
                <option value="">Área</option>
                {catalogs?.areas.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
              </select>
              <select className="field" value={assignment.responsibleUserId ?? ''} onChange={(event) => updateAssignment(index, { responsibleUserId: event.target.value })} disabled={membersLoading}>
                <option value="">Sin responsable específico</option>
                {members.map((member) => <option value={member.userId} key={member.userId}>{member.name} · {member.roleName}</option>)}
              </select>
              <input className="field" type="datetime-local" value={assignment.dueAt ?? ''} onChange={(event) => updateAssignment(index, { dueAt: event.target.value })} />
              <input className="field" placeholder="Observaciones" value={assignment.observations ?? ''} onChange={(event) => updateAssignment(index, { observations: event.target.value })} />
              <button className="btn btn-white icon-only" type="button" onClick={() => removeAssignment(index)} aria-label="Eliminar asignación"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
        {submitError ? <div className="alert danger">{submitError}</div> : null}
        <div className="manual-submit-row">
          <button className="btn btn-primary" type="submit" disabled={isSubmitting || catalogsLoading || !catalogs}>
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
            <p>{createdDueAt ? <>Fecha límite: <b>{formatDateTime(createdDueAt)}</b></> : 'La fecha límite se calcula al crear el caso.'}</p>
          </div>
        </section>
        <section className="card card-block">
          <div className="card-block-head"><div><h3>Adjuntos</h3><p>Gestión documental en Fase 3.</p></div></div>
          <div className="upload-zone small phase-note">La carga de documentos se habilita en la siguiente fase.</div>
        </section>
      </aside>
    </form>
  );
}

export function AssignCaseModal({ caseId, onClose, onSaved }: { caseId: string; onClose: () => void; onSaved: () => void }) {
  const { data: catalogs } = useSigcCatalogs();
  const { data: members, isLoading } = useSigcMembers();
  const [areaId, setAreaId] = useState('');
  const [responsibleUserId, setResponsibleUserId] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [observations, setObservations] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
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
      await sigcService.assignCase({ caseId, areaId, responsibleUserId, dueAt, observations, isPrimary });
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
        <header><h3>Asignar área y responsable</h3><button className="btn btn-white icon-only" onClick={onClose}><X size={17} /></button></header>
        <div className="modal-body form-stack">
          <select className="field" value={areaId} onChange={(event) => setAreaId(event.target.value)}>
            <option value="">Área *</option>
            {catalogs?.areas.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
          </select>
          <select className="field" value={responsibleUserId} onChange={(event) => setResponsibleUserId(event.target.value)} disabled={isLoading}>
            <option value="">Sin responsable específico</option>
            {members.map((member) => <option value={member.userId} key={member.userId}>{member.name} · {member.roleName}</option>)}
          </select>
          <input className="field" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
          <textarea className="field textarea" placeholder="Observaciones de asignación" value={observations} onChange={(event) => setObservations(event.target.value)} />
          <label className="check-row"><input type="checkbox" checked={isPrimary} onChange={(event) => setIsPrimary(event.target.checked)} /> Convertir en asignación principal</label>
          {error ? <div className="alert danger">{error}</div> : null}
          <div className="modal-actions"><button className="btn btn-white" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Asignar'}</button></div>
        </div>
      </section>
    </>
  );
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
