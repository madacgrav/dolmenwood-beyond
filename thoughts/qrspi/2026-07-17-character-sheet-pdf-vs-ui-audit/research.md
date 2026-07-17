# Research Findings

## Q1: Identity/header fields — render + data model

### Data model
`Character` (`packages/types/src/index.ts:60-83`) and `CharacterDoc` (`apps/web/src/lib/cosmos/types.ts:133-178`):

| Field | Character | CharacterDoc |
|---|---|---|
| name | `name` :63 | :136 |
| kindred | `kindred` :68 | :141 |
| class | `characterClass` :69 | :142 |
| alignment | `alignment` :70 | :143 |
| moonSign | `moonSign?` :71 | `moonSign \| null` :144 |
| background | `background?` :72 | `background \| null` :145 |
| level | `level` :73 | :146 |
| xp | `xp` :74 | :147 |
| portrait | `portraitUrl?` :78 | :151 |
| sex/age/height/weight | :64-67 | :137-140 |
| affiliation | **absent** (only on unrelated `CharacterCampaignData.affiliation?` :102) | **absent** |

### Rendered (header only) — `CharacterSheetHeader.tsx`
- Name — `:53` (`<h2>`)
- Kindred + Class + Level — `:56` single subtitle `{kindred} {class} · Level {level}`
- Portrait — `PortraitButton` `:36-44`, `portraitUrl`; falls back to initial `name.charAt(0)` `:16`
- XP — `header/XPBar.tsx:49` `✨ {xp} XP / {nextLevelXP}`
- HP — `header/HPBar.tsx:40` `❤️ {hpCurrent} / {hpMax} HP`

### Stored but NOT rendered anywhere in character-sheet UI (grep-confirmed)
- **alignment** — captured in wizard `Step11Alignment.tsx`, written to PDF export `lib/pdf/character-sheet.ts:78`, but no sheet component displays it
- **moonSign** — captured in import flow, PDF export `:79`, not rendered
- **background** — wizard `Step13Details.tsx:47,145`, PDF export `:77`, not rendered
- **affiliation** — zero hits in `apps/web/src`; exists only as a type field on `CharacterCampaignData`, never implemented
- Also unrendered: sex, age, height, weight

## Q2: Stats tab sections

Order in `StatsTab.tsx:39-104`: AbilityScores → CombatStats → Skills → SavingThrows → Languages → Retainers.

**Ability Scores** — `stats/AbilityScoresSection.tsx`
- Heading "Ability Scores" `:41`; 6 cards from `ABILITY_KEYS :7-14`
- Each: abbr label STR/INT/WIS/DEX/CON/CHA `:65`, raw score `:80` (editable input in edit mode), modifier via `formatMod(getAbilityModifier(score))` `:87`, full-name sublabel `:89`
- **INT sublabel is "Intellect"** not "Intelligence" `:9`
- Prime abilities: gold border + ★ badge `:55,62-64`, footer `:94-97`

**Combat Stats** — `stats/CombatStatsSection.tsx`
- Heading "Combat Stats" `:14`; three `StatPill`s: **"AC"** `:18`, **"Attack"** `:19`, **"Speed"** `:20` (`{speed}′`)
- Sourced in `StatsTab.tsx`: `ac=acBreakdown.total :31`, `attackBonus=getAttackBonus() :30`, `speed=calculateSpeed(0) :32` (**hardcoded 0 → always 40′**)
- No "Exploring" (feet/turn) or "Overland" (travel points) values anywhere

**Skills** — `stats/SkillsSection.tsx`
- Heading "Skills" `:33`; dynamic list from `getAllSkills(class, level, kindred) :18` — NOT a fixed Listen/Search/Survival set
- Per row: name `:40`, sub-line `"{7-target}-in-6 (need {target}+) · Universal/Class" :41-43`, 🎲 Roll button `:58-64`
- No standalone "Modifier" field

**Saving Throws** — `stats/SavingThrowsSection.tsx`
- Heading "Saving Throws" `:21`; 5 saves from `SAVE_NAMES :5-11`, each `{target}+`:
  - "Death / Doom" (doom), "Wands / Rays" (ray), "Paralysis / Hold" (hold), "Breath / Blast" (blast), "Spells / Rods" (spell)
- **No "Magic Resistance" row** — `magicResistance` exists in `DerivedStats` (`types:207`) but unused by sheet

**Languages** — `stats/LanguagesSection.tsx`
- Heading "Languages" `:39`; native from `getKindredLanguages(kindred) :33` tagged "Native", learned from `extraLanguages` tagged "Learned"
- Footer: INT-mod bonus slot count `:58-63`; add-language input in edit mode

## Q3: Combat tab

Order `CombatTab.tsx:50-93`: Conditions → ArmourClass → Attack → Ammo(cond) → BattleModal(cond) → HitDice → SavingThrows(cond) → Mounts.

