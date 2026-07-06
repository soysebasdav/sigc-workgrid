import { useEffect, useState, type FormEvent } from 'react';
import { Save, ShieldCheck } from 'lucide-react';
import { useApp } from '../../app/AppProvider';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { Field, Input } from '../../components/ui/Field';
import { useAuthorization } from '../authz/AuthorizationProvider';

export function ProfilePage() {
  const { currentUser, updateProfile } = useApp();
  const { roleName, permissions } = useAuthorization();
  const [name, setName] = useState(currentUser?.name ?? '');
  const [email, setEmail] = useState(currentUser?.email ?? '');
  const [password, setPassword] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(currentUser?.name ?? '');
    setEmail(currentUser?.email ?? '');
  }, [currentUser?.email, currentUser?.name]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    try {
      await updateProfile({ name, email, password });
      setPassword('');
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2200);
    } catch (error) {
      console.error('No fue posible actualizar el perfil:', error);
      window.alert('No fue posible actualizar el perfil. Revisa la conexión o la configuración de Supabase Auth.');
    }
  }

  return (
    <div className="profile-grid">
      <Card>
        <CardHeader title="Datos personales" description="Actualiza tu nombre, correo y contraseña de acceso." />
        <form className="stack" onSubmit={handleSubmit}>
          <Field label="Nombre">
            <Input value={name} onChange={(event) => setName(event.target.value)} required />
          </Field>
          <Field label="Correo">
            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </Field>
          <Field label="Nueva contraseña" hint="Déjala vacía si no deseas cambiarla.">
            <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </Field>
          {saved ? <div className="alert success">Perfil actualizado correctamente.</div> : null}
          <Button type="submit"><Save size={17} /> Guardar perfil</Button>
        </form>
      </Card>

      <Card className="identity-card">
        <ShieldCheck size={28} />
        <span>Rol en la organización activa</span>
        <strong>{roleName}</strong>
        <p>{permissions.size} permiso(s) efectivo(s). Tu acceso ya no depende del rol histórico guardado en el perfil.</p>
      </Card>
    </div>
  );
}
