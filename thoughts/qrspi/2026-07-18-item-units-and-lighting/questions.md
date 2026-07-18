# Research Questions

## Context
Focus on the character inventory feature in `apps/web/src`: the restock flow
(`components/character-sheet/inventory/RestockSheet.tsx`, `use-restock.ts`,
`restock-data.ts`), the light/fire tracking stack (`LightTracker.tsx`,
`lib/light-data.ts`, `lib/api/light.ts`, `lib/data/light.ts`, the
`/api/characters/[id]/light` route), item-name parsing (`lib/inventory/parse-count.ts`
and its tests, `scripts/fix-inventory-names.ts`), the add-item/catalog flow
(`use-add-item.ts`), and the ammo view in `components/character-sheet/combat/`.
Recent work on this branch touched several of these files — read them as they are now.

## Questions

1. Trace the restock purchase flow end to end: what does one "+" press on a restock
   row represent, how does `unit` convert a buy-count into an inventory quantity, how
   is the price applied per press, and how does the UI communicate the bundle size?
   Which restock entries have `unit > 1` and what item names do they insert or merge
   into?

2. By which exact string comparisons are inventory item names matched across features —
   restock's merge-into-existing-row lookup, the light tracker's `lightSourceFor`
   registry lookup, and the ammo list's name-pattern filter? For each, what happens
   when the inventory name is plural ("Torches"), differently cased, or has a suffix —
   which matches succeed and which fail?

3. What names and count conventions exist in the data sources that feed inventory —
   the restock catalog entries, the `LIGHT_SOURCES` registry, test fixtures, and any
   name lists in the repo? Where do singular vs plural forms of the same item (Torch /
   Torches, Arrow / Arrows) appear, and is there any normalization between them?

4. How does `parseCountSuffix` currently behave for set-style names — which suffix
   patterns does it recognize, which does it not (e.g. "Nails (dozen)", plural names
   without a number, "Rations (7 days)"), and where is it invoked (which entry paths
   and scripts call it, and which do not)?

5. Trace the full light/fire lifecycle: how an inventory item becomes "lightable" in
   `LightTracker`, what `lightSource` does server-side to inventory quantity and
   `activeLights`, what data `ActiveLightDoc` carries, and how burn-down/extinguish
   mutate it. What determines the burn duration, and what happens if the item name is
   not in the registry at each of these layers?

6. Where else in the app are item quantities interpreted with per-item semantics
   (ammo tracking decrement, light consumption, quantity-spend, encumbrance weight ×
   quantity), and would any of these read differently if a row's quantity counted
   "sets" rather than individual items? List each consumer of `quantity` with its
   file:line.
