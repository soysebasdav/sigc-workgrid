import { useEffect, useState, type FormEvent } from 'react';
import { LifeBuoy, MessageSquareText, Plus, RefreshCw, Send, X } from 'lucide-react';
import { platformService } from '../platform/platformService';
import type { SupportTicket } from '../platform/types';

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function label(value: string): string {
  const values: Record<string, string> = {
    new: 'Nuevo', in_analysis: 'En análisis', assigned: 'Asignado', waiting_customer: 'Esperando información', in_solution: 'En solución', resolved: 'Resuelto', closed: 'Cerrado', reopened: 'Reabierto', cancelled: 'Cancelado',
    low: 'Baja', medium: 'Media', high: 'Alta', critical: 'Crítica'
  };
  return values[value] || value;
}

export function SupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    setLoading(true); setError('');
    try {
      const result = await platformService.listMyTickets(1, 100);
      setTickets(result.rows);
      if (selected) {
        const refreshed = await platformService.getTicket(selected.id);
        setSelected(refreshed);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible consultar soporte.');
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function openTicket(ticket: SupportTicket) {
    setLoading(true); setError('');
    try { setSelected(await platformService.getTicket(ticket.id)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible abrir el ticket.'); }
    finally { setLoading(false); }
  }

  return <div className="page support-page">
    <header className="page-head"><div><span className="eyebrow">Orkesta · Acompañamiento</span><h1>Ayuda y soporte</h1><p>Crea solicitudes técnicas, funcionales o administrativas que llegarán directamente al Super Admin.</p></div><div className="page-actions"><button className="btn btn-white" onClick={() => void load()}><RefreshCw size={16} />Actualizar</button><button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={16} />Nuevo ticket</button></div></header>
    {error ? <div className="alert danger">{error}</div> : null}
    <section className="support-layout">
      <aside className="card support-ticket-list"><header><div><h2>Solicitudes</h2><p>{tickets.length} tickets registrados</p></div><LifeBuoy /></header>{isLoading && !tickets.length ? <div className="support-empty"><RefreshCw className="spin" /><strong>Cargando tickets...</strong></div> : tickets.map((ticket) => <button key={ticket.id} className={selected?.id === ticket.id ? 'active' : ''} onClick={() => void openTicket(ticket)}><div><strong>{ticket.ticketNumber}</strong><span className={`support-status ${ticket.status}`}>{label(ticket.status)}</span></div><h3>{ticket.subject}</h3><p>{ticket.category} · {label(ticket.priority)}</p><small>{formatDate(ticket.updatedAt)}</small></button>)}{!isLoading && !tickets.length ? <div className="support-empty"><MessageSquareText /><strong>Aún no hay solicitudes</strong><p>Crea un ticket cuando necesites ayuda.</p></div> : null}</aside>
      <article className="card support-ticket-detail">{selected ? <TicketConversation ticket={selected} onSaved={load} /> : <div className="support-empty large"><LifeBuoy /><strong>Selecciona un ticket</strong><p>Podrás revisar la respuesta del equipo, agregar información y seguir el estado.</p></div>}</article>
    </section>
    {showCreate ? <CreateTicketModal onClose={() => setShowCreate(false)} onCreated={async (ticket) => { setShowCreate(false); await load(); await openTicket(ticket); }} /> : null}
  </div>;
}

function TicketConversation({ ticket, onSaved }: { ticket: SupportTicket; onSaved: () => Promise<void> }) {
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setSaving(true); setError('');
    try { await platformService.replyTicket(ticket.id, body.trim(), false); setBody(''); await onSaved(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible enviar el mensaje.'); }
    finally { setSaving(false); }
  }
  return <><header className="support-detail-head"><div><span className="eyebrow">{ticket.ticketNumber}</span><h2>{ticket.subject}</h2><p>{ticket.description}</p></div><span className={`support-status ${ticket.status}`}>{label(ticket.status)}</span></header><dl className="support-ticket-meta"><div><dt>Categoría</dt><dd>{ticket.category}{ticket.subcategory ? ` · ${ticket.subcategory}` : ''}</dd></div><div><dt>Prioridad</dt><dd>{label(ticket.priority)}</dd></div><div><dt>Creado</dt><dd>{formatDate(ticket.createdAt)}</dd></div><div><dt>SLA de soporte</dt><dd>{formatDate(ticket.slaDueAt)}</dd></div></dl><div className="support-conversation">{ticket.messages?.filter((message) => !message.isInternal).map((message) => <article key={message.id} className={message.authorKind}><header><strong>{message.authorName || message.authorEmail || (message.authorKind === 'platform' ? 'Soporte Orkesta' : 'Organización')}</strong><small>{formatDate(message.createdAt)}</small></header><p>{message.body}</p></article>)}</div>{!['closed', 'cancelled'].includes(ticket.status) ? <form className="support-reply" onSubmit={submit}><textarea rows={4} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Agrega información o responde al equipo de soporte..." />{error ? <div className="alert danger">{error}</div> : null}<button className="btn btn-primary" disabled={saving || !body.trim()}><Send size={16} />{saving ? 'Enviando...' : 'Enviar mensaje'}</button></form> : <div className="alert">Este ticket está cerrado. Puedes crear uno nuevo si necesitas atención adicional.</div>}</>;
}

function CreateTicketModal({ onClose, onCreated }: { onClose: () => void; onCreated: (ticket: SupportTicket) => void }) {
  const [category, setCategory] = useState('Soporte técnico');
  const [subcategory, setSubcategory] = useState('');
  const [priority, setPriority] = useState('medium');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (subject.trim().length < 5 || description.trim().length < 10) { setError('Describe la solicitud con mayor detalle.'); return; }
    setSaving(true); setError('');
    try { onCreated(await platformService.createTicket({ category, subcategory, priority, subject: subject.trim(), description: description.trim() })); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible crear el ticket.'); }
    finally { setSaving(false); }
  }

  return <div className="support-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><form className="card support-modal" onSubmit={submit}><header><div><span className="eyebrow">Centro de ayuda</span><h2>Nueva solicitud de soporte</h2></div><button type="button" onClick={onClose} aria-label="Cerrar"><X /></button></header><div className="support-form-grid"><label>Categoría<select value={category} onChange={(event) => setCategory(event.target.value)}><option>Soporte técnico</option><option>Soporte funcional</option><option>Solicitud administrativa</option><option>Seguridad o incidente</option><option>Capacitación</option></select></label><label>Subcategoría<input value={subcategory} onChange={(event) => setSubcategory(event.target.value)} placeholder="Ej. Error en documentos" /></label><label>Prioridad<select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="critical">Crítica</option></select></label></div><label>Asunto<input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Resumen claro de la solicitud" /></label><label>Descripción<textarea rows={7} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Explica qué ocurrió, qué esperabas y cómo afecta la operación." /></label>{error ? <div className="alert danger">{error}</div> : null}<footer><button type="button" className="btn btn-white" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Creando...' : 'Crear ticket'}</button></footer></form></div>;
}
