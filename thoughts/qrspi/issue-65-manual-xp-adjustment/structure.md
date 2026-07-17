# Structure Outline — Manual XP Adjustment (issue #65)

## Approach

Three vertical slices. Phase 1 lands the audit-honest DM correction core
(types → data → route → tests) — API-complete and independently valuable.
Phase 2 wires the DM correction UI onto the existing `/view` page. Phase 3 is
owner-side UX (Set-mode toggle + optimistic-update fix), independent of 1–2.

Test cmd (run in `apps/web/`): `pnpm test` (`vitest run`) and
`pnpm typecheck` (`tsc --noEmit`).

---

## Phase 1: DM correction core — `dm_correction` source + loosened `awardXP` + route

Add the new log source and a correction mode to `awardXP`, expose it on the
existing `award-xp` route via a `correction` flag. End-to-end minus UI: a DM
can POST a signed correction and it lands in the log as `dm_correction`.

**Files**:
- `packages/types/src/index.ts` — extend `XPLogSource`
- `apps/web/src/lib/data/campaigns.ts` — `awardXP` signature + branch
- `apps/web/src/app/api/characters/[id]/award-xp/route.ts` — pass `correction`
- `apps/web/src/app/(app)/characters/[id]/xp-log/page.tsx` — extend maps (compiler-forced)
- `apps/web/src/test/__tests__/campaigns.test.ts` — correction cases

**Key changes**:
- `XPLogSource = 'dm_award' | 'manual_edit' | 'level_up' | 'dm_correction'`
- `awardXP(characterId: string, gain: number, correction?: boolean): Promise<void>`
  - `correction` false/absent → unchanged: `gain` positive int, source `dm_award`
  - `correction` true → `gain` signed non-zero int; reject (400) if
    `doc.xp + gain < 0`; source `dm_correction`; same authz (DM-of-owner,
    no self-correct), same log-append pattern
- Route body `{ gain, correction }`; `awardXP(id, Number(body?.gain), Boolean(body?.correction))`
- `SOURCE_LABELS.dm_correction = 'DM Correction'`, `SOURCE_ICONS.dm_correction = '🔧'`

**Verify**: `pnpm test` — new cases: DM correction lowers XP + logs
`dm_correction` with signed delta; correction that would go below 0 → 400;
zero gain → 400 (both modes); non-DM/self → 403; existing `dm_award` cases
still green. `pnpm typecheck` passes (proves both source maps updated).

---

## Phase 2: DM correction UI on the `/view` page

Reuse `XPBar` in a `dm-correction` variant so a DM on `/characters/[id]/view`
gets an inline signed-delta editor that posts to Phase 1's endpoint and
refetches. Builds on Phase 1.

**Files**:
- `apps/web/src/lib/api/campaigns.ts` — new client wrapper `correctXP`
- `apps/web/src/components/character-sheet/header/XPBar.tsx` — `variant` prop
- `apps/web/src/components/character-sheet/header/types.ts` — prop type
- `apps/web/src/components/character-sheet/CharacterSheetHeader.tsx` — pass variant/handler through
- `apps/web/src/app/(app)/characters/[id]/view/page.tsx` — enable XP editor, `handleCorrectXP`

**Key changes**:
- `correctXP(characterId: string, delta: number): Promise<{ error: { message: string } | null }>`
  — POST `award-xp` with `{ gain: delta, correction: true }` (mirrors `awardXP` wrapper)
- `XPBar` prop `variant?: 'owner' | 'dm-correction'` (default `'owner'`):
  - `dm-correction` renders the inline editor even on a `readOnly` sheet
  - skips `applyXPModifiers` (raw signed delta, both signs)
  - submits via `onCorrectXP?.(delta)` not `onAdjustXP`; label "Correct XP" both signs
- `view/page.tsx`: `handleCorrectXP(delta)` → `await correctXP(id, delta)`;
  on `error` show message, else refetch `fetchCharacterWithNotes(id)` (no
  optimistic write — follow DM-panel pattern, design decision 8)

**Verify**: `pnpm typecheck` + `pnpm test` green. Manual (`pnpm dev`): as a DM,
open a party member via roster → `/view`, enter `-1350`, submit; XP drops,
XP History shows a "DM Correction 🔧" entry attributed to the DM. Owner sheet
XPBar unchanged (default variant).

---

## Phase 3: Owner Set-mode toggle + optimistic-update fix

Add an Add/Set switch to the owner XPBar editor (Set sends the typed value as
the absolute total to the existing `adjust-xp` endpoint), and make the sheet
page reconcile a failed adjust. No server change.

**Files**:
- `apps/web/src/components/character-sheet/header/XPBar.tsx` — mode toggle
- `apps/web/src/app/(app)/characters/[id]/page.tsx` — `handleAdjustXP` rollback

**Key changes**:
- XPBar internal `mode: 'add' | 'set'` state (owner variant only):
  - `add` → today's behavior (delta, modifier on positive)
  - `set` → `onAdjustXP?.(Math.max(0, parsedValue))` — typed value is the new
    total; no modifier math
- `handleAdjustXP(newTotal)`: capture `prev = character.xp`; optimistic set;
  `const err = await adjustXP(id, newTotal)`; if `err` restore `prev` + surface message

**Verify**: `pnpm test` green (owner `adjustXP` server behavior unchanged;
Set-mode is client conversion). Manual: as owner, toggle Set, type an exact
total → XP becomes that value, logged `manual_edit`; simulate a failed call
(e.g. offline) → XP reverts, error shown.

---

## Testing Checkpoints

- **After Phase 1**: `award-xp` accepts `{ correction: true }`; corrections
  logged as `dm_correction` with signed delta, floored at 0, DM-only; award
  mode and all prior tests unchanged. Enum + both history maps compile.
  → API-complete; usable via curl even if Phases 2–3 slip.
- **After Phase 2**: DM can correct a character's XP from `/view`; entry shows
  "DM Correction" in history; owner XPBar untouched.
- **After Phase 3**: owner can Set an absolute total (not just deltas); failed
  owner adjusts roll back on screen.

## Notes / Slicing Caveats

- Phase 1 is the only slice that must land for the issue's core ("audit trail
  stays honest") — 2 and 3 are UX on top and each degrade gracefully if cut.
- Phase 2 depends on Phase 1's endpoint; Phase 3 is fully independent (could
  run before or in parallel).
- Risk carried from design: if the `XPBar` variant/mode multiplexing gets
  tangled (Phase 2/3), fall back to a small standalone `DMCorrectXP` control
  on `/view` rather than overloading XPBar (design Open Risks).
