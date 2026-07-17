import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Cloud,
  Code2,
  Copy,
  Database,
  Download,
  ExternalLink,
  FileArchive,
  Globe2,
  KeyRound,
  Loader2,
  Mail,
  Network,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Send,
  ServerCog,
  ShieldCheck,
  TestTube2,
  ThumbsDown,
  ThumbsUp,
  Unplug,
  Webhook,
  X
} from 'lucide-react';
import { platformService } from './platformService';
import { useAuthorization } from '../authz/AuthorizationProvider';
import { PERMISSIONS } from '../authz/permissions';
import { usePlatformAccess } from './PlatformAccessProvider';
import type {
  CreatedIntegrationSecret,
  IntegrationDashboard,
  IntegrationDomain,
  IntegrationWebhook,
  KnowledgeArticle,
  OrganizationDataExport,
  OrganizationIntegrationsSnapshot
} from './types';

type Mode = 'platform' | 'organization';
type Tab = 'api' | 'webhooks' | 'domains' | 'identity' | 'exports';

function formatDate(value: string | null | undefined, withTime = true): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', ...(withTime ? { timeStyle: 'short' as const } : {}) }).format(parsed);
}

function formatBytes(value: number | null | undefined): string {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let amount = bytes;
  let unit = -1;
  do { amount /= 1024; unit += 1; } while (amount >= 1024 && unit < units.length - 1);
  return `${amount.toFixed(amount >= 10 ? 1 : 2)} ${units[unit]}`;
}

function tone(status: string): string {
  if (['active', 'verified', 'connected', 'completed', 'succeeded', 'ready', 'published'].includes(status)) return 'success';
  if (['pending', 'queued', 'processing', 'draft', 'test'].includes(status)) return 'warning';
  if (['failed', 'dead_letter', 'error', 'revoked', 'expired', 'disabled'].includes(status)) return 'danger';
  return 'info';
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: 'Activo', paused: 'Pausado', disabled: 'Deshabilitado', revoked: 'Revocada', expired: 'Expirada',
    pending: 'Pendiente', verified: 'Verificado', failed: 'Fallido', connected: 'Conectado', error: 'Error',
    queued: 'En cola', processing: 'Procesando', completed: 'Completado', dead_letter: 'Cola muerta',
    succeeded: 'Entregado', draft: 'Borrador', ready: 'Listo', not_configured: 'Sin configurar', published: 'Publicado', archived: 'Archivado'
  };
  return labels[status] || status;
}

function useLoad<T>(loader: () => Promise<T>, deps: readonly unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((current) => current + 1), []);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    void loader().then((result) => { if (alive) setData(result); }).catch((cause: unknown) => { if (alive) setError(cause instanceof Error ? cause.message : 'No fue posible cargar el módulo.'); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, revision]);
  return { data, loading, error, reload };
}

function PageHead({ title, description, actions, platform = true }: { title: string; description: string; actions?: ReactNode; platform?: boolean }) {
  return <header className={platform ? 'platform-page-head' : 'page-head'}><div><span className="eyebrow">Orkesta · Integraciones</span><h1>{title}</h1><p>{description}</p></div>{actions ? <div className={platform ? 'platform-page-actions' : 'page-actions'}>{actions}</div> : null}</header>;
}

function Loading({ text = 'Cargando integraciones...' }: { text?: string }) {
  return <section className="card platform-loading"><Loader2 className="spin" /><strong>{text}</strong></section>;
}

function ErrorBox({ message, reload }: { message: string; reload: () => void }) {
  return <section className="card platform-error"><AlertTriangle /><div><strong>No fue posible cargar la información</strong><p>{message}</p></div><button className="btn btn-white" onClick={reload}>Reintentar</button></section>;
}

function Empty({ icon, title, description }: { icon?: ReactNode; title: string; description: string }) {
  return <div className="platform-empty">{icon || <Unplug />}<strong>{title}</strong><p>{description}</p></div>;
}

function Metric({ icon, label, value, helper, danger }: { icon: ReactNode; label: string; value: ReactNode; helper: string; danger?: boolean }) {
  return <article className={`platform-metric card ${danger ? 'danger' : ''}`}><div className="platform-metric-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{helper}</small></div></article>;
}

export function PlatformIntegrationsPage() {
  const { canPlatform } = usePlatformAccess();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { data, loading, error, reload } = useLoad<IntegrationDashboard>(() => platformService.getIntegrationsDashboard());
  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox message={error} reload={reload} />;
  const dashboard = data!;
  return <div className="platform-page">
    <PageHead title="Integraciones empresariales" description="API pública, webhooks, dominios, SSO, conectores y exportaciones de todas las organizaciones." actions={<><Link className="btn btn-white" to="/superadmin/knowledge"><BookOpen size={16} />Conocimiento</Link>{canPlatform('platform.integrations.manage') ? <button className="btn btn-white" onClick={() => setSettingsOpen(true)}><ServerCog size={16} />Configuración global</button> : null}<button className="btn btn-white" onClick={reload}><RefreshCw size={16} />Actualizar</button></>} />
    <section className="platform-metric-grid">
      <Metric icon={<KeyRound />} label="API keys activas" value={dashboard.metrics.activeApiKeys} helper="Credenciales vigentes" />
      <Metric icon={<Webhook />} label="Webhooks activos" value={dashboard.metrics.activeWebhooks} helper="Endpoints recibiendo eventos" />
      <Metric icon={<AlertTriangle />} label="Entregas fallidas" value={dashboard.metrics.failedDeliveries} helper="Fallidas o en cola muerta" danger={dashboard.metrics.failedDeliveries > 0} />
      <Metric icon={<Globe2 />} label="Dominios pendientes" value={dashboard.metrics.pendingDomains} helper={`${dashboard.metrics.verifiedDomains} verificados`} danger={dashboard.metrics.pendingDomains > 0} />
      <Metric icon={<ShieldCheck />} label="SSO preparado" value={dashboard.metrics.ssoReady} helper="Organizaciones listas o activas" />
      <Metric icon={<FileArchive />} label="Exportaciones pendientes" value={dashboard.metrics.pendingExports} helper="En cola o procesamiento" danger={dashboard.metrics.pendingExports > 0} />
      <Metric icon={<Cloud />} label="Conectores activos" value={dashboard.metrics.connectedConnectors} helper="Drive, SharePoint u otros" />
    </section>
    <section className="card platform-table-card">
      <header className="platform-card-heading"><div><h2>Organizaciones e integraciones</h2><p>Estado consolidado por cliente.</p></div><Network /></header>
      <div className="platform-table-scroll"><table><thead><tr><th>Organización</th><th>API</th><th>Webhooks</th><th>Dominios</th><th>SSO</th><th>Conectores</th><th>Fallos</th><th /></tr></thead><tbody>{dashboard.organizations.map((item) => <tr key={item.organizationId}><td><strong>{item.organizationName}</strong><small>{item.slug}</small></td><td><strong>{item.apiKeys}</strong><small>{item.lastApiUse ? `Último uso ${formatDate(item.lastApiUse)}` : 'Sin uso'}</small></td><td>{item.webhooks}</td><td>{item.domains}</td><td><span className={`platform-chip ${tone(item.ssoStatus || 'not_configured')}`}>{statusLabel(item.ssoStatus || 'not_configured')}</span></td><td>{item.connectors}</td><td><span className={item.failedDeliveries ? 'text-danger' : 'text-success'}>{item.failedDeliveries}</span></td><td><Link className="btn btn-white compact" to={`/superadmin/integrations/${item.organizationId}`}>Gestionar <ChevronRight size={15} /></Link></td></tr>)}</tbody></table></div>
    </section>
    <section className="card platform-panel"><header><div><h2>Configuración global</h2><p>URLs base, destinos CNAME y políticas comunes.</p></div><ServerCog /></header><div className="integration-settings-grid"><div><span>API pública</span><strong>{dashboard.settings?.publicApiBaseUrl || 'Pendiente de configurar'}</strong></div><div><span>CNAME aplicación</span><strong>{dashboard.settings?.appCnameTarget || 'Pendiente'}</strong></div><div><span>CNAME formulario</span><strong>{dashboard.settings?.publicFormCnameTarget || 'Pendiente'}</strong></div><div><span>CNAME API</span><strong>{dashboard.settings?.apiCnameTarget || 'Pendiente'}</strong></div><div><span>Retención exportaciones</span><strong>{dashboard.settings?.exportsRetentionDays || 30} días</strong></div><div><span>Webhooks</span><strong>{dashboard.settings?.webhookMaxAttempts || 5} intentos · {dashboard.settings?.webhookTimeoutMs || 15000} ms</strong></div></div></section>
    <section className="card platform-panel"><header><div><h2>Fallos recientes de webhooks</h2><p>Entregas que requieren revisión técnica.</p></div><AlertTriangle /></header>{dashboard.recentFailures.length ? <div className="platform-table-scroll"><table><thead><tr><th>Organización</th><th>Evento</th><th>Intentos</th><th>Error</th><th>Fecha</th></tr></thead><tbody>{dashboard.recentFailures.map((item) => <tr key={item.id}><td>{item.organizationName}</td><td><code>{item.eventType}</code></td><td>{item.attempts}</td><td className="integration-error-cell">{item.lastError || 'Sin detalle'}</td><td>{formatDate(item.createdAt)}</td></tr>)}</tbody></table></div> : <Empty icon={<CheckCircle2 />} title="Sin fallos recientes" description="Las entregas webhook no registran fallos pendientes." />}</section>
    {settingsOpen ? <IntegrationSettingsModal settings={dashboard.settings} close={() => setSettingsOpen(false)} saved={() => { setSettingsOpen(false); reload(); }} /> : null}
  </div>;
}

