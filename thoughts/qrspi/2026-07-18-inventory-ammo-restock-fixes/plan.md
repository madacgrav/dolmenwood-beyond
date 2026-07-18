# Implementation Plan

## Overview
Catalog ammo bundles become per-unit rows (Arrow ×20 @ 1¢ each), existing data migrated, restock writes hardened with visible errors and honest coin deduction, wizard starting equipment persisted to the new character.

**Deviation from structure.md**: API wrappers return success flags instead of throwing — `updateItemQuantity` is bare-awaited at `use-inventory.ts:70` and `use-ammo-tracking.ts:26,43,54`; throwing would add unhandled-rejection paths in three files. `insertInventoryItem` keeps its `| null` signature; `updateItemQuantity` changes `Promise<void>` → `Promise<boolean>` (non-breaking for callers that ignore the return).

---

## Phase 1: Bundle parsing + catalog picker fix

### Changes

#### 1. Extend parseCountSuffix
**File**: `apps/web/src/lib/inventory/parse-count.ts`
**Action**: modify

Replace the regex and doc comment (current: `parse-count.ts:1-16`). Add bundle-phrase support:

```ts
/**
 * Split a trailing count off an item name: "Torches (3)" → { name: 'Torches', quantity: 3 }.
 * Matches numeric suffixes — "(3)", "x3", "x 3", "×3" — and bundle phrases —
 * "(quiver of 20)", "(case of 20)", "(bundle of 12)", "(bag of 10)". Other
 * parentheticals like "Potion (minor)" or "Horse Feed (per day)" pass through untouched.
 * Returns quantity: null when no count is present, so callers keep the original name.
 */
export function parseCountSuffix(raw: string): { name: string; quantity: number | null } {
  const s = raw.trim();
  const m = s.match(
    /^(.*?)(?:\s*\((?:(?:quiver|case|bundle|bag|pack|set)\s+of\s+)?(\d+)\)|\s+[x×]\s*(\d+))\s*$/i,
  );
  if (!m) return { name: s, quantity: null };
  const n = parseInt(m[2] ?? m[3] ?? '', 10);
  if (!Number.isFinite(n) || n <= 0) return { name: s, quantity: null };
  const name = m[1]!.trim();
  if (!name) return { name: s, quantity: null };
  return { name, quantity: n };
}
```

Note: `canonicalName` (`consumables.ts:14-21`) needs no change — `parseCountSuffix('Arrows (quiver of 20)').name === 'Arrows'` → lowercased `'arrows'` hits the `Arrow` alias.

#### 2. Divide bundle weight in catalog picker
**File**: `apps/web/src/components/character-sheet/inventory/use-add-item.ts`
**Action**: modify `selectCatalogItem` (lines 59-75)

```ts
    const parsed = parseCountSuffix(cat.name);
    // Bundle-named catalog rows ("Arrows (quiver of 20)") carry whole-bundle
    // weight; store per-unit weight so weight × quantity stays correct.
    const weight = parsed.quantity
      ? Math.round((cat.weight / parsed.quantity) * 100) / 100
      : cat.weight;
    setNewItem({
      item_name: canonicalName(cat.name),
      ...
      quantity: parsed.quantity ?? 1,
      weight_coins: weight,
      ...
```

#### 3. Tests
**File**: `apps/web/src/test/__tests__/consumables.test.ts`
**Action**: modify (add cases alongside existing `parseCountSuffix`/`canonicalName` tests)

```ts
// parseCountSuffix
expect(parseCountSuffix('Arrows (quiver of 20)')).toEqual({ name: 'Arrows', quantity: 20 });
expect(parseCountSuffix('Quarrels (case of 20)')).toEqual({ name: 'Quarrels', quantity: 20 });
expect(parseCountSuffix('Candles (bundle of 12)')).toEqual({ name: 'Candles', quantity: 12 });
expect(parseCountSuffix('Rations (1 week)')).toEqual({ name: 'Rations (1 week)', quantity: null });
expect(parseCountSuffix('Horse Feed (per day)')).toEqual({ name: 'Horse Feed (per day)', quantity: null });
// canonicalName
expect(canonicalName('Arrows (quiver of 20)')).toBe('Arrow');
expect(canonicalName('Quarrels (case of 20)')).toBe('Crossbow Quarrel');
```

