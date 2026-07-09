# Implementation Plan

## Overview
Show the full campaign roster grouped by response status, with names, on both date proposals (Available / Busy / Not yet voted) and confirmed sessions (Yes / Maybe / No / Not yet responded), referee included. A new `SECURITY DEFINER` RPC supplies the roster; a shared pure helper computes the groups.

---

## Phase 1: Roster RPC + loader + proposal grouping

### Changes

#### 1. Roster RPC migration
**File**: `supabase/migrations/20260709000029_campaign_roster.sql`
**Action**: create

Mirror `get_campaign_party_data` (`20260512000014_review_fixes.sql:143-191`) for the SECURITY DEFINER pattern, but use the member-OR-referee guard from `get_campaign_proposals` (`20260624000028_proposal_guards.sql:135-137`) so the referee (who is not a `campaign_members` row) can also call it. Union members with the referee, exclude the referee from the member select so they appear exactly once, order by `display_name`.

```sql
-- get_campaign_roster: full participant list (members ∪ referee) with names.
-- SECURITY DEFINER because a player cannot enumerate campaign_members via RLS.
create or replace function public.get_campaign_roster(p_campaign_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_campaign_member(p_campaign_id) or public.is_campaign_referee(p_campaign_id)) then
    raise exception 'Not a participant of this campaign';
  end if;

  return coalesce((
    select json_agg(json_build_object(
      'account_id', p.account_id,
      'display_name', acc.display_name,
      'is_referee', p.is_referee
    ) order by acc.display_name)
    from (
      select referee_id as account_id, true as is_referee
      from public.campaigns
      where id = p_campaign_id
      union
      select cm.account_id, false as is_referee
      from public.campaign_members cm
      where cm.campaign_id = p_campaign_id
        and cm.account_id <> (select referee_id from public.campaigns where id = p_campaign_id)
    ) p
    join public.accounts acc on acc.id = p.account_id
  ), '[]'::json);
end;
$$;

revoke execute on function public.get_campaign_roster(uuid) from public;
grant  execute on function public.get_campaign_roster(uuid) to authenticated;
```

#### 2. Roster loader + type + grouping helper
**File**: `apps/web/src/lib/data/roster.ts`
**Action**: create

```ts
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
    if (status === undefined) { notResponded.push(m); continue; }
    (groups[status] ??= []).push(m);
  }
  return { groups, notResponded };
}
```

#### 3. Unit test for `splitRoster`
**File**: `apps/web/src/test/__tests__/roster-grouping.test.ts`
**Action**: create (follows the vitest layout of `use-optional-rules.test.ts`)

Cover: (a) empty responses → everyone in `notResponded`, order preserved; (b) mixed statuses → each member in exactly one group; (c) referee present in roster and grouped/not-grouped correctly; (d) a response referencing an account absent from the roster is ignored (iterate roster, not responses); (e) empty roster → empty groups and empty `notResponded`.

```ts
import { describe, it, expect } from 'vitest';
import { splitRoster, type RosterMember } from '../../lib/data/roster';

const roster: RosterMember[] = [
  { account_id: 'a', display_name: 'Alice', is_referee: true },
  { account_id: 'b', display_name: 'Bob', is_referee: false },
  { account_id: 'c', display_name: 'Cara', is_referee: false },
];

describe('splitRoster', () => {
  it('puts everyone in notResponded when there are no responses', () => {
    const { groups, notResponded } = splitRoster(roster, []);
    expect(Object.keys(groups)).toHaveLength(0);
    expect(notResponded.map(m => m.account_id)).toEqual(['a', 'b', 'c']);
  });

  it('groups by status and preserves order, remainder in notResponded', () => {
    const { groups, notResponded } = splitRoster(roster, [
      { account_id: 'a', status: 'available' as const },
      { account_id: 'c', status: 'busy' as const },
    ]);
    expect(groups.available?.map(m => m.account_id)).toEqual(['a']);
    expect(groups.busy?.map(m => m.account_id)).toEqual(['c']);
    expect(notResponded.map(m => m.account_id)).toEqual(['b']);
  });

  it('ignores responses for accounts not in the roster', () => {
    const { groups, notResponded } = splitRoster(roster, [
      { account_id: 'zzz', status: 'yes' as const },
    ]);
    expect(groups.yes).toBeUndefined();
    expect(notResponded).toHaveLength(3);
  });

  it('handles an empty roster', () => {
    const { groups, notResponded } = splitRoster([], [{ account_id: 'a', status: 'x' as const }]);
    expect(Object.keys(groups)).toHaveLength(0);
    expect(notResponded).toHaveLength(0);
  });
});
```

