import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AccountDoc, NotificationDoc } from '@/lib/cosmos/types';
import { store, resetFake } from '@/test/cosmos-fake';

const REFEREE = { id: 'ref-1', displayName: 'The Referee' } as AccountDoc;
const ALICE = { id: 'alice-1', displayName: 'Alice' } as AccountDoc;
const BOB = { id: 'bob-1', displayName: 'Bob' } as AccountDoc;
let currentAccount: AccountDoc = REFEREE;

vi.mock('@/lib/auth/session', () => ({
  requireAccountId: async () => currentAccount.id,
  getCurrentAccount: async () => currentAccount,
}));

vi.mock('@/lib/cosmos/client', async () => await import('@/test/cosmos-fake'));

const sentEmails: { to: string; subject: string }[] = [];
vi.mock('@/lib/notifications/channels/email', () => ({
  sendEmail: async (to: string, subject: string) => {
    if (to.includes('bounce')) throw new Error('bounced');
    sentEmails.push({ to, subject });
  },
}));

import { createCampaign, joinCampaign } from '@/lib/data/campaigns';
import { createCharacter } from '@/lib/data/characters';

/** Enrollment is per character: create a throwaway character and join with it. */
async function joinWithNewCharacter(code: string) {
  const { id } = await createCharacter({
    name: 'Joiner',
    kindred: 'Human',
    characterClass: 'Fighter',
    alignment: 'lawful',
    abilityScores: { str: 10, int: 10, wis: 10, dex: 10, con: 10, cha: 10 },
    hpMax: 6,
  });
  await joinCampaign(code, id);
}
import {
  createProposal,
  loadProposals,
  setProposalAvailability,
} from '@/lib/data/proposals';
import { createSession, getCampaignSchedule, setSessionRsvp, deleteSession } from '@/lib/data/schedule';
import { loadNotifications, markNotificationRead } from '@/lib/data/notifications';
import { drainNotifications } from '@/lib/notifications/dispatch';

function seedAccounts(emailOptIn = true) {
  for (const a of [REFEREE, ALICE, BOB]) {
    store('accounts').set(a.id, {
      ...a,
      email: `${a.id}@example.com`,
      emailOptIn,
      smsOptIn: false,
      whatsappOptIn: false,
    });
  }
}

async function setupCampaign(): Promise<string> {
  currentAccount = REFEREE;
  const { id } = await createCampaign('Schedule Camp');
  const code = store('campaigns').get(id)!.inviteCode as string;
  currentAccount = ALICE;
  await joinWithNewCharacter(code);
  currentAccount = BOB;
  await joinWithNewCharacter(code);
  return id;
}

beforeEach(() => {
  resetFake();
  seedAccounts();
  sentEmails.length = 0;
  currentAccount = REFEREE;
});

describe('sessions + RSVPs (port of get_campaign_schedule / set_session_rsvp)', () => {
  it('creates a session, upserts RSVPs with display names, creator-or-referee deletes', async () => {
    const campId = await setupCampaign();
    currentAccount = ALICE;
    await createSession(campId, { title: 'Session 0', scheduledAt: '2026-08-01T18:00:00Z', notes: '' });

    await setSessionRsvp(campId, (await getCampaignSchedule(campId))[0]!.id, 'yes');
    currentAccount = BOB;
    const sessions = await getCampaignSchedule(campId);
    await setSessionRsvp(campId, sessions[0]!.id, 'maybe');
    await setSessionRsvp(campId, sessions[0]!.id, 'no'); // upsert, not duplicate

    const after = await getCampaignSchedule(campId);
    expect(after[0]!.rsvps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ account_id: ALICE.id, display_name: 'Alice', status: 'yes' }),
        expect.objectContaining({ account_id: BOB.id, display_name: 'Bob', status: 'no' }),
      ]),
    );
    expect(after[0]!.rsvps).toHaveLength(2);

    // Bob is not the creator nor referee — cannot delete Alice's session
    await expect(deleteSession(campId, after[0]!.id)).rejects.toMatchObject({ status: 403 });
    currentAccount = REFEREE;
    await deleteSession(campId, after[0]!.id);
    expect(await getCampaignSchedule(campId)).toHaveLength(0);
  });
});

