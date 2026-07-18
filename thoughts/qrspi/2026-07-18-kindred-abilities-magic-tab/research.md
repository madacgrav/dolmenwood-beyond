# Research Findings

## Q1: Wizard end-to-end — steps, state, finalize persistence

### Findings
- Mode select at `apps/web/src/app/(app)/characters/new/page.tsx:34-42` — `reset()` + `setMode()`, routes to `/characters/new/auto` or `/manual`.
- Both modes share the same 13-step shape. Auto router: `apps/web/src/app/(app)/characters/new/auto/[step]/page.tsx:32-71`; manual router: `manual/[step]/page.tsx:18-56`. Manual reuses the same step components except steps 1 and 7 (`ManualStep1AbilityScores`, `ManualStep7HP`).
- Steps: 1 Ability Scores → 2 Kindred → 3 Class → 4 Adjust (UI-only; `adjust()` defined but void'd, `Step4AbilityAdjust.tsx:22-30`) → 5 Modifiers (display) → 6 Traits (display) → 7 HP → 8 Equipment → 9 AC (display) → 10 Speed (display) → 11 Alignment → 12 Level/XP (display) → 13 Name & Details → complete.
- Wizard store: single global Zustand store, no persistence middleware (`apps/web/src/stores/wizard-store.ts:6-47,51`). Fields: mode, step, abilityScores, kindred, characterClass, alignment, hpMax, name/sex/age/height/weight, background, portraitUrl, equipment (string[]), startingGold. **No fields for traits, spells, glamours, level, or xp.**
- Auto finalize (`auto/complete/page.tsx:68-81`): `createCharacter({name, sex, age, height, weight, kindred, characterClass, alignment, background, abilityScores, hpMax, portraitUrl})`; then `seedInventory(id, equipment, startingGold)` (lines 17-53, 88) — parses equipment strings, matches catalog, `insertInventoryItem` per item (best-effort, errors logged and skipped), `saveCoins` for gold; then `wizard.reset()` (line 90).
- Manual finalize (`manual/complete/page.tsx:24-51`): same `createCharacter` call but **`seedInventory` is never called** — equipment/gold collected in the store are silently dropped for manual-mode characters.
- Persistence chain: client wrapper `apps/web/src/lib/api/characters.ts:72-83` → POST `/api/characters` (`app/api/characters/route.ts:13-24`, validates name/kindred/characterClass/abilityScores present) → data layer `apps/web/src/lib/data/characters.ts:204-209` → `newCharacterToDoc` (`lib/data/mappers/character.ts:100-141`).
- `newCharacterToDoc` hard-codes `traits: null` (mapper line 115) and initializes `inventory: []`, `spellSlots: []`, `spellPreparations: []`, `spellbook: []`, etc. (lines 130-137). **Spells, glamours, and kindred-derived abilities are never written during creation** in either mode. No wizard step file imports anything from `rules-engine/src/spells.ts`.
- `Step6Traits.tsx:6,11` calls `getKindredTraits(kindred)` purely for display; result never enters the store or `createCharacter`.
- Starting equipment `CLASS_STARTING_ITEMS` (`Step8Equipment.tsx:16-26`) includes 'Spellbook'/'Fairy charm' for Magician/Enchanter, but only as generic inventory gear rows (auto mode only).

## Q2: Kindred trait model — `getKindredTraits`, `hasInnateGlamours`, trait JSON

### Findings
- Trait model: static JSON `packages/rules-engine/src/data/kindreds.json`, keyed by kindred name, each with `traits: {name, description}[]`. No per-trait type discrimination — semantics inferred by consumers string-matching `trait.name`.
- Types/functions (`packages/rules-engine/src/kindreds.ts`): `KindredTrait {name, description}` (lines 5-8); `getKindredData` (30-32); `getKindredTraits(kindred): KindredTrait[]` (60-62); `hasInnateGlamours(kindred): boolean` (65-67) — pure string match `t.name === 'Glamours'`, documented "trait-driven: Elf, Grimalkin" (line 64).
- Traits per kindred (kindreds.json):
  - **Breggle** (14-27): Fur, Gaze (Longhorn L4+), Horns.
  - **Elf** (120-145): Elf Skills, **Glamours** ("Knows one randomly determined glamour."), Immortality, Magic Resistance, Unearthly Beauty, Vulnerable to Cold Iron.
  - **Grimalkin** (191-228): Armour and Weapons, Defensive Bonus, Eating Giant Rodents, **Glamours** (same text), Grimalkin Skills, Immortality, Magic Resistance, **Shape-Shifting** ("Can transform into Chester (fat domestic cat, unlimited) or Wilder (primal fey form, 1/day at <50% HP, heals 2d6 HP, lasts 2d4 Rounds)."), Vulnerable to Cold Iron.
  - **Human** (272-285): Decisiveness, Leadership, Spirited.
  - **Mossling** (316-337): Armour and Weapons, **Knacks** ("Each mossling knows one knack (quasi-magical craft). See Mossling Knacks (p112)."), Mossling Skills, Resilience, Symbiotic Flesh ("At each Level... gains a random trait from the Symbiotic Flesh table (d20)").
  - **Woodgrue** (380-405): Armour and Weapons, Compulsive Jubilation, Defensive Bonus, **Mad Revelry** ("1/day: play enchanted melody... afflict nearby creatures (Save vs Spell). Options: Confide, Dance, Imbibe, Jape, Jubilate, Mount, Revel."), Moon Sight, Musical Instrument.
- Only Elf and Grimalkin carry a trait literally named `"Glamours"` — asserted by `packages/rules-engine/src/__tests__/kindreds.test.ts:89-96`.
- Consumers of `getKindredTraits`: `Step6Traits.tsx:6,11` (full trait cards); `Step2Kindred.tsx:6,55,101,103` (first-2 pills + "+N more").
- Consumers of `hasInnateGlamours`: `MagicTab.tsx:4,22` (empty-state gate line 40, glamour section gate line 104, passed to `useSpells` line 24); `magic/use-spells.ts:28,37,100-102` (gates data loading).
- No mechanical hook-up exists anywhere for Shape-Shifting, Mad Revelry, or Knacks — they are display-only trait entries.

## Q3: Glamour definitions — spells.json, getSpellsForClass, glamoursKnownByLevel

### Findings
- `packages/rules-engine/src/data/spells.json`: top-level keys are class names (Magician, Cleric, Friar, Bard, Enchanter). Ranked classes use `rankN: string[]`. **Enchanter is the only class with a `"glamours"` key** (line 29): 22 names — Alter Self, Bewitchment, Charm Animal, Charm Monster, Charm Person, Confusion, Disguise, ESP, Fascinate, Forget, Glamour, Hold Person, Hypnotic Pattern, Illusion, Induce Sleep, Mass Charm, Mass Suggestion, Phantasmal Force, Sleep, Suggestion, Veil, Ventriloquism.
- `getSpellsForClass(className, rank?)` (`packages/rules-engine/src/spells.ts:17-36`): returns `SpellEntry {name, rank: number | 'glamour'}` (7-10). For a glamours-keyed class: returns `[]` if numeric rank filter passed (line 24), else maps to `{name, rank: 'glamour'}` (line 25).
- `getSpellSlots(className, level)` (`spells.ts:51-68`): if `glamoursKnownByLevel` exists (Enchanter only), returns `{glamours: array[level-1] ?? 0}` (55-57); else builds rank1..rank6 map from `slotsPerLevel`.
- `glamoursKnownByLevel` (`packages/rules-engine/src/data/spell-slots.json:426-442`, Enchanter): `[1, 2, 3, 3, 4, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10]` (level 1 → 1 known, level 15 → 10).
- `isSpellcaster` (`spells.ts:70-72`): `className in spellSlotData`. Keys: Cleric, Friar, Magician, Bard, Enchanter.
- **Class vs innate distinction**: Enchanter glamours are modeled in spells.json + spell-slots.json with level progression. Kindred innate glamour (Elf/Grimalkin) is modeled *only* as a kindreds.json trait string — no progression, no slot count, no list of which glamour was rolled, no tie into spellSlotData. Detection purely via `hasInnateGlamours`, independent of class. The two converge only at the UI (`MagicTab.tsx:104` gate `isGlamour || innateGlamours`) and at storage (`SpellbookEntryDoc.kind: 'glamour'` does not record source).
- Rules-engine types: `SpellEntry` (spells.ts:7-10), `SpellcastingClass` (39), `SpellSlotRow` (41-49). `packages/types/src/index.ts`: `SpellRank` (9), `SpellSlot` (161-167), `SpellSlotTable` (236-238), `DerivedStats.spellSlots` (212). All exported via `packages/rules-engine/src/index.ts:1-13` (`export * from './spells'` line 8, `'./kindreds'` line 7).

## Q4: How a spell/glamour gets added and persisted today

### Findings
- UI: `AddSpellForm.tsx:19-36` — local state only. Rank picker only when `!isGlamour && validRanks.length > 0` (48-59; `validRanks` from `MagicTab.tsx:33-38`). Name `<select>` populated from `getSpellsForClass(characterClass)` (glamour variant passes no rank) (24-29), plus an "Other (type manually)…" free-text option (71, 75-83). **No randomization anywhere in the add flow** — select-from-list or free-text only.
- `SpellBookSection.tsx:19-21,45-53` toggles the form and passes `onAdd` through; rows have memorize checkbox (71-76) and delete (91-102).
- Hook: `use-spells.ts:181-196` `addSpell(rank, name, kind?)` — builds `{character_id, spell_name, spell_level: kind==='spell' ? rank : 0, is_memorized: false, kind}`; `MagicTab.tsx` always passes explicit kind: `'spell'` (97), `'glamour'` (111), `'rune'` (123).
- Client wrapper: `apps/web/src/lib/api/spells.ts:117-122` `insertCharacterSpell` POSTs `{op: 'addSpell', ...payload}` to `/api/characters/{id}/magic` via `magicOp` helper (43-51).
- Route: `app/api/characters/[id]/magic/route.ts:16-24` — no body-schema validation; dispatches to `applyMagicOp`.
- Server: `apps/web/src/lib/data/spells.ts:137-153` `addSpell` case — trims name (required), allowlists `kind` to `'spell'|'glamour'|'rune'|undefined` (141), builds `SpellbookEntryDoc {id: crypto.randomUUID(), spellName, spellLevel, isMemorized, notes, kind?}` and appends to `doc.spellbook`. Runs inside `mutateOwnedCharacterDoc` (`spells.ts:78`, `characters.ts:66-72`) — ETag-guarded read-modify-write with owner assertion.
- Storage: `spellbook?: SpellbookEntryDoc[]` embedded on `CharacterDoc` (`apps/web/src/lib/cosmos/types.ts:73-81,170`), container `characters`, partition key `/ownerId` (types.ts:135). No separate spells container (`lib/data/spells.ts:14-15` comment: `character_spells` table never created).
- Legacy entries lack `kind`; UI infers `'glamour'` when `spellLevel === 0` (`MagicTab.tsx:27` `entryKind`).

## Q5: Magic tab rendering and gating

### Findings
- Variables (`MagicTab.tsx`): `spellcaster = isSpellcaster(class)` (15); `slotsData = getSpellSlots(class, level)` if caster else null (16-19); `isGlamour = slotsData && 'glamours' in slotsData` (20) — Enchanter only; `hasRunes = classHasRunes(class)` (21) — Enchanter only (`runes.json` has only an Enchanter key); `innateGlamours = hasInnateGlamours(kindred)` (22) — Elf/Grimalkin only.
- Data loading: `use-spells.ts:100` — `if (!spellcaster && !innateGlamours) return;` (no fetch).
- Empty state: `MagicTab.tsx:40-47` — `!spellcaster && !innateGlamours` → "This class has no magical abilities." Only zero-section case.
- Sections and gates:
  1. `SpellSlotsSection` — `spellcaster` (63-73). Not shown for non-caster Elf/Grimalkin.
  2. `PreparedSpellsSection` — `spellcaster && !isGlamour` (76-87).
  3. `SpellBookSection` spell variant — `spellcaster && !isGlamour` (90-101).
  4. `SpellBookSection` glamour variant — `isGlamour || innateGlamours` (104-115), "Glamours Known", + Add Glamour button.
  5. `RunesSection` — `hasRunes` (118-126).
- Matrix (class × kindred → sections):

| Class | Kindred | Empty | Slots | Prepared | Book(spell) | Book(glamour) | Runes |
|---|---|---|---|---|---|---|---|
| Cleric/Friar/Magician/Bard | non-Elf/Grimalkin | no | yes | yes | yes | no | no |
| Cleric/Friar/Magician/Bard | Elf/Grimalkin | no | yes | yes | yes | yes | no |
| Enchanter | any | no | yes (glamour circles) | no | no | yes | yes |
| Non-caster | non-Elf/Grimalkin | **yes** | — | — | — | — | — |
| Non-caster | Elf/Grimalkin | no | no | no | no | yes | no |

- Note: Woodgrue (Mad Revelry) and Mossling (Knacks) non-casters hit the empty state — their quasi-magical kindred abilities do not affect any Magic tab gate.

## Q6: Random-generation patterns in character creation

### Findings
- Rules-engine dice module `packages/rules-engine/src/dice.ts:1-44`: `rollDie(sides: DieType)`, `rollMultiple`, `roll3d6`, `rollAbilityScores` (unused by wizard), `parseDiceNotation`, `rollFromNotation`, `rollDamage`. All thin `Math.random()` wrappers; no seeded PRNG abstraction.
- Wizard invocation sites:
  - Ability scores: `Step1AbilityScores.tsx:5,13-16,40,50` and `ManualStep1AbilityScores.tsx:8,42-56` — `roll3d6()` from rules-engine.
  - HP: `Step7HP.tsx:9,26` and `ManualStep7HP.tsx:8,22` — `rollDie(getHitDie(class))` + conMod, min 1.
  - Adventure gear picks: `Step8Equipment.tsx:49-54` — raw `Math.floor(Math.random() * ADVENTURE_GEAR.length)`, up to 3 non-duplicate picks. Bypasses dice.ts.
  - Starting gold: `Step8Equipment.tsx:67` — inline 3d6×10 with raw `Math.random()` (does not use `roll3d6`).
  - Name roll: `Step13Details.tsx:6,19-32` — random pick from `packages/rules-engine/src/data/name-tables.json` via raw `Math.random()` (line 30).
  - Cosmetic: `AnimatedDie.tsx:28` — flicker values during ~700-800ms roll animation (`Step1AbilityScores.tsx:33`, `Step7HP.tsx:25`), discarded.
- Pattern split: stat rolls go through rules-engine `dice.ts`; list-picks (gear, name) and the gold roll use inline raw `Math.random()` in components.
- `retainers.ts` and `combat.ts` in rules-engine contain no wizard-invoked randomness.

## Q7: Tab definition and repo-wide `magic` tab references

### Findings
- Edit page `apps/web/src/app/(app)/characters/[id]/page.tsx`: `type TabName = 'stats'|'combat'|'inventory'|'magic'|'notes'` (15); `useState<TabName>('stats')` (24) — no URL sync, no localStorage; `tabs` array literal with `{id: 'magic', label: 'Magic'}` (105-111, magic at 109); tab bar render (131-151); gated mount `{activeTab === 'magic' && <MagicTab .../>}` (158); import (12).
- Read-only view page `characters/[id]/view/page.tsx` **duplicates the whole pattern independently**: `TabName` (16), state (34), `{id: 'magic', label: 'Magic'}` (91), `<MagicTab ... readOnly />` (151), import (13). No shared tabs constant.
- Related naming: API route path segment `app/api/characters/[id]/magic/route.ts`; `lib/data/spells.ts:11` comment "magic tab"; `magic/use-spells.ts:32` comment; sub-components under `components/character-sheet/magic/`; PDF export spell section `lib/pdf/character-sheet.ts`.
- No `tab=` query param anywhere in repo. `activeTab` appears only in the two character page files + unrelated `campaign/page.tsx` (own TabId set, no magic).
- No tests reference the tab: no e2e dir, no `*.spec.ts` outside node_modules; `test/__tests__/inventory-spells.test.ts` and `pdf-export.test.ts` exercise spell mechanics, not tab UI.
- Docs mentioning the Magic tab: `docs/prd.md:482,868` ("Magic Tab (shown only for Cleric, Friar, Magician, Enchanter, Bard)"; "Magic tab (spell slots + memorization)"), duplicate `dolmenwood_beyond_prd.md:482,868`, `.github/copilot-instructions.md:38,76`, `README.md:8`.
- ~60+ other files match "magic" case-insensitively but are game mechanics (magic resistance, saving throws "vs. Magic", spell descriptions, `Magician` class name at `packages/types/src/index.ts:19`, `magicResistance` field at :208) — not tab references.
- Build artifacts: `apps/web/public/sw.js:1` precache entry for the compiled `/api/characters/[id]/magic` route chunk (API path, not UI label).

## Cross-Cutting Observations
- **Trait names are the only mechanic hook.** The rules engine has exactly one trait-name special case (`hasInnateGlamours` matching `'Glamours'`). Shape-Shifting, Mad Revelry, Knacks, Symbiotic Flesh, Gaze etc. have no code hook — they exist only as `{name, description}` display data.
- **"Randomly determined" is unimplemented flavor text.** kindreds.json says the Elf/Grimalkin glamour is "randomly determined" (126-128, 205-207), but no code rolls or auto-assigns one at creation or later; the only path is manual add via `AddSpellForm` (select from Enchanter's 22-glamour list or free text).
- **Creation persists nothing magical.** `newCharacterToDoc` writes empty `spellbook`/`spellSlots`/`spellPreparations` and `traits: null`; all spell/glamour data enters post-creation through the magic op route.
- **Server-tier pattern for character mutations**: data module (`lib/data/spells.ts` op-dispatcher `applyMagicOp`) + route (`api/characters/[id]/magic`) + client wrapper (`lib/api/spells.ts`) + owner-asserted ETag-guarded document mutation (`mutateOwnedCharacterDoc`). Inventory seeding at creation follows the same wrapper pattern (`lib/api/inventory.ts` `insertInventoryItem`).
- **Duplication hotspots**: tabs array + TabName union duplicated across edit and view pages; 3d6 logic re-implemented inline in `Step8Equipment.tsx:67`; manual-mode finalize drops equipment/gold (auto mode seeds them).
- **Spellbook entry `kind` field** (`'spell'|'glamour'|'rune'`, optional) is the discriminator used by all Magic tab sections; legacy entries without `kind` are inferred glamour iff `spellLevel === 0`.

## Open Areas
- The Dolmenwood rulebook's actual random-glamour table for Elf/Grimalkin (which glamours, what die) is not present anywhere in the repo data files — kindreds.json only says "randomly determined" and the Enchanter's 22-glamour list is the only glamour enumeration that exists. Whether the innate-glamour pool equals the Enchanter list cannot be determined from the codebase.
- Mossling "Knacks" references "Mossling Knacks (p112)" and Woodgrue Mad Revelry lists seven option names, but no data file enumerates knacks or revelry effects — only the one-line trait descriptions exist.
- No test coverage exists for MagicTab gating, tab switching, or wizard finalize seeding; assertions about behavior come from code reading only.
