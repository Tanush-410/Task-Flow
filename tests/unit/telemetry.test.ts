import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { recordError } from '@/lib/telemetry';

describe('recordError', () => {
  it('emits a structured error with only allowlisted public context', () => {
    const sink = vi.fn();
    const error = Object.assign(new Error('untrusted message'), {
      code: 'INVITATION_CLEANUP_FAILED',
    });

    recordError(
      error,
      'trace-123',
      {
        operation: 'invitation_cleanup',
        invitationId: '20000000-0000-0000-0000-000000000001',
        attempt: 2,
        retryable: true,
        result: null,
      } as never,
      sink,
    );

    expect(sink).toHaveBeenCalledWith({
      timestamp: expect.stringMatching(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      ),
      level: 'error',
      traceId: 'trace-123',
      code: 'INVITATION_CLEANUP_FAILED',
      message: 'Invitation cleanup failed',
      context: {
        operation: 'invitation_cleanup',
        invitationId: '20000000-0000-0000-0000-000000000001',
      },
    });
  });

  it('uses fixed public messages and drops unrecognized error codes', () => {
    const sink = vi.fn();
    const error = Object.assign(
      new Error(
        'AWS_ACCESS_KEY_ID=AKIAEXAMPLE privateKey=private signingKey=signing accessKey=access amqps://user:pass@mq.example smtp://user:pass@mail.example ftp://user:pass@files.example',
      ),
      { code: 'AWS_ACCESS_KEY_ID' },
    );

    recordError(error, 'trace-fixed', {}, sink);

    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'UNKNOWN_ERROR',
        message: 'An operational error occurred',
      }),
    );
    const serialized = JSON.stringify(sink.mock.calls[0]?.[0]);
    expect(serialized).not.toContain('AKIAEXAMPLE');
    expect(serialized).not.toContain('private');
    expect(serialized).not.toContain('signing');
    expect(serialized).not.toContain('access');
    expect(serialized).not.toContain('user:pass');
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
        AWS_ACCESS_KEY_ID: 'aws-env-secret',
        awsAccessKeyId: 'aws-camel-secret',
        privateKey: 'private-key-secret',
        signingKey: 'signing-key-secret',
        accessKey: 'access-key-secret',
        queueUrl: 'amqps://queue-user:queue-secret@mq.example',
        mailUrl: 'smtp://mail-user:mail-secret@mail.example',
        transferUrl: 'ftp://file-user:file-secret@files.example',
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
    expect(serialized).not.toContain('aws-env-secret');
    expect(serialized).not.toContain('aws-camel-secret');
    expect(serialized).not.toContain('private-key-secret');
    expect(serialized).not.toContain('signing-key-secret');
    expect(serialized).not.toContain('access-key-secret');
    expect(serialized).not.toContain('queue-secret');
    expect(serialized).not.toContain('mail-secret');
    expect(serialized).not.toContain('file-secret');
    expect(serialized).not.toContain('hidden');
    expect(sink.mock.calls[0]?.[0]).toMatchObject({
      context: {},
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
        message: 'An operational error occurred',
        context: {},
      }),
    );
    expect(JSON.stringify(sink.mock.calls[0]?.[0])).not.toContain(
      'private response',
    );
  });

  it('drops arbitrary context keys instead of enumerating them', () => {
    const sink = vi.fn();
    const ownKeys = vi.fn(() =>
      Array.from({ length: 10_000 }, (_, index) => `field${index}`),
    );
    const context = new Proxy({ ignored: 'not public' }, { ownKeys });

    recordError(new Error('bounded'), 'trace-bounded', context as never, sink);

    const record = sink.mock.calls[0]?.[0];
    expect(record.context).toEqual({});
    expect(ownKeys).not.toHaveBeenCalled();
  });

  it('never processes multi-megabyte raw error messages', () => {
    const sink = vi.fn();
    const secret = 'AWS_ACCESS_KEY_ID=AKIA_SHOULD_NEVER_BE_READ';
    const error = new Error(`${'x'.repeat(2_000_000)}${secret}`);

    recordError(error, 'trace-large', {}, sink);

    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'An operational error occurred' }),
    );
    expect(JSON.stringify(sink.mock.calls[0]?.[0])).not.toContain(secret);
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
      expect.objectContaining({
        message: 'An operational error occurred',
        context: {},
      }),
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
