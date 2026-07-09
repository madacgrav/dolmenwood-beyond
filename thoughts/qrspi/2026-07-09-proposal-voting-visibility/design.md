# Design Discussion

## Current State

The campaign Schedule tab renders two response-gathering features, both of which show *who responded* only partially:

- **Date proposals** (`ProposalList.tsx`): `get_campaign_proposals` returns an `availability` array of `{account_id, display_name, available}` for everyone who has voted (both `available: true` and `false`), plus a numeric `participant_count` (`supabase/migrations/20260624000028_proposal_guards.sql:143-172`). The UI filters to available votes only — `approverNames = availability.filter(a => a.available).map(a => a.display_name)` (`ProposalList.tsx:41`) — and renders `✅ {approved} / {participant_count} available · {names}` (`ProposalList.tsx:82-85`). **"Busy" voters' names are in the payload but hidden; non-voters are never named.**
- **Confirmed-session RSVPs** (`SessionList.tsx`): `get_campaign_schedule` returns an `rsvps` array for responders only. The UI shows counts only — `✅ {yes} · ❔ {maybe} · ❌ {no}` (`SessionList.tsx:106-108`) — **no names for any status.**

The full participant set (`campaign_members ∪ campaigns.referee_id`) is known server-side and used for `participant_count`, but member display names never reach the schedule area. The only roster-with-names loaders (`loadRefereeCampaigns`, `get_campaign_party_data`) live in the Overview/Party tab and **exclude the referee** (referee isn't a `campaign_members` row). Refresh is manual re-fetch after each mutation (`ProposalsSection.tsx:82-89`); no realtime, no optimistic UI. Styling is inline `style={{}}` with CSS variables; there is no reusable Badge/Pill component.

**RLS constraint (decisive):** a regular player can read only *their own* `campaign_members` row (`20260425000001_initial_schema.sql:63-65`); only referees can enumerate all members (`20260425000005_fix_rls_recursion.sql:56-58`). So the roster cannot be loaded by a direct client join — it needs a `SECURITY DEFINER` RPC, the same pattern `get_campaign_party_data` uses (`20260512000014_review_fixes.sql:143-147`).

## Desired End State

Each date proposal and each confirmed session shows the **full campaign roster grouped by response status, with names**:

- Proposals: **Available** / **Busy** / **Not yet voted** — each a named list.
- Confirmed sessions: **Yes** / **Maybe** / **No** / **Not yet responded** — each a named list.
- The roster includes the **referee** as a participant.

**Verification:** In a campaign with a referee + N players, open a proposal where some voted available, some busy, and some not at all. All three groups list the correct names; the referee appears; a player (not just the referee) sees the same complete roster. The same holds for a confirmed session's RSVP groups. Counts still reconcile with `participant_count`.

## Patterns to Follow

- **`SECURITY DEFINER` roster RPC** — mirror `get_campaign_party_data` (`20260512000014_review_fixes.sql:143-190`): membership guard against `campaign_members`, then join `accounts` for `display_name`, `revoke execute from public; grant to authenticated`. This is the only RLS-safe way to enumerate the roster for players.
- **lib/data loader shape** — mirror `loadProposals` / `loadSchedule` (`proposals.ts:25-29`, `schedule.ts:22-29`): thin wrapper over `supabase.rpc(...)`, typed return, `[]` on error.
- **Load in `ScheduleTab`, pass down as props** — `ScheduleTab` already loads sessions and forwards `userId`/`isReferee` to children (`ScheduleTab.tsx:184, 257-258`). Load the roster once there and pass it into both `ProposalsSection`/`ProposalList` and `SessionList`.
- **Client-side merge** — compute groups in the render components from `roster` + `availability`/`rsvps` (e.g. `notVoted = roster.filter(m => !availability.some(a => a.account_id === m.account_id))`), the same place `myAvailable`/`approverNames` are computed today (`ProposalList.tsx:39-41`).
- **Inline styling with CSS variables** — match the existing summary-line and card conventions (`ProposalList.tsx:82-85`, `SessionList.tsx:106-108`); muted `0.72rem` text, emoji status markers.
- **Mutate → `refetch()`** — no change to the update model (`ProposalsSection.tsx:82-89`).

**Patterns to NOT follow:**
- Do **not** load the roster via a direct `from('campaign_members').select('accounts(display_name)')` join — RLS returns only the caller's row for players (incomplete roster shown silently).
- Do **not** reuse the Overview loaders (`loadRefereeCampaigns` / `get_campaign_party_data`) — they exclude the referee and carry character-roster payload we don't need.

## Design Decisions

1. **Roster source: new `SECURITY DEFINER` RPC + lib/data loader** — Add `get_campaign_roster(p_campaign_id)` returning `[{account_id, display_name, is_referee}]` for `campaign_members ∪ referee_id`, wrapped by `loadRoster()` in a lib/data module. Chosen over extending the voting RPCs so roster logic lives in one place and serves both proposals and RSVPs.
2. **Load once in `ScheduleTab`, merge client-side** — One roster fetch feeds both features. Grouping (voted-by-status vs. not-voted) is computed in `ProposalList` / `SessionList` from roster + the existing availability/rsvp arrays.
3. **Three named groups for proposals, four for RSVPs** — Surface the "Busy" votes already in the payload and the non-voters newly available from the roster. Reuse the existing muted summary-line styling.
4. **Include the referee** — The referee is already a participant (counts toward `participant_count`, can vote), so the RPC unions `referee_id` and flags it via `is_referee`.
5. **Apply to confirmed-session RSVPs too** — Same roster, same grouping treatment in `SessionList`, for consistency.

## What We're NOT Doing

- No Supabase realtime or polling — other users still see changes only on their own re-fetch (unchanged behavior).
- No optimistic UI.
- No changes to the voting/RSVP *write* paths (`set_proposal_availability`, `set_session_rsvp`) or the auto-confirm logic.
- No new notifications, no proposal edit flow, no changes to `participant_count` semantics.
- No new shared Badge/Pill component — keep inline styling consistent with the surrounding code.
- No changes to the Overview/Party tab.

## Open Risks

- **Referee `campaign_members` membership is ambiguous.** Research shows the Overview loaders exclude the referee because they only read `campaign_members`, implying the referee may not have a member row. The new RPC must union `referee_id` explicitly (not rely on membership) and de-duplicate if the referee *is* also a member, so they appear exactly once.
- **Roster/vote de-duplication and ordering.** A participant who voted must appear in exactly one group; ordering within groups should follow `display_name` (matching the RPC's existing `order by acc.display_name`, `20260624000028:156`).
- **Empty/edge states.** A brand-new proposal shows everyone under "Not yet voted"; the empty-roster and single-participant cases should render sensibly.
- **Extra query per Schedule tab load.** One additional RPC call on mount; negligible, but note it loads alongside sessions/proposals.
- **Confirmed proposals.** On a confirmed proposal the availability control is replaced by "✓ Confirmed" (`ProposalList.tsx:86-92`); decide whether the grouped roster still renders there (likely yes, as a record of who responded).
