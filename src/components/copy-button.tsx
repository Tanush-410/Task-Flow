'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

export function CopyButton({
  value,
  label = 'Copy',
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      onClick={() => {
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      size="sm"
      type="button"
      variant="outline"
    >
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      {copied ? 'Copied' : label}
    </Button>
  );
}
