import { Heading, Stack, Text } from '@chakra-ui/react';

export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <Stack gap="1" mb="8">
      <Heading as="h1" size="2xl" letterSpacing="tight">
        {title}
      </Heading>
      {description ? <Text color="fg.muted">{description}</Text> : null}
    </Stack>
  );
}
