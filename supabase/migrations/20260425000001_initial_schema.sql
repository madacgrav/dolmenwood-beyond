-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- ACCOUNTS (extends Supabase auth.users)
-- ============================================================
create table public.accounts (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('player', 'referee')),
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.accounts enable row level security;

create policy "Users can view their own account"
  on public.accounts for select
  using (auth.uid() = id);

create policy "Users can update their own account"
  on public.accounts for update
  using (auth.uid() = id);

create policy "Users can insert their own account"
  on public.accounts for insert
  with check (auth.uid() = id);

-- ============================================================
-- CAMPAIGNS
-- ============================================================
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  referee_id uuid not null references public.accounts(id) on delete cascade,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

alter table public.campaigns enable row level security;

create policy "Referees can manage their own campaigns"
  on public.campaigns for all
  using (auth.uid() = referee_id);

create policy "Players can view campaigns they belong to"
  on public.campaigns for select
  using (
    exists (
      select 1 from public.campaign_members
      where campaign_id = campaigns.id
        and account_id = auth.uid()
    )
  );

-- ============================================================
-- CAMPAIGN MEMBERS
-- ============================================================
create table public.campaign_members (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (campaign_id, account_id)
);

alter table public.campaign_members enable row level security;

create policy "Members can view their own memberships"
  on public.campaign_members for select
  using (auth.uid() = account_id);

create policy "Referees can view all members in their campaigns"
  on public.campaign_members for select
  using (
    exists (
      select 1 from public.campaigns
      where id = campaign_members.campaign_id
        and referee_id = auth.uid()
    )
  );

create policy "Players can join campaigns"
  on public.campaign_members for insert
  with check (auth.uid() = account_id);

create policy "Members can leave campaigns"
  on public.campaign_members for delete
  using (auth.uid() = account_id);

-- ============================================================
-- CHARACTERS
-- ============================================================
create table public.characters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.accounts(id) on delete cascade,
  name text not null,
  sex text,
  age text,
  height text,
  weight text,
  kindred text not null check (kindred in ('Human', 'Breggle', 'Elf', 'Grimalkin', 'Mossling', 'Woodgrue')),
  character_class text not null check (character_class in ('Cleric', 'Enchanter', 'Fighter', 'Friar', 'Hunter', 'Knight', 'Magician', 'Thief', 'Bard')),
  alignment text not null check (alignment in ('lawful', 'neutral', 'chaotic')),
  moon_sign text,
  background text,
  level integer not null default 1 check (level >= 1 and level <= 15),
  xp integer not null default 0 check (xp >= 0),
  ability_scores jsonb not null default '{"str":10,"int":10,"wis":10,"dex":10,"con":10,"cha":10}',
  hp_current integer not null default 1,
  hp_max integer not null default 1,
  portrait_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_characters_owner_id on public.characters(owner_id);

alter table public.characters enable row level security;

create policy "Players can manage their own characters"
  on public.characters for all
  using (auth.uid() = owner_id);

create policy "Referees can view characters in their campaigns"
  on public.characters for select
  using (
    exists (
      select 1 from public.campaign_members cm
      join public.campaigns c on c.id = cm.campaign_id
      where cm.account_id = characters.owner_id
        and c.referee_id = auth.uid()
    )
  );

create policy "Campaign members can view each other's characters"
  on public.characters for select
  using (
    exists (
      select 1 from public.campaign_members cm1
      join public.campaign_members cm2 on cm1.campaign_id = cm2.campaign_id
      where cm1.account_id = characters.owner_id
        and cm2.account_id = auth.uid()
    )
  );

