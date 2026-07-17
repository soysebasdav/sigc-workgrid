import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, RouterProvider, createBrowserRouter, isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { AppProvider } from './app/AppProvider';
import { PermissionRoute } from './app/PermissionRoute';
import { AuthorizationProvider, useAuthorization } from './features/authz/AuthorizationProvider';
import { PlatformAccessProvider, usePlatformAccess } from './features/platform/PlatformAccessProvider';
import { PlatformAdminRoute } from './features/platform/PlatformAdminRoute';
import { CASE_READ_PERMISSIONS, PERMISSIONS } from './features/authz/permissions';
import { ClientObservability, SigcErrorBoundary } from './features/sigc/components/SaasRuntime';
import { ClientPortalPage, ForgotPasswordPage, ResetPasswordPage } from './features/sigc/components/Phase1011Product';
import {
  BoardPage,
  CaseDetailPage,
  CasesPage,
  DocumentsPage,
  ManualCasePage,
  PublicFormPage,
  SigcLoginPage,
  SigcShell,
  SubtasksPage
} from './features/sigc/pages';

const AnalyticsDashboardPage = lazy(() => import('./features/sigc/components/Phase78Analytics').then((module) => ({ default: module.AnalyticsDashboardPage })));
const AnalyticsReportsPage = lazy(() => import('./features/sigc/components/Phase78Analytics').then((module) => ({ default: module.AnalyticsReportsPage })));
const AdminConfigurationPage = lazy(() => import('./features/sigc/components/Phase56Admin').then((module) => ({ default: module.AdminConfigurationPage })));
const SaasManagementPage = lazy(() => import('./features/sigc/components/Phase8Saas').then((module) => ({ default: module.SaasManagementPage })));
const InvitationPage = lazy(() => import('./features/sigc/components/Phase8Saas').then((module) => ({ default: module.InvitationPage })));
const QualityCenterPage = lazy(() => import('./features/quality/QualityCenterPage').then((module) => ({ default: module.QualityCenterPage })));
const OrkestaHomePage = lazy(() => import('./features/home/OrkestaHomePage').then((module) => ({ default: module.OrkestaHomePage })));

const PlatformAdminShell = lazy(() => import('./features/platform/PlatformAdminPages').then((module) => ({ default: module.PlatformAdminShell })));
const PlatformDashboardPage = lazy(() => import('./features/platform/PlatformAdminPages').then((module) => ({ default: module.PlatformDashboardPage })));
const PlatformOrganizationsPage = lazy(() => import('./features/platform/PlatformAdminPages').then((module) => ({ default: module.PlatformOrganizationsPage })));
const PlatformOrganizationDetailPage = lazy(() => import('./features/platform/PlatformAdminPages').then((module) => ({ default: module.PlatformOrganizationDetailPage })));
const PlatformUsersPage = lazy(() => import('./features/platform/PlatformAdminPages').then((module) => ({ default: module.PlatformUsersPage })));
const PlatformTicketsPage = lazy(() => import('./features/platform/PlatformAdminPages').then((module) => ({ default: module.PlatformTicketsPage })));
const PlatformBackupsPage = lazy(() => import('./features/platform/PlatformAdminPages').then((module) => ({ default: module.PlatformBackupsPage })));
const PlatformAuditPage = lazy(() => import('./features/platform/PlatformAdminPages').then((module) => ({ default: module.PlatformAuditPage })));
const PlatformOperationsPage = lazy(() => import('./features/platform/PlatformAdminPages').then((module) => ({ default: module.PlatformOperationsPage })));

const PlatformCommercialDashboardPage = lazy(() => import('./features/platform/Phase31CommercialPages').then((module) => ({ default: module.PlatformCommercialDashboardPage })));
const PlatformPlansPage = lazy(() => import('./features/platform/Phase31CommercialPages').then((module) => ({ default: module.PlatformPlansPage })));
const PlatformBillingPage = lazy(() => import('./features/platform/Phase31CommercialPages').then((module) => ({ default: module.PlatformBillingPage })));
const PlatformOnboardingPage = lazy(() => import('./features/platform/Phase31CommercialPages').then((module) => ({ default: module.PlatformOnboardingPage })));
const OrganizationBillingPortalPage = lazy(() => import('./features/platform/Phase31CommercialPages').then((module) => ({ default: module.OrganizationBillingPortalPage })));

