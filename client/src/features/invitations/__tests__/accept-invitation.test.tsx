import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { errorBody, mockApi, noSession, page, sessionBody, workspaceFixture } from '@/test/mock-api';
import { renderApp } from '@/test/render';

const TOKEN = 'tok_abcdefghijklmnopqrstuvwxyz0123456789ABCD';
const preview = {
  workspaceName: 'Acme',
  email: 'ada@example.com',
  role: 'admin',
  invitedByName: 'Grace',
  expiresAt: '2026-01-22T10:00:00.000Z',
  status: 'pending',
};

describe('AcceptInvitationPage', () => {
  it('asks signed-out visitors to sign in, then returns them to the invite', async () => {
    const { calls } = mockApi({
      'POST /auth/refresh': noSession,
      'POST /invitations/preview': { status: 200, body: { invitation: preview } },
      'POST /auth/login': { status: 200, body: sessionBody },
    });
    const { user, router } = renderApp(`/invite/${TOKEN}`);

    expect(await screen.findByText('Grace invited you to join Acme.')).toBeInTheDocument();
    expect(calls.find((call) => call.path === '/invitations/preview')?.body).toEqual({ token: TOKEN });

    await user.click(await screen.findByRole('link', { name: 'Sign in to accept' }));
    await waitFor(() => { expect(router.state.location.pathname).toBe('/login'); });
    await user.type(screen.getByLabelText(/email/i), 'ada@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'correct-horse-1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => { expect(router.state.location.pathname).toBe(`/invite/${TOKEN}`); });
    expect(await screen.findByRole('button', { name: 'Accept invitation' })).toBeInTheDocument();
  });

  it('accepts and opens the workspace', async () => {
    const workspace = workspaceFixture({ role: 'admin' });
    const { calls } = mockApi({
      'POST /auth/refresh': { status: 200, body: sessionBody },
      'POST /invitations/preview': { status: 200, body: { invitation: preview } },
      'POST /invitations/accept': { status: 200, body: { workspace } },
      'GET /workspaces': { status: 200, body: page([workspace]) },
      [`GET /workspaces/${workspace.id}/members`]: { status: 200, body: page([]) },
      [`GET /workspaces/${workspace.id}/invitations`]: { status: 200, body: page([]) },
    });
    const { user, router } = renderApp(`/invite/${TOKEN}`);

    await user.click(await screen.findByRole('button', { name: 'Accept invitation' }));
    await waitFor(() => { expect(router.state.location.pathname).toBe(`/w/${workspace.id}`); });
    const accept = calls.find((call) => call.path === '/invitations/accept');
    expect(accept?.body).toEqual({ token: TOKEN });
    expect(accept?.headers.authorization).toBe('Bearer access-token-1');
  });

  it('warns when signed in with a different email', async () => {
    mockApi({
      'POST /auth/refresh': { status: 200, body: sessionBody },
      'POST /invitations/preview': { status: 200, body: { invitation: { ...preview, email: 'other@example.com' } } },
    });
    renderApp(`/invite/${TOKEN}`);
    expect(await screen.findByRole('button', { name: 'Sign out and switch account' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept invitation' })).not.toBeInTheDocument();
  });

  it('shows server errors from accepting, e.g. expiry since the page loaded', async () => {
    mockApi({
      'POST /auth/refresh': { status: 200, body: sessionBody },
      'POST /invitations/preview': { status: 200, body: { invitation: preview } },
      'POST /invitations/accept': {
        status: 410,
        body: errorBody('INVITATION_EXPIRED', 'This invitation has expired. Ask for a new one.'),
      },
    });
    const { user } = renderApp(`/invite/${TOKEN}`);
    await user.click(await screen.findByRole('button', { name: 'Accept invitation' }));
    expect(await screen.findByText('This invitation has expired. Ask for a new one.')).toBeInTheDocument();
  });

  it('explains expired and used invitations without offering to accept', async () => {
    mockApi({
      'POST /auth/refresh': { status: 200, body: sessionBody },
      'POST /invitations/preview': { status: 200, body: { invitation: { ...preview, status: 'expired' } } },
    });
    renderApp(`/invite/${TOKEN}`);
    expect(await screen.findByText('This invitation has expired. Ask for a new link.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept invitation' })).not.toBeInTheDocument();
  });

  it('handles invalid or revoked links', async () => {
    mockApi({
      'POST /auth/refresh': noSession,
      'POST /invitations/preview': {
        status: 404,
        body: errorBody('INVITATION_NOT_FOUND', 'This invitation is invalid or has been revoked'),
      },
    });
    renderApp(`/invite/${TOKEN}`);
    expect(await screen.findByText(/This invitation link is invalid or has been revoked/)).toBeInTheDocument();
  });
});
