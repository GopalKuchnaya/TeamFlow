export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export interface RequestContext {
  userAgent?: string | undefined;
}
