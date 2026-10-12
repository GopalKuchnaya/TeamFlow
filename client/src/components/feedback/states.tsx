import { Box, Button, Center, EmptyState as ChakraEmptyState, Spinner, Text, VStack } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { LuCircleAlert } from 'react-icons/lu';

export function LoadingState({ label = 'Loading…', fullPage = false }: { label?: string; fullPage?: boolean }) {
  return (
    <Center minH={fullPage ? '100dvh' : '40'} role="status" aria-live="polite">
      <VStack gap="3">
        <Spinner size="lg" color="brand.solid" borderWidth="3px" />
        <Text color="fg.muted" fontSize="sm">
          {label}
        </Text>
      </VStack>
    </Center>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  fullPage?: boolean;
}

export function ErrorState({ title = 'Something went wrong', message, onRetry, fullPage = false }: ErrorStateProps) {
  return (
    <Center minH={fullPage ? '100dvh' : '40'} px="4">
      <ChakraEmptyState.Root role="alert">
        <ChakraEmptyState.Content>
          <ChakraEmptyState.Indicator color="red.500">
            <LuCircleAlert />
          </ChakraEmptyState.Indicator>
          <VStack textAlign="center">
            <ChakraEmptyState.Title>{title}</ChakraEmptyState.Title>
            <ChakraEmptyState.Description>{message}</ChakraEmptyState.Description>
          </VStack>
          {onRetry ? (
            <Button colorPalette="brand" variant="outline" onClick={onRetry}>
              Try again
            </Button>
          ) : null}
        </ChakraEmptyState.Content>
      </ChakraEmptyState.Root>
    </Center>
  );
}

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Box borderWidth="1px" borderStyle="dashed" borderRadius="xl" bg="bg">
      <ChakraEmptyState.Root>
        <ChakraEmptyState.Content>
          <ChakraEmptyState.Indicator color="brand.solid">{icon}</ChakraEmptyState.Indicator>
          <VStack textAlign="center">
            <ChakraEmptyState.Title>{title}</ChakraEmptyState.Title>
            <ChakraEmptyState.Description>{description}</ChakraEmptyState.Description>
          </VStack>
          {action}
        </ChakraEmptyState.Content>
      </ChakraEmptyState.Root>
    </Box>
  );
}
