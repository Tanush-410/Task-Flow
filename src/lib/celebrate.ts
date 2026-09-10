export const TASK_COMPLETED_EVENT = 'taskflow:task-completed';

/**
 * Fired from every surface that marks a task/assignment complete (task
 * detail, board drag-to-complete, quick-complete button). Listened to by
 * `CelebrationHost` (particle burst) and `AmbientBackground` (a brief
 * shader brightness lift) — kept as a plain DOM event rather than React
 * context so the three call sites don't need to be wired into a provider.
 */
export function celebrateTaskCompleted() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(TASK_COMPLETED_EVENT));
}
