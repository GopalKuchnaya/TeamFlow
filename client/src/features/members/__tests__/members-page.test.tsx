import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { errorBody, memberFixture, mockApi, page, sessionBody, workspaceFixture } from '@/test/mock-api';
import { renderApp } from '@/test/render';

const owner = memberFixture();
const admin = memberFixture({ userId: '65f000000000000000000002', name: 'Grace Admin', email: 'grace@example.com', role: 'admin' });
const member = memberFixture({ userId: '65f000000000000000000003', name: 'Linus Member', email: 'linus@example.com', role: 'member' });

function setup(role: 'owner' | 'admin' | 'member', extra: Parameters<typeof mockApi>[0] = {}) {
  const workspace = workspaceFixture({ role });
  const self = { ...owner, role };
  const api = mockApi({
    'POST /auth/refresh': { status: 200, body: sessionBody },
    'GET /workspaces': { status: 200, body: page([workspace]) },
    [`GET /workspaces/${workspace.id}`]: { status: 200, body: { workspace } },
    [`GET /workspaces/${workspace.id}/members`]: { status: 200, body: page([self, admin, member]) },
    [`GET /workspaces/${workspace.id}/invitations`]: { status: 200, body: page([]) },
    ...extra,
  });
  return { ...api, workspace, ...renderApp(`/w/${workspace.id}/members`) };
}

describe('MembersPage', () => {
  it('gives the owner invites, role changes, and removal', async () => {
    setup('owner');
    const list = await screen.findByRole('list', { name: 'Members' });
    expect(screen.getByRole('form', { name: 'Invite a teammate' })).toBeInTheDocument();
    expect(within(list).getByRole('combobox', { name: 'Role for Grace Admin' })).toBeInTheDocument();
    expect(within(list).getByRole('combobox', { name: 'Role for Linus Member' })).toBeInTheDocument();
    expect(within(list).getAllByRole('button', { name: 'Remove' })).toHaveLength(2);
    // The owner's own row is never editable.
    expect(within(list).queryByRole('combobox', { name: 'Role for Ada Lovelace' })).not.toBeInTheDocument();
  });

  it('lets admins invite and remove members only, without changing roles', async () => {
    setup('admin');
    const list = await screen.findByRole('list', { name: 'Members' });
    expect(screen.getByRole('form', { name: 'Invite a teammate' })).toBeInTheDocument();
    expect(within(list).queryAllByRole('combobox')).toHaveLength(0);
    expect(within(list).getAllByRole('button', { name: 'Remove' })).toHaveLength(1);
    // Admins can only invite members.
    const roleSelect = screen.getByRole('combobox', { name: 'Role' });
    expect(within(roleSelect).getAllByRole('option').map((o) => o.textContent)).toEqual(['Member']);
  });

  it('shows members a read-only list', async () => {
    setup('member');
    const list = await screen.findByRole('list', { name: 'Members' });
    expect(screen.queryByRole('form', { name: 'Invite a teammate' })).not.toBeInTheDocument();
    expect(within(list).queryAllByRole('button', { name: 'Remove' })).toHaveLength(0);
    expect(within(list).queryAllByRole('combobox')).toHaveLength(0);
  });

  it('creates an invitation and shows the one-time link', async () => {
    const workspace = workspaceFixture();
    const { user, calls } = setup('owner', {
      [`POST /workspaces/${workspace.id}/invitations`]: {
        status: 201,
        body: {
          token: 'tok_abcdefghijklmnopqrstuvwxyz0123456789ABCD',
          invitation: {
            id: 'inv1',
            email: 'new@example.com',
            role: 'admin',
            invitedBy: { id: owner.userId, name: owner.name },
            expiresAt: '2026-01-22T10:00:00.000Z',
            createdAt: '2026-01-15T10:00:00.000Z',
          },
        },
      },
    });

    await user.type(await screen.findByLabelText(/email address/i), 'new@example.com');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Role' }), 'admin');
    await user.click(screen.getByRole('button', { name: 'Create invite' }));

    expect(await screen.findByText('Invitation created for new@example.com')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Invite link' })).toHaveValue(
      `${window.location.origin}/invite/tok_abcdefghijklmnopqrstuvwxyz0123456789ABCD`,
    );
    expect(calls.find((call) => call.method === 'POST' && call.path.endsWith('/invitations'))?.body).toEqual({
      email: 'new@example.com',
      role: 'admin',
    });
  });

  it('shows the server reason when inviting an existing member', async () => {
    const workspace = workspaceFixture();
    const { user } = setup('owner', {
      [`POST /workspaces/${workspace.id}/invitations`]: {
        status: 409,
        body: errorBody('ALREADY_MEMBER', 'This person is already a member of the workspace'),
      },
    });
    await user.type(await screen.findByLabelText(/email address/i), 'linus@example.com');
    await user.click(screen.getByRole('button', { name: 'Create invite' }));
    expect(await screen.findByText('This person is already a member of the workspace')).toBeInTheDocument();
  });

  it('changes a role and surfaces permission errors from the server', async () => {
    const workspace = workspaceFixture();
    const { user, calls } = setup('owner', {
      [`PATCH /workspaces/${workspace.id}/members/${member.userId}`]: {
        status: 403,
        body: errorBody('FORBIDDEN', 'You do not have permission to perform this action'),
      },
    });
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Role for Linus Member' }), 'admin');

    expect(await screen.findByText('Could not change role')).toBeInTheDocument();
    expect(screen.getByText('You do not have permission to perform this action')).toBeInTheDocument();
    expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({ role: 'admin' });
  });

  it('confirms before removing a member', async () => {
    const workspace = workspaceFixture();
    const { user, calls } = setup('owner', {
      [`DELETE /workspaces/${workspace.id}/members/${member.userId}`]: { status: 204 },
    });
    const list = await screen.findByRole('list', { name: 'Members' });
    const row = within(list).getByText('Linus Member').closest('li');
    if (!row) throw new Error('row not found');
    await user.click(within(row).getByRole('button', { name: 'Remove' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(calls.some((call) => call.method === 'DELETE')).toBe(false);
    await user.click(within(dialog).getByRole('button', { name: 'Remove member' }));
    await waitFor(() => { expect(calls.some((call) => call.method === 'DELETE')).toBe(true); });
  });
});
