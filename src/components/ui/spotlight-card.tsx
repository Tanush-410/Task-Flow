'use client';

import { useRef, type PointerEvent, type ReactNode } from 'react';

const MAX_TILT_DEG = 5;

/**
 * Wraps a card with a cursor-following radial glow and a subtle 3D tilt
 * toward the pointer. Pure CSS custom properties + a transform, updated
 * imperatively on pointermove (not React state) so it never re-renders.
 * No-ops for touch input (no hover concept) and respects reduced-motion.
 */
export function SpotlightCard({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotionRef = useRef<boolean | null>(null);

  function prefersReducedMotion() {
    if (reducedMotionRef.current === null) {
      reducedMotionRef.current =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return reducedMotionRef.current;
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' || prefersReducedMotion()) return;
    const node = ref.current;
    if (!node) return;

    const rect = node.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const px = x / rect.width;
    const py = y / rect.height;

    node.style.setProperty('--spot-x', `${x}px`);
    node.style.setProperty('--spot-y', `${y}px`);
    node.style.setProperty('--spot-opacity', '1');
    node.style.transform = `perspective(800px) rotateX(${(0.5 - py) * MAX_TILT_DEG}deg) rotateY(${(px - 0.5) * MAX_TILT_DEG}deg)`;
  }

  function handlePointerLeave() {
    const node = ref.current;
    if (!node) return;
    node.style.setProperty('--spot-opacity', '0');
    node.style.transform = '';
  }

  return (
    <div
      className={`relative transition-transform duration-200 ease-out ${className}`}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      ref={ref}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 rounded-xl transition-opacity duration-300"
        style={{
          background:
            'radial-gradient(240px circle at var(--spot-x,50%) var(--spot-y,50%), color-mix(in oklch, var(--primary), transparent 78%), transparent 70%)',
          opacity: 'var(--spot-opacity, 0)',
        }}
      />
      {children}
    </div>
  );
}