const PlatformIntegrationsPage = lazy(() => import('./features/platform/Phase32IntegrationPages').then((module) => ({ default: module.PlatformIntegrationsPage })));
const PlatformOrganizationIntegrationsPage = lazy(() => import('./features/platform/Phase32IntegrationPages').then((module) => ({ default: module.PlatformOrganizationIntegrationsPage })));
const PlatformKnowledgePage = lazy(() => import('./features/platform/Phase32IntegrationPages').then((module) => ({ default: module.PlatformKnowledgePage })));
const OrganizationIntegrationsPage = lazy(() => import('./features/platform/Phase32IntegrationPages').then((module) => ({ default: module.OrganizationIntegrationsPage })));
const KnowledgeCenterPage = lazy(() => import('./features/platform/Phase32IntegrationPages').then((module) => ({ default: module.KnowledgeCenterPage })));
const KnowledgeArticlePage = lazy(() => import('./features/platform/Phase32IntegrationPages').then((module) => ({ default: module.KnowledgeArticlePage })));

const PublicStatusPage = lazy(() => import('./features/platform/Phase33ReliabilityPages').then((module) => ({ default: module.PublicStatusPage })));
const PlatformReliabilityPage = lazy(() => import('./features/platform/Phase33ReliabilityPages').then((module) => ({ default: module.PlatformReliabilityPage })));
const PlatformIncidentsPage = lazy(() => import('./features/platform/Phase33ReliabilityPages').then((module) => ({ default: module.PlatformIncidentsPage })));
const PlatformPrivacyPage = lazy(() => import('./features/platform/Phase33ReliabilityPages').then((module) => ({ default: module.PlatformPrivacyPage })));
const PlatformGovernancePage = lazy(() => import('./features/platform/Phase33ReliabilityPages').then((module) => ({ default: module.PlatformGovernancePage })));
const PlatformCapacityPage = lazy(() => import('./features/platform/Phase33ReliabilityPages').then((module) => ({ default: module.PlatformCapacityPage })));
const OrganizationPrivacyPage = lazy(() => import('./features/platform/Phase33ReliabilityPages').then((module) => ({ default: module.OrganizationPrivacyPage })));
const OrganizationRegionalPage = lazy(() => import('./features/platform/Phase33ReliabilityPages').then((module) => ({ default: module.OrganizationRegionalPage })));

const PlatformRecoveryPage = lazy(() => import('./features/platform/Phase2PlatformPages').then((module) => ({ default: module.PlatformRecoveryPage })));
const PlatformSupportAccessPage = lazy(() => import('./features/platform/Phase2PlatformPages').then((module) => ({ default: module.PlatformSupportAccessPage })));
const PlatformUsageControlPage = lazy(() => import('./features/platform/Phase2PlatformPages').then((module) => ({ default: module.PlatformUsageControlPage })));
const PlatformExplorerPage = lazy(() => import('./features/platform/Phase2PlatformPages').then((module) => ({ default: module.PlatformExplorerPage })));
const PlatformSecurityTeamPage = lazy(() => import('./features/platform/Phase2PlatformPages').then((module) => ({ default: module.PlatformSecurityTeamPage })));
const PlatformSchedulerPage = lazy(() => import('./features/platform/Phase2PlatformPages').then((module) => ({ default: module.PlatformSchedulerPage })));

const AgendaPage = lazy(() => import('./features/agenda/AgendaPage').then((module) => ({ default: module.AgendaPage })));
const AuditPage = lazy(() => import('./features/audit/AuditPage').then((module) => ({ default: module.AuditPage })));
const NotificationsPage = lazy(() => import('./features/notifications/NotificationsPage').then((module) => ({ default: module.NotificationsPage })));
const ProfilePage = lazy(() => import('./features/profile/ProfilePage').then((module) => ({ default: module.ProfilePage })));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const UsersPage = lazy(() => import('./features/users/UsersPage').then((module) => ({ default: module.UsersPage })));
const SupportPage = lazy(() => import('./features/support/SupportPage').then((module) => ({ default: module.SupportPage })));

function LazyRoute({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<main className="login-workgrid"><section className="login-card card"><strong>Cargando módulo...</strong></section></main>}>
      {children}
    </Suspense>
  );
}

function RouteErrorFallback() {
  const routeError = useRouteError();
  const message = isRouteErrorResponse(routeError)
    ? `${routeError.status} · ${routeError.statusText || 'No fue posible abrir esta vista.'}`
    : routeError instanceof Error
      ? routeError.message
      : 'Ocurrió un error inesperado al abrir este módulo.';

  return (
    <main className="route-error-page">
      <section className="card route-error-card">
        <span className="route-error-icon">!</span>
        <span className="eyebrow">SIGC · Recuperación de vista</span>
        <h1>No pudimos abrir este módulo</h1>
        <p>{message}</p>
        <div className="route-error-actions">
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Recargar página</button>
          <a className="btn btn-white" href="/">Volver al inicio</a>
        </div>
        <small>El error quedó aislado para evitar mostrar la pantalla técnica de React Router.</small>
      </section>
    </main>
  );
}

