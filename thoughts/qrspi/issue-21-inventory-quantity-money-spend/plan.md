# Implementation Plan

## Overview
Give players direct control over expendable resources on the character sheet: editable item quantities on every inventory row, a server-enforced "Spend" flow for coins, and a manual light-burn tracker (issue #21). Test command: `pnpm --filter web test`; typecheck: `pnpm --filter web typecheck`.

---

## Phase 1: Editable item quantities on ItemRow

Pure client wiring on top of the existing `updateItemQuantity` PATCH. No server/type changes.

### Changes

#### 1. `useInventory` — quantity handler
**File**: `apps/web/src/components/character-sheet/inventory/use-inventory.ts`
**Action**: modify — import `updateItemQuantity`, add `setItemQuantity`, export it.

```ts
import {
  listInventory,
  updateItemLocation,
  updateItemQuantity,   // add
  deleteInventoryItem,
  type InventoryItem as DBInventoryItem,
} from '@/lib/api/inventory';
```

```ts
async function setItemQuantity(id: string, quantity: number) {
  const q = Math.max(0, Math.floor(quantity) || 0);
  setItems(prev => prev.map(i => i.id === id ? { ...i, quantity: q } : i));
  await updateItemQuantity(characterId, id, q);
}
```
Add `setItemQuantity` to the returned object.

#### 2. `ItemRow` — stepper + tap-to-edit chip
**File**: `apps/web/src/components/character-sheet/inventory/ItemRow.tsx`
**Action**: modify — add `onSetQuantity` prop, replace the read-only `×{quantity}` chip (line 23) with an editable control. Owner-gated; non-owner still sees the plain chip.

```tsx
interface Props {
  item: DBInventoryItem;
  isOwner: boolean;
  onToggleLocation: (item: DBInventoryItem) => void;
  onSetQuantity: (id: string, quantity: number) => void;   // add
  onDelete: (id: string) => void;
}
```

Add local edit state at the top of the component:
```tsx
import { useState } from 'react';
const [editing, setEditing] = useState(false);
const [draft, setDraft] = useState(String(item.quantity));
```

Replace the `<span>×{item.quantity}</span>` (line 23) with: when `!isOwner`, keep the existing read-only span; when `isOwner`, render a −/+ stepper (copy the button/​span styling from `AmmoSection.tsx:32-61`: 36×44 buttons, `fontVariantNumeric:'tabular-nums'`, minus `disabled={item.quantity<=0}`) whose center count is a button that toggles `editing`. When `editing`, render a numeric text input instead of the count:
```tsx
<input
  autoFocus
  inputMode="numeric"
  pattern="[0-9]*"
  value={draft}
  onChange={e => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
  onBlur={() => { onSetQuantity(item.id, parseInt(draft) || 0); setEditing(false); }}
  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
  style={{ width: '4ch', textAlign: 'center', fontVariantNumeric: 'tabular-nums', minHeight: '44px', border: '1px solid var(--color-border)', borderRadius: '6px', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontWeight: '700' }}
  aria-label={`Set quantity for ${item.item_name}`}
/>
```
Stepper handlers call `onSetQuantity(item.id, item.quantity + 1)` / `- 1`. Keep `draft` in sync when not editing (`useEffect(() => { if (!editing) setDraft(String(item.quantity)); }, [item.quantity, editing])`). Do NOT use `type="number"` (iOS spinner is broken — the original bug).

The weight chip (lines 24-28), location button (30-37), and delete button (38-46) are unchanged.

#### 3. `ItemList` — thread the callback
**File**: `apps/web/src/components/character-sheet/inventory/ItemList.tsx`
**Action**: modify — add `onSetQuantity` to `Props` and pass it into each `<ItemRow>`.

#### 4. `InventoryTab` — pass the handler
**File**: `apps/web/src/components/character-sheet/InventoryTab.tsx`
**Action**: modify — on the `<ItemList>` (lines 94-99) add `onSetQuantity={inv.setItemQuantity}`.

#### 5. Test
**File**: `apps/web/src/test/__tests__/inventory-spells.test.ts`
**Action**: modify — inside the existing `adds, patches, and removes` test (or a new `it`), assert `updateInventoryEntry(id, sword.id, { quantity: 0 })` sets 0 and a large value (e.g. 999) round-trips. The data path is already covered; this just pins the floor-0/no-ceiling behavior the UI relies on.

### Verification
#### Automated
- [x] `pnpm --filter web typecheck` passes
- [x] `pnpm --filter web test` passes
#### Manual
- [ ] On iPhone Safari: tap a torch's count → numeric keypad → type 3 → blur → persists (no broken spinner)
- [ ] −/+ nudges a count; minus disabled at 0
- [ ] Editing an ammo item here reflects in the Combat tab after reload

---

## Phase 2: Spend money (server-enforced deduct)

New owner-only deduct endpoint with an insufficient-funds guard and cross-denomination change-making, plus a Spend form beside CoinPurse. Independent of Phase 1.

### Changes

#### 1. Shared coin math
**File**: `apps/web/src/lib/coins.ts`
**Action**: create — integer CP math (adapted from `deductSp`, `restock-data.ts:27-39`).

```ts
import type { Coins } from '@/lib/data/characters';

const CP_PER_GP = 200; // 1 gp = 20 sp = 200 cp
const CP_PER_SP = 10;

export function toCp(c: Coins): number {
  return c.gp * CP_PER_GP + c.sp * CP_PER_SP + c.cp;
}

export function fromCp(cp: number): Coins {
  const n = Math.max(0, Math.floor(cp));
  return { gp: Math.floor(n / CP_PER_GP), sp: Math.floor((n % CP_PER_GP) / CP_PER_SP), cp: n % CP_PER_SP };
}

export function amountToCp(amount: number, denom: 'gp' | 'sp' | 'cp'): number {
  const a = Math.floor(amount);
  return denom === 'gp' ? a * CP_PER_GP : denom === 'sp' ? a * CP_PER_SP : a;
}
```

#### 2. `spendCoins` data function
**File**: `apps/web/src/lib/data/characters.ts`
**Action**: modify — add after `saveCoins` (line 184). `badRequest` is already imported (line 8).

```ts
import { toCp, fromCp } from '@/lib/coins';  // add near top imports
```

```ts
/** Owner-only spend: deducts amountCp across the purse (make-change), guarding
 *  against overspend. Returns the new coin counts. */
export async function spendCoins(characterId: string, amountCp: number): Promise<Coins> {
  if (!Number.isInteger(amountCp) || amountCp <= 0) throw badRequest('amount must be a positive integer');
  const doc = await mutateOwnedCharacterDoc(characterId, (d) => {
    const have = toCp({ gp: d.coinsGp ?? 0, sp: d.coinsSp ?? 0, cp: d.coinsCp ?? 0 });
    if (have < amountCp) throw badRequest('insufficient funds');
    const next = fromCp(have - amountCp);
    d.coinsGp = next.gp; d.coinsSp = next.sp; d.coinsCp = next.cp;
  });
  return { gp: doc.coinsGp, sp: doc.coinsSp, cp: doc.coinsCp };
}
```
> Note: `lib/coins.ts` imports the `Coins` type from `characters.ts` and `characters.ts` imports functions from `coins.ts`. That's a type-only ↔ value cycle — fine for TS/ESM, but if it complains, move `Coins` into `coins.ts` and re-export from `characters.ts`.

#### 3. Route
**File**: `apps/web/src/app/api/characters/[id]/coins/spend/route.ts`
**Action**: create.

```ts
import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import { spendCoins } from '@/lib/data/characters';
import { amountToCp } from '@/lib/coins';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const amount = Number(body?.amount);
    const denom = body?.denom;
    if (!['gp', 'sp', 'cp'].includes(denom)) return NextResponse.json({ error: 'invalid denom' }, { status: 400 });
    const coins = await spendCoins(id, amountToCp(amount, denom));
    return NextResponse.json(coins);
  } catch (e) {
    return handleRouteError(e);
  }
}
```

#### 4. Client wrapper
**File**: `apps/web/src/lib/api/characters.ts`
**Action**: modify — add after `saveCoins` (line 98).

```ts
export async function spendCoins(
  characterId: string,
  amount: number,
  denom: 'gp' | 'sp' | 'cp',
): Promise<{ coins: Coins | null; error: string | null }> {
  const res = await fetch(`/api/characters/${characterId}/coins/spend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, denom }),
  });
  if (!res.ok) return { coins: null, error: await errorText(res) };
  return { coins: await res.json(), error: null };
}
```

#### 5. Spend form UI
**File**: `apps/web/src/components/character-sheet/inventory/SpendForm.tsx`
**Action**: create — styled after `BankPanel.tsx:82-121` (collapsible form, amount input + inline error). Amount input uses `inputMode="numeric"` (not `type="number"`).

```tsx
interface Props {
  characterId: string;
  coins: Coins;
  onSpent: (coins: Coins) => void;
}
```
Behavior: a "Spend" toggle button (styled like the Restock button, `InventoryTab.tsx:78-89`) reveals a row with a numeric amount input + a gp/sp/cp `<select>` + a Spend button. On submit: client-side `if (!amount || amount <= 0)` inline error; else `const { coins: next, error } = await spendCoins(characterId, amount, denom)`; on error show it inline (server returns `insufficient funds`), on success `onSpent(next)` and reset/close. Show current holdings as helper text (e.g. `You have {coins.gp}gp {coins.sp}sp {coins.cp}cp`).

#### 6. Wire into InventoryTab
**File**: `apps/web/src/components/character-sheet/InventoryTab.tsx`
**Action**: modify — render `<SpendForm>` right after `<CoinPurse>` (line 61), owner-only:
```tsx
{isOwner && (
  <SpendForm characterId={characterId} coins={inv.coins} onSpent={next => inv.setCoins(next)} />
)}
```
Add the import.

#### 7. Test
**File**: `apps/web/src/test/__tests__/coins-spend.test.ts`
**Action**: create — mirror the `inventory-spells.test.ts` harness (mock session `me-1`, `cosmos-fake`, `createCharacter`). Seed coins via `saveCoins`, then:
- spend within holdings deducts across denominations (e.g. hold `{gp:2, sp:25, cp:0}` → `toCp`=425+250=… ; spend `amountToCp(3,'gp')`=600 exceeds → expect `insufficient funds` 400)
- hold `{gp:3, sp:0, cp:0}` (600cp), spend `amountToCp(3,'gp')`=600 → `{gp:0,sp:0,cp:0}`
- hold `{gp:1, sp:0, cp:0}` (200cp), spend `amountToCp(5,'sp')`=50 → `{gp:0, sp:15, cp:0}` (make-change)
- spend 0 / negative → `rejects` 400

### Verification
#### Automated
- [ ] `pnpm --filter web typecheck` passes
- [ ] `pnpm --filter web test` passes (new `coins-spend.test.ts`)
#### Manual
- [ ] Spend button beside coins opens the form
- [ ] Overspend → inline `insufficient funds`, coins unchanged
- [ ] Spend 5sp while holding only gp → CoinPurse updates with correct change
- [ ] Works on iPhone (numeric keypad, no spinner)

---

## Phase 3: Light-burn tracker (issue #21)

Manual tap-per-turn tracker persisted on the character doc. Lighting a source consumes 1 of its inventory quantity and starts a countdown in the same ETag-guarded write. No automatic clock. Builds on the inventory doc but otherwise standalone.

### Changes

#### 1. Type
**File**: `apps/web/src/lib/cosmos/types.ts`
**Action**: modify — add `ActiveLightDoc` near `InventoryEntryDoc` and an `activeLights?` field on `CharacterDoc` (after line 161, in the optional-embedded block).

```ts
/** A currently-burning light/heat source, tracked in turns (10 min each). */
export interface ActiveLightDoc {
  id: string;
  itemName: string;
  turnsRemaining: number;
  totalTurns: number;
  litAt: string;
}
```
```ts
  activeLights?: ActiveLightDoc[];   // add to CharacterDoc, comment: absent on old docs — default []
