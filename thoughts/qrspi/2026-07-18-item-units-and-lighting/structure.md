# Structure Outline

## Approach

Four vertical slices. A shared canonical/alias helper for known consumables underpins two
of them, so it lands first (with tests) and is then consumed by the light matcher, the
label normalization, and restock. No schema changes. Test command:
`cd apps/web && pnpm test` (vitest); repo root `pnpm typecheck && pnpm lint`.

---

## Phase 1: Consumable registry — aliases + canonical names

Single source of truth for "what counts as a torch/oil/candle/firewood" and "what the
clean singular label is". Unblocks lighting (Phase 2) and label normalization (Phase 3).

**Files**: `apps/web/src/lib/light-data.ts` (extend), `apps/web/src/lib/inventory/consumables.ts` (new), `apps/web/src/test/__tests__/consumables.test.ts` (new)

**Key changes**:
- `LightSource { name: string; turns: number; icon: string; aliases: string[] }` — add `aliases` to each of the 4 entries (`light-data.ts:4-15`). No Lantern entry.
- `lightSourceFor(itemName: string): LightSource | undefined` — match on `parseCountSuffix(name)`-stripped, lowercased string equal to `name` OR any `aliases[]` entry (`light-data.ts:18-20`).
- `canonicalName(raw: string): string` — new in `consumables.ts`: strip count suffix, then if the cleaned lowercased name matches a known consumable alias, return that entry's canonical singular label; else return the count-stripped name unchanged. Backed by a small map covering the light sources + ammo (Arrow, Crossbow Quarrel, Sling Stone) + common gear (Ration).

**Verify**: `pnpm test` new `consumables` test — `lightSourceFor('Torches')`, `'torch'`, `'Torch (3)'` all resolve; `'Lantern'` does NOT; `canonicalName('Arrows (20)')` → `'Arrow'`, `canonicalName('Rope')` → `'Rope'` (unchanged).

---

## Phase 2: Lighting works for plural/variant rows

The alias-aware `lightSourceFor` (Phase 1) now flows through the existing client filter and
server gate — no new wiring, just verification that both layers accept the wider set.

**Files**: (no code change beyond Phase 1) `apps/web/src/components/character-sheet/inventory/LightTracker.tsx`, `apps/web/src/lib/data/light.ts`, `apps/web/src/test/__tests__/light.test.ts` (extend)

**Key changes**:
- None structural — `LightTracker.tsx:36` `lightable` filter and `light.ts:27` server gate both call the extended `lightSourceFor`.
- Extend `light.test.ts` with plural/variant fixtures: a `'Torches'` row is lightable and lights server-side; a `'Lantern'` row is NOT; `'Oil Flask'` still works.

**Verify**: `pnpm test light` passes; manual — a character with a "Torches" row shows the Light button and can light/burn/extinguish it.

---

## Phase 3: Canonical singular labels on entry

New consumable rows get clean singular labels via `canonicalName` at the two write paths.

**Files**: `apps/web/src/components/character-sheet/inventory/use-add-item.ts` (catalog-add), `apps/web/src/components/character-sheet/inventory/restock-data.ts` (names), `apps/web/src/components/character-sheet/inventory/use-restock.ts` (merge lookup + insert)

**Key changes**:
- `selectCatalogItem` (`use-add-item.ts:57-71`): replace the `parseCountSuffix` name with `canonicalName(cat.name)` for `item_name` (still take quantity from `parseCountSuffix`).
- `restock-data.ts`: rewrite ammo names to canonical singular — `Arrow`, `Crossbow Quarrel`, `Sling Stone`.
- `use-restock.ts:59-61` merge lookup: match existing rows by `canonicalName(i.item_name) === canonicalName(entry.name)` (alias-aware) so a new "Arrow" purchase merges into an existing "Arrows" row; insert uses `entry.name` (already canonical).

**Verify**: `pnpm test`; manual — catalog-pick "Torches (3)" → row "Torch" qty 3; restock arrows into a pre-existing "Arrows" row → single merged row.

---

## Phase 4: Restock per-item pricing + pack quick-add

Restock sells individual items priced per item, with an optional pack button; the
"×N per purchase" bundle framing is gone.

**Files**: `apps/web/src/components/character-sheet/inventory/restock-data.ts`, `apps/web/src/components/character-sheet/inventory/use-restock.ts`, `apps/web/src/components/character-sheet/inventory/RestockSheet.tsx`

**Key changes**:
- `RestockEntry { name; priceSp; category; weightCoins; pack?: number }` — rename `unit`→`pack` (optional quick-add size), set `priceSp` to per-item price (Arrow 0.05, Crossbow Quarrel 0.1, Sling Stone round-to-CP, others unchanged) (`restock-data.ts:2-21`).
- `use-restock.ts:58`: `totalQty = qty` (drop the `* entry.unit` multiplier); `restockTotalSp` already `qty * priceSp` — now per item.
- `RestockSheet.tsx:94`: drop "×{unit} per purchase" label; per-item price already shown. Add a "+{pack}" quick-add button (owner) next to the stepper for entries with `pack`, incrementing `restockQtys[entry.name]` by `pack`.

**Verify**: `pnpm test`; manual — buy 3 arrows → qty 3 at 3× per-item price; tap "+20" → qty jumps 20; total scales per item; no "×N per purchase" text.

---

## Testing Checkpoints

- **After P1**: `consumables` + extended registry unit-tested in isolation; `lightSourceFor` alias-aware, `canonicalName` maps known items and passes through unknowns.
- **After P2**: plural/variant rows are lightable end to end; Lantern excluded; light tests green.
- **After P3**: new catalog/restock rows carry canonical singular labels; restock merges alias-equivalent rows instead of duplicating.
- **After P4**: restock is per-item priced with a pack quick-add; bundle multiplier and label gone.

Phase order rationale: P1 is the shared foundation (registry + canonical map) with its own
tests. P2 is pure verification that the foundation flows through untouched call sites —
cheapest win, delivers the headline "lighting works" fix. P3 and P4 both build on P1's map;
P3 (labels/merge) is independent of P4 (pricing/UI), so a stall in either leaves the other
plus P1–P2 intact.
