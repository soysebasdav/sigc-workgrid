import { NavLink } from 'react-router-dom';
import { Bell, CalendarDays, CheckSquare, LayoutDashboard, Settings, UserCog, Users } from 'lucide-react';
import { useApp } from '../../app/AppProvider';

const baseItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/tasks', label: 'Tareas', icon: CheckSquare },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/notifications', label: 'Notificaciones', icon: Bell }
];

const adminItems = [
  { to: '/users', label: 'Usuarios', icon: Users },
  { to: '/settings', label: 'Configuración', icon: Settings }
];

export function Sidebar() {
  const { currentUser, unreadNotifications } = useApp();
  const items = currentUser?.role === 'admin' ? [...baseItems, ...adminItems] : baseItems;

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">TF</div>
        <div>
          <strong>TaskFlow Pro</strong>
          <span>React Edition</span>
        </div>
      </div>

      <nav className="nav-list" aria-label="Navegación principal">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon size={18} />
              <span>{item.label}</span>
              {item.to === '/notifications' && unreadNotifications > 0 ? <em>{unreadNotifications}</em> : null}
            </NavLink>
          );
        })}
      </nav>

      <NavLink to="/profile" className={({ isActive }) => `profile-card ${isActive ? 'active' : ''}`}>
        <UserCog size={18} />
        <div>
          <strong>{currentUser?.name}</strong>
          <span>{currentUser?.role === 'admin' ? 'Administrador' : 'Usuario'}</span>
        </div>
      </NavLink>
    </aside>
  );
}