### Verification
#### Automated
- [x] `npm test` (in `apps/web`) passes, including new cases
- [x] `npm run typecheck` (in `apps/web`) passes

#### Manual
- [ ] Catalog-add a bundle-named ammo item → row shows `Arrow ×20`, weight chip shows bundle total (per-unit × 20), not bundle × 20

---

## Phase 2: Data migration

### Changes

#### 1. Migration script
**File**: `scripts/fix-bundle-items.ts`
**Action**: create (clone structure of `scripts/fix-inventory-names.ts:1-76` — dry-run default, `--apply` flag)

Differences from `fix-inventory-names.ts`:
- Import `canonicalName` from `../apps/web/src/lib/inventory/consumables` in addition to `parseCountSuffix`.
- **catalog_items**: where `parseCountSuffix(doc.name)` yields a quantity: rename to `canonicalName(doc.name)` AND divide `doc.weight` by the count (`round2`). Log old → new name, weight.
- **characters**: for each inventory entry where `parseCountSuffix(entry.itemName)` yields a quantity:
  ```ts
  const parsed = parseCountSuffix(entry.itemName);
  const newQty = Math.max(1, entry.quantity || 1) * parsed.quantity;
  const newWeight = Math.round((entry.weightCoins / parsed.quantity) * 100) / 100;
  entry.itemName = canonicalName(entry.itemName);
  entry.quantity = newQty;
  entry.weightCoins = newWeight;
  ```
  (Interface gains `weightCoins: number`.) Log `"<old>" qty q weight w -> "<new>" qty q' weight w'` per row.
- Also normalize already-clean ammo names: entries whose `canonicalName(entry.itemName) !== entry.itemName` with no count parsed (e.g. `"Arrows"` → `"Arrow"`) get renamed only — enables restock merge. No qty/weight change.
- Same ETag-safe `characters.item(doc.id, doc.ownerId).replace(doc)` write; same summary line.

Usage: `COSMOS_ENDPOINT=... COSMOS_KEY=... npx tsx scripts/fix-bundle-items.ts [--apply]`

### Verification
#### Automated
- [ ] `npx tsx scripts/fix-bundle-items.ts` (dry-run) runs clean; output reviewed — every proposed change sane (**gate: user reviews before --apply**)
#### Manual
- [ ] After `--apply`: affected character shows `Arrow ×20` weight 20¢ total; Combat tab ammo names clean; re-run dry-run reports 0 changes (idempotent)

---

## Phase 3: Restock hardening + weights + button investigation

### Changes

#### 1. Correct ammo weights
**File**: `apps/web/src/components/character-sheet/inventory/restock-data.ts`
**Action**: modify lines 10-14

```ts
export const RESTOCK_ITEMS: RestockEntry[] = [
  { name: 'Arrow',            priceSp: 0.05, category: 'ammo', weightCoins: 1, pack: 20 },
  { name: 'Crossbow Quarrel', priceSp: 0.1,  category: 'ammo', weightCoins: 1, pack: 20 },
  { name: 'Sling Stone',      priceSp: 0.05, category: 'ammo', weightCoins: 1, pack: 20 },
  ...rest unchanged
];
```
Delete the `// ponytail: provisional` comment (line 10) — weights now rulebook-derived (quiver of 20 = 20 coins, `equipment.json:344-364`).

#### 2. updateItemQuantity returns success
**File**: `apps/web/src/lib/api/inventory.ts`
**Action**: modify lines 76-86

