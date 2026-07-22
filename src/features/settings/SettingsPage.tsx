import { useEffect, useState, type FormEvent } from 'react';
import { Globe2, Palette, Save, Settings2, ShieldCheck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApp } from '../../app/AppProvider';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { Field, Input } from '../../components/ui/Field';
import { useAuthorization } from '../authz/AuthorizationProvider';
import { PERMISSIONS } from '../authz/permissions';
import { appErrorMessage } from '../../utils/errors';

export function SettingsPage() {
  const { state, updateSettings, dataMode } = useApp();
  const { roleName, can } = useAuthorization();
  const canManageWorkspace = can(PERMISSIONS.saasManageWorkspace);
  const [timeout, setTimeoutValue] = useState(String(state.settings.inactivityTimeoutMinutes));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setTimeoutValue(String(state.settings.inactivityTimeoutMinutes));
  }, [state.settings.inactivityTimeoutMinutes]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    try {
      await updateSettings({ inactivityTimeoutMinutes: Number(timeout) });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2200);
    } catch (error) {
      console.error('No fue posible guardar configuración:', error);
      window.alert(appErrorMessage(error, 'No fue posible guardar la configuración. Revisa tus permisos en la organización activa.'));
    }
  }

  return (
    <div className="profile-grid">
      <Card>
        <CardHeader title="Parámetros generales" description="Parámetros operativos de la organización activa. La configuración operativa vive por organización." />
        <form className="stack" onSubmit={handleSubmit}>
          <Field label="Cierre por inactividad" hint="Valor en minutos para la organización activa. La escritura está protegida por admin.manage_configuration.">
            <Input type="number" min={1} value={timeout} onChange={(event) => setTimeoutValue(event.target.value)} />
          </Field>
          {saved ? <div className="alert success">Configuración guardada correctamente.</div> : null}
          <Button type="submit"><Save size={17} /> Guardar configuración</Button>
        </form>
      </Card>



      {canManageWorkspace ? (
        <Card>
          <CardHeader title="Configuración de la organización" description="La marca, el formulario público y las invitaciones se administran desde el Espacio de trabajo." />
          <div className="stack">
            <Link className="btn btn-white" to="/workspace?tab=branding"><Palette size={17} /> Identidad visual y marca</Link>
            <Link className="btn btn-white" to="/workspace?tab=public-intake"><Globe2 size={17} /> Radicación pública y enlace externo</Link>
            <Link className="btn btn-white" to="/workspace?tab=team"><Users size={17} /> Invitaciones y equipo</Link>
          </div>
        </Card>
      ) : null}

      <Card className="identity-card">
        {dataMode === 'supabase' ? <ShieldCheck size={28} /> : <Settings2 size={28} />}
        <strong>{dataMode === 'supabase' ? 'Autorización RBAC activa' : 'Modo demo local'}</strong>
        <p>{dataMode === 'supabase' ? `Tu rol ${roleName} accede por permiso organizacional. La configuración operativa vive en organizations.settings y se aplica por empresa.` : 'La configuración vive en localStorage durante la demo.'}</p>
      </Card>
    </div>
  );
}
