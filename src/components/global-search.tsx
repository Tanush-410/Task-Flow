'use client';

import { Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';

import { searchTasks, type TaskSearchResult } from '@/modules/tasks/actions';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

const PRIORITY_VARIANT: Record<
  string,
  'secondary' | 'default' | 'destructive'
> = {
  low: 'secondary',
  medium: 'secondary',
  high: 'default',
  urgent: 'destructive',
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TaskSearchResult[]>([]);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      const isShortcut =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';

      if (isShortcut) {
        event.preventDefault();
        setOpen(true);
      }
    }

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, []);

  const trimmedQuery = query.trim();

  useEffect(() => {
    if (!open || trimmedQuery.length < 2) {
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      startTransition(() => {
        searchTasks(trimmedQuery).then(setResults);
      });
    }, 200);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [trimmedQuery, open]);

  const visibleResults = trimmedQuery.length < 2 ? [] : results;

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            aria-label="Search tasks"
            className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            onClick={() => setOpen(true)}
            type="button"
          >
            <Search aria-hidden="true" className="size-[18px]" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Search tasks (⌘K)</TooltipContent>
      </Tooltip>

      <Dialog
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setQuery('');
            setResults([]);
          }
        }}
        open={open}
      >
        <DialogContent
          className="gap-0 overflow-hidden p-0 sm:max-w-lg"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DialogTitle className="sr-only">Search tasks</DialogTitle>
          <div className="flex items-center gap-2 border-b border-border px-4">
            <Search
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground"
            />
            <Input
              autoFocus
              className="h-12 border-none bg-transparent px-0 shadow-none focus-visible:ring-0"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tasks by title…"
              value={query}
            />
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            {trimmedQuery.length < 2 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Type at least 2 characters to search.
              </p>
            ) : isPending ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Searching…
              </p>
            ) : visibleResults.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No tasks match &ldquo;{query}&rdquo;.
              </p>
            ) : (
              <ul className="space-y-0.5">
                {visibleResults.map((task) => (
                  <li key={task.id}>
                    <Link
                      className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-accent"
                      href={`/tasks/${task.id}`}
                      onClick={() => setOpen(false)}
                    >
                      <span className="min-w-0 truncate font-medium text-foreground">
                        {task.title}
                      </span>
                      <Badge
                        className="shrink-0"
                        variant={PRIORITY_VARIANT[task.priority]}
                      >
                        {PRIORITY_LABELS[task.priority] ?? task.priority}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
