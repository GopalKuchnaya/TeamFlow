import { Avatar, Box, Button, Flex, HStack, NativeSelect, Stack, Text } from '@chakra-ui/react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/dialogs/confirm-dialog';
import { notifyError, notifySuccess } from '@/components/feedback/notify';
import { ErrorState, LoadingState } from '@/components/feedback/states';
import { PaginationControls } from '@/components/pagination-controls';
import { useCurrentUser } from '@/features/auth/api';
import { RoleBadge } from '@/features/workspaces/components/role-badge';
import { ROLE_LABELS, canRemoveMember, permissions } from '@/features/workspaces/permissions';
import { WORKSPACE_ROLES, type Member, type Workspace, type WorkspaceRole } from '@/types/api';
import { useMembers, useRemoveMember, useUpdateMemberRole } from '../api';

const PAGE_SIZE = 20;
const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

export function MemberList({ workspace }: { workspace: Workspace }) {
  const user = useCurrentUser();
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState<WorkspaceRole | undefined>(undefined);
  const members = useMembers(workspace.id, { page, limit: PAGE_SIZE, role: roleFilter });
  const updateRole = useUpdateMemberRole(workspace.id);
  const removeMember = useRemoveMember(workspace.id);
  const [pendingRemoval, setPendingRemoval] = useState<Member | null>(null);

  const changeRole = (member: Member, role: 'admin' | 'member') => {
    updateRole.mutate(
      { userId: member.userId, role },
      {
        onSuccess: () => { notifySuccess(`${member.name} is now ${ROLE_LABELS[role].toLowerCase()}`); },
        onError: (error) => { notifyError('Could not change role', error); },
      },
    );
  };

  const confirmRemoval = () => {
    if (!pendingRemoval) return;
    const member = pendingRemoval;
    removeMember.mutate(member.userId, {
      onSuccess: () => { notifySuccess(`${member.name} was removed from ${workspace.name}`); },
      onError: (error) => { notifyError('Could not remove member', error); },
      onSettled: () => { setPendingRemoval(null); },
    });
  };

  return (
    <Box>
      <HStack justify="flex-end" mb="3">
        <NativeSelect.Root size="sm" w="44">
          <NativeSelect.Field
            aria-label="Filter by role"
            value={roleFilter ?? ''}
            onChange={(event) => {
              const value = WORKSPACE_ROLES.find((role) => role === event.currentTarget.value);
              setRoleFilter(value);
              setPage(1);
            }}
          >
            <option value="">All roles</option>
            {WORKSPACE_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}s
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </HStack>

      {members.isPending ? (
        <LoadingState label="Loading members…" />
      ) : members.isError ? (
        <ErrorState message={members.error.message} onRetry={() => void members.refetch()} />
      ) : members.data.items.length === 0 ? (
        <Text color="fg.muted" fontSize="sm">
          No members match this filter.
        </Text>
      ) : (
        <>
          <Stack as="ul" listStyleType="none" gap="0" borderWidth="1px" borderRadius="lg" divideY="1px" aria-label="Members">
            {members.data.items.map((member) => {
              const isSelf = member.userId === user.id;
              const editable = permissions.changeRoles(workspace.role) && !isSelf && member.role !== 'owner';
              const removable = !isSelf && canRemoveMember(workspace.role, member.role, false);
              return (
                <Flex as="li" key={member.userId} align="center" gap="3" px="4" py="3" wrap="wrap">
                  <HStack gap="3" flex="1" minW="56">
                    <Avatar.Root size="sm" colorPalette="brand">
                      <Avatar.Fallback name={member.name} />
                      {member.avatarUrl ? <Avatar.Image src={member.avatarUrl} alt="" /> : null}
                    </Avatar.Root>
                    <Box minW="0">
                      <Text fontWeight="medium" truncate>
                        {member.name}
                        {isSelf ? (
                          <Text as="span" color="fg.muted" fontWeight="normal">
                            {' '}
                            (you)
                          </Text>
                        ) : null}
                      </Text>
                      <Text fontSize="sm" color="fg.muted" truncate>
                        {member.email}
                      </Text>
                    </Box>
                  </HStack>
                  <Text fontSize="sm" color="fg.muted" display={{ base: 'none', md: 'block' }} minW="28">
                    Joined {dateFormatter.format(new Date(member.joinedAt))}
                  </Text>
                  {editable ? (
                    <NativeSelect.Root size="sm" w="32" disabled={updateRole.isPending}>
                      <NativeSelect.Field
                        aria-label={`Role for ${member.name}`}
                        value={member.role}
                        onChange={(event) => {
                          const role = event.currentTarget.value;
                          if (role === 'admin' || role === 'member') changeRole(member, role);
                        }}
                      >
                        <option value="admin">{ROLE_LABELS.admin}</option>
                        <option value="member">{ROLE_LABELS.member}</option>
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  ) : (
                    <Box w={{ md: '32' }}>
                      <RoleBadge role={member.role} />
                    </Box>
                  )}
                  <Box w={{ md: '20' }} textAlign="end">
                    {removable ? (
                      <Button size="sm" variant="ghost" colorPalette="red" onClick={() => { setPendingRemoval(member); }}>
                        Remove
                      </Button>
                    ) : null}
                  </Box>
                </Flex>
              );
            })}
          </Stack>
          <PaginationControls label="Members" page={page} totalPages={members.data.totalPages} onPageChange={setPage} />
        </>
      )}

      <ConfirmDialog
        open={pendingRemoval !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemoval(null);
        }}
        title="Remove member?"
        description={`${pendingRemoval?.name ?? 'This member'} will immediately lose access to ${workspace.name}. You can invite them again later.`}
        confirmLabel="Remove member"
        onConfirm={confirmRemoval}
        isPending={removeMember.isPending}
      />
    </Box>
  );
}
