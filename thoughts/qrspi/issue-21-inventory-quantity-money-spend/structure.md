# Structure Outline

## Approach
Three independent vertical slices, ordered quick-wins-first: (1) editable item quantities on `ItemRow`, (2) server-enforced Spend flow next to CoinPurse, (3) manual light-burn tracker (issue 21). Each crosses data → route → api-wrapper → UI and is independently shippable. Test command: `pnpm --filter web test` (vitest), plus `pnpm --filter web typecheck`.

---

## Phase 1: Editable item quantities on ItemRow

Give every inventory row a ±1 stepper and a tap-to-edit quantity chip (absolute set), reusing the existing PATCH path. No server or type changes — pure client wiring on top of `updateItemQuantity`.

**Files**: `apps/web/src/components/character-sheet/inventory/ItemRow.tsx`, `.../inventory/ItemList.tsx` (pass callback), `.../inventory/use-inventory.ts` (add handler), `apps/web/src/test/__tests__/inventory-spells.test.ts` (extend).

**Key changes**:
- `use-inventory.ts`: `setItemQuantity(itemId: string, quantity: number): Promise<void>` — optimistic `setItems` + `await updateItemQuantity(characterId, itemId, Math.max(0, quantity))`. Mirrors `adjustAmmo` (`use-ammo-tracking.ts:23-27`).
- `ItemRow.tsx`: new props `onSetQuantity(itemId, qty)`, owner-gated. Stepper (−/+ 36×44, minus disabled at 0) copied from `AmmoSection.tsx:32-61`; chip `×{qty}` becomes a button → inline `inputMode="numeric"` text entry (NOT `type=number` — iOS). Clamp `Math.max(0,…)`.
- `ItemList.tsx`: thread `onSetQuantity` through to rows.

**Verify**: `test` passes (extend `updateInventoryEntry` coverage for a set-to-0 and set-to-large case). Manual on iPhone: torch 20→3 via chip edit in two taps; ± nudges; edited ammo shows in combat tab after refetch.

---

## Phase 2: Spend money (server-enforced deduct)

New owner-only deduct endpoint with insufficient-funds guard + change-making, and a Spend button/form beside CoinPurse. Independent of Phase 1.

**Files**: `apps/web/src/lib/data/characters.ts` (new data fn), `apps/web/src/lib/coins.ts` (new — shared CP math, or colocate), `apps/web/src/app/api/characters/[id]/coins/spend/route.ts` (new), `apps/web/src/lib/api/characters.ts` (wrapper), `apps/web/src/components/character-sheet/inventory/SpendForm.tsx` (new) + wire into `InventoryTab.tsx`/`CoinPurse` area, `apps/web/src/test/__tests__/` (new spend test).

**Key changes**:
- `lib/coins.ts`: `toCp(c: Coins): number`, `fromCp(cp: number): Coins`, `amountToCp(amount: number, denom: 'gp'|'sp'|'cp'): number` — integer math extracted/adapted from `deductSp` (`restock-data.ts:27-39`).
- `data/characters.ts`: `spendCoins(characterId: string, amountCp: number): Promise<Coins>` — `mutateOwnedCharacterDoc`; `if (toCp(current) < amountCp) throw badRequest('insufficient funds')`; write `fromCp(total - amountCp)`; return new `Coins`. Shape mirrors `recordBankTransaction` guard (`data/bank.ts:73-75`) minus DM/ledger.
- `coins/spend/route.ts`: `POST` `{ amount: number, denom: 'gp'|'sp'|'cp' }` → validate positive → `amountToCp` → `spendCoins` → 200 `{coins}`; `handleRouteError`.
- `lib/api/characters.ts`: `spendCoins({ characterId, amount, denom }): Promise<Coins>`.
- `SpendForm.tsx`: amount input (`inputMode="numeric"`) + gp/sp/cp selector + Spend button + inline error, styled after `BankPanel.tsx:22-45`.

**Verify**: `test` passes (spend > holdings → thrown `insufficient funds`; spend 3gp from {2,25,0} → correct change via CP math; spend 0/negative rejected). Manual: Spend button opens form; overspend shows inline error, no state change; valid spend updates CoinPurse immediately from returned `Coins`; works on iPhone.

---

## Phase 3: Light-burn tracker (issue 21)

Manual tap-per-turn tracker persisted on the character doc. Lighting consumes 1 of the source item and starts a countdown; a turn-passes tap burns down; expiry warns. No automatic clock. Builds on the quantity mutation but is otherwise independent — if it slips, Phases 1–2 stand alone.

**Files**: `apps/web/src/lib/cosmos/types.ts` (new field), `apps/web/src/lib/data/light.ts` (new), `apps/web/src/app/api/characters/[id]/light/route.ts` (new), `apps/web/src/lib/api/light.ts` (new), light source constants (`.../inventory/light-data.ts` new, next to `restock-data.ts`), UI `apps/web/src/components/character-sheet/inventory/LightTracker.tsx` (new) wired into `InventoryTab.tsx`, test (new).

**Key changes**:
- `types.ts`: `CharacterDoc.activeLights?: ActiveLightDoc[]` where `ActiveLightDoc { id: string; itemName: string; turnsRemaining: number; totalTurns: number; litAt: string }`. Array (supports torch + lantern at once per Open Risk).
- `light-data.ts`: `LIGHT_SOURCES: { name: string; turns: number }[]` (torch 6, lamp oil flask 24, candle 12, lantern-hooded uses oil… — exact turns confirmed against Dolmenwood rulebook during plan/impl; data-only, trivially adjustable).
- `data/light.ts` (all `mutateOwnedCharacterDoc`, single ETag write each):
  - `listLights(characterId): Promise<ActiveLightDoc[]>`
  - `lightSource(characterId, itemId): Promise<...>` — decrement that inventory entry's quantity by 1 (reuse in-doc mutation, reject if quantity 0), push `ActiveLightDoc` with `turns` from `LIGHT_SOURCES` matched by name.
  - `burnTurn(characterId, lightId, turns=1): Promise<ActiveLightDoc[]>` — `turnsRemaining = Math.max(0, …-turns)`.
  - `extinguish(characterId, lightId): Promise<...>` — remove entry.
- `light/route.ts`: `GET` list; `POST {action:'light'|'burn'|'extinguish', itemId?/lightId?, turns?}`.
- `lib/api/light.ts`: thin wrappers.
- `LightTracker.tsx`: list active lights (big tabular-nums turns remaining, `BattleModal.tsx` vocabulary), "Turn passes" button per light, "Light a source" picker (from inventory items matching `LIGHT_SOURCES`), expired/low warning styling.

**Verify**: `test` passes (light → source quantity −1 + tracker entry with correct turns; light with 0 quantity → rejected; burn to 0 → expired; extinguish removes). Manual: light torch → inventory torch −1, tracker shows 6; 6 taps → expired; relight consumes another; survives page reload.

---

## Testing Checkpoints
- **After P1**: any inventory item's quantity editable from the sheet (stepper + tap-edit), iOS-safe; persists; combat ammo consistent. No server/type change.
- **After P2**: Spend deducts across denominations with server funds guard; overspend blocked server-side; CoinPurse syncs from returned `Coins`. Endpoint independently testable via vitest.
- **After P3**: light sources tracked with manual burn-down, state on `CharacterDoc.activeLights`, source item consumed on light; reload-durable. Issue 21 satisfied (manual model, no auto clock — explicitly scoped out).
- **Global**: `pnpm --filter web typecheck` + `pnpm --filter web test` green after every phase; each phase is a standalone valuable increment.
