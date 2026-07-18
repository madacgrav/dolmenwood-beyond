# Implementation Plan

## Overview

Make restock sell individual items (per-item price + optional pack quick-add), make Light
& Fire work for plural/variant item rows via an alias-aware registry, and write canonical
singular labels for known consumables on entry. No schema changes. Test:
`cd apps/web && pnpm test` (vitest); repo root `pnpm typecheck && pnpm lint`.

---

## Phase 1: Consumable registry — aliases + canonical names

### Changes

#### 1. Aliases on light sources + alias-aware lookup
**File**: `apps/web/src/lib/light-data.ts` **Action**: modify
```ts
import { parseCountSuffix } from '@/lib/inventory/parse-count';

export interface LightSource {
  name: string;
  turns: number;
  icon: string;
  aliases: string[]; // lowercased match forms, count-suffix already stripped
}

export const LIGHT_SOURCES: LightSource[] = [
  { name: 'Torch',     turns: 6,  icon: '🔥',   aliases: ['torch', 'torches'] },
  { name: 'Oil Flask', turns: 24, icon: '🪔',   aliases: ['oil flask', 'oil flasks', 'flask of oil', 'lamp oil'] },
  { name: 'Candle',    turns: 12, icon: '🕯️',  aliases: ['candle', 'candles'] },
  { name: 'Firewood',  turns: 48, icon: '🪵',   aliases: ['firewood', 'wood', 'logs'] },
];
// No Lantern entry — a lantern is equipment; the Oil Flask is the consumable that is lit.

export function lightSourceFor(itemName: string): LightSource | undefined {
  const cleaned = parseCountSuffix(itemName).name.trim().toLowerCase();
  return LIGHT_SOURCES.find(
    (s) => s.name.toLowerCase() === cleaned || s.aliases.includes(cleaned),
  );
}
```

#### 2. Canonical-name helper
**File**: `apps/web/src/lib/inventory/consumables.ts` **Action**: create
```ts
import { LIGHT_SOURCES } from '@/lib/light-data';
import { parseCountSuffix } from './parse-count';

// Non-light consumables that also have a canonical singular label. Light sources
// are resolved from LIGHT_SOURCES (single source of truth for their aliases).
const EXTRA_CONSUMABLES: { canonical: string; aliases: string[] }[] = [
  { canonical: 'Arrow',            aliases: ['arrow', 'arrows'] },
  { canonical: 'Crossbow Quarrel', aliases: ['crossbow quarrel', 'crossbow quarrels', 'quarrel', 'quarrels'] },
  { canonical: 'Sling Stone',      aliases: ['sling stone', 'sling stones'] },
  { canonical: 'Ration',           aliases: ['ration', 'rations', 'preserved ration', 'preserved rations'] },
];

/** Return the clean singular label for a known consumable, else the count-stripped name. */
export function canonicalName(raw: string): string {
  const cleaned = parseCountSuffix(raw).name.trim();
  const key = cleaned.toLowerCase();
  const light = LIGHT_SOURCES.find((s) => s.name.toLowerCase() === key || s.aliases.includes(key));
  if (light) return light.name;
  const extra = EXTRA_CONSUMABLES.find((c) => c.aliases.includes(key));
  return extra ? extra.canonical : cleaned;
}
```

#### 3. Unit test
**File**: `apps/web/src/test/__tests__/consumables.test.ts` **Action**: create
```ts
import { describe, it, expect } from 'vitest';
import { lightSourceFor } from '../../lib/light-data';
import { canonicalName } from '../../lib/inventory/consumables';
// lightSourceFor: 'Torches', 'torch', 'Torch (3)' resolve to Torch; 'Lantern' → undefined; 'Oil Flask' → Oil Flask
// canonicalName: 'Arrows (20)' → 'Arrow'; 'Torches' → 'Torch'; 'preserved rations' → 'Ration'; 'Rope' → 'Rope'
```

### Verification
#### Automated
- [x] `cd apps/web && pnpm test` — new `consumables` test passes (8 tests)
- [x] repo root `pnpm typecheck && pnpm lint` pass
#### Manual
- [ ] (covered by later phases where these are mounted)

---

## Phase 2: Lighting works for plural/variant rows

No new wiring — `LightTracker.tsx:36` filter and `light.ts:27` gate both call the extended
`lightSourceFor`. This phase is test-extension + confirmation.

### Changes

#### 1. Extend light tests with plural/variant fixtures
**File**: `apps/web/src/test/__tests__/light.test.ts` **Action**: modify
- Add: a `'Torches'` row (plural) is lightable and lights server-side — `lightSource` succeeds, `itemName` stays `'Torches'` (label unchanged; only matching widened), `turnsRemaining` 6.
- Add: an item named `'Lantern'` is rejected `{ status: 400 }` (not a light source).
- Keep existing `'Torch'` / `'Oil Flask'` / `'Rope'` cases green.

### Verification
#### Automated
- [x] `cd apps/web && pnpm test light` passes (6 tests incl. plural + lantern-reject)
- [x] `pnpm typecheck` passes
#### Manual
- [ ] Character with a "Torches" row shows the Light button; light → burn → extinguish work
- [ ] "Lantern" row shows no Light button

---

## Phase 3: Canonical singular labels on entry

