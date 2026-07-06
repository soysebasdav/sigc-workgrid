import { Building2, RefreshCw, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../app/AppProvider';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { useAuthorization } from '../authz/AuthorizationProvider';
import { PERMISSIONS } from '../authz/permissions';
import { useSigcUserManagementSnapshot } from '../sigc/hooks/useSigcData';
import { sigcService } from '../sigc/services/sigcService';

function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'U';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'No fue posible actualizar el rol del usuario.';
}

export function UsersPage() {
  const { currentUser } = useApp();
  const { can, roleName } = useAuthorization();
  const { data, isLoading, error, warning, reload } = useSigcUserManagementSnapshot();
  const [savingMembershipId, setSavingMembershipId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const activeRoles = useMemo(() => data?.roles.filter((role) => role.isActive) ?? [], [data?.roles]);
  const canInvite = can(PERMISSIONS.saasManageWorkspace);

  async function changeRole(membershipId: string, roleId: string): Promise<void> {
    setSavingMembershipId(membershipId);
    setMessage(null);
    try {
      await sigcService.setMemberRole(membershipId, roleId);
      setMessage('Rol actualizado. Los permisos efectivos se recalcularon para la organización activa.');
    } catch (changeError) {
      setMessage(errorMessage(changeError));
    } finally {
      setSavingMembershipId(null);
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <span className="eyebrow">Fase 9 · RBAC organizacional</span>
          <h1>Usuarios y roles</h1>
          <p>La autorización se determina por membresía, rol y permisos de la organización activa. El campo histórico de perfil ya no decide el acceso.</p>
        </div>
        <div className="page-actions">
          <Button variant="secondary" onClick={reload}><RefreshCw size={17} /> Recargar</Button>
          {canInvite ? <Link className="btn btn-primary" to="/workspace"><UserPlus size={17} /> Invitar usuario</Link> : null}
        </div>
      </header>

      {warning ? <div className="alert danger">{warning}</div> : null}
      {error ? <div className="alert danger">{error}</div> : null}
      {message ? <div className="alert success">{message}</div> : null}

      <Card>
        <CardHeader
          title="Miembros de la organización"
          description={data ? `${data.members.length} miembro(s) · tu rol actual: ${roleName}` : 'Cargando membresías y roles reales.'}
        />

        {isLoading ? <div className="empty-inline">Validando miembros y permisos...</div> : null}
        {!isLoading && data ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Correo</th>
                  <th>Rol organizacional</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.members.map((member) => {
                  const isCurrentUser = member.userId === currentUser?.id;
                  return (
                    <tr key={member.membershipId}>
                      <td>
                        <div className="phase56-member-identity">
                          <span className="avatar small-avatar">{initials(member.name)}</span>
                          <span>
                            <strong>{member.name}</strong>
                            <small>{isCurrentUser ? 'Tu usuario actual' : 'Miembro de la organización'}</small>
                          </span>
                        </div>
                      </td>
                      <td>{member.email}</td>
                      <td>
                        <select
                          className="input"
                          value={member.roleId ?? ''}
                          disabled={!member.isActive || isCurrentUser || savingMembershipId === member.membershipId}
                          onChange={(event) => void changeRole(member.membershipId, event.target.value)}
                          title={isCurrentUser ? 'Tu propio rol no se cambia desde esta pantalla.' : 'Asignar rol'}
                        >
                          {!member.roleId ? <option value="">Sin rol</option> : null}
                          {activeRoles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                        </select>
                        {isCurrentUser ? <small>Tu propio rol se protege para evitar bloqueos accidentales.</small> : null}
                      </td>
                      <td><Badge tone={member.isActive ? 'success' : 'neutral'}>{member.isActive ? 'Activo' : 'Inactivo'}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      <div className="grid-2">
        <Card className="info-card">
          <ShieldCheck size={22} />
          <div>
            <strong>Una sola fuente de autoridad</strong>
            <p>Los permisos efectivos provienen de organization_members → roles → role_permissions → permissions.</p>
          </div>
        </Card>
        <Card className="info-card">
          {canInvite ? <UserPlus size={22} /> : <Building2 size={22} />}
          <div>
            <strong>{canInvite ? 'Altas mediante invitación' : 'Gestión separada por permisos'}</strong>
            <p>{canInvite ? 'Los nuevos accesos se incorporan desde el espacio SaaS mediante invitaciones y rol inicial.' : 'Puedes administrar roles existentes; las invitaciones requieren el permiso de gestión del espacio SaaS.'}</p>
          </div>
        </Card>
      </div>

      {!data?.members.length && !isLoading ? (
        <Card className="info-card"><Users size={22} /><div><strong>Sin miembros visibles</strong><p>No se encontraron membresías activas para la organización actual.</p></div></Card>
      ) : null}
    </div>
  );
}