function HomeRedirect() {
  const { isLoading, can, canAny } = useAuthorization();
  const { isPlatformAdmin, isLoading: platformLoading } = usePlatformAccess();
  if (isLoading || platformLoading) return <main className="login-workgrid"><section className="login-card card"><strong>Resolviendo acceso...</strong></section></main>;
  if (isPlatformAdmin) return <Navigate to="/superadmin" replace />;
  if (can(PERMISSIONS.clientPortal)) return <Navigate to="/portal" replace />;
  if (can(PERMISSIONS.reportsView)) return <Navigate to="/dashboard" replace />;
  if (canAny(CASE_READ_PERMISSIONS)) return <Navigate to="/cases" replace />;
  if (can(PERMISSIONS.caseCreate)) return <Navigate to="/manual-case" replace />;
  if (can(PERMISSIONS.saasManageWorkspace)) return <Navigate to="/workspace" replace />;
  if (can(PERMISSIONS.adminManageUsers)) return <Navigate to="/users" replace />;
  if (can(PERMISSIONS.adminManageConfiguration)) return <Navigate to="/settings" replace />;
  if (can(PERMISSIONS.qualityView)) return <Navigate to="/quality" replace />;
  return <Navigate to="/profile" replace />;
}

const router = createBrowserRouter([
  { path: '/', element: <LazyRoute><OrkestaHomePage /></LazyRoute> },
  { path: '/login', element: <SigcLoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/radicar', element: <PublicFormPage /> },
  { path: '/radicar/:tenant', element: <PublicFormPage /> },
  { path: '/casos', element: <PublicFormPage /> },
  { path: '/casos/:tenant', element: <PublicFormPage /> },
  { path: '/invite/:token', element: <LazyRoute><InvitationPage /></LazyRoute> },
  { path: '/status', element: <LazyRoute><PublicStatusPage /></LazyRoute> },
  { path: '/public-form', element: <Navigate to="/radicar" replace /> },
  {
    element: <PlatformAdminRoute />,
    children: [
      {
        element: <LazyRoute><PlatformAdminShell /></LazyRoute>,
        children: [
          { path: 'superadmin', element: <LazyRoute><PlatformDashboardPage /></LazyRoute> },
          { path: 'superadmin/organizations', element: <LazyRoute><PlatformOrganizationsPage /></LazyRoute> },
          { path: 'superadmin/organizations/:organizationId', element: <LazyRoute><PlatformOrganizationDetailPage /></LazyRoute> },
          { path: 'superadmin/commercial', element: <LazyRoute><PlatformCommercialDashboardPage /></LazyRoute> },
          { path: 'superadmin/plans', element: <LazyRoute><PlatformPlansPage /></LazyRoute> },
          { path: 'superadmin/billing', element: <LazyRoute><PlatformBillingPage /></LazyRoute> },
          { path: 'superadmin/onboarding', element: <LazyRoute><PlatformOnboardingPage /></LazyRoute> },
          { path: 'superadmin/integrations', element: <LazyRoute><PlatformIntegrationsPage /></LazyRoute> },
          { path: 'superadmin/integrations/:organizationId', element: <LazyRoute><PlatformOrganizationIntegrationsPage /></LazyRoute> },
          { path: 'superadmin/knowledge', element: <LazyRoute><PlatformKnowledgePage /></LazyRoute> },
          { path: 'superadmin/reliability', element: <LazyRoute><PlatformReliabilityPage /></LazyRoute> },
          { path: 'superadmin/incidents', element: <LazyRoute><PlatformIncidentsPage /></LazyRoute> },
          { path: 'superadmin/privacy', element: <LazyRoute><PlatformPrivacyPage /></LazyRoute> },
          { path: 'superadmin/governance', element: <LazyRoute><PlatformGovernancePage /></LazyRoute> },
          { path: 'superadmin/capacity', element: <LazyRoute><PlatformCapacityPage /></LazyRoute> },
          { path: 'superadmin/users', element: <LazyRoute><PlatformUsersPage /></LazyRoute> },
          { path: 'superadmin/tickets', element: <LazyRoute><PlatformTicketsPage /></LazyRoute> },
          { path: 'superadmin/backups', element: <LazyRoute><PlatformBackupsPage /></LazyRoute> },
          { path: 'superadmin/recovery', element: <LazyRoute><PlatformRecoveryPage /></LazyRoute> },
          { path: 'superadmin/access', element: <LazyRoute><PlatformSupportAccessPage /></LazyRoute> },
          { path: 'superadmin/usage', element: <LazyRoute><PlatformUsageControlPage /></LazyRoute> },
          { path: 'superadmin/explorer', element: <LazyRoute><PlatformExplorerPage /></LazyRoute> },
          { path: 'superadmin/security', element: <LazyRoute><PlatformSecurityTeamPage /></LazyRoute> },
          { path: 'superadmin/audit', element: <LazyRoute><PlatformAuditPage /></LazyRoute> },
          { path: 'superadmin/operations', element: <LazyRoute><PlatformOperationsPage /></LazyRoute> },
          { path: 'superadmin/scheduler', element: <LazyRoute><PlatformSchedulerPage /></LazyRoute> }
        ]
      }
    ]
  },
  {
    element: <SigcShell />,
    errorElement: <RouteErrorFallback />,
    children: [
      { path: 'app', element: <HomeRedirect /> },
      {
        element: <PermissionRoute anyOf={[PERMISSIONS.reportsView]} />,
        children: [{ path: 'dashboard', element: <LazyRoute><AnalyticsDashboardPage /></LazyRoute> }]
      },
      {
        element: <PermissionRoute allOf={[PERMISSIONS.clientPortal]} />,
        children: [{ path: 'portal', element: <ClientPortalPage /> }]
      },
      {
        element: <PermissionRoute anyOf={CASE_READ_PERMISSIONS} />,
        children: [
          { path: 'cases', element: <CasesPage /> },
          { path: 'cases/:caseId', element: <CaseDetailPage /> },
          { path: 'case-detail', element: <Navigate to="/cases/SIG-2026-000003" replace /> },
          { path: 'board', element: <BoardPage /> },
          { path: 'subtasks', element: <SubtasksPage /> },
          { path: 'agenda', element: <LazyRoute><AgendaPage /></LazyRoute> },
          { path: 'documents', element: <DocumentsPage /> }
        ]
      },
      {
        element: <PermissionRoute allOf={[PERMISSIONS.caseCreate]} />,
        children: [{ path: 'manual-case', element: <ManualCasePage /> }]
      },
      {
        element: <PermissionRoute allOf={[PERMISSIONS.reportsView]} />,
        children: [{ path: 'reports', element: <LazyRoute><AnalyticsReportsPage /></LazyRoute> }]
      },
      {
        element: <PermissionRoute allOf={[PERMISSIONS.auditView]} />,
        children: [{ path: 'audit', element: <LazyRoute><AuditPage /></LazyRoute> }]
      },
      {
        element: <PermissionRoute allOf={[PERMISSIONS.qualityView]} />,
        children: [{ path: 'quality', element: <LazyRoute><QualityCenterPage /></LazyRoute> }]
      },

      {
        element: <PermissionRoute allOf={[PERMISSIONS.saasManageWorkspace]} />,
        children: [
          { path: 'workspace', element: <LazyRoute><SaasManagementPage /></LazyRoute> },
          { path: 'subscription', element: <LazyRoute><OrganizationBillingPortalPage /></LazyRoute> }
        ]
      },
      {
        element: <PermissionRoute allOf={[PERMISSIONS.integrationsView]} />,
        children: [{ path: 'integrations', element: <LazyRoute><OrganizationIntegrationsPage /></LazyRoute> }]
      },
      { path: 'help', element: <LazyRoute><KnowledgeCenterPage /></LazyRoute> },
      {
        element: <PermissionRoute allOf={[PERMISSIONS.privacyView]} />,
        children: [{ path: 'privacy', element: <LazyRoute><OrganizationPrivacyPage /></LazyRoute> }]
      },
      {
        element: <PermissionRoute allOf={[PERMISSIONS.regionalView]} />,
        children: [{ path: 'regional', element: <LazyRoute><OrganizationRegionalPage /></LazyRoute> }]
      },
      { path: 'help/:slug', element: <LazyRoute><KnowledgeArticlePage /></LazyRoute> },
      { path: 'notifications', element: <LazyRoute><NotificationsPage /></LazyRoute> },
      { path: 'support', element: <LazyRoute><SupportPage /></LazyRoute> },
      { path: 'profile', element: <LazyRoute><ProfilePage /></LazyRoute> },
      {
        element: <PermissionRoute allOf={[PERMISSIONS.adminManageUsers]} />,
        children: [{ path: 'users', element: <LazyRoute><UsersPage /></LazyRoute> }]
      },
      {
        element: <PermissionRoute allOf={[PERMISSIONS.adminManageConfiguration]} />,
        children: [{ path: 'settings', element: <LazyRoute><SettingsPage /></LazyRoute> }]
      },
      {
        element: <PermissionRoute anyOf={[PERMISSIONS.adminManageConfiguration, PERMISSIONS.automationView, PERMISSIONS.automationManage]} />,
        children: [{ path: 'admin', element: <LazyRoute><AdminConfigurationPage /></LazyRoute> }]
      }
    ]
  },
  { path: '*', element: <Navigate to="/" replace /> }
]);

export default function App() {
  return (
    <SigcErrorBoundary>
      <AppProvider>
        <PlatformAccessProvider>
          <AuthorizationProvider>
            <ClientObservability />
            <RouterProvider router={router} />
          </AuthorizationProvider>
        </PlatformAccessProvider>
      </AppProvider>
    </SigcErrorBoundary>
  );
}
