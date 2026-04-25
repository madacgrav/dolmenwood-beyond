# Dolmenwood Beyond — Product Requirements Document

**Version:** 1.0 (Draft)
**Date:** April 25, 2026
**Author:** Adam Graves
**Repository:** https://github.com/madacgrav/dolmenwood-beyond
**Product:** Dolmenwood Beyond — Web & Mobile Character Management App

---

## 1. Executive Summary

Dolmenwood Beyond is a cross-platform Progressive Web App (PWA) built with Next.js that serves as a digital companion for players and Referees of the Dolmenwood tabletop RPG by Necrotic Gnome. The application manages characters, parties, retainers, mounts, combat, and session tooling — replacing paper character sheets with a connected, intelligent, and always-available digital experience.

This document covers the **V1.0 scope: Character Management**, establishing the foundation for all future features. The project is also a living documentation exercise: the developer (a DevOps engineer) is publishing AI-assisted build journals to a WordPress blog after each development session, creating a public record of the AI-first development workflow.

---

## 2. Product Vision & Goals

### 2.1 Vision Statement

> *A faithful digital companion to Dolmenwood — built with the aesthetic of the books, the feel of the table, and the intelligence of modern software.*

### 2.2 V1.0 Goals

- Eliminate paper character sheets entirely for Dolmenwood players
- Automate all derived stats (AC, modifiers, save targets, speed, XP thresholds)
- Guide new players through character creation without requiring the rulebook open
- Provide a fast, reliable mobile experience during active play sessions
- Establish the data model and infrastructure that all future features build on

### 2.3 Success Metrics (V1.0)

- A player can create a complete, valid character in under 5 minutes using the Auto Creation wizard
- All derived statistics (AC, modifiers, saves, attack bonus) are correct per Dolmenwood rules for all 9 classes and all Kindreds
- The app is installable on iOS and Android as a PWA
- Character data persists reliably across sessions and devices
- Zero data loss incidents in first 30 days of live use

---

## 3. Users & Roles

### 3.1 User Types

| Role | Description | V1 Capabilities |
|------|-------------|-----------------|
| **Player** | A Dolmenwood player managing their own characters | Full character creation, sheet management, inventory, retainers, mounts, combat view |
| **Referee** | The Game Master / Dungeon Master | Create campaigns, generate invite codes, read-only view of all character sheets in their campaign |

### 3.2 User Personas

**The Veteran Player** — Knows the rules, wants fast data entry and reliable calculations. Needs manual creation mode and the ability to override any field.

**The New Player** — Has never played Dolmenwood. Needs guided auto-creation with suggestions, tooltips, and the ability to re-roll without reading the rulebook.

**The Referee** — Running a campaign for 3–5 players. Needs to see all character sheets at a glance without managing them. Will use the future DM Screen heavily.

---

## 4. Platform & Technical Architecture

### 4.1 Platform Decision

**V1.0: Progressive Web App (PWA) built with Next.js**

- Single codebase deploys as web app AND installs on iOS/Android home screens
- Offline capability via service workers (character sheets readable without connection)
- V2 path: wrap with Capacitor for native App Store distribution with minimal code changes

### 4.2 Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend Framework** | Next.js (App Router) | SSR/SSG, PWA support, React ecosystem |
| **Language** | TypeScript | Type safety critical for stat calculation engine |
| **Styling** | Tailwind CSS v4 | Rapid UI development, mobile-first |
| **State Management** | Zustand + React Query | Local state + server sync |
| **Database** | Supabase (PostgreSQL) | Auth, real-time, storage — fully managed |
| **Auth** | Supabase Auth | Email + OAuth (Google); Player and Referee roles |
| **Hosting** | Vercel | Zero-config Next.js deployment |
| **Mobile** | PWA (Capacitor in V2) | Install on iOS/Android home screen |
| **CI/CD** | GitHub Actions | Automated lint, test, build, deploy pipeline |
| **IaC** | Vercel + Supabase CLI | Infrastructure managed as code |
| **Blog Integration** | WordPress REST API | Session journals published via API post-session |

### 4.3 Repository Structure

```
dolmenwood-beyond/
├── apps/
│   └── web/                    # Next.js PWA
├── packages/
│   ├── rules-engine/           # Dolmenwood stat calculation logic (pure TS)
│   ├── ui/                     # Shared component library
│   └── types/                  # Shared TypeScript types/interfaces
├── .github/
│   └── workflows/
│       ├── ci.yml              # Lint, type-check, test on PR
│       ├── deploy-preview.yml  # Vercel preview on PR
│       └── deploy-prod.yml     # Deploy to production on main merge
├── supabase/
│   ├── migrations/             # Database schema migrations
│   └── seed.sql                # Reference data (classes, kindreds, equipment)
└── docs/
    └── prd.md                  # This document
```

