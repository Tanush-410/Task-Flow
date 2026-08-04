'use client';

import { useRouter, useSearchParams } from 'next/navigation';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SORT_OPTIONS = [
  { value: 'due-asc', label: 'Due soonest' },
  { value: 'due-desc', label: 'Due latest' },
  { value: 'priority', label: 'Priority, high to low' },
  { value: 'newest', label: 'Newest created' },
] as const;

export function TaskSortSelect({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <Select
      defaultValue={defaultValue}
      onValueChange={(value) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value === 'due-asc') {
          params.delete('sort');
        } else {
          params.set('sort', value);
        }
        const query = params.toString();
        router.push(query ? `/tasks?${query}` : '/tasks');
      }}
    >
      <SelectTrigger aria-label="Sort tasks" className="w-[190px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
