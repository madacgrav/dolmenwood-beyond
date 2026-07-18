# Research Findings

## Q1: Full inventory data model across layers; what can change after create?

### Findings — the four shapes

**Cosmos doc** — `InventoryEntryDoc` (`apps/web/src/lib/cosmos/types.ts:30-44`), embedded array `CharacterDoc.inventory?` (`types.ts:161`):
`id, itemName, itemType, quantity, weightCoins, notes (string|null), location ('equipped'|'stowed'|'tiny'), weaponDamageDice (string|null), armorAcBonus (number|null), isShield?, armorBulk?, catalogItemId (string|null)`.
No sort-order/position field. Inventory is embedded in the character document (pk `/ownerId`) — no separate container.

**Shared package type** — `InventoryItem` (`packages/types/src/index.ts:141-158`): `ownerType, ownerId, name, weight, weightOverride?, isConsumable, weaponAttackBonus?, isFromCatalog`, etc. **Never imported anywhere in `apps/web/src`** — dead vocabulary; the feature does not use it. `ItemLocation` in `lib/api/inventory.ts:8` is a hand-redeclared union, not the package's `WeightLocation`.

**Browser client type** — `InventoryItem` (`apps/web/src/lib/api/inventory.ts:10-23`), snake_case (Supabase-era shape, per doc comment lines 2-4): `id, character_id, item_name, item_type, quantity, weight_coins, notes?, location, weapon_damage_dice?, armor_ac_bonus?, is_shield?, armor_bulk?`. No `catalog_item_id`.

**Server data module** (`apps/web/src/lib/data/inventory.ts`):
- Mapper `entryToItem` (14-29): camelCase→snake_case 1:1, injects `character_id` (17), maps `notes` null→undefined (22), **drops `catalogItemId`** (never surfaced to client).
- Create input `NewInventoryEntryInput` (48-60): full field set incl. `notes`, `catalog_item_id`.
- Update input (93): `{ quantity?: number; location?: ItemLocation }` — **only two fields**.

### Findings — PATCH path (what is mutable)
- Client wrappers: only `updateItemQuantity` (`lib/api/inventory.ts:75-85`, body `{quantity}`) and `updateItemLocation` (87-97, body `{location}`). Neither checks `res.ok`.
- Route `app/api/characters/[id]/inventory/[itemId]/route.ts:7-16` (PATCH): forwards only `{ quantity: body?.quantity, location: body?.location }`; all other body fields silently ignored.
- Data module `updateInventoryEntry` (`lib/data/inventory.ts:90-106`): clamps quantity `Math.max(0, Number||0)` (98), whitelists location (99-104) else `badRequest`.
- Everything else (`itemName`, `weightCoins`, `notes`, dice, AC, etc.) is create-only; changing it requires delete + re-add.

## Q2: Weight and encumbrance computation

### Findings
- Per-row chip: `ItemRow.tsx:82-86` renders `{item.weight_coins * item.quantity}¢`, hidden for `location === 'tiny'`.
- Encumbrance bar: `WeightBar.tsx:12-15` — `itemWeight = Σ (tiny ? 0 : weight_coins * quantity)`; `:16` `totalWeight = itemWeight + coinWeight`; `:17` `speed = calculateSpeed(totalWeight)` (`packages/rules-engine/src/speed.ts:1-6`, step fn ≤400→40, ≤600→30, ≤800→20, else 10); `:19-20` bar max 800; `:44-48` threshold labels 400/600/800.
- Coin weight: `InventoryTab.tsx:44-45` — `coinWeight = rules.coinWeightEnabled ? calculateCoinWeight(inv.coins) : 0`; `calculateCoinWeight` (`speed.ts:9-11`) = `gp + sp + cp` (1 coin = 1 coin-weight), gated by optional campaign rule. Passed to WeightBar at `InventoryTab.tsx:60`.
- PDF export duplicates the multiply: `lib/pdf/character-sheet.ts:56` (`e.weightCoins * e.quantity` per slot) and `:126-129` (speed calc mirroring WeightBar, deliberately without coin weight per comment 123-125).
- `weightOverride`: declared only at `packages/types/src/index.ts:147-148`; grep shows **zero readers/writers anywhere** — dead field on an unused type. Cosmos doc and client type have no override concept.
- Units: everything in "coins" (¢), Dolmenwood abstract unit; no conversions anywhere. Weight-per-unit is stored per item; total is always per-unit × quantity — there is no per-bundle/flat-weight representation in the model.

## Q3: Entry paths and how name/quantity/weight are set at insert

### Findings
**Common server sink** — `addInventoryItem` (`lib/data/inventory.ts:62-88`): name trimmed + required (66-67); `quantity: Math.max(1, Number||1)` (72); `weightCoins: Math.max(0, Number||0)` (73); via `POST /api/characters/[id]/inventory` (`route.ts:16-24`).

