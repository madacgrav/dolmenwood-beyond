# Structure Outline

## Approach
Five vertical slices, ordered lowest-risk/highest-independence first. Phases 1–3
are render/wiring only (no model change). Phase 4 adds one persisted field
through the full server tier. Phase 5 (movement) is last because it is blocked on
sourcing the exact Exploring/Overland table from the rulebook. Each phase stands
alone — if a later phase stalls, earlier ones still ship.

Commands: `pnpm typecheck`, `pnpm test` (turbo → `vitest run`), `pnpm lint`.

---

## Phase 1: Identity fields in header
Render stored `alignment`, `moonSign`, `background` in the sheet header. Pure UI, no model/data change — fields already flow through `docToCharacter`.

**Files**: `apps/web/src/components/character-sheet/CharacterSheetHeader.tsx`
**Key changes**:
- Add detail lines under the existing subtitle (`:56`) showing Alignment, Moon Sign, Background when present (omit empty ones).
- Values from `character.alignment`, `character.moonSign`, `character.background` (already on `Character`).

**Verify**: `pnpm typecheck`. Manual: load a character with non-null alignment/moonSign/background → all three visible in header; a character missing them → those lines absent (no blank labels).

---

## Phase 2: Naming + item_type reconcile
Cosmetic correctness: INT sublabel and Add-Item type options.

**Files**: `apps/web/src/components/character-sheet/stats/AbilityScoresSection.tsx`, `apps/web/src/components/character-sheet/inventory/types.ts`, `apps/web/src/components/character-sheet/inventory/AddItemForm.tsx`
**Key changes**:
- `AbilityScoresSection.tsx:9` sublabel "Intellect" → "Intelligence".
- `inventory/types.ts:18` `ITEM_TYPES` → model enum values `['weapon','armor','gear','spell_component','ammo','coin']` with friendly display labels; ensure AddItemForm `<select>` writes the enum value not the label.
- Confirm no consumer keys off the old `armour/consumable/other` strings (grep first).

**Verify**: `pnpm test` (existing inventory/spells tests pass). Manual: INT card reads "Intelligence"; add an item of each type → stored `item_type` matches the model enum; AC still correct for equipped armour (AC derivation keys off `armorAcBonus`/`isShield`, not `item_type`).

---

## Phase 3: Magic Resistance save row
Add a 6th save row, "Magic Resistance", to both SavingThrows sections. Reuses existing `getMagicResistance(wis, kindredBonus)`.

**Files**: `packages/rules-engine/src/retainers.ts` (or `kindreds.ts`) for a kindred-bonus accessor, `packages/rules-engine/src/index.ts` (export), `apps/web/src/components/character-sheet/StatsTab.tsx`, `apps/web/src/components/character-sheet/CombatTab.tsx`, `apps/web/src/components/character-sheet/stats/SavingThrowsSection.tsx`, `apps/web/src/components/character-sheet/combat/SavingThrowsSection.tsx`
**Key changes**:
- New helper `getKindredMagicResistance(kindred: Kindred): number` — reads `magicResistance` from `kindreds.json` (mirror `getKindredACBonus`). Returns 0 when absent.
- In each tab container compute `magicResistance = getMagicResistance(character.abilityScores.wis, getKindredMagicResistance(character.kindred))` and pass to the section.
- SavingThrows sections render an extra row: label "Magic Resistance", target `{magicResistance}+` (rollable in the combat variant, static in stats variant).

**Verify**: `pnpm test` — add a rules-engine test: WIS 16 + kindred bonus 2 → 4. Manual: WIS 16 character of a magic-resistant kindred (e.g. the two in `kindreds.json:181,260`) shows the correct target; a WIS 9 human shows the base value.

---

## Phase 4: Kindred & Class Traits box
New persisted freeform field `traits`, rendered as an autosaved textarea section in the Stats tab.

**Files**: `packages/types/src/index.ts` (`Character`), `apps/web/src/lib/cosmos/types.ts` (`CharacterDoc`), `apps/web/src/lib/data/mappers/character.ts` (`docToCharacter`, `applyCharacterUpdates`, `newCharacterToDoc`), `apps/web/src/components/character-sheet/StatsTab.tsx`, new `apps/web/src/components/character-sheet/stats/TraitsSection.tsx`
**Key changes**:
- `Character.traits?: string`; `CharacterDoc.traits: string | null`.
- Mapper: `traits: doc.traits ?? undefined` in `docToCharacter`; handle in `applyCharacterUpdates` and default `null` in `newCharacterToDoc`. (This file is the documented single source of truth — `character.ts:18`.)
- `TraitsSection`: textarea + debounced `onUpdate({ traits })` + "Saved ✓" indicator, copied from `NotesTab` GeneralNotes (`NotesTab.tsx:18-52`); takes `readOnly`.
- Render in `StatsTab` render order; thread `readOnly` on the view page.
- No new API route — existing `PATCH /api/characters/[id]` accepts partial `Character`.

**Verify**: `pnpm test` — mapper round-trip test (doc→domain→update→doc preserves `traits`). Manual: type in Traits box → "Saved ✓" → reload → text persists; view page shows it read-only (no textarea edit).

---

## Phase 5: Movement — fix Speed source + Exploring/Overland
Fix the hardcoded `calculateSpeed(0)` and add two derived movement values. **Blocked** on the exact Speed→Exploring→Overland table (see Open Risk in design).

**Files**: `packages/rules-engine/src/speed.ts`, `packages/rules-engine/src/index.ts`, `apps/web/src/components/character-sheet/StatsTab.tsx`, `apps/web/src/components/character-sheet/stats/CombatStatsSection.tsx`
**Key changes**:
- New: `getExplorationRate(speed: 10|20|30|40): number` (feet/turn), `getOverlandRate(speed: 10|20|30|40): number` (travel points/day) — values from the Dolmenwood Player's Book.
- `StatsTab.tsx:32`: replace `calculateSpeed(0)` with speed from real equipped weight — compute `totalEquippedWeight` the way `WeightBar.tsx:12-17` does (share a helper if practical) so the Stats pill and Inventory bar agree.
- `CombatStatsSection`: show three pills — Speed (`{speed}′` ft/round), Exploring (`{explore}′` ft/turn), Overland (`{overland}` pts/day).

**Verify**: `pnpm test` — speed/exploration/overland table tests. Manual: a lightly-loaded character shows Speed 40′; load one past 400/600/800-coin thresholds → Speed pill drops (no longer always 40′) and matches the Inventory `WeightBar` value; Exploring/Overland change accordingly.

---

## Testing Checkpoints
- **After P1**: header renders alignment/moonSign/background; typecheck clean.
- **After P2**: INT="Intelligence"; item_type values are model-enum-valid; inventory/AC tests green.
- **After P3**: Magic Resistance row in both saves sections; rules-engine MR test green.
- **After P4**: `traits` persists round-trip; mapper test green; view page read-only.
- **After P5**: Stats Speed reflects real encumbrance (bug gone) and equals `WeightBar`; Exploring/Overland present; speed tests green.

## Notes
- P5 is the only phase that can't proceed without external data (the movement table). P1–P4 are fully unblocked and can ship independently in order.
- No database migration needed — Cosmos is schemaless; `traits` simply appears on new writes and reads back `undefined`/`null` for existing docs.
