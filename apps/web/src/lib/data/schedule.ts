import type { SupabaseClient } from '@supabase/supabase-js';

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
  scheduled_at: string;   // ISO timestamptz
  notes: string;
  created_by: string;
  rsvps: SessionRsvp[];
}

/** Sessions + nested RSVPs for a campaign via the membership-guarded RPC. */
export async function loadSchedule(
  supabase: SupabaseClient,
  campaignId: string,
): Promise<Session[]> {
  const { data, error } = await supabase.rpc('get_campaign_schedule', { p_campaign_id: campaignId });
  if (error || !data) return [];
  return data as Session[];
}

export async function createSession(
  supabase: SupabaseClient,
  input: { campaignId: string; createdBy: string; title: string; scheduledAt: string; notes: string },
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.from('campaign_sessions').insert({
    campaign_id: input.campaignId,
    created_by: input.createdBy,
    title: input.title,
    scheduled_at: input.scheduledAt,   // ISO (caller converts from datetime-local)
    notes: input.notes,
  });
  return { error };
}

export async function setRsvp(
  supabase: SupabaseClient,
  sessionId: string,
  status: RsvpStatus,
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.rpc('set_session_rsvp', { p_session_id: sessionId, p_status: status });
  return { error };
}

export async function updateSession(
  supabase: SupabaseClient,
  id: string,
  patch: { title: string; scheduledAt: string; notes: string },
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.from('campaign_sessions')
    .update({ title: patch.title, scheduled_at: patch.scheduledAt, notes: patch.notes })
    .eq('id', id);
  return { error };
}

export async function deleteSession(
  supabase: SupabaseClient,
  id: string,
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.from('campaign_sessions').delete().eq('id', id);
  return { error };
}
