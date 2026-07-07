import { BellRing, CheckCheck, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
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
  const { currentUser, markNotificationRead, markAllNotificationsRead } = useApp();
  const [pageNumber, setPageNumber] = useState(1);
  const pageSize = 25;
  const { data, isLoading, error, warning, reload } = useSigcNotificationPage(pageNumber, pageSize);
  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));

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
    <Card>
      <CardHeader
        title="Centro de notificaciones"
        description={currentUser ? `${data.total} notificación(es) · ${data.unreadTotal} sin leer` : 'Alertas de casos y SLA.'}
        action={<Button variant="secondary" onClick={() => void markAllRead()} disabled={!data.unreadTotal}><CheckCheck size={17} /> Marcar todo leído</Button>}
      />

      {warning ? <div className="alert danger">{warning}</div> : null}
      {error ? <div className="alert danger">{error}</div> : null}
      {isLoading ? <div className="empty-inline">Cargando notificaciones...</div> : null}

      {!isLoading && data.items.length ? (
        <>
          <div className="notification-list">
            {data.items.map((notification) => {
              const actionUrl = notification.actionUrl ?? (notification.caseId ? `/cases/${notification.caseId}` : null);
              return (
                <article className={`notification-item ${notification.isRead ? '' : 'unread'}`} key={notification.id}>
                  <div className="notification-icon"><BellRing size={18} /></div>
                  <div>
                    <div className="notification-title">
                      <strong>{notification.title}</strong>
                      <Badge tone="info">{typeLabel(notification.type)}</Badge>
                      {notification.isRead ? <Badge>Leída</Badge> : <Badge tone="info">Nueva</Badge>}
                    </div>
                    <p>{notification.message}</p>
                    <span>{formatDateTime(notification.createdAt)}</span>
                    {actionUrl ? <div className="notification-action"><Link to={actionUrl} onClick={() => !notification.isRead && void markRead(notification.id)}><ExternalLink size={14} /> Abrir expediente</Link></div> : null}
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
        <EmptyState title="Sin notificaciones" description="Cuando un caso requiera tu atención, aparecerá aquí." />
      ) : null}
    </Card>
  );
}
