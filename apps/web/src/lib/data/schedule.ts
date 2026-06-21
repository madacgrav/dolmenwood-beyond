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
