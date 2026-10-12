import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { errorBody, mockApi, noSession, sessionBody } from '@/test/mock-api';
import { renderApp } from '@/test/render';

describe('LoginPage', () => {
  it('validates fields before calling the API', async () => {
    const { calls } = mockApi({ 'POST /auth/refresh': noSession });
    const { user } = renderApp('/login');

    await user.click(await screen.findByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(calls.filter((call) => call.path === '/auth/login')).toHaveLength(0);
  });

  it('shows the safe server message for invalid credentials', async () => {
    mockApi({
      'POST /auth/refresh': noSession,
      'POST /auth/login': { status: 401, body: errorBody('INVALID_CREDENTIALS', 'Invalid email or password') },
    });
    const { user } = renderApp('/login');

    await user.type(await screen.findByLabelText(/email/i), 'ada@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'wrong-password-1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
  });

  it('signs in and returns the user to the page they originally requested', async () => {
    const { calls } = mockApi({
      'POST /auth/refresh': noSession,
      'POST /auth/login': { status: 200, body: sessionBody },
      'GET /auth/me': { status: 200, body: { user: sessionBody.user } },
    });
    const { user, router } = renderApp('/account');

    // Unauthenticated visit to a protected page redirects to login.
    await waitFor(() => { expect(router.state.location.pathname).toBe('/login'); });

    await user.type(await screen.findByLabelText(/email/i), 'ada@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'correct-horse-1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => { expect(router.state.location.pathname).toBe('/account'); });
    expect(await screen.findByRole('heading', { name: 'Account settings' })).toBeInTheDocument();
    const login = calls.find((call) => call.path === '/auth/login');
    expect(login?.body).toEqual({ email: 'ada@example.com', password: 'correct-horse-1' });

    // The protected API call carries the in-memory access token.
    await waitFor(() => { expect(calls.find((call) => call.path === '/auth/me')?.headers.authorization).toBe('Bearer access-token-1'); },
    );
  });
});