### 4.4 Data Model (Core Entities)

```
Account
  ├── id
  ├── email
  ├── role: "player" | "referee"
  └── display_name

Campaign
  ├── id
  ├── name
  ├── referee_id (Account)
  ├── invite_code (unique, 6-char)
  └── created_at

CampaignMember
  ├── campaign_id
  ├── account_id
  └── joined_at

Character
  ├── id
  ├── owner_id (Account)
  ├── name, sex, age, height, weight
  ├── kindred, class
  ├── alignment
  ├── moon_sign
  ├── background
  ├── level, xp
  ├── ability_scores: { str, int, wis, dex, con, cha }
  ├── hp_current, hp_max
  ├── portrait_url
  └── is_active

CharacterCampaignData  ← campaign-scoped data (separate from base character)
  ├── character_id
  ├── campaign_id
  ├── xp_earned_this_campaign
  ├── notes
  └── affiliation

Retainer
  ├── id
  ├── owner_character_id (Character)
  ├── name, kindred, class, level
  ├── stats (AC, HP, Attack, Saves, Speed, Morale, Loyalty)
  ├── wage_type: "daily" | "share"
  ├── wage_amount
  ├── is_promoted_to_pc: boolean
  └── inventory[]

Mount
  ├── id
  ├── owner_id: character_id | "party" (for pack animals)
  ├── campaign_id (pack animals scoped to campaign)
  ├── name, type (horse/mule/dog/etc)
  ├── speed
  ├── has_full_stats: boolean  ← true for Knights' warhorses
  ├── stats (AC, HP, Attack, Saves, Morale) — nullable
  └── inventory[]

InventoryItem
  ├── id
  ├── owner_type: "character" | "retainer" | "mount"
  ├── owner_id
  ├── name
  ├── quantity
  ├── weight
  ├── weight_override: number | null
  ├── location: "equipped" | "stowed" | "tiny"
  ├── is_consumable: boolean
  ├── item_type: "weapon" | "armor" | "gear" | "spell_component" | "ammo" | "coin"
  ├── weapon_damage_dice (nullable)
  ├── weapon_attack_bonus (nullable)
  ├── armor_ac_bonus (nullable)
  └── is_from_catalog: boolean

SpellSlot
  ├── character_id
  ├── spell_rank (1-6)
  ├── slots_total
  ├── slots_used
  └── spells_memorized[]

LevelUpLog
  ├── character_id
  ├── from_level, to_level
  ├── timestamp
  ├── changes[] ← list of stat changes applied
  └── hp_roll, hp_roll_final
```

---

## 5. Screen Inventory

### 5.1 Authentication Screens

#### S-01: Sign In / Sign Up
- Email + password authentication
- Google OAuth option
- Role selection on first sign-up: Player or Referee
- Forgot password flow
- No guest mode — account required to persist characters

### 5.2 Navigation Model

**Bottom tab bar (mobile) / Left sidebar (desktop):**

| Tab | Icon | Description |
|-----|------|-------------|
| Characters | Person icon | Character roster |
| Party | Group icon | Campaign/party view |
| Dice | d20 icon | Quick dice roller |
| More | Ellipsis | Settings, account, help |

### 5.3 Character Screens

#### S-02: Character Roster
- Card list of all characters owned by the account
- Each card shows: portrait, name, kindred, class, level, current HP / max HP, AC
- HP shown as colored bar (green/yellow/red based on percentage)
- FAB: "+ New Character" 
- Swipe left to delete (with confirmation dialog)
- Tap character → opens Character Sheet (S-04)
- Sort options: name, level, class, recently viewed
- Empty state: illustrated empty state with "Create your first adventurer" CTA

#### S-03: Character Creation — Mode Select
Two paths presented as large cards:
- **Auto Create** — "Roll your fate. Choose your destiny." — dice imagery
- **Manual Create** — "Forge every detail by hand." — quill imagery
- **Import Existing** — "Bring your paper character to life." — paper-to-screen imagery

---

#### S-03A: Auto Character Creation Wizard

A multi-step wizard. Progress indicator at top showing current step of 13.

