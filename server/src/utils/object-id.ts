import { z } from 'zod';

/** A 24-character hex MongoDB ObjectId supplied by a client (path params, body references). */
export const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');
