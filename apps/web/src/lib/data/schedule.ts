import { requireAccountId } from '@/lib/auth/session';
import {
  assertCampaignParticipant,
  badRequest,
  forbidden,
  isCampaignParticipant,
  notFound,
} from '@/lib/authz';
import type { CampaignDoc, SessionEntryDoc } from '@/lib/cosmos/types';
import type { RsvpStatus, Session } from '@/lib/api/schedule';
import { displayNamesFor, replaceCampaignWithRetry } from './campaigns';

/**
 * Server-only session scheduling: sessions (with embedded RSVPs) live on
 * the campaign doc, replacing the get_campaign_schedule/set_session_rsvp
 * RPCs and the RLS-less session_rsvps table.
 */

async function sessionsToUi(doc: CampaignDoc): Promise<Session[]> {
  const sessions = [...(doc.sessions ?? [])].sort((a, b) =>
    a.scheduledAt.localeCompare(b.scheduledAt),
  );
  const names = await displayNamesFor(sessions.flatMap((s) => s.rsvps.map((r) => r.accountId)));
  return sessions.map((s) => ({
    id: s.id,
    campaign_id: doc.id,
    title: s.title,
    scheduled_at: s.scheduledAt,
    notes: s.notes,
    created_by: s.createdBy,
    rsvps: s.rsvps.map((r) => ({
      account_id: r.accountId,
      display_name: names[r.accountId] ?? 'Unknown',
      status: r.status,
    })),
  }));
}

export async function getCampaignSchedule(campaignId: string): Promise<Session[]> {
  const me = await requireAccountId();
  return sessionsToUi(await assertCampaignParticipant(campaignId, me));
}

export async function createSession(
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
      const session: SessionEntryDoc = {
        id: crypto.randomUUID(),
        title,
        scheduledAt: input.scheduledAt,
        notes: String(input.notes ?? ''),
        createdBy: me,
        rsvps: [],
        createdAt: new Date().toISOString(),
      };
      doc.sessions = [...(doc.sessions ?? []), session];
    },
  );
}

/** Creator or referee may edit/delete (port of the campaign_sessions RLS). */
function assertCanEdit(doc: CampaignDoc, session: SessionEntryDoc, meId: string): void {
  if (session.createdBy !== meId && doc.refereeId !== meId) throw forbidden();
}

export async function updateSession(
  campaignId: string,
  sessionId: string,
  patch: { title: string; scheduledAt: string; notes: string },
): Promise<void> {
  const me = await requireAccountId();
  await replaceCampaignWithRetry(
    campaignId,
    () => undefined,
    (doc) => {
      const session = (doc.sessions ?? []).find((s) => s.id === sessionId);
      if (!session) throw notFound('session');
      assertCanEdit(doc, session, me);
      session.title = String(patch.title ?? session.title);
      session.scheduledAt = String(patch.scheduledAt ?? session.scheduledAt);
      session.notes = String(patch.notes ?? session.notes);
    },
  );
}

export async function deleteSession(campaignId: string, sessionId: string): Promise<void> {
  const me = await requireAccountId();
  await replaceCampaignWithRetry(
    campaignId,
    () => undefined,
    (doc) => {
      const session = (doc.sessions ?? []).find((s) => s.id === sessionId);
      if (!session) throw notFound('session');
      assertCanEdit(doc, session, me);
      doc.sessions = (doc.sessions ?? []).filter((s) => s.id !== sessionId);
    },
  );
}

export async function setSessionRsvp(
  campaignId: string,
  sessionId: string,
  status: RsvpStatus,
): Promise<void> {
  if (!['yes', 'no', 'maybe'].includes(status)) throw badRequest('invalid rsvp status');
  const me = await requireAccountId();
  await replaceCampaignWithRetry(
    campaignId,
    (doc, meId) => {
      if (!isCampaignParticipant(doc, meId)) throw forbidden();
    },
    (doc) => {
      const session = (doc.sessions ?? []).find((s) => s.id === sessionId);
      if (!session) throw notFound('session');
      const existing = session.rsvps.find((r) => r.accountId === me);
      if (existing) {
        existing.status = status;
        existing.updatedAt = new Date().toISOString();
      } else {
        session.rsvps.push({ accountId: me, status, updatedAt: new Date().toISOString() });
      }
    },
  );
}
