# Research Findings

## Q1: How is an inventory item's weight computed and displayed end to end?

### Findings
- `weightCoins` is stored **per-unit** on the embedded inventory entry (`apps/web/src/lib/cosmos/types.ts:35`), alongside `quantity` (`types.ts:34`). Entries are embedded in the character doc (`doc.inventory`).
- Read path is a pure rename: `entryToItem` maps `weight_coins: e.weightCoins`, `quantity: e.quantity` with no arithmetic (`apps/web/src/lib/data/inventory.ts:14-30`).
- Insert path stores what the client sends, unmodified: `addInventoryItem` clamps `quantity = Math.max(1, Number(input.quantity) || 1)` (`inventory.ts:75`) and `weightCoins = Math.max(0, Number(input.weight_coins) || 0)` (`inventory.ts:76`). **No code anywhere divides `weightCoins` by `quantity`.**
- Every display/sum multiplies per-unit × quantity:
  - Row chip: `r2(item.weight_coins * item.quantity)` (`apps/web/src/components/character-sheet/inventory/ItemRow.tsx:91`); hidden for `location === 'tiny'` (`ItemRow.tsx:89`).
  - Encumbrance bar: `.reduce` sums `weight_coins * quantity` over non-tiny items (`WeightBar.tsx:15-18`), plus `coinWeight`, fed to `calculateSpeed` against hardcoded `maxWeight = 800` (`WeightBar.tsx:19-23`).
  - PDF export: `Math.round(e.weightCoins * e.quantity * 100) / 100` per slot (`apps/web/src/lib/pdf/character-sheet.ts:57`); same reduce for Speed/Total Weight (`character-sheet.ts:129,168`).
  - Duplicate reduces on roster/view pages: `apps/web/src/app/(app)/characters/[id]/page.tsx:103` and `.../view/page.tsx:85`.
- Consequence (factual): if a stored entry has `weightCoins = 20` (a whole-bundle weight) and `quantity = 1`, every consumer displays 20; if the same entry has `quantity = 20`, it displays 400. The system's semantics assume `weightCoins` is per-unit; whether stored data honors that depends on the write path (see Q2).

## Q2: How are ammo items identified, seeded, and given `weightCoins`/`quantity` values?

### Findings
- **Runtime identification**: `AMMO_NAME_PATTERN = /arrow|quarrel|stone|bolt/i`; `listAmmo` filters `item_type === 'ammo' || AMMO_NAME_PATTERN.test(item_name)` (`apps/web/src/lib/api/inventory.ts:45-53`).
- **`equipment.json` values** (`packages/rules-engine/src/data/equipment.json:344-364`):
  - `"Arrows (quiver of 20)"` — weight **20** (whole quiver)
  - `"Quarrels (case of 20)"` — weight **20** (whole case)
  - `"Sling stones"` — weight **1** ("Per stone, free")
  - This file is **not wired to any runtime path**: only in-repo consumer is `scripts/backfill-armor-classification.ts:14`. The live `catalog_items` Cosmos container was populated by `scripts/seed-catalog.ts:41-49` copying from a legacy Postgres table whose contents aren't in the repo — so live catalog names/weights may carry the same bundle-style values.
- **Entry paths into inventory**:
  - (a) **Catalog picker** (`use-add-item.ts:59-75`): `weight_coins: cat.weight` copied **verbatim** from the catalog doc (`use-add-item.ts:67`); `quantity: parseCountSuffix(cat.name).quantity ?? 1` (`use-add-item.ts:62,66`). A name like `"Arrows (quiver of 20)"` does NOT match `parseCountSuffix` (parenthetical not purely digits), so quantity defaults to **1** while weight stays the bundle value (e.g. 20). This is the code path that produces "weight of 20 on a single item".
  - (b) **Restock** (`use-restock.ts:69-77`): new rows get per-unit `weight_coins: entry.weightCoins` from `restock-data.ts` (Arrow 0.1, Crossbow Quarrel 0.1, Sling Stone 0.2 — `restock-data.ts:12-14`, flagged provisional at line 10). Merge into an existing row updates **quantity only**; the existing row's `weightCoins` is left untouched (`use-restock.ts:61-67`).
  - (c) **Wizard Step8Equipment** (`apps/web/src/components/wizard/steps/Step8Equipment.tsx`): builds display-only strings (`Hunter: 'Arrows (20)'` at line 24); **never writes inventory** — no `insertInventoryItem` call in wizard code.
  - (d) **Manual custom add**: user-typed name and weight stored raw (`use-add-item.ts:77-98`, `AddItemForm.tsx:125-126`).
