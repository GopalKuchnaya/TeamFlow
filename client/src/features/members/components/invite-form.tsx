import { Alert, Button, Field, HStack, Input, NativeSelect, Stack, Text } from '@chakra-ui/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { LuCopy } from 'react-icons/lu';
import { toaster } from '@/components/feedback/toaster';
import { FormAlert } from '@/features/auth/components/form-alert';
import { ROLE_LABELS, invitableRoles } from '@/features/workspaces/permissions';
import { inviteFormSchema, type InviteFormInput } from '@/features/workspaces/schemas';
import { applyServerErrors } from '@/lib/form-errors';
import type { WorkspaceRole } from '@/types/api';
import { useCreateInvitation } from '../api';

export function inviteUrl(token: string): string {
  return `${window.location.origin}/invite/${token}`;
}

/**
 * Creates an invitation and shows its one-time link. There is no email delivery yet, so the
 * inviter shares the link; the server stores only a hash and cannot show it again.
 */
export function InviteForm({ workspaceId, actorRole }: { workspaceId: string; actorRole: WorkspaceRole }) {
  const createInvitation = useCreateInvitation(workspaceId);
  const roles = invitableRoles(actorRole);
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; link: string } | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteFormInput>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: { email: '', role: 'member' },
  });

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    setCreated(null);
    try {
      const result = await createInvitation.mutateAsync(values);
      setCreated({ email: result.invitation.email, link: inviteUrl(result.token) });
      reset({ email: '', role: values.role });
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ['email', 'role']));
    }
  });

  const copy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toaster.create({ type: 'success', title: 'Invite link copied' });
    } catch {
      toaster.create({ type: 'warning', title: 'Copy failed', description: 'Select the link and copy it manually.' });
    }
  };

  return (
    <Stack gap="4">
      <form onSubmit={(event) => void submit(event)} noValidate aria-label="Invite a teammate">
        <Stack gap="4">
          <FormAlert message={formError} />
          <Stack direction={{ base: 'column', md: 'row' }} gap="3" align={{ md: 'flex-start' }}>
            <Field.Root invalid={Boolean(errors.email)} required flex="1">
              <Field.Label>Email address</Field.Label>
              <Input type="email" autoComplete="off" placeholder="teammate@company.com" {...register('email')} />
              <Field.ErrorText>{errors.email?.message}</Field.ErrorText>
            </Field.Root>
            <Field.Root w={{ base: 'full', md: '40' }}>
              <Field.Label>Role</Field.Label>
              <NativeSelect.Root disabled={roles.length < 2}>
                <NativeSelect.Field {...register('role')}>
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Field.Root>
            <Button type="submit" colorPalette="brand" mt={{ md: '6' }} loading={isSubmitting} loadingText="Inviting…">
              Create invite
            </Button>
          </Stack>
        </Stack>
      </form>

      {created ? (
        <Alert.Root status="success" borderRadius="lg" alignItems="flex-start">
          <Alert.Indicator />
          <Alert.Content gap="2" minW="0">
            <Alert.Title>Invitation created for {created.email}</Alert.Title>
            <Alert.Description>
              <Text mb="2">Share this link with them. It expires in 7 days and can be used once. It won't be shown again.</Text>
              <HStack gap="2" align="stretch" wrap={{ base: 'wrap', sm: 'nowrap' }}>
                <Input
                  readOnly
                  value={created.link}
                  aria-label="Invite link"
                  size="sm"
                  bg="bg"
                  onFocus={(event) => { event.currentTarget.select(); }}
                />
                <Button size="sm" variant="outline" onClick={() => void copy(created.link)}>
                  <LuCopy /> Copy link
                </Button>
              </HStack>
            </Alert.Description>
          </Alert.Content>
        </Alert.Root>
      ) : null}
    </Stack>
  );
}
