# Design Discussion

## Goal of this cycle
The UI feels clunky. This cycle **produces a series of GitHub issues** (repo
`madacgrav/dolmenwood-beyond`) capturing a UI/UX expert's findings — a
prioritized, actionable backlog. **No app code ships this cycle.** Later QRSPI
phases (structure/plan/implement) will scope and build the individual issues.

## Current State
Grounded in `research.md`:
- **Inline `style={{}}` is the de facto styling system** — 1489 uses / 138 files.
  The 3 `ui/` primitives are near-dead: `Button.tsx`/`Card.tsx` have **zero** JSX
  usages; `ui/HPBar.tsx` has one (`CharacterCard.tsx:7`). Tailwind v4 configured,
  barely consumed for components.
- **Duplication over abstraction**: 5 hand-rolled modal shapes with diverging
  zIndex/scrim/radius (`BattleModal.tsx:26`, `DeleteAccountModal.tsx:21`,
  `DeleteSessionModal.tsx:13`, `PromoteRetainerModal.tsx:25`, + inline delete in
  `characters/[id]/page.tsx:154`); 2 HP bars with copy-pasted threshold math
  (`ui/HPBar.tsx` vs `header/HPBar.tsx:13-88`); per-file form styles;
  per-component skeletons/empty-states/error strings.
- **Inconsistent feedback maturity**: Spend/Restock/Light have loading/error/
  success UI; `AddItemForm`/`AddSpellForm`/`AddRetainerForm` have none →
  double-tap possible.
- **Silent failure gap**: `use-inventory.ts` returns `[]` on fetch error (no error
  field); a failed load is indistinguishable from empty. `use-characters.ts` does
  it right (explicit `error`).
- **Fake offline toggle**: `OfflineModeSection.tsx` writes
  `localStorage['dolmenwood-offline']`, read nowhere. Real offline is `next-pwa`
  service worker, disconnected from the toggle.
- **Tab-switch cost**: `characters/[id]/page.tsx:43` refetches inventory on every
  tab switch; tabs unmount/remount (147-151).
- Mobile-only (no breakpoints); 44px touch target enforced globally
  (`globals.css:89-95`) yet re-declared inline in many components.

## Desired End State
A set of **GitHub issues** in `madacgrav/dolmenwood-beyond`, each self-contained
(problem, evidence with `file:line`, proposed direction, acceptance criteria,
labels). Verify by: issues created, correctly labeled, grouped so an implementer
can pick any one independently. Two tracks:

### Track A — Defect issues (behavior, agreed in design Q3)
1. **Silent inventory-fetch failure** — add explicit `error` to `use-inventory.ts`
   mirroring `use-characters.ts`; surface it in `InventoryTab`. Label: `bug`,
   `character-management`.
2. **Double-tappable add-forms** — add in-flight disabled + label swap to
   `AddItemForm`/`AddSpellForm`/`AddRetainerForm`, matching `SpendForm`/
   `AddMountForm`. Label: `bug`, `character-management`.
3. **Fake offline toggle** — either wire `dolmenwood-offline` to real behavior or
   remove it and surface a real `navigator.onLine` banner. Label: `bug`,
   `platform`.
4. **Tab-switch inventory refetch** — avoid refetch/remount churn on every tab
   switch (cache items, or refetch only when inventory mutates). Label:
   `enhancement`, `character-management`.

### Track B — Structural / styling issues (direction, agreed in design Q2)
5. **Revive `ui/` primitives (Tailwind)** — make `Button`/`Card` the real,
   adopted primitives; establish the Tailwind-arbitrary-value + `cn()` pattern
   (`Button.tsx:17-30`) as the house style. Umbrella/parent issue. Label:
   `enhancement`, `platform`.
6. **Shared `Modal` primitive** — one overlay/panel/action-row component; migrate
   the 5 hand-rolled modals onto it (shared zIndex/scrim/radius tokens). Label:
   `enhancement`.
7. **Consolidate the two HP bars** — single source for percent/color threshold
   logic; header edit-controls compose it. Label: `enhancement`,
   `character-management`.
8. **Shared `EmptyState` + loading/error conventions** — one `EmptyState`, one
   skeleton, a documented loading/error contract for hooks. Label: `enhancement`.
9. **Shared form `Field`/`Input` primitives** — promote `magic/types.ts`
   INPUT/SELECT consts into shared `ui/` field components; adopt across add-forms.
   Label: `enhancement`.

## Patterns to Follow
- **Adopt** the Tailwind + `cn()` + arbitrary-CSS-var pattern already in
  `ui/Button.tsx:17-30`, `ui/Card.tsx:11-15`, `lib/utils.ts:1-6` — this is the
  target house style per design Q2.
- **Adopt** `use-characters.ts:11-19` error-exposure pattern as the hook contract
  (loading + error both surfaced).
- **Adopt** `SpendForm.tsx:95-106` / `RestockSheet.tsx:191-218` loading/error/
  success feedback as the form-submit standard.
- **Adopt** `settings/components/styles.ts` shared-const idea, but graduate it to
  real `ui/` components rather than loose consts.
- **Do NOT follow**: per-file inline modal/form/empty-state duplication; silent
  `[]`-on-error (`inventory.ts:39`); redundant inline `minHeight:44px` where
  `globals.css:89-95` already enforces it; duplicate dark-mode declaration
  (`globals.css:29-41` and `44-54`).

## Design Decisions
1. **Deliverable = GitHub issues, not code** — user chose this over shipping fixes
   now. Keeps the "expert review" framing; each issue is independently pickable.
2. **Styling target = revive `ui/` primitives (Tailwind)** — user chose over
   "keep inline / extract consts". Collapses the two competing styling systems
   into one; issues #5-#9 carry the migration, staged so no single mega-PR.
3. **All 4 named defects in scope** — issues #1-#4.
4. **Issue granularity** — one concern per issue; #5 is an umbrella that #6-#9
   reference, so partial adoption is fine and PRs stay reviewable.
5. **Labels reuse existing set** — `bug`, `enhancement`, `platform`,
   `character-management`, `magic` where it fits; no new labels created.

## What We're NOT Doing
- Not writing/refactoring app code this cycle — issues only.
- Not migrating every inline `style={{}}` site (1489 of them) — issues define the
  primitives and target areas; wholesale migration is out of scope, done
  opportunistically as files are touched.
- Not adding responsive/desktop breakpoints — app stays mobile-first.
- Not adding a validation library — form issues keep the existing guard-clause
  approach, just standardize feedback.
- Not creating new GitHub labels.
- Not touching the `next-pwa` service-worker config beyond what the offline-toggle
  issue (#3) needs.

## Open Risks
- "Clunky" is subjective; issues target *structural* causes (duplication,
  inconsistent feedback) + measurable defects, but may not fully match the user's
  felt experience. A follow-up runtime UX pass (animation/layout-shift profiling)
  is noted as out of scope in research Open Areas.
- Reviving `ui/` primitives risks a long-lived half-migrated state (two systems
  coexisting). Umbrella issue #5 should state the migration is opportunistic, not
  a blocking big-bang.
- Tab-switch refetch (#4) fix depends on whether AC-sync correctness
  (`page.tsx:41-42` comment) still holds if inventory isn't refetched — issue must
  flag that constraint.
