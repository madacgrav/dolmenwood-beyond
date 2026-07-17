# Implementation Plan

## Overview
Bring the character sheet to selective parity with the printed Dolmenwood sheet:
surface stored identity fields, add a Magic Resistance row, add Exploring/Overland
movement (and fix the hardcoded Speed source), add a Kindred & Class Traits box,
and fix two naming/enum nits. Commands: `pnpm typecheck`, `pnpm test`, `pnpm lint`.

> Deviation from structure.md (Phase 3): `getMagicResistance` returns a **modifier**
> (WIS mod + kindred bonus), not a d20 save target. Magic Resistance renders as a
> signed modifier (e.g. `+2`), non-rollable — not `{n}+`.

---

## Phase 1: Identity fields in header

### Changes

#### 1. Header detail lines
**File**: `apps/web/src/components/character-sheet/CharacterSheetHeader.tsx`
**Action**: modify — after the subtitle `<p>` (`:55-57`), add a details block that renders only the present fields.

```tsx
{(character.alignment || character.moonSign || character.background) && (
  <div style={{ margin: '0 0 0.625rem', fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.75rem' }}>
    {character.alignment && <span><strong style={{ fontWeight: 600 }}>Alignment:</strong> {character.alignment}</span>}
    {character.moonSign && <span><strong style={{ fontWeight: 600 }}>Moon Sign:</strong> {character.moonSign}</span>}
    {character.background && <span><strong style={{ fontWeight: 600 }}>Background:</strong> {character.background}</span>}
  </div>
)}
```
Move the `margin-bottom` off the subtitle `<p>` if the spacing doubles up (set its bottom margin to `0.125rem` when the details block renders — simplest: keep `<p>` as-is, the block adds its own bottom margin).

### Verification
#### Automated
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes
#### Manual
- [ ] Character with alignment/moonSign/background → all three lines show under name
- [ ] Character missing all three → no empty labels, no stray gap
- [ ] View page (`/characters/[id]/view`) shows the same (header is shared)

---

## Phase 2: Naming + item_type reconcile

### Changes

#### 1. INT label
**File**: `apps/web/src/components/character-sheet/stats/AbilityScoresSection.tsx`
**Action**: modify `:9` — `label: 'Intellect'` → `label: 'Intelligence'`.

#### 2. Item-type enum + labels
**File**: `apps/web/src/components/character-sheet/inventory/types.ts`
**Action**: modify — replace `ITEM_TYPES` (`:18`) with the model enum and add a display-label map.

```ts
export const ITEM_TYPES = ['weapon', 'armor', 'gear', 'spell_component', 'ammo', 'coin'] as const;
export type ItemType = typeof ITEM_TYPES[number];

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  weapon: 'Weapon', armor: 'Armour', gear: 'Gear',
  spell_component: 'Spell Component', ammo: 'Ammo', coin: 'Coin',
};
```

#### 3. AddItemForm option labels + armour check
**File**: `apps/web/src/components/character-sheet/inventory/AddItemForm.tsx`
**Action**: modify.
- `:101` option render → `{ITEM_TYPES.map(t => <option key={t} value={t}>{ITEM_TYPE_LABELS[t]}</option>)}` (import `ITEM_TYPE_LABELS`).
- `:138` AC-field trigger `newItem.item_type === 'armour'` → `=== 'armor'`.
- Weapon trigger `:129` unchanged (`'weapon'` still valid).

#### 4. Add-item default
**File**: `apps/web/src/components/character-sheet/inventory/use-add-item.ts`
**Action**: verify the default `newItem.item_type` is a valid enum member (e.g. `'gear'`); if it's `'armour'`/`'consumable'`/`'other'`, change to a valid value.

