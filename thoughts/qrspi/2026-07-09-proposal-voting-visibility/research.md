# Research Findings

## Q1: Trace the full date-proposal / availability flow — storage, `get_campaign_proposals` return shape, and how it reaches the client

### Findings

**Tables**
- `public.date_proposals` — `supabase/migrations/20260624000024_date_proposals.sql:4-15`. Columns: `id`, `campaign_id` (FK campaigns), `scheduled_at`, `title`, `notes`, `status` (`open`/`confirmed`/`cancelled`), `confirmed_session_id` (FK campaign_sessions), `created_by` (FK accounts), timestamps. RLS: select/insert for members or referee; update/delete for creator or referee (`:25-42`).
- `public.proposal_availability` — one row per `(proposal_id, account_id)` with `available boolean` — `supabase/migrations/20260624000025_proposal_availability.sql:6-12`. RLS enabled but **no policies** (`:4-5`): all reads/writes flow through SECURITY DEFINER RPCs only. So the table cannot be `select`ed directly from the client.

**Write path** — `set_proposal_availability(p_proposal_id, p_available)`, final version `supabase/migrations/20260624000028_proposal_guards.sql:41-125`. Upserts the caller's row (`:70-73`); if the proposal is still `open`, counts participants as `campaign_members ∪ {referee_id}` (`:80-84`) and counts `available=true` rows within that set (`:86-94`); when `approved >= participants > 0` it auto-confirms — flips status to `confirmed` under a guarded update (`:101-103`), inserts a `campaign_sessions` row attributed to the **proposer** `v_created_by` (`:106-108`), stamps `confirmed_session_id`, and fans out `notifications` rows `kind='date_confirmed'` (`:114-121`).

**Read path** — `get_campaign_proposals(p_campaign_id) returns json`, final version `supabase/migrations/20260624000028_proposal_guards.sql:128-179`. Returns a `json_agg` of proposals ordered by proposal `scheduled_at` (`:140`). Each proposal object (`:143-173`) contains all `date_proposals` columns plus:
  - `availability`: array of `{account_id, display_name, available}` — `join public.accounts acc on acc.id = pa.account_id`, ordered by `display_name` (`:151-165`). **Scoped to rows that exist in `proposal_availability` AND belong to current members ∪ referee** — i.e. only people who have already voted.
  - `participant_count`: bare integer count of `campaign_members ∪ {referee_id}` (`:166-172`).
- Grants: `authenticated` only (`20260624000024:76-77`, `20260624000025:48-49`).

**Client layer** — `apps/web/src/lib/data/proposals.ts`:
- Types mirror the RPC JSON exactly: `ProposalAvailability {account_id, display_name, available}` (`:5-9`), `Proposal {...cols, availability: ProposalAvailability[], participant_count: number}` (`:11-22`).
- `loadProposals(supabase, campaignId)` (`:25-29`): `supabase.rpc('get_campaign_proposals', {p_campaign_id})`, casts `data as Proposal[]` with no reshaping; returns `[]` on error.
- `createProposal` (`:31-43`): direct `.from('date_proposals').insert(...)` (not an RPC).
- `deleteProposal` (`:45-50`): direct `.from('date_proposals').delete().eq('id', id)`.
- `setAvailability` (`:52-59`): `supabase.rpc('set_proposal_availability', {p_proposal_id, p_available})`.

**Key fact for this feature:** the `availability` array contains only accounts that have voted (either `available: true` or `false`). Non-voters are never enumerated by name — the only signal about them is the `participant_count` denominator.

## Q2: How the UI renders availability responses; referee vs. player differences

### Findings

Component chain: `page.tsx` → `ScheduleTab` → `ProposalsSection` → `ProposalList` (+ `AvailabilityControl`).
- `apps/web/src/components/campaign/schedule/ProposalsSection.tsx:137-143` fetches via `loadProposals` and renders `<ProposalList proposals userId isReferee onDelete onAvail={handleAvailability} />`.
- Per-proposal computed values in `ProposalList.tsx:39-41`:
  - `myAvailable` = `proposal.availability.find(a => a.account_id === userId)?.available ?? null` — current user's own vote, `null` if not voted.
  - `approved` = `proposal.availability.filter(a => a.available).length` — count of "available" votes only.
  - `approverNames` = `proposal.availability.filter(a => a.available).map(a => a.display_name)` — names of **available** voters only.