```ts
export async function updateItemQuantity(
  characterId: string,
  itemId: string,
  quantity: number,
): Promise<boolean> {
  const res = await fetch(`/api/characters/${characterId}/inventory/${itemId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quantity }),
  });
  return res.ok;
}
```
Other callers (`use-inventory.ts:70`, `use-ammo-tracking.ts:26,43,54`) ignore the return — no changes needed there.

#### 3. Honest per-item accounting in handleRestock
**File**: `apps/web/src/components/character-sheet/inventory/use-restock.ts`
**Action**: modify `handleRestock` (lines 45-95). Replace the loop + coin block:

```ts
    setRestockLoading(true);
    setRestockError('');
    let succeededSp = 0;
    let anyFailed = false;
    try {
      for (const entry of RESTOCK_ITEMS) {
        const qty = restockQtys[entry.name] ?? 0;
        if (qty <= 0) continue;
        const existing = items.find(
          i => canonicalName(i.item_name) === canonicalName(entry.name),
        );
        if (existing) {
          const newQty = existing.quantity + qty;
          const ok = await updateItemQuantity(characterId, existing.id, newQty);
          if (!ok) { anyFailed = true; continue; }
          setItems(prev => prev.map(i => i.id === existing.id ? { ...i, quantity: newQty } : i));
        } else {
          const mapped = await insertInventoryItem({
            character_id: characterId,
            item_name: entry.name,
            item_type: entry.category === 'ammo' ? 'ammo' : 'gear',
            quantity: qty,
            weight_coins: entry.weightCoins,
            location: 'stowed',
          });
          if (!mapped) { anyFailed = true; continue; }
          setItems(prev => [...prev, mapped]);
        }
        succeededSp += qty * entry.priceSp;
      }
      if (succeededSp > 0) {
        const newCoins = deductSp(coins, succeededSp);
        await saveCoins(newCoins);
        setCoins(newCoins);
      }
      if (anyFailed) {
        setRestockError('error'); // partial writes applied; coins deducted only for successes
      } else {
        setRestockQtys({});
        setRestockSuccess(true);
        setTimeout(() => {
          setRestockSuccess(false);
          setShowRestock(false);
        }, 1500);
      }
    } catch {
      setRestockError('error');
    }
    setRestockLoading(false);
```
(`totalQty` alias dropped; funds gate above unchanged.) `RestockSheet.tsx` already renders `restockError === 'error'` state — verify its copy fits partial failure; adjust text to "Some items could not be added. Coins were only deducted for successful purchases." if the existing message misleads.

#### 4. Button investigation (live)
Run app (`preview_start`), open a character sheet as owner:
- Confirm "🛒 Restock" renders (`InventoryTab.tsx:84-98`, gated `isOwner = !readOnly` at line 42).
- If missing: inspect what `readOnly` prop is passed from the character page and why; fix the actual cause found (unknown until observed — do not speculate in code).
- Also verify submit button state: with qty > 0 it enables and label reads `Restock (…)` (`RestockSheet.tsx:211-229`).

### Verification
#### Automated
- [x] `npm test` passes
- [x] `npm run typecheck` passes
#### Manual
- [ ] Restock arrows for migrated character → merges into existing `Arrow` row (quantity increases, no duplicate row)
- [ ] Restock on fresh character → new `Arrow` row, weight 1¢/unit
- [ ] Simulate failure (devtools offline after sheet open) → error message shown, coins unchanged
- [ ] "🛒 Restock" button visible for owner; cause found/fixed if not

---

## Phase 4: Persist wizard starting equipment

### Changes

#### 1. Wizard store fields
**File**: `apps/web/src/stores/wizard-store.ts`
**Action**: modify

Add to `WizardState` interface (after `portraitUrl`):
```ts
  equipment: string[];
  startingGold: number;
  setEquipment: (items: string[]) => void;
  setStartingGold: (gold: number) => void;
