-- ============================================================
-- FORMALLY MIGRATE character_inventory TABLE
-- Adds the table if not yet created, and fills in missing columns
-- for location tracking, weapon stats, and catalog linking.
-- ============================================================

create table if not exists public.character_inventory (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  item_name text not null,
  item_type text not null check (item_type in ('weapon', 'armour', 'gear', 'consumable', 'other')),
  quantity integer not null default 1 check (quantity >= 1),
  weight_coins integer not null default 0 check (weight_coins >= 0),
  notes text,
  location text not null default 'stowed' check (location in ('equipped', 'stowed', 'tiny')),
  weapon_damage_dice text,
  armor_ac_bonus integer,
  catalog_item_id uuid,
  created_at timestamptz not null default now()
);

-- Add new columns to existing installs (safe — ignored if column already exists)
alter table public.character_inventory
  add column if not exists location text not null default 'stowed';

alter table public.character_inventory
  add column if not exists weapon_damage_dice text;

alter table public.character_inventory
  add column if not exists armor_ac_bonus integer;

alter table public.character_inventory
  add column if not exists catalog_item_id uuid;

create index if not exists idx_char_inv_character on public.character_inventory(character_id);

alter table public.character_inventory enable row level security;

do $$ begin
  create policy "Players can manage their own character inventory"
    on public.character_inventory for all
    using (
      exists (
        select 1 from public.characters
        where id = character_inventory.character_id
          and owner_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Referees and campaign members can view character inventory"
    on public.character_inventory for select
    using (
      exists (
        select 1 from public.characters c
        join public.campaign_members cm on cm.account_id = c.owner_id
        join public.campaigns camp on camp.id = cm.campaign_id
        where c.id = character_inventory.character_id
          and (camp.referee_id = auth.uid() or cm.account_id = auth.uid())
      )
    );
exception when duplicate_object then null; end $$;

-- ============================================================
-- CHARACTERS TABLE — add notes column if missing
-- ============================================================
alter table public.characters
  add column if not exists notes text;
