# Design Discussion

Follow-up to PR #73. Two tester complaints: items still read as "sets × count of
sets" (restock bundles, plural/ set-style names), and Light & Fire can't be *started*
for most items because the registry match is too strict.

## Current State

- **Restock bundles**: one "+" adds `qty * entry.unit` (20 for ammo) at a per-bundle
  price; label "×{unit} per purchase" (`use-restock.ts:58`, `RestockSheet.tsx:94`).
  Merge/insert by case-insensitive exact name (`use-restock.ts:59-61,69`); names verbatim.
- **Light gate**: `lightSourceFor` is case-insensitive *exact-equals* against 4 singular
  literals — Torch, Oil Flask, Candle, Firewood (`light-data.ts:11-20`). Used in the
  client `lightable` filter (`LightTracker.tsx:36`) and as the authoritative server gate
  (`lib/data/light.ts:27-28`). Plural/variant/unknown names → no button (silent), 400 server.
- **Quantity is already per-item everywhere** in code (ammo fire/recovery
  `use-ammo-tracking.ts:23-60`, light consume `light.ts:30`, weight × qty
  `WeightBar.tsx:15-18`, PDF `character-sheet.ts:57,126-130`). Set-semantics survive only
  in *names* (catalog lineage "Torches (3)", `equipment.json`) and restock's `unit`.
- **No singularize utility exists** (research Q3). `parseCountSuffix`
  (`lib/inventory/parse-count.ts`) strips a numeric suffix but preserves plurality
  ("Torches (3)" → "Torches"); only called by catalog-add (`use-add-item.ts:60`) and the
  offline cleanup script.
- Ammo filter is the one plural-safe matcher: substring regex `/arrow|quarrel|stone|bolt/i`
  (`lib/api/inventory.ts:45-51`).

## Desired End State

1. **Restock buys individual items**: the stepper adds 1 item at a per-item price;
   an optional "pack" quick-add (+20) remains for ammo convenience. Quantity stored is the
   true individual count; the "×N per purchase" framing is gone.
   Verify: buy 3 arrows → row "Arrow" qty 3; buy a pack → qty +20; price scales per item.
2. **Lighting works for the items players actually have**: any inventory row that is a
   torch/lantern/candle/oil/firewood — singular, plural, or lightly varied — shows a Light
   button and lights server-side. Verify: a "Torches" row and a "Lantern" row both light.
3. **New consumable rows carry canonical singular labels**: restock and catalog-add write
   "Torch"/"Arrow"/"Ration", not "Torches"/"Arrows (20)". Verify: restock/catalog a known
   consumable → singular name + separate count.

## Patterns to Follow

- **Shared registry, two call layers**: `lightSourceFor` is consumed by both client
  (`LightTracker.tsx:36`) and server (`light.ts:27`) — extend it in one place
  (`light-data.ts`) and both layers gain the new matching for free. Keep it the single
  source of truth.
- **Substring/keyword tolerance already proven**: the ammo filter (`lib/api/inventory.ts:45`)
  is the model for name tolerance — but we use an explicit alias list (chosen over blind
  substring) to avoid false positives.
- **7-stop nothing new here**: no schema change — `activeLights`/`InventoryEntryDoc`
  unchanged. Work is in data files + matchers + restock UI.
- **Offline cleanup script exists** (`scripts/fix-inventory-names.ts`) — the pattern for
  data migration, but we are NOT extending it this cycle (see What We're NOT Doing).
- **DO NOT** rely on exact-equals name matching for cross-feature identity (the current
  brittle pattern at `use-restock.ts:60`, `light-data.ts:19`). New matching goes through
  the alias-aware helper.
- **DO NOT** add a general English singularizer — use a small explicit canonical map for
  the known consumable set only.

## Design Decisions

1. **Restock = per-item price + optional pack quick-add**. Rename `unit` semantics: keep a
   `pack` size field for the quick-add button, add per-item `priceSp` (arrows 0.05, quarrels
   0.1, sling stones ~0.0125→round). Default stepper adds 1 at per-item price; a "+{pack}"
   button adds a pack. Drop the "×N per purchase" label; show per-item price. Store canonical
   singular `name`.
2. **Alias list per light source**. Add `aliases: string[]` to `LightSource`
   (`light-data.ts`) and make `lightSourceFor` match if the (count-suffix-stripped,
   lowercased) name equals the canonical name OR any alias. E.g. Torch: ["torch","torches"];
   Candle: ["candle","candles"]; Oil Flask: ["oil flask","oil flasks","flask of oil",
   "lamp oil"]; Firewood: ["firewood","wood","logs"]. **No Lantern entry** — a lantern is
   equipment, not fuel; the Oil Flask is the consumable that gets lit (per Dolmenwood rules).
   This fixes lighting for existing plural rows too, covering the "fix-forward only" data gap.
3. **Canonical singular labels for known consumables on entry**. A small map (canonical
   singular keyed by alias) applied where new rows are created: restock uses singular `name`
   directly; catalog-add resolves the picked name through the map after `parseCountSuffix`.
   Unknown items keep their typed/catalog name unchanged.
4. **Fix forward only for data**. No cleanup-script changes. Existing plural rows keep their
   labels but become lightable via the alias list and mergeable via alias-aware restock match.

## What We're NOT Doing

- No schema/migration changes; no changes to `ActiveLightDoc` or `InventoryEntryDoc`.
- No general-purpose singularization library; only the known-consumable canonical map.
- Not extending or re-running `scripts/fix-inventory-names.ts` (existing data stays as-is;
  alias matching makes it work without renames).
- Not touching ammo fire/recovery math or weight calc — already per-item and correct.
- Not changing the burn/extinguish/turn-passes flow — only what makes an item *lightable*.
- Not reworking the ammo substring filter (`lib/api/inventory.ts:45`) — already tolerant.

## Open Risks

- **Alias false positives**: a substring-free alias list is safe, but "oil" as an alias
  could catch "Oil-soaked rag". Mitigate by matching whole cleaned name against alias
  (equals), not substring — aliases are full names, not fragments.
- **Restock merge with existing plural rows**: buying "Arrow" (new canonical) won't merge
  into a pre-existing "Arrows" row (exact match). Alias-aware merge on the restock lookup
  mitigates, but adds coupling; if out of scope, a duplicate row results until data cleanup.
  Decision: make restock merge alias-aware using the same canonical map.
- **Per-item ammo price rounding**: sling stones 0.25sp/20 = 0.0125sp — below CP granularity.
  Price in CP; a single stone may round to 0 cp. Keep the pack quick-add as the priced unit
  for sub-CP items, or round per-item price up to the nearest sensible minimum.
- ~~Lantern~~ Resolved: Lantern stays out of the registry — Oil Flask is the consumable
  (user-confirmed). A player with a lantern lights an Oil Flask.
