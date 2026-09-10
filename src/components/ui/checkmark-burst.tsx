/** A circle + check that draw themselves in via stroke-dasharray (see the
 * `.checkmark-circle`/`.checkmark-check` keyframes in globals.css). Purely
 * decorative -- the surrounding text is what actually conveys completion. */
export function CheckmarkBurst({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="checkmark-circle"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        className="checkmark-check"
        d="M7 12.5l3 3 7-7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}
