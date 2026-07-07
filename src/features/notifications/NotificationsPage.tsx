import { BellRing, CheckCheck, ChevronLeft, ChevronRight, ExternalLink, Inbox, MailOpen, Radio } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../app/AppProvider';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDateTime } from '../../utils/dates';
import { useSigcNotificationPage } from '../sigc/hooks/useSigcData';

function typeLabel(type: string): string {
  if (type.startsWith('case_review')) return 'Revisión';
  if (type === 'case_overdue') return 'Vencimiento';
  if (type === 'case_due_soon' || type === 'case_reminder') return 'Recordatorio';
  if (type === 'case_assigned' || type === 'case_reassigned') return 'Asignación';
  if (type === 'case_sla_changed') return 'SLA';
  if (type.startsWith('case_')) return 'Caso';
  return 'Sistema';
}

export function NotificationsPage() {
  const { markNotificationRead, markAllNotificationsRead } = useApp();
  const [pageNumber, setPageNumber] = useState(1);
  const pageSize = 25;
  const { data, isLoading, error, warning, reload } = useSigcNotificationPage(pageNumber, pageSize);
  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));
  const readTotal = Math.max(0, data.total - data.unreadTotal);

  async function markRead(notificationId: string): Promise<void> {
    await markNotificationRead(notificationId);
    reload();
  }

  async function markAllRead(): Promise<void> {
    await markAllNotificationsRead();
    setPageNumber(1);
    reload();
  }

  return (
    <div className="page notifications-page">
      <header className="page-head notifications-page-head">
        <div>
          <span className="eyebrow">Centro de actividad</span>
          <h1>Notificaciones</h1>
          <p>Revisa asignaciones, vencimientos, cambios de SLA y actuaciones que requieren tu atención.</p>
        </div>
        <div className="page-actions">
          <Button variant="secondary" onClick={() => void markAllRead()} disabled={!data.unreadTotal}>
            <CheckCheck size={17} /> Marcar todo leído
          </Button>
        </div>
      </header>

      <section className="notification-kpi-grid" aria-label="Resumen de notificaciones">
        <article className="notification-kpi-card notification-kpi-total">
          <div className="notification-kpi-icon"><Inbox size={21} /></div>
          <div><span>Total</span><strong>{data.total}</strong><small>En tu historial</small></div>
        </article>
        <article className="notification-kpi-card notification-kpi-unread">
          <div className="notification-kpi-icon"><Radio size={21} /></div>
          <div><span>Sin leer</span><strong>{data.unreadTotal}</strong><small>Requieren revisión</small></div>
        </article>
        <article className="notification-kpi-card notification-kpi-read">
          <div className="notification-kpi-icon"><MailOpen size={21} /></div>
          <div><span>Leídas</span><strong>{readTotal}</strong><small>Ya revisadas</small></div>
        </article>
        <article className="notification-kpi-card notification-kpi-page">
          <div className="notification-kpi-icon"><BellRing size={21} /></div>
          <div><span>Página actual</span><strong>{data.items.length}</strong><small>de {pageSize} posibles</small></div>
        </article>
      </section>

      {warning ? <div className="alert danger">{warning}</div> : null}
      {error ? <div className="alert danger">{error}</div> : null}

      <Card className="notification-inbox-card">
        <CardHeader
          title="Bandeja de actividad"
          description={data.unreadTotal ? `${data.unreadTotal} pendiente${data.unreadTotal === 1 ? '' : 's'} de lectura` : 'Estás al día. No tienes notificaciones pendientes.'}
        />

        {isLoading ? <div className="empty-inline">Cargando notificaciones...</div> : null}

        {!isLoading && data.items.length ? (
          <>
            <div className="notification-list notification-inbox-list">
              {data.items.map((notification) => {
                const actionUrl = notification.actionUrl ?? (notification.caseId ? `/cases/${notification.caseId}` : null);
                return (
                  <article className={`notification-item ${notification.isRead ? '' : 'unread'}`} key={notification.id}>
                    <div className="notification-icon"><BellRing size={18} /></div>
                    <div className="notification-content">
                      <div className="notification-title">
                        <strong>{notification.title}</strong>
                        <Badge tone="info">{typeLabel(notification.type)}</Badge>
                        {notification.isRead ? <Badge>Leída</Badge> : <Badge tone="warning">Nueva</Badge>}
                      </div>
                      <p>{notification.message}</p>
                      <div className="notification-meta-row">
                        <span>{formatDateTime(notification.createdAt)}</span>
                        {actionUrl ? <Link to={actionUrl} onClick={() => !notification.isRead && void markRead(notification.id)}><ExternalLink size={14} /> Abrir expediente</Link> : null}
                      </div>
                    </div>
                    {!notification.isRead ? <Button variant="ghost" onClick={() => void markRead(notification.id)}>Marcar leída</Button> : null}
                  </article>
                );
              })}
            </div>
            <div className="pagination-bar">
              <button className="btn btn-white" disabled={pageNumber <= 1} onClick={() => setPageNumber((page) => Math.max(1, page - 1))}><ChevronLeft size={16} /> Anterior</button>
              <span>Página <strong>{pageNumber}</strong> de <strong>{totalPages}</strong></span>
              <button className="btn btn-white" disabled={pageNumber >= totalPages} onClick={() => setPageNumber((page) => Math.min(totalPages, page + 1))}>Siguiente <ChevronRight size={16} /></button>
            </div>
          </>
        ) : !isLoading ? (
          <EmptyState title="Sin notificaciones" description="Cuando un caso requiera tu atención, aparecerá aquí con su prioridad y acceso directo al expediente." />
        ) : null}
      </Card>
    </div>
  );
}