- `scripts/fix-inventory-names.ts` folds numeric name-suffixes into `quantity` (`newQty = qty * parsed.quantity`, line 54) but **never adjusts `weightCoins`** — an entry whose quantity got multiplied kept its old per-something weight.
- Value conflict: `equipment.json` implies 1.0 coin per arrow/quarrel (20/20) and 1.0 per sling stone; `restock-data.ts` uses 0.1/0.1/0.2.

## Q3: How is an item's display name produced?

### Findings
- `parseCountSuffix` regex: `/^(.*?)(?:\s*\((\d+)\)|\s+[x×]\s*(\d+))\s*$/i` (`apps/web/src/lib/inventory/parse-count.ts:9`). Strips only **purely numeric** suffixes: `"(3)"`, `"x3"`, `"x 3"`, `"×3"`. Does NOT match `"(quiver of 20)"`, `"(case of 20)"`, `"(1 week)"`, `"(per day)"` — those pass through untouched (doc comment `parse-count.ts:2-5`).
- `canonicalName` (`apps/web/src/lib/inventory/consumables.ts:14-21`): strips count suffix → lowercases → exact-match against `LIGHT_SOURCES` aliases (`light-data.ts:14-19`: Torch, Oil Flask, Candle, Firewood) then `EXTRA_CONSUMABLES` (`consumables.ts:6-11`):
  - `Arrow` ← `arrow, arrows`
  - `Crossbow Quarrel` ← `crossbow quarrel(s), quarrel(s)`
  - `Sling Stone` ← `sling stone(s)`
  - `Ration` ← `ration(s), preserved ration(s)`
  - Matching is exact string equality, not substring — so `"arrows (quiver of 20)"` is NOT in the alias list and returns unchanged.
- Normalization only runs at **catalog-picker selection**: `selectCatalogItem` sets `item_name: canonicalName(cat.name)` and `quantity: parseCountSuffix(cat.name).quantity ?? 1` (`use-add-item.ts:62-66`). Custom adds store the typed name raw (`use-add-item.ts:81`). No normalization at render time anywhere.
- Combat tab renders `item_name` **verbatim**: `listAmmo` passes names through unchanged (`lib/api/inventory.ts:48-53`); `AmmoSection.tsx:29-60` renders `🏹 {ammo.item_name}` directly.
- `ItemRow` renders `item.item_name` plus a separate `×{quantity}` badge (`ItemRow.tsx:87`).
- Tests confirm: `canonicalName('Arrows (20)') === 'Arrow'`, `canonicalName('Bag of marbles x 2') === 'Bag of marbles'` (`apps/web/src/test/__tests__/consumables.test.ts:35-55`).
- Net: any stored `item_name` like `"Arrows (quiver of 20)"` — from legacy data, the legacy-Postgres-seeded catalog, or manual entry — displays exactly as stored in both Inventory and Combat tabs. The one-time `scripts/fix-inventory-names.ts` cleanup only stripped numeric suffixes, not "quiver of/case of" phrasing.

## Q4: Full restock submission flow — merge vs insert, write gates

### Findings
- Trigger: "🛒 Restock" button in `InventoryTab.tsx:84-98`, `onClick={restock.openRestock}`; sheet mounted only when `restock.showRestock` (`InventoryTab.tsx:147`).
- `openRestock` resets `restockQtys = {}` and error/success flags (`use-restock.ts:31-36`). Quantities display as `restockQtys[entry.name] ?? 0` (`RestockSheet.tsx:79`) — start at 0.
- `handleRestock(forceConfirm)` (`use-restock.ts:45-95`):
  - Early return if `restockTotalSp() === 0` (silent).
  - Funds gate: `totalSp > totalSpOnHand(coins) && !forceConfirm` → `restockError = 'insufficient'`, no writes. "Proceed anyway" calls `handleRestock(true)` (`RestockSheet.tsx:183`).
  - Sequential `for...of` over static `RESTOCK_ITEMS`; skips `qty <= 0`.
  - Merge match: `items.find(i => canonicalName(i.item_name) === canonicalName(entry.name))` (`use-restock.ts:60-63`). Match → `updateItemQuantity` PATCH + local `setItems`. No match → `insertInventoryItem` POST; on success appends locally.
  - **`items` comes from the `useRestock` hook props captured from `InventoryTab` (`InventoryTab.tsx:30-37`).**
