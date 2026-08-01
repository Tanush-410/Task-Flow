type CookieValue<TOptions> = {
  name: string;
  value: string;
  options: TOptions;
};

export function synchronizeProxyCookies<TOptions, TResponse>(
  values: readonly CookieValue<TOptions>[],
  setRequestCookie: (name: string, value: string) => void,
  createResponse: () => TResponse,
  setResponseCookie: (
    response: TResponse,
    name: string,
    value: string,
    options: TOptions,
  ) => void,
): TResponse {
  values.forEach(({ name, value }) => {
    setRequestCookie(name, value);
  });

  const response = createResponse();

  values.forEach(({ name, value, options }) => {
    setResponseCookie(response, name, value, options);
  });

  return response;
}
