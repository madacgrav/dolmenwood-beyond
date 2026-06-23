# Implementation Plan

## Overview
Add campaign **date proposals** with per-participant **free/busy availability**. When every participant (campaign members ∪ referee) marks a proposal available, it is atomically confirmed once, a `campaign_session` is created, and an in-app **notification** is fanned out to every participant (surfaced by a shell bell/badge). Date entry moves to a **calendar-modal picker**.

## Conventions (apply to every phase)
- Migrations: new file under `supabase/migrations/`, timestamp-prefixed and after the latest (`20260621000023`). Use sequential names below. RPCs are `security definer`, `set search_path = public`, paired with `revoke execute … from public; grant execute … to authenticated`.
- Apply migrations locally with `npx supabase db reset` (re-runs all migrations on a clean DB).
- Data-layer fns: `supabase` first arg; reads return `[]`/`null`; writes return `{ error }`.
- No schema-version test assertions exist (tests cover HPBar, WizardProgress, wizard-store, use-optional-rules, use-dice-roll, ability-modifiers) — none reference migration count or schema, so none need updating.
- Verification commands (run from repo root): `pnpm --filter web typecheck`, `pnpm --filter web lint`, `pnpm --filter web test`, `pnpm --filter web build`.

---

## Phase 1: Date proposals — create, list, delete

### Changes

#### 1. Migration — proposals table + read RPC
**File**: `supabase/migrations/20260624000024_date_proposals.sql`
**Action**: create

```sql
-- ============================================================
-- DATE PROPOSALS: candidate play dates per campaign
-- ============================================================
create table public.date_proposals (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  scheduled_at timestamptz not null,
  title text not null,
  notes text not null default '',
  status text not null default 'open' check (status in ('open','confirmed','cancelled')),
  confirmed_session_id uuid references public.campaign_sessions(id) on delete set null,
  created_by uuid not null references public.accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_date_proposals_campaign on public.date_proposals(campaign_id, scheduled_at);

create trigger set_updated_at
  before update on public.date_proposals
  for each row execute function public.handle_updated_at();

alter table public.date_proposals enable row level security;

create policy "Participants can view proposals"
  on public.date_proposals for select
  using (public.is_campaign_member(campaign_id) or public.is_campaign_referee(campaign_id));

create policy "Participants can create proposals"
  on public.date_proposals for insert
  with check (
    (public.is_campaign_member(campaign_id) or public.is_campaign_referee(campaign_id))
    and created_by = auth.uid()
  );

create policy "Creator or referee can update proposals"
  on public.date_proposals for update
  using (created_by = auth.uid() or public.is_campaign_referee(campaign_id));

create policy "Creator or referee can delete proposals"
  on public.date_proposals for delete
  using (created_by = auth.uid() or public.is_campaign_referee(campaign_id));

-- Read RPC: proposals for a campaign (participant-guarded). Availability added in P2.
create or replace function public.get_campaign_proposals(p_campaign_id uuid)
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
    select json_agg(row order by row->>'scheduled_at')
    from (
      select json_build_object(
        'id', dp.id,
        'campaign_id', dp.campaign_id,
        'scheduled_at', dp.scheduled_at,
        'title', dp.title,
        'notes', dp.notes,
        'status', dp.status,
        'confirmed_session_id', dp.confirmed_session_id,
        'created_by', dp.created_by
      ) as row
      from public.date_proposals dp
      where dp.campaign_id = p_campaign_id
    ) rows
  ), '[]'::json);
end;
$$;

revoke execute on function public.get_campaign_proposals(uuid) from public;
grant  execute on function public.get_campaign_proposals(uuid) to authenticated;
```

#### 2. Data layer
**File**: `apps/web/src/lib/data/proposals.ts`
**Action**: create

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

export type ProposalStatus = 'open' | 'confirmed' | 'cancelled';

