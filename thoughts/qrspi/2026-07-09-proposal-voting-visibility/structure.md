# Structure Outline

## Approach

One foundation — a `SECURITY DEFINER` RPC `get_campaign_roster` plus a `loadRoster()` lib/data wrapper — is loaded once in `ScheduleTab` and threaded as a prop into both response-list components. Each component merges the roster against its existing votes (client-side, via a shared pure helper) to render named groups. Phase 1 builds the foundation and delivers the proposals feature end-to-end; Phase 2 reuses the already-loaded roster for confirmed-session RSVPs. Phase 2 depends on Phase 1 but Phase 1 stands alone if Phase 2 is deferred.

Verification commands (run from repo root):
- SQL: `supabase db reset` (applies all migrations + seed), then query `select public.get_campaign_roster('<campaign_id>')` in Studio.
- Web: `pnpm --filter @dolmenwood/web typecheck`, `pnpm --filter @dolmenwood/web test`, `pnpm --filter @dolmenwood/web lint`, and the dev server for manual UI checks.

---

## Phase 1: Roster RPC + loader + proposal grouping

Adds the roster data source and surfaces it in the date-proposal cards: each proposal shows **Available / Busy / Not yet voted** as named lists, referee included. Delivers the full proposals feature (DB → loader → prop threading → UI).

**Files**:
- `supabase/migrations/20260709000029_campaign_roster.sql` — new migration (next sequence after `...028`)
- `apps/web/src/lib/data/roster.ts` — new loader + type + grouping helper
- `apps/web/src/lib/data/__tests__` or `apps/web/src/test/__tests__/roster-grouping.test.ts` — new unit test (matches existing vitest layout)
- `apps/web/src/components/campaign/ScheduleTab.tsx` — load roster, pass into `ProposalsSection`
- `apps/web/src/components/campaign/schedule/ProposalsSection.tsx` — accept `roster` prop, forward to `ProposalList`
- `apps/web/src/components/campaign/schedule/ProposalList.tsx` — render grouped names

**Key changes**:
- SQL: `create function public.get_campaign_roster(p_campaign_id uuid) returns json` — `SECURITY DEFINER`, membership guard against `campaign_members` (mirror `get_campaign_party_data`, `20260512000014:143-190`), returns `[{account_id, display_name, is_referee}]` for `campaign_members ∪ campaigns.referee_id`, de-duplicated (referee once even if also a member), ordered by `display_name`; `revoke execute from public; grant execute to authenticated`.
- `RosterMember { account_id: string; display_name: string; is_referee: boolean }` — new type
- `loadRoster(supabase: SupabaseClient, campaignId: string): Promise<RosterMember[]>` — thin `supabase.rpc('get_campaign_roster', { p_campaign_id })` wrapper, `[]` on error (mirror `loadProposals`, `proposals.ts:25-29`)
- `splitRoster<S extends string>(roster: RosterMember[], responses: { account_id: string; status: S }[]): { groups: Record<S, RosterMember[]>; notResponded: RosterMember[] }` — pure helper; each roster member lands in exactly one bucket, names ordered by `display_name`
- `ProposalsSection` props gain `roster: RosterMember[]`; `ProposalList` props gain `roster: RosterMember[]`. Inside `ProposalList.map`, replace the single `approverNames` line (`ProposalList.tsx:41, 82-85`) by mapping each proposal's `availability` to `{account_id, status: available ? 'available' : 'busy'}`, calling `splitRoster`, and rendering three muted-text named groups (reuse the `0.72rem` / `var(--color-text-muted)` convention).

**Verify**: `supabase db reset` succeeds and `get_campaign_roster` returns members + referee for a seeded campaign. `pnpm --filter @dolmenwood/web test` (new `splitRoster` unit test covers: all-not-voted, mixed, referee present, voter in exactly one group). `typecheck` + `lint` pass. Manual (dev server, two accounts): as a **player** (not just referee) open a proposal with some available / some busy / some silent — all three named groups render, referee appears, confirmed proposals still show the groups above the "✓ Confirmed" label.

---

## Phase 2: Session RSVP grouping

Reuses the Phase 1 roster to give confirmed sessions named groups: **Yes / Maybe / No / Not yet responded**, replacing the counts-only line. No new data source.

**Files**:
- `apps/web/src/components/campaign/ScheduleTab.tsx` — pass existing `roster` into `SessionList`
- `apps/web/src/components/campaign/schedule/SessionList.tsx` — render grouped names

**Key changes**:
- `SessionList` props gain `roster: RosterMember[]`.
- In `SessionList.map`, feed each session's `rsvps` (`{account_id, status}` where status ∈ `yes|maybe|no`) into `splitRoster` (from Phase 1) and render four muted named groups, replacing the counts-only summary line (`SessionList.tsx:52, 106-108`). Keep the emoji markers (✅/❔/❌ + a "waiting" marker for not-responded).

**Verify**: `pnpm --filter @dolmenwood/web test` / `typecheck` / `lint` pass. Manual: a confirmed session with mixed RSVPs shows Yes/Maybe/No/Not-responded by name; a session nobody has responded to lists everyone (incl. referee) under "Not yet responded"; counts still reconcile with the roster size.

---

## Testing Checkpoints

- **After Phase 1**: `get_campaign_roster` exists and is callable by an authenticated member; `loadRoster` + `splitRoster` are unit-tested; date-proposal cards show Available/Busy/Not-voted by name for both players and referee; web `typecheck`/`test`/`lint` green. Proposals feature is complete and independently valuable.
- **After Phase 2**: confirmed-session cards show Yes/Maybe/No/Not-responded by name using the same roster; no additional RPC calls added; web checks green. Both features complete.

## Notes on slicing
- The RPC + loader is a shared foundation but is delivered *inside* Phase 1's vertical slice (proposals), not as a standalone horizontal layer — Phase 1 is testable end-to-end on its own.
- `splitRoster` is the one piece of pure logic worth an automated unit test; the rest is DB/RLS behavior (verified via `supabase db reset` + a manual two-account check) and presentational JSX.
