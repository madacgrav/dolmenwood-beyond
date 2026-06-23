# Structure Outline

## Approach
Build the proposal → availability → auto-confirm flow as vertical slices, each crossing migration + data layer + UI and independently testable. Order: (1) proposals CRUD, (2) availability marking + who-approved display, (3) atomic auto-confirm + session creation, (4) notifications table + badge, (5) calendar-modal date picker. Each phase reuses the `set_session_rsvp` / `get_campaign_schedule` templates and the orchestrator-owns-state + full-re-fetch component pattern.

---

## Phase 1: Date proposals — create, list, delete

End-to-end: a participant proposes a candidate date; all members see open proposals in the Schedule tab. No availability yet.

**Files**: `supabase/migrations/2026062400003X_date_proposals.sql` (new), `apps/web/src/lib/data/proposals.ts` (new), `apps/web/src/components/campaign/schedule/ProposalList.tsx` (new), `apps/web/src/components/campaign/schedule/ProposalForm.tsx` (new), `apps/web/src/components/campaign/ScheduleTab.tsx` (wire in).

**Key changes**:
- Table `date_proposals(id, campaign_id fk cascade, scheduled_at timestamptz, title text default '', notes text default '', status text check in ('open','confirmed','cancelled') default 'open', confirmed_session_id uuid null, created_by fk→accounts, created_at, updated_at)` + `updated_at` trigger + RLS mirroring `campaign_sessions` (migration 23:25–45) + index `(campaign_id, scheduled_at)`.
- RPC `get_campaign_proposals(p_campaign_id uuid) returns json` (SECURITY DEFINER, membership guard, `json_agg` ordered by `scheduled_at`) — mirrors `get_campaign_schedule`.
- `interface Proposal { id; campaign_id; scheduled_at: string; title; notes; status: 'open'|'confirmed'|'cancelled'; confirmed_session_id: string|null; created_by; availability: ProposalAvailability[] }` (availability empty until Phase 2).
- `loadProposals(supabase, campaignId): Promise<Proposal[]>` (rpc, `[]` on error); `createProposal(supabase, input): Promise<{error}>` (direct insert); `deleteProposal(supabase, id): Promise<{error}>` (direct delete).

**Verify**: `pnpm --filter web test` passes; `pnpm --filter web build` clean. Manually: propose a date → it appears in the list; delete it (creator/referee) → gone; non-creator player cannot delete.

---

## Phase 2: Mark availability + show who approved

End-to-end: each participant toggles Available/Busy on an open proposal; UI shows per-member status and an "N of M approved" tally. No confirm yet.

**Files**: `supabase/migrations/...availability.sql` (extend Phase-1 migration or new), `apps/web/src/lib/data/proposals.ts`, `apps/web/src/components/campaign/schedule/AvailabilityControl.tsx` (new, mirrors `RsvpControl.tsx`), `ProposalList.tsx`, `ScheduleTab.tsx`.

**Key changes**:
- Table `proposal_availability(proposal_id fk cascade, account_id fk cascade, available boolean not null, updated_at, pk(proposal_id, account_id))` — RLS enabled, **no policies**.
- RPC `set_proposal_availability(p_proposal_id uuid, p_available boolean) returns void` — SECURITY DEFINER, member/referee guard, `INSERT … ON CONFLICT (proposal_id, account_id) DO UPDATE` with `account_id = auth.uid()` (the `set_session_rsvp` template). **No confirm logic yet.**
- `get_campaign_proposals` extended: nest `availability` array (account_id, display_name, available) joined to `accounts`, plus `participant_count` = count over `campaign_members ∪ referee_id`.
- `interface ProposalAvailability { account_id; display_name; available: boolean }`; `setAvailability(supabase, proposalId, available): Promise<{error}>` (rpc).
- `AvailabilityControl({ available: boolean|null; onSet })`; `myAvailability = availability.find(a => a.account_id === userId)?.available ?? null`.

**Verify**: tests + build pass. Manually: each account toggles Available/Busy → status persists after re-fetch; list shows who approved and "N of M"; cannot set another user's availability (verified server-side).

---

## Phase 3: Auto-confirm + create session (atomic, idempotent)

End-to-end: when the last participant marks available, the proposal flips to `confirmed`, a `campaign_session` is created, and it appears in the existing calendar/list.

