-- ============================================================
-- PROPOSAL AVAILABILITY: per-participant free/busy on a proposal
-- ============================================================
-- One row per (proposal, account). RLS enabled, NO policies —
-- all reads/writes flow through the SECURITY DEFINER RPCs below.
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

-- Upsert the caller's availability (participant-guarded). Confirm logic added in Phase 3.
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
