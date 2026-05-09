-- ============================================================
-- XP AWARD RPC + TIGHTENED level_up_logs RLS
-- ============================================================

-- 1. award_xp: security-definer RPC for referees to grant XP atomically.
--    Validates the caller is a referee for the campaign that contains the target
--    character, then increments xp in-place (no TOCTOU stale-read).
--    Returns the character's new XP total.
create or replace function public.award_xp(p_character_id uuid, p_gain integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_xp integer;
begin
  if p_gain <= 0 then
    raise exception 'p_gain must be a positive integer';
  end if;

  -- Verify the caller is a referee for any campaign containing this character.
  if not exists (
    select 1
    from public.characters ch
    join public.campaign_members cm on cm.account_id = ch.owner_id
    join public.campaigns c         on c.id = cm.campaign_id
    where ch.id = p_character_id
      and c.referee_id = auth.uid()
      and ch.owner_id  != auth.uid()      -- prevent self-award via own campaign
  ) then
    raise exception 'unauthorized: caller is not a referee for this character''s campaign';
  end if;

  -- Atomic increment — avoids client-side stale-read overwrite.
  update public.characters
  set xp = xp + p_gain
  where id = p_character_id
  returning xp into v_new_xp;

  if v_new_xp is null then
    raise exception 'character not found: %', p_character_id;
  end if;

  return v_new_xp;
end;
$$;

-- 2. Tighten level_up_logs RLS: replace the permissive FOR ALL policy with
--    separate SELECT and INSERT policies. The INSERT policy adds a WITH CHECK
--    that prevents players from fabricating log entries.

drop policy if exists "Players can view and create level up logs for their characters" on public.level_up_logs;

create policy "Players can view level up logs for their characters"
  on public.level_up_logs for select
  using (
    exists (
      select 1 from public.characters
      where id = level_up_logs.character_id
        and owner_id = auth.uid()
    )
  );

create policy "Players can create level up logs for their characters"
  on public.level_up_logs for insert
  with check (
    -- Must own the character (level check excluded — character is already at to_level when INSERT runs)
    exists (
      select 1 from public.characters
      where id = level_up_logs.character_id
        and owner_id = auth.uid()
    )
    -- Log must record exactly one level increment
    and level_up_logs.to_level = level_up_logs.from_level + 1
  );

-- Restrict award_xp to authenticated users only (no anonymous access)
revoke execute on function public.award_xp(uuid, integer) from public;
grant  execute on function public.award_xp(uuid, integer) to authenticated;