#### 4. Load roster in ScheduleTab and thread it down
**File**: `apps/web/src/components/campaign/ScheduleTab.tsx`
**Action**: modify

- Add import: `import { loadRoster, type RosterMember } from '@/lib/data/roster';`
- Add state after `sessions` (line 27): `const [roster, setRoster] = useState<RosterMember[]>([]);`
- Add an effect (near the session-load effect, lines 67-79) that reloads the roster when `campaignId` changes:

```ts
useEffect(() => {
  if (!campaignId) return;
  let active = true;
  (async () => {
    const data = await loadRoster(supabase, campaignId);
    if (active) setRoster(data);
  })();
  return () => { active = false; };
}, [supabase, campaignId]);
```

- Pass `roster` into `ProposalsSection` (line 184): add `roster={roster}`.
- Pass `roster` into `SessionList` (line 253-262): add `roster={roster}` (consumed in Phase 2; harmless to add now).

#### 5. Forward roster through ProposalsSection
**File**: `apps/web/src/components/campaign/schedule/ProposalsSection.tsx`
**Action**: modify

- Add import: `import type { RosterMember } from '@/lib/data/roster';`
- Extend the props (line 10-12) with `roster: RosterMember[]` and destructure it.
- Pass `roster={roster}` into `<ProposalList ... />` (lines 137-143).

#### 6. Render grouped names in ProposalList
**File**: `apps/web/src/components/campaign/schedule/ProposalList.tsx`
**Action**: modify

- Add imports: `import { splitRoster, type RosterMember } from '@/lib/data/roster';`
- Add `roster: RosterMember[]` to `ProposalListProps` (lines 7-13); destructure in the component signature (line 22).
- Inside `ordered.map` (lines 36-41), keep `canManage`, `isConfirmed`, `myAvailable`. **Remove** `approved` and `approverNames` (lines 40-41). Add:

```ts
const responses: { account_id: string; status: 'available' | 'busy' }[] =
  proposal.availability.map(a => ({ account_id: a.account_id, status: a.available ? 'available' : 'busy' }));
const { groups, notResponded } = splitRoster(roster, responses);
const available = groups.available ?? [];
const busy = groups.busy ?? [];
```

- Replace the summary `<div>` (lines 82-85) with three named groups, reusing the muted `0.72rem` convention:

```tsx
<div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.6rem', marginBottom: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
  <div>✅ Available ({available.length}/{proposal.participant_count}){available.length > 0 && `: ${available.map(m => m.display_name).join(', ')}`}</div>
  {busy.length > 0 && <div>🚫 Busy: {busy.map(m => m.display_name).join(', ')}</div>}
  {notResponded.length > 0 && <div>⏳ Not yet voted: {notResponded.map(m => m.display_name).join(', ')}</div>}
</div>
```

(The `AvailabilityControl` / `✓ Confirmed` block at lines 86-92 is unchanged — grouped names render above it, including on confirmed proposals.)

#### 7. Documentation (if the function list is maintained)
**File**: `docs/database.md`
**Action**: modify — add `get_campaign_roster` to the DB functions reference alongside the other campaign RPCs. Skip if no such list exists.

