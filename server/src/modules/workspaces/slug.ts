import { randomBytes } from 'node:crypto';

const MAX_BASE_LENGTH = 48;

export function slugify(name: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_BASE_LENGTH)
    .replace(/-+$/g, '');
  return base || 'workspace';
}

/** A readable slug with a random suffix, so two workspaces with the same name never collide in practice. */
export function generateSlug(name: string): string {
  return `${slugify(name)}-${randomBytes(4).toString('hex').slice(0, 6)}`;
}
