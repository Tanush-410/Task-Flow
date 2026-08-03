const STATIC_FILE_EXTENSION =
  /\.(?:avif|css|eot|gif|ico|jpe?g|js|map|png|svg|ttf|txt|webmanifest|webp|woff2?|xml)$/i;

export function shouldRefreshSession(pathname: string): boolean {
  return (
    !pathname.startsWith('/_next/static/') &&
    !pathname.startsWith('/_next/image') &&
    // Turbopack/webpack's dev-only hot-reload socket: running session-refresh
    // logic against this WebSocket upgrade request breaks the handshake and
    // silently disables live reload.
    !pathname.startsWith('/_next/hmr') &&
    !pathname.startsWith('/_next/webpack-hmr') &&
    pathname !== '/favicon.ico' &&
    !STATIC_FILE_EXTENSION.test(pathname)
  );
}
