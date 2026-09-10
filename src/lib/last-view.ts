const PREFIX = 'taskflow:last-view:';
const CHANGE_EVENT = 'taskflow:last-view-changed';

export type ViewMode = 'list' | 'board';

/** Per-viewer convenience only -- never load-bearing, always safe to lose. */
export function getLastView(scope: string): ViewMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(PREFIX + scope);
    return value === 'list' || value === 'board' ? value : null;
  } catch {
    return null;
  }
}

export function setLastView(scope: string, view: ViewMode) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREFIX + scope, view);
  } catch {
    // Ignored -- private browsing / storage blocked. Worst case, the app
    // just always opens to List, same as before this feature existed.
  }
  // The sidebar's nav link lives in a persistent layout that doesn't
  // remount as the user switches views elsewhere, so it needs an explicit
  // nudge to re-read localStorage rather than going stale for the session.
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeLastViewChange(onChange: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}