describe('proposal auto-confirm chain (port of set_proposal_availability v4)', () => {
  it('confirms only when ALL participants approve; creates the session and fans out notifications', async () => {
    const campId = await setupCampaign();
    currentAccount = ALICE;
    await createProposal(campId, { title: 'Next Friday?', scheduledAt: '2026-08-07T18:00:00Z', notes: '' });
    const proposalId = (await loadProposals(campId))[0]!.id;

    await setProposalAvailability(campId, proposalId, true);
    currentAccount = BOB;
    await setProposalAvailability(campId, proposalId, true);

    // Referee hasn't approved — still open; only the create-time suggestions
    // exist (Alice proposed → referee + Bob notified, not Alice herself).
    expect((await loadProposals(campId))[0]!.status).toBe('open');
    const kinds = () =>
      [...store('notifications').values()].map((n) => (n as unknown as NotificationDoc).kind);
    expect(kinds().filter((k) => k === 'date_confirmed')).toHaveLength(0);
    expect(kinds().filter((k) => k === 'date_suggested')).toHaveLength(2);
    const suggested = [...store('notifications').values()] as unknown as NotificationDoc[];
    expect(new Set(suggested.map((n) => n.accountId))).toEqual(new Set([REFEREE.id, BOB.id]));
    expect(suggested[0]!.body).toBe('New session date suggested: Next Friday?');

    currentAccount = REFEREE;
    await setProposalAvailability(campId, proposalId, true);

    const confirmed = (await loadProposals(campId))[0]!;
    expect(confirmed.status).toBe('confirmed');
    expect(confirmed.confirmed_session_id).not.toBeNull();
    expect(confirmed.participant_count).toBe(3);

    // The session exists and is attributed to the proposer, not the last approver
    const sessions = await getCampaignSchedule(campId);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.created_by).toBe(ALICE.id);
    expect(sessions[0]!.id).toBe(confirmed.confirmed_session_id);

    // One confirmation notification per participant (plus the 2 suggestions)
    const confirmedNotes = [...store('notifications').values()].filter(
      (n) => (n as unknown as NotificationDoc).kind === 'date_confirmed',
    ) as unknown as NotificationDoc[];
    expect(confirmedNotes).toHaveLength(3);
    expect(new Set(confirmedNotes.map((n) => n.accountId))).toEqual(
      new Set([REFEREE.id, ALICE.id, BOB.id]),
    );
    expect(confirmedNotes[0]!.body).toBe('Session confirmed: Next Friday?');

    // A declined vote flipping later does not re-confirm or duplicate
    currentAccount = BOB;
    await setProposalAvailability(campId, proposalId, false);
    expect(store('notifications').size).toBe(5); // 2 suggested + 3 confirmed
    expect(await getCampaignSchedule(campId)).toHaveLength(1);
  });
});

describe('notification reads + dispatch (Cosmos outbox)', () => {
  it('loadNotifications is partition-scoped; markRead flips the flag', async () => {
    const campId = await setupCampaign();
    currentAccount = ALICE;
    await createProposal(campId, { title: 'T', scheduledAt: '2026-08-07T18:00:00Z', notes: '' });
    const pid = (await loadProposals(campId))[0]!.id;
    await setProposalAvailability(campId, pid, true);
    currentAccount = BOB;
    await setProposalAvailability(campId, pid, true);
    currentAccount = REFEREE;
    await setProposalAvailability(campId, pid, true);

    currentAccount = ALICE;
    const mine = await loadNotifications();
    expect(mine).toHaveLength(1); // only Alice's, not all 3
    await markNotificationRead(mine[0]!.id);
    expect((await loadNotifications())[0]!.read).toBe(true);
  });

  it('drain enqueues per opted-in channel idempotently and sends via Resend', async () => {
    const campId = await setupCampaign();
    // Bob opts out of email
    const bob = store('accounts').get(BOB.id)!;
    store('accounts').set(BOB.id, { ...bob, emailOptIn: false });

    currentAccount = ALICE;
    await createProposal(campId, { title: 'Drain me', scheduledAt: '2026-08-07T18:00:00Z', notes: '' });
    const pid = (await loadProposals(campId))[0]!.id;
    await setProposalAvailability(campId, pid, true);
    currentAccount = BOB;
    await setProposalAvailability(campId, pid, true);
    currentAccount = REFEREE;
    await setProposalAvailability(campId, pid, true);

    const first = await drainNotifications();
    // Referee: date_suggested + date_confirmed; Alice (proposer): date_confirmed
    // only; Bob opted out of email entirely.
    expect(first.enqueued).toBe(3);
    expect(first.sent).toBe(3);
    expect(first.failed).toBe(0);
    expect(sentEmails.map((e) => e.to).sort()).toEqual([
      'alice-1@example.com',
      'ref-1@example.com',
      'ref-1@example.com',
    ]);

    // Second drain: nothing new to enqueue or send
    const second = await drainNotifications();
    expect(second).toEqual({ enqueued: 0, sent: 0, failed: 0 });
    expect(sentEmails).toHaveLength(3);
  });

  it('a failing send marks the delivery failed without blocking others', async () => {
    const campId = await setupCampaign();
    const alice = store('accounts').get(ALICE.id)!;
    store('accounts').set(ALICE.id, { ...alice, email: 'bounce@example.com' });

    currentAccount = ALICE;
    await createProposal(campId, { title: 'Bounce', scheduledAt: '2026-08-07T18:00:00Z', notes: '' });
    const pid = (await loadProposals(campId))[0]!.id;
    await setProposalAvailability(campId, pid, true);
    currentAccount = BOB;
    await setProposalAvailability(campId, pid, true);
    currentAccount = REFEREE;
    await setProposalAvailability(campId, pid, true);

    const result = await drainNotifications();
    expect(result.failed).toBe(1); // alice's bounce (her only note: date_confirmed)
    expect(result.sent).toBe(4); // referee + bob: date_suggested + date_confirmed each

    const aliceNote = [...store('notifications').values()].find(
      (n) => (n as unknown as NotificationDoc).accountId === ALICE.id,
    ) as unknown as NotificationDoc;
    expect(aliceNote.deliveries[0]).toMatchObject({ status: 'failed', attempts: 1 });
    expect(aliceNote.deliveries[0]!.error).toContain('bounced');
  });
});