### Verification
#### Automated
- [x] `supabase db reset` applies all migrations (incl. `20260709000029_campaign_roster.sql`) with no error
- [x] `get_campaign_roster` verified via psql with fixture data (seed.sql has no campaigns): returns members + referee, each once, ordered by `display_name`, `is_referee` correct — as a player caller AND as the referee (no member row); non-participant raises 'Not a participant of this campaign'
- [x] `pnpm --filter @dolmenwood/web test` passes (new `roster-grouping.test.ts` green — 43/43 tests)
- [x] `pnpm --filter @dolmenwood/web typecheck` passes (after clearing stale `.next/types` from a removed `party` page — pre-existing issue, not caused by this change)
- [x] `pnpm --filter @dolmenwood/web lint` passes

#### Manual
- [ ] Dev server (`pnpm --filter @dolmenwood/web dev`), campaign with a referee + ≥2 players
- [ ] On a proposal with some Available / some Busy / some silent, all three named groups render correctly; the referee appears in the roster
- [ ] Signed in as a **player** (not the referee), the full roster still shows (RLS did not truncate it to just the caller)
- [ ] A brand-new proposal lists everyone under "Not yet voted"
- [ ] A confirmed proposal still shows the grouped names above the "✓ Confirmed" label

---

## Phase 2: Session RSVP grouping

### Changes

#### 1. Render grouped names in SessionList
**File**: `apps/web/src/components/campaign/schedule/SessionList.tsx`
**Action**: modify

- Add imports: `import { splitRoster, type RosterMember } from '@/lib/data/roster';`
- Add `roster: RosterMember[]` to `SessionListProps` (lines 7-14); destructure in the signature (line 35).
- **Remove** the `tally` function (lines 28-33) — it is replaced by the grouped display.
- Inside `ordered.map` (lines 50-53), keep `isPast`, `myStatus`, `canManage`. **Remove** `const counts = tally(session);`. Add:

```ts
const responses = session.rsvps.map(r => ({ account_id: r.account_id, status: r.status }));
const { groups, notResponded } = splitRoster(roster, responses);
const yes = groups.yes ?? [];
const maybe = groups.maybe ?? [];
const no = groups.no ?? [];
```

- Replace the counts summary `<div>` (lines 106-108) with four named groups:

```tsx
<div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.6rem', marginBottom: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
  {yes.length > 0 && <div>✅ Yes: {yes.map(m => m.display_name).join(', ')}</div>}
  {maybe.length > 0 && <div>❔ Maybe: {maybe.map(m => m.display_name).join(', ')}</div>}
  {no.length > 0 && <div>❌ No: {no.map(m => m.display_name).join(', ')}</div>}
  {notResponded.length > 0 && <div>⏳ Not yet responded: {notResponded.map(m => m.display_name).join(', ')}</div>}
</div>
```

(The `roster` prop was already passed from `ScheduleTab` in Phase 1, step 4. `RsvpControl` at line 109 is unchanged.)

### Verification
#### Automated
- [ ] `pnpm --filter @dolmenwood/web test` passes
- [ ] `pnpm --filter @dolmenwood/web typecheck` passes (no unused `tally`/`counts` references remain)
- [ ] `pnpm --filter @dolmenwood/web lint` passes

#### Manual
- [ ] A confirmed session with mixed RSVPs shows Yes / Maybe / No / Not-yet-responded by name
- [ ] A session nobody has responded to lists everyone (incl. referee) under "Not yet responded"
- [ ] Group membership reconciles: total names across the four groups equals the roster size

---

## Notes / Deviations from structure.md
- `splitRoster` returns `Partial<Record<S, RosterMember[]>>` (keys only for statuses that occur) rather than a fully-populated `Record`; callers use `groups.x ?? []`. This avoids needing to know the full status set inside the generic helper.
- No test currently asserts a schema version or migration count, so there are no schema-version test updates to make (the `docs/database.md` function list is documentation, updated in Phase 1 step 7 if present).
- Migration filename `20260709000029_campaign_roster.sql` follows the existing `YYYYMMDD` + 5-digit sequence convention (next after `...028`).
