# Structure Outline

## Approach

Six vertical slices, each crossing schema → data module → route → api wrapper → hook →
UI where relevant. Independent-value order: notes and reorder are self-contained new
fields (follow the `location` 7-stop chain); the `NumberField` primitive unblocks the
weight/decimal work; ammo weight and the label/count cleanup are data-shaped and land
last. Test command: `cd apps/web && pnpm test` (vitest), plus `pnpm typecheck && pnpm lint`
from repo root.

---

## Phase 1: Item notes (#68)

Editable `notes` on the PATCH path and shown/edited on the row. `notes` already exists on
the doc, mapper, and client type — only the update path and UI are missing.

**Files**: `lib/data/inventory.ts`, `app/api/characters/[id]/inventory/[itemId]/route.ts`,
`lib/api/inventory.ts`, `components/character-sheet/inventory/use-inventory.ts`,
`components/character-sheet/inventory/ItemRow.tsx`

**Key changes**:
- `updateInventoryEntry(characterId, itemId, patch: { quantity?; location?; notes?: string|null })` — extend patch (`inventory.ts:93,98-104`); trim, cap length, allow clearing to null.
- PATCH route: add `notes: body?.notes` to the forwarded allowlist (`[itemId]/route.ts:11`).
- `updateItemNotes(characterId, itemId, notes: string|null): Promise<void>` — new api wrapper (mirror `updateItemLocation`).
- `setItemNotes(id, notes)` — new hook fn, optimistic then await (`use-inventory.ts`).
- `ItemRow`: expandable notes affordance (collapsed by default), commit on blur.

**Verify**: `pnpm test` passes; manually add/edit a note, reload, note persists; clear note → empty.

---

## Phase 2: Manual reorder (#67)

`sortOrder` field + reorder operation; up/down buttons move an item within its location
section; `sortedEntries` sorts by location then `sortOrder`.

**Files**: `lib/cosmos/types.ts`, `lib/data/inventory.ts`,
`app/api/characters/[id]/inventory/[itemId]/route.ts`, `lib/api/inventory.ts`,
`use-inventory.ts`, `ItemRow.tsx`, `ItemList.tsx`, `scripts/lib/transform.ts` (migration passthrough)

**Key changes**:
- `InventoryEntryDoc.sortOrder?: number` — new optional field (`cosmos/types.ts:30-44`).
- `sortedEntries`: order by `LOCATION_ORDER` then `(a.sortOrder ?? Infinity)` then existing `itemType` fallback (`inventory.ts:33-40`).
- `addInventoryItem`: assign `sortOrder = max(existing in same location) + 1` on insert (`inventory.ts:62-88`).
- `reorderInventoryItem(characterId, itemId, direction: 'up'|'down')` in data module — swap `sortOrder` with the adjacent same-location entry; via PATCH body `{ move: 'up'|'down' }` (route allowlist + `updateInventoryEntry` branch, or a dedicated handler).
- `moveItem(characterId, itemId, direction): Promise<void>` — api wrapper.
- `reorderItem(item, direction)` — hook fn, optimistic reorder of local `items`.
- `ItemRow`: ▲/▼ buttons (disabled at section ends); `ItemList` passes handler + section-position info.

**Verify**: `pnpm test`; reorder items within Stowed, reload, order held; ▲ disabled on first row of a section; items in different locations don't interleave.

---

## Phase 3: Shared `NumberField` primitive (#66)

New reusable numeric input: blank-start, transient-empty allowed, optional decimals.
No behavior change to inventory yet — this phase is the primitive + its own test.

**Files**: `components/ui/NumberField.tsx` (new), `apps/web/src/test/__tests__/number-field.test.tsx` (new)

**Key changes**:
- `NumberField({ value: number|null, onCommit: (n: number|null) => void, allowDecimal?: boolean, min?: number, max?: number, ...aria })` — string draft internally (pattern from `ItemRow.tsx:22-32`); strips per `allowDecimal` (`[0-9.]` vs `[0-9]`); commits `parseFloat`/`parseInt` on blur/Enter; empty draft commits `null`.

**Verify**: `pnpm test` new unit test — blank start renders empty; typing then clearing commits null; `allowDecimal` accepts `2.5`, integer mode rejects `.`; min/max clamp on commit.

---

## Phase 4: Decimal weight + adopt NumberField (#66)

Make `weightCoins` a float end-to-end and migrate inventory add-form + row inputs to
`NumberField`; quantity starts blank, weight accepts decimals.

