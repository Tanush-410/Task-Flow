import 'server-only';

type PublicTelemetryOperation = 'invitation_cleanup';

export type SafeTelemetryContext = {
  operation?: PublicTelemetryOperation;
  invitationId?: string;
};

export type ErrorTelemetryRecord = {
  timestamp: string;
  level: 'error';
  traceId: string;
  code: string;
  message: string;
  context: SafeTelemetryContext;
};

export type TelemetrySink = (record: ErrorTelemetryRecord) => void;

const PUBLIC_ERROR_MESSAGES = {
  INVITATION_CLEANUP_FAILED: 'Invitation cleanup failed',
} as const;
const UNKNOWN_ERROR_MESSAGE = 'An operational error occurred';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TRACE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

function readProperty(value: unknown, key: string): unknown {
  if (
    value === null ||
    (typeof value !== 'object' && typeof value !== 'function')
  ) {
    return undefined;
  }

  try {
    return Reflect.get(value, key);
  } catch {
    return undefined;
  }
}

function publicError(error: unknown): { code: string; message: string } {
  const code = readProperty(error, 'code');
  if (
    typeof code === 'string' &&
    code.length <= 64 &&
    Object.hasOwn(PUBLIC_ERROR_MESSAGES, code)
  ) {
    return {
      code,
      message:
        PUBLIC_ERROR_MESSAGES[code as keyof typeof PUBLIC_ERROR_MESSAGES],
    };
  }

  return { code: 'UNKNOWN_ERROR', message: UNKNOWN_ERROR_MESSAGE };
}

function safeTraceId(value: unknown): string {
  return typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= 128 &&
    TRACE_ID_PATTERN.test(value)
    ? value
    : 'invalid-trace-id';
}

function safeContext(value: unknown): SafeTelemetryContext {
  const context: SafeTelemetryContext = {};
  const operation = readProperty(value, 'operation');
  const invitationId = readProperty(value, 'invitationId');

  if (operation === 'invitation_cleanup') {
    context.operation = operation;
  }
  if (
    typeof invitationId === 'string' &&
    invitationId.length === 36 &&
    UUID_PATTERN.test(invitationId)
  ) {
    context.invitationId = invitationId;
  }

  return context;
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
  try {
    const publicDetails = publicError(error);
    const record: ErrorTelemetryRecord = {
      timestamp: new Date().toISOString(),
      level: 'error',
      traceId: safeTraceId(traceId),
      code: publicDetails.code,
      message: publicDetails.message,
      context: safeContext(context),
    };

    try {
      sink(record);
    } catch {
      // Telemetry must never alter the operation it observes.
    }
  } catch {
    // Telemetry is best-effort and must fail silently at its outer boundary.
  }
}