function IntegrationSettingsModal({ settings, close, saved }: { settings: IntegrationDashboard['settings']; close: () => void; saved: () => void }) {
  const [publicApiBaseUrl, setPublicApiBaseUrl] = useState(settings?.publicApiBaseUrl || '');
  const [appCnameTarget, setAppCnameTarget] = useState(settings?.appCnameTarget || '');
  const [publicFormCnameTarget, setPublicFormCnameTarget] = useState(settings?.publicFormCnameTarget || '');
  const [apiCnameTarget, setApiCnameTarget] = useState(settings?.apiCnameTarget || '');
  const [exportsRetentionDays, setExportsRetentionDays] = useState(settings?.exportsRetentionDays || 30);
  const [webhookMaxAttempts, setWebhookMaxAttempts] = useState(settings?.webhookMaxAttempts || 5);
  const [webhookTimeoutMs, setWebhookTimeoutMs] = useState(settings?.webhookTimeoutMs || 15000);
  const [reason, setReason] = useState('Configuración operativa de integraciones');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      await platformService.updateIntegrationSettings({ publicApiBaseUrl, appCnameTarget, publicFormCnameTarget, apiCnameTarget, exportsRetentionDays, webhookMaxAttempts, webhookTimeoutMs }, reason);
      saved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible guardar la configuración.'); }
    finally { setSaving(false); }
  }
  return <Modal title="Configuración global de integraciones" subtitle="Estos valores se usan para documentación, verificación de dominios y políticas de procesamiento." close={close}><form className="integration-form" onSubmit={submit}><div className="platform-form-grid"><label>URL base de API<input type="url" value={publicApiBaseUrl} onChange={(event) => setPublicApiBaseUrl(event.target.value)} placeholder="https://.../functions/v1/orkesta-public-api" /></label><label>CNAME de aplicación<input value={appCnameTarget} onChange={(event) => setAppCnameTarget(event.target.value)} placeholder="app.orkesta..." /></label><label>CNAME de formulario público<input value={publicFormCnameTarget} onChange={(event) => setPublicFormCnameTarget(event.target.value)} /></label><label>CNAME de API<input value={apiCnameTarget} onChange={(event) => setApiCnameTarget(event.target.value)} /></label><label>Retención de exportaciones (días)<input type="number" min={1} max={365} value={exportsRetentionDays} onChange={(event) => setExportsRetentionDays(Number(event.target.value))} /></label><label>Intentos máximos de webhook<input type="number" min={1} max={20} value={webhookMaxAttempts} onChange={(event) => setWebhookMaxAttempts(Number(event.target.value))} /></label><label>Timeout de webhook (ms)<input type="number" min={1000} max={60000} value={webhookTimeoutMs} onChange={(event) => setWebhookTimeoutMs(Number(event.target.value))} /></label></div><label>Justificación<textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} required /></label>{error ? <div className="alert danger">{error}</div> : null}<footer><button type="button" className="btn btn-white" onClick={close}>Cancelar</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar y auditar'}</button></footer></form></Modal>;
}

export function PlatformOrganizationIntegrationsPage() {
  const { organizationId = '' } = useParams();
  return <IntegrationWorkspace mode="platform" organizationId={organizationId} />;
}

export function OrganizationIntegrationsPage() {
  return <div className="page"><IntegrationWorkspace mode="organization" /></div>;
}