**Step 1 — Roll Ability Scores**
- Six 3d6 rolls displayed one at a time with animated dice
- Results populate STR, INT, WIS, DEX, CON, CHA
- Re-roll any individual die showing a 1 (auto-prompted: "That's a 1 — re-roll?")
- Option to re-roll the entire set: "These aren't the stats for me"
- When re-rolling entire set: show side-by-side comparison of Set A vs Set B, user chooses which to keep
- Sub-par character detection: if all scores ≤ 6, or 2+ scores ≤ 3, a banner appears: "These are rough rolls. Re-roll full set?"
- Inline character flavor: as rolls come in, show a personality hint ("High WIS + low DEX suggests a wise but clumsy soul...")

**Step 2 — Choose Kindred**
- Card grid of all Kindreds: Human, Breggle, Elf, Grimalkin, Mossling, Woodgrue
- Each card: kindred name, brief description, key traits, class restrictions
- Suggestion badge: "Suits your rolls" — highlights Kindreds whose traits complement highest ability scores
- Locked indicator on class-restricted Kindreds (e.g., Elf — "Cannot be Cleric or Friar")
- Tap card → expanded detail view before confirming

**Step 3 — Choose Class**
- Card grid of 9 classes (filtered by Kindred restrictions)
- Each card: class name, Prime Abilities highlighted, hit die, combat aptitude, 1-line description
- Suggestion badge on classes whose Prime Abilities match highest rolled scores
- Tap card → full class description with advancement table preview

**Step 4 — Adjust Ability Scores (Optional)**
- Visual 2-for-1 trade tool: slider or +/- controls
- Prime Abilities highlighted in accent color
- Non-prime ability sources shown as "donate" sources
- Live preview of XP modifier impact
- Floor (3) and ceiling (18) enforced with visual guardrails
- "Skip" option — no adjustment required

**Step 5 — Modifiers (Auto-calculated)**
- Display all 6 ability scores with their modifiers
- Auto-calculated, read-only confirmation screen
- Tap any modifier to see tooltip explaining what it affects

**Step 6 — Kindred & Class Traits (Auto-applied)**
- List of all traits from selected Kindred and Class
- Each trait shown as a card with name, mechanical effect, and brief description
- Attack bonus and Save Targets populated from class advancement table at Level 1
- Skill Targets populated per class

**Step 7 — Roll Hit Points**
- Animated die roll (correct die per class — d4 through d10)
- CON modifier shown being applied
- If roll is 1 or 2: "Bad luck! Re-roll?" prompt (per optional rule)
- Final HP shown prominently
- Minimum 1 HP enforced

**Step 8 — Roll Equipment**
- Animated sequential rolls for class equipment
- Results displayed as a growing inventory list
- Adventuring items: roll d24 up to 3 times (or choose from list)
- Trinket: rolled from Kindred table, shown with flavor text
- Optional: "Buy Equipment Instead" toggle — converts to gold roll + manual shopping

**Step 9 — Armour Class (Auto-calculated)**
- AC breakdown shown: base (10) + DEX modifier + armor bonus + kindred bonus + class bonus
- Each component labeled and explained
- Read-only confirmation

**Step 10 — Speed (Auto-calculated)**
- Current encumbrance shown based on rolled equipment
- Speed tier displayed: 40 / 30 / 20 / 10
- Equipped vs. Stowed distinction shown

**Step 11 — Choose Alignment**
- Three large buttons: Lawful | Neutral | Chaotic
- Class restrictions enforced (Clerics/Friars cannot choose Chaotic — option greyed with tooltip)
- Brief description of each alignment's meaning in Dolmenwood

**Step 12 — Level & XP**
- Confirmation screen: Level 1, 0 XP
- XP modifier displayed based on Prime Ability scores
- Next level XP threshold shown

**Step 13 — Name & Details**
- Name: text field + "Roll a Name" button (pulls from Kindred name tables)
- Sex: free text (not restricted)
- Age, Height, Weight: optional free text
- Background: roll button (Kindred background table) or free text
- Physical details: optional roll buttons (fur color, voice, notable feature, etc. per Kindred)
- Beliefs/desires/quirks: optional roll or free text
- Portrait: upload image or skip (kindred silhouette placeholder)

**Final Step — Character Ready**
- Celebration animation
- Full character summary card
- "Begin Adventure" CTA → opens Character Sheet (S-04)

---

#### S-03B: Manual Character Creation

