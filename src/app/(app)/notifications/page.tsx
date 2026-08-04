import Link from 'next/link';

import {
  markAllNotificationsRead,
  markNotificationRead,
} from '@/modules/notifications/actions';
import { listMyNotifications } from '@/modules/notifications/queries';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';

export default async function NotificationsPage() {
  const { data: notifications } = await listMyNotifications();

  async function markAllRead() {
    'use server';
    await markAllNotificationsRead();
  }

  return (
    <section aria-labelledby="notifications-heading" className="space-y-6">
      <PageHeader
        action={
          <form action={markAllRead}>
            <Button size="sm" type="submit" variant="outline">
              Mark all read
            </Button>
          </form>
        }
        eyebrow="Inbox"
        headingId="notifications-heading"
        title="Notifications"
      />

      {!notifications || notifications.length === 0 ? (
        <p className="text-base text-muted-foreground">
          You&apos;re all caught up.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {notifications.map((notification) => {
            const isUnread = !notification.read_at;

            async function markRead() {
              'use server';
              await markNotificationRead(notification.id);
            }

            return (
              <li
                className="flex flex-wrap items-start justify-between gap-3 px-5 py-4"
                key={notification.id}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {isUnread ? (
                      <span
                        aria-hidden="true"
                        className="size-2 rounded-full bg-primary"
                      />
                    ) : null}
                    <p
                      className={`text-sm font-semibold ${isUnread ? 'text-foreground' : 'text-muted-foreground'}`}
                    >
                      {notification.title}
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {notification.body}
                  </p>
                  {notification.task_id ? (
                    <Link
                      className="mt-2 inline-block text-sm font-semibold text-primary underline underline-offset-2"
                      href={`/tasks/${notification.task_id}`}
                    >
                      View task
                    </Link>
                  ) : null}
                </div>
                {isUnread ? (
                  <form action={markRead}>
                    <Button size="sm" type="submit" variant="outline">
                      Mark read
                    </Button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
