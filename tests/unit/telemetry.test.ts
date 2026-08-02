import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { recordError } from '@/lib/telemetry';

describe('recordError', () => {
  it('emits a structured error with safe scalar context', () => {
    const sink = vi.fn();
    const error = Object.assign(new Error('Database unavailable'), {
      code: 'DATABASE_UNAVAILABLE',
    });

    recordError(
      error,
      'trace-123',
      {
        operation: 'invitation_cleanup',
        attempt: 2,
        retryable: true,
        result: null,
      },
      sink,
    );

    expect(sink).toHaveBeenCalledWith({
      timestamp: expect.stringMatching(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      ),
      level: 'error',
      traceId: 'trace-123',
      code: 'DATABASE_UNAVAILABLE',
      message: 'Database unavailable',
      context: {
        operation: 'invitation_cleanup',
        attempt: 2,
        retryable: true,
        result: null,
      },
    });
  });

  it('excludes sensitive keys, non-scalars, and sensitive values', () => {
    const sink = vi.fn();
    const error = new Error(
      'Failed for person@example.com with Bearer super-secret-token',
    );
    error.stack = 'STACK_SENTINEL';

    recordError(
      error,
      'trace-safe',
      {
        operation: 'invite_member',
        token: 'token-value',
        comment: 'private comment',
        fileName: 'private.pdf',
        body: 'request body',
        rawProviderError: 'provider response',
        recipientEmail: 'person@example.com',
        authorization: 'Bearer another-secret',
        apiKey: 'api-key-value',
        databaseCredential: 'database-credential',
        sessionId: 'session-secret',
        connectionString: 'postgres://db-user:db-password@db.example/tasks',
        detail:
          'contact person@example.com using Bearer "third-secret" with API_KEY="fourth-secret" and postgres://user:password@db.example/tasks',
        nested: { password: 'hidden' },
      } as never,
      sink,
    );

    const serialized = JSON.stringify(sink.mock.calls[0]?.[0]);

    expect(serialized).not.toContain('STACK_SENTINEL');
    expect(serialized).not.toContain('person@example.com');
    expect(serialized).not.toContain('super-secret-token');
    expect(serialized).not.toContain('token-value');
    expect(serialized).not.toContain('private comment');
    expect(serialized).not.toContain('private.pdf');
    expect(serialized).not.toContain('request body');
    expect(serialized).not.toContain('provider response');
    expect(serialized).not.toContain('another-secret');
    expect(serialized).not.toContain('third-secret');
    expect(serialized).not.toContain('fourth-secret');
    expect(serialized).not.toContain('api-key-value');
    expect(serialized).not.toContain('database-credential');
    expect(serialized).not.toContain('session-secret');
    expect(serialized).not.toContain('db-password');
    expect(serialized).not.toContain('user:password');
    expect(serialized).not.toContain('hidden');
    expect(sink.mock.calls[0]?.[0]).toMatchObject({
      context: { operation: 'invite_member' },
    });
  });

  it('does not serialize raw thrown provider objects', () => {
    const sink = vi.fn();

    recordError(
      {
        message: 'raw provider failure',
        response: { body: 'private response' },
      },
      'trace-unknown',
      {},
      sink,
    );

    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'UNKNOWN_ERROR',
        message: 'Unknown error',
        context: {},
      }),
    );
    expect(JSON.stringify(sink.mock.calls[0]?.[0])).not.toContain(
      'private response',
    );
  });

  it('bounds context entry count and total serialized size', () => {
    const sink = vi.fn();
    const context = Object.fromEntries(
      Array.from({ length: 100 }, (_, index) => [
        `safeField${index}`,
        'x'.repeat(500),
      ]),
    );

    recordError(new Error('bounded'), 'trace-bounded', context, sink);

    const record = sink.mock.calls[0]?.[0];
    expect(Object.keys(record.context).length).toBeLessThanOrEqual(20);
    expect(JSON.stringify(record).length).toBeLessThanOrEqual(4_096);
  });

  it('survives hostile errors and context objects', () => {
    const sink = vi.fn();
    const error = new Error('unreadable');
    Object.defineProperty(error, 'message', {
      get: () => {
        throw new Error('message getter failure');
      },
    });
    const context = new Proxy(
      {},
      {
        ownKeys: () => {
          throw new Error('context proxy failure');
        },
      },
    );

    expect(() =>
      recordError(error, 'trace-hostile', context as never, sink),
    ).not.toThrow();
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Unknown error', context: {} }),
    );
  });

  it('never lets a failing sink escape', () => {
    expect(() =>
      recordError(new Error('safe'), 'trace-sink', {}, () => {
        throw new Error('sink unavailable');
      }),
    ).not.toThrow();
  });
});
