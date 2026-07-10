import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AccountDoc, NotificationDoc } from '@/lib/cosmos/types';
import { store, resetFake } from '@/test/cosmos-fake';

const DM = { id: 'dm-1', role: 'referee', displayName: 'The DM' } as AccountDoc;
const ALICE = { id: 'alice-1', role: 'player', displayName: 'Alice' } as AccountDoc;
const BOB = { id: 'bob-1', role: 'player', displayName: 'Bob' } as AccountDoc;
let currentAccount: AccountDoc = DM;

vi.mock('@/lib/auth/session', () => ({
  requireAccountId: async () => currentAccount.id,
  getCurrentAccount: async () => currentAccount,
}));

vi.mock('@/lib/cosmos/client', async () => await import('@/test/cosmos-fake'));

vi.mock('@/lib/notifications/channels/email', () => ({
  sendEmail: async () => undefined,
}));

const sentWhatsApp: { to: string; body: string }[] = [];
vi.mock('@/lib/notifications/channels/whatsapp', () => ({
  sendWhatsApp: async (to: string, _subject: string, body: string) => {
    if (!to) throw new Error('WhatsApp channel requires a recipient phone number');
    sentWhatsApp.push({ to, body });
  },
}));

import { createCampaign, joinCampaign } from '@/lib/data/campaigns';
import { createProposal, loadProposals, setProposalAvailability } from '@/lib/data/proposals';
import { drainNotifications } from '@/lib/notifications/dispatch';

// DM: whatsapp opted-in + consented with a phone. Alice: opted-in + consented
// but NO phone (delivery must fail without blocking others). Bob: email only.
function seedAccounts() {
  const base = { emailOptIn: true, smsOptIn: false };
  store('accounts').set(DM.id, {
    ...DM,
    email: 'dm@example.com',
    phone: '+15551230000',
    ...base,
    whatsappOptIn: true,
    whatsappConsentAt: '2026-07-01T00:00:00Z',
  });
  store('accounts').set(ALICE.id, {
    ...ALICE,
    email: 'alice@example.com',
    phone: null,
    ...base,
    whatsappOptIn: true,
    whatsappConsentAt: '2026-07-01T00:00:00Z',
  });
  store('accounts').set(BOB.id, {
    ...BOB,
    email: 'bob@example.com',
    phone: '+15551239999',
    ...base,
    whatsappOptIn: false,
    whatsappConsentAt: null,
  });
}

async function setupCampaignAndConfirm(): Promise<void> {
  currentAccount = DM;
  const { id } = await createCampaign('WhatsApp Camp');
  const code = store('campaigns').get(id)!.inviteCode as string;
  currentAccount = ALICE;
  await joinCampaign(code);
  currentAccount = BOB;
  await joinCampaign(code);

  currentAccount = ALICE;
  await createProposal(id, { title: 'Friday?', scheduledAt: '2026-08-07T18:00:00Z', notes: '' });
  const pid = (await loadProposals(id))[0]!.id;
  await setProposalAvailability(id, pid, true);
  currentAccount = BOB;
  await setProposalAvailability(id, pid, true);
  currentAccount = DM;
  await setProposalAvailability(id, pid, true);
}

beforeEach(() => {
  resetFake();
  seedAccounts();
  sentWhatsApp.length = 0;
  currentAccount = DM;
});

describe('whatsapp channel dispatch', () => {
  it('delivers whatsapp to opted-in+consented recipients; missing phone fails without blocking others', async () => {
    await setupCampaignAndConfirm();
    // Notes: suggested → DM + Bob; confirmed → all 3.
    // Email deliveries: DM 2, Alice 1, Bob 2 = 5.
    // WhatsApp deliveries: DM 2 (suggested+confirmed), Alice 1 (confirmed, no
    // phone → fails). Bob: not opted in.
    const result = await drainNotifications();
    expect(result.enqueued).toBe(8);
    expect(result.sent).toBe(7);
    expect(result.failed).toBe(1); // alice's whatsapp (no phone)

    expect(sentWhatsApp.map((m) => m.to)).toEqual(['+15551230000', '+15551230000']);
    expect(sentWhatsApp.map((m) => m.body).sort()).toEqual([
      'New session date suggested: Friday?',
      'Session confirmed: Friday?',
    ]);

    const aliceNote = [...store('notifications').values()].find(
      (n) => (n as unknown as NotificationDoc).accountId === ALICE.id,
    ) as unknown as NotificationDoc;
    const wa = aliceNote.deliveries.find((d) => d.channel === 'whatsapp')!;
    expect(wa).toMatchObject({ status: 'failed', attempts: 1 });
    expect(wa.error).toContain('recipient phone number');
    expect(aliceNote.deliveries.find((d) => d.channel === 'email')).toMatchObject({
      status: 'sent',
    });

    // Idempotent: second drain does nothing new
    expect(await drainNotifications()).toEqual({ enqueued: 0, sent: 0, failed: 0 });
    expect(sentWhatsApp).toHaveLength(2);
  });

  it('opted-in but unconsented accounts get no whatsapp delivery', async () => {
    const alice = store('accounts').get(ALICE.id)!;
    store('accounts').set(ALICE.id, { ...alice, whatsappConsentAt: null });
    await setupCampaignAndConfirm();

    await drainNotifications();
    const aliceNote = [...store('notifications').values()].find(
      (n) => (n as unknown as NotificationDoc).accountId === ALICE.id,
    ) as unknown as NotificationDoc;
    expect(aliceNote.deliveries.map((d) => d.channel)).toEqual(['email']);
  });
});