Same 13 steps as Auto, but all fields are editable text inputs from the start. Dice roller available on any field that can be rolled. No suggestions or auto-population — player enters everything. All the same validation rules apply (class restrictions, score floors/ceilings, etc.).

---

#### S-04: Character Sheet

The primary in-play screen. Inspired by the official Dolmenwood PDF sheet aesthetic: same information architecture, typography in the spirit of the book (serif display + clean sans body), forest green / parchment cream palette, clean ruled section dividers — but designed for touch interaction (no literal ruled lines or paper texture).

**Navigation within sheet: Tab bar at top of sheet**

| Tab | Contents |
|-----|----------|
| **Stats** | Ability scores, saves, skills, traits, languages |
| **Combat** | AC breakdown, attack weapons, HP, speed |
| **Inventory** | Equipped, stowed, tiny items; coins; weight tracker |
| **Magic** | Spells/prayers (visible only for spell-casting classes) |
| **Notes** | Background, description details, custom notes |

**Editing Model — Hybrid:**
- HP (current) and XP: always tappable — tap to open quick +/- adjuster
- All other fields: locked by default, "Edit" button in top-right unlocks the sheet
- When unlocked: all fields editable inline, "Save" button appears

---

**Stats Tab**

*Ability Scores block:*
- 2×3 grid showing all 6 ability scores
- Each cell: score (large), modifier (small, colored: green positive / red negative), ability name
- Prime Abilities marked with a small accent dot
- Tap any score → tooltip showing what the modifier affects

*Core stats row:*
- HP (current / max) | AC | Attack Bonus | Speed
- These 4 stats visible at top of every tab as a persistent mini-bar

*Save Targets block:*
- Five saves in a row: Doom | Ray | Hold | Blast | Spell
- Magic Resistance shown below
- Each save tappable → description tooltip

*Skills block:*
- Universal: Listen, Search, Survival (with foraging variant for Friars)
- Class-specific skills listed below (e.g., Thief: Climb Wall, Pick Lock, Stealth, Decipher Doc, Disarm Mechanism, Legerdemain)
- Each skill: name + target number
- Tap skill → inline dice roller pre-configured for that skill check (roll d20, shows pass/fail)

*Kindred & Class Traits block:*
- All traits listed as expandable rows
- Tap any trait → full description

*Languages:*
- List of all known languages
- Extra language slots shown if INT modifier grants them

*Meta info row:*
- Kindred | Class | Level | Alignment | Moon Sign | Background | Affiliation

---

**Combat Tab**

This is the focused combat view — the "Battle Screen" for V1.

*Persistent mini-bar:* HP | AC | Attack | Speed (always visible)

*HP Adjuster:*
- Large current HP display
- Prominent +/- buttons (large touch targets)
- Quick damage entry: tap number pad → apply damage (auto-subtracts)
- Quick heal entry: same pattern
- HP bar with color gradient (green → yellow → red)
- Max HP shown; "Level Up" button appears when XP threshold reached

*AC Breakdown:*
- Expandable accordion: "AC 14 ▼"
- Opens to show: Base 10 + DEX modifier + Armor + Kindred bonus + Class bonus + Shield
- Each component labeled

*Weapons block:*
- Each equipped weapon shown as a card
- Card shows: weapon name, attack roll (dice + bonus), damage dice, damage type (melee/missile)
- Melee weapons: STR modifier applied to attack and damage
- Missile weapons: DEX modifier applied to attack only
- Tap weapon → inline attack roller: rolls d20 + shows attack total vs target AC field, then damage roll

*Ammo / Arrow Counter:*
- Visible only when missile weapon is equipped
- Shows: Arrows remaining (or other ammo type)
- "Start Battle" button → opens ammo tracking modal:
  - Displays count at battle start
  - "Shot" button: decrements by 1
  - "End Battle" button → rolls for recovery (half arrows rounded down per rules, shown as dice roll)
  - Recovered arrows auto-added back to count

*Saving Throws quick-reference row:*
- All 5 saves shown as compact chips
- Tap any → inline save roller (roll d20, compares against save target)

---

**Inventory Tab**

*Encumbrance summary bar:*
- Visual weight meter with current weight / max weight
- Speed indicator updates live: 40 / 30 / 20 / 10
- Color coded: green (unencumbered) → yellow → red

*Sections (collapsible):*
1. **Equipped Items** — items contributing to AC and encumbrance
2. **Stowed Items** — in backpack, do not affect speed
3. **Tiny Items** — small items (coins counted separately)

