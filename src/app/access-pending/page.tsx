import { AuthCard, AuthLogo } from '@/components/auth-shell';

export default function AccessPendingPage() {
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
    </AuthCard>
  );
}
