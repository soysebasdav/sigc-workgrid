import { useEffect, useState, type FormEvent } from 'react';
import type { Role, User, UserFormValues } from '../../types';
import { Button } from '../../components/ui/Button';
import { Field, Input, Select } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { useApp } from '../../app/AppProvider';

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: User | null;
}

export function UserFormModal({ isOpen, onClose, user }: UserFormModalProps) {
  const { createUser, updateUser } = useApp();
  const [values, setValues] = useState<UserFormValues>({ name: '', email: '', password: '', role: 'user' });

  useEffect(() => {
    if (user) {
      setValues({ name: user.name, email: user.email, password: '', role: user.role });
      return;
    }
    setValues({ name: '', email: '', password: '', role: 'user' });
  }, [user, isOpen]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!values.name.trim() || !values.email.trim()) return;
    try {
      if (user) await updateUser(user.id, values);
      else await createUser(values);
      onClose();
    } catch (error) {
      console.error('No fue posible guardar el usuario:', error);
      window.alert('No fue posible guardar el usuario. Revisa permisos o configuración de Supabase.');
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={user ? 'Editar usuario' : 'Nuevo usuario'} description="Control administrativo de usuarios y roles.">
      <form className="stack" onSubmit={handleSubmit}>
        <Field label="Nombre">
          <Input value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} required />
        </Field>
        <Field label="Correo">
          <Input type="email" value={values.email} onChange={(event) => setValues({ ...values, email: event.target.value })} required />
        </Field>
        <Field label={user ? 'Nueva contraseña' : 'Contraseña'} hint={user ? 'Déjala vacía para conservar la actual.' : 'Si la dejas vacía se usará User123*.'}>
          <Input type="password" value={values.password ?? ''} onChange={(event) => setValues({ ...values, password: event.target.value })} />
        </Field>
        <Field label="Rol">
          <Select value={values.role} onChange={(event) => setValues({ ...values, role: event.target.value as Role })}>
            <option value="user">Usuario</option>
            <option value="admin">Administrador</option>
          </Select>
        </Field>
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit">Guardar usuario</Button>
        </div>
      </form>
    </Modal>
  );
}