1. **Custom add form** (`AddItemForm.tsx` + `use-add-item.ts:73-94`): name free-text trimmed (77); quantity clamped `Math.max(1, parseInt||1)` (`AddItemForm.tsx:117`); weight clamped `Math.max(0, parseInt||0)` (`:124`), integer only. No multiplier.
2. **Catalog picker** (`use-add-item.ts:57-71`): fetches `/api/catalog` (32) → `listCatalogItems` (`lib/data/catalog.ts:5-10`, `SELECT * FROM c ORDER BY c.name` on `catalog_items` container, `cosmos/types.ts:271-288`). `selectCatalogItem` prefills draft: `name`→`item_name` (60), `weight`→`weight_coins` (63), `quantity: 1` unconditional (62), then flips back to custom mode (70) — persists through the same `addItem()` path. `catalog_item_id` is **not** included in the POST payload (75-87), so `catalogItemId` persists as null even for catalog adds.
3. **Restock** (`use-restock.ts:44-93`, `restock-data.ts:9-19`): `totalQty = qty * entry.unit` (58; Arrows/Quarrels/Sling Stones unit=20, rest unit=1). Case-insensitive name match to existing row (59-61): merge = quantity PATCH (63-65); else insert with `item_name: entry.name`, `weight_coins: 0` **hardcoded** (67-74), location stowed.
4. **Wizard / character creation** (`components/wizard/steps/Step8Equipment.tsx`): rolled equipment (41-60) and buy-mode gold (62-66) live only in component state, rendered as checklist (124-136). No inventory API call; `wizard-store.ts` has no equipment field. `newCharacterToDoc` (`lib/data/mappers/character.ts:99-139`) always sets `inventory: []` (128). **Creation seeds no inventory** — starting gear must be added by hand on the sheet.
5. **Migration** (`scripts/lib/transform.ts:110-127` `toInventoryEntry`, from `scripts/migrate-supabase-to-cosmos.ts:86,97`): passthrough of `item_name`/`quantity`/`weight_coins`; location validated defaulting stowed; legacy `inventory_items` table explicitly not migrated (`migrate-supabase-to-cosmos.ts:101,106-110`).

## Q4: Name origins; counts embedded in name strings?

### Findings
- `RESTOCK_ITEMS` (`restock-data.ts:9-19`): clean noun names ('Arrows', 'Torch', …); count lives in separate `unit` field. No baked counts.
- **Wizard lists bake counts into labels**: `ADVENTURE_GEAR` (`Step8Equipment.tsx:8-13`) — `'Torches (6)'`, `'Iron Spikes (12)'`, `'Chalk (3)'`, `'Candles (6)'`, `'Nails (dozen)'`; `CLASS_STARTING_ITEMS.Hunter` (24) — `'Arrows (20)'`. Data structure is `string[]` — no quantity field exists. But per Q3, these strings are display-only and never persisted.
- Catalog names: live data in the Cosmos `catalog_items` container, seeded from Supabase by `scripts/seed-catalog.ts:45-72`; no seed `.sql`/static data in repo, so catalog names **cannot be inspected via code search**. Mapping code treats `name` and `weight` as separate fields, no count concatenation.
- Test fixtures: clean names, separate quantity.
- Conclusion: every persisting code path keeps label and count separate. If persisted rows exist with counts in names (e.g. "Torches x 3"), the string came from data — the live catalog container or a user's manual typing — not from repo code.

## Q5: Numeric input handling

### Findings — three coexisting patterns
1. **`type="number"` bound to numeric state, coerced every keystroke** — can never be blank:
   - AddItemForm quantity (`AddItemForm.tsx:116-119`): `min={1}`, `parseInt`, empty→1, initial `EMPTY_DRAFT.quantity = 1` (`use-add-item.ts:7`).
   - AddItemForm weight (`:123-126`): `min={0}`, `parseInt` (**no decimals**), empty→0, initial 0.
   - CoinPurse (`CoinPurse.tsx:20-27`): bound to `coins[coin]`, raw string forwarded to `handleCoinChange` (`use-inventory.ts:46-51`, `Math.max(0, parseInt||0)`).
2. **String draft + `inputMode="numeric" pattern="[0-9]*"`, digit-strip on change, parse at commit** — blank allowed while editing:
   - ItemRow inline qty editor (`ItemRow.tsx:22-32,53-63`): string draft, `replace(/[^0-9]/g,'')`, commit `parseInt(draft) || 0` on blur/Enter; resync effect (25-27). +/- buttons bypass draft (46-51, 73-77).
   - SpendForm (`SpendForm.tsx:17,67-74,23-24`): initial `''`, digit-strip, `parseInt` at submit with explicit error.
