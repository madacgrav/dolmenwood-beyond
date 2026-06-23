-- ============================================================
-- NOTIFICATIONS: per-account in-app messages. On proposal confirm,
-- fan out one notification per participant.
-- ============================================================
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

-- Re-declare set_proposal_availability to fan out notifications on confirm.
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

      insert into public.notifications (account_id, campaign_id, kind, body, related_session_id)
      select parts.account_id, v_campaign_id, 'date_confirmed',
             'Session confirmed: ' || v_title, v_session_id
      from (
        select account_id from public.campaign_members where campaign_id = v_campaign_id
        union
        select referee_id from public.campaigns where id = v_campaign_id
      ) parts;
    end if;
  end if;
end;
$$;
