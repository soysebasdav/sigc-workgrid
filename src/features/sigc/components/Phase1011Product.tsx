import { useState, type FormEvent } from 'react';
import { CheckCircle2, Clock3, Download, ExternalLink, FileText, Layers3, Search, Shield, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { useApp } from '../../../app/AppProvider';
import { useClientPortal, useDebouncedValue } from '../hooks/useSigcData';
import { sigcService } from '../services/sigcService';

function formatDate(value?: string | null): string {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(date) : value;
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB'];
  let current = value;
  let index = -1;
  do { current /= 1024; index += 1; } while (current >= 1024 && index < units.length - 1);
  return `${current.toFixed(current >= 10 ? 1 : 2)} ${units[index]}`;
}

export function ForgotPasswordPage() {
  const { currentUser, dataMode, requestPasswordReset } = useApp();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (currentUser) return <Navigate to="/app" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setError('');
    setMessage('');
    try {
      await requestPasswordReset(email);
      setMessage('Si el correo pertenece a una cuenta válida, recibirás un enlace para definir una nueva contraseña.');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No fue posible iniciar la recuperación.');
    } finally {
      setSending(false);
    }
  }

  return <main className="login-workgrid">
    <section className="login-panel hero-gradient">
      <div className="chip chip-light">Seguridad de acceso</div>
      <h1>Recupera el acceso al SIGC</h1>
      <p>El enlace de recuperación es temporal y solo permite definir una nueva contraseña para la cuenta solicitada.</p>
      <div className="login-benefits"><span><ShieldCheck size={18} /> Enlace temporal</span><span><Shield size={18} /> Supabase Auth</span></div>
    </section>
    <section className="login-card card">
      <Shield size={30} />
      <h2>Olvidé mi contraseña</h2>
      <p className="muted">Escribe el correo con el que ingresas al sistema.</p>
      <form className="form-stack" onSubmit={submit}>
        <label className="field-label">Correo<input className="field" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        {dataMode !== 'supabase' ? <div className="alert danger">La recuperación está disponible cuando la aplicación usa Supabase Auth.</div> : null}
        {message ? <div className="alert success">{message}</div> : null}
        {error ? <div className="alert danger">{error}</div> : null}
        <button className="btn btn-primary full" disabled={sending || dataMode !== 'supabase'}>{sending ? 'Enviando...' : 'Enviar enlace seguro'}</button>
      </form>
      <Link className="btn btn-white full" to="/login">Volver al inicio de sesión</Link>
    </section>
  </main>;
}

export function ResetPasswordPage() {
  const { currentUser, isLoading, dataMode, completePasswordRecovery, isPasswordRecovery } = useApp();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (password.length < 8) { setError('La contraseña debe tener mínimo 8 caracteres.'); return; }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return; }
    setSaving(true);
    try {
      await completePasswordRecovery(password);
      setCompleted(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No fue posible actualizar la contraseña.');
    } finally {
      setSaving(false);
    }
  }

  return <main className="login-workgrid">
    <section className="login-panel hero-gradient"><div className="chip chip-light">Recuperación segura</div><h1>Define una nueva contraseña</h1><p>La sesión de recuperación debe provenir del enlace enviado a tu correo.</p></section>
    <section className="login-card card">
      {isLoading ? <><Clock3 className="spin" /><h2>Validando enlace...</h2></> : completed ? <><CheckCircle2 size={34} /><h2>Contraseña actualizada</h2><p className="muted">Ya puedes continuar usando el SIGC con tu nueva contraseña.</p><Link className="btn btn-primary full" to="/app">Continuar</Link></> : !currentUser || dataMode !== 'supabase' || !isPasswordRecovery ? <><Shield size={32} /><h2>Enlace no disponible</h2><p className="muted">Abre nuevamente el enlace de recuperación enviado a tu correo. Si expiró, solicita uno nuevo.</p><Link className="btn btn-primary full" to="/forgot-password">Solicitar otro enlace</Link></> : <><Shield size={32} /><h2>Nueva contraseña</h2><form className="form-stack" onSubmit={submit}><label className="field-label">Nueva contraseña<input className="field" type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></label><label className="field-label">Confirmar contraseña<input className="field" type="password" minLength={8} value={confirm} onChange={(event) => setConfirm(event.target.value)} required /></label>{error ? <div className="alert danger">{error}</div> : null}<button className="btn btn-primary full" disabled={saving}>{saving ? 'Actualizando...' : 'Guardar nueva contraseña'}</button></form></>}
    </section>
  </main>;
}

