# Research Findings

## Q1: `calculateAC` signature and formula

### Findings
- Formula (`packages/rules-engine/src/ac.ts:11-20`):
  `AC = 10 + getAbilityModifier(dexScore) + armorBonus + kindredACBonus + classACBonus + shieldBonus`
- `ACInputs` interface (`packages/rules-engine/src/ac.ts:3-9`) — all five fields `number`, **all required, no defaults**:
  - `dexScore` — raw DEX score, run through `getAbilityModifier`.
  - `armorBonus` — flat AC from worn armor.
  - `kindredACBonus` — flat AC from kindred/species.
  - `classACBonus` — flat AC from class.
  - `shieldBonus` — flat AC from equipped shield.
- DEX mod via `getAbilityModifier` (`packages/rules-engine/src/ability-modifiers.ts:1-15`): lookup table, ≤3 → -3, ≥18 → +3, 9-12 → 0, `?? 0` fallback for unmapped.

## Q2: Call sites — how each input is sourced

### Findings
Five independent call sites. `classACBonus` and `shieldBonus` hardcoded `0` at ALL five. `kindredACBonus` derived via `getKindredACBonus` at all five. Divergence is entirely in `armorBonus`:

| Site | file:line | dexScore | armorBonus |
|---|---|---|---|
| CombatTab | `CombatTab.tsx:46-52` | prop `character.abilityScores.dex` | **`equippedArmorBonus` state**, fetched via `fetchEquippedArmorBonus(characterId)` (`CombatTab.tsx:35`) |
| StatsTab | `StatsTab.tsx:30` | prop `character.abilityScores.dex` | **hardcoded `0`** — no inventory lookup |
| CharacterCard | `CharacterCard.tsx:23-29` | prop `character.abilityScores.dex` | **prop `armorBonus`** (defaults `0` at `CharacterCard.tsx:11,15`), fed from roster batch calc |
| Step9AC (wizard) | `Step9AC.tsx:15` | store `abilityScores.dex` | **hardcoded `const armorBonus = 0`** (`Step9AC.tsx:14`), comment "wired in once inventory is tracked" |
| PDF export | `character-sheet.ts:117-123` | `c.abilityScores.dex` | **inline reduce** over `c.inventory` equipped (`character-sheet.ts:112-114`) |

**Root divergence:** StatsTab and Step9AC hardcode `armorBonus: 0`; CombatTab, CharacterCard, PDF each derive it through a *different* code path. Same character on Stats tab vs Combat tab yields different AC whenever any armor is equipped.

## Q3: Three independent "equipped armor bonus" implementations

### Findings
Same predicate (`location === 'equipped'`), same `reduce(sum + (x ?? 0), 0)`. Differences are field-name/shape + data-loading path, **not logic**:

