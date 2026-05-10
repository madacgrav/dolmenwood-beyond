-- Migration: Add character_id to mounts table and add referee read-only RLS policies
-- for retainers, spell_slots, and spell_preparations.

-- ── 1. Mounts: add character_id column ───────────────────────────────────────
alter table public.mounts
  add column if not exists character_id uuid references public.characters(id) on delete cascade;

-- ── 2. Mounts: add referee view policy ───────────────────────────────────────
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'mounts'
      and policyname = 'Referees can view campaign mounts'
  ) then
    execute $policy$
      create policy "Referees can view campaign mounts"
        on public.mounts for select
        using (
          campaign_id is not null and
          exists (
            select 1 from public.campaigns c
            where c.id = mounts.campaign_id
              and c.referee_id = auth.uid()
          )
        )
    $policy$;
  end if;
end $$;

-- ── 3. Retainers: add referee read policy ────────────────────────────────────
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'retainers'
      and policyname = 'Referees can view retainers of campaign characters'
  ) then
    execute $policy$
      create policy "Referees can view retainers of campaign characters"
        on public.retainers for select
        using (
          exists (
            select 1 from public.characters ch
            join public.campaign_members cm on cm.account_id = ch.owner_id
            join public.campaigns c on c.id = cm.campaign_id
            where ch.id = retainers.owner_character_id
              and c.referee_id = auth.uid()
          )
        )
    $policy$;
  end if;
end $$;

-- ── 4. Spell slots: add referee read policy ──────────────────────────────────
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'spell_slots'
      and policyname = 'Referees can view spell slots of campaign characters'
  ) then
    execute $policy$
      create policy "Referees can view spell slots of campaign characters"
        on public.spell_slots for select
        using (
          exists (
            select 1 from public.characters ch
            join public.campaign_members cm on cm.account_id = ch.owner_id
            join public.campaigns c on c.id = cm.campaign_id
            where ch.id = spell_slots.character_id
              and c.referee_id = auth.uid()
          )
        )
    $policy$;
  end if;
end $$;

-- ── 5. Spell preparations: add referee read policy ───────────────────────────
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'spell_preparations'
      and policyname = 'Referees can view spell preparations of campaign characters'
  ) then
    execute $policy$
      create policy "Referees can view spell preparations of campaign characters"
        on public.spell_preparations for select
        using (
          exists (
            select 1 from public.characters ch
            join public.campaign_members cm on cm.account_id = ch.owner_id
            join public.campaigns c on c.id = cm.campaign_id
            where ch.id = spell_preparations.character_id
              and c.referee_id = auth.uid()
          )
        )
    $policy$;
  end if;
end $$;
