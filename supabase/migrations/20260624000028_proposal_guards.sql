-- ============================================================
-- PROPOSAL GUARDS + review fixes
--  1. Prevent client-side tampering with proposal status / confirmed_session_id
--     (managed solely by the confirm RPC) and make campaign_id / created_by
--     immutable. Closes the gap where a creator could directly PATCH a proposal
--     to 'confirmed', bypassing the all-participants-available gate.
--  2. Scope nested availability to current participants (members ∪ referee) so
--     the UI's approved count matches the server confirm threshold and stale
--     rows from departed members are excluded.
--  3. Attribute the confirmed session to the proposer, not the last approver.
-- ============================================================

-- (1) Guard trigger. Only the confirm RPC — which sets a transaction-local flag
-- before its privileged writes — may move status / confirmed_session_id.
create or replace function public.guard_date_proposal_update()
returns trigger
language plpgsql
as $$
begin
  if (new.status is distinct from old.status
      or new.confirmed_session_id is distinct from old.confirmed_session_id)
     and coalesce(current_setting('app.confirming_proposal', true), '') <> 'on' then
    raise exception 'Proposal status is managed by the system';
  end if;

  if new.campaign_id is distinct from old.campaign_id
     or new.created_by is distinct from old.created_by then
    raise exception 'Cannot change a proposal''s campaign or owner';
  end if;

  return new;
end;
$$;

create trigger guard_date_proposal_update
  before update on public.date_proposals
  for each row execute function public.guard_date_proposal_update();

-- (1)+(3) Re-declare the confirm RPC: raise the transaction-local flag before the
-- privileged status writes, and attribute the new session to the proposer.
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
  v_created_by uuid;
  v_participants int;
  v_approved int;
  v_session_id uuid;
begin
  select campaign_id, status, scheduled_at, title, notes, created_by
    into v_campaign_id, v_status, v_scheduled_at, v_title, v_notes, v_created_by
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
    -- Permit this transaction's status / confirmed_session_id writes past the guard.
    perform set_config('app.confirming_proposal', 'on', true);

    -- Claim the confirm exactly once; concurrent caller's WHERE finds no open row.
    update public.date_proposals
      set status = 'confirmed'
      where id = p_proposal_id and status = 'open';

    if found then
      insert into public.campaign_sessions (campaign_id, title, scheduled_at, notes, created_by)
      values (v_campaign_id, v_title, v_scheduled_at, v_notes, v_created_by)
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

-- (2) Re-declare the read RPC: nested availability limited to current participants.
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
            and pa.account_id in (
              select account_id from public.campaign_members where campaign_id = dp.campaign_id
              union
              select referee_id from public.campaigns where id = dp.campaign_id
            )
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
