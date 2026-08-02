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
        detail: 'contact person@example.com using Bearer third-secret',
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
});
