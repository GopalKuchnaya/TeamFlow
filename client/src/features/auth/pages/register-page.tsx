import { Button, Field, Input, Link, Stack } from '@chakra-ui/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link as RouterLink, useLocation } from 'react-router';
import { toaster } from '@/components/feedback/toaster';
import { PasswordInput } from '@/components/password-input';
import { applyServerErrors } from '@/lib/form-errors';
import { safeRedirectTarget } from '@/routes/guards';
import { useRegister } from '../api';
import { AuthLayout } from '../components/auth-layout';
import { FormAlert } from '../components/form-alert';
import { registerFormSchema, type RegisterFormValues } from '../schemas';

export function RegisterPage() {
  const registerUser = useRegister();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const session = await registerUser.mutateAsync(values);
      toaster.create({ type: 'success', title: `Welcome to TeamFlow, ${session.user.name}!` });
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ['name', 'email', 'password']));
    }
  });

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start organising your team's work in minutes."
      footer={
        <>
          Already have an account?{' '}
          <Link asChild color="brand.fg" fontWeight="medium">
            <RouterLink to="/login" state={{ from: safeRedirectTarget(location.state) }}>
              Sign in
            </RouterLink>
          </Link>
        </>
      }
    >
      <form onSubmit={(event) => void onSubmit(event)} noValidate aria-label="Create account">
        <Stack gap="5">
          <FormAlert message={formError} />
          <Field.Root invalid={Boolean(errors.name)} required>
            <Field.Label>Full name</Field.Label>
            <Input autoComplete="name" autoFocus {...register('name')} />
            <Field.ErrorText>{errors.name?.message}</Field.ErrorText>
          </Field.Root>
          <Field.Root invalid={Boolean(errors.email)} required>
            <Field.Label>Email</Field.Label>
            <Input type="email" autoComplete="email" {...register('email')} />
            <Field.ErrorText>{errors.email?.message}</Field.ErrorText>
          </Field.Root>
          <Field.Root invalid={Boolean(errors.password)} required>
            <Field.Label>Password</Field.Label>
            <PasswordInput autoComplete="new-password" {...register('password')} />
            {errors.password ? (
              <Field.ErrorText>{errors.password.message}</Field.ErrorText>
            ) : (
              <Field.HelperText>At least 8 characters, including a letter and a number.</Field.HelperText>
            )}
          </Field.Root>
          <Field.Root invalid={Boolean(errors.confirmPassword)} required>
            <Field.Label>Confirm password</Field.Label>
            <PasswordInput autoComplete="new-password" {...register('confirmPassword')} />
            <Field.ErrorText>{errors.confirmPassword?.message}</Field.ErrorText>
          </Field.Root>
          <Button
            type="submit"
            colorPalette="brand"
            size="lg"
            loading={registerUser.isPending}
            loadingText="Creating account…"
          >
            Create account
          </Button>
        </Stack>
      </form>
    </AuthLayout>
  );
}
