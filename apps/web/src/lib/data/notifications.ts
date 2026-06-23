import type { SupabaseClient } from '@supabase/supabase-js';

export interface AppNotification {
  id: string;
  kind: string;
  body: string;
  related_session_id: string | null;
  read: boolean;
  created_at: string;
}

/** The caller's notifications, newest first (RLS scopes to auth.uid()). */
export async function loadNotifications(supabase: SupabaseClient): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, kind, body, related_session_id, read, created_at')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as AppNotification[];
}

export async function markNotificationRead(
  supabase: SupabaseClient, id: string,
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
  return { error };
}
