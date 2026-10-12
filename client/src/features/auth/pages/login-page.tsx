import { Button, Field, Input, Link, Stack } from '@chakra-ui/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link as RouterLink, useLocation } from 'react-router';
import { PasswordInput } from '@/components/password-input';
import { applyServerErrors } from '@/lib/form-errors';
import { safeRedirectTarget } from '@/routes/guards';
import { useLogin } from '../api';
import { AuthLayout } from '../components/auth-layout';
import { FormAlert } from '../components/form-alert';
import { loginFormSchema, type LoginFormValues } from '../schemas';

export function LoginPage() {
  const login = useLogin();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      // On success the session query is populated and GuestOnly redirects to the app.
      await login.mutateAsync(values);
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ['email', 'password']));
    }
  });

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue to your workspace."
      footer={
        <>
          New to TeamFlow?{' '}
          <Link asChild color="brand.fg" fontWeight="medium">
            <RouterLink to="/register" state={{ from: safeRedirectTarget(location.state) }}>
              Create an account
            </RouterLink>
          </Link>
        </>
      }
    >
      <form onSubmit={(event) => void onSubmit(event)} noValidate aria-label="Sign in">
        <Stack gap="5">
          <FormAlert message={formError} />
          <Field.Root invalid={Boolean(errors.email)} required>
            <Field.Label>Email</Field.Label>
            <Input type="email" autoComplete="email" autoFocus {...register('email')} />
            <Field.ErrorText>{errors.email?.message}</Field.ErrorText>
          </Field.Root>
          <Field.Root invalid={Boolean(errors.password)} required>
            <Field.Label>Password</Field.Label>
            <PasswordInput autoComplete="current-password" {...register('password')} />
            <Field.ErrorText>{errors.password?.message}</Field.ErrorText>
          </Field.Root>
          <Button type="submit" colorPalette="brand" size="lg" loading={login.isPending} loadingText="Signing in…">
            Sign in
          </Button>
        </Stack>
      </form>
    </AuthLayout>
  );
}
