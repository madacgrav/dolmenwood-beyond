# Research Findings

## Q1: Inventory item quantity — store, read, mutate end-to-end

### Findings
- **Storage**: `InventoryEntryDoc` at `apps/web/src/lib/cosmos/types.ts:33-47`, field `quantity: number` (line 37). Entries embedded on `CharacterDoc.inventory?: InventoryEntryDoc[]` (`types.ts:154`) — no separate container.
- **Server module** `apps/web/src/lib/data/inventory.ts`:
  - `listInventory` (42-46): `assertCharacterOwner` then maps each entry via `entryToItem` (14-29) to snake_case `InventoryItem`.
  - `addInventoryItem` (62-88): builds doc with `quantity: Math.max(1, Number(input.quantity) || 1)` (72, floor 1), appends via `mutateOwnedCharacterDoc`.
  - `updateInventoryEntry` (90-106): **only** function mutating an existing entry's quantity. Finds by id (96, 404 if missing), sets `entry.quantity = Math.max(0, Number(patch.quantity) || 0)` (98) — floor 0, **no upper bound, no encumbrance/stack check**. Also patches `location` validated against `equipped|stowed|tiny` (99-104).
  - `removeInventoryItem` (108-112): filters entry out (full delete, not quantity).
- **Routes**: `.../inventory/route.ts` GET→list, POST→add. `.../inventory/[itemId]/route.ts` PATCH (7-16)→`updateInventoryEntry(id, itemId, {quantity: body?.quantity, location: body?.location})` — **no route-level validation**; DELETE→remove.
- **Client wrapper** `apps/web/src/lib/api/inventory.ts`: `updateItemQuantity(characterId, itemId, quantity)` (75-85) = `PATCH {quantity}` — single client entry point for quantity-only change. `insertInventoryItem` (62-73), `deleteInventoryItem` (99-101), `updateItemLocation` (87-97, location-only).
- **Callers that change quantity today** (all via `updateItemQuantity` absolute-set PATCH):
  1. Ammo `adjustAmmo` ±1, `fireShotInBattle` −1, `endBattle` +recovered (`use-ammo-tracking.ts:23-60`).
  2. Restock: existing item → `newQty = existing.quantity + totalQty` PATCH; new item → `insertInventoryItem` (`use-restock.ts:44-93`).
- **Rendering**: `ItemList.tsx` (14-39) groups by location → `ItemRow` per entry. `ItemRow.tsx:23` shows `×{item.quantity}` **read-only** — no stepper/input. Only quantity-edit UIs today: Ammo tab stepper/battle, Restock sheet. `ItemRow` exposes only location-cycle + delete (30-46).
- Test: `apps/web/src/test/__tests__/inventory-spells.test.ts:49-66` drives `updateInventoryEntry` directly (quantity, bad id→404, bad location).

## Q2: Coins (gp/sp/cp) — model, display, write paths

### Findings
- **Model**: `CharacterDoc.coinsGp/coinsSp/coinsCp: number` (`types.ts:150-152`) on the doc itself. `Coins {gp,sp,cp}` server shape at `characters.ts:166-170`.
- **Server**: `fetchCoins` (`characters.ts:172-176`, owner-only read). `saveCoins` (178-184): **full replace** — unconditionally overwrites all three denominations inside `mutateOwnedCharacterDoc`, no funds check.
- **Bank delta write** `apps/web/src/lib/data/bank.ts`: `recordBankTransaction(characterId, amountGp, description)` (54-93). Rejects non-integer/zero (59). Appends `BankLedgerEntryDoc` then `doc.coinsGp -= amountGp` (90) — a **delta on coinsGp only** (sp/cp untouched). Deposit (`+`) moves purse→bank; payout (`−`) moves bank→purse. Funds checks: deposit needs `doc.coinsGp >= amountGp` (73-75); payout needs `balanceOf(doc)+amountGp >= 0` (76-78).
- **Routes**: `coins/route.ts` PUT clamps each field `Math.max(0, parseInt||0)` (20) → `saveCoins` full-replace. `bank/route.ts` POST → `recordBankTransaction` with signed `amountGp` (20).
- **Every distinct coin write path**:
  1. **CoinPurse direct edit → saveCoins full-replace.** `CoinPurse.tsx:20-27` three `<input type=number>` → `onCoinChange` → `use-inventory.ts:handleCoinChange` (45-50): `n=Math.max(0,parseInt||0)`, optimistic `setCoins`, `saveCoins(updated)`. Full object round-tripped through React state — **this is already how you can lower coins manually** (edit the box down).
  2. **Restock → saveCoins full-replace.** `use-restock.ts:handleRestock` (44-93): client-side `totalSpOnHand` check, `deductSp(coins, totalSp)` (restock-data.ts:27-39, CP-based to avoid float drift, floors at 0), `saveCoins(newCoins)`.
  3. **Bank deposit (owner) → recordBankTransaction +amount.** `BankPanel.tsx:handleDeposit` (22-45), client validates `amount<=coinsGp`.
  4. **DM payout → recordBankTransaction −amount.** `BankingTab.tsx:handleTransfer` (49-67), negative `amountGp`; **DM-only** server-side.