### Verification
#### Automated
- [x] `pnpm test` — `inventory-spells.test.ts` passes
- [x] `pnpm typecheck` passes (catches any remaining `'armour'`/`'consumable'`/`'other'` literal)
- [x] `rg "'armour'|'consumable'|'other'" apps/web/src` returns no live item-type usages (also fixed: `use-add-item.ts` armor→armour catalog mapping removed; `use-restock.ts` ammo restock now `'ammo'` not `'consumable'`; test literals updated)
#### Manual
- [ ] INT card reads "Intelligence"
- [ ] Add-item type dropdown shows Weapon/Armour/Gear/Spell Component/Ammo/Coin; selecting Armour reveals the AC field; Weapon reveals damage dice
- [ ] Equipped armour still contributes to AC (derivation keys off `armorAcBonus`/`isShield`, not `item_type`)

---

## Phase 3: Magic Resistance row

### Changes

#### 1. Kindred magic-resistance accessor
**File**: `packages/rules-engine/src/retainers.ts` (co-locate with `getMagicResistance`) — or a kindreds helper if one exists.
**Action**: add a reader for the kindred's `magicResistance` from `kindreds.json`.

```ts
import kindreds from './data/kindreds.json';

export function getKindredMagicResistance(kindred: string): number {
  const k = (kindreds as Array<{ id?: string; name?: string; magicResistance?: number }>)
    .find(k => k.id === kindred || k.name === kindred);
  return k?.magicResistance ?? 0;
}
```
Match the lookup key to how existing helpers resolve kindred (mirror `getKindredACBonus` in `packages/rules-engine/src/` — check whether it matches on `id` or `name` and copy that).

**File**: `packages/rules-engine/src/index.ts`
**Action**: export `getKindredMagicResistance` (`getMagicResistance` is already exported).

#### 2. Compute + pass MR in both tab containers
**File**: `apps/web/src/components/character-sheet/StatsTab.tsx`
**Action**: modify.
```ts
import { getMagicResistance, getKindredMagicResistance } from '@dolmenwood/rules-engine';
const magicResistance = getMagicResistance(character.abilityScores.wis, getKindredMagicResistance(character.kindred));
```
Pass `magicResistance={magicResistance}` to `<SavingThrowsSection />` (`:57`).

**File**: `apps/web/src/components/character-sheet/CombatTab.tsx`
**Action**: same computation; pass `magicResistance` to its `SavingThrowsSection`.

#### 3. Render MR row (stats variant — static)
**File**: `apps/web/src/components/character-sheet/stats/SavingThrowsSection.tsx`
**Action**: modify — add `magicResistance: number` to `Props`, import `formatMod` from `./shared`, append one row after the mapped saves inside the card:
```tsx
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.625rem 0.875rem', borderTop: '1px solid var(--color-border)' }}>
  <span style={{ fontSize: '0.85rem', color: 'var(--color-text)' }}>Magic Resistance</span>
  <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatMod(magicResistance)}</span>
</div>
```
(Change the last mapped row's `borderBottom` logic isn't needed — the appended row uses `borderTop`.) Update the footer note to mention MR is a bonus to saves vs magic.

#### 4. Render MR row (combat variant — static, non-button)
**File**: `apps/web/src/components/character-sheet/combat/SavingThrowsSection.tsx`
**Action**: modify — add `magicResistance: number` to `Props`, import `formatMod` from `./shared`, append a non-interactive `<div>` row (same markup as above) after the mapped `<button>`s. MR is not rollable (it modifies magic saves), so it stays a plain row.

### Verification
#### Automated
- [ ] `pnpm test` — add to `packages/rules-engine/src/__tests__/retainers.test.ts`: `getKindredMagicResistance` returns the JSON bonus for a magic-resistant kindred and `0` otherwise; a combined case `getMagicResistance(16, getKindredMagicResistance(<that kindred>))`
- [ ] `pnpm typecheck` passes
#### Manual
- [ ] WIS 16 character of a magic-resistant kindred (`kindreds.json:181,260`) → Magic Resistance shows the summed modifier (e.g. `+4`)
- [ ] WIS 9 human → shows `-1` (or `+0`); row present in both Stats and Combat tabs
- [ ] Combat MR row is not clickable/rollable

---

## Phase 4: Kindred & Class Traits box

### Changes

