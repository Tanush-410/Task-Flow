'use client';

import dynamic from 'next/dynamic';
import { Component, useSyncExternalStore, type ReactNode } from 'react';

// next/dynamic(..., { ssr: false }) must be called from inside a Client
// Component in this Next.js version -- it can no longer be called directly
// in a Server Component (the root layout that mounts <AmbientBackground />
// is one), so the dynamic import lives here rather than in layout.tsx.
const AmbientShaderScene = dynamic(
  () => import('./ambient-shader-scene').then((mod) => mod.AmbientShaderScene),
  { loading: () => null, ssr: false },
);

/** A shader error must never take a real page down with it. */
class ShaderErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

let webglSupportCache: boolean | null = null;

function supportsWebGL(): boolean {
  if (webglSupportCache !== null) return webglSupportCache;
  try {
    const canvas = document.createElement('canvas');
    webglSupportCache = Boolean(
      canvas.getContext('webgl2') ?? canvas.getContext('webgl'),
    );
  } catch {
    webglSupportCache = false;
  }
  return webglSupportCache;
}

// A one-time capability check has nothing to subscribe to, so the
// subscribe function is a no-op -- useSyncExternalStore still gives us the
// SSR-safe snapshot semantics we need (`false` on the server, the real
// answer once mounted on the client).
function subscribeNever() {
  return () => {};
}

function useWebGLReady(): boolean {
  return useSyncExternalStore(subscribeNever, supportsWebGL, () => false);
}

function reducedMotionQuery(): MediaQueryList {
  return window.matchMedia('(prefers-reduced-motion: reduce)');
}

function subscribeReducedMotion(onChange: () => void) {
  const query = reducedMotionQuery();
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function useAnimate(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => !reducedMotionQuery().matches,
    () => true,
  );
}

/**
 * A single ambient shader-gradient layer, mounted once in the root layout
 * so every route shares one canvas instead of paying for one per page.
 * Renders nothing (not even a static fallback) when WebGL is unavailable
 * -- the page already looks correct without it, since it only ever adds
 * atmosphere on top of the existing flat background.
 */
export function AmbientBackground() {
  const ready = useWebGLReady();
  const animate = useAnimate();

  if (!ready) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <ShaderErrorBoundary>
        <AmbientShaderScene animate={animate} />
      </ShaderErrorBoundary>
      <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/70 to-background" />
    </div>
  );
}
