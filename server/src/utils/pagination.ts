import { z } from 'zod';

export const MAX_PAGE_SIZE = 100;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function skipFor({ page, limit }: PaginationQuery): number {
  return (page - 1) * limit;
}

export function paginated<T>(items: T[], total: number, { page, limit }: PaginationQuery): Paginated<T> {
  return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
}
