# Implementation Plan

## Overview
A Schedule tab on `/campaign` where any campaign participant (player or referee) posts gaming sessions (title, date/time, notes), edits/deletes their own (referee may manage any), and sets a yes/no/maybe RSVP. Sessions show as both an upcoming list and a hand-built month grid; data loads on open and refetches after each mutation.

**Deviation from structure.md** (applied throughout): every schedule read/write is guarded by `is_campaign_member(campaign_id) OR is_campaign_referee(campaign_id)`, because a referee is identified by `campaigns.referee_id` and has **no** `campaign_members` row (`research.md` Q1). Using `is_campaign_member` alone would lock referees out.

Verification commands (from root `package.json`): `pnpm typecheck`, `pnpm lint`, `pnpm build`; DB: `npx supabase db reset`.

---

## Phase 1: Schema + read path + read-only tab

### Changes

#### 1. Migration
**File**: `supabase/migrations/20260621000023_campaign_scheduling.sql`
**Action**: create

```sql
-- ============================================================
-- CAMPAIGN SCHEDULING: sessions + RSVPs (per-campaign calendar)
-- ============================================================

create table public.campaign_sessions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  title text not null,
  scheduled_at timestamptz not null,
  notes text not null default '',
  created_by uuid not null references public.accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_campaign_sessions_campaign on public.campaign_sessions(campaign_id, scheduled_at);

create trigger set_updated_at
  before update on public.campaign_sessions
  for each row execute function public.handle_updated_at();

alter table public.campaign_sessions enable row level security;

-- Participants (members or referee) can read sessions in their campaigns.
create policy "Participants can view campaign sessions"
  on public.campaign_sessions for select
  using (public.is_campaign_member(campaign_id) or public.is_campaign_referee(campaign_id));

-- Any participant can create a session they author (Phase 2 exercises this).
create policy "Participants can create sessions"
  on public.campaign_sessions for insert
  with check (
    (public.is_campaign_member(campaign_id) or public.is_campaign_referee(campaign_id))
    and created_by = auth.uid()
  );

-- Creator or referee can edit (Phase 4).
create policy "Creator or referee can update sessions"
  on public.campaign_sessions for update
  using (created_by = auth.uid() or public.is_campaign_referee(campaign_id));

-- Creator or referee can delete (Phase 4).
create policy "Creator or referee can delete sessions"
  on public.campaign_sessions for delete
  using (created_by = auth.uid() or public.is_campaign_referee(campaign_id));

-- RSVPs: one row per (session, account). RLS enabled, NO policies —
-- all reads/writes flow through the SECURITY DEFINER RPCs below.
create table public.session_rsvps (
  session_id uuid not null references public.campaign_sessions(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  status text not null check (status in ('yes','no','maybe')),
  updated_at timestamptz not null default now(),
  primary key (session_id, account_id)
);

create trigger set_updated_at
  before update on public.session_rsvps
  for each row execute function public.handle_updated_at();

alter table public.session_rsvps enable row level security;

-- Read RPC: sessions + nested rsvps for a campaign (participant-guarded).
create or replace function public.get_campaign_schedule(p_campaign_id uuid)
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
    select json_agg(session_data order by session_data->>'scheduled_at')
    from (
      select json_build_object(
        'id', s.id,
        'campaign_id', s.campaign_id,
        'title', s.title,
        'scheduled_at', s.scheduled_at,
        'notes', s.notes,
        'created_by', s.created_by,
        'rsvps', (
          select coalesce(json_agg(json_build_object(
            'account_id', r.account_id,
            'display_name', acc.display_name,
            'status', r.status
          ) order by acc.display_name), '[]'::json)
          from public.session_rsvps r
          join public.accounts acc on acc.id = r.account_id
          where r.session_id = s.id
        )
      ) as session_data
      from public.campaign_sessions s
      where s.campaign_id = p_campaign_id
    ) sessions
  ), '[]'::json);
end;
$$;

revoke execute on function public.get_campaign_schedule(uuid) from public;
grant  execute on function public.get_campaign_schedule(uuid) to authenticated;
```

> Note: `is_campaign_member` / `is_campaign_referee` / `handle_updated_at` already exist (migrations `…000005`, `…000001`). RPC `set_session_rsvp` is added in Phase 3 (same file may be appended, or — to keep phases independently testable — add it now; it is harmless before its UI exists). This plan appends it in Phase 3.

#### 2. Shared types + data module
**File**: `apps/web/src/lib/data/schedule.ts`
**Action**: create — Phase 1 ships `loadSchedule` + types only; `createSession`/`updateSession`/`deleteSession`/`setRsvp` are added in later phases.

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