```
Initial values `equipment: [], startingGold: 0`; setters `setEquipment: (equipment) => set({ equipment })`, `setStartingGold: (startingGold) => set({ startingGold })`; add both to `reset()` (line 80-85).

#### 2. Step8 writes the store
**File**: `apps/web/src/components/wizard/steps/Step8Equipment.tsx`
**Action**: modify

- `const { characterClass, kindred, setEquipment, setStartingGold } = useWizardStore();`
- End of `handleRoll` (line 57): after `setItems(rolled)`, also `setEquipment(rolled); setStartingGold(0);` (build the array in a local `const rolled` first).
- `handleBuyMode` (line 62-66): after `setGold(g)`, also `setStartingGold(g); setEquipment([]);`
- "Roll Equipment" toggle button (line 77): also `setEquipment([]); setStartingGold(0);`

#### 3. Complete page inserts inventory
**File**: `apps/web/src/app/(app)/characters/new/auto/complete/page.tsx`
**Action**: modify `save()` (lines 19-43)

After `id` is obtained, before `wizard.reset()`:

```ts
      } else if (id) {
        await seedInventory(id, wizard.equipment, wizard.startingGold);
        setCharacterId(id);
        wizard.reset();
      }
```

New helper in the same file (module scope):

```ts
import { insertInventoryItem } from '@/lib/api/inventory';
import { saveCoins } from '@/lib/api/characters';
import { parseCountSuffix } from '@/lib/inventory/parse-count';
import { canonicalName } from '@/lib/inventory/consumables';

/** Best-effort: character exists either way; a failed item insert is logged and skipped. */
async function seedInventory(characterId: string, equipment: string[], startingGold: number) {
  let catalog: { name: string; itemType: string; weight: number }[] = [];
  try {
    const res = await fetch('/api/catalog');
    if (res.ok) catalog = await res.json();
  } catch { /* fall back to zero-weight gear */ }

  for (const raw of equipment) {
    const parsed = parseCountSuffix(raw);
    const name = canonicalName(raw);
    const cat = catalog.find(c => canonicalName(c.name) === name);
    const catCount = cat ? parseCountSuffix(cat.name).quantity : null;
    const weight = cat
      ? Math.round((cat.weight / (catCount ?? 1)) * 100) / 100
      : 0;
    try {
      await insertInventoryItem({
        character_id: characterId,
        item_name: name,
        item_type: cat?.itemType ?? 'gear',
        quantity: parsed.quantity ?? 1,
        weight_coins: weight,
        location: 'stowed',
      });
    } catch (e) {
      console.error('starting equipment insert failed', raw, e);
    }
  }
  if (startingGold > 0) {
    try { await saveCoins(characterId, { gp: startingGold, sp: 0, cp: 0 }); }
    catch (e) { console.error('starting gold save failed', e); }
  }
}
```

Notes:
- `'Arrows (20)'` → name `Arrow`, qty 20 (existing numeric parse, `consumables.test.ts:35`).
- Armor/weapon rows land `stowed` with no damage/AC metadata — user equips on the sheet. (Matching catalog rows supply `itemType`; wiring damage dice/AC from catalog is deliberately out — smallest diff, sheet allows editing.) If catalog has `weaponDamageDice`/`armorAcBonus` readily on the fetched shape, pass them through — check the `/api/catalog` response shape (`use-add-item.ts:36-41`) and include `weapon_damage_dice`, `armor_ac_bonus`, `is_shield`, `armor_bulk` when present; `location: 'equipped'` for armor/weapon like `selectCatalogItem` does (`use-add-item.ts:68`).

### Verification
#### Automated
- [ ] `npm test` passes
- [ ] `npm run typecheck` passes
#### Manual
- [ ] Auto wizard as Hunter, Roll Equipment → new character inventory has Short bow, `Arrow ×20` (weight 20¢ total), Leather armour, up to 3 gear items, kindred trinket
- [ ] Auto wizard, Buy Equipment → no items, coins show rolled gp
- [ ] Wizard `reset()` clears equipment/gold (start second wizard run, step 8 empty)
