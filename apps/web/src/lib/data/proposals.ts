import { getContainer } from '@/lib/cosmos/client';
import { requireAccountId } from '@/lib/auth/session';
import {
  assertCampaignParticipant,
  badRequest,
  forbidden,
  isCampaignParticipant,
  notFound,
} from '@/lib/authz';
import type {
  CampaignDoc,
  NotificationDoc,
  ProposalEntryDoc,
  SessionEntryDoc,
} from '@/lib/cosmos/types';
import type { Proposal } from '@/lib/api/proposals';
import { displayNamesFor, replaceCampaignWithRetry } from './campaigns';

/**
 * Server-only date proposals. The auto-confirm chain (upsert availability →
 * all participants approve → status flips, a session is created, and the
 * proposal links to it) happens in ONE campaign-doc replace, so the
 * GUC-guarded trigger from the Postgres era is unnecessary: the ETag loop
 * is the race-safe single-winner claim. Notification fan-out to the
 * participants' partitions follows the successful confirm, best-effort and
 * idempotent (the drain path dedupes per channel inside each doc).
 */

const participantIdsOf = (doc: CampaignDoc): string[] => [
  ...new Set([...doc.members.map((m) => m.accountId), doc.refereeId]),
];

export async function loadProposals(campaignId: string): Promise<Proposal[]> {
  const me = await requireAccountId();
  const doc = await assertCampaignParticipant(campaignId, me);
  const participants = new Set(participantIdsOf(doc));
  const proposals = [...(doc.proposals ?? [])].sort((a, b) =>
    a.scheduledAt.localeCompare(b.scheduledAt),
  );
  const names = await displayNamesFor(
    proposals.flatMap((p) => p.availability.map((a) => a.accountId)),
  );
  return proposals.map((p) => ({
    id: p.id,
    campaign_id: doc.id,
    scheduled_at: p.scheduledAt,
    title: p.title,
    notes: p.notes,
    status: p.status,
    confirmed_session_id: p.confirmedSessionId,
    created_by: p.createdBy,
    // Scope availability to current participants (port of migration 028's fix)
    availability: p.availability
      .filter((a) => participants.has(a.accountId))
      .map((a) => ({
        account_id: a.accountId,
        display_name: names[a.accountId] ?? 'Unknown',
        available: a.available,
      })),
    participant_count: participants.size,
  }));
}

export async function createProposal(
  campaignId: string,
  input: { title: string; scheduledAt: string; notes: string },
): Promise<void> {
  const me = await requireAccountId();
  const title = String(input.title ?? '').trim();
  if (!title) throw badRequest('title is required');
  if (!input.scheduledAt) throw badRequest('scheduled_at is required');
  await replaceCampaignWithRetry(
    campaignId,
    (doc, meId) => {
      if (!isCampaignParticipant(doc, meId)) throw forbidden();
    },
    (doc) => {
      const proposal: ProposalEntryDoc = {
        id: crypto.randomUUID(),
        title,
        scheduledAt: input.scheduledAt,
        notes: String(input.notes ?? ''),
        status: 'open',
        confirmedSessionId: null,
        createdBy: me,
        availability: [],
        createdAt: new Date().toISOString(),
      };
      doc.proposals = [...(doc.proposals ?? []), proposal];
    },
  );
}

export async function deleteProposal(campaignId: string, proposalId: string): Promise<void> {
  const me = await requireAccountId();
  await replaceCampaignWithRetry(
    campaignId,
    () => undefined,
    (doc) => {
      const proposal = (doc.proposals ?? []).find((p) => p.id === proposalId);
      if (!proposal) throw notFound('proposal');
      // Creator or referee (port of the date_proposals RLS)
      if (proposal.createdBy !== me && doc.refereeId !== me) throw forbidden();
      doc.proposals = (doc.proposals ?? []).filter((p) => p.id !== proposalId);
    },
  );
}

/**
 * Port of set_proposal_availability (final version, migration 028):
 * upsert the caller's availability; when every participant has approved an
 * open proposal, confirm it — create the session (attributed to the
 * original proposer), link it, and fan out one notification per
 * participant.
 */
export async function setProposalAvailability(
  campaignId: string,
  proposalId: string,
  available: boolean,
): Promise<void> {
  const me = await requireAccountId();

  // Set per mutate invocation; the final (successful) attempt wins.
  let confirmed: { title: string; sessionId: string; participantIds: string[] } | null = null;

  await replaceCampaignWithRetry(
    campaignId,
    (doc, meId) => {
      if (!isCampaignParticipant(doc, meId)) throw forbidden();
    },
    (doc) => {
      confirmed = null;
      const proposal = (doc.proposals ?? []).find((p) => p.id === proposalId);
      if (!proposal) throw notFound('proposal');

      const existing = proposal.availability.find((a) => a.accountId === me);
      if (existing) {
        existing.available = available;
        existing.updatedAt = new Date().toISOString();
      } else {
        proposal.availability.push({
          accountId: me,
          available,
          updatedAt: new Date().toISOString(),
        });
      }

      if (proposal.status !== 'open') return;
      const participantIds = participantIdsOf(doc);
      const approvals = new Set(
        proposal.availability.filter((a) => a.available).map((a) => a.accountId),
      );
      if (!participantIds.every((id) => approvals.has(id))) return;

      // Everyone is in — confirm and create the session in the same replace.
      const session: SessionEntryDoc = {
        id: crypto.randomUUID(),
        title: proposal.title,
        scheduledAt: proposal.scheduledAt,
        notes: proposal.notes,
        createdBy: proposal.createdBy, // the proposer, not the last approver
        rsvps: [],
        createdAt: new Date().toISOString(),
      };
      doc.sessions = [...(doc.sessions ?? []), session];
      proposal.status = 'confirmed';
      proposal.confirmedSessionId = session.id;
      confirmed = { title: proposal.title, sessionId: session.id, participantIds };
    },
  );

  if (confirmed) {
    await fanOutConfirmationNotifications(campaignId, confirmed);
  }
}

/** Cross-partition, best-effort: a failed insert only costs that recipient. */
async function fanOutConfirmationNotifications(
  campaignId: string,
  confirmed: { title: string; sessionId: string; participantIds: string[] },
): Promise<void> {
  const notifications = getContainer('notifications');
  await Promise.all(
    confirmed.participantIds.map(async (accountId) => {
      const doc: NotificationDoc = {
        id: crypto.randomUUID(),
        accountId,
        campaignId,
        kind: 'date_confirmed',
        body: `Session confirmed: ${confirmed.title}`,
        relatedSessionId: confirmed.sessionId,
        read: false,
        deliveries: [],
        createdAt: new Date().toISOString(),
      };
      try {
        await notifications.items.create(doc);
      } catch (e) {
        console.error(`notification fan-out failed for ${accountId}:`, e);
      }
    }),
  );
}
