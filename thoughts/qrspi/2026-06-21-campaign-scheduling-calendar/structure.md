# Structure Outline

## Approach
Five vertical slices. Phase 1 lays the schema, read RPC, data layer, and a read-only Schedule tab end-to-end (the foundation everything else renders into). Phases 2–4 add create, RSVP, and edit/delete — each a full DB→data→UI slice that is independently valuable. Phase 5 adds the month-grid view over the already-loaded dataset. Migration sequence continues at `…23`. All writes are RLS-guarded table calls except RSVP (RPC); reads go through one membership-checked nested-json RPC modeled on `get_campaign_party_data`.

Resolved open risks: `ScheduleTab` receives `campaignId` chosen in Phase 1 (default to the user's sole membership; render a small selector when >1). Both past and upcoming sessions are returned, ordered `scheduled_at`; the list groups upcoming-first.

---

## Phase 1: Schema + read path + read-only tab
Two tables, RLS, the `get_campaign_schedule` RPC, the data module, and a Schedule tab that lists sessions (read-only). Delivers a visible, queryable schedule end-to-end.

**Files**: `supabase/migrations/20260621000023_campaign_scheduling.sql` (new), `apps/web/src/lib/data/schedule.ts` (new), `apps/web/src/lib/wordpress.ts` or a new `apps/web/src/lib/format.ts` (add `formatSessionDate`), `apps/web/src/components/campaign/ScheduleTab.tsx` (new), `apps/web/src/components/campaign/schedule/SessionList.tsx` (new), `apps/web/src/app/(app)/campaign/page.tsx` (register tab), `packages/types/src/index.ts` (types).

**Key changes**:
- Tables `campaign_sessions(id, campaign_id→campaigns ON DELETE CASCADE, title, scheduled_at timestamptz, notes default '', created_by→accounts, created_at, updated_at)` + index `(campaign_id, scheduled_at)`; `session_rsvps(session_id→campaign_sessions ON DELETE CASCADE, account_id→accounts ON DELETE CASCADE, status CHECK in ('yes','no','maybe'), updated_at, PK(session_id, account_id))`. Both `enable row level security`; `set_updated_at` triggers via `handle_updated_at()`.
- RLS: `campaign_sessions` SELECT `using (is_campaign_member(campaign_id))`; `session_rsvps` SELECT via the read RPC (no broad SELECT policy needed) — add a member SELECT policy guarded by a `SECURITY DEFINER` membership check on the parent session if direct reads are needed.
- `get_campaign_schedule(p_campaign_id uuid) returns json` — `SECURITY DEFINER set search_path = public`, membership guard then `json_agg` of sessions each with nested `rsvps` (account_id, display_name, status) and `created_by`; `revoke … from public; grant … to authenticated`.
- `loadSchedule(supabase, campaignId): Promise<CampaignSchedule | null>` calling `supabase.rpc('get_campaign_schedule', { p_campaign_id })`.
- Types: `Session { id; campaignId; title; scheduledAt; notes; createdBy; rsvps: SessionRsvp[] }`, `SessionRsvp { accountId; displayName; status: 'yes'|'no'|'maybe' }`, `RsvpStatus`.
- `ScheduleTab({ campaignId, userId })` resolves `campaignId` (sole membership default / selector), calls `loadSchedule` on mount, renders `<SessionList>`. Tab registered as `{ id:'schedule', label:'📅 Schedule' }` (no `refereeOnly`).

**Verify**: `npx supabase db reset` applies cleanly; seed a session row, open `/campaign` → Schedule tab lists it with formatted date; a non-member calling the RPC gets "Not a member of this campaign".

---

## Phase 2: Create session
A controlled form that inserts a session via an RLS-guarded table call; list refetches.

**Files**: `apps/web/src/lib/data/schedule.ts` (add `createSession`), `apps/web/src/components/campaign/schedule/SessionForm.tsx` (new), `apps/web/src/components/campaign/ScheduleTab.tsx` (wire form + refetch).

**Key changes**:
- RLS INSERT on `campaign_sessions`: `with check (is_campaign_member(campaign_id) and created_by = auth.uid())` (added in Phase 1 migration).
- `createSession(supabase, input: { campaignId; title; scheduledAt; notes }): Promise<{ error }>` — `from('campaign_sessions').insert({...,created_by:auth user})` (mirrors `insertPackAnimal`).
- `SessionForm` controlled by parent (props: `title`, `scheduledAt`, `notes`, `error`, `loading`, `onChange*`, `onSubmit`, `onCancel`); native `<input type="datetime-local">`; inline styles.
- `ScheduleTab` re-runs `loadSchedule()` after success.

**Verify**: `pnpm lint` + `pnpm typecheck` pass; create a session as a member → appears in list; created session not visible to a member of a different campaign.

---

## Phase 3: RSVP
Per-member yes/no/maybe via `set_session_rsvp` RPC; tally and own-status render.

**Files**: `supabase/migrations/20260621000023_campaign_scheduling.sql` (RPC in same migration), `apps/web/src/lib/data/schedule.ts` (add `setRsvp`), `apps/web/src/components/campaign/schedule/RsvpControl.tsx` (new), `SessionList.tsx` (show tally + control).

**Key changes**:
- `set_session_rsvp(p_session_id uuid, p_status text) returns void` — `SECURITY DEFINER`, resolves the session's `campaign_id`, guards `is_campaign_member`, upserts `session_rsvps(session_id, account_id=auth.uid(), status)` on PK conflict; `revoke/grant`.
- `setRsvp(supabase, sessionId, status: RsvpStatus): Promise<{ error }>`.
- `RsvpControl({ status, onSet })` — three buttons; `SessionList` renders counts (yes/no/maybe) from `session.rsvps` and highlights the current user's choice.
- `ScheduleTab` refetches after `setRsvp`.

**Verify**: typecheck/lint pass; set RSVP → persists across refetch; counts reflect a second member's response; non-member RPC call rejected.

---

## Phase 4: Edit & delete session
Creator (or referee) edits/deletes; delete behind a confirm modal.

**Files**: `apps/web/src/lib/data/schedule.ts` (add `updateSession`, `deleteSession`), `apps/web/src/components/campaign/schedule/DeleteSessionModal.tsx` (new), `SessionForm.tsx` (reused for edit), `SessionList.tsx` (edit/delete affordances), `ScheduleTab.tsx`.

**Key changes**:
- RLS UPDATE/DELETE on `campaign_sessions`: `using (created_by = auth.uid() or is_campaign_referee(campaign_id))`.
- `updateSession(supabase, id, patch): Promise<{ error }>`; `deleteSession(supabase, id): Promise<{ error }>` (mirrors `removePackAnimal`).
- `DeleteSessionModal` modeled on `DeleteAccountModal` (fixed overlay, confirm button).
- `ScheduleTab` opens form in edit mode / modal; refetch after each.

**Verify**: typecheck/lint pass; creator edits + deletes own session; referee deletes another member's session; a non-creator non-referee member cannot (RLS blocks; UI hides controls); deleting a session removes its RSVPs (cascade).

---

## Phase 5: Month-grid calendar view
Hand-built month grid over the already-loaded dataset, with list/grid toggle.

**Files**: `apps/web/src/components/campaign/schedule/SessionCalendar.tsx` (new), `apps/web/src/lib/calendar.ts` (new — `Date` helpers), `ScheduleTab.tsx` (view toggle).

**Key changes**:
- `buildMonthGrid(year, month): { date: Date; inMonth: boolean }[]` (6×7 with leading/trailing days); pure, no library.
- `SessionCalendar({ sessions, month, onPrev, onNext, onSelectDay })` — day cells show dots/counts for sessions on that date; clicking a day filters/scrolls the list.
- `ScheduleTab` holds `view: 'list'|'grid'` and `month` state; both views read the same loaded `sessions`.

**Verify**: typecheck/lint pass; grid renders correct weekday alignment for the current month; prev/next navigation works; days with sessions show markers; selecting a day surfaces its sessions; manual check across a month boundary (e.g. session on the 1st/31st).

---

## Testing Checkpoints
- **After P1**: migration applies; Schedule tab lists seeded sessions; read RPC enforces membership. Foundation usable read-only.
- **After P2**: members create sessions; campaign isolation holds.
- **After P3**: RSVP persists; tallies aggregate across members.
- **After P4**: edit/delete works for creator+referee only; cascade verified.
- **After P5**: month grid + toggle functional; date math correct across boundaries.

Each phase leaves the app in a shippable state; if P5 is dropped, P1–P4 deliver a working list-based scheduler.
