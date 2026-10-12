import { describe, expect, it } from 'vitest';
import { parseEnv } from '../../src/config/env.js';

const base = {
  MONGODB_URI: 'mongodb://localhost:27017/teamflow',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
};

describe('parseEnv', () => {
  it('applies safe defaults', () => {
    const env = parseEnv(base);
    expect(env.PORT).toBe(4000);
    expect(env.NODE_ENV).toBe('development');
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:5173']);
    expect(env.COOKIE_SECURE).toBe(false);
    expect(env.COOKIE_SAMESITE).toBe('lax');
    expect(env.ACCESS_TOKEN_TTL_SECONDS).toBe(900);
  });

  it('forces secure cookies in production by default', () => {
    expect(parseEnv({ ...base, NODE_ENV: 'production' }).COOKIE_SECURE).toBe(true);
  });

  it('parses a comma-separated CORS allowlist', () => {
    const env = parseEnv({ ...base, CORS_ORIGINS: 'https://app.example.com, https://admin.example.com' });
    expect(env.CORS_ORIGINS).toEqual(['https://app.example.com', 'https://admin.example.com']);
  });

  it('rejects a short JWT secret without echoing its value', () => {
    expect(() => parseEnv({ ...base, JWT_ACCESS_SECRET: 'short-secret' })).toThrow(
      /JWT_ACCESS_SECRET: JWT_ACCESS_SECRET must be at least 32 characters/,
    );
    expect(() => parseEnv({ ...base, JWT_ACCESS_SECRET: 'short-secret' })).not.toThrow(/short-secret/);
  });

  it('requires MONGODB_URI', () => {
    expect(() => parseEnv({ JWT_ACCESS_SECRET: base.JWT_ACCESS_SECRET })).toThrow(/MONGODB_URI/);
  });

  it('rejects SameSite=None without Secure', () => {
    expect(() => parseEnv({ ...base, COOKIE_SAMESITE: 'none', COOKIE_SECURE: 'false' })).toThrow(
      /COOKIE_SAMESITE=none requires COOKIE_SECURE=true/,
    );
  });

  it('rejects invalid CORS origins', () => {
    expect(() => parseEnv({ ...base, CORS_ORIGINS: 'not a url' })).toThrow(/CORS_ORIGINS/);
  });
});