function IntegrationWorkspace({ mode, organizationId }: { mode: Mode; organizationId?: string }) {
  const { can } = useAuthorization();
  const { canPlatform } = usePlatformAccess();
  const loader = useCallback(() => mode === 'platform' ? platformService.getOrganizationIntegrations(organizationId || '') : platformService.getOrganizationIntegrationsPortal(), [mode, organizationId]);
  const { data, loading, error, reload } = useLoad<OrganizationIntegrationsSnapshot>(loader, [mode, organizationId]);
  const [tab, setTab] = useState<Tab>('api');
  const [dialog, setDialog] = useState<'api' | 'webhook' | 'domain' | 'export' | 'sso' | 'email' | 'connector' | null>(null);
  const [secret, setSecret] = useState<{ title: string; value: string } | null>(null);
  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox message={error} reload={reload} />;
  const snapshot = data!;
  const platform = mode === 'platform';
  const canApiManage = platform ? canPlatform('platform.api.manage') : can(PERMISSIONS.integrationsApiManage);
  const canWebhookManage = platform ? canPlatform('platform.webhooks.manage') : can(PERMISSIONS.integrationsWebhookManage);
  const canDomainManage = platform ? canPlatform('platform.domains.manage') : can(PERMISSIONS.integrationsDomainManage);
  const canIdentityManage = platform ? canPlatform('platform.sso.manage') || canPlatform('platform.integrations.manage') : can(PERMISSIONS.integrationsManage);
  const canExportManage = platform ? canPlatform('platform.exports.manage') : can(PERMISSIONS.integrationsExportsManage);
  const wrapClass = platform ? 'platform-page' : '';
  return <div className={wrapClass}>
    <PageHead platform={platform} title={platform ? `Integraciones · ${snapshot.organization.name}` : 'Integraciones y API'} description="Administra credenciales, eventos, dominios, identidad, conectores y exportaciones sin entrar a la base de datos." actions={<><button className="btn btn-white" onClick={reload}><RefreshCw size={16} />Actualizar</button>{platform ? <Link className="btn btn-white" to="/superadmin/integrations">Volver</Link> : <Link className="btn btn-white" to="/help"><BookOpen size={16} />Ayuda</Link>}</>} />
    <nav className="platform-tabs integration-tabs">
      <button className={tab === 'api' ? 'active' : ''} onClick={() => setTab('api')}><KeyRound size={16} />API</button>
      <button className={tab === 'webhooks' ? 'active' : ''} onClick={() => setTab('webhooks')}><Webhook size={16} />Webhooks</button>
      <button className={tab === 'domains' ? 'active' : ''} onClick={() => setTab('domains')}><Globe2 size={16} />Dominios</button>
      <button className={tab === 'identity' ? 'active' : ''} onClick={() => setTab('identity')}><ShieldCheck size={16} />Identidad y conectores</button>
      <button className={tab === 'exports' ? 'active' : ''} onClick={() => setTab('exports')}><FileArchive size={16} />Exportaciones</button>
    </nav>
    {tab === 'api' ? <ApiSection snapshot={snapshot} canManage={canApiManage} create={() => setDialog('api')} revoke={async (id) => { const reason = window.prompt('Motivo de revocación (mínimo 5 caracteres):') || ''; if (reason.trim().length < 5) return; if (platform) await platformService.revokePlatformApiKey(id, reason); else await platformService.revokeOrganizationApiKey(id, reason); reload(); }} /> : null}
    {tab === 'webhooks' ? <WebhookSection snapshot={snapshot} canManage={canWebhookManage} create={() => setDialog('webhook')} platform={platform} reload={reload} showSecret={(value) => setSecret({ title: 'Secreto de firma webhook', value })} /> : null}
    {tab === 'domains' ? <DomainsSection rows={snapshot.domains} canManage={canDomainManage} create={() => setDialog('domain')} verify={async (id) => { await platformService.verifyIntegrationDomain(id); reload(); }} /> : null}
    {tab === 'identity' ? <IdentitySection snapshot={snapshot} canManage={canIdentityManage} editSso={() => setDialog('sso')} editEmail={() => setDialog('email')} addConnector={() => setDialog('connector')} /> : null}
    {tab === 'exports' ? <ExportsSection rows={snapshot.exports} canManage={canExportManage} create={() => setDialog('export')} process={async (id) => { await platformService.processDataExport(id); reload(); }} download={async (id) => { const result = await platformService.createDataExportDownloadUrl(id); window.open(result.url, '_blank', 'noopener,noreferrer'); }} /> : null}
    {dialog === 'api' ? <ApiKeyModal mode={mode} organizationId={snapshot.organization.id} close={() => setDialog(null)} saved={(created) => { setDialog(null); setSecret({ title: 'API key creada', value: created.secret }); reload(); }} /> : null}
    {dialog === 'webhook' ? <WebhookModal mode={mode} organizationId={snapshot.organization.id} catalog={snapshot.eventCatalog} close={() => setDialog(null)} saved={(createdSecret) => { setDialog(null); if (createdSecret) setSecret({ title: 'Secreto de firma webhook', value: createdSecret }); reload(); }} /> : null}
    {dialog === 'domain' ? <DomainModal mode={mode} organizationId={snapshot.organization.id} close={() => setDialog(null)} saved={() => { setDialog(null); reload(); }} /> : null}
    {dialog === 'export' ? <ExportModal mode={mode} organizationId={snapshot.organization.id} close={() => setDialog(null)} saved={async (id) => { setDialog(null); await platformService.processDataExport(id).catch(() => undefined); reload(); }} /> : null}
    {dialog === 'sso' ? <SsoModal mode={mode} organizationId={snapshot.organization.id} current={snapshot.sso} close={() => setDialog(null)} saved={() => { setDialog(null); reload(); }} /> : null}
    {dialog === 'email' ? <EmailModal mode={mode} organizationId={snapshot.organization.id} current={snapshot.emailChannel} close={() => setDialog(null)} saved={() => { setDialog(null); reload(); }} /> : null}
    {dialog === 'connector' ? <ConnectorModal mode={mode} organizationId={snapshot.organization.id} close={() => setDialog(null)} saved={() => { setDialog(null); reload(); }} /> : null}
    {secret ? <SecretModal title={secret.title} value={secret.value} close={() => setSecret(null)} /> : null}
  </div>;
}

function ApiSection({ snapshot, canManage, create, revoke }: { snapshot: OrganizationIntegrationsSnapshot; canManage: boolean; create: () => void; revoke: (id: string) => Promise<void> }) {
  return <section className="card platform-panel"><header><div><h2>Credenciales de API</h2><p>Los secretos se muestran una sola vez. Asigna únicamente los alcances necesarios.</p></div>{canManage ? <button className="btn btn-primary" onClick={create}><Plus size={16} />Nueva API key</button> : null}</header>
    <div className="integration-callout"><Code2 /><div><strong>Base URL</strong><code>{String(snapshot.settings.public_api_base_url || 'https://TU-PROJECT.supabase.co/functions/v1/orkesta-public-api')}</code><small>Endpoints disponibles: GET /v1/health, GET /v1/catalogs, GET /v1/cases, GET /v1/cases/:id y POST /v1/cases.</small></div></div>
    {snapshot.apiKeys.length ? <div className="platform-table-scroll"><table><thead><tr><th>Credencial</th><th>Entorno</th><th>Alcances</th><th>Límite</th><th>Último uso</th><th>Estado</th><th /></tr></thead><tbody>{snapshot.apiKeys.map((key) => <tr key={key.id}><td><strong>{key.name}</strong><small><code>ork_{key.environment}_{key.prefix}_••••</code></small></td><td>{key.environment}</td><td><div className="integration-scope-list">{key.scopes.map((scope) => <span key={scope}>{scope}</span>)}</div></td><td>{key.rateLimitPerMinute}/min</td><td>{formatDate(key.lastUsedAt)}<small>{key.usageCount} solicitudes</small></td><td><span className={`platform-chip ${tone(key.status)}`}>{statusLabel(key.status)}</span></td><td>{canManage && key.status === 'active' ? <button className="btn btn-white compact" onClick={() => void revoke(key.id)}>Revocar</button> : null}</td></tr>)}</tbody></table></div> : <Empty icon={<KeyRound />} title="Sin credenciales" description="Crea una API key para integrar sistemas externos." />}
  </section>;
}

