-- ============================================================
-- REVIEW FIXES — feature/next4 security & correctness issues
-- ============================================================

-- ── 1. Fix is_admin self-escalation (SEC-C1) ─────────────────
-- The existing UPDATE policy has no WITH CHECK — any user could
-- set their own is_admin = true. Replace it with one that
-- prevents users from changing the is_admin field on their own row.
drop policy if exists "Users can update their own account" on public.accounts;

create policy "Users can update their own account"
  on public.accounts for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- Prevent self-promotion: new is_admin must equal the current stored value
    and is_admin = (select a.is_admin from public.accounts a where a.id = auth.uid())
  );

-- ── 2. Remove hardcoded email from admin trigger (ARCH-C1) ────
-- Replace the trigger function that compared against a hardcoded
-- personal email with a no-op. Admin status is bootstrapped via
-- the manual UPDATE in migration 013 and managed via Supabase dashboard.
create or replace function public.set_admin_on_signup()
returns trigger language plpgsql
security definer
set search_path = public
as $$
begin
  -- Admin status is set manually via Supabase Dashboard SQL console.
  -- No automatic promotion on signup.
  return new;
end;
$$;

-- ── 3. Add upper-bound CHECK on spell_slots.slots_used (SEC-H1) ─
-- The existing constraint only prevents slots_used < 0.
-- Add a constraint preventing slots_used > slots_total.
alter table public.spell_slots
  drop constraint if exists chk_slots_used_lte_total;

alter table public.spell_slots
  add constraint chk_slots_used_lte_total
  check (slots_used <= slots_total);

-- ── 4. Make migration 011 policies idempotent (DEVOPS-M2) ─────
-- Bare CREATE POLICY fails on retry if policy already exists.
-- Re-create both spell table policies with drop-if-exists guard.
drop policy if exists "Owners manage spell slots" on public.spell_slots;
do $$ begin
  create policy "Owners manage spell slots"
    on public.spell_slots for all
    using (
      exists (
        select 1 from public.characters
        where id = spell_slots.character_id and owner_id = auth.uid()
      )
    )
    with check (
      exists (
        select 1 from public.characters
        where id = spell_slots.character_id and owner_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

drop policy if exists "Owners manage spell preparations" on public.spell_preparations;
do $$ begin
  create policy "Owners manage spell preparations"
    on public.spell_preparations for all
    using (
      exists (
        select 1 from public.characters
        where id = spell_preparations.character_id and owner_id = auth.uid()
      )
    )
    with check (
      exists (
        select 1 from public.characters
        where id = spell_preparations.character_id and owner_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

-- ── 5. Fix location CHECK constraint in upgrade path (DEVOPS-M3) ─
-- The ADD COLUMN IF NOT EXISTS path in migration 010 omitted the
-- CHECK constraint. Add it explicitly so it applies on all installs.
alter table public.character_inventory
  drop constraint if exists character_inventory_location_check;

alter table public.character_inventory
  add constraint character_inventory_location_check
  check (location in ('equipped', 'stowed', 'tiny'));

-- ── 6. Fix join_campaign return type conflict (SEC-M2) ────────
-- Migration 007 defined join_campaign returning uuid.
-- Migration 012 tried CREATE OR REPLACE with return type json —
-- PostgreSQL rejects this. Drop and recreate to resolve the conflict.
drop function if exists public.join_campaign(text);

create function public.join_campaign(p_invite_code text)
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

  if exists (
    select 1 from public.campaign_members
    where campaign_id = v_campaign_id and account_id = auth.uid()
  ) then
    raise exception 'Already a member of this campaign';
  end if;

  insert into public.campaign_members (campaign_id, account_id)
  values (v_campaign_id, auth.uid());

  return json_build_object(
    'campaign_id', v_campaign_id,
    'campaign_name', v_campaign_name
  );
end;
$$;

revoke execute on function public.join_campaign(text) from public;
grant  execute on function public.join_campaign(text) to authenticated;

-- ── 7. get_campaign_party_data RPC for PlayerView (ARCH-C2) ──
-- Players cannot read other players' characters via RLS.
-- This SECURITY DEFINER function enforces campaign membership
-- and returns all party characters in one server-side call.
create or replace function public.get_campaign_party_data(p_campaign_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Verify caller is a member of this campaign
  if not exists (
    select 1 from public.campaign_members
    where campaign_id = p_campaign_id and account_id = auth.uid()
  ) then
    raise exception 'Not a member of this campaign';
  end if;

  return (
    select json_agg(member_data)
    from (
      select
        cm.account_id,
        acc.display_name,
        (
          select json_agg(char_data order by char_data->>'name')
          from (
            select json_build_object(
              'id', ch.id,
              'name', ch.name,
              'character_class', ch.character_class,
              'level', ch.level,
              'kindred', ch.kindred,
              'hp_current', ch.hp_current,
              'hp_max', ch.hp_max,
              'xp', ch.xp
            ) as char_data
            from public.characters ch
            where ch.owner_id = cm.account_id and ch.is_active = true
          ) chars
        ) as characters
      from public.campaign_members cm
      join public.accounts acc on acc.id = cm.account_id
      where cm.campaign_id = p_campaign_id
      order by acc.display_name
    ) member_data
  );
end;
$$;

revoke execute on function public.get_campaign_party_data(uuid) from public;
grant  execute on function public.get_campaign_party_data(uuid) to authenticated;

-- ── 8. Add REVOKE/GRANT for create_campaign (SEC-S4) ─────────
-- PostgreSQL grants EXECUTE to PUBLIC by default.
-- Unauthenticated users could call create_campaign without this.
revoke execute on function public.create_campaign(text) from public;
grant  execute on function public.create_campaign(text) to authenticated;
