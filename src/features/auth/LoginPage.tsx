import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { CheckCircle2, LockKeyhole, Sparkles } from 'lucide-react';
import { useApp } from '../../app/AppProvider';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';

export function LoginPage() {
  const { currentUser, login, isLoading, dataMode } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@test.com');
  const [password, setPassword] = useState('Admin123*');
  const [error, setError] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);

  if (currentUser) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const ok = await login(email, password);
      if (!ok) {
        setError(dataMode === 'supabase' ? 'Correo o contraseña inválidos en Supabase Auth.' : 'Correo o contraseña inválidos. Usa las credenciales demo o crea usuarios desde admin.');
        return;
      }
      navigate('/dashboard');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-hero">
        <div className="hero-pill"><Sparkles size={16} /> Migración React + Vite</div>
        <h1>TaskFlow Pro</h1>
        <p>
          La app de la prueba técnica quedó convertida a una SPA moderna, sin PHP, con módulos separados por feature y lista para evolucionar a Supabase o API propia.
        </p>
        <div className="hero-checks">
          <span><CheckCircle2 size={18} /> CRUD de tareas</span>
          <span><CheckCircle2 size={18} /> Roles admin/user</span>
          <span><CheckCircle2 size={18} /> Agenda y notificaciones</span>
        </div>
      </section>

      <section className="login-card">
        <div className="login-icon"><LockKeyhole /></div>
        <h2>Iniciar sesión</h2>
        <p>Datos demo precargados en localStorage.</p>

        <form onSubmit={handleSubmit} className="stack">
          <Field label="Correo">
            <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required />
          </Field>
          <Field label="Contraseña">
            <Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" required />
          </Field>
          {error ? <div className="alert danger">{error}</div> : null}
          <Button type="submit" disabled={isSubmitting || isLoading}>{isSubmitting || isLoading ? 'Validando...' : 'Entrar al sistema'}</Button>
        </form>

        <div className="demo-credentials">
          <strong>{dataMode === 'supabase' ? 'Credenciales Supabase' : 'Credenciales demo'}</strong>
          <span>admin@test.com / Admin123*</span>
          <span>user@test.com / User123*</span>
        </div>
      </section>
    </main>
  );
}
