import { getContainer } from '@/lib/cosmos/client';
import type { DeliveryDoc, NotificationDoc } from '@/lib/cosmos/types';
import { fetchAccountDoc } from '@/lib/data/account';
import { channelsFor, type Channel } from './channels';
import { sendEmail } from './channels/email';
import { sendWhatsApp } from './channels/whatsapp';

/**
 * Trigger-agnostic dispatch: enqueue deliveries for recent notifications,
 * then send everything pending. Invoked by the drain route (cron today;
 * an Azure Function on the Cosmos change feed after phase 8). Deliveries
 * embed on the notification doc — idempotency is a per-channel existence
 * check inside the doc, replacing the old unique-key upsert.
 */

// Never blast historical notifications (e.g. on first deploy) or spam
// accounts that opt in long after the event.
const ENQUEUE_WINDOW_HOURS = 24;

const notifications = () => getContainer('notifications');

/** Create a pending delivery per opted-in channel for recent notifications. Idempotent. */
async function enqueue(): Promise<number> {
  const since = new Date(Date.now() - ENQUEUE_WINDOW_HOURS * 3600_000).toISOString();
  const { resources } = await notifications()
    .items.query<NotificationDoc>({
      query: 'SELECT * FROM c WHERE c.createdAt >= @since',
      parameters: [{ name: '@since', value: since }],
    })
    .fetchAll();

  let enqueued = 0;
  for (const note of resources) {
    const account = await fetchAccountDoc(note.accountId);
    if (!account) continue;
    const wanted = channelsFor({
      email_opt_in: account.emailOptIn,
      sms_opt_in: account.smsOptIn,
      whatsapp_opt_in: account.whatsappOptIn,
      whatsapp_consent_at: account.whatsappConsentAt,
    });
    const existing = new Set((note.deliveries ?? []).map((d) => d.channel));
    const missing = wanted.filter((c) => !existing.has(c));
    if (missing.length === 0) continue;
    note.deliveries = [
      ...(note.deliveries ?? []),
      ...missing.map(
        (channel): DeliveryDoc => ({
          channel,
          status: 'pending',
          sentAt: null,
          error: null,
          attempts: 0,
        }),
      ),
    ];
    await notifications().item(note.id, note.accountId).replace(note);
    enqueued += missing.length;
  }
  return enqueued;
}

// date_confirmed bodies are already a full sentence ("Session confirmed: <title>").
function subjectFor(_kind: string, body: string): string {
  return body;
}

/** Send all pending deliveries, marking sent/failed. Failed rows are terminal (attempts tracked for a future retry policy). */
async function sendPending(): Promise<{ sent: number; failed: number }> {
  const { resources } = await notifications()
    .items.query<NotificationDoc>(
      "SELECT * FROM c WHERE EXISTS (SELECT VALUE d FROM d IN c.deliveries WHERE d.status = 'pending')",
    )
    .fetchAll();

  let sent = 0;
  let failed = 0;
  for (const note of resources) {
    const account = await fetchAccountDoc(note.accountId);
    let changed = false;
    for (const delivery of note.deliveries ?? []) {
      if (delivery.status !== 'pending') continue;
      try {
        if (!account) throw new Error('missing recipient account');
        if (delivery.channel === 'email') {
          await sendEmail(account.email, subjectFor(note.kind, note.body), note.body);
        } else if (delivery.channel === 'whatsapp') {
          await sendWhatsApp(account.phone ?? '', '', note.body);
        } else {
          throw new Error(`channel ${delivery.channel satisfies Channel} not implemented`);
        }
        delivery.status = 'sent';
        delivery.sentAt = new Date().toISOString();
        delivery.attempts += 1;
        sent++;
      } catch (e) {
        delivery.status = 'failed';
        delivery.error = String(e);
        delivery.attempts += 1;
        failed++;
      }
      changed = true;
    }
    if (changed) {
      await notifications().item(note.id, note.accountId).replace(note);
    }
  }
  return { sent, failed };
}

export async function drainNotifications(): Promise<{
  enqueued: number;
  sent: number;
  failed: number;
}> {
  const enqueued = await enqueue();
  const { sent, failed } = await sendPending();
  return { enqueued, sent, failed };
}
