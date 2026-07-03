import { LogOut, RotateCcw } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../../app/AppProvider';
import { Button } from '../ui/Button';

const titles: Record<string, { title: string; description: string }> = {
  '/dashboard': {
    title: 'Panel de control',
    description: 'Resumen operativo de tareas, estados, retrasos y vencimientos.'
  },
  '/tasks': {
    title: 'Gestión de tareas',
    description: 'CRUD completo con responsables, estado, vencimiento y trazabilidad básica.'
  },
  '/agenda': {
    title: 'Agenda mensual',
    description: 'Vista calendario para controlar cargas de trabajo por fecha límite.'
  },
  '/notifications': {
    title: 'Notificaciones',
    description: 'Eventos generados por asignaciones, actualizaciones y alertas del sistema.'
  },
  '/users': {
    title: 'Administración de usuarios',
    description: 'Gestión de usuarios, roles y accesos administrativos.'
  },
  '/settings': {
    title: 'Configuración',
    description: 'Parámetros generales de operación de la aplicación.'
  },
  '/profile': {
    title: 'Mi perfil',
    description: 'Actualiza tus datos de acceso y preferencias personales.'
  }
};

export function Topbar() {
  const location = useLocation();
  const { logout, resetDemoData } = useApp();
  const current = titles[location.pathname] ?? titles['/dashboard'];

  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">Aplicación migrada de PHP a React</p>
        <h1>{current.title}</h1>
        <span>{current.description}</span>
      </div>
      <div className="topbar-actions">
        <Button variant="secondary" onClick={resetDemoData} title="Restaurar datos demo">
          <RotateCcw size={17} />
          Demo
        </Button>
        <Button variant="ghost" onClick={logout}>
          <LogOut size={17} />
          Salir
        </Button>
      </div>
    </header>
  );
}
