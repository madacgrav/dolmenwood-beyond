# Database Schema — Dolmenwood Beyond

Supabase-hosted PostgreSQL. Row Level Security (RLS) is enabled on **all** tables.

---

## Migrations

| File | Description |
|------|-------------|
| `20260425000001_initial_schema.sql` | All 12 core tables + RLS policies + auth triggers |
| `20260425000002_equipment_catalog.sql` | `catalog_items` table + 97 equipment items |
| `20260425000003_invite_code_function.sql` | `generate_invite_code()` function for campaigns |
| `20260425000004_accounts_invite_code.sql` | Per-account invite code + `generate_account_invite_code()` function |
| `20260425000005_fix_rls_recursion.sql` | Security-definer helper to break campaign/campaign_members RLS recursion |
| `20260503000006_banking.sql` | Add `coins_gp`, `coins_sp`, `coins_cp` columns to `characters` |
| `20260503000007_campaign_management.sql` | `is_account_in_my_campaign()` helper + RLS for accounts visibility |
| `20260508000008_award_xp_rpc.sql` | `award_xp(character_id, gain)` security-definer RPC for referees |
| `20260509000009_level_up_rpc.sql` | `level_up(character_id, new_level, hp_roll_final)` atomic level-up RPC |
| `20260510000010_character_inventory_formal.sql` | Formal `character_inventory` table with location, weapon/armour stats, catalog linking |
| `20260511000011_spell_slot_tracking.sql` | `spell_slots` table (per-rank slot tracking) |
| `20260511000012_join_campaign_rpc.sql` | `join_campaign(invite_code)` security-definer RPC |
| `20260511000013_admin_role.sql` | `is_admin` column on accounts + self-escalation prevention RLS |
| `20260512000014_review_fixes.sql` | Security fixes: is_admin self-escalation, RLS tightening |
| `20260512000015_notes_enhancements.sql` | Add `session_notes jsonb` + `people_of_note jsonb` to `characters` |
| `20260512000016_portrait_storage.sql` | Supabase Storage `portraits` bucket + initial RLS policies |
| `20260512000017_mounts_and_referee_rls.sql` | Add `character_id` column to `mounts`; referee read-only RLS on retainers, spell_slots |
| `20260512000018_portrait_rls_fix.sql` | Replace portrait RLS with path-ownership enforcement (`{userId}/{charId}/...`) |

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
| `coins_gp` | int | Carried gold pieces (default 0) |
| `coins_sp` | int | Carried silver pieces (default 0) |
| `coins_cp` | int | Carried copper pieces (default 0) |
| `session_notes` | jsonb | Timestamped session note entries (default `[]`) |
| `people_of_note` | jsonb | Named NPC notes (default `[]`) |
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
| `item_type` | text | `'weapon'` \| `'armour'` \| `'gear'` \| `'consumable'` \| `'ammo'` \| `'other'` |
| `quantity` | int | Default 1 |
| `weight_coins` | int | Weight in coins (Dolmenwood unit) |
| `location` | text | `'equipped'` \| `'stowed'` \| `'tiny'` (default `'stowed'`) |
| `weapon_damage_dice` | text | Optional, e.g. `'1d8'` |
| `weapon_attack_bonus` | int | Optional |
| `armour_ac_bonus` | int | Optional |
| `is_from_catalog` | bool | Whether sourced from `catalog_items` |
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

### `public.spell_slots`
Tracks daily spell slot usage per rank per character.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `character_id` | uuid | FK → `characters.id` ON DELETE CASCADE |
| `spell_rank` | int | 1–6 |
| `slots_total` | int | Max slots at this rank |
| `slots_used` | int | Used slots (checked ≥ 0) |

**Unique**: `(character_id, spell_rank)`
**RLS**: Inherited from character ownership.

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

### `join_campaign(p_invite_code text) → json`
Security-definer RPC that joins the calling player to a campaign by invite code. Creates a `campaign_members` row and returns the campaign record.

### `level_up(p_character_id uuid, p_new_level int, p_hp_roll_final int) → void`
Security-definer RPC for atomic level-up. Validates character ownership, monotonic level progression, and XP threshold, then updates the character and inserts an audit log entry.

### `award_xp(p_character_id uuid, p_gain int) → int`
Security-definer RPC for referees. Validates the caller is a referee for a campaign the character belongs to, increments XP atomically, and returns the new XP total.

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
