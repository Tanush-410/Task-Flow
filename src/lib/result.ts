export type ActionError = {
  code: string;
  message: string;
  traceId: string;
  fields?: Record<string, string[]>;
};

export type ActionResult<T> =
  { ok: true; data: T } | { ok: false; error: ActionError };