### Changes

#### 1. Catalog-add writes canonical name
**File**: `apps/web/src/components/character-sheet/inventory/use-add-item.ts` **Action**: modify
```ts
import { canonicalName } from '@/lib/inventory/consumables';
// in selectCatalogItem (currently: const parsed = parseCountSuffix(cat.name); item_name: parsed.name)
const parsed = parseCountSuffix(cat.name);
setNewItem({
  item_name: canonicalName(cat.name),   // canonical singular for known consumables
  quantity: parsed.quantity ?? 1,
  /* ...rest unchanged... */
});
```
(Keep `parseCountSuffix` for the quantity; `canonicalName` internally strips the suffix for the name.)

#### 2. Restock canonical ammo names
**File**: `apps/web/src/components/character-sheet/inventory/restock-data.ts` **Action**: modify
- Rename ammo entries to singular: `Arrow`, `Crossbow Quarrel`, `Sling Stone`. Rename `Preserved Rations` → `Ration` (canonical). Other names unchanged.

#### 3. Alias-aware restock merge
**File**: `apps/web/src/components/character-sheet/inventory/use-restock.ts` **Action**: modify
```ts
import { canonicalName } from '@/lib/inventory/consumables';
// merge lookup (was: i.item_name.toLowerCase() === entry.name.toLowerCase())
const existing = items.find(
  (i) => canonicalName(i.item_name) === canonicalName(entry.name),
);
```
(Insert branch keeps `item_name: entry.name`, already canonical.)

### Verification
#### Automated
- [ ] `cd apps/web && pnpm test` passes; `pnpm typecheck && pnpm lint` pass
#### Manual
- [ ] Catalog-pick "Torches (3)" → row "Torch" qty 3
- [ ] Restock arrows when an "Arrows" row already exists → single merged "Arrows" row (no duplicate), quantity increased
- [ ] Restock arrows on a fresh character → row named "Arrow"

---

## Phase 4: Restock per-item pricing + pack quick-add

### Changes

#### 1. Per-item price + pack field
**File**: `apps/web/src/components/character-sheet/inventory/restock-data.ts` **Action**: modify
```ts
export interface RestockEntry {
  name: string;
  priceSp: number;      // now price PER INDIVIDUAL ITEM
  category: string;
  weightCoins: number;
  pack?: number;        // optional quick-add size (replaces `unit`); undefined = no pack button
}
// ponytail: per-item ammo prices provisional — confirm vs rulebook
{ name: 'Arrow',            priceSp: 0.05, category: 'ammo', weightCoins: 0.1, pack: 20 },
{ name: 'Crossbow Quarrel', priceSp: 0.1,  category: 'ammo', weightCoins: 0.1, pack: 20 },
{ name: 'Sling Stone',      priceSp: 0.05, category: 'ammo', weightCoins: 0.2, pack: 20 },
{ name: 'Oil Flask',        priceSp: 1,    category: 'gear', weightCoins: 10 },
{ name: 'Torch',            priceSp: 0.05, category: 'gear', weightCoins: 10 },
{ name: 'Ration',           priceSp: 1,    category: 'gear', weightCoins: 15 },
{ name: 'Waterskin Refill', priceSp: 0.05, category: 'gear', weightCoins: 0 },
{ name: 'Horse Feed (per day)', priceSp: 0.25, category: 'gear', weightCoins: 0 },
{ name: 'Dog Feed (per day)',   priceSp: 0.10, category: 'gear', weightCoins: 0 },
```

#### 2. Drop the unit multiplier
**File**: `apps/web/src/components/character-sheet/inventory/use-restock.ts` **Action**: modify
- Line 58: `const totalQty = qty;` (was `qty * entry.unit`). `restockTotalSp` (`:37-42`) already sums `qty * entry.priceSp` — now per-item, no change needed.

#### 3. UI: remove bundle label, add pack quick-add
**File**: `apps/web/src/components/character-sheet/inventory/RestockSheet.tsx` **Action**: modify
- Remove the `×{entry.unit} per purchase` sub-label (`:94`). Per-item price already shown at `:96-98`.
- Add a "+{entry.pack}" button next to the `+` stepper, shown only when `entry.pack` is set; onClick `setRestockQtys(q => ({ ...q, [entry.name]: (q[entry.name] ?? 0) + entry.pack! }))`.

### Verification
#### Automated
- [ ] `cd apps/web && pnpm test` passes; `pnpm typecheck && pnpm lint` pass
#### Manual
- [ ] Buy 3 arrows → row qty 3, cost 3 × per-item price; no "×N per purchase" text
- [ ] Tap "+20" on Arrow → count jumps by 20; total scales per item
- [ ] Cheapest ammo shows a non-zero price (or the pack is the priced unit)

---

## Cross-phase final checks
- [ ] Repo root `pnpm typecheck && pnpm lint && pnpm test` all green
- [ ] `git diff` limited to: `light-data.ts`, new `lib/inventory/consumables.ts`, `use-add-item.ts`, `restock-data.ts`, `use-restock.ts`, `RestockSheet.tsx`, and the two new/extended tests
- [ ] No Lantern in `LIGHT_SOURCES`; no schema/`ActiveLightDoc`/`fix-inventory-names.ts` changes; ammo/weight math untouched
