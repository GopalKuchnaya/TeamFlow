import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { rememberWorkspace } from '@/features/workspaces/current-workspace';
import { errorBody, memberFixture, mockApi, page, sessionBody, testUser, workspaceFixture } from '@/test/mock-api';
import { renderApp } from '@/test/render';

const acme = workspaceFixture();
const globex = workspaceFixture({ id: '65f0000000000000000000bb', name: 'Globex', role: 'member' });

afterEach(() => {
  localStorage.clear();
});

describe('workspace selection', () => {
  it('sends / to the most recent workspace', async () => {
    mockApi({
      'POST /auth/refresh': { status: 200, body: sessionBody },
      'GET /workspaces': { status: 200, body: page([acme, globex]) },
      [`GET /workspaces/${acme.id}`]: { status: 200, body: { workspace: acme } },
      [`GET /workspaces/${acme.id}/members`]: { status: 200, body: page([memberFixture()]) },
      [`GET /workspaces/${acme.id}/invitations`]: { status: 200, body: page([]) },
    });
    const { router } = renderApp('/');
    await waitFor(() => { expect(router.state.location.pathname).toBe(`/w/${acme.id}`); });
    expect(await screen.findByRole('heading', { name: 'Acme', level: 1 })).toBeInTheDocument();
  });

  it('prefers the workspace last used in this browser', async () => {
    rememberWorkspace(testUser.id, globex.id);
    mockApi({
      'POST /auth/refresh': { status: 200, body: sessionBody },
      'GET /workspaces': { status: 200, body: page([acme, globex]) },
      [`GET /workspaces/${globex.id}`]: { status: 200, body: { workspace: globex } },
      [`GET /workspaces/${globex.id}/members`]: { status: 200, body: page([memberFixture()]) },
    });
    const { router } = renderApp('/');
    await waitFor(() => { expect(router.state.location.pathname).toBe(`/w/${globex.id}`); });
  });

  it('lists workspaces with the caller’s role and creates a new one', async () => {
    const created = workspaceFixture({ id: '65f0000000000000000000cc', name: 'New Team' });
    const { calls } = mockApi({
      'POST /auth/refresh': { status: 200, body: sessionBody },
      'GET /workspaces': { status: 200, body: page([acme, globex]) },
      'POST /workspaces': { status: 201, body: { workspace: created } },
      [`GET /workspaces/${created.id}/members`]: { status: 200, body: page([memberFixture()]) },
      [`GET /workspaces/${created.id}/invitations`]: { status: 200, body: page([]) },
    });
    const { user, router } = renderApp('/workspaces');

    const list = await screen.findByRole('list', { name: 'Your workspaces' });
    expect(within(list).getByRole('link', { name: 'Acme' })).toHaveAttribute('href', `/w/${acme.id}`);
    expect(within(list).getByText('Member')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Create workspace' }));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/workspace name/i), 'New Team');
    await user.click(screen.getByRole('button', { name: 'Create workspace' }));

    await waitFor(() => { expect(router.state.location.pathname).toBe(`/w/${created.id}`); });
    expect(calls.find((call) => call.method === 'POST' && call.path === '/workspaces')?.body).toEqual({
      name: 'New Team',
      description: '',
    });
  });

  it('shows a not-found state for workspaces the user cannot access', async () => {
    mockApi({
      'POST /auth/refresh': { status: 200, body: sessionBody },
      'GET /workspaces': { status: 200, body: page([acme]) },
      'GET /workspaces/65f0000000000000000000ff': {
        status: 404,
        body: errorBody('NOT_FOUND', 'Workspace not found'),
      },
    });
    renderApp('/w/65f0000000000000000000ff');
    expect(await screen.findByText('Workspace not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View your workspaces' })).toHaveAttribute('href', '/workspaces');
  });
});

describe('workspace settings', () => {
  it('lets the owner edit settings and offers transfer and delete', async () => {
    const { calls } = mockApi({
      'POST /auth/refresh': { status: 200, body: sessionBody },
      'GET /workspaces': { status: 200, body: page([acme]) },
      [`GET /workspaces/${acme.id}`]: { status: 200, body: { workspace: acme } },
      [`GET /workspaces/${acme.id}/members`]: { status: 200, body: page([memberFixture()]) },
      [`PATCH /workspaces/${acme.id}`]: {
        status: 200,
        body: { workspace: { ...acme, name: 'Acme Corp', updatedAt: '2026-02-01T00:00:00.000Z' } },
      },
    });
    const { user } = renderApp(`/w/${acme.id}/settings`);

    const name = await screen.findByLabelText(/workspace name/i);
    await user.clear(name);
    await user.type(name, 'Acme Corp');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => { expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({ name: 'Acme Corp', description: 'Product team' }); },
    );
    expect(screen.getByRole('heading', { name: 'Transfer ownership' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete workspace' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Leave workspace' })).not.toBeInTheDocument();
  });

  it('shows members read-only details and the leave action', async () => {
    mockApi({
      'POST /auth/refresh': { status: 200, body: sessionBody },
      'GET /workspaces': { status: 200, body: page([globex]) },
      [`GET /workspaces/${globex.id}`]: { status: 200, body: { workspace: globex } },
    });
    renderApp(`/w/${globex.id}/settings`);

    expect(await screen.findByText('Only the workspace owner can change these settings.')).toBeInTheDocument();
    expect(screen.queryByLabelText(/workspace name/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete workspace' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Leave workspace' })).toBeInTheDocument();
  });

  it('requires typing the workspace name before deleting', async () => {
    const { calls } = mockApi({
      'POST /auth/refresh': { status: 200, body: sessionBody },
      'GET /workspaces': { status: 200, body: page([acme]) },
      [`GET /workspaces/${acme.id}`]: { status: 200, body: { workspace: acme } },
      [`GET /workspaces/${acme.id}/members`]: { status: 200, body: page([memberFixture()]) },
      [`DELETE /workspaces/${acme.id}`]: { status: 204 },
    });
    const { user, router } = renderApp(`/w/${acme.id}/settings`);

    await user.click(await screen.findByRole('button', { name: 'Delete workspace' }));
    const dialog = await screen.findByRole('alertdialog');
    const confirm = within(dialog).getByRole('button', { name: 'Delete permanently' });
    expect(confirm).toBeDisabled();

    await user.type(within(dialog).getByRole('textbox'), 'Acme');
    await user.click(confirm);

    await waitFor(() => { expect(router.state.location.pathname).toBe('/workspaces'); });
    expect(calls.some((call) => call.method === 'DELETE' && call.path === `/workspaces/${acme.id}`)).toBe(true);
  });
});
