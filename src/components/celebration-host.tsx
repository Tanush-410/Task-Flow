'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

import { TASK_COMPLETED_EVENT } from '@/lib/celebrate';

const CelebrationScene = dynamic(
  () => import('./celebration-scene').then((mod) => mod.CelebrationScene),
  { loading: () => null, ssr: false },
);

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/**
 * Listens for `taskflow:task-completed` anywhere in the app and mounts a
 * brief full-screen particle burst. Mounted once in the root layout, next
 * to `AmbientBackground`. Skips entirely under reduced-motion or when
 * WebGL is unavailable -- this is pure decoration, never load-bearing.
 */
export function CelebrationHost() {
  const [burstKey, setBurstKey] = useState<number | null>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (reduceMotion || !supportsWebGL()) return;

    function handleCompleted() {
      setBurstKey((previous) => (previous ?? 0) + 1);
    }

    window.addEventListener(TASK_COMPLETED_EVENT, handleCompleted);
    return () =>
      window.removeEventListener(TASK_COMPLETED_EVENT, handleCompleted);
  }, []);

  if (burstKey === null) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
    >
      <CelebrationScene key={burstKey} onDone={() => setBurstKey(null)} />
    </div>
  );
}