*Each item row:*
- Name | Quantity | Weight (total) | Category icon
- Swipe left → delete; tap → edit modal
- Edit modal: name, qty, weight, weight override toggle (enter custom weight), location (equipped/stowed/tiny), consumable flag, item type

*Add item:*
- "+ Add Item" button opens bottom sheet with two options:
  - **Search Catalog** — searchable list of all Dolmenwood equipment with auto-filled weight/stats
  - **Add Custom** — blank entry form

*Coins section:*
- Four denomination rows: Copper | Silver | Gold | Pellucidium
- Tap +/- on each denomination
- Coin weight calculated and included in encumbrance (optional toggle)

*Restock Tool:*
- Accessible from inventory tab via "Restock" button
- Shows pre-defined consumable list: arrows, crossbow quarrels, sling stones, oil flasks, torches, preserved rations, waterskin refill, feed (horse/dog per day)
- Each item: default quantity, price per unit, auto-calculated total cost
- Player adjusts quantities, confirms → items added to inventory AND gold auto-decremented
- If insufficient gold: warning shown, player confirms override or adjusts quantities

---

**Magic Tab** *(shown only for Cleric, Friar, Magician, Enchanter, Bard)*

*Spell Slots block:*
- Grid of ranks (Rank 1 through Rank 6 as applicable per class/level)
- Each rank: total slots | used slots (shown as filled/empty circles)
- Tap circle to mark slot as used (casting); long-press to mark all as restored (rest)

*Memorized Spells / Prayers:*
- List of currently memorized spells per rank
- Tap spell → full description
- "Edit Memorization" button → re-assign spells to slots

*Glamours (Enchanter/Elf/Grimalkin):*
- List of known glamours
- Each glamour: name + brief effect
- "Roll New Glamour" button (if level-up grants new glamour)

*Fairy Runes (Enchanter):*
- List of known runes
- Roll button for acquiring new rune on level-up

---

**Notes Tab**

- Character biography (free text, markdown-lite formatting)
- Background text
- Physical description details (from creation rolls or manual)
- Beliefs, desires, quirks
- Session notes (free text, timestamped entries)
- People of Note section: add name + brief note (seeds the future full NPC tracker)

---

#### S-05: Level Up Flow

Triggered from: XP reaching next-level threshold (auto-prompt) OR manual "Level Up" button in Combat tab.

**Level Up Screen:**
1. Congratulations banner with current level → new level
2. Roll new HP: animated die roll + CON modifier application
   - Re-roll 1s and 2s option (per optional rule setting)
   - New max HP shown
3. Updated stats shown as a diff list:
   - Attack bonus: old → new (highlighted if changed)
   - Save Targets: old → new for each (highlighted if changed)
   - New class traits unlocked (highlighted in accent color)
   - Skill targets updated (highlighted if changed)
   - New spell slots (if applicable)
   - New glamours to roll (if applicable)
4. Log entry auto-created and saved to Level Up Log
5. "Confirm Level Up" button → applies all changes

**Level Up Log** (accessible from character header menu):
- Timeline of all level-up events
- Each entry: date, from/to level, HP gained, stats changed, traits unlocked

---

#### S-06: Retainer Sheet

Accessed from: Party tab → Retainer list → tap retainer

**Header:** Retainer name, Kindred, Class, Level
**Simplified stat block:** AC | HP (current/max) | Attack | Speed | Morale | Loyalty
**Saves:** Doom | Ray | Hold | Blast | Spell (compact row)
**Employer:** Shows which PC employs them + Charisma-based max retainers remaining
**Wages:** daily rate or % share, editable
**Mount:** Link to mount record (if retainer has a mount)
**Inventory:** Same component as character inventory tab (equipped/stowed/tiny + coins)
**Notes:** Free text

**"Promote to Full Character" button:**
- Converts retainer to a full Player Character sheet (S-04)
- Confirmation dialog explaining this is irreversible
- Promoted character appears in the character roster owned by the account

---

#### S-07: Mount Management

Accessed from: Character Sheet → Stats tab → "Mounts" section OR Party tab → Pack Animals

**Character-owned mount:**
- Name, type (horse / mule / dog / etc.), speed
- For Knights: full stat block (AC, HP, Attack, Saves, Morale, XP) — uses same sheet format as a retainer simplified block
- For all others: speed + inventory only
- Mount inventory: same component, tracks saddlebags, feed, etc.

