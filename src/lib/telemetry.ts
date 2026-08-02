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

const MAX_CONTEXT_ENTRIES = 20;
const MAX_CONTEXT_SIZE = 2_048;
const MAX_TEXT_SIZE = 512;

const SENSITIVE_KEY_MARKERS = [
  'apikey',
  'authorization',
  'body',
  'comment',
  'connectionstring',
  'cookie',
  'credential',
  'email',
  'file',
  'password',
  'provider',
  'raw',
  'secret',
  'session',
  'stack',
  'token',
];

function isSafeContextKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  return (
    /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(key) &&
    !SENSITIVE_KEY_MARKERS.some((marker) => normalized.includes(marker))
  );
}

function redactText(value: string): string {
  return value
    .replace(
      /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s]+/gi,
      '[REDACTED_CONNECTION_URL]',
    )
    .replace(
      /\bBearer\s+(?:"[^"]*"|'[^']*'|[A-Za-z0-9._~+/=-]+)/gi,
      'Bearer [REDACTED]',
    )
    .replace(
      /\b(?:api[\s_-]*key|authorization|connection[\s_-]*string|cookie|credential|password|secret|session|token)\s*[=:]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
      '[REDACTED_SECRET]',
    )
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]')
    .replace(/https?:\/\/[^\s]+/gi, '[REDACTED_URL]')
    .replace(/\/invite\/[A-Za-z0-9_-]+/gi, '/invite/[REDACTED]')
    .replace(/\b[A-Za-z0-9_+/=-]{40,}\b/g, '[REDACTED_SECRET]')
    .slice(0, MAX_TEXT_SIZE);
}

function sanitizeContext(context: SafeTelemetryContext): SafeTelemetryContext {
  const safe: SafeTelemetryContext = {};
  let entries: [string, unknown][];

  try {
    entries = Object.entries(context);
  } catch {
    return safe;
  }

  let size = 0;
  let count = 0;

  for (const [key, value] of entries) {
    if (count >= MAX_CONTEXT_ENTRIES) break;
    if (!isSafeContextKey(key)) continue;

    let sanitized: SafeTelemetryScalar | undefined;
    if (typeof value === 'string') {
      sanitized = redactText(value);
    } else if (
      value === null ||
      typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value))
    ) {
      sanitized = value;
    }

    if (sanitized === undefined) continue;

    const entrySize = key.length + JSON.stringify(sanitized).length;
    if (size + entrySize > MAX_CONTEXT_SIZE) break;

    safe[key] = sanitized;
    size += entrySize;
    count += 1;
  }

  return safe;
}

function errorCode(error: Error): string {
  try {
    const code = (error as Error & { code?: unknown }).code;
    return typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(code)
      ? code
      : 'UNKNOWN_ERROR';
  } catch {
    return 'UNKNOWN_ERROR';
  }
}

function errorMessage(error: Error): string {
  try {
    return redactText(error.message || 'Unknown error');
  } catch {
    return 'Unknown error';
  }
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
  let record: ErrorTelemetryRecord;

  try {
    const knownError = error instanceof Error ? error : null;
    const safeTraceId =
      typeof traceId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(traceId)
        ? traceId
        : 'invalid-trace-id';

    record = {
      timestamp: new Date().toISOString(),
      level: 'error',
      traceId: safeTraceId,
      code: knownError ? errorCode(knownError) : 'UNKNOWN_ERROR',
      message: knownError ? errorMessage(knownError) : 'Unknown error',
      context: sanitizeContext(context),
    };
  } catch {
    record = {
      timestamp: new Date().toISOString(),
      level: 'error',
      traceId: 'invalid-trace-id',
      code: 'UNKNOWN_ERROR',
      message: 'Unknown error',
      context: {},
    };
  }

  try {
    sink(record);
  } catch {
    // Telemetry must never alter the operation it observes.
  }
}
