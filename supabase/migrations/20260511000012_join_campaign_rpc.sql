create or replace function public.join_campaign(p_invite_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
  v_campaign_name text;
begin
  select id, name into v_campaign_id, v_campaign_name
  from public.campaigns
  where invite_code = upper(trim(p_invite_code));

  if v_campaign_id is null then
    raise exception 'Invalid invite code';
  end if;

  -- Check not already a member
  if exists (select 1 from public.campaign_members where campaign_id = v_campaign_id and account_id = auth.uid()) then
    raise exception 'Already a member of this campaign';
  end if;

  insert into public.campaign_members (campaign_id, account_id)
  values (v_campaign_id, auth.uid());

  return json_build_object('campaign_id', v_campaign_id, 'campaign_name', v_campaign_name);
end;
$$;

revoke execute on function public.join_campaign(text) from public;
grant execute on function public.join_campaign(text) to authenticated;
