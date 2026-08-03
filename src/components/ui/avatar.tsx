import { getPersonTag } from '@/lib/person-tag';
import { cn } from '@/lib/cn';

const sizeClass = {
  sm: 'size-6 text-[10px]',
  md: 'size-8 text-xs',
  lg: 'size-10 text-sm',
} as const;

export function Avatar({
  userId,
  displayName,
  size = 'md',
  className,
}: {
  userId: string;
  displayName: string;
  size?: keyof typeof sizeClass;
  className?: string;
}) {
  const tag = getPersonTag(userId, displayName);

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        tag.solidBg,
        tag.solidText,
        sizeClass[size],
        className,
      )}
      title={displayName}
    >
      {tag.initials}
    </span>
  );
}
