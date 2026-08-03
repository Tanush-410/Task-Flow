'use client';

import { LogOut } from 'lucide-react';

import { signOut } from '@/modules/auth/actions';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';

export function SignOutMenuItem() {
  return (
    <DropdownMenuItem
      onSelect={() => {
        void signOut();
      }}
      variant="destructive"
    >
      <LogOut aria-hidden />
      Sign out
    </DropdownMenuItem>
  );
}