-- ============================================================
-- CHARACTER CAMPAIGN DATA
-- ============================================================
create table public.character_campaign_data (
  character_id uuid not null references public.characters(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  xp_earned integer not null default 0,
  notes text,
  affiliation text,
  primary key (character_id, campaign_id)
);

alter table public.character_campaign_data enable row level security;

create policy "Players can manage their own campaign character data"
  on public.character_campaign_data for all
  using (
    exists (
      select 1 from public.characters
      where id = character_campaign_data.character_id
        and owner_id = auth.uid()
    )
  );

-- ============================================================
-- RETAINERS
-- ============================================================
create table public.retainers (
  id uuid primary key default gen_random_uuid(),
  owner_character_id uuid not null references public.characters(id) on delete cascade,
  name text not null,
  kindred text not null,
  character_class text not null,
  level integer not null default 1,
  ac integer not null default 10,
  hp_current integer not null default 1,
  hp_max integer not null default 1,
  attack_bonus integer not null default 0,
  saves jsonb not null default '{"doom":15,"ray":15,"hold":15,"blast":15,"spell":15}',
  speed integer not null default 30,
  morale integer not null default 7,
  loyalty integer not null default 7,
  wage_type text not null default 'daily' check (wage_type in ('daily', 'share')),
  wage_amount numeric not null default 0,
  is_promoted_to_pc boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_retainers_owner on public.retainers(owner_character_id);

alter table public.retainers enable row level security;

create policy "Players can manage retainers of their characters"
  on public.retainers for all
  using (
    exists (
      select 1 from public.characters
      where id = retainers.owner_character_id
        and owner_id = auth.uid()
    )
  );

-- ============================================================
-- MOUNTS
-- ============================================================
create table public.mounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  owner_type text not null check (owner_type in ('character', 'party')),
  campaign_id uuid references public.campaigns(id) on delete cascade,
  name text not null,
  mount_type text not null,
  speed integer not null default 120,
  has_full_stats boolean not null default false,
  ac integer,
  hp_current integer,
  hp_max integer,
  attack_bonus integer,
  saves jsonb,
  morale integer,
  created_at timestamptz not null default now()
);

alter table public.mounts enable row level security;

create policy "Players can manage their character's mounts"
  on public.mounts for all
  using (
    owner_type = 'character' and
    exists (
      select 1 from public.characters
      where id = mounts.owner_id
        and owner_id = auth.uid()
    )
  );

create policy "Campaign members can manage party mounts"
  on public.mounts for all
  using (
    owner_type = 'party' and
    exists (
      select 1 from public.campaign_members
      where campaign_id = mounts.campaign_id
        and account_id = auth.uid()
    )
  );

-- ============================================================
-- INVENTORY ITEMS
-- ============================================================
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('character', 'retainer', 'mount')),
  owner_id uuid not null,
  name text not null,
  quantity integer not null default 1 check (quantity >= 0),
  weight integer not null default 0,
  weight_override integer,
  location text not null default 'stowed' check (location in ('equipped', 'stowed', 'tiny')),
  is_consumable boolean not null default false,
  item_type text not null check (item_type in ('weapon', 'armor', 'gear', 'spell_component', 'ammo', 'coin')),
  weapon_damage_dice text,
  weapon_attack_bonus integer,
  armor_ac_bonus integer,
  is_from_catalog boolean not null default false,
  catalog_item_id uuid,
  created_at timestamptz not null default now()
);

create index idx_inventory_owner on public.inventory_items(owner_type, owner_id);

alter table public.inventory_items enable row level security;

create policy "Players can manage character inventory"
  on public.inventory_items for all
  using (
    owner_type = 'character' and
    exists (
      select 1 from public.characters
      where id = inventory_items.owner_id
        and owner_id = auth.uid()
    )
  );

create policy "Players can manage retainer inventory"
  on public.inventory_items for all
  using (
    owner_type = 'retainer' and
    exists (
      select 1 from public.retainers r
      join public.characters c on c.id = r.owner_character_id
      where r.id = inventory_items.owner_id
        and c.owner_id = auth.uid()
    )
  );

-- ============================================================
-- SPELL SLOTS
-- ============================================================
create table public.spell_slots (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  spell_rank integer not null check (spell_rank between 1 and 6),
  slots_total integer not null default 0,
  slots_used integer not null default 0,
  spells_memorized text[] not null default '{}',
  unique (character_id, spell_rank)
);

alter table public.spell_slots enable row level security;

create policy "Players can manage their character's spell slots"
  on public.spell_slots for all
  using (
    exists (
      select 1 from public.characters
      where id = spell_slots.character_id
        and owner_id = auth.uid()
    )
  );

-- ============================================================
-- LEVEL UP LOG
-- ============================================================
create table public.level_up_logs (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  from_level integer not null,
  to_level integer not null,
  timestamp timestamptz not null default now(),
  changes jsonb not null default '[]',
  hp_roll integer not null,
  hp_roll_final integer not null
);

create index idx_level_up_logs_character on public.level_up_logs(character_id, timestamp desc);

alter table public.level_up_logs enable row level security;

create policy "Players can view and create level up logs for their characters"
  on public.level_up_logs for all
  using (
    exists (
      select 1 from public.characters
      where id = level_up_logs.character_id
        and owner_id = auth.uid()
    )
  );

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at
  before update on public.characters
  for each row execute function public.handle_updated_at();

-- ============================================================
-- NEW USER TRIGGER (create account record on auth signup)
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.accounts (id, email, role, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'player'),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