**Armour Class** — `combat/ArmourClassSection.tsx`
- Heading "Armour Class" `:13`; "Total AC" big value `:16-17`
- Breakdown rows shown: "Base" = literal 10 `:20-22`, "DEX modifier ({dex})" `:23-28`; note "Equip armour in Inventory tab…" `:29`
- `ac = acBreakdown?.total ?? 10` (`CombatTab.tsx:45`); `acBreakdown` derived in page loader `[id]/page.tsx:95` via `deriveCharacterAC(character, acItems)` (`rules-engine/character-ac.ts:28-58` → base10 + dexMod + armor + kindred + class + shield)
- Kindred/class/shield/armor sub-bonuses computed but **not individually displayed**

**Attack** — `combat/AttackSection.tsx`
- Heading "Attack Rolls" `:43`; `attackBonus=getAttackBonus(class,level)` (`CombatTab.tsx:40`)
- Equipped weapons: card per weapon w/ to-hit + damage + STR/DEX tag, 🎲 Roll `:55-91`
- No weapons: generic "melee"/"ranged" tiles `:99-105`

**HP / Max HP** — NOT in combat tab. Only in shared header `HPBar.tsx:40`.

**Hit Dice** — `combat/HitDiceSection.tsx`
- Heading "Hit Dice" `:13`; `{class} — Level {level}` `:15`, value `{level}{hitDie}` (e.g. "3d8") `:16-18`; `getHitDie(class)` (`CombatTab.tsx:46`)

**Saving Throws** — `combat/SavingThrowsSection.tsx` (also here, rollable)
- Heading "Saving Throws — tap to roll" `:50`; same 5 labels `:7-13`; roll badge `🎲 {roll} ✓/✗ vs {target}+`

**Conditions** — `combat/ConditionsSection.tsx`
- Heading "Conditions" `:21`; 3 toggles: "Poisoned", "Paralysed", "Unconscious" `:5`
- **Local state only — not persisted, not read from character**

**Ammo** — `combat/AmmoSection.tsx` + `BattleModal.tsx`: ammo qty tracking, battle mode, arrow recovery via `calcAmmoRecovery`.

**Mounts** — `combat/MountsSection.tsx` + `MountCard.tsx`: name, type, `{speed} ft/round`; if full stats: AC/ATK/Morale pills + HP bar. Mount has own stored `attackBonus`.

## Q4: Inventory tab

**Categorization — location (tiny/stowed/equipped, EXISTS)**
- `WeightLocation = 'equipped'|'stowed'|'tiny'` (`types:4`); `InventoryItem.location` (`types:149`)
- Labels (`inventory/types.ts:21-25`): `⚔️ Equipped`, `🎒 Stowed`, `🔮 Tiny`
- `ItemList.tsx:18` groups in fixed order `[equipped, stowed, tiny]`, header `"{label} ({count})"`, empty groups hidden
- Location cycled via button `ItemRow.tsx:89-94` (order `stowed→equipped→tiny` `use-inventory.ts:54`); AddItemForm sets initial `:108-110`
- **tiny items excluded from carried weight** `WeightBar.tsx:12-15`; weight chip hidden `ItemRow.tsx:82`

**item_type** — model `'weapon'|'armor'|'gear'|'spell_component'|'ammo'|'coin'` (`types:5`); UI form uses different set `['weapon','armour','gear','consumable','other']` (`inventory/types.ts:18`). `armor_bulk` field exists (`types:6`) but **not surfaced** in inventory UI.

**Encumbrance method** — **Weight only. No Weight-vs-Slots toggle exists.** Only related toggle is `coinWeightEnabled` (whether purse counts toward weight).

**Weight + speed** — `WeightBar.tsx`
- `totalWeight = non-tiny item weights + (coinWeightEnabled ? coinWeight : 0)` `:12-16`
- `calculateSpeed(totalWeight)` (`rules-engine/speed.ts:1-6`): ≤400→40, ≤600→30, ≤800→20, >800→10 (coin-weight thresholds; 40/30/20/10 are resulting speed in feet)
- Display: "Carried Weight (Equipped + Stowed)" `:26`, `"{totalWeight} / 800 coins"` `:27`, `{speed}′` color-coded; markers `400¢→40′`, `600¢→30′`, `800¢→20′` `:43-48`

**Coins — 3 denominations only**
- `Coins = { gp, sp, cp }` (`lib/data/characters.ts:167-171`)
- `CoinPurse.tsx`: "Coins on Hand" `:15`, inputs for `['gp','sp','cp'] :17`
- `SpendForm`/`BankPanel`: gp/sp/cp; bank is gold-only
- **No pellucidium/platinum** — `calculateCoinWeight` accepts optional `pp?` (`speed.ts:9`) but `Coins` has no pp; persistence only `coinsGp/Sp/Cp`. PDF exporter notes "Pellucidium Pieces" left blank (`lib/pdf/character-sheet.ts:21-22`)