- No other code writes coins; generic character PATCH (`characters.ts:131-136`) does **not** touch coins.

## Q3: Combat-tab ammunition tracker

### Findings
- Hook `apps/web/src/components/character-sheet/combat/use-ammo-tracking.ts`. State (7-13): `ammoItems`, plus battle session `battleOpen/AmmoId/StartQty/CurrentQty/Result/Ending`.
- **Read**: `listAmmo` (`inventory.ts:44-52`) filters `listInventory` by `item_type==='ammo'` OR name `AMMO_NAME_PATTERN=/arrow|quarrel|stone|bolt/i` (45). Fetched on mount (19-21).
- **adjustAmmo(item, delta)** (23-27): `next=Math.max(0, quantity+delta)`, optimistic `setAmmoItems`, `updateItemQuantity` PATCH. Minus disabled at 0 (`AmmoSection.tsx:34`).
- **Battle mode**: `openBattle` seeds start/current from current qty (29-36). `fireShotInBattle` (38-46): `−1`, PATCH per shot. `endBattle` (48-60): `shotsUsed=start−current`, `recovered=calcAmmoRecovery(shotsUsed)` (`packages/rules-engine/src/combat.ts:4-6` = `floor(shotsUsed/2)`), if `>0` PATCH `current+recovered`. `closeBattle` (62-66) no persist.
- UI: `AmmoSection.tsx` rows (−/+ stepper, ⚔️ Battle button when qty>0). `BattleModal.tsx` big count + 🏹 Shot Fired + 🏁 End Battle. All persistence = `updateItemQuantity` (same inventory PATCH as Q1).

## Q4: Restock flow

### Findings
- Hook `use-restock.ts`, catalog `restock-data.ts`, UI `RestockSheet.tsx` (bottom-sheet modal).
- **Catalog** `RESTOCK_ITEMS` (`restock-data.ts:9-19`): 9 fixed `{name, unit, priceSp, category}` entries (Torch, Oil Flask, Preserved Rations, Waterskin Refill, Horse/Dog Feed, ammo types).
- **Cost math**: `restockTotalSp` sums `qty*priceSp` (37-42). `totalSpOnHand(c)=gp*20+sp+cp/10` (restock-data.ts:22-24). `deductSp` (27-39): all→CP, subtract, floor at 0, reconstitute gp/sp/cp.
- **handleRestock(forceConfirm)** (44-93): early-out if total 0. If `totalSp>available && !forceConfirm` → `restockError='insufficient'` (client-side gate only; "Proceed anyway" calls `handleRestock(true)`). Per catalog entry qty>0: `totalQty=qty*unit`; case-insensitive name match → existing → `updateItemQuantity(existing.id, existing.quantity+totalQty)`; else `insertInventoryItem({item_type: category==='ammo'?'consumable':'gear', quantity: totalQty, location:'stowed'})`. After loop: `saveCoins(deductSp(coins,totalSp))`, reset, 1.5s success then close.
- **Note**: ammo-category restock inserts as `item_type:'consumable'` (not `'ammo'`) — still surfaces in `listAmmo` via name pattern.
- Per-row +/- steppers live **inline in `RestockSheet.tsx`** (101, 119) mutating `restockQtys` map, not in the hook.
- `saveCoins` injected from `useInventory` (`InventoryTab.tsx:34`).

## Q5: Reusable numeric-adjust UI patterns

### Findings
- **No shared `NumberInput`/`Stepper` component** — `apps/web/src/components/ui/` has only `Button.tsx`, `Card.tsx`, `HPBar.tsx`. Every stepper/input is inline-styled, but shares vocabulary: `minHeight:44px` tap targets, `fontVariantNumeric:'tabular-nums'`, `var(--color-border/bg)`, `Math.max(0,…)` clamp in handler.
- **±stepper (server per-tap)**: `AmmoSection.tsx:32-61` — −/+ buttons around tabular-nums span, minus `disabled` at 0.
- **±stepper (local until confirm)**: `RestockSheet.tsx:100-127` — mutates `restockQtys` map, no server call.
- **Big single-commit button**: `BattleModal.tsx:49-107` — 3rem count + 🏹 Shot Fired.
- **Editable number input + handler clamp**: `CoinPurse.tsx:20-27` (gp/sp/cp) → `handleCoinChange`.
- **Editable number input, inline clamp**: `AddItemForm.tsx:116-126` (new-item quantity `Math.max(1,…)`, weight `Math.max(0,…)`).
- **Read-only qty chip**: `ItemRow.tsx:23` `×{quantity}`; weight chip 24-28.
- **Delete control**: `ItemRow.tsx:38-46` ✕ button, `color:var(--color-danger)`, 44×44, owner-gated. Same ✕ shape reused for close in `RestockSheet.tsx:50-59`.
- **Component ownership**: `ItemList.tsx` (grouping) → `ItemRow.tsx` (stateless card, `onToggleLocation`/`onDelete`). `CoinPurse.tsx` (stateless, `onCoinChange` up). `RestockSheet.tsx` / `BattleModal.tsx` / `AddItemForm.tsx` props-driven; state in their hooks.

