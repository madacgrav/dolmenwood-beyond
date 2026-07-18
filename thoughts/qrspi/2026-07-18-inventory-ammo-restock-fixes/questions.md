# Research Questions

## Context
Focus on the character-sheet inventory subsystem under `apps/web/src/components/character-sheet/inventory/` and its supporting data/api layers (`apps/web/src/lib/data/inventory.ts`, `apps/web/src/lib/api/inventory.ts`, `apps/web/src/lib/inventory/`), the catalog seed data (`packages/rules-engine/src/data/equipment.json`), and the weight/encumbrance code (`WeightBar.tsx`, `packages/rules-engine/src/speed.ts`). Also cover the combat-side ammunition tracking under `apps/web/src/components/character-sheet/combat/`.

## Questions
1. Trace how an inventory item's weight is computed and displayed end to end — from the persisted `weightCoins` / `quantity` fields through `entryToItem`, `ItemRow`, and `WeightBar` — and how per-unit weight vs. total stack weight is handled for stackable items.

2. How are ammunition items (arrows, quarrels, sling stones) identified, seeded, and given their `weightCoins` and `quantity` values? Compare the values in `equipment.json`, `restock-data.ts`, and any catalog entries, and trace where each value originates when an item enters a character's inventory.

3. How is an item's display name produced? Trace `parseCountSuffix`, `canonicalName`, `EXTRA_CONSUMABLES`, and `selectCatalogItem` — which name patterns are stripped or normalized, and which forms (e.g. "quiver of 20", "case of 20", "x 20") pass through unchanged.

4. Trace the full restock submission flow: from the restock trigger button in `InventoryTab.tsx` through `useRestock` (`openRestock`, `handleRestock`) into `insertInventoryItem` / `updateItemQuantity` and the `/api/characters/[id]/inventory` routes. Where does an item get merged into an existing row versus inserted as new, and what conditions gate a successful write?

5. What is the current UI entry point for starting a restock/purchase, and how is it conditionally rendered? Identify the button(s), their visibility conditions, and any state (coins, bank balance, sheet open/closed) they depend on in `InventoryTab.tsx` and `RestockSheet.tsx`.

6. How does the restock catalog (`RESTOCK_ITEMS`, `RestockEntry`) relate to the main catalog (`catalog_items` / `equipment.json`) and to the alias/canonicalization tables — specifically how a restock entry's name is matched against existing inventory rows during merge?
