import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom';
import { AppProvider } from './app/AppProvider';
import { PermissionRoute } from './app/PermissionRoute';
import { AuthorizationProvider, useAuthorization } from './features/authz/AuthorizationProvider';
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

function LazyRoute({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<main className="login-workgrid"><section className="login-card card"><strong>Cargando módulo...</strong></section></main>}>
      {children}
    </Suspense>
  );
}

function HomeRedirect() {
  const { isLoading, can, canAny } = useAuthorization();
  if (isLoading) return <main className="login-workgrid"><section className="login-card card"><strong>Resolviendo acceso...</strong></section></main>;
  if (can(PERMISSIONS.clientPortal)) return <Navigate to="/portal" replace />;
  if (can(PERMISSIONS.reportsView)) return <Navigate to="/dashboard" replace />;
  if (canAny(CASE_READ_PERMISSIONS)) return <Navigate to="/cases" replace />;
  if (can(PERMISSIONS.caseCreate)) return <Navigate to="/manual-case" replace />;
  if (can(PERMISSIONS.saasManageWorkspace)) return <Navigate to="/workspace" replace />;
  if (can(PERMISSIONS.adminManageUsers)) return <Navigate to="/users" replace />;
  if (can(PERMISSIONS.adminManageConfiguration)) return <Navigate to="/settings" replace />;
  return <Navigate to="/profile" replace />;
}

const router = createBrowserRouter([
  { path: '/login', element: <SigcLoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/radicar', element: <PublicFormPage /> },
  { path: '/radicar/:tenant', element: <PublicFormPage /> },
  { path: '/casos', element: <PublicFormPage /> },
  { path: '/casos/:tenant', element: <PublicFormPage /> },
  { path: '/invite/:token', element: <LazyRoute><InvitationPage /></LazyRoute> },
  { path: '/public-form', element: <Navigate to="/radicar" replace /> },
  {
    path: '/',
    element: <SigcShell />,
    children: [
      { index: true, element: <HomeRedirect /> },
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
        element: <PermissionRoute allOf={[PERMISSIONS.saasManageWorkspace]} />,
        children: [{ path: 'workspace', element: <LazyRoute><SaasManagementPage /></LazyRoute> }]
      },
      { path: 'notifications', element: <NotificationsPage /> },
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
        <AuthorizationProvider>
          <ClientObservability />
          <RouterProvider router={router} />
        </AuthorizationProvider>
      </AppProvider>
    </SigcErrorBoundary>
  );
}
