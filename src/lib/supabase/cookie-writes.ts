type NextServerError = Error & {
  __NEXT_ERROR_CODE?: string;
};

function isReadonlyRequestCookiesError(
  error: unknown,
): error is NextServerError {
  return (
    error instanceof Error &&
    (error as NextServerError).__NEXT_ERROR_CODE === 'E1180'
  );
}

export function writeServerCookies(write: () => void): void {
  try {
    write();
  } catch (error) {
    if (!isReadonlyRequestCookiesError(error)) {
      throw error;
    }
  }
}
