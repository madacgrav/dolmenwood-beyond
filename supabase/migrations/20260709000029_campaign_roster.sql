-- Campaign roster RPC.
--
-- The schedule UI needs the full participant list (members ∪ referee) with
-- display names so it can show who has / hasn't responded to proposals and
-- session RSVPs. RLS on campaign_members only lets players see their own
-- membership row, so a direct client join cannot enumerate the roster —
-- this SECURITY DEFINER function enforces participation and returns the
-- list in one server-side call (same pattern as get_campaign_party_data).

create or replace function public.get_campaign_roster(p_campaign_id uuid)
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
    select json_agg(json_build_object(
      'account_id', p.account_id,
      'display_name', acc.display_name,
      'is_referee', p.is_referee
    ) order by acc.display_name)
    from (
      select referee_id as account_id, true as is_referee
      from public.campaigns
      where id = p_campaign_id
      union
      -- Exclude the referee here so they appear exactly once even if they
      -- also hold a campaign_members row.
      select cm.account_id, false as is_referee
      from public.campaign_members cm
      where cm.campaign_id = p_campaign_id
        and cm.account_id <> (select referee_id from public.campaigns where id = p_campaign_id)
    ) p
    join public.accounts acc on acc.id = p.account_id
  ), '[]'::json);
end;
$$;

revoke execute on function public.get_campaign_roster(uuid) from public;
grant  execute on function public.get_campaign_roster(uuid) to authenticated;
