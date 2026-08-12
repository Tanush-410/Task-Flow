'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useRef } from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'epic', label: 'Epics' },
  { value: 'feature', label: 'Features' },
  { value: 'user_story', label: 'User stories' },
  { value: 'task', label: 'Tasks' },
] as const;

const ESTIMATE_OPTIONS = [
  { value: 'all', label: 'All estimates' },
  { value: 'estimated', label: 'Estimated' },
  { value: 'unestimated', label: 'Unestimated' },
] as const;

const SEARCH_DEBOUNCE_MS = 300;

export function BacklogFilters({
  teamId,
  type,
  assigneeId,
  estimateState,
  text,
  assignees,
}: {
  teamId: string;
  type: string;
  assigneeId: string;
  estimateState: string;
  text: string;
  assignees: { userId: string; displayName: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function navigate(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === 'all' || value === '') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    const query = params.toString();
    router.push(
      query
        ? `/planning/teams/${teamId}/backlog?${query}`
        : `/planning/teams/${teamId}/backlog`,
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <Label htmlFor="backlog-filter-text">Search</Label>
        <Input
          className="mt-2 w-56"
          defaultValue={text}
          id="backlog-filter-text"
          onChange={(event) => {
            const value = event.target.value;
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(
              () => navigate({ q: value }),
              SEARCH_DEBOUNCE_MS,
            );
          }}
          placeholder="Search titles"
          type="text"
        />
      </div>

      <div>
        <Label htmlFor="backlog-filter-type">Type</Label>
        <Select
          defaultValue={type}
          onValueChange={(value) => navigate({ type: value })}
        >
          <SelectTrigger className="mt-2 w-40" id="backlog-filter-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="backlog-filter-estimate">Estimate</Label>
        <Select
          defaultValue={estimateState}
          onValueChange={(value) => navigate({ estimateState: value })}
        >
          <SelectTrigger className="mt-2 w-44" id="backlog-filter-estimate">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ESTIMATE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {assignees.length > 0 ? (
        <div>
          <Label htmlFor="backlog-filter-assignee">Assignee</Label>
          <Select
            defaultValue={assigneeId}
            onValueChange={(value) => navigate({ assigneeId: value })}
          >
            <SelectTrigger className="mt-2 w-44" id="backlog-filter-assignee">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Everyone</SelectItem>
              {assignees.map((assignee) => (
                <SelectItem key={assignee.userId} value={assignee.userId}>
                  {assignee.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  );
}
