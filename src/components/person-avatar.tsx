import { getPersonTag } from '@/lib/person-tag';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const sizeClass = {
  sm: 'size-6 text-[10px]',
  default: 'size-8 text-xs',
  lg: 'size-10 text-sm',
} as const;

export function PersonAvatar({
  userId,
  displayName,
  size = 'default',
  className,
}: {
  userId: string;
  displayName: string;
  size?: keyof typeof sizeClass;
  className?: string;
}) {
  const tag = getPersonTag(userId, displayName);

  return (
    <Avatar className={cn(sizeClass[size], className)} title={displayName}>
      <AvatarFallback
        className={cn(tag.solidBg, tag.solidText, 'font-semibold')}
      >
        {tag.initials}
      </AvatarFallback>
    </Avatar>
  );
}