export function ClientPortalPage() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 400);
  const [page, setPage] = useState(1);
  const { data, isLoading, error, warning } = useClientPortal(page, 10, debouncedQuery);
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / Math.max(1, data?.pageSize ?? 10)));

  async function openDocument(storagePath: string) {
    try {
      const url = await sigcService.getDocumentSignedUrl(storagePath);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (openError) {
      window.alert(openError instanceof Error ? openError.message : 'No fue posible abrir el documento.');
    }
  }

  return <div className="page client-portal-page">
    <header className="page-head"><div><span className="eyebrow">Portal de cliente</span><h1>Mis casos</h1><p>Consulta el estado de las solicitudes asociadas a <strong>{data?.email ?? 'tu cuenta'}</strong>.</p></div></header>
    {warning ? <div className="alert danger">{warning}</div> : null}
    {error ? <div className="alert danger">{error}</div> : null}
    <section className="client-portal-kpis" aria-label="Resumen de casos">
      <article className="client-kpi-card client-kpi-total">
        <div className="client-kpi-icon"><Layers3 size={22} /></div>
        <div><span>Total</span><strong>{data?.summary.total ?? 0}</strong><small>Casos registrados</small></div>
      </article>
      <article className="client-kpi-card client-kpi-open">
        <div className="client-kpi-icon"><Clock3 size={22} /></div>
        <div><span>Abiertos</span><strong>{data?.summary.open ?? 0}</strong><small>En trámite</small></div>
      </article>
      <article className="client-kpi-card client-kpi-closed">
        <div className="client-kpi-icon"><CheckCircle2 size={22} /></div>
        <div><span>Cerrados</span><strong>{data?.summary.closed ?? 0}</strong><small>Finalizados</small></div>
      </article>
      <article className="client-kpi-card client-kpi-overdue">
        <div className="client-kpi-icon"><TriangleAlert size={22} /></div>
        <div><span>Vencidos</span><strong>{data?.summary.overdue ?? 0}</strong><small>Requieren atención</small></div>
      </article>
    </section>
    <section className="card filter-card"><div className="filter-search-field"><Search size={17} /><input className="field" placeholder="Buscar por radicado o asunto" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} /></div></section>
    <div className="case-list-meta"><span>{isLoading ? 'Consultando tus casos...' : `${data?.organizationName ?? 'Organización'} · acceso restringido a tu cuenta`}</span><strong>{data?.total ?? 0} caso{data?.total === 1 ? '' : 's'}</strong></div>
    <div className="client-portal-list">
      {data?.items.map((item) => <article className="card client-case-card" key={item.id}>
        <header><div><strong className="radicado">{item.radicado}</strong><h2>{item.subject}</h2><p>{item.type}</p></div><div className="chip-row"><span className="chip" style={item.stateColor ? { borderColor: item.stateColor, color: item.stateColor } : undefined}>{item.state}</span><span className="chip" style={item.priorityColor ? { borderColor: item.priorityColor, color: item.priorityColor } : undefined}>{item.priority}</span></div></header>
        <div className="client-case-meta"><span>Creado <b>{formatDate(item.openedAt)}</b></span><span>Fecha límite <b>{formatDate(item.dueAt)}</b></span><span>Actualizado <b>{formatDate(item.updatedAt)}</b></span><span>Avance <b>{item.progress}%</b></span></div>
        {item.documents.length ? <section className="client-case-section"><h3><FileText size={17} /> Documentos compartidos</h3>{item.documents.map((document) => <button className="client-document-row" key={document.id} onClick={() => void openDocument(document.currentStoragePath)}><span><strong>{document.name}</strong><small>{document.currentFilename} · v{document.currentVersion} · {formatBytes(document.currentSizeBytes)}</small></span><Download size={17} /></button>)}</section> : null}
        {item.deliveries.length ? <section className="client-case-section"><h3><ExternalLink size={17} /> Respuestas enviadas</h3>{item.deliveries.map((delivery) => <div className="client-delivery-row" key={delivery.id}><span><strong>{delivery.channel}</strong><small>{delivery.recipient}</small></span><span>{formatDate(delivery.deliveredAt)}</span></div>)}</section> : null}
      </article>)}
      {!isLoading && !data?.items.length ? <section className="card placeholder-card"><h2>No hay casos para mostrar</h2><p>No encontramos solicitudes asociadas a tu correo con los filtros actuales.</p></section> : null}
    </div>
    <div className="pagination-row"><button className="btn btn-white" disabled={page <= 1 || isLoading} onClick={() => setPage((value) => value - 1)}>Anterior</button><span>Página <strong>{page}</strong> de <strong>{totalPages}</strong></span><button className="btn btn-white" disabled={page >= totalPages || isLoading} onClick={() => setPage((value) => value + 1)}>Siguiente</button></div>
  </div>;
}