- Rendered summary line (`ProposalList.tsx:82-85`): `✅ {approved} / {proposal.participant_count} available` followed by `· {approverNames.join(', ')}` when non-empty.
- **Not shown today:** names of people who voted "Busy" (`available: false` rows are filtered out and never displayed), and anyone who has **not yet voted** (no diff against the roster; only the numeric denominator hints at them).
- Own-vote control: `AvailabilityControl.tsx:13-37` is a two-button `Available`/`Busy` toggle for the current user only; it renders no other participants. When `status === 'confirmed'`, the control is replaced by a `✓ Confirmed` label (`ProposalList.tsx:86-92`) — no votes can change.
- **Referee vs. player:** the only difference in the scheduling components is `canManage = proposal.created_by === userId || isReferee` (`ProposalList.tsx:37`), which gates the Delete button (`:61-74`). The availability display is identical for both roles. `ProposalForm.tsx` is create-only (no proposal edit flow is wired).

Props origin: `userId`/`isReferee` resolved in `page.tsx:17-31` (see Q3) and passed straight through `ScheduleTab.tsx:184` into `ProposalsSection`.

## Q3: How campaign membership / the full roster is determined and where it's loaded

### Findings

**Schema** — membership is a plain join table with **no per-campaign role column**:
- `public.accounts` — `supabase/migrations/20260425000001_initial_schema.sql:8-15`. `role` (`player`/`referee`) is an **account-level** flag, not campaign-specific.
- `public.campaigns` — `:34-40`. The referee is `campaigns.referee_id` — a column, **not** a `campaign_members` row.
- `public.campaign_members` — `:54-59`. Columns: `campaign_id`, `account_id`, `joined_at`, PK `(campaign_id, account_id)`. No role/status column in any migration.
- Therefore the "complete roster" = `campaign_members.account_id ∪ campaigns.referee_id`. RPCs compute this union but only ever return a **count** (`20260624000028_proposal_guards.sql:80-84, 166-172`). Helper functions `is_campaign_member` / `is_campaign_referee` at `20260425000005_fix_rls_recursion.sql:14-41`.