export interface Proposal {
  id: string;
  campaign_id: string;
  scheduled_at: string;   // ISO timestamptz
  title: string;
  notes: string;
  status: ProposalStatus;
  confirmed_session_id: string | null;
  created_by: string;
  // availability + participant_count added in Phase 2
}

export async function loadProposals(supabase: SupabaseClient, campaignId: string): Promise<Proposal[]> {
  const { data, error } = await supabase.rpc('get_campaign_proposals', { p_campaign_id: campaignId });
  if (error || !data) return [];
  return data as Proposal[];
}

export async function createProposal(
  supabase: SupabaseClient,
  input: { campaignId: string; createdBy: string; title: string; scheduledAt: string; notes: string },
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.from('date_proposals').insert({
    campaign_id: input.campaignId,
    created_by: input.createdBy,
    title: input.title,
    scheduled_at: input.scheduledAt,
    notes: input.notes,
  });
  return { error };
}

export async function deleteProposal(
  supabase: SupabaseClient, id: string,
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.from('date_proposals').delete().eq('id', id);
  return { error };
}
```

#### 3. ProposalForm (mirror of SessionForm)
**File**: `apps/web/src/components/campaign/schedule/ProposalForm.tsx`
**Action**: create — copy `SessionForm.tsx` structure exactly (`'use client'`, `ProposalFormField = 'title' | 'scheduledAt' | 'notes'`, same `inputStyle`/`labelStyle`, `datetime-local` input for now — swapped in P5). Heading: `mode === 'create' ? 'Propose a Date' : 'Edit Proposal'`. Submit label: `mode === 'create' ? 'Propose' : 'Save'`.

#### 4. ProposalList
**File**: `apps/web/src/components/campaign/schedule/ProposalList.tsx`
**Action**: create — list each proposal as a card (mirror `SessionList` card styling). Show `title`, `formatSessionDate(scheduled_at)`, optional `notes`. Show a Delete button when `canManage = proposal.created_by === userId || isReferee`. Empty state: "No dates proposed yet." Props:

```ts
interface ProposalListProps {
  proposals: Proposal[];
  userId: string;
  isReferee: boolean;
  onDelete: (proposal: Proposal) => void;   // availability/onAvail added in P2
}
```

#### 5. ProposalsSection (orchestrator, owns proposal state)
**File**: `apps/web/src/components/campaign/schedule/ProposalsSection.tsx`
**Action**: create — self-contained, mirrors `BankingTab` load pattern (`useCallback` loader + `useEffect`). Owns: `proposals`, form state (`showForm/editingId-less for now/formTitle/formWhen/formNotes/formError/saving`), and delete-modal state reusing `DeleteSessionModal` (generic enough; pass `sessionTitle={deleting.title}`). Props:

```ts
export function ProposalsSection({ campaignId, userId, isReferee }: {
  campaignId: string; userId: string; isReferee: boolean;
}) { /* loadProposals on campaignId change; createProposal/deleteProposal then refetch */ }
```
- `handleSubmit`: validate title + date, `new Date(formWhen).toISOString()`, `createProposal(...)`, on success reset + refetch.
- `handleDelete`: `deleteProposal(...)`, on success refetch.

#### 6. Wire into ScheduleTab
**File**: `apps/web/src/components/campaign/ScheduleTab.tsx`
**Action**: modify — import and render `<ProposalsSection campaignId={campaignId} userId={userId} isReferee={isReferee} />` directly above the `{showForm ? … : New session}` block (only when `campaignId` is set). No other changes this phase.

### Verification
#### Automated
- [x] `npx supabase db reset` applies cleanly (no SQL errors)
- [x] `pnpm --filter web typecheck` passes
- [x] `pnpm --filter web lint` passes
- [x] `pnpm --filter web build` passes
#### Manual (`pnpm --filter web dev`)
- [ ] On the campaign Schedule tab, "Propose a Date" form creates a proposal that appears in the proposals list
- [ ] Creator (and referee) sees Delete; a non-creator player does not
- [ ] Deleting a proposal removes it from the list

---

## Phase 2: Mark availability + show who approved

### Changes

#### 1. Migration — availability table + upsert RPC + extend read RPC
**File**: `supabase/migrations/20260624000025_proposal_availability.sql`
**Action**: create

```sql
-- Per-participant free/busy. RLS enabled, NO policies — access via RPCs only.
create table public.proposal_availability (
  proposal_id uuid not null references public.date_proposals(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  available boolean not null,
  updated_at timestamptz not null default now(),
  primary key (proposal_id, account_id)
);

create trigger set_updated_at
  before update on public.proposal_availability
  for each row execute function public.handle_updated_at();

alter table public.proposal_availability enable row level security;

-- Upsert the caller's availability (participant-guarded). Confirm logic added in P3.
create or replace function public.set_proposal_availability(p_proposal_id uuid, p_available boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
begin
  select campaign_id into v_campaign_id
  from public.date_proposals where id = p_proposal_id;

  if v_campaign_id is null then
    raise exception 'Proposal not found';
  end if;

  if not (public.is_campaign_member(v_campaign_id) or public.is_campaign_referee(v_campaign_id)) then
    raise exception 'Not a participant of this campaign';
  end if;

  insert into public.proposal_availability (proposal_id, account_id, available)
  values (p_proposal_id, auth.uid(), p_available)
  on conflict (proposal_id, account_id)
  do update set available = excluded.available, updated_at = now();
end;
$$;

revoke execute on function public.set_proposal_availability(uuid, boolean) from public;
grant  execute on function public.set_proposal_availability(uuid, boolean) to authenticated;

-- Extend the read RPC to nest availability + participant_count.
create or replace function public.get_campaign_proposals(p_campaign_id uuid)
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
    select json_agg(row order by row->>'scheduled_at')
    from (
      select json_build_object(
        'id', dp.id,
        'campaign_id', dp.campaign_id,
        'scheduled_at', dp.scheduled_at,
        'title', dp.title,
        'notes', dp.notes,
        'status', dp.status,
        'confirmed_session_id', dp.confirmed_session_id,
        'created_by', dp.created_by,
        'availability', (
          select coalesce(json_agg(json_build_object(
            'account_id', pa.account_id,
            'display_name', acc.display_name,
            'available', pa.available
          ) order by acc.display_name), '[]'::json)
          from public.proposal_availability pa
          join public.accounts acc on acc.id = pa.account_id
          where pa.proposal_id = dp.id
        ),
        'participant_count', (
          select count(*) from (
            select account_id from public.campaign_members where campaign_id = dp.campaign_id
            union
            select referee_id from public.campaigns where id = dp.campaign_id
          ) parts
        )
      ) as row
      from public.date_proposals dp
      where dp.campaign_id = p_campaign_id
    ) rows
  ), '[]'::json);