function WebhookSection({ snapshot, canManage, create, platform, reload, showSecret }: { snapshot: OrganizationIntegrationsSnapshot; canManage: boolean; create: () => void; platform: boolean; reload: () => void; showSecret: (value: string) => void }) {
  async function rotate(id: string) { const reason = platform ? window.prompt('Motivo de rotación:') || '' : ''; if (platform && reason.trim().length < 5) return; const value = platform ? await platformService.rotatePlatformWebhookSecret(id, reason) : await platformService.rotateOrganizationWebhookSecret(id); showSecret(value); }
  return <div className="integration-stack"><section className="card platform-panel"><header><div><h2>Endpoints webhook</h2><p>Los eventos se firman con HMAC SHA-256.</p></div>{canManage ? <button className="btn btn-primary" onClick={create}><Plus size={16} />Nuevo endpoint</button> : null}</header>{snapshot.webhooks.length ? <div className="integration-card-grid">{snapshot.webhooks.map((webhook) => <article className="integration-card" key={webhook.id}><header><span className={`platform-chip ${tone(webhook.status)}`}>{statusLabel(webhook.status)}</span><Webhook /></header><h3>{webhook.name}</h3><code>{webhook.endpointUrl}</code><div className="integration-scope-list">{webhook.events.slice(0, 6).map((event) => <span key={event}>{event}</span>)}</div><dl><div><dt>Último éxito</dt><dd>{formatDate(webhook.lastSuccessAt)}</dd></div><div><dt>Fallos consecutivos</dt><dd>{webhook.consecutiveFailures}</dd></div></dl>{canManage ? <footer><button className="btn btn-white compact" onClick={() => void platformService.testIntegrationWebhook(webhook.id).then(reload)}><TestTube2 size={14} />Probar</button><button className="btn btn-white compact" onClick={() => void rotate(webhook.id)}><RotateCcw size={14} />Rotar secreto</button></footer> : null}</article>)}</div> : <Empty icon={<Webhook />} title="Sin webhooks" description="Registra un endpoint HTTPS para recibir eventos." />}</section>
    <section className="card platform-panel"><header><div><h2>Últimas entregas</h2><p>Historial de intentos, respuestas y errores.</p></div><Send /></header>{snapshot.deliveries.length ? <div className="platform-table-scroll"><table><thead><tr><th>Evento</th><th>Estado</th><th>Intentos</th><th>HTTP</th><th>Error</th><th>Fecha</th><th /></tr></thead><tbody>{snapshot.deliveries.map((delivery) => <tr key={delivery.id}><td><code>{delivery.eventType}</code><small>{delivery.eventId}</small></td><td><span className={`platform-chip ${tone(delivery.status)}`}>{statusLabel(delivery.status)}</span></td><td>{delivery.attempts}/{delivery.maxAttempts}</td><td>{delivery.responseStatus || '—'}</td><td className="integration-error-cell">{delivery.lastError || '—'}</td><td>{formatDate(delivery.createdAt)}</td><td>{canManage && platform && ['failed','dead_letter'].includes(delivery.status) ? <button className="btn btn-white compact" onClick={() => { const reason = window.prompt('Motivo del reintento:') || ''; if (reason.trim().length >= 5) void platformService.requeueWebhookDelivery(delivery.id, reason).then(reload); }}><RotateCcw size={14} />Reintentar</button> : null}</td></tr>)}</tbody></table></div> : <Empty title="Sin entregas" description="Los eventos aparecerán cuando haya actividad." />}</section></div>;
}

function DomainsSection({ rows, canManage, create, verify }: { rows: IntegrationDomain[]; canManage: boolean; create: () => void; verify: (id: string) => Promise<void> }) {
  return <section className="card platform-panel"><header><div><h2>Dominios personalizados</h2><p>Verifica propiedad mediante TXT. La activación final de DNS/TLS en Render se realiza después de la verificación.</p></div>{canManage ? <button className="btn btn-primary" onClick={create}><Plus size={16} />Registrar dominio</button> : null}</header>{rows.length ? <div className="integration-card-grid">{rows.map((domain) => <article className="integration-card" key={domain.id}><header><span className={`platform-chip ${tone(domain.status)}`}>{statusLabel(domain.status)}</span><Globe2 /></header><h3>{domain.domain}</h3><small>{domain.domainType} {domain.isPrimary ? '· principal' : ''}</small><div className="integration-dns"><span>TXT</span><code>{domain.verificationRecordName}</code><code>{domain.verificationToken}</code>{domain.expectedCname ? <><span>CNAME</span><code>{domain.expectedCname}</code></> : null}</div>{domain.errorMessage ? <div className="alert warning">{domain.errorMessage}</div> : null}{canManage ? <footer><button className="btn btn-white compact" onClick={() => void verify(domain.id)}><RefreshCw size={14} />Verificar DNS</button></footer> : null}</article>)}</div> : <Empty icon={<Globe2 />} title="Sin dominios" description="Registra el dominio que usará la organización." />}</section>;
}

function IdentitySection({ snapshot, canManage, editSso, editEmail, addConnector }: { snapshot: OrganizationIntegrationsSnapshot; canManage: boolean; editSso: () => void; editEmail: () => void; addConnector: () => void }) {
  const sso = snapshot.sso || {};
  const email = snapshot.emailChannel || {};
  return <div className="integration-stack"><section className="platform-commercial-grid"><article className="card platform-panel"><header><div><h2>SSO empresarial</h2><p>Metadatos OIDC/SAML y política por dominios.</p></div><ShieldCheck /></header><dl className="commercial-definition"><div><dt>Modo</dt><dd>{String(sso.mode || 'disabled')}</dd></div><div><dt>Estado</dt><dd><span className={`platform-chip ${tone(String(sso.status || 'not_configured'))}`}>{statusLabel(String(sso.status || 'not_configured'))}</span></dd></div><div><dt>Proveedor</dt><dd>{String(sso.provider_name || '—')}</dd></div><div><dt>Dominios</dt><dd>{Array.isArray(sso.email_domains) ? sso.email_domains.join(', ') : '—'}</dd></div></dl>{canManage ? <button className="btn btn-white" onClick={editSso}><ServerCog size={16} />Configurar SSO</button> : null}<div className="alert info">La activación real del proveedor debe completarse también en Supabase Auth/SSO según el plan contratado.</div></article><article className="card platform-panel"><header><div><h2>Canal de correo</h2><p>Remitente, reply-to y proveedor externo.</p></div><Mail /></header><dl className="commercial-definition"><div><dt>Modo</dt><dd>{String(email.mode || 'platform')}</dd></div><div><dt>Remitente</dt><dd>{String(email.from_name || email.fromName || 'Orkesta')}</dd></div><div><dt>Correo</dt><dd>{String(email.from_email || email.fromEmail || '—')}</dd></div><div><dt>Estado</dt><dd>{statusLabel(String(email.status || 'active'))}</dd></div></dl>{canManage ? <button className="btn btn-white" onClick={editEmail}><Save size={16} />Configurar correo</button> : null}</article></section><section className="card platform-panel"><header><div><h2>Conectores documentales</h2><p>Registro de integraciones con Drive, SharePoint, OneDrive, Dropbox o un proveedor personalizado.</p></div>{canManage ? <button className="btn btn-primary" onClick={addConnector}><Plus size={16} />Agregar conector</button> : null}</header>{snapshot.connectors.length ? <div className="integration-card-grid">{snapshot.connectors.map((connector) => <article className="integration-card" key={String(connector.id)}><header><span className={`platform-chip ${tone(String(connector.status || 'draft'))}`}>{statusLabel(String(connector.status || 'draft'))}</span><Cloud /></header><h3>{String(connector.name || connector.provider)}</h3><small>{String(connector.provider)}</small><pre className="platform-json">{JSON.stringify(connector.configuration || {}, null, 2)}</pre></article>)}</div> : <Empty icon={<Cloud />} title="Sin conectores" description="Registra una integración documental para iniciar su configuración." />}</section></div>;
}

