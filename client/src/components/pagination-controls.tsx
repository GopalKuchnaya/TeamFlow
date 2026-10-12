import { Button, HStack, Text } from '@chakra-ui/react';

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  label: string;
}

export function PaginationControls({ page, totalPages, onPageChange, label }: PaginationControlsProps) {
  if (totalPages <= 1) return null;
  return (
    <HStack as="nav" aria-label={`${label} pagination`} justify="space-between" pt="3">
      <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => { onPageChange(page - 1); }}>
        Previous
      </Button>
      <Text fontSize="sm" color="fg.muted" aria-live="polite">
        Page {page} of {totalPages}
      </Text>
      <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => { onPageChange(page + 1); }}>
        Next
      </Button>
    </HStack>
  );
}
