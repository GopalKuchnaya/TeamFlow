import { Button, Field, Input, Stack, Textarea } from '@chakra-ui/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormAlert } from '@/features/auth/components/form-alert';
import { applyServerErrors } from '@/lib/form-errors';
import { workspaceFormSchema, type WorkspaceFormInput } from '../schemas';

interface WorkspaceFormProps {
  defaultValues?: WorkspaceFormInput;
  submitLabel: string;
  pendingLabel: string;
  onSubmit: (values: WorkspaceFormInput) => Promise<unknown>;
  /** Reset the form to the saved values after a successful submit (edit mode). */
  resetOnSuccess?: boolean;
}

export function WorkspaceForm({
  defaultValues = { name: '', description: '' },
  submitLabel,
  pendingLabel,
  onSubmit,
  resetOnSuccess = false,
}: WorkspaceFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<WorkspaceFormInput>({ resolver: zodResolver(workspaceFormSchema), defaultValues });

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await onSubmit(values);
      if (resetOnSuccess) reset(values);
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ['name', 'description']));
    }
  });

  return (
    <form onSubmit={(event) => void submit(event)} noValidate aria-label={submitLabel}>
      <Stack gap="4">
        <FormAlert message={formError} />
        <Field.Root invalid={Boolean(errors.name)} required>
          <Field.Label>Workspace name</Field.Label>
          <Input autoComplete="off" placeholder="e.g. Product Team" {...register('name')} />
          <Field.ErrorText>{errors.name?.message}</Field.ErrorText>
        </Field.Root>
        <Field.Root invalid={Boolean(errors.description)}>
          <Field.Label>Description</Field.Label>
          <Textarea rows={3} placeholder="What does this team work on?" {...register('description')} />
          <Field.ErrorText>{errors.description?.message}</Field.ErrorText>
        </Field.Root>
        <Button
          type="submit"
          colorPalette="brand"
          alignSelf="flex-start"
          loading={isSubmitting}
          loadingText={pendingLabel}
          disabled={resetOnSuccess && !isDirty}
        >
          {submitLabel}
        </Button>
      </Stack>
    </form>
  );
}
