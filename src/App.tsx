import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom';
import { AppProvider } from './app/AppProvider';
import { AdminRoute } from './app/AdminRoute';
import { AgendaPage } from './features/agenda/AgendaPage';
import { NotificationsPage } from './features/notifications/NotificationsPage';
import { ProfilePage } from './features/profile/ProfilePage';
import { SettingsPage } from './features/settings/SettingsPage';
import { UsersPage } from './features/users/UsersPage';
import {
  AdminPage,
  BoardPage,
  CaseDetailPage,
  CasesPage,
  DashboardPage,
  DocumentsPage,
  ManualCasePage,
  PublicFormPage,
  ReportsPage,
  SigcLoginPage,
  SigcShell,
  SubtasksPage
} from './features/sigc/pages';

const router = createBrowserRouter([
  { path: '/login', element: <SigcLoginPage /> },
  { path: '/radicar', element: <PublicFormPage /> },
  { path: '/public-form', element: <Navigate to="/radicar" replace /> },
  {
    path: '/',
    element: <SigcShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'cases', element: <CasesPage /> },
      { path: 'cases/:caseId', element: <CaseDetailPage /> },
      { path: 'case-detail', element: <Navigate to="/cases/SIG-2026-000003" replace /> },
      { path: 'manual-case', element: <ManualCasePage /> },
      { path: 'board', element: <BoardPage /> },
      { path: 'subtasks', element: <SubtasksPage /> },
      { path: 'tasks', element: <Navigate to="/subtasks" replace /> },
      { path: 'agenda', element: <AgendaPage /> },
      { path: 'documents', element: <DocumentsPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'settings', element: <SettingsPage /> },
      {
        element: <AdminRoute />,
        children: [
          { path: 'users', element: <UsersPage /> }
        ]
      },
      { path: 'admin', element: <AdminPage /> }
    ]
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> }
]);

export default function App() {
  return (
    <AppProvider>
      <RouterProvider router={router} />
    </AppProvider>
  );
}
