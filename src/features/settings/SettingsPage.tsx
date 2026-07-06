import { useEffect, useState, type FormEvent } from 'react';
import { Save, Settings2, ShieldCheck } from 'lucide-react';
import { useApp } from '../../app/AppProvider';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { Field, Input } from '../../components/ui/Field';
import { useAuthorization } from '../authz/AuthorizationProvider';

export function SettingsPage() {
  const { state, updateSettings, dataMode } = useApp();
  const { roleName } = useAuthorization();
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
      window.alert('No fue posible guardar la configuración. Revisa tus permisos en la organización activa.');
    }
  }

  return (
    <div className="profile-grid">
      <Card>
        <CardHeader title="Parámetros generales" description="Fase 9 mantiene temporalmente este parámetro legacy mientras la Fase 10 migra toda la configuración al núcleo organizacional." />
        <form className="stack" onSubmit={handleSubmit}>
          <Field label="Cierre por inactividad" hint="Valor en minutos. La escritura está protegida por admin.manage_configuration en Supabase.">
            <Input type="number" min={1} value={timeout} onChange={(event) => setTimeoutValue(event.target.value)} />
          </Field>
          {saved ? <div className="alert success">Configuración guardada correctamente.</div> : null}
          <Button type="submit"><Save size={17} /> Guardar configuración</Button>
        </form>
      </Card>

      <Card className="identity-card">
        {dataMode === 'supabase' ? <ShieldCheck size={28} /> : <Settings2 size={28} />}
        <strong>{dataMode === 'supabase' ? 'Autorización RBAC activa' : 'Modo demo local'}</strong>
        <p>{dataMode === 'supabase' ? `Tu rol ${roleName} accede por permiso organizacional. app_settings queda como puente temporal hasta la consolidación de la Fase 10.` : 'La configuración vive en localStorage durante la demo.'}</p>
      </Card>
    </div>
  );
}
