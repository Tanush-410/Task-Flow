'use client';

import { useActionState, useState } from 'react';

import type { ActionResult } from '@/lib/result';
import { deleteOwnAccount } from '@/modules/auth/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const CODE_LENGTH = 6;
// Excludes 0/O and 1/I -- easy to mistype, not worth the confusion.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateConfirmationCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

async function submitDeleteAccount(): Promise<ActionResult<never>> {
  return deleteOwnAccount();
}

export function DeleteAccountCard() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [typed, setTyped] = useState('');
  const [state, formAction, pending] = useActionState(
    submitDeleteAccount,
    null,
  );

  const matches =
    typed.trim().toUpperCase() === code && typed.trim().length > 0;

  function openDialog() {
    setCode(generateConfirmationCode());
    setTyped('');
    setOpen(true);
  }

  return (
    <>
      <Card className="max-w-xl border-destructive/30">
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Permanently delete your account and remove you from your
            organization. This cannot be undone.
          </p>
          <Button
            className="mt-4"
            onClick={openDialog}
            size="sm"
            type="button"
            variant="destructive"
          >
            Delete account
          </Button>
        </CardContent>
      </Card>

      <Dialog
        onOpenChange={(next) => {
          if (!pending) setOpen(next);
        }}
        open={open}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This permanently deletes your account and removes you from your
              organization. Tasks and comments you left behind stay, no longer
              attributed to you. This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Type the code below to confirm:
            </p>
            <p
              aria-live="polite"
              className="rounded-lg bg-muted px-4 py-3 text-center font-mono text-xl font-bold tracking-[0.3em] text-foreground"
            >
              {code}
            </p>
            <div>
              <Label htmlFor="delete-confirm-code">Confirmation code</Label>
              <Input
                autoComplete="off"
                autoFocus
                className="mt-2 text-center font-mono tracking-[0.2em] uppercase"
                disabled={pending}
                id="delete-confirm-code"
                onChange={(event) => setTyped(event.target.value)}
                value={typed}
              />
            </div>
            {state && !state.ok ? (
              <FieldError>{state.error.message}</FieldError>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              disabled={pending}
              onClick={() => setOpen(false)}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <form action={formAction}>
              <Button
                disabled={!matches}
                loading={pending}
                type="submit"
                variant="destructive"
              >
                Permanently delete
              </Button>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