**Files**: `AddItemForm.tsx`, `ItemRow.tsx`, `use-add-item.ts`, `use-inventory.ts`,
`lib/data/inventory.ts` (clamp), display sites `ItemRow.tsx`, `WeightBar.tsx`, `lib/pdf/character-sheet.ts`

**Key changes**:
- `NewItemDraft.quantity/weight_coins`: `number | null` (blank support) (`use-add-item.ts:7`); submit defaults null→1 / 0.
- `AddItemForm`: qty/weight inputs → `NumberField` (`allowDecimal` on weight) (`AddItemForm.tsx:116-126`).
- `ItemRow` inline qty editor → `NumberField` (integer) (`ItemRow.tsx:53-63`).
- Server: keep `weightCoins: Math.max(0, Number||0)` (already float-safe, drop any `Math.floor`).
- Display rounding: `ItemRow.tsx:82` chip, `WeightBar.tsx:12-27`, PDF `character-sheet.ts:56,126-129` — round/format floats (e.g. `Math.round(x*100)/100`) so totals don't show long decimals.

**Verify**: `pnpm test`; add item weight `0.075`, persists and displays rounded; quantity field starts blank; WeightBar total sane with fractional weights; PDF export renders clean numbers.

---

## Phase 5: Ammo weight (#64)

Give ammo correct fractional per-unit weight and stop restock zeroing it. Depends on
Phase 4 (decimals must round-trip).

**Files**: `components/character-sheet/inventory/use-restock.ts`,
`components/character-sheet/inventory/restock-data.ts`, ammo catalog data (script/Cosmos)

**Key changes**:
- `RestockEntry.weightCoins: number` — add per-unit weight to `RESTOCK_ITEMS` (`restock-data.ts:2-19`) with the Dolmenwood per-unit fractions (source-of-truth number — placeholder until confirmed).
- `use-restock.ts:67-74`: insert with `weight_coins: entry.weightCoins` instead of hardcoded `0`.
- Catalog `catalog_items` ammo rows: correct fractional weight via the Phase 6 script (or a targeted update).

**Verify**: `pnpm test`; restock 1 bundle of Arrows (qty 20) → row weight = 20 × per-unit = intended quiver weight, not the old inflated total; WeightBar reflects it.

---

## Phase 6: Label/count normalization (display bug)

Strip trailing counts on catalog-add, and a one-time script to split baked names in
`catalog_items` and each character's embedded inventory.

**Files**: `components/character-sheet/inventory/use-add-item.ts`,
`lib/inventory/parse-count.ts` (new shared helper), `scripts/fix-inventory-names.ts` (new),
`apps/web/src/test/__tests__/parse-count.test.ts` (new)

**Key changes**:
- `parseCountSuffix(name: string): { name: string; quantity: number | null }` — strip trailing `(n)`, ` x n`, ` xN`, `× n`; return cleaned name + count, or null count when none/ambiguous (guard legit `(minor)`, `(per day)`).
- `selectCatalogItem` (`use-add-item.ts:57-71`): run `parseCountSuffix`, set `item_name` cleaned and `quantity` from parsed count when present.
- `scripts/fix-inventory-names.ts`: dry-run + apply; scan `catalog_items` and every character doc's `inventory`, split baked names, ETag-safe replace; print a report of changed rows. Mirror style of `scripts/seed-catalog.ts` / `scripts/lib/transform.ts`.

**Verify**: `pnpm test` unit tests for `parseCountSuffix` (splits `"Torches (3)"`→`{Torches,3}`; leaves `"Potion (minor)"`, `"Horse Feed (per day)"` untouched); catalog-pick "Torches (3)" → name "Torches", qty 3; script dry-run report lists expected rows without writing.

---

## Testing Checkpoints

- **After P1**: notes editable + persisted on rows; PATCH accepts notes.
- **After P2**: items reorder within a location and persist; `sortOrder` on doc; missing `sortOrder` still renders (backfill-safe).
- **After P3**: `NumberField` unit-tested in isolation; no inventory change yet.
- **After P4**: quantity blank-start, decimal weights round-trip and display rounded across row/bar/PDF.
- **After P5**: ammo carries realistic weight from both restock and catalog paths.
- **After P6**: catalog-add cleans baked counts; cleanup script (dry-run verified) splits existing data.

Each phase is independently valuable: if a later phase stalls, earlier phases stand alone
(notes, reorder, and the NumberField primitive don't depend on the ammo/label data work).
