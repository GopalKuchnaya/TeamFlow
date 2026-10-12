import { Box, Button, Flex, Stack, Text } from '@chakra-ui/react';
import { useState } from 'react';
import { notifyError, notifySuccess } from '@/components/feedback/notify';
import { ErrorState, LoadingState } from '@/components/feedback/states';
import { PaginationControls } from '@/components/pagination-controls';
import { RoleBadge } from '@/features/workspaces/components/role-badge';
import { useInvitations, useRevokeInvitation } from '../api';

const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

export function InvitationList({ workspaceId }: { workspaceId: string }) {
  const [page, setPage] = useState(1);
  const invitations = useInvitations(workspaceId, page, true);
  const revoke = useRevokeInvitation(workspaceId);

  if (invitations.isPending) return <LoadingState label="Loading invitations…" />;
  if (invitations.isError) {
    return <ErrorState message={invitations.error.message} onRetry={() => void invitations.refetch()} />;
  }
  if (invitations.data.items.length === 0) {
    return (
      <Text color="fg.muted" fontSize="sm">
        No pending invitations.
      </Text>
    );
  }

  return (
    <Box>
      <Stack as="ul" listStyleType="none" gap="0" borderWidth="1px" borderRadius="lg" divideY="1px" aria-label="Pending invitations">
        {invitations.data.items.map((invitation) => (
          <Flex as="li" key={invitation.id} align="center" gap="3" px="4" py="3" wrap="wrap">
            <Box flex="1" minW="48">
              <Text fontWeight="medium" wordBreak="break-all">
                {invitation.email}
              </Text>
              <Text fontSize="sm" color="fg.muted">
                {invitation.invitedBy ? `Invited by ${invitation.invitedBy.name} · ` : ''}
                Expires {dateFormatter.format(new Date(invitation.expiresAt))}
              </Text>
            </Box>
            <RoleBadge role={invitation.role} />
            <Button
              size="sm"
              variant="ghost"
              colorPalette="red"
              loading={revoke.isPending && revoke.variables === invitation.id}
              onClick={() => { revoke.mutate(invitation.id, {
                  onSuccess: () => { notifySuccess(`Invitation for ${invitation.email} revoked`); },
                  onError: (error) => { notifyError('Could not revoke invitation', error); },
                }); }
              }
            >
              Revoke
            </Button>
          </Flex>
        ))}
      </Stack>
      <PaginationControls
        label="Invitations"
        page={page}
        totalPages={invitations.data.totalPages}
        onPageChange={setPage}
      />
    </Box>
  );
}
