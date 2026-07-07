import { Building2, RefreshCw, ShieldCheck, Trash2, UserCheck, UserPlus, Users } from 'lucide-react';
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
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'U';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'No fue posible actualizar el usuario.';
}

export function UsersPage() {
  const { currentUser } = useApp();
  const { can, roleName } = useAuthorization();
  const { data, isLoading, error, warning, reload } = useSigcUserManagementSnapshot();
  const [savingMembershipId, setSavingMembershipId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const activeRoles = useMemo(() => data?.roles.filter((role) => role.isActive) ?? [], [data?.roles]);
  const canInvite = can(PERMISSIONS.saasManageWorkspace);
  const canManageUsers = can(PERMISSIONS.adminManageUsers);

  async function runMembershipAction(membershipId: string, action: () => Promise<void>, successMessage: string): Promise<void> {
    setSavingMembershipId(membershipId);
    setMessage(null);
    try {
      await action();
      setMessage(successMessage);
      reload();
    } catch (actionError) {
      setMessage(errorMessage(actionError));
    } finally {
      setSavingMembershipId(null);
    }
  }

  async function changeRole(membershipId: string, roleId: string): Promise<void> {
    await runMembershipAction(membershipId, () => sigcService.setMemberRole(membershipId, roleId), 'Rol actualizado. Los permisos efectivos se recalcularon para la organización activa.');
  }

  async function toggleStatus(membershipId: string, isActive: boolean, name: string): Promise<void> {
    const verb = isActive ? 'desactivar' : 'reactivar';
    if (!window.confirm(`¿${verb[0].toUpperCase()}${verb.slice(1)} a ${name}?`)) return;
    await runMembershipAction(
      membershipId,
      () => sigcService.setMemberActive(membershipId, !isActive),
      isActive ? 'Miembro desactivado. Ya no puede acceder a este espacio.' : 'Miembro reactivado correctamente.'
    );
  }

  async function removeMember(membershipId: string, name: string): Promise<void> {
    if (!window.confirm(`¿Retirar a ${name} de la organización? La operación conserva la trazabilidad histórica y revoca su acceso.`)) return;
    await runMembershipAction(membershipId, () => sigcService.removeMember(membershipId), 'Miembro retirado de la organización.');
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <span className="eyebrow">Seguridad organizacional</span>
          <h1>Usuarios y roles</h1>
          <p>Administra el ciclo de vida completo de las membresías sin perder trazabilidad ni dejar a la organización sin un gestor activo.</p>
        </div>
        <div className="page-actions">
          <Button variant="secondary" onClick={reload}><RefreshCw size={17} /> Recargar</Button>
          {canInvite ? <Link className="btn btn-primary" to="/workspace"><UserPlus size={17} /> Invitar usuario</Link> : null}
        </div>
      </header>

      {warning ? <div className="alert danger">{warning}</div> : null}
      {error ? <div className="alert danger">{error}</div> : null}
      {message ? <div className={message.toLowerCase().includes('no fue') || message.toLowerCase().includes('último') ? 'alert danger' : 'alert success'}>{message}</div> : null}

      <Card className="users-members-card">
        <CardHeader title="Miembros de la organización" description={data ? `${data.members.length} miembro(s) · tu rol actual: ${roleName}` : 'Cargando membresías y roles reales.'} />

        {isLoading ? <div className="empty-inline">Validando miembros y permisos...</div> : null}
        {!isLoading && data ? (
          <div className="users-member-list">
            <div className="users-member-grid users-member-grid-head" aria-hidden="true">
              <span>Usuario</span><span>Correo</span><span>Rol organizacional</span><span>Estado</span><span>Acciones</span>
            </div>
            {data.members.map((member) => {
              const isCurrentUser = member.userId === currentUser?.id;
              const isSaving = savingMembershipId === member.membershipId;
              return (
                <article className="users-member-grid users-member-row" key={member.membershipId}>
                  <div className="users-member-identity">
                    <span className="avatar small-avatar">{initials(member.name)}</span>
                    <span><strong>{member.name}</strong><small>{isCurrentUser ? 'Tu usuario actual' : 'Miembro de la organización'}</small></span>
                  </div>
                  <div className="users-member-email"><span className="users-mobile-label">Correo</span><strong>{member.email}</strong></div>
                  <div className="users-member-role">
                    <span className="users-mobile-label">Rol organizacional</span>
                    <select className="input" value={member.roleId ?? ''} disabled={!canManageUsers || !member.isActive || isCurrentUser || isSaving} onChange={(event) => void changeRole(member.membershipId, event.target.value)} title={isCurrentUser ? 'Tu propio rol no se cambia desde esta pantalla.' : 'Asignar rol'}>
                      {!member.roleId ? <option value="">Sin rol</option> : null}
                      {activeRoles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                    </select>
                    {isCurrentUser ? <small>Tu propia membresía se protege para evitar bloqueos accidentales.</small> : null}
                  </div>
                  <div className="users-member-status"><span className="users-mobile-label">Estado</span><Badge tone={member.isActive ? 'success' : 'neutral'}>{member.isActive ? 'Activo' : 'Inactivo'}</Badge></div>
                  <div className="users-member-actions">
                    <span className="users-mobile-label">Acciones</span>
                    {canManageUsers && !isCurrentUser ? <div className="table-actions">
                      <button className="btn btn-white small" disabled={isSaving} onClick={() => void toggleStatus(member.membershipId, member.isActive, member.name)}>{member.isActive ? <><Users size={14} /> Desactivar</> : <><UserCheck size={14} /> Reactivar</>}</button>
                      <button className="btn btn-white icon-only small danger-icon" title="Retirar de la organización" disabled={isSaving} onClick={() => void removeMember(member.membershipId, member.name)}><Trash2 size={14} /></button>
                    </div> : <span className="muted">Protegido</span>}
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </Card>

      <div className="grid-2">
        <Card className="info-card"><ShieldCheck size={22} /><div><strong>Protección del último gestor</strong><p>El backend bloquea degradar, desactivar o retirar al último miembro activo con capacidad para administrar el espacio.</p></div></Card>
        <Card className="info-card">{canInvite ? <UserPlus size={22} /> : <Building2 size={22} />}<div><strong>{canInvite ? 'Altas mediante invitación' : 'Gestión separada por permisos'}</strong><p>{canInvite ? 'Los nuevos accesos se incorporan mediante invitaciones y rol inicial.' : 'Las invitaciones requieren el permiso de gestión del espacio SaaS.'}</p></div></Card>
      </div>

      {!data?.members.length && !isLoading ? <Card className="info-card"><Users size={22} /><div><strong>Sin miembros visibles</strong><p>No se encontraron membresías vigentes para la organización actual.</p></div></Card> : null}
    </div>
  );
}
