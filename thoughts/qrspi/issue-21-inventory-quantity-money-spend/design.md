# Design Discussion

## Current State

- **Item quantity** lives on embedded `InventoryEntryDoc.quantity` (`apps/web/src/lib/cosmos/types.ts:37`). One server mutator, `updateInventoryEntry` (`apps/web/src/lib/data/inventory.ts:90-106`, absolute-set, floor 0, no ceiling), one client call `updateItemQuantity` (`apps/web/src/lib/api/inventory.ts:75-85`). But `ItemRow.tsx:23` renders `×{quantity}` **read-only** — only the combat-tab ammo stepper (`use-ammo-tracking.ts:23-27`) and the restock sheet (`use-restock.ts:44-93`) can change a quantity. Torches/rations/etc. cannot be edited in place.
- **Coins** are `coinsGp/Sp/Cp` on `CharacterDoc` (`types.ts:150-152`). Two write models: full-replace `saveCoins` (`data/characters.ts:178-184`, no funds check, backs CoinPurse free-edit and restock) and delta-with-ledger `recordBankTransaction` (`data/bank.ts:54-93`, funds-checked, gp-only, owner/DM split). Down-editing the CoinPurse `<input type=number>` **does not work on iPhone Safari** and is tedious for large amounts (user-reported). No dedicated "spend" flow exists.
- **Burn-down tracking (issue 21)**: nothing exists. No duration/lit field on `InventoryEntryDoc`, no turn/round/rest clock anywhere in the repo. Closest analogue is the manual, tap-driven ammo battle tracker (`use-ammo-tracking.ts` + `calcAmmoRecovery`, `packages/rules-engine/src/combat.ts:4-6`).
- All character mutations funnel through `mutateCharacterDoc` (`data/characters.ts:43-62`, ETag-guarded, retry-on-412) / `mutateOwnedCharacterDoc` (owner-only). Inventory + coins are strictly owner-only.

## Desired End State

1. **Editable item quantities on the inventory tab.** Every `ItemRow` gets ±1 stepper buttons AND a tap-to-edit on the quantity chip (opens a number entry, absolute set). Persists via existing `updateItemQuantity` PATCH. Verify: change torch count 20→3 in two taps on mobile; ammo edited here reflects in combat tab after refetch.
2. **Spend money.** A "Spend" button next to the CoinPurse opens a small form: amount + denomination (gp/sp/cp). Deducts across denominations with automatic change-making (spend 5sp while holding only gp works). Server-side deduct endpoint with an insufficient-funds guard. Verify: spend larger than holdings → 400 + inline error; spend 3gp from {gp:2, sp:25, cp:0} succeeds with correct change.
3. **Light tracker (issue 21).** A manual, tap-driven tracker for burning light/heat sources (torch, lamp oil, candle, firewood): "light" an item (consumes 1 from its inventory quantity, starts a tracker with N turns remaining), tap "turn passes" to burn down, warns/expires at 0. Mirrors the battle-modal interaction model — no automatic clock (none exists in the app; out of scope). State persists on the character doc so it survives reloads. Verify: light torch → quantity −1, tracker shows 6 turns; 6 taps → expired state; relight consumes another torch.

## Patterns to Follow

- **Stepper UI**: copy `AmmoSection.tsx:32-61` (−/+ 36×44 buttons, tabular-nums span, minus disabled at 0, aria-labels).
- **Optimistic update + PATCH**: `adjustAmmo` (`use-ammo-tracking.ts:23-27`) — compute next, set local state, `await updateItemQuantity`.
- **Amount form UI**: `BankPanel.tsx:22-45` deposit form (amount input + description + validate + inline error) — the Spend form is its sibling.
- **Change-making math**: `deductSp` (`restock-data.ts:27-39`) — convert to CP, subtract, reconstitute. Reuse/adapt for the server-side deduct (work in CP, integer math).
- **Funds-checked delta endpoint**: `recordBankTransaction` (`data/bank.ts:54-93`) — validate amount, throw `badRequest('insufficient …')` inside the mutate callback. The new deduct endpoint follows this shape (minus the DM split — spend is owner-only).
- **Server-tier feature pattern** (per project convention): data module fn + route + `lib/api` wrapper + authz via `mutateOwnedCharacterDoc`.
- **Modal/tracker UI**: `BattleModal.tsx` (big tabular-nums count, one primary action button, result panel) for the light tracker.
- **Error mapping**: routes wrap in `handleRouteError` (`lib/http.ts:6-12`).

