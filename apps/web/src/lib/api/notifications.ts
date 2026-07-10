/** Client-side wrappers over /api/notifications. */

export interface AppNotification {
  id: string;
  kind: string;
  body: string;
  related_session_id: string | null;
  read: boolean;
  created_at: string;
}

export async function loadNotifications(): Promise<AppNotification[]> {
  const res = await fetch('/api/notifications');
  if (!res.ok) return [];
  const body = await res.json();
  return body.notifications ?? [];
}

export async function markNotificationRead(
  id: string,
): Promise<{ error: { message: string } | null }> {
  const res = await fetch(`/api/notifications/${id}`, { method: 'PATCH' });
  if (res.ok) return { error: null };
  const body = await res.json().catch(() => null);
  return { error: { message: body?.error ?? `request failed (${res.status})` } };
}