## Q6: Shared mutation + authorization path

### Findings
- **Core** `characters.ts:43-62` `mutateCharacterDoc(fetchAuthorized, mutate)`: read-modify-write loop, up to 4 attempts. `fetchAuthorized()` both reads doc and asserts caller may mutate. Write = Cosmos IfMatch on `doc._etag` (52-54), partition `/ownerId`. On 412 retries fresh (58); else rethrows.
- `mutateOwnedCharacterDoc(characterId, mutate)` (65-71): `requireAccountId()` + `fetchAuthorized=assertCharacterOwner` — **owner-only, no DM path**.
- **Primitives** `authz.ts`: `assertOwner` (21-23, 403 unless match). `assertCharacterOwner` (114-133): point-read in caller's partition (122-124), fallback cross-partition query (129) to split 404 vs 403. `isDMOfAccount(dmId, target)` (98-105): true if dmId runs a campaign target is a member of.
- **Route enforcement**:
  - Inventory (all) + coins (get/put): **owner-only** (`assertCharacterOwner`/`mutateOwnedCharacterDoc`). No DM path exists.
  - Bank read `fetchBankState` (bank.ts:41-52): owner **or** DM.
  - Bank deposit (`+`): owner **or** DM. Bank payout (`−`): **DM only** (bank.ts:67-69) — owner cannot self-pay-out.
- Errors → `handleRouteError` (`http.ts:6-12`) maps `AuthError`/`HttpError` to status, else 500.

## Q7: Time/event-based consumption / burn-down

### Findings
- **No automatic time/round/turn/rest decrement exists anywhere.** No dungeon-turn or combat-round counter/clock in the repo.
- **Ammo battle tracker** (`use-ammo-tracking.ts` + `calcAmmoRecovery`, `combat.ts:4-6`): only consumption/recovery logic — **manual tap-per-shot**, no clock.
- **Spell "rest" reset** (`spells.ts:110-114` `applyMagicOp case 'rest'`): clears preparations + zeroes `slotsUsed`, stamps `lastRestDate`. Entry `resetSpellsForRest` (`api/spells.ts:97-99`). `RestPrompt.tsx` compares character `last_rest_date` to campaign in-world date (`sameDwDate`, 25) and shows a **manual** Rest button — not auto-run. Also callable from magic tab (`use-spells.ts:126`).
- **HP**: purely manual (`HPBar.tsx:19-27` `adjustHP`/`commitHpInput`); no rest/timer recovery anywhere.
- **Torch/rations/oil/feed**: only `RESTOCK_ITEMS` price-list entries (restock-data.ts:9-19) for *buying* quantity back. **No duration/lit/burning/countdown field or logic.** Quantity changes only via manual inventory PATCH or ammo tracker.
- "duration" in code = inert flavor text (`kindreds.json:21`). "session"/"expire" hits = campaign scheduling / auth, unrelated.

## Cross-Cutting Observations
- **Two coin-write models coexist**: full-replace (`saveCoins`, owner-only, used by CoinPurse + restock) and signed-delta with ledger + funds-check (`recordBankTransaction`, owner/DM split). Lowering coins ("spend") is **already possible** via CoinPurse down-edit or restock; there is no dedicated "spend" transaction concept for the purse outside the bank ledger.
- **Quantity changes are always absolute-set PATCH** (`updateItemQuantity`) with client-computed new value — no server-side delta/consume endpoint. `updateInventoryEntry` floors at 0, no ceiling.
- **Inventory/coins are strictly owner-only**; DM involvement exists only for the bank ledger.
- **No generic stepper/number-input component** — five independent inline implementations sharing style conventions (44px targets, tabular-nums, `Math.max` clamp).
- **All character mutations funnel through `mutateCharacterDoc`** (ETag-guarded, retry-on-412, `/ownerId` partition).

## Open Areas
- No existing "consumable with a burn-down/duration" data shape anywhere — issue-21-style tracking would be greenfield relative to the current schema (`InventoryEntryDoc` has no duration/lit/state field).
- `ITEM_TYPES` UI enum (`inventory/types.ts`, `weapon|armour|gear|consumable|other`) differs from doc-level `ItemType` (`packages/types`, `weapon|armor|gear|spell_component|ammo|coin`) — two divergent type vocabularies not reconciled here.
