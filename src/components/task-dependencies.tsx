'use client';

import { CircleCheck, CircleDashed } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import {
  createDependency,
  deleteDependency,
} from '@/modules/dependencies/actions';
import { searchTasks, type TaskSearchResult } from '@/modules/tasks/actions';
import { Input } from '@/components/ui/input';

export type TaskDependencyRow = {
  id: string;
  dependsOnTaskId: string;
  dependsOnTaskTitle: string;
  isSatisfied: boolean;
};

export function TaskDependencies({
  taskId,
  dependencies,
}: {
  taskId: string;
  dependencies: TaskDependencyRow[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TaskSearchResult[]>([]);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trimmedQuery = query.trim();

  useEffect(() => {
    if (trimmedQuery.length < 2) {
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startTransition(() => {
        searchTasks(trimmedQuery).then(setResults);
      });
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [trimmedQuery]);

  const visibleResults = results.filter(
    (result) =>
      result.id !== taskId &&
      !dependencies.some((dep) => dep.dependsOnTaskId === result.id),
  );

  return (
    <div className="space-y-4">
      {dependencies.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          This task has no dependencies.
        </p>
      ) : (
        <ul className="space-y-2">
          {dependencies.map((dependency) => (
            <li
              className="flex items-center gap-2.5 text-sm"
              key={dependency.id}
            >
              {dependency.isSatisfied ? (
                <CircleCheck aria-hidden className="size-4 text-emerald-400" />
              ) : (
                <CircleDashed aria-hidden className="size-4 text-amber-400" />
              )}
              <Link
                className="flex-1 font-medium text-foreground hover:text-primary"
                href={`/tasks/${dependency.dependsOnTaskId}`}
              >
                {dependency.dependsOnTaskTitle}
              </Link>
              {!dependency.isSatisfied ? (
                <span className="text-xs font-semibold text-amber-400">
                  Not done
                </span>
              ) : null}
              <button
                className="text-xs font-semibold text-muted-foreground hover:text-red-400"
                onClick={() => {
                  deleteDependency({ dependencyId: dependency.id }).then(
                    (result) => {
                      if (result.ok) router.refresh();
                    },
                  );
                }}
                type="button"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2">
        <Input
          className="h-9"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search a task this depends on…"
          value={query}
        />
        {trimmedQuery.length >= 2 && !isPending && visibleResults.length > 0 ? (
          <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border p-1.5">
            {visibleResults.map((result) => (
              <li key={result.id}>
                <button
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                  onClick={() => {
                    createDependency({
                      taskId,
                      dependsOnTaskId: result.id,
                    }).then((res) => {
                      if (res.ok) {
                        setQuery('');
                        setResults([]);
                        router.refresh();
                      }
                    });
                  }}
                  type="button"
                >
                  <span className="truncate text-foreground">
                    {result.title}
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-primary">
                    Add
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