#### 1. Domain + doc types
**File**: `packages/types/src/index.ts`
**Action**: add `traits?: string;` to the `Character` interface (near `background`, `:72`).

**File**: `apps/web/src/lib/cosmos/types.ts`
**Action**: add `traits: string | null;` to `CharacterDoc` (near `background`, `:145`).

#### 2. Mapper (single source of truth)
**File**: `apps/web/src/lib/data/mappers/character.ts`
**Action**: modify three spots.
- `docToCharacter` (`:21-45`): add `traits: doc.traits ?? undefined,`.
- `newCharacterToDoc` (`:99-138`): add `traits: null,`.
- `UPDATABLE_FIELDS` (`:142-154`): add `'traits',` so PATCH can write it.

#### 3. TraitsSection component
**File**: `apps/web/src/components/character-sheet/stats/TraitsSection.tsx`
**Action**: create — debounced autosave textarea, copied from `NotesTab` `GeneralNotes` (`NotesTab.tsx:18-52`), saving `onUpdate({ traits: value })`.

```tsx
'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import type { CharacterWithNotes } from '@dolmenwood/types';
import { sectionHead } from './shared';

interface Props {
  traits?: string;
  onUpdate: (updates: Partial<CharacterWithNotes>) => void;
  readOnly?: boolean;
}
type SaveStatus = 'idle' | 'saving' | 'saved';

export function TraitsSection({ traits, onUpdate, readOnly }: Props) {
  const [text, setText] = useState(traits ?? '');
  const [status, setStatus] = useState<SaveStatus>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { setText(traits ?? ''); }, [traits]);

  const triggerSave = useCallback((value: string) => {
    if (timer.current) clearTimeout(timer.current);
    setStatus('saving');
    timer.current = setTimeout(async () => {
      await onUpdate({ traits: value });
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2000);
    }, 1000);
  }, [onUpdate]);

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <h3 style={sectionHead}>Kindred &amp; Class Traits</h3>
        <span style={{ fontSize: '0.75rem', color: status === 'saved' ? 'var(--color-primary)' : status === 'saving' ? 'var(--color-gold)' : 'transparent', transition: 'color 0.3s' }}>
          {status === 'saved' ? 'Saved ✓' : status === 'saving' ? 'Saving…' : '·'}
        </span>
      </div>
      <textarea
        value={text}
        onChange={e => { if (!readOnly) { setText(e.target.value); triggerSave(e.target.value); } }}
        readOnly={readOnly}
        placeholder="Special abilities, class features, kindred traits…"
        style={{ width: '100%', minHeight: '140px', padding: '0.875rem', borderRadius: '10px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '0.9rem', lineHeight: 1.6, resize: readOnly ? 'none' : 'vertical', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }}
      />
    </section>
  );
}
```

#### 4. Mount in Stats tab
**File**: `apps/web/src/components/character-sheet/StatsTab.tsx`
**Action**: import `TraitsSection`; render `<TraitsSection traits={character.traits} onUpdate={onUpdate} readOnly={readOnly} />` after `AbilityScoresSection`/`CombatStatsSection` (front-of-sheet placement).

### Verification
#### Automated
- [ ] `pnpm test` — add to `characters-data.test.ts` (or `migration-transform.test.ts`): a doc with `traits` round-trips through `docToCharacterWithNotes` → `applyCharacterUpdates({ traits: 'x' })` → doc has `traits: 'x'`; a doc without `traits` maps to `undefined` (no crash)
- [ ] `pnpm typecheck` passes
#### Manual
- [ ] Type in Traits box → "Saving…" → "Saved ✓"; reload → text persists
- [ ] View page shows the traits read-only (no editable textarea, no save indicator firing)
- [ ] Existing character (doc without `traits`) opens with an empty box, no error

---

## Phase 5: Movement — fix Speed source + Exploring/Overland

> **Blocked on data.** The exact Speed→Exploring→Overland numbers must come from the
> Dolmenwood Player's Book (`Dolmenwood_Player_s_Book.pdf`, repo root). Do NOT ship the
> table below unconfirmed. The Speed-source **fix** (step 2) is independent and safe to
> ship even if the table is deferred. If numbers can't be confirmed, ship steps 1(speed
> fix)+3(Speed pill from real weight) and defer Exploring/Overland pills.

