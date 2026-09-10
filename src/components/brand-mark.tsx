const SIZE_CLASSES = {
  sm: 'size-6 text-xs',
  md: 'size-8 text-sm',
} as const;

/**
 * The gold "T" mark, used in the sidebar, auth screens, and landing page.
 * `perspective` on the wrapper plus a Y-axis rotation on hover/focus gives
 * it a subtle 3D flip without pulling in a WebGL canvas for a single glyph.
 */
export function BrandMark({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <span className="inline-block [perspective:400px]">
      <span
        aria-hidden="true"
        className={`brand-mark relative grid place-items-center overflow-hidden rounded-lg bg-[radial-gradient(circle_at_30%_25%,var(--primary-hover),var(--primary)_65%)] font-semibold text-primary-foreground shadow-[0_0_16px_var(--glass-glow)] transition-transform duration-300 ease-out [transform-style:preserve-3d] hover:[transform:rotateY(18deg)_rotateX(6deg)_scale(1.06)] ${SIZE_CLASSES[size]}`}
      >
        T
      </span>
    </span>
  );
}
