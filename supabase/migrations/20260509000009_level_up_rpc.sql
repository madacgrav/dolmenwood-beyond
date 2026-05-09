-- ============================================================
-- LEVEL UP RPC — atomic, server-side-validated level progression
-- ============================================================
-- Replaces the two-call pattern (characters.update + level_up_logs.insert)
-- in handleConfirm with a single SECURITY DEFINER function that:
--   1. Validates the caller owns the character
--   2. Validates monotonic level progression (current level = new_level - 1)
--   3. Validates XP meets the threshold for the new level
--   4. Atomically updates the character and inserts the audit log
--
-- This fixes:
--   - R2-C2: level_up_logs INSERT was always rejected (RLS timing bug)
--   - R2-C3: no server-side XP sufficiency gate

create or replace function public.level_up(
  p_character_id  uuid,
  p_new_level     integer,
  p_hp_gain       integer,
  p_hp_roll       integer,
  p_changes       jsonb,
  p_xp_threshold  integer default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_level integer;
  v_current_xp    integer;
begin
  -- Basic input validation
  if p_new_level < 2 or p_new_level > 15 then
    raise exception 'invalid target level: %', p_new_level;
  end if;
  if p_hp_gain < 0 then
    raise exception 'hp_gain cannot be negative';
  end if;

  -- Fetch character state, implicitly validating ownership via WHERE owner_id = auth.uid()
  select level, xp
  into   v_current_level, v_current_xp
  from   public.characters
  where  id       = p_character_id
    and  owner_id = auth.uid();

  if not found then
    raise exception 'character not found or access denied: %', p_character_id;
  end if;

  -- Validate monotonic level progression (prevents skipping levels via direct API calls)
  if v_current_level != p_new_level - 1 then
    raise exception 'level mismatch: character is at level %, cannot advance to level %',
      v_current_level, p_new_level;
  end if;

  -- Validate XP threshold when one exists (p_xp_threshold = 0 means max level or no gate)
  if p_xp_threshold > 0 and v_current_xp < p_xp_threshold then
    raise exception 'insufficient XP: character has %, requires % for level %',
      v_current_xp, p_xp_threshold, p_new_level;
  end if;

  -- Atomically update the character
  update public.characters
  set    level      = p_new_level,
         hp_max     = hp_max     + p_hp_gain,
         hp_current = hp_current + p_hp_gain
  where  id = p_character_id;

  -- Insert the audit log (within the same transaction — bypasses RLS via SECURITY DEFINER)
  insert into public.level_up_logs (
    character_id,
    from_level,
    to_level,
    hp_roll,
    hp_roll_final,
    changes
  )
  values (
    p_character_id,
    p_new_level - 1,
    p_new_level,
    p_hp_roll,
    p_hp_gain,
    coalesce(p_changes, '[]'::jsonb)
  );
end;
$$;

-- Restrict to authenticated users only
revoke execute on function public.level_up(uuid, integer, integer, integer, jsonb, integer) from public;
grant  execute on function public.level_up(uuid, integer, integer, integer, jsonb, integer) to authenticated;
