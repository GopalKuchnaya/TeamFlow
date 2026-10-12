import { Button, Center, Heading, Stack, Text } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router';

export function NotFoundPage() {
  return (
    <Center minH="100dvh" px="4" as="main">
      <Stack gap="4" textAlign="center" align="center">
        <Text fontWeight="semibold" color="brand.fg">
          404
        </Text>
        <Heading as="h1" size="2xl">
          Page not found
        </Heading>
        <Text color="fg.muted" maxW="md">
          The page you are looking for doesn't exist or may have moved.
        </Text>
        <Button asChild colorPalette="brand">
          <RouterLink to="/">Go to home</RouterLink>
        </Button>
      </Stack>
    </Center>
  );
}
