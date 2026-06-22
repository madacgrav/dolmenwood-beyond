# Implementation Plan

## Overview

Close the genuine gaps from the audit as seven independent, separately-mergeable
slices: refresh the stale dev doc, finish the manual creation wizard (steps 8–13),
wire the three optional-rules toggles to real behavior, compute real equipped-armor AC
on the sheet and roster, delete the orphaned `/party` stub, ship real PWA icons, and add
a dice-roller tab.

Verify commands (repo root): `pnpm --filter @dolmenwood/web typecheck` ·
`pnpm --filter @dolmenwood/web build` · `pnpm --filter @dolmenwood/rules-engine test` ·
`pnpm dev` for manual checks.

Note on S4: the structure assumed the Combat tab computed real armor/kindred AC; it does
not (`CombatTab.tsx:46` hardcodes `equippedArmorBonus = 0`, `kindredACBonus: 0`). Per the
user decision, S4 now implements real equipped-armor AC in **both** the sheet and the
roster. This is the only deviation from `structure.md`.

---

## Phase S1: Refresh `copilot-instructions.md`

### Changes

#### 1. Update stale claims
**File**: `.github/copilot-instructions.md`
**Action**: modify (prose only)

- Repo-structure block (line ~31): change `campaign/  # stub (coming soon)` to reflect
  the built surface (overview / bank / schedule tabs). Add that `party/` is an unused
  orphan stub not linked in nav.
- Add a short "Implementation status" note: auto + import creation paths complete; manual
  wizard now complete through step 13 (after S2); optional-rules toggles wired (after S3);
  PWA icons are real PNGs (after S6).
- Leave all other conventions intact.

> Sequencing: write S1 to describe the **post-S2/S3/S6 target state**, so it doesn't need
> re-touching after those phases land. If S2/S3/S6 are dropped, adjust the two lines that
> reference them.

### Verification
#### Automated
- [x] No build impact (docs only).
#### Manual
- [ ] Every claim cross-checks against `research.md` (campaign built, `/party` orphan,
  manual completes through 13).

---

## Phase S2: Manual wizard steps 8–13

Render the six missing manual steps by parameterizing the shared auto components with a
`basePath` prop (mirroring steps 2–6) and removing the `step > 7` gate. The manual
`complete` page already saves (`manual/complete/page.tsx:34`), so no save work is needed.

### Changes

#### 1. Parameterize navigation in six step components
**Files** (all `apps/web/src/components/wizard/steps/`): `Step8Equipment.tsx`,
`Step9AC.tsx`, `Step10Speed.tsx`, `Step11Alignment.tsx`, `Step12LevelXP.tsx`,
`Step13Details.tsx`
**Action**: modify

For each, add a `basePath` prop defaulting to the current auto path, then replace every
hardcoded `'/characters/new/auto/…'` literal (both `router.push(...)` and
`WizardProgress onBack={...}`) with a template using `basePath`. Example (Step11):

```tsx
// signature
export function Step11Alignment({ basePath = '/characters/new/auto' }: { basePath?: string }) {
  // ...
  function handleSelect(a: Alignment) {
    setAlignment(a);
    router.push(`${basePath}/12`);          // was '/characters/new/auto/12'
  }
  // WizardProgress onBack={() => router.push(`${basePath}/10`)}  // was '/auto/10'
```

Exact literals to convert per file:
- `Step8Equipment.tsx`: onBack `…/7`; Continue `…/9` (`:71`, `:141`).
- `Step9AC.tsx`: onBack `…/8`; Continue `…/10` (`:27`, `:63`).
- `Step10Speed.tsx`: onBack `…/9`; Continue `…/11` (`:24`, `:62`).
- `Step11Alignment.tsx`: onBack `…/10`; handleSelect `…/12` (`:45`, `:50`).
- `Step12LevelXP.tsx`: onBack `…/11`; Continue `…/13` (`:26`, `:82`).
- `Step13Details.tsx`: onBack `…/12` (`:68`); handleContinue `…/complete` (`:62`).

> Auto path unaffected: the `auto/[step]/page.tsx` map renders these with no `basePath`
> arg, so the default keeps auto behavior identical. Equipment/AC/Speed/Level stay
> display-only for both paths (parity preserved — neither path persists equipment).

#### 2. Wire steps 8–13 into the manual route
**File**: `apps/web/src/app/(app)/characters/new/manual/[step]/page.tsx`
**Action**: modify

- Add imports for the six components.
- Delete the `if (step > 7) { … coming soon … }` block (`:36-51`).
- Extend the switch (`:53-70`) with cases 8–13, each passing `basePath={BASE}`:

