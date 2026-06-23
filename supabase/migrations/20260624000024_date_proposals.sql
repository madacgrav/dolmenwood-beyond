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

-- Read RPC: proposals for a campaign (participant-guarded). Availability added in Phase 2.
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
