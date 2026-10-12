import { Writable } from 'node:stream';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { redactPaths } from '../../src/config/logger.js';

describe('log redaction', () => {
  it('never writes credentials, cookies, or tokens to the log', () => {
    let output = '';
    const sink = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });
    const logger = pino({ redact: { paths: redactPaths, censor: '[REDACTED]' } }, sink);

    logger.info({
      req: { headers: { authorization: 'Bearer secret-access', cookie: 'tf_refresh=secret-refresh' } },
      res: { headers: { 'set-cookie': 'tf_refresh=secret-rotated' } },
      body: { password: 'secret-password', accessToken: 'secret-token' },
    });

    expect(output).not.toMatch(/secret-/);
    expect(output).toContain('[REDACTED]');
  });
});
