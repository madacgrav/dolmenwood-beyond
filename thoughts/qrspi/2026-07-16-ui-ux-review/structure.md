# Structure Outline

## Approach
Deliverable is **9 GitHub issues** in `madacgrav/dolmenwood-beyond`, not app code.
The classic vertical-slice model (DB→API→UI) does not apply — each "slice" is one
self-contained issue. Slices are ordered defects-first (Track A, immediately
valuable) then structural (Track B). Umbrella issue #5 is created before #6-#9 so
they can reference it. Verification per issue = created, correctly labeled, body
renders, `file:line` refs resolve.

**Note (vertical-slice deviation):** per the skill's escape hatch, this work
cannot be sliced across code layers because it produces no code this cycle. Phases
below are issue-creation batches, each independently valuable.

## Shared issue skeleton (every issue uses this body)
```
## Problem
<one paragraph, the felt symptom>

## Evidence
<bulleted file:line refs from research.md>

## Proposed direction
<the design.md direction — not a full impl>

## Acceptance criteria
- [ ] <verifiable outcomes>

## Notes / constraints
<risks, dependencies on other issues>
```
Labels drawn only from existing set (`bug`, `enhancement`, `platform`,
`character-management`, `magic`). No new labels.

---

## Phase 1: Track A defect issues (4)
Create the 4 behavior-defect issues. Highest priority, no dependency on Track B.

**Issues**:
- **A1 — Silent inventory-fetch failure**
  Evidence: `use-inventory.ts` exposes only `loading` (no error); `listInventory`
  returns `[]` on `!res.ok` (`lib/api/inventory.ts:39`); contrast
  `use-characters.ts:11-19`. AC: `use-inventory` exposes `error`; `InventoryTab`
  renders an error branch; failed fetch is distinguishable from empty.
  Labels: `bug`, `character-management`.
- **A2 — Double-tappable add-forms**
  Evidence: `AddItemForm`/`AddSpellForm`/`AddRetainerForm` have no loading/disabled
  submit; contrast `SpendForm.tsx:95-106`, `RestockSheet.tsx:191-218`. AC: each
  form disables + label-swaps while in flight; double-submit prevented.
  Labels: `bug`, `character-management`.
- **A3 — Fake offline toggle**
  Evidence: `OfflineModeSection.tsx` writes `localStorage['dolmenwood-offline']`,
  read nowhere; real offline is `next-pwa` (`next.config.ts:11-26`), disconnected.
  AC: toggle either drives real behavior or is replaced by a `navigator.onLine`
  banner; no dead localStorage key. Labels: `bug`, `platform`.
- **A4 — Tab-switch inventory refetch**
  Evidence: `characters/[id]/page.tsx:43` refetches inventory every tab switch;
  tabs remount (147-151); AC-sync comment (41-42). AC: inventory not refetched on
  every switch while AC stays correct; constraint documented in issue.
  Labels: `enhancement`, `character-management`.

**Verify**: `gh issue list --label bug` shows A1-A3; A4 under `character-management`.
Each body renders with resolvable refs.

---

## Phase 2: Umbrella styling issue (1)
Create the parent that Track B children reference.

**Issue**:
- **B5 — Revive `ui/` primitives (Tailwind) as house style**
  Evidence: `Button.tsx`/`Card.tsx` zero JSX usages; 1489 inline `style={{}}` /
  138 files; target pattern `Button.tsx:17-30` + `cn()` (`lib/utils.ts:1-6`). AC:
  issue defines the Tailwind-arbitrary-value house style, states migration is
  **opportunistic** (no big-bang), lists child issues #6-#9 as the migration
  vehicles. Labels: `enhancement`, `platform`.

**Verify**: issue exists; its number captured for cross-linking in Phase 3.

---

## Phase 3: Track B structural children (4)
Create the 4 child issues, each linking back to B5.

**Issues**:
- **B6 — Shared `Modal` primitive**
  Evidence: 5 hand-rolled modals (`BattleModal.tsx:26`, `DeleteAccountModal.tsx:21`,
  `DeleteSessionModal.tsx:13`, `PromoteRetainerModal.tsx:25`, inline
  `page.tsx:154`) with diverging zIndex/scrim/radius. AC: one `ui/Modal` with
  shared overlay/panel/action-row + tokens; issue lists the 5 migration targets.
  Labels: `enhancement`.
- **B7 — Consolidate the two HP bars**
  Evidence: `ui/HPBar.tsx` (1 use) vs `header/HPBar.tsx:13-88`; duplicated
  0.66/0.33 threshold math. AC: single source for percent/color; header edit
  controls compose it. Labels: `enhancement`, `character-management`.
- **B8 — Shared `EmptyState` + loading/error contract**
  Evidence: 4+ per-component empty literals (`InventoryTab.tsx:117`,
  `SpellBookSection.tsx:55`, `PreparedSpellsSection.tsx:53`,
  `RetainersSection.tsx:76`); per-page skeletons; only 2 route `loading.tsx`. AC:
  one `EmptyState`, one skeleton component, documented hook loading/error contract.
  Labels: `enhancement`.
- **B9 — Shared form `Field`/`Input` primitives**
  Evidence: only `magic/types.ts:15-30` INPUT/SELECT consts shared (1 consumer);
  every other add-form repeats inline field styles. AC: `ui/` field components;
  add-forms adopt them. Labels: `enhancement`, `character-management`.

**Verify**: `gh issue list --label enhancement` shows B5-B9; each B6-B9 body
references B5's issue number.

---

## Testing Checkpoints
- **After Phase 1**: 4 defect issues exist (A1-A3 `bug`, A4 `character-management`),
  each with problem/evidence/AC/labels. Independently actionable.
- **After Phase 2**: B5 umbrella exists; issue number recorded.
- **After Phase 3**: B6-B9 exist, each cross-linked to B5. Full backlog of 9.
- **Resume signal**: `gh issue list --search "in:title (inventory OR offline OR
  Modal OR HPBar OR EmptyState OR primitives)"` — count of matching open issues
  tells you which phases already ran (dedupe before re-creating).

## Decisions (locked)
- **No milestone/project board** — labels only.
- **Assignee: `madacgrav`** — all 9 issues self-assigned (`gh issue create --assignee madacgrav`).
