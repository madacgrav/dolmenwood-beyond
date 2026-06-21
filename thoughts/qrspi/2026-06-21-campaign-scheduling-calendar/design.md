# Design Discussion

Per-campaign scheduling & calendar: members of a campaign post gaming sessions (date/time + title/notes) and RSVP yes/no/maybe, with a shared view of upcoming and past sessions. Decisions below reflect: fixed-sessions+RSVP model, surfaced as a new tab in `/campaign`, any member may create/manage sessions, shown as both an upcoming list and a month grid, with load + manual refresh (no realtime).

## Current State

- No scheduling, calendar, RSVP, or availability tables/UI exist (`research.md` Open Areas). Built from scratch against existing patterns.
- Campaign membership is the join table `campaign_members(campaign_id, account_id, joined_at)`; referee is `campaigns.referee_id`, not a member row (`20260425000001_initial_schema.sql:34-59`).
- Cross-campaign-table RLS uses `SECURITY DEFINER` helpers `is_campaign_member` / `is_campaign_referee` to avoid the documented RLS recursion (`20260425000005_fix_rls_recursion.sql:14-41`).
- Read-with-nested-data uses a `SECURITY DEFINER` RPC that first checks membership then returns nested `json` — `get_campaign_party_data` (`20260512000014_review_fixes.sql:143-191`).
- Simple campaign-scoped writes use direct table calls guarded by RLS — `insertPackAnimal` / `removePackAnimal` (`campaigns.ts:219,246`).
- `/campaign` is a client tabbed page: `TabId` union + `useState`, `tabs` array with optional `refereeOnly`, `visibleTabs` filter, `{activeTab==='x' && <Tab/>}` render (`campaign/page.tsx:8-113`). It self-fetches `accounts.role` for `isReferee` (does not use `useAuthStore`).
- All timestamps are `timestamptz default now()`; mutable tables (`characters`, `accounts`) carry `updated_at` + the `handle_updated_at` trigger; append-only tables omit it (`research.md` Q5/Q2).
- Only date util is `formatWPDate` (`lib/wordpress.ts:50-56`). **No date/calendar library installed** (`package.json:14-26`).
- UI split: `ui/` primitives use Tailwind+`cn()`; feature components use inline `style={{}}` with `var(--color-*)` (`research.md` Q6).

## Desired End State

A "Schedule" tab on `/campaign`, visible to all members (not `refereeOnly`). Members can create a session (title, date/time, optional notes), edit/delete sessions, and set their own RSVP (yes/no/maybe). The tab shows a month-grid calendar and an upcoming-sessions list, each session displaying its RSVP tally and the current user's response. Data loads on tab open and refetches after any mutation.

Verify correct when: a member creates a session and it appears for all members of that campaign (and no others); RSVP changes persist and re-render; a non-member receives an error from the read RPC; deleting a campaign cascades and removes its sessions and RSVPs.

## Patterns to Follow

- **Migration**: `YYYYMMDDNNNNNN_description.sql`, next sequence `…23`. Model the table block on `bank_ledger` (`20260503000006_banking.sql:14-72`) — UUID PK, inline FKs `references … on delete cascade`, `enable row level security` immediately, one policy per command per actor.
- **`updated_at`**: sessions and RSVPs are edited in place → include `updated_at timestamptz default now()` + `set_updated_at` trigger using `handle_updated_at()` (`20260425000001_initial_schema.sql:366-376`).
- **Membership RLS**: use `is_campaign_member(campaign_id)` for member reads/writes and `is_campaign_referee(campaign_id)` for referee override — never inline cross-table subselects (recursion).
- **Nested read RPC**: mirror `get_campaign_party_data` (`20260512000014:143-191`) for `get_campaign_schedule` — membership check first, nested `json` of sessions→rsvps, `revoke … from public; grant … to authenticated`.
- **Mutation RPC**: mirror `join_campaign` (`20260512000014:101-137`) for `set_session_rsvp` — `auth.uid()` as identity, membership guard, upsert.
- **Data layer**: new `lib/data/schedule.ts`, each fn takes `SupabaseClient` first, returns `{data?, error}` with `error.message` (matches `campaigns.ts` / `bank.ts`).
- **Tab registration**: add `{ id:'schedule', label:'📅 Schedule' }` to `campaign/page.tsx` tabs (no `refereeOnly`); render `<ScheduleTab campaignId={…} userId={…} />`.
- **Components**: inline-styled cards with `var(--color-*)`, controlled forms like `CampaignCreateForm` (parent owns state + handlers), modal like `DeleteAccountModal` for delete confirm.

