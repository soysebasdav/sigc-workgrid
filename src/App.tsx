import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom';
import { AppProvider } from './app/AppProvider';
import { AdminRoute } from './app/AdminRoute';
import { AgendaPage } from './features/agenda/AgendaPage';
import { NotificationsPage } from './features/notifications/NotificationsPage';
import { ProfilePage } from './features/profile/ProfilePage';
import { SettingsPage } from './features/settings/SettingsPage';
import { UsersPage } from './features/users/UsersPage';
import { ClientObservability, SigcErrorBoundary } from './features/sigc/components/SaasRuntime';
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

const router = createBrowserRouter([
  { path: '/login', element: <SigcLoginPage /> },
  { path: '/radicar', element: <PublicFormPage /> },
  { path: '/invite/:token', element: <LazyRoute><InvitationPage /></LazyRoute> },
  { path: '/public-form', element: <Navigate to="/radicar" replace /> },
  {
    path: '/',
    element: <SigcShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <LazyRoute><AnalyticsDashboardPage /></LazyRoute> },
      { path: 'cases', element: <CasesPage /> },
      { path: 'cases/:caseId', element: <CaseDetailPage /> },
      { path: 'case-detail', element: <Navigate to="/cases/SIG-2026-000003" replace /> },
      { path: 'manual-case', element: <ManualCasePage /> },
      { path: 'board', element: <BoardPage /> },
      { path: 'subtasks', element: <SubtasksPage /> },
      { path: 'tasks', element: <Navigate to="/subtasks" replace /> },
      { path: 'agenda', element: <AgendaPage /> },
      { path: 'documents', element: <DocumentsPage /> },
      { path: 'reports', element: <LazyRoute><AnalyticsReportsPage /></LazyRoute> },
      { path: 'workspace', element: <LazyRoute><SaasManagementPage /></LazyRoute> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'settings', element: <SettingsPage /> },
      {
        element: <AdminRoute />,
        children: [
          { path: 'users', element: <UsersPage /> }
        ]
      },
      { path: 'admin', element: <LazyRoute><AdminConfigurationPage /></LazyRoute> }
    ]
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> }
]);

export default function App() {
  return (
    <SigcErrorBoundary>
      <AppProvider>
        <ClientObservability />
        <RouterProvider router={router} />
      </AppProvider>
    </SigcErrorBoundary>
  );
}
