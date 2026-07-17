# Design Discussion — Manual XP Adjustment (issue #65)

## Current State

The XP subsystem already has an append-only audit log and three writers
(research.md Q1-Q3):

- `XPLogSource = 'dm_award' | 'manual_edit' | 'level_up'` and `XPLogEntry`
  (`packages/types/src/index.ts:186-196`); log embedded as
  `CharacterDoc.xpLog?: XPLogEntry[]` (`apps/web/src/lib/cosmos/types.ts:169`).
- **Owner correction already works.** `adjustXP` accepts an absolute
  `newTotal ≥ 0`, derives the signed delta server-side, logs `manual_edit`
  (`apps/web/src/lib/data/characters.ts:141-157`). The XPBar exposes it:
  positive input = "Add XP" (client applies `applyXPModifiers`), negative
  input = "Correct XP" (raw), both converted to `Math.max(0, xp + gain)`
  (`apps/web/src/components/character-sheet/header/XPBar.tsx:28-38`).
- **DM has no correction path.** `awardXP` requires a positive integer `gain`,
  blocks self-award, requires `isDMOfAccount`
  (`apps/web/src/lib/data/campaigns.ts:294-317`). A DM who enters 1500
  instead of 150 cannot lower it.
- A DM per-character screen exists: `/characters/[id]/view`
  (`apps/web/src/app/(app)/characters/[id]/view/page.tsx`) — read-only
  referee sheet; owners are redirected to the editable sheet (lines 45-51),
  so anyone left on this page is a DM-of-owner. It renders
  `CharacterSheetHeader` with `readOnly` (lines 99-106). Reached from the
  roster row (`MemberList.tsx:62`).
- Owner sheet's optimistic update ignores the API error result — no rollback
  (`apps/web/src/app/(app)/characters/[id]/page.tsx:51-55`).

## Desired End State

1. **DM correction**: a DM viewing a player character can apply a signed XP
   correction (positive or negative delta). Server enforces DM-of-owner,
   forbids self-correction, floors the resulting total at 0, and logs a new
   `dm_correction` entry so it's distinguishable from a `dm_award` in the
   XP History page.
2. **Owner set-vs-delta clarity**: the XPBar editor gains an explicit
   "Set total" mode alongside today's delta mode, so a player can type the
   exact correct total instead of computing a delta in their head. Still
   logs `manual_edit` via the existing `adjust-xp` endpoint.
3. **Honest optimistic updates**: a failed adjust/correct call no longer
   leaves stale XP on screen.

Verification: unit tests on the loosened `awardXP` (authz, validation, log
entry shape) and set-mode conversion; manual pass — DM lowers a wrong award
from the view page, entry shows as "DM Correction" in XP History.

## Patterns to Follow

- **Mutation + log append in one doc replace** inside the
  `mutateCharacterDoc` optimistic-concurrency loop, authz inside the
  fetch-authorized closure so it re-runs on ETag retries
  (`apps/web/src/lib/data/campaigns.ts:297-303`, research Cross-Cutting).
- **Log append spread**: `doc.xpLog = [...(doc.xpLog ?? []), entry]` — never
  edit or delete existing entries (append-only corrections).
- **Route shape**: thin POST handler, `Number(body?.x)` coercion,
  `handleRouteError` (`award-xp/route.ts:7-16`).
- **Client wrapper shape**: `{ error }` result object like `awardXP`
  (`apps/web/src/lib/api/campaigns.ts:107-118`).
- **Source label/icon maps**: extend `SOURCE_LABELS`/`SOURCE_ICONS`
  (`xp-log/page.tsx:12-22`) — both are `Record<XPLogSource, string>` so the
  compiler flags the missing key when the enum grows.
- **Anti-pattern — do NOT copy**: the sheet page's fire-and-forget optimistic
  update (`page.tsx:51-55`, flagged in research Q5). New/updated call sites
  must check the wrapper's error result and reconcile.

## Design Decisions

1. **Scope: owner + DM** (user decision). DM correction is the real gap;
   owner side gets the set-vs-delta UX improvement.
