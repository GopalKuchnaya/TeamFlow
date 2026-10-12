import { createBrowserRouter, type RouteObject } from 'react-router';
import { AppShell } from '@/components/layout/app-shell';
import { AccountPage } from '@/features/account/account-page';
import { LoginPage } from '@/features/auth/pages/login-page';
import { RegisterPage } from '@/features/auth/pages/register-page';
import { NotFoundPage } from '@/features/errors/not-found-page';
import { RouteErrorPage } from '@/features/errors/route-error-page';
import { AcceptInvitationPage } from '@/features/invitations/accept-invitation-page';
import { MembersPage } from '@/features/members/members-page';
import { HomeRedirect } from '@/features/workspaces/pages/home-redirect';
import { WorkspaceLayout } from '@/features/workspaces/pages/workspace-layout';
import { WorkspaceOverviewPage } from '@/features/workspaces/pages/workspace-overview-page';
import { WorkspaceSettingsPage } from '@/features/workspaces/pages/workspace-settings-page';
import { WorkspacesPage } from '@/features/workspaces/pages/workspaces-page';
import { GuestOnly, RequireAuth } from '@/routes/guards';

export const routes: RouteObject[] = [
  {
    errorElement: <RouteErrorPage />,
    children: [
      {
        path: '/login',
        element: (
          <GuestOnly>
            <LoginPage />
          </GuestOnly>
        ),
      },
      {
        path: '/register',
        element: (
          <GuestOnly>
            <RegisterPage />
          </GuestOnly>
        ),
      },
      // Reachable signed in or out: the page explains what to do in each case.
      { path: '/invite/:token', element: <AcceptInvitationPage /> },
      {
        path: '/',
        element: (
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        ),
        children: [
          { index: true, element: <HomeRedirect /> },
          { path: 'workspaces', element: <WorkspacesPage /> },
          {
            path: 'w/:workspaceId',
            element: <WorkspaceLayout />,
            children: [
              { index: true, element: <WorkspaceOverviewPage /> },
              { path: 'members', element: <MembersPage /> },
              { path: 'settings', element: <WorkspaceSettingsPage /> },
            ],
          },
          { path: 'account', element: <AccountPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
