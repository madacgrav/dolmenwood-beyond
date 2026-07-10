/** Client-side wrappers over /api/campaigns/[id]/schedule. */

export type RsvpStatus = 'yes' | 'no' | 'maybe';

export interface SessionRsvp {
  account_id: string;
  display_name: string;
  status: RsvpStatus;
}

export interface Session {
  id: string;
  campaign_id: string;
  title: string;
  scheduled_at: string;
  notes: string;
  created_by: string;
  rsvps: SessionRsvp[];
}

type MaybeError = { error: { message: string } | null };

async function errorOf(res: Response): Promise<MaybeError> {
  if (res.ok) return { error: null };
  const body = await res.json().catch(() => null);
  return { error: { message: body?.error ?? `request failed (${res.status})` } };
}

export async function loadSchedule(campaignId: string): Promise<Session[]> {
  const res = await fetch(`/api/campaigns/${campaignId}/schedule`);
  if (!res.ok) return [];
  const body = await res.json();
  return body.sessions ?? [];
}

export async function createSession(input: {
  campaignId: string;
  title: string;
  scheduledAt: string;
  notes: string;
}): Promise<MaybeError> {
  const res = await fetch(`/api/campaigns/${input.campaignId}/schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: input.title, scheduledAt: input.scheduledAt, notes: input.notes }),
  });
  return errorOf(res);
}

export async function setRsvp(
  campaignId: string,
  sessionId: string,
  status: RsvpStatus,
): Promise<MaybeError> {
  const res = await fetch(`/api/campaigns/${campaignId}/schedule/${sessionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rsvp: status }),
  });
  return errorOf(res);
}

export async function updateSession(
  campaignId: string,
  sessionId: string,
  patch: { title: string; scheduledAt: string; notes: string },
): Promise<MaybeError> {
  const res = await fetch(`/api/campaigns/${campaignId}/schedule/${sessionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return errorOf(res);
}

export async function deleteSession(campaignId: string, sessionId: string): Promise<MaybeError> {
  const res = await fetch(`/api/campaigns/${campaignId}/schedule/${sessionId}`, {
    method: 'DELETE',
  });
  return errorOf(res);
}
