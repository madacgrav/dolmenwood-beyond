# Structure Outline

## Approach
One pure engine function `deriveCharacterAC` becomes the sole AC producer; every display site
routes through it. Ship in dependency order: engine core first (foundation), then rewire the
UI/PDF sites to fix the reported bug, then add the `isShield`/`armorBulk` data model, then
backfill legacy docs. Phases 1–2 fix the reported inconsistency on their own; 3–4 light up
shield isolation and the Breggle gate.

---

## Phase 1: Engine core — `deriveCharacterAC` + `getClassACBonus` + Breggle gate
Pure rules-engine. Single function assembles all `ACInputs` and returns an `ACBreakdown`.
Reads new item fields when present, falls open when absent (no data-model change yet).

**Files**: `packages/rules-engine/src/ac.ts`, new `packages/rules-engine/src/character-ac.ts`,
`packages/rules-engine/src/advancement.ts` (export class AC), `packages/rules-engine/src/kindreds.ts`
(gate helper), `packages/rules-engine/src/index.ts` (exports),
`packages/rules-engine/src/__tests__/character-ac.test.ts` (new)

**Key changes**:
- `interface ACItem { location: WeightLocation; itemType: string; armorAcBonus?: number | null; isShield?: boolean; armorBulk?: ArmorBulk | null }` — engine-local input shape
- `deriveCharacterAC(input: { abilityScores: AbilityScores; kindred: string; characterClass: string; level: number }, items: ACItem[]): ACBreakdown` — new, sole producer
- `getClassACBonus(className: string, level: number): number` — new; reads `class-advancement.json` `acBonus` (Friar only, else 0)
- `kindredBonusApplies(kindred: string, bodyArmorBulk: ArmorBulk | null): boolean` — new; Breggle-type condition ("unarmoured or light") false when medium/heavy body armor
- `type ArmorBulk = 'none' | 'light' | 'medium' | 'heavy'` — new (in `packages/types`)
- Shield term = sum `armorAcBonus` of equipped `isShield` items; armor term = sum of equipped non-shield; body-armor bulk = heaviest equipped non-shield `armorBulk`

**Verify**: `turbo test --filter=rules-engine` passes new cases — base 10; Friar L1 unarmored → 12;
Breggle in light armor keeps +1, in plate drops it; shield stacks on armor; missing `armorBulk`
falls open (bonus kept).

---

## Phase 2: Rewire all display sites → `deriveCharacterAC` (fixes reported bug)
Replace manual `calculateAC` assembly at all five sites with `deriveCharacterAC`. Collapse the
three duplicated armor reducers. Lift equipped-armor fetch to the parent character page so Stats
and Combat tabs share one source. Delete `fetchEquippedArmorBonus` divergence.

**Files**: `apps/web/src/components/character-sheet/CombatTab.tsx`,
`.../StatsTab.tsx`, `.../characters/CharacterCard.tsx`, `.../wizard/steps/Step9AC.tsx`,
`apps/web/src/lib/pdf/character-sheet.ts`, `apps/web/src/app/(app)/characters/[id]/page.tsx`
(lift fetch), `apps/web/src/lib/data/characters.ts` (roster uses helper),
`apps/web/src/lib/data/inventory.ts` (reuse `equippedArmorBonusOf` or map to `ACItem`),
`apps/web/src/lib/api/inventory.ts` (remove now-unused `fetchEquippedArmorBonus` if orphaned)

**Key changes**:
- Character page fetches inventory once, computes `ACBreakdown` (or passes `ACItem[]`), passes to `CombatTab`/`StatsTab` as prop
- Each site: `const breakdown = deriveCharacterAC(char, items); const ac = breakdown.total`
- Roster `listCharactersWithArmor` maps `doc.inventory` → `ACItem[]`, calls helper per character (or precomputes `total`)
- PDF exporter drops inline reduce, calls `deriveCharacterAC`

**Verify**: `turbo typecheck` clean; `turbo test` green; manual — a character with equipped armor
shows the **same** AC on Stats tab, Combat tab, roster card, and PDF. (Shield/Breggle still inert
until Phase 3 stamps fields — value here is armor consistency = the reported bug.)

---

## Phase 3: Data model — `isShield` + `armorBulk` fields end-to-end
Add the two classification fields through every layer so new items carry them. `deriveCharacterAC`
already consumes them (Phase 1).

**Files**: `apps/web/src/lib/cosmos/types.ts` (`CatalogItemDoc`, `InventoryEntryDoc`),
`packages/types/src/index.ts` (`InventoryItem`, confirm `ACBreakdown`, `ArmorBulk`),
`apps/web/src/lib/api/inventory.ts` (client shape), `apps/web/src/lib/data/inventory.ts`
(`entryToItem`, `addInventoryItem`), `apps/web/src/components/character-sheet/inventory/use-add-item.ts`

**Key changes**:
- `CatalogItemDoc`/`InventoryEntryDoc` += `isShield: boolean`, `armorBulk: ArmorBulk | null`
- `InventoryItem` (domain + client snake_case) += same fields
- `addInventoryItem` copies `isShield`/`armorBulk` at add-time like `armorAcBonus` (`inventory.ts:74`)
- `use-add-item.ts` `selectCatalogItem` copies fields from catalog entry into draft

**Verify**: `turbo typecheck` clean; manual — add a catalog "Shield" to a character → AC shows a
separate shield contribution; equip a medium/heavy armor item on a Breggle → kindred +1 drops.

---

## Phase 4: Backfill script for existing catalog + character docs
One-time script stamps `isShield`/`armorBulk` onto existing `catalog_items` and embedded
`CharacterDoc.inventory` entries via an `equipment.json` name→bulk map. Dry-run prints proposed
assignments + unmatched items + suspect `armorAcBonus` (≥10) for review before writing.

**Files**: new `scripts/backfill-armor-classification.ts` (pattern: `scripts/seed-catalog.ts`)

**Key changes**:
- Name→`{ armorBulk, isShield }` map derived from `equipment.json` `armour` array (`bulk` field; `Shield` → isShield)
- `--dry-run` (default) prints table; `--apply` writes
- Sweeps `catalog_items` container AND all `CharacterDoc` docs' embedded `inventory[]`
- Free-text items (no catalog match) → `armorBulk: null`, `isShield: false`

**Verify**: dry-run against data, human-review the printed mapping (esp. `Chain mail armour` /
`Plate armour` name divergences and any ≥10 `armorAcBonus`), then `--apply`; re-run dry-run shows
zero pending. Spot-check a Breggle in plate now gates correctly.

---

## Testing Checkpoints
- **After P1**: `deriveCharacterAC` correct in isolation (engine tests green). No app behavior change yet.
- **After P2**: reported bug fixed — AC identical across Stats/Combat/roster/PDF. Shield & Breggle terms present but zero/open (no field data).
- **After P3**: newly added shield/armor items classified; shield isolation + Breggle gate active for new data.
- **After P4**: legacy items classified; gate/shield correct for all existing characters.

## Notes
- P1 + P2 are the shippable bug fix; P3 + P4 are the "full scope" additions and can land in a follow-up if needed.
- No phase is un-sliceable. P4 is the one non-UI slice (a script) — its checkpoint is the dry-run review, not a UI change.
