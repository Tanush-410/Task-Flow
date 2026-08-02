import 'server-only';

export type SafeTelemetryScalar = string | number | boolean | null;
export type SafeTelemetryContext = Record<string, SafeTelemetryScalar>;

export type ErrorTelemetryRecord = {
  timestamp: string;
  level: 'error';
  traceId: string;
  code: string;
  message: string;
  context: SafeTelemetryContext;
};

export type TelemetrySink = (record: ErrorTelemetryRecord) => void;

const SENSITIVE_KEY_PARTS = new Set([
  'authorization',
  'body',
  'comment',
  'cookie',
  'email',
  'file',
  'password',
  'provider',
  'raw',
  'secret',
  'stack',
  'token',
]);

function keyParts(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function isSafeContextKey(key: string): boolean {
  return (
    /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(key) &&
    !keyParts(key).some((part) => SENSITIVE_KEY_PARTS.has(part))
  );
}

function redactText(value: string): string {
  return value
    .slice(0, 512)
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]')
    .replace(/https?:\/\/[^\s]+/gi, '[REDACTED_URL]')
    .replace(/\/invite\/[A-Za-z0-9_-]+/gi, '/invite/[REDACTED]')
    .replace(
      /\b(?:authorization|cookie|password|secret|token)\s*[=:]\s*[^\s,;]+/gi,
      '[REDACTED_SECRET]',
    )
    .replace(/\b[A-Za-z0-9_+/=-]{40,}\b/g, '[REDACTED_SECRET]');
}

function sanitizeContext(context: SafeTelemetryContext): SafeTelemetryContext {
  const safe: SafeTelemetryContext = {};

  for (const [key, value] of Object.entries(context)) {
    if (!isSafeContextKey(key)) continue;

    if (typeof value === 'string') {
      safe[key] = redactText(value);
    } else if (
      value === null ||
      typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value))
    ) {
      safe[key] = value;
    }
  }

  return safe;
}

function errorCode(error: Error): string {
  const code = (error as Error & { code?: unknown }).code;
  return typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(code)
    ? code
    : 'UNKNOWN_ERROR';
}

const consoleTelemetrySink: TelemetrySink = (record) => {
  console.error(JSON.stringify(record));
};

export function recordError(
  error: unknown,
  traceId: string,
  context: SafeTelemetryContext = {},
  sink: TelemetrySink = consoleTelemetrySink,
): void {
  const knownError = error instanceof Error ? error : null;
  const safeTraceId = /^[A-Za-z0-9_-]{1,128}$/.test(traceId)
    ? traceId
    : 'invalid-trace-id';

  sink({
    timestamp: new Date().toISOString(),
    level: 'error',
    traceId: safeTraceId,
    code: knownError ? errorCode(knownError) : 'UNKNOWN_ERROR',
    message: knownError
      ? redactText(knownError.message || 'Unknown error')
      : 'Unknown error',
    context: sanitizeContext(context),
  });
}
