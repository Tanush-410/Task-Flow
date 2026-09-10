'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

function reducedMotionQuery(): MediaQueryList {
  return window.matchMedia('(prefers-reduced-motion: reduce)');
}

function subscribeReducedMotion(onChange: () => void) {
  const query = reducedMotionQuery();
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/**
 * Fades + slides a section into view the first time it crosses into the
 * viewport. Skips the observer entirely (content just renders visible) if
 * the user prefers reduced motion.
 */
export function ScrollReveal({
  children,
  className = '',
  as = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'ol';
}) {
  const ref = useRef<HTMLDivElement & HTMLOListElement>(null);
  const [intersected, setIntersected] = useState(false);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => reducedMotionQuery().matches,
    () => false,
  );

  useEffect(() => {
    if (reducedMotion) return;
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIntersected(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -80px 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [reducedMotion]);

  const visible = reducedMotion || intersected;
  const Tag = as;

  return (
    <Tag
      className={`transition-all duration-700 ease-out ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
      } ${className}`}
      ref={ref}
    >
      {children}
    </Tag>
  );
}