```tsx
case 8:  return <Step8Equipment basePath={BASE} />;
case 9:  return <Step9AC basePath={BASE} />;
case 10: return <Step10Speed basePath={BASE} />;
case 11: return <Step11Alignment basePath={BASE} />;
case 12: return <Step12LevelXP basePath={BASE} />;
case 13: return <Step13Details basePath={BASE} />;
```

### Verification
#### Automated
- [x] `pnpm --filter @dolmenwood/web typecheck` passes
- [x] `pnpm --filter @dolmenwood/web build` passes
#### Manual
- [ ] Walk `/characters/new/manual/1` → 13 → complete; character saves, opens its sheet.
- [ ] Back buttons on steps 8–13 stay within `/manual/*`.
- [ ] Auto path `/characters/new/auto/1` → complete still works (regression).

---

## Phase S3: Wire the three optional-rules toggles

`useOptionalRules()` returns `[rules, setRules]` with `subParReroll`, `hpRerollLowRolls`,
`coinWeightEnabled` (`hooks/use-optional-rules.ts:4-7`). Read `[rules]` in each surface.

### Changes

#### 1. Coin-weight rule in rules-engine
**File**: `packages/rules-engine/src/speed.ts`
**Action**: modify — add export (auto-exported via existing `export * from './speed'`)

```ts
/** Each coin weighs 1 coin-weight unit (Dolmenwood encumbrance is measured in coins). */
export function calculateCoinWeight(coins: { gp: number; sp: number; cp: number; pp?: number }): number {
  return coins.gp + coins.sp + coins.cp + (coins.pp ?? 0);
}
```

**File**: `packages/rules-engine/src/__tests__/speed.test.ts`
**Action**: modify — add cases: `calculateCoinWeight({gp:0,sp:0,cp:0})===0`,
`calculateCoinWeight({gp:100,sp:50,cp:10})===160`, `pp` counted when present.

#### 2. Consume coin weight in the inventory tab
**File**: `apps/web/src/components/character-sheet/inventory/WeightBar.tsx`
**Action**: modify — add optional prop, fold into total:

```tsx
export function WeightBar({ items, coinWeight = 0 }: { items: DBInventoryItem[]; coinWeight?: number }) {
  const itemWeight = items.reduce((s, i) => i.location === 'tiny' ? s : s + i.weight_coins * i.quantity, 0);
  const totalWeight = itemWeight + coinWeight;          // coins add when enabled
  // …rest unchanged (speed = calculateSpeed(totalWeight))
```

**File**: `apps/web/src/components/character-sheet/InventoryTab.tsx`
**Action**: modify — compute and pass:

```tsx
import { calculateCoinWeight } from '@dolmenwood/rules-engine';
import { useOptionalRules } from '@/hooks/use-optional-rules';
// inside component:
const [rules] = useOptionalRules();
const coinWeight = rules.coinWeightEnabled ? calculateCoinWeight(inv.coins) : 0;
// <WeightBar items={inv.items} coinWeight={coinWeight} />
```

#### 3. Gate sub-par banner behind `subParReroll`
**Files**: `apps/web/src/components/wizard/steps/Step1AbilityScores.tsx` (banner `:73`),
`apps/web/src/components/wizard/steps/ManualStep1AbilityScores.tsx` (banner `:146`)
**Action**: modify — add `const [rules] = useOptionalRules();` and change each
`{subpar && (` to `{subpar && rules.subParReroll && (`.

#### 4. HP low-roll reroll behind `hpRerollLowRolls`
**File**: `apps/web/src/components/wizard/steps/Step7HP.tsx`
**Action**: modify — gate the existing bad-roll UI (currently always shown). Add
`const [rules] = useOptionalRules();`; change banner (`:59`) and reroll button (`:77`)
conditions from `isBadRoll` to `isBadRoll && rules.hpRerollLowRolls`.

**File**: `apps/web/src/components/wizard/steps/ManualStep7HP.tsx`
**Action**: modify — track the last rolled die and show a hint when enabled:

```tsx
const [rules] = useOptionalRules();
const [lastRoll, setLastRoll] = useState<number | null>(null);
function rollHP() { const r = rollDie(dieSides); setLastRoll(r); setHp(Math.max(1, r + conMod)); }
// after the Roll button, render when rules.hpRerollLowRolls && lastRoll !== null && lastRoll <= 2:
//   a small gold hint "Bad luck — roll again?" (re-uses the existing 🎲 Roll button)
```

