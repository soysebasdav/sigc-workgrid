import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, RouterProvider, createBrowserRouter, isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { AppProvider } from './app/AppProvider';
import { PermissionRoute } from './app/PermissionRoute';
import { AuthorizationProvider, useAuthorization } from './features/authz/AuthorizationProvider';
import { PlatformAccessProvider, usePlatformAccess } from './features/platform/PlatformAccessProvider';
import { PlatformAdminRoute } from './features/platform/PlatformAdminRoute';
import { PlatformAdminShell, PlatformAuditPage, PlatformBackupsPage, PlatformDashboardPage, PlatformOrganizationDetailPage, PlatformOrganizationsPage, PlatformOperationsPage, PlatformTicketsPage, PlatformUsersPage } from './features/platform/PlatformAdminPages';
import { SupportPage } from './features/support/SupportPage';
import {
  OrganizationBillingPortalPage,
  PlatformBillingPage,
  PlatformCommercialDashboardPage,
  PlatformOnboardingPage,
  PlatformPlansPage
} from './features/platform/Phase31CommercialPages';
import {
  KnowledgeArticlePage,
  KnowledgeCenterPage,
  OrganizationIntegrationsPage,
  PlatformIntegrationsPage,
  PlatformKnowledgePage,
  PlatformOrganizationIntegrationsPage
} from './features/platform/Phase32IntegrationPages';
import {
  OrganizationPrivacyPage,
  OrganizationRegionalPage,
  PlatformCapacityPage,
  PlatformGovernancePage,
  PlatformIncidentsPage,
  PlatformPrivacyPage,
  PlatformReliabilityPage,
  PublicStatusPage
} from './features/platform/Phase33ReliabilityPages';
import {
  PlatformExplorerPage,
  PlatformRecoveryPage,
  PlatformSchedulerPage,
  PlatformSecurityTeamPage,
  PlatformSupportAccessPage,
  PlatformUsageControlPage
} from './features/platform/Phase2PlatformPages';
import { CASE_READ_PERMISSIONS, PERMISSIONS } from './features/authz/permissions';
import { AgendaPage } from './features/agenda/AgendaPage';
import { AuditPage } from './features/audit/AuditPage';
import { NotificationsPage } from './features/notifications/NotificationsPage';
import { ProfilePage } from './features/profile/ProfilePage';
import { SettingsPage } from './features/settings/SettingsPage';
import { UsersPage } from './features/users/UsersPage';
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
  { path: '/status', element: <PublicStatusPage /> },
  { path: '/public-form', element: <Navigate to="/radicar" replace /> },
  {
    element: <PlatformAdminRoute />,
    children: [
      {
        element: <PlatformAdminShell />,
        children: [
          { path: 'superadmin', element: <PlatformDashboardPage /> },
          { path: 'superadmin/organizations', element: <PlatformOrganizationsPage /> },
          { path: 'superadmin/organizations/:organizationId', element: <PlatformOrganizationDetailPage /> },
          { path: 'superadmin/commercial', element: <PlatformCommercialDashboardPage /> },
          { path: 'superadmin/plans', element: <PlatformPlansPage /> },
          { path: 'superadmin/billing', element: <PlatformBillingPage /> },
          { path: 'superadmin/onboarding', element: <PlatformOnboardingPage /> },
          { path: 'superadmin/integrations', element: <PlatformIntegrationsPage /> },
          { path: 'superadmin/integrations/:organizationId', element: <PlatformOrganizationIntegrationsPage /> },
          { path: 'superadmin/knowledge', element: <PlatformKnowledgePage /> },
          { path: 'superadmin/reliability', element: <PlatformReliabilityPage /> },
          { path: 'superadmin/incidents', element: <PlatformIncidentsPage /> },
          { path: 'superadmin/privacy', element: <PlatformPrivacyPage /> },
          { path: 'superadmin/governance', element: <PlatformGovernancePage /> },
          { path: 'superadmin/capacity', element: <PlatformCapacityPage /> },
          { path: 'superadmin/users', element: <PlatformUsersPage /> },
          { path: 'superadmin/tickets', element: <PlatformTicketsPage /> },
          { path: 'superadmin/backups', element: <PlatformBackupsPage /> },
          { path: 'superadmin/recovery', element: <PlatformRecoveryPage /> },
          { path: 'superadmin/access', element: <PlatformSupportAccessPage /> },
          { path: 'superadmin/usage', element: <PlatformUsageControlPage /> },
          { path: 'superadmin/explorer', element: <PlatformExplorerPage /> },
          { path: 'superadmin/security', element: <PlatformSecurityTeamPage /> },
          { path: 'superadmin/audit', element: <PlatformAuditPage /> },
          { path: 'superadmin/operations', element: <PlatformOperationsPage /> },
          { path: 'superadmin/scheduler', element: <PlatformSchedulerPage /> }
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
          { path: 'agenda', element: <AgendaPage /> },
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
        children: [{ path: 'audit', element: <AuditPage /> }]
      },
      {
        element: <PermissionRoute allOf={[PERMISSIONS.qualityView]} />,
        children: [{ path: 'quality', element: <LazyRoute><QualityCenterPage /></LazyRoute> }]
      },

      {
        element: <PermissionRoute allOf={[PERMISSIONS.saasManageWorkspace]} />,
        children: [
          { path: 'workspace', element: <LazyRoute><SaasManagementPage /></LazyRoute> },
          { path: 'subscription', element: <OrganizationBillingPortalPage /> }
        ]
      },
      {
        element: <PermissionRoute allOf={[PERMISSIONS.integrationsView]} />,
        children: [{ path: 'integrations', element: <OrganizationIntegrationsPage /> }]
      },
      { path: 'help', element: <KnowledgeCenterPage /> },
      {
        element: <PermissionRoute allOf={[PERMISSIONS.privacyView]} />,
        children: [{ path: 'privacy', element: <OrganizationPrivacyPage /> }]
      },
      {
        element: <PermissionRoute allOf={[PERMISSIONS.regionalView]} />,
        children: [{ path: 'regional', element: <OrganizationRegionalPage /> }]
      },
      { path: 'help/:slug', element: <KnowledgeArticlePage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'support', element: <SupportPage /> },
      { path: 'profile', element: <ProfilePage /> },
      {
        element: <PermissionRoute allOf={[PERMISSIONS.adminManageUsers]} />,
        children: [{ path: 'users', element: <UsersPage /> }]
      },
      {
        element: <PermissionRoute allOf={[PERMISSIONS.adminManageConfiguration]} />,
        children: [{ path: 'settings', element: <SettingsPage /> }]
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
