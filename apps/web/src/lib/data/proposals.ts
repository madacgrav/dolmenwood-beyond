import type { SupabaseClient } from '@supabase/supabase-js';

export type ProposalStatus = 'open' | 'confirmed' | 'cancelled';

export interface ProposalAvailability {
  account_id: string;
  display_name: string;
  available: boolean;
}

export interface Proposal {
  id: string;
  campaign_id: string;
  scheduled_at: string;   // ISO timestamptz
  title: string;
  notes: string;
  status: ProposalStatus;
  confirmed_session_id: string | null;
  created_by: string;
  availability: ProposalAvailability[];
  participant_count: number;
}

/** Proposals for a campaign via the membership-guarded RPC. */
export async function loadProposals(supabase: SupabaseClient, campaignId: string): Promise<Proposal[]> {
  const { data, error } = await supabase.rpc('get_campaign_proposals', { p_campaign_id: campaignId });
  if (error || !data) return [];
  return data as Proposal[];
}

export async function createProposal(
  supabase: SupabaseClient,
  input: { campaignId: string; createdBy: string; title: string; scheduledAt: string; notes: string },
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.from('date_proposals').insert({
    campaign_id: input.campaignId,
    created_by: input.createdBy,
    title: input.title,
    scheduled_at: input.scheduledAt,   // ISO (caller converts from datetime-local)
    notes: input.notes,
  });
  return { error };
}

export async function deleteProposal(
  supabase: SupabaseClient, id: string,
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.from('date_proposals').delete().eq('id', id);
  return { error };
}

export async function setAvailability(
  supabase: SupabaseClient, proposalId: string, available: boolean,
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.rpc('set_proposal_availability', {
    p_proposal_id: proposalId, p_available: available,
  });
  return { error };
}