## Q5: Magic tab

`MagicTab.tsx:12`; gated by `isSpellcaster(class) :13`; "This class has no magical abilities." if not `:34`. State via `use-spells.ts` → `/api/characters/[id]/magic` → `lib/data/spells.ts` mutating 3 embedded doc arrays.

- **Spell Slots** — `SpellSlotsSection.tsx`: "Spell Slots"/"Glamour Circles" `:20-22`, "🌙 Rest" `:33`, ●/○ per rank. Backed by `CharacterDoc.spellSlots` (`cosmos/types.ts:162,56-61`). `slotsData` itself from `getSpellSlots()` (derived). Rest clears preps + stamps `lastRestDate`.
- **Prepared Spells** — `PreparedSpellsSection.tsx` (non-glamour only): "Today's Prepared Spells (n)" `:27`. Backed by `CharacterDoc.spellPreparations` (`cosmos/types.ts:163,63-69`).
- **Spell Book** — `SpellBookSection.tsx`: "Spell Book (n)"/"Glamours Known (n)" `:28`, memorize checkbox. Backed by `CharacterDoc.spellbook` (`cosmos/types.ts:164,71-77`).
- `DerivedStats.spellSlots` (`types:211,235`) is a separate rules-engine computed table, distinct from stored `CharacterDoc.spellSlots`.

## Q6: Notes tab

`NotesTab.tsx:205`; 3 sub-tabs (`SUBTABS :202`): "General", "Sessions", "People".
- **General** `:18-52`: one `<textarea>` "General Notes" `:38`, debounced save `onUpdate({notes}) :25-33`. Backed by `Character.notes`/`CharacterDoc.notes` (`cosmos/types.ts:154`).
- **Sessions** `:55-124`: `SessionNote {id,date,text}` (`types:85-89`) array `sessionNotes` (`cosmos/types.ts:155`).
- **People** `:127-199`: `PersonOfNote {id,name,note}` (`types:91-95`) array `peopleOfNote` (`cosmos/types.ts:156`).
- **No "Kindred & Class Traits" and no "Other Notes" field** anywhere. Only General/Sessions/People.

## Q7: Model coverage — unsurfaced + derived

### Fields NOT surfaced in character-sheet UI (grep-confirmed)
`sex`, `age`, `height`, `weight`, `moonSign`, `background`, `alignment` (only a hardcoded `'neutral'` literal in `use-retainers.ts:62`), `isActive`, `createdAt`, `updatedAt`, `xpLog`, `levelUpLogs`, `lastRestDate` (rendered on campaign page, not sheet), `_etag`. `bankLedger` surfaced only as aggregate balance, not per-entry.

### Derived vs stored
`DerivedStats` type exists (`types:198-212`) but is **never assembled as an object** — each stat computed independently at point of use.

| Stat | Stored | Derived via |
|---|---|---|
| Ability modifiers | scores stored | `getAbilityModifier()` (`rules-engine/ability-modifiers.ts:11`) |
| AC | no | `deriveCharacterAC()` (`character-ac.ts:28`), page loader, from scores+kindred+class+level+equipped items |
| Speed | no | `calculateSpeed(weight)` (`speed.ts:1`); real in `WeightBar`, but `StatsTab.tsx:32` passes **0 → always 40′** |
| Saving throws | no | `getSaveTargets(class,level)` (`advancement.ts:48`) |
| Skill targets | no | `getAllSkills(class,level,kindred)` (`skills.ts:67`) |
| Attack bonus | no | `getAttackBonus(class,level)` (`advancement.ts:38`) |
| HP | **stored** `hpCurrent/hpMax` | direct, no derivation |

## Cross-Cutting Observations
- Server-tier pattern throughout: data module (`lib/data/*`) → API route (`app/api/characters/**`) → client wrapper (`lib/api/*`); embedded doc arrays fetched separately from the mapped `Character`.
- Two host pages render the same tab set: `[id]/page.tsx` (owner-editable) and `[id]/view/page.tsx` (readOnly threaded through every section).
- A PDF exporter (`lib/pdf/character-sheet.ts`) already maps character data onto the printed sheet's fields, and its own comments flag which sheet fields have no app data source (Magic Resistance, Exploring, Overland, Pellucidium Pieces `:21-22`).
- Speed appears in two places with different logic: Stats-tab pill (hardcoded 0 → 40′) vs Inventory `WeightBar` (real weight-derived).

## Open Areas
- Whether unrendered stored fields (alignment/moonSign/background/sex/age/height/weight) are intentionally header-only or pending UI is not determinable from code alone.
- The `item_type` mismatch (model enum vs AddItemForm options) — no code reconciles the two sets; downstream effect not traced here.