3. **`type="number"` bound to raw string, parse only at submit** — blank naturally supported:
   - AddItemForm AC bonus (`:141-144`, `NewItemDraft.armor_ac_bonus: string`, initial `''`, `placeholder="12"`; parsed at `use-add-item.ts:84-85`).
   - BankPanel deposit (`BankPanel.tsx:17,87-93,23-25`): initial `''`, `min={1} max={coinsGp}`, `parseInt` + validation at submit, reset to `''` (41, 67).

- Final quantity sink: `setItemQuantity` (`use-inventory.ts:65-69`) `Math.max(0, Math.floor(q) || 0)` — integer, min 0, no max, optimistic update before await.
- **No `parseFloat` anywhere** in inventory forms — all integer.
- **No shared input primitive exists**: `components/ui/` = Button, Card, HPBar only. `SessionFormField`/`ProposalFormField` in campaign/schedule are string-literal union types, not components. All inventory numeric inputs are raw inline-styled `<input>` elements.

## Q6: List ordering and mutation pattern

### Findings — ordering
- Server: `sortedEntries` (`lib/data/inventory.ts:33-40`) sorts by `LOCATION_ORDER` `{equipped:0, stowed:1, tiny:2}` (31), tiebreak `itemType.localeCompare`. Derived at read time; **no persisted sort/position field** on `InventoryEntryDoc`.
- Client: `ItemList.tsx:18-38` groups by location sections `['equipped','stowed','tiny']`, filter preserves server order within each. `use-inventory.ts` mutations use `.map`/`.filter` — order-stable, no client sort.

### Findings — mutation chain (quantity as reference thread)
1. `ItemRow.tsx:65-77` UI → 2. `use-inventory.ts:65-69` optimistic `setItems` then await (no rollback; response not checked) → 3. `lib/api/inventory.ts:75-85` fetch PATCH → 4. route `[itemId]/route.ts:7-16` explicit body-field allowlist → 5. `updateInventoryEntry` (`lib/data/inventory.ts:90-106`) → 6. `mutateOwnedCharacterDoc` (`lib/data/characters.ts:66-72`) → 7. `mutateCharacterDoc` (44-63): owner-asserted read, in-memory mutate, `updatedAt` stamp, ETag-conditioned `replace` (`IfMatch: doc._etag`), retry ≤3 on 412.
- Authz: `assertCharacterOwner` (`lib/authz.ts:114-133`) — 1-RU point read in caller's partition, fallback cross-partition query, 404/403. Sole check on the path.

### Findings — pattern for a new editable field (7 stops, `location` as fullest example)
1. Field on `InventoryEntryDoc` (`cosmos/types.ts:37`) → 2. snake_case mirror on client type (`lib/api/inventory.ts:18`) → 3. data module: `entryToItem` read-map (23), create-input + validation/default (`inventory.ts:54,75-77`), update-patch + validation (93, 99-104) → 4. route explicit body forward (`[itemId]/route.ts:11`) → 5. dedicated api wrapper (`updateItemLocation`, 87-97) → 6. hook optimistic fn (`toggleLocation`, `use-inventory.ts:53-58`) → 7. component prop (`ItemRow.tsx:87-95`, threaded via `ItemList.tsx:9,30`).

## Cross-Cutting Observations

- Inventory is an embedded array on the character doc; every mutation is a whole-doc ETag-guarded read-modify-write with retry. Adding fields = additive schema change, no migration needed (optional fields tolerated, cf. `isShield?` backfill note at `cosmos/types.ts` comment).
- `notes` exists end-to-end on the create path (doc → create input → mapper → client type) but is absent from the PATCH path and never rendered by `ItemRow.tsx`.
- Weight model is strictly per-unit × quantity; nothing represents flat/bundle weight. Two independent multiply sites (ItemRow, WeightBar) plus two in PDF export.
- Restock's zero-weight inserts and the catalog's per-unit weights mean identical item names can carry different `weightCoins` depending on entry path; restock merge (name match) keeps the *existing* row's weight.
- The route layer's explicit body-field allowlist means adding a PATCH-able field requires touching the route, not just the data module.
- No optimistic-update rollback anywhere in inventory hooks; API wrappers don't check `res.ok`.

## Open Areas

- **Live catalog data not inspectable**: `catalog_items` names/weights (e.g. whether entries like "Torches x 3" or "Bag of marbles" exist with baked-in counts) live only in Cosmos; repo has no seed data. Verifying requires querying the container or the app UI.
- Ammo per-bundle weights per Dolmenwood printed rules are external to the codebase; the model has no field to express them.
- Existing characters' persisted rows (weights/names created before any fix) are data, not code — extent of inconsistency unknown from repo alone.
