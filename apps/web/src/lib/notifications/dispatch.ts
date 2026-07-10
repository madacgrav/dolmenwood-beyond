import type { SupabaseClient } from '@supabase/supabase-js';
import { channelsFor, type Channel } from './channels';
import { sendEmail } from './channels/email';

/**
 * Trigger-agnostic dispatch: enqueue deliveries for recent notifications,
 * then send everything pending. Invoked by the drain route (cron today;
 * an Azure Function on the Cosmos change feed after the DB migration).
 */

// Never blast historical notifications (e.g. on first deploy) or spam
// accounts that opt in long after the event.
const ENQUEUE_WINDOW_HOURS = 24;

interface EnqueueRow {
  id: string;
  accounts: { email_opt_in: boolean; sms_opt_in: boolean; whatsapp_opt_in: boolean } | null;
}

interface PendingRow {
  id: string;
  channel: Channel;
  attempts: number;
  notifications: { kind: string; body: string; accounts: { email: string } | null } | null;
}

/** Create a pending delivery per opted-in channel for recent notifications. Idempotent via the unique key. */
async function enqueue(admin: SupabaseClient): Promise<number> {
  const since = new Date(Date.now() - ENQUEUE_WINDOW_HOURS * 3600_000).toISOString();
  const { data } = await admin
    .from('notifications')
    .select('id, accounts:account_id(email_opt_in, sms_opt_in, whatsapp_opt_in)')
    .gte('created_at', since);
  const notes = (data ?? []) as unknown as EnqueueRow[];

  const rows: { notification_id: string; channel: Channel }[] = [];
  for (const n of notes) {
    if (!n.accounts) continue;
    for (const channel of channelsFor(n.accounts)) {
      rows.push({ notification_id: n.id, channel });
    }
  }
  if (rows.length === 0) return 0;
  await admin
    .from('notification_deliveries')
    .upsert(rows, { onConflict: 'notification_id,channel', ignoreDuplicates: true });
  return rows.length;
}

// date_confirmed bodies are already a full sentence ("Session confirmed: <title>").
function subjectFor(_kind: string, body: string): string {
  return body;
}

/** Send all pending deliveries, marking sent/failed. Failed rows are terminal (attempts tracked for a future retry policy). */
async function sendPending(admin: SupabaseClient): Promise<{ sent: number; failed: number }> {
  const { data } = await admin
    .from('notification_deliveries')
    .select('id, channel, attempts, notifications:notification_id(kind, body, accounts:account_id(email))')
    .eq('status', 'pending');
  const pending = (data ?? []) as unknown as PendingRow[];

  let sent = 0;
  let failed = 0;
  for (const d of pending) {
    try {
      const note = d.notifications;
      if (!note?.accounts) throw new Error('missing notification or recipient');
      if (d.channel === 'email') {
        await sendEmail(note.accounts.email, subjectFor(note.kind, note.body), note.body);
      } else {
        throw new Error(`channel ${d.channel} not implemented`);
      }
      await admin
        .from('notification_deliveries')
        .update({ status: 'sent', sent_at: new Date().toISOString(), attempts: d.attempts + 1 })
        .eq('id', d.id);
      sent++;
    } catch (e) {
      await admin
        .from('notification_deliveries')
        .update({ status: 'failed', error: String(e), attempts: d.attempts + 1 })
        .eq('id', d.id);
      failed++;
    }
  }
  return { sent, failed };
}

export async function drainNotifications(
  admin: SupabaseClient,
): Promise<{ enqueued: number; sent: number; failed: number }> {
  const enqueued = await enqueue(admin);
  const { sent, failed } = await sendPending(admin);
  return { enqueued, sent, failed };
}
