'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ActionError } from '@/lib/result';
import { disconnectAzureDevOps } from '@/modules/azure-devops/connections/actions';
import type { AzureDevOpsConnectionView } from '@/modules/azure-devops/connections/queries';

const CONNECT_ENDPOINT = '/api/integrations/azure-devops/connect';

const STATUS_BADGE: Record<
  AzureDevOpsConnectionView['status'],
  { label: string; variant: 'secondary' | 'success' | 'warning' | 'outline' }
> = {
  pending: { label: 'Pending setup', variant: 'secondary' },
  configured: { label: 'Ready for initial import', variant: 'success' },
  paused: { label: 'Reconnect required', variant: 'warning' },
  disconnected: { label: 'Not connected', variant: 'outline' },
};

function DisconnectControl() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ActionError | null>(null);

  async function handleDisconnect() {
    setPending(true);
    setError(null);
    const result = await disconnectAzureDevOps();
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setConfirming(false);
    router.refresh();
  }

  if (!confirming) {
    return (
      <Button
        onClick={() => setConfirming(true)}
        type="button"
        variant="outline"
      >
        Disconnect
      </Button>
    );
  }

  return (
    <div className="w-full space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
      <p className="text-sm text-foreground">
        Disconnecting removes Azure DevOps access for this organization.
        Planning teams and their mappings are preserved and can be reconnected
        later; nothing is deleted.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={pending}
          onClick={handleDisconnect}
          type="button"
          variant="destructive"
        >
          {pending ? 'Disconnecting…' : 'Confirm disconnect'}
        </Button>
        <Button
          disabled={pending}
          onClick={() => setConfirming(false)}
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>{error.message}</AlertTitle>
          <AlertDescription>Reference: {error.traceId}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

export function AzureDevOpsConnectionForm({
  connection,
}: {
  connection: AzureDevOpsConnectionView | null;
}) {
  const status = connection?.status ?? 'disconnected';
  const badge = STATUS_BADGE[status];
  const showConnect = status === 'disconnected';
  const showReconnect = status === 'paused';
  const showDisconnect = status === 'pending' || status === 'configured';

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-medium text-foreground">
            Connection
          </h2>
          {connection ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {connection.authorizedUser.displayName}
              {connection.authorizedUser.email
                ? ` · ${connection.authorizedUser.email}`
                : ''}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Connect an Azure DevOps organization to this workspace.
            </p>
          )}
        </div>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>

      {connection?.organization ? (
        <p className="text-sm text-muted-foreground">
          Organization:{' '}
          <span className="font-medium text-foreground">
            {connection.organization.name}
          </span>
        </p>
      ) : null}

      {status === 'paused' ? (
        <Alert variant="destructive">
          <AlertTitle>Azure DevOps needs to be reconnected</AlertTitle>
          <AlertDescription>
            The stored credential could not be renewed. Reconnect to restore
            access; your team mappings are kept as-is.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {showConnect ? (
          <form action={CONNECT_ENDPOINT} method="POST">
            <Button type="submit">Connect Azure DevOps</Button>
          </form>
        ) : null}
        {showReconnect ? (
          <form action={CONNECT_ENDPOINT} method="POST">
            <Button type="submit">Reconnect Azure DevOps</Button>
          </form>
        ) : null}
        {showDisconnect ? <DisconnectControl /> : null}
      </div>
    </div>
  );
}
