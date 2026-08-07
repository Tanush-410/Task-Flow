'use client';

import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { createBrowserSupabase } from '@/lib/supabase/browser';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const POLL_INTERVAL_MS = 15_000;

export function NotificationBell({
  userId,
  initialUnreadCount,
}: {
  userId: string;
  initialUnreadCount: number;
}) {
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  // Anything created after this point is "new" and worth a toast; anything
  // before it was already reflected in initialUnreadCount from the SSR load.
  const sinceRef = useRef(new Date().toISOString());

  useEffect(() => {
    if (
      typeof Notification !== 'undefined' &&
      Notification.permission === 'default'
    ) {
      void Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    let cancelled = false;

    // Supabase Realtime's postgres_changes subscription for this project is
    // in a broken state server-side (every subscribe succeeds momentarily
    // then gets torn down with a spurious "invalid column for filter"
    // error, reproduced consistently across publication resets, a replica
    // identity change, and a full project restart) so pop-ups are delivered
    // by polling instead — plenty responsive for a task app, and it doesn't
    // depend on Realtime at all.
    async function poll() {
      const since = sinceRef.current;
      const { data } = await supabase
        .from('task_notifications')
        .select('id,title,body,created_at')
        .eq('recipient_id', userId)
        .gt('created_at', since)
        .order('created_at', { ascending: true });

      if (cancelled || !data || data.length === 0) return;

      sinceRef.current = data[data.length - 1]!.created_at;
      // Only fire an OS-level banner when the tab isn't the one the user is
      // actually looking at — the in-app toast already covers that case,
      // and doubling up would be noisy.
      const showNative =
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted' &&
        document.visibilityState !== 'visible';

      for (const record of data) {
        const title = record.title ?? 'New notification';
        toast(title, { description: record.body });
        if (showNative) {
          const native = new Notification(title, { body: record.body });
          native.onclick = () => {
            window.focus();
            native.close();
          };
        }
      }
      setUnreadCount((count) => count + data.length);
    }

    const interval = setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userId]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : 'Notifications'
          }
          className="relative inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          href="/notifications"
        >
          <Bell aria-hidden="true" className="size-[18px]" />
          {unreadCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </Link>
      </TooltipTrigger>
      <TooltipContent>Notifications</TooltipContent>
    </Tooltip>
  );
}
