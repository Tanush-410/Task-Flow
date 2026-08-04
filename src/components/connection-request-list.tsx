'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { roleLandingPath } from '@/modules/auth/navigation';
import { respondToConnectionRequest } from '@/modules/members/connection-actions';
import type { PendingConnectionRequest } from '@/modules/members/queries';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function ConnectionRequestList({
  requests,
}: {
  requests: PendingConnectionRequest[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function respond(requestId: string, accept: boolean) {
    setPendingId(requestId);
    setError(null);

    respondToConnectionRequest({ requestId, accept }).then((result) => {
      setPendingId(null);

      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      if (result.data) {
        router.push(roleLandingPath(result.data.role));
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      <ul className="space-y-2">
        {requests.map((request) => (
          <li key={request.id}>
            <Card className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-4">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {request.organizationName}
                </p>
                <p className="text-sm text-muted-foreground">
                  Invited by {request.invitedByName} as{' '}
                  <span className="capitalize">{request.role}</span>
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  disabled={pendingId === request.id}
                  onClick={() => respond(request.id, true)}
                  size="sm"
                  type="button"
                >
                  Accept
                </Button>
                <Button
                  disabled={pendingId === request.id}
                  onClick={() => respond(request.id, false)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Decline
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
