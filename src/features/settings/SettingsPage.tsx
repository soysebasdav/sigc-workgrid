import { useEffect, useState, type FormEvent } from 'react';
import { Save, Settings2 } from 'lucide-react';
import { useApp } from '../../app/AppProvider';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { Field, Input } from '../../components/ui/Field';

export function SettingsPage() {
  const { state, updateSettings, dataMode } = useApp();
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
      window.alert('No fue posible guardar la configuración. Revisa permisos de administrador en Supabase.');
    }
  }

  return (
    <div className="profile-grid">
      <Card>
        <CardHeader title="Parámetros generales" description="Configuración equivalente al módulo app_settings del proyecto PHP." />
        <form className="stack" onSubmit={handleSubmit}>
          <Field label="Cierre por inactividad" hint="Valor en minutos. En esta versión demo se conserva como parámetro de negocio.">
            <Input type="number" min={1} value={timeout} onChange={(event) => setTimeoutValue(event.target.value)} />
          </Field>
          {saved ? <div className="alert success">Configuración guardada correctamente.</div> : null}
          <Button type="submit"><Save size={17} /> Guardar configuración</Button>
        </form>
      </Card>

      <Card className="identity-card">
        <Settings2 size={28} />
        <strong>Sin PHP ni Apache</strong>
        <p>{dataMode === 'supabase' ? 'La configuración se guarda en Supabase/PostgreSQL mediante app_settings.' : 'La configuración vive en localStorage durante la demo. Puedes activar Supabase con VITE_DATA_MODE=supabase.'}</p>
      </Card>
    </div>
  );
}
