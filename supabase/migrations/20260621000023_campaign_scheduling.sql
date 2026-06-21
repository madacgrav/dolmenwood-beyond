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
