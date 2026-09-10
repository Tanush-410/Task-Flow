'use client';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from 'cmdk';
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import { navItemsForRole } from '@/lib/nav-items';
import { listPeopleForCommandPalette } from '@/modules/members/actions';
import { searchTasks, type TaskSearchResult } from '@/modules/tasks/actions';
import { Badge } from '@/components/ui/badge';
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

type Person = {
  userId: string;
  displayName: string;
  role: 'admin' | 'employee';
};

export function CommandPalette({
  role,
  planningEnabled,
}: {
  role: 'admin' | 'employee';
  planningEnabled: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [tasks, setTasks] = useState<TaskSearchResult[]>([]);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [, startTransition] = useTransition();
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

  useEffect(() => {
    if (open && role === 'admin' && people === null) {
      listPeopleForCommandPalette().then(setPeople);
    }
  }, [open, role, people]);

  const trimmedQuery = query.trim();

  useEffect(() => {
    if (!open || trimmedQuery.length < 2) {
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startTransition(() => {
        searchTasks(trimmedQuery).then(setTasks);
      });
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [trimmedQuery, open]);

  function close() {
    setOpen(false);
    setQuery('');
    setTasks([]);
  }

  function goTo(href: string) {
    close();
    router.push(href);
  }

  const lowerQuery = trimmedQuery.toLowerCase();
  const pages = navItemsForRole(role, planningEnabled).filter(
    (item) => !lowerQuery || item.label.toLowerCase().includes(lowerQuery),
  );
  const visibleTasks = trimmedQuery.length < 2 ? [] : tasks;
  const visiblePeople = (people ?? []).filter(
    (person) =>
      !lowerQuery || person.displayName.toLowerCase().includes(lowerQuery),
  );

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            aria-label="Search or jump to a page"
            className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            onClick={() => setOpen(true)}
            type="button"
          >
            <Search aria-hidden="true" className="size-[18px]" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Search or jump to (⌘K)</TooltipContent>
      </Tooltip>

      <CommandDialog
        className="flex max-h-[70vh] flex-col"
        contentClassName="fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border-0 bg-glass-bg p-0 shadow-card-lg ring-1 ring-glass-border backdrop-blur-xl backdrop-saturate-150 outline-none sm:max-w-lg"
        label="Command palette"
        onOpenChange={(next) => {
          if (!next) close();
          else setOpen(true);
        }}
        open={open}
        overlayClassName="fixed inset-0 z-50 bg-black/60 backdrop-blur-md"
        shouldFilter={false}
      >
        <div className="flex items-center gap-2 border-b border-glass-border px-4">
          <Search
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground"
          />
          <CommandInput
            autoFocus
            className="h-12 w-full border-none bg-transparent px-0 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            onValueChange={setQuery}
            placeholder="Search tasks, people, or jump to a page…"
            value={query}
          />
        </div>

        <CommandList className="max-h-80 overflow-y-auto p-2">
          <CommandEmpty className="px-3 py-6 text-center text-sm text-muted-foreground">
            No results for &ldquo;{query}&rdquo;.
          </CommandEmpty>

          {pages.length > 0 ? (
            <CommandGroup
              className="px-1 py-1.5 text-xs font-medium text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1.5"
              heading="Pages"
            >
              {pages.map((item) => (
                <CommandItem
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-foreground aria-selected:bg-accent"
                  key={item.href}
                  onSelect={() => goTo(item.href)}
                  value={`page-${item.href}`}
                >
                  <item.icon
                    aria-hidden
                    className="size-4 text-muted-foreground"
                  />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {visibleTasks.length > 0 ? (
            <CommandGroup
              className="px-1 py-1.5 text-xs font-medium text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1.5"
              heading="Tasks"
            >
              {visibleTasks.map((task) => (
                <CommandItem
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm aria-selected:bg-accent"
                  key={task.id}
                  onSelect={() => goTo(`/tasks/${task.id}`)}
                  value={`task-${task.id}`}
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
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {role === 'admin' && visiblePeople.length > 0 ? (
            <CommandGroup
              className="px-1 py-1.5 text-xs font-medium text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1.5"
              heading="People"
            >
              {visiblePeople.map((person) => (
                <CommandItem
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm aria-selected:bg-accent"
                  key={person.userId}
                  onSelect={() =>
                    person.role === 'employee'
                      ? goTo(`/employees/${person.userId}`)
                      : goTo('/employees')
                  }
                  value={`person-${person.userId}`}
                >
                  <span className="text-foreground">{person.displayName}</span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {person.role}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
        </CommandList>

        <div className="flex items-center gap-3 border-t border-glass-border px-4 py-2 text-[11px] text-muted-foreground">
          <span>↑↓ Navigate</span>
          <span>↵ Select</span>
          <span>esc Close</span>
        </div>
      </CommandDialog>
    </>
  );
}
