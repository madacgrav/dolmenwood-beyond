-- ============================================================
-- CAMPAIGN MANAGEMENT: account visibility + campaign RPCs
-- ============================================================

-- 1. Security definer helper: does the target account share any campaign with the caller?
--    Used in RLS policies on accounts to avoid recursion (same pattern as migration 005).
create or replace function public.is_account_in_my_campaign(p_account_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.campaign_members cm1
    join public.campaign_members cm2 on cm1.campaign_id = cm2.campaign_id
    where cm1.account_id = p_account_id
      and cm2.account_id = auth.uid()
  );
$$;

-- 2. Security definer helper: is the target account a member of any campaign the caller referees?
create or replace function public.is_account_in_my_campaign_as_referee(p_account_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.campaign_members cm
    join public.campaigns c on c.id = cm.campaign_id
    where cm.account_id = p_account_id
      and c.referee_id = auth.uid()
  );
$$;

-- 3. RLS: referees can view the accounts of their campaign members
drop policy if exists "Referees can view member accounts" on public.accounts;
create policy "Referees can view member accounts"
  on public.accounts for select
  using (public.is_account_in_my_campaign_as_referee(id));

-- 4. RLS: campaign members can view each other's accounts
drop policy if exists "Campaign members can view each other accounts" on public.accounts;
create policy "Campaign members can view each other accounts"
  on public.accounts for select
  using (public.is_account_in_my_campaign(id));

-- 5. Index for fast invite code lookup
create index if not exists idx_campaigns_invite_code
  on public.campaigns(invite_code);

-- 6. create_campaign RPC: referee creates a campaign with an auto-generated invite code.
--    Returns the new campaign id.
create or replace function public.create_campaign(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_code text;
begin
  v_code := public.generate_invite_code();
  insert into public.campaigns (name, referee_id, invite_code)
  values (p_name, auth.uid(), v_code)
  returning id into v_id;
  return v_id;
end;
$$;

-- 7. join_campaign RPC: player calls this with an invite code to join a campaign.
--    Returns the campaign_id on success, NULL if the code is invalid.
--    Runs as security definer so it can SELECT campaigns without a broad SELECT policy.
create or replace function public.join_campaign(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
begin
  select id into v_campaign_id
  from public.campaigns
  where invite_code = upper(trim(p_invite_code));

  if v_campaign_id is null then
    return null;
  end if;

  -- Insert if not already a member (idempotent)
  insert into public.campaign_members (campaign_id, account_id)
  values (v_campaign_id, auth.uid())
  on conflict (campaign_id, account_id) do nothing;

  return v_campaign_id;
end;
$$;