**Anti-patterns to avoid:**
- Do NOT reuse the client-computes-then-`saveCoins` pattern (restock, `use-restock.ts:79-80`) for Spend — decided against; server must enforce funds.
- Do NOT rely on `<input type=number>` spinners for anything new — broken on iPhone (the original complaint). Buttons + explicit numeric entry.
- The two divergent `ItemType` vocabularies (UI `consumable` vs doc `ammo`) — don't try to reconcile here; light tracker matches items by name like `listAmmo`'s pattern does (`lib/api/inventory.ts:44-52`).

## Design Decisions

1. **Scope**: all three features in this effort — quantity edit, spend money, light tracker (issue 21). Delivered as separate vertical slices so the two quick wins aren't blocked on the tracker.
2. **Quantity edit UX**: **both** ±1 stepper and tap-the-chip-to-edit (absolute entry) on each `ItemRow`. Stepper for nudges, tap-edit for big jumps. Owner-gated like the delete button (`ItemRow.tsx:38`).
3. **Spend denominations**: single amount + gp/sp/cp denomination choice, deducted across the whole purse with automatic change-making (CP-integer math per `deductSp`). Matches how players actually spend.
4. **Spend placement**: button adjacent to CoinPurse on the inventory tab.
5. **Spend server path**: **new deduct endpoint** — `POST /api/characters/[id]/coins/spend` (or equivalent) with `{amountCp}` (or amount+denom), owner-only via `mutateOwnedCharacterDoc`, `badRequest('insufficient funds')` when purse total < amount. Returns the new `Coins` so client state syncs exactly.
6. **Light tracker model**: manual tap-per-turn (like battle tracker), NOT a real-time or automatic clock — no time system exists and building one is out of scope. Burn durations are data constants (Dolmenwood: torch 6 turns, lamp oil flask 24 turns, candle 12 turns, firewood 8 hours-ish — exact table finalized in planning against the rulebook; constants live next to `restock-data.ts` or in rules-engine).
7. **Light tracker state**: persisted on `CharacterDoc` (e.g. `activeLight?: { itemName, turnsRemaining, litAt }`) so it survives reload/device switch; mutated through its own small data fn + route following the coins pattern. Lighting decrements the source item via the existing inventory mutation, server-side in the same doc mutation (single ETag-guarded write).

## What We're NOT Doing

- No automatic/real-time burn-down, no in-world clock or turn counter shared across the party. Player taps.
- No DM access to inventory/coins (stays owner-only; bank remains the only DM surface).
- No purse ledger/history for spend (bank ledger stays bank-only). Spend is fire-and-forget.
- No shared `Stepper`/`NumberInput` component extraction — copy the inline pattern like every other instance. (Refactor candidate later, not now.)
- No reconciliation of the two `ItemType` vocabularies.
- No changes to restock's client-side coin math (it keeps `saveCoins`; only the new Spend uses the deduct endpoint).
- No encumbrance recalcs beyond what existing quantity changes already trigger (WeightBar reads quantity — updates for free).

## Open Risks

- **Burn duration table**: exact Dolmenwood turn counts per light source need checking against the rulebook during planning; wrong constants are trivially fixable data.
- **Tap-to-edit on iOS**: the edit affordance must not regress into the same `type=number` spinner trap; plan should specify `inputMode="numeric"` text entry or button-driven entry and verify on iPhone.
- **Spend rounding**: change-making in CP with integer math avoids float drift, but UI display of mixed results (e.g., 19sp 5cp) needs the `fmtSp`-style formatting care (`RestockSheet.tsx:81-84`).
- **Multiple light sources**: design assumes one active light at a time (`activeLight` singular). If a party runs torch + lantern simultaneously on one character, model needs to be a small array — cheap to change if planning decides so.
- **Concurrent edits**: quantity stepper spam + ETag retry loop is already the ammo tracker's behavior (last-write-wins per tap); acceptable, unchanged.