**Party-owned pack animals:**
- Listed in Party tab
- Each pack animal: name, type, speed, carrying capacity, inventory
- No stats (not combat assets)

---

### 5.4 Party Screens

#### S-08: Campaign / Party View

*Create Campaign (Referee):*
- Campaign name
- Auto-generated 6-character invite code
- Share code button (copy to clipboard / share sheet)

*Join Campaign (Player):*
- Enter invite code field
- Confirms campaign name before joining
- Select which character to bring into the campaign

*Party Dashboard:*
- Campaign name + Referee name at top
- Member list: portrait | name | class | level | HP bar | AC
- Tap any member → read-only view of their character sheet (players see their own; Referee sees all)
- Pack Animals section: list with type, capacity, inventory link
- Party notes: shared free text field

---

### 5.5 Settings & Account

#### S-09: Settings
- Account info (display name, email, avatar)
- Optional Rules toggles:
  - Sub-Par Character re-roll rule
  - Re-roll 1s and 2s on HP
  - Customise Thief/Hunter Skills (expertise point allocation)
  - Coin weight counts toward encumbrance
- Theme: Light / Dark / System
- Data: Export all characters as JSON, delete account

---

## 6. Rules Engine

The rules engine is a pure TypeScript package (`packages/rules-engine`) with no side effects — it takes character data as input and returns derived stats as output. It is unit-tested against the Dolmenwood Player's Book tables.

### 6.1 Calculations

| Derived Stat | Inputs | Formula |
|---|---|---|
| Ability Modifier | Ability Score | Table lookup: 3→-3, 4-5→-2, 6-8→-1, 9-12→0, 13-15→+1, 16-17→+2, 18→+3 |
| AC (base) | Armor in inventory, DEX modifier, Kindred AC bonus, Class AC bonus | 10 + DEX mod + armor AC + kindred bonus + class bonus |
| XP Modifier | Prime Ability scores | Lowest Prime Ability: ≤5→-20%, 6-8→-10%, 9-12→0%, 13-15→+5%, 16-18→+10% |
| Max Retainers | CHA modifier | Base 3 + CHA modifier |
| Retainer Loyalty | CHA modifier | Base 7 + CHA modifier |
| Speed | Total equipped weight | ≤400→Speed 40, ≤600→30, ≤800→20, >800→10 |
| Attack Bonus | Class, Level | Class advancement table lookup |
| Save Targets | Class, Level | Class advancement table lookup (5 saves) |
| Magic Resistance | WIS modifier, Kindred | WIS modifier (some Kindreds add bonus) |
| Skill Targets | Class, Level, Kindred | Class skill table lookup |
| Spell Slots | Class, Level | Class spell table lookup (Rank 1–6) |

### 6.2 Class Advancement Tables

All 9 class advancement tables encoded as static JSON reference data in the rules engine, covering Levels 1–10 for: XP threshold, HP die, Attack bonus, all Save Targets, and class-specific values (Friar AC bonus, Enchanter glamour count, etc.).

### 6.3 Kindred Data

All Kindred traits, AC bonuses, natural attacks, language lists, class restrictions, skill modifiers, and trinket tables encoded as static reference data.

---

## 7. Character Creation — Auto vs. Manual Comparison

| Step | Auto Mode | Manual Mode |
|---|---|---|
| Ability Scores | System rolls 3d6, animated; user can re-roll 1s and compare two full sets | User enters values directly; dice roller available |
| Kindred | Selectable cards with suggestions based on rolls | Same card selection, no suggestions |
| Class | Selectable cards filtered by Kindred, suggestions shown | Same, no suggestions |
| Ability Adjustment | Visual 2-for-1 tool with live XP modifier preview | Same tool |
| HP | Animated roll with re-roll 1s prompt | Enter value or use roller |
| Equipment | Animated sequential rolls | Manual entry or roller |
| AC / Speed | Auto-calculated, confirmation screen | Same |
| Alignment | Selection screen | Same |
| Name | Random name roll from Kindred table + text field | Text field only |

---

## 8. WordPress Dev Blog Integration

### 8.1 Overview

After each development session, the developer generates and publishes a blog post to their WordPress site documenting the session. This is part of the project's meta-goal: publicly demonstrating AI-assisted DevOps and product development practices.

### 8.2 Workflow