end;
$$;
```

#### 2. Data layer — types + setAvailability
**File**: `apps/web/src/lib/data/proposals.ts`
**Action**: modify — add to `Proposal` interface and add the RPC fn:

```ts
export interface ProposalAvailability {
  account_id: string;
  display_name: string;
  available: boolean;
}
// add to Proposal:
//   availability: ProposalAvailability[];
//   participant_count: number;

export async function setAvailability(
  supabase: SupabaseClient, proposalId: string, available: boolean,
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.rpc('set_proposal_availability', {
    p_proposal_id: proposalId, p_available: available,
  });
  return { error };
}
```

#### 3. AvailabilityControl (mirror RsvpControl)
**File**: `apps/web/src/components/campaign/schedule/AvailabilityControl.tsx`
**Action**: create — two buttons, `available: boolean | null` prop, `onSet: (available: boolean) => void`. Active styling identical to `RsvpControl`. Options: `{ value: true, label: 'Available' }`, `{ value: false, label: 'Busy' }`.

#### 4. ProposalList — availability display
**File**: `apps/web/src/components/campaign/schedule/ProposalList.tsx`
**Action**: modify — for each proposal: `myAvailable = proposal.availability.find(a => a.account_id === userId)?.available ?? null`; tally `approved = availability.filter(a => a.available).length`; show `✅ {approved} / {participant_count} available` and the list of approver `display_name`s; render `<AvailabilityControl available={myAvailable} onSet={a => onAvail(proposal.id, a)} />`. Add `onAvail: (proposalId: string, available: boolean) => void` to props.

#### 5. ProposalsSection — handleAvailability
**File**: `apps/web/src/components/campaign/schedule/ProposalsSection.tsx`
**Action**: modify — add `handleAvailability(proposalId, available)` → `setAvailability(...)` → on success `await refetch()`. Pass `onAvail={handleAvailability}` to `ProposalList`.

### Verification
#### Automated
- [ ] `npx supabase db reset` applies cleanly
- [ ] `pnpm --filter web typecheck` / `lint` / `build` pass
#### Manual
- [ ] Each participant can toggle Available/Busy; choice persists after refetch
- [ ] List shows who approved and "✅ N / M available" with correct M (members + referee)
- [ ] Logged in as user A, you cannot change user B's availability (no UI path; server hardcodes `auth.uid()`)
- [ ] Proposal does NOT auto-confirm yet even when all are available

---

## Phase 3: Auto-confirm + create session (atomic, idempotent)

### Changes

#### 1. Migration — confirm logic in set_proposal_availability
**File**: `supabase/migrations/20260624000026_proposal_confirm.sql`
**Action**: create — `create or replace` the function, adding the confirm branch after the upsert:

```sql
create or replace function public.set_proposal_availability(p_proposal_id uuid, p_available boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
  v_status text;
  v_scheduled_at timestamptz;
  v_title text;
  v_notes text;
  v_participants int;
  v_approved int;
  v_session_id uuid;
begin
  select campaign_id, status, scheduled_at, title, notes
    into v_campaign_id, v_status, v_scheduled_at, v_title, v_notes
  from public.date_proposals where id = p_proposal_id;

  if v_campaign_id is null then
    raise exception 'Proposal not found';
  end if;

  if not (public.is_campaign_member(v_campaign_id) or public.is_campaign_referee(v_campaign_id)) then
    raise exception 'Not a participant of this campaign';
  end if;

  insert into public.proposal_availability (proposal_id, account_id, available)
  values (p_proposal_id, auth.uid(), p_available)
  on conflict (proposal_id, account_id)
  do update set available = excluded.available, updated_at = now();

  if v_status <> 'open' then
    return;   -- already confirmed/cancelled; no re-confirm
  end if;

  -- Count participants (members ∪ referee) and approvals among them.
  select count(*) into v_participants from (
    select account_id from public.campaign_members where campaign_id = v_campaign_id
    union
    select referee_id from public.campaigns where id = v_campaign_id
  ) parts;

  select count(*) into v_approved
  from public.proposal_availability pa
  where pa.proposal_id = p_proposal_id
    and pa.available = true
    and pa.account_id in (
      select account_id from public.campaign_members where campaign_id = v_campaign_id
      union
      select referee_id from public.campaigns where id = v_campaign_id
    );

  if v_participants > 0 and v_approved >= v_participants then
    -- Claim the confirm exactly once; concurrent caller's WHERE finds no open row.
    update public.date_proposals
      set status = 'confirmed'
      where id = p_proposal_id and status = 'open';

    if found then
      insert into public.campaign_sessions (campaign_id, title, scheduled_at, notes, created_by)
      values (v_campaign_id, v_title, v_scheduled_at, v_notes, auth.uid())
      returning id into v_session_id;

      update public.date_proposals
        set confirmed_session_id = v_session_id
        where id = p_proposal_id;
      -- Phase 4 inserts notifications here.
    end if;
  end if;
end;
$$;
```

#### 2. ProposalsSection — refresh sessions on confirm
**File**: `apps/web/src/components/campaign/schedule/ProposalsSection.tsx`
**Action**: modify — add `onConfirmed?: () => void` prop; after a successful `handleAvailability` refetch, call `onConfirmed?.()` (cheap, always refreshes parent sessions so a newly-created session appears).

#### 3. ScheduleTab — pass session refresh down
**File**: `apps/web/src/components/campaign/ScheduleTab.tsx`
**Action**: modify — pass `onConfirmed={refetch}` to `<ProposalsSection />` (`refetch` already reloads sessions).

#### 4. ProposalList — confirmed state
**File**: `apps/web/src/components/campaign/schedule/ProposalList.tsx`
**Action**: modify — when `proposal.status === 'confirmed'`, show a "✓ Confirmed" badge and hide the AvailabilityControl (read-only).

### Verification
#### Automated
- [ ] `npx supabase db reset` applies cleanly
- [ ] `pnpm --filter web typecheck` / `lint` / `build` pass
#### Manual
- [ ] In a campaign with N participants, the Nth "Available" flips the proposal to Confirmed and creates exactly one new session visible in the session list/calendar
- [ ] A partially-approved proposal creates no session
- [ ] Rapidly double-confirming (two quick clicks / two browsers) yields exactly one session and one Confirmed proposal (no duplicates)

---

## Phase 4: In-app notifications table + bell/badge

### Changes

#### 1. Migration — notifications table + fan-out
**File**: `supabase/migrations/20260624000027_notifications.sql`
**Action**: create

```sql
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  kind text not null,
  body text not null,
  related_session_id uuid references public.campaign_sessions(id) on delete set null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_notifications_account on public.notifications(account_id, read, created_at);

alter table public.notifications enable row level security;

create policy "Users read their own notifications"
  on public.notifications for select
  using (account_id = auth.uid());

create policy "Users update their own notifications"
  on public.notifications for update
  using (account_id = auth.uid());
```

Then `create or replace set_proposal_availability` (copy the P3 body) and insert the fan-out inside the `if found` block, after writing `confirmed_session_id`:

```sql
      insert into public.notifications (account_id, campaign_id, kind, body, related_session_id)
      select parts.account_id, v_campaign_id, 'date_confirmed',
             'Session confirmed: ' || v_title, v_session_id
      from (
        select account_id from public.campaign_members where campaign_id = v_campaign_id
        union
        select referee_id from public.campaigns where id = v_campaign_id
      ) parts;
```

#### 2. Data layer
**File**: `apps/web/src/lib/data/notifications.ts`
**Action**: create

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

export interface AppNotification {
  id: string;
  kind: string;
  body: string;
  related_session_id: string | null;
  read: boolean;
  created_at: string;
}

export async function loadNotifications(supabase: SupabaseClient): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, kind, body, related_session_id, read, created_at')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as AppNotification[];
}

export async function markNotificationRead(
  supabase: SupabaseClient, id: string,
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
  return { error };
}
```

#### 3. NotificationBell
**File**: `apps/web/src/components/notifications/NotificationBell.tsx`
**Action**: create — `'use client'`. Creates its own `createClient()`. On mount loads notifications (`useCallback` + `useEffect`), computes `unread = notifications.filter(n => !n.read).length`. Renders a 🔔 button with an unread-count badge (hidden when 0). Clicking toggles a dropdown panel (absolute-positioned, `var(--color-surface)` card) listing `body` + relative time; clicking an unread item calls `markNotificationRead` then refetches. No realtime — load on mount only.

#### 4. Mount in app shell
**File**: `apps/web/src/app/(app)/layout.tsx`
**Action**: modify — add a fixed top header containing the bell (the layout already has `user`). Pass nothing (the bell uses RLS-scoped `auth.uid()` via its own client). Add top padding to `<main>` to clear the header:

```tsx
// header (above <main>), only when user is present:
{user && (
  <header style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '52px', zIndex: 50,
    backgroundColor: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)',
    display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 1rem' }}>
    <NotificationBell />
  </header>
)}
// and change <main> padding: paddingTop: user ? '52px' : 0, paddingBottom: '80px'
```

### Verification
#### Automated
- [ ] `npx supabase db reset` applies cleanly
- [ ] `pnpm --filter web typecheck` / `lint` / `build` pass
#### Manual
- [ ] Confirming a date (Phase 3 flow) creates exactly one unread notification per participant
- [ ] The bell badge shows the unread count; opening the panel lists "Session confirmed: <title>"
- [ ] Clicking an unread item marks it read and decrements the badge
- [ ] A user in a different campaign receives no notification (RLS + fan-out scope)

---

## Phase 5: Calendar-modal date picker

### Changes

#### 1. CalendarDatePicker
**File**: `apps/web/src/components/campaign/schedule/CalendarDatePicker.tsx`
**Action**: create — `'use client'`. Modal overlay mirroring `DeleteSessionModal` (`position: fixed; inset: 0; …`). Inside, a month grid built with `buildMonthGrid` (reuse the `SessionCalendar` cell styling) plus prev/next month nav. Props:

```ts
interface Props {
  value: Date | null;
  onSelect: (d: Date) => void;   // picks a day, closes
  onClose: () => void;
}
```
Clicking a day calls `onSelect(cell.date)`. Internal `month` state seeded from `value ?? new Date()`.

#### 2. Swap picker into the two forms (keep the `scheduledAt` datetime-local string contract)
**Files**: `apps/web/src/components/campaign/schedule/ProposalForm.tsx`, `apps/web/src/components/campaign/schedule/SessionForm.tsx`
**Action**: modify — replace the single `datetime-local` input with: (a) a "📅 {chosen date or 'Pick a date'}" button opening `CalendarDatePicker`, and (b) an adjacent `<input type="time">`. Keep the parent contract: `scheduledAt` remains a `YYYY-MM-DDTHH:mm` string passed via `onChange('scheduledAt', composed)`. Compose the string from the picked day + time using the same formatting as `toDatetimeLocal` (zero-padded). Parent `new Date(formWhen).toISOString()` conversion in `ScheduleTab`/`ProposalsSection` is unchanged. Each form holds local modal-open state; the date/time values stay derived from the `scheduledAt` prop (parse on render).

### Verification
#### Automated
- [ ] `pnpm --filter web typecheck` / `lint` / `build` pass
- [ ] `pnpm --filter web test` passes
#### Manual
- [ ] Opening the proposal form and the session form shows the calendar-pick button + time input (no raw datetime-local)
- [ ] Picking a day in the modal + a time fills the field; submitting creates the correct `scheduled_at` (verify the saved date/time matches what was picked)
- [ ] Editing an existing session pre-fills the picker with its current date/time
- [ ] Existing session create/edit still works end to end

---

## Testing Checkpoints (for resume)
- **After P1**: proposals create/list/delete with correct RLS; no availability/confirm/notifications.
- **After P2**: Available/Busy toggle persists; who-approved + "N / M" shown; identity enforced server-side; never auto-confirms.
- **After P3**: full approval confirms once and creates exactly one `campaign_session`; concurrency-safe; partial approval does nothing.
- **After P4**: confirmation fans out per-participant notifications; shell bell badge shows/clears unread; cross-campaign isolation holds.
- **After P5**: both forms use the calendar modal + time input; ISO `scheduled_at` correct; legacy session flow unaffected.

> Cross-phase coupling: `set_proposal_availability` is `create or replace`d three times (P2 upsert-only → P3 +confirm → P4 +notifications). Apply migrations in order; each supersedes the prior definition.
