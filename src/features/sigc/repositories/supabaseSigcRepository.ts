import { supabase } from '../../../lib/supabaseClient';
import type { CasePriorityName, SemColor, SigcCase, SigcCatalogOption, SigcCatalogs } from '../domain/types';
import type { SigcRepository } from './types';

function requireClient() {
  if (!supabase) throw new Error('Supabase no está configurado.');
  return supabase;
}

type CaseQueryRow = {
  id: string;
  organization_id: string;
  radicado: string;
  subject: string;
  requester_name: string;
  requester_company: string | null;
  requester_email: string | null;
  source: string;
  risk_level: string | null;
  due_at: string | null;
  progress: number;
  updated_at: string;
  case_type: { name: string } | null;
  priority: { name: string } | null;
  state: { name: string } | null;
  area: { name: string } | null;
  owner: { name: string } | null;
  sla_policy: { duration_value: number; duration_unit: string } | null;
};

async function ensureOrganization(): Promise<string> {
  const client = requireClient();
  const { data, error } = await client.rpc('ensure_user_organization');
  if (error) throw error;
  if (!data) throw new Error('No fue posible resolver la organización activa del usuario.');
  return String(data);
}

function durationLabel(policy: CaseQueryRow['sla_policy']): string {
  if (!policy) return 'Sin SLA';
  const unitMap: Record<string, string> = { hours: 'horas', calendar_days: 'días calendario', business_days: 'días hábiles' };
  return `${policy.duration_value} ${unitMap[policy.duration_unit] ?? policy.duration_unit}`;
}

function relativeUpdated(iso: string): string {
  const value = new Date(iso).getTime();
  if (!Number.isFinite(value)) return iso;
  const minutes = Math.max(0, Math.round((Date.now() - value) / 60000));
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Ayer' : `Hace ${days} días`;
}

function formatDue(iso: string | null): string {
  if (!iso) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

function semFromDue(dueAt: string | null): SemColor {
  if (!dueAt) return 'green';
  const remaining = new Date(dueAt).getTime() - Date.now();
  if (remaining <= 0) return 'red';
  const hours = remaining / 3600000;
  if (hours <= 24) return 'orange';
  if (hours <= 72) return 'yellow';
  return 'green';
}

function mapCase(row: CaseQueryRow): SigcCase {
  const priorityName = (row.priority?.name ?? 'Media') as CasePriorityName;
  const sem = semFromDue(row.due_at);
  return {
    id: row.radicado,
    databaseId: row.id,
    radicado: row.radicado,
    organizationId: row.organization_id,
    type: row.case_type?.name ?? 'Sin clasificar',
    subject: row.subject,
    company: row.requester_company ?? 'Sin empresa',
    requester: row.requester_name,
    requesterEmail: row.requester_email ?? undefined,
    area: row.area?.name ?? 'Sin área',
    owner: row.owner?.name ?? 'Sin responsable',
    state: row.state?.name ?? 'Pendiente de Clasificación',
    priority: priorityName,
    sla: durationLabel(row.sla_policy),
    due: formatDue(row.due_at),
    sem,
    progress: row.progress,
    updated: relativeUpdated(row.updated_at),
    risk: row.risk_level ?? (sem === 'red' ? 'Vencido' : sem === 'orange' ? 'Próximo a vencer' : 'En tiempo'),
    source: row.source
  };
}

async function fetchCases(identifier?: string): Promise<SigcCase[]> {
  const client = requireClient();
  const organizationId = await ensureOrganization();

  let query = client
    .from('cases')
    .select(`
      id, organization_id, radicado, subject, requester_name, requester_company, requester_email,
      source, risk_level, due_at, progress, updated_at,
      case_type:case_types(name),
      priority:priorities(name),
      state:case_states(name),
      area:areas(name),
      owner:profiles(name),
      sla_policy:sla_policies(duration_value,duration_unit)
    `)
    .eq('organization_id', organizationId)
    .order('updated_at', { ascending: false });

  if (identifier) {
    const decoded = decodeURIComponent(identifier);
    query = /^[0-9a-f-]{36}$/i.test(decoded) ? query.eq('id', decoded) : query.eq('radicado', decoded);
  }

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as CaseQueryRow[]).map(mapCase);
}

function mapCatalog(rows: Array<{ id: string; name: string; code?: string | null; color?: string | null; is_active?: boolean }>): SigcCatalogOption[] {
  return rows.map((row) => ({ id: row.id, name: row.name, code: row.code ?? undefined, color: row.color ?? null, isActive: row.is_active ?? true }));
}

export const supabaseSigcRepository: SigcRepository = {
  async listCases(): Promise<SigcCase[]> {
    return fetchCases();
  },

  async getCaseByIdentifier(identifier: string): Promise<SigcCase | null> {
    const rows = await fetchCases(identifier);
    return rows[0] ?? null;
  },

  async getCatalogs(): Promise<SigcCatalogs> {
    const client = requireClient();
    const organizationId = await ensureOrganization();
    const [areas, types, states, priorities, roles] = await Promise.all([
      client.from('areas').select('id,name,code,color,is_active').eq('organization_id', organizationId).order('sort_order'),
      client.from('case_types').select('id,name,code,color,is_active').eq('organization_id', organizationId).order('name'),
      client.from('case_states').select('id,name,code,color,is_active').eq('organization_id', organizationId).order('sort_order'),
      client.from('priorities').select('id,name,code,color,is_active').eq('organization_id', organizationId).order('sort_order'),
      client.from('roles').select('id,name,code,is_active').eq('organization_id', organizationId).order('name')
    ]);

    const error = areas.error ?? types.error ?? states.error ?? priorities.error ?? roles.error;
    if (error) throw error;

    return {
      organizationId,
      areas: mapCatalog(areas.data ?? []),
      caseTypes: mapCatalog(types.data ?? []),
      states: mapCatalog(states.data ?? []),
      priorities: mapCatalog(priorities.data ?? []),
      roles: mapCatalog(roles.data ?? [])
    };
  }
};