### Patterns to NOT follow

- Do **not** put cross-table `EXISTS(SELECT … FROM other_table)` directly in RLS policies (the original recursion bug, `20260425000005:1-11`).
- Do **not** add a date library or month-grid dependency — build the grid with plain `Date` math, consistent with the dependency-light `package.json`.
- The coarse single-channel realtime in `use-characters.ts` is intentionally **not** reused (user chose manual refresh).

## Design Decisions

1. **Model — fixed sessions + RSVP**: `campaign_sessions` rows hold a concrete `scheduled_at`; `session_rsvps` hold per-member yes/no/maybe. Directly serves "keep track when everyone should be playing" and maps onto existing roles.
2. **Surface — new tab in `/campaign`**: reuses the proven tabbed-page pattern; one line added to the `tabs` array. The unused `/party` stub is left untouched.
3. **Permissions — any member**: create/edit/delete sessions guarded by `is_campaign_member(campaign_id)`; write also requires `created_by = auth.uid()`, with `is_campaign_referee(campaign_id)` OR-ed in for edit/delete so a referee can manage any session. RSVP writes are always scoped to `auth.uid()`.
4. **Display — both list and month grid**: a chronological "upcoming" list (lightweight, matches card pattern) plus a hand-built month grid (plain `Date` math, prev/next month navigation, day cells showing session dots). Both read from the same loaded dataset.
5. **Refresh — load + manual**: `ScheduleTab` calls `loadSchedule()` on mount and re-runs it after each mutation (same pattern as `BankingTab` re-running `loadData()` after a transfer, `BankingTab.tsx:73-77`). No Supabase channel.
6. **Reads via RPC, simple writes via RLS-guarded table calls**: `get_campaign_schedule` RPC returns sessions+RSVPs nested (lets members see each other's responses without RLS recursion); session create/update/delete go through direct table calls under RLS (mirrors `insertPackAnimal`); RSVP upsert goes through `set_session_rsvp` RPC (membership guard + `auth.uid()`).
7. **Date input/format**: native `<input type="datetime-local">` for entry; a new `formatSessionDate` helper (`toLocaleString('en-US', …)`) alongside `formatWPDate`, no library.

## Proposed Schema (for the structure phase)

- `campaign_sessions(id uuid PK, campaign_id uuid → campaigns ON DELETE CASCADE, title text, scheduled_at timestamptz NOT NULL, notes text default '', created_by uuid → accounts, created_at, updated_at)` + index `(campaign_id, scheduled_at)`.
- `session_rsvps(session_id uuid → campaign_sessions ON DELETE CASCADE, account_id uuid → accounts ON DELETE CASCADE, status text CHECK (status IN ('yes','no','maybe')), updated_at, PRIMARY KEY (session_id, account_id))`.

## What We're NOT Doing

- No availability/Doodle-style polling (a date was already chosen as the model).
- No recurring/repeating sessions.
- No calendar export (`.ics`), external-calendar sync, or invitations.
- No push notifications, email reminders, or any reminder/dispatch mechanism (none exists in the codebase).
- No timezone management beyond the browser's locale (`toLocaleString`).
- No Supabase Realtime for the schedule.
- No changes to the `/party` stub or `BottomNav`.

## Open Risks

- **Campaign selection**: a player can belong to multiple campaigns, but the current `/campaign` page passes `userId` and `PlayerView` loads all of them — there is no single "active campaign" id in page state. `ScheduleTab` needs one `campaignId`. Likely fine for a small single-campaign group, but the structure phase must define how `campaignId` is chosen (e.g. a selector when >1, or default to the only membership).
- **Month-grid effort**: hand-building the grid (weeks, leading/trailing days, month nav) is the largest net-new UI surface; the upcoming-list is cheap. If scope tightens, the list ships first.
- **RSVP visibility of past sessions**: decide whether the list/grid show past sessions or only upcoming; affects the RPC query ordering/filter.
- **Concurrent edits**: no realtime means two members can act on stale data; the manual-refresh-after-mutation pattern mitigates but does not eliminate this (acceptable for a small group).
