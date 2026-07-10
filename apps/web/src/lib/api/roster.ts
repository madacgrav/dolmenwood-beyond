/**
 * Client-side wrapper over /api/campaigns/[id]/roster, plus the pure
 * roster-grouping helper the schedule UI uses to show who has and hasn't
 * responded. (Ported from the Supabase get_campaign_roster RPC.)
 */

export interface RosterMember {
  account_id: string;
  display_name: string;
  is_referee: boolean;
}

/** Full participant list (members ∪ referee), ordered by display name. */
export async function loadRoster(campaignId: string): Promise<RosterMember[]> {
  const res = await fetch(`/api/campaigns/${campaignId}/roster`);
  if (!res.ok) return [];
  const body = await res.json();
  return body.roster ?? [];
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