1. Developer completes a work session
2. In Dolmenwood Beyond settings (or a separate dev tool), triggers "Generate Session Journal"
3. Developer provides a brief session summary prompt (what was built, what decisions were made, what AI tools were used, what worked/failed)
4. AI generates a formatted blog post draft:
   - Title: "Dolmenwood Beyond Dev Log #N — [Session Topic]"
   - Sections: What Was Built | AI Tools & Prompts Used | Decisions Made | Challenges | Next Steps
   - Tags: dolmenwood-beyond, devops, ai-development, nextjs (as applicable)
5. Developer reviews/edits draft
6. Post published to WordPress via REST API (`POST /wp-json/wp/v2/posts`)

### 8.3 WordPress API Integration

- **Authentication:** WordPress Application Password (generated in WP Admin → Users → Application Passwords)
- **Endpoint:** `POST https://{site}/wp-json/wp/v2/posts`
- **Payload:** `{ title, content (HTML), status: "draft" | "publish", tags[], categories[] }`
- **Implementation:** API call made from a Next.js API Route (`/api/blog/publish`) — WordPress credentials stored in environment variables, never exposed client-side
- **V1 scope:** Draft creation only — developer reviews before publishing
- **Future:** Auto-publish with scheduled delay; session summary auto-generated from Git commit history + PR descriptions via GitHub Actions

### 8.4 Blog Post Template

```
# Dolmenwood Beyond Dev Log #[N] — [Topic]
*[Date] | Tags: dolmenwood-beyond, ai-development, devops*

## What Was Built
[Summary of features/screens completed this session]

## AI Tools & Prompts Used
[Which AI tools were used, example prompts, how they helped]

## Key Decisions Made
[Architecture, UX, or scope decisions with rationale]

## Challenges & What Failed
[Honest account of blockers, wrong turns, things that didn't work]

## What's Next
[Next session focus]
```

---

## 9. GitHub Issues Map

All features tracked as GitHub Issues in `madacgrav/dolmenwood-beyond`. Labels used:

| Label | Meaning |
|-------|---------|
| `v1` | V1.0 scope — must ship |
| `backlog` | Future feature, not V1 |
| `character-management` | Character sheet/creation |
| `party-management` | Party/campaign features |
| `combat` | Battle and combat tooling |
| `magic` | Spells, glamours, runes |
| `reference` | In-app rules reference |
| `platform` | Auth, sync, offline, export |
| `devex` | Developer experience / blog integration |
| `bug` | Defects |

V1 Issues: #1–#14 (character management) + #15 (character creation auto) + #16 (retainer sheet) + #17 (mount management) + #18 (restock tool) + #19 (ammo counter / battle view) + #20 (level up flow + log) + #21 (campaign/party v1) + #22 (WordPress blog integration)

Backlog Issues: #23–#40 (party sync, DM screen, spells, calendar, map, NPC tracker, firewood/torch tracking, PDF export, push notifications, Capacitor native wrapping)

Full issue details in: `dolmenwood_beyond_github_issues.md`

---

## 10. V1 Out of Scope

The following are explicitly excluded from V1.0 and tracked as backlog issues:

- Real-time party session sync
- DM Screen (forage, weather, random encounter generators)
- Full battle tracker (initiative order, round counter, condition tags)
- Track day / skill reset automation
- Firewood, torch, lamp usage tracker
- In-app rules compendium (searchable)
- Dolmenwood calendar / moon phase tracker
- Locations visited / map with pins
- People of Note full tracker (seeds exist in Notes tab)
- PDF character sheet export
- Push notifications
- Capacitor native App Store wrapping
- Noble Houses reference browser
- Session log / XP award log

---

## 11. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| **Performance** | Initial page load < 2s on 4G; character sheet interactive < 1s |
| **Offline** | Character sheet readable offline; edits queued and synced on reconnect |
| **Availability** | 99.5% uptime (Vercel/Supabase SLA) |
| **Data safety** | No character data loss; all edits persisted to database within 2s |
| **Accessibility** | WCAG AA — keyboard navigable, screen reader compatible, 4.5:1 contrast |
| **Mobile** | Fully functional at 375px (iPhone SE); touch targets ≥ 44px |
| **Security** | Row-level security in Supabase: players can only read/write their own characters; Referees read-only on campaign members |

---

## 12. CI/CD Pipeline (GitHub Actions)

### PR Workflow (`ci.yml`)
```
on: pull_request
jobs:
  - lint: ESLint + Prettier check
  - typecheck: tsc --noEmit
  - test: Vitest unit tests (rules engine)
  - build: next build (smoke test)
  - preview: Vercel preview deployment
```

