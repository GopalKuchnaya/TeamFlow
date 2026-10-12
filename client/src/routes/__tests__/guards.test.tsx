import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { safeRedirectTarget } from '@/routes/guards';
import { mockApi, noSession, sessionBody } from '@/test/mock-api';
import { renderApp } from '@/test/render';

describe('route guards', () => {
  it('redirects unauthenticated visitors to /login', async () => {
    mockApi({ 'POST /auth/refresh': noSession });
    const { router } = renderApp('/');
    await waitFor(() => { expect(router.state.location.pathname).toBe('/login'); });
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  it('restores the session from the refresh cookie on load (reload keeps you signed in)', async () => {
    const { calls } = mockApi({ 'POST /auth/refresh': { status: 200, body: sessionBody } });
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Welcome, Ada' })).toBeInTheDocument();
    const refresh = calls.find((call) => call.path === '/auth/refresh');
    expect(refresh?.headers['x-requested-with']).toBe('teamflow');
  });

  it('signs out from the user menu, revoking the server session, without crashing the shell', async () => {
    const { calls } = mockApi({
      'POST /auth/refresh': { status: 200, body: sessionBody },
      'POST /auth/logout': { status: 204 },
    });
    const { user, router } = renderApp('/');

    await user.click(await screen.findByRole('button', { name: /account menu/i }));
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }));

    await waitFor(() => { expect(router.state.location.pathname).toBe('/login'); });
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    const logout = calls.find((call) => call.path === '/auth/logout');
    expect(logout?.headers['x-requested-with']).toBe('teamflow');
  });

  it('sends signed-in users away from the login page', async () => {
    mockApi({ 'POST /auth/refresh': { status: 200, body: sessionBody } });
    const { router } = renderApp('/login');
    await waitFor(() => { expect(router.state.location.pathname).toBe('/'); });
  });

  it('shows a retryable error when the server is unreachable', async () => {
    mockApi({ 'POST /auth/refresh': { status: 503, body: { error: { code: 'X', message: 'Service unavailable' } } } });
    renderApp('/');
    expect(await screen.findByText("We couldn't reach TeamFlow")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('renders the not-found page for unknown routes', async () => {
    mockApi({ 'POST /auth/refresh': noSession });
    renderApp('/nope');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('only allows relative in-app redirect targets', () => {
    expect(safeRedirectTarget({ from: '/account' })).toBe('/account');
    expect(safeRedirectTarget({ from: '//evil.example' })).toBe('/');
    expect(safeRedirectTarget({ from: 'https://evil.example' })).toBe('/');
    expect(safeRedirectTarget(null)).toBe('/');
  });
});
