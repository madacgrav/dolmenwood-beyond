# Implementation Plan

## Overview

Five inventory fixes on the embedded-inventory feature: editable notes (#68), manual
reorder (#67), a shared blank-start/decimal `NumberField` (#66), decimal + realistic ammo
weight (#66/#64), and label/count normalization (display bug). Test command:
`cd apps/web && pnpm test` (vitest); repo root `pnpm typecheck && pnpm lint`.

Conventions to follow (from research): the 7-stop new-field chain using `location` as the
model; mutate only via `mutateOwnedCharacterDoc`; optimistic update in the hook then await;
route PATCH explicitly allowlists body fields.

---

## Phase 1: Item notes (#68)

`notes` already exists on `InventoryEntryDoc`, mapper, and client type. Add it to the
update path and the row UI.

### Changes

#### 1. Data module — accept notes in patch
**File**: `apps/web/src/lib/data/inventory.ts` **Action**: modify

```ts
// updateInventoryEntry signature (line 90-93)
patch: { quantity?: number; location?: ItemLocation; notes?: string | null },
// inside mutate closure, after the location block:
if (patch.notes !== undefined) {
  const n = patch.notes === null ? null : String(patch.notes).trim().slice(0, 500);
  entry.notes = n && n.length ? n : null;
}
```

#### 2. PATCH route — forward notes
**File**: `apps/web/src/app/api/characters/[id]/inventory/[itemId]/route.ts:11` **Action**: modify
```ts
await updateInventoryEntry(id, itemId, {
  quantity: body?.quantity, location: body?.location, notes: body?.notes,
});
```

#### 3. API wrapper
**File**: `apps/web/src/lib/api/inventory.ts` **Action**: add (mirror `updateItemLocation`)
```ts
export async function updateItemNotes(characterId: string, itemId: string, notes: string | null): Promise<void> {
  await fetch(`/api/characters/${characterId}/inventory/${itemId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes }),
  });
}
```

#### 4. Hook fn
**File**: `apps/web/src/components/character-sheet/inventory/use-inventory.ts` **Action**: add + export
```ts
async function setItemNotes(id: string, notes: string | null) {
  setItems(prev => prev.map(i => i.id === id ? { ...i, notes: notes ?? undefined } : i));
  await updateItemNotes(characterId, id, notes);
}
```
Add `updateItemNotes` to the import from `@/lib/api/inventory`; return `setItemNotes`.

#### 5. Row UI — expandable notes editor
**File**: `apps/web/src/components/character-sheet/inventory/ItemRow.tsx` **Action**: modify
- Add prop `onSetNotes: (id: string, notes: string | null) => void`.
- Add a 📝 toggle button (owner-only) next to delete; local `showNotes` state.
- When expanded, render a `<textarea>` below the row (full width) seeded from `item.notes ?? ''`, committing on blur via `onSetNotes(item.id, value.trim() || null)`.
- Show a small note indicator (e.g. filled 📝) when `item.notes` is set.
- Thread `onSetNotes` through `ItemList.tsx` (add to Props + pass to `ItemRow`) and `InventoryTab.tsx` (`onSetNotes={inv.setItemNotes}` on `<ItemList>`).

### Verification
#### Automated
- [x] `cd apps/web && pnpm test` passes
- [x] repo root `pnpm typecheck && pnpm lint` pass
#### Manual
- [ ] Add a note to an item, reload page → note persists and indicator shows
- [ ] Clear the note → saved as empty, indicator gone
- [ ] Referee (readOnly) view shows no notes editor

---

## Phase 2: Manual reorder (#67)

Add `sortOrder`, sort by it within a location, up/down buttons, and a `move` PATCH op.

### Changes

#### 1. Doc type
**File**: `apps/web/src/lib/cosmos/types.ts:30-44` **Action**: modify
```ts
/** Optional: absent on entries created before manual reordering. */
sortOrder?: number;
```

#### 2. Data module — sort, assign, move
**File**: `apps/web/src/lib/data/inventory.ts` **Action**: modify
```ts
// sortedEntries (line 33-40): replace itemType tiebreak with sortOrder
return [...(doc.inventory ?? [])].sort(
  (a, b) =>
    (LOCATION_ORDER[a.location] ?? 9) - (LOCATION_ORDER[b.location] ?? 9) ||
    (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER) ||
    a.itemType.localeCompare(b.itemType),
);
```
- `addInventoryItem`: move `sortOrder` assignment INTO the mutate callback so it can see siblings:
```ts
await mutateOwnedCharacterDoc(characterId, (doc) => {
  const sameLoc = (doc.inventory ?? []).filter(e => e.location === entry.location);
  entry.sortOrder = sameLoc.reduce((m, e) => Math.max(m, e.sortOrder ?? 0), 0) + 1;
  doc.inventory = [...(doc.inventory ?? []), entry];
});
```
  (Remove `sortOrder` from the static `entry` literal; add `sortOrder: 0` default there is unnecessary since it's set in the callback. `entryToItem` maps it through — see below.)
- Extend `updateInventoryEntry` patch with `move?: 'up' | 'down'`:
```ts
if (patch.move) {
  const list = (doc.inventory ?? [])
    .filter(e => e.location === entry.location)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  // backfill any missing sortOrder deterministically
  list.forEach((e, i) => { if (e.sortOrder == null) e.sortOrder = i; });
  const idx = list.findIndex(e => e.id === entry.id);
  const swapWith = patch.move === 'up' ? idx - 1 : idx + 1;
  if (swapWith >= 0 && swapWith < list.length) {
    const a = list[idx]!, b = list[swapWith]!;
    [a.sortOrder, b.sortOrder] = [b.sortOrder, a.sortOrder];
  }
}
```

#### 3. Client type + mapper
**File**: `apps/web/src/lib/api/inventory.ts:10-23` add `sort_order?: number;`
**File**: `apps/web/src/lib/data/inventory.ts:14-29` `entryToItem`: add `sort_order: e.sortOrder`.

#### 4. PATCH route — forward move
**File**: `.../[itemId]/route.ts:11` add `move: body?.move` to the patch object.

#### 5. API wrapper + hook
**File**: `apps/web/src/lib/api/inventory.ts` add:
```ts
export async function moveInventoryItem(characterId: string, itemId: string, move: 'up' | 'down'): Promise<void> {
  await fetch(`/api/characters/${characterId}/inventory/${itemId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ move }),
  });
}
```
**File**: `use-inventory.ts` add `moveItem(id, direction)`: optimistic swap of adjacent same-location items in `items` (recompute via a helper mirroring the server swap), then `await moveInventoryItem`. Simplest correct optimism: after the await, refetch is overkill — instead reorder local `items` by swapping the two adjacent same-location entries in array order.

#### 6. Row + list UI
**File**: `ItemRow.tsx` add props `onMove: (id, dir) => void`, `canMoveUp: boolean`, `canMoveDown: boolean`; render ▲/▼ buttons (owner-only), disabled per flags.
**File**: `ItemList.tsx` within each location's `locItems.map((item, i) => ...)`: pass `canMoveUp={i > 0}`, `canMoveDown={i < locItems.length - 1}`, `onMove={onMove}`. Add `onMove` to Props.
**File**: `InventoryTab.tsx` pass `onMove={inv.moveItem}` to `<ItemList>`.

#### 7. Migration passthrough
**File**: `scripts/lib/transform.ts:110-127` `toInventoryEntry`: no change required (`sortOrder` optional, absent → backfilled on first move). Leave as-is.

### Verification
#### Automated
- [x] `cd apps/web && pnpm test` passes; `pnpm typecheck && pnpm lint` pass
#### Manual
- [ ] Reorder two Stowed items with ▲/▼, reload → order held
- [ ] ▲ disabled on first row of a section, ▼ on last
- [ ] Items in different locations never interleave; add new item → appends to end of its section

---

## Phase 3: Shared `NumberField` primitive (#66)

Reusable numeric input: blank-start, transient empty, optional decimals. No inventory
wiring yet.

### Changes

#### 1. Component
**File**: `apps/web/src/components/ui/NumberField.tsx` **Action**: create
```tsx
'use client';
import { useEffect, useState, type CSSProperties } from 'react';

interface Props {
  value: number | null;
  onCommit: (n: number | null) => void;
  allowDecimal?: boolean;
  min?: number; max?: number;
  placeholder?: string; style?: CSSProperties; 'aria-label'?: string;
}

export function NumberField({ value, onCommit, allowDecimal = false, min, max, placeholder, style, ...aria }: Props) {
  const [draft, setDraft] = useState(value == null ? '' : String(value));
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (!editing) setDraft(value == null ? '' : String(value)); }, [value, editing]);

  const clean = (s: string) => allowDecimal
    ? s.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')  // one dot max
    : s.replace(/[^0-9]/g, '');

  function commit() {
    setEditing(false);
    if (draft.trim() === '') return onCommit(null);
    let n = allowDecimal ? parseFloat(draft) : parseInt(draft, 10);
    if (Number.isNaN(n)) return onCommit(null);
    if (min != null) n = Math.max(min, n);
    if (max != null) n = Math.min(max, n);
    onCommit(n);
  }

  return (
    <input
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      value={draft}
      placeholder={placeholder}
      onFocus={() => setEditing(true)}
      onChange={e => setDraft(clean(e.target.value))}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      style={style}
      {...aria}
    />
  );
}
```

#### 2. Unit test
**File**: `apps/web/src/test/__tests__/number-field.test.tsx` **Action**: create
- Renders empty when `value={null}`.
- Integer mode strips `.` and non-digits; decimal mode keeps one `.`.
- Clearing the field then blurring commits `null`.
- `min`/`max` clamp on commit; `allowDecimal` commits `2.5`.
(Use `@testing-library/react` if present; else a shallow render + fireEvent. Check existing test imports first — match the pattern used in a sibling `*.test.tsx`.)

### Verification
#### Automated
- [x] `cd apps/web && pnpm test` — new `NumberField` test passes (9 tests)
- [x] `pnpm typecheck` passes
#### Manual
- [ ] (deferred to Phase 4 where it's mounted)

Note: if no React testing lib exists in the repo, write the test as pure-function coverage
of an extracted `cleanNumeric`/`commitValue` helper instead, and keep the component thin.

---

## Phase 4: Decimal weight + adopt NumberField (#66)

`weightCoins` becomes a float; inventory qty/weight inputs use `NumberField`; quantity
starts blank.

### Changes

#### 1. Draft type allows blank
**File**: `apps/web/src/components/character-sheet/inventory/types.ts:37-47` **Action**: modify
```ts
quantity: number | null;
weight_coins: number | null;
```
**File**: `use-add-item.ts` `EMPTY_DRAFT` (line 6-10): `quantity: null, weight_coins: null`.
`addItem` payload (line 79-80): `quantity: newItem.quantity ?? 1, weight_coins: newItem.weight_coins ?? 0`.
`selectCatalogItem` (line 62-63): `quantity: 1, weight_coins: cat.weight` (unchanged; both non-null).

#### 2. Add-form inputs → NumberField
**File**: `AddItemForm.tsx:116-126` **Action**: modify
```tsx
<NumberField value={newItem.quantity} min={1}
  onCommit={n => setNewItem(p => ({ ...p, quantity: n }))}
  placeholder="1" aria-label="Quantity" style={/* existing input style */} />
<NumberField value={newItem.weight_coins} min={0} allowDecimal
  onCommit={n => setNewItem(p => ({ ...p, weight_coins: n }))}
  placeholder="0" aria-label="Weight in coins" style={/* existing input style */} />
```
Import `NumberField` from `@/components/ui/NumberField`.

#### 3. Row inline qty editor → NumberField
**File**: `ItemRow.tsx:52-63` **Action**: modify — replace the manual draft input with
`<NumberField value={item.quantity} min={0} onCommit={n => onSetQuantity(item.id, n ?? 0)} />`.
Keep the +/- step buttons as-is. Remove now-unused local `draft`/`editing`/`commitDraft` if
fully replaced (the display-only button that opens editing can be kept, wrapping NumberField).

#### 4. Server clamp tolerates float
**File**: `lib/data/inventory.ts:73` — already `Math.max(0, Number(input.weight_coins) || 0)`; confirm no `Math.floor`. `updateInventoryEntry` quantity clamp stays integer (`Math.max(0, Number||0)` — quantities remain whole). No change beyond confirming.

#### 5. Display rounding
Add a tiny formatter (inline, no new file): `const r2 = (n: number) => Math.round(n * 100) / 100;`
**File**: `ItemRow.tsx:84` → `{r2(item.weight_coins * item.quantity)}¢`
**File**: `WeightBar.tsx:27,45` → wrap `totalWeight` display and threshold comparisons stay numeric; format the shown `{r2(totalWeight)} / 800 coins`. (Keep `weightPct`/`speed` on raw values.)
**File**: `lib/pdf/character-sheet.ts:56` and `:126-129` → round the per-slot and total weight when writing to the PDF (`r2(...)`), so floats don't render long.

### Verification
#### Automated
- [x] `cd apps/web && pnpm test` passes (existing inventory/pdf tests still green)
- [x] `pnpm typecheck && pnpm lint` pass
#### Manual
- [ ] Add item with weight `0.075` → persists, row/bar show rounded (`0.08`/sane total)
- [ ] Quantity field in add-form starts blank; leaving blank saves as 1
- [ ] Clear row quantity to blank → commits 0 (existing danger-color behavior)
- [ ] Export PDF → weight column shows clean numbers

---

## Phase 5: Ammo weight (#64)

Give ammo realistic fractional per-unit weight; stop restock zeroing it.

### Changes

#### 1. Restock data — per-unit weight
**File**: `apps/web/src/components/character-sheet/inventory/restock-data.ts:2-19` **Action**: modify
```ts
export interface RestockEntry { name: string; unit: number; priceSp: number; category: string; weightCoins: number; }
// PLACEHOLDER per-unit weights (coins) — CONFIRM against Dolmenwood rulebook before merge:
{ name: 'Arrows',            unit: 20, priceSp: 1,    category: 'ammo', weightCoins: 0.1 },
{ name: 'Crossbow Quarrels', unit: 20, priceSp: 2,    category: 'ammo', weightCoins: 0.1 },
{ name: 'Sling Stones',      unit: 20, priceSp: 0.25, category: 'ammo', weightCoins: 0.2 },
// gear entries: set weightCoins to their catalog weight (or 0 where trivial)
```
(Give every entry a `weightCoins` since the field is required; use existing catalog weights for the gear rows — Oil Flask, Torch, etc.)

#### 2. Restock insert uses it
**File**: `use-restock.ts:67-74` **Action**: modify — `weight_coins: entry.weightCoins` (was hardcoded `0`).

#### 3. Catalog ammo weights
Catalog `catalog_items` ammo rows carry their own weight (used on catalog-add). Correct
values are data — handled by the Phase 6 cleanup script or a targeted Cosmos update; note in
the script's report. No repo code change here.

### Verification
#### Automated
- [x] `cd apps/web && pnpm test` passes
#### Manual
- [ ] Restock 1 bundle of Arrows (qty 20) → row weight = `20 × 0.1 = 2¢`, not inflated
- [ ] WeightBar total reflects the fractional ammo weight
- [ ] Confirm the placeholder per-unit numbers against the rulebook and adjust

---

## Phase 6: Label/count normalization (display bug)

Strip trailing counts on catalog-add; one-time script splits baked names in `catalog_items`
and character inventory.

### Changes

#### 1. Parse helper
**File**: `apps/web/src/lib/inventory/parse-count.ts` **Action**: create
```ts
/** Split a trailing count off an item name: "Torches (3)" → { name:'Torches', quantity:3 }.
 *  Returns quantity=null when no numeric count is present, so callers keep the original name. */
export function parseCountSuffix(raw: string): { name: string; quantity: number | null } {
  const s = raw.trim();
  // trailing "(3)", " x3", " x 3", " ×3", " ×12"
  const m = s.match(/^(.*?)[\s]*(?:\((\d+)\)|[x×]\s*(\d+))\s*$/i);
  if (!m) return { name: s, quantity: null };
  const n = parseInt(m[2] ?? m[3] ?? '', 10);
  if (!Number.isFinite(n) || n <= 0) return { name: s, quantity: null };
  const name = m[1].trim();
  return name ? { name, quantity: n } : { name: s, quantity: null };
}
```
(Regex only matches a purely-numeric parenthetical, so `"Potion (minor)"`, `"Horse Feed (per day)"` are left untouched.)

#### 2. Catalog-add uses it
**File**: `use-add-item.ts:57-71` `selectCatalogItem` **Action**: modify
```ts
const parsed = parseCountSuffix(cat.name);
setNewItem({
  item_name: parsed.name,
  quantity: parsed.quantity ?? 1,
  weight_coins: cat.weight,
  /* ...rest unchanged... */
});
```

#### 3. Cleanup script
**File**: `scripts/fix-inventory-names.ts` **Action**: create (mirror `scripts/seed-catalog.ts` style — raw `CosmosClient`, env `COSMOS_ENDPOINT`/`COSMOS_KEY`, `--apply` flag else dry-run)
- Query `catalog_items` (`SELECT * FROM c`): for each, `parseCountSuffix(name)`; if quantity !== null, log `name → parsed.name`; on `--apply`, upsert with cleaned `name` (catalog has no quantity field, so the count is dropped from the name only).
- Query `characters` container (`SELECT * FROM c`, cross-partition): for each doc, map `doc.inventory`; for entries where `parseCountSuffix(itemName).quantity !== null`, set `itemName = parsed.name` and `quantity = existing.quantity * parsed.quantity` (a row that said "Torches (3)" with quantity 1 becomes "Torches" quantity 3; if quantity was already >1, multiply). Log every change; on `--apply`, `container.item(doc.id, doc.ownerId).replace(doc)`.
- Print totals: `N catalog names, M inventory rows would change` (dry-run) / `changed` (apply).

#### 4. Parse unit test
**File**: `apps/web/src/test/__tests__/parse-count.test.ts` **Action**: create
```ts
parseCountSuffix('Torches (3)')        // { name:'Torches', quantity:3 }
parseCountSuffix('Bag of marbles x 2') // { name:'Bag of marbles', quantity:2 }
parseCountSuffix('Arrows ×20')         // { name:'Arrows', quantity:20 }
parseCountSuffix('Potion (minor)')     // { name:'Potion (minor)', quantity:null }
parseCountSuffix('Horse Feed (per day)') // unchanged, quantity:null
parseCountSuffix('Torch')              // { name:'Torch', quantity:null }
parseCountSuffix('(3)')                // name empty → { name:'(3)', quantity:null }
```

### Verification
#### Automated
- [ ] `cd apps/web && pnpm test` — `parse-count` test passes
- [ ] `pnpm typecheck && pnpm lint` pass
#### Manual
- [ ] Catalog-pick an item named "Torches (3)" → form shows name "Torches", qty 3
- [ ] `npx tsx scripts/fix-inventory-names.ts` (dry-run) prints the intended changes without writing
- [ ] Re-run with `--apply` against a test/dev container → baked names split; reload app → clean labels + correct counts

---

## Cross-phase final checks
- [ ] Repo root `pnpm typecheck && pnpm lint && pnpm test` all green
- [ ] `git diff` limited to inventory feature + new `ui/NumberField`, `lib/inventory/parse-count`, `scripts/fix-inventory-names`, and their tests
- [ ] No changes to CoinPurse/Bank/Spend (out of scope), no `weightOverride`/wizard-seed changes