### Production Deploy (`deploy-prod.yml`)
```
on: push to main
jobs:
  - all CI jobs pass
  - supabase db push (run pending migrations)
  - vercel deploy --prod
```

### Blog Auto-Draft (`blog-session.yml`) *(Future)*
```
on: workflow_dispatch (manual trigger)
inputs: session_summary (text)
jobs:
  - generate: call AI to draft blog post from commits + summary
  - publish: POST to WordPress REST API as draft
```

---

## 13. Design System

### 13.1 Aesthetic Direction

*Inspired by the Dolmenwood PDF and books: the same information architecture, typographic hierarchy, and palette — redesigned for touch interaction.*

- **No ruled lines or paper textures** — depth via surface layers, not decoration
- **Parchment-to-forest palette**: warm cream surfaces, deep forest green primary accent, moonlight silver secondary
- **Typography**: Display font with old-world gravitas (Cormorant Garamond or Cinzel) for headings and section labels; clean humanist sans (Satoshi or General Sans) for body text and UI
- **Section dividers**: thin 1px lines in accent color, not thick borders
- **Data density**: balanced — not as sparse as a modern SaaS dashboard, not as dense as the paper sheet

### 13.2 Color Palette (Dolmenwood Theme)

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `--color-bg` | `#f5f2e8` | `#17160f` | Page background (parchment / deep night) |
| `--color-surface` | `#faf8f0` | `#1e1d15` | Card surfaces |
| `--color-primary` | `#2d5a27` | `#5a9e50` | Forest green accent — CTAs, highlights |
| `--color-text` | `#1e1b0f` | `#d8d4c0` | Primary text |
| `--color-text-muted` | `#6b6450` | `#8a8470` | Secondary text, labels |
| `--color-gold` | `#c49a1a` | `#e8b830` | XP, coins, level indicators |
| `--color-danger` | `#8b1a1a` | `#c44040` | HP critical, delete actions |

### 13.3 Typography

- **Display / Headers**: Cinzel (Google Fonts) — evokes the book's engraved titling style
- **Body / UI**: Satoshi (Fontshare) — clean, modern, readable at 12–18px
- **Monospace** (dice results, stat numbers): JetBrains Mono or tabular-nums feature on Satoshi

---

## 14. Open Questions & Risks

| Item | Status | Notes |
|------|--------|-------|
| Dolmenwood licensing for digital stat data | ⚠️ Open | Necrotic Gnome's license terms need review before encoding all class tables |
| Offline sync conflict resolution | ⚠️ Open | If two devices edit same character offline, how is conflict resolved? Last-write-wins for V1 |
| Capacitor migration path | ✅ Planned V2 | PWA → Capacitor wrapper; no code changes required for core app |
| Retainer XP tracking | ✅ Included | Retainers earn ½ XP; tracked in retainer record |
| Fighter Combat Talents on level-up | ✅ Included | Level-up flow includes talent selection step for Fighters at Levels 3, 6, 9, 12 |
| Multiple Prime Abilities (Bard, Friar, etc.) | ✅ Included | Rules engine uses lowest Prime Ability for XP modifier |

---

## 15. Development Phases

### Phase 1 — Foundation (Weeks 1–2)
- Repo setup, Next.js + Supabase + Tailwind scaffolding
- GitHub Actions CI/CD pipeline
- Auth (sign in / sign up / roles)
- Database schema + migrations
- Rules engine: ability modifiers, AC, XP modifier, advancement tables

### Phase 2 — Character Creation (Weeks 3–4)
- Auto creation wizard (all 13 steps)
- Manual creation mode
- Character roster screen
- Basic character sheet (Stats tab)

### Phase 3 — Full Character Sheet (Weeks 5–6)
- Combat tab + ammo counter
- Inventory tab + restock tool
- Magic tab (spell slots + memorization)
- Notes tab

### Phase 4 — Level Up & Retainers (Week 7)
- Level up flow + change log
- Retainer sheet
- Retainer promote-to-PC

### Phase 5 — Mounts & Party (Week 8)
- Mount management (character-owned + pack animals)
- Campaign creation + invite code
- Party dashboard

### Phase 6 — Polish & Blog Integration (Week 9)
- WordPress blog draft generation + REST API publish
- PWA manifest + service worker (offline)
- Accessibility audit
- Performance optimization
- QA pass on all screens

---

*Document maintained in `docs/prd.md` in the `madacgrav/dolmenwood-beyond` repository. All decisions logged here supersede prior conversation decisions.*