function ExportsSection({ rows, canManage, create, process, download }: { rows: OrganizationDataExport[]; canManage: boolean; create: () => void; process: (id: string) => Promise<void>; download: (id: string) => Promise<void> }) {
  return <section className="card platform-panel"><header><div><h2>Exportaciones de datos</h2><p>Genera paquetes lógicos sin contraseñas, tokens ni secretos de proveedores.</p></div>{canManage ? <button className="btn btn-primary" onClick={create}><Plus size={16} />Nueva exportación</button> : null}</header>{rows.length ? <div className="platform-table-scroll"><table><thead><tr><th>Alcance</th><th>Formato</th><th>Estado</th><th>Tamaño</th><th>Vencimiento</th><th>Error</th><th /></tr></thead><tbody>{rows.map((item) => <tr key={item.id}><td><strong>{item.scope}</strong><small>{item.reason}</small></td><td>{item.format}</td><td><span className={`platform-chip ${tone(item.status)}`}>{statusLabel(item.status)}</span></td><td>{formatBytes(item.sizeBytes)}</td><td>{formatDate(item.expiresAt)}</td><td className="integration-error-cell">{item.errorMessage || '—'}</td><td><div className="phase2-actions">{canManage && ['queued','failed'].includes(item.status) ? <button className="btn btn-white compact" onClick={() => void process(item.id)}><RefreshCw size={14} />Procesar</button> : null}{item.status === 'completed' ? <button className="btn btn-primary compact" onClick={() => void download(item.id)}><Download size={14} />Descargar</button> : null}</div></td></tr>)}</tbody></table></div> : <Empty icon={<FileArchive />} title="Sin exportaciones" description="Solicita una exportación completa o parcial." />}</section>;
}

