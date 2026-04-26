# Database Schema — Dolmenwood Beyond

Supabase-hosted PostgreSQL. Row Level Security (RLS) is enabled on **all** tables.

---

## Migrations

| File | Description |
|------|-------------|
| `20260425000001_initial_schema.sql` | All 12 core tables + RLS policies + auth triggers |
| `20260425000002_equipment_catalog.sql` | `catalog_items` table + 97 equipment items |
| `20260425000003_invite_code_function.sql` | `generate_invite_code()` function |

---

## Entity Relationship Overview

```
auth.users (Supabase managed)
    │ FK (1:1)
    ▼
accounts
    │ FK (1:many)
    ├──► campaigns (as referee_id)
    ├──► campaign_members (as account_id)
    └──► characters (as owner_id)
              │ FK (1:many)
              ├──► character_inventory
              ├──► character_spells
              ├──► character_spell_slots
              ├──► level_up_log
              ├──► retainers
              │        │ FK
              │        └──► character_inventory (retainer gear)
              └──► mounts
                       │ FK
                       └──► character_inventory (mount gear)

campaigns
    │ FK (1:many)
    └──► campaign_members
              │
              └──► accounts + characters cross-joined
```

---

## Table Reference

### `public.accounts`
Extends `auth.users` (1:1 via FK on `id`). Created automatically by `handle_new_user()` trigger on Supabase signup.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | FK → `auth.users.id` |
| `email` | text | Copied from auth on creation |
| `role` | text | `'player'` or `'referee'` |
| `display_name` | text | User's chosen display name |
| `invite_code` | text | 6-char unique code from `generate_invite_code()` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**RLS**: Users can SELECT/UPDATE their own row. INSERT allowed for own id only.

---

### `public.campaigns`
Referee-created campaigns that group characters.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `name` | text | Campaign name |
| `referee_id` | uuid | FK → `accounts.id` |
| `invite_code` | text UNIQUE | Used for player join |
| `created_at` | timestamptz | |

**RLS**: Referees can manage their own campaigns. Players can SELECT campaigns they are members of.

---

### `public.campaign_members`
Join table between campaigns and accounts.

| Column | Type | Notes |
|--------|------|-------|
| `campaign_id` | uuid | FK → `campaigns.id` |
| `account_id` | uuid | FK → `accounts.id` |
| `joined_at` | timestamptz | |

**PK**: `(campaign_id, account_id)`

---

### `public.characters`
The central entity. One character per row.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `owner_id` | uuid | FK → `accounts.id` |
| `name` | text | |
| `sex` | text | Optional, free text |
| `age` | text | Optional |
| `height` | text | Optional |
| `weight` | text | Optional |
| `kindred` | text | `'Human'` \| `'Breggle'` \| `'Elf'` \| `'Grimalkin'` \| `'Mossling'` \| `'Woodgrue'` |
| `character_class` | text | One of 9 classes |
| `alignment` | text | `'lawful'` \| `'neutral'` \| `'chaotic'` |
| `moon_sign` | text | Optional |
| `background` | text | Optional free-text |
| `level` | int | Default 1 |
| `xp` | int | Default 0 |
| `ability_scores` | jsonb | `{"str":N,"int":N,"wis":N,"dex":N,"con":N,"cha":N}` |
| `hp_current` | int | |
| `hp_max` | int | |
| `portrait_url` | text | Optional, URL to uploaded image |
| `notes` | text | Free-form character notes |
| `is_active` | bool | Soft delete flag |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**RLS**: Players own their own characters (SELECT/INSERT/UPDATE/DELETE where `owner_id = auth.uid()`). Referees can SELECT characters belonging to campaign members.

> **Note**: `ability_scores` is JSONB — always cast in TypeScript: `row.ability_scores as AbilityScores`

---

