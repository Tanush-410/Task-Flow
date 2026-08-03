import Link from 'next/link';

import {
  markAllNotificationsRead,
  markNotificationRead,
} from '@/modules/notifications/actions';
import { listMyNotifications } from '@/modules/notifications/queries';

export default async function NotificationsPage() {
  const { data: notifications } = await listMyNotifications();

  async function markAllRead() {
    'use server';
    await markAllNotificationsRead();
  }

  return (
    <section aria-labelledby="notifications-heading">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Inbox</p>
          <h1
            className="mt-1 text-3xl font-semibold tracking-[-0.035em] text-slate-950"
            id="notifications-heading"
          >
            Notifications
          </h1>
        </div>
        <form action={markAllRead}>
          <button
            className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:border-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
            type="submit"
          >
            Mark all read
          </button>
        </form>
      </div>

      {!notifications || notifications.length === 0 ? (
        <p className="mt-8 text-base text-slate-600">
          You&apos;re all caught up.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
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
                        className="size-2 rounded-full bg-slate-950"
                      />
                    ) : null}
                    <p
                      className={`text-sm font-semibold ${isUnread ? 'text-slate-950' : 'text-slate-500'}`}
                    >
                      {notification.title}
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {notification.body}
                  </p>
                  {notification.task_id ? (
                    <Link
                      className="mt-2 inline-block text-sm font-semibold text-slate-950 underline underline-offset-2"
                      href={`/tasks/${notification.task_id}`}
                    >
                      View task
                    </Link>
                  ) : null}
                </div>
                {isUnread ? (
                  <form action={markRead}>
                    <button
                      className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:border-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
                      type="submit"
                    >
                      Mark read
                    </button>
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
