# Research Questions

## Context
Focus on the character inventory feature: the embedded inventory data model
(`lib/cosmos/types.ts`, `packages/types`), the server data module and API
routes under `app/api/characters/[id]/inventory/`, the browser `lib/api`
wrapper, and the inventory UI/hooks under
`components/character-sheet/inventory/` (add-item form, item row, list,
restock, weight bar). Also relevant: ammo tracking under
`components/character-sheet/combat/`, encumbrance/weight math, and any shared
form/input components under `components/ui/`.

## Questions

1. Trace an inventory item's full data model — every field on it in the Cosmos
   doc type, the shared `packages/types` type, the server data module, and the
   browser client type. Where do the shapes diverge, and which fields can be
   changed after an item is created (what does the update/PATCH path currently
   accept)?

2. How is per-item weight and total character encumbrance computed and
   displayed? Trace where an item's weight value is multiplied by its quantity,
   what `weightOverride` (if present) is for, and how the weight bar and any
   per-row weight chip derive their numbers.

3. By what paths does an item enter a character's inventory (custom add form,
   catalog picker, restock sheet, starting equipment, migration), and for each
   path, how are the item's name, quantity, and weight set at insert time? Do
   any paths set weight to zero or bundle multiple units into one quantity?

4. Where do inventory item *names* originate for each entry path, and how is a
   count represented relative to the name? Are there any cases where a
   multiplier or count is embedded in the name string itself rather than in the
   quantity field?

5. How do the inventory forms handle numeric input for quantity and weight —
   initial/default values, parsing (integer vs decimal), min/max, and empty
   state? Is there any shared numeric/field input component, and which forms use
   raw `<input type="number">` directly?

6. How is the inventory list ordered when rendered, and is there any per-item
   ordering or sort field persisted per character? How are inventory mutations
   persisted end to end (optimistic UI updates, API route, authz, ETag guard),
   and what is the established pattern for adding a new editable field or a new
   update operation?
