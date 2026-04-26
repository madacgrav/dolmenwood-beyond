-- Fix infinite recursion between campaigns <-> campaign_members RLS policies.
--
-- Root cause:
--   "Referees can view all members in their campaigns" on campaign_members
--     -> sub-selects from campaigns (triggers campaigns SELECT policies)
--   "Players can view campaigns they belong to" on campaigns
--     -> sub-selects from campaign_members (triggers campaign_members SELECT policies)
--   -> infinite loop
--
-- Fix: introduce a SECURITY DEFINER helper function that reads campaign_members
-- without triggering RLS, then use it in all policies that need cross-table checks.

-- 1. Helper: check if caller is a member of a given campaign (bypasses RLS)
create or replace function public.is_campaign_member(p_campaign_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.campaign_members
    where campaign_id = p_campaign_id
      and account_id = auth.uid()
  );
$$;

-- 2. Helper: check if caller is the referee of a given campaign (bypasses RLS)
create or replace function public.is_campaign_referee(p_campaign_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.campaigns
    where id = p_campaign_id
      and referee_id = auth.uid()
  );
$$;

-- 3. Drop the recursive policies
drop policy if exists "Players can view campaigns they belong to" on public.campaigns;
drop policy if exists "Referees can view all members in their campaigns" on public.campaign_members;
drop policy if exists "Campaign members can view each other's characters" on public.characters;
drop policy if exists "Referees can view characters in their campaigns" on public.characters;
drop policy if exists "Campaign members can manage party mounts" on public.mounts;

-- 4. Recreate campaigns policy using the SECURITY DEFINER helper (no recursion)
create policy "Players can view campaigns they belong to"
  on public.campaigns for select
  using (public.is_campaign_member(id));

-- 5. Recreate campaign_members policy using the SECURITY DEFINER helper (no recursion)
create policy "Referees can view all members in their campaigns"
  on public.campaign_members for select
  using (public.is_campaign_referee(campaign_id));

-- 6. Recreate characters policies using SECURITY DEFINER helpers
create policy "Campaign members can view each other's characters"
  on public.characters for select
  using (
    exists (
      select 1 from public.campaign_members cm
      where cm.account_id = characters.owner_id
        and public.is_campaign_member(cm.campaign_id)
    )
  );

create policy "Referees can view characters in their campaigns"
  on public.characters for select
  using (
    exists (
      select 1 from public.campaign_members cm
      where cm.account_id = characters.owner_id
        and public.is_campaign_referee(cm.campaign_id)
    )
  );

-- 7. Recreate mounts party policy
create policy "Campaign members can manage party mounts"
  on public.mounts for all
  using (
    campaign_id is not null
    and public.is_campaign_member(campaign_id)
  )
  with check (
    campaign_id is not null
    and public.is_campaign_member(campaign_id)
  );
