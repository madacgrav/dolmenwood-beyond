/** Client-side wrappers over /api/campaigns/[id]/proposals. */

export type ProposalStatus = 'open' | 'confirmed' | 'cancelled';

export interface ProposalAvailability {
  account_id: string;
  display_name: string;
  available: boolean;
}

export interface Proposal {
  id: string;
  campaign_id: string;
  scheduled_at: string;
  title: string;
  notes: string;
  status: ProposalStatus;
  confirmed_session_id: string | null;
  created_by: string;
  availability: ProposalAvailability[];
  participant_count: number;
}

type MaybeError = { error: { message: string } | null };

async function errorOf(res: Response): Promise<MaybeError> {
  if (res.ok) return { error: null };
  const body = await res.json().catch(() => null);
  return { error: { message: body?.error ?? `request failed (${res.status})` } };
}

export async function loadProposals(campaignId: string): Promise<Proposal[]> {
  const res = await fetch(`/api/campaigns/${campaignId}/proposals`);
  if (!res.ok) return [];
  const body = await res.json();
  return body.proposals ?? [];
}

export async function createProposal(input: {
  campaignId: string;
  title: string;
  scheduledAt: string;
  notes: string;
}): Promise<MaybeError> {
  const res = await fetch(`/api/campaigns/${input.campaignId}/proposals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: input.title, scheduledAt: input.scheduledAt, notes: input.notes }),
  });
  return errorOf(res);
}

export async function deleteProposal(campaignId: string, proposalId: string): Promise<MaybeError> {
  const res = await fetch(`/api/campaigns/${campaignId}/proposals/${proposalId}`, {
    method: 'DELETE',
  });
  return errorOf(res);
}

export async function setAvailability(
  campaignId: string,
  proposalId: string,
  available: boolean,
): Promise<MaybeError> {
  const res = await fetch(`/api/campaigns/${campaignId}/proposals/${proposalId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ available }),
  });
  return errorOf(res);
}
