import type { SupabaseClient } from '@supabase/supabase-js';

export interface RosterMember {
  account_id: string;
  display_name: string;
  is_referee: boolean;
}

/** Full participant list (members ∪ referee) via the membership-guarded RPC. */
export async function loadRoster(supabase: SupabaseClient, campaignId: string): Promise<RosterMember[]> {
  const { data, error } = await supabase.rpc('get_campaign_roster', { p_campaign_id: campaignId });
  if (error || !data) return [];
  return data as RosterMember[];
}

/**
 * Split a roster into response groups + the not-yet-responded remainder.
 * Each member lands in exactly one bucket; roster input order (display_name) is preserved.
 * Responses for accounts absent from the roster are ignored.
 */
export function splitRoster<S extends string>(
  roster: RosterMember[],
  responses: { account_id: string; status: S }[],
): { groups: Partial<Record<S, RosterMember[]>>; notResponded: RosterMember[] } {
  const byId = new Map(responses.map(r => [r.account_id, r.status]));
  const groups: Partial<Record<S, RosterMember[]>> = {};
  const notResponded: RosterMember[] = [];
  for (const m of roster) {
    const status = byId.get(m.account_id);
    if (status === undefined) {
      notResponded.push(m);
      continue;
    }
    (groups[status] ??= []).push(m);
  }
  return { groups, notResponded };
}