export type RsvpStatus = 'yes' | 'no' | 'maybe';

export interface SessionRsvp {
  account_id: string;
  display_name: string;
  status: RsvpStatus;
}

export interface Session {
  id: string;
  campaign_id: string;
  title: string;
  scheduled_at: string;   // ISO timestamptz
  notes: string;
  created_by: string;
  rsvps: SessionRsvp[];
}

/** Sessions + nested RSVPs for a campaign via the membership-guarded RPC. */
export async function loadSchedule(
  supabase: SupabaseClient,
  campaignId: string,
): Promise<Session[]> {
  const { data, error } = await supabase.rpc('get_campaign_schedule', { p_campaign_id: campaignId });
  if (error || !data) return [];
  return data as Session[];
}
```

#### 3. Date formatting helper
**File**: `apps/web/src/lib/format.ts`
**Action**: create

```ts
export function formatSessionDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

/** ISO → value for <input type="datetime-local"> (local wall-clock). */
export function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
```

#### 4. Read-only Schedule tab + list
**File**: `apps/web/src/components/campaign/ScheduleTab.tsx` (create), `apps/web/src/components/campaign/schedule/SessionList.tsx` (create)

`ScheduleTab({ userId }: { userId: string })`:
- State: `campaigns: {id:string;name:string}[]`, `campaignId: string`, `sessions: Session[]`, `loading: boolean`. (`view`/`month`/form/delete state added in later phases.)
- On mount: `supabase.from('campaigns').select('id, name').order('name')` — RLS returns campaigns the user owns or belongs to (avoids the referee-not-in-`campaign_members` problem). Default `campaignId` to the sole campaign, or first; render a `<select>` campaign switcher only when `campaigns.length > 1`.
- `useEffect` on `campaignId`: `setSessions(await loadSchedule(supabase, campaignId))`.
- Render `<SessionList sessions={sessions} userId={userId} />` (read-only this phase). Empty state mirrors `BankingTab.tsx:96-103`.

`SessionList({ sessions, userId })`: maps sessions to inline-styled cards (pattern from `BankingTab.tsx:107-144`): title, `formatSessionDate(scheduled_at)`, notes. Sort client-side: upcoming (`scheduled_at >= now`) ascending first, then past descending. RSVP tally/controls added Phase 3.

#### 5. Register the tab
**File**: `apps/web/src/app/(app)/campaign/page.tsx`
**Action**: modify
- Extend `type TabId = 'overview' | 'bank' | 'schedule'` (`:8`).
- Add `{ id: 'schedule', label: '📅 Schedule' }` to the `tabs` array (`:32-35`) — **no** `refereeOnly`.
- Add render branch after the bank branch (`:114`): `{activeTab === 'schedule' && userId && <ScheduleTab userId={userId} />}`. Import `ScheduleTab`.

### Verification
#### Automated
- [x] `npx supabase db reset` applies all migrations with no error
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes
#### Manual
- [ ] In Supabase Studio, insert a `campaign_sessions` row for a campaign you belong to; open `/campaign` → Schedule tab lists it with a formatted date
- [ ] Calling `select get_campaign_schedule('<campaign-not-mine>')` as that user raises "Not a participant of this campaign"
- [ ] Referee (owner, not a member row) sees the Schedule tab and the campaign's sessions

---

## Phase 2: Create session

### Changes

#### 1. Data: createSession
**File**: `apps/web/src/lib/data/schedule.ts` (add)
```ts
export async function createSession(
  supabase: SupabaseClient,
  input: { campaignId: string; createdBy: string; title: string; scheduledAt: string; notes: string },
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.from('campaign_sessions').insert({
    campaign_id: input.campaignId,
    created_by: input.createdBy,
    title: input.title,
    scheduled_at: input.scheduledAt,   // ISO (caller converts from datetime-local)
    notes: input.notes,
  });
  return { error };
}
```

#### 2. SessionForm
**File**: `apps/web/src/components/campaign/schedule/SessionForm.tsx` (create)
- Controlled, parent owns state (pattern: `CampaignCreateForm.tsx`). Props: `{ title, scheduledAt, notes, error, loading, mode: 'create'|'edit', onChange(field,value), onSubmit, onCancel }`.
- Fields: text `title`, `<input type="datetime-local" value={scheduledAt}>`, optional `notes` textarea. Inline styles per `CampaignCreateForm`.

#### 3. ScheduleTab wiring
**File**: `apps/web/src/components/campaign/ScheduleTab.tsx` (modify)
- Add form state (`showForm`, `formTitle`, `formWhen` (datetime-local string), `formNotes`, `formError`, `saving`).
- "➕ New session" button toggles the form.
- `handleCreate`: validate non-empty title + `formWhen`; `const scheduledAt = new Date(formWhen).toISOString();` then `createSession(supabase, { campaignId, createdBy: userId, title, scheduledAt, notes })`; on success close form + `loadSchedule` refetch; on error show `error.message`.

### Verification
#### Automated
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes
#### Manual
- [ ] Create a session as a player → it appears in the list at the correct local time
- [ ] A user in a different campaign does not see it
- [ ] Submitting with empty title or date shows an inline error, no insert

---

## Phase 3: RSVP

### Changes

#### 1. Migration: set_session_rsvp RPC (append to `20260621000023_campaign_scheduling.sql`)
```sql
create or replace function public.set_session_rsvp(p_session_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
begin
  if p_status not in ('yes','no','maybe') then
    raise exception 'Invalid RSVP status';
  end if;

  select campaign_id into v_campaign_id
  from public.campaign_sessions where id = p_session_id;

  if v_campaign_id is null then
    raise exception 'Session not found';
  end if;

  if not (public.is_campaign_member(v_campaign_id) or public.is_campaign_referee(v_campaign_id)) then
    raise exception 'Not a participant of this campaign';
  end if;

  insert into public.session_rsvps (session_id, account_id, status)
  values (p_session_id, auth.uid(), p_status)
  on conflict (session_id, account_id)
  do update set status = excluded.status, updated_at = now();
end;
$$;

revoke execute on function public.set_session_rsvp(uuid, text) from public;
grant  execute on function public.set_session_rsvp(uuid, text) to authenticated;
```
> Editing an already-applied migration requires `npx supabase db reset` to re-run it locally.

#### 2. Data: setRsvp
**File**: `apps/web/src/lib/data/schedule.ts` (add)
```ts
export async function setRsvp(
  supabase: SupabaseClient,
  sessionId: string,
  status: RsvpStatus,
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.rpc('set_session_rsvp', { p_session_id: sessionId, p_status: status });
  return { error };
}
```

#### 3. RsvpControl + tally
**File**: `apps/web/src/components/campaign/schedule/RsvpControl.tsx` (create), `SessionList.tsx` (modify)
- `RsvpControl({ status, onSet }: { status: RsvpStatus | null; onSet(s: RsvpStatus): void })`: three buttons (Yes/No/Maybe); the active one highlighted (`var(--color-primary)`), pattern from `BankingTab` action buttons.
- `SessionList`: for each session compute tally `{yes,no,maybe}` from `session.rsvps`; current user's status = `rsvps.find(r => r.account_id === userId)?.status ?? null`; render counts + `<RsvpControl>`. Add `onRsvp(sessionId, status)` prop.
- `ScheduleTab`: `handleRsvp` calls `setRsvp` then `loadSchedule` refetch.

### Verification
#### Automated
- [x] `npx supabase db reset` applies cleanly
- [x] `pnpm typecheck` / `pnpm lint` pass
#### Manual
- [ ] Set your RSVP to each of yes/no/maybe → persists across a tab reload, active button reflects it
- [ ] A second account's RSVP on the same session updates the tally counts
- [ ] `set_session_rsvp('<other-campaign-session>', 'yes')` as a non-participant raises an error

---

## Phase 4: Edit & delete session

### Changes

#### 1. Data: updateSession, deleteSession
**File**: `apps/web/src/lib/data/schedule.ts` (add)
```ts
export async function updateSession(
  supabase: SupabaseClient,
  id: string,
  patch: { title: string; scheduledAt: string; notes: string },
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.from('campaign_sessions')
    .update({ title: patch.title, scheduled_at: patch.scheduledAt, notes: patch.notes })
    .eq('id', id);
  return { error };
}

export async function deleteSession(
  supabase: SupabaseClient,
  id: string,
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.from('campaign_sessions').delete().eq('id', id);
  return { error };
}
```

#### 2. DeleteSessionModal
**File**: `apps/web/src/components/campaign/schedule/DeleteSessionModal.tsx` (create)
- Modeled on `DeleteAccountModal` (fixed overlay `inset:0, zIndex:200`, but per host rules avoid `position:fixed` issues only in widgets — this is a real app page so `position:'fixed'` matches the existing modal). Props: `{ sessionTitle, deleting, error, onCancel, onConfirm }`. Confirm button danger-styled; no typed-text gate needed (lighter than account deletion).

#### 3. SessionList affordances + ScheduleTab
**File**: `SessionList.tsx`, `ScheduleTab.tsx` (modify)
- `SessionList`: show Edit + Delete buttons on a session only when `session.created_by === userId || isReferee`. Add `isReferee`, `onEdit(session)`, `onDelete(session)` props. `ScheduleTab` passes `isReferee` (fetch via `accounts.role` like `campaign/page.tsx:22`, or pass down from page — see below).
- `ScheduleTab`: reuse `SessionForm` in `mode='edit'` (prefill via `toDatetimeLocal(session.scheduled_at)`, track `editingId`). `handleUpdate` → `updateSession` → refetch. `handleDelete` opens modal; confirm → `deleteSession` → refetch.
- **Pass `isReferee` into the tab**: change the page render to `<ScheduleTab userId={userId} isReferee={isReferee} />` (`campaign/page.tsx`), and update `ScheduleTab` props — `isReferee` already exists in page state (`:12`).

### Verification
#### Automated
- [x] `pnpm typecheck` / `pnpm lint` pass
#### Manual
- [ ] Creator edits a session (title/time/notes) → list reflects changes
- [ ] Creator deletes own session via modal → removed; its RSVP rows are gone (cascade — confirm in Studio)
- [ ] Referee can delete another member's session; a non-creator non-referee sees no edit/delete buttons and a direct `delete` is rejected by RLS

---

## Phase 5: Month-grid calendar view

### Changes

#### 1. Calendar date helpers
**File**: `apps/web/src/lib/calendar.ts` (create)
```ts
export interface MonthCell { date: Date; inMonth: boolean; }

export function buildMonthGrid(year: number, month: number): MonthCell[] {
  const startDow = new Date(year, month, 1).getDay();       // 0 = Sunday
  const gridStart = new Date(year, month, 1 - startDow);
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    return { date, inMonth: date.getMonth() === month };
  });
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}
```

#### 2. SessionCalendar
**File**: `apps/web/src/components/campaign/schedule/SessionCalendar.tsx` (create)
- Props: `{ sessions: Session[]; month: Date; onPrev(): void; onNext(): void; selectedDay: Date | null; onSelectDay(d: Date): void }`.
- Header: month label (`month.toLocaleString('en-US',{month:'long',year:'numeric'})`) with ‹ / › buttons calling `onPrev`/`onNext`. Weekday row Su–Sa.
- Body: `buildMonthGrid(month.getFullYear(), month.getMonth())` → 6×7 cells (CSS grid `gridTemplateColumns: repeat(7,1fr)`). Each cell: day number; a dot/count when any `sessions` fall on that day (`sameDay(new Date(s.scheduled_at), cell.date)`); `inMonth` cells full opacity, others muted; selected day highlighted. Click → `onSelectDay(cell.date)`.

#### 3. ScheduleTab view toggle
**File**: `apps/web/src/components/campaign/ScheduleTab.tsx` (modify)
- Add `view: 'list' | 'grid'` (default `'list'`) and `month: Date` (default first-of-current-month) and `selectedDay: Date | null` state.
- Toggle control (two buttons, pattern from page tabs). When `view==='grid'`, render `<SessionCalendar>`; clicking a day sets `selectedDay` and the list below filters to that day (or render `SessionList` filtered by `selectedDay`). `onPrev`/`onNext` shift `month` by ±1 (`new Date(y, m-1/m+1, 1)`).

### Verification
#### Automated
- [ ] `pnpm typecheck` / `pnpm lint` pass
- [ ] `pnpm build` succeeds
#### Manual
- [ ] Grid shows correct weekday alignment for the current month; ‹/› navigate months
- [ ] A day with a session shows a marker; selecting it surfaces that day's session(s)
- [ ] Cross-boundary check: a session on the 1st and one on the last day of a month both render on the correct cells
- [ ] Toggling list ⇄ grid preserves loaded data (no refetch needed)

---

## Cross-phase notes
- **No schema-version test assertions** exist to update (no test references the migration list; `pnpm test` runs `turbo test` — run it once to confirm nothing breaks, but the repo has no schema snapshot test per research).
- **Timezone**: `datetime-local` is wall-clock; always store via `new Date(value).toISOString()` and display via `formatSessionDate`. Editing round-trips through `toDatetimeLocal`.
- **CSS variables** in use across these components: `--color-bg`, `--color-surface`, `--color-border`, `--color-text`, `--color-text-muted`, `--color-primary`, `--color-danger`, `--color-gold`, `--font-display` (confirmed in existing campaign components).
- **Refetch-after-mutation** is the chosen consistency model (no realtime), matching `BankingTab.loadData()` re-run after a transfer.
