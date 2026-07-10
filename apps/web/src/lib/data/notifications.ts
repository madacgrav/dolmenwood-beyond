import { getContainer } from '@/lib/cosmos/client';
import { requireAccountId } from '@/lib/auth/session';
import { forbidden, notFound } from '@/lib/authz';
import type { NotificationDoc } from '@/lib/cosmos/types';
import type { AppNotification } from '@/lib/api/notifications';

/** Server-only in-app notifications, scoped to the caller's partition. */

const notifications = () => getContainer('notifications');

export async function loadNotifications(): Promise<AppNotification[]> {
  const me = await requireAccountId();
  const { resources } = await notifications()
    .items.query<NotificationDoc>(
      {
        query: 'SELECT * FROM c WHERE c.accountId = @id ORDER BY c.createdAt DESC',
        parameters: [{ name: '@id', value: me }],
      },
      { partitionKey: me },
    )
    .fetchAll();
  return resources.map((n) => ({
    id: n.id,
    kind: n.kind,
    body: n.body,
    related_session_id: n.relatedSessionId,
    read: n.read,
    created_at: n.createdAt,
  }));
}

export async function markNotificationRead(id: string): Promise<void> {
  const me = await requireAccountId();
  const { resource: doc } = await notifications().item(id, me).read<NotificationDoc>();
  if (!doc) throw notFound('notification');
  if (doc.accountId !== me) throw forbidden();
  doc.read = true;
  await notifications().item(id, me).replace(doc);
}
