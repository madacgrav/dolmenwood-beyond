# Design Discussion

Bundle of five inventory fixes: #64 ammo weight, #66 numeric inputs (blank + decimal),
#67 manual reorder, #68 item notes, and a label/count display bug. All touch the same
embedded-inventory feature under `apps/web/src/components/character-sheet/inventory/`.

## Current State

- Inventory is an embedded array on the character doc (`InventoryEntryDoc`,
  `lib/cosmos/types.ts:30-44`); every mutation is an ETag-guarded whole-doc
  read-modify-write (`lib/data/characters.ts:44-63`).
- **Weight** is strictly per-unit × quantity, computed at 4 sites: `ItemRow.tsx:82`,
  `WeightBar.tsx:12-15`, and `lib/pdf/character-sheet.ts:56,126-129`. `weightCoins` is
  integer everywhere (`Math.max(0, Number||0)` at `inventory.ts:73`, `parseInt` in forms).
  No flat/bundle-weight concept. Restock inserts ammo with `weight_coins: 0`
  (`use-restock.ts:67-74`), so weights are already inconsistent by entry path.
- **Numeric inputs**: 3 inconsistent patterns, all `parseInt` (no decimals), no shared
  primitive. `components/ui/` = Button/Card/HPBar only. Quantity/weight inputs bind to
  numeric state and can't go blank (`AddItemForm.tsx:116-126`).
- **Ordering**: derived at read time by `location` then `itemType.localeCompare`
  (`inventory.ts:33-40`), grouped into location sections client-side
  (`ItemList.tsx:18-38`). No persisted sort/position field.
- **Notes**: `notes` exists on the doc, create input, mapper, and client type — but is
  absent from the PATCH path (`updateInventoryEntry` accepts only `{quantity, location}`,
  `inventory.ts:90-106`) and never rendered by `ItemRow.tsx`.
- **Label/count**: every persisting code path keeps name and quantity separate. Baked
  counts ("Torches x 3") come from live catalog data or manual entry, not repo code
  (research Open Areas). Wizard gear lists bake counts but never persist
  (`Step8Equipment.tsx:8-26`).

## Desired End State

1. **#64** — Ammo encumbrance is realistic: ammo carries a small fractional per-unit
   `weightCoins`; a full quiver no longer over-weighs. Verify: 20 arrows show a sane
   total in the row chip and WeightBar, matching the intended per-quiver weight.
2. **#66** — Quantity/weight inputs start blank (not 0/1) and weight accepts decimals
   (e.g. `0.075`, pipeleaf). Verify: clearing a field leaves it empty; typing `2.5`
   persists `2.5`.
3. **#67** — Each item row has up/down controls that reorder it within its location
   section; order persists per character. Verify: reorder, reload, order held.
4. **#68** — Items have an editable `notes` field shown on the row. Verify: add/edit
   note, reload, note held.
5. **Display bug** — Catalog-add strips a trailing count into the quantity; a one-time
   script splits existing baked names in `catalog_items` and character inventory. Verify:
   picking "Torches (3)" yields name "Torches" + quantity 3; script report lists fixed rows.

## Patterns to Follow

- **7-stop new-field chain** (`location` is the fullest example): doc type
  (`cosmos/types.ts:37`) → client snake_case type (`lib/api/inventory.ts:18`) → data
  module mapper+create+update (`inventory.ts:23,54,99-104`) → route body allowlist
  (`[itemId]/route.ts:11`) → api wrapper (`updateItemLocation`, `inventory.ts:87-97`) →
  hook optimistic fn (`toggleLocation`, `use-inventory.ts:53-58`) → component prop
  (`ItemRow.tsx:87-95`). `sortOrder` and `notes` PATCH follow this exactly.
- **ETag mutate helper**: reuse `mutateOwnedCharacterDoc` (`lib/data/characters.ts:66`);
  never write the doc directly.