**File**: `apps/web/src/app/(app)/characters/[id]/level-up/components/HPRollStep.tsx`
**Action**: modify — add an opt-in reroll. Add `const [rules] = useOptionalRules();`, a
`reroll()` that rolls again and re-commits, and a button shown only when allowed:

```tsx
function reroll() {
  const rolled = rollDie(hitDie as DieType);
  setRoll(rolled);
  onHpGain(Math.max(1, rolled + conMod));
}
// render before Continue, when: done && rules.hpRerollLowRolls && roll !== null && roll <= 2
//   <button onClick={reroll}>Re-roll (bad luck)</button>
```

### Verification
#### Automated
- [x] `pnpm --filter @dolmenwood/rules-engine test` passes (new `calculateCoinWeight` cases)
- [x] `pnpm --filter @dolmenwood/web typecheck` passes
#### Manual (Settings → Optional Rules)
- [ ] Enable **Coin Weight** → Inventory tab carried-weight/speed change with coins on hand.
- [ ] Disable **Sub-Par Re-roll** → low-roll banner no longer appears on step 1 (auto+manual).
- [ ] Enable **HP reroll** → rolling 1–2 HP offers a re-roll in creation step 7 and level-up.

---

## Phase S4: Real equipped-armor AC (sheet + roster)

Compute equipped-armor AC from `character_inventory.armor_ac_bonus` (`location='equipped'`)
plus `getKindredACBonus(kindred)`, in both the Combat tab and the roster card.

### Changes

#### 1. Armor-bonus queries
**File**: `apps/web/src/lib/data/inventory.ts`
**Action**: modify — add two helpers:

```ts
/** Sum of armor_ac_bonus over a character's equipped items. */
export async function fetchEquippedArmorBonus(supabase: SupabaseClient, characterId: string): Promise<number> {
  const { data } = await supabase.from('character_inventory')
    .select('armor_ac_bonus').eq('character_id', characterId).eq('location', 'equipped');
  return (data ?? []).reduce((s, r: Record<string, unknown>) => s + ((r.armor_ac_bonus as number) ?? 0), 0);
}

/** Batched: armor bonus per character id (one query for the roster). */
export async function fetchEquippedArmorBonuses(supabase: SupabaseClient, characterIds: string[]): Promise<Record<string, number>> {
  if (characterIds.length === 0) return {};
  const { data } = await supabase.from('character_inventory')
    .select('character_id, armor_ac_bonus').in('character_id', characterIds).eq('location', 'equipped');
  const map: Record<string, number> = {};
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    const id = r.character_id as string;
    map[id] = (map[id] ?? 0) + ((r.armor_ac_bonus as number) ?? 0);
  }
  return map;
}
```

#### 2. Sheet Combat tab
**File**: `apps/web/src/components/character-sheet/CombatTab.tsx`
**Action**: modify
- Import `getKindredACBonus` and `fetchEquippedArmorBonus`.
- Replace `const equippedArmorBonus = 0;` (`:46`) with state loaded in a `useEffect`
  (alongside the existing `listEquippedWeapons` effect): `fetchEquippedArmorBonus(supabase, characterId).then(setEquippedArmorBonus)`.
- In `calculateAC` (`:47`), set `armorBonus: equippedArmorBonus` and
  `kindredACBonus: getKindredACBonus(character.kindred)`.

#### 3. Roster card + hook + page
**File**: `apps/web/src/components/characters/CharacterCard.tsx`
**Action**: modify — accept armor bonus, drop the TODO zeros:

```tsx
import { calculateAC, getAttackBonus, getKindredACBonus } from '@dolmenwood/rules-engine';
interface CharacterCardProps { character: Character; armorBonus?: number; onDelete: (id: string) => Promise<unknown>; }
export function CharacterCard({ character, armorBonus = 0, onDelete }: CharacterCardProps) {
  const ac = calculateAC({
    dexScore: character.abilityScores.dex,
    armorBonus,
    kindredACBonus: getKindredACBonus(character.kindred),
    classACBonus: 0, shieldBonus: 0,
  });
```

**File**: `apps/web/src/hooks/use-characters.ts`
**Action**: modify — after `listCharacters`, fetch the batched map and return it:

```ts
const [armorByCharacter, setArmorByCharacter] = useState<Record<string, number>>({});
// in fetchCharacters(), after setCharacters(mapped):
setArmorByCharacter(await fetchEquippedArmorBonuses(supabase, mapped.map(c => c.id)));
// return { characters, armorByCharacter, loading, error, deleteCharacter };
```

