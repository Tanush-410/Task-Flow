'use client';

import { useSyncExternalStore } from 'react';

// A one-time read with nothing to subscribe to -- useSyncExternalStore still
// gives the SSR-safe snapshot semantics (an hour-agnostic greeting on the
// server, the real one once mounted client-side), matching the same pattern
// used for WebGL/reduced-motion capability checks elsewhere in this app.
function subscribeNever() {
  return () => {};
}

function getHour(): number {
  return new Date().getHours();
}

function greetingForHour(hour: number): string {
  if (hour < 0) return 'Welcome back';
  if (hour < 5) return 'Working late';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Working late';
}

/** A time-of-day-aware greeting, e.g. "Good morning, Asha". */
export function Greeting({ name }: { name: string }) {
  const hour = useSyncExternalStore(subscribeNever, getHour, () => -1);
  const firstName = name.trim().split(/\s+/)[0] || name;

  return (
    <>
      {greetingForHour(hour)}
      {firstName ? `, ${firstName}` : ''}
    </>
  );
}
