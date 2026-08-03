/**
 * Every admin/employee gets a stable, automatically-assigned color + initials
 * derived from their user id — a "tag" that stays consistent everywhere the
 * person shows up (calendar, directory, assignee rollups, notifications)
 * without any settings screen or schema change.
 */

export type PersonTagColor = {
  /** Solid background + white text, for avatars. */
  solidBg: string;
  solidText: string;
  /** Soft background + colored text/border, for calendar chips and legends. */
  softBg: string;
  softText: string;
  softBorder: string;
  /** A plain dot/swatch color, for legends. */
  dot: string;
};

const PALETTE: PersonTagColor[] = [
  {
    solidBg: 'bg-rose-500',
    solidText: 'text-white',
    softBg: 'bg-rose-50',
    softText: 'text-rose-700',
    softBorder: 'border-rose-200',
    dot: 'bg-rose-500',
  },
  {
    solidBg: 'bg-orange-500',
    solidText: 'text-white',
    softBg: 'bg-orange-50',
    softText: 'text-orange-700',
    softBorder: 'border-orange-200',
    dot: 'bg-orange-500',
  },
  {
    solidBg: 'bg-amber-500',
    solidText: 'text-white',
    softBg: 'bg-amber-50',
    softText: 'text-amber-800',
    softBorder: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  {
    solidBg: 'bg-lime-600',
    solidText: 'text-white',
    softBg: 'bg-lime-50',
    softText: 'text-lime-800',
    softBorder: 'border-lime-200',
    dot: 'bg-lime-600',
  },
  {
    solidBg: 'bg-emerald-500',
    solidText: 'text-white',
    softBg: 'bg-emerald-50',
    softText: 'text-emerald-700',
    softBorder: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  {
    solidBg: 'bg-teal-500',
    solidText: 'text-white',
    softBg: 'bg-teal-50',
    softText: 'text-teal-700',
    softBorder: 'border-teal-200',
    dot: 'bg-teal-500',
  },
  {
    solidBg: 'bg-cyan-500',
    solidText: 'text-white',
    softBg: 'bg-cyan-50',
    softText: 'text-cyan-700',
    softBorder: 'border-cyan-200',
    dot: 'bg-cyan-500',
  },
  {
    solidBg: 'bg-sky-500',
    solidText: 'text-white',
    softBg: 'bg-sky-50',
    softText: 'text-sky-700',
    softBorder: 'border-sky-200',
    dot: 'bg-sky-500',
  },
  {
    solidBg: 'bg-blue-500',
    solidText: 'text-white',
    softBg: 'bg-blue-50',
    softText: 'text-blue-700',
    softBorder: 'border-blue-200',
    dot: 'bg-blue-500',
  },
  {
    solidBg: 'bg-indigo-500',
    solidText: 'text-white',
    softBg: 'bg-indigo-50',
    softText: 'text-indigo-700',
    softBorder: 'border-indigo-200',
    dot: 'bg-indigo-500',
  },
  {
    solidBg: 'bg-violet-500',
    solidText: 'text-white',
    softBg: 'bg-violet-50',
    softText: 'text-violet-700',
    softBorder: 'border-violet-200',
    dot: 'bg-violet-500',
  },
  {
    solidBg: 'bg-fuchsia-500',
    solidText: 'text-white',
    softBg: 'bg-fuchsia-50',
    softText: 'text-fuchsia-700',
    softBorder: 'border-fuchsia-200',
    dot: 'bg-fuchsia-500',
  },
];

function hashString(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }

  return Math.abs(hash);
}

export function getInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return '?';
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export type PersonTag = PersonTagColor & { initials: string };

export function getPersonTag(userId: string, displayName: string): PersonTag {
  const color = PALETTE[hashString(userId) % PALETTE.length];

  return { ...color, initials: getInitials(displayName) };
}
