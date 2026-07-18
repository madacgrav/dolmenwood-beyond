# Research Findings

All paths under `apps/web/src/` unless noted.

## Q1: Restock purchase flow end to end

### Findings
- One "+" press increments a per-entry *purchase count* (`restockQtys[entry.name]`), not inventory quantity (`RestockSheet.tsx:118-127`, state at `use-restock.ts:25`); "−" mirrors clamped at 0 (`RestockSheet.tsx:100-111`).
- Conversion: `totalQty = qty * entry.unit` (`use-restock.ts:58`). Price is per press/bundle: `subtotal = qty * entry.priceSp` (`RestockSheet.tsx:80`), grand total `restockTotalSp()` (`use-restock.ts:37-42`); insufficient-funds guard + `forceConfirm` override (`use-restock.ts:48-51`), deduction in CP via `deductSp` (`restock-data.ts:29-41`).
- Bundle size shown only via the label `×{entry.unit} per purchase` (`RestockSheet.tsx:94`).
- `unit > 1` entries (`restock-data.ts:12-14`): Arrows (20), Crossbow Quarrels (20), Sling Stones (20) — all `category: 'ammo'`, inserted as `item_type: 'ammo'` (`use-restock.ts:70`). All other entries `unit: 1`.
- Merge-vs-insert (`use-restock.ts:55-77`): case-insensitive exact name match against current items; on match `newQty = existing.quantity + totalQty` via `updateItemQuantity`; else `insertInventoryItem` with `item_name: entry.name` verbatim, `quantity: totalQty`, `weight_coins: entry.weightCoins` (per-unit, unmultiplied), `location: 'stowed'` hardcoded. Sequential awaits per entry.

## Q2: Name-match sites and their failure modes

### Findings
- **Restock merge** (`use-restock.ts:59-61`): case-insensitive exact-equals. Case differences succeed; plural fails (`'Torches'` row vs `'Torch'` entry → no merge, second row created); suffixed names (`'Torches (3)'`) fail.
- **Light registry** `lightSourceFor` (`light-data.ts:18-20`): case-insensitive exact-equals against 4 literals (Torch, Oil Flask, Candle, Firewood — `light-data.ts:11-14`). Called client-side in the `lightable` filter (`LightTracker.tsx:36`) and icon display (`:45,121`), and server-side as the authoritative gate (`lib/data/light.ts:27-28`, `badRequest('not a light source')`). Plural/suffixed names fail at every call site → no Light button client-side; 400 server-side.
- **Ammo filter** (`lib/api/inventory.ts:45-51`): `item_type === 'ammo'` OR unanchored case-insensitive regex `/arrow|quarrel|stone|bolt/i` on the name. Only match site plural-safe by construction ('Arrow', 'Arrows', 'Arrows (20)' all pass). Consumed by `use-ammo-tracking.ts:16`.
- **Missile-weapon detection** (`combat/AttackSection.tsx:48`): substring regex `/bow|crossbow|sling|throwing/` on equipped-weapon names — same substring shape, plural/suffix tolerant.
- `parseCountSuffix` is a suffix-stripper, not a comparator; never invoked by any of the matchers above.

## Q3: Name/count conventions in data sources

### Findings
- `RESTOCK_ITEMS` (`restock-data.ts:11-21`): bare labels, count lives in `unit` field. Ammo names plural ('Arrows', 'Crossbow Quarrels', 'Sling Stones'); gear/light singular ('Torch', 'Oil Flask'). 'Horse/Dog Feed (per day)' have non-numeric parentheticals.
- `LIGHT_SOURCES` (`light-data.ts:10-15`): all singular, bare.
- Test fixtures: singular clean names only (`light.test.ts:28,42,57,61,69` — 'Torch', 'Oil Flask', 'Rope'); `parse-count.test.ts:6` shows the parser preserves plurality ('Torches (3)' → name 'Torches', **not** 'Torch').
- Wizard display lists (`Step8Equipment.tsx:8-26`): plural + baked counts ('Torches (6)', 'Arrows (20)') — display-only, never persisted.
- **`packages/rules-engine/src/data/equipment.json`** (not imported by inventory code): light section 453-491 has 'Candles (10)', 'Oil (flask)', 'Torches (3)'; campingAndTravel 507 'Firewood (bundle, 8 hours)'; weapons 346/352 'Arrows (quiver of 20)', 'Quarrels (case of 20)'. Same source lineage as the Cosmos catalog (seeded from Supabase `catalog_items` via `scripts/seed-catalog.ts`), whose real data contained bundled names per `scripts/fix-inventory-names.ts:2-8` docstring examples.
- **No singularize/pluralize utility exists anywhere in the repo** (grep confirms). `parseCountSuffix` is the only name transform, and it keeps the plural prefix.

## Q4: parseCountSuffix behavior and call sites

