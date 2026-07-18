# Structure Outline

## Approach
Fix bundle parsing at the shared choke point (`parseCountSuffix`), let the catalog picker derive per-unit weight, migrate existing data with a dry-run script, harden the restock write path, and persist wizard starting equipment. Four vertical slices, each shippable alone.

## Phase 1: Bundle parsing + catalog picker fix

Adding "Arrows (quiver of 20)" from the catalog picker produces `Arrow, qty 20, weight_coins = catalogWeight / 20`.

**Files**: `apps/web/src/lib/inventory/parse-count.ts`, `apps/web/src/components/character-sheet/inventory/use-add-item.ts`, `apps/web/src/test/__tests__/consumables.test.ts` (or new `parse-count.test.ts`)

**Key changes**:
- `parseCountSuffix(raw: string): { name: string; quantity: number | null }` — regex extended to also match `(quiver of N)`, `(case of N)`, `(bundle of N)`, `(bag of N)` (case-insensitive). Existing numeric forms unchanged.
- `selectCatalogItem` — when `parsed.quantity` came from the name, set `weight_coins: cat.weight / parsed.quantity` (rounded to 2 dp); else `cat.weight` as today.
- `canonicalName` needs no change — count-stripped "Arrows" already hits the `Arrow` alias.

**Verify**: `npm test` in `apps/web` passes with new cases (`'Arrows (quiver of 20)'` → `{name:'Arrows', quantity:20}`; `canonicalName('Arrows (quiver of 20)') === 'Arrow'`; `'Rations (1 week)'` unchanged). Manual: catalog-add an ammo bundle, row shows `Arrow ×20`, weight chip 20¢ total.

---

## Phase 2: Data migration for existing rows + catalog docs

Existing bundle-shaped data (character inventory entries and `catalog_items` docs) converted to canonical singular name, multiplied quantity, divided per-unit weight.

**Files**: new `scripts/fix-bundle-items.ts` (modeled on `scripts/fix-inventory-names.ts`)

**Key changes**:
- Script iterates `catalog_items` and `characters` containers; for each name where the extended `parseCountSuffix` yields a quantity: `itemName = canonicalName(cleaned)`, `quantity *= N`, `weightCoins = round2(weightCoins / N)`. Dry-run default, `--apply` to write.
- Skip entries already per-unit (no bundle pattern in name).

**Verify**: run dry-run, review printed diff against live data (catalog contents unknown — this is the gate), then `--apply`. Manual: affected character now shows `Arrow ×20`, weight 20¢; Combat tab ammo list shows clean names.

---

## Phase 3: Restock hardening + weight values + button investigation

Restock reliably writes, surfaces failures, deducts coins only for successful items; ammo per-unit weights corrected; live check of the missing button.

**Files**: `apps/web/src/lib/api/inventory.ts`, `apps/web/src/components/character-sheet/inventory/use-restock.ts`, `apps/web/src/components/character-sheet/inventory/restock-data.ts`

**Key changes**:
- `restock-data.ts`: `weightCoins` → 1 (Arrow), 1 (Crossbow Quarrel), 1 (Sling Stone); drop provisional comment.
- `insertInventoryItem(...): Promise<InventoryItem>` — throws on `!response.ok` (was: return null).
- `updateItemQuantity(...): Promise<void>` — throws on `!response.ok` (was: fire-and-forget). Check other callers (`use-inventory.ts`, `use-ammo-tracking.ts`) tolerate the throw.
- `handleRestock` — track `succeededSp` per item inside the loop; on loop end deduct `succeededSp` only; any per-item failure sets `restockError = 'error'` (keep partial successes applied).
- Live: run app, open character sheet as owner, confirm "🛒 Restock" renders; fix whatever visibility bug appears (unknown until observed).

**Verify**: `npm test` passes. Manual: restock arrows into migrated character → merges into existing `Arrow` row; kill network mid-restock → error shown, coins not deducted for failed items.

---

## Phase 4: Persist wizard starting equipment

Completing the auto wizard writes rolled equipment (and buy-mode gold) to the new character.

**Files**: `apps/web/src/stores/wizard-store.ts`, `apps/web/src/components/wizard/steps/Step8Equipment.tsx`, `apps/web/src/app/(app)/characters/new/auto/complete/page.tsx`

**Key changes**:
- `wizard-store`: add `equipment: string[]`, `startingGold: number`, setters, include in `reset()`.
- `Step8Equipment`: `handleRoll` → `setEquipment([...classItems, ...gearRolls, trinket])`; `handleBuyMode` → `setStartingGold(g)`; mode toggle clears the other field.
- `complete/page.tsx` after `createCharacter` success, before `wizard.reset()`:
  - fetch `/api/catalog` once; for each equipment string: `parseCountSuffix` → qty, `canonicalName` → name, catalog match by canonical name → `weight_coins` (bundle-divided per Phase 1 logic) + `item_type`; fallback `{weight_coins: 0, item_type: 'gear'}`; `insertInventoryItem(...)` sequentially.
  - `startingGold > 0` → save coins `{gp: startingGold}` via existing coins API (`saveCoins` wrapper in `lib/api/characters.ts`).
  - Insert failures: non-fatal — character already created; log and continue (note on screen optional).

**Verify**: `npm test` + `npm run typecheck` pass. Manual: run auto wizard as Hunter → new character has Short bow, `Arrow ×20` (weight 20¢), leather armour, rolled gear, trinket; buy-mode run → coins show rolled gold, no items.

## Testing Checkpoints
- After P1: unit tests green; fresh catalog adds are correct; old data still wrong (expected).
- After P2: live data clean; picker + data consistent; restock merge target now canonical.
- After P3: restock end-to-end works with visible errors; ammo weights = 1¢/unit everywhere; button visibility resolved.
- After P4: wizard produces populated inventory; whole task complete.
