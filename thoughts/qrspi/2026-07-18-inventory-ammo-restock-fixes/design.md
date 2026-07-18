# Design Discussion

## Current State

1. **Ammo weight/quantity conflict** — catalog picker copies the catalog doc's `weight` verbatim as per-unit `weight_coins` (`use-add-item.ts:67`) and `parseCountSuffix` cannot parse non-numeric parentheticals like "(quiver of 20)" (`parse-count.ts:9`), so a bundle-named catalog item becomes `quantity 1, weightCoins 20`. Every read site computes `weight_coins × quantity` (`ItemRow.tsx:91`, `WeightBar.tsx:15-18`, `pdf/character-sheet.ts:57,129`), so the row shows the full bundle weight but only 1 consumable unit.
2. **Set-string labels** — names like "Arrows (quiver of 20)" survive every normalization layer (`canonicalName` is exact-alias-match only, `consumables.ts:14-21`) and render verbatim in Inventory (`ItemRow.tsx`) and Combat (`AmmoSection.tsx:29-60`).
3. **Restock silent failures** — `insertInventoryItem` returns `null` on HTTP error (`lib/api/inventory.ts:63-74`), `updateItemQuantity` never checks `response.ok` (`lib/api/inventory.ts:76-86`), `saveCoins` result unchecked (`use-inventory.ts:44-46`). Coins are deducted for the full cart even when item writes fail (`use-restock.ts:80-83`). Merges can also target an unrecognized legacy bundle-named row (canonical mismatch → separate row) making purchases look like no-ops.
4. **Restock button** — exists (`InventoryTab.tsx:84-98`) but only when `isOwner = !readOnly`. User reports not seeing it; needs live investigation (Q5 answer: option A).
5. **Starting inventory never persisted** — `Step8Equipment.tsx` keeps rolled items in local `useState` only (line 35); `wizard-store` has no equipment field; `complete/page.tsx:20-33` calls `createCharacter` without inventory. Rolled equipment vanishes.

## Desired End State

- Adding "Arrows (quiver of 20)" from the catalog yields an inventory row: name **Arrow**, quantity **20**, weight_coins **1** (total 20¢ displayed). Same for quarrels/cases and other "N-bundle" names.
- Existing character rows and catalog docs with bundle names/weights are migrated to per-unit form (one-time script).
- Restock submit surfaces failures visibly, never deducts coins for items that failed to write, and merges into the (now-canonical) ammo rows.
- Restock button confirmed visible for owners; if the live investigation finds a rendering/visibility bug, fix it.
- Completing the auto wizard writes the rolled starting equipment into the new character's inventory with canonical names, parsed quantities, and catalog-derived weights.

Verification: unit tests for the new parse patterns + migration transform; manual run: add catalog ammo, restock arrows into an existing "Arrows (quiver of 20)" character, complete a Hunter wizard run, check inventory rows.

## Patterns to Follow

- **Server-tier pattern** (memory + repo convention): data module + route + `lib/api` wrapper; browser never touches Cosmos. All writes stay behind `/api/characters/[id]/inventory` (`route.ts:16-24`).
- **Count parsing**: extend `parseCountSuffix` (`parse-count.ts:7-16`) — it is the single shared choke point already used by `canonicalName`, the catalog picker, and the migration script. One fix propagates everywhere.
- **Migration script pattern**: `scripts/fix-inventory-names.ts` (dry-run default, `--apply` flag, ETag-safe doc mutation) — model the new migration on it. Note it deliberately did NOT touch `weightCoins`; the new script must.
- **Alias canonicalization**: `EXTRA_CONSUMABLES` (`consumables.ts:6-11`) for singular display names.
- **Anti-pattern to avoid**: swallowing HTTP errors in `lib/api` wrappers (`insertInventoryItem`, `updateItemQuantity`). Do not replicate; fix.
- **Anti-pattern to avoid**: render-time name cleanup. Fix data at write time + migration, render stays dumb.

## Design Decisions

1. **Per-unit ammo weight = 1 coin** (arrow, quarrel, sling stone) — derived from rulebook bundle weights in `equipment.json:344-364` (quiver of 20 = 20 coins). Update `restock-data.ts` provisional 0.1/0.1/0.2 values to 1 and align `priceSp` only if rulebook says so (prices stay as-is otherwise).
2. **Fix at write time + migrate** (user chose A). Extend `parseCountSuffix` to also match "(quiver of N)", "(case of N)", "(bundle of N)", "(bag of N)" → returns quantity N. Catalog picker then divides: `weight_coins = cat.weight / parsedQuantity` when a count was parsed (bundle weight → per-unit). New one-time script migrates existing character rows and `catalog_items` docs: split name → canonical singular, multiply quantity, divide weight.
3. **Restock robustness**: `insertInventoryItem`/`updateItemQuantity` check `response.ok` and throw (or return typed error); `handleRestock` accumulates per-item success, deducts SP **only for items that actually wrote**, and shows the existing `restockError` state on partial/total failure. Keep optimistic local state update; no full re-fetch (lazy, existing pattern).
4. **Restock button**: investigate live during implement phase (user chose A). No speculative UI change until observed.
5. **Starting equipment persistence**: add `equipment: string[]` (+ `startingGold: number`) to `wizard-store`; Step8 writes rolled items (and buy-mode gold) to the store; `complete/page.tsx` after successful `createCharacter` inserts each item via existing `insertInventoryItem`, using `canonicalName` + `parseCountSuffix` for name/quantity and a catalog lookup (`/api/catalog`, match by canonical name) for weight/type — fallback `weight 0, type 'gear'`. Buy-mode gold lands in coins via existing coins save.

## What We're NOT Doing

- No unification of `RESTOCK_ITEMS` with the main catalog — stays a hand-authored array.
- No market/shop feature for buy-mode wizard gold (gold just becomes starting coins).
- No re-fetch-after-write architecture change; optimistic updates stay.
- No changes to encumbrance math, speed bands, or the 800-coin cap.
- No manual-wizard (`/characters/new/manual`) equipment work unless it shares Step8 (check during implement).
- No renaming of non-ammo legacy items beyond what the parse patterns cover.

## Open Risks

- Live `catalog_items` contents unknown (seeded from legacy Postgres). The migration must be driven by observed data — dry-run output reviewed before `--apply`. Bundle-name patterns beyond "quiver/case of N" may exist.
- "Restock adds nothing" root cause is inferred, not reproduced. If live repro shows a different failure (e.g., auth, ETag conflict), scope may shift.
- Dividing weight by parsed count assumes catalog `weight` is bundle weight whenever the name carries a bundle count — could mis-divide an item whose weight is already per-unit despite a bundle name. Dry-run review mitigates.
- `AMMO_NAME_PATTERN /arrow|quarrel|stone|bolt/i` substring-matches things like "Whetstone" — pre-existing quirk, unchanged by this work, but migration renames could shift what appears in the Combat ammo list.