### Findings
- Regex (`lib/inventory/parse-count.ts:9`): `^(.*?)(?:\s*\((\d+)\)|\s+[x×]\s*(\d+))\s*$` — recognizes trailing "(N)" (digits only) and whitespace-preceded "xN"/"× N". Post-guards reject `n <= 0` and empty leading names.
- Recognized: 'Torches (3)', 'Iron Spikes (12)', 'Bag of marbles x 2', 'Torches x3', 'Arrows ×20' (`parse-count.test.ts:6-14`).
- NOT recognized: non-numeric parentheticals — 'Potion (minor)', 'Horse Feed (per day)', 'Nails (dozen)' (`parse-count.test.ts:17-23`); plain/plural names with no digits ('Torch', 'Torches'); bare trailing digits ('Box 3', `:27`); mixed parentheticals like 'Rations (7 days)' (digits+text → `\((\d+)\)` fails, falls through; untested but per regex). Zero/empty rejected (`:31-32`).
- Call sites: catalog-picker only — `use-add-item.ts:60` (`selectCatalogItem`); cleanup script `scripts/fix-inventory-names.ts:36,52` (dry-run/--apply, offline). NOT called by: custom add (`use-add-item.ts:79` uses raw trimmed name), restock (no import; names verbatim `use-restock.ts:60,69`), migration transform.

## Q5: Light/fire lifecycle

### Findings
- Lightable filter: `items.filter(i => lightSourceFor(i.item_name) && i.quantity > 0)` (`LightTracker.tsx:36`); button label `Light {name} (×{qty})` (`:121`).
- Server `lightSource` (`lib/data/light.ts:20-43`): inside one ETag-guarded `mutateOwnedCharacterDoc` write — finds entry by id (404), re-derives registry entry (`:27`, 400 `'not a light source'`), guards `quantity <= 0` (400 `'none left to light'`), then `entry.quantity -= 1` (`:30`) and appends `ActiveLightDoc { id, itemName, turnsRemaining: source.turns, totalTurns: source.turns, litAt }` (`:31-40`). Comment `:9-10`: decrement + append atomic by design.
- `burnTurn` (`:46-57`): `turnsRemaining = max(0, remaining - max(1, floor(turns)||1))`; inventory untouched. `extinguish` (`:60-68`): removes the light; no quantity refund.
- Route (`app/api/characters/[id]/light/route.ts`): GET list; POST `{action: 'light'|'burn'|'extinguish'}` dispatch (`:22-28`), errors via `handleRouteError`.
- Client wrapper (`lib/api/light.ts`): `listLights` returns `[]` on non-OK silently; POST helper throws on non-OK (`:7-18`) → `LightTracker` `run()` catches into red error text (`LightTracker.tsx:27-34,127-129`).
- Burn duration: static `LIGHT_SOURCES.turns` — Torch 6, Oil Flask 24, Candle 12, Firewood 48 (1 turn = 10 min; values flagged approximate `light-data.ts:1-3`).
- Unknown name behavior: UI → button simply absent (no error); direct server call → 400. No silent server no-op.

## Q6: Consumers of `quantity` (all assume individual items)

### Findings
- Ammo: `adjustAmmo` ±1 (`use-ammo-tracking.ts:23-27`); `fireShotInBattle` −1 per shot (`:38-46`); `endBattle` recovery math `calcAmmoRecovery(shotsUsed)` assumes 1 quantity = 1 projectile (`:48-60`).
- Light: `entry.quantity -= 1` per lighting (`lib/data/light.ts:30`); optimistic mirror `InventoryTab.tsx:116`.
- Steppers/editors: ItemRow ±1 buttons + NumberField absolute set (`ItemRow.tsx:57,63-70,81`); `setItemQuantity` clamp (`use-inventory.ts:67-71`).
- Restock: only place quantity is *built* from a multiplier (`qty * entry.unit`, `use-restock.ts:58`) — converts bundles into individual-unit counts before storage.
- Weight: `weight_coins * quantity` at `WeightBar.tsx:15-18`, `ItemRow.tsx:89-93`, PDF `character-sheet.ts:57,126-130`; PDF label ' ×N' suffix (`:37`).
- Conclusion: every consumer treats `quantity` as a count of individual, identically-weighted, individually-usable items. No code reads quantity as "number of sets". A row whose quantity means "sets" (e.g. 'Torches' qty 1 = 3 torches) under-counts in every one of these consumers.

## Cross-Cutting Observations

- The individual-item semantic is already universal in code; set-semantics only survive in *names* originating from data (catalog lineage: `equipment.json`-style 'Torches (3)', 'Arrows (quiver of 20)') and in restock's purchase-side `unit` bundling.
- Exact-equals matchers (restock merge, light registry) are brittle to plurality; substring matchers (ammo, missile detection) are not. Registry names are singular; restock ammo names are plural; the parser preserves plurality — so a cleaned 'Torches' row still fails both exact matchers.
- Server re-validates lighting via the same `lightSourceFor` as the client, so any lightability change must touch both `light-data.ts` (shared) — single registry, two call layers.
- `catalog_item_id` is captured at insert but never surfaced/used for matching — all cross-feature identity is by display-name string.

## Open Areas

- Live Cosmos `catalog_items` names not inspectable from repo; `equipment.json` and the fix-script docstring are the best proxies for what bundled names exist ('Torches (3)', 'Bag of marbles x 2' confirmed real per script docstring).
- Whether characters hold rows with plural names ('Torches') vs singular ('Torch') is live data; both forms plausibly coexist post-cleanup since `parseCountSuffix` preserves plurality.
- 'Rations (7 days)'-style mixed parentheticals: regex-analysis says unrecognized; no test covers it.