2. **Server mechanism: loosen `awardXP`** (user decision) rather than a new
   data function or widening `adjustXP` authz. `awardXP` keeps its existing
   authz (DM-of-owner, no self) and gains a correction mode.
3. **Explicit `correction` flag, not sign-inference.** Because corrections
   get their own log source (decision 4), a positive correction (+50 to fix
   an under-award) is indistinguishable from an award by sign alone. Body
   becomes `{ gain, correction?: boolean }`:
   - default (absent/false): today's behavior exactly — positive integer
     only, `dm_award`.
   - `correction: true`: signed non-zero integer; resulting total
     `doc.xp + gain` must be ≥ 0 (mirror `adjustXP`'s floor, 400 otherwise);
     logs `dm_correction`.
   Zero gain stays rejected in both modes.
4. **New `dm_correction` log source** (user decision). Add to `XPLogSource`
   (`packages/types/src/index.ts:186`) and to the history page maps —
   proposed label "DM Correction", icon 🔧. `XPLogEntry` shape is unchanged;
   old entries unaffected (enum growth is backward-compatible).
5. **DM corrections are delta-based, not absolute set.** Consequence of
   loosening `awardXP` (which takes `gain`). The DM sees the current total
   on the view page and enters the difference. Absolute set stays
   owner-only via `adjustXP`. Acceptable: the DM's mistake is an award
   delta, so the fix is naturally a delta.
6. **DM UI on `/characters/[id]/view`** (user decision). The page already
   guarantees the visitor is a DM-of-owner (owner redirect). Reuse `XPBar`
   with a correction variant instead of building a new control: a prop
   (e.g. `variant: 'owner' | 'dm-correction'`) that (a) enables the inline
   editor despite the read-only sheet, (b) skips `applyXPModifiers` — DM
   corrections are always raw, both signs, (c) submits the raw signed delta
   through a new client wrapper to `award-xp` with `correction: true`,
   (d) labels the input "Correct XP" for both signs. Owner behavior
   untouched by default.
7. **Owner set-mode: toggle inside the existing XPBar editor.** A small
   Add/Set mode switch; Set mode sends the typed value as the absolute
   `newTotal` (validated ≥ 0) to the existing `adjust-xp` endpoint — no
   server change needed for the owner side. No modifier math in Set mode.
8. **Fix optimistic-update handling where we touch it.** `handleAdjustXP`
   (`page.tsx:51-55`) checks the wrapper result; on error, restores the
   previous XP and surfaces the message. The DM view page follows the DM
   panel's pattern instead: no optimistic write, refetch after success
   (`DungeonMasterView.tsx:91-129`).

## What We're NOT Doing

- No editing or deleting existing XP log entries — corrections are new
  appended entries only.
- No DM absolute-set of XP, and no DM path through `adjustXP`.
- No changes to `levelUp`, level thresholds, or the level-up log.
- No touching `CharacterCampaignData.xpEarnedThisCampaign` (no mutation
  path exists today; out of scope — research Open Areas).
- No bulk-correction in `XPAwardPanel` — the panel stays positive-award
  only; corrections are per-character on the view page.
- No new authz helpers — existing `isDMOfAccount` / owner checks suffice.

## Open Risks

- **Exhaustiveness of `XPLogSource` consumers**: research found the two maps
  on the history page; other switches on the union (if any exist outside the
  researched files) will surface as compile errors when the enum grows —
  low risk, TypeScript catches it.
- **XPBar variant creep**: XPBar already multiplexes add/correct semantics;
  adding variant + set-mode risks a tangled component. If it gets messy,
  fall back to a tiny separate `DMCorrectXP` control on the view page rather
  than forcing reuse.
- **`correction` flag on an "award" endpoint** is a semantic overload
  (accepted trade-off of decision 2); mitigate with clear naming in the data
  layer (e.g. internal branch or wrapper named `correctXP`) and tests
  pinning both modes.
- **View page fetch shape**: the view page renders from
  `fetchCharacterWithNotes`; after a correction it must refetch to show the
  new total — confirm no cached roster (`MemberList`) staleness matters
  (roster refetches on campaign load already).