**File**: `apps/web/src/app/(app)/characters/page.tsx`
**Action**: modify — pull `armorByCharacter` from the hook and pass per card:
`<CharacterCard … armorBonus={armorByCharacter[character.id] ?? 0} />`.

> Limitation (acceptable): the roster realtime subscription watches `characters`, not
> `character_inventory`, so armor-bonus changes refresh on next load, not live. HP still
> updates live. No schema change.

### Verification
#### Automated
- [ ] `pnpm --filter @dolmenwood/web typecheck` + `build` pass
#### Manual
- [ ] Equip an armour item (with an AC bonus) in the Inventory tab; the Combat tab AC
  increases by that bonus, and the roster card shows the **same** AC.
- [ ] A character of a kindred with an AC bonus (e.g. Breggle/Elf) reflects it in both.

---

## Phase S5: Remove `/party` stub

### Changes
#### 1. Delete the route
**File**: `apps/web/src/app/(app)/party/page.tsx`
**Action**: delete (and the now-empty `party/` directory).

#### 2. Confirm no references
- Grep `/party` across `apps/web/src`; expect no `Link`/`router.push` targets (BottomNav
  uses `/campaign`). Remove any stragglers found.

### Verification
#### Automated
- [ ] `pnpm --filter @dolmenwood/web build` passes
- [ ] `grep -rn "/party" apps/web/src` returns nothing (or only unrelated substrings)
#### Manual
- [ ] Navigating to `/party` 404s.

---

## Phase S6: Real PWA icons

### Changes
#### 1. Generate raster icons
**Files**: `apps/web/public/icons/icon-192.png`, `apps/web/public/icons/icon-512.png` (new)
**Action**: create — render from the existing `icon.svg`.

Primary: throwaway Node script using `sharp` if available —
`npx --yes sharp-cli -i apps/web/public/icons/icon.svg -o apps/web/public/icons/icon-512.png resize 512 512`
(and 192). **If `sharp`/codegen is unavailable**: export the two PNGs from any image tool
(or an online SVG→PNG converter) at 192×192 and 512×512 and drop them in `public/icons/`.
Each PNG should be a solid `#1a1510` background with the gold sword glyph centered
(matching `icon.svg`), suitable for `purpose: "any maskable"`.

#### 2. Reference them in the manifest
**File**: `apps/web/public/manifest.json`
**Action**: modify — replace the single SVG `icons` entry with:

```json
"icons": [
  { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
  { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" },
  { "src": "/icons/icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any" }
]
```

### Verification
#### Automated
- [ ] `pnpm --filter @dolmenwood/web build` passes
#### Manual
- [ ] DevTools → Application → Manifest lists both PNG icons with no warnings; install
  prompt shows the raster icon.

---

## Phase S7: Dice-roller tab

### Changes
#### 1. Dice page
**File**: `apps/web/src/app/(app)/dice/page.tsx` (new)
**Action**: create — a `'use client'` page using existing primitives:

```tsx
'use client';
import { useState } from 'react';
import { rollDie, rollFromNotation, type DieType } from '@dolmenwood/rules-engine';

const DICE: DieType[] = [4, 6, 8, 10, 12, 20, 100];
export default function DicePage() {
  const [history, setHistory] = useState<{ label: string; value: number }[]>([]);
  const [notation, setNotation] = useState('');
  const add = (label: string, value: number) => setHistory(h => [{ label, value }, ...h].slice(0, 20));
  // buttons: DICE.map(d => onClick={() => add(`d${d}`, rollDie(d))})
  // notation input + Roll button: try { add(notation, rollFromNotation(notation)) } catch { /* invalid */ }
  // render latest result large + a history list; all 44px+ touch targets, theme tokens
}
```

No store/DB; ephemeral client state only.

#### 2. Nav entry
**File**: `apps/web/src/components/layout/BottomNav.tsx`
**Action**: modify — add to `BASE_NAV_ITEMS` (`:12-17`):
`{ href: '/dice', label: 'Dice', icon: '🎲' }` (insert before Settings).

### Verification
#### Automated
- [ ] `pnpm --filter @dolmenwood/web typecheck` + `build` pass
#### Manual
- [ ] Dice tab reachable from BottomNav; tapping a die shows a result and appends history.
- [ ] Notation like `2d6` rolls; invalid input is ignored without crashing.
- [ ] At 375px the nav (now 5 items, 6 with admin) fits without overflow.

---

## Final regression pass
- [ ] `pnpm typecheck` (all packages) passes
- [ ] `pnpm test` (rules-engine + web) passes
- [ ] `pnpm --filter @dolmenwood/web build` passes
