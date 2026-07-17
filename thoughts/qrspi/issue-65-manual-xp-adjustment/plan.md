# Implementation Plan — Manual XP Adjustment (issue #65)

## Overview

DMs get a signed XP correction path (logged as a new `dm_correction` source),
and owners get an explicit "Set total" mode plus honest optimistic-update
handling. All corrections are appended log entries — nothing is edited or
deleted.

Test commands (run in `apps/web/`): `pnpm test` (vitest), `pnpm typecheck`.

---

## Phase 1: DM correction core — `dm_correction` source + loosened `awardXP` + route

### Changes

#### 1. Add the new log source
**File**: `packages/types/src/index.ts`
**Action**: modify (line 186)

```ts
export type XPLogSource = 'dm_award' | 'manual_edit' | 'level_up' | 'dm_correction';
```
`XPLogEntry` (188-196) is unchanged. Update the `actorId` comment to note DM
id also applies to `dm_correction` (optional nicety):
```ts
  actorId: string;     // DM account id for dm_award / dm_correction; owner id otherwise
```

#### 2. Loosen `awardXP` with a correction mode
**File**: `apps/web/src/lib/data/campaigns.ts`
**Action**: modify (`awardXP`, 293-317)

```ts
/** Port of award_xp: DM-of-the-owner's-campaign only, never self.
 *  correction=true allows a signed (non-zero) delta and logs dm_correction. */
export async function awardXP(
  characterId: string,
  gain: number,
  correction = false,
): Promise<void> {
  if (!Number.isInteger(gain) || gain === 0) throw badRequest('XP gain must be a non-zero integer');
  if (!correction && gain < 0) throw badRequest('XP gain must be positive');
  const me = await requireAccountId();
  await mutateCharacterDoc(
    async () => {
      const doc = await fetchCharacterDocById(characterId);
      if (!doc) throw notFound('character');
      if (doc.ownerId === me) throw forbidden(); // no self-award/correct
      if (!(await isDMOfAccount(me, doc.ownerId))) throw forbidden();
      if (correction && doc.xp + gain < 0) throw badRequest('correction would drop XP below 0');
      return doc;
    },
    (doc) => {
      doc.xp += gain;
      doc.xpLog = [...(doc.xpLog ?? []), {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        delta: gain,
        newTotal: doc.xp,
        source: correction ? 'dm_correction' as const : 'dm_award' as const,
        actorId: me,
      }];
    },
  );
}
```
Note: the `doc.xp + gain < 0` guard lives inside the fetch-authorized closure
so it re-checks against the fresh doc on each ETag retry (same as the authz
checks).

#### 3. Route passes the flag
**File**: `apps/web/src/app/api/characters/[id]/award-xp/route.ts`
**Action**: modify (line 11)

```ts
await awardXP(id, Number(body?.gain), Boolean(body?.correction));
```

#### 4. Extend the history-page source maps
**File**: `apps/web/src/app/(app)/characters/[id]/xp-log/page.tsx`
**Action**: modify (12-22) — compiler forces these since both are `Record<XPLogSource, string>`

```ts
const SOURCE_LABELS: Record<XPLogSource, string> = {
  dm_award: 'DM Award',
  manual_edit: 'Manual Edit',
  level_up: 'Level Up',
  dm_correction: 'DM Correction',
};
const SOURCE_ICONS: Record<XPLogSource, string> = {
  dm_award: '🎁',
  manual_edit: '✏️',
  level_up: '⬆',
  dm_correction: '🔧',
};
```

#### 5. Tests
**File**: `apps/web/src/test/__tests__/campaigns.test.ts`
**Action**: modify — add to the `describe('awardXP ...')` block, mirroring the
existing referee/owner/outsider setup (lines 93-120 per research):
- referee correction lowers XP: `awardXP(charId, -50, true)` after an award →
  `store('characters').get(charId)!.xp` decreased by 50; last `xpLog` entry
  `toMatchObject({ source: 'dm_correction', delta: -50, actorId: REFEREE.id })`.
- positive correction: `awardXP(charId, 50, true)` → entry
  `{ source: 'dm_correction', delta: 50 }` (distinct from `dm_award`).
