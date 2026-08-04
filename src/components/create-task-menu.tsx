'use client';

import { ChevronDown } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function dateAt9am(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(9, 0, 0, 0);
  return date.toISOString();
}

function prefillHref(daysFromNow: number): string {
  return `/tasks/new?date=${encodeURIComponent(dateAt9am(daysFromNow))}`;
}

export function CreateTaskMenu() {
  return (
    <div className="flex" data-slot="button-group">
      <Button asChild className="rounded-r-none">
        <Link href="/tasks/new">Create Task</Link>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label="More create options"
            className="rounded-l-none border-l border-primary-foreground/20 px-1.5"
            size="icon"
          >
            <ChevronDown aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href="/tasks/new">Blank task</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={prefillHref(0)}>Due today</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={prefillHref(1)}>Due tomorrow</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