**A roster-with-names loader exists — but only for the Party/Overview tab, not scheduling:**
- `loadRefereeCampaigns` — `apps/web/src/lib/data/campaigns.ts:66-133`. Embedded join `.from('campaign_members').select('campaign_id, account_id, joined_at, accounts(display_name)')` (`:93-96`). `Member` type `{account_id, display_name, joined_at, characters}` (`:36-41`). Rendered by `overview/MemberList.tsx:15-95`.
- `loadPlayerCampaigns` — `campaigns.ts:140-192`, via RPC `get_campaign_party_data` (`supabase/migrations/20260512000014_review_fixes.sql:143-190`, joins `campaign_members` → `accounts`). Rendered by `overview/PartyRoster.tsx:11-96`.
- Both **exclude the referee** (referee isn't in `campaign_members`). Both are wired only through `OverviewTab` (the "⚔️ Party" tab, `page.tsx:100-102`).

**The scheduling area never loads the full roster with names.** `ScheduleTab.tsx:52` loads only `campaigns(id, name)`. `get_campaign_schedule` (`20260621000023_campaign_scheduling.sql:64-101`) and `get_campaign_proposals` only return accounts that have already RSVP'd / voted, plus a numeric count. No file under `components/campaign/schedule/` or `lib/data/schedule.ts`/`proposals.ts` queries `campaign_members` joined to `accounts.display_name`.

**`userId`/`isReferee` resolution** — `page.tsx:17-31`: `userId` = `supabase.auth.getUser()` id; `isReferee` = `accounts.role === 'referee'` (account-level). Passed to `ScheduleTab` at `page.tsx:118-119`, forwarded to `ProposalsSection` (`ScheduleTab.tsx:184`) and `SessionList` (`:257-258`).

## Q4: UI refresh pattern after casting/changing availability

### Findings

- `ProposalsSection.tsx` is a client component holding proposals in local state (`useState<Proposal[]>([])`, `:14`). Initial load via `useEffect` calling `loadProposals` once on mount/campaign-change (`:34-42`).
- `refetch` = `useCallback` re-running `loadProposals` and replacing the whole array (`:29-32`).
- `handleAvailability` (`:82-89`): calls `setAvailability`, and on success does a **full `refetch()`** plus `onConfirmed?.()` (so the parent refreshes its sessions list, since auto-confirm may have created a session). `handleSubmit` (create) and `handleConfirmDelete` (delete) follow the same mutate-then-`refetch()` pattern.
- **No optimistic updates** anywhere — every mutation is followed by a full re-query of `get_campaign_proposals`.
- **No Supabase realtime subscription in the schedule area.** Repo-wide, the only `.channel(...)`/`postgres_changes` usage is `apps/web/src/hooks/use-characters.ts:33-34` (unrelated). No polling interval exists in `ProposalsSection.tsx`.
- **Consequence:** another user's tab does not see proposal/availability changes until it performs its own fresh `loadProposals` (e.g. on next mount/navigation). No live push.

## Q5: Conventions for rendering people/status/badge lists — RSVP display on confirmed sessions (the analog)

### Findings

`SessionList.tsx` (confirmed sessions, `campaign_sessions` + `session_rsvps`) is the closest analog to `ProposalList.tsx`:
- RSVP tally (`SessionList.tsx:28-33`): `session.rsvps.reduce(...)` into `{yes, no, maybe}` counts.
- Own status (`:53`): `session.rsvps.find(r => r.account_id === userId)?.status ?? null`.
- Rendered summary (`:106-108`): `✅ {counts.yes} · ❔ {counts.maybe} · ❌ {counts.no}` — **counts only, no voter names for any status** (unlike proposals, which show approver names). This is the one structural difference between the two features.
- `RsvpControl.tsx:16-40` = three-way own-vote toggle (`Yes`/`Maybe`/`No`).
- `canManage = session.created_by === userId || isReferee` (`:54`) gates Edit + Delete (`:75-98`); proposals expose only Delete.

**Shared styling conventions (no Tailwind — inline `style={{}}` with CSS custom properties):**
- Card: `var(--color-surface)`, `1px solid var(--color-border)`, `borderRadius: 10px`, `padding: 0.875rem 1rem` — `ProposalList.tsx:45-50` ≈ `SessionList.tsx:58-64`.
- Title `fontWeight:700`/`0.95rem`; date line `0.78rem`/`var(--color-primary)` via `formatSessionDate` from `apps/web/src/lib/format`.
- Summary/tally line: `fontSize:0.72rem`, `color: var(--color-text-muted)`, emoji-prefixed — `ProposalList.tsx:82-85` / `SessionList.tsx:106-108`.
- Own-vote toggle pill row (`AvailabilityControl.tsx:13-37`, `RsvpControl.tsx:16-40`): `flex:1` buttons, `gap:0.375rem`; active = solid `var(--color-primary)` + white + `700`; inactive = transparent + `var(--color-text-muted)` + `1px solid var(--color-border)`; `minHeight:36px`.
- Delete button uses `color: var(--color-danger)`; empty-state = centered large emoji + muted message.
- **No reusable Badge/Pill component exists** — every status indicator is an inline-styled `div`/`button`.

## Cross-Cutting Observations
- The full participant roster (`campaign_members ∪ referee_id`) is known server-side and used for counts, but only names of **voters** ever cross to the client via `get_campaign_proposals`. Rendering "who hasn't voted" would need a source of member display names, which today lives only in the Overview-tab loaders (`loadRefereeCampaigns` / `get_campaign_party_data`), not in the scheduling data path.
- Proposals already surface approver names (`approverNames`); confirmed-session RSVPs surface only counts. The two features are styled identically but differ in name visibility.
- Mutations are uniformly "call data-layer fn → `await refetch()`"; there is no optimistic UI and no realtime in this area.
- Everything is inline-styled with CSS variables; there is no shared badge primitive to reuse.

## Open Areas
- Whether `proposal.availability` intentionally includes `available: false` rows in all cases: the final RPC (`20260624000028:151-165`) selects all `proposal_availability` rows for current participants regardless of the boolean, so "Busy" votes ARE present in the payload — they're simply filtered out in `ProposalList.tsx`. Confirmed by reading the SQL; not observed at runtime.
- The referee's own availability/RSVP: the referee can vote (participant set includes `referee_id`), and their `display_name` would appear in `availability` if they vote, but the referee is never enumerated as a roster member by the Overview loaders. Not separately verified in UI.