- correction below zero: from `xp: 100`, `awardXP(charId, -500, true)` →
  `rejects.toMatchObject({ status: 400 })`; no log entry appended.
- zero gain rejected in both modes: `awardXP(charId, 0)` and
  `awardXP(charId, 0, true)` → 400.
- self-correct forbidden: owner calls `awardXP(charId, -10, true)` → 403.
- non-DM correct forbidden: outsider → 403.
- existing `dm_award` positive-only cases still pass unchanged.

### Verification
#### Automated
- [x] `pnpm typecheck` passes (proves enum + both source maps updated everywhere)
- [x] `pnpm test` passes, including the new correction cases and all prior
      `awardXP` / `xp-log` / `adjustXP` tests

#### Manual
- [ ] `curl -X POST .../api/characters/<id>/award-xp -d '{"gain":-100,"correction":true}'`
      as a DM lowers XP and adds a `dm_correction` entry (verify via the XP
      History page rendering "DM Correction 🔧")

---

## Phase 2: DM correction UI on the `/view` page

### Changes

#### 1. Client wrapper
**File**: `apps/web/src/lib/api/campaigns.ts`
**Action**: add after `awardXP` (118)

```ts
export async function correctXP(
  characterId: string,
  delta: number,
): Promise<{ error: { message: string } | null }> {
  const res = await fetch(`/api/characters/${characterId}/award-xp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gain: delta, correction: true }),
  });
  if (res.ok) return { error: null };
  return { error: { message: await errorMessage(res) } };
}
```

#### 2. XPBar `variant` prop + DM-correction branch
**File**: `apps/web/src/components/character-sheet/header/XPBar.tsx`
**Action**: modify

- Props (7-13): add
  ```ts
  variant?: 'owner' | 'dm-correction';
  onCorrectXP?: (delta: number) => void | Promise<void>;
  ```
  and destructure with `variant = 'owner'` default (15).
- Derived flag near top of component:
  ```ts
  const isDM = variant === 'dm-correction';
  const editable = !readOnly || isDM;   // DM edits despite the read-only sheet
  ```
- Bar click (44-45): `onClick={() => { if (editable) onToggle(); }}` and
  `cursor: editable ? 'pointer' : 'default'`.
- `commitXPInput` (28-38): branch on variant —
  ```ts
  function commitXPInput() {
    const val = parseInt(xpInputVal, 10);
    if (!isNaN(val) && val !== 0) {
      if (isDM) {
        onCorrectXP?.(val);                         // raw signed delta, no modifier
      } else {
        const gain = val > 0
          ? applyXPModifiers(val, character.characterClass, character.abilityScores as unknown as Record<string, number>, character.kindred)
          : val;
        onAdjustXP?.(Math.max(0, character.xp + gain));
      }
    }
    setXpInputVal('');
    onToggle();
  }
  ```
- Edit block gate (63): `{editable && xpEditOpen && (() => {`
- Label (74-76) and button (93): when `isDM`, always read `'Correct XP:'` /
  `'±XP'` (both signs are corrections); keep the positive-modifier preview
  (96-101) hidden for `isDM` (add `&& !isDM` to `showPreview`).
- Level-up button (107) stays `!readOnly` — DM variant (readOnly sheet) shows
  no level-up button. No change.

#### 3. Thread variant through the header
**File**: `apps/web/src/components/character-sheet/header/types.ts`
**Action**: modify — add to `CharacterSheetHeaderProps`:
```ts
  xpVariant?: 'owner' | 'dm-correction';
  onCorrectXP?: (delta: number) => void | Promise<void>;
```

**File**: `apps/web/src/components/character-sheet/CharacterSheetHeader.tsx`
**Action**: modify — destructure `xpVariant, onCorrectXP` (10); pass to XPBar
(75-81):
```tsx
<XPBar
  character={character}
  readOnly={readOnly}
  xpEditOpen={xpEditOpen}
  onToggle={() => { setXpEditOpen(o => !o); setHpEditOpen(false); }}
  onAdjustXP={onAdjustXP}
  variant={xpVariant}
  onCorrectXP={onCorrectXP}
/>
```

#### 4. Wire the view page
**File**: `apps/web/src/app/(app)/characters/[id]/view/page.tsx`
**Action**: modify

- Import: `import { correctXP } from '@/lib/api/campaigns';`
- Add a handler (near `noopUpdate`, 94):
  ```ts
  async function handleCorrectXP(delta: number) {
    const { error } = await correctXP(id, delta);
    if (error) { alert(error.message); return; }   // matches simple error surfacing on this page
    await fetchCharacter();                          // refetch, no optimistic write
  }
  ```
  (`fetchCharacter` is already a `useCallback` in scope.)
- Header (99-106): add `xpVariant="dm-correction"` and
  `onCorrectXP={handleCorrectXP}`. Keep `readOnly`.

### Verification
#### Automated
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes (no behavior change to owner XPBar path)

#### Manual (`pnpm dev`)
- [ ] As a DM, open a party member from the roster (`MemberList` row) → `/view`
- [ ] Click the XP bar, enter `-1350`, submit → XP drops, page refetches to the
      new total
- [ ] XP History shows a "DM Correction 🔧" entry attributed to the DM
- [ ] Owner's own sheet XPBar behaves exactly as before (default `owner` variant)

---

## Phase 3: Owner Set-mode toggle + optimistic-update fix

### Changes

#### 1. Add/Set mode in XPBar (owner variant only)
**File**: `apps/web/src/components/character-sheet/header/XPBar.tsx`
**Action**: modify

- State (16): `const [xpMode, setXpMode] = useState<'add' | 'set'>('add');`
- `commitXPInput` owner branch: when `xpMode === 'set'`, treat the input as the
  absolute total:
  ```ts
  } else if (xpMode === 'set') {
    if (!isNaN(val) && val >= 0) onAdjustXP?.(val);   // typed value is the new total, no modifier
  } else {
    // existing add-mode logic (modifier on positive)
  }
  ```
  (Adjust the outer `val !== 0` guard so Set mode allows `0`; keep NaN-guard.)
- In the edit block (owner, `!isDM`), render a small two-button Add/Set toggle
  above the input that flips `xpMode`. Label switches to `'Set XP total:'` in
  set mode; suppress the modifier preview in set mode (`showPreview && xpMode === 'add'`).

#### 2. Reconcile failed owner adjust
**File**: `apps/web/src/app/(app)/characters/[id]/page.tsx`
**Action**: modify (`handleAdjustXP`, 51-55)

```ts
async function handleAdjustXP(newTotal: number) {
  if (!character) return;
  const prevXp = character.xp;
  setCharacter(prev => prev ? { ...prev, xp: newTotal } : prev);
  const error = await adjustXP(character.id, newTotal);
  if (error) {
    setCharacter(prev => prev ? { ...prev, xp: prevXp } : prev);
    alert(error);   // adjustXP returns the error string or null
  }
}
```

### Verification
#### Automated
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes (owner `adjustXP` server behavior unchanged; Set-mode
      is pure client conversion)

#### Manual (`pnpm dev`)
- [ ] As owner, open the XP editor, toggle **Set**, type an exact total (e.g.
      `2000`) → XP becomes exactly 2000, XP History logs a `manual_edit` entry
      with the correct signed delta
- [ ] **Add** mode still applies the XP modifier on positive input as before
- [ ] Simulate a failed adjust (e.g. offline / blocked request) → on-screen XP
      reverts to the prior value and an error is surfaced

---

## Notes / Deviations from structure.md

- No deviations in phase order or scope. `award-xp/route.ts` coerces
  `correction` with `Boolean(body?.correction)` (parallels the existing
  `Number(body?.gain)` coercion).
- `alert(...)` is used for error surfacing on the view page and owner sheet to
  match the codebase's existing lightweight error handling for these flows; if
  a toast/inline-error pattern is preferred, swap it in — not required by the
  design.
- Zero-gain is now rejected with a mode-agnostic message ("XP gain must be a
  non-zero integer"); the existing zero-gain test expecting 400 still passes.