- **Error swallowing (factual)**:
  - `insertInventoryItem` returns `null` on any non-ok response, throws nothing (`lib/api/inventory.ts:63-74`). `handleRestock` only does `if (mapped) setItems(...)` — a failed insert silently skips the item, and coins are still deducted for it (total computed upfront).
  - `updateItemQuantity` returns `void`, never checks `response.ok` (`lib/api/inventory.ts:76-86`) — failed PATCH invisible.
  - `catch { setRestockError('error') }` reached only on thrown exceptions (network reject), not HTTP 4xx/5xx.
  - `saveCoins` return (error string or null) is unchecked (`use-inventory.ts:44-46`, `use-restock.ts:82`).
- Post-success: `deductSp` (clamps at 0 — `restock-data.ts:29-41`), `saveCoins`, `setCoins`, reset qtys, success banner, sheet auto-closes after 1500 ms (`use-restock.ts:80-90`). **No re-fetch of inventory or coins** — UI state relies entirely on the optimistic local `setItems`/`setCoins`.
- Server side: `POST` → `addInventoryItem` (quantity clamped ≥ 1, `data/inventory.ts:75`); `PATCH` → `updateInventoryEntry` (quantity clamped ≥ 0, `data/inventory.ts:104`; unknown id throws `notFound` → JSON error response the client wrapper ignores).

## Q5: UI entry point for restock/purchase

### Findings
- Sole entry: "🛒 Restock" button, `InventoryTab.tsx:85-96`, rendered only when `isOwner` (`InventoryTab.tsx:83`, `isOwner = !readOnly` at line 42). Never disabled; independent of coins/bank state.
- Inside `RestockSheet`, per-item rows have only steppers: `−` (disabled at 0), `+`, optional `+{pack}` quick-add (`RestockSheet.tsx:100-138`). **No per-item buy button.**
- Single global submit: `RestockSheet.tsx:211-229` — `onClick={() => handleRestock(false)}`, `disabled={restockLoading || restockTotalSp() === 0}`, label `Restock (<total>)` or `Restocking…`. Replaced by "✓ Restocked!" banner when `restockSuccess` (`RestockSheet.tsx:202-230`).
- "Proceed anyway" button appears only in the insufficient-funds banner (`RestockSheet.tsx:173-194`).

## Q6: Restock catalog vs main catalog; merge matching

### Findings
- `RESTOCK_ITEMS` is a self-contained, hand-authored 9-entry array (`restock-data.ts:11-21`); no reference to `catalog_items`/`equipment.json` from any restock file.
- Only cross-module link is `canonicalName` (`use-restock.ts:10`).
- Merge comparison: `canonicalName(i.item_name) === canonicalName(entry.name)` (`use-restock.ts:60-63`). Restock names `Arrow`/`Crossbow Quarrel`/`Sling Stone`/`Ration` canonicalize via `EXTRA_CONSUMABLES`; `Torch`/`Oil Flask` via `LIGHT_SOURCES`; `Waterskin Refill`, `Horse Feed (per day)`, `Dog Feed (per day)` have no aliases — matching for those falls back to exact count-stripped name equality. Note `(per day)` is a non-numeric parenthetical and is NOT stripped by `parseCountSuffix`.
- Because `canonicalName("Arrows (quiver of 20)")` returns the string unchanged (Q3), an existing legacy row named `"Arrows (quiver of 20)"` does **not** match a restock `"Arrow"` purchase — restock would insert a **second, separate** ammo row rather than merging.

## Cross-Cutting Observations
- Weight semantics are uniformly "per-unit × quantity" at every read site; correctness depends entirely on write-time data. The catalog-picker path (`use-add-item.ts:62-67`) is the one place where a bundle-named catalog item ("quiver of 20", weight 20) yields `quantity 1, weightCoins 20`.
- Name normalization is exact-match alias tables + numeric-suffix stripping only; "quiver of"/"case of" phrasing survives every normalization layer, including the one-time migration script.
- The client API wrappers (`insertInventoryItem`, `updateItemQuantity`, `saveCoins`) uniformly swallow HTTP errors; restock's only user-visible failure mode is thrown network exceptions.
- Two identical legacy-looking data risks coexist: bundle-weight rows (weight 20, qty 1) and bundle-name rows ("Arrows (quiver of 20)") — both come from data written before/outside the current normalization paths.
- `use-restock.ts` captures `items` from props; merge decisions are made against that snapshot.

## Open Areas
- Live contents of the Cosmos `catalog_items` container are unknown (seeded from a legacy Postgres table not in the repo, `scripts/seed-catalog.ts:41-49`) — the actual stored names/weights for ammo in the picker can't be confirmed from code alone.
- Whether the reported restock failure reproduces as an HTTP-level error (swallowed by the wrappers) or something else cannot be determined statically; the code paths that could silently no-op are documented in Q4.
- `restock-data.ts:10` comment flags per-item ammo prices/weights as provisional, unconfirmed against the Dolmenwood rulebook.
