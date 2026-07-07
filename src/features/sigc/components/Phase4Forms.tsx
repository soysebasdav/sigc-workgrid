import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { CheckCircle2, LoaderCircle, Mail, RotateCcw, Send, TimerReset, X } from 'lucide-react';
import type { SigcAssignment, SigcCaseReview, SigcMember } from '../domain/types';
import { sigcService } from '../services/sigcService';
import { PERMISSIONS } from '../../authz/permissions';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
}

function localInputValue(iso?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function ModalFrame({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <>
      <div className="sigc-overlay open" onClick={onClose} />
      <section className="modal open phase3-modal phase4-modal">
        <header><h3>{title}</h3><button className="btn btn-white icon-only" type="button" onClick={onClose}><X size={17} /></button></header>
        {children}
      </section>
    </>
  );
}

export function SlaOverrideModal({ caseId, currentDueAt, onClose, onSaved }: { caseId: string; currentDueAt?: string | null; onClose: () => void; onSaved: (message: string) => void }) {
  const [newDueAt, setNewDueAt] = useState(localInputValue(currentDueAt));
  const [justification, setJustification] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError('');
    try {
      await sigcService.overrideCaseSla({ caseId, newDueAt, justification });
      onSaved('Fecha límite modificada y registrada en auditoría.');
    } catch (error) { setError(errorMessage(error)); } finally { setSaving(false); }
  }

  return <ModalFrame title="Modificar SLA excepcionalmente" onClose={onClose}>
    <form className="modal-body form-stack" onSubmit={submit}>
      <div className="phase4-context"><TimerReset size={18} /><div><span>Fecha actual</span><strong>{currentDueAt ? new Date(currentDueAt).toLocaleString('es-CO') : 'Sin fecha límite'}</strong></div></div>
      <label className="field-label"><span>Nueva fecha límite *</span><input className="field" type="datetime-local" value={newDueAt} onChange={(event) => setNewDueAt(event.target.value)} required /></label>
      <textarea className="field textarea compact" placeholder="Justificación obligatoria del cambio *" value={justification} onChange={(event) => setJustification(event.target.value)} required minLength={5} />
      <div className="phase-note">La fecha anterior, la nueva fecha, el usuario y la justificación quedarán registrados permanentemente.</div>
      {error ? <div className="alert danger">{error}</div> : null}
      <div className="modal-actions"><button className="btn btn-white" type="button" onClick={onClose}>Cancelar</button><button className="btn btn-primary" type="submit" disabled={saving}>{saving ? <><LoaderCircle size={17} className="spin" /> Guardando...</> : 'Guardar nueva fecha'}</button></div>
    </form>
  </ModalFrame>;
}

export function ManualReminderModal({ caseId, members, assignments, onClose, onSaved }: { caseId: string; members: SigcMember[]; assignments: SigcAssignment[]; onClose: () => void; onSaved: (message: string) => void }) {
  const defaultRecipients = useMemo(() => [...new Set(assignments.map((assignment) => assignment.responsibleUserId).filter((id): id is string => Boolean(id)))], [assignments]);
  const [recipientIds, setRecipientIds] = useState<string[]>(defaultRecipients);
  const [message, setMessage] = useState('Recuerda revisar y continuar la gestión de este caso antes de su fecha límite.');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function toggle(userId: string) { setRecipientIds((current) => current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]); }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      if (!recipientIds.length) throw new Error('Selecciona al menos un destinatario.');
      const count = await sigcService.sendManualReminder({ caseId, message, recipientUserIds: recipientIds });
      onSaved(`Recordatorio enviado a ${count} destinatario${count === 1 ? '' : 's'}.`);
    } catch (error) { setError(errorMessage(error)); } finally { setSaving(false); }
  }

  return <ModalFrame title="Enviar recordatorio manual" onClose={onClose}>
    <form className="modal-body form-stack" onSubmit={submit}>
      <div className="phase4-recipient-grid">
        {members.map((member) => <label className={`phase4-recipient ${recipientIds.includes(member.userId) ? 'selected' : ''}`} key={member.userId}><input type="checkbox" checked={recipientIds.includes(member.userId)} onChange={() => toggle(member.userId)} /><div><strong>{member.name}</strong><span>{member.roleName} · {member.email}</span></div></label>)}
      </div>
      <textarea className="field textarea" placeholder="Mensaje del recordatorio" value={message} onChange={(event) => setMessage(event.target.value)} required minLength={3} />
      <div className="phase-note"><Mail size={15} /> Se crea notificación interna y se encola el correo del destinatario.</div>
      {error ? <div className="alert danger">{error}</div> : null}
      <div className="modal-actions"><button className="btn btn-white" type="button" onClick={onClose}>Cancelar</button><button className="btn btn-primary" type="submit" disabled={saving || !recipientIds.length}>{saving ? 'Enviando...' : 'Enviar recordatorio'}</button></div>
    </form>
  </ModalFrame>;
}

