export const NOTE_COLORS = [
  { key: 'default', label: 'Default' },
  { key: 'coral', label: 'Coral' },
  { key: 'peach', label: 'Peach' },
  { key: 'sand', label: 'Sand' },
  { key: 'sage', label: 'Sage' },
  { key: 'fog', label: 'Fog' },
  { key: 'storm', label: 'Storm' },
  { key: 'dusk', label: 'Dusk' },
] as const;

export type NoteColorKey = (typeof NOTE_COLORS)[number]['key'];

const HUE_CLASSNAMES: Record<Exclude<NoteColorKey, 'default'>, string> = {
  coral: 'bg-red-500/15 ring-red-500/25',
  peach: 'bg-orange-500/15 ring-orange-500/25',
  sand: 'bg-amber-500/15 ring-amber-500/25',
  sage: 'bg-emerald-500/15 ring-emerald-500/25',
  fog: 'bg-cyan-500/15 ring-cyan-500/25',
  storm: 'bg-blue-500/15 ring-blue-500/25',
  dusk: 'bg-purple-500/15 ring-purple-500/25',
};

const SWATCH_CLASSNAMES: Record<Exclude<NoteColorKey, 'default'>, string> = {
  coral: 'bg-red-500/60',
  peach: 'bg-orange-500/60',
  sand: 'bg-amber-500/60',
  sage: 'bg-emerald-500/60',
  fog: 'bg-cyan-500/60',
  storm: 'bg-blue-500/60',
  dusk: 'bg-purple-500/60',
};

export function noteCardClassName(color: string): string {
  if (color === 'default' || !(color in HUE_CLASSNAMES)) {
    return '';
  }
  return HUE_CLASSNAMES[color as Exclude<NoteColorKey, 'default'>];
}

export function noteSwatchClassName(color: string): string {
  if (color === 'default' || !(color in SWATCH_CLASSNAMES)) {
    return 'bg-muted';
  }
  return SWATCH_CLASSNAMES[color as Exclude<NoteColorKey, 'default'>];
}
