'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import type { SprintStatus } from '@/modules/sprints/schemas';
import { updateSprintStatus } from '@/modules/sprints/actions';

const NEXT_STATUS: Record<SprintStatus, SprintStatus | null> = {
  planned: 'active',
  active: 'completed',
  completed: null,
};

const NEXT_LABEL: Record<SprintStatus, string> = {
  planned: 'Start sprint',
  active: 'Complete sprint',
  completed: 'Completed',
};

export function SprintStatusControl({
  sprintId,
  status,
}: {
  sprintId: string;
  status: SprintStatus;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextStatus = NEXT_STATUS[status];

  if (!nextStatus) return null;

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        loading={pending}
        onClick={() => {
          setPending(true);
          setError(null);
          updateSprintStatus({ sprintId, status: nextStatus }).then(
            (result) => {
              setPending(false);
              if (result.ok) {
                router.refresh();
              } else {
                setError(result.error.message);
              }
            },
          );
        }}
        size="sm"
        type="button"
      >
        {NEXT_LABEL[status]}
      </Button>
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