### Changes

#### 1. Movement derivations
**File**: `packages/rules-engine/src/speed.ts`
**Action**: add two functions. **Placeholder values — confirm against rulebook.**
```ts
// PLACEHOLDER — confirm exact table from Dolmenwood Player's Book before shipping.
// B/X convention: exploration ft/turn = 3× encounter ft/round.
export function getExplorationRate(speed: 10 | 20 | 30 | 40): number {
  return speed * 3; // 40→120, 30→90, 20→60, 10→30 ft/turn
}
export function getOverlandRate(speed: 10 | 20 | 30 | 40): number {
  // Travel Points/day — NO confirmed formula yet. Fill from rulebook.
  throw new Error('getOverlandRate: table not yet sourced');
}
```
**File**: `packages/rules-engine/src/index.ts`
**Action**: export both.

#### 2. Fix hardcoded speed source
**File**: `apps/web/src/components/character-sheet/StatsTab.tsx`
**Action**: replace `const speed = calculateSpeed(0);` (`:32`). Compute real equipped weight the way `WeightBar.tsx:12-17` does. StatsTab does not currently load inventory; the character page already fetches inventory for AC (`acItems` in `[id]/page.tsx:95`). Pass the equipped-weight total (or the raw items) into StatsTab as a prop and compute `calculateSpeed(totalWeight)`.
- Add prop `equippedWeight: number` (or reuse the `acItems` list) to `StatsTab` `Props`.
- In `[id]/page.tsx` and `view/page.tsx`, compute `equippedWeight` from the same inventory list used for `deriveCharacterAC`, summing non-tiny `weight_coins * quantity` (+ coin weight if `coinWeightEnabled`), and pass it to `StatsTab`.
- `const speed = calculateSpeed(equippedWeight);`

> ponytail: if threading a new prop is heavy, the minimal fix is to keep StatsTab
> reading a weight it already has access to; do not duplicate the weight formula in a
> third place — extract a shared `sumCarriedWeight(items)` helper if it lands in >2 spots.

#### 3. Show three movement pills
**File**: `apps/web/src/components/character-sheet/stats/CombatStatsSection.tsx`
**Action**: modify — add `exploring: number` and `overland: number | null` to `Props`; render pills:
```tsx
<StatPill label="Speed" value={`${speed}′`} color="var(--color-text)" />
<StatPill label="Exploring" value={`${exploring}′`} color="var(--color-text)" />
{overland != null && <StatPill label="Overland" value={`${overland} pts`} color="var(--color-text)" />}
```
**File**: `apps/web/src/components/character-sheet/StatsTab.tsx`
**Action**: compute `exploring = getExplorationRate(speed)`; `overland` only once the rulebook formula is in (else pass `null` and the pill hides).

### Verification
#### Automated
- [ ] `pnpm test` — add `speed.test.ts` cases for `getExplorationRate` at 10/20/30/40; add `getOverlandRate` cases once the formula is confirmed
- [ ] `pnpm typecheck` passes
#### Manual
- [ ] Lightly-loaded character → Speed 40′ (as before)
- [ ] Load a character past 400/600/800-coin thresholds → Stats Speed pill drops and **matches** the Inventory `WeightBar` value (the always-40′ bug is gone)
- [ ] Exploring pill present and consistent with Speed; Overland pill only appears once its formula is confirmed

---

## Cross-phase notes
- No DB migration: Cosmos is schemaless; `traits` reads back `undefined`/`null` for existing docs.
- No new API routes: identity fields and `traits` ride the existing `PATCH /api/characters/[id]`.
- Every new section takes `readOnly` and is threaded through both `[id]/page.tsx` and `[id]/view/page.tsx`.
- PDF exporter (`lib/pdf/character-sheet.ts`) currently leaves Magic Resistance/Exploring/Overland blank; wiring it to the new values is out of scope for this plan.