```

#### 2. Light source constants
**File**: `apps/web/src/components/character-sheet/inventory/light-data.ts`
**Action**: create — burn durations in turns. **Verify counts against the Dolmenwood Player's Book during implementation** (data-only, trivially adjustable).

```ts
export interface LightSource { name: string; turns: number; icon: string; }

// Dolmenwood: 1 turn = 10 minutes. VERIFY these against the rulebook.
export const LIGHT_SOURCES: LightSource[] = [
  { name: 'Torch',     turns: 6,  icon: '🔥' },  // ~1 hour
  { name: 'Oil Flask', turns: 24, icon: '🪔' },  // lantern, ~4 hours
  { name: 'Candle',    turns: 12, icon: '🕯️' },
  { name: 'Firewood',  turns: 48, icon: '🪵' },  // campfire, ~8 hours
];

/** Match an inventory item name to a known light source (case-insensitive). */
export function lightSourceFor(itemName: string): LightSource | undefined {
  return LIGHT_SOURCES.find(s => s.name.toLowerCase() === itemName.toLowerCase());
}
```

#### 3. Data module
**File**: `apps/web/src/lib/data/light.ts`
**Action**: create — all mutations via `mutateOwnedCharacterDoc` (single ETag write each).

```ts
import { requireAccountId } from '@/lib/auth/session';
import { assertCharacterOwner, badRequest, notFound } from '@/lib/authz';
import type { ActiveLightDoc } from '@/lib/cosmos/types';
import { mutateOwnedCharacterDoc } from './characters';
import { lightSourceFor } from '@/components/character-sheet/inventory/light-data';
```
> If importing a component-dir constant into server code is undesirable, move `light-data.ts` to `apps/web/src/lib/light-data.ts` and import from both places. Decide during impl; keep one source of truth.

Functions:
- `listLights(characterId): Promise<ActiveLightDoc[]>` — `assertCharacterOwner`, return `doc.activeLights ?? []`.
- `lightSource(characterId, itemId): Promise<ActiveLightDoc[]>` — in the mutate callback: find the inventory entry by `itemId` (404 if missing), `if (entry.quantity <= 0) throw badRequest('none left to light')`, `entry.quantity -= 1`; resolve `lightSourceFor(entry.itemName)` (fallback `{turns: 6}` or `badRequest('not a light source')` — pick `badRequest`), push `{ id: crypto.randomUUID(), itemName, turnsRemaining: turns, totalTurns: turns, litAt: new Date().toISOString() }` to `doc.activeLights ??= []`. Return the new array.
- `burnTurn(characterId, lightId, turns = 1): Promise<ActiveLightDoc[]>` — find light (404 if missing), `l.turnsRemaining = Math.max(0, l.turnsRemaining - Math.max(1, turns))`. Return array.
- `extinguish(characterId, lightId): Promise<ActiveLightDoc[]>` — `doc.activeLights = (doc.activeLights ?? []).filter(l => l.id !== lightId)`. Return array.

#### 4. Route
**File**: `apps/web/src/app/api/characters/[id]/light/route.ts`
**Action**: create — `GET` → `listLights`; `POST` dispatch on `body.action`:
```ts
// action: 'light'   → lightSource(id, body.itemId)
// action: 'burn'    → burnTurn(id, body.lightId, body.turns ?? 1)
// action: 'extinguish' → extinguish(id, body.lightId)
// else → 400 invalid action
```
Wrap in `handleRouteError`.

#### 5. Client wrapper
**File**: `apps/web/src/lib/api/light.ts`
**Action**: create — `listLights`, `lightSource`, `burnTurn`, `extinguish` thin fetch wrappers returning `ActiveLightDoc[]` (import the type from `@/lib/cosmos/types`).

#### 6. UI
**File**: `apps/web/src/components/character-sheet/inventory/LightTracker.tsx`
**Action**: create — own hook-free component driven by props from a small `useLight(characterId)` hook (colocate the hook in the same file or `use-light.ts`). Renders:
- A "Light a source" picker: inventory items whose name matches `LIGHT_SOURCES` and `quantity > 0` → tap → `lightSource`.
- Active-light rows (big tabular-nums `turnsRemaining`/`totalTurns`, `BattleModal.tsx` vocabulary): a "Turn passes" button → `burnTurn`; expired (`turnsRemaining === 0`) shows a `var(--color-danger)` "Burned out" state; an ✕ extinguish button (reuse the `ItemRow.tsx:38-46` delete-button shape).
- Empty state when no active lights.

**File**: `apps/web/src/components/character-sheet/InventoryTab.tsx`
**Action**: modify — render `<LightTracker characterId={characterId} items={inv.items} isOwner={isOwner} />` after the Item list (near line 99). Pass `inv.items` so the picker knows what's on hand; the tracker refetches its own light state.
> Lighting decrements an item server-side; to keep the CoinPurse-style optimism, on a successful `lightSource` call, also `inv.setItems(prev => prev.map(i => i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i))`.

#### 7. Test
**File**: `apps/web/src/test/__tests__/light.test.ts`
**Action**: create — harness like `inventory-spells.test.ts`:
- add a `Torch` item qty 2, `lightSource` → torch qty 1, one active light `turnsRemaining === 6`
- `burnTorch` 6× (or `burnTurn` with turns) → `turnsRemaining === 0`
- `lightSource` on a 0-qty item → `rejects` 400
- `extinguish` removes the entry

### Verification
#### Automated
- [ ] `pnpm --filter web typecheck` passes
- [ ] `pnpm --filter web test` passes (new `light.test.ts`)
#### Manual
- [ ] Light a torch → inventory torch −1, tracker shows 6 turns
- [ ] "Turn passes" 6× → burned-out state
- [ ] Relight consumes another torch; reload the page → active lights persist
- [ ] Extinguish removes a light

---

## Cross-phase final checks
- [ ] `pnpm --filter web typecheck` and `pnpm --filter web test` green
- [ ] `pnpm --filter web lint` clean on changed files
- [ ] Each phase committed separately so P1/P2 stand alone if P3 is deferred