**Files**: `supabase/migrations/...confirm.sql` (replace `set_proposal_availability` body), `apps/web/src/lib/data/proposals.ts` (no signature change), `ScheduleTab.tsx` (re-fetch sessions too after availability change), `ProposalList.tsx` (show "Confirmed" state).

**Key changes**:
- `set_proposal_availability` extended: after upsert, recompute approved-vs-participants over the union set; **iff** all available **and** `status='open'`, do conditional `UPDATE date_proposals SET status='confirmed', confirmed_session_id=… WHERE id=p AND status='open'` (only one concurrent caller wins via `GET DIAGNOSTICS`/`FOUND`), then `INSERT INTO campaign_sessions(...)` using the proposal's `scheduled_at/title/notes`, write back `confirmed_session_id`. All in one transaction.
- `ScheduleTab.handleAvailability` re-fetches both proposals and sessions (the new session must show in the schedule).

**Verify**: tests + build pass. Manually: 3-person campaign, all 3 mark available → exactly one new `campaign_session`, proposal shows `confirmed` once; partial approval → no session; simulate concurrent final approvals (two quick clicks) → still exactly one session (no duplicate).

---

## Phase 4: In-app notifications table + bell/badge

End-to-end: on confirmation every participant gets a notification row; the app shell shows an unread badge; opening lists messages and marks read.

**Files**: `supabase/migrations/...notifications.sql` (new), `apps/web/src/lib/data/notifications.ts` (new), `apps/web/src/components/notifications/NotificationBell.tsx` (new), the `(app)` layout/header (mount point — **locate during plan**), `set_proposal_availability` (add fan-out insert).

**Key changes**:
- Table `notifications(id uuid pk, account_id fk cascade, campaign_id fk cascade null, kind text, body text, related_session_id uuid null, read boolean default false, created_at)` — RLS: SELECT/UPDATE `account_id = auth.uid()`.
- In the confirm branch of `set_proposal_availability`: `INSERT INTO notifications SELECT … FROM (participant union)` — one row per participant ("Session confirmed for <date>").
- `interface AppNotification { id; kind; body; related_session_id: string|null; read: boolean; created_at: string }`.
- `loadNotifications(supabase): Promise<AppNotification[]>`; `markNotificationRead(supabase, id): Promise<{error}>` (direct update via RLS).
- `NotificationBell` — loads on mount, shows unread count, dropdown list, click → mark read + re-fetch.

**Verify**: tests + build pass. Manually: confirming a date (Phase 3) produces one unread notification per participant; badge count correct; clicking marks read and decrements; another campaign's members get nothing.

---

## Phase 5: Calendar-modal date picker

End-to-end: replace the `datetime-local` text input in `ProposalForm` and `SessionForm` with a calendar-grid modal (day pick) + time field producing ISO `scheduled_at`.

**Files**: `apps/web/src/components/campaign/schedule/CalendarDatePicker.tsx` (new, reuses month-grid look from `SessionCalendar.tsx`), `ProposalForm.tsx`, `SessionForm.tsx`.

**Key changes**:
- `CalendarDatePicker({ value: Date|null; onChange: (d: Date) => void })` — modal overlay (mirror `DeleteSessionModal.tsx` overlay style) with month grid + prev/next; clicking a day selects it.
- `ProposalForm`/`SessionForm`: replace text input with picker button (opens modal) + a separate time `<input type="time">`; combine into ISO via `new Date(...).toISOString()` (existing conversion at `ScheduleTab.tsx:110`).

**Verify**: tests + build pass. Manually: open proposal/session form → calendar modal opens, pick a day + time → field fills, submit creates the correct `scheduled_at`; existing session create/edit still works.

---

## Testing Checkpoints
- **After P1**: proposals can be created/listed/deleted with correct RLS; no availability/confirm/notifications yet.
- **After P2**: participants mark Available/Busy, who-approved + tally visible; identity enforced server-side; proposals never auto-confirm.
- **After P3**: full approval atomically confirms once and creates exactly one `campaign_session`, visible in the existing schedule; concurrency-safe.
- **After P4**: confirmation fans out per-participant notifications; shell badge shows/clears unread; cross-campaign isolation holds.
- **After P5**: both forms use the calendar modal; ISO `scheduled_at` correct; legacy session flow unaffected.

> Note: Phases are independently valuable — if P4/P5 slip, P1–P3 still deliver propose → approve → confirmed-session. The only cross-phase coupling is the confirm/notification fan-out living inside `set_proposal_availability` (P3 adds confirm, P4 adds the insert), flagged for the plan.