export function SubmitReviewModal({ caseId, members, onClose, onSaved }: { caseId: string; members: SigcMember[]; onClose: () => void; onSaved: (message: string) => void }) {
  const reviewers = members.filter((member) => member.permissionCodes.includes(PERMISSIONS.caseApprove));
  const [reviewerUserId, setReviewerUserId] = useState('');
  const [note, setNote] = useState('La respuesta está lista para revisión y aprobación.');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      await sigcService.submitCaseForReview({ caseId, reviewerUserId: reviewerUserId || undefined, note });
      onSaved('Respuesta enviada a revisión.');
    } catch (error) { setError(errorMessage(error)); } finally { setSaving(false); }
  }

  return <ModalFrame title="Enviar respuesta a revisión" onClose={onClose}>
    <form className="modal-body form-stack" onSubmit={submit}>
      <select className="field" value={reviewerUserId} onChange={(event) => setReviewerUserId(event.target.value)}>
        <option value="">Cualquier aprobador autorizado</option>
        {reviewers.map((member) => <option value={member.userId} key={member.userId}>{member.name} · {member.roleName}</option>)}
      </select>
      <textarea className="field textarea compact" placeholder="Nota para el revisor" value={note} onChange={(event) => setNote(event.target.value)} />
      {error ? <div className="alert danger">{error}</div> : null}
      <div className="modal-actions"><button className="btn btn-white" type="button" onClick={onClose}>Cancelar</button><button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Enviando...' : <><Send size={16} /> Enviar a revisión</>}</button></div>
    </form>
  </ModalFrame>;
}

export function ReviewDecisionModal({ review, decision, onClose, onSaved }: { review: SigcCaseReview; decision: 'approved' | 'returned'; onClose: () => void; onSaved: (message: string) => void }) {
  const [comments, setComments] = useState(decision === 'approved' ? 'Respuesta revisada y aprobada.' : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      await sigcService.decideCaseReview({ reviewId: review.id, decision, comments });
      onSaved(decision === 'approved' ? 'Respuesta aprobada.' : 'Respuesta devuelta para ajustes.');
    } catch (error) { setError(errorMessage(error)); } finally { setSaving(false); }
  }

  return <ModalFrame title={decision === 'approved' ? 'Aprobar respuesta' : 'Devolver para ajustes'} onClose={onClose}>
    <form className="modal-body form-stack" onSubmit={submit}>
      <div className="phase4-context">{decision === 'approved' ? <CheckCircle2 size={20} /> : <RotateCcw size={20} />}<div><span>Ronda de revisión</span><strong>#{review.reviewRound}</strong></div></div>
      <textarea className="field textarea" placeholder={decision === 'approved' ? 'Observaciones de aprobación' : 'Describe obligatoriamente los ajustes requeridos *'} value={comments} onChange={(event) => setComments(event.target.value)} required={decision === 'returned'} minLength={decision === 'returned' ? 5 : 0} />
      {error ? <div className="alert danger">{error}</div> : null}
      <div className="modal-actions"><button className="btn btn-white" type="button" onClick={onClose}>Cancelar</button><button className={`btn ${decision === 'approved' ? 'btn-primary' : 'btn-soft'}`} type="submit" disabled={saving}>{saving ? 'Guardando...' : decision === 'approved' ? 'Aprobar' : 'Devolver'}</button></div>
    </form>
  </ModalFrame>;
}

export function DeliveryModal({ caseId, defaultRecipient, onClose, onSaved }: { caseId: string; defaultRecipient?: string; onClose: () => void; onSaved: (message: string) => void }) {
  const [channel, setChannel] = useState<'email' | 'physical' | 'portal' | 'courier' | 'other'>('email');
  const [recipient, setRecipient] = useState(defaultRecipient ?? '');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      await sigcService.registerCaseDelivery({ caseId, channel, recipient, reference, notes });
      onSaved('Envío registrado y caso movido a Enviado.');
    } catch (error) { setError(errorMessage(error)); } finally { setSaving(false); }
  }

  return <ModalFrame title="Registrar envío de la respuesta" onClose={onClose}>
    <form className="modal-body form-stack" onSubmit={submit}>
      <div className="phase3-form-grid">
        <select className="field" value={channel} onChange={(event) => setChannel(event.target.value as typeof channel)}><option value="email">Correo electrónico</option><option value="physical">Entrega física</option><option value="portal">Portal</option><option value="courier">Mensajería</option><option value="other">Otro</option></select>
        <input className="field" placeholder="Destinatario *" value={recipient} onChange={(event) => setRecipient(event.target.value)} required minLength={2} />
      </div>
      <input className="field" placeholder="Referencia, guía o número de envío" value={reference} onChange={(event) => setReference(event.target.value)} />
      <textarea className="field textarea compact" placeholder="Observaciones del envío" value={notes} onChange={(event) => setNotes(event.target.value)} />
      {error ? <div className="alert danger">{error}</div> : null}
      <div className="modal-actions"><button className="btn btn-white" type="button" onClick={onClose}>Cancelar</button><button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Registrando...' : 'Registrar envío'}</button></div>
    </form>
  </ModalFrame>;
}
