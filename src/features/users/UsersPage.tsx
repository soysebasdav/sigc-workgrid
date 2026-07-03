import { Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { User } from '../../types';
import { useApp } from '../../app/AppProvider';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { formatDateTime } from '../../utils/dates';
import { UserFormModal } from './UserFormModal';

export function UsersPage() {
  const { state, currentUser, deleteUser } = useApp();
  const [isOpen, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  function openCreate(): void {
    setEditingUser(null);
    setOpen(true);
  }

  function openEdit(user: User): void {
    setEditingUser(user);
    setOpen(true);
  }

  return (
    <>
      <Card>
        <CardHeader
          title="Usuarios registrados"
          description="Solo los administradores pueden crear usuarios y modificar roles."
          action={<Button onClick={openCreate}><Plus size={18} /> Nuevo usuario</Button>}
        />
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Actualizado</th>
                <th className="align-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {state.users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.name}</strong>
                    <span>{user.id === currentUser?.id ? 'Tu usuario actual' : 'Usuario del sistema'}</span>
                  </td>
                  <td>{user.email}</td>
                  <td>
                    <Badge tone={user.role === 'admin' ? 'info' : 'neutral'}>
                      {user.role === 'admin' ? 'Administrador' : 'Usuario'}
                    </Badge>
                  </td>
                  <td>{formatDateTime(user.updatedAt)}</td>
                  <td>
                    <div className="row-actions">
                      <Button variant="ghost" onClick={() => openEdit(user)}><Pencil size={17} /></Button>
                      <Button variant="ghost" onClick={() => deleteUser(user.id)} disabled={user.id === currentUser?.id} title="Eliminar usuario"><Trash2 size={17} /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="info-card">
        <ShieldCheck size={22} />
        <div>
          <strong>Regla de seguridad conservada</strong>
          <p>No se permite eliminar tu propio usuario ni dejar el sistema sin administradores.</p>
        </div>
      </Card>

      <UserFormModal isOpen={isOpen} onClose={() => setOpen(false)} user={editingUser} />
    </>
  );
}
