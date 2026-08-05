'use client';

import { Palette } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

import { NOTE_COLORS, noteSwatchClassName } from './note-colors';

export function ColorSwatchPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          aria-label="Change color"
          onClick={(event) => event.stopPropagation()}
          size="icon"
          type="button"
          variant="ghost"
        >
          <Palette aria-hidden className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-2"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap gap-1.5">
          {NOTE_COLORS.map((color) => (
            <button
              aria-label={color.label}
              aria-pressed={value === color.key}
              className={`size-7 rounded-full ring-1 ring-border transition-transform hover:scale-110 ${noteSwatchClassName(color.key)} ${
                value === color.key
                  ? 'outline-2 outline-offset-2 outline-primary'
                  : ''
              }`}
              key={color.key}
              onClick={() => onChange(color.key)}
              type="button"
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
