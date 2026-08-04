import { AuthCard, AuthLogo } from '@/components/auth-shell';
import { ConnectionRequestList } from '@/components/connection-request-list';
import { CopyButton } from '@/components/copy-button';
import {
  getOwnConnectCode,
  listMyConnectionRequests,
} from '@/modules/members/queries';

export default async function AccessPendingPage() {
  const [connectCode, requests] = await Promise.all([
    getOwnConnectCode(),
    listMyConnectionRequests(),
  ]);

  return (
    <AuthCard headingId="access-pending-heading">
      <AuthLogo />
      <h1
        className="text-2xl font-semibold tracking-[-0.03em] text-foreground"
        id="access-pending-heading"
      >
        Access pending
      </h1>
      <p className="mt-3 leading-7 text-muted-foreground">
        Your account is verified, but it is not assigned to an organization yet.
        Ask your organization administrator to grant access.
      </p>

      {connectCode ? (
        <div className="mt-5 rounded-xl border border-border bg-muted/40 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Or share this with your admin so they can add you:
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="flex-1 font-mono text-lg font-semibold tracking-[0.2em] text-foreground">
              {connectCode.connectCode}
            </span>
            <CopyButton label="Copy code" value={connectCode.connectCode} />
          </div>
        </div>
      ) : null}

      {requests.length > 0 ? (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-foreground">
            Pending requests to join
          </h2>
          <div className="mt-2">
            <ConnectionRequestList requests={requests} />
          </div>
        </div>
      ) : null}
    </AuthCard>
  );
}
