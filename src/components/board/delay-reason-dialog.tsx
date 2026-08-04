'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FieldError } from '@/components/ui/field-error';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function DelayReasonDialog({
  taskTitle,
  pending,
  onCancel,
  onConfirm,
}: {
  taskTitle: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const trimmed = reason.trim();

  return (
    <Dialog onOpenChange={(open) => (open ? null : onCancel())} open>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Report a delay</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Why is “{taskTitle}” delayed?
          </p>
        </DialogHeader>

        <div>
          <Label htmlFor="delay-reason">Reason for delay</Label>
          <Textarea
            className="mt-2"
            disabled={pending}
            id="delay-reason"
            maxLength={2_000}
            onBlur={() => setTouched(true)}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            value={reason}
          />
          {touched && trimmed.length === 0 ? (
            <FieldError>A delay reason is required.</FieldError>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            disabled={pending}
            onClick={onCancel}
            type="button"
            variant="ghost"
          >
            Cancel
          </Button>
          <Button
            disabled={pending || trimmed.length === 0}
            onClick={() => onConfirm(trimmed)}
            type="button"
          >
            {pending ? 'Saving…' : 'Submit delay'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
