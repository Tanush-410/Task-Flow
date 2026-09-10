'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

const DURATION_MS = 900;

function easeOutExpo(t: number) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function reducedMotionQuery(): MediaQueryList {
  return window.matchMedia('(prefers-reduced-motion: reduce)');
}

function subscribeReducedMotion(onChange: () => void) {
  const query = reducedMotionQuery();
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** Counts up from 0 to `value` on mount/change. Renders strings as-is. */
export function AnimatedNumber({
  value,
  className,
}: {
  value: number | string;
  className?: string;
}) {
  const numeric = typeof value === 'number' ? value : Number(value);
  const isAnimatable = typeof value === 'number' && Number.isFinite(numeric);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => reducedMotionQuery().matches,
    () => false,
  );
  const [displayed, setDisplayed] = useState(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isAnimatable || reducedMotion) return;

    const start = performance.now();

    function tick(now: number) {
      const progress = Math.min(1, (now - start) / DURATION_MS);
      setDisplayed(Math.round(easeOutExpo(progress) * numeric));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [numeric, isAnimatable, reducedMotion]);

  if (!isAnimatable) {
    return <span className={className}>{value}</span>;
  }

  return (
    <span className={className}>{reducedMotion ? numeric : displayed}</span>
  );
}
