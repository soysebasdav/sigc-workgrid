import { BellRing, CheckCheck } from 'lucide-react';
import { useMemo } from 'react';
import { useApp } from '../../app/AppProvider';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDateTime } from '../../utils/dates';

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
        description="Trazabilidad ligera de eventos relevantes para tu usuario."
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
                  {notification.isRead ? <Badge>Leída</Badge> : <Badge tone="info">Nueva</Badge>}
                </div>
                <p>{notification.message}</p>
                <span>{formatDateTime(notification.createdAt)}</span>
              </div>
              {!notification.isRead ? (
                <Button variant="ghost" onClick={() => markNotificationRead(notification.id)}>Marcar leída</Button>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="Sin notificaciones" description="Cuando se creen o actualicen tareas asignadas a ti, aparecerán aquí." />
      )}
    </Card>
  );
}