function ApiKeyModal({ mode, organizationId, close, saved }: { mode: Mode; organizationId: string; close: () => void; saved: (secret: CreatedIntegrationSecret) => void }) {
  const [name, setName] = useState('Integración principal');
  const [environment, setEnvironment] = useState<'test' | 'live'>('live');
  const [scopes, setScopes] = useState<string[]>(['cases.read', 'catalogs.read']);
  const [rate, setRate] = useState(120);
  const [expiresAt, setExpiresAt] = useState('');
  const [reason, setReason] = useState('Creación de credencial para integración autorizada');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const allScopes = ['cases.read', 'cases.write', 'catalogs.read'];
  async function submit(event: FormEvent) { event.preventDefault(); if (!scopes.length) return setError('Selecciona al menos un alcance.'); setSaving(true); setError(''); try { const created = mode === 'platform' ? await platformService.createPlatformApiKey({ organizationId, name, environment, scopes, rateLimit: rate, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null, reason }) : await platformService.createOrganizationApiKey({ name, environment, scopes, rateLimit: rate, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null }); saved(created); } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible crear la credencial.'); } finally { setSaving(false); } }
  return <Modal title="Nueva API key" subtitle="El valor completo se mostrará una sola vez." close={close}><form onSubmit={submit} className="integration-form"><div className="platform-form-grid"><label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label>Entorno<select value={environment} onChange={(event) => setEnvironment(event.target.value as 'test' | 'live')}><option value="test">Pruebas</option><option value="live">Producción</option></select></label><label>Límite por minuto<input type="number" min={1} max={10000} value={rate} onChange={(event) => setRate(Number(event.target.value))} /></label><label>Vence en<input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></label></div><fieldset><legend>Alcances</legend><div className="integration-checkbox-grid">{allScopes.map((scope) => <label key={scope}><input type="checkbox" checked={scopes.includes(scope)} onChange={(event) => setScopes((current) => event.target.checked ? [...current, scope] : current.filter((item) => item !== scope))} />{scope}</label>)}</div></fieldset>{mode === 'platform' ? <label>Justificación<textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></label> : null}{error ? <div className="alert danger">{error}</div> : null}<footer><button type="button" className="btn btn-white" onClick={close}>Cancelar</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Creando...' : 'Crear credencial'}</button></footer></form></Modal>;
}

function WebhookModal({ mode, organizationId, catalog, close, saved }: { mode: Mode; organizationId: string; catalog: OrganizationIntegrationsSnapshot['eventCatalog']; close: () => void; saved: (secret: string | null) => void }) {
  const [name, setName] = useState('Eventos de casos'); const [url, setUrl] = useState('https://'); const [events, setEvents] = useState<string[]>(['case.created']); const [reason, setReason] = useState('Configuración de endpoint autorizado'); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setError(''); try { const payload = { name, endpointUrl: url, events, status: 'active', maxAttempts: 8, timeoutMs: 15000, customHeaders: {} }; const result = mode === 'platform' ? await platformService.upsertPlatformWebhook(organizationId, payload, reason) : await platformService.upsertOrganizationWebhook(payload); saved(result.signingSecret ? String(result.signingSecret) : null); } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible guardar el webhook.'); } finally { setSaving(false); } }
  return <Modal title="Nuevo webhook" subtitle="Solo se permiten URLs HTTPS públicas." close={close}><form onSubmit={submit} className="integration-form"><label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label>Endpoint HTTPS<input type="url" value={url} onChange={(event) => setUrl(event.target.value)} required /></label><fieldset><legend>Eventos</legend><div className="integration-checkbox-grid">{catalog.map((item) => <label key={item.code}><input type="checkbox" checked={events.includes(item.code)} onChange={(event) => setEvents((current) => event.target.checked ? [...current, item.code] : current.filter((code) => code !== item.code))} /><span><strong>{item.name}</strong><small>{item.code}</small></span></label>)}</div></fieldset>{mode === 'platform' ? <label>Justificación<textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></label> : null}{error ? <div className="alert danger">{error}</div> : null}<footer><button type="button" className="btn btn-white" onClick={close}>Cancelar</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Crear webhook'}</button></footer></form></Modal>;
}

function DomainModal({ mode, organizationId, close, saved }: { mode: Mode; organizationId: string; close: () => void; saved: () => void }) {
  const [domain, setDomain] = useState(''); const [type, setType] = useState('app'); const [primary, setPrimary] = useState(true); const [reason, setReason] = useState('Registro de dominio autorizado por la organización'); const [saving, setSaving] = useState(false); const [result, setResult] = useState<Record<string, unknown> | null>(null); const [error, setError] = useState('');
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setError(''); try { const created = mode === 'platform' ? await platformService.registerPlatformDomain({ organizationId, domain, domainType: type, primary, reason }) : await platformService.registerOrganizationDomain({ domain, domainType: type, primary }); setResult(created); } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible registrar el dominio.'); } finally { setSaving(false); } }
  return <Modal title="Registrar dominio" subtitle="Después agrega el TXT mostrado en tu proveedor DNS." close={close}>{result ? <div className="integration-secret-panel"><CheckCircle2 /><h3>Dominio registrado</h3><p>Crea este registro TXT:</p><label>Nombre<code>{String(result.recordName)}</code></label><label>Valor<code>{String(result.recordValue)}</code></label>{result.expectedCname ? <label>CNAME esperado<code>{String(result.expectedCname)}</code></label> : null}<button className="btn btn-primary" onClick={saved}>Entendido</button></div> : <form onSubmit={submit} className="integration-form"><div className="platform-form-grid"><label>Dominio<input placeholder="app.empresa.com" value={domain} onChange={(event) => setDomain(event.target.value)} required /></label><label>Uso<select value={type} onChange={(event) => setType(event.target.value)}><option value="app">Aplicación</option><option value="public_form">Formulario público</option><option value="api">API</option></select></label></div><label className="commercial-check"><input type="checkbox" checked={primary} onChange={(event) => setPrimary(event.target.checked)} />Dominio principal para este uso</label>{mode === 'platform' ? <label>Justificación<textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></label> : null}{error ? <div className="alert danger">{error}</div> : null}<footer><button type="button" className="btn btn-white" onClick={close}>Cancelar</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Registrando...' : 'Registrar'}</button></footer></form>}</Modal>;
}

function ExportModal({ mode, organizationId, close, saved }: { mode: Mode; organizationId: string; close: () => void; saved: (id: string) => void }) {
  const [scope, setScope] = useState('full'); const [format, setFormat] = useState('json_gzip'); const [reason, setReason] = useState('Exportación solicitada para conservación y portabilidad de datos'); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setError(''); try { const result = mode === 'platform' ? await platformService.requestPlatformDataExport({ organizationId, scope, format, reason }) : await platformService.requestOrganizationDataExport({ scope, format, reason }); saved(String(result.id)); } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible solicitar la exportación.'); } finally { setSaving(false); } }
  return <Modal title="Nueva exportación" subtitle="Los archivos quedan en almacenamiento privado y expiran automáticamente." close={close}><form onSubmit={submit} className="integration-form"><div className="platform-form-grid"><label>Alcance<select value={scope} onChange={(event) => setScope(event.target.value)}><option value="full">Completa</option><option value="cases">Casos</option><option value="documents">Documentos</option><option value="configuration">Configuración</option><option value="audit">Auditoría</option></select></label><label>Formato<select value={format} onChange={(event) => setFormat(event.target.value)}><option value="json_gzip">JSON comprimido</option></select></label></div><label>Motivo<textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></label>{error ? <div className="alert danger">{error}</div> : null}<footer><button type="button" className="btn btn-white" onClick={close}>Cancelar</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Solicitando...' : 'Solicitar exportación'}</button></footer></form></Modal>;
}

function SsoModal({ mode, organizationId, current, close, saved }: { mode: Mode; organizationId: string; current: Record<string, unknown> | null; close: () => void; saved: () => void }) {
  const [providerName, setProvider] = useState(String(current?.provider_name || 'Microsoft Entra ID')); const [ssoMode, setMode] = useState(String(current?.mode || 'oidc')); const [status, setStatus] = useState(String(current?.status || 'draft')); const [domains, setDomains] = useState(Array.isArray(current?.email_domains) ? (current?.email_domains as string[]).join(', ') : ''); const [discovery, setDiscovery] = useState(String(current?.discovery_url || '')); const [metadata, setMetadata] = useState(String(current?.metadata_url || '')); const [clientId, setClientId] = useState(String(current?.client_id || '')); const [secretRef, setSecretRef] = useState(''); const [reason, setReason] = useState('Actualización de configuración de identidad empresarial'); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  async function submit(event: FormEvent) { event.preventDefault(); const payload = { mode: ssoMode, status, providerName, emailDomains: domains.split(',').map((item) => item.trim()).filter(Boolean), discoveryUrl: discovery || null, metadataUrl: metadata || null, clientId: clientId || null, secretRef: secretRef || null, attributeMapping: {}, enforceForDomains: false, allowPasswordFallback: true, notes: '' }; setSaving(true); setError(''); try { if (mode === 'platform') await platformService.upsertPlatformSso(organizationId, payload, reason); else await platformService.upsertOrganizationSso(payload); saved(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible guardar SSO.'); } finally { setSaving(false); } }
  return <Modal title="Configuración SSO" subtitle="Se registran metadatos; la activación del proveedor debe completarse en Supabase Auth." close={close}><form onSubmit={submit} className="integration-form"><div className="platform-form-grid"><label>Modo<select value={ssoMode} onChange={(event) => setMode(event.target.value)}><option value="disabled">Deshabilitado</option><option value="oidc">OIDC</option><option value="saml">SAML</option></select></label><label>Estado<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="draft">Borrador</option><option value="ready">Listo</option><option value="active">Activo</option><option value="disabled">Deshabilitado</option></select></label><label>Proveedor<input value={providerName} onChange={(event) => setProvider(event.target.value)} /></label><label>Dominios de correo<input value={domains} onChange={(event) => setDomains(event.target.value)} placeholder="empresa.com, filial.com" /></label><label>Discovery URL<input value={discovery} onChange={(event) => setDiscovery(event.target.value)} /></label><label>Metadata URL<input value={metadata} onChange={(event) => setMetadata(event.target.value)} /></label><label>Client ID<input value={clientId} onChange={(event) => setClientId(event.target.value)} /></label><label>Referencia del secreto<input value={secretRef} onChange={(event) => setSecretRef(event.target.value)} placeholder="Nombre en Vault/Secrets" /></label></div>{mode === 'platform' ? <label>Justificación<textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></label> : null}{error ? <div className="alert danger">{error}</div> : null}<footer><button type="button" className="btn btn-white" onClick={close}>Cancelar</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button></footer></form></Modal>;
}

function EmailModal({ mode, organizationId, current, close, saved }: { mode: Mode; organizationId: string; current: Record<string, unknown> | null; close: () => void; saved: () => void }) {
  const [emailMode, setMode] = useState(String(current?.mode || 'platform')); const [fromName, setFromName] = useState(String(current?.from_name || 'Orkesta')); const [fromEmail, setFromEmail] = useState(String(current?.from_email || '')); const [replyTo, setReplyTo] = useState(String(current?.reply_to_email || '')); const [webhookUrl, setWebhookUrl] = useState(String(current?.webhook_url || '')); const [provider, setProvider] = useState(String(current?.provider_name || '')); const [secretRef, setSecretRef] = useState(''); const [reason, setReason] = useState('Actualización del canal de correo organizacional'); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  async function submit(event: FormEvent) { event.preventDefault(); const payload = { mode: emailMode, status: 'active', fromName, fromEmail, replyToEmail: replyTo, webhookUrl: webhookUrl || null, providerName: provider || null, secretRef: secretRef || null, providerConfiguration: {} }; setSaving(true); setError(''); try { if (mode === 'platform') await platformService.upsertPlatformEmailChannel(organizationId, payload, reason); else await platformService.upsertOrganizationEmailChannel(payload); saved(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible guardar el canal.'); } finally { setSaving(false); } }
  return <Modal title="Canal de correo" subtitle="Las credenciales reales deben almacenarse en Secrets/Vault; aquí solo se guarda una referencia." close={close}><form onSubmit={submit} className="integration-form"><div className="platform-form-grid"><label>Modo<select value={emailMode} onChange={(event) => setMode(event.target.value)}><option value="platform">Correo de plataforma</option><option value="webhook">Webhook de correo</option><option value="external_provider">Proveedor externo</option></select></label><label>Proveedor<input value={provider} onChange={(event) => setProvider(event.target.value)} /></label><label>Nombre remitente<input value={fromName} onChange={(event) => setFromName(event.target.value)} /></label><label>Correo remitente<input type="email" value={fromEmail} onChange={(event) => setFromEmail(event.target.value)} /></label><label>Reply-to<input type="email" value={replyTo} onChange={(event) => setReplyTo(event.target.value)} /></label><label>Webhook URL<input value={webhookUrl} onChange={(event) => setWebhookUrl(event.target.value)} /></label><label>Referencia de secreto<input value={secretRef} onChange={(event) => setSecretRef(event.target.value)} /></label></div>{mode === 'platform' ? <label>Justificación<textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></label> : null}{error ? <div className="alert danger">{error}</div> : null}<footer><button type="button" className="btn btn-white" onClick={close}>Cancelar</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button></footer></form></Modal>;
}

function ConnectorModal({ mode, organizationId, close, saved }: { mode: Mode; organizationId: string; close: () => void; saved: () => void }) {
  const [provider, setProvider] = useState('google_drive'); const [name, setName] = useState('Repositorio documental'); const [secretRef, setSecretRef] = useState(''); const [configuration, setConfiguration] = useState('{\n  "rootFolder": ""\n}'); const [reason, setReason] = useState('Registro de conector documental autorizado'); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  async function submit(event: FormEvent) { event.preventDefault(); let config: Record<string, unknown>; try { config = JSON.parse(configuration); } catch { return setError('La configuración JSON no es válida.'); } const payload = { provider, name, status: 'draft', capabilities: ['documents.read','documents.write'], configuration: config, secretRef }; setSaving(true); setError(''); try { if (mode === 'platform') await platformService.upsertPlatformConnector(organizationId, payload, reason); else await platformService.upsertOrganizationConnector(payload); saved(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible guardar el conector.'); } finally { setSaving(false); } }
  return <Modal title="Nuevo conector" subtitle="Orkesta registra y audita la configuración. La autorización OAuth específica se completa con cada proveedor." close={close}><form onSubmit={submit} className="integration-form"><div className="platform-form-grid"><label>Proveedor<select value={provider} onChange={(event) => setProvider(event.target.value)}><option value="google_drive">Google Drive</option><option value="sharepoint">SharePoint</option><option value="onedrive">OneDrive</option><option value="dropbox">Dropbox</option><option value="custom">Personalizado</option></select></label><label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} /></label><label>Referencia de secreto<input value={secretRef} onChange={(event) => setSecretRef(event.target.value)} /></label></div><label>Configuración JSON<textarea rows={7} value={configuration} onChange={(event) => setConfiguration(event.target.value)} /></label>{mode === 'platform' ? <label>Justificación<textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></label> : null}{error ? <div className="alert danger">{error}</div> : null}<footer><button type="button" className="btn btn-white" onClick={close}>Cancelar</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar conector'}</button></footer></form></Modal>;
}

function SecretModal({ title, value, close }: { title: string; value: string; close: () => void }) {
  const [copied, setCopied] = useState(false);
  async function copy() { await navigator.clipboard.writeText(value); setCopied(true); }
  return <Modal title={title} subtitle="Guárdalo ahora. Orkesta no volverá a mostrar el valor completo." close={close}><div className="integration-secret-panel"><KeyRound /><code>{value}</code><button className="btn btn-primary" onClick={() => void copy()}>{copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}{copied ? 'Copiado' : 'Copiar secreto'}</button><div className="alert warning">No lo envíes por correo ni lo guardes en el código fuente.</div></div></Modal>;
}

function Modal({ title, subtitle, close, children }: { title: string; subtitle: string; close: () => void; children: ReactNode }) {
  return <div className="platform-modal-backdrop"><section className="card platform-modal commercial-modal-wide"><header><div><span className="eyebrow">Integraciones</span><h2>{title}</h2><p>{subtitle}</p></div><button type="button" onClick={close}><X /></button></header>{children}</section></div>;
}

export function PlatformKnowledgePage() {
  const { canPlatform } = usePlatformAccess();
  const [search, setSearch] = useState('');
  const { data, loading, error, reload } = useLoad<KnowledgeArticle[]>(() => platformService.listPlatformKnowledge(undefined, search), [search]);
  const [selected, setSelected] = useState<KnowledgeArticle | null>(null);
  if (loading && !data) return <Loading text="Cargando centro de conocimiento..." />;
  return <div className="platform-page"><PageHead title="Centro de conocimiento" description="Documentación global y organizacional para soporte y autoservicio." actions={<><Link className="btn btn-white" to="/help"><ExternalLink size={16} />Vista de usuario</Link>{canPlatform('platform.knowledge.manage') ? <button className="btn btn-primary" onClick={() => setSelected({ id: '', slug: '', title: '', summary: '', contentMarkdown: '', tags: [], featured: false, viewCount: 0, publishedAt: null, status: 'draft', visibility: 'authenticated' })}><Plus size={16} />Nuevo artículo</button> : null}</>} /><section className="card platform-filters"><label><Search size={17} /><input placeholder="Buscar artículos" value={search} onChange={(event) => setSearch(event.target.value)} /></label></section>{error ? <ErrorBox message={error} reload={reload} /> : null}<section className="integration-knowledge-grid">{(data || []).map((article) => <article className="card knowledge-admin-card" key={article.id}><header><span className={`platform-chip ${tone(article.status || 'draft')}`}>{statusLabel(article.status || 'draft')}</span>{article.featured ? <CircleDot /> : <BookOpen />}</header><h2>{article.title}</h2><p>{article.summary}</p><div className="integration-scope-list">{article.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><footer><small>{article.organizationName || 'Global'} · {article.viewCount} vistas</small>{canPlatform('platform.knowledge.manage') ? <button className="btn btn-white compact" onClick={() => setSelected(article)}>Editar</button> : null}</footer></article>)}</section>{selected ? <KnowledgeEditor article={selected} close={() => setSelected(null)} saved={() => { setSelected(null); reload(); }} /> : null}</div>;
}

function KnowledgeEditor({ article, close, saved }: { article: KnowledgeArticle; close: () => void; saved: () => void }) {
  const [title, setTitle] = useState(article.title); const [slug, setSlug] = useState(article.slug); const [summary, setSummary] = useState(article.summary || ''); const [content, setContent] = useState(article.contentMarkdown); const [status, setStatus] = useState(article.status || 'draft'); const [visibility, setVisibility] = useState(article.visibility || 'authenticated'); const [tags, setTags] = useState(article.tags.join(', ')); const [featured, setFeatured] = useState(article.featured); const [reason, setReason] = useState('Actualización de documentación de soporte'); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setError(''); try { await platformService.upsertKnowledgeArticle({ id: article.id || null, organizationId: article.organizationId || null, categoryId: article.categoryId || null, title, slug, summary, contentMarkdown: content, status, visibility, tags: tags.split(',').map((item) => item.trim()).filter(Boolean), featured }, reason); saved(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'No fue posible guardar el artículo.'); } finally { setSaving(false); } }
  return <Modal title={article.id ? 'Editar artículo' : 'Nuevo artículo'} subtitle="El contenido admite Markdown básico." close={close}><form onSubmit={submit} className="integration-form"><div className="platform-form-grid"><label>Título<input value={title} onChange={(event) => setTitle(event.target.value)} required /></label><label>Slug<input value={slug} onChange={(event) => setSlug(event.target.value)} required /></label><label>Estado<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="draft">Borrador</option><option value="published">Publicado</option><option value="archived">Archivado</option></select></label><label>Visibilidad<select value={visibility} onChange={(event) => setVisibility(event.target.value)}><option value="public">Público</option><option value="authenticated">Usuarios autenticados</option><option value="organization">Organización</option><option value="platform_only">Solo plataforma</option></select></label></div><label>Resumen<textarea rows={2} value={summary} onChange={(event) => setSummary(event.target.value)} /></label><label>Contenido Markdown<textarea rows={14} value={content} onChange={(event) => setContent(event.target.value)} /></label><label>Etiquetas<input value={tags} onChange={(event) => setTags(event.target.value)} /></label><label className="commercial-check"><input type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)} />Artículo destacado</label><label>Justificación<textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} /></label>{error ? <div className="alert danger">{error}</div> : null}<footer><button type="button" className="btn btn-white" onClick={close}>Cancelar</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar artículo'}</button></footer></form></Modal>;
}

export function KnowledgeCenterPage() {
  const [search, setSearch] = useState('');
  const { data, loading, error, reload } = useLoad<KnowledgeArticle[]>(() => platformService.listKnowledge(search || undefined), [search]);
  const categories = useMemo(() => [...new Set((data || []).map((item) => item.categoryCode).filter(Boolean))], [data]);
  if (loading && !data) return <main className="page"><Loading text="Cargando ayuda..." /></main>;
  return <div className="page"><PageHead platform={false} title="Centro de ayuda" description="Guías para operar, configurar e integrar Orkesta." actions={<Link className="btn btn-white" to="/support">Enviar ticket</Link>} /><section className="knowledge-search card"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar en la documentación" /></section>{error ? <ErrorBox message={error} reload={reload} /> : null}{categories.length ? <div className="knowledge-category-strip">{categories.map((category) => <span key={category}>{category}</span>)}</div> : null}<section className="knowledge-user-grid">{(data || []).map((article) => <Link className="card knowledge-user-card" to={`/help/${article.slug}`} key={article.id}><header>{article.featured ? <CircleDot /> : <BookOpen />}<span>{article.category || 'Ayuda'}</span></header><h2>{article.title}</h2><p>{article.summary}</p><footer><span>{article.tags.slice(0, 3).join(' · ')}</span><ChevronRight /></footer></Link>)}</section>{!data?.length ? <Empty icon={<BookOpen />} title="Sin resultados" description="No encontramos artículos con ese criterio." /> : null}</div>;
}

export function KnowledgeArticlePage() {
  const { slug = '' } = useParams();
  const { data, loading, error, reload } = useLoad<KnowledgeArticle>(() => platformService.getKnowledgeArticle(slug), [slug]);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  if (loading && !data) return <main className="page"><Loading text="Abriendo artículo..." /></main>;
  if (error && !data) return <main className="page"><ErrorBox message={error} reload={reload} /></main>;
  const article = data!;
  return <div className="page knowledge-article-page"><div className="knowledge-breadcrumb"><Link to="/help">Centro de ayuda</Link><ChevronRight /><span>{article.category || 'Artículo'}</span></div><article className="card knowledge-article"><header><span className="eyebrow">{article.category || 'Orkesta'}</span><h1>{article.title}</h1><p>{article.summary}</p><small>Publicado {formatDate(article.publishedAt, false)} · {article.viewCount} vistas</small></header><Markdown content={article.contentMarkdown} /><footer><strong>¿Este artículo fue útil?</strong><div><button className={`btn btn-white ${feedback === 'up' ? 'active' : ''}`} onClick={() => { setFeedback('up'); void platformService.sendKnowledgeFeedback(article.id, true); }}><ThumbsUp size={16} />Sí</button><button className={`btn btn-white ${feedback === 'down' ? 'active' : ''}`} onClick={() => { setFeedback('down'); void platformService.sendKnowledgeFeedback(article.id, false); }}><ThumbsDown size={16} />No</button></div></footer></article></div>;
}

function Markdown({ content }: { content: string }) {
  const lines = content.split('\n');
  const nodes: ReactNode[] = [];
  let code: string[] = [];
  let inCode = false;
  lines.forEach((line, index) => {
    if (line.trim().startsWith('```')) { if (inCode) { nodes.push(<pre key={`code-${index}`}><code>{code.join('\n')}</code></pre>); code = []; } inCode = !inCode; return; }
    if (inCode) { code.push(line); return; }
    if (line.startsWith('# ')) nodes.push(<h2 key={index}>{line.slice(2)}</h2>);
    else if (line.startsWith('## ')) nodes.push(<h3 key={index}>{line.slice(3)}</h3>);
    else if (line.startsWith('- ')) nodes.push(<li key={index}>{line.slice(2)}</li>);
    else if (!line.trim()) nodes.push(<br key={index} />);
    else nodes.push(<p key={index}>{line}</p>);
  });
  return <div className="knowledge-markdown">{nodes}</div>;
}