1. `fetchEquippedArmorBonus` (`apps/web/src/lib/api/inventory.ts:58-64`) — sums `armor_ac_bonus` (snake_case) over client `InventoryItem[]` from `listInventory()` → HTTP `GET /api/characters/[id]/inventory` (`route.ts:7-14`). `entryToItem` (`lib/data/inventory.ts:13-26`) maps camelCase `armorAcBonus` → snake `armor_ac_bonus`. Used only by CombatTab.
2. `armorByCharacter` in `listCharactersWithArmor` (`apps/web/src/lib/data/characters.ts:82-94`) — sums `armorAcBonus` (camelCase) straight off `doc.inventory` (`InventoryEntryDoc[]`), one bulk Cosmos query. Feeds CharacterCard prop via `/api/characters` → `useCharacters()` → `page.tsx:127`.
3. PDF inline reduce (`apps/web/src/lib/pdf/character-sheet.ts:112-114`) — sums `armorAcBonus` off `c.inventory` from `fetchFullCharacter(id)`.
- Server twin exists but unused by these: `equippedArmorBonusOf(doc)` (`lib/data/inventory.ts:107-112`) — same logic, called by neither.
- Same underlying `doc.inventory`, so results match for identical data; only difference is HTTP-fetch staleness (#1) vs single server read (#2/#3). Duplicated code, not shared.

## Q4: InventoryItem model, armorAcBonus origin, shields

### Findings
- "Equipped" = `location === 'equipped'`; no boolean flag. `WeightLocation = 'equipped' | 'stowed' | 'tiny'` (`packages/types/src/index.ts:7`).
- Three parallel shapes: domain `InventoryItem` (`packages/types/src/index.ts:144-159`, `armorAcBonus?: number`), client `InventoryItem` snake_case (`lib/api/inventory.ts:9-20`, `armor_ac_bonus`), persistence `InventoryEntryDoc` (`lib/cosmos/types.ts:33-44`, embedded on `CharacterDoc.inventory`).
- **armorAcBonus origin:** NOT `equipment.json` (that file's raw `"ac"` values are never read at runtime — no import found). Actual source: Cosmos `catalog_items` container (`CatalogItemDoc.armorAcBonus`, `lib/cosmos/types.ts:260-273`), seeded once from legacy Supabase Postgres `armor_ac_bonus` column (`scripts/seed-catalog.ts:18-31,56-70`). Value copied onto inventory entry at add-time (`use-add-item.ts:53-65`, `lib/data/inventory.ts:74`); no live re-lookup (`catalogItemId` stored but not dereferenced in AC calc).
- **Shield:** a separate equipped inventory item, NOT a distinct field. No `isShield`/`shield` flag anywhere. Shield's `armorAcBonus` folds into the same `armorBonus` sum via the equipped reduce. `shieldBonus` param stays `0`. PDF comment confirms: "shield folds into equipped armorAcBonus" (`character-sheet.ts:111`). `equipment.json` `Shield.ac = "+1"` (`equipment.json:334-342`) — reference only.

## Q5: Kindred bonus + unused class/skill/ability AC data

### Findings
- `getKindredACBonus(kindred)` (`packages/rules-engine/src/kindreds.ts:38-43`): regex `/\+(\d+)/` on `KindredData.acBonus` string, `parseInt`, else `0`. Ignores condition text.
- In `kindreds.json`: **only `Breggle.acBonus = "+1 AC (unarmoured or light armour)"`** (`kindreds.json:28`) → returns 1. All other kindreds: no `acBonus` key → 0. The `"+1"` applied **unconditionally** — the "unarmoured or light armour" restriction is not parsed/enforced.
- **Unused AC data that COULD fill hardcoded 0s:**
  - **Class (classACBonus):** `class-advancement.json` has per-level `acBonus` but **only for Friar** (`class-advancement.json:892…1088`), values 2,2,2,3,3,3,4,4,4,4,5,5,5,5,5 for L1-15. Surfaced via `getClassLevel` (`advancement.ts:32-36`), consumed only for a level-up notification (`advancement.ts:148-155`). No `getClassACBonus` helper; no call site reads it into `calculateAC`.
  - **Kindred trait text (unused):** Grimalkin + Woodgrue traits `"Defensive Bonus" "+2 AC in melee with Large creatures"` (`kindreds.json:196-199,390-392`) — free-text only, not in `acBonus`, so `getKindredACBonus` returns 0.
  - **Skills:** no AC modifier in `skills.json`.
  - **`ACBreakdown` type** exists (`packages/types/src/index.ts:215-223`: base/dexModifier/armorBonus/kindredBonus/classBonus/shieldBonus/total) but **no producer** anywhere in repo.

## Q6: Data-loading pattern per site

### Findings
| Site | Pattern | Source |
|---|---|---|
| CombatTab | async client fetch (own `useEffect`) | `character` prop from page `fetchCharacterWithNotes`; armor via `fetchEquippedArmorBonus` HTTP (`CombatTab.tsx:30-36`) — decoupled from page fetch, independent re-fetch |
| StatsTab | prop only, no fetch | `character` prop; `armorBonus:0` hardcoded (`StatsTab.tsx:30`) |
| CharacterCard | server batch, one query | `useCharacters()` → `/api/characters` → `listCharactersWithArmor()`; `armorBonus` prop (`page.tsx:127`) |
| Step9AC | Zustand store, hardcoded | `useWizardStore()`; `armorBonus:0` (`Step9AC.tsx:14`) — no inventory exists at creation |
| PDF | server route single read | `fetchFullCharacter(id)` (`pdf/route.ts:20`), inline compute |
- `/characters/[id]/view` referee route reuses same CombatTab/StatsTab (`view/page.tsx:23-49`) — identical pattern.

## Q7: Tests + non-derived AC displays

### Findings
- **Tests:** `ac.test.ts:1-20` covers `calculateAC` with literal inputs (base 10, dex 16→12, armor stacking, all-five stacking→19). `kindreds.test.ts:10,27` covers `getKindredACBonus('Breggle')>0` and `'Unknown'→0`. `advancement.test.ts:111` covers Friar acBonus level-up detection. **No test exercises any of the 5 app call sites**; no integration/display test for AC.
- **RetainerCard/MountCard:** display **stored** `ac`, not computed. `RetainerCard.tsx:57` (`r.ac`, `DBRetainer.ac: number` `retainers.ts:9`), `MountCard.tsx:49` (`mount.ac ?? '—'`, `DBMount.ac: number|null` `mounts.ts:13`). Value is user-typed number field on create (`AddRetainerForm.tsx:38`, `AddMountForm.tsx:85`), never touches `calculateAC`. Structurally separate path — out of scope for player-character AC consistency.

## Cross-Cutting Observations
- **No single "get character AC" function.** `calculateAC` is a pure formula; every display assembles inputs itself → the inconsistency.
- **Three duplicated equipped-armor reducers** with identical logic (Q3). A shared helper (`equippedArmorBonusOf`) already exists but is used by none of the three.
- **Two dimensions of divergence:** (a) armorBonus 0-vs-derived across sites; (b) `classACBonus`/`shieldBonus` universally 0 despite Friar class data + shield-as-equipped-item existing.
- **Kindred bonus applied unconditionally** — Breggle +1 ignores its "unarmoured/light" restriction.
- Two AC data shapes never wired: `ACBreakdown` type (no producer), Friar per-level `acBonus` (notification only).

## Open Areas
- Whether the Breggle "unarmoured or light armour" condition SHOULD gate the +1 is a rules question, not answerable from code alone.
- Legacy derivation of `armor_ac_bonus` values (Leather=12 total → stored delta) happened in the old Supabase schema, outside this repo — the exact base each stored value is relative to is not verifiable here.
