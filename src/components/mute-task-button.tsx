'use client';

import { Bell, BellOff } from 'lucide-react';
import { useState, useTransition } from 'react';

import { toggleTaskMute } from '@/modules/notifications/actions';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function MuteTaskButton({
  taskId,
  initialMuted,
}: {
  taskId: string;
  initialMuted: boolean;
}) {
  const [muted, setMuted] = useState(initialMuted);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(() => {
      toggleTaskMute(taskId).then((result) => {
        if (result.ok) {
          setMuted(result.data.muted);
        }
      });
    });
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          disabled={isPending}
          onClick={handleToggle}
          size="sm"
          variant="outline"
        >
          {muted ? <BellOff aria-hidden /> : <Bell aria-hidden />}
          {muted ? 'Muted' : 'Notify me'}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {muted
          ? 'Turn notifications for this task back on'
          : 'Stop in-app notifications for this task'}
      </TooltipContent>
    </Tooltip>
  );
}
