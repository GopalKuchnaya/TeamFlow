import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { errorBody, mockApi, noSession, page, sessionBody } from '@/test/mock-api';
import { renderApp } from '@/test/render';

async function fillForm(user: ReturnType<typeof renderApp>['user'], overrides: { confirm?: string } = {}) {
  await user.type(await screen.findByLabelText(/full name/i), 'Ada Lovelace');
  await user.type(screen.getByLabelText(/^email/i), 'ada@example.com');
  await user.type(screen.getByLabelText(/^password/i), 'correct-horse-1');
  await user.type(screen.getByLabelText(/confirm password/i), overrides.confirm ?? 'correct-horse-1');
}

describe('RegisterPage', () => {
  it('requires matching passwords', async () => {
    const { calls } = mockApi({ 'POST /auth/refresh': noSession });
    const { user } = renderApp('/register');

    await fillForm(user, { confirm: 'something-else-1' });
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    expect(calls.some((call) => call.path === '/auth/register')).toBe(false);
  });

  it('maps a duplicate-email error onto the email field', async () => {
    mockApi({
      'POST /auth/refresh': noSession,
      'POST /auth/register': {
        status: 409,
        body: errorBody('EMAIL_TAKEN', 'An account with this email already exists', [
          { path: 'email', message: 'An account with this email already exists' },
        ]),
      },
    });
    const { user } = renderApp('/register');

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    const message = await screen.findByText('An account with this email already exists');
    expect(message).toBeInTheDocument();
    expect(screen.getByLabelText(/^email/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('creates the account, never sends confirmPassword, and enters the app', async () => {
    const { calls } = mockApi({
      'POST /auth/refresh': noSession,
      'POST /auth/register': { status: 201, body: sessionBody },
      'GET /workspaces': { status: 200, body: page([]) },
    });
    const { user, router } = renderApp('/register');

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    // A brand-new user has no workspaces, so they land on the workspace selection page.
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/workspaces');
    });
    expect(await screen.findByText('No workspaces yet')).toBeInTheDocument();
    expect(calls.find((call) => call.path === '/auth/register')?.body).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'correct-horse-1',
    });
  });
});
