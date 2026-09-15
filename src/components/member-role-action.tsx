'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { updateMemberRole } from '@/modules/members/actions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function MemberRoleAction({
  userId,
  role,
  isSelf,
}: {
  userId: string;
  role: 'admin' | 'employee';
  isSelf: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextRole = role === 'admin' ? 'employee' : 'admin';
  const label = role === 'admin' ? 'Make employee' : 'Make admin';

  function submit() {
    setPending(true);
    setError(null);
    updateMemberRole(userId, nextRole).then((result) => {
      setPending(false);
      if (result.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error.message);
      }
    });
  }

  return (
    <>
      <div className="flex flex-col items-end gap-1">
        <Button
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          {label}
        </Button>
      </div>

      <Dialog
        onOpenChange={(next) => {
          if (!pending) setOpen(next);
        }}
        open={open}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {role === 'admin' ? 'Remove admin access?' : 'Make an admin?'}
            </DialogTitle>
            <DialogDescription>
              {role === 'admin'
                ? isSelf
                  ? "You'll lose admin access to this organization immediately, including this page."
                  : "They'll lose admin access to this organization immediately."
                : "They'll be able to see and assign every task in this organization, invite others, and manage settings."}
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              disabled={pending}
              onClick={() => setOpen(false)}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button loading={pending} onClick={submit} type="button">
              {label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
