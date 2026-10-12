import type { AuthUser } from '../modules/auth/auth.types.js';

declare global {
   
  namespace Express {
    interface Request {
      /** Set by `requireAuth` once the access token has been verified and the user loaded. */
      user?: AuthUser;
    }
  }
}

export {};
