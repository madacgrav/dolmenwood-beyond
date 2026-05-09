-- Spell slot usage tracking (per rank, per day)
create table if not exists public.spell_slots (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  spell_rank integer not null check (spell_rank >= 1 and spell_rank <= 6),
  slots_total integer not null default 0,
  slots_used integer not null default 0 check (slots_used >= 0),
  unique (character_id, spell_rank)
);
alter table public.spell_slots enable row level security;
create policy "Owners manage spell slots"
  on public.spell_slots for all
  using (exists (select 1 from public.characters where id = spell_slots.character_id and owner_id = auth.uid()))
  with check (exists (select 1 from public.characters where id = spell_slots.character_id and owner_id = auth.uid()));

-- Today's prepared spells (spell chosen for a slot)
create table if not exists public.spell_preparations (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  slot_rank integer not null check (slot_rank >= 1 and slot_rank <= 6),
  spell_name text not null,
  is_cast boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.spell_preparations enable row level security;
create policy "Owners manage spell preparations"
  on public.spell_preparations for all
  using (exists (select 1 from public.characters where id = spell_preparations.character_id and owner_id = auth.uid()))
  with check (exists (select 1 from public.characters where id = spell_preparations.character_id and owner_id = auth.uid()));