- **Optimistic update in hook** then await wrapper (`use-inventory.ts:65-69`).
- **DO NOT follow**: existing inputs that bind `value` to coerced numeric state (can't go
  blank) — the new `NumberField` uses the string-draft pattern already present in
  `ItemRow.tsx:22-32` / `SpendForm.tsx:67-74`. DO NOT reuse the dead `packages/types`
  `InventoryItem`/`weightOverride` — unused, wrong vocabulary.
- **DO NOT** wire new PATCH fields only in the data module — the route explicitly
  allowlists body fields (`[itemId]/route.ts:11`); forgetting it silently drops the field.

## Design Decisions

1. **Ammo weight = decimal per-unit** (chosen over flat-per-stack / zero). Keeps the
   per-unit × quantity model intact at all 4 multiply sites; only the stored value and
   its numeric type change. Set correct fractional `weightCoins` for ammo catalog items
   and fix restock's hardcoded `0` (`use-restock.ts:73`).
2. **`weightCoins` becomes a float** end-to-end. Relax integer clamps: server
   `Math.max(0, Number||0)` already tolerates floats; forms must switch `parseInt`→
   `parseFloat`; the 4 multiply sites already work on floats (JS number). Display rounds
   for presentation only.
3. **Shared `NumberField` primitive** in `components/ui/NumberField.tsx` (chosen over
   in-place fixes). String-draft internally: starts blank, allows empty transient state,
   `allowDecimal` prop, commits parsed number on blur/change. Migrate the inventory
   add-form + row quantity/weight inputs to it. (Addresses #66's shared-primitive intent
   from #60.) Other forms (CoinPurse/Bank/Spend) may migrate opportunistically but are
   not required.
4. **Reorder = up/down buttons within location** (chosen over drag / flat list). Add
   `sortOrder: number` to `InventoryEntryDoc`; new reorder operation on the PATCH path;
   `sortedEntries` sorts by `location` then `sortOrder` (replacing the `itemType`
   tiebreak). Up/down swap adjacent `sortOrder` within the same location; new items get
   `max+1`.
5. **Notes = editable, shown on row** (#68). Add `notes` to the PATCH allowlist +
   `updateItemNotes` wrapper + hook fn; render an editable notes affordance on `ItemRow`
   (collapsed/expandable to keep the row compact).
6. **Label/count = normalize on add + one-time script**. In `selectCatalogItem`
   (`use-add-item.ts:57-71`) strip a trailing `(n)` / `x n` / ` xN` suffix into
   `quantity`. Add a maintenance script (mirroring `scripts/seed-catalog.ts` /
   `scripts/lib/transform.ts` style) that scans `catalog_items` and each character's
   embedded inventory, splitting baked counts into name+quantity, with a dry-run report.

## What We're NOT Doing

- No drag-and-drop reorder; no removal of location grouping.
- No flat/bundle weight schema; no `weightOverride` revival.
- Not seeding starting inventory from the wizard (separate concern; creation stays
  `inventory: []`).
- Not migrating CoinPurse/Bank/Spend to `NumberField` as a requirement (optional).
- Not adding optimistic-rollback / `res.ok` checks broadly (pre-existing gap, out of scope).
- Not editing name/type/dice/AC via PATCH — only adding `sortOrder` and `notes` to it.

## Open Risks

- **Ammo weight values**: exact per-unit fractions depend on Dolmenwood printed rules
  (external). Need a source-of-truth number per ammo type; placeholder until confirmed.
- **Live catalog data**: baked-count names in `catalog_items` are unknown from the repo;
  the cleanup script must be run/observed against the real container, and the regex for
  count suffixes must not mangle legitimate names (e.g. "Potion (minor)"). Dry-run first.
- **Decimal display**: existing integer assumptions in PDF/WeightBar rendering may show
  long floats; need rounding at display sites (`ItemRow.tsx:82`, `WeightBar.tsx`, PDF).
- **`sortOrder` backfill**: existing entries have no `sortOrder`; `sortedEntries` must
  treat missing as a stable fallback (e.g. `?? large`) so un-backfilled docs still render.
