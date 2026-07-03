import { BellRing, CheckCheck, ExternalLink } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../app/AppProvider';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDateTime } from '../../utils/dates';

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
  const { currentUser, state, markNotificationRead, markAllNotificationsRead } = useApp();

  const notifications = useMemo(() => {
    if (!currentUser) return [];
    return state.notifications
      .filter((notification) => notification.recipientUserId === currentUser.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [currentUser, state.notifications]);

  return (
    <Card>
      <CardHeader
        title="Centro de notificaciones"
        description="Alertas de casos, asignaciones, comentarios, documentos, SLA, recordatorios y revisiones."
        action={<Button variant="secondary" onClick={markAllNotificationsRead}><CheckCheck size={17} /> Marcar todo leído</Button>}
      />

      {notifications.length ? (
        <div className="notification-list">
          {notifications.map((notification) => (
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
                {notification.actionUrl ? <div className="notification-action"><Link to={notification.actionUrl} onClick={() => !notification.isRead && void markNotificationRead(notification.id)}><ExternalLink size={14} /> Abrir expediente</Link></div> : null}
              </div>
              {!notification.isRead ? <Button variant="ghost" onClick={() => markNotificationRead(notification.id)}>Marcar leída</Button> : null}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="Sin notificaciones" description="Cuando un caso requiera tu atención, aparecerá aquí." />
      )}
    </Card>
  );
}
