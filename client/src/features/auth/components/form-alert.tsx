import { Alert } from '@chakra-ui/react';

export function FormAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Alert.Root status="error" borderRadius="lg">
      <Alert.Indicator />
      <Alert.Description>{message}</Alert.Description>
    </Alert.Root>
  );
}
