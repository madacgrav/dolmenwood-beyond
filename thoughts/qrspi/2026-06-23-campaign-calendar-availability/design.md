# Design Discussion

## Current State

The Schedule tab lets a referee create fixed `campaign_sessions` and members RSVP yes/no/maybe via `session_rsvps` (`supabase/migrations/20260621000023_campaign_scheduling.sql`). Flow: `ScheduleTab.tsx` owns all state, loads via `get_campaign_schedule` RPC, mutates via direct table CRUD (`createSession`/`updateSession`/`deleteSession`) plus the `set_session_rsvp` RPC, and **full-re-fetches after every mutation** (`ScheduleTab.tsx:61–152`). Date entry is a raw `datetime-local` text input (`SessionForm.tsx`).

There is **no proposal/voting concept**, **no in-app notification system**, and **no place that computes "did everyone approve a date."** The referee is stored in `campaigns.referee_id`, *not* as a `campaign_members` row, so any "all participants" set must union the two (research Q3, Cross-Cutting). No outbound email infrastructure exists, and per the decisions below we are **not** adding any.

## Desired End State

1. Any participant can **propose a play date** for a campaign (new `date_proposals`).
2. Each participant marks **free/busy (available / not available)** on each open proposal; the UI shows **who has approved and who has not** (new `proposal_availability`).
3. When **every participant** marks a proposal available, the proposal is atomically **marked confirmed**, a row is **inserted into `campaign_sessions`** (so it appears in the existing calendar/list), and an **in-app notification** is fanned out to every participant.
4. A **notifications table + bell/badge** in the app shell surfaces unread notifications ("Session confirmed for <date>").
5. The date field for proposing (and for `SessionForm`) is a **calendar-grid modal** replacing the raw text input.

**Verify correct when:** a 3-person campaign where all 3 mark a proposal available results in exactly one new `campaign_session`, the proposal flips to `confirmed` once (no duplicates under concurrent approval), and all 3 accounts get one unread notification each; a partially-approved proposal creates no session and no notification.

## Patterns to Follow

- **Per-user write = SECURITY DEFINER RPC, `account_id` hardcoded to `auth.uid()`, `ON CONFLICT DO UPDATE`** — exactly `set_session_rsvp` (migration 23:107–139). Use for `set_proposal_availability`.
- **Cross-user read = SECURITY DEFINER RPC returning `json_agg` with nested rows; table has RLS-on/no-policies** — `get_campaign_schedule` + `session_rsvps` (migration 23:64–101, 47–61). Use for `get_campaign_proposals` + `proposal_availability`.
- **Direct table CRUD with RLS mirroring `campaign_sessions`** (member/referee SELECT; INSERT requires `created_by = auth.uid()`; UPDATE/DELETE creator-or-referee) — migration 23:25–45. Use for `date_proposals`.
- **Atomic multi-step write inside one RPC** — `bank_transaction` rationale (`bank.ts:9`). The confirm path (flip status + insert session + insert notifications) must be one RPC, guarded so only one caller wins.
- **Participant enumeration unions `campaign_members.account_id` with `campaigns.referee_id`** (Cross-Cutting). The "all approved" check counts against this union.
- **`is_campaign_member()` / `is_campaign_referee()` helpers** for guards (migration 5:14–41); every RPC `SECURITY DEFINER`, `set search_path = public`, `REVOKE … FROM public; GRANT … TO authenticated`.
- **Data layer**: `supabase` first arg; reads return `[]`/`null`; writes return `{ error }` (schedule.ts/campaigns.ts conventions, research Q5).
- **Components**: orchestrator owns state, presentational children take props+callbacks, **full re-fetch after mutation** (research Q6).

**Patterns to NOT follow:** the optimistic fire-and-forget pack-animal mutations (`RefereeView.tsx:134–155`, no rollback). Stay with full re-fetch for availability and proposals.

## Design Decisions

1. **Availability calendar with explicit proposals** (chosen over overloading `session_rsvps`): new `date_proposals` (campaign-scoped candidate dates) + `proposal_availability` (per-account boolean). Keeps the existing yes/no/maybe RSVP-to-confirmed-session flow untouched.
2. **Schema**:
   - `date_proposals(id uuid pk, campaign_id fk cascade, scheduled_at timestamptz, title text default '', notes text default '', status text check in ('open','confirmed','cancelled') default 'open', confirmed_session_id uuid null fk→campaign_sessions, created_by fk→accounts, created_at, updated_at)` — `updated_at` via shared trigger.
   - `proposal_availability(proposal_id fk cascade, account_id fk cascade, available boolean not null, updated_at, pk(proposal_id, account_id))` — RLS on, no policies.
   - `notifications(id uuid pk, account_id fk cascade, campaign_id fk cascade null, kind text, body text, related_session_id uuid null, read boolean default false, created_at)` — RLS: account_id = auth.uid() for SELECT/UPDATE (mark read).
3. **Confirm trigger = auto on last approval, server-authoritative & idempotent**: `set_proposal_availability` upserts the caller's row, recomputes approved-vs-participants over the union set, and **iff** all participants are available **and** `status = 'open'`, does a conditional `UPDATE … WHERE status='open'` (only one concurrent caller wins), inserts the `campaign_session`, stores `confirmed_session_id`, and inserts one notification per participant. All in one RPC.
4. **Confirmed date creates a `campaign_session`** so it flows into the existing calendar/list; `confirmed_session_id` links back.
5. **In-app notifications table + bell/badge** in the app shell; no email, no Edge Function, no push/PWA. Badge reads via `get_my_notifications` on load; `mark_notification_read` RPC (or direct update via RLS).
6. **Calendar-modal date picker** (`CalendarDatePicker`) reusing the `SessionCalendar` month-grid look; replaces the `datetime-local` text input in both the new `ProposalForm` and existing `SessionForm` (day from grid + a time field → ISO `scheduled_at`).

## What We're NOT Doing

- No email / SMTP / Resend / Edge Functions / Postgres `pg_net` — explicitly cut.
- No push notifications or PWA service-worker messaging — in-app table+badge only.
- No recurring proposals, time-zone negotiation, or ranked-choice voting.
- Not changing the existing RSVP semantics on confirmed sessions.
- Not letting anyone set another user's availability (server hardcodes `auth.uid()`).
- No realtime subscriptions — notifications load on page load (matches the codebase's no-realtime pattern).

## Open Risks

- **App-shell mount point for the bell/badge** was not traced in research — need to locate the `(app)` layout/header to mount it (touch point, not yet identified).
- **Membership changes mid-vote**: a member joining after others approved re-opens the gap (participant set evaluated at check time). Acceptable, but worth a note in the plan; a leaver could also tip a proposal to "all approved."
- **Concurrent final approvals**: two members approving simultaneously — mitigated by the conditional `UPDATE … WHERE status='open'` so session/notification insert happens exactly once.
- **`scheduled_at` granularity**: calendar modal picks a day; a separate time input supplies the time. Need a default time if omitted.
- **Notification table growth / no read-pruning** — out of scope now, flag for later.
