const STATIC_FILE_EXTENSION =
  /\.(?:avif|css|eot|gif|ico|jpe?g|js|map|png|svg|ttf|txt|webmanifest|webp|woff2?|xml)$/i;

export function shouldRefreshSession(pathname: string): boolean {
  return (
    !pathname.startsWith('/_next/static/') &&
    !pathname.startsWith('/_next/image') &&
    pathname !== '/favicon.ico' &&
    !STATIC_FILE_EXTENSION.test(pathname)
  );
}