### `public.character_inventory`
Equipment and items carried by a character, retainer, or mount.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `character_id` | uuid | FK → `characters.id` |
| `item_name` | text | |
| `item_type` | text | `'weapon'` \| `'armour'` \| `'gear'` \| `'consumable'` \| `'other'` |
| `quantity` | int | Default 1 |
| `weight_coins` | int | Weight in coins (Dolmenwood unit) |
| `notes` | text | Optional |
| `created_at` | timestamptz | |

**RLS**: Inherited from character ownership.

---

### `public.character_spells`
Spells known/memorized by a character.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `character_id` | uuid | FK → `characters.id` |
| `spell_name` | text | |
| `spell_level` | int | 1–6 |
| `is_memorized` | bool | Default false |
| `notes` | text | Optional |

---

### `public.character_spell_slots`
Tracks used/available spell slots per level per character.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `character_id` | uuid | FK → `characters.id` |
| `spell_rank` | int | 1–6 |
| `slots_total` | int | Max slots at this rank |
| `slots_used` | int | Used (expended) slots |

---

### `public.level_up_log`
Audit trail of level-up events.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `character_id` | uuid | FK → `characters.id` |
| `from_level` | int | |
| `to_level` | int | |
| `hp_roll` | int | Raw die result |
| `hp_roll_final` | int | After CON modifier |
| `changes` | jsonb | Array of `{field, oldValue, newValue}` |
| `created_at` | timestamptz | |

---

### `public.retainers`
Hireling NPCs attached to a character.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `owner_character_id` | uuid | FK → `characters.id` |
| `name` | text | |
| `kindred` | text | |
| `character_class` | text | |
| `level` | int | |
| `ac` | int | |
| `hp_current` | int | |
| `hp_max` | int | |
| `attack_bonus` | int | |
| `saves` | jsonb | `SaveTargets` object |
| `speed` | int | |
| `morale` | int | |
| `loyalty` | int | |
| `wage_type` | text | `'daily'` \| `'share'` |
| `wage_amount` | int | |
| `is_promoted_to_pc` | bool | If true, converted to full character |

---

### `public.mounts`
Horses, ponies, and other mounts.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `owner_id` | uuid | FK → `characters.id` |
| `campaign_id` | uuid | Optional FK → `campaigns.id` |
| `name` | text | |
| `mount_type` | text | e.g. `'horse'`, `'pony'`, `'mule'` |
| `speed` | int | ft/round |
| `has_full_stats` | bool | |
| `ac` | int | Optional |
| `hp_current` | int | Optional |
| `hp_max` | int | Optional |
| `attack_bonus` | int | Optional |
| `saves` | jsonb | Optional `SaveTargets` |
| `morale` | int | Optional |

---

### `public.catalog_items`
Reference table of 97 equipment items from the Dolmenwood Player's Book. Read-only (no RLS needed for SELECT).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `name` | text | Item name |
| `category` | text | `'weapon'`, `'armour'`, `'gear'`, etc. |
| `cost_gp` | numeric | Cost in gold pieces |
| `weight_coins` | int | Weight in coins |
| `damage_dice` | text | Weapons only, e.g. `'1d8'` |
| `ac_bonus` | int | Armour only |
| `notes` | text | Any special rules |

---

## Functions & Triggers

### `generate_invite_code()`
Returns a 6-character alphanumeric invite code, retrying on collision (max 10 attempts).
```sql
SELECT generate_invite_code(); -- e.g. 'X4KR9T'
```

### `handle_new_user()`
Trigger on `auth.users` INSERT. Automatically creates an `accounts` row on Supabase signup, reading `role` and `display_name` from `raw_user_meta_data`.

```sql
-- Fires on: AFTER INSERT ON auth.users
-- Creates: public.accounts row with matching id + invite code
```

---

## Local Development

```bash
# Start local Supabase stack (Docker required)
npx supabase start

# Apply migrations
npx supabase db reset

# Generate TypeScript types from schema (optional)
npx supabase gen types typescript --local > packages/types/src/supabase.ts
```

The local Supabase dashboard runs at `http://localhost:54323`.
The local API URL is `http://localhost:54321`.
